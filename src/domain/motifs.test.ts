import { describe, it, expect, afterEach } from "vitest";
import {
  MOTIFS,
  searchMotifs,
  isHidden,
  isCustom,
  idFromLabel,
  makeCustomMotif,
  motifById,
  motifsOf,
  byFamily,
  setVocabulary,
  suggestMotifs,
  allMotifs,
} from "./motifs";
import { makeFilm } from "./film";

describe("the motif catalogue", () => {
  it("has no key twice", () => {
    const ids = MOTIFS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does carry the question that started it all", () => {
    const m = motifById("hero-dies");
    expect(m?.label).toBe("Le héros meurt");
    // and it gives the ending away: it must be scratched out on display
    expect(m?.spoiler).toBe(true);
  });

  it("files every motif under a displayed family", () => {
    const filed = byFamily().flatMap((f) => f.motifs);
    expect(filed).toHaveLength(MOTIFS.length);
  });

  it("ignores an unknown motif rather than showing it", () => {
    const film = makeFilm({ motifs: ["hero-dies", "motif-supprimé-depuis"] });
    expect(motifsOf(film).map((m) => m.id)).toEqual(["hero-dies"]);
  });

  it("searches case-insensitively", () => {
    expect(searchMotifs("HÉROS").map((m) => m.id)).toContain("hero-dies");
    expect(searchMotifs("")).toEqual([]);
  });
});

describe("what TMDB suggests", () => {
  it("recognises a catalogue keyword, whatever the case", () => {
    const out = suggestMotifs([{ id: 1, name: "Time Loop" }]);
    expect(out.map((m) => m.id)).toEqual(["time-loop"]);
  });

  it("accepte aussi une simple liste de mots", () => {
    expect(suggestMotifs(["road movie"]).map((m) => m.id)).toContain("road-movie");
  });

  it("suggests nothing on keywords it does not know", () => {
    expect(suggestMotifs([{ name: "woman director" }])).toEqual([]);
    expect(suggestMotifs([])).toEqual([]);
  });
});

describe("your own motifs", () => {
  afterEach(() => setVocabulary({ custom: [], hidden: [] }));

  it("are added to the catalogue without replacing it", () => {
    const mine = makeCustomMotif("Il pleut sans arrêt", "world");
    setVocabulary({ custom: [mine], hidden: [] });
    expect(motifById(mine.id)?.label).toBe("Il pleut sans arrêt");
    expect(motifById("hero-dies")).toBeTruthy();
    expect(allMotifs()).toHaveLength(MOTIFS.length + 1);
    expect(isCustom(mine.id)).toBe(true);
    expect(isCustom("hero-dies")).toBe(false);
  });

  it("take their identifier from the label, once and for all", () => {
    expect(idFromLabel("Il pleut, sans arrêt !")).toBe("il-pleut-sans-arret");
    // and never overwrite an identifier already taken
    expect(idFromLabel("Le héros meurt", ["le-heros-meurt"])).toBe("le-heros-meurt-2");
  });

  it("are searched like the others", () => {
    const mine = makeCustomMotif("Il pleut sans arrêt", "world");
    setVocabulary({ custom: [mine], hidden: [] });
    expect(searchMotifs("pleut").map((m) => m.id)).toContain(mine.id);
  });
});

describe("the motifs set aside", () => {
  afterEach(() => setVocabulary({ custom: [], hidden: [] }));

  it("leave the list you choose from", () => {
    setVocabulary({ custom: [], hidden: ["hero-dies"] });
    expect(allMotifs().some((m) => m.id === "hero-dies")).toBe(false);
    expect(searchMotifs("héros").some((m) => m.id === "hero-dies")).toBe(false);
  });

  /* Hiding is not erasing: a card that carries it must go on showing
     it, otherwise setting aside would quietly rewrite data. */
  it("restent lisibles sur les fiches qui les portent", () => {
    setVocabulary({ custom: [], hidden: ["hero-dies"] });
    expect(motifById("hero-dies")?.label).toBe("Le héros meurt");
    expect(motifsOf(makeFilm({ motifs: ["hero-dies"] }))).toHaveLength(1);
    expect(isHidden("hero-dies")).toBe(true);
  });
});
