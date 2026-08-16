import { describe, it, expect } from "vitest";
import {
  withFilm,
  makeThread,
  threadMembers,
  threadLabel,
  normalizeThreads,
  withoutFilm,
  effectiveThreads,
  isStarred,
  countOfMotif,
  colorForMotif,
  isPlainDefault,
} from "./threads";
import { makeFilm } from "./film";

const A = makeFilm({ id: "a", title: "A", motifs: ["hero-dies"] });
const B = makeFilm({ id: "b", title: "B", motifs: ["hero-dies"] });
const C = makeFilm({ id: "c", title: "C" });
const films = [A, B, C];

/** What a view hands the domain: the key back, so a test needs no catalogue. */
const key = (k: string) => k;

describe("a gathering's members", () => {
  it("gathers what the motif brings in", () => {
    expect(threadMembers(makeThread({ motif: "hero-dies" }), films).sort()).toEqual(["a", "b"]);
  });

  it("adds what was set by hand, motif or no motif", () => {
    const thread = makeThread({ motif: "hero-dies", filmIds: ["c"] });
    expect(threadMembers(thread, films).sort()).toEqual(["a", "b", "c"]);
  });

  it("rules out what was removed, even if the motif still brings it in", () => {
    const thread = makeThread({ motif: "hero-dies", excluded: ["b"] });
    expect(threadMembers(thread, films)).toEqual(["a"]);
  });

  it("does not count a film deleted since", () => {
    const thread = makeThread({ motif: "nowhere", filmIds: ["a", "disparu"] });
    expect(threadMembers(thread, films)).toEqual(["a"]);
  });
});

describe("putting in and taking out", () => {
  it("removing a film brought in by the motif writes it into the exclusions", () => {
    const after = withoutFilm(makeThread({ motif: "hero-dies" }), "a", films);
    expect(after.excluded).toEqual(["a"]);
    // failing which it would come back on the next load
    expect(threadMembers(after, films)).toEqual(["b"]);
  });

  it("removing a film set by hand has nothing to exclude", () => {
    const after = withoutFilm(makeThread({ motif: "nowhere", filmIds: ["c"] }), "c", films);
    expect(after.excluded).toEqual([]);
    expect(threadMembers(after, films)).toEqual([]);
  });

  it("putting an excluded film back lifts the exclusion rather than stacking", () => {
    const after = withFilm(makeThread({ motif: "hero-dies", excluded: ["a"] }), "a");
    expect(after.excluded).toEqual([]);
    expect(threadMembers(after, films).sort()).toEqual(["a", "b"]);
  });
});

/* ============================================================
   THE MOTIF IS THE GATHERING

   Nobody promotes anything any more: a motif laid on two cards is a star
   on its own, and what is stored is only what somebody changed about it.
   ============================================================ */
describe("what the map draws", () => {
  it("makes a star of a motif laid on two cards, with nothing stored", () => {
    const [star, ...rest] = effectiveThreads(films, []);
    expect(rest).toEqual([]);
    expect(star?.motif).toBe("hero-dies");
    // the identity is the motif, so the sky's node id is stable
    expect(star?.id).toBe("hero-dies");
  });

  it("leaves a motif laid on a single card out of the sky", () => {
    expect(effectiveThreads([A, C], [])).toEqual([]);
  });

  it("draws a gathering held up by hand alone, below the count", () => {
    const stored = [makeThread({ motif: "rain", filmIds: ["a", "c"] })];
    expect(effectiveThreads([A, C], stored).map((t) => t.motif)).toEqual(["rain"]);
  });

  it("does not draw a star put out by hand", () => {
    const stored = [makeThread({ motif: "hero-dies", off: true })];
    expect(effectiveThreads(films, stored)).toEqual([]);
    expect(isStarred("hero-dies", films, stored)).toBe(false);
  });

  it("lays the stored settings over the default", () => {
    const stored = [makeThread({ motif: "hero-dies", color: "plum", note: "les fins amères" })];
    const [star] = effectiveThreads(films, stored);
    expect(star?.color).toBe("plum");
    expect(star?.note).toBe("les fins amères");
  });

  it("gives a motif the same colour whatever else exists", () => {
    /* It used to be `CAT_KEYS[threads.length % …]`: the colour depended on
       how many gatherings happened to exist that day, and every colour
       shifted when an earlier one was deleted. */
    expect(colorForMotif("hero-dies")).toBe(colorForMotif("hero-dies"));
    expect(makeThread({ motif: "hero-dies" }).color).toBe(colorForMotif("hero-dies"));
  });
});

describe("what a gathering is called", () => {
  it("asks the catalogue when nothing was written by hand", () => {
    expect(threadLabel(makeThread({ motif: "hero-dies" }), key)).toBe("motifs.labels.hero-dies");
  });

  it("prefers the name written by hand", () => {
    expect(threadLabel(makeThread({ motif: "hero-dies", label: "Les fins amères" }), key)).toBe(
      "Les fins amères"
    );
  });

  it("falls back on the identifier for a motif nobody knows any more", () => {
    expect(threadLabel(makeThread({ motif: "il-pleut" }), key)).toBe("il-pleut");
  });
});

describe("what is worth storing", () => {
  it("says nothing is, for an untouched gathering", () => {
    expect(isPlainDefault(makeThread({ motif: "hero-dies" }))).toBe(true);
  });

  it("says something is, as soon as one thing deviates", () => {
    expect(isPlainDefault(makeThread({ motif: "hero-dies", note: "x" }))).toBe(false);
    expect(isPlainDefault(makeThread({ motif: "hero-dies", off: true }))).toBe(false);
    expect(isPlainDefault(makeThread({ motif: "hero-dies", filmIds: ["c"] }))).toBe(false);
  });
});

describe("counting", () => {
  it("counts the cards carrying a motif", () => {
    expect(countOfMotif("hero-dies", films)).toBe(2);
    expect(countOfMotif("nowhere", films)).toBe(0);
  });
});

/* ============================================================
   WHAT WAS WRITTEN BEFORE THE TRANSLATION

   `normalizeThreads` is the only door a gathering comes in through. Three
   things changed name there when the code moved to English — `exclus`,
   `couleur`, and the id of the motif that feeds it — and a binder already
   kept must lose none of the three.
   ============================================================ */
describe("what comes off the disk", () => {
  it("survives any shape at all", () => {
    expect(normalizeThreads(null)).toEqual([]);
    expect(normalizeThreads([{ label: "" }])).toEqual([]);
  });

  it("READS BACK A ROW WHOSE LABEL WAS NEVER WRITTEN", () => {
    /* THE CRASH THIS WHOLE CHANGE CAME FROM. Making a gathering out of a
       CATALOGUE motif copied `motif.label`, which a catalogue motif does
       not have: the row went to disk with `label: undefined`, and the next
       read did `.trim()` on it — a TypeError at the very mounting of the
       app, with the binder unreachable until localStorage was cleared. */
    const [thread] = normalizeThreads([{ motif: "hero-dies", label: undefined }] as never);
    expect(thread?.label).toBe("");
    expect(threadLabel(thread!, key)).toBe("motifs.labels.hero-dies");
  });

  it("throws away a row fed by no motif", () => {
    // reachable from nowhere, drawing nothing, and impossible to delete
    expect(normalizeThreads([{ label: "À la main", motif: null }] as never)).toEqual([]);
  });

  it("merges two rows on the same motif rather than keeping both", () => {
    const kept = normalizeThreads([
      { motif: "hero-dies", filmIds: ["a"] },
      { motif: "hero-dies", filmIds: ["c"], label: "Les fins amères" },
    ] as never);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.filmIds.sort()).toEqual(["a", "c"]);
    expect(kept[0]?.label).toBe("Les fins amères");
  });

  it("reads back `exclus` and `couleur`", () => {
    const [thread] = normalizeThreads([
      { motif: "hero-dies", exclus: ["a"], couleur: "plum" },
    ] as never);
    expect(thread?.excluded).toEqual(["a"]);
    expect(thread?.color).toBe("plum");
    // and the old keys do not go back out onto the disk
    expect(thread as unknown as Record<string, unknown>).not.toHaveProperty("exclus");
    expect(thread as unknown as Record<string, unknown>).not.toHaveProperty("couleur");
  });

  it("translates the motif that feeds the gathering", () => {
    /* Without it, a gathering fed by `melancolie` would stop catching
       anything at all as soon as the catalogue called it `melancholy`. */
    const [thread] = normalizeThreads([{ label: "Les tristes", motif: "melancolie" }] as never);
    expect(thread?.motif).toBe("melancholy");
    expect(thread?.id).toBe("melancholy");
  });

  it("keeps intact a motif the catalogue does not know", () => {
    const [thread] = normalizeThreads([{ label: "Le mien", motif: "il-pleut" }] as never);
    expect(thread?.motif).toBe("il-pleut");
  });

  it("does not damage a row already written in English", () => {
    const [thread] = normalizeThreads([
      { label: "Un thread", excluded: ["b"], color: "pine", motif: "hero-dies" },
    ] as never);
    expect(thread?.excluded).toEqual(["b"]);
    expect(thread?.color).toBe("pine");
    expect(thread?.motif).toBe("hero-dies");
  });
});
