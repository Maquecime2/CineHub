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

describe("les relations", () => {
  it("l'inverse de l'inverse ramène à la relation de départ", () => {
    for (const r of RELATIONS) expect(inverseOf(inverseOf(r.id))).toBe(r.id);
  });

  it("une relation symétrique est son propre inverse", () => {
    expect(inverseOf("echo")).toBe("echo");
    expect(inverseOf("diptych")).toBe("diptych");
    expect(isSymmetric("same-fate")).toBe(true);
  });

  it("une relation orientée se renverse", () => {
    expect(inverseOf("sequel-to")).toBe("precedes");
    expect(inverseOf("precedes")).toBe("sequel-to");
    expect(inverseOf("remake-of")).toBe("remade-by");
    expect(isSymmetric("sequel-to")).toBe(false);
  });

  it("ne propose pas à la saisie ce qui s'écrit tout seul à l'autre bout", () => {
    const ids = ENTERABLE_RELATIONS.map((r) => r.id);
    expect(ids).not.toContain("precedes");
    expect(ids).not.toContain("remade-by");
    expect(ids).toContain("sequel-to");
  });

  it("laisse tranquille ce qu'elle ne connaît pas", () => {
    expect(inverseOf(undefined)).toBeUndefined();
    expect(relationDef(null)).toBeUndefined();
  });

  it("ramène toute force hors des trois crans au cran du milieu", () => {
    expect(strengthOf(undefined)).toBe(2);
    expect(strengthOf(0)).toBe(2);
    expect(strengthOf(9)).toBe(2);
    expect(strengthOf(3)).toBe(3);
    expect(STRENGTHS).toHaveLength(3);
  });
});
