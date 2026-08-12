import { describe, it, expect } from "vitest";
import { withFilm, makeThread, threadMembers, normalizeThreads, withoutFilm } from "./threads";
import { makeFilm } from "./film";

const A = makeFilm({ id: "a", title: "A", motifs: ["hero-dies"] });
const B = makeFilm({ id: "b", title: "B", motifs: ["hero-dies"] });
const C = makeFilm({ id: "c", title: "C" });
const films = [A, B, C];

describe("les membres d'un fil", () => {
  it("rassemble ce que le motif amène", () => {
    const fil = makeThread({ label: "Le héros meurt", motif: "hero-dies" });
    expect(threadMembers(fil, films).sort()).toEqual(["a", "b"]);
  });

  it("ajoute ce qu'on a posé à la main, motif ou pas", () => {
    const fil = makeThread({ motif: "hero-dies", filmIds: ["c"], label: "x" });
    expect(threadMembers(fil, films).sort()).toEqual(["a", "b", "c"]);
  });

  it("écarte ce qu'on a retiré, même si le motif l'amène encore", () => {
    const fil = makeThread({ motif: "hero-dies", excluded: ["b"], label: "x" });
    expect(threadMembers(fil, films)).toEqual(["a"]);
  });

  it("ne compte pas un film supprimé depuis", () => {
    const fil = makeThread({ filmIds: ["a", "disparu"], label: "x" });
    expect(threadMembers(fil, films)).toEqual(["a"]);
  });
});

describe("poser et ôter", () => {
  it("retirer un film amené par le motif l'inscrit dans les exclus", () => {
    const fil = makeThread({ motif: "hero-dies", label: "x" });
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
    const fil = makeThread({ motif: "hero-dies", excluded: ["a"], label: "x" });
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

/* ============================================================
   CE QUI A ÉTÉ ÉCRIT AVANT LA TRADUCTION

   `normalizeThreads` est la seule porte par laquelle un fil entre. Trois
   choses y ont changé de nom en passant à l'anglais — `exclus`,
   `couleur`, et l'identifiant du motif qui alimente le fil — et un
   classeur déjà tenu ne doit rien perdre des trois.
   ============================================================ */
describe("les fils d'avant la traduction", () => {
  it("relit `exclus` et `couleur`", () => {
    const [fil] = normalizeThreads([{ label: "Un fil", exclus: ["a"], couleur: "plum" }] as never);
    expect(fil?.excluded).toEqual(["a"]);
    expect(fil?.color).toBe("plum");
    // and the old keys do not go back out onto the disk
    expect(fil as unknown as Record<string, unknown>).not.toHaveProperty("exclus");
    expect(fil as unknown as Record<string, unknown>).not.toHaveProperty("couleur");
  });

  it("traduit le motif qui alimente le fil", () => {
    /* Sans cela, un fil nourri par `melancolie` cesserait d'attraper quoi
       que ce soit dès que le catalogue l'appellerait `melancholy` : le
       fil resterait là, vide, sans que rien ne dise pourquoi. */
    const [fil] = normalizeThreads([{ label: "Les tristes", motif: "melancolie" }] as never);
    expect(fil?.motif).toBe("melancholy");
  });

  it("laisse un fil à la main sans motif", () => {
    const [fil] = normalizeThreads([{ label: "À la main", motif: null }] as never);
    expect(fil?.motif).toBeNull();
  });

  it("garde intact un motif que le catalogue ne connaît pas", () => {
    const [fil] = normalizeThreads([{ label: "Le mien", motif: "il-pleut" }] as never);
    expect(fil?.motif).toBe("il-pleut");
  });

  it("n'abîme pas un fil déjà écrit en anglais", () => {
    const [fil] = normalizeThreads([
      { label: "Un fil", excluded: ["b"], color: "pine", motif: "hero-dies" },
    ] as never);
    expect(fil?.excluded).toEqual(["b"]);
    expect(fil?.color).toBe("pine");
    expect(fil?.motif).toBe("hero-dies");
  });
});
