import { describe, it, expect } from "vitest";
import { planDraw, levelCounts, categoryShares, LEVELS, SIZES, POINTS } from "../src/draw.ts";
import type { Difficulty, Stock } from "../src/draw.ts";

/* ============================================================
   THE ARITHMETIC OF A DRAW

   Tested here and not through a database, because that is what it is:
   shares, remainders, and what to do when the bank is short. A test that
   had to insert forty questions to ask "does 25/50/25 of ten come to
   ten?" would ask it once and never again.

   THE NUMBER THAT MATTERS is the total. A quiz that comes out at
   nineteen questions instead of twenty, or that weighs a different
   number of points from another of the same level, breaks the one
   promise this feature makes: that two scores can be compared.
   ============================================================ */

const bank = (have: Partial<Record<Difficulty, number>>, id = "c1"): Stock => ({
  categoryId: id,
  have: { easy: 0, normal: 0, hard: 0, ...have },
});

/** Plenty of everything: the case where nothing has to give. */
const deep = (id: string) => bank({ easy: 100, normal: 100, hard: 100 }, id);

const countOf = (plan: ReturnType<typeof planDraw>, d: Difficulty) =>
  plan.cells.filter((c) => c.difficulty === d).reduce((n, c) => n + c.count, 0);

describe("the mix of levels", () => {
  it("always comes to the length asked for", () => {
    for (const level of LEVELS) {
      for (const size of SIZES) {
        const counts = levelCounts(level, size);
        const total = LEVELS.reduce((n, d) => n + counts[d], 0);
        expect(total, `${level}/${size}`).toBe(size);
      }
    }
  });

  it("holds the promised proportions where they divide", () => {
    expect(levelCounts("easy", 10)).toEqual({ easy: 6, normal: 3, hard: 1 });
    expect(levelCounts("easy", 20)).toEqual({ easy: 12, normal: 6, hard: 2 });
    expect(levelCounts("easy", 30)).toEqual({ easy: 18, normal: 9, hard: 3 });
    expect(levelCounts("normal", 20)).toEqual({ easy: 5, normal: 10, hard: 5 });
    expect(levelCounts("hard", 10)).toEqual({ easy: 1, normal: 3, hard: 6 });
    expect(levelCounts("hard", 20)).toEqual({ easy: 2, normal: 6, hard: 12 });
    expect(levelCounts("hard", 30)).toEqual({ easy: 3, normal: 9, hard: 18 });
  });

  it("hands the spare question to the quiz's own level", () => {
    /* The only two cases that do not divide, and the tie is exact: easy
       and hard are equally short. A middling quiz leans middling — any
       other tiebreak would need arguing about. */
    expect(levelCounts("normal", 10)).toEqual({ easy: 2, normal: 6, hard: 2 });
    expect(levelCounts("normal", 30)).toEqual({ easy: 7, normal: 16, hard: 7 });
  });

  it("makes two quizzes of the same level and length weigh the same", () => {
    /* THE WHOLE POINT. Points follow difficulty, and the mix is fixed:
       two middling quizzes of twenty are both worth forty, so two scores
       out of them are the same measurement. */
    for (const level of LEVELS) {
      for (const size of SIZES) {
        const counts = levelCounts(level, size);
        const weight = LEVELS.reduce((n, d) => n + counts[d] * POINTS[d], 0);
        expect(weight, `${level}/${size}`).toBe(
          LEVELS.reduce((n, d) => n + levelCounts(level, size)[d] * POINTS[d], 0)
        );
      }
    }
    expect(LEVELS.reduce((n, d) => n + levelCounts("normal", 20)[d] * POINTS[d], 0)).toBe(40);
  });
});

describe("the shares between categories", () => {
  it("splits evenly, and hands the remainder out one apiece", () => {
    expect([...categoryShares(["a", "b", "c"], 30).values()]).toEqual([10, 10, 10]);
    expect([...categoryShares(["a", "b", "c"], 20).values()]).toEqual([7, 7, 6]);
    expect([...categoryShares(["a"], 10).values()]).toEqual([10]);
  });
});

describe("a draw from a bank with plenty in it", () => {
  it("gives the length asked for, the mix asked for, and equal shares", () => {
    const plan = planDraw([deep("a"), deep("b")], "hard", 20);
    expect(plan.total).toBe(20);
    expect(plan.softened).toBe(false);
    expect(countOf(plan, "hard")).toBe(12);
    expect(countOf(plan, "normal")).toBe(6);
    expect(countOf(plan, "easy")).toBe(2);

    for (const id of ["a", "b"]) {
      const share = plan.cells.filter((c) => c.categoryId === id).reduce((n, c) => n + c.count, 0);
      expect(share, id).toBe(10);
    }
  });

  it("never asks for a question a category has not got", () => {
    const thin = [bank({ easy: 4, normal: 3, hard: 3 }, "a"), deep("b")];
    const plan = planDraw(thin, "normal", 10);
    for (const cell of plan.cells) {
      const held = thin.find((s) => s.categoryId === cell.categoryId)!.have[cell.difficulty];
      expect(cell.count, `${cell.categoryId}/${cell.difficulty}`).toBeLessThanOrEqual(held);
    }
  });
});

describe("a draw from a bank that is short", () => {
  it("fills up from the neighbouring level, and says it did", () => {
    /* Two hard questions where twelve are wanted: the ten missing come
       back as middling ones — the neighbour — and not as easy ones. */
    const plan = planDraw([bank({ easy: 50, normal: 50, hard: 2 })], "hard", 20);
    expect(plan.total).toBe(20);
    expect(plan.softened).toBe(true);
    expect(countOf(plan, "hard")).toBe(2);
    expect(countOf(plan, "normal")).toBe(16);
    expect(countOf(plan, "easy")).toBe(2);
  });

  it("does not cry softened when the mix came out exactly", () => {
    const plan = planDraw([bank({ easy: 2, normal: 6, hard: 2 })], "normal", 10);
    expect(plan.softened).toBe(false);
    expect(plan.total).toBe(10);
  });

  it("lets a starved category be carried by the others", () => {
    /* Equal shares are a preference, not a promise: `a` can only give
       three, so `b` gives seventeen rather than the quiz coming out
       three questions short. */
    const plan = planDraw([bank({ normal: 3 }, "a"), deep("b")], "normal", 20);
    expect(plan.total).toBe(20);
    const fromA = plan.cells.filter((c) => c.categoryId === "a").reduce((n, c) => n + c.count, 0);
    expect(fromA).toBe(3);
  });

  it("comes out short only when the whole bank is smaller than the quiz", () => {
    const plan = planDraw([bank({ easy: 3, normal: 1 })], "normal", 10);
    expect(plan.total).toBe(4);
    expect(plan.softened).toBe(true);
  });

  it("gives nothing at all out of an empty bank, without falling over", () => {
    expect(planDraw([], "normal", 10)).toEqual({ cells: [], total: 0, softened: false });
    expect(planDraw([bank({})], "normal", 10).total).toBe(0);
  });
});

describe("chance", () => {
  it("does not always hand the spare question to the same category", () => {
    /* The order is the caller's to shuffle, and the shares follow it.
       Without that, one basket would collect the odd question of every
       draw for ever. */
    const ids = ["a", "b", "c"];
    const first = categoryShares(ids, 20);
    const reversed = categoryShares([...ids].reverse(), 20);
    expect(first.get("a")).toBe(7);
    expect(reversed.get("a")).toBe(6);
  });

  it("takes the shuffle it is given", () => {
    const seen: string[] = [];
    planDraw([deep("a"), deep("b")], "normal", 10, (xs) => {
      seen.push("shuffled");
      return [...xs].reverse();
    });
    expect(seen).toEqual(["shuffled"]);
  });
});
