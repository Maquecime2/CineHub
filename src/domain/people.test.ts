import { describe, it, expect } from "vitest";
import {
  averageRating,
  census,
  companions,
  pageOf,
  rolesOnFilm,
  searchPeople,
  sortPeople,
  type Person,
  standouts,
} from "./people";
import { makeFilm } from "./film";
import type { Film } from "../types";

const film = (title: string, partial: Partial<Film> = {}) => makeFilm({ title, ...partial });

const by = (people: ReturnType<typeof census>, name: string) => people.find((p) => p.name === name);

describe("census", () => {
  it("returns nothing from an empty collection", () => {
    expect(census([])).toEqual([]);
  });

  it("brings together one name written two ways", () => {
    /* "Decae" typed by hand and "Decaë" come from TMDB are the same
       cinematographer: two entries would make two strangers of them. */
    const people = census([
      film("Ascenseur", { crew: { image: ["Henri Decaë"] } }),
      film("Le Samouraï", { crew: { image: ["Henri Decae"] } }),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0]!.films).toHaveLength(2);
  });

  it("keeps the most frequent spelling", () => {
    const people = census([
      film("A", { crew: { image: ["Henri Decaë"] } }),
      film("B", { crew: { image: ["Henri Decaë"] } }),
      film("C", { crew: { image: ["henri decae"] } }),
    ]);
    expect(people[0]!.name).toBe("Henri Decaë");
  });

  it("carries several roles without splitting in two", () => {
    const people = census([
      film("Le Cercle rouge", {
        director: "Jean-Pierre Melville",
        crew: { scénario: ["Jean-Pierre Melville"] },
      }),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0]!.roles).toEqual(["réalisation", "scénario"]);
    // and the film counts only once, despite the two hats
    expect(people[0]!.films).toHaveLength(1);
  });

  it("rules out keywords, which are not people", () => {
    const people = census([film("Stalker", { themes: ["la pluie"], director: "Tarkovski" })]);
    expect(people.map((p) => p.name)).toEqual(["Tarkovski"]);
  });

  it("counts the watched, the to-watch and the screenings", () => {
    const people = census([
      film("A", {
        director: "Varda",
        status: "watched",
        watches: [
          { date: "2024-01-02", rating: 4 },
          { date: "2020-05-05", rating: 4 },
        ],
      }),
      film("B", { director: "Varda", status: "watchlist" }),
    ]);
    const varda = by(people, "Varda")!;
    expect(varda.watched).toBe(1);
    expect(varda.toWatch).toBe(1);
    expect(varda.screenings).toBe(2);
  });

  it("does not let an unrated film drag the average down", () => {
    /* A zero means "not rated": counting it would make someone we simply
       have not judged look lukewarm. */
    const people = census([
      film("A", { director: "Ozu", rating: 5 }),
      film("B", { director: "Ozu", rating: 0 }),
    ]);
    expect(by(people, "Ozu")!.rating).toBe(5);
  });

  it("leaves the rating empty when nothing is rated", () => {
    expect(census([film("A", { director: "Ozu" })])[0]!.rating).toBeNull();
  });
});

describe("the gap to the public rating", () => {
  it("is measured on the same scale", () => {
    // 4/5 is 8/10: two points above a public sitting at 6
    const people = census([film("A", { director: "Ozu", rating: 4, tmdbRating: 6 })]);
    expect(by(people, "Ozu")!.gap).toBe(2);
  });

  it("stays empty with no public rating", () => {
    const people = census([film("A", { director: "Ozu", rating: 4, tmdbRating: null })]);
    expect(by(people, "Ozu")!.gap).toBeNull();
  });

  it("ignores the cards where one of the two ratings is missing", () => {
    const people = census([
      film("A", { director: "Ozu", rating: 4, tmdbRating: 6 }),
      film("B", { director: "Ozu", rating: 0, tmdbRating: 9 }),
    ]);
    expect(by(people, "Ozu")!.gap).toBe(2);
  });
});

describe("the period and the motifs", () => {
  it("runs from the oldest to the most recent", () => {
    const people = census([
      film("A", { director: "Ozu", year: 1953 }),
      film("B", { director: "Ozu", year: 1949 }),
      film("C", { director: "Ozu", year: "" }),
    ]);
    expect(by(people, "Ozu")!.period).toEqual([1949, 1953]);
  });

  it("only keeps a motif that recurs", () => {
    const people = census([
      film("A", { director: "Ozu", motifs: ["train", "sea"] }),
      film("B", { director: "Ozu", motifs: ["train"] }),
    ]);
    expect(by(people, "Ozu")!.motifs).toEqual(["train"]);
  });
});

describe("rolesOnFilm", () => {
  it("says in what capacities somebody is there", () => {
    const f = film("Le Cercle rouge", {
      director: "Jean-Pierre Melville",
      crew: { scénario: ["Jean-Pierre Melville"], image: ["Henri Decaë"] },
    });
    expect(rolesOnFilm(f, "jean-pierre melville")).toEqual(["réalisation", "scénario"]);
    expect(rolesOnFilm(f, "henri decae")).toEqual(["image"]);
    expect(rolesOnFilm(f, "personne")).toEqual([]);
  });
});

describe("searchPeople", () => {
  const people = census([
    film("A", { director: "Agnès Varda" }),
    film("B", { cast: ["Kenji Kurozu"] }),
    film("C", { director: "Yasujirō Ozu" }),
  ]);

  it("finds despite the accents", () => {
    expect(searchPeople(people, "agnes").map((p) => p.name)).toEqual(["Agnès Varda"]);
  });

  it("finds by the surname, which does not open the name", () => {
    expect(searchPeople(people, "varda").map((p) => p.name)).toEqual(["Agnès Varda"]);
  });

  it("puts first whoever has a WORD starting with what you type", () => {
    // "ozu" must return Ozu before Kurozu, which only contains it in the middle
    expect(searchPeople(people, "ozu").map((p) => p.name)).toEqual([
      "Yasujirō Ozu",
      "Kenji Kurozu",
    ]);
  });

  it("returns everybody on an empty search", () => {
    expect(searchPeople(people, "  ")).toHaveLength(3);
  });
});

describe("standouts", () => {
  /* Six directors, one film each: enough to fill the rows, and each of
     them a "regular" by their role. */
  const many = (n: number, make: (i: number) => Partial<Film>) =>
    Array.from({ length: n }, (_, i) => film(`F${i}`, make(i)));

  it("gives back nothing from an empty collection", () => {
    expect(standouts([])).toEqual({ loyal: [], loved: [], newcomers: [] });
  });

  it("holds no row back on a collection too small to rank", () => {
    /* Two names under a heading called "your loyalties" announce a
       ranking where there is only scarcity. */
    const people = census([film("A", { director: "Ozu" }), film("B", { director: "Varda" })]);
    expect(standouts(people).loyal).toEqual([]);
  });

  it("caps each row", () => {
    const people = census(
      Array.from({ length: 9 }, (_, i) => [
        film(`A${i}`, { director: `D${i}` }),
        film(`B${i}`, { director: `D${i}` }),
      ]).flat()
    );
    expect(standouts(people).loyal).toHaveLength(6);
  });

  it("calls nobody a loyalty on a single film", () => {
    /* `isRegular` lets a composer heard once into the directory, and
       that is right there — but a row named "your loyalties" naming
       them says something untrue. */
    const people = census(many(6, (i) => ({ director: `D${i}` })));
    expect(standouts(people).loyal).toEqual([]);
  });

  it("leaves the loved row empty when nothing is rated", () => {
    const people = census(many(6, (i) => ({ director: `D${i}` })));
    expect(standouts(people).loved).toEqual([]);
  });

  it("ranks the loved by your rating, and only from two films", () => {
    const people = census([
      ...many(3, (i) => ({ director: "Ozu", rating: 5, year: 1950 + i })),
      ...many(3, (i) => ({ director: "Varda", rating: 3, year: 1960 + i })),
      ...many(3, (i) => ({ director: "Melville", rating: 4, year: 1970 + i })),
      // rated by nobody, so a loyalty without being one of the loved
      ...many(3, (i) => ({ director: "Tati", year: 1980 + i })),
      // one film only: not judged on it
      film("Once", { director: "Akerman", rating: 5 }),
    ]);
    expect(standouts(people).loved.map((p) => p.name)).toEqual(["Ozu", "Melville", "Varda"]);
  });

  it("drops the loved row when it names exactly the loyalties", () => {
    /* The same three names under two headings, in a different order,
       reads as a bug and not as two rankings. */
    const people = census([
      ...many(2, (i) => ({ director: "Ozu", rating: 5, year: 1950 + i })),
      ...many(2, (i) => ({ director: "Varda", rating: 3, year: 1960 + i })),
      ...many(2, (i) => ({ director: "Melville", rating: 4, year: 1970 + i })),
    ]);
    const { loyal, loved } = standouts(people);
    expect(loyal.map((p) => p.name).sort()).toEqual(["Melville", "Ozu", "Varda"]);
    expect(loved).toEqual([]);
  });

  it("does not show a loyalty a second time as a newcomer", () => {
    /* A collection built in one go used to serve the same six names
       under three headings, which is worse than showing nothing. */
    const people = census(
      Array.from({ length: 6 }, (_, i) => [
        film(`A${i}`, { director: `D${i}`, addedAt: 1000 + i }),
        film(`B${i}`, { director: `D${i}`, addedAt: 1000 + i }),
      ]).flat()
    );
    const { loyal, newcomers } = standouts(people);
    expect(loyal).not.toHaveLength(0);
    expect(newcomers.filter((p) => loyal.some((l) => l.key === p.key))).toEqual([]);
  });

  it("puts the last cards filed first among the newcomers", () => {
    const people = census([
      ...many(6, (i) => ({ director: `D${i}`, addedAt: 1000 })),
      film("Late", { cast: ["Nouvelle Venue", "Autre Venu", "Troisième Venu"], addedAt: 9000 }),
    ]);
    expect(
      standouts(people)
        .newcomers.slice(0, 3)
        .map((p) => p.name)
    ).toEqual(["Autre Venu", "Nouvelle Venue", "Troisième Venu"]);
  });
});

describe("averageRating", () => {
  it("is empty when nothing is rated", () => {
    expect(averageRating([film("A"), film("B")])).toBeNull();
  });

  it("leaves the unrated cards out, rather than counting them as zero", () => {
    expect(averageRating([film("A", { rating: 4 }), film("B", { rating: 0 })])).toBe(4);
  });
});

describe("companions", () => {
  it("gives back nobody when somebody is alone on their films", () => {
    expect(companions([film("A", { director: "Ozu" })], "ozu")).toEqual([]);
  });

  it("counts by film and not by hat", () => {
    /* Melville directs AND writes: met once on that card, not twice. */
    const films = [
      film("Le Cercle rouge", {
        director: "Jean-Pierre Melville",
        crew: { scénario: ["Jean-Pierre Melville"], image: ["Henri Decaë"] },
      }),
      film("Le Samouraï", {
        director: "Jean-Pierre Melville",
        crew: { image: ["Henri Decaë"] },
      }),
    ];
    expect(companions(films, "henri decae")).toEqual([
      { key: "jean-pierre melville", name: "Jean-Pierre Melville", n: 2 },
    ]);
  });

  it("rules out keywords, which are not people", () => {
    const films = [film("Stalker", { director: "Tarkovski", themes: ["la pluie"] })];
    expect(companions(films, "tarkovski")).toEqual([]);
  });

  it("orders by how often one meets them", () => {
    const films = [
      film("A", { director: "Ozu", cast: ["Setsuko Hara", "Chishū Ryū"] }),
      film("B", { director: "Ozu", cast: ["Chishū Ryū"] }),
    ];
    expect(companions(films, "ozu").map((c) => c.name)).toEqual(["Chishū Ryū", "Setsuko Hara"]);
  });

  it("keeps the most frequent spelling, like the census", () => {
    const films = [
      film("A", { director: "Melville", crew: { image: ["Henri Decaë"] } }),
      film("B", { director: "Melville", crew: { image: ["Henri Decaë"] } }),
      film("C", { director: "Melville", crew: { image: ["henri decae"] } }),
    ];
    expect(companions(films, "melville")[0]!.name).toBe("Henri Decaë");
  });
});

describe("pageOf", () => {
  it("returns null for a stranger", () => {
    expect(pageOf([film("A", { director: "Ozu" })], "kurosawa")).toBeNull();
  });

  it("finds somebody by their normalized key", () => {
    expect(pageOf([film("A", { director: "Agnès Varda" })], "agnes varda")?.name).toBe(
      "Agnès Varda"
    );
  });
});

/* ============================================================
   L'ORDRE DU RÉPERTOIRE

   Quatre tris, et le seul qui demande à être éprouvé est celui des
   NOTES : une personne qu'on n'a jamais notée n'a pas une mauvaise note,
   elle n'en a pas — et la faire passer pour la pire serait pire que de
   ne pas trier du tout.
   ============================================================ */
describe("sortPeople", () => {
  const who = (name: string, extra: Partial<Person> = {}): Person =>
    ({
      key: name.toLowerCase(),
      name,
      roles: ["réalisation"],
      films: ["f1"],
      watched: 1,
      toWatch: 0,
      screenings: 1,
      rating: null,
      gap: null,
      period: null,
      motifs: [],
      lastAdded: 0,
      lastSeen: "",
      ...extra,
    }) as Person;

  it("range par nombre de films, le mieux fourni d'abord", () => {
    const out = sortPeople(
      [who("Peu", { films: ["a"] }), who("Beaucoup", { films: ["a", "b", "c"] })],
      "films"
    );
    expect(out.map((p) => p.name)).toEqual(["Beaucoup", "Peu"]);
  });

  it("range par note, la meilleure d'abord", () => {
    const out = sortPeople([who("Moyen", { rating: 3 }), who("Aimé", { rating: 4.5 })], "rating");
    expect(out.map((p) => p.name)).toEqual(["Aimé", "Moyen"]);
  });

  /* LE POINT DU BLOC. */
  it("met les non notés à la fin, jamais devant", () => {
    const out = sortPeople(
      [who("Jamais noté"), who("Tiède", { rating: 1 }), who("Aimé", { rating: 5 })],
      "rating"
    );
    expect(out.map((p) => p.name)).toEqual(["Aimé", "Tiède", "Jamais noté"]);
  });

  it("range par dernière séance, la plus récente d'abord", () => {
    const out = sortPeople(
      [who("Vieux", { lastSeen: "2020-01-01" }), who("Frais", { lastSeen: "2026-01-01" })],
      "seen"
    );
    expect(out.map((p) => p.name)).toEqual(["Frais", "Vieux"]);
  });

  it("laisse ceux qu'on n'a jamais vus à la fin", () => {
    const out = sortPeople([who("Jamais vu"), who("Vu", { lastSeen: "2024-05-05" })], "seen");
    expect(out.map((p) => p.name)).toEqual(["Vu", "Jamais vu"]);
  });

  it("range par nom, accents compris", () => {
    const out = sortPeople([who("Étienne"), who("Alain"), who("Zoé")], "name");
    expect(out.map((p) => p.name)).toEqual(["Alain", "Étienne", "Zoé"]);
  });

  /* UN RÉPERTOIRE QUI GIGOTE N'EST PAS UN RÉPERTOIRE : à égalité, le
     départage est le même partout et il est stable. */
  it("départage toujours pareil", () => {
    const a = [who("Bernard", { rating: 4 }), who("Alain", { rating: 4 })];
    expect(sortPeople(a, "rating").map((p) => p.name)).toEqual(["Alain", "Bernard"]);
    expect(sortPeople([...a].reverse(), "rating").map((p) => p.name)).toEqual(["Alain", "Bernard"]);
  });

  it("ne touche pas au tableau qu'on lui donne", () => {
    const given = [who("B"), who("A")];
    sortPeople(given, "name");
    expect(given.map((p) => p.name)).toEqual(["B", "A"]);
  });
});
