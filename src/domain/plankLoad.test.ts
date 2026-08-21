import { describe, it, expect } from "vitest";
import { sagOf, SAG_FROM } from "./plankLoad";

describe("sagOf", () => {
  /* L'EXCEPTION SEULE SE DESSINE. Un rayon vide, a moitie plein ou aux
     deux tiers est le cas ordinaire d'un classeur qu'on remplit. */
  it("ne ploie pas sous le seuil", () => {
    expect(sagOf(0, 10)).toBe(0);
    expect(sagOf(3, 10)).toBe(0);
    expect(sagOf(6, 10)).toBe(0);
  });

  it("ne ploie pas AU seuil exactement", () => {
    expect(sagOf(SAG_FROM * 10, 10)).toBe(0);
  });

  it("ploie tout a fait quand le rayon est plein", () => {
    expect(sagOf(10, 10)).toBe(1);
  });

  it("croit entre le seuil et le plein", () => {
    const a = sagOf(8, 10);
    const b = sagOf(9, 10);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
  });

  /* UN RAYON NE PLOIE PAS PLUS QUE PLEIN. `splitRow` peut laisser une
     ligne deborder le temps d'un rendu ; la planche ne doit pas s'en
     apercevoir. */
  it("plafonne au-dela du plein", () => {
    expect(sagOf(30, 10)).toBe(1);
  });

  /* UNE CAPACITE INCONNUE NE FAIT PAS PLOYER A L'INFINI. */
  it("rend zero sans capacite", () => {
    expect(sagOf(5, 0)).toBe(0);
    expect(sagOf(5, -1)).toBe(0);
    expect(sagOf(5, NaN)).toBe(0);
  });

  /* C'EST LE RAPPORT QUI COMPTE, PAS LE COMPTE. Deux rayons egalement
     charges ploient pareil, quelle que soit leur largeur. */
  it("ne lit qu'un rapport", () => {
    expect(sagOf(9, 10)).toBeCloseTo(sagOf(18, 20), 10);
  });
});
