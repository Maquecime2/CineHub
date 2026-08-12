import { describe, it, expect } from "vitest";
import { census, dossierOf, rolesOnFilm, searchPeople } from "./people";
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

describe("dossierOf", () => {
  it("returns null for a stranger", () => {
    expect(dossierOf([film("A", { director: "Ozu" })], "kurosawa")).toBeNull();
  });

  it("finds somebody by their normalized key", () => {
    expect(dossierOf([film("A", { director: "Agnès Varda" })], "agnes varda")?.name).toBe(
      "Agnès Varda"
    );
  });
});
