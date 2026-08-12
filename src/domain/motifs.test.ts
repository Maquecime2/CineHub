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

describe("le catalogue de motifs", () => {
  it("n'a pas deux fois la même clé", () => {
    const ids = MOTIFS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("porte bien la question qui a tout déclenché", () => {
    const m = motifById("hero-dies");
    expect(m?.label).toBe("Le héros meurt");
    // et il raconte la fin : il doit se gratter à l'affichage
    expect(m?.spoiler).toBe(true);
  });

  it("range chaque motif dans une famille affichée", () => {
    const rangés = byFamily().flatMap((f) => f.motifs);
    expect(rangés).toHaveLength(MOTIFS.length);
  });

  it("ignore un motif inconnu plutôt que de le montrer", () => {
    const film = makeFilm({ motifs: ["hero-dies", "motif-supprimé-depuis"] });
    expect(motifsOf(film).map((m) => m.id)).toEqual(["hero-dies"]);
  });

  it("cherche sans casse", () => {
    expect(searchMotifs("HÉROS").map((m) => m.id)).toContain("hero-dies");
    expect(searchMotifs("")).toEqual([]);
  });
});

describe("ce que TMDB propose", () => {
  it("reconnaît un mot-clé du catalogue, quelle que soit la casse", () => {
    const out = suggestMotifs([{ id: 1, name: "Time Loop" }]);
    expect(out.map((m) => m.id)).toEqual(["time-loop"]);
  });

  it("accepte aussi une simple liste de mots", () => {
    expect(suggestMotifs(["road movie"]).map((m) => m.id)).toContain("road-movie");
  });

  it("ne propose rien sur des mots-clés qu'il ne connaît pas", () => {
    expect(suggestMotifs([{ name: "woman director" }])).toEqual([]);
    expect(suggestMotifs([])).toEqual([]);
  });
});

describe("vos motifs à vous", () => {
  afterEach(() => setVocabulary({ custom: [], hidden: [] }));

  it("s'ajoutent au catalogue sans le remplacer", () => {
    const mien = makeCustomMotif("Il pleut sans arrêt", "world");
    setVocabulary({ custom: [mien], hidden: [] });
    expect(motifById(mien.id)?.label).toBe("Il pleut sans arrêt");
    expect(motifById("hero-dies")).toBeTruthy();
    expect(allMotifs()).toHaveLength(MOTIFS.length + 1);
    expect(isCustom(mien.id)).toBe(true);
    expect(isCustom("hero-dies")).toBe(false);
  });

  it("tirent leur identifiant du libellé, une fois pour toutes", () => {
    expect(idFromLabel("Il pleut, sans arrêt !")).toBe("il-pleut-sans-arret");
    // et n'écrasent jamais un identifiant déjà pris
    expect(idFromLabel("Le héros meurt", ["le-heros-meurt"])).toBe("le-heros-meurt-2");
  });

  it("se cherchent comme les autres", () => {
    const mien = makeCustomMotif("Il pleut sans arrêt", "world");
    setVocabulary({ custom: [mien], hidden: [] });
    expect(searchMotifs("pleut").map((m) => m.id)).toContain(mien.id);
  });
});

describe("les motifs écartés", () => {
  afterEach(() => setVocabulary({ custom: [], hidden: [] }));

  it("quittent la liste où l'on choisit", () => {
    setVocabulary({ custom: [], hidden: ["hero-dies"] });
    expect(allMotifs().some((m) => m.id === "hero-dies")).toBe(false);
    expect(searchMotifs("héros").some((m) => m.id === "hero-dies")).toBe(false);
  });

  /* Masquer n'est pas effacer : une fiche qui le porte doit continuer de
     l'afficher, sans quoi écarter réécrirait les données en douce. */
  it("restent lisibles sur les fiches qui les portent", () => {
    setVocabulary({ custom: [], hidden: ["hero-dies"] });
    expect(motifById("hero-dies")?.label).toBe("Le héros meurt");
    expect(motifsOf(makeFilm({ motifs: ["hero-dies"] }))).toHaveLength(1);
    expect(isHidden("hero-dies")).toBe(true);
  });
});
