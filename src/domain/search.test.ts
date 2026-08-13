import { describe, it, expect } from "vitest";
import i18n from "../i18n";
import { matchFilm as match, searchFilms as sweep } from "./search";
import { makeFilm } from "./film";

const solaris = makeFilm({ id: "1", title: "Solaris", director: "Tarkovski", year: 1972 });
const other = makeFilm({ id: "2", title: "Le Solaris de minuit", director: "X", year: 1990 });
const amelie = makeFilm({
  id: "3",
  title: "Le Fabuleux Destin d'Amélie Poulain",
  cast: ["Audrey Tautou"],
  themes: ["Paris"],
  motifs: ["hero-dies"],
});
const films = [other, solaris, amelie];

/* The motif names come from the caller now — a film is findable by
   "le héros meurt" only if somebody says what that motif is called.
   `setupTests` pins the suite to French. */
const name = i18n.t.bind(i18n);
const matchFilm = (f: Parameters<typeof match>[0], q: string) => match(f, q, name);
const searchFilms = (fs: Parameters<typeof sweep>[0], q: string, limit?: number) =>
  sweep(fs, q, name, limit);

describe("searching for a film", () => {
  it("finds on the title and on the director", () => {
    expect(matchFilm(solaris, "tarkov")).toBe(true);
    expect(matchFilm(solaris, "solar")).toBe(true);
    expect(matchFilm(solaris, "kubrick")).toBe(false);
  });

  it("ignores accents in both directions", () => {
    expect(matchFilm(amelie, "amelie")).toBe(true);
    expect(matchFilm(amelie, "AMÉLIE")).toBe(true);
  });

  it("also finds by the year, the cast, a keyword or a motif", () => {
    expect(matchFilm(solaris, "1972")).toBe(true);
    expect(matchFilm(amelie, "tautou")).toBe(true);
    expect(matchFilm(amelie, "paris")).toBe(true);
    expect(matchFilm(amelie, "le héros meurt")).toBe(true);
  });

  it("puts the title before the rest, and the title's start before its middle", () => {
    expect(searchFilms(films, "solaris").map((f) => f.id)).toEqual(["1", "2"]);
  });

  it("returns everything, in order, when nothing is searched for", () => {
    expect(searchFilms(films, "  ", 0)).toEqual(films);
    expect(searchFilms(films, "", 2)).toHaveLength(2);
  });

  it("stops at the limit asked for", () => {
    expect(searchFilms(films, "solaris", 1).map((f) => f.id)).toEqual(["1"]);
  });
});
