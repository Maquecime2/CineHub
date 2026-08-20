import { describe, it, expect } from "vitest";
import { readRow, filmsInRow, EMPTY_READING } from "./shelfReading";
import type { ReadableItem } from "./shelfReading";
import { makeFilm } from "./film";
import type { Film } from "../types";

const film = (id: string, extra: Partial<Film> = {}): Film =>
  makeFilm({ title: id, ...extra, id } as Partial<Film>);

const index = (films: Film[]) => new Map(films.map((f) => [f.id, f]));

const f = (id: string): ReadableItem => ({ t: "f", id });
const d = (id: string): ReadableItem => ({ t: "d", id });
const box = (id: string, items: ReadableItem[]): ReadableItem => ({ t: "c", id, items });

describe("ce qui compte pour un boîtier", () => {
  it("une ligne vide ne dit rien", () => {
    expect(readRow([], new Map())).toEqual(EMPTY_READING);
  });

  it("les objets posés ne sont pas des boîtiers", () => {
    const films = [film("a"), film("b")];
    expect(readRow([f("a"), d("plante"), f("b")], index(films)).cases).toBe(2);
  });

  it("une boîte se traverse et ses films comptent", () => {
    const films = [film("a"), film("b"), film("c")];
    expect(readRow([f("a"), box("c_1", [f("b"), f("c")])], index(films)).cases).toBe(3);
  });

  it("un objet posé DANS une boîte ne compte pas davantage", () => {
    const films = [film("a")];
    expect(readRow([box("c_1", [f("a"), d("chat")])], index(films)).cases).toBe(1);
  });

  it("l'ordre du tableau est l'ordre rendu", () => {
    expect(filmsInRow([f("a"), box("c_1", [f("b")]), f("c")])).toEqual(["a", "b", "c"]);
  });
});

/* LIRE N'ÉCRIT PAS. Une fiche partie du classeur se saute à l'affichage
   et le rangement reste tranquille — la copie de `threadMembers`. */
describe("une fiche disparue", () => {
  it("ne compte dans aucune moyenne mais reste un emplacement", () => {
    const films = [film("a", { rating: 4, year: 1970 })];
    const r = readRow([f("a"), f("parti")], index(films));
    expect(r.cases).toBe(2);
    expect(r.rating).toBe(4);
    expect(r.years).toEqual([1970, 1970]);
  });
});

describe("les années", () => {
  it("rendent la fourchette réelle", () => {
    const films = [film("a", { year: 1989 }), film("b", { year: 1954 }), film("c", { year: 1971 })];
    expect(readRow([f("a"), f("b"), f("c")], index(films)).years).toEqual([1954, 1989]);
  });

  it("sont nulles quand aucune fiche n'en porte", () => {
    const films = [film("a", { year: "" })];
    expect(readRow([f("a")], index(films)).years).toBeNull();
  });

  it("ignorent une année vide au milieu", () => {
    const films = [film("a", { year: 1960 }), film("b", { year: "" })];
    expect(readRow([f("a"), f("b")], index(films)).years).toEqual([1960, 1960]);
  });
});

describe("le genre dominant", () => {
  /* Sans forme canonique, « Science Fiction » et « Science-Fiction »
     comptent pour deux et aucun des deux ne domine. */
  it("réunit deux graphies du même genre", () => {
    const films = [
      film("a", { genres: ["Science Fiction"] }),
      film("b", { genres: ["Science-Fiction"] }),
      film("c", { genres: ["Drame"] }),
    ];
    expect(readRow([f("a"), f("b"), f("c")], index(films)).genre).toBe("Science-Fiction");
  });

  /* Un genre porté par une seule fiche est un accident, pas une veine. */
  it("ne nomme rien quand douze films portent douze genres", () => {
    const films = [
      film("a", { genres: ["Drame"] }),
      film("b", { genres: ["Polar"] }),
      film("c", { genres: ["Western"] }),
    ];
    expect(readRow([f("a"), f("b"), f("c")], index(films)).genre).toBeNull();
  });

  it("ne nomme rien pour un seul film", () => {
    const films = [film("a", { genres: ["Drame"] })];
    expect(readRow([f("a")], index(films)).genre).toBeNull();
  });

  it("tranche une égalité sur l'alphabet, donc toujours pareil", () => {
    const films = [
      film("a", { genres: ["Western"] }),
      film("b", { genres: ["Western"] }),
      film("c", { genres: ["Drame"] }),
      film("e", { genres: ["Drame"] }),
    ];
    const items = [f("a"), f("b"), f("c"), f("e")];
    const once = readRow(items, index(films)).genre;
    expect(once).toBe("Drame");
    expect(readRow([...items].reverse(), index(films)).genre).toBe(once);
  });
});

describe("la note moyenne", () => {
  /* Compter un zéro pour « pas encore noté » ferait descendre le rayon à
     mesure qu'on y range. */
  it("ne porte que sur les fiches notées", () => {
    const films = [film("a", { rating: 5 }), film("b", { rating: 4 }), film("c", { rating: 0 })];
    expect(readRow([f("a"), f("b"), f("c")], index(films)).rating).toBe(4.5);
  });

  it("est nulle quand rien n'est noté", () => {
    const films = [film("a", { rating: 0 })];
    expect(readRow([f("a")], index(films)).rating).toBeNull();
  });

  it("s'arrondit au dixième", () => {
    const films = [film("a", { rating: 4 }), film("b", { rating: 3 }), film("c", { rating: 3 })];
    expect(readRow([f("a"), f("b"), f("c")], index(films)).rating).toBe(3.3);
  });
});

describe("ce que la recherche trouve", () => {
  it("est nul quand on ne cherche rien", () => {
    const films = [film("a"), film("b")];
    expect(readRow([f("a"), f("b")], index(films), null).found).toBe(0);
  });

  it("compte les fiches qui répondent, boîtes comprises", () => {
    const films = [film("a"), film("b"), film("c")];
    const found = new Set(["a", "c"]);
    expect(readRow([f("a"), box("c_1", [f("b"), f("c")])], index(films), found).found).toBe(2);
  });

  it("compte une fiche disparue qui répond encore, comme un emplacement", () => {
    expect(readRow([f("parti")], new Map(), new Set(["parti"])).found).toBe(1);
  });
});
