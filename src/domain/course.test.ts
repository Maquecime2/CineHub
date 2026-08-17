import { describe, it, expect } from "vitest";
import {
  courseSteps,
  groupedSteps,
  isEmptyCourse,
  makeCourse,
  makeStep,
  move,
  moveBy,
  moveGroup,
  normalizeCourses,
  patchStep,
  stepBond,
  strandedCount,
  withStep,
  withoutStep,
  withoutSteps,
} from "./course";
import { makeBond } from "./bonds";
import { makeFilm } from "./film";

/* ============================================================
   THE ARRAY IS THE ORDER
   ============================================================

   Everything below defends one sentence. A viewing plan is an ORDER,
   the order lives in the array and nowhere else, and no convenience is
   allowed to reorder it on somebody's behalf — not a sort on the way
   out, not a tidy grouping, not a clamp that makes a refused move look
   like it worked.

   The second thing it defends is that reading NEVER WRITES. A film
   missing from the collection for the moment — a synchronisation
   running behind — must come back on its own, so a step pointing at it
   is skipped when drawn and left exactly where it is on disk. The same
   mistake in `threadMembers` would have destroyed gatherings; here it
   would destroy plans.
   ============================================================ */

const OZU_A = makeFilm({ id: "a", title: "Late Spring", director: "Yasujirō Ozu" });
const OZU_B = makeFilm({ id: "b", title: "Tokyo Story", director: "Yasujirō Ozu" });
const HOU = makeFilm({ id: "c", title: "Flowers of Shanghai", director: "Hou Hsiao-hsien" });
const films = [OZU_A, OZU_B, HOU];

const run = (...filmIds: string[]) =>
  makeCourse({ steps: filmIds.map((id) => makeStep(id)), label: "a run" });

describe("moving a step", () => {
  it("puts it where it was asked to go, and moves nothing else", () => {
    expect(move(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("gives back the very same list when there is nothing to do", () => {
    const list = ["a", "b"];
    /* The identity matters: it is what lets a caller skip a write. */
    expect(move(list, 1, 1)).toBe(list);
    expect(move(list, 5, 0)).toBe(list);
    expect(move(list, 0, -1)).toBe(list);
  });

  it("never touches the list it was given", () => {
    const list = ["a", "b", "c"];
    move(list, 0, 2);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("refuses a move off the end rather than clamping it", () => {
    /* Clamping would make the last entry's "move down" look like it
       worked, and the spoken announcement would then say it changed
       place when it had not. */
    const list = ["a", "b", "c"];
    expect(moveBy(list, 2, 1)).toBe(list);
    expect(moveBy(list, 0, -1)).toBe(list);
    expect(moveBy(list, 1, 1)).toEqual(["a", "c", "b"]);
  });
});

describe("moving several steps at once", () => {
  const list = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const ids = (...names: string[]) => new Set(names);
  const read = (l: { id: string }[]) => l.map((i) => i.id);

  it("gathers the selection in front of the entry it was dropped on", () => {
    expect(read(moveGroup(list, ids("a", "b"), "e"))).toEqual(["c", "d", "a", "b", "e"]);
  });

  it("keeps what was taken in ITS own order, however scattered", () => {
    /* Trois entrées prises aux places 1, 3 et 4 restent dans cet
       ordre-là : on a demandé à les déplacer, pas à les ranger. */
    expect(read(moveGroup(list, ids("e", "a", "c"), "d"))).toEqual(["b", "a", "c", "e", "d"]);
  });

  it("gathers them at the end when the target is the last entry", () => {
    expect(read(moveGroup(list, ids("a"), "e"))).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("refuses a drop onto the selection itself, rather than inventing an answer", () => {
    /* La même identité que `move` : c'est elle qui permet à l'appelant
       de ne pas écrire, et de ne pas ANNONCER un déplacement qui
       n'a pas eu lieu. */
    expect(moveGroup(list, ids("a", "b"), "b")).toBe(list);
    expect(moveGroup(list, ids(), "b")).toBe(list);
    expect(moveGroup(list, ids("zz"), "b")).toBe(list);
    expect(moveGroup(list, ids("a"), "inconnu")).toBe(list);
  });

  it("never touches the list it was given", () => {
    const before = read(list);
    moveGroup(list, ids("a", "b"), "e");
    expect(read(list)).toEqual(before);
  });
});

describe("what a step is", () => {
  it("is not its film: the same film twice is a plan, not a mistake", () => {
    /* Ozu, then Hou, then Ozu again is a reading of all three. Keying a
       step by its film would have forbidden it without anybody
       deciding to. */
    const course = run("a", "c", "a");
    const ids = course.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
    expect(courseSteps(course, films)).toHaveLength(3);
  });

  it("edits only the one it was asked for, even among twins", () => {
    const course = run("a", "c", "a");
    const target = course.steps[2]!.id;
    const next = patchStep(course, target, { why: "after Hou, it reads differently" });
    expect(next.steps[0]!.why).toBe("");
    expect(next.steps[2]!.why).toBe("after Hou, it reads differently");
  });

  it("keeps its own id whatever a patch claims", () => {
    const course = run("a");
    const id = course.steps[0]!.id;
    expect(patchStep(course, id, { id: "elsewhere" }).steps[0]!.id).toBe(id);
  });
});

describe("a step whose card is gone", () => {
  const course = run("a", "gone", "c");

  it("is not drawn", () => {
    expect(courseSteps(course, films).map((e) => e.film.id)).toEqual(["a", "c"]);
  });

  it("is not erased, because reading must not write", () => {
    courseSteps(course, films);
    expect(course.steps).toHaveLength(3);
  });

  it("is counted, so the view can say so instead of quietly shrinking", () => {
    expect(strandedCount(course, films)).toBe(1);
    expect(strandedCount(run("a"), films)).toBe(0);
  });
});

describe("grouping consecutive films by their director", () => {
  const by = (f: { director: string }) => f.director;

  it("gathers a run of the same name into one group", () => {
    const entries = courseSteps(run("a", "b", "c"), films);
    const groups = groupedSteps(entries, by);
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1]);
  });

  it("does NOT gather two runs split by somebody else", () => {
    /* Sorting them together would rewrite the plan under cover of
       presenting it, and the plan is the one thing here that is
       theirs. */
    const entries = courseSteps(run("a", "c", "b"), films);
    expect(groupedSteps(entries, by).map((g) => g.key)).toEqual([
      "Yasujirō Ozu",
      "Hou Hsiao-hsien",
      "Yasujirō Ozu",
    ]);
  });
});

describe("a run worth storing", () => {
  it("is not one with nothing in it and nothing to say", () => {
    expect(isEmptyCourse(makeCourse())).toBe(true);
    expect(isEmptyCourse(makeCourse({ label: "  " }))).toBe(true);
  });

  it("is one that holds a film, or a title, or a thesis", () => {
    expect(isEmptyCourse(makeCourse({ steps: [makeStep("a")] }))).toBe(false);
    expect(isEmptyCourse(makeCourse({ label: "Ozu to Hou" }))).toBe(false);
    expect(isEmptyCourse(makeCourse({ note: "going back up the line" }))).toBe(false);
  });

  it("is dropped on read, so an empty one never comes back", () => {
    expect(normalizeCourses([makeCourse(), run("a")])).toHaveLength(1);
  });
});

describe("adding and removing", () => {
  it("appends to the end and stamps the run as touched", () => {
    const course = makeCourse({ label: "x", updatedAt: 1 });
    const next = withStep(course, "a");
    expect(next.steps.map((s) => s.filmId)).toEqual(["a"]);
    expect(next.updatedAt).toBeGreaterThan(1);
  });

  it("removes by step, not by film", () => {
    const course = run("a", "c", "a");
    const next = withoutStep(course, course.steps[0]!.id);
    expect(next.steps.map((s) => s.filmId)).toEqual(["c", "a"]);
  });

  it("removes a whole selection by step, and the twin film stays", () => {
    const course = run("a", "c", "a", "d");
    const next = withoutSteps(course, new Set([course.steps[0]!.id, course.steps[3]!.id]));
    /* Le second « a » survit : c'est l'ÉTAPE qu'on retire, jamais le
       film — deux séances du même titre sont un plan ordinaire. */
    expect(next.steps.map((s) => s.filmId)).toEqual(["c", "a"]);
  });
});

describe("what reading turns away", () => {
  it("drops a step pointing at no film at all", () => {
    const raw = [{ ...run("a"), steps: [{ why: "" }, { filmId: "a" }] }];
    expect(normalizeCourses(raw)[0]!.steps).toHaveLength(1);
  });

  it("gives a fresh id to a step that shares one, rather than dropping it", () => {
    /* Two steps on one id would move as one and edit as one — the very
       confusion `Step.id` exists to prevent. But it is still a real
       entry in somebody's plan, only badly named. */
    const raw = [
      {
        ...run("a"),
        steps: [
          { id: "same", filmId: "a" },
          { id: "same", filmId: "c" },
        ],
      },
    ];
    const steps = normalizeCourses(raw)[0]!.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0]!.id).not.toBe(steps[1]!.id);
  });

  it("keeps a `because` that names a bond nobody holds any more", () => {
    /* The two documents travel apart. Checking one against the other
       here would erase somebody's justification because their
       synchronisation ran late — it is muted when drawn instead. */
    const raw = [
      { ...run("a"), steps: [{ id: "s", filmId: "a", because: "master:x>y", why: "" }] },
    ];
    const step = normalizeCourses(raw)[0]!.steps[0]!;
    expect(step.because).toBe("master:x>y");
    expect(stepBond(step, [])).toBeUndefined();
  });

  it("finds the bond a step follows from when we do hold it", () => {
    const bond = makeBond({ kind: "master", fromName: "Ozu", toName: "Hou" })!;
    const step = makeStep("a", { because: bond.id });
    expect(stepBond(step, [bond])).toBe(bond);
  });

  it("keeps one course per id and hands them back oldest first", () => {
    const raw = [
      makeCourse({ id: "two", label: "b", createdAt: 20 }),
      makeCourse({ id: "one", label: "a", createdAt: 10 }),
      makeCourse({ id: "two", label: "b again", createdAt: 30 }),
    ];
    expect(normalizeCourses(raw).map((c) => c.id)).toEqual(["one", "two"]);
  });

  it("drops what is not a course at all", () => {
    expect(normalizeCourses([null, 4, "x"])).toEqual([]);
    expect(normalizeCourses(undefined)).toEqual([]);
  });
});
