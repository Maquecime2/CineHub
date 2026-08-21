/* ============================================================
   THE ALMANAC — the collection looked at through time
   ============================================================

   The screening log is the card's richest data, and until now the least
   looked at: `WatchLog` shows it film by film, which answers "how many
   times that one" and never "what did I do with this year". This module
   answers the second question.

   IT COUNTS SCREENINGS, NOT CARDS, and that is the whole difference. A
   month in which the same film was watched six times is not a month in
   which six films were watched — but neither is it a month in which one
   film was watched. Both numbers are given, never one for the other.

   Pure, offline, React-free: like all of `domain/`. */
import { sortWatches } from "./film";
import type { Film, Watch } from "../types";

/* A screening tied back to its film — the shape the whole module works
   on, because counting years, directors and decades means knowing WHICH
   FILM each screening comes from. */
interface Screening {
  film: Film;
  watch: Watch;
}

/** `YYYY-MM-DD` → the year, or `null` if the date says nothing. */
const yearOf = (date: string | null | undefined): number | null => {
  const year = Number((date || "").slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : null;
};

/* WHAT WE LOOK AT: one year, or the whole practice.

   For a long time the almanac could only answer by year. That was the
   right cut to begin with — you take stock of a year, not of a quarter —
   but it left the question that comes next unanswered: "and since the
   beginning?". A collection kept for seven years has a shape that seven
   annual reports read one after another do not show.

   Rather than doubling every function, the period becomes a parameter.
   Almost everything generalises without another word: counting
   screenings, countries or decades never needs to know over what span.
   The little that resists — density, related to the calendar year — is
   dealt with where it resists. */
export type Period = number | "always";

/** Does the screening fall inside the period? An unreadable date, never. */
const inPeriod = (date: string | null | undefined, p: Period): boolean => {
  const year = yearOf(date);
  return year != null && (p === "always" || year === p);
};

/* EVERY SCREENING IN THE COLLECTION.

   Cards set aside count: having archived them does not make them
   unwatched. Those on the watchlist, on the other hand, have no business
   here — a screening of a film we have not seen does not exist, and if
   the log carries one, it is the status that is lagging.

   `migrate` guarantees a non-null `watches` and seeds the screening of a
   pre-log card from `watchedAt`. So we do NOT redo that work here: a film
   with no screening in its log is a film with no date, and it is right
   that it should weigh on no month at all. */
const screeningsOf = (films: Film[]): Screening[] => {
  const out: Screening[] = [];
  for (const film of films) {
    if (film.status === "watchlist") continue;
    for (const watch of film.watches || []) if (watch?.date) out.push({ film, watch });
  }
  return out;
};

/** The years something happened in, from the most recent to the oldest. */
export function yearsCovered(films: Film[]): number[] {
  const years = new Set<number>();
  for (const { watch } of screeningsOf(films)) {
    const year = yearOf(watch.date);
    if (year) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/* THE LONGEST RUN OF CONSECUTIVE DAYS.

   On sorted `YYYY-MM-DD` dates, we compare each day with the previous
   one + 1. Going through `Date` is what makes month ends and leap years
   free — counting them by hand on strings is exactly the kind of
   calculation you believe correct until 29 February.

   `Date.UTC` and not `new Date(string)`: the latter reads a bare date as
   UTC but a timestamped one as local, and one timezone's offset is enough
   to slide a midnight screening by a day. */
const inDays = (date: string): number => {
  const parts = date.split("-").map(Number);
  const a = parts[0] || 0;
  const m = parts[1] || 1;
  const j = parts[2] || 1;
  return Math.floor(Date.UTC(a, m - 1, j) / 86400000);
};

export function longestStreak(dates: string[]): number {
  const days = [...new Set(dates.filter(Boolean).map(inDays))].sort((a, b) => a - b);
  if (days.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    current = days[i] === (days[i - 1] as number) + 1 ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
}

/** The most frequent values, from most to least — on a tie, alphabetical order. */
const ranking = (values: string[], howMany: number): { name: string; n: number }[] => {
  const count = new Map<string, number>();
  for (const v of values) {
    const name = (v || "").trim();
    if (name) count.set(name, (count.get(name) || 0) + 1);
  }
  return [...count.entries()]
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, howMany);
};

/* ============================================================
   WHAT REVEALS A TASTE
   ============================================================

   A count says nothing about anyone: everybody watches films. What tells
   one collection from another is the AGE of what is watched, the
   countries visited, the people followed, and the rhythm of it. The
   functions that follow answer that.

   Each is exported and tests on its own, but all of them are called by
   `almanacFor`: the view has only one call to make, and cannot forget to
   make one. */

/** A card's release year, or `null` — the `Year` type allows emptiness. */
const releaseOf = (film: Film): number | null => {
  const n = typeof film.year === "number" ? film.year : Number(film.year);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? (t[m] as number) : ((t[m - 1] as number) + (t[m] as number)) / 2;
};

export interface AgeOfFilms {
  /** Mean gap, in years, between the film's release and the screening. */
  mean: number | null;
  median: number | null;
  /** Share of screenings of a film more than twenty years old, in %. */
  heritageShare: number | null;
  /** The oldest film watched in the year. */
  oldest: { film: Film; year: number } | null;
}

/* THE AGE OF WHAT WE WATCH.

   "You watch films thirty-four years old on average" says something no
   count says. The median goes with it because it resists a 1920 silent
   film which, on its own, would shift the mean by ten years all by
   itself.

   Cards with no release year are RULED OUT and not counted as zero: a
   film with no date would give an age of two thousand years. */
export function ageOfFilms(films: Film[], period: Period): AgeOfFilms {
  const ages: number[] = [];
  let oldest: { film: Film; year: number } | null = null;

  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    const release = releaseOf(film);
    if (release == null) continue;
    /* Age is counted from THE SCREENING's year, and not from the
       period's. Over one year the two coincide; over a whole practice,
       taking a fixed year would give a film watched in 2019 the age it
       has today. */
    ages.push((yearOf(watch.date) as number) - release);
    if (!oldest || release < oldest.year) oldest = { film, year: release };
  }

  if (ages.length === 0) return { mean: null, median: null, heritageShare: null, oldest: null };

  return {
    mean: ages.reduce((s, a) => s + a, 0) / ages.length,
    median: median(ages),
    heritageShare: (ages.filter((a) => a > 20).length / ages.length) * 100,
    oldest,
  };
}

/* THE MEAN RATING BY DECADE — the bias you do not know you have.

   You may be rating the 1970s half a star above everything else, without
   ever having noticed. Only RATED screenings come in here; a decade with
   no rating at all does not appear, rather than appearing at zero. */
export function ratingByDecade(
  films: Film[],
  period: Period
): { decade: number; avg: number; n: number }[] {
  const per = new Map<number, { sum: number; n: number }>();
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period) || watch.rating == null) continue;
    const release = releaseOf(film);
    if (release == null) continue;
    const d = Math.floor(release / 10) * 10;
    const batch = per.get(d) || { sum: 0, n: 0 };
    batch.sum += watch.rating;
    batch.n += 1;
    per.set(d, batch);
  }
  return [...per.entries()]
    .map(([decade, { sum, n }]) => ({ decade, avg: sum / n, n }))
    .sort((a, b) => a.decade - b.decade);
}

/* THE FILMMAKERS DISCOVERED THIS YEAR.

   "Discovered" and not "watched": we look at the WHOLE log to know
   whether that name had already appeared before. A director you have
   followed for ten years is not a discovery, even if you watched them
   again this year — and that is precisely the distinction that has
   value.

   ON "ALWAYS", THE QUESTION DISSOLVES: everybody was indeed discovered
   one day, and the answer would be the collection's entire list of
   filmmakers — true, and of no interest whatsoever. So we return an
   empty list, which reads "this question has no answer here", and the
   plate shows something else in that place. */
export function newDirectors(films: Film[], period: Period): string[] {
  if (period === "always") return [];
  const firstSeen = new Map<string, number>();
  for (const { film, watch } of screeningsOf(films)) {
    const year = yearOf(watch.date);
    if (year == null) continue;
    for (const name of namesIn(film.director)) {
      const seen = firstSeen.get(name);
      if (seen == null || year < seen) firstSeen.set(name, year);
    }
  }
  return [...firstSeen.entries()]
    .filter(([, year]) => year === period)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

/** Coen, Coen or Powell & Pressburger — one field, several people. */
const namesIn = (field: string): string[] =>
  (field || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

export interface Loyalties {
  /** Filmmakers watched at least `threshold` times within the period. */
  directors: { name: string; n: number }[];
  /** Performers met again at least `threshold` times within the period. */
  actors: { name: string; n: number }[];
}

/* LOYALTIES. Three times in one year is no accident: it is a crossing
   of a body of work, and it is the thing a film lover wants to see
   named. Below that, it is noise.

   Over a whole practice, three times no longer says anything — you get
   there by strolling. So the caller raises the threshold: it is a
   reading setting, not a rule of the domain, and the parameter already
   existed. */
export function loyalties(films: Film[], period: Period, threshold = 3): Loyalties {
  const directorNames: string[] = [];
  const actors: string[] = [];
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    directorNames.push(...namesIn(film.director));
    actors.push(...(film.cast || []));
  }
  const keep = (list: string[]) => ranking(list, 99).filter((x) => x.n >= threshold);
  return { directors: keep(directorNames), actors: keep(actors) };
}

/* ------------------------------------------------------------
   THE YEAR'S SUBJECTS
   ------------------------------------------------------------

   The almanac could say the genres, the countries, the languages, the
   filmmakers and the performers — that is to say WHO and FROM WHERE,
   never ABOUT WHAT. It was the only axis missing, and the most
   interesting: "a year of time loops and bereavements" says something
   other than "a year of French dramas".

   TWO LISTS AND NOT ONE, because the two vocabularies are not from the
   same hand. The keywords come from TMDB, in English, as they are. The
   motifs are the project's shared vocabulary, and they are IDENTIFIERS:
   "time-loop" reads "Le temps se répète" once it has been through
   `motifById`. Mixing them would give a list where raw English rubs
   shoulders with hyphenated identifiers, and where the count of one
   subject would end up split across two lines.

   Returned raw, like `geography`'s country codes: translating is display
   work, and the domain does not know what language it will be read in. */
export interface Subjects {
  /** The most-watched TMDB keywords — in English, as received. */
  keywords: { name: string; n: number }[];
  /** The catalogue's motifs, by `id`: the view translates them. */
  motifs: { name: string; n: number }[];
}

export function subjects(films: Film[], period: Period, howMany = 6): Subjects {
  const keywords: string[] = [];
  const motifIds: string[] = [];
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    keywords.push(...(film.keywords || []));
    motifIds.push(...(film.motifs || []));
  }
  return { keywords: ranking(keywords, howMany), motifs: ranking(motifIds, howMany) };
}

/* ------------------------------------------------------------
   THE CRAFTSPEOPLE FOLLOWED
   ------------------------------------------------------------

   `loyalties` only looks at directing and performing, that is to say the
   two fields we already know about. But `crew` has carried the
   cinematography and the music from the start, and that is where the
   loyalties hide that we never noticed ourselves contracting: nobody
   says to themselves "I follow a cinematographer's work", and yet.

   No threshold, unlike the loyalties: two films by the same
   cinematographer in one year is already worth a remark, where two films
   by the same filmmaker is not. The ranking returns what it finds, and
   the view decides to show only what recurs.

   THE KEYS STAY FRENCH, and they must: they are the ones used to index
   `film.crew`, which is written to disk as `{ image, musique, scénario }`.
   Translating them here would look for trades that do not exist and
   return three empty lists, without raising a thing. */
export interface Craftspeople {
  /** Cinematographers, from most watched to least. */
  image: { name: string; n: number }[];
  /** Composers. */
  musique: { name: string; n: number }[];
  /** Screenwriters — the third trade `crew` knows about. */
  scénario: { name: string; n: number }[];
}

export function craftspeople(films: Film[], period: Period, howMany = 5): Craftspeople {
  const by: Record<string, string[]> = { image: [], musique: [], scénario: [] };
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    for (const trade of Object.keys(by)) by[trade]!.push(...((film.crew || {})[trade] || []));
  }
  return {
    image: ranking(by.image!, howMany),
    musique: ranking(by.musique!, howMany),
    scénario: ranking(by.scénario!, howMany),
  };
}

export interface Rhythm {
  /** Distinct days on which something was watched. */
  days: number;
  /** Share of the period's days, in % — the density of the practice. */
  density: number;
  /** The longest gap with no screening at all, in days. */
  drought: number;
  /** The densest month, 1 to 12; `null` if the period is empty. */
  moisLePlusDense: number | null;
}

/* LE RYTHME.

   The drought is measured BETWEEN the first and the last screening of
   the year, and not from 1 January: a year that started in March did not
   go through two months of drought, it simply had not started. Counting
   the edges would make every newcomer look like an intermittent film
   lover.

   THE DENSITY IS THE ONLY THING THAT DOES NOT GENERALISE BY ITSELF.
   Related to three hundred and sixty-five days, it only makes sense over
   one year; over seven years it would say seven hundred per cent. On
   "always", the denominator therefore becomes the span ACTUALLY covered,
   from the first screening to the last — the same rule as the drought,
   and for the same reason: we do not hold against someone the years in
   which they were not yet keeping a log. */
export function rhythm(films: Film[], period: Period): Rhythm {
  const days = new Set<number>();
  const perMonth = Array(12).fill(0) as number[];
  for (const { watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    days.add(inDays(watch.date));
    const m = Number(watch.date.slice(5, 7));
    if (m >= 1 && m <= 12) perMonth[m - 1] = (perMonth[m - 1] as number) + 1;
  }

  const sorted = [...days].sort((a, b) => a - b);
  let drought = 0;
  for (let i = 1; i < sorted.length; i++)
    drought = Math.max(drought, (sorted[i] as number) - (sorted[i - 1] as number) - 1);

  const span =
    period === "always"
      ? sorted.length > 1
        ? (sorted[sorted.length - 1] as number) - (sorted[0] as number) + 1
        : sorted.length
      : period % 4 === 0 && (period % 100 !== 0 || period % 400 === 0)
        ? 366
        : 365;

  const max = Math.max(...perMonth);
  return {
    days: days.size,
    density: span > 0 ? (days.size / span) * 100 : 0,
    drought,
    moisLePlusDense: max > 0 ? perMonth.indexOf(max) + 1 : null,
  };
}

export interface ScreenTime {
  /** Cumulative minutes of the screenings whose runtime is known. */
  minutes: number;
  /** A screening's mean runtime; `null` if no runtime is known. */
  moyenne: number | null;
  longest: { film: Film; runtime: number } | null;
  /** Screenings whose runtime is missing — enough to say the total is a floor. */
  noRuntime: number;
}

/* THE HOURS OF CINEMA.

   Screenings with no known runtime are counted SEPARATELY and not
   silently ignored: "ninety-two hours" on a half-filled collection is a
   false figure, "ninety-two hours, and twelve screenings whose runtime is
   unknown" is an honest one. It is also what makes you want to go and
   click "complete the cards". */
export function screenTime(films: Film[], period: Period): ScreenTime {
  let minutes = 0;
  let n = 0;
  let noRuntime = 0;
  let longest: { film: Film; runtime: number } | null = null;

  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    if (film.runtime == null || film.runtime <= 0) {
      noRuntime += 1;
      continue;
    }
    minutes += film.runtime;
    n += 1;
    if (!longest || film.runtime > longest.runtime) longest = { film, runtime: film.runtime };
  }
  return { minutes, moyenne: n ? minutes / n : null, longest, noRuntime };
}

export interface Geography {
  /** ISO 3166-1 codes, from the most watched to the least. */
  countries: { name: string; n: number }[];
  /** Codes ISO 639-1. */
  languages: { name: string; n: number }[];
  /** How many distinct countries the year crossed. */
  countryCount: number;
}

/* GEOGRAPHY. We return CODES and not names: translating "JP" into
   "Japon" is a display-language choice, and it belongs to the view. The
   domain does not know what language it will be read in. */
export function geography(films: Film[], period: Period): Geography {
  const countries: string[] = [];
  const languages: string[] = [];
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    countries.push(...(film.countries || []));
    if (film.language) languages.push(film.language);
  }
  return {
    countries: ranking(countries, 6),
    languages: ranking(languages, 6),
    countryCount: new Set(countries).size,
  };
}

export interface Almanac {
  period: Period;
  /** The period's screenings — rewatches included. */
  count: number;
  /** Distinct cards touched: the number of films, not of evenings. */
  titles: number;
  /** Screenings of a film already seen before, here or before the period. */
  rewatches: number;
  /** Twelve slots, January first. Screenings, always. */
  byMonth: number[];
  /**
   * One slot per year covered, from the oldest to the most recent. Empty
   * on a yearly period: `byMonth` already answers that, and the same
   * information drawn twice does not make it two.
   */
  byYear: { year: number; screenings: number; titles: number; rating: number | null }[];
  /** Mean of the RATED screenings; `null` when none is. */
  ratingAvg: number | null;
  /** Eleven bins: 0, 0.5, 1 … 5. */
  ratingHistogram: number[];
  /** The release decades visited, from the oldest to the most recent. */
  decades: { decade: number; n: number }[];
  topDirectors: { name: string; n: number }[];
  topGenres: { name: string; n: number }[];
  longestStreak: number;
  firstWatch: string | null;
  lastWatch: string | null;
  /* What reveals a taste, rather than what counts it. Each also computes
     on its own — see the functions of the same name above. */
  age: AgeOfFilms;
  ratingByDecade: { decade: number; avg: number; n: number }[];
  newDirectors: string[];
  loyalties: Loyalties;
  /** What the year was about: TMDB keywords and catalogue motifs. */
  subjects: Subjects;
  /** The trades in the shadows, which `loyalties` did not look at. */
  craftspeople: Craftspeople;
  rhythm: Rhythm;
  screenTime: ScreenTime;
  geography: Geography;
  gap: GapToPublic;
}

/* ------------------------------------------------------------
   THE GAP FROM THE PUBLIC RATING
   ------------------------------------------------------------

   `tmdbRating` has been stored on every card from the start, and the type
   says plainly what it is for: "enough to measure one's own gap". The
   Credits view uses it per person; the same measure was missing at the
   scale of the practice — are you gentler or harsher than the
   foule, et sur quoi.

   Only the screenings where BOTH ratings exist count: comparing against
   a void would give an invented gap. The ratings are brought onto ten,
   yours being out of five — subtracting two different scales is a
   faute qu'aucun signe ne trahit ensuite. */
export interface GapToPublic {
  /** Your mean, out of ten, over the comparable screenings. */
  you: number | null;
  /** The public mean for the same films. */
  public: number | null;
  /** `you - public`. Positive: you are gentler. */
  gap: number | null;
  /** Comparable screenings — what the measure rests on. */
  n: number;
  /** Where you are furthest above the crowd, then furthest below. */
  mostGenerous: { film: Film; delta: number }[];
  mostSevere: { film: Film; delta: number }[];
}

export function gapToPublic(films: Film[], period: Period, howMany = 3): GapToPublic {
  let sumYou = 0;
  let sumPublic = 0;
  let n = 0;
  /* By FILM and not by screening: a film watched four times would weigh
     four times in a three-line ranking, and would fill it on its own. We
     keep its best rating within the period. */
  const byFilm = new Map<string, { film: Film; you: number }>();

  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    if (watch.rating == null || film.tmdbRating == null) continue;
    const you = watch.rating * 2;
    sumYou += you;
    sumPublic += film.tmdbRating;
    n += 1;
    const already = byFilm.get(film.id);
    if (!already || you > already.you) byFilm.set(film.id, { film, you });
  }

  const deltas = [...byFilm.values()]
    .map(({ film, you }) => ({ film, delta: you - (film.tmdbRating as number) }))
    .sort((a, b) => b.delta - a.delta);

  return {
    you: n ? sumYou / n : null,
    public: n ? sumPublic / n : null,
    gap: n ? (sumYou - sumPublic) / n : null,
    n,
    mostGenerous: deltas.filter((d) => d.delta > 0).slice(0, howMany),
    mostSevere: deltas
      .filter((d) => d.delta < 0)
      .slice(-howMany)
      .reverse(),
  };
}

/* ------------------------------------------------------------
   YEAR BY YEAR
   ------------------------------------------------------------

   What twelve monthly bars tell about a year, N yearly bars tell about a
   practice: the troughs, the climb, the year the log started being kept.
   It is the only thing the "always" report could not borrow from the
   yearly account — it needed one more graduation. */
export function byYear(
  films: Film[]
): { year: number; screenings: number; titles: number; rating: number | null }[] {
  const per = new Map<
    number,
    { screenings: number; films: Set<string>; sum: number; rated: number }
  >();
  for (const { film, watch } of screeningsOf(films)) {
    const year = yearOf(watch.date);
    if (year == null) continue;
    const batch = per.get(year) || { screenings: 0, films: new Set<string>(), sum: 0, rated: 0 };
    batch.screenings += 1;
    batch.films.add(film.id);
    if (watch.rating != null) {
      batch.sum += watch.rating;
      batch.rated += 1;
    }
    per.set(year, batch);
  }
  return [...per.entries()]
    .map(([year, l]) => ({
      year,
      screenings: l.screenings,
      titles: l.films.size,
      rating: l.rated ? l.sum / l.rated : null,
    }))
    .sort((a, b) => a.year - b.year);
}

/* WHAT A YEAR CONTAINS.

   One sweep per question, and none assumes another: an empty collection,
   a year with no screening and a screening with no rating all three give
   an answer — never an exception, never a `NaN`. That is what lets the
   view test nothing before drawing. */
export function almanacFor(films: Film[], period: Period): Almanac {
  const all = screeningsOf(films);
  const year = all.filter(({ watch }) => inPeriod(watch.date, period));

  const rated = year.filter(({ watch }) => watch.rating != null);
  const sum = rated.reduce((s, { watch }) => s + (watch.rating || 0), 0);

  const byMonth = Array(12).fill(0) as number[];
  for (const { watch } of year) {
    const month = Number(watch.date.slice(5, 7));
    if (month >= 1 && month <= 12) byMonth[month - 1] = (byMonth[month - 1] as number) + 1;
  }

  /* A rewatch is a screening that is not its film's FIRST, with the whole
     log to back it up — watching again in March a film discovered the
     year before is a rewatch, and counting it as a discovery would lie
     about what the year brought. */
  const firstSeen = new Map<string, string>();
  for (const { film, watch } of all) {
    const known = firstSeen.get(film.id);
    if (!known || watch.date < known) firstSeen.set(film.id, watch.date);
  }
  const rewatches = year.filter(({ film, watch }) => watch.date !== firstSeen.get(film.id)).length;

  const ratingHistogram = Array(11).fill(0) as number[];
  for (const { watch } of rated) {
    const case_ = Math.round((watch.rating || 0) * 2);
    if (case_ >= 0 && case_ <= 10) ratingHistogram[case_] = (ratingHistogram[case_] as number) + 1;
  }

  /* Decades are read from the film's RELEASE YEAR, which can be missing
     — the `Year` type allows the empty string, inherited from CSVs with
     no year column. Those cards are ruled out of the count rather than
     filed under year zero. */
  const byDecade = new Map<number, number>();
  for (const { film } of year) {
    const release = typeof film.year === "number" ? film.year : Number(film.year);
    if (!Number.isFinite(release) || release <= 0) continue;
    const d = Math.floor(release / 10) * 10;
    byDecade.set(d, (byDecade.get(d) || 0) + 1);
  }

  const dates = year.map(({ watch }) => watch.date).sort();

  return {
    period,
    count: year.length,
    titles: new Set(year.map(({ film }) => film.id)).size,
    rewatches,
    byMonth,
    byYear: period === "always" ? byYear(films) : [],
    ratingAvg: rated.length ? sum / rated.length : null,
    ratingHistogram,
    decades: [...byDecade.entries()]
      .map(([decade, n]) => ({ decade, n }))
      .sort((a, b) => a.decade - b.decade),
    topDirectors: ranking(
      year.map(({ film }) => film.director),
      6
    ),
    topGenres: ranking(
      year.flatMap(({ film }) => film.genres || []),
      6
    ),
    longestStreak: longestStreak(dates),
    firstWatch: dates[0] ?? null,
    lastWatch: dates[dates.length - 1] ?? null,
    age: ageOfFilms(films, period),
    ratingByDecade: ratingByDecade(films, period),
    newDirectors: newDirectors(films, period),
    /* Three times in one year is a crossing of a body of work; three times
       in seven, a coincidence. The threshold follows the period. */
    loyalties: loyalties(films, period, period === "always" ? 6 : 3),
    subjects: subjects(films, period),
    craftspeople: craftspeople(films, period),
    rhythm: rhythm(films, period),
    screenTime: screenTime(films, period),
    geography: geography(films, period),
    gap: gapToPublic(films, period),
  };
}

/* ------------------------------------------------------------
   THE FILMS OF THE YEAR
   ------------------------------------------------------------

   The almanac counts screenings; a picture to take away shows POSTERS,
   and therefore films — a film watched three times appears only once, with
   the best rating it received that year.

   The order is that of merit then of the calendar: on an equal rating, the
   most recently watched first. With no rating, a film does not go ahead of
   a rated one — but it does go, because not having rated is not a
   jugement. */
export interface FilmOfYear {
  film: Film;
  /** The best rating received that year; `null` if no screening is rated. */
  rating: number | null;
  /** The year's screenings for this film. */
  n: number;
  /** The year's last screening. */
  date: string;
}

export function filmsOfYear(films: Film[], period: Period): FilmOfYear[] {
  const per = new Map<string, FilmOfYear>();
  for (const { film, watch } of screeningsOf(films)) {
    if (!inPeriod(watch.date, period)) continue;
    const seen = per.get(film.id);
    if (!seen) {
      per.set(film.id, { film, rating: watch.rating, n: 1, date: watch.date });
      continue;
    }
    seen.n += 1;
    if (watch.rating != null && (seen.rating == null || watch.rating > seen.rating))
      seen.rating = watch.rating;
    if (watch.date > seen.date) seen.date = watch.date;
  }
  return [...per.values()].sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.date.localeCompare(a.date)
  );
}

/* ------------------------------------------------------------
   WHAT HAS MOVED
   ------------------------------------------------------------

   The almanac's most personal find is not a count: it is a film we had
   given three stars and that is worth five ten years later.
   `ratingDrift` already knows how to compute it on one card; all that
   was missing was a place to look at the whole collection from.

   We keep the LARGEST gap in absolute value, and we only retain the
   direction it leans in — a film that goes up then comes back down did
   move twice, but what we want to see is its amplitude. */
export interface Drift {
  film: Film;
  /** Signed: positive if the rating went up. */
  delta: number;
  from: number;
  to: number;
  /** The screening that carries this gap. */
  date: string;
}

export function driftHighlights(films: Film[], howMany = 5): Drift[] {
  const out: Drift[] = [];
  for (const film of films) {
    if (film.status === "watchlist") continue;
    const ordered = sortWatches(film.watches || []);
    let best: Drift | null = null;
    ordered.forEach((w, i) => {
      if (w.rating == null) return;
      const before = ordered.slice(i + 1).find((p) => p.rating != null);
      if (!before) return;
      const delta = w.rating - (before.rating as number);
      if (delta === 0) return;
      if (!best || Math.abs(delta) > Math.abs(best.delta))
        best = { film, delta, from: before.rating as number, to: w.rating, date: w.date };
    });
    if (best) out.push(best);
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, howMany);
}

/* ============================================================
   LA PLANCHE — CE QU'ON A VU, ET NON CE QU'ON A ACHETÉ
   ============================================================

   LA BOÎTE DE L'ANNÉE DESSINE DES AFFICHES, et une affiche n'est de
   personne : elle est hébergée par TMDB, elle ne coûte rien, et deux
   personnes ayant vu les mêmes films exportent la même image. Une
   planche de PHOTOGRAMMES est la seule image de ce produit qui puisse
   être à vous.

   DEUX SOURCES, ET L'ORDRE N'EST PAS UN GOÛT.

   `stills` sont VOS captures : elles vivent dans le coffre, elles sont
   miroitées, elles comptent dans `MEDIA_CEILING`. `frames` sont des
   plans que TMDB héberge, dont on ne garde que le CHEMIN, qui ne
   coûtent ni un appel ni un octet de capacité.

   Les vôtres passent devant, toujours. Et les `frames` ne sont pas un
   pis-aller honteux : sans elles la planche serait VIDE le jour de sa
   sortie, pour tout le monde — le défaut exact que `Film.synopsis` a
   coûté. C'est en voyant une belle planche faite des images de
   quelqu'un d'autre qu'on a envie d'y mettre les siennes.

   ON MARQUE DONC LAQUELLE EST LAQUELLE (`mine`), et l'écran le montre :
   sans cela on croirait avoir capturé ce qu'on n'a pas.

   UNE IMAGE PAR FILM, ET C'EST CE QUI FAIT UNE ANNÉE. Six captures d'un
   même film rempliraient la planche à elles seules et diraient
   « j'ai travaillé cette fiche », pas « voici mon année ».
   ============================================================ */

/** Une case de la planche. `src` est prêt à charger, jamais à composer. */
export interface PlateShot {
  filmId: string;
  title: string;
  /** `idb:<clé>` pour une capture à soi, une adresse TMDB pour un plan. */
  src: string;
  /** Vraie de vous. Ce que la planche distingue à l'œil. */
  mine: boolean;
}

/**
 * Choisit les images d'une planche, dans l'ordre des séances.
 *
 * @param idb     le préfixe des clés de coffre (`db.IDB_PREFIX`)
 * @param frameAt compose l'adresse d'un photogramme depuis son chemin
 *
 * LES DEUX SONT DONNÉS ET NON IMPORTÉS : ce module est du domaine pur,
 * et `db` comme `tmdb` sont des entrées-sorties. C'est la règle que
 * `yearInBox` énonce pour les couleurs — « elles lui sont données ».
 */
export function plateShots(
  films: FilmOfYear[],
  howMany: number,
  idb: string,
  frameAt: (path: string) => string
): PlateShot[] {
  const mine: PlateShot[] = [];
  const borrowed: PlateShot[] = [];

  for (const { film } of films) {
    /* La vignette plutôt que l'originale : décoder du 4K pour une case
       de planche est ce que `thumbKey` existe pour éviter. */
    const still = (film.stills || []).find((s) => s.thumbKey || s.key);
    if (still) {
      mine.push({
        filmId: film.id,
        title: film.title,
        src: idb + (still.thumbKey || still.key),
        mine: true,
      });
      continue;
    }
    const frame = (film.frames || [])[0];
    if (frame) {
      borrowed.push({ filmId: film.id, title: film.title, src: frameAt(frame), mine: false });
    }
  }

  /* LES VÔTRES D'ABORD, ET LE RESTE COMBLE. Mélangés dans l'ordre des
     séances, une année où l'on a capturé trois films sur vingt aurait
     rendu une planche d'emprunts avec trois des siennes perdues au
     milieu — c'est-à-dire l'inverse de ce qu'elle sert à montrer. */
  return [...mine, ...borrowed].slice(0, howMany);
}
