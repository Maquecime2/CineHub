import { describe, it, expect } from "vitest";
import { normalizeVocabulaire } from "./motifs";

/* ============================================================
   THE VOCABULARY WRITTEN BEFORE THE TRANSLATION

   The motifs YOU created are written into `localStorage`, and three of
   the fields around them changed name when the code moved to English:
   `perso` became `custom`, `masqués` became `hidden`, and each motif's
   `famille` became `family`. `normalizeVocabulaire` is the only door they
   come in through.

   With no migration they would not vanish — which is worse. Your motifs
   would land in an empty list, and the ones that survived would all be
   filed under "the way of telling", that is to say in the wrong place and
   with nothing to say so. Exactly the kind of damage you only notice on
   reopening the drawer six months later.
   ============================================================ */
describe("a vocabulary written before the switch", () => {
  const oldShape = (family: unknown) => ({
    perso: [{ id: "il-pleut", label: "Il pleut", famille: family }],
    masqués: ["hero-dies"],
  });

  it("reads the old `perso` and `masqués` keys", () => {
    const v = normalizeVocabulaire(oldShape("monde"));
    expect(v.custom.map((m) => m.id)).toEqual(["il-pleut"]);
    expect(v.hidden).toEqual(["hero-dies"]);
  });

  it.each([
    ["destin", "fate"],
    ["fin", "ending"],
    ["récit", "narrative"],
    ["figure", "figures"],
    ["ton", "tone"],
    ["monde", "world"],
  ])("reads the old family « %s »", (old, expected) => {
    expect(normalizeVocabulaire(oldShape(old)).custom[0]!.family).toBe(expected);
  });

  it("keeps a custom motif's id, which is not the catalogue's", () => {
    /* Its id is taken from its label and was never translated: migrating
       it would orphan it from the cards that carry it. */
    expect(normalizeVocabulaire(oldShape("monde")).custom[0]!.id).toBe("il-pleut");
  });

  it("does not let the old keys back out onto the disk", () => {
    const v = normalizeVocabulaire(oldShape("monde"));
    expect(v as unknown as Record<string, unknown>).not.toHaveProperty("perso");
    expect(v as unknown as Record<string, unknown>).not.toHaveProperty("masqués");
    expect(v.custom[0] as unknown as Record<string, unknown>).not.toHaveProperty("famille");
  });
});

describe("a vocabulary already written in English", () => {
  const current = {
    custom: [{ id: "il-pleut", label: "Il pleut", family: "world" }],
    hidden: ["hero-dies"],
  };

  it("comes through untouched", () => {
    const v = normalizeVocabulaire(current);
    expect(v.custom[0]!.family).toBe("world");
    expect(v.hidden).toEqual(["hero-dies"]);
  });

  it("falls back on the narrative for a family it cannot read", () => {
    /* An unknown family must not make the motif invisible: better to file
       it somewhere than to lose it. */
    const v = normalizeVocabulaire({
      custom: [{ id: "x", label: "Un motif", family: "famille-inventée" }],
    });
    expect(v.custom[0]!.family).toBe("narrative");
  });
});

describe("what comes off the disk", () => {
  it("survives any shape at all", () => {
    expect(normalizeVocabulaire(null)).toEqual({ custom: [], hidden: [] });
    expect(normalizeVocabulaire({ custom: "pas une liste" })).toEqual({ custom: [], hidden: [] });
    expect(normalizeVocabulaire({ custom: [{ id: "x" }] }).custom).toEqual([]);
  });

  it("drops a motif with no label rather than showing an empty line", () => {
    const v = normalizeVocabulaire({ custom: [{ id: "x", label: "   ", family: "world" }] });
    expect(v.custom).toEqual([]);
  });
});
