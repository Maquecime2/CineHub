import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { DECLARED_CEILING, RATE } from "../src/points.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   THE MERIT, AND WHAT KEEPS IT FROM BEING FICTION

   Three promises are tried here, and all three are kept by the SCHEMA
   rather than by the code that calls it — which is the only reason they
   can be trusted from every route at once.

   ONE FACT PAYS ONCE. The journal is unique on (person, kind, ref), so a
   double click, a retried request or a page opened twice credit nothing
   the second time. That is tested by doing exactly that.

   THE PURSE IS ALWAYS THE JOURNAL'S SUM. It is a cache, and a cache that
   drifts is worse than no cache: the figure on the screen would be
   nobody's.

   AND WHAT ONE MERELY DECLARES IS CAPPED BY THE DAY. A card is written
   by the client and the server cannot tell a real evening from a made-up
   one; the ceiling is what makes lying tedious rather than profitable.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

const someone = async (pseudo: string) => (await store.createPerson(db, pseudo)).id;

/** What the journal says, added up — the figure the purse must match. */
async function journal(personId: string) {
  const rows = await db.query<{ merit: number; tokens: number }>(
    `SELECT coalesce(sum(merit), 0)::int AS merit,
            (coalesce(sum(tokens), 0)
             - coalesce((SELECT sum(tokens) FROM token_spend WHERE person_id = $1), 0))::int
              AS tokens
       FROM merit_event WHERE person_id = $1`,
    [personId]
  );
  return rows[0]!;
}

describe("a gain", () => {
  it("credits both counters at once", async () => {
    const me = await someone("varda");
    expect(await store.award(db, me, "list_shared", "l1", RATE.list_shared)).toBe(5);
    expect(await store.purseOf(db, me)).toEqual({ merit: 5, tokens: 5 });
  });

  it("pays once for the same fact, however often it is asked", async () => {
    const me = await someone("demy");
    expect(await store.award(db, me, "challenge", "e1", 30)).toBe(30);
    expect(await store.award(db, me, "challenge", "e1", 30)).toBe(0);
    expect(await store.award(db, me, "challenge", "e1", 30)).toBe(0);
    expect((await store.purseOf(db, me)).merit).toBe(30);
  });

  it("tells the same fact from another one by its reference", async () => {
    const me = await someone("rohmer");
    await store.award(db, me, "watch", "42:2026-03-01", 1);
    await store.award(db, me, "watch", "42:2026-03-02", 1);
    /* The same film, another evening: a second gain. The same evening
       again: nothing. */
    await store.award(db, me, "watch", "42:2026-03-02", 1);
    expect((await store.purseOf(db, me)).merit).toBe(2);
  });

  it("leaves the purse equal to the journal, whatever the run", async () => {
    const me = await someone("rivette");
    await store.award(db, me, "quiz", "q1", 18);
    await store.award(db, me, "quiz_flawless", "q1", 15);
    await store.award(db, me, "quiz", "q1", 18); // refused
    await store.award(db, me, "review", "77", 3);
    expect(await store.purseOf(db, me)).toEqual(await journal(me));
  });
});

describe("what one merely declares", () => {
  it("stops paying past the day's ceiling", async () => {
    const me = await someone("akerman");
    /* Fifty screenings claimed on the same day. */
    let credited = 0;
    for (let i = 0; i < 50; i++) {
      credited += await store.award(db, me, "watch", `${i}:2026-03-01`, 1);
    }
    expect(credited).toBe(DECLARED_CEILING);
    expect((await store.purseOf(db, me)).merit).toBe(DECLARED_CEILING);
  });

  it("does not cap what the server itself witnessed", async () => {
    const me = await someone("guiraudie");
    for (let i = 0; i < 50; i++) await store.award(db, me, "watch", `${i}:2026-03-01`, 1);
    /* The ceiling is full — and a quiz, which the server scored itself,
       still pays. Otherwise a busy afternoon of filing would silently
       cost somebody their evening's game. */
    expect(await store.award(db, me, "quiz", "q9", 22)).toBe(22);
  });
});

describe("a card, priced", () => {
  it("pays a screening a day, a review and a rating once each", async () => {
    const me = await someone("denis");
    const card = {
      tmdb_id: "1234",
      data: {
        watches: [{ date: "2026-03-01T21:00:00Z" }, { date: "2026-03-04" }],
        rating: 4,
        review: "x".repeat(200),
      },
    };
    expect(await store.awardFromCard(db, me, card)).toBe(
      RATE.watch * 2 + RATE.review + RATE.rating
    );
    /* Synchronising the same card again — which happens at every start —
       must add nothing at all. */
    expect(await store.awardFromCard(db, me, card)).toBe(0);
  });

  it("ignores a review too short to be one", async () => {
    const me = await someone("breillat");
    await store.awardFromCard(db, me, { tmdb_id: "9", data: { review: "bien" } });
    expect((await store.purseOf(db, me)).merit).toBe(0);
  });

  it("survives a card from before the screening log", async () => {
    const me = await someone("pialat");
    /* `watches` did not always exist, and an old card carries a single
       date. Ignoring it would tell somebody they never saw the film. */
    await store.awardFromCard(db, me, { tmdb_id: "5", data: { watchedAt: "2019-06-02" } });
    expect((await store.purseOf(db, me)).merit).toBe(1);
  });

  it("says nothing of a card that claims nothing", async () => {
    const me = await someone("garrel");
    expect(await store.awardFromCard(db, me, { tmdb_id: "3", data: {} })).toBe(0);
    expect(await store.awardFromCard(db, me, { tmdb_id: null, data: { rating: 5 } })).toBe(0);
  });
});

/* ------------------------------------------------------------
   THE TWO THINGS THE SERVER SCORED ITSELF
   ------------------------------------------------------------ */

/** A bank of ten, a quiz drawn from it, and the answers all right. */
async function quizPlayedBy(pseudo: string, rightAnswers: number) {
  const cat = await store.createCategory(db, { label: `cat-${pseudo}` });
  for (let i = 0; i < 10; i++) {
    const q = await store.addBankQuestion(db, cat, { ask: `q${i}`, difficulty: "easy" });
    await store.setChoices(db, q, [
      { label: "oui", is_right: true },
      { label: "non", is_right: false },
    ]);
  }
  const me = await store.createPerson(db, pseudo);
  const quiz = await store.drawQuiz(db, me.id, {
    title: "partie",
    categoryIds: [cat],
    level: "easy",
    size: 10,
  });
  await store.startAttempt(db, quiz.id, me.id);

  const drawn = await db.query<{ question_id: string }>(
    "SELECT question_id FROM quiz_draw WHERE quiz_id = $1 ORDER BY rank",
    [quiz.id]
  );
  for (const [i, d] of drawn.entries()) {
    const c = await db.query<{ id: string }>(
      "SELECT id FROM quiz_choice WHERE question_id = $1 AND is_right = $2 LIMIT 1",
      [d.question_id, i < rightAnswers]
    );
    await store.answer(db, quiz.id, me.id, d.question_id, c[0]!.id);
  }
  await store.finishAttempt(db, quiz.id, me.id);
  return { me: me.id, quiz: quiz.id };
}

describe("a quiz, once finished", () => {
  it("pays the score, and the flawless run on top", async () => {
    const g = await quizPlayedBy("chantal", 10);
    const gains = await store.awardQuiz(db, g.quiz, g.me);
    expect(gains.map((x) => x.kind)).toEqual(["quiz", "quiz_flawless"]);
    /* Ten easy questions, one point each. */
    expect(gains[0]!.amount).toBe(10);
    expect((await store.purseOf(db, g.me)).merit).toBe(10 + RATE.quiz_flawless);
  });

  it("pays nothing extra for a run that was not flawless", async () => {
    const g = await quizPlayedBy("jean", 7);
    const gains = await store.awardQuiz(db, g.quiz, g.me);
    expect(gains.map((x) => x.kind)).toEqual(["quiz"]);
    expect((await store.purseOf(db, g.me)).merit).toBe(7);
  });

  it("does not pay for being first when nobody else was playing", async () => {
    const g = await quizPlayedBy("seule", 10);
    const gains = await store.awardQuiz(db, g.quiz, g.me);
    expect(gains.map((x) => x.kind)).not.toContain("quiz_first");
  });

  it("credits once, however many times finishing is asked for", async () => {
    const g = await quizPlayedBy("double", 10);
    await store.awardQuiz(db, g.quiz, g.me);
    const again = await store.awardQuiz(db, g.quiz, g.me);
    expect(again).toEqual([]);
    expect((await store.purseOf(db, g.me)).merit).toBe(10 + RATE.quiz_flawless);
  });
});

describe("a challenge, once its period is over", () => {
  /** A list of `works` films, a finished challenge, and one participant. */
  async function finished(pseudo: string, works: number, seen: number) {
    const me = await store.createPerson(db, pseudo);
    const list = await store.createList(db, me.id, { title: "mars" });
    for (let i = 0; i < works; i++) {
      await store.addToList(db, list, me.id, { tmdbId: String(1000 + i), title: `film ${i}` });
      if (i < seen) {
        await store.storeCard(db, me.id, {
          id: `c${i}`,
          tmdbId: String(1000 + i),
          data: { watches: [{ date: "2026-03-04" }] },
          updatedAt: new Date(1),
        });
      }
    }
    const e = await store.createChallenge(db, me.id, {
      listId: list,
      title: "le défi",
      starts_on: "2026-03-01",
      ends_on: "2026-03-31",
    });
    return { me: me.id, challenge: e };
  }

  it("pays whoever went the whole way", async () => {
    const g = await finished("complete", 4, 4);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });

  it("pays half a way, less", async () => {
    const g = await finished("moitie", 4, 2);
    await store.settleChallenge(db, g.challenge);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge_half);
  });

  it("pays nothing for barely starting", async () => {
    const g = await finished("apeine", 4, 1);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
    expect((await store.purseOf(db, g.me)).merit).toBe(0);
  });

  it("pays nothing for a challenge on an empty list", async () => {
    /* Everybody has "finished" a list of no films, and it would have
       been the cheapest merit going. */
    const g = await finished("vide", 0, 0);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
  });

  it("is settled by the first to look, and by nobody after", async () => {
    const g = await finished("premiere", 4, 4);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });
});
