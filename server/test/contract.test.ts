import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb, testApp, cookieOf } from "./helpers.ts";
import { readPerson } from "../../src/services/contract.ts";
import * as store from "../src/store.ts";
import { buildApp } from "../src/app.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE CONTRACT WITH THE BINDER

   These tests are the only ones in this package that read a file from
   the OTHER one — `src/services/contract.ts`, which holds no import and
   exists for this. They call the very function the binder calls, on a
   reply the server really produced.

   Why it had to be this way: the binder's tests mock the server, so a
   renamed field is repeated identically on both sides of the mock and
   nothing complains. The server's tests, on their side, checked their
   own replies against their own expectations. Two green suites, one
   application that could not sign anybody in — the reply was
   `{ person }` and the binder read `.who`.

   So the check has to run where the two meet, and it has to run on
   something that survives compilation. `readPerson` is a function for
   that reason alone: rename the field on either side and it returns
   `undefined` here, out loud.

   WHAT IS STILL NOT TRIED, and it is the same limit as everywhere else:
   the ceremony. `/auth/signup/verify` and `/auth/signin/verify` want a
   signature, so a fingerprint, so a human. `/dev/session` is the door
   made for exactly that — it opens a session with no ceremony, and it
   answers with the same shape as the two routes it stands in for.
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

describe("the shape the binder reads", () => {
  it("names the person on /me, under the name the binder looks for", async () => {
    const person = await store.createPerson(db, "varda");
    const secret = await store.openSession(db, person.id);

    const r = await app.inject({
      method: "GET",
      url: "/me",
      headers: { cookie: `session=${secret}` },
    });
    expect(r.statusCode).toBe(200);

    /* NOT `r.json().person` — that would be this test writing down the
       field name a third time, which is the mistake itself. We go
       through the binder's own reader. */
    const who = readPerson(r.json());
    expect(who?.id).toBe(person.id);
    expect(who?.pseudo).toBe("varda");
  });

  it("names it the same way when a session opens", async () => {
    /* The service door stands in for the two ceremony routes: same
       reply, and it is reachable without an authenticator. */
    const withDoor = await buildApp({
      db,
      domain: "localhost",
      origin: "http://localhost:5173",
      secure: false,
      devDoor: true,
    });
    try {
      const r = await withDoor.inject({
        method: "POST",
        url: "/dev/session",
        payload: { pseudo: "akerman" },
      });
      expect(r.statusCode).toBe(200);

      const who = readPerson(r.json());
      expect(who?.pseudo).toBe("akerman");

      /* A session that opens is a session that carries: the binder asks
         `/me` right after, and that is the round trip that broke. */
      const then = await withDoor.inject({
        method: "GET",
        url: "/me",
        headers: { cookie: cookieOf(r) },
      });
      expect(readPerson(then.json())?.id).toBe(who.id);
    } finally {
      await withDoor.close();
    }
  });
});
