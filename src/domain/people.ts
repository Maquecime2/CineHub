/* ============================================================
   THE CREDITS — what the collection knows about people

   The names were already there. Every card carries its director, its
   first eight roles and its crew by trade, and those three fields served
   ONE purpose only: drawing the constellation's dotted lines. You could
   not ask "and Decaë, what have I got of his".

   Nothing more is collected, nothing is written anywhere: a person's
   dossier is RECOMPOSED on every read from the films, like a thread
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
}

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
    if (isPersonRole(k.role) && normalize(k.nom.trim()) === key) seen.add(k.role);
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
       makes us open somebody's dossier. */
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
      const name = k.nom.trim();
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

/** A person's dossier, or `null` if the collection does not know them. */
export const dossierOf = (films: Film[], key: string): Person | null =>
  census(films).find((p) => p.key === key) || null;

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
