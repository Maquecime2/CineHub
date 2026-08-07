import { describe, it, expect } from "vitest";
import {
  ageOfFilms,
  almanacFor,
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
  écartAuPublic,
  parAnnée,
} from "./almanac";
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

describe("ageOfFilms", () => {
  it("mesure l'écart entre la sortie et la séance", () => {
    const films = [vu("A", ["2024-01-01"], { year: 1990 })];
    expect(ageOfFilms(films, 2024).moyen).toBe(34);
  });

  /* Un muet de 1920 décalerait la moyenne de dix ans à lui seul : la
     médiane est là pour résister à ce genre de fiche. */
  it("rend une médiane qui résiste à un film isolé très ancien", () => {
    const films = [
      vu("A", ["2024-01-01"], { year: 2020 }),
      vu("B", ["2024-01-02"], { year: 2018 }),
      vu("C", ["2024-01-03"], { year: 1920 }),
    ];
    const a = ageOfFilms(films, 2024);
    expect(a.median).toBe(6);
    expect(Math.round(a.moyen!)).toBe(38);
  });

  it("écarte les fiches sans année plutôt que de leur donner deux mille ans", () => {
    const films = [vu("A", ["2024-01-01"], { year: 1990 }), vu("B", ["2024-01-02"], { year: "" })];
    expect(ageOfFilms(films, 2024).moyen).toBe(34);
  });

  it("compte la part de patrimoine au-delà de vingt ans", () => {
    const films = [
      vu("A", ["2024-01-01"], { year: 1990 }),
      vu("B", ["2024-01-02"], { year: 2020 }),
    ];
    expect(ageOfFilms(films, 2024).partPatrimoine).toBe(50);
  });

  it("ne rend rien d'une année vide", () => {
    expect(ageOfFilms([], 2024)).toMatchObject({ moyen: null, median: null, plusAncien: null });
  });
});

describe("ratingByDecade", () => {
  it("moyenne les notes par décennie de sortie", () => {
    const films = [
      vu("A", [{ date: "2024-01-01", rating: 4 }], { year: 1975 }),
      vu("B", [{ date: "2024-01-02", rating: 5 }], { year: 1979 }),
      vu("C", [{ date: "2024-01-03", rating: 2 }], { year: 1985 }),
    ];
    expect(ratingByDecade(films, 2024)).toEqual([
      { decade: 1970, avg: 4.5, n: 2 },
      { decade: 1980, avg: 2, n: 1 },
    ]);
  });

  it("n'invente pas une décennie qui n'a aucune séance notée", () => {
    const films = [vu("A", [{ date: "2024-01-01", rating: null }], { year: 1975 })];
    expect(ratingByDecade(films, 2024)).toEqual([]);
  });
});

describe("newDirectors", () => {
  it("ne retient que les cinéastes vus pour la PREMIÈRE fois cette année", () => {
    const films = [
      vu("A", ["2019-01-01"], { director: "Varda" }),
      vu("B", ["2024-01-01"], { director: "Varda" }), // pas une découverte
      vu("C", ["2024-01-02"], { director: "Akerman" }), // une découverte
    ];
    expect(newDirectors(films, 2024)).toEqual(["Akerman"]);
  });

  it("sépare une co-réalisation", () => {
    const films = [vu("A", ["2024-01-01"], { director: "Powell, Pressburger" })];
    expect(newDirectors(films, 2024)).toEqual(["Powell", "Pressburger"]);
  });
});

describe("loyalties", () => {
  it("ne nomme que ce qui revient au moins trois fois", () => {
    const films = [
      vu("A", ["2024-01-01"], { director: "Ozu", cast: ["Ryu"] }),
      vu("B", ["2024-01-02"], { director: "Ozu", cast: ["Ryu"] }),
      vu("C", ["2024-01-03"], { director: "Ozu", cast: ["Hara"] }),
      vu("D", ["2024-01-04"], { director: "Naruse", cast: ["Hara"] }),
    ];
    const l = loyalties(films, 2024);
    expect(l.directors).toEqual([{ nom: "Ozu", n: 3 }]);
    expect(l.actors).toEqual([]); // Ryu 2, Hara 2 — sous le seuil
  });
});

describe("rhythm", () => {
  it("compte les jours distincts, pas les séances", () => {
    const films = [vu("A", ["2024-03-01", "2024-03-01", "2024-03-05"])];
    expect(rhythm(films, 2024).jours).toBe(2);
  });

  /* La disette se mesure ENTRE la première et la dernière séance : une
     année commencée en mars n'a pas connu deux mois de disette, elle
     n'avait pas commencé. */
  it("ne compte pas les bords de l'année comme une disette", () => {
    const films = [vu("A", ["2024-03-01", "2024-03-11"])];
    expect(rhythm(films, 2024).disette).toBe(9);
  });

  it("connaît les années bissextiles pour la densité", () => {
    const films = [vu("A", ["2024-03-01"])];
    expect(rhythm(films, 2024).densite).toBeCloseTo((1 / 366) * 100, 6);
    expect(rhythm([vu("A", ["2023-03-01"])], 2023).densite).toBeCloseTo((1 / 365) * 100, 6);
  });

  it("désigne le mois le plus dense, et rien si l'année est vide", () => {
    const films = [vu("A", ["2024-05-01", "2024-05-02", "2024-09-09"])];
    expect(rhythm(films, 2024).moisLePlusDense).toBe(5);
    expect(rhythm([], 2024).moisLePlusDense).toBeNull();
  });
});

describe("screenTime", () => {
  it("cumule les durées et compte à part ce qu'il ignore", () => {
    const films = [
      vu("A", ["2024-01-01"], { runtime: 120 }),
      vu("B", ["2024-01-02"], { runtime: 90 }),
      vu("C", ["2024-01-03"], { runtime: null }),
    ];
    const s = screenTime(films, 2024);
    expect(s.minutes).toBe(210);
    expect(s.moyenne).toBe(105);
    expect(s.sansDuree).toBe(1);
    expect(s.plusLong?.runtime).toBe(120);
  });

  /* Une durée de zéro est une donnée fausse, pas un film de zéro
     minute : elle ne doit pas tirer la moyenne vers le bas. */
  it("traite une durée nulle comme inconnue", () => {
    const films = [
      vu("A", ["2024-01-01"], { runtime: 100 }),
      vu("B", ["2024-01-02"], { runtime: 0 }),
    ];
    const s = screenTime(films, 2024);
    expect(s.moyenne).toBe(100);
    expect(s.sansDuree).toBe(1);
  });

  it("compte deux fois un film revu deux fois — on l'a bien regardé deux fois", () => {
    const films = [vu("A", ["2024-01-01", "2024-06-06"], { runtime: 100 })];
    expect(screenTime(films, 2024).minutes).toBe(200);
  });

  it("ne rend rien d'une année vide", () => {
    expect(screenTime([], 2024)).toMatchObject({ minutes: 0, moyenne: null, sansDuree: 0 });
  });
});

describe("geography", () => {
  it("classe pays et langues, et compte les pays distincts", () => {
    const films = [
      vu("A", ["2024-01-01"], { countries: ["FR"], language: "fr" }),
      vu("B", ["2024-01-02"], { countries: ["FR", "IT"], language: "it" }),
      vu("C", ["2024-01-03"], { countries: ["JP"], language: "ja" }),
    ];
    const g = geography(films, 2024);
    expect(g.pays[0]).toEqual({ nom: "FR", n: 2 });
    expect(g.nbPays).toBe(3);
    expect(g.langues).toHaveLength(3);
  });

  it("ne rend rien quand aucune fiche n'est renseignée", () => {
    expect(geography([vu("A", ["2024-01-01"])], 2024)).toMatchObject({ nbPays: 0, pays: [] });
  });
});

/* ============================================================
   LA PÉRIODE « TOUJOURS »

   L'almanach ne savait répondre que par année. Ces tests tiennent la
   promesse de la généralisation : ce qui se comptait sur douze mois se
   compte sur sept ans sans qu'aucune fonction ait à le savoir, et le
   peu qui résiste — la densité, les découvertes — le dit franchement.
   ============================================================ */
describe("toujours", () => {
  const collection = () => [
    vu("A", ["2022-01-10", "2024-01-10"], { year: 1990, rating: 4 }),
    vu("B", ["2023-06-15"], { year: 2000 }),
    vu("C", ["2024-03-20"], { year: 1960 }),
  ];

  it("compte toutes les séances, toutes années confondues", () => {
    const a = almanacFor(collection(), "toujours");
    expect(a.count).toBe(4);
    expect(a.titles).toBe(3);
    expect(a.période).toBe("toujours");
  });

  it("compte la revoyure comme telle même à deux ans d'écart", () => {
    expect(almanacFor(collection(), "toujours").rewatches).toBe(1);
  });

  it("rend une case par année couverte, la plus ancienne d'abord", () => {
    const a = almanacFor(collection(), "toujours");
    expect(a.byYear.map((y) => y.year)).toEqual([2022, 2023, 2024]);
    expect(a.byYear.map((y) => y.séances)).toEqual([1, 1, 2]);
  });

  it("ne dessine pas les années sur une période annuelle", () => {
    // `byMonth` y répond déjà : la même information deux fois n'en fait pas une de plus
    expect(almanacFor(collection(), 2024).byYear).toEqual([]);
  });

  it("écarte la question des cinéastes découverts", () => {
    // tout le monde a bien été découvert un jour : la réponse serait la liste entière
    expect(newDirectors(collection(), "toujours")).toEqual([]);
  });

  it("rapporte la densité à l'étendue vraiment couverte, non à l'année civile", () => {
    /* Deux séances à un an d'écart : 2 jours sur 367, et non 2 sur 365
       — sur sept ans, un dénominateur d'année civile passerait les 100 %. */
    const r = rhythm([vu("A", ["2023-01-01", "2024-01-02"])], "toujours");
    expect(r.jours).toBe(2);
    expect(r.densite).toBeLessThan(1);
    expect(r.densite).toBeGreaterThan(0);
  });

  it("compte l'âge d'un film depuis l'année de SA séance", () => {
    /* Un film de 1990 vu en 2000 avait dix ans ce soir-là, pas trente.
       Prendre une année fixe sur toute une pratique serait faux. */
    const a = ageOfFilms([vu("A", ["2000-01-01", "2020-01-01"], { year: 1990 })], "toujours");
    expect(a.moyen).toBe(20); // (10 + 30) / 2
  });

  it("relève le seuil de fidélité : trois fois en sept ans n'est pas une traversée", () => {
    const films = [vu("A", ["2019-01-01", "2020-01-01", "2021-01-01"], { director: "Ozu" })];
    expect(almanacFor(films, "toujours").loyalties.directors).toEqual([]);
  });
});

describe("écartAuPublic", () => {
  it("ramène les deux notes sur la même échelle avant de soustraire", () => {
    // 4/5 vaut 8/10 : deux points au-dessus d'un public à 6
    const e = écartAuPublic(
      [vu("A", [{ date: "2024-01-01", rating: 4 }], { tmdbRating: 6 })],
      2024
    );
    expect(e.vous).toBe(8);
    expect(e.public).toBe(6);
    expect(e.écart).toBe(2);
    expect(e.n).toBe(1);
  });

  it("n'entre que les séances où les DEUX notes existent", () => {
    const films = [
      vu("Notée", [{ date: "2024-01-01", rating: 4 }], { tmdbRating: 6 }),
      vu("Sans public", [{ date: "2024-01-02", rating: 5 }], { tmdbRating: null }),
      vu("Sans vous", ["2024-01-03"], { tmdbRating: 9 }),
    ];
    expect(écartAuPublic(films, 2024).n).toBe(1);
  });

  it("range d'un côté ce qu'on aime plus que la foule, de l'autre le contraire", () => {
    const films = [
      vu("Adoré", [{ date: "2024-01-01", rating: 5 }], { tmdbRating: 5 }),
      vu("Détesté", [{ date: "2024-01-02", rating: 1 }], { tmdbRating: 8 }),
    ];
    const e = écartAuPublic(films, 2024);
    expect(e.plusTendre[0]?.film.title).toBe("Adoré");
    expect(e.plusSévère[0]?.film.title).toBe("Détesté");
  });

  it("ne fait peser un film revu qu'une fois dans les palmarès", () => {
    const films = [
      vu(
        "Revu",
        [
          { date: "2024-01-01", rating: 5 },
          { date: "2024-02-01", rating: 4 },
        ],
        { tmdbRating: 5 }
      ),
    ];
    expect(écartAuPublic(films, 2024).plusTendre).toHaveLength(1);
  });

  it("reste vide plutôt que de rendre zéro quand rien n'est comparable", () => {
    const e = écartAuPublic([vu("A", ["2024-01-01"])], 2024);
    expect(e).toMatchObject({ vous: null, public: null, écart: null, n: 0 });
  });
});

describe("parAnnée", () => {
  it("rend séances, titres et note moyenne par année", () => {
    const films = [
      vu("A", [
        { date: "2023-01-01", rating: 4 },
        { date: "2023-02-01", rating: 2 },
      ]),
      vu("B", [{ date: "2024-01-01", rating: 5 }]),
    ];
    expect(parAnnée(films)).toEqual([
      { year: 2023, séances: 2, titres: 1, note: 3 },
      { year: 2024, séances: 1, titres: 1, note: 5 },
    ]);
  });

  it("laisse la note vide sur une année sans aucune séance notée", () => {
    expect(parAnnée([vu("A", ["2024-01-01"])])[0]?.note).toBeNull();
  });

  it("ne rend rien d'une collection sans séance", () => {
    expect(parAnnée([])).toEqual([]);
  });
});
