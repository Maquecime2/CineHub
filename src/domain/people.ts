/* ============================================================
   THE CREDITS — what the collection knows about people

   The names were already there. Every card carries its director, its
   first eight roles and its crew by trade, and those three fields served
   ONE purpose only: drawing the constellation's dotted lines. You could
   not ask "and Decaë, what have I got of his".

   Nothing more is collected, nothing is written anywhere: a person's
   page is RECOMPOSED on every read from the films, like a thread
   (`domain/threads`). A person is not an entity you file away, it is a
   question you put to the collection.
   ============================================================ */
import { kinshipsOf } from "./sky";
import { normalize } from "./search";
import { watchCount } from "./film";
import type { Film, KinshipRole, Year } from "../types";

/** The roles that designate somebody. `thème` is not a person. */
export const PERSON_ROLES: KinshipRole[] = [
  "réalisation",
  "interprétation",
  "image",
  "musique",
  "scénario",
];

const isPersonRole = (r: KinshipRole): boolean => r !== "thème";

export interface Person {
  /** `normalize(name)` — the identity, insensitive to case and accents. */
  key: string;
  /** The most frequent spelling in the collection. */
  name: string;
  /** The capacities this person appears in, in `PERSON_ROLES` order. */
  roles: KinshipRole[];
  /** Their films at your place, all hats together, most recent first. */
  films: string[];
  watched: number;
  toWatch: number;
  /** The number of screenings held on their films — a rewatch counts twice. */
  screenings: number;
  /**
   * The average of YOUR ratings, over their films watched AND rated. A
   * zero means "not rated" and not "panned": letting it into the average
   * would make someone we simply have not judged look lukewarm. `null`
   * when none of their films is rated.
   */
  rating: number | null;
  /**
   * Your rating brought onto ten, minus the public rating. Positive: you
   * are gentler than the crowd; negative: harsher.
   *
   * This is the first real use of `tmdbRating`, whose type has said from
   * the start that it is there "to measure one's own gap". Only counts
   * the cards where BOTH ratings exist — comparing against a void would
   * give an invented gap.
   */
  gap: number | null;
  /** From their oldest film to their most recent. `null` if no year is known. */
  period: [Year, Year] | null;
  /** The motifs that recur with them: seen on at least two of their films. */
  motifs: string[];
  /**
   * When their most recently filed card was filed. Not a piece of
   * information about the person — a piece of information about US, and
   * the only one that tells a name we have just met from one that has
   * been on the shelf for three years.
   */
  lastAdded: number;
}

/* THE THRESHOLD, AND WHAT IT REALLY AIMS AT.

   A collection of a thousand films carries eight thousand names, most of
   which have crossed only one card: displaying them all does not make a
   more complete list, it makes a list nobody walks through. So the
   directory only shows straight away those one meets twice — the same
   ones the constellation's kinships keep.

   But that noise comes from ONE source: the eight roles each card
   carries. Film-makers, cinematographers, composers and screenwriters
   are counted in dozens, not in thousands, and a global threshold erased
   them wrongly — clicking "musique" on a collection where a single
   composer is named returned emptiness, which reads as a defect and not
   as a rule. So the threshold only applies to those whose acting is
   their only title. */
export const THRESHOLD = 2;

export const isRegular = (p: Person): boolean =>
  p.films.length >= THRESHOLD || p.roles.some((r) => r !== "interprétation");

/* What we accumulate while sweeping, before doing the sums. */
interface Draft {
  key: string;
  /** Every spelling met, and how many times. */
  spellings: Map<string, number>;
  roles: Set<KinshipRole>;
  films: Film[];
}

/** The capacities this person appears in on THIS film. */
export const rolesOnFilm = (f: Film, key: string): KinshipRole[] => {
  const seen = new Set<KinshipRole>();
  for (const k of kinshipsOf(f))
    if (isPersonRole(k.role) && normalize(k.name.trim()) === key) seen.add(k.role);
  return PERSON_ROLES.filter((r) => seen.has(r));
};

const dominantSpelling = (spellings: Map<string, number>): string => {
  let best = "";
  let bestCount = -1;
  /* On a tie the first one met wins — the collection's order is stable,
     so the displayed name does not change from one render to the next. A
     person whose name danced about would be a different person at every
     glance. */
  for (const [spelling, n] of spellings)
    if (n > bestCount) {
      best = spelling;
      bestCount = n;
    }
  return best;
};

const average = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const compose = ({ key, spellings, roles, films }: Draft): Person => {
  const ratings: number[] = [];
  const gaps: number[] = [];
  const years: number[] = [];
  const motifCounts = new Map<string, number>();

  for (const f of films) {
    if (f.rating > 0) {
      ratings.push(f.rating);
      // out of five on one side, out of ten on the other: speak the same language before subtracting
      if (f.tmdbRating != null) gaps.push(f.rating * 2 - f.tmdbRating);
    }
    if (f.year) years.push(Number(f.year));
    for (const id of f.motifs || []) motifCounts.set(id, (motifCounts.get(id) || 0) + 1);
  }

  return {
    key,
    name: dominantSpelling(spellings),
    roles: PERSON_ROLES.filter((r) => roles.has(r)),
    /* Most recently added first: it is the film we have just filed that
       makes us open somebody's page. */
    films: [...films].sort((a, b) => b.addedAt - a.addedAt).map((f) => f.id),
    watched: films.filter((f) => f.status === "watched").length,
    toWatch: films.filter((f) => f.status === "watchlist").length,
    screenings: films.reduce((n, f) => n + watchCount(f), 0),
    rating: average(ratings),
    gap: average(gaps),
    period: years.length ? [Math.min(...years), Math.max(...years)] : null,
    motifs: [...motifCounts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id),
    lastAdded: films.reduce((t, f) => Math.max(t, f.addedAt), 0),
  };
};

/**
 * Everybody, the best furnished first.
 *
 * No index, no cache: at a few thousand cards and eight names each, a
 * sweep takes less than a frame, where an index would be one more
 * structure to keep up to date on every write. It is the same reasoning
 * as in `domain/search`, and the view memoises.
 *
 * ARCHIVED cards count: having set them aside does not take somebody out
 * of their credits, any more than it makes them unwatched — the almanac
 * already makes that choice for screenings.
 */
export function census(films: Film[]): Person[] {
  const drafts = new Map<string, Draft>();

  for (const f of films) {
    /* The same name can come round more than once on a card (director AND
       screenwriter): we want the film only once in their list, but both
       roles. */
    const seenHere = new Set<string>();
    for (const k of kinshipsOf(f)) {
      if (!isPersonRole(k.role)) continue;
      const name = k.name.trim();
      if (!name) continue;
      const key = normalize(name);
      if (!key) continue;

      let b = drafts.get(key);
      if (!b) drafts.set(key, (b = { key, spellings: new Map(), roles: new Set(), films: [] }));
      b.roles.add(k.role);
      b.spellings.set(name, (b.spellings.get(name) || 0) + 1);
      if (!seenHere.has(key)) {
        seenHere.add(key);
        b.films.push(f);
      }
    }
  }

  return [...drafts.values()]
    .map(compose)
    .sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name, "fr"));
}

/** A person's page, or `null` if the collection does not know them. */
export const pageOf = (films: Film[], key: string): Person | null =>
  census(films).find((p) => p.key === key) || null;

/* ============================================================
   WHO COUNTS — the head of the directory

   A grid of names sorted by how well furnished they are answers a
   question one rarely asks straight off. These three rows answer the one
   we do ask on arriving: not "have you got any X", but "who is in
   there".
   ============================================================ */

/** How many names a row shows. Beyond that it stops being a shortlist. */
const HOW_MANY = 6;

/**
 * A row of two names is not a shortlist, it is the whole collection with
 * a title on top — and it announces a ranking where there is only
 * scarcity. Under this, the row does not exist.
 */
const ENOUGH = 3;

export interface Standouts {
  /** The best furnished, the ones one keeps coming back to. */
  loyal: Person[];
  /** Those you rate highest, on at least two films. */
  loved: Person[];
  /** The names your last cards brought in. */
  newcomers: Person[];
}

const shortlist = (xs: Person[]): Person[] => (xs.length >= ENOUGH ? xs.slice(0, HOW_MANY) : []);

const sameNames = (a: Person[], b: Person[]): boolean =>
  a.length === b.length && a.every((p) => b.some((q) => q.key === p.key));

export function standouts(people: Person[]): Standouts {
  /* A FIDELITY IS A RETURN, not a title.

     `isRegular` — the sieve that keeps the directory walkable — lets
     through anyone bearing a role other than acting, INCLUDING on a
     single film. Good for a directory, false for this heading: a row
     called "your loyalties" naming a composer heard once says something
     untrue. Here, and here only, it takes coming back.

     `census` already hands them back best furnished first. */
  const loyal = shortlist(people.filter((p) => p.films.length >= THRESHOLD));

  const loved = shortlist(
    people
      .filter((p) => p.rating != null && p.films.length >= THRESHOLD)
      .sort((a, b) => b.rating! - a.rating! || b.films.length - a.films.length)
  );

  /* Somebody already shown as a loyalty is not news. Without this, a
     collection built in one go showed the same six names three times
     over, which is worse than showing nothing. */
  const already = new Set(loyal.map((p) => p.key));
  const newcomers = shortlist(
    people.filter((p) => !already.has(p.key)).sort((a, b) => b.lastAdded - a.lastAdded)
  );

  /* THE SAME SIX NAMES UNDER TWO HEADINGS IS NOT TWO ROWS.

     On a well-stocked collection the two questions part company —
     whom one comes back to is not whom one rates best. On a small one
     they name exactly the same people, in a different order, and the
     head reads as a bug. Below that, only the first row is kept. */
  return {
    loyal,
    loved: sameNames(loyal, loved) ? [] : loved,
    newcomers,
  };
}

/**
 * YOUR own average, over the whole collection.
 *
 * The gap already computed on a person is a gap to the PUBLIC, and it
 * says nothing about the only comparison one actually makes: is this
 * person above or below what I usually give? A four out of five means
 * two different things depending on whether one rates everything four or
 * everything two.
 *
 * Same rule as everywhere: a zero is "not rated", not "panned".
 */
export const averageRating = (films: Film[]): number | null =>
  average(films.filter((f) => f.rating > 0).map((f) => f.rating));

/* ============================================================
   WHO COMES BACK WITH THEM
   ============================================================ */

export interface Companion {
  /** Their normalised key — what one opens. */
  key: string;
  name: string;
  /** On how many of this person's films they are named. */
  n: number;
}

/**
 * The people met on this person's films, the most frequent first.
 *
 * The constellation links FILMS to one another (`suggestLinks`); nothing
 * until now linked one name to another, and a folder one cannot leave
 * except by a film or the back button is a dead end. This is the way
 * out: a film-maker's regular cinematographer, an actor's usual
 * director.
 *
 * Counted BY FILM: somebody who directs and writes the same card is met
 * once there, not twice.
 */
export function companions(films: Film[], key: string, howMany = 8): Companion[] {
  const theirs = films.filter((f) => rolesOnFilm(f, key).length > 0);
  const met = new Map<string, { name: string; n: number; spellings: Map<string, number> }>();

  for (const f of theirs) {
    const here = new Set<string>();
    for (const k of kinshipsOf(f)) {
      if (!isPersonRole(k.role)) continue;
      const name = k.name.trim();
      if (!name) continue;
      const other = normalize(name);
      if (!other || other === key || here.has(other)) continue;
      here.add(other);

      let e = met.get(other);
      if (!e) met.set(other, (e = { name, n: 0, spellings: new Map() }));
      e.n += 1;
      e.spellings.set(name, (e.spellings.get(name) || 0) + 1);
    }
  }

  return [...met.entries()]
    .map(([k, e]) => ({ key: k, name: dominantSpelling(e.spellings), n: e.n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "fr"))
    .slice(0, howMany);
}

/**
 * Searching the directory.
 *
 * On the name alone, and deliberately: you type "decae" to find Decaë,
 * not to find the films he worked on — that is the question the wall's
 * search answers.
 */
export const searchPeople = (people: Person[], q: string): Person[] => {
  const t = normalize(q.trim());
  if (!t) return people;
  const hits = people.filter((p) => p.key.includes(t));
  /* Whoever has a WORD starting with what you type goes first. The rank
     is not taken on the whole name as it is for a film title
     (`domain/search`): you almost always type the surname, which is the
     last word, and "ozu" must find Ozu before Kurozu. */
  const byWord = (key: string) => (key.split(/[\s-]+/).some((word) => word.startsWith(t)) ? 0 : 1);
  return hits.sort(
    (a, b) =>
      byWord(a.key) - byWord(b.key) ||
      b.films.length - a.films.length ||
      a.name.localeCompare(b.name, "fr")
  );
};
