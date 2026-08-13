import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   THE DECORATION OBJECTS, AND WHO MAY SEE THEM

   A decor is the only thing somebody uploads that another person may
   read. Everything else is guarded by the blob's path alone — one's own
   prefix, and nothing else — so the guard for THESE had to be written,
   and written where it cannot be gone round: in the store.

   Four things are tried, and the last two are the ones that would rot
   quietly if nobody looked:

   A BLOCK BEATS `is_public`. Somebody silenced does not come back in
   through the furniture.

   A COPY OUTLIVES A CHANGE OF MIND. Having taken a piece, one keeps it,
   even after its author has put it back to private — otherwise a shelf
   empties itself because somebody elsewhere hesitated.

   AND THE AUTHOR'S WITHDRAWAL IS A TOMBSTONE, not a deletion: erasing
   the row would cascade onto the copies and reach onto other people's
   walls.
   ============================================================ */

let db: Db;

const anna = async () => store.createPerson(db, "anna");
const bruno = async () => store.createPerson(db, "bruno");

beforeEach(async () => {
  db = await testDb();
});

afterEach(async () => {
  await db.close();
});

describe("the decoration objects", () => {
  it("refuses a piece with no name, or of an unknown kind", async () => {
    const a = await anna();
    await expect(store.createDecor(db, { ownerId: a.id, label: "   " })).rejects.toThrow();
    await expect(
      store.createDecor(db, { ownerId: a.id, label: "a lamp", kind: "gif" as never })
    ).rejects.toThrow();
  });

  it("goes with the person who made it", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });
    await store.editDecor(db, a.id, lamp.id, { is_public: true });
    await store.copyDecor(db, b.id, lamp.id);

    await store.deletePerson(db, a.id);
    expect(await store.decorById(db, lamp.id)).toBeNull();
    /* The copy goes with the original: the cascade is in the schema. */
    expect(await store.myDecor(db, b.id)).toEqual([]);
  });

  it("stays private by default, and invisible to others", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });

    expect(lamp.is_public).toBe(false);
    expect(await store.canReadDecor(db, a.id, lamp.id)).toBe(true);
    expect(await store.canReadDecor(db, b.id, lamp.id)).toBe(false);
    expect(await store.publicDecorOf(db, "anna")).toEqual([]);
  });

  it("shows itself to a follower once put on display", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });
    await store.editDecor(db, a.id, lamp.id, { is_public: true });
    await store.follow(db, b.id, a.id);

    expect(await store.canReadDecor(db, b.id, lamp.id)).toBe(true);
    expect((await store.sharedDecor(db, b.id)).map((d) => d.label)).toEqual(["a lamp"]);
    expect((await store.publicDecorOf(db, "anna", b.id)).map((d) => d.owner)).toEqual(["anna"]);
  });

  it("a block beats the display", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });
    await store.editDecor(db, a.id, lamp.id, { is_public: true });
    await store.follow(db, b.id, a.id);
    await store.block(db, b.id, a.id);

    expect(await store.canReadDecor(db, b.id, lamp.id)).toBe(false);
    expect(await store.sharedDecor(db, b.id)).toEqual([]);
    expect(await store.publicDecorOf(db, "anna", b.id)).toEqual([]);
    /* And the other way round too: blocking works in both directions. */
    expect(await store.canReadDecor(db, a.id, lamp.id)).toBe(true);
  });

  it("a copy survives a return to private", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });
    await store.editDecor(db, a.id, lamp.id, { is_public: true });
    expect(await store.copyDecor(db, b.id, lamp.id)).toBe(true);

    await store.editDecor(db, a.id, lamp.id, { is_public: false });
    expect(await store.canReadDecor(db, b.id, lamp.id)).toBe(true);
    expect((await store.myDecor(db, b.id)).map((d) => d.mine)).toEqual([false]);
  });

  it("is not copied without the right to read it", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });

    expect(await store.copyDecor(db, b.id, lamp.id)).toBe(false);
    expect(await store.myDecor(db, b.id)).toEqual([]);
  });

  it("the author's withdrawal does not take back what was given", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });
    await store.editDecor(db, a.id, lamp.id, { is_public: true });
    await store.copyDecor(db, b.id, lamp.id);

    expect(await store.deleteDecor(db, a.id, lamp.id)).toBe(true);
    /* The object has gone from both sides — that is what withdrawing
       means — but the ROW is still there: nothing cascaded onto the
       copies, and the blob stays readable while the client tidies its
       own copy away. */
    expect(await store.decorById(db, lamp.id)).toBeNull();
    expect(await store.myDecor(db, b.id)).toEqual([]);
    const left = await db.query("SELECT deleted FROM decor WHERE id = $1", [lamp.id]);
    expect(left).toHaveLength(1);
  });

  it("is neither edited nor withdrawn by somebody else", async () => {
    const a = await anna();
    const b = await bruno();
    const lamp = await store.createDecor(db, { ownerId: a.id, label: "a lamp" });
    await store.editDecor(db, a.id, lamp.id, { is_public: true });
    await store.copyDecor(db, b.id, lamp.id);

    expect(await store.editDecor(db, b.id, lamp.id, { label: "mine now" })).toBe(false);
    expect(await store.deleteDecor(db, b.id, lamp.id)).toBe(false);
    expect(await store.ownsDecor(db, b.id, lamp.id)).toBe(false);
    expect(await store.ownsDecor(db, a.id, lamp.id)).toBe(true);

    /* Giving back one's copy does not reach the original. */
    await store.dropDecorCopy(db, b.id, lamp.id);
    expect((await store.decorById(db, lamp.id))?.label).toBe("a lamp");
  });
});
