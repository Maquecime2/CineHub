/* ============================================================
   MODEL — a film card, one single definition
   ============================================================ */
import { inverseOf, migrateRelation } from "./relations";
import { migrateMotifIds } from "./motifs";
import type { Film, LinkedWork, LinkPatch, Watch } from "../types";

/* ============================================================
   A CARD'S IDENTIFIER — good for one collection, not for two
   ============================================================

   Eight characters of `Math.random` are enough as long as a binder only
   talks to itself: the chance of two identical cards within a single
   collection is nil in practice. The day two binders talk to each other,
   that chance becomes the chance of two collections colliding — and
   `Math.random` never promised to be unique anywhere but at home.

   UUID version 7: forty-eight bits of time up front, the rest from the
   cryptographic generator. Two properties we want both of — unique
   across machines, and SORTABLE in the order the cards were born, which
   makes a database index one that does not fragment.

   WE DO NOT REWRITE THE OLD ONES, and that is deliberate. A card's
   identifier is quoted everywhere else: a shelf's rows list identifiers,
   red threads join two of them, cross-references from one card to another
   carry them. Renumbering would mean rewriting in one gesture six stores
   that are not versioned together, and a single omission breaks a link
   with nothing to flag it. Uniqueness across machines will be guaranteed
   anyway by the account that holds them, and two collections are not
   compared by our identifiers but by `tmdbId`, which designates the WORK
   and not the card. */
/* THE COUNTER THAT WAS MISSING — the timestamp alone is not enough.

   A millisecond is long: an import lays two hundred cards inside one. All
   those cards then carry the SAME time up front, and the order falls back
   on the randomness that follows — which is to say, on nothing. The
   promise "sortable in birth order" was false exactly where it was most
   useful, and it was the test that said so.

   Twelve bits of counter right after the version marker, reset to zero on
   every new millisecond: that is the method the standard provides for
   this. Four thousand and ninety-six cards in the same millisecond would
   overflow it — we then borrow a millisecond from the future rather than
   hand out the same rank twice. */
let lastMs = 0;
let counter = 0;

export const uid = (): string => {
  const random = crypto.randomUUID?.();
  if (!random) {
    /* With no cryptographic generator — an old browser, an insecure
       context — we fall back on the old recipe rather than refuse to
       write a card. */
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  let ms = Date.now();
  if (ms > lastMs) {
    lastMs = ms;
    counter = 0;
  } else {
    /* Same millisecond — or a clock going backwards, which happens when
       it is reset: we keep our own time, which never goes back. */
    ms = lastMs;
    counter += 1;
    if (counter > 0xfff) {
      lastMs = ms + 1;
      ms = lastMs;
      counter = 0;
    }
  }

  /* A UUID is written 8-4-4-4-12. We replace the first twelve nibbles
     with the timestamp, the version marker with 7, and the next twelve
     bits with the counter; the variant and the trailing sixty-two bits
     stay the browser's. */
  const time = ms.toString(16).padStart(12, "0").slice(-12);
  const rank = counter.toString(16).padStart(3, "0");
  return (
    time.slice(0, 8) +
    "-" +
    time.slice(8, 12) +
    "-7" +
    rank +
    "-" +
    random.slice(19, 23) +
    "-" +
    random.slice(24)
  );
};

export const makeFilm = (partial: Partial<Film> = {}): Film => ({
  id: uid(),
  title: "",
  year: "",
  director: "",
  poster: "", // TMDB URL, pasted address, or a shrunken image as a data URI
  stills: [], // screenshots: { id, key (IndexedDB), caption }
  genres: [],
  cast: [], // the first eight roles; see `types`
  crew: {}, // photography · music · screenplay
  runtime: null, // `null` and not 0: an unknown runtime stays out of the averages
  language: "",
  countries: [],
  tmdbRating: null,
  themes: [],
  motifs: [], // the shared vocabulary; see `domain/motifs`
  rating: 0,
  review: "",
  notes: "",
  linkedWorks: [],
  addedAt: Date.now(),
  /* Born now, therefore modified now. The store will rewrite it on every
     real change — see `stamp`. */
  updatedAt: Date.now(),
  status: "watched",
  bedside: false, // the top shelf: the ones we watch again
  /* Set aside: the card leaves the wall and the constellation without
     being destroyed. It is the opposite of a deletion — it stays whole,
     stored in the shelf's reserve, and comes back with one drag. */
  archived: false,
  order: null, // manual rank on the shelf; null = never arranged by hand
  watchedAt: null,
  watches: [], // the screening log; see `withWatches`
  tmdbId: null,
  source: "manual",
  ...partial,
});

/* THE FALLBACK POSTER — the title's initials.

   The rule is ONE: the first letters of the first two words. It was
   copied under every place that draws a film — `FilmPolaroid`,
   `shelf/items`, `shelf/layout` — and the almanac export would have made
   a fourth copy of it.

   Worse: the card applied ANOTHER one, `title.slice(0, 2)`. "Sans toit ni
   loi" became "SN" on the wall and "SA" on its own card, for the same
   film. Two images of the same thing that do not look alike is the thing
   you stop recognising. */
export const initialsOf = (title = ""): string =>
  title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/* WHAT AN INCOMPLETE CARD IS — in the sense of what TMDB can fill in.

   The cast is the best witness: TMDB gives one for almost every fiction
   film, and its absence signals a card that has never seen the harvest.
   The runtime confirms it.

   We do NOT look at countries or language, and that is deliberate: TMDB
   legitimately leaves them empty for an obscure short. Taking those for a
   gap would mean re-querying the same cards forever, on every pass,
   without anything ever changing. */
export const isIncomplete = (f: Pick<Film, "cast" | "runtime" | "keywords">): boolean =>
  (f.cast || []).length === 0 ||
  f.runtime == null ||
  /* Keywords are tested on ABSENCE and not on emptiness, and that is what
     tells them apart from the countries and language ruled out above. A
     film TMDB has no keyword for comes back with an empty list, which is
     an answer: it will not be asked again. A card from before their
     harvest has nothing at all — and it is that difference which lets us
     complete once without looping. */
  f.keywords == null;

/* WHAT AN EXPLICIT CATCH-UP GOES AFTER — and it is broader.

   `isIncomplete` rules out emptiness, so as not to loop on every pass.
   But a whole collection was frozen at `[]` by a harvesting fault (see
   `getDetails`), and nothing that repairs could reach it any more. So we
   needed a gesture that ALSO targets emptiness.

   It is not automatic, and must not be: on five hundred cards, that makes
   five hundred calls. It is for the user to ask for it, once, knowing the
   number. */
export const withoutKeywords = (f: Pick<Film, "keywords">): boolean => !(f.keywords || []).length;

/* ------------------------------------------------------------
   THE SCREENING LOG
   ------------------------------------------------------------

   A film seen three times is not a film seen. The card carried only one
   date and one rating, and all the rest was thrown away when reading the
   CSV — whereas `diary.csv` and the Letterboxd feed both give one line
   per screening with that day's rating.

   `watches` is the TRUTH, `watchedAt` is its reflection. The two cannot
   drift apart because we only write them here. */

/** From the most recent to the oldest. */
export const sortWatches = (w: Watch[]): Watch[] =>
  [...w].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

export const watchCount = (film: Pick<Film, "watches">): number => (film.watches || []).length;

/* ONE SCREENING PER DATE, AND THAT IS WHAT MAKES A RE-IMPORT HARMLESS.

   Running the same `diary.csv` through three times must not give a film
   seen nine times. The date is therefore the key: two entries from the
   same day are the same screening, and the second only completes the
   first — a rating recovered must not be erased by a screening that
   carries none. That is exactly the kind of drift nobody notices until
   six months of re-imports have gone by. */
export const mergeWatches = (...batches: (Watch[] | undefined)[]): Watch[] => {
  const byDate = new Map<string, Watch>();
  for (const batch of batches)
    for (const w of batch || []) {
      if (!w?.date) continue;
      const prev = byDate.get(w.date);
      byDate.set(w.date, prev ? { ...prev, ...w, rating: w.rating ?? prev.rating } : w);
    }
  return sortWatches([...byDate.values()]);
};

/** The only path for writing screenings: it realigns `watchedAt` with them. */
export const withWatches = <T extends Partial<Film>>(film: T, watches: Watch[]): T => {
  const merged = mergeWatches(watches);
  return { ...film, watches: merged, watchedAt: merged[0]?.date ?? null };
};

/* Has the rating moved since last time? We compare against the last RATED
   screening, and not the previous one: a rewatch with no rating does not
   break the chain, it simply has nothing to say about it. */
export const ratingDrift = (watches: Watch[]): (number | null)[] => {
  const ordered = sortWatches(watches);
  return ordered.map((w, i) => {
    if (w.rating == null) return null;
    const before = ordered.slice(i + 1).find((p) => p.rating != null);
    return before ? w.rating - before.rating! : null;
  });
};

/* Of a card from before the log, we know only one thing: it was seen
   once, on such a day, and rated so. We write that down — it is true, and
   it beats leaving a counter at zero under a film that carries a
   screening date.

   The test is on `Array.isArray` and NOT on the length: a log the user
   emptied by hand is an empty array, not a missing field. Confusing it
   with "never migrated" would resurrect the screening on the next load —
   and `migrate` writes straight back into `localStorage`, so the
   resurrection would be permanent. */
const seedWatches = (f: Partial<Film>): Watch[] => {
  if (Array.isArray(f.watches)) return f.watches;
  return f.watchedAt ? [{ date: f.watchedAt, rating: f.rating || null }] : [];
};

/* THE SHAPE STORED BEFORE THIS MODULE WAS TRANSLATED.

   `migrate` is the ONLY door cards come in through, which is what makes
   renaming a stored field safe: the old spelling is read here, once, and
   the next write uses the new one. `chevet` became `bedside`, and the
   relations carried by `linkedWorks` changed vocabulary at the same
   time (see `migrateRelation`). */
type StoredFilm = Partial<Film> & { chevet?: unknown };

/* Cards saved before these fields existed are completed on load. We take
   the opportunity to bring `year` back to a number: sorting by year was
   until now doing arithmetic on strings that came out of the CSV. */
export const migrate = (films: StoredFilm[] | null | undefined): Film[] =>
  (films || []).map(({ chevet, ...f }) => ({
    ...makeFilm(),
    ...f,
    year: f.year === "" || f.year == null ? "" : Number(f.year) || "",
    status: f.status === "watchlist" ? ("watchlist" as const) : ("watched" as const),
    bedside: !!(f.bedside ?? chevet),
    archived: !!f.archived,
    order: typeof f.order === "number" ? f.order : null,
    /* A CARD FROM BEFORE HAS NO MODIFICATION DATE, and giving it "now"
       would be a lie that helps today and costs tomorrow: on the first
       synchronisation the whole collection would claim to be fresh and
       overwrite whatever came from the other side. So we take the date it
       was ADDED, which is the last true thing we know about that card. */
    updatedAt: typeof f.updatedAt === "number" ? f.updatedAt : f.addedAt || Date.now(),
    genres: f.genres || [],
    /* Cards from before the cast do not carry one. We do NOT go and fetch
       it here: `migrate` runs on load, offline and with no TMDB key. It is
       a re-import that will fill it, and the diff will show it before
       writing. */
    cast: f.cast || [],
    crew: f.crew || {},
    /* Like the cast: cards from before do not carry them, and we do NOT go
       and fetch them here — `migrate` runs on load, offline and keyless.
       It is the Import tab's "complete the cards" button that fills them,
       diff in hand.

       `?? null` and not `|| null`: a legitimate runtime cannot be zero,
       but an unknown film's TMDB rating can — and `||` would crush it
       without telling "zero" from "absent". */
    runtime: f.runtime ?? null,
    language: f.language || "",
    countries: f.countries || [],
    tmdbRating: f.tmdbRating ?? null,
    /* NO FALLBACK TO THE EMPTY LIST, unlike all its neighbours: "never
       asked" and "asked, there are none" must stay distinct, otherwise
       completion goes round in circles. See `types`. */
    keywords: f.keywords,
    themes: f.themes || [],
    motifs: migrateMotifIds(f.motifs),
    linkedWorks: (f.linkedWorks || []).map((w) => ({
      ...w,
      relation: migrateRelation(w.relation),
    })),
    stills: f.stills || [],
    watches: sortWatches(seedWatches(f)),
  }));

/* ------------------------------------------------------------
   DATING WHAT ACTUALLY CHANGED
   ------------------------------------------------------------

   The rule is easy to state and easy to get wrong: `updatedAt` must
   change when the CARD changes, and not when the object changes.

   The whole application works by copying — `films.map(f => ...)` makes a
   fresh object for each of a thousand films when only one has moved.
   Dating on object identity would therefore date the whole collection on
   every note typed, and the first synchronisation would send back a
   thousand cards instead of one.

   So we compare VALUES, field by field. The cost is one comparison per
   film per write, which is measured in microseconds; the lie avoided is
   measured in megabytes on somebody's network. */

/** The fields that do not count towards "has the card changed". */
const NOT_COMPARED = new Set(["updatedAt"]);

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  /* A card's composite parts — the screening log, the cross-references,
     the stills — are small pure data structures: comparing them
     serialised is exact and fast enough. */
  return JSON.stringify(a) === JSON.stringify(b);
};

/** Do two states of the same card say anything different from each other? */
export const hasChanged = (before: Film | undefined, after: Film): boolean => {
  if (!before) return true;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const c of keys) {
    if (NOT_COMPARED.has(c)) continue;
    if (!sameValue(before[c as keyof Film], after[c as keyof Film])) return true;
  }
  return false;
};

/**
 * Puts the modification date back on the cards that moved, and on those
 * only.
 *
 * Returns the SAME object for an unchanged card: the views are memoised
 * on identity, and returning a copy of every card on every write would
 * redo the whole shelf on every keystroke.
 */
export const stamp = (before: Film[], after: Film[], now = Date.now()): Film[] => {
  const byId = new Map(before.map((f) => [f.id, f]));
  let moved = false;
  const next = after.map((f) => {
    const old = byId.get(f.id);
    if (!hasChanged(old, f)) {
      if (old && old !== f) moved = true;
      return old ?? f;
    }
    moved = true;
    return { ...f, updatedAt: now };
  });
  /* Nothing moved, not even a copy: we return the array we were given.
     Returning a fresh array would re-render every view watching it, to
     say exactly the same thing. */
  return moved ? next : after;
};

/* ------------------------------------------------------------
   WHAT GETS SHARED, AND WHAT NEVER LEAVES HERE
   ------------------------------------------------------------

   The separation is drawn NOW, while there is no server to make it
   urgent. The day a collection gets published, the question "what goes
   out?" will come up in the middle of a form, in a hurry, and the easy
   answer will be "everything".

   Two things never go out, whatever visibility is chosen: the NOTES,
   which are a private notebook and not a review, and the SCREENING LOG,
   which says how regularly someone spent their evenings — an attendance
   record nobody else has any use for.

   The review, the numeric rating and the last screening date, on the
   other hand, are what you publish when you publish: that is the very
   point of a shared video library. */
export type FilmPublic = Omit<Film, "notes" | "watches">;

export const publicPart = (f: Film): FilmPublic => {
  /* Named in order to be left out: a whitelist extraction would silently
     drop any field added later, and a published card would lose pieces
     with nothing to say so. */
  const { notes: _notes, watches: _watches, ...rest } = f;
  return rest;
};

/* ------------------------------------------------------------
   The red thread — reworking a link already strung
   ------------------------------------------------------------ */

/* What a thread allows to be rewritten depends on its nature, and the
   rule lives HERE rather than in the form: a free mention is written
   entirely by hand, whereas a cross-reference to a card on the wall takes
   its title and its author from THAT card. Rewriting them from this side
   would make the map lie — two names for the same work, depending on
   which end you look at it from.

   The note, on the other hand, belongs to the link and not to either of
   the two cards: it says the resonance BETWEEN them. So it holds on both
   sides, and the reciprocal half receives it too. It is the same reason
   that makes undoing a link undo it at both ends.

   A pure function over the whole collection: it is the only way to reach
   both halves of the same thread in a single write. */
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
  // a thread with no title would have nothing left to say: we leave it all in place
  if (!work.filmId && !title) return films;

  /* The relation and the strength belong to the link, like the note: they
     say what happens BETWEEN the two cards. So they hold on both sides —
     but the relation flips over there (see `inverseOf`), otherwise each
     film would declare itself the sequel of the other. */
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
    // the half opposite: the note, the strength, the flipped relation — never the rest
    if (work.pairId && f.id === work.filmId)
      return {
        ...f,
        linkedWorks: (f.linkedWorks || []).map((w) =>
          w.pairId === work.pairId ? { ...w, note, force, relation: inverseOf(relation) } : w
        ),
      };
    return f;
  });
};
