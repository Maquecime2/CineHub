/* ============================================================
   L'ALLURE DU MUR — ce qui se règle sur la présentation en fiches
   ============================================================

   L'étagère a son atelier déco depuis longtemps ; le mur, lui, était une
   grille figée : deux cent dix pixels de colonne, une affiche de cent
   cinquante, et pas une poignée. Tout ce qui suit n'est que ça — les
   cotes qui étaient écrites en dur, sorties du composant et nommées.

   Un seul facteur commande la taille : une fiche est un objet, elle
   grandit d'un bloc. Régler séparément l'affiche, le titre et la légende
   permettrait surtout de fabriquer des fiches disgracieuses.

   Les catalogues sont des dictionnaires de facteurs, sur le modèle de
   `DECOR_SIZES` (`components/shelf/constants.tsx`) : une clé se persiste
   et se relit, un nombre nu ne se relit pas. */

/** Le calibre d'une fiche — facteur appliqué à TOUTES ses cotes. */
export const CARD_SIZES = {
  XS: { label: "minuscule", f: 0.62 },
  S: { label: "petit", f: 0.78 },
  M: { label: "moyen", f: 1 },
  L: { label: "grand", f: 1.25 },
  XL: { label: "très grand", f: 1.6 },
} as const;

/** L'écartement entre fiches, indépendamment de leur taille. */
export const SPREADS = {
  serre: { label: "serré", f: 0.5 },
  normal: { label: "normal", f: 1 },
  aere: { label: "aéré", f: 1.6 },
} as const;

/* Le désordre ne se retire pas, il se DOSE : les inclinaisons et les
   décalages restent semés par l'identifiant du film (`tiltOf`, `nudgeOf`),
   on ne fait que multiplier ce tirage. À zéro, le mur est au cordeau sans
   qu'aucune fiche n'ait changé de tirage — remonter d'un cran retrouve
   exactement le désordre qu'on avait. */
export const MESSES = {
  range: { label: "rangé", f: 0 },
  naturel: { label: "naturel", f: 1 },
  disperse: { label: "dispersé", f: 1.9 },
} as const;

/** Ce qui tient la fiche au mur. `auto` laisse le tirage décider. */
export const HANGS = {
  auto: { label: "au hasard" },
  pin: { label: "punaise" },
  tape: { label: "ruban" },
  none: { label: "rien" },
} as const;

export type CardSize = keyof typeof CARD_SIZES;
export type Spread = keyof typeof SPREADS;
export type Mess = keyof typeof MESSES;
export type Hang = keyof typeof HANGS;

/** Le décor de fond, exactement la forme que `wallStyle` sait lire. */
export interface WallDecor {
  paint?: string | null;
  pattern?: string | null;
  patternInk?: string | null;
  texture?: string | null;
}

export interface WallLook {
  size: CardSize;
  spread: Spread;
  mess: Mess;
  hang: Hang;
  decor: WallDecor | null;
}

/* Le mur ouvrait en `M`, et c'était trop gros : à deux cent dix pixels de
   colonne, un écran courant n'en montrait que cinq ou six. On ouvre donc
   un cran plus bas — les grands calibres restent à un clic pour qui veut
   revoir les affiches en grand. */
export const DEFAULT_WALL_LOOK: WallLook = {
  size: "S",
  spread: "normal",
  mess: "naturel",
  hang: "auto",
  decor: null,
};

/* L'allure de qui n'en demande pas. Elle n'est PAS le défaut du mur :
   une fiche posée ailleurs (les découvertes, par exemple) n'a pas à
   rapetisser parce que le mur, lui, ouvre plus petit. Neutre veut dire
   « comme avant qu'on puisse régler quoi que ce soit ». */
export const NEUTRAL_WALL_LOOK: WallLook = {
  size: "M",
  spread: "normal",
  mess: "naturel",
  hang: "auto",
  decor: null,
};

const keyOf = <T extends object>(cat: T, v: unknown, fallback: keyof T): keyof T =>
  typeof v === "string" && v in cat ? (v as keyof T) : fallback;

/* Les préférences viennent du disque, écrites par une version qui ne
   connaissait pas ces champs — ou par une plus récente que celle qui
   les relit. On ne fait donc jamais confiance à ce qu'on lit : chaque
   clé inconnue retombe sur son défaut, et le mur s'affiche. */
export function wallLookOf(saved?: Partial<WallLook> | null): WallLook {
  const s = saved || {};
  return {
    size: keyOf(CARD_SIZES, s.size, DEFAULT_WALL_LOOK.size),
    spread: keyOf(SPREADS, s.spread, DEFAULT_WALL_LOOK.spread),
    mess: keyOf(MESSES, s.mess, DEFAULT_WALL_LOOK.mess),
    hang: keyOf(HANGS, s.hang, DEFAULT_WALL_LOOK.hang),
    decor: s.decor && typeof s.decor === "object" ? s.decor : null,
  };
}

/* Les trois lectures d'une allure. Sans allure du tout, c'est la neutre
   qui répond — jamais celle du mur, qui n'a pas cours ailleurs. */

/** Le facteur de taille d'une allure, prêt à multiplier une cote. */
export const scaleOf = (look?: WallLook | null): number =>
  CARD_SIZES[look?.size || NEUTRAL_WALL_LOOK.size].f;

/** L'écart horizontal entre deux fiches, en pixels. */
export const gapOf = (look?: WallLook | null): number =>
  Math.round(34 * scaleOf(look) * SPREADS[look?.spread || NEUTRAL_WALL_LOOK.spread].f);

/** De combien on multiplie le désordre semé. */
export const messOf = (look?: WallLook | null): number =>
  MESSES[look?.mess || NEUTRAL_WALL_LOOK.mess].f;
