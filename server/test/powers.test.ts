import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   THE POWERS, AND THE HOLE THEY WOULD HAVE OPENED

   "Remove two wrong answers" is the only thing in this server that
   touches `is_right` before an attempt is closed. Left to itself it is
   an oracle: ask it again and again on the same question and it hands
   back two OTHERS each time, until only the right one is left. One pays
   fifteen tokens and reads the answer.

   `quiz_help`'s primary key is what shuts that: the second call returns
   THE SAME PAIR and charges nothing. That is the first test below, and
   it is the reason the table exists at all.

   The rest is bookkeeping that a route would have got wrong: help on a
   finished attempt, a power one does not hold, a challenge extended by
   somebody who did not start it, and — the one always forgotten — a
   challenge extended AFTER it has been paid out.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

/** A bank, a quiz drawn from it, and somebody in the middle of playing. */
async function playing(pseudo = "varda") {
  const cat = await store.createCategory(db, { label: "réalisation" });

  /* Ten questions, because a quiz of ten is the smallest the schema
     accepts and a thinner bank comes back "softened". */
  let first = "";
  for (let i = 0; i < 10; i++) {
    const q = await store.addBankQuestion(db, cat, {
      ask: `Qui a réalisé le film n° ${i} ?`,
      difficulty: "normal",
    });
    await store.setChoices(db, q, [
      { label: "Agnès Varda", is_right: true },
      { label: "Jacques Demy", is_right: false },
      { label: "Alain Resnais", is_right: false },
      { label: "Chris Marker", is_right: false },
    ]);
    if (i === 0) first = q;
  }

  const me = await store.createPerson(db, pseudo);
  const quiz = await store.drawQuiz(db, me.id, {
    title: "samedi",
    categoryIds: [cat],
    level: "normal",
    size: 10,
  });
  await store.startAttempt(db, quiz.id, me.id);
  return { me: me.id, quiz: quiz.id, question: first };
}

/** Give somebody a power without making them pay for it. */
const grant = (personId: string, kind: string, n = 1) =>
  db.query(
    `INSERT INTO power (person_id, kind, left_over) VALUES ($1, $2, $3)
     ON CONFLICT (person_id, kind) DO UPDATE SET left_over = power.left_over + $3`,
    [personId, kind, n]
  );

describe("removing two wrong answers", () => {
  it("hands back the same two, however often it is asked", async () => {
    const g = await playing();
    await grant(g.me, "halve", 5);

    const first = await store.halveFor(db, g.quiz, g.me, g.question);
    const again = await store.halveFor(db, g.quiz, g.me, g.question);
    expect(first).not.toBe("no-power");
    expect(again).toEqual(first);

    /* AND ASKING AGAIN COST NOTHING. Without this, one pays once and
       peels the question bare by repeating the request. */
    expect((await store.holdingsOf(db, g.me)).powers.halve).toBe(4);
  });

  it("never gives away the right answer", async () => {
    const g = await playing();
    await grant(g.me, "halve");
    const got = await store.halveFor(db, g.quiz, g.me, g.question);
    expect(got).not.toBe("no-power");

    const removed = (got as { removed: string[] }).removed;
    expect(removed).toHaveLength(2);
    const right = await db.query<{ id: string }>(
      "SELECT id FROM quiz_choice WHERE question_id = $1 AND is_right",
      [g.question]
    );
    expect(removed).not.toContain(right[0]!.id);
  });

  it("refuses whoever holds no such power", async () => {
    const g = await playing();
    expect(await store.halveFor(db, g.quiz, g.me, g.question)).toBe("no-power");
  });

  it("refuses on an attempt already closed", async () => {
    const g = await playing();
    await grant(g.me, "halve");
    await store.finishAttempt(db, g.quiz, g.me);
    expect(await store.halveFor(db, g.quiz, g.me, g.question)).toBe("closed");
    /* And the refusal did not take the power. */
    expect((await store.holdingsOf(db, g.me)).powers.halve).toBe(1);
  });
});

describe("taking an answer back", () => {
  it("clears the answer and leaves the mark", async () => {
    const g = await playing();
    await grant(g.me, "redo");
    const choice = await db.query<{ id: string }>(
      "SELECT id FROM quiz_choice WHERE question_id = $1 AND NOT is_right LIMIT 1",
      [g.question]
    );
    await store.answer(db, g.quiz, g.me, g.question, choice[0]!.id);

    expect(await store.redoAnswer(db, g.quiz, g.me, g.question)).toBe("done");
    const left = await db.query("SELECT 1 FROM quiz_answer WHERE quiz_id = $1 AND person_id = $2", [
      g.quiz,
      g.me,
    ]);
    expect(left).toHaveLength(0);

    /* The mark stays: a question one has had a second go at must not
       look, to the other players, like one got right first time. */
    const marks = await store.helpOf(db, g.quiz, g.me);
    expect(marks.map((m) => m.kind)).toContain("redo");
  });

  it("may not be used twice on the same question", async () => {
    const g = await playing();
    await grant(g.me, "redo", 3);
    await store.redoAnswer(db, g.quiz, g.me, g.question);
    expect(await store.redoAnswer(db, g.quiz, g.me, g.question)).toBe("already");
    expect((await store.holdingsOf(db, g.me)).powers.redo).toBe(2);
  });

  it("refuses once the attempt is finished", async () => {
    const g = await playing();
    await grant(g.me, "redo");
    await store.finishAttempt(db, g.quiz, g.me);
    expect(await store.redoAnswer(db, g.quiz, g.me, g.question)).toBe("closed");
  });
});

describe("pushing a challenge back", () => {
  let n = 0;
  async function ending(days: number) {
    const me = await store.createPerson(db, `organisatrice-${n++}`);
    const list = await store.createList(db, me.id, { title: "mars" });
    const day = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const e = await store.createChallenge(db, me.id, {
      listId: list,
      title: "le défi",
      starts_on: day(-30),
      ends_on: day(days),
    });
    return { me: me.id, challenge: e };
  }

  it("adds a week, twice at most", async () => {
    const g = await ending(1);
    expect(await store.extendChallenge(db, g.challenge, g.me)).toMatchObject({ extensions: 1 });
    expect(await store.extendChallenge(db, g.challenge, g.me)).toMatchObject({ extensions: 2 });
    expect(await store.extendChallenge(db, g.challenge, g.me)).toBeNull();
  });

  it("belongs to whoever started it", async () => {
    const g = await ending(1);
    const other = await store.createPerson(db, "quelquun");
    expect(await store.extendChallenge(db, g.challenge, other.id)).toBeNull();
  });

  it("pushes back, it does not resurrect", async () => {
    const long = await ending(-30);
    expect(await store.extendChallenge(db, long.challenge, long.me)).toBeNull();
    /* A week over, on the other hand, is still within reach. */
    const near = await ending(-3);
    expect(await store.extendChallenge(db, near.challenge, near.me)).not.toBeNull();
  });

  it("refuses once the accounts are closed", async () => {
    /* THE LIMIT ONE FORGETS. The journal would refuse to pay a second
       time anyway — but the board would be left describing a period
       nobody was actually measured over. */
    const g = await ending(-1);
    await store.joinChallenge(db, g.challenge, g.me);
    await store.award(db, g.me, "challenge", g.challenge, 30);
    expect(await store.extendChallenge(db, g.challenge, g.me)).toBeNull();
  });
});
