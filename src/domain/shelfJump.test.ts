import { describe, it, expect } from "vitest";
import { nextMatch, sameSearch } from "./shelfJump";

const ids = ["a", "b", "c", "d", "e"];
const set = (...k: string[]) => new Set(k);

describe("nextMatch", () => {
  it("rend null quand on ne cherche rien", () => {
    expect(nextMatch(ids, null, -1, 1)).toBeNull();
  });

  it("rend null quand rien ne repond", () => {
    expect(nextMatch(ids, set("zz"), -1, 1)).toBeNull();
  });

  it("entre par le PREMIER en avancant depuis nulle part", () => {
    expect(nextMatch(ids, set("b", "d"), -1, 1)).toEqual({ index: 0, id: "b" });
  });

  it("entre par le DERNIER en reculant depuis nulle part", () => {
    expect(nextMatch(ids, set("b", "d"), -1, -1)).toEqual({ index: 1, id: "d" });
  });

  /* L'ORDRE EST CELUI DE `ids`, jamais celui de l'ensemble : un `Set` ne
     promet rien, et le tour se ferait dans un ordre que l'ecran ne montre
     pas. */
  it("suit l'ordre a l'ecran et non celui de l'ensemble", () => {
    expect(nextMatch(ids, set("e", "a"), -1, 1)).toEqual({ index: 0, id: "a" });
  });

  it("avance d'un cran", () => {
    expect(nextMatch(ids, set("a", "c", "e"), 0, 1)).toEqual({ index: 1, id: "c" });
  });

  it("boucle en avancant depuis le dernier", () => {
    expect(nextMatch(ids, set("a", "c", "e"), 2, 1)).toEqual({ index: 0, id: "a" });
  });

  it("boucle en reculant depuis le premier", () => {
    expect(nextMatch(ids, set("a", "c", "e"), 0, -1)).toEqual({ index: 2, id: "e" });
  });

  /* AVANCER PUIS RECULER RAMENE OU L'ON ETAIT. C'est tout ce que le
     bouton « precedent » promet, et c'est le seul invariant qui compte. */
  it("avancer puis reculer revient au meme boitier", () => {
    const one = nextMatch(ids, set("a", "b", "c"), 0, 1);
    const back = nextMatch(ids, set("a", "b", "c"), one!.index, -1);
    expect(back).toEqual({ index: 0, id: "a" });
  });

  it("ramene un rang hors bornes dans l'anneau", () => {
    expect(nextMatch(ids, set("a", "b"), 99, 1)).toEqual({ index: 0, id: "a" });
  });

  /* Un seul trouve : les deux sens rendent le meme, sans division par
     zero ni rang negatif. */
  it("tient sur un seul trouve", () => {
    expect(nextMatch(ids, set("c"), 0, 1)).toEqual({ index: 0, id: "c" });
    expect(nextMatch(ids, set("c"), 0, -1)).toEqual({ index: 0, id: "c" });
  });
});

describe("sameSearch", () => {
  it("compare le CONTENU et non l'objet", () => {
    expect(sameSearch(set("a", "b"), set("b", "a"))).toBe(true);
  });

  it("voit une recherche qui change", () => {
    expect(sameSearch(set("a", "b"), set("a", "c"))).toBe(false);
    expect(sameSearch(set("a"), set("a", "b"))).toBe(false);
  });

  it("deux fois rien est la meme chose", () => {
    expect(sameSearch(null, null)).toBe(true);
  });

  it("rien et quelque chose ne sont pas la meme chose", () => {
    expect(sameSearch(null, set("a"))).toBe(false);
  });
});
