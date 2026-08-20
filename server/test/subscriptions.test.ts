import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   FOLLOWING SOMEBODY, AND READING THEIR FEED

   What is tested here is not "does it work" — it is what the community
   half lets slip. A follow is the first place where two people's data
   cross, and where a mistake cannot be seen from one's own screen.
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

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("finding somebody", () => {
  it("one finds only those who chose to be findable", async () => {
    const closed = await count("discrete");
    const open = await count("varda");
    await openUp(open.cookie);

    expect((await app.inject({ method: "GET", url: "/profiles/varda" })).statusCode).toBe(200);
    /* A private account answers like an account that does not exist:
       without that, trying pseudonyms becomes a directory. */
    const privateKey = await app.inject({ method: "GET", url: "/profiles/discrete" });
    const unknown = await app.inject({ method: "GET", url: "/profiles/jamais-vue" });
    expect(privateKey.statusCode).toBe(unknown.statusCode);
    expect(privateKey.json()).toEqual(unknown.json());
    expect(closed).toBeTruthy();
  });

  it("sharing by LINK does not open a profile", async () => {
    /* A link is given to somebody; it does not make you findable. */
    const p = await count("varda");
    await openUp(p.cookie, "lien");
    expect((await app.inject({ method: "GET", url: "/profiles/varda" })).statusCode).toBe(404);
  });

  it("the profile says what it shows, and nothing of the person", async () => {
    const p = await count("varda");
    await push(p.cookie, [
      { id: "f1", updatedAt: 1, data: { title: "Cléo" } },
      { id: "f2", updatedAt: 1, data: { title: "Le Bonheur" } },
    ]);
    await openUp(p.cookie);

    const r = await app.inject({ method: "GET", url: "/profiles/varda" });
    expect(r.json()).toMatchObject({ pseudo: "varda", films: 2 });
    expect(Object.keys(r.json())).not.toContain("email");
    expect(Object.keys(r.json())).not.toContain("id");
  });
});

describe("following", () => {
  it("is a gesture one makes alone, and remakes without harm", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);

    const un = await app.inject({
      method: "PUT",
      url: "/follows/varda",
      headers: { cookie: me.cookie },
    });
    const two = await app.inject({
      method: "PUT",
      url: "/follows/varda",
      headers: { cookie: me.cookie },
    });
    expect(un.statusCode).toBe(200);
    expect(two.statusCode).toBe(200);

    const list = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: me.cookie },
    });
    expect(list.json().subscriptions.map((a: { pseudo: string }) => a.pseudo)).toEqual(["varda"]);
  });

  it("one does not subscribe to a silence", async () => {
    const me = await count("mine");
    await count("discrete");
    const r = await app.inject({
      method: "PUT",
      url: "/follows/discrete",
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  it("one does not follow oneself", async () => {
    /* Otherwise one's own feed fills with what one has just written. */
    const me = await count("mine");
    await openUp(me.cookie);
    const r = await app.inject({
      method: "PUT",
      url: "/follows/mine",
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(400);
  });

  it("unfollowing stays possible when the other has closed up", async () => {
    /* Going through the public profile would have made it impossible —
       one would be following somebody invisible for life. */
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });
    await openUp(her.cookie, "privee");

    const r = await app.inject({
      method: "DELETE",
      url: "/follows/varda",
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(200);
    const list = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: me.cookie },
    });
    expect(list.json().subscriptions).toEqual([]);
  });
});

describe("the feed", () => {
  it("shows only what the people followed show", async () => {
    const me = await count("mine");
    const suivie = await count("varda");
    const other = await count("unknown");
    await openUp(suivie.cookie);
    await openUp(other.cookie);

    await push(suivie.cookie, [{ id: "f1", updatedAt: 1, data: { title: "Cléo" } }]);
    await push(other.cookie, [{ id: "f9", updatedAt: 1, data: { title: "Jamais vu" } }]);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    const r = await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } });
    expect(r.json().news.map((n: { film: { title: string } }) => n.film.title)).toEqual(["Cléo"]);
  });

  it("never carries off the notes or the log", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      {
        id: "f1",
        updatedAt: 1,
        data: {
          title: "Cléo",
          review: "la scène du chapeau",
          notes: "SECRET",
          watches: [{ date: "2024-03-02" }],
          watchedAt: "2024-03-02",
        },
      },
    ]);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    const film = (
      await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } })
    ).json().news[0].film;
    expect(film.review).toBe("la scène du chapeau");
    expect("notes" in film).toBe(false);
    expect("watches" in film).toBe(false);
    expect("watchedAt" in film).toBe(false);
  });

  it("falls silent when the followed person closes up", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [{ id: "f1", updatedAt: 1, data: { title: "Cléo" } }]);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    await openUp(her.cookie, "privee");
    const r = await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } });
    /* L'follow left : c'est at fil qui se tait, et il reparlera si
       her rouvre. */
    expect(r.json().news).toEqual([]);
  });

  it("a card set aside does not appear either", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      { id: "montrable", updatedAt: 1, data: { title: "Playtime" } },
      { id: "honteuse", updatedAt: 1, data: { title: "coupable" } },
    ]);
    await app.inject({
      method: "PUT",
      url: "/cards/honteuse/hidden",
      headers: { cookie: her.cookie },
      payload: { hidden: true },
    });
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    const titres = (
      await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } })
    )
      .json()
      .news.map((n: { film: { title: string } }) => n.film.title);
    expect(titres).toEqual(["Playtime"]);
  });

  it("reads page by page, from the most recent to the oldest", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [{ id: "a", updatedAt: 1, data: { title: "premier" } }]);
    await push(her.cookie, [{ id: "b", updatedAt: 1, data: { title: "second" } }]);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    const p1 = await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } });
    expect(p1.json().news.map((n: { film: { title: string } }) => n.film.title)).toEqual([
      "second",
      "premier",
    ]);

    const suite = await app.inject({
      method: "GET",
      url: `/feed?before=${p1.json().news[0].id ? p1.json().upTo : 0}`,
      headers: { cookie: me.cookie },
    });
    expect(suite.json().news).toEqual([]);
  });

  it("an account is needed to have a feed", async () => {
    expect((await app.inject({ method: "GET", url: "/feed" })).statusCode).toBe(401);
  });
});

/* ============================================================
   LES DEUX SENS DU MÊME LIEN

   `subscriptionsOf` N'APPLIQUAIT PAS `NOT_BLOCKED`, là où tous ses
   frères le font. Suivre est antérieur au blocage — rien n'efface la
   ligne de `follow` quand quelqu'un vous bloque ensuite — donc « qui je
   suis » pouvait NOMMER une personne qui vous a bloqué, et le
   pseudonyme est exactement ce qu'un blocage retire de la vue. Rien
   n'échouait, ce qui est pourquoi le trou a duré.

   `followersOf` est le miroir, et sa garde est écrite dans le MÊME
   commit : les séparer aurait laissé « lequel des deux le fait ? » à
   quelqu'un dans six mois.
   ============================================================ */
describe("who I follow, and who follows me", () => {
  const follows = (cookie: string) =>
    app.inject({ method: "GET", url: "/follows", headers: { cookie } });
  const followers = (cookie: string) =>
    app.inject({ method: "GET", url: "/followers", headers: { cookie } });

  it("names the same pair from both ends", async () => {
    const me = await count("copine");
    const her = await count("varda");
    await openUp(her.cookie);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    const named = (rows: { pseudo: string }[]) => rows.map((s) => s.pseudo);
    expect(named((await follows(me.cookie)).json().subscriptions)).toEqual(["varda"]);
    expect(named((await followers(her.cookie)).json().followers)).toEqual(["copine"]);
    /* Et pas l'inverse : le lien est orienté. */
    expect((await followers(me.cookie)).json().followers).toEqual([]);
    expect((await follows(her.cookie)).json().subscriptions).toEqual([]);
  });

  it("stops naming somebody who blocked me — in BOTH directions", async () => {
    const me = await count("copine");
    const her = await count("varda");
    await openUp(her.cookie);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });
    expect((await follows(me.cookie)).json().subscriptions).toHaveLength(1);
    expect((await followers(her.cookie)).json().followers).toHaveLength(1);

    /* ELLE bloque. La ligne de `follow` reste — rien ne l'efface — donc
       c'est bien la LECTURE qui doit se taire, des deux côtés. */
    await store.block(db, her.person.id, me.person.id);
    expect((await follows(me.cookie)).json().subscriptions).toEqual([]);
    expect((await followers(her.cookie)).json().followers).toEqual([]);
  });

  it("wants an account", async () => {
    expect((await app.inject({ method: "GET", url: "/followers" })).statusCode).toBe(401);
  });
});
