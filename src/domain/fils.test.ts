import { describe, it, expect } from "vitest";
import { avecFilm, makeFil, membresDuFil, normalizeFils, sansFilm } from "./fils";
import { makeFilm } from "./film";

const A = makeFilm({ id: "a", title: "A", motifs: ["heros-meurt"] });
const B = makeFilm({ id: "b", title: "B", motifs: ["heros-meurt"] });
const C = makeFilm({ id: "c", title: "C" });
const films = [A, B, C];

describe("les membres d'un fil", () => {
  it("rassemble ce que le motif amène", () => {
    const fil = makeFil({ label: "Le héros meurt", motif: "heros-meurt" });
    expect(membresDuFil(fil, films).sort()).toEqual(["a", "b"]);
  });

  it("ajoute ce qu'on a posé à la main, motif ou pas", () => {
    const fil = makeFil({ motif: "heros-meurt", filmIds: ["c"], label: "x" });
    expect(membresDuFil(fil, films).sort()).toEqual(["a", "b", "c"]);
  });

  it("écarte ce qu'on a retiré, même si le motif l'amène encore", () => {
    const fil = makeFil({ motif: "heros-meurt", exclus: ["b"], label: "x" });
    expect(membresDuFil(fil, films)).toEqual(["a"]);
  });

  it("ne compte pas un film supprimé depuis", () => {
    const fil = makeFil({ filmIds: ["a", "disparu"], label: "x" });
    expect(membresDuFil(fil, films)).toEqual(["a"]);
  });
});

describe("poser et ôter", () => {
  it("retirer un film amené par le motif l'inscrit dans les exclus", () => {
    const fil = makeFil({ motif: "heros-meurt", label: "x" });
    const après = sansFilm(fil, "a", films);
    expect(après.exclus).toEqual(["a"]);
    // sans quoi il reviendrait au chargement suivant
    expect(membresDuFil(après, films)).toEqual(["b"]);
  });

  it("retirer un film posé à la main n'a rien à exclure", () => {
    const fil = makeFil({ filmIds: ["c"], label: "x" });
    const après = sansFilm(fil, "c", films);
    expect(après.exclus).toEqual([]);
    expect(membresDuFil(après, films)).toEqual([]);
  });

  it("reposer un film exclu lève l'exclusion plutôt que d'empiler", () => {
    const fil = makeFil({ motif: "heros-meurt", exclus: ["a"], label: "x" });
    const après = avecFilm(fil, "a");
    expect(après.exclus).toEqual([]);
    expect(membresDuFil(après, films).sort()).toEqual(["a", "b"]);
  });
});

describe("ce qui sort du disque", () => {
  it("survit à n'importe quelle forme", () => {
    expect(normalizeFils(null)).toEqual([]);
    expect(normalizeFils([{ label: "" }])).toEqual([]);
    const [fil] = normalizeFils([{ label: "Un fil" }]);
    expect(fil?.filmIds).toEqual([]);
    expect(fil?.id).toBeTruthy();
  });
});
