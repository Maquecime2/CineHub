import { describe, it, expect } from "vitest";
import { weightOf, directorsOf, decadeOf, buildTaste, favorites, topDirectors } from "./taste";

/* Card factory: only the fields that matter for the test are named, the
   rest take neutral values. */
const film = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: "Film",
  year: 2000,
  rating: 0,
  director: "",
  genres: [],
  themes: [],
  status: "watched",
  ...over,
});

describe("weightOf", () => {
  it("puts the point of indifference at 2.5 stars", () => {
    expect(weightOf(2.5)).toBe(0);
  });

  it("turns negative below 2.5 and reaches ±1 at the ends", () => {
    expect(weightOf(1)).toBeLessThan(0);
    expect(weightOf(5)).toBe(1);
    expect(weightOf(0.5)).toBeCloseTo(-0.8);
  });

  it("counts a film seen but unrated only faintly", () => {
    // Letterboxd imports are mostly without a rating: ignoring them
    // would empty the profile of its substance
    expect(weightOf(0)).toBe(0.35);
    expect(weightOf(undefined)).toBe(0.35);
  });
});

describe("directorsOf", () => {
  it("splits multiple directors apart and trims the spaces", () => {
    expect(directorsOf({ director: "Joel Coen, Ethan Coen" })).toEqual(["Joel Coen", "Ethan Coen"]);
  });

  it("returns an empty list when the field is missing or empty", () => {
    expect(directorsOf({})).toEqual([]);
    expect(directorsOf({ director: "  ,  " })).toEqual([]);
  });
});

describe("decadeOf", () => {
  it("rounds down to the decade", () => {
    expect(decadeOf(1967)).toBe(1960);
    expect(decadeOf(1970)).toBe(1970);
    expect(decadeOf("1999")).toBe(1990);
  });

  it("returns null with no year", () => {
    expect(decadeOf(null)).toBeNull();
    expect(decadeOf(undefined)).toBeNull();
  });
});

describe("buildTaste", () => {
  it("ignores the watchlist, which states an intention and not an observed taste", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ status: "watchlist", rating: 5, genres: ["Horreur"] }),
    ]);
    expect(taste.total).toBe(3);
    expect(taste.seenGenres.has("Horreur")).toBe(false);
  });

  it("normalises the weights: the largest in absolute value is 1", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 4, genres: ["Comédie"] }),
    ]);
    const max = Math.max(...[...taste.genres.values()].map(Math.abs));
    expect(max).toBeCloseTo(1);
    expect(taste.genres.get("Comédie")).toBeLessThan(taste.genres.get("Drame"));
  });

  it("leaves a negative weight on what is hated", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 1, genres: ["Horreur"] }),
    ]);
    expect(taste.genres.get("Horreur")).toBeLessThan(0);
  });

  it("weighs themes above genres, because they are typed in by hand", () => {
    // same rating, same number of occurrences: only the 1.4 coefficient separates them
    const films = [film({ rating: 4, genres: ["Drame"], themes: ["deuil"] })];
    const taste = buildTaste([...films, ...films, ...films]);
    // each is normalised within its own table, so we compare the raw ones
    const rawGenre = weightOf(4) * 3;
    const rawTheme = weightOf(4) * 1.4 * 3;
    expect(rawTheme / rawGenre).toBeCloseTo(1.4);
    expect(taste.themes.get("deuil")).toBeCloseTo(1);
  });

  it("declares itself empty below three films seen", () => {
    expect(buildTaste([film(), film()]).isEmpty).toBe(true);
    expect(buildTaste([film(), film(), film()]).isEmpty).toBe(false);
  });

  it("works out the mean year and its spread", () => {
    const taste = buildTaste([film({ year: 1990 }), film({ year: 2000 }), film({ year: 2010 })]);
    expect(taste.meanYear).toBe(2000);
    expect(taste.spread).toBeCloseTo(Math.sqrt(200 / 3));
  });

  it("survives an empty collection", () => {
    const taste = buildTaste([]);
    expect(taste.total).toBe(0);
    expect(taste.isEmpty).toBe(true);
    expect(taste.meanYear).toBeNull();
    expect(taste.spread).toBeNull();
    expect(taste.genres.size).toBe(0);
  });

  it("counts the rated cards apart from the total", () => {
    const taste = buildTaste([film({ rating: 4 }), film({ rating: 0 }), film({ rating: 3 })]);
    expect(taste.total).toBe(3);
    expect(taste.rated).toBe(2);
  });

  it("leaves the language profile empty when the cards do not carry that field", () => {
    // a real case from Letterboxd imports — the scoring must cope with it
    const taste = buildTaste([film(), film(), film()]);
    expect(taste.seenLanguages.size).toBe(0);
  });
});

describe("favorites", () => {
  it("keeps only films seen, rated at least 4, and tied to TMDB", () => {
    const out = favorites([
      film({ title: "gardé", rating: 4.5, tmdbId: 1 }),
      film({ title: "trop bas", rating: 3.5, tmdbId: 2 }),
      film({ title: "sans tmdbId", rating: 5 }),
      film({ title: "watchlist", rating: 5, tmdbId: 3, status: "watchlist" }),
    ]);
    expect(out.map((f) => f.title)).toEqual(["gardé"]);
  });

  it("sorts by falling rating then by recent addition, and respects the limit", () => {
    const out = favorites(
      [
        film({ title: "b", rating: 5, tmdbId: 1, addedAt: 1 }),
        film({ title: "a", rating: 5, tmdbId: 2, addedAt: 2 }),
        film({ title: "c", rating: 4, tmdbId: 3, addedAt: 3 }),
      ],
      2
    );
    expect(out.map((f) => f.title)).toEqual(["a", "b"]);
  });
});

describe("topDirectors", () => {
  it("demands several cards, or a very clear liking on a single one", () => {
    const films = [
      film({ rating: 5, director: "Récurrent" }),
      film({ rating: 5, director: "Récurrent" }),
      film({ rating: 3, director: "Tiède" }),
    ];
    const taste = buildTaste(films);
    const names = topDirectors(films, taste).map((d) => d.name);
    expect(names).toContain("Récurrent");
    expect(names).not.toContain("Tiède");
  });

  it("admits a single card when the liking dominates the collection", () => {
    /* The 0.75 threshold applies AFTER normalisation: it is therefore
       relative to the strongest film-maker. A lone 5-star passes here, but
       would no longer pass if another name gathered two 5-star cards —
       which is the intended behaviour: "bedside" is judged against the
       rest. */
    const films = [
      film({ rating: 5, director: "Adoré" }),
      film({ rating: 3, director: "Tiède" }),
      film({ rating: 3, director: "Autre" }),
    ];
    const taste = buildTaste(films);
    expect(topDirectors(films, taste).map((d) => d.name)).toContain("Adoré");
  });

  it("sets aside directors of negative weight", () => {
    const films = [
      film({ rating: 5, director: "Aimé" }),
      film({ rating: 5, director: "Aimé" }),
      film({ rating: 1, director: "Détesté" }),
      film({ rating: 1, director: "Détesté" }),
    ];
    const taste = buildTaste(films);
    expect(topDirectors(films, taste).map((d) => d.name)).toEqual(["Aimé"]);
  });

  it("returns the number of cards and the weight, and respects the limit", () => {
    const films = [
      film({ rating: 5, director: "A" }),
      film({ rating: 5, director: "A" }),
      film({ rating: 4, director: "B" }),
      film({ rating: 4, director: "B" }),
    ];
    const taste = buildTaste(films);
    const top = topDirectors(films, taste, 1);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ name: "A", count: 2 });
    expect(top[0].weight).toBeGreaterThan(0);
  });
});
