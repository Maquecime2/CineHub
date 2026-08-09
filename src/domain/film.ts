/* ============================================================
   MODÈLE — une fiche film, une seule définition
   ============================================================ */
import { inverseDe } from "./relations";
import type { Film, LinkedWork, LinkPatch, Watch } from "../types";

/* ============================================================
   L'IDENTIFIANT D'UNE FICHE — bon pour une collection, pas pour deux
   ============================================================

   Huit caractères de `Math.random` suffisent tant qu'un classeur ne
   parle qu'à lui-même : la chance de deux fiches identiques dans une
   seule collection est nulle en pratique. Le jour où deux classeurs se
   parlent, cette chance devient celle de deux collections qui se
   heurtent — et `Math.random` n'a jamais promis d'être unique ailleurs
   que chez soi.

   UUID version 7 : quarante-huit bits de temps en tête, le reste au
   hasard du générateur cryptographique. Deux propriétés qu'on veut
   toutes les deux — unique entre machines, et TRIABLE dans l'ordre où
   les fiches sont nées, ce qui fait d'un index de base de données un
   index qui ne se fragmente pas.

   ON NE REÉCRIT PAS LES ANCIENS, et c'est délibéré. Un identifiant de
   fiche est cité partout ailleurs : les rangées d'une étagère listent
   des identifiants, les fils rouges en relient deux, les renvois d'une
   fiche à l'autre en portent. Les renuméroter voudrait dire réécrire
   d'un seul geste six magasins qui ne sont pas versionnés ensemble, et
   un seul oubli casse un lien sans que rien ne le signale. L'unicité
   entre machines sera de toute façon assurée par le compte qui les
   porte, et deux collections ne se comparent pas par nos identifiants
   mais par `tmdbId`, qui désigne l'ŒUVRE et non la fiche. */
/* LE COMPTEUR QUI MANQUAIT — l'horodatage seul ne suffit pas.

   Une milliseconde, c'est long : un import en pose deux cents dedans.
   Toutes ces fiches portent alors le MÊME temps en tête, et l'ordre
   retombe sur le hasard qui suit — c'est-à-dire sur rien. La promesse
   « triable dans l'ordre des naissances » était fausse là où elle
   servait le plus, et c'est le test qui l'a dit.

   Douze bits de compteur juste après le marqueur de version, remis à
   zéro à chaque milliseconde nouvelle : c'est la méthode que la norme
   prévoit pour cela. Quatre mille quatre-vingt-seize fiches dans la
   même milliseconde le feraient déborder — on emprunte alors une
   milliseconde à l'avenir plutôt que de rendre deux fois le même rang. */
let dernièreMs = 0;
let compteur = 0;

export const uid = (): string => {
  const hasard = crypto.randomUUID?.();
  if (!hasard) {
    /* Sans générateur cryptographique — un vieux navigateur, un contexte
       non sécurisé — on retombe sur l'ancienne recette plutôt que de
       refuser d'écrire une fiche. */
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  let ms = Date.now();
  if (ms > dernièreMs) {
    dernièreMs = ms;
    compteur = 0;
  } else {
    /* Même milliseconde — ou horloge qui recule, ce qui arrive à la
       remise à l'heure : on garde notre temps à nous, qui ne recule
       jamais. */
    ms = dernièreMs;
    compteur += 1;
    if (compteur > 0xfff) {
      dernièreMs = ms + 1;
      ms = dernièreMs;
      compteur = 0;
    }
  }

  /* Un UUID s'écrit 8-4-4-4-12. On remplace les douze premiers
     demi-octets par l'horodatage, le marqueur de version par 7, et les
     douze bits suivants par le compteur ; la variante et les
     soixante-deux bits de queue restent ceux du navigateur. */
  const temps = ms.toString(16).padStart(12, "0").slice(-12);
  const rang = compteur.toString(16).padStart(3, "0");
  return (
    temps.slice(0, 8) +
    "-" +
    temps.slice(8, 12) +
    "-7" +
    rang +
    "-" +
    hasard.slice(19, 23) +
    "-" +
    hasard.slice(24)
  );
};

export const makeFilm = (partial: Partial<Film> = {}): Film => ({
  id: uid(),
  title: "",
  year: "",
  director: "",
  poster: "", // URL TMDB, adresse collée, ou image réduite en data URI
  stills: [], // captures d'écran : { id, key (IndexedDB), caption }
  genres: [],
  cast: [], // les huit premiers rôles ; voir `types`
  crew: {}, // image · musique · scénario
  runtime: null, // `null` et non 0 : une durée inconnue s'écarte des moyennes
  language: "",
  countries: [],
  tmdbRating: null,
  themes: [],
  motifs: [], // le vocabulaire commun ; voir `domain/motifs`
  rating: 0,
  review: "",
  notes: "",
  linkedWorks: [],
  addedAt: Date.now(),
  /* Née maintenant, donc modifiée maintenant. Le dépôt la réécrira à
     chaque changement réel — voir `horodater`. */
  updatedAt: Date.now(),
  status: "watched",
  chevet: false, // le rayon du haut : ceux qu'on revoit
  /* Mis de côté : la fiche quitte le mur et la constellation sans être
     détruite. C'est le contraire d'une suppression — elle reste entière,
     rangée dans la réserve de l'étagère, et revient d'un glissement. */
  archived: false,
  order: null, // rang manuel sur l'étagère ; null = jamais rangé à la main
  watchedAt: null,
  watches: [], // le journal des séances ; voir `withWatches`
  tmdbId: null,
  source: "manual",
  ...partial,
});

/* L'AFFICHE DE SECOURS — les initiales du titre.

   La règle est UNE : les premières lettres des deux premiers mots. Elle
   était recopiée sous chaque endroit qui dessine un film — `FilmPolaroid`,
   `shelf/items`, `shelf/layout` — et l'export de l'almanach en aurait
   fait une quatrième copie.

   Pire : la fiche en appliquait une AUTRE, `title.slice(0, 2)`. « Sans
   toit ni loi » devenait « SN » au mur et « SA » sur sa propre fiche,
   pour le même film. Deux images d'une même chose qui ne se ressemblent
   pas, c'est la chose qu'on cesse de reconnaître. */
export const initialsOf = (title = ""): string =>
  title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/* CE QU'EST UNE FICHE INCOMPLÈTE — au sens de ce que TMDB sait remplir.

   Le casting est le meilleur témoin : TMDB en donne un pour presque tout
   film de fiction, et son absence signale une fiche qui n'a jamais vu la
   récolte. La durée le confirme.

   On ne regarde PAS les pays ni la langue, et c'est délibéré : TMDB en
   laisse légitimement sans pour un court-métrage obscur. Les prendre
   pour un manque ferait réinterroger éternellement les mêmes fiches, à
   chaque passage, sans que rien ne change jamais. */
export const isIncomplete = (f: Pick<Film, "cast" | "runtime">): boolean =>
  (f.cast || []).length === 0 || f.runtime == null;

/* ------------------------------------------------------------
   LE JOURNAL DES SÉANCES
   ------------------------------------------------------------

   Un film vu trois fois n'est pas un film vu. La fiche ne portait qu'une
   date et qu'une note, et tout le reste était jeté à la lecture du CSV —
   alors que `diary.csv` et le flux Letterboxd donnent, l'un comme
   l'autre, une ligne par séance avec la note de ce jour-là.

   `watches` est la VÉRITÉ, `watchedAt` en est le reflet. Les deux ne
   peuvent pas diverger parce qu'on ne les écrit qu'ici. */

/** De la plus récente à la plus ancienne. */
export const sortWatches = (w: Watch[]): Watch[] =>
  [...w].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

export const watchCount = (film: Pick<Film, "watches">): number => (film.watches || []).length;

/* UNE SÉANCE PAR DATE, ET C'EST CE QUI REND UN RÉIMPORT INOFFENSIF.

   Repasser le même `diary.csv` trois fois ne doit pas donner un film vu
   neuf fois. La date est donc la clé : deux entrées du même jour sont la
   même séance, et la seconde ne fait que compléter la première — une
   note retrouvée ne doit pas être effacée par une séance qui n'en porte
   pas. C'est exactement le genre de dérive que personne ne remarque
   avant six mois de réimports. */
export const mergeWatches = (...lots: (Watch[] | undefined)[]): Watch[] => {
  const byDate = new Map<string, Watch>();
  for (const lot of lots)
    for (const w of lot || []) {
      if (!w?.date) continue;
      const prev = byDate.get(w.date);
      byDate.set(w.date, prev ? { ...prev, ...w, rating: w.rating ?? prev.rating } : w);
    }
  return sortWatches([...byDate.values()]);
};

/** Le seul chemin pour écrire des séances : il recale `watchedAt` avec. */
export const withWatches = <T extends Partial<Film>>(film: T, watches: Watch[]): T => {
  const merged = mergeWatches(watches);
  return { ...film, watches: merged, watchedAt: merged[0]?.date ?? null };
};

/* La note a-t-elle bougé depuis la fois d'avant ? On compare à la
   dernière séance NOTÉE, et non à la précédente : un revisionnage sans
   note ne rompt pas la chaîne, il n'a simplement rien à en dire. */
export const ratingDrift = (watches: Watch[]): (number | null)[] => {
  const ordered = sortWatches(watches);
  return ordered.map((w, i) => {
    if (w.rating == null) return null;
    const before = ordered.slice(i + 1).find((p) => p.rating != null);
    return before ? w.rating - before.rating! : null;
  });
};

/* D'une fiche d'avant le journal, on ne sait qu'une chose : elle a été
   vue une fois, tel jour, et notée ainsi. On l'écrit — c'est vrai, et
   c'est mieux que de laisser un compteur à zéro sous un film qui porte
   une date de séance.

   Le test porte sur `Array.isArray` et NON sur la longueur : un journal
   que l'utilisateur a vidé à la main est un tableau vide, pas un champ
   absent. Le confondre avec « jamais migré » ressusciterait la séance au
   chargement suivant — et `migrate` réécrit aussitôt dans le
   `localStorage`, donc la résurrection serait définitive. */
const seedWatches = (f: Partial<Film>): Watch[] => {
  if (Array.isArray(f.watches)) return f.watches;
  return f.watchedAt ? [{ date: f.watchedAt, rating: f.rating || null }] : [];
};

/* Les fiches enregistrées avant ces champs sont complétées au chargement.
   On en profite pour ramener `year` à un nombre : le tri par année faisait
   jusqu'ici de l'arithmétique sur des chaînes venues du CSV. */
export const migrate = (films: Partial<Film>[] | null | undefined): Film[] =>
  (films || []).map((f) => ({
    ...makeFilm(),
    ...f,
    year: f.year === "" || f.year == null ? "" : Number(f.year) || "",
    status: f.status === "watchlist" ? ("watchlist" as const) : ("watched" as const),
    chevet: !!f.chevet,
    archived: !!f.archived,
    order: typeof f.order === "number" ? f.order : null,
    /* UNE FICHE D'AVANT N'A PAS DE DATE DE MODIFICATION, et lui donner
       « maintenant » serait un mensonge utile aujourd'hui et coûteux
       demain : à la première synchronisation, toute la collection se
       prétendrait fraîche et écraserait ce qui viendrait d'en face. On
       prend donc la date d'AJOUT, qui est la dernière chose vraie qu'on
       sache de cette fiche. */
    updatedAt: typeof f.updatedAt === "number" ? f.updatedAt : f.addedAt || Date.now(),
    genres: f.genres || [],
    /* Les fiches d'avant le casting n'en portent pas. On ne va PAS le
       chercher ici : `migrate` tourne au chargement, hors ligne et sans
       clé TMDB. C'est un réimport qui le remplira, et le diff le
       montrera avant de l'écrire. */
    cast: f.cast || [],
    crew: f.crew || {},
    /* Comme le casting : les fiches d'avant ne les portent pas, et on ne
       va PAS les chercher ici — `migrate` tourne au chargement, hors
       ligne et sans clé. C'est le bouton « compléter les fiches » de
       l'onglet Import qui les remplit, diff à l'appui.

       `?? null` et non `|| null` : une durée légitime ne peut pas valoir
       zéro, mais la note TMDB d'un film inconnu, si — et `||`
       l'écraserait sans distinguer « zéro » de « absent ». */
    runtime: f.runtime ?? null,
    language: f.language || "",
    countries: f.countries || [],
    tmdbRating: f.tmdbRating ?? null,
    themes: f.themes || [],
    motifs: f.motifs || [],
    linkedWorks: f.linkedWorks || [],
    stills: f.stills || [],
    watches: sortWatches(seedWatches(f)),
  }));

/* ------------------------------------------------------------
   DATER CE QUI A VRAIMENT CHANGÉ
   ------------------------------------------------------------

   La règle est simple à dire et facile à rater : `updatedAt` doit
   changer quand la FICHE change, et pas quand l'objet change.

   Toute l'application travaille par recopie — `films.map(f => ...)`
   refait un objet neuf pour chacun des mille films alors qu'un seul a
   bougé. Dater sur l'identité des objets daterait donc toute la
   collection à chaque note tapée, et la première synchronisation
   renverrait mille fiches au lieu d'une.

   On compare donc les VALEURS, champ par champ. Le coût est celui d'une
   comparaison par film et par écriture, ce qui se mesure en
   microsecondes ; le mensonge évité, lui, se mesure en mégaoctets sur
   le réseau de quelqu'un. */

/** Les champs qui ne comptent pas dans « la fiche a-t-elle changé ». */
const HORS_COMPARAISON = new Set(["updatedAt"]);

const mêmeValeur = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  /* Les parties composées d'une fiche — le journal des séances, les
     renvois, les captures — sont de petites structures de données
     pures : les comparer sérialisées est exact et suffisamment rapide. */
  return JSON.stringify(a) === JSON.stringify(b);
};

/** Deux états d'une même fiche disent-ils autre chose l'un de l'autre ? */
export const aChangé = (avant: Film | undefined, après: Film): boolean => {
  if (!avant) return true;
  const clés = new Set([...Object.keys(avant), ...Object.keys(après)]);
  for (const c of clés) {
    if (HORS_COMPARAISON.has(c)) continue;
    if (!mêmeValeur(avant[c as keyof Film], après[c as keyof Film])) return true;
  }
  return false;
};

/**
 * Repose la date de modification sur les seules fiches qui ont bougé.
 *
 * Rend le MÊME objet pour une fiche inchangée : les vues sont mémoïsées
 * sur l'identité, et rendre une copie de chaque fiche à chaque écriture
 * referait toute l'étagère à chaque frappe.
 */
export const horodater = (avant: Film[], après: Film[], maintenant = Date.now()): Film[] => {
  const parId = new Map(avant.map((f) => [f.id, f]));
  let bougé = false;
  const suite = après.map((f) => {
    const vieux = parId.get(f.id);
    if (!aChangé(vieux, f)) {
      if (vieux && vieux !== f) bougé = true;
      return vieux ?? f;
    }
    bougé = true;
    return { ...f, updatedAt: maintenant };
  });
  /* Rien n'a bougé, pas même une recopie : on rend le tableau reçu.
     Rendre un tableau neuf ferait re-rendre toutes les vues qui
     l'observent, pour dire exactement la même chose. */
  return bougé ? suite : après;
};

/* ------------------------------------------------------------
   CE QUI SE PARTAGE, ET CE QUI NE SORT PAS D'ICI
   ------------------------------------------------------------

   La séparation se pose MAINTENANT, pendant qu'il n'y a pas de serveur
   pour la rendre urgente. Le jour où une collection se publie, la
   question « qu'est-ce qui part ? » se posera au milieu d'un
   formulaire, dans la précipitation, et la réponse facile sera « tout ».

   Deux choses ne sortent jamais, quelle que soit la visibilité choisie :
   les NOTES, qui sont un carnet intime et non une critique, et le
   JOURNAL DES SÉANCES, qui dit avec quelle régularité on a passé ses
   soirées — un relevé de présence dont personne d'autre n'a l'usage.

   La critique, la note chiffrée et la date de dernière séance, elles,
   sont ce qu'on publie quand on publie : c'est le propos même d'une
   vidéothèque partagée. */
export type FilmPublic = Omit<Film, "notes" | "watches">;

export const partiePublique = (f: Film): FilmPublic => {
  /* Nommés pour être écartés : une extraction par liste blanche
     laisserait tomber en silence tout champ ajouté plus tard, et une
     fiche publiée perdrait des morceaux sans que rien ne le dise. */
  const { notes: _notes, watches: _watches, ...reste } = f;
  return reste;
};

/* ------------------------------------------------------------
   Le fil rouge — retoucher un lien déjà tendu
   ------------------------------------------------------------ */

/* Ce qu'un fil accepte qu'on réécrive dépend de sa nature, et la règle
   vit ICI plutôt que dans le formulaire : une mention libre s'écrit
   entièrement à la main, tandis qu'un renvoi vers une fiche du mur tient
   son titre et son auteur de CETTE fiche. Les réécrire de ce côté-ci
   ferait mentir la carte — deux noms pour une même œuvre, selon le bout
   par lequel on la regarde.

   La note, elle, appartient au lien et non à l'une des deux fiches :
   elle dit la résonance ENTRE elles. Elle vaut donc des deux côtés, et la
   moitié réciproque la reçoit avec. C'est la même raison qui fait que
   défaire un lien le défait aux deux bouts.

   Fonction pure sur la collection entière : c'est la seule façon
   d'atteindre les deux moitiés d'un même fil en une écriture. */
export const editLinkedWork = (
  films: Film[],
  ownerId: string,
  workId: string,
  patch: LinkPatch
): Film[] => {
  const owner = films.find((f) => f.id === ownerId);
  const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
  if (!work) return films;

  const note = (patch.note ?? work.note ?? "").trim();
  const title = (patch.title ?? work.title ?? "").trim();
  // un fil sans titre n'aurait plus rien à dire : on laisse tout en place
  if (!work.filmId && !title) return films;

  /* La relation et la force appartiennent au lien, comme la note : elles
     disent ce qui se passe ENTRE les deux fiches. Elles valent donc des
     deux côtés — mais la relation s'y renverse (voir `inverseDe`), sans
     quoi chaque film se déclarerait la suite de l'autre. */
  const relation = patch.relation ?? work.relation;
  const force = patch.force ?? work.force;

  const next: Partial<LinkedWork> = work.filmId
    ? { note, relation, force }
    : {
        type: patch.type ?? work.type,
        title,
        creator: (patch.creator ?? work.creator ?? "").trim(),
        note,
      };

  return films.map((f) => {
    if (f.id === ownerId)
      return {
        ...f,
        linkedWorks: (f.linkedWorks || []).map((w) => (w.id === workId ? { ...w, ...next } : w)),
      };
    // la moitié d'en face : la note, la force, la relation inversée — jamais le reste
    if (work.pairId && f.id === work.filmId)
      return {
        ...f,
        linkedWorks: (f.linkedWorks || []).map((w) =>
          w.pairId === work.pairId ? { ...w, note, force, relation: inverseDe(relation) } : w
        ),
      };
    return f;
  });
};
