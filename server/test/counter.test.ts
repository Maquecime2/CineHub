import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE COUNTER, THROUGH ITS DOORS

   The store's own tests prove the guarantees. These prove the ROUTES
   carry them: that the refusals come back as codes a client can read,
   that the credit really happens where the gesture happens, and — the
   one worth writing at all — that a card synchronised twice does not pay
   twice through the door either.

   AND THAT NOTHING HERE IS REACHABLE WITHOUT AN ACCOUNT. The binder
   hides this whole tab in that case, but a hidden tab is a drawing
   decision; the refusal has to be real.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});
afterEach(async () => {
  await app.close();
  await db.close();
});

async function count(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const get = (url: string, cookie?: string) =>
  app.inject({ method: "GET", url, headers: cookie ? { cookie } : {} });

describe("without an account", () => {
  it("refuses every door of the counter", async () => {
    for (const url of ["/purse", "/ladder/world", "/ladder/friends", "/shop", "/shop/mine"]) {
      expect((await get(url)).statusCode, url).toBe(401);
    }
    const bought = await app.inject({
      method: "POST",
      url: "/shop/buy",
      payload: { item: "stamp-habitue" },
    });
    expect(bought.statusCode).toBe(401);
  });
});

describe("the purse", () => {
  it("starts empty rather than failing", async () => {
    const me = await count("varda");
    const r = await get("/purse", me.cookie);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ merit: 0, tokens: 0, ladder: "suivis" });
  });

  it("says which board one has agreed to appear on, and lets it change", async () => {
    const me = await count("demy");
    const set = await app.inject({
      method: "PATCH",
      url: "/ladder/mine",
      headers: { cookie: me.cookie },
      payload: { ladder: "tous" },
    });
    expect(set.statusCode).toBe(200);
    expect((await get("/purse", me.cookie)).json().ladder).toBe("tous");
  });

  it("refuses a wish it does not understand", async () => {
    const me = await count("rohmer");
    const bad = await app.inject({
      method: "PATCH",
      url: "/ladder/mine",
      headers: { cookie: me.cookie },
      payload: { ladder: "public" },
    });
    expect(bad.statusCode).toBe(400);
  });
});

describe("a collection pushed up", () => {
  const push = (cookie: string, cards: unknown[]) =>
    app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { cards } });

  it("pays for what it says, once", async () => {
    const me = await count("akerman");
    const card = [
      {
        id: "c1",
        tmdbId: 4242,
        updatedAt: 1,
        data: { watches: [{ date: "2026-03-02" }], rating: 4 },
      },
    ];
    await push(me.cookie, card);
    expect((await get("/purse", me.cookie)).json().merit).toBe(2);

    /* THE SAME PUSH AGAIN — which is what every start-up does. It must
       add nothing at all, or the ranking measures how often one opens
       the application. */
    await push(me.cookie, [{ ...card[0], updatedAt: 2 }]);
    expect((await get("/purse", me.cookie)).json().merit).toBe(2);
  });

  it("files the card even when the counter is unhappy", async () => {
    /* The ledger is never on the way of the gesture: a card whose data
       makes no sense at all still lands. */
    const me = await count("denis");
    const r = await push(me.cookie, [
      { id: "c2", tmdbId: 7, updatedAt: 1, data: { watches: "pas un tableau" } },
    ]);
    expect(r.statusCode).toBe(200);
    expect(r.json().filed).toBe(1);
  });
});

describe("the shop", () => {
  async function rich(pseudo: string, tokens: number) {
    const me = await count(pseudo);
    await store.award(db, me.person.id, "quiz", "seed", tokens);
    return me;
  }
  const buy = (cookie: string, item: string) =>
    app.inject({ method: "POST", url: "/shop/buy", headers: { cookie }, payload: { item } });

  it("shows the catalogue, and what one already holds", async () => {
    const me = await rich("rivette", 100);
    await buy(me.cookie, "stamp-habitue");
    const items = (await get("/shop", me.cookie)).json().items;
    expect(items.find((i: { id: string }) => i.id === "stamp-habitue").owned).toBe(true);
    expect(items.find((i: { id: string }) => i.id === "stamp-noctambule").owned).toBe(false);
  });

  it("answers a refusal with a sentence and a code, not a stack trace", async () => {
    const me = await rich("pauvre", 5);
    const r = await buy(me.cookie, "stamp-habitue");
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/jetons/);
  });

  it("refuses to wear what one does not own", async () => {
    const me = await rich("breillat", 100);
    const r = await app.inject({
      method: "PATCH",
      url: "/shop/worn",
      headers: { cookie: me.cookie },
      payload: { stamp: "stamp-projectionniste" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("lets one wear what one bought", async () => {
    const me = await rich("pialat", 100);
    await buy(me.cookie, "stamp-habitue");
    const r = await app.inject({
      method: "PATCH",
      url: "/shop/worn",
      headers: { cookie: me.cookie },
      payload: { stamp: "stamp-habitue" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().stamp).toBe("stamp-habitue");
  });
});

describe("a power on a question", () => {
  it("is refused with 402 to whoever has not bought it", async () => {
    const me = await count("garrel");
    const cat = await store.createCategory(db, { label: "réalisation" });
    for (let i = 0; i < 10; i++) {
      const q = await store.addBankQuestion(db, cat, { ask: `q${i}` });
      await store.setChoices(db, q, [
        { label: "oui", is_right: true },
        { label: "non", is_right: false },
      ]);
    }
    const quiz = await store.drawQuiz(db, me.person.id, {
      title: "partie",
      categoryIds: [cat],
      level: "normal",
      size: 10,
    });
    await store.startAttempt(db, quiz.id, me.person.id);
    const drawn = await db.query<{ question_id: string }>(
      "SELECT question_id FROM quiz_draw WHERE quiz_id = $1 LIMIT 1",
      [quiz.id]
    );

    const r = await app.inject({
      method: "POST",
      url: `/quizzes/${quiz.id}/questions/${drawn[0]!.question_id}/halve`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(402);
  });
});

describe("pushing a challenge back", () => {
  it("gives the power back when the push is refused", async () => {
    /* All five limits live in one statement, so the only way to know is
       to try — and trying must not cost thirty tokens. */
    const me = await count("organisatrice");
    const list = await store.createList(db, me.person.id, { title: "mars" });
    const challenge = await store.createChallenge(db, me.person.id, {
      listId: list,
      title: "fini depuis longtemps",
      starts_on: "2020-01-01",
      ends_on: "2020-02-01",
    });
    await store.givePower(db, me.person.id, "extend");

    const r = await app.inject({
      method: "POST",
      url: `/challenges/${challenge}/extend`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(409);
    expect((await store.holdingsOf(db, me.person.id)).powers.extend).toBe(1);
  });
});
