import { describe, it, expect } from "vitest";
import { matchFilm, searchFilms } from "./search";
import { makeFilm } from "./film";

const solaris = makeFilm({ id: "1", title: "Solaris", director: "Tarkovski", year: 1972 });
const autre = makeFilm({ id: "2", title: "Le Solaris de minuit", director: "X", year: 1990 });
const amelie = makeFilm({
  id: "3",
  title: "Le Fabuleux Destin d'Amélie Poulain",
  cast: ["Audrey Tautou"],
  themes: ["Paris"],
  motifs: ["hero-dies"],
});
const films = [autre, solaris, amelie];

describe("chercher un film", () => {
  it("trouve sur le titre et sur le réalisateur", () => {
    expect(matchFilm(solaris, "tarkov")).toBe(true);
    expect(matchFilm(solaris, "solar")).toBe(true);
    expect(matchFilm(solaris, "kubrick")).toBe(false);
  });

  it("ignore les accents dans les deux sens", () => {
    expect(matchFilm(amelie, "amelie")).toBe(true);
    expect(matchFilm(amelie, "AMÉLIE")).toBe(true);
  });

  it("trouve aussi par l'année, le casting, un mot-clé ou un motif", () => {
    expect(matchFilm(solaris, "1972")).toBe(true);
    expect(matchFilm(amelie, "tautou")).toBe(true);
    expect(matchFilm(amelie, "paris")).toBe(true);
    expect(matchFilm(amelie, "le héros meurt")).toBe(true);
  });

  it("fait passer le titre avant le reste, et le début du titre avant le milieu", () => {
    expect(searchFilms(films, "solaris").map((f) => f.id)).toEqual(["1", "2"]);
  });

  it("rend tout, dans l'ordre, quand on ne cherche rien", () => {
    expect(searchFilms(films, "  ", 0)).toEqual(films);
    expect(searchFilms(films, "", 2)).toHaveLength(2);
  });

  it("s'arrête à la limite demandée", () => {
    expect(searchFilms(films, "solaris", 1).map((f) => f.id)).toEqual(["1"]);
  });
});
