import { describe, it, expect } from "vitest";
import {
  FORCES,
  RELATIONS,
  RELATIONS_SAISISSABLES,
  estSymétrique,
  forceDe,
  inverseDe,
  relationDef,
} from "./relations";

describe("les relations", () => {
  it("l'inverse de l'inverse ramène à la relation de départ", () => {
    for (const r of RELATIONS) expect(inverseDe(inverseDe(r.id))).toBe(r.id);
  });

  it("une relation symétrique est son propre inverse", () => {
    expect(inverseDe("écho")).toBe("écho");
    expect(inverseDe("diptyque")).toBe("diptyque");
    expect(estSymétrique("même-destin")).toBe(true);
  });

  it("une relation orientée se renverse", () => {
    expect(inverseDe("suite-de")).toBe("précède");
    expect(inverseDe("précède")).toBe("suite-de");
    expect(inverseDe("remake-de")).toBe("remaké-par");
    expect(estSymétrique("suite-de")).toBe(false);
  });

  it("ne propose pas à la saisie ce qui s'écrit tout seul à l'autre bout", () => {
    const ids = RELATIONS_SAISISSABLES.map((r) => r.id);
    expect(ids).not.toContain("précède");
    expect(ids).not.toContain("remaké-par");
    expect(ids).toContain("suite-de");
  });

  it("laisse tranquille ce qu'elle ne connaît pas", () => {
    expect(inverseDe(undefined)).toBeUndefined();
    expect(relationDef(null)).toBeUndefined();
  });

  it("ramène toute force hors des trois crans au cran du milieu", () => {
    expect(forceDe(undefined)).toBe(2);
    expect(forceDe(0)).toBe(2);
    expect(forceDe(9)).toBe(2);
    expect(forceDe(3)).toBe(3);
    expect(FORCES).toHaveLength(3);
  });
});
