import { describe, it, expect } from "vitest";
import {
  ageOfFilms,
  almanacFor,
  craftspeople,
  subjects,
  driftHighlights,
  filmsOfYear,
  geography,
  longestStreak,
  loyalties,
  newDirectors,
  ratingByDecade,
  rhythm,
  screenTime,
  yearsCovered,
  gapToPublic,
  byYear,
} from "./almanac";
import { makeFilm } from "./film";
import type { Film, Watch } from "../types";

/* A watched card, with its log. The screenings are given in any order at
   all on purpose: nothing in the almanac may assume they arrive
   sorted. */
const seen = (title: string, watches: (Watch | string)[], extra: Partial<Film> = {}): Film =>
  makeFilm({
    title,
    watches: watches.map((w) => (typeof w === "string" ? { date: w, rating: null } : w)),
    ...extra,
  });

describe("yearsCovered", () => {
  it("returns only the years something happened in, most recent first", () => {
    const films = [seen("A", ["2021-03-02", "2024-01-01"]), seen("B", ["2021-11-30"])];
    expect(yearsCovered(films)).toEqual([2024, 2021]);
  });

  it("returns nothing from an empty collection, nor from cards with no screening", () => {
    expect(yearsCovered([])).toEqual([]);
    expect(yearsCovered([seen("A", [])])).toEqual([]);
  });

  it("rules out dates that say nothing", () => {
    expect(yearsCovered([seen("A", [{ date: "", rating: null }, "0000-01-01"])])).toEqual([]);
  });

  it("ignores the watchlist — a screening of an unwatched film does not exist", () => {
    const films = [seen("A", ["2024-05-05"], { status: "watchlist" })];
    expect(yearsCovered(films)).toEqual([]);
  });

  it("counts cards set aside: archiving them does not make them unwatched", () => {
    expect(yearsCovered([seen("A", ["2024-05-05"], { archived: true })])).toEqual([2024]);
  });
});

describe("longestStreak", () => {
  it("counts consecutive days", () => {
    expect(longestStreak(["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-09"])).toBe(3);
  });

  it("counts two screenings on the same day only once", () => {
    expect(longestStreak(["2024-03-01", "2024-03-01", "2024-03-02"])).toBe(2);
  });

  it("crosses a month end", () => {
    expect(longestStreak(["2024-01-31", "2024-02-01"])).toBe(2);
  });

  it("crosses a 29 February", () => {
    expect(longestStreak(["2024-02-28", "2024-02-29", "2024-03-01"])).toBe(3);
  });

  it("does NOT cross a 29 February that does not exist", () => {
    // 2023 is not a leap year: 28 February and 1 March do not touch
    expect(longestStreak(["2023-02-28", "2023-03-01"])).toBe(2);
  });

  it("returns zero with no date, and one for a single one", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2024-06-06"])).toBe(1);
  });
});

describe("almanacFor", () => {
  it("answers on an empty collection without inventing anything", () => {
    const a = almanacFor([], 2024);
    expect(a.count).toBe(0);
    expect(a.titles).toBe(0);
    expect(a.ratingAvg).toBeNull();
    expect(a.byMonth).toEqual(Array(12).fill(0));
    expect(a.firstWatch).toBeNull();
    expect(a.decades).toEqual([]);
  });

  it("counts SCREENINGS per month, not cards", () => {
    const films = [seen("A", ["2024-03-01", "2024-03-14", "2024-03-30"])];
    const a = almanacFor(films, 2024);
    expect(a.byMonth[2]).toBe(3);
    expect(a.count).toBe(3);
    expect(a.titles).toBe(1);
  });

  it("keeps only the year asked for", () => {
    const films = [seen("A", ["2023-12-31", "2024-01-01"])];
    expect(almanacFor(films, 2024).count).toBe(1);
    expect(almanacFor(films, 2023).count).toBe(1);
    expect(almanacFor(films, 2022).count).toBe(0);
  });

  it("calls a rewatch any screening that is not the film's first", () => {
    const films = [seen("A", ["2024-02-02", "2024-08-08"])];
    const a = almanacFor(films, 2024);
    expect(a.count).toBe(2);
    expect(a.rewatches).toBe(1);
  });

  it("counts as a rewatch a film discovered a year earlier", () => {
    const films = [seen("A", ["2019-05-05", "2024-05-05"])];
    expect(almanacFor(films, 2024).rewatches).toBe(1);
    expect(almanacFor(films, 2019).rewatches).toBe(0);
  });

  it("averages only the rated screenings — an unrated screening is not a zero", () => {
    const films = [
      seen("A", [
        { date: "2024-01-01", rating: 4 },
        { date: "2024-02-01", rating: null },
      ]),
    ];
    const a = almanacFor(films, 2024);
    expect(a.ratingAvg).toBe(4);
    expect(a.count).toBe(2);
  });

  it("files the ratings in half notches", () => {
    const films = [
      seen("A", [{ date: "2024-01-01", rating: 3.5 }]),
      seen("B", [{ date: "2024-01-02", rating: 5 }]),
    ];
    const h = almanacFor(films, 2024).ratingHistogram;
    expect(h).toHaveLength(11);
    expect(h[7]).toBe(1); // 3,5
    expect(h[10]).toBe(1); // 5
  });

  it("rules out of the decades the cards with no release year", () => {
    const films = [
      seen("A", ["2024-01-01"], { year: 1975 }),
      seen("B", ["2024-01-02"], { year: 1979 }),
      seen("C", ["2024-01-03"], { year: "" }),
    ];
    expect(almanacFor(films, 2024).decades).toEqual([{ decade: 1970, n: 2 }]);
  });

  it("ranks directors and genres, and breaks ties alphabetically", () => {
    const films = [
      seen("A", ["2024-01-01"], { director: "Varda", genres: ["Drame"] }),
      seen("B", ["2024-01-02"], { director: "Varda", genres: ["Drame", "Documentaire"] }),
      seen("C", ["2024-01-03"], { director: "Akerman", genres: ["Documentaire"] }),
    ];
    const a = almanacFor(films, 2024);
    expect(a.topDirectors).toEqual([
      { name: "Varda", n: 2 },
      { name: "Akerman", n: 1 },
    ]);
    expect(a.topGenres).toEqual([
      { name: "Documentaire", n: 2 },
      { name: "Drame", n: 2 },
    ]);
  });

  it("gives the year's first and last screening, in order", () => {
    const films = [seen("A", ["2024-09-09", "2024-02-02", "2024-05-05"])];
    const a = almanacFor(films, 2024);
    expect(a.firstWatch).toBe("2024-02-02");
    expect(a.lastWatch).toBe("2024-09-09");
  });

  it("does not count twice one date entered twice", () => {
    // the log is meant to be deduplicated by `mergeWatches`, but the
    // almanac must not collapse if a card escapes the rule
    const films = [seen("A", ["2024-04-04", "2024-04-04"])];
    expect(almanacFor(films, 2024).longestStreak).toBe(1);
  });
});

describe("filmsOfYear", () => {
  it("returns one line per film only, with its best rating of the year", () => {
    const films = [
      seen("A", [
        { date: "2024-01-01", rating: 3 },
        { date: "2024-06-06", rating: 4.5 },
      ]),
    ];
    expect(filmsOfYear(films, 2024)).toMatchObject([{ rating: 4.5, n: 2, date: "2024-06-06" }]);
  });

  it("ranks by rating, then by most recent screening", () => {
    const films = [
      seen("A", [{ date: "2024-01-01", rating: 3 }]),
      seen("B", [{ date: "2024-01-02", rating: 5 }]),
      seen("C", [{ date: "2024-12-12", rating: 3 }]),
    ];
    expect(filmsOfYear(films, 2024).map((f) => f.film.title)).toEqual(["B", "C", "A"]);
  });

  it("keeps an unrated film, but behind those that are rated", () => {
    const films = [
      seen("A", [{ date: "2024-05-05", rating: null }]),
      seen("B", [{ date: "2024-01-01", rating: 1 }]),
    ];
    expect(filmsOfYear(films, 2024).map((f) => f.film.title)).toEqual(["B", "A"]);
  });

  it("ignores the other years", () => {
    expect(filmsOfYear([seen("A", ["2023-01-01"])], 2024)).toEqual([]);
  });
});

describe("driftHighlights", () => {
  it("keeps a card's largest gap, and its direction", () => {
    const films = [
      seen("Solaris", [
        { date: "2010-01-01", rating: 2 },
        { date: "2020-01-01", rating: 5 },
      ]),
    ];
    expect(driftHighlights(films)).toMatchObject([
      { delta: 3, from: 2, to: 5, date: "2020-01-01" },
    ]);
  });

  it("ranks from the largest gap to the smallest, in both directions", () => {
    const films = [
      seen("A", [
        { date: "2010-01-01", rating: 3 },
        { date: "2020-01-01", rating: 4 },
      ]),
      seen("B", [
        { date: "2010-01-01", rating: 5 },
        { date: "2020-01-01", rating: 2 },
      ]),
    ];
    expect(driftHighlights(films).map((d) => d.film.title)).toEqual(["B", "A"]);
  });

  it("ignores a film that has not moved, or was watched only once", () => {
    const films = [
      seen("A", [
        { date: "2010-01-01", rating: 4 },
        { date: "2020-01-01", rating: 4 },
      ]),
      seen("B", [{ date: "2020-01-01", rating: 4 }]),
    ];
    expect(driftHighlights(films)).toEqual([]);
  });

  it("skips an unrated screening without breaking the comparison", () => {
    // watching again without rating has nothing to say: the gap is read
    // against the last RATED screening, as in `ratingDrift`
    const films = [
      seen("A", [
        { date: "2010-01-01", rating: 2 },
        { date: "2015-01-01", rating: null },
        { date: "2020-01-01", rating: 4 },
      ]),
    ];
    expect(driftHighlights(films)).toMatchObject([{ delta: 2 }]);
  });

  it("ignores the watchlist", () => {
    const films = [
      seen(
        "A",
        [
          { date: "2010-01-01", rating: 2 },
          { date: "2020-01-01", rating: 5 },
        ],
        { status: "watchlist" }
      ),
    ];
    expect(driftHighlights(films)).toEqual([]);
  });
});

describe("ageOfFilms", () => {
  it("measures the gap between the release and the screening", () => {
    const films = [seen("A", ["2024-01-01"], { year: 1990 })];
    expect(ageOfFilms(films, 2024).mean).toBe(34);
  });

  /* A 1920 silent film would shift the mean by ten years all on its own:
     the median is there to resist that kind of card. */
  it("returns a median that resists one isolated very old film", () => {
    const films = [
      seen("A", ["2024-01-01"], { year: 2020 }),
      seen("B", ["2024-01-02"], { year: 2018 }),
      seen("C", ["2024-01-03"], { year: 1920 }),
    ];
    const a = ageOfFilms(films, 2024);
    expect(a.median).toBe(6);
    expect(Math.round(a.mean!)).toBe(38);
  });

  it("rules out cards with no year rather than giving them two thousand years", () => {
    const films = [
      seen("A", ["2024-01-01"], { year: 1990 }),
      seen("B", ["2024-01-02"], { year: "" }),
    ];
    expect(ageOfFilms(films, 2024).mean).toBe(34);
  });

  it("counts the heritage share beyond twenty years", () => {
    const films = [
      seen("A", ["2024-01-01"], { year: 1990 }),
      seen("B", ["2024-01-02"], { year: 2020 }),
    ];
    expect(ageOfFilms(films, 2024).heritageShare).toBe(50);
  });

  it("returns nothing from an empty year", () => {
    expect(ageOfFilms([], 2024)).toMatchObject({ mean: null, median: null, oldest: null });
  });
});

describe("ratingByDecade", () => {
  it("averages the ratings by release decade", () => {
    const films = [
      seen("A", [{ date: "2024-01-01", rating: 4 }], { year: 1975 }),
      seen("B", [{ date: "2024-01-02", rating: 5 }], { year: 1979 }),
      seen("C", [{ date: "2024-01-03", rating: 2 }], { year: 1985 }),
    ];
    expect(ratingByDecade(films, 2024)).toEqual([
      { decade: 1970, avg: 4.5, n: 2 },
      { decade: 1980, avg: 2, n: 1 },
    ]);
  });

  it("does not invent a decade with no rated screening", () => {
    const films = [seen("A", [{ date: "2024-01-01", rating: null }], { year: 1975 })];
    expect(ratingByDecade(films, 2024)).toEqual([]);
  });
});

describe("newDirectors", () => {
  it("keeps only the filmmakers seen for the FIRST time that year", () => {
    const films = [
      seen("A", ["2019-01-01"], { director: "Varda" }),
      seen("B", ["2024-01-01"], { director: "Varda" }), // not a discovery
      seen("C", ["2024-01-02"], { director: "Akerman" }), // a discovery
    ];
    expect(newDirectors(films, 2024)).toEqual(["Akerman"]);
  });

  it("splits a co-direction", () => {
    const films = [seen("A", ["2024-01-01"], { director: "Powell, Pressburger" })];
    expect(newDirectors(films, 2024)).toEqual(["Powell", "Pressburger"]);
  });
});

describe("loyalties", () => {
  it("names only what comes back at least three times", () => {
    const films = [
      seen("A", ["2024-01-01"], { director: "Ozu", cast: ["Ryu"] }),
      seen("B", ["2024-01-02"], { director: "Ozu", cast: ["Ryu"] }),
      seen("C", ["2024-01-03"], { director: "Ozu", cast: ["Hara"] }),
      seen("D", ["2024-01-04"], { director: "Naruse", cast: ["Hara"] }),
    ];
    const l = loyalties(films, 2024);
    expect(l.directors).toEqual([{ name: "Ozu", n: 3 }]);
    expect(l.actors).toEqual([]); // Ryu 2, Hara 2 — sous le threshold
  });
});

describe("subjects", () => {
  it("files the keywords and the motifs separately", () => {
    const films = [
      seen("A", ["2024-01-01"], {
        keywords: ["time loop", "small town"],
        motifs: ["time-loop"],
      }),
      seen("B", ["2024-01-02"], { keywords: ["time loop"], motifs: ["time-loop", "flight"] }),
    ];
    const s = subjects(films, 2024);
    expect(s.keywords[0]).toEqual({ name: "time loop", n: 2 });
    expect(s.motifs[0]).toEqual({ name: "time-loop", n: 2 });
    /* The two vocabularies never mix: a motif has no business in the
       keyword ranking, and vice versa. */
    expect(s.keywords.map((x) => x.name)).not.toContain("flight");
  });

  it("counts only the period's screenings", () => {
    const films = [
      seen("A", ["2024-01-01"], { keywords: ["dream"] }),
      seen("B", ["2023-01-01"], { keywords: ["dream"] }),
    ];
    expect(subjects(films, 2024).keywords).toEqual([{ name: "dream", n: 1 }]);
  });

  /* A collection imported from a CSV has neither keywords nor motifs:
     the card must be able to draw itself on two empty lists rather than
     throw on the first stroke. */
  it("returns two empty lists when nothing is filled in", () => {
    expect(subjects([seen("A", ["2024-01-01"])], 2024)).toEqual({ keywords: [], motifs: [] });
  });

  it("returns two empty lists on an empty collection", () => {
    expect(subjects([], "always")).toEqual({ keywords: [], motifs: [] });
  });
});

describe("craftspeople", () => {
  it("counts cinematography, music and writing, each on its own", () => {
    const films = [
      seen("A", ["2024-01-01"], { crew: { image: ["Decaë"], musique: ["Delerue"] } }),
      seen("B", ["2024-01-02"], { crew: { image: ["Decaë"], scénario: ["Audiard"] } }),
    ];
    const a = craftspeople(films, 2024);
    expect(a.image).toEqual([{ name: "Decaë", n: 2 }]);
    expect(a.musique).toEqual([{ name: "Delerue", n: 1 }]);
    expect(a.scénario).toEqual([{ name: "Audiard", n: 1 }]);
  });

  /* No threshold, unlike the loyalties: two films by the same
     cinematographer is already worth a remark. So is one — it is the view
     that decides to show only what recurs. */
  it("imposes no threshold on itself", () => {
    const films = [seen("A", ["2024-01-01"], { crew: { musique: ["Vangelis"] } })];
    expect(craftspeople(films, 2024).musique).toEqual([{ name: "Vangelis", n: 1 }]);
  });

  it("counts a rewatch as one more screening", () => {
    const films = [seen("A", ["2024-01-01", "2024-06-01"], { crew: { image: ["Doyle"] } })];
    expect(craftspeople(films, 2024).image).toEqual([{ name: "Doyle", n: 2 }]);
  });

  /* The field is optional on the card, and `migrate` returns it as `{}`:
     a missing or empty `crew` must break nothing. */
  it("survives cards with no crew", () => {
    expect(craftspeople([seen("A", ["2024-01-01"])], 2024)).toEqual({
      image: [],
      musique: [],
      scénario: [],
    });
  });

  it("survives an empty collection", () => {
    expect(craftspeople([], "always")).toEqual({ image: [], musique: [], scénario: [] });
  });
});

describe("rhythm", () => {
  it("counts distinct days, not screenings", () => {
    const films = [seen("A", ["2024-03-01", "2024-03-01", "2024-03-05"])];
    expect(rhythm(films, 2024).days).toBe(2);
  });

  /* The drought is measured BETWEEN the first and the last screening: a
     year that started in March did not go through two months of drought,
     it had not started. */
  it("does not count the year's edges as a drought", () => {
    const films = [seen("A", ["2024-03-01", "2024-03-11"])];
    expect(rhythm(films, 2024).drought).toBe(9);
  });

  it("knows about leap years for the density", () => {
    const films = [seen("A", ["2024-03-01"])];
    expect(rhythm(films, 2024).density).toBeCloseTo((1 / 366) * 100, 6);
    expect(rhythm([seen("A", ["2023-03-01"])], 2023).density).toBeCloseTo((1 / 365) * 100, 6);
  });

  it("names the densest month, and nothing if the year is empty", () => {
    const films = [seen("A", ["2024-05-01", "2024-05-02", "2024-09-09"])];
    expect(rhythm(films, 2024).moisLePlusDense).toBe(5);
    expect(rhythm([], 2024).moisLePlusDense).toBeNull();
  });
});

describe("screenTime", () => {
  it("sums the runtimes and counts separately what it does not know", () => {
    const films = [
      seen("A", ["2024-01-01"], { runtime: 120 }),
      seen("B", ["2024-01-02"], { runtime: 90 }),
      seen("C", ["2024-01-03"], { runtime: null }),
    ];
    const s = screenTime(films, 2024);
    expect(s.minutes).toBe(210);
    expect(s.moyenne).toBe(105);
    expect(s.noRuntime).toBe(1);
    expect(s.longest?.runtime).toBe(120);
  });

  /* A runtime of zero is bad data, not a nought-minute film: it must not
     drag the mean down. */
  it("treats a zero runtime as unknown", () => {
    const films = [
      seen("A", ["2024-01-01"], { runtime: 100 }),
      seen("B", ["2024-01-02"], { runtime: 0 }),
    ];
    const s = screenTime(films, 2024);
    expect(s.moyenne).toBe(100);
    expect(s.noRuntime).toBe(1);
  });

  it("counts twice a film watched twice — we did watch it twice", () => {
    const films = [seen("A", ["2024-01-01", "2024-06-06"], { runtime: 100 })];
    expect(screenTime(films, 2024).minutes).toBe(200);
  });

  it("returns nothing from an empty year", () => {
    expect(screenTime([], 2024)).toMatchObject({ minutes: 0, moyenne: null, noRuntime: 0 });
  });
});

describe("geography", () => {
  it("ranks countries and languages, and counts the distinct countries", () => {
    const films = [
      seen("A", ["2024-01-01"], { countries: ["FR"], language: "fr" }),
      seen("B", ["2024-01-02"], { countries: ["FR", "IT"], language: "it" }),
      seen("C", ["2024-01-03"], { countries: ["JP"], language: "ja" }),
    ];
    const g = geography(films, 2024);
    expect(g.countries[0]).toEqual({ name: "FR", n: 2 });
    expect(g.countryCount).toBe(3);
    expect(g.languages).toHaveLength(3);
  });

  it("returns nothing when no card is filled in", () => {
    expect(geography([seen("A", ["2024-01-01"])], 2024)).toMatchObject({
      countryCount: 0,
      countries: [],
    });
  });
});

/* ============================================================
   THE "ALWAYS" PERIOD

   The almanac only knew how to answer by year. These tests hold the
   promise of the generalisation: what was counted over twelve months is
   counted over seven years without any function having to know it, and
   the little that resists — the density, the discoveries — says so
   plainly.
   ============================================================ */
describe("the whole practice", () => {
  const collection = () => [
    seen("A", ["2022-01-10", "2024-01-10"], { year: 1990, rating: 4 }),
    seen("B", ["2023-06-15"], { year: 2000 }),
    seen("C", ["2024-03-20"], { year: 1960 }),
  ];

  it("counts all the screenings, across all years", () => {
    const a = almanacFor(collection(), "always");
    expect(a.count).toBe(4);
    expect(a.titles).toBe(3);
    expect(a.period).toBe("always");
  });

  it("counts a rewatch as such even two years apart", () => {
    expect(almanacFor(collection(), "always").rewatches).toBe(1);
  });

  it("returns one slot per year covered, the oldest first", () => {
    const a = almanacFor(collection(), "always");
    expect(a.byYear.map((y) => y.year)).toEqual([2022, 2023, 2024]);
    expect(a.byYear.map((y) => y.screenings)).toEqual([1, 1, 2]);
  });

  it("does not draw the years on a yearly period", () => {
    // `byMonth` already answers that: the same information twice does not make it two
    expect(almanacFor(collection(), 2024).byYear).toEqual([]);
  });

  it("sets aside the question of filmmakers discovered", () => {
    // everybody was indeed discovered one day: the answer would be the whole list
    expect(newDirectors(collection(), "always")).toEqual([]);
  });

  it("relates the density to the span actually covered, not to the calendar year", () => {
    /* Two screenings a year apart: 2 days out of 367, and not 2 out of
       365 — over seven years, a calendar-year denominator would go past
       100%. */
    const r = rhythm([seen("A", ["2023-01-01", "2024-01-02"])], "always");
    expect(r.days).toBe(2);
    expect(r.density).toBeLessThan(1);
    expect(r.density).toBeGreaterThan(0);
  });

  it("counts a film's age from the year of ITS screening", () => {
    /* A 1990 film watched in 2000 was ten years old that evening, not
       thirty. Taking a fixed year over a whole practice would be wrong. */
    const a = ageOfFilms([seen("A", ["2000-01-01", "2020-01-01"], { year: 1990 })], "always");
    expect(a.mean).toBe(20); // (10 + 30) / 2
  });

  it("raises the loyalty threshold: three times in seven years is not a crossing", () => {
    const films = [seen("A", ["2019-01-01", "2020-01-01", "2021-01-01"], { director: "Ozu" })];
    expect(almanacFor(films, "always").loyalties.directors).toEqual([]);
  });
});

describe("gapToPublic", () => {
  it("brings both ratings onto the same scale before subtracting", () => {
    // 4/5 is 8/10: two points above a public sitting at 6
    const e = gapToPublic(
      [seen("A", [{ date: "2024-01-01", rating: 4 }], { tmdbRating: 6 })],
      2024
    );
    expect(e.you).toBe(8);
    expect(e.public).toBe(6);
    expect(e.gap).toBe(2);
    expect(e.n).toBe(1);
  });

  it("takes in only the screenings where BOTH ratings exist", () => {
    const films = [
      seen("Notée", [{ date: "2024-01-01", rating: 4 }], { tmdbRating: 6 }),
      seen("Sans public", [{ date: "2024-01-02", rating: 5 }], { tmdbRating: null }),
      seen("Sans you", ["2024-01-03"], { tmdbRating: 9 }),
    ];
    expect(gapToPublic(films, 2024).n).toBe(1);
  });

  it("files on one side what we like more than the crowd, on the other the opposite", () => {
    const films = [
      seen("Adoré", [{ date: "2024-01-01", rating: 5 }], { tmdbRating: 5 }),
      seen("Détesté", [{ date: "2024-01-02", rating: 1 }], { tmdbRating: 8 }),
    ];
    const e = gapToPublic(films, 2024);
    expect(e.mostGenerous[0]?.film.title).toBe("Adoré");
    expect(e.mostSevere[0]?.film.title).toBe("Détesté");
  });

  it("makes a rewatched film weigh only once in the rankings", () => {
    const films = [
      seen(
        "Revu",
        [
          { date: "2024-01-01", rating: 5 },
          { date: "2024-02-01", rating: 4 },
        ],
        { tmdbRating: 5 }
      ),
    ];
    expect(gapToPublic(films, 2024).mostGenerous).toHaveLength(1);
  });

  it("stays empty rather than returning zero when nothing is comparable", () => {
    const e = gapToPublic([seen("A", ["2024-01-01"])], 2024);
    expect(e).toMatchObject({ you: null, public: null, gap: null, n: 0 });
  });
});

describe("byYear", () => {
  it("returns screenings, titles and mean rating per year", () => {
    const films = [
      seen("A", [
        { date: "2023-01-01", rating: 4 },
        { date: "2023-02-01", rating: 2 },
      ]),
      seen("B", [{ date: "2024-01-01", rating: 5 }]),
    ];
    expect(byYear(films)).toEqual([
      { year: 2023, screenings: 2, titles: 1, rating: 3 },
      { year: 2024, screenings: 1, titles: 1, rating: 5 },
    ]);
  });

  it("leaves the rating empty on a year with no rated screening", () => {
    expect(byYear([seen("A", ["2024-01-01"])])[0]?.rating).toBeNull();
  });

  it("returns nothing from a collection with no screening", () => {
    expect(byYear([])).toEqual([]);
  });
});
