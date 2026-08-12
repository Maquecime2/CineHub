import { describe, it, expect } from "vitest";
import {
  STRENGTHS,
  RELATIONS,
  ENTERABLE_RELATIONS,
  isSymmetric,
  strengthOf,
  inverseOf,
  relationDef,
} from "./relations";

describe("the relations", () => {
  it("the inverse of the inverse comes back to the original relation", () => {
    for (const r of RELATIONS) expect(inverseOf(inverseOf(r.id))).toBe(r.id);
  });

  it("a symmetric relation is its own inverse", () => {
    expect(inverseOf("echo")).toBe("echo");
    expect(inverseOf("diptych")).toBe("diptych");
    expect(isSymmetric("same-fate")).toBe(true);
  });

  it("a directed relation flips over", () => {
    expect(inverseOf("sequel-to")).toBe("precedes");
    expect(inverseOf("precedes")).toBe("sequel-to");
    expect(inverseOf("remake-of")).toBe("remade-by");
    expect(isSymmetric("sequel-to")).toBe(false);
  });

  it("does not offer for entry what writes itself at the other end", () => {
    const ids = ENTERABLE_RELATIONS.map((r) => r.id);
    expect(ids).not.toContain("precedes");
    expect(ids).not.toContain("remade-by");
    expect(ids).toContain("sequel-to");
  });

  it("leaves alone what it does not know", () => {
    expect(inverseOf(undefined)).toBeUndefined();
    expect(relationDef(null)).toBeUndefined();
  });

  it("brings any strength outside the three notches back to the middle one", () => {
    expect(strengthOf(undefined)).toBe(2);
    expect(strengthOf(0)).toBe(2);
    expect(strengthOf(9)).toBe(2);
    expect(strengthOf(3)).toBe(3);
    expect(STRENGTHS).toHaveLength(3);
  });
});
