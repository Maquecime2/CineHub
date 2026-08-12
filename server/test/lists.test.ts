import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES LISTES, ET LES DÉFIS QU'ON EN TIRE

   Deux choses s'éprouvent ici, et la seconde count davantage.

   L'ASYMÉTRIE : co-construire est un droit d'écriture, pas one
   propriété partagée. Un isMember added des films ; il ne renomme pas,
   ne publie pas, n'erased pas.

   L'AVANCEMENT SE CALCULE À PARTIR DU JOURNAL DES SÉANCES — celui-là
   même qui ne sort jamais d'one collection partagée. Il ne doit pas en
   sortir davantage ici : un nombre, pour des gens qui ont demandé à
   participer, et rien d'other.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const createList = async (cookie: string, body: Record<string, unknown> = {}) =>
  (
    await app.inject({
      method: "POST",
      url: "/lists",
      headers: { cookie },
      payload: { title: "Les mois de Varda", ...body },
    })
  ).json().id as string;

const addWork = (cookie: string, list: string, tmdbId: string, title = "Cléo") =>
  app.inject({
    method: "POST",
    url: `/lists/${list}/works`,
    headers: { cookie },
    payload: { tmdbId, title },
  });

const readTheList = (cookie: string, list: string) =>
  app.inject({ method: "GET", url: `/lists/${list}`, headers: { cookie } });

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a list", () => {
  it("is closed by default, and invisible to others", async () => {
    const me = await count("mine");
    const other = await count("other");
    const id = await createList(me.cookie);

    expect((await readTheList(me.cookie, id)).json().list.is_public).toBe(false);
    /* Le même 404 que « n'existe pas » : distinguer dirait à un inconnu
       que cet identifiant désigne quelque chose. */
    const refus = await readTheList(other.cookie, id);
    const fantome = await readTheList(other.cookie, "00000000-0000-4000-8000-000000000000");
    expect(refus.statusCode).toBe(404);
    expect(refus.json()).toEqual(fantome.json());
  });

  it("holds works and not cards, and never the same one twice", async () => {
    /* Une list de cards serait la list des exemplaires de quelqu'un :
       her ne voudrait rien dire chez un other, et se viderait at day
       où son author erased one card. */
    const me = await count("mine");
    const id = await createList(me.cookie);
    expect((await addWork(me.cookie, id, "550")).json().fresh).toBe(true);
    expect((await addWork(me.cookie, id, "550")).json().fresh).toBe(false);

    const r = await readTheList(me.cookie, id);
    expect(r.json().works).toHaveLength(1);
    expect(r.json().works[0]).toMatchObject({ tmdb_id: "550", by: "mine" });
  });

  it("refuses what is not a work identifier", async () => {
    const me = await count("mine");
    const id = await createList(me.cookie);
    const r = await app.inject({
      method: "POST",
      url: `/lists/${id}/works`,
      headers: { cookie: me.cookie },
      payload: { tmdbId: "Cléo de 5 à 7" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("a mistyped address answers 404, and not a breakdown", async () => {
    const me = await count("mine");
    expect((await readTheList(me.cookie, "pas-un-uuid")).statusCode).toBe(404);
  });
});

describe("co-building", () => {
  it("lets you write, and not administer", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const id = await createList(me.cookie);
    await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });

    expect((await addWork(ami.cookie, id, "550")).statusCode).toBe(200);
    /* Sans cette asymétrie, one list à six mains n'a plus person
       pour en répondre. */
    const renommer = await app.inject({
      method: "PUT",
      url: `/lists/${id}`,
      headers: { cookie: ami.cookie },
      payload: { title: "à me maintenant" },
    });
    const effacer = await app.inject({
      method: "DELETE",
      url: `/lists/${id}`,
      headers: { cookie: ami.cookie },
    });
    expect(renommer.statusCode).toBe(403);
    expect(effacer.statusCode).toBe(403);
  });

  it("one does not invite somebody one has silenced", async () => {
    const me = await count("mine");
    await count("genant");
    const id = await createList(me.cookie);
    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const r = await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/genant`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  it("leaving asks nobody's permission", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const id = await createList(me.cookie);
    await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });

    const parti = await app.inject({
      method: "DELETE",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: ami.cookie },
    });
    expect(parti.statusCode).toBe(200);
    expect((await readTheList(ami.cookie, id)).statusCode).toBe(404);
  });

  it("a visitor to a public list does not read who holds it", async () => {
    const me = await count("mine");
    const ami = await count("ami");
    const passant = await count("passant");
    const id = await createList(me.cookie, { is_public: true });
    await app.inject({
      method: "PUT",
      url: `/lists/${id}/members/ami`,
      headers: { cookie: me.cookie },
    });

    expect((await readTheList(passant.cookie, id)).json().members).toEqual([]);
    expect((await readTheList(ami.cookie, id)).json().members).toEqual(["ami"]);
  });
});

describe("a challenge", () => {
  const vu = (date: string) => ({ watches: [{ date }] });

  async function defiDEssai() {
    const me = await count("mine");
    const list = await createList(me.cookie);
    await addWork(me.cookie, list, "550");
    await addWork(me.cookie, list, "551");
    const id = (
      await app.inject({
        method: "POST",
        url: "/challenges",
        headers: { cookie: me.cookie },
        payload: { listId: list, title: "Mars", starts_on: "2026-03-01", ends_on: "2026-03-31" },
      })
    ).json().id as string;
    return { me, list, id };
  }

  it("counts what was seen DURING the period, and nothing else", async () => {
    const { me, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Cléo", ...vu("2026-03-12") } },
          /* Vu, mais l'an dernier : un défi mensuel qui compterait les
             films vus il y a trois ans serait déjà gagné en s'y
             inscrivant. */
          { id: "b", tmdbId: "551", updatedAt: 1, data: { title: "Autre", ...vu("2025-01-04") } },
        ],
      },
    });

    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.json().progress).toEqual([{ pseudo: "mine", done: 1 }]);
    expect(r.json().challenge.works).toBe(2);
  });

  it("counts the old cards too, from before the log", async () => {
    const { me, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          {
            id: "a",
            tmdbId: "550",
            updatedAt: 1,
            data: { title: "Cléo", watchedAt: "2026-03-09" },
          },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.json().progress[0].done).toBe(1);
  });

  it("does not fall over on a malformed log", async () => {
    /* `watches` traverse des clients de toutes les époques :
       `jsonb_array_elements` sur ce qui n'est pas un tableau ferait
       tomber la requête ENTIÈRE, et l'progress de everything at monde avec. */
    const { me, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Cléo", watches: "autrefois" } },
          { id: "b", tmdbId: "551", updatedAt: 1, data: { title: "Autre", ...vu("2026-03-02") } },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().progress[0].done).toBe(1);
  });

  it("measures only those who asked to be in it", async () => {
    const { me, list, id } = await defiDEssai();
    const other = await count("other");
    await app.inject({
      method: "PUT",
      url: `/lists/${list}/members/other`,
      headers: { cookie: me.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: other.cookie },
      payload: {
        cards: [
          { id: "x", tmdbId: "550", updatedAt: 1, data: { title: "Cléo", ...vu("2026-03-12") } },
        ],
      },
    });

    /* Membre de la list, mais pas inscrit au défi : son journal n'est
       compté nulle part. */
    let r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: other.cookie },
    });
    expect(r.json().progress.map((a: { pseudo: string }) => a.pseudo)).toEqual(["mine"]);

    await app.inject({
      method: "PUT",
      url: `/challenges/${id}/participation`,
      headers: { cookie: other.cookie },
    });
    r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: other.cookie },
    });
    expect(r.json().progress).toContainEqual({ pseudo: "other", done: 1 });
  });

  it("never returns the log itself, only a number", async () => {
    const { me, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: me.cookie },
      payload: {
        cards: [
          {
            id: "a",
            tmdbId: "550",
            updatedAt: 1,
            data: { title: "Cléo", notes: "SECRET", ...vu("2026-03-12") },
          },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    const text = JSON.stringify(r.json());
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("2026-03-12");
  });

  it("whoever starts it takes part in it", async () => {
    const { id } = await defiDEssai();
    const list = (await app.inject({ method: "GET", url: `/challenges/${id}` })).statusCode;
    expect(list).toBe(401);
  });

  it("is not built on a stranger's public list", async () => {
    /* Sinon n'importe qui lance un défi sur la list de quelqu'un, qui
       at verrait apparaître sans l'avoir voulu. */
    const isOwner = await count("proprio");
    const passant = await count("passant");
    const list = await createList(isOwner.cookie, { is_public: true });

    const r = await app.inject({
      method: "POST",
      url: "/challenges",
      headers: { cookie: passant.cookie },
      payload: { listId: list, title: "Mars", starts_on: "2026-03-01", ends_on: "2026-03-31" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("refuses an end before its beginning", async () => {
    const me = await count("mine");
    const list = await createList(me.cookie);
    const r = await app.inject({
      method: "POST",
      url: "/challenges",
      headers: { cookie: me.cookie },
      payload: {
        listId: list,
        title: "À l'envers",
        starts_on: "2026-03-31",
        ends_on: "2026-03-01",
      },
    });
    expect(r.statusCode).toBe(400);
  });

  it("can always be left, even when the list has closed again", async () => {
    const { me, list, id } = await defiDEssai();
    const other = await count("other");
    await app.inject({
      method: "PUT",
      url: `/lists/${list}/members/other`,
      headers: { cookie: me.cookie },
    });
    await app.inject({
      method: "PUT",
      url: `/challenges/${id}/participation`,
      headers: { cookie: other.cookie },
    });
    /* On at renvoie de la list : il ne peut plus la read, et se
       trouverait mesuré by un décount dont il ne peut plus sortir. */
    await app.inject({
      method: "DELETE",
      url: `/lists/${list}/members/other`,
      headers: { cookie: me.cookie },
    });

    const parti = await app.inject({
      method: "DELETE",
      url: `/challenges/${id}/participation`,
      headers: { cookie: other.cookie },
    });
    expect(parti.statusCode).toBe(200);
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.json().progress.map((a: { pseudo: string }) => a.pseudo)).toEqual(["mine"]);
  });

  it("is erased with its list", async () => {
    const { me, list, id } = await defiDEssai();
    await app.inject({
      method: "DELETE",
      url: `/lists/${list}`,
      headers: { cookie: me.cookie },
    });
    const r = await app.inject({
      method: "GET",
      url: `/challenges/${id}`,
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(404);
  });
});
