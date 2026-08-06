import { describe, it, expect } from "vitest";
import { MOTIFS, chercheMotifs, motifById, motifsDe, parFamille, suggestMotifs } from "./motifs";
import { makeFilm } from "./film";

describe("le catalogue de motifs", () => {
  it("n'a pas deux fois la même clé", () => {
    const ids = MOTIFS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("porte bien la question qui a tout déclenché", () => {
    const m = motifById("heros-meurt");
    expect(m?.label).toBe("Le héros meurt");
    // et il raconte la fin : il doit se gratter à l'affichage
    expect(m?.spoiler).toBe(true);
  });

  it("range chaque motif dans une famille affichée", () => {
    const rangés = parFamille().flatMap((f) => f.motifs);
    expect(rangés).toHaveLength(MOTIFS.length);
  });

  it("ignore un motif inconnu plutôt que de le montrer", () => {
    const film = makeFilm({ motifs: ["heros-meurt", "motif-supprimé-depuis"] });
    expect(motifsDe(film).map((m) => m.id)).toEqual(["heros-meurt"]);
  });

  it("cherche sans casse", () => {
    expect(chercheMotifs("HÉROS").map((m) => m.id)).toContain("heros-meurt");
    expect(chercheMotifs("")).toEqual([]);
  });
});

describe("ce que TMDB propose", () => {
  it("reconnaît un mot-clé du catalogue, quelle que soit la casse", () => {
    const out = suggestMotifs([{ id: 1, name: "Time Loop" }]);
    expect(out.map((m) => m.id)).toEqual(["boucle-temporelle"]);
  });

  it("accepte aussi une simple liste de mots", () => {
    expect(suggestMotifs(["road movie"]).map((m) => m.id)).toContain("road-movie");
  });

  it("ne propose rien sur des mots-clés qu'il ne connaît pas", () => {
    expect(suggestMotifs([{ name: "woman director" }])).toEqual([]);
    expect(suggestMotifs([])).toEqual([]);
  });
});
