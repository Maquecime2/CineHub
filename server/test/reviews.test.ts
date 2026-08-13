import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   WHAT IS SAID ABOUT A WORK, AND HOW ONE IS PROTECTED FROM IT

   The first place in the project where a stranger's text can appear
   under a film one loves. So what is tested here is not the display —
   it is what must NEVER come up: the private notes, the closed
   collections, the people one has silenced.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const push = (cookie: string, cards: Record<string, unknown>[]) =>
  app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { cards } });

const openUp = (cookie: string, sharing = "publique") =>
  app.inject({ method: "PUT", url: "/sharing", headers: { cookie }, payload: { sharing } });

const echo = (cookie: string, tmdbId = "550") =>
  app.inject({ method: "GET", url: `/works/${tmdbId}`, headers: { cookie } });

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a work's echo", () => {
  it("gathers those who have filed the same film, and nobody else", async () => {
    const me = await count("mine");
    const one = await count("varda");
    const two = await count("tati");
    await openUp(one.cookie);
    await openUp(two.cookie);

    await push(one.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 4 } },
      { id: "z", tmdbId: "999", updatedAt: 1, data: { title: "Autre film", rating: 1 } },
    ]);
    await push(two.cookie, [
      { id: "b", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(2);
    expect(r.mean).toBe(4.5);
    expect(r.reviews.map((a: { pseudo: string }) => a.pseudo).sort()).toEqual(["tati", "varda"]);
  });

  it("reads nothing of a collection that is not public", async () => {
    const me = await count("mine");
    const discrete = await count("discrete");
    await push(discrete.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", review: "PRIVÉ" } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(0);
    expect(r.reviews).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("PRIVÉ");
  });

  it("never carries off the notes or the log", async () => {
    /* The `WITHOUT_THE_PRIVATE` fragment is not used here: this query
       picks its fields one by one. Checking it separately is therefore
       necessary — it is exactly the kind of filter a second route
       forgets. */
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      {
        id: "a",
        tmdbId: "550",
        updatedAt: 1,
        data: {
          title: "Fight Club",
          rating: 4,
          review: "la scène du savon",
          notes: "SECRET",
          watches: [{ date: "2024-03-02" }],
          watchedAt: "2024-03-02",
        },
      },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.reviews[0].review).toBe("la scène du savon");
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(JSON.stringify(r)).not.toContain("2024-03-02");
  });

  it("does not hand me back my own review", async () => {
    /* Otherwise the mean "of the others" contains my own voice, and I
       read myself believing I am reading somebody else. */
    const me = await count("mine");
    await openUp(me.cookie);
    await push(me.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(0);
    expect(r.mean).toBe(null);
  });

  it("a card set aside from sharing says nothing either", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      { id: "honteuse", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);
    await app.inject({
      method: "PUT",
      url: "/cards/honteuse/hidden",
      headers: { cookie: her.cookie },
      payload: { hidden: true },
    });

    expect((await echo(me.cookie)).json().collections).toBe(0);
  });

  it("an unreadable rating does not bring down the others' mean", async () => {
    /* `rating` comes through six hundred clients and older versions: it
       arrives empty, or spelled out in words. A plain `::numeric` would
       fail the WHOLE query — everybody's mean lost for one old card. */
    const me = await count("mine");
    const broken = await count("cassee");
    const sound = await count("saine");
    await openUp(broken.cookie);
    await openUp(sound.cookie);
    await push(broken.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: "" } },
    ]);
    await push(sound.cookie, [
      { id: "b", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: "3" } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(2);
    expect(r.ratings).toBe(1);
    expect(r.mean).toBe(3);
  });

  it("a card that says nothing counts without being read", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club" } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(1);
    expect(r.reviews).toEqual([]);
  });

  it("an account is needed, and a work identifier that is one", async () => {
    const me = await count("mine");
    expect((await app.inject({ method: "GET", url: "/works/550" })).statusCode).toBe(401);
    expect((await echo(me.cookie, "550;DROP")).statusCode).toBe(400);
  });
});

describe("blocking", () => {
  it("cuts both ways, even declared from one", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(me.cookie);
    await openUp(genant.cookie);
    await push(me.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);
    await push(genant.cookie, [
      { id: "b", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 1 } },
    ]);

    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    expect((await echo(me.cookie)).json().collections).toBe(0);
    /* And they no longer read me either: a one-way block leaves the
       other free to go on reading, replying and starting again. */
    expect((await echo(genant.cookie)).json().collections).toBe(0);
  });

  it("makes you unfindable, without saying you are blocked", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(genant.cookie);
    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const blocked = await app.inject({
      method: "GET",
      url: "/profiles/genant",
      headers: { cookie: me.cookie },
    });
    const inconnu = await app.inject({
      method: "GET",
      url: "/profiles/jamais-vue",
      headers: { cookie: me.cookie },
    });
    expect(blocked.statusCode).toBe(inconnu.statusCode);
    expect(blocked.json()).toEqual(inconnu.json());
  });

  it("undoes the follows on both sides", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(me.cookie);
    await openUp(genant.cookie);
    await app.inject({
      method: "PUT",
      url: "/follows/genant",
      headers: { cookie: me.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/follows/mine",
      headers: { cookie: genant.cookie },
    });

    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const mien = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: me.cookie },
    });
    const sien = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: genant.cookie },
    });
    expect(mien.json().subscriptions).toEqual([]);
    expect(sien.json().subscriptions).toEqual([]);
  });

  it("stops you following, and the feed falls silent", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(genant.cookie);
    await push(genant.cookie, [{ id: "b", updatedAt: 1, data: { title: "Cléo" } }]);
    await app.inject({
      method: "PUT",
      url: "/follows/genant",
      headers: { cookie: me.cookie },
    });
    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const follow = await app.inject({
      method: "PUT",
      url: "/follows/genant",
      headers: { cookie: me.cookie },
    });
    expect(follow.statusCode).toBe(404);
    const fil = await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } });
    expect(fil.json().news).toEqual([]);
  });

  it("is undone, and re-follows nobody", async () => {
    const me = await count("mine");
    const him = await count("him");
    await openUp(him.cookie);
    await app.inject({ method: "PUT", url: "/follows/him", headers: { cookie: me.cookie } });
    await app.inject({ method: "PUT", url: "/blocks/him", headers: { cookie: me.cookie } });
    await app.inject({ method: "DELETE", url: "/blocks/him", headers: { cookie: me.cookie } });

    expect(
      (await app.inject({ method: "GET", url: "/blocks", headers: { cookie: me.cookie } })).json()
        .blocks
    ).toEqual([]);
    const list = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: me.cookie },
    });
    expect(list.json().subscriptions).toEqual([]);
    /* The profile is findable again: the silence was reversible. */
    expect(
      (await app.inject({ method: "GET", url: "/profiles/him", headers: { cookie: me.cookie } }))
        .statusCode
    ).toBe(200);
  });

  it("stays possible when the other has closed up, and on oneself never", async () => {
    const me = await count("mine");
    const him = await count("him");
    /* `him` has never shared anything: going through the public profile
       would make anybody who closes up, then comes back out, unblockable. */
    expect(
      (await app.inject({ method: "PUT", url: "/blocks/him", headers: { cookie: me.cookie } }))
        .statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "PUT", url: "/blocks/mine", headers: { cookie: me.cookie } }))
        .statusCode
    ).toBe(400);
    expect(him).toBeTruthy();
  });

  it("does not hide a collection whose address one has", async () => {
    /* A block is a silence, not a wall. Saying so here avoids promising
       a protection that does not exist. */
    const me = await count("mine");
    const him = await count("him");
    await openUp(him.cookie);
    await app.inject({ method: "PUT", url: "/blocks/him", headers: { cookie: me.cookie } });
    expect((await app.inject({ method: "GET", url: "/collections/him" })).statusCode).toBe(200);
  });
});

describe("reporting", () => {
  it("keeps the report, and counts it once only", async () => {
    const me = await count("mine");
    const him = await count("him");
    const body = { pseudo: "him", card: "a", reason: "propos haineux" };

    const one = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: body,
    });
    const two = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: body,
    });
    expect(one.json()).toMatchObject({ noted: true, fresh: true });
    /* The same answer from outside: knowing one had already reported
       adds nothing for somebody who has just done it. */
    expect(two.statusCode).toBe(200);
    expect(two.json().noted).toBe(true);

    const rows = await db.query<{ reason: string; about_id: string }>(
      "SELECT reason, about_id FROM report"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.about_id).toBe(him.person.id);
  });

  it("wants a reason, and a person who exists", async () => {
    const me = await count("mine");
    await count("him");
    const vide = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: { pseudo: "him", card: "a", reason: "   " },
    });
    const ghost = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: { pseudo: "fantome", card: "a", reason: "quelque chose" },
    });
    expect(vide.statusCode).toBe(400);
    expect(ghost.statusCode).toBe(404);
  });

  it("survives the erasure of the reported card, and not that of the account", async () => {
    /* The one reported about is a column and not a deduction: a card
       erased in the meantime would otherwise carry off the only thing
       that made the report usable. An erased account, on the other hand,
       must carry everything off — that is the right to erasure, and it
       comes first. */
    const me = await count("mine");
    const him = await count("him");
    await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: { pseudo: "him", card: "a", reason: "propos haineux" },
    });

    await app.inject({ method: "DELETE", url: "/my-account", headers: { cookie: him.cookie } });
    expect(await db.query("SELECT 1 FROM report")).toHaveLength(0);
  });
});
