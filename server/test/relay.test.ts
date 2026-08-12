import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { testDb, testApp } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE RELAYS

   We do not talk to the real TMDB in a test: that would mean depending
   on a network and a quota to know whether OUR code is right. So we
   double `fetch`, and look at what the server asked for — that is where
   everything is at stake: which address, with which key, and for whom.
   ============================================================ */

let db: Db;
let app: FastifyInstance;
let requests: string[];

async function signedIn(pseudo = "varda") {
  const person = await store.createPerson(db, pseudo);
  return `session=${await store.openSession(db, person.id)}`;
}

beforeEach(async () => {
  db = await testDb();
  requests = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    requests.push(String(url));
    return new Response('{"results":[]}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  app = await testApp(db, { tmdbKey: "LA-CLE-DU-SERVEUR" });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await app.close();
  await db.close();
});

describe("the TMDB relay", () => {
  it("refuses whoever has no account: a key lent to everybody is no longer a key", async () => {
    const r = await app.inject({ method: "GET", url: "/tmdb/search/movie?query=cleo" });
    expect(r.statusCode).toBe(401);
    expect(requests).toEqual([]);
  });

  it("relays a known path, with THE server's key", async () => {
    const cookie = await signedIn();
    const r = await app.inject({
      method: "GET",
      url: "/tmdb/search/movie?query=cleo",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain("https://api.themoviedb.org/3/search/movie");
    expect(requests[0]).toContain("query=cleo");
    expect(requests[0]).toContain("api_key=LA-CLE-DU-SERVEUR");
  });

  it("throws away a key the client may have slipped into its request", async () => {
    const cookie = await signedIn();
    await app.inject({
      method: "GET",
      url: "/tmdb/movie/42?api_key=LA-CLE-DE-QUELQUUN-DAUTRE",
      headers: { cookie },
    });
    expect(requests[0]).toContain("api_key=LA-CLE-DU-SERVEUR");
    expect(requests[0]).not.toContain("LA-CLE-DE-QUELQUUN-DAUTRE");
  });

  it("relays only the paths spelled out in full", async () => {
    const cookie = await signedIn();
    /* A relay that forwards anything lends its key, its address and its
       bill to whoever comes by. */
    for (const path of [
      "/tmdb/account/1/favorites",
      "/tmdb/authentication/token/new",
      "/tmdb/movie/42/lists",
      "/tmdb/../3/configuration",
    ]) {
      const r = await app.inject({ method: "GET", url: path, headers: { cookie } });
      expect({ path, code: r.statusCode }).toEqual({ path, code: 404 });
    }
    expect(requests).toEqual([]);
  });

  it("passes TMDB's code back as it stands", async () => {
    /* A 404 turned into a 200 would retry a film that does not exist for
       ever; a 429 swallowed would lose the waiting rhythm. */
    vi.stubGlobal("fetch", async () => new Response('{"error":"rien"}', { status: 404 }));
    const cookie = await signedIn();
    const r = await app.inject({
      method: "GET",
      url: "/tmdb/movie/999999999",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  /* THE WAIT MUST CROSS, or the 429 "the client knows how to wait for"
     teaches it nothing: it falls back on an invented second, gets
     refused again inside the same window, and burns its three tries for
     nothing. */
  it("passes back the wait TMDB announces", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("{}", { status: 429, headers: { "retry-after": "47" } })
    );
    const cookie = await signedIn();
    const r = await app.inject({ method: "GET", url: "/tmdb/movie/42", headers: { cookie } });
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("47");
  });

  /* ============================================================
     THE RELAY'S CEILING IS NOT THE REST'S
     ============================================================

     The server limits to a hundred requests per minute per address,
     which is right for routes that write. Applied to the relay it was
     wrong: "complete the cards" asks ONE request per film, five at a
     time — three hundred cards make three hundred requests, and the
     hundred were passed in a few seconds. All the rest of the minute
     came back as 429, synchronisation included, which shares the
     counter. The binder looked broken at the very moment it was
     working.

     The test is played with a low cap, so as not to inject six hundred
     requests: what is tried is not the figure, it is the fact that the
     relay has one of ITS OWN. */
  it("lets through more than the server's general cap", async () => {
    const large = await testApp(db, { tmdbKey: "K", tmdbCeiling: 250 });
    const cookie = await signedIn("chantal");
    /* Cent one : one de plus que at cap global, qui refusait ici. */
    let dernier = 0;
    for (let i = 0; i < 101; i++) {
      const r = await large.inject({
        method: "GET",
        url: `/tmdb/movie/${1000 + i}`,
        headers: { cookie },
      });
      dernier = r.statusCode;
    }
    expect(dernier).toBe(200);
    await large.close();
  });

  it("keeps a cap all the same, or it is no longer a relay but a tap", async () => {
    const narrow = await testApp(db, { tmdbKey: "K", tmdbCeiling: 3 });
    const cookie = await signedIn("jacques");
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await narrow.inject({
        method: "GET",
        url: `/tmdb/movie/${2000 + i}`,
        headers: { cookie },
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes[3]).toBe(429);
    await narrow.close();
  });

  /* The general cap stays what it is on the other routes: the relay has
     won an exception, not the whole server. */
  it("loosens nothing elsewhere", async () => {
    const narrow = await testApp(db, { tmdbKey: "K", tmdbCeiling: 3 });
    const cookie = await signedIn("agnes");
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await narrow.inject({ method: "GET", url: "/me", headers: { cookie } });
      codes.push(r.statusCode);
    }
    /* Five calls do not pass a hundred: no 429 here, and above all no
       429 at three — the relay's cap does not spill over onto its
       neighbours. */
    expect(codes.filter((c) => c === 429)).toEqual([]);
    /* And the route really answers: without this line, a `/me` gone 404
       would let the test pass while proving nothing. */
    expect(codes[0]).toBe(200);
    await narrow.close();
  });

  it("with no key on this side, it says so instead of pretending", async () => {
    const nu = await testApp(db, {});
    const cookie = await signedIn("melville");
    const r = await nu.inject({
      method: "GET",
      url: "/tmdb/configuration",
      headers: { cookie },
    });
    expect(r.statusCode).toBe(503);
    await nu.close();
  });
});

describe("the Letterboxd relay", () => {
  it("fetches the feed the browser cannot read", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      requests.push(String(url));
      return new Response("<rss></rss>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    });
    const r = await app.inject({ method: "GET", url: "/letterboxd/agnesvarda" });
    expect(r.statusCode).toBe(200);
    expect(requests[0]).toBe("https://letterboxd.com/agnesvarda/rss/");
    expect(r.body).toContain("<rss>");
  });

  it("does not let itself be sent visiting something else", async () => {
    /* With no bound, the parameter becomes a machine for sending our
       server visiting any address at all. */
    for (const pseudo of ["../../admin", "quelquun/../..", "http:%2F%2Failleurs"]) {
      const r = await app.inject({ method: "GET", url: `/letterboxd/${pseudo}` });
      expect(r.statusCode).not.toBe(200);
    }
    expect(requests).toEqual([]);
  });
});
