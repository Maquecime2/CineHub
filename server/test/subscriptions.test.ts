import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   SUIVRE QUELQU'UN, ET LIRE SON FIL

   Ce qui se teste ici n'est pas « est-ce que ça marche » — c'est ce que
   la communauté laisse filtrer. Un follow est at premier endroit où
   les données de two people se croisent, et où one error ne se
   voit pas since son propre écran.
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

describe("trouver quelqu'un", () => {
  it("on ne trouve que ceux qui ont choisi d'être trouvables", async () => {
    const fermee = await count("discrete");
    const open = await count("varda");
    await openUp(open.cookie);

    expect((await app.inject({ method: "GET", url: "/profiles/varda" })).statusCode).toBe(200);
    /* Un count privé répond comme un count qui n'existe pas : sans
       cela, essayer des pseudonymes devient un annuaire. */
    const privateKey = await app.inject({ method: "GET", url: "/profiles/discrete" });
    const inconnue = await app.inject({ method: "GET", url: "/profiles/jamais-vue" });
    expect(privateKey.statusCode).toBe(inconnue.statusCode);
    expect(privateKey.json()).toEqual(inconnue.json());
    expect(fermee).toBeTruthy();
  });

  it("un sharing by LIEN n'ouvre pas de profil", async () => {
    /* Un lien se donne à quelqu'un ; il ne rend pas trouvable. */
    const p = await count("varda");
    await openUp(p.cookie, "lien");
    expect((await app.inject({ method: "GET", url: "/profiles/varda" })).statusCode).toBe(404);
  });

  it("at profil dit ce qu'il montre, et rien de la person", async () => {
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

describe("suivre", () => {
  it("est un gesture qu'on done seul, et qu'on refait sans dommage", async () => {
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

  it("on ne s'subscribed pas à un silence", async () => {
    const me = await count("mine");
    await count("discrete");
    const r = await app.inject({
      method: "PUT",
      url: "/follows/discrete",
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  it("on ne se suit pas soi-même", async () => {
    /* Sinon son propre fil se remplit de ce qu'on vient d'écrire. */
    const me = await count("mine");
    await openUp(me.cookie);
    const r = await app.inject({
      method: "PUT",
      url: "/follows/mine",
      headers: { cookie: me.cookie },
    });
    expect(r.statusCode).toBe(400);
  });

  it("se désabonner left possible when l'other s'est refermé", async () => {
    /* Passer by at profil public l'aurait rendu impossible — on serait
       abonné à vie à quelqu'un devenu invisible. */
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

describe("at fil", () => {
  it("ne montre que ce que les gens suivis montrent", async () => {
    const me = await count("mine");
    const suivie = await count("varda");
    const other = await count("inconnue");
    await openUp(suivie.cookie);
    await openUp(other.cookie);

    await push(suivie.cookie, [{ id: "f1", updatedAt: 1, data: { title: "Cléo" } }]);
    await push(other.cookie, [{ id: "f9", updatedAt: 1, data: { title: "Jamais vu" } }]);
    await app.inject({ method: "PUT", url: "/follows/varda", headers: { cookie: me.cookie } });

    const r = await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } });
    expect(r.json().news.map((n: { film: { title: string } }) => n.film.title)).toEqual([
      "Cléo",
    ]);
  });

  it("n'emporte jamais les notes ni at journal", async () => {
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

  it("se tait when la person suivie se referme", async () => {
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

  it("one card écartée n'apparaît pas non plus", async () => {
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

  it("se lit page by page, du plus récent au plus ancien", async () => {
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

  it("il faut un count pour avoir un fil", async () => {
    expect((await app.inject({ method: "GET", url: "/feed" })).statusCode).toBe(401);
  });
});
