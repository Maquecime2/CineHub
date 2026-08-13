import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   LES OBJETS DE DÉCORATION, ET QUI PEUT LES VOIR

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

describe("les décors", () => {
  it("refuse une pièce sans nom, ou d'une espèce inconnue", async () => {
    const a = await anna();
    await expect(store.createDecor(db, { ownerId: a.id, label: "   " })).rejects.toThrow();
    await expect(
      store.createDecor(db, { ownerId: a.id, label: "une lampe", kind: "gif" as never })
    ).rejects.toThrow();
  });

  it("s'en va avec la personne qui l'a faite", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });
    await store.editDecor(db, a.id, lampe.id, { is_public: true });
    await store.copyDecor(db, b.id, lampe.id);

    await store.deletePerson(db, a.id);
    expect(await store.decorById(db, lampe.id)).toBeNull();
    /* La copie part avec l'original : la cascade est dans le schéma. */
    expect(await store.myDecor(db, b.id)).toEqual([]);
  });

  it("reste privé par défaut, et invisible aux autres", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });

    expect(lampe.is_public).toBe(false);
    expect(await store.canReadDecor(db, a.id, lampe.id)).toBe(true);
    expect(await store.canReadDecor(db, b.id, lampe.id)).toBe(false);
    expect(await store.publicDecorOf(db, "anna")).toEqual([]);
  });

  it("se montre à qui suit, une fois posé en vitrine", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });
    await store.editDecor(db, a.id, lampe.id, { is_public: true });
    await store.follow(db, b.id, a.id);

    expect(await store.canReadDecor(db, b.id, lampe.id)).toBe(true);
    expect((await store.sharedDecor(db, b.id)).map((d) => d.label)).toEqual(["une lampe"]);
    expect((await store.publicDecorOf(db, "anna", b.id)).map((d) => d.owner)).toEqual(["anna"]);
  });

  it("un blocage l'emporte sur la vitrine", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });
    await store.editDecor(db, a.id, lampe.id, { is_public: true });
    await store.follow(db, b.id, a.id);
    await store.block(db, b.id, a.id);

    expect(await store.canReadDecor(db, b.id, lampe.id)).toBe(false);
    expect(await store.sharedDecor(db, b.id)).toEqual([]);
    expect(await store.publicDecorOf(db, "anna", b.id)).toEqual([]);
    /* Et dans l'autre sens aussi : bloquer agit des deux côtés. */
    expect(await store.canReadDecor(db, a.id, lampe.id)).toBe(true);
  });

  it("une copie survit au retour en privé", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });
    await store.editDecor(db, a.id, lampe.id, { is_public: true });
    expect(await store.copyDecor(db, b.id, lampe.id)).toBe(true);

    await store.editDecor(db, a.id, lampe.id, { is_public: false });
    expect(await store.canReadDecor(db, b.id, lampe.id)).toBe(true);
    expect((await store.myDecor(db, b.id)).map((d) => d.mine)).toEqual([false]);
  });

  it("ne se copie pas sans le droit de le lire", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });

    expect(await store.copyDecor(db, b.id, lampe.id)).toBe(false);
    expect(await store.myDecor(db, b.id)).toEqual([]);
  });

  it("le retrait par l'auteur ne reprend pas ce qui a été donné", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });
    await store.editDecor(db, a.id, lampe.id, { is_public: true });
    await store.copyDecor(db, b.id, lampe.id);

    expect(await store.deleteDecor(db, a.id, lampe.id)).toBe(true);
    /* L'objet a disparu des deux côtés — c'est le sens d'un retrait —
       mais la LIGNE est toujours là : rien n'a cascadé sur les copies,
       et le blob reste lisible le temps que le client range sa copie. */
    expect(await store.decorById(db, lampe.id)).toBeNull();
    expect(await store.myDecor(db, b.id)).toEqual([]);
    const reste = await db.query("SELECT deleted FROM decor WHERE id = $1", [lampe.id]);
    expect(reste).toHaveLength(1);
  });

  it("n'est ni modifié ni retiré par quelqu'un d'autre", async () => {
    const a = await anna();
    const b = await bruno();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe" });
    await store.editDecor(db, a.id, lampe.id, { is_public: true });
    await store.copyDecor(db, b.id, lampe.id);

    expect(await store.editDecor(db, b.id, lampe.id, { label: "chez moi" })).toBe(false);
    expect(await store.deleteDecor(db, b.id, lampe.id)).toBe(false);
    expect(await store.ownsDecor(db, b.id, lampe.id)).toBe(false);
    expect(await store.ownsDecor(db, a.id, lampe.id)).toBe(true);

    /* Rendre sa copie n'atteint pas l'original. */
    await store.dropDecorCopy(db, b.id, lampe.id);
    expect((await store.decorById(db, lampe.id))?.label).toBe("une lampe");
  });
});
