/* ============================================================
   Les formes de données du projet, en un seul endroit.
   ============================================================ */
import type { Strength, Relation } from "../domain/relations";

export type { Strength, Relation };

/** Une fiche vue, ou seulement mise de côté. */
export type FilmStatus = "watched" | "watchlist";

/**
 * D'où vient la fiche : saisie à la main, remontée d'un export CSV, ou
 * rangée depuis le bureau des découvertes.
 */
export type FilmSource = "manual" | "letterboxd" | "tmdb";

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
  /** Partagé par les deux moitiés d'un renvoi réciproque. */
  pairId?: string;
  /**
   * La nature du lien (`domain/relations`) — ce que la note disait en
   * français et que la carte ne savait pas lire. N'a de sens que sur un
   * renvoi vers une fiche : une mention libre n'est reliée qu'à elle-même.
   * Les deux moitiés portent des relations INVERSES, pas la même.
   */
  relation?: Relation;
  /** Trois crans ; voir `domain/relations`. Vaut 2 quand rien n'est dit. */
  force?: Strength;
}

/**
 * Ce qu'on peut retoucher sur un fil déjà tendu.
 *
 * Un renvoi vers une fiche du mur n'accepte que `note` : son titre et son
 * auteur appartiennent à CETTE fiche, et les réécrire ici ferait mentir la
 * carte. C'est le modèle d'écriture, dans `App`, qui fait respecter la
 * règle — le formulaire ne fait que ne pas la proposer.
 */
export type LinkPatch = Partial<
  Pick<LinkedWork, "type" | "title" | "creator" | "note" | "relation" | "force">
>;

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

/**
 * Une séance. La note est celle donnée CE jour-là — un film qu'on revoit
 * dix ans plus tard ne reçoit pas la même, et c'est justement ce qu'on
 * veut pouvoir regarder. `null` veut dire « vu sans noter », ce qui n'est
 * pas la même chose que zéro.
 */
export interface Watch {
  /** `YYYY-MM-DD`, comme `watchedAt` : c'est aussi la clé d'unicité. */
  date: string;
  rating: number | null;
  rewatch?: boolean;
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
  /**
   * Les huit premiers rôles, dans l'ordre du générique. Huit et pas le
   * générique entier : au-delà on entre dans les silhouettes, qui ne
   * relient jamais deux films et pèsent dans le `localStorage`.
   */
  cast: string[];
  /**
   * L'équipe, par métier : `image`, `musique`, `scénario`. Les clés
   * absentes valent « pas renseigné » — jamais une liste vide écrite
   * pour rien.
   */
  crew: Record<string, string[]>;
  /**
   * Durée en minutes. `null` — et jamais 0 — quand elle est inconnue :
   * un zéro entrerait dans les moyennes de l'almanach et les fausserait
   * en silence, là où un `null` s'écarte.
   */
  runtime: number | null;
  /** Langue d'origine, code ISO 639-1 (« fr », « ja »). Vide si inconnue. */
  language: string;
  /** Pays de production, deux au plus, codes ISO 3166-1 (« FR », « JP »). */
  countries: string[];
  /** La note du public TMDB sur 10 — de quoi mesurer son propre écart. */
  tmdbRating: number | null;
  /**
   * Les mots-clés de TMDB (« time loop », « neo-noir »), vingt au plus.
   * Ce sont les SEULS renseignements thématiques qui arrivent tout seuls :
   * `themes` et `motifs` se posent à la main, et sur une collection
   * importée ils restent vides. Ils ne remplacent ni l'un ni l'autre —
   * un motif est un mot qu'on a choisi de suivre, un mot-clé est ce que
   * TMDB a écrit — mais ils donnent au sillage de quoi rapprocher deux
   * films autrement que par les noms de leur équipe.
   *
   * ABSENT ET LISTE VIDE NE DISENT PAS LA MÊME CHOSE, et c'est ce qui
   * permet de compléter sans boucler. `undefined` : on n'a jamais
   * demandé. `[]` : on a demandé, TMDB n'en a pas — un court-métrage
   * obscur, par exemple. Sans cette distinction, « compléter les
   * fiches » réinterrogerait éternellement les mêmes films sans que rien
   * ne change jamais, ce contre quoi `isIncomplete` met déjà en garde.
   */
  keywords?: string[];
  themes: string[];
  /**
   * Les motifs du catalogue (`domain/motifs`), par `id`. À côté de
   * `themes` et jamais à sa place : `themes` est votre vocabulaire, libre
   * et orthographié comme vous voulez ; `motifs` est le vocabulaire commun,
   * figé, celui sur lequel une question comme « où le héros meurt » peut
   * porter. Un `id` inconnu du catalogue est ignoré à l'affichage, pas
   * effacé de la fiche.
   */
  motifs: string[];
  rating: number;
  review: string;
  notes: string;
  linkedWorks: LinkedWork[];
  addedAt: number;
  /**
   * La dernière fois que CETTE fiche a changé, en millisecondes.
   *
   * Ce n'est pas une curiosité d'affichage : c'est l'arbitre du jour où
   * deux appareils tiendront la même collection. Quand la même fiche a
   * été touchée des deux côtés, c'est la plus récente qui gagne, et
   * sans cette date il n'y a rien à comparer — on ne saurait que dire
   * « elles diffèrent ».
   *
   * Posé par le dépôt (`services/collection`) au moment d'écrire, et
   * jamais à la main : une date que chaque appelant se rappellerait de
   * mettre à jour est une date qu'un appelant oubliera.
   */
  updatedAt: number;
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
  /**
   * La dernière séance, en raccourci. Ce n'est PLUS la source de vérité :
   * c'est `watches` qui l'est, et ce champ en est le reflet, recalé par
   * `withWatches`. On le garde parce qu'une douzaine d'endroits demandent
   * « quand l'ai-je vu pour la dernière fois » — le tri de la
   * bibliothèque, la fusion d'import — et qu'aucun n'a besoin du journal
   * entier pour répondre.
   */
  watchedAt: string | null;
  /** Le journal des séances, de la plus récente à la plus ancienne. */
  watches: Watch[];
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

/**
 * Un séparateur posé à la main entre deux boîtiers d'un rayon.
 *
 * Les vues d'étagère ont pris la suite : les intercalaires ne sont plus
 * créés, mais restent lus au chargement d'une collection ancienne, que
 * `buildViewsFromLegacy` convertit en vue.
 */
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

/**
 * Les vues d'étagère, telles que `ensureViews` les tient en mémoire.
 *
 * Le contenu d'une vue — rangées, catégories, décors — vit dans
 * `shelf-views.js`, encore en JavaScript : `unknown` dit honnêtement que
 * ce module n'est pas typé plutôt que d'en inventer la forme ici.
 */
export interface ShelfViews {
  byWall: Record<FilmStatus, string[]>;
  docs: Record<string, unknown>;
}

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
  cast?: string[];
  crew?: Record<string, string[]>;
  runtime?: number | null;
  language?: string;
  countries?: string[];
  tmdbRating?: number | null;
  keywords?: string[];
  poster?: string;
  tmdbId?: number | string | null;
  /**
   * Les séances que CE fichier apporte. `diary.csv` en a une par ligne,
   * le flux Letterboxd une par entrée ; `rating` et `watchedAt` ci-dessus
   * restent ceux de la plus récente, pour que la fusion d'import n'ait
   * pas à changer de regard.
   */
  watches?: Watch[];
  /**
   * Quand la fiche a été mise de côté, si la source le sait. La watchlist
   * relevée en ligne ne donne pas de date, mais elle donne un ORDRE — le
   * plus récemment ajouté d'abord — et c'est de lui qu'on déduit ce
   * champ, faute de mieux. Absent, `makeFilm` datera de maintenant.
   */
  addedAt?: number;
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
  /** `fil` : un rassemblement nommé, qui n'est ni un film ni une œuvre. */
  kind: "film" | "work" | "fil";
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
  /** Fils seulement : la clé de teinte du fil, et le motif qui l'alimente. */
  couleur?: string;
  motif?: string | null;
  /** Vrai quand l'astre ne tient au ciel que parce qu'on l'y a épinglé. */
  épinglé?: boolean;
}

/** Un nœud une fois placé par la relaxation. */
export type PlacedNode = SkyNode & { x: number; y: number };

export interface SkyLink {
  a: string;
  b: string;
  /**
   * "cite" : un film renvoie à une œuvre. "peer" : deux fiches du mur
   * reliées à la main. "crew" : une parenté trouvée par la machine dans
   * les génériques — elle se dessine autrement, parce que la carte doit
   * dire du premier coup d'œil ce qui vient de vous.
   */
  kind: "cite" | "peer" | "crew" | "fil";
  /** Les raisons qui justifient un fil "crew" — de quoi l'expliquer en une ligne. */
  why?: Kinship[];
  /** "peer" seulement : la nature du lien, telle qu'écrite du côté `a`. */
  relation?: Relation;
  /** Ce qu'on a écrit sous le lien — côté `a` pour un "peer". */
  note?: string;
  force?: Strength;
}

/**
 * La NATURE d'une parenté, et non seulement son nom.
 *
 * « Decaë » ne dit pas grand-chose ; « image · Decaë » dit qu'on suit un
 * chef opérateur. `thème` est la seule qui ne vienne pas d'un générique
 * mais de vos propres mots-clés — elle mérite d'être distinguée des
 * autres, parce qu'elle est de vous.
 */
export type KinshipRole =
  "réalisation" | "interprétation" | "image" | "musique" | "scénario" | "thème";

export interface Kinship {
  role: KinshipRole;
  nom: string;
}

/** Restreint la carte du ciel à un sous-ensemble de la collection. */
export interface SkyFilters {
  tags?: string[];
  genres?: string[];
}
