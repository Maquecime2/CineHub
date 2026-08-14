import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   THE TWO BOARDS

   A RANKING IS A PUBLICATION OF SOMEBODY'S NAME, so the question of who
   appears is settled before the question of who is winning. `person.
   ladder` carries that answer and nothing else does — deliberately not
   `sharing`, which answers "may my collection be read", a different
   sentence about a different thing.

   THREE THINGS ARE TRIED HERE, and each was got wrong in an easier
   version of these queries:

   - ONE ALWAYS SEES ONESELF. Even having asked to appear nowhere, even
     far below the fiftieth row. A board one cannot find oneself in is a
     board one closes.
   - A BLOCK WORKS BOTH WAYS. Declared on one side, it takes the two
     people out of each other's boards — as everywhere else in this
     server.
   - THE RANK IS THE REAL RANK. Computed in the window before the LIMIT,
     so a page of fifty does not renumber the world.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

/** Somebody with a purse, and a stated wish about being ranked. */
async function player(pseudo: string, merit: number, ladder = "tous") {
  const p = await store.createPerson(db, pseudo);
  await store.setLadder(db, p.id, ladder);
  if (merit > 0) await store.award(db, p.id, "quiz", `seed-${pseudo}`, merit);
  return p.id;
}

const names = (rows: { pseudo: string }[]) => rows.map((r) => r.pseudo);

describe("the world's board", () => {
  it("ranks those who asked to be on it", async () => {
    await player("varda", 300);
    await player("demy", 500);
    const me = await player("rohmer", 100);

    const board = await store.globalLadder(db, me);
    expect(names(board)).toEqual(["demy", "varda", "rohmer"]);
    expect(board.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(board.find((r) => r.me)?.pseudo).toBe("rohmer");
  });

  it("leaves out whoever did not ask", async () => {
    await player("discret", 900, "suivis");
    await player("secret", 800, "non");
    const me = await player("moi", 10);

    expect(names(await store.globalLadder(db, me))).toEqual(["moi"]);
  });

  it("still shows me myself when I appear nowhere", async () => {
    const me = await player("invisible", 42, "non");
    const board = await store.globalLadder(db, me);
    expect(names(board)).toEqual(["invisible"]);
    expect(board[0]!.me).toBe(true);
  });

  it("takes two blocked people out of each other's board, whichever declared it", async () => {
    const me = await player("moi", 100);
    const them = await player("eux", 900);
    await store.block(db, them, me); // THEY blocked ME

    expect(names(await store.globalLadder(db, me))).toEqual(["moi"]);
    expect(names(await store.globalLadder(db, them))).toEqual(["eux"]);
  });

  it("gives the real rank even when the page is short", async () => {
    for (let i = 0; i < 6; i++) await player(`joueur-${i}`, 100 * (i + 1));
    const me = await player("dernier", 5);

    const page = await store.globalLadder(db, me, 3);
    expect(page).toHaveLength(3);
    expect(page.map((r) => r.rank)).toEqual([1, 2, 3]);
    /* And off the page, the standing is still a true count. */
    expect(await store.myStanding(db, me)).toBe(7);
  });

  it("says nothing of people who have earned nothing", async () => {
    await store.createPerson(db, "passant");
    const me = await player("moi", 3);
    expect(names(await store.globalLadder(db, me))).toEqual(["moi"]);
  });
});

describe("the friends' board", () => {
  it("holds the people I follow, and me", async () => {
    const me = await player("moi", 50, "non");
    const suivi = await player("suivi", 400, "suivis");
    await player("inconnu", 900, "tous");
    await store.follow(db, me, suivi);

    expect(names(await store.friendsLadder(db, me))).toEqual(["suivi", "moi"]);
  });

  it("does not follow back on its own", async () => {
    /* The tie is one-way and stays so: somebody following me does not
       thereby appear on my board. No second table, and no pretending
       `follow` is a friendship. */
    const me = await player("moi", 50);
    const fan = await player("fan", 900);
    await store.follow(db, fan, me);

    expect(names(await store.friendsLadder(db, me))).toEqual(["moi"]);
  });

  it("respects somebody who asked to be ranked nowhere", async () => {
    const me = await player("moi", 50);
    const discret = await player("discret", 900, "non");
    await store.follow(db, me, discret);

    expect(names(await store.friendsLadder(db, me))).toEqual(["moi"]);
  });

  it("obeys a block over a follow", async () => {
    const me = await player("moi", 50);
    const them = await player("eux", 900);
    await store.follow(db, me, them);
    await store.block(db, me, them);

    expect(names(await store.friendsLadder(db, me))).toEqual(["moi"]);
  });
});
