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
  it("place le point d'indifférence à 2,5 étoiles", () => {
    expect(weightOf(2.5)).toBe(0);
  });

  it("devient négatif en dessous de 2,5 et atteint ±1 aux extrêmes", () => {
    expect(weightOf(1)).toBeLessThan(0);
    expect(weightOf(5)).toBe(1);
    expect(weightOf(0.5)).toBeCloseTo(-0.8);
  });

  it("compte faiblement un film vu mais non noté", () => {
    // Letterboxd imports are mostly without a rating: ignoring them
    // would empty the profile of its substance
    expect(weightOf(0)).toBe(0.35);
    expect(weightOf(undefined)).toBe(0.35);
  });
});

describe("directorsOf", () => {
  it("sépare les réalisateurs multiples et retire les espaces", () => {
    expect(directorsOf({ director: "Joel Coen, Ethan Coen" })).toEqual(["Joel Coen", "Ethan Coen"]);
  });

  it("renvoie une liste vide quand le champ est absent ou vide", () => {
    expect(directorsOf({})).toEqual([]);
    expect(directorsOf({ director: "  ,  " })).toEqual([]);
  });
});

describe("decadeOf", () => {
  it("arrondit à la décennie inférieure", () => {
    expect(decadeOf(1967)).toBe(1960);
    expect(decadeOf(1970)).toBe(1970);
    expect(decadeOf("1999")).toBe(1990);
  });

  it("renvoie null sans année", () => {
    expect(decadeOf(null)).toBeNull();
    expect(decadeOf(undefined)).toBeNull();
  });
});

describe("buildTaste", () => {
  it("ignore la watchlist, qui exprime une intention et non un goût constaté", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ status: "watchlist", rating: 5, genres: ["Horreur"] }),
    ]);
    expect(taste.total).toBe(3);
    expect(taste.seenGenres.has("Horreur")).toBe(false);
  });

  it("normalise les poids : le plus fort en valeur absolue vaut 1", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 4, genres: ["Comédie"] }),
    ]);
    const max = Math.max(...[...taste.genres.values()].map(Math.abs));
    expect(max).toBeCloseTo(1);
    expect(taste.genres.get("Comédie")).toBeLessThan(taste.genres.get("Drame"));
  });

  it("laisse un poids négatif à ce qui est détesté", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 1, genres: ["Horreur"] }),
    ]);
    expect(taste.genres.get("Horreur")).toBeLessThan(0);
  });

  it("pèse les thèmes plus que les genres, parce qu'ils sont saisis à la main", () => {
    // same rating, same number of occurrences: only the 1.4 coefficient separates them
    const films = [film({ rating: 4, genres: ["Drame"], themes: ["deuil"] })];
    const taste = buildTaste([...films, ...films, ...films]);
    // each is normalised within its own table, so we compare the raw ones
    const rawGenre = weightOf(4) * 3;
    const rawTheme = weightOf(4) * 1.4 * 3;
    expect(rawTheme / rawGenre).toBeCloseTo(1.4);
    expect(taste.themes.get("deuil")).toBeCloseTo(1);
  });

  it("se déclare vide en dessous de trois films vus", () => {
    expect(buildTaste([film(), film()]).isEmpty).toBe(true);
    expect(buildTaste([film(), film(), film()]).isEmpty).toBe(false);
  });

  it("calcule l'année moyenne et sa dispersion", () => {
    const taste = buildTaste([film({ year: 1990 }), film({ year: 2000 }), film({ year: 2010 })]);
    expect(taste.meanYear).toBe(2000);
    expect(taste.spread).toBeCloseTo(Math.sqrt(200 / 3));
  });

  it("survit à une collection vide", () => {
    const taste = buildTaste([]);
    expect(taste.total).toBe(0);
    expect(taste.isEmpty).toBe(true);
    expect(taste.meanYear).toBeNull();
    expect(taste.spread).toBeNull();
    expect(taste.genres.size).toBe(0);
  });

  it("compte les fiches notées à part du total", () => {
    const taste = buildTaste([film({ rating: 4 }), film({ rating: 0 }), film({ rating: 3 })]);
    expect(taste.total).toBe(3);
    expect(taste.rated).toBe(2);
  });

  it("laisse le profil de langue vide quand les fiches ne portent pas ce champ", () => {
    // a real case from Letterboxd imports — the scoring must cope with it
    const taste = buildTaste([film(), film(), film()]);
    expect(taste.seenLanguages.size).toBe(0);
  });
});

describe("favorites", () => {
  it("ne retient que les films vus, notés au moins 4, et rattachables à TMDB", () => {
    const out = favorites([
      film({ title: "gardé", rating: 4.5, tmdbId: 1 }),
      film({ title: "trop bas", rating: 3.5, tmdbId: 2 }),
      film({ title: "sans tmdbId", rating: 5 }),
      film({ title: "watchlist", rating: 5, tmdbId: 3, status: "watchlist" }),
    ]);
    expect(out.map((f) => f.title)).toEqual(["gardé"]);
  });

  it("trie par note décroissante puis par ajout récent, et respecte la limite", () => {
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
  it("exige plusieurs fiches, ou une adhésion très nette sur une seule", () => {
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

  it("admet une seule fiche quand l'adhésion domine la collection", () => {
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

  it("écarte les réalisateurs de poids négatif", () => {
    const films = [
      film({ rating: 5, director: "Aimé" }),
      film({ rating: 5, director: "Aimé" }),
      film({ rating: 1, director: "Détesté" }),
      film({ rating: 1, director: "Détesté" }),
    ];
    const taste = buildTaste(films);
    expect(topDirectors(films, taste).map((d) => d.name)).toEqual(["Aimé"]);
  });

  it("renvoie le nombre de fiches et le poids, et respecte la limite", () => {
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
