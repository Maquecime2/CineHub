/* ============================================================
   THE COUNTERPOINT — what the collection does NOT look at
   ============================================================

   THE MIRROR OF `domain/proposals`. The recommendation offers what is
   OUTSIDE: films the binder does not hold. This module never names a
   film that has not been watched — it only reads the log, and it reads
   it for what is MISSING from it. The decade never put on. The country
   visited once. The filmmaker of whom three cards are held and one
   evening was spent.

   THREE AXES, AND THE FOURTH IS REFUSED ON PURPOSE. Genre looks like it
   would qualify — TMDB always fills it — but `domain/genres` says
   itself that a genre is served IN THE LANGUAGE ASKED FOR and that
   `canonicalGenres` unifies spellings WITHOUT translating. A gap on
   genre would therefore count zero on a collection imported in French,
   in silence, which is the most expensive shape of "it depends whether
   the card was filled in". Decade, country and filmmaker are the three
   things a card completed by TMDB always carries — the very three the
   criterion challenge settled on, and for the very same reason. Do not
   add a fourth here believing an oversight is being fixed.

   WHAT IS RETURNED IS A KEY, NEVER A SENTENCE: "1970", "JP", "Yasujirō
   Ozu". The view turns "JP" into "Japon" through `names.countryName`.
   That is the rule of `threadLabel` and of `geography` — the domain does
   not know what language it will be read in, and writing French in here
   would freeze the day's language into somebody's screen.

   NOTHING IS STORED. A counterpoint is computed from the cards on every
   opening: no disk key, nothing to synchronise, no version to raise.

   Pure, offline, React-free: like all of `domain/`. */
import { inPeriod, namesIn, screeningsOf, type Period } from "./almanac";
import { decadeOf } from "./course";
import { THRESHOLD } from "./people";
import { normalize } from "./search";
import type { Film } from "../types";

export type GapKind = "decade" | "country" | "director";

/**
 * One gap, and everything needed to jump at it — never the jump itself.
 *
 * The domain hands over `kind`, `key` and `witness`; the view decides
 * where each one leads (the wall filtered on a decade, the Credits on a
 * filmmaker, the card of the witness).
 */
export interface Gap {
  kind: GapKind;
  /** THE KEY, never a label: "1970", "JP", "Yasujirō Ozu". */
  key: string;
  /** Screenings carrying this key within the period. */
  seen: number;
  /**
   * DISTINCT CARDS watched carrying it, and this is what qualifies the
   * gap. Six rewatches of the same Japanese film are not six visits to
   * Japanese cinema — read on `seen` alone, "Japan seen six times" would
   * hide the exact opposite of what one thinks one is reading.
   */
  cards: number;
  /** Cards HELD carrying it, watchlist included: a watchlist is held. */
  held: number;
  /** The card that bears witness — the oldest screening. `null` when none. */
  witness: Film | null;
}

export interface Counterpoint {
  period: Period;
  /** The gaps, in the deterministic order described below. */
  gaps: Gap[];
  /** Distinct cards watched and dated that went into the reckoning. */
  weighed: number;
  /** The collection is too thin to have habits, so too thin to have gaps. */
  tooThin: boolean;
}

/* HOW MUCH IS NEEDED BEFORE AN ABSENCE MEANS ANYTHING.

   Not a number picked because it sounds right: three axes, each needing
   `THRESHOLD` to show a habit, and twice over so that an absence stands
   against something. Below that, "you never watch the fifties" said to
   somebody holding six cards is not an observation, it is a lie. */
export const THIN = 3 * THRESHOLD * 2;

/* THE ORDER OF THE NATURES IS FIXED, and it goes from the panoramic to
   the particular: a decade is a whole era, a country is a way of
   looking, a filmmaker is a matter of attention. */
const KINDS: GapKind[] = ["decade", "country", "director"];

/** At most this many gaps per nature — six lines, read at a glance. */
const HOW_MANY = 2;

/* What we accumulate per key while sweeping, before doing the sums. */
interface Tally {
  /** Every spelling met, and how many times — filmmakers only. */
  spellings: Map<string, number>;
  held: number;
  seen: number;
  /** Card ids watched, so a rewatch never counts as a second card. */
  watched: Set<string>;
  witness: Film | null;
  /** The witness's screening date, to keep the oldest. */
  witnessAt: string;
}

const blank = (): Tally => ({
  spellings: new Map(),
  held: 0,
  seen: 0,
  watched: new Set(),
  witness: null,
  witnessAt: "",
});

const tallyIn = (book: Map<string, Tally>, key: string): Tally => {
  const found = book.get(key);
  if (found) return found;
  const made = blank();
  book.set(key, made);
  return made;
};

/* THE KEYS A CARD CARRIES, per nature.

   Filmmakers are aggregated on `normalize` and NOT on the spelling
   written down: "Ozu" and "ozu" are one person, and `openPerson`
   normalises too — an unnormalised key would open a third. The spelling
   shown is the most frequent one met, which is what `census` does. */
const keysOf = (film: Film, kind: GapKind): string[] => {
  if (kind === "decade") {
    const decade = decadeOf(film);
    /* A card typed by hand carries "196?" or nothing at all, and
       `decadeOf` answers with an empty string. It weighs on no decade
       rather than inventing one. */
    return decade ? [decade] : [];
  }
  if (kind === "country") return (film.countries || []).filter(Boolean);
  return namesIn(film.director);
};

/** The spelling to show: the most frequent met, ties broken by the word. */
const spelt = (tally: Tally, key: string): string => {
  let best = "";
  let most = 0;
  for (const [word, n] of tally.spellings)
    if (n > most || (n === most && word.localeCompare(best) < 0)) {
      best = word;
      most = n;
    }
  return best || key;
};

/* IS THIS KEY A GAP?

   The threshold is `people.THRESHOLD`, borrowed and not copied. Its own
   comment says what it draws — "those met twice", which is exactly the
   line between an accident and a habit, and therefore the line a gap has
   to cross. A third constant at 2 in this project would be one too many.

   THE DECADE IS THE ONE MEASURED ON ZERO. "The decade never put on" is
   an absence of evenings, not a scarcity of them; and a decade held by a
   single card is not a decade being avoided, it is one film. The other
   two are measured on CARDS — one card watched is a visit, not a
   practice. */
const isGap = (kind: GapKind, tally: Tally): boolean => {
  const cards = tally.watched.size;
  if (kind === "decade") return tally.seen === 0 && tally.held >= THRESHOLD;
  if (kind === "director") return cards < THRESHOLD && tally.held >= THRESHOLD;
  return cards < THRESHOLD;
};

/**
 * The gaps inside a collection, over a period.
 *
 * ONE ARGUMENT, AND IT IS THE WHOLE COLLECTION — watchlist cards
 * included. `screeningsOf` already leaves them out of what was watched,
 * so they only ever weigh on `held`, which is where they belong: "three
 * held, one watched" cannot be said out of a list already stripped of
 * them. Handing this the watched cards alone would make `held` equal
 * `cards` everywhere and the filmmaker gap would never come out, without
 * an error.
 *
 * IT TAKES A `Period` like everything else in the almanac, because the
 * almanac already has one chosen in its header: a sheet ignoring it
 * would claim "Japan seen once" under a title reading 2019, and nothing
 * on screen would say which of the two was right.
 */
export function counterpointFor(films: Film[], period: Period): Counterpoint {
  const books = new Map<GapKind, Map<string, Tally>>(KINDS.map((k) => [k, new Map()]));

  /* WHAT IS HELD — every card, whatever its status. */
  for (const film of films)
    for (const kind of KINDS) {
      const book = books.get(kind) as Map<string, Tally>;
      for (const written of keysOf(film, kind)) {
        const key = kind === "director" ? normalize(written) : written;
        const tally = tallyIn(book, key);
        tally.held += 1;
        if (kind === "director")
          tally.spellings.set(written, (tally.spellings.get(written) || 0) + 1);
      }
    }

  /* WHAT WAS WATCHED — the screenings of the period, and only those. */
  const weighed = new Set<string>();
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    weighed.add(film.id);
    for (const kind of KINDS) {
      const book = books.get(kind) as Map<string, Tally>;
      for (const written of keysOf(film, kind)) {
        const key = kind === "director" ? normalize(written) : written;
        const tally = tallyIn(book, key);
        tally.seen += 1;
        tally.watched.add(film.id);
        /* THE WITNESS IS THE OLDEST SCREENING, and it is picked on the
           date rather than on the order the log arrives in — the same
           reason the race is settled on the screening: two readings of
           the same collection must not name two different films. */
        if (!tally.witness || watch.date < tally.witnessAt) {
          tally.witness = film;
          tally.witnessAt = watch.date;
        }
      }
    }
  }

  const gaps: Gap[] = [];
  for (const kind of KINDS) {
    const book = books.get(kind) as Map<string, Tally>;
    const found: Gap[] = [];
    for (const [key, tally] of book) {
      if (!key || !isGap(kind, tally)) continue;
      found.push({
        kind,
        key: kind === "director" ? spelt(tally, key) : key,
        seen: tally.seen,
        cards: tally.watched.size,
        held: tally.held,
        witness: tally.witness,
      });
    }
    /* THE ORDER IS DETERMINISTIC, and the third criterion is not
       decorative: a sheet that reshuffles its gaps between two openings
       casts doubt on what it claimed the first time. Widest gap first —
       what is held and left unwatched — then the biggest stock, then the
       RAW key. Never a translated label: the order would change with the
       language, and two screenshots of one binder would differ. */
    found.sort(
      (a, b) =>
        b.held - b.cards - (a.held - a.cards) || b.held - a.held || a.key.localeCompare(b.key)
    );
    gaps.push(...found.slice(0, HOW_MANY));
  }

  const tooThin = weighed.size < THIN;
  return { period, gaps: tooThin ? [] : gaps, weighed: weighed.size, tooThin };
}
