import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LE COFFRE DE DÉVELOPPEMENT

   Il sert à essayer la boutique en boucle, et il le fait SANS toucher
   au chemin d'achat : il remet la bourse à flot et efface ce qu'on
   possède, puis on rachète par la vraie porte. Ce qui est éprouvé reste
   donc ce qui tourne en production.

   Le dernier test est le plus important du fichier : la porte n'existe
   pas quand on ne l'a pas demandée.
   ============================================================ */

let db: Db;

beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

async function open(devDoor: boolean) {
  const app = await testApp(db, { devDoor });
  const person = await store.createPerson(db, "maquecime");
  const secret = await store.openSession(db, person.id);
  return { app, person, cookie: `session=${secret}` };
}

const fill = (app: FastifyInstance, cookie: string, body: object = {}) =>
  app.inject({ method: "POST", url: "/dev/coffers", headers: { cookie }, payload: body });

describe("le coffre", () => {
  it("remplit la bourse et permet de tout racheter", async () => {
    const { app, person, cookie } = await open(true);
    expect((await fill(app, cookie)).json().tokens).toBe(100000);

    await store.buy(db, person.id, "stamp-habitue", () => 0);
    /* Le refus du doublon marche : c'est le vrai chemin d'achat. */
    await expect(store.buy(db, person.id, "stamp-habitue", () => 0)).rejects.toThrow();

    /* Et le coffre le rend rachetable, sans avoir modifié `buy`. */
    await fill(app, cookie);
    await expect(store.buy(db, person.id, "stamp-habitue", () => 0)).resolves.toBeTruthy();
    await app.close();
  });

  it("garde le journal des gains, qui est la mémoire de ce qui a payé", async () => {
    const { app, person, cookie } = await open(true);
    await store.award(db, person.id, "quiz", "q1", 20);
    await fill(app, cookie);
    /* Effacer le journal masquerait un double crédit : on le garde. */
    expect(await store.award(db, person.id, "quiz", "q1", 20)).toBe(0);
    await app.close();
  });

  it("laisse ce qu'on possède quand on le demande", async () => {
    const { app, person, cookie } = await open(true);
    await fill(app, cookie);
    await store.buy(db, person.id, "stamp-habitue", () => 0);
    await fill(app, cookie, { wipe: false });
    expect((await store.holdingsOf(db, person.id)).items).toContain("stamp-habitue");
    await app.close();
  });

  it("n'existe pas sans la porte de développement", async () => {
    const { app, cookie } = await open(false);
    expect((await fill(app, cookie)).statusCode).toBe(404);
    await app.close();
  });

  it("demande un compte, comme tout le reste", async () => {
    const app = await testApp(db, { devDoor: true });
    expect(
      (await app.inject({ method: "POST", url: "/dev/coffers", payload: {} })).statusCode
    ).toBe(401);
    await app.close();
  });
});
