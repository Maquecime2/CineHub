import { describe, it, expect } from "vitest";
import { almanacFor, driftHighlights, filmsOfYear, longestStreak, yearsCovered } from "./almanac";
import { makeFilm } from "./film";
import type { Film, Watch } from "../types";

/* Une fiche vue, avec son journal. Les séances sont données dans
   n'importe quel ordre à dessein : rien dans l'almanach ne doit
   supposer qu'elles arrivent triées. */
const vu = (title: string, watches: (Watch | string)[], extra: Partial<Film> = {}): Film =>
  makeFilm({
    title,
    watches: watches.map((w) => (typeof w === "string" ? { date: w, rating: null } : w)),
    ...extra,
  });

describe("yearsCovered", () => {
  it("ne rend que les années où il s'est passé quelque chose, la plus récente en tête", () => {
    const films = [vu("A", ["2021-03-02", "2024-01-01"]), vu("B", ["2021-11-30"])];
    expect(yearsCovered(films)).toEqual([2024, 2021]);
  });

  it("ne rend rien d'une collection vide, ni de fiches sans séance", () => {
    expect(yearsCovered([])).toEqual([]);
    expect(yearsCovered([vu("A", [])])).toEqual([]);
  });

  it("écarte les dates qui ne disent rien", () => {
    expect(yearsCovered([vu("A", [{ date: "", rating: null }, "0000-01-01"])])).toEqual([]);
  });

  it("ignore la liste à voir — une séance sur un film non vu n'existe pas", () => {
    const films = [vu("A", ["2024-05-05"], { status: "watchlist" })];
    expect(yearsCovered(films)).toEqual([]);
  });

  it("compte les fiches mises de côté : les archiver ne les rend pas non vues", () => {
    expect(yearsCovered([vu("A", ["2024-05-05"], { archived: true })])).toEqual([2024]);
  });
});

describe("longestStreak", () => {
  it("compte les jours consécutifs", () => {
    expect(longestStreak(["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-09"])).toBe(3);
  });

  it("ne compte qu'une fois deux séances du même jour", () => {
    expect(longestStreak(["2024-03-01", "2024-03-01", "2024-03-02"])).toBe(2);
  });

  it("franchit une fin de mois", () => {
    expect(longestStreak(["2024-01-31", "2024-02-01"])).toBe(2);
  });

  it("franchit un 29 février", () => {
    expect(longestStreak(["2024-02-28", "2024-02-29", "2024-03-01"])).toBe(3);
  });

  it("ne franchit PAS un 29 février qui n'existe pas", () => {
    // 2023 n'est pas bissextile : le 28 février et le 1er mars ne se touchent pas
    expect(longestStreak(["2023-02-28", "2023-03-01"])).toBe(2);
  });

  it("rend zéro sans date, et un pour une seule", () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(["2024-06-06"])).toBe(1);
  });
});

describe("almanacFor", () => {
  it("répond sur une collection vide sans rien inventer", () => {
    const a = almanacFor([], 2024);
    expect(a.count).toBe(0);
    expect(a.titles).toBe(0);
    expect(a.ratingAvg).toBeNull();
    expect(a.byMonth).toEqual(Array(12).fill(0));
    expect(a.firstWatch).toBeNull();
    expect(a.decades).toEqual([]);
  });

  it("compte les SÉANCES par mois, pas les fiches", () => {
    const films = [vu("A", ["2024-03-01", "2024-03-14", "2024-03-30"])];
    const a = almanacFor(films, 2024);
    expect(a.byMonth[2]).toBe(3);
    expect(a.count).toBe(3);
    expect(a.titles).toBe(1);
  });

  it("ne retient que l'année demandée", () => {
    const films = [vu("A", ["2023-12-31", "2024-01-01"])];
    expect(almanacFor(films, 2024).count).toBe(1);
    expect(almanacFor(films, 2023).count).toBe(1);
    expect(almanacFor(films, 2022).count).toBe(0);
  });

  it("appelle revoyure toute séance qui n'est pas la première du film", () => {
    const films = [vu("A", ["2024-02-02", "2024-08-08"])];
    const a = almanacFor(films, 2024);
    expect(a.count).toBe(2);
    expect(a.rewatches).toBe(1);
  });

  it("compte comme revoyure un film découvert une année plus tôt", () => {
    const films = [vu("A", ["2019-05-05", "2024-05-05"])];
    expect(almanacFor(films, 2024).rewatches).toBe(1);
    expect(almanacFor(films, 2019).rewatches).toBe(0);
  });

  it("ne moyenne que les séances notées — une séance sans note n'est pas un zéro", () => {
    const films = [
      vu("A", [
        { date: "2024-01-01", rating: 4 },
        { date: "2024-02-01", rating: null },
      ]),
    ];
    const a = almanacFor(films, 2024);
    expect(a.ratingAvg).toBe(4);
    expect(a.count).toBe(2);
  });

  it("range les notes en demi-crans", () => {
    const films = [
      vu("A", [{ date: "2024-01-01", rating: 3.5 }]),
      vu("B", [{ date: "2024-01-02", rating: 5 }]),
    ];
    const h = almanacFor(films, 2024).ratingHistogram;
    expect(h).toHaveLength(11);
    expect(h[7]).toBe(1); // 3,5
    expect(h[10]).toBe(1); // 5
  });

  it("écarte des décennies les fiches sans année de sortie", () => {
    const films = [
      vu("A", ["2024-01-01"], { year: 1975 }),
      vu("B", ["2024-01-02"], { year: 1979 }),
      vu("C", ["2024-01-03"], { year: "" }),
    ];
    expect(almanacFor(films, 2024).decades).toEqual([{ decade: 1970, n: 2 }]);
  });

  it("classe réalisateurs et genres, et tranche les égalités par l'alphabet", () => {
    const films = [
      vu("A", ["2024-01-01"], { director: "Varda", genres: ["Drame"] }),
      vu("B", ["2024-01-02"], { director: "Varda", genres: ["Drame", "Documentaire"] }),
      vu("C", ["2024-01-03"], { director: "Akerman", genres: ["Documentaire"] }),
    ];
    const a = almanacFor(films, 2024);
    expect(a.topDirectors).toEqual([
      { nom: "Varda", n: 2 },
      { nom: "Akerman", n: 1 },
    ]);
    expect(a.topGenres).toEqual([
      { nom: "Documentaire", n: 2 },
      { nom: "Drame", n: 2 },
    ]);
  });

  it("donne la première et la dernière séance de l'année, dans l'ordre", () => {
    const films = [vu("A", ["2024-09-09", "2024-02-02", "2024-05-05"])];
    const a = almanacFor(films, 2024);
    expect(a.firstWatch).toBe("2024-02-02");
    expect(a.lastWatch).toBe("2024-09-09");
  });

  it("ne compte pas deux fois une même date rentrée deux fois", () => {
    // le journal est censé être dédoublonné par `mergeWatches`, mais
    // l'almanach ne doit pas s'écrouler si une fiche échappe à la règle
    const films = [vu("A", ["2024-04-04", "2024-04-04"])];
    expect(almanacFor(films, 2024).longestStreak).toBe(1);
  });
});

describe("filmsOfYear", () => {
  it("ne rend qu'une ligne par film, avec sa meilleure note de l'année", () => {
    const films = [
      vu("A", [
        { date: "2024-01-01", rating: 3 },
        { date: "2024-06-06", rating: 4.5 },
      ]),
    ];
    expect(filmsOfYear(films, 2024)).toMatchObject([{ rating: 4.5, n: 2, date: "2024-06-06" }]);
  });

  it("classe par note, puis par séance la plus récente", () => {
    const films = [
      vu("A", [{ date: "2024-01-01", rating: 3 }]),
      vu("B", [{ date: "2024-01-02", rating: 5 }]),
      vu("C", [{ date: "2024-12-12", rating: 3 }]),
    ];
    expect(filmsOfYear(films, 2024).map((f) => f.film.title)).toEqual(["B", "C", "A"]);
  });

  it("garde un film non noté, mais derrière ceux qui le sont", () => {
    const films = [
      vu("A", [{ date: "2024-05-05", rating: null }]),
      vu("B", [{ date: "2024-01-01", rating: 1 }]),
    ];
    expect(filmsOfYear(films, 2024).map((f) => f.film.title)).toEqual(["B", "A"]);
  });

  it("ignore les autres années", () => {
    expect(filmsOfYear([vu("A", ["2023-01-01"])], 2024)).toEqual([]);
  });
});

describe("driftHighlights", () => {
  it("retient le plus grand écart d'une fiche, et son sens", () => {
    const films = [
      vu("Solaris", [
        { date: "2010-01-01", rating: 2 },
        { date: "2020-01-01", rating: 5 },
      ]),
    ];
    expect(driftHighlights(films)).toMatchObject([
      { delta: 3, from: 2, to: 5, date: "2020-01-01" },
    ]);
  });

  it("classe du plus grand écart au plus petit, dans les deux sens", () => {
    const films = [
      vu("A", [
        { date: "2010-01-01", rating: 3 },
        { date: "2020-01-01", rating: 4 },
      ]),
      vu("B", [
        { date: "2010-01-01", rating: 5 },
        { date: "2020-01-01", rating: 2 },
      ]),
    ];
    expect(driftHighlights(films).map((d) => d.film.title)).toEqual(["B", "A"]);
  });

  it("ignore un film qui n'a pas bougé, ou vu une seule fois", () => {
    const films = [
      vu("A", [
        { date: "2010-01-01", rating: 4 },
        { date: "2020-01-01", rating: 4 },
      ]),
      vu("B", [{ date: "2020-01-01", rating: 4 }]),
    ];
    expect(driftHighlights(films)).toEqual([]);
  });

  it("saute une séance sans note sans rompre la comparaison", () => {
    // revoir sans noter n'a rien à dire : l'écart se lit face à la
    // dernière séance NOTÉE, comme dans `ratingDrift`
    const films = [
      vu("A", [
        { date: "2010-01-01", rating: 2 },
        { date: "2015-01-01", rating: null },
        { date: "2020-01-01", rating: 4 },
      ]),
    ];
    expect(driftHighlights(films)).toMatchObject([{ delta: 2 }]);
  });

  it("ignore la liste à voir", () => {
    const films = [
      vu(
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
