/* ============================================================
   DANS LE SILLAGE D'UN FILM — ce qui, chez vous, tient de celui-là

   La collection savait déjà répondre à deux questions. `chezvous`
   regarde le classeur entier et demande « qu'est-ce que j'ai oublié ? ».
   Le bureau des découvertes regarde dehors et demande « quoi d'autre
   existe-t-il ? ». Aucun des deux ne répond à celle qu'on se pose la
   fiche ouverte, le film encore en tête : « et à côté de CELUI-LÀ ? ».

   IL NE S'AGIT PAS DE GENRE. « Deux drames » ne rapproche rien — la
   moitié d'une collection est un drame. Ce qui rapproche vraiment deux
   films, c'est ce qui est RARE : la même personne derrière la caméra, la
   même à la musique, un motif qu'on n'a posé que trois fois. Les poids
   ci-dessous ne classent donc pas par force d'impression mais par
   RARETÉ : le chef opérateur passe devant le réalisateur, non parce
   qu'il compte plus, mais parce que le partager est plus improbable — et
   qu'apprendre « ces deux-là sont du même œil » vaut mieux
   qu'apprendre une chose qu'on savait déjà.

   Pur, hors ligne, déterministe : cette moitié-ci du panneau ne demande
   rien à personne, et c'est ce qui la rend utile sans clé TMDB. L'autre
   moitié vit dans `sillageLoin`.
   ============================================================ */
import { normaliser } from "./search";
import { directorsOf, weightOf } from "../taste";
import { motifById } from "./motifs";
import type { Film } from "../types";

/** La nature d'un rapprochement — ce qui fait que deux fiches se tiennent. */
export type Lien =
  "réalisation" | "image" | "musique" | "scénario" | "motif" | "thème" | "mot-clé" | "acteur";

export interface Rapprochement {
  type: Lien;
  /** Ce qui est partagé : un nom, l'intitulé d'un motif, une étiquette. */
  valeur: string;
}

export interface Voisin {
  film: Film;
  score: number;
  /** Les rapprochements trouvés, du plus fort au plus faible. */
  liens: Rapprochement[];
  /** Pourquoi celui-ci, en clair et en français. */
  raison: string;
  clé: string;
}

/* LES POIDS, ET CE QU'ILS DISENT.

   Un chef opérateur partagé est le fait le plus improbable de cette
   liste : on ne le remarque presque jamais tout seul, et c'est souvent
   lui qui explique qu'un film « ressemble » à un autre sans qu'on sache
   dire pourquoi. La musique vient juste avec.

   La réalisation pèse un peu MOINS, à rebours de l'intuition : elle est
   déjà visible partout ailleurs — au Générique, sur la fiche, dans les
   propositions de `chezvous`. La redire ici n'apprend rien. */
export const POIDS: Record<Lien, number> = {
  image: 3,
  musique: 3,
  réalisation: 2.5,
  scénario: 2,
  motif: 2,
  acteur: 1.5,
  /* LE MOT-CLÉ TMDB PÈSE MOINS QUE LE MOTIF, ET PLUS QUE RIEN.

     Un motif est un mot que vous avez choisi de suivre : le poser est un
     acte, et deux fiches qui le partagent le partagent parce que vous
     l'avez voulu. Un mot-clé est écrit par TMDB, sans vous — plus
     bruyant, parfois administratif (« based on novel »), mais il a un
     mérite décisif : il EXISTE sans qu'on ait rien saisi. Sur une
     collection importée, motifs et thèmes sont vides, et sans les
     mots-clés le sillage ne sait rapprocher que des noms de personnes. */
  "mot-clé": 1.4,
  thème: 1.2,
};

/* CE QU'UNE ACCUMULATION NE DOIT PAS POUVOIR FAIRE.

   Sans plafond, six motifs communs (12 points) écrasent un chef
   opérateur partagé (3 points) — et l'on remonte deux films qui
   partagent six banalités devant deux films qui partagent un regard.
   Chaque famille de signal est donc bornée : elle peut convaincre, elle
   ne peut pas emporter la mise à elle seule. */
export const PLAFONDS: Partial<Record<Lien, number>> = {
  motif: 5,
  thème: 3,
  /* Plafonné plus bas que les motifs alors qu'ils sont plus nombreux :
     deux films populaires partagent facilement six mots-clés de série
     (« sequel », « based on novel », « woman director »). Sans ce
     plafond, ils écraseraient un chef opérateur partagé à eux seuls. */
  "mot-clé": 3.5,
  acteur: 3.5,
};

/* LE CAST EST ORDONNÉ, ET C'EST UNE INFORMATION.

   `cast` porte les huit premiers noms au générique, dans l'ordre du
   billing. Traiter le huitième comme le premier ferait remonter des
   films qui ne partagent qu'un second rôle de trois répliques — et il y
   en a beaucoup, ce qui noierait tout le reste.

   Le rang décide donc du poids : plein pour la tête d'affiche, un quart
   pour le bas de la liste.

   C'EST LE RANG DANS LE PIVOT QUI COMPTE, et non le meilleur des deux.
   Le premier jet prenait le meilleur, en se disant que partager une tête
   d'affiche vaut d'être dit ; mais alors le huitième rôle du film qu'on
   regarde comptait à plein dès qu'il tenait le haut de l'affiche
   ailleurs — c'est-à-dire précisément le cas qu'on voulait écarter, et
   il y en a beaucoup. Le panneau parle DE CE FILM-LÀ : la question est
   ce que cette personne y est, pas ce qu'elle est autre part. */
const poidsDuRang = (rang: number): number => Math.max(0.25, 1 - rang * 0.11);

/** Le nom, comparable : sans accent, sans casse, sans espaces au bord. */
const clé = (nom: string): string => normaliser((nom || "").trim());

/* Les trois métiers que la récolte range dans `crew`, et le nom du lien
   correspondant. On ne parcourt PAS `crew` en aveugle : une clé inconnue
   du modèle n'aurait pas de poids, et vaudrait alors zéro en silence. */
const MÉTIERS: [clé: string, lien: Lien][] = [
  ["image", "image"],
  ["musique", "musique"],
  ["scénario", "scénario"],
];

/** L'ensemble des noms d'un métier, normalisés. */
const gensDe = (f: Film, métier: string): string[] =>
  (f.crew?.[métier] || []).map(clé).filter(Boolean);

/* Ce qu'on affiche devant un nom. « Roger Deakins » seul ne dit pas de
   quoi il est question ; « même chef op — Roger Deakins » le dit. */
const INTITULÉS: Record<Lien, string> = {
  image: "même chef op",
  musique: "même compositeur",
  réalisation: "même réalisation",
  scénario: "même scénario",
  motif: "motif partagé",
  thème: "thème partagé",
  "mot-clé": "sujet commun",
  acteur: "à l'affiche des deux",
};

/* La meilleure note qu'une fiche ait jamais reçue — la même mesure que
   `chezvous` : le journal des séances peut porter mieux que la note
   courante, et un film adoré une fois reste un film adoré. */
const meilleureNote = (f: Film): number => {
  const notes = (f.watches || []).map((w) => w.rating).filter((r): r is number => r != null);
  return Math.max(f.rating || 0, ...(notes.length ? notes : [0]));
};

/* LE GOÛT RECLASSE, IL NE SÉLECTIONNE PAS.

   Un film très proche mais qu'on a détesté doit descendre — pas
   disparaître : il reste vrai qu'il tient du pivot, et c'est parfois
   exactement ce qu'on veut savoir. Le multiplicateur est donc étroit,
   entre 0,7 et 1,3, ce que `weightOf` (−1 à 1) donne tout seul.

   Une fiche non notée vaut 0,35 chez `weightOf`, donc un multiplicateur
   au-dessus de 1 : ne pas avoir noté n'est pas avoir mal noté, et une
   collection importée de Letterboxd est notée pour un tiers à peine. */
const parLeGoût = (f: Film): number => 1 + 0.3 * weightOf(meilleureNote(f) || f.rating);

/* Comment se compte chaque espèce de lien quand elle arrive en nombre.
   Les métiers n'y figurent pas : on ne partage pas « trois chefs op »,
   et si cela arrivait, « + 3 autres » reste juste. */
const PLURIELS: Partial<Record<Lien, (n: number) => string>> = {
  motif: (n) => `motif${n > 1 ? "s" : ""}`,
  "mot-clé": (n) => `sujet${n > 1 ? "s" : ""} commun${n > 1 ? "s" : ""}`,
  thème: (n) => `thème${n > 1 ? "s" : ""}`,
  acteur: (n) => (n > 1 ? "noms à l'affiche" : "nom à l'affiche"),
};

/* Ce qu'on écrit sous le titre. On NOMME le lien le plus fort — c'est
   lui qui apprend quelque chose — et l'on résume le reste d'un compte.
   Tout énumérer ferait quatre lignes sous chaque affiche, et l'on ne
   lirait plus rien. */
function raisonDe(liens: Rapprochement[]): string {
  const [tête, ...reste] = liens;
  if (!tête) return "";
  const début = `${INTITULÉS[tête.type]} — ${tête.valeur}`;
  if (!reste.length) return début;
  /* QUAND LE RESTE EST D'UNE SEULE ESPÈCE, ON LA NOMME. « + 3 motifs »
     et « + 4 acteurs » se lisent ; « + 3 autres » ne dit rien de ce qui
     rapproche, et c'est précisément ce qu'on est venu chercher. */
  const espèces = new Set(reste.map((l) => l.type));
  if (espèces.size === 1) {
    const type = reste[0]!.type;
    return `${début}, + ${reste.length} ${PLURIELS[type]?.(reste.length) ?? "autres"}`;
  }
  return `${début}, + ${reste.length} autre${reste.length > 1 ? "s" : ""}`;
}

/** Tous les rapprochements entre deux fiches, du plus fort au plus faible. */
export function liensEntre(pivot: Film, autre: Film): Rapprochement[] {
  const liens: Rapprochement[] = [];

  /* La réalisation. Le champ peut porter plusieurs noms (« Coen, Coen »),
     d'où le découpage — le même que partout ailleurs. */
  const réals = new Map(directorsOf(autre).map((n: string) => [clé(n), n]));
  for (const nom of directorsOf(pivot) as string[]) {
    const eux = réals.get(clé(nom));
    if (eux) liens.push({ type: "réalisation", valeur: nom });
  }

  for (const [métier, lien] of MÉTIERS) {
    const eux = new Set(gensDe(autre, métier));
    for (const nom of pivot.crew?.[métier] || [])
      if (eux.has(clé(nom))) liens.push({ type: lien, valeur: nom });
  }

  /* Les motifs partagés — et, au passage, les mots-clés TMDB que ces
     motifs recouvrent déjà. Chaque motif du catalogue porte la liste des
     mots-clés qui le désignent (`motif.tmdb`) : c'est par elle que
     `suggestMotifs` les propose, et c'est par elle qu'on évite de dire
     deux fois la même chose sous une même affiche. */
  const motsCouverts = new Set<string>();
  const motifsEux = new Set(autre.motifs || []);
  for (const id of pivot.motifs || []) {
    if (!motifsEux.has(id)) continue;
    const motif = motifById(id);
    /* Un motif inconnu du catalogue est ignoré à l'affichage, jamais
       effacé de la fiche : la règle vaut partout dans le projet. */
    if (!motif) continue;
    liens.push({ type: "motif", valeur: motif.label });
    /* `motif.tmdb` mélange des libellés et des identifiants numériques.
       On ne garde que les libellés : `film.keywords` porte des noms, et
       un identifiant ne s'y compare pas. */
    for (const mot of motif.tmdb || []) if (typeof mot === "string") motsCouverts.add(clé(mot));
  }

  const thèmesEux = new Set((autre.themes || []).map(clé));
  for (const t of pivot.themes || [])
    if (thèmesEux.has(clé(t))) liens.push({ type: "thème", valeur: t });

  /* Les mots-clés de TMDB, sauf ceux qu'un motif partagé vient de dire :
     « Le héros meurt » suivi de « death of hero » ferait deux fois la
     même remarque sous la même affiche, et compterait deux fois. */
  const motsEux = new Set((autre.keywords || []).map(clé));
  for (const m of pivot.keywords || [])
    if (motsEux.has(clé(m)) && !motsCouverts.has(clé(m)))
      liens.push({ type: "mot-clé", valeur: m });

  const castEux = new Set((autre.cast || []).map(clé));
  for (const nom of pivot.cast || [])
    if (castEux.has(clé(nom))) liens.push({ type: "acteur", valeur: nom });

  return liens.sort((a, b) => POIDS[b.type] - POIDS[a.type]);
}

/* Le score d'un voisin, plafonds appliqués famille par famille. Séparé
   de `liensEntre` parce que les liens s'AFFICHENT et que le score se
   CLASSE : mélanger les deux rendait la pondération intestable. */
export function scoreDe(pivot: Film, autre: Film, liens: Rapprochement[]): number {
  const parFamille = new Map<Lien, number>();

  const castPivot = new Map((pivot.cast || []).map((n, i) => [clé(n), i]));

  for (const l of liens) {
    let p = POIDS[l.type];
    if (l.type === "acteur") p *= poidsDuRang(castPivot.get(clé(l.valeur)) ?? 7);
    parFamille.set(l.type, (parFamille.get(l.type) || 0) + p);
  }

  let total = 0;
  for (const [type, somme] of parFamille) {
    const plafond = PLAFONDS[type];
    total += plafond != null ? Math.min(somme, plafond) : somme;
  }
  return total * parLeGoût(autre);
}

/**
 * Ce que votre collection a de proche de ce film-là.
 *
 * Rend les voisins classés, chacun avec ses raisons. Aucun réseau, aucun
 * état, aucun hasard : les mêmes fiches donnent toujours la même liste.
 *
 * Les fiches ARCHIVÉES sont écartées — les avoir rangées est une façon
 * de dire qu'on ne veut plus les voir remonter. La watchlist, elle,
 * reste : « vous l'avez mis de côté, et il tient de celui-ci » est
 * précisément une chose qu'on veut apprendre. L'écran les sépare.
 */
export function sillageMaison(pivot: Film, films: Film[], combien = 8): Voisin[] {
  const out: Voisin[] = [];
  for (const film of films) {
    if (film.id === pivot.id || film.archived) continue;
    const liens = liensEntre(pivot, film);
    if (!liens.length) continue;
    out.push({
      film,
      score: scoreDe(pivot, film, liens),
      liens,
      raison: raisonDe(liens),
      clé: `sillage:${pivot.id}:${film.id}`,
    });
  }
  /* À score égal, le mieux noté puis le titre : sans ce dernier cran, deux
     fiches jumelles s'échangeraient de place d'un rendu à l'autre selon
     l'ordre du tableau, et un mur qui gigote n'est pas un mur. */
  return out
    .sort(
      (a, b) =>
        b.score - a.score ||
        meilleureNote(b.film) - meilleureNote(a.film) ||
        a.film.title.localeCompare(b.film.title, "fr")
    )
    .slice(0, combien);
}
