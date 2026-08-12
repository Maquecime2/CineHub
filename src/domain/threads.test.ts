import { describe, it, expect } from "vitest";
import { withFilm, makeThread, threadMembers, normalizeThreads, withoutFilm } from "./threads";
import { makeFilm } from "./film";

const A = makeFilm({ id: "a", title: "A", motifs: ["heros-meurt"] });
const B = makeFilm({ id: "b", title: "B", motifs: ["heros-meurt"] });
const C = makeFilm({ id: "c", title: "C" });
const films = [A, B, C];

describe("les membres d'un fil", () => {
  it("rassemble ce que le motif amène", () => {
    const fil = makeThread({ label: "Le héros meurt", motif: "heros-meurt" });
    expect(threadMembers(fil, films).sort()).toEqual(["a", "b"]);
  });

  it("ajoute ce qu'on a posé à la main, motif ou pas", () => {
    const fil = makeThread({ motif: "heros-meurt", filmIds: ["c"], label: "x" });
    expect(threadMembers(fil, films).sort()).toEqual(["a", "b", "c"]);
  });

  it("écarte ce qu'on a retiré, même si le motif l'amène encore", () => {
    const fil = makeThread({ motif: "heros-meurt", excluded: ["b"], label: "x" });
    expect(threadMembers(fil, films)).toEqual(["a"]);
  });

  it("ne compte pas un film supprimé depuis", () => {
    const fil = makeThread({ filmIds: ["a", "disparu"], label: "x" });
    expect(threadMembers(fil, films)).toEqual(["a"]);
  });
});

describe("poser et ôter", () => {
  it("retirer un film amené par le motif l'inscrit dans les exclus", () => {
    const fil = makeThread({ motif: "heros-meurt", label: "x" });
    const après = withoutFilm(fil, "a", films);
    expect(après.excluded).toEqual(["a"]);
    // sans quoi il reviendrait au chargement suivant
    expect(threadMembers(après, films)).toEqual(["b"]);
  });

  it("retirer un film posé à la main n'a rien à exclure", () => {
    const fil = makeThread({ filmIds: ["c"], label: "x" });
    const après = withoutFilm(fil, "c", films);
    expect(après.excluded).toEqual([]);
    expect(threadMembers(après, films)).toEqual([]);
  });

  it("reposer un film exclu lève l'exclusion plutôt que d'empiler", () => {
    const fil = makeThread({ motif: "heros-meurt", excluded: ["a"], label: "x" });
    const après = withFilm(fil, "a");
    expect(après.excluded).toEqual([]);
    expect(threadMembers(après, films).sort()).toEqual(["a", "b"]);
  });
});

describe("ce qui sort du disque", () => {
  it("survit à n'importe quelle forme", () => {
    expect(normalizeThreads(null)).toEqual([]);
    expect(normalizeThreads([{ label: "" }])).toEqual([]);
    const [fil] = normalizeThreads([{ label: "Un fil" }]);
    expect(fil?.filmIds).toEqual([]);
    expect(fil?.id).toBeTruthy();
  });
});
