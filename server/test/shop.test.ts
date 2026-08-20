import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { draw } from "../src/shop.ts";
import type { DecorDef } from "../src/shop.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   THE COUNTER

   THE OVERDRAFT IS REFUSED BY THE TABLE, NOT BY A ROUTE. `purse` carries
   `CHECK (tokens >= 0)`, and a purchase is one statement: the spending
   row and the decrement go in together. So a purchase that cannot be
   afforded leaves NOTHING behind — not even a spending row for something
   never received. That last part is what is actually checked below,
   because it is the part a two-statement version would have got wrong
   while looking correct.

   THE CHANCE IS THE SERVER'S. A packet drawn in the browser would be
   reopened by reloading the page until it pleased. Here the object is in
   the database before the answer leaves.

   AND `draw` TAKES ITS GENERATOR AS AN ARGUMENT, which is the only way
   anything built on chance can be tested at all.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

/** Real randomness is not wanted in a test: this counts up instead. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

async function rich(pseudo: string, tokens: number) {
  const p = await store.createPerson(db, pseudo);
  if (tokens > 0) await store.award(db, p.id, "quiz", "seed", tokens);
  return p.id;
}

describe("buying", () => {
  it("takes the price, and leaves the merit alone", async () => {
    const me = await rich("varda", 100);
    const { purse } = await store.buy(db, me, "stamp-habitue", sequence(0));
    expect(purse).toEqual({ merit: 100, tokens: 60 });
    /* THE WHOLE POINT OF TWO COUNTERS: spending never costs a place. */
    expect((await store.globalLadder(db, me))[0]!.merit).toBe(100);
  });

  it("refuses an overdraft without leaving a trace of it", async () => {
    const me = await rich("demy", 10);
    await expect(store.buy(db, me, "stamp-habitue", sequence(0))).rejects.toThrow(
      store.ShopRefusal
    );
    expect(await store.purseOf(db, me)).toEqual({ merit: 10, tokens: 10 });
    /* And no spending row survives the refusal. A version that inserted
       first and decremented after would pass every other test here. */
    const spent = await db.query("SELECT 1 FROM token_spend WHERE person_id = $1", [me]);
    expect(spent).toHaveLength(0);
  });

  it("refuses somebody who has never earned anything", async () => {
    const p = await store.createPerson(db, "passant");
    await expect(store.buy(db, p.id, "stamp-habitue", sequence(0))).rejects.toThrow(
      store.ShopRefusal
    );
  });

  it("refuses to sell the same stamp twice", async () => {
    const me = await rich("rohmer", 200);
    await store.buy(db, me, "stamp-habitue", sequence(0));
    await expect(store.buy(db, me, "stamp-habitue", sequence(0))).rejects.toThrow(
      store.ShopRefusal
    );
    /* And the second refusal cost nothing. */
    expect((await store.purseOf(db, me)).tokens).toBe(160);
  });

  it("refuses an article that does not exist", async () => {
    const me = await rich("rivette", 500);
    await expect(store.buy(db, me, "stamp-inventé", sequence(0))).rejects.toThrow(
      store.ShopRefusal
    );
  });

  it("adds a power to the shelf, and stacks it", async () => {
    const me = await rich("akerman", 100);
    await store.buy(db, me, "power-halve", sequence(0));
    await store.buy(db, me, "power-halve", sequence(0));
    expect((await store.holdingsOf(db, me)).powers.halve).toBe(2);
  });
});

describe("une pochette", () => {
  /* UN OBJET, ET UN SEUL. Elle en rendait trois, réglables par pochette ;
     le produit a tranché pour un, toujours — d'où `DRAWS`, qui n'est plus
     une colonne. Les doubles restent possibles, et voulus. */
  it("rend un objet, et le compte", async () => {
    const me = await rich("denis", 100);
    const { drawn } = await store.buy(db, me, "pack-trois", sequence(0, 0));
    expect(drawn).toHaveLength(1);

    /* Deux fois la même pochette, sur un générateur qui dit toujours
       zéro : un double se compte, il ne se ravale pas. */
    await store.buy(db, me, "pack-trois", sequence(0, 0));
    const held = (await store.holdingsOf(db, me)).decors;
    expect(held).toHaveLength(1);
    expect(held[0]!.copies).toBe(2);
  });

  it("is already in the database when the answer leaves", async () => {
    const me = await rich("garrel", 100);
    const { drawn } = await store.buy(db, me, "pack-trois", sequence(0, 400));
    const rows = await db.query<{ decor_id: string }>(
      "SELECT decor_id FROM decor_won WHERE person_id = $1",
      [me]
    );
    expect(rows.map((r) => r.decor_id).sort()).toEqual([...new Set(drawn)].sort());
  });
});

describe("the draw", () => {
  /* LE BASSIN VIENT DE LA BASE MAINTENANT, et ces épreuves le lisent là
     plutôt que d'en garder une copie : une liste recopiée dans un test
     est une liste qui finit par décrire un stock qui n'existe plus. Les
     onze objets d'origine sont posés par `002_collection.sql`. */
  let stock: DecorDef[];
  beforeEach(async () => {
    stock = await store.listDecors(db, "pack-trois");
  });

  it("follows the rarities it announces", async () => {
    const rarityOf = (id: string) => stock.find((s) => s.id === id)!.rarity;
    expect(rarityOf(draw(sequence(0, 0), 1, stock)[0]!)).toBe("common");
    expect(rarityOf(draw(sequence(800, 0), 1, stock)[0]!)).toBe("rare");
    expect(rarityOf(draw(sequence(999, 0), 1, stock)[0]!)).toBe("gold");
  });

  /* UNE POCHETTE PEUT ÊTRE VIDE, ce qui n'était pas possible quand les
     objets étaient en dur. Elle ne doit pas lever : les jetons sont
     déjà partis quand `draw` s'exécute. */
  it("rend un paquet vide plutôt qu'une exception, sur une pochette vide", () => {
    expect(draw(sequence(0, 0), 3, [])).toEqual([]);
  });

  /* Et un bassin absent redescend vers ce qui existe, au lieu de tirer
     dans le vide : une pochette sans objet doré est légitime. */
  it("retombe sur un bassin qui existe", async () => {
    const common = stock.filter((s) => s.rarity === "common");
    expect(draw(sequence(999, 0), 1, common)[0]).toBe(common[0]!.id);
  });

  it("never falls off the end of a pool", async () => {
    /* Two ways of falling off, and both were real.

       A roll of exactly the last threshold finds no band at all under a
       strict `<`, and reaches for `undefined.rarity`.

       And an index past the end of the pool: `rng` is asked for a number
       below the bound, but it is somebody else's function, and by the
       time `draw` runs the tokens have ALREADY gone. Throwing here would
       mean somebody paid for an exception. */
    expect(draw(sequence(1000, 0), 1, stock)).toHaveLength(1);
    expect(draw(sequence(0, 9999), 1, stock)).toHaveLength(1);
    expect(draw(sequence(0, -3), 1, stock)).toHaveLength(1);
  });
});

describe("wearing", () => {
  it("refuses what one does not own", async () => {
    const me = await rich("breillat", 100);
    expect(await store.wear(db, me, "stamp", "stamp-projectionniste")).toBe(false);
    expect((await store.holdingsOf(db, me)).worn.stamp).toBeNull();
  });

  it("accepts what one bought, and lets it be taken off", async () => {
    const me = await rich("pialat", 100);
    await store.buy(db, me, "stamp-habitue", sequence(0));
    expect(await store.wear(db, me, "stamp", "stamp-habitue")).toBe(true);
    expect((await store.holdingsOf(db, me)).worn.stamp).toBe("stamp-habitue");

    expect(await store.wear(db, me, "stamp", null)).toBe(true);
    expect((await store.holdingsOf(db, me)).worn.stamp).toBeNull();
  });

  it("shows the worn stamp on the board", async () => {
    const me = await rich("guiraudie", 100);
    await store.buy(db, me, "stamp-habitue", sequence(0));
    await store.wear(db, me, "stamp", "stamp-habitue");
    expect((await store.globalLadder(db, me))[0]!.stamp).toBe("stamp-habitue");
  });
});
