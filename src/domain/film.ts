/* ============================================================
   MODÈLE — une fiche film, une seule définition
   ============================================================ */
import type { Film, LinkedWork, LinkPatch, Watch } from "../types";

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const makeFilm = (partial: Partial<Film> = {}): Film => ({
  id: uid(),
  title: "",
  year: "",
  director: "",
  poster: "", // URL TMDB, adresse collée, ou image réduite en data URI
  stills: [], // captures d'écran : { id, key (IndexedDB), caption }
  genres: [],
  themes: [],
  rating: 0,
  review: "",
  notes: "",
  linkedWorks: [],
  addedAt: Date.now(),
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
    genres: f.genres || [],
    themes: f.themes || [],
    linkedWorks: f.linkedWorks || [],
    stills: f.stills || [],
    watches: sortWatches(seedWatches(f)),
  }));

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

  const next: Partial<LinkedWork> = work.filmId
    ? { note }
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
    // la moitié d'en face : elle ne reçoit que la note, jamais le reste
    if (work.pairId && f.id === work.filmId)
      return {
        ...f,
        linkedWorks: (f.linkedWorks || []).map((w) =>
          w.pairId === work.pairId ? { ...w, note } : w
        ),
      };
    return f;
  });
};
