/* ============================================================
   WHAT YOU ALREADY HAVE — suggestions without a network

   The discovery desk only ever talked to TMDB: it answered "what else is
   out there" admirably, and never the question a collection kept for
   years ends up asking all by itself — "what have I got in here that I've
   forgotten?".

   Two hundred cards watched, and we keep circling the last twelve. This
   module goes and fetches the others.

   IT DOES NOT TALK ABOUT THE WATCHLIST. `domain/soir` handles that, and
   asks a different question: there, we pick what we are going to discover
   tonight; here, we remember what we loved. Blending the two would give
   two tools treading on each other's toes.

   Pure, offline, deterministic: none of these suggestions asks anything
   of anyone, and that is what makes them useful when no TMDB key is set.
   ============================================================ */
import { sortWatches } from "./film";
import { motifById, motifWording } from "./motifs";
import { directorsOf } from "../taste";
import type { Film } from "../types";
import { saying, words, type Wording } from "./wording";

/**
 * The nature of a suggestion — this is not a ranking but three different
 * QUESTIONS, and that is why we keep them apart rather than melting them
 * into a single score. "You had loved it" and "this motif has not crossed
 * your path again" are not answered the same way.
 */
export type Nature = "rewatch" | "motif" | "director";

export interface Suggestion {
  nature: Nature;
  film: Film;
  /** The suggestion's heading, kept short. */
  /** What to write on it: our words, or the user's own. */
  label: Wording;
  /** Why this one, in plain words. */
  reason: Wording;
  /** Stable identity — two natures can point at the same film. */
  key: string;
}

const DAY = 24 * 3600 * 1000;

/* THE THRESHOLDS ARE DEDUCED FROM YOUR OWN PRACTICE, THEY ARE NOT
   WRITTEN DOWN IN ADVANCE.

   The first draft set two years for a rewatch and eighteen months for a
   motif. Reasonable numbers — for a collection kept for ten years. On a
   binder opened eighteen months ago they disqualified EVERYTHING: the
   whole section stayed empty, and nothing said why. An absolute
   threshold does not measure forgetting, it measures the age of the
   binder.

   What we mean is relative: "a long time ago, FOR YOU". So we take a
   fraction of the span actually covered, from the first screening to the
   last.

   Bounded on both sides, and both bounds matter.

   The FLOOR sits at five months, not at a few weeks: you do not
   rediscover a film you loved three months ago, and a collection opened
   last month has nothing forgotten in it — it must be able to suggest
   nothing at all rather than insist.

   The CEILING keeps the original behaviour as soon as the practice runs
   past a few years: beyond that, two years really is the right measure of
   forgetting, where a third of fifteen years would wipe out the whole
   last decade. */
const FILM_NEGLECT = { share: 1 / 3, min: 150, max: 730 };
const THEME_NEGLECT = { share: 1 / 4, min: 120, max: 540 };

export interface Thresholds {
  film: number;
  theme: number;
}

const clamp = (n: number, min: number, max: number): number =>
  Math.round(Math.max(min, Math.min(max, n)));

export const thresholdsFor = (span: number): Thresholds => ({
  film: clamp(span * FILM_NEGLECT.share, FILM_NEGLECT.min, FILM_NEGLECT.max),
  theme: clamp(span * THEME_NEGLECT.share, THEME_NEGLECT.min, THEME_NEGLECT.max),
});

/** What is worth watching again: we do not bring a disappointment back up. */
const LOVED = 4;
const LOVED_AVERAGE = 3.5;

/** A card's latest screening, in milliseconds; `null` when it has no log. */
const lastWatch = (f: Film): number | null => {
  const w = sortWatches(f.watches || [])[0];
  if (!w?.date) return null;
  const t = Date.parse(`${w.date}T12:00:00Z`);
  return Number.isFinite(t) ? t : null;
};

const daysSince = (t: number, now: number): number => Math.floor((now - t) / DAY);

/* "two years ago" reads; "913 days ago" asks for a calculation. Under a
   year we keep months, which stay meaningful. */
/* HOW LONG AGO, IN ROUND TERMS. Returned as a wording rather than a
   sentence: "two years" and "deux ans" do not decline the same way, and
   the plural is the catalogue's job. */
const inPlainWords = (days: number): Wording => {
  const years = Math.floor(days / 365);
  if (years >= 1) return saying("athome.years", { count: years });
  return saying("athome.months", { count: Math.max(1, Math.floor(days / 30)) });
};

/** The best rating a card has ever been given. */
const bestRating = (f: Film): number => {
  const ratings = (f.watches || []).map((w) => w.rating).filter((r): r is number => r != null);
  return Math.max(f.rating || 0, ...(ratings.length ? ratings : [0]));
};

/* The cards this module works on: watched, not archived, and dated. A
   card without a screening has no forgetting to measure — it is not that
   we neglected it, it is that we do not know when we saw it. */
interface Dated {
  film: Film;
  when: number;
  days: number;
}

const dated = (films: Film[], now: number): Dated[] => {
  const out: Dated[] = [];
  for (const film of films) {
    if (film.status === "watchlist" || film.archived) continue;
    const when = lastWatch(film);
    if (when == null) continue;
    out.push({ film, when, days: daysSince(when, now) });
  }
  return out;
};

/* THE SPAN OF THE PRACTICE: from the oldest screening to the most
   recent. It is what gives the scale of "a long time ago".

   We start from the OLDEST screening and not the most recent: what we
   measure is how long the binder has been kept, not how long it has been
   since we opened it.

   It was written inline in `atHomeSuggestions`. It comes out here because
   the shelf now asks the same question of the same collection, and a
   second span computed next door would have drifted from this one the
   first time either was touched. */
const spanOf = (pool: Dated[]): number =>
  pool.length === 0
    ? 0
    : Math.max(...pool.map((d) => d.days)) - Math.min(...pool.map((d) => d.days));

/**
 * How long is "a long time ago, FOR YOU" — in days, for a whole
 * collection.
 *
 * The shelf reads it to know which case has gone dormant. It is the SAME
 * number `atHomeSuggestions` uses to decide what is worth watching again,
 * and it must stay so: a case that looks neglected on the shelf while the
 * suggestions panel says nothing about it would make one of the two a
 * liar, with nothing on screen to say which.
 */
export const neglectDaysFor = (films: Film[], now: number = Date.now()): number =>
  thresholdsFor(spanOf(dated(films, now))).film;

/* ------------------------------------------------------------
   1. TO WATCH AGAIN — what you had loved and set aside
   ------------------------------------------------------------ */
function toRewatch(pool: Dated[], threshold: number): Suggestion[] {
  return pool
    .filter((d) => d.days >= threshold && bestRating(d.film) >= LOVED)
    .sort((a, b) => bestRating(b.film) - bestRating(a.film) || b.days - a.days)
    .map(({ film, days }) => ({
      nature: "rewatch" as const,
      film,
      label: saying("athome.rewatch"),
      reason: saying("athome.reason.rewatch", {
        stars: bestRating(film),
        since: inPlainWords(days),
      }),
      key: `rewatch:${film.id}`,
    }));
}

/* ------------------------------------------------------------
   2. A MOTIF THAT HAS NOT CROSSED YOUR PATH AGAIN
   ------------------------------------------------------------

   Motifs are the collection's shared vocabulary — "it rains at the end",
   "the hero dies". So we can ask how long it has been since we last saw a
   film carrying one, which no free-form tag would let us do cleanly.

   A motif set on a single card says nothing: that is an accident, not a
   vein we would have neglected. */
function neglectedMotifs(pool: Dated[], threshold: number): Suggestion[] {
  const by = new Map<string, Dated[]>();
  for (const d of pool)
    for (const id of d.film.motifs || []) {
      const batch = by.get(id);
      if (batch) batch.push(d);
      else by.set(id, [d]);
    }

  const out: Suggestion[] = [];
  for (const [id, batch] of by) {
    if (batch.length < 2) continue;
    const motif = motifById(id);
    /* A motif unknown to the catalogue is ignored on display, never
       erased from the card: the rule holds everywhere. */
    if (!motif) continue;
    /* The motif's date is that of its MOST RECENT screening: that is when
       we stopped crossing its path. */
    const days = Math.min(...batch.map((d) => d.days));
    if (days < threshold) continue;
    /* We suggest the best-rated of the vein, not the oldest: the point is
       to reopen a door, not to clear out the back of a drawer. */
    const pick = [...batch].sort(
      (a, b) => bestRating(b.film) - bestRating(a.film) || b.days - a.days
    )[0]!;
    out.push({
      nature: "motif",
      film: pick.film,
      label: motifWording(motif),
      reason: saying("athome.reason.motif", {
        count: batch.length,
        since: inPlainWords(days),
      }),
      key: `motif:${id}`,
    });
  }
  /* NOT SORTED BY NAME HERE: the name depends on the language, and
     alphabetical order is not the same in the two. The view, which knows
     which one is in force, does the sorting. */
  return out;
}

/* ------------------------------------------------------------
   3. A NEGLECTED FILMMAKER
   ------------------------------------------------------------

   Someone whose films we have seen several of, whom we loved, and whom we
   have not opened in a long time. We require TWO films and a clear
   average: a single film rated five stars does not make a filmmaker we
   follow, and bringing it up would be guessing on someone else's
   behalf. */
function neglectedDirectors(pool: Dated[], threshold: number): Suggestion[] {
  const by = new Map<string, Dated[]>();
  for (const d of pool)
    for (const name of directorsOf(d.film) as string[]) {
      const batch = by.get(name);
      if (batch) batch.push(d);
      else by.set(name, [d]);
    }

  const out: Suggestion[] = [];
  for (const [name, batch] of by) {
    if (batch.length < 2) continue;
    const ratings = batch.map((d) => bestRating(d.film)).filter((n) => n > 0);
    if (ratings.length === 0) continue;
    const average = ratings.reduce((s, n) => s + n, 0) / ratings.length;
    if (average < LOVED_AVERAGE) continue;
    const days = Math.min(...batch.map((d) => d.days));
    if (days < threshold) continue;
    const pick = [...batch].sort(
      (a, b) => bestRating(b.film) - bestRating(a.film) || b.days - a.days
    )[0]!;
    out.push({
      nature: "director",
      film: pick.film,
      label: words(name),
      reason: saying("athome.reason.director", {
        count: batch.length,
        average: average.toFixed(1),
        since: inPlainWords(days),
      }),
      key: `director:${name.toLowerCase()}`,
    });
  }
  return out;
}

/* WHAT ONE SUGGESTION SAYS THAT ANOTHER DOES NOT.

   The same film is often picked out by all three natures at once: we
   loved it, it carries a neglected motif, and its director has not been
   opened again. It must appear only once — but then under WHICH reason?

   The first draft kept whichever came first, and "to watch again" always
   came first. The result: it hoovered up the films, and the other two
   natures, left without a subject, never appeared. The flaw did not show
   on any single card — only at the scale of the list, which started
   telling one story and one only.

   So we keep the most SPECIFIC one. "Melancholy — three films carry this
   motif, none since two years ago" teaches you something about the
   collection; "to watch again, 5★" teaches nothing a rating does not
   already say. The commonplace goes last, and serves as filler once the
   veins are exhausted. */
const SPECIFICITY: Nature[] = ["motif", "director", "rewatch"];

/**
 * What your collection has to suggest to you, without asking anything of
 * anyone.
 *
 * The natures are INTERLEAVED rather than laid end to end: three
 * "rewatch" in a row would give the impression of a single tool repeating
 * itself, where alternating shows we are looking at the collection from
 * three angles.
 *
 * `now` is a parameter: without it this module would be untestable — half
 * of what it computes is a duration since today.
 */
export function atHomeSuggestions(
  films: Film[],
  now: number = Date.now(),
  howMany = 6
): Suggestion[] {
  const pool = dated(films, now);
  if (pool.length === 0) return [];

  /* THE SPAN OF THE PRACTICE: from the oldest screening to the most
     recent. It is what gives the scale of "a long time ago".

     We start from the OLDEST screening and not the most recent: what we
     measure is how long the binder has been kept, not how long it has
     been since we opened it. */
  const thresholds = thresholdsFor(spanOf(pool));

  const byNature: Record<Nature, Suggestion[]> = {
    rewatch: toRewatch(pool, thresholds.film),
    motif: neglectedMotifs(pool, thresholds.theme),
    director: neglectedDirectors(pool, thresholds.theme),
  };

  /* Each film is only kept by the most specific nature that picks it out —
     the others let it through and keep their slot for a film they alone
     know how to name. */
  const claimed = new Map<string, Nature>();
  for (const nature of SPECIFICITY)
    for (const s of byNature[nature]) if (!claimed.has(s.film.id)) claimed.set(s.film.id, nature);

  const queues = SPECIFICITY.map((nature) =>
    byNature[nature].filter((s) => claimed.get(s.film.id) === nature)
  );

  const out: Suggestion[] = [];
  for (let round = 0; out.length < howMany; round++) {
    let placed = false;
    for (const queue of queues) {
      const s = queue[round];
      if (!s) continue;
      placed = true;
      out.push(s);
      if (out.length >= howMany) break;
    }
    // nothing left in any queue: we stop rather than spin
    if (!placed) break;
  }
  return out;
}
