import { describe, it, expect } from "vitest";
import { withFilm, makeThread, threadMembers, normalizeThreads, withoutFilm } from "./threads";
import { makeFilm } from "./film";

const A = makeFilm({ id: "a", title: "A", motifs: ["hero-dies"] });
const B = makeFilm({ id: "b", title: "B", motifs: ["hero-dies"] });
const C = makeFilm({ id: "c", title: "C" });
const films = [A, B, C];

describe("a thread's members", () => {
  it("gathers what the motif brings in", () => {
    const thread = makeThread({ label: "Le héros meurt", motif: "hero-dies" });
    expect(threadMembers(thread, films).sort()).toEqual(["a", "b"]);
  });

  it("adds what was set by hand, motif or no motif", () => {
    const thread = makeThread({ motif: "hero-dies", filmIds: ["c"], label: "x" });
    expect(threadMembers(thread, films).sort()).toEqual(["a", "b", "c"]);
  });

  it("rules out what was removed, even if the motif still brings it in", () => {
    const thread = makeThread({ motif: "hero-dies", excluded: ["b"], label: "x" });
    expect(threadMembers(thread, films)).toEqual(["a"]);
  });

  it("does not count a film deleted since", () => {
    const thread = makeThread({ filmIds: ["a", "disparu"], label: "x" });
    expect(threadMembers(thread, films)).toEqual(["a"]);
  });
});

describe("putting in and taking out", () => {
  it("removing a film brought in by the motif writes it into the exclusions", () => {
    const thread = makeThread({ motif: "hero-dies", label: "x" });
    const after = withoutFilm(thread, "a", films);
    expect(after.excluded).toEqual(["a"]);
    // sans quoi il reviendrait au chargement suivant
    expect(threadMembers(after, films)).toEqual(["b"]);
  });

  it("removing a film set by hand has nothing to exclude", () => {
    const thread = makeThread({ filmIds: ["c"], label: "x" });
    const after = withoutFilm(thread, "c", films);
    expect(after.excluded).toEqual([]);
    expect(threadMembers(after, films)).toEqual([]);
  });

  it("putting an excluded film back lifts the exclusion rather than stacking", () => {
    const thread = makeThread({ motif: "hero-dies", excluded: ["a"], label: "x" });
    const after = withFilm(thread, "a");
    expect(after.excluded).toEqual([]);
    expect(threadMembers(after, films).sort()).toEqual(["a", "b"]);
  });
});

describe("what comes off the disk", () => {
  it("survives any shape at all", () => {
    expect(normalizeThreads(null)).toEqual([]);
    expect(normalizeThreads([{ label: "" }])).toEqual([]);
    const [thread] = normalizeThreads([{ label: "Un thread" }]);
    expect(thread?.filmIds).toEqual([]);
    expect(thread?.id).toBeTruthy();
  });
});

/* ============================================================
   WHAT WAS WRITTEN BEFORE THE TRANSLATION

   `normalizeThreads` is the only door a thread comes in through. Three
   things changed name there when the code moved to English — `exclus`,
   `couleur`, and the id of the motif that feeds the thread — and a binder
   already kept must lose none of the three.
   ============================================================ */
describe("threads written before the translation", () => {
  it("reads back `exclus` and `couleur`", () => {
    const [thread] = normalizeThreads([
      { label: "Un thread", exclus: ["a"], couleur: "plum" },
    ] as never);
    expect(thread?.excluded).toEqual(["a"]);
    expect(thread?.color).toBe("plum");
    // and the old keys do not go back out onto the disk
    expect(thread as unknown as Record<string, unknown>).not.toHaveProperty("exclus");
    expect(thread as unknown as Record<string, unknown>).not.toHaveProperty("couleur");
  });

  it("translates the motif that feeds the thread", () => {
    /* Without it, a thread fed by `melancolie` would stop catching
       anything at all as soon as the catalogue called it `melancholy`:
       the thread would sit there, empty, with nothing to say why. */
    const [thread] = normalizeThreads([{ label: "Les tristes", motif: "melancolie" }] as never);
    expect(thread?.motif).toBe("melancholy");
  });

  it("leaves a hand-made thread with no motif", () => {
    const [thread] = normalizeThreads([{ label: "À la main", motif: null }] as never);
    expect(thread?.motif).toBeNull();
  });

  it("keeps intact a motif the catalogue does not know", () => {
    const [thread] = normalizeThreads([{ label: "Le mien", motif: "il-pleut" }] as never);
    expect(thread?.motif).toBe("il-pleut");
  });

  it("does not damage a thread already written in English", () => {
    const [thread] = normalizeThreads([
      { label: "Un thread", excluded: ["b"], color: "pine", motif: "hero-dies" },
    ] as never);
    expect(thread?.excluded).toEqual(["b"]);
    expect(thread?.color).toBe("pine");
    expect(thread?.motif).toBe("hero-dies");
  });
});
