import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LA PIERRE TOMBALE D'UN DOCUMENT

   CE FICHIER EXISTE PARCE QUE LE CHEMIN N'AVAIT JAMAIS ÉTÉ EMPRUNTÉ.

   Le magasin local ne savait pas effacer un document synchronisable :
   il appelait `removeItem` en direct, sans rien mettre en attente. Aucune
   suppression n'est donc jamais montée — et le serveur, lui, n'avait
   jamais eu à en recevoir une.

   Le jour où le classeur a su le dire, le serveur ne savait pas
   l'entendre : `content` est `jsonb NOT NULL`, une tombe arrive sans
   contenu, et l'insertion repartait en 23502. Cinq cents, journal côté
   serveur, rien de lisible côté classeur.

   Deux moitiés d'un même oubli, découvertes à un jour d'écart. La
   seconde n'aurait jamais pu l'être sans la première.
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

const push = (cookie: string, documents: unknown[]) =>
  app.inject({ method: "PUT", url: "/documents", headers: { cookie }, payload: { documents } });

describe("effacer un document", () => {
  it("accepte une tombe sans contenu", async () => {
    const me = await count("varda");
    await push(me.cookie, [{ key: "shelf-view:v1", updatedAt: 1, content: { id: "v1" } }]);

    const r = await push(me.cookie, [{ key: "shelf-view:v1", updatedAt: 2, deleted: true }]);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().filed).toBe(1);
  });

  it("la rend au classeur comme une suppression", async () => {
    const me = await count("demy");
    await push(me.cookie, [{ key: "shelf-view:v1", updatedAt: 1, content: { id: "v1" } }]);
    await push(me.cookie, [{ key: "shelf-view:v1", updatedAt: 2, content: null, deleted: true }]);

    const back = await app.inject({
      method: "GET",
      url: "/documents?since=0",
      headers: { cookie: me.cookie },
    });
    const doc = back.json().documents.find((d: { key: string }) => d.key === "shelf-view:v1");
    expect(doc.deleted).toBe(true);
    expect(doc.content).toBeNull();
  });

  it("refuse une tombe plus vieille que ce qu'on tient", async () => {
    /* Une suppression en retard ne doit pas emporter un travail plus
       frais : c'est la même arbitration que partout ailleurs. */
    const me = await count("rohmer");
    await push(me.cookie, [{ key: "shelf-view:v1", updatedAt: 5, content: { id: "v1" } }]);
    const r = await push(me.cookie, [{ key: "shelf-view:v1", updatedAt: 2, deleted: true }]);
    expect(r.json().stale).toBe(1);
  });

  it("accepte une tombe pour un document jamais vu", async () => {
    /* Le classeur peut effacer hors ligne puis se connecter : le serveur
       n'a rien à supprimer, mais il doit garder la trace, sinon un autre
       appareil repousserait le document. */
    const me = await count("akerman");
    const r = await push(me.cookie, [{ key: "shelf-view:jamais", updatedAt: 1, deleted: true }]);
    expect(r.statusCode).toBe(200);
    expect(r.json().filed).toBe(1);
  });
});
