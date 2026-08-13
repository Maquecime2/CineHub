import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE OTHER DEVICES

   What is tried here is not the WebAuthn ceremony — that one needs an
   authenticator, and a fake one would only prove that the fake works.
   What is tried is everything AROUND it, which is where an account gets
   lost or stolen:

   A CHALLENGE BELONGS TO THE ACCOUNT THAT OPENED IT. Otherwise whoever
   is signed in finishes somebody else's ceremony and hangs their own key
   on that account — a spare key to a door that is not theirs.

   THE LAST KEY IS NOT REMOVED. Not as a courtesy: with no passkey left
   and no password to fall back on, the account has no way back in at
   all. And the refusal must hold when two requests arrive together,
   which is why it lives in the SQL and not in the handler.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function account(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

/* A key placed straight into the store: registering it through the route
   would take an authenticator, and what follows tests the bookkeeping,
   not the signature. */
async function hangKey(personId: string, id: string, transports: string[] = ["internal"]) {
  await store.addKey(db, {
    id,
    personId,
    publicKey: new Uint8Array([1, 2, 3]),
    counter: 0,
    transports,
    device: id,
  });
}

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("les autres appareils", () => {
  it("ne parle à personne sans session", async () => {
    for (const [method, url] of [
      ["GET", "/auth/keys"],
      ["POST", "/auth/keys/options"],
      ["POST", "/auth/keys/verify"],
      ["DELETE", "/auth/keys/quelconque"],
    ] as const) {
      const r = await app.inject({ method, url });
      expect(r.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("propose une clé d'un AUTRE appareil, et exclut celles déjà là", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "hello-de-ce-pc");

    const r = await app.inject({
      method: "POST",
      url: "/auth/keys/options",
      headers: { cookie: anna.cookie },
    });
    expect(r.statusCode).toBe(200);
    const { options } = r.json();

    /* Les deux mots qui font apparaître le QR du téléphone plutôt que le
       capteur de ce PC-ci. */
    expect(options.authenticatorSelection.authenticatorAttachment).toBe("cross-platform");
    expect(options.authenticatorSelection.residentKey).toBe("required");
    expect(options.excludeCredentials.map((c: { id: string }) => c.id)).toEqual(["hello-de-ce-pc"]);
  });

  it("refuse un défi ouvert pour quelqu'un d'autre", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");

    const ouvert = await app.inject({
      method: "POST",
      url: "/auth/keys/options",
      headers: { cookie: anna.cookie },
    });
    const { challenge } = ouvert.json();

    const vole = await app.inject({
      method: "POST",
      url: "/auth/keys/verify",
      headers: { cookie: bruno.cookie },
      payload: { challenge, response: {} },
    });
    expect(vole.statusCode).toBe(403);

    /* Et le défi est consommé au passage : le rejouer, même par son
       propriétaire, ne mène nulle part. */
    const rejoue = await app.inject({
      method: "POST",
      url: "/auth/keys/verify",
      headers: { cookie: anna.cookie },
      payload: { challenge, response: {} },
    });
    expect(rejoue.statusCode).toBe(400);
  });

  it("montre les appareils sans livrer la clé publique", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "le-pc");
    await hangKey(anna.person.id, "le-telephone", ["hybrid", "internal"]);

    const { keys } = (
      await app.inject({ method: "GET", url: "/auth/keys", headers: { cookie: anna.cookie } })
    ).json();

    expect(keys).toHaveLength(2);
    expect(keys.map((k: { id: string }) => k.id).sort()).toEqual(["le-pc", "le-telephone"]);
    /* `hybrid` est ce qui, sur l'autre PC, allumera l'offre du QR. */
    expect(keys.find((k: { id: string }) => k.id === "le-telephone").transports).toContain(
      "hybrid"
    );
    for (const k of keys) expect(k).not.toHaveProperty("public_key");
  });

  it("ne voit pas les appareils des autres", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    await hangKey(anna.person.id, "le-pc-d-anna");

    const { keys } = (
      await app.inject({ method: "GET", url: "/auth/keys", headers: { cookie: bruno.cookie } })
    ).json();
    expect(keys).toEqual([]);

    /* Et il ne la retire pas non plus : elle n'existe pas, de son côté. */
    const r = await app.inject({
      method: "DELETE",
      url: "/auth/keys/le-pc-d-anna",
      headers: { cookie: bruno.cookie },
    });
    expect(r.statusCode).toBe(404);
    expect(await store.countKeys(db, anna.person.id)).toBe(1);
  });

  it("retire une clé quand il en reste une, jamais la dernière", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "le-pc");
    await hangKey(anna.person.id, "le-telephone");

    const premier = await app.inject({
      method: "DELETE",
      url: "/auth/keys/le-pc",
      headers: { cookie: anna.cookie },
    });
    expect(premier.statusCode).toBe(200);
    expect(premier.json().keys).toHaveLength(1);

    const dernier = await app.inject({
      method: "DELETE",
      url: "/auth/keys/le-telephone",
      headers: { cookie: anna.cookie },
    });
    expect(dernier.statusCode).toBe(409);
    expect(await store.countKeys(db, anna.person.id)).toBe(1);
  });

  it("deux retraits simultanés ne vident pas le trousseau", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "le-pc");
    await hangKey(anna.person.id, "le-telephone");

    /* La garde est dans le SQL, pas dans le gestionnaire : comptée dans
       la route puis appliquée après, elle laisserait passer ces deux-là. */
    const [a, b] = await Promise.all([
      store.forgetKey(db, anna.person.id, "le-pc"),
      store.forgetKey(db, anna.person.id, "le-telephone"),
    ]);
    expect([a, b].filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(await store.countKeys(db, anna.person.id)).toBeGreaterThanOrEqual(1);
  });

  it("laisse la clé du téléphone se présenter à la connexion", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "le-telephone", ["hybrid", "internal"]);

    const r = await app.inject({
      method: "POST",
      url: "/auth/signin/options",
      payload: { pseudo: "anna" },
    });
    const { options } = r.json();
    /* Sans les transports, le navigateur de l'autre PC n'offre pas le
       QR : c'est ce chemin-là qui fait tout le point 2. */
    expect(options.allowCredentials).toHaveLength(1);
    expect(options.allowCredentials[0].transports).toContain("hybrid");
  });
});
