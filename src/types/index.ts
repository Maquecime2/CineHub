/* ============================================================
   The project's data shapes, in one place.
   ============================================================ */
import type { Strength, Relation } from "../domain/relations";

export type { Strength, Relation };

/** A card watched, or merely set aside. */
export type FilmStatus = "watched" | "watchlist";

/**
 * Where the card comes from: typed by hand, brought up from a CSV export,
 * or filed from the discovery desk.
 */
export type FilmSource = "manual" | "letterboxd" | "tmdb";

/** The four kinds of work a film can be linked to. */
export type LinkType = "book" | "painting" | "film" | "other";

/**
 * A year is a number, or the empty string when it is unknown. The empty
 * one comes from the CSVs, where the column can be missing; we keep it
 * rather than `null` because it can be displayed in a field as it is.
 */
export type Year = number | "";

/** A work linked to a film — it is what weaves the red thread. */
export interface LinkedWork {
  id: string;
  type: LinkType;
  title: string;
  creator: string;
  note: string;
  /** Filled in when the link points at another film in the collection. */
  filmId?: string | null;
  /** Shared by the two halves of a reciprocal cross-reference. */
  pairId?: string;
  /**
   * The link's nature (`domain/relations`) — what the note used to say in
   * prose and the map could not read. Only means anything on a
   * cross-reference to a card: a free mention is linked only to itself.
   * The two halves carry INVERSE relations, not the same one.
   */
  relation?: Relation;
  /** Three notches; see `domain/relations`. Worth 2 when nothing is said. */
  force?: Strength;
}

/**
 * What can be retouched on a thread already strung.
 *
 * A cross-reference to a card on the wall accepts `note` only: its title
 * and its author belong to THAT card, and rewriting them here would make
 * the map lie. It is the write model, in `App`, that enforces the rule —
 * the form merely does not offer it.
 */
export type LinkPatch = Partial<
  Pick<LinkedWork, "type" | "title" | "creator" | "note" | "relation" | "force">
>;

/** A screenshot. The image lives in IndexedDB, the card keeps only the key. */
export interface Still {
  id: string;
  key: string;
  /** Shrunken version: no point decoding 4K for a 110 px thumbnail. */
  thumbKey?: string;
  caption: string;
  /** Original size and weight, shown under the thumbnail. */
  w?: number;
  h?: number;
  bytes?: number;
  type?: string;
}

/**
 * A screening. The rating is the one given THAT day — a film watched
 * again ten years later does not get the same, and that is precisely what
 * we want to be able to look at. `null` means "watched without rating",
 * which is not the same thing as zero.
 */
export interface Watch {
  /** `YYYY-MM-DD`, like `watchedAt`: it is also the uniqueness key. */
  date: string;
  rating: number | null;
  rewatch?: boolean;
}

export interface Film {
  id: string;
  title: string;
  year: Year;
  director: string;
  /** TMDB URL, pasted address, or a shrunken image as a data URI. */
  poster: string;
  stills: Still[];
  genres: string[];
  /**
   * The first eight roles, in billing order. Eight and not the whole
   * credit list: beyond that we get into the walk-on parts, which never
   * link two films and weigh on `localStorage`.
   */
  cast: string[];
  /**
   * The crew, by trade: `image`, `musique`, `scénario`. The keys stay
   * French — they are what a card carries on disk. Missing keys mean "not
   * filled in" — never an empty list written for nothing.
   */
  crew: Record<string, string[]>;
  /**
   * Runtime in minutes. `null` — and never 0 — when it is unknown: a zero
   * would enter the almanac's averages and skew them in silence, where a
   * `null` rules itself out.
   */
  runtime: number | null;
  /** Original language, ISO 639-1 code ("fr", "ja"). Empty if unknown. */
  language: string;
  /** Production countries, two at most, ISO 3166-1 codes ("FR", "JP"). */
  countries: string[];
  /** TMDB's public rating out of 10 — enough to measure one's own gap. */
  tmdbRating: number | null;
  /**
   * What the film is about, in TMDB's words. Empty means "we have never
   * asked", and it is the only honest default: a card typed by hand has
   * no summary and inventing one is not this application's business.
   *
   * IT IS NOT `review` AND NEVER WILL BE. `review` is what YOU wrote
   * about the film, and it is the point of the whole binder; this is
   * what the film is, which one needs BEFORE having seen it — a
   * viewing plan is made of films one cannot yet have an opinion on.
   * Filing them together would make the second overwrite the first the
   * first time a card was completed.
   */
  synopsis: string;
  /**
   * TMDB's keywords ("time loop", "neo-noir"), twenty at most. They are
   * the ONLY thematic information that arrives on its own: `themes` and
   * `motifs` are set by hand, and on an imported collection they stay
   * empty. They replace neither — a motif is a word you chose to follow,
   * a keyword is what TMDB wrote — but they give the wake something to
   * bring two films together with, other than the names of their crew.
   *
   * ABSENT AND EMPTY LIST DO NOT SAY THE SAME THING, and that is what
   * lets us complete without looping. `undefined`: we never asked. `[]`:
   * we asked, TMDB has none — an obscure short, for instance. Without
   * that distinction, "complete the cards" would query the same films
   * forever without anything ever changing, which `isIncomplete` already
   * warns about.
   */
  keywords?: string[];
  themes: string[];
  /**
   * The catalogue's motifs (`domain/motifs`), by `id`. Alongside `themes`
   * and never instead of it: `themes` is your vocabulary, free and spelt
   * however you like; `motifs` is the shared vocabulary, fixed, the one a
   * question like "where the hero dies" can bear on. An `id` unknown to
   * the catalogue is ignored on display, not erased from the card.
   */
  motifs: string[];
  rating: number;
  review: string;
  notes: string;
  linkedWorks: LinkedWork[];
  addedAt: number;
  /**
   * The last time THIS card changed, in milliseconds.
   *
   * It is not a display curiosity: it is the arbiter of the day two
   * devices hold the same collection. When the same card has been touched
   * on both sides, the more recent one wins, and without this date there
   * is nothing to compare — we could only say "they differ".
   *
   * Set by the store (`services/collection`) at write time, and never by
   * hand: a date every caller would have to remember to update is a date
   * one caller will forget.
   */
  updatedAt: number;
  status: FilmStatus;
  /** The top shelf: the ones we watch again. */
  bedside: boolean;
  /**
   * Set aside: the card leaves the wall and the constellation without
   * being destroyed. It is the opposite of a deletion.
   */
  archived: boolean;
  /** Manual rank on the shelf; `null` = never arranged by hand. */
  order: number | null;
  /**
   * The last screening, in shorthand. It is NO LONGER the source of
   * truth: `watches` is, and this field is its reflection, realigned by
   * `withWatches`. We keep it because a dozen places ask "when did I last
   * watch it" — the library's sorting, the import merge — and none of
   * them needs the whole log to answer.
   */
  watchedAt: string | null;
  /** The screening log, from the most recent to the oldest. */
  watches: Watch[];
  tmdbId: number | string | null;
  source: FilmSource;
}

/** A notebook page, belonging to no film. */
export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

/** The shelf's three levels. */
export type ShelfKind = "bedside" | "main" | "reserve";

/**
 * A divider set by hand between two cases on a shelf.
 *
 * The shelf views have taken over: dividers are no longer created, but
 * are still read when loading an older collection, which
 * `buildViewsFromLegacy` converts into a view.
 */
export interface Divider {
  id: string;
  label: string;
  /** The wall it belongs to: the video library or the "to watch" list. */
  wall: FilmStatus;
  /** The level, inside that wall. */
  shelf: ShelfKind;
  /** Position on the level, in the same frame as `Film.order`. */
  order: number;
  /**
   * Number of cases on the row it opens. `null` or absent: we follow the
   * level's setting.
   */
  perRow?: number | null;
}

/**
 * The shelf views, as `ensureViews` holds them in memory.
 *
 * A view's content — rows, categories, decors — lives in
 * `shelf-views.js`, still in JavaScript: `unknown` honestly says that
 * module is untyped rather than inventing its shape here.
 */
export interface ShelfViews {
  byWall: Record<FilmStatus, string[]>;
  docs: Record<string, unknown>;
}

/* ---------- Import ---------- */

/** A CSV row, once cleaned and possibly enriched via TMDB. */
export interface ImportRow {
  title: string;
  year: Year;
  /** `null` means "not rated", which is not the same thing as 0. */
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
  synopsis?: string;
  keywords?: string[];
  poster?: string;
  tmdbId?: number | string | null;
  /**
   * The screenings THIS file brings. `diary.csv` has one per line, the
   * Letterboxd feed one per entry; `rating` and `watchedAt` above stay
   * those of the most recent, so that the import merge does not have to
   * change its point of view.
   */
  watches?: Watch[];
  /**
   * When the card was set aside, if the source knows. The watchlist read
   * online gives no date, but it gives an ORDER — most recently added
   * first — and it is from that we deduce this field, for want of
   * better. Absent, `makeFilm` will date it from now.
   */
  addedAt?: number;
}

/** What the file really contained — shown before anything is written. */
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

/** An existing card and the only fields the import offers to change. */
export interface FilmUpdate {
  film: Film;
  changes: Partial<Film>;
}

/** The diff shown on screen: nothing is written until it is approved. */
export interface ImportDiff {
  toCreate: Film[];
  toUpdate: FilmUpdate[];
  unchanged: Film[];
}

/* ---------- Constellation ---------- */

export interface SkyNode {
  id: string;
  /** `thread`: a named gathering, which is neither a film nor a work. */
  kind: "film" | "work" | "thread";
  label: string;
  sub: string;
  /** Number of edges: sets the star's size and decides whether it is labelled. */
  degree: number;
  /** Films only. */
  rating?: number;
  filmId?: string;
  /** Works only — beyond 1, the star is a bridge between two films. */
  type?: LinkType;
  refs?: number;
  /** Threads only: the thread's tint key, and the motif that feeds it. */
  color?: string;
  motif?: string | null;
  /** True when the star only holds in the sky because it was pinned there. */
  pinned?: boolean;
}

/** A node once placed by the relaxation. */
export type PlacedNode = SkyNode & { x: number; y: number };

export interface SkyLink {
  a: string;
  b: string;
  /**
   * "cite": a film refers to a work. "peer": two cards on the wall linked
   * by hand. "crew": a kinship the machine found in the credits — it is
   * drawn differently, because the map must say at a glance what comes
   * from you.
   */
  kind: "cite" | "peer" | "crew" | "thread";
  /** The reasons behind a "crew" thread — enough to explain it in one line. */
  why?: Kinship[];
  /** "peer" only: the link's nature, as written on `a`'s side. */
  relation?: Relation;
  /** What was written under the link — `a`'s side for a "peer". */
  note?: string;
  force?: Strength;
}

/**
 * The NATURE of a kinship, and not only its name.
 *
 * "Decaë" does not say much; "image · Decaë" says you follow a
 * cinematographer. `thème` is the only one that comes not from a credit
 * list but from your own keywords — it deserves telling apart from the
 * others, because it is yours.
 *
 * THE VALUES STAY FRENCH: the Credits view displays them as they are.
 */
export type KinshipRole =
  "réalisation" | "interprétation" | "image" | "musique" | "scénario" | "thème";

export interface Kinship {
  role: KinshipRole;
  name: string;
}

/** Restricts the sky map to a subset of the collection. */
export interface SkyFilters {
  tags?: string[];
  genres?: string[];
}
