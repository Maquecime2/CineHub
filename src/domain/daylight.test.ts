import { describe, it, expect } from "vitest";
import { lightOf } from "./daylight";

/* L'heure LOCALE, comme la lit `lightOf` : construire la date par ses
   composantes evite qu'un fuseau d'integration ne decale le test. */
const at = (hour: number) => new Date(2026, 0, 15, hour, 30).getTime();

describe("lightOf", () => {
  it("nomme les quatre moments", () => {
    expect(lightOf(at(3)).key).toBe("night");
    expect(lightOf(at(7)).key).toBe("dawn");
    expect(lightOf(at(14)).key).toBe("day");
    expect(lightOf(at(18)).key).toBe("dusk");
    expect(lightOf(at(23)).key).toBe("night");
  });

  /* LE PLEIN JOUR NE DESSINE RIEN, et c'est la regle qui fait tenir tout
     le reste : sans un moment plat, les trois autres ne sont plus des
     exceptions. */
  it("le plein jour est plat", () => {
    expect(lightOf(at(14)).warmth).toBe(0);
  });

  it("le matin est froid, le couchant est chaud", () => {
    expect(lightOf(at(7)).warmth).toBeLessThan(0);
    expect(lightOf(at(18)).warmth).toBeGreaterThan(0);
  });

  it("la lampe de la nuit est chaude aux deux bouts du cadran", () => {
    expect(lightOf(at(2)).warmth).toBeGreaterThan(0);
    expect(lightOf(at(23)).warmth).toBeGreaterThan(0);
    expect(lightOf(at(2))).toEqual(lightOf(at(23)));
  });

  /* La chaleur ne sort jamais de sa plage : le dessin s'en sert comme
     d'une opacite, et un nombre hors bornes y passerait sans se plaindre. */
  it("reste entre -1 et 1 a toute heure", () => {
    for (let h = 0; h < 24; h++) {
      const { warmth } = lightOf(at(h));
      expect(warmth).toBeGreaterThanOrEqual(-1);
      expect(warmth).toBeLessThanOrEqual(1);
    }
  });

  it("chaque heure a un moment", () => {
    for (let h = 0; h < 24; h++) {
      expect(lightOf(at(h)).key).toBeTruthy();
    }
  });

  /* PUR ET DETERMINISTE : appele au rendu, il ne doit pas bouger entre
     deux lectures du meme instant. */
  it("rend deux fois la meme chose", () => {
    expect(lightOf(at(18))).toEqual(lightOf(at(18)));
  });
});
