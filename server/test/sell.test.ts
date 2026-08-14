import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   RENDRE UN ARTICLE

   Un outil réservé au rôle, pour reprendre la boutique article par
   article. Ce qu'on éprouve ici :

   LA BOURSE RESTE ÉGALE AU JOURNAL. C'est l'invariant que `points.test`
   vérifie ailleurs, et le seul qu'une revente pouvait casser en silence
   — recréditer sans effacer la dépense aurait laissé un chiffre juste à
   l'œil et faux au comptage.

   ET LE CHEMIN D'ACHAT N'EST PAS TOUCHÉ : après avoir rendu, on rachète
   par la vraie porte, refus du doublon compris.
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

async function boss(pseudo = "maquecime", tokens = 1000) {
  const person = await store.createPerson(db, pseudo);
  await store.markAdmins(db, [pseudo]);
  await store.award(db, person.id, "quiz", "seed", tokens);
  const secret = await store.openSession(db, person.id);
  return { id: person.id, cookie: `session=${secret}` };
}

/** La bourse recalculée depuis les deux journaux. */
async function fromJournals(personId: string) {
  const r = await db.query<{ tokens: number }>(
    `SELECT (coalesce((SELECT sum(tokens) FROM merit_event WHERE person_id = $1), 0)
           - coalesce((SELECT sum(tokens) FROM token_spend WHERE person_id = $1), 0))::int
             AS tokens`,
    [personId]
  );
  return r[0]!.tokens;
}

describe("rendre un article", () => {
  it("rembourse, et laisse la bourse égale au journal", async () => {
    const me = await boss();
    await store.buy(db, me.id, "stamp-habitue", () => 0);
    expect((await store.purseOf(db, me.id)).tokens).toBe(960);

    expect(await store.sell(db, me.id, "stamp-habitue")).toMatchObject({ tokens: 1000 });
    /* LE POINT DU FICHIER : la ligne de dépense a disparu avec. */
    expect(await fromJournals(me.id)).toBe(1000);
    expect((await store.purseOf(db, me.id)).tokens).toBe(await fromJournals(me.id));
  });

  it("laisse le mérite tranquille", async () => {
    const me = await boss();
    await store.buy(db, me.id, "stamp-habitue", () => 0);
    await store.sell(db, me.id, "stamp-habitue");
    expect((await store.purseOf(db, me.id)).merit).toBe(1000);
  });

  it("rend l'article rachetable par la vraie porte", async () => {
    const me = await boss();
    await store.buy(db, me.id, "stamp-habitue", () => 0);
    await expect(store.buy(db, me.id, "stamp-habitue", () => 0)).rejects.toThrow();
    await store.sell(db, me.id, "stamp-habitue");
    await expect(store.buy(db, me.id, "stamp-habitue", () => 0)).resolves.toBeTruthy();
  });

  it("retire ce qu'on portait", async () => {
    const me = await boss();
    await store.buy(db, me.id, "stamp-habitue", () => 0);
    await store.wear(db, me.id, "stamp", "stamp-habitue");
    await store.sell(db, me.id, "stamp-habitue");
    expect((await store.holdingsOf(db, me.id)).worn.stamp).toBeNull();
  });

  it("reprend un pouvoir, un seul à la fois", async () => {
    const me = await boss();
    await store.buy(db, me.id, "power-halve", () => 0);
    await store.buy(db, me.id, "power-halve", () => 0);
    await store.sell(db, me.id, "power-halve");
    expect((await store.holdingsOf(db, me.id)).powers.halve).toBe(1);
    expect((await store.purseOf(db, me.id)).tokens).toBe(await fromJournals(me.id));
  });

  it("refuse ce qu'on n'a pas payé", async () => {
    const me = await boss();
    expect(await store.sell(db, me.id, "stamp-habitue")).toBe("not-owned");
    expect(await store.sell(db, me.id, "article-qui-n-existe-pas")).toBe("not-owned");
    expect((await store.purseOf(db, me.id)).tokens).toBe(1000);
  });

  it("rembourse le prix PAYÉ, pas le prix affiché", async () => {
    /* Un article dont le tarif monte entre-temps ne doit pas devenir une
       façon de gagner des jetons. Le journal fait foi. */
    const me = await boss();
    await store.buy(db, me.id, "stamp-habitue", () => 0);
    await db.query("UPDATE token_spend SET tokens = 5 WHERE person_id = $1", [me.id]);
    await db.query("UPDATE purse SET tokens = 995 WHERE person_id = $1", [me.id]);
    expect(await store.sell(db, me.id, "stamp-habitue")).toMatchObject({ tokens: 1000 });
  });
});

describe("la route", () => {
  const sell = (cookie: string, item: string) =>
    app.inject({ method: "POST", url: "/shop/sell", headers: { cookie }, payload: { item } });

  it("est réservée au rôle", async () => {
    const me = await boss();
    const person = await store.createPerson(db, "quidam");
    await store.award(db, person.id, "quiz", "seed", 1000);
    const secret = await store.openSession(db, person.id);
    await store.buy(db, person.id, "stamp-habitue", () => 0);

    expect((await sell(`session=${secret}`, "stamp-habitue")).statusCode).toBe(403);
    /* Et le refus n'a rien rendu. */
    expect((await store.holdingsOf(db, person.id)).items).toContain("stamp-habitue");
    expect(me.id).toBeTruthy();
  });

  it("répond une phrase quand il n'y a rien à rendre", async () => {
    const me = await boss();
    const r = await sell(me.cookie, "stamp-habitue");
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toMatch(/acheté/);
  });
});

describe("repartir de zéro", () => {
  const wipe = (cookie: string) =>
    app.inject({ method: "DELETE", url: "/shop/mine", headers: { cookie } });

  it("efface tout le comptoir, et rend les faits repayables", async () => {
    const me = await boss();
    await store.buy(db, me.id, "stamp-habitue", () => 0);
    await store.buy(db, me.id, "pack-trois", () => 0);
    await store.wear(db, me.id, "stamp", "stamp-habitue");

    expect((await wipe(me.cookie)).json()).toMatchObject({ merit: 0, tokens: 0 });
    expect(await store.purseOf(db, me.id)).toEqual({ merit: 0, tokens: 0 });

    const held = await store.holdingsOf(db, me.id);
    expect(held.items).toEqual([]);
    expect(held.stickers).toEqual([]);
    expect(held.worn.stamp).toBeNull();

    /* LE POINT : le journal part aussi, sinon on repart de zéro sans
       pouvoir regagner quoi que ce soit — ce qui n'est pas repartir. */
    expect(await store.award(db, me.id, "quiz", "seed", 1000)).toBe(1000);
  });

  it("ne touche à rien d'autre que le comptoir", async () => {
    const me = await boss();
    const list = await store.createList(db, me.id, { title: "mars" });
    const other = await store.createPerson(db, "amie");
    await store.follow(db, me.id, other.id);

    await wipe(me.cookie);

    expect(await store.myLists(db, me.id)).toHaveLength(1);
    expect(await store.subscriptionsOf(db, me.id)).toHaveLength(1);
    expect(list).toBeTruthy();
  });

  it("n'efface que le sien", async () => {
    const me = await boss();
    const other = await store.createPerson(db, "amie");
    await store.award(db, other.id, "quiz", "seed", 300);

    await wipe(me.cookie);
    expect((await store.purseOf(db, other.id)).merit).toBe(300);
  });

  it("demande un compte", async () => {
    expect((await app.inject({ method: "DELETE", url: "/shop/mine" })).statusCode).toBe(401);
  });
});
