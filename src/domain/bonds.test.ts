import { describe, it, expect } from "vitest";
import {
  BONDS,
  bondId,
  bondLabel,
  bondsTouching,
  contradicts,
  hasBond,
  isBondKind,
  makeBond,
  normalizeBonds,
} from "./bonds";
import type { Bond } from "./bonds";

/* ============================================================
   WHAT A BOND REFUSES TO BE
   ============================================================

   This test exists for the door, not for the shape. `domain/threads`
   learned at some cost that a stored row must be impossible to
   duplicate rather than merely unlikely to be, and that a value which
   cannot be drawn must be dropped where it comes in rather than
   discovered halfway through a render.

   The four cases below all LOOK like duplicates and only two of them
   are. A → B written twice is one row. A—B and B—A on an undirected
   kind is one row. A → B together with B → A on a DIRECTED kind is
   neither — it is two statements that cannot both hold, and the whole
   point is that reading does not get to pick a winner.
   ============================================================ */

/** What a view hands the domain: enough to see which wording came out. */
const say = (k: string, values?: Record<string, unknown>) => `${k}(${values?.name ?? ""})`;

const bond = (kind: "master" | "affinity" | "influence" | "counterpoint", a: string, b: string) =>
  makeBond({ kind, fromName: a, toName: b })!;

describe("the vocabulary itself", () => {
  it("names an inverse for every kind, and the same wording when symmetric", () => {
    for (const def of BONDS) {
      expect(def.label).toMatch(/^bonds\./);
      expect(def.inverse).toMatch(/^bonds\./);
      if (!def.directed) expect(def.inverse).toBe(def.label);
      else expect(def.inverse).not.toBe(def.label);
    }
  });

  it("knows a kind it has, and refuses one it has not", () => {
    expect(isBondKind("master")).toBe(true);
    expect(isBondKind("mentor")).toBe(false);
    expect(isBondKind(undefined)).toBe(false);
  });
});

describe("stating a bond", () => {
  it("files both ends under the key the collection uses", () => {
    const b = bond("master", "Yasujirō OZU", "Hou Hsiao-hsien");
    expect(b.from).toBe("yasujiro ozu");
    expect(b.to).toBe("hou hsiao-hsien");
  });

  it("keeps the names as they were typed, because nothing else will", () => {
    const b = bond("master", "Yasujirō Ozu", "Hou Hsiao-hsien");
    expect(b.fromName).toBe("Yasujirō Ozu");
    expect(b.toName).toBe("Hou Hsiao-hsien");
  });

  it("refuses a loop: a bond from somebody to themselves says nothing", () => {
    expect(makeBond({ kind: "master", fromName: "Ozu", toName: "ozu" })).toBeNull();
  });

  it("refuses an empty end", () => {
    expect(makeBond({ kind: "master", fromName: "  ", toName: "Ozu" })).toBeNull();
    expect(makeBond({ kind: "master", fromName: "Ozu", toName: "" })).toBeNull();
  });

  it("refuses a kind it cannot draw", () => {
    expect(makeBond({ kind: "mentor" as "master", fromName: "A", toName: "B" })).toBeNull();
  });

  it("swaps the names along with the keys when it canonicalises an undirected bond", () => {
    /* "Zulawski" sorts after "Antonioni", so this one is stored the
       other way round — and the names must follow, or the row comes
       back with the two of them exchanged. */
    const b = bond("affinity", "Zulawski", "Antonioni");
    expect(b.from).toBe("antonioni");
    expect(b.fromName).toBe("Antonioni");
    expect(b.toName).toBe("Zulawski");
  });
});

describe("the identity of a bond", () => {
  it("keeps the direction when the kind has one", () => {
    expect(bondId("master", "a", "b")).not.toBe(bondId("master", "b", "a"));
  });

  it("sorts the two ends when the kind has none", () => {
    expect(bondId("affinity", "a", "b")).toBe(bondId("affinity", "b", "a"));
  });

  it("separates two kinds between the same two people", () => {
    /* Being somebody's pupil AND their counterpoint happens; one row
       must not swallow the other. */
    expect(bondId("master", "a", "b")).not.toBe(bondId("counterpoint", "a", "b"));
  });
});

describe("what reading turns away", () => {
  it("merges the same bond written twice", () => {
    const raw = [bond("master", "Ozu", "Hou"), bond("master", "Ozu", "Hou")];
    expect(normalizeBonds(raw)).toHaveLength(1);
  });

  it("merges an undirected bond written from either end", () => {
    const raw = [bond("affinity", "Ozu", "Hou"), bond("affinity", "Hou", "Ozu")];
    expect(normalizeBonds(raw)).toHaveLength(1);
  });

  it("keeps the note of whichever half actually carried one", () => {
    const raw = [
      makeBond({ kind: "affinity", fromName: "Ozu", toName: "Hou" })!,
      makeBond({ kind: "affinity", fromName: "Hou", toName: "Ozu", note: "the same rooms" })!,
    ];
    expect(normalizeBonds(raw)[0]!.note).toBe("the same rooms");
  });

  it("turns away a contradiction, and the first written stands", () => {
    const raw = [
      makeBond({ kind: "master", fromName: "Ozu", toName: "Hou", at: 1 })!,
      makeBond({ kind: "master", fromName: "Hou", toName: "Ozu", at: 2 })!,
    ];
    const out = normalizeBonds(raw);
    expect(out).toHaveLength(1);
    expect(out[0]!.fromName).toBe("Ozu");
  });

  it("does not call an undirected pair a contradiction", () => {
    /* Nothing to refuse: the two share an id and merge on their own. */
    const a = bond("counterpoint", "Ozu", "Hou");
    const b = bond("counterpoint", "Hou", "Ozu");
    expect(contradicts([a], b)).toBeUndefined();
    expect(hasBond([a], b)).toBe(true);
  });

  it("drops a kind this version does not know rather than drawing it in grey", () => {
    const raw = [{ ...bond("master", "Ozu", "Hou"), kind: "mentor" }];
    expect(normalizeBonds(raw)).toEqual([]);
  });

  it("drops what is not a bond at all", () => {
    expect(normalizeBonds(["x", null, 3, {}])).toEqual([]);
    expect(normalizeBonds("nothing of the sort")).toEqual([]);
  });

  it("derives the keys from the names, so a hand-edited key cannot move a bond", () => {
    const raw = [{ ...bond("master", "Ozu", "Hou"), from: "kurosawa" }];
    expect(normalizeBonds(raw)[0]!.from).toBe("ozu");
  });
});

describe("reading a bond from one end", () => {
  const b = bond("master", "Ozu", "Hou");

  it("says the plain wording standing at the start", () => {
    expect(bondLabel(b, "ozu", say)).toBe("bonds.master(Hou)");
  });

  it("says the inverse standing at the other end", () => {
    /* This is the whole reason `inverse` is a wording and not a second
       row: nobody has to reverse it in their head. */
    expect(bondLabel(b, "hou", say)).toBe("bonds.masterInverse(Ozu)");
  });

  it("says the same thing from both ends when the bond is symmetric", () => {
    const c = bond("counterpoint", "Ozu", "Hou");
    expect(bondLabel(c, "ozu", say)).toBe("bonds.counterpoint(Hou)");
    expect(bondLabel(c, "hou", say)).toBe("bonds.counterpoint(Ozu)");
  });
});

describe("the bonds around one person", () => {
  const bonds: Bond[] = [
    bond("master", "Ozu", "Hou"),
    bond("affinity", "Hou", "Kore-eda"),
    bond("master", "Bresson", "Schrader"),
  ];

  it("finds them whichever end that person is at", () => {
    expect(bondsTouching(bonds, "hou")).toHaveLength(2);
  });

  it("finds none for somebody nobody has tied to anything", () => {
    expect(bondsTouching(bonds, "varda")).toEqual([]);
  });
});
