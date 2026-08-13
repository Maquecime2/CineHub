import { describe, it, expect } from "vitest";
import { CAT_COLORS, CAT_KEYS, CAT_FAMILIES, catInk } from "./palette";

describe("the palette", () => {
  /* THE TEST THAT MATTERS. `CAT_KEYS[0]` is the colour of a brand-new
     category, and the shelf by film-maker hands out its boxes by walking
     this list in order. Widening it at the head, or merely shuffling the
     original eight, would repaint every view one rebuilt — and since we
     store the key, those already made would change tint in place. */
  it("keeps the original eight at the head, in their order and at their tint", () => {
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
    expect(CAT_COLORS.burgundy).toBe("#8C3A34");
    expect(CAT_COLORS.ochre).toBe("#B9862E");
    expect(CAT_COLORS.pine).toBe("#3E5B4B");
    expect(CAT_COLORS.slate).toBe("#5C6B78");
    expect(CAT_COLORS.cobalt).toBe("#3A5C8C");
    expect(CAT_COLORS.vermillion).toBe("#C4562E");
    expect(CAT_COLORS.moss).toBe("#6E7A3A");
    expect(CAT_COLORS.ink).toBe("#2B2620");
  });

  it("has really widened", () => {
    expect(CAT_KEYS.length).toBeGreaterThanOrEqual(24);
  });

  it("has a single list: the keys follow from the colours", () => {
    expect(CAT_KEYS).toEqual(Object.keys(CAT_COLORS));
    for (const k of CAT_KEYS) expect(catInk(k)).toBe(CAT_COLORS[k]);
  });

  it("falls back on the burgundy for an unknown key", () => {
    expect(catInk("n'existe pas")).toBe("#8C3A34");
  });

  /* The families are only a VIEW onto the palette. A key missing from
     the display would remain perfectly valid — but it would be
     unreachable, which is no way to offer a colour. */
  it("offers each tint exactly once, and nothing else", () => {
    const shown = CAT_FAMILIES.flatMap((f) => f.keys);
    expect(new Set(shown).size).toBe(shown.length);
    expect([...shown].sort()).toEqual([...CAT_KEYS].sort());
  });

  it("has nothing but well-formed hex codes", () => {
    for (const k of CAT_KEYS) expect(CAT_COLORS[k]).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
