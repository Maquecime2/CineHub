import { describe, it, expect } from "vitest";
import { CAT_COLORS, CAT_KEYS, CAT_FAMILIES, catInk } from "./palette";
import { C } from "./tokens";

describe("la palette", () => {
  /* LE TEST QUI COMPTE. `CAT_KEYS[0]` est la couleur d'une catégorie
     neuve, et l'étagère par cinéaste distribue ses cartons en parcourant
     cette liste dans l'ordre. L'élargir en tête, ou seulement bousculer
     les huit d'origine, repeindrait toutes les vues qu'on referait — et
     comme on stocke la clé, celles déjà faites changeraient de teinte
     sur place. */
  it("garde les huit d'origine en tête, dans leur ordre et à leur teinte", () => {
    expect(CAT_KEYS.slice(0, 8)).toEqual([
      "burgundy",
      "ochre",
      "pine",
      "slate",
      "cobalt",
      "vermillion",
      "moss",
      "ink",
    ]);
    expect(CAT_COLORS.burgundy).toBe(C.burgundy);
    expect(CAT_COLORS.ochre).toBe(C.ochre);
    expect(CAT_COLORS.pine).toBe(C.pine);
    expect(CAT_COLORS.slate).toBe(C.slate);
    expect(CAT_COLORS.cobalt).toBe(C.cobalt);
    expect(CAT_COLORS.vermillion).toBe(C.vermillion);
    expect(CAT_COLORS.moss).toBe(C.moss);
    expect(CAT_COLORS.ink).toBe(C.ink);
  });

  it("s'est vraiment élargie", () => {
    expect(CAT_KEYS.length).toBeGreaterThanOrEqual(24);
  });

  it("n'a qu'une seule liste : les clés se déduisent des couleurs", () => {
    expect(CAT_KEYS).toEqual(Object.keys(CAT_COLORS));
    for (const k of CAT_KEYS) expect(catInk(k)).toBe(CAT_COLORS[k]);
  });

  it("retombe sur le bordeaux pour une clé inconnue", () => {
    expect(catInk("n'existe pas")).toBe(C.burgundy);
  });

  /* Les familles ne sont qu'une VUE sur le nuancier. Une clé absente de
     l'affichage resterait parfaitement valide — mais elle serait
     inatteignable, ce qui n'est pas une façon d'offrir une couleur. */
  it("offre chaque teinte exactement une fois, et rien d'autre", () => {
    const shown = CAT_FAMILIES.flatMap((f) => f.keys);
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual([...CAT_KEYS].sort());
  });

  it("n'a que des hexadécimaux bien formés", () => {
    for (const k of CAT_KEYS) expect(CAT_COLORS[k]).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
