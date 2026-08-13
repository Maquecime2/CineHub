import { describe, it, expect, afterEach } from "vitest";
import {
  MOTIFS,
  searchMotifs,
  isHidden,
  isCustom,
  idFromLabel,
  makeCustomMotif,
  motifById,
  motifLabel,
  motifsOf,
  byFamily,
  setVocabulary,
  suggestMotifs,
  allMotifs,
} from "./motifs";
import fr from "../i18n/fr";
import { makeFilm } from "./film";

/* The catalogue's own names, read the way the screen reads them: a
   search must find what is on the page, not an identifier. */
const name = (key: string): string =>
  key.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown>)?.[k], fr) as string;

describe("the motif catalogue", () => {
  it("has no key twice", () => {
    const ids = MOTIFS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does carry the question that started it all", () => {
    const m = motifById("hero-dies");
    expect(m).toBeTruthy();
    /* The words live in the catalogue now; the motif keeps the id, which
       is the thing a card actually carries. */
    expect(motifLabel(m!, name)).toBe("Le héros meurt");
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
    expect(searchMotifs("HÉROS", name).map((m) => m.id)).toContain("hero-dies");
    expect(searchMotifs("", name)).toEqual([]);
  });
});

describe("what TMDB suggests", () => {
  it("recognises a catalogue keyword, whatever the case", () => {
    const out = suggestMotifs([{ id: 1, name: "Time Loop" }]);
    expect(out.map((m) => m.id)).toEqual(["time-loop"]);
  });

  it("accepts a plain list of words too", () => {
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
    expect(searchMotifs("pleut", name).map((m) => m.id)).toContain(mine.id);
  });
});

describe("the motifs set aside", () => {
  afterEach(() => setVocabulary({ custom: [], hidden: [] }));

  it("leave the list you choose from", () => {
    setVocabulary({ custom: [], hidden: ["hero-dies"] });
    expect(allMotifs().some((m) => m.id === "hero-dies")).toBe(false);
    expect(searchMotifs("héros", name).some((m) => m.id === "hero-dies")).toBe(false);
  });

  /* Hiding is not erasing: a card that carries it must go on showing
     it, otherwise setting aside would quietly rewrite data. */
  it("stay readable on the cards that carry them", () => {
    setVocabulary({ custom: [], hidden: ["hero-dies"] });
    expect(motifLabel(motifById("hero-dies")!, name)).toBe("Le héros meurt");
    expect(motifsOf(makeFilm({ motifs: ["hero-dies"] }))).toHaveLength(1);
    expect(isHidden("hero-dies")).toBe(true);
  });
});
