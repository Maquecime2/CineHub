/* ============================================================
   Les formes de données du projet, en un seul endroit.
   ============================================================ */

/** Une fiche vue, ou seulement mise de côté. */
export type FilmStatus = "watched" | "watchlist";

/** D'où vient la fiche : saisie à la main ou remontée d'un export CSV. */
export type FilmSource = "manual" | "letterboxd";

/** Les quatre natures d'œuvre qu'on peut relier à un film. */
export type LinkType = "book" | "painting" | "film" | "other";

/**
 * Une année est un nombre, ou la chaîne vide quand elle est inconnue.
 * Le vide vient des CSV, où la colonne peut manquer ; on le garde plutôt
 * que `null` parce que c'est directement affichable dans un champ.
 */
export type Year = number | "";

/** Une œuvre reliée à un film — c'est elle qui tisse le fil rouge. */
export interface LinkedWork {
  id: string;
  type: LinkType;
  title: string;
  creator: string;
  note: string;
  /** Renseigné quand le lien pointe vers un autre film de la collection. */
  filmId?: string | null;
}

/** Une capture d'écran. L'image vit dans IndexedDB, la fiche n'en garde que la clé. */
export interface Still {
  id: string;
  key: string;
  /** Version réduite : inutile de décoder du 4K pour une vignette de 110 px. */
  thumbKey?: string;
  caption: string;
  /** Définition et poids d'origine, affichés sous la vignette. */
  w?: number;
  h?: number;
  bytes?: number;
  type?: string;
}

export interface Film {
  id: string;
  title: string;
  year: Year;
  director: string;
  /** URL TMDB, adresse collée, ou image réduite en data URI. */
  poster: string;
  stills: Still[];
  genres: string[];
  themes: string[];
  rating: number;
  review: string;
  notes: string;
  linkedWorks: LinkedWork[];
  addedAt: number;
  status: FilmStatus;
  /** Le rayon du haut : ceux qu'on revoit. */
  chevet: boolean;
  /**
   * Mis de côté : la fiche quitte le mur et la constellation sans être
   * détruite. C'est le contraire d'une suppression.
   */
  archived: boolean;
  /** Rang manuel sur l'étagère ; `null` = jamais rangé à la main. */
  order: number | null;
  watchedAt: string | null;
  tmdbId: number | string | null;
  source: FilmSource;
}

/** Une page du carnet, qui n'appartient à aucun film. */
export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

/** Les trois rayons de l'étagère. */
export type ShelfKind = "chevet" | "main" | "reserve";

/** Un séparateur posé à la main entre deux boîtiers d'un rayon. */
export interface Divider {
  id: string;
  label: string;
  /** Le mur auquel il appartient : la vidéothèque ou la liste « à voir ». */
  wall: FilmStatus;
  /** Le rayon, à l'intérieur de ce mur. */
  shelf: ShelfKind;
  /** Position dans le rayon, exprimée dans le même repère que `Film.order`. */
  order: number;
  /**
   * Nombre de boîtiers sur la ligne qu'il ouvre. `null` ou absent : on suit
   * le réglage du rayon.
   */
  perRow?: number | null;
}

/** Le nombre de boîtiers par ligne : un chiffre, ou au fil de la largeur. */
export type PerRow = number | "auto";

/* ---------- Import ---------- */

/** Une ligne de CSV, une fois nettoyée et éventuellement enrichie via TMDB. */
export interface ImportRow {
  title: string;
  year: Year;
  /** `null` signifie « non noté », ce qui n'est pas la même chose que 0. */
  rating: number | null;
  watchedAt: string | null;
  uri: string | null;
  director?: string;
  genres?: string[];
  poster?: string;
  tmdbId?: number | string | null;
}

/** Ce que le fichier contenait réellement — affiché avant toute écriture. */
export interface ImportStats {
  lines: number;
  total: number;
  duplicatesInFile: number;
  withRating: number;
  withoutRating: number;
  skippedNoTitle: number;
}

export interface ParsedCsv {
  rows: ImportRow[];
  kind: FilmStatus;
  stats: ImportStats;
}

/** Une fiche existante et les seuls champs que l'import propose de changer. */
export interface FilmUpdate {
  film: Film;
  changes: Partial<Film>;
}

/** Le diff montré à l'écran : rien n'est écrit tant qu'il n'est pas validé. */
export interface ImportDiff {
  toCreate: Film[];
  toUpdate: FilmUpdate[];
  unchanged: Film[];
}

/* ---------- Constellation ---------- */

export interface SkyNode {
  id: string;
  kind: "film" | "work";
  label: string;
  sub: string;
  /** Nombre d'arêtes : dose la taille de l'astre et décide s'il est étiqueté. */
  degree: number;
  /** Films seulement. */
  rating?: number;
  filmId?: string;
  /** Œuvres seulement — au-delà de 1, l'astre est un pont entre deux films. */
  type?: LinkType;
  refs?: number;
}

/** Un nœud une fois placé par la relaxation. */
export type PlacedNode = SkyNode & { x: number; y: number };

export interface SkyLink {
  a: string;
  b: string;
  /** "cite" : un film renvoie à une œuvre. "peer" : deux fiches du mur reliées. */
  kind: "cite" | "peer";
}

/** Restreint la carte du ciel à un sous-ensemble de la collection. */
export interface SkyFilters {
  tags?: string[];
  genres?: string[];
}
