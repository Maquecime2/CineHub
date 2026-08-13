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

describe("the other devices", () => {
  it("speaks to nobody without a session", async () => {
    for (const [method, url] of [
      ["GET", "/auth/keys"],
      ["POST", "/auth/keys/options"],
      ["POST", "/auth/keys/verify"],
      ["DELETE", "/auth/keys/whatever"],
    ] as const) {
      const r = await app.inject({ method, url });
      expect(r.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("offers a key from ANOTHER device, and excludes the ones already here", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "hello-on-this-pc");

    const r = await app.inject({
      method: "POST",
      url: "/auth/keys/options",
      headers: { cookie: anna.cookie },
    });
    expect(r.statusCode).toBe(200);
    const { options } = r.json();

    /* The two words that bring up the telephone's QR code rather than
       this computer's own sensor. */
    expect(options.authenticatorSelection.authenticatorAttachment).toBe("cross-platform");
    expect(options.authenticatorSelection.residentKey).toBe("required");
    expect(options.excludeCredentials.map((c: { id: string }) => c.id)).toEqual([
      "hello-on-this-pc",
    ]);
  });

  it("refuses a challenge opened for somebody else", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");

    const opened = await app.inject({
      method: "POST",
      url: "/auth/keys/options",
      headers: { cookie: anna.cookie },
    });
    const { challenge } = opened.json();

    const stolen = await app.inject({
      method: "POST",
      url: "/auth/keys/verify",
      headers: { cookie: bruno.cookie },
      payload: { challenge, response: {} },
    });
    expect(stolen.statusCode).toBe(403);

    /* And the challenge is consumed on the way: replaying it, even by
       its owner, leads nowhere. */
    const replayed = await app.inject({
      method: "POST",
      url: "/auth/keys/verify",
      headers: { cookie: anna.cookie },
      payload: { challenge, response: {} },
    });
    expect(replayed.statusCode).toBe(400);
  });

  it("shows the devices without handing over the public key", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "the-pc");
    await hangKey(anna.person.id, "the-telephone", ["hybrid", "internal"]);

    const { keys } = (
      await app.inject({ method: "GET", url: "/auth/keys", headers: { cookie: anna.cookie } })
    ).json();

    expect(keys).toHaveLength(2);
    expect(keys.map((k: { id: string }) => k.id).sort()).toEqual(["the-pc", "the-telephone"]);
    /* `hybrid` is what will light up the QR offer on the other PC. */
    expect(keys.find((k: { id: string }) => k.id === "the-telephone").transports).toContain(
      "hybrid"
    );
    for (const k of keys) expect(k).not.toHaveProperty("public_key");
  });

  it("does not see other people's devices", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    await hangKey(anna.person.id, "annas-pc");

    const { keys } = (
      await app.inject({ method: "GET", url: "/auth/keys", headers: { cookie: bruno.cookie } })
    ).json();
    expect(keys).toEqual([]);

    /* Nor does he remove it: on his side, it does not exist. */
    const r = await app.inject({
      method: "DELETE",
      url: "/auth/keys/annas-pc",
      headers: { cookie: bruno.cookie },
    });
    expect(r.statusCode).toBe(404);
    expect(await store.countKeys(db, anna.person.id)).toBe(1);
  });

  it("removes a key while one is left, never the last", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "the-pc");
    await hangKey(anna.person.id, "the-telephone");

    const first = await app.inject({
      method: "DELETE",
      url: "/auth/keys/the-pc",
      headers: { cookie: anna.cookie },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().keys).toHaveLength(1);

    const last = await app.inject({
      method: "DELETE",
      url: "/auth/keys/the-telephone",
      headers: { cookie: anna.cookie },
    });
    expect(last.statusCode).toBe(409);
    expect(await store.countKeys(db, anna.person.id)).toBe(1);
  });

  it("two simultaneous removals do not empty the keyring", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "the-pc");
    await hangKey(anna.person.id, "the-telephone");

    /* The guard is in the SQL, not in the handler: counted in the route
       and applied afterwards, it would let these two through. */
    const [a, b] = await Promise.all([
      store.forgetKey(db, anna.person.id, "the-pc"),
      store.forgetKey(db, anna.person.id, "the-telephone"),
    ]);
    expect([a, b].filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(await store.countKeys(db, anna.person.id)).toBeGreaterThanOrEqual(1);
  });

  it("offers this machine's own sensor when that is what was asked", async () => {
    const anna = await account("anna");
    const r = await app.inject({
      method: "POST",
      url: "/auth/keys/options",
      headers: { cookie: anna.cookie },
      payload: { where: "here" },
    });
    /* Offering a QR code for the computer under one's hands would be
       absurd — and it is exactly what somebody does right after
       arriving with a pairing code. */
    expect(r.json().options.authenticatorSelection.authenticatorAttachment).toBe("platform");
  });

  it("lets the telephone's key present itself at sign-in", async () => {
    const anna = await account("anna");
    await hangKey(anna.person.id, "the-telephone", ["hybrid", "internal"]);

    const r = await app.inject({
      method: "POST",
      url: "/auth/signin/options",
      payload: { pseudo: "anna" },
    });
    const { options } = r.json();
    /* Without the transports, the other PC's browser offers no QR code:
       that path is the whole of this feature. */
    expect(options.allowCredentials).toHaveLength(1);
    expect(options.allowCredentials[0].transports).toContain("hybrid");
  });
});

/* ============================================================
   THE PAIRING CODE

   The door the passkeys cannot open: on `localhost` each computer is
   its own domain, so two machines at home have nothing in common to
   sign for and the QR ceremony is of no use whatsoever. A code crosses
   that — which means it is worth an account, and everything below is
   about what keeps that acceptable.
   ============================================================ */
describe("the pairing code", () => {
  const claim = (code: string) =>
    app.inject({ method: "POST", url: "/auth/pair/claim", payload: { code } });

  it("is not made without a session", async () => {
    expect((await app.inject({ method: "POST", url: "/auth/pair" })).statusCode).toBe(401);
  });

  it("opens the account on a machine that holds no key", async () => {
    const anna = await account("anna");
    const { code } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();

    const r = await claim(code);
    expect(r.statusCode).toBe(200);
    expect(r.json().person.pseudo).toBe("anna");
    /* A session, which is the whole point: from there the ordinary
       synchronisation brings everything back. */
    expect(r.headers["set-cookie"]).toBeTruthy();
  });

  it("works once, and once only", async () => {
    const anna = await account("anna");
    const { code } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();

    expect((await claim(code)).statusCode).toBe(200);
    expect((await claim(code)).statusCode).toBe(401);
  });

  it("reads what was shown, whatever the case and the spaces", async () => {
    const anna = await account("anna");
    const { code } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();
    /* It is read off one screen and typed on another: the shape it
       comes back in is not ours to insist on. */
    expect((await claim(`  ${code.toLowerCase()} `)).statusCode).toBe(200);
  });

  it("says nothing about a code that never existed", async () => {
    /* Unknown, expired, already spent — one answer for all three.
       Telling them apart would say whether a code once existed. */
    const unknown = await claim("ABCDEFGHJK");
    expect(unknown.statusCode).toBe(401);

    const anna = await account("anna");
    const { code } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();
    await claim(code);
    expect((await claim(code)).json().error).toBe(unknown.json().error);
  });

  it("lasts a week, and not a minute more", async () => {
    const anna = await account("anna");
    const { code, days } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();
    expect(days).toBe(7);

    /* The row carries its own expiry and the clause is in the DELETE, so
       we age the ROW rather than the clock — and by a week, which is
       what makes this test say something about the life we chose rather
       than merely about the existence of an expiry. */
    await db.query("UPDATE pairing_code SET expires_at = expires_at - interval '8 days'");
    expect((await claim(code)).statusCode).toBe(401);
  });

  it("is still good six days later", async () => {
    const anna = await account("anna");
    const { code } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();
    /* A code already dead by the time one sits down at the other machine
       is a code asked for three times over: the week is the point. */
    await db.query("UPDATE pairing_code SET expires_at = expires_at - interval '6 days'");
    expect((await claim(code)).statusCode).toBe(200);
  });

  it("carries no readable code in the table", async () => {
    const anna = await account("anna");
    const { code } = (
      await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } })
    ).json();
    const rows = await db.query<{ digest: string }>("SELECT digest FROM pairing_code");
    /* Same reasoning as the sessions: a leak of this table hands over
       nothing usable. */
    expect(rows[0]!.digest).not.toBe(code);
    expect(rows[0]!.digest).toHaveLength(64);
  });

  it("goes with the person it opens", async () => {
    const anna = await account("anna");
    await app.inject({ method: "POST", url: "/auth/pair", headers: { cookie: anna.cookie } });
    await store.deletePerson(db, anna.person.id);
    expect(await db.query("SELECT 1 FROM pairing_code")).toEqual([]);
  });
});
