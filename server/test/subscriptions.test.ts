import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   SUIVRE QUELQU'UN, ET LIRE SON FIL

   Ce qui se teste ici n'est pas « est-ce que ça marche » — c'est ce que
   la communauté laisse filtrer. Un abonnement est le premier endroit où
   les données de deux personnes se croisent, et où une erreur ne se
   voit pas depuis son propre écran.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function compte(pseudo: string) {
  const personne = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, personne.id);
  return { personne, cookie: `session=${secret}` };
}

const pousser = (cookie: string, fiches: Record<string, unknown>[]) =>
  app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { fiches } });

const ouvrir = (cookie: string, partage = "publique") =>
  app.inject({ method: "PUT", url: "/partage", headers: { cookie }, payload: { partage } });

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
    const fermee = await compte("discrete");
    const ouverte = await compte("varda");
    await ouvrir(ouverte.cookie);

    expect((await app.inject({ method: "GET", url: "/profils/varda" })).statusCode).toBe(200);
    /* Un compte privé répond comme un compte qui n'existe pas : sans
       cela, essayer des pseudonymes devient un annuaire. */
    const privateKey = await app.inject({ method: "GET", url: "/profils/discrete" });
    const inconnue = await app.inject({ method: "GET", url: "/profils/jamais-vue" });
    expect(privateKey.statusCode).toBe(inconnue.statusCode);
    expect(privateKey.json()).toEqual(inconnue.json());
    expect(fermee).toBeTruthy();
  });

  it("un partage par LIEN n'ouvre pas de profil", async () => {
    /* Un lien se donne à quelqu'un ; il ne rend pas trouvable. */
    const p = await compte("varda");
    await ouvrir(p.cookie, "lien");
    expect((await app.inject({ method: "GET", url: "/profils/varda" })).statusCode).toBe(404);
  });

  it("le profil dit ce qu'il montre, et rien de la personne", async () => {
    const p = await compte("varda");
    await pousser(p.cookie, [
      { id: "f1", majLe: 1, donnees: { title: "Cléo" } },
      { id: "f2", majLe: 1, donnees: { title: "Le Bonheur" } },
    ]);
    await ouvrir(p.cookie);

    const r = await app.inject({ method: "GET", url: "/profils/varda" });
    expect(r.json()).toMatchObject({ pseudo: "varda", films: 2 });
    expect(Object.keys(r.json())).not.toContain("courriel");
    expect(Object.keys(r.json())).not.toContain("id");
  });
});

describe("suivre", () => {
  it("est un geste qu'on fait seul, et qu'on refait sans dommage", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);

    const un = await app.inject({
      method: "PUT",
      url: "/abonnements/varda",
      headers: { cookie: moi.cookie },
    });
    const deux = await app.inject({
      method: "PUT",
      url: "/abonnements/varda",
      headers: { cookie: moi.cookie },
    });
    expect(un.statusCode).toBe(200);
    expect(deux.statusCode).toBe(200);

    const liste = await app.inject({
      method: "GET",
      url: "/abonnements",
      headers: { cookie: moi.cookie },
    });
    expect(liste.json().subscriptions.map((a: { pseudo: string }) => a.pseudo)).toEqual(["varda"]);
  });

  it("on ne s'abonne pas à un silence", async () => {
    const moi = await compte("moi");
    await compte("discrete");
    const r = await app.inject({
      method: "PUT",
      url: "/abonnements/discrete",
      headers: { cookie: moi.cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  it("on ne se suit pas soi-même", async () => {
    /* Sinon son propre fil se remplit de ce qu'on vient d'écrire. */
    const moi = await compte("moi");
    await ouvrir(moi.cookie);
    const r = await app.inject({
      method: "PUT",
      url: "/abonnements/moi",
      headers: { cookie: moi.cookie },
    });
    expect(r.statusCode).toBe(400);
  });

  it("se désabonner reste possible quand l'autre s'est refermé", async () => {
    /* Passer par le profil public l'aurait rendu impossible — on serait
       abonné à vie à quelqu'un devenu invisible. */
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await app.inject({ method: "PUT", url: "/abonnements/varda", headers: { cookie: moi.cookie } });
    await ouvrir(elle.cookie, "privee");

    const r = await app.inject({
      method: "DELETE",
      url: "/abonnements/varda",
      headers: { cookie: moi.cookie },
    });
    expect(r.statusCode).toBe(200);
    const liste = await app.inject({
      method: "GET",
      url: "/abonnements",
      headers: { cookie: moi.cookie },
    });
    expect(liste.json().subscriptions).toEqual([]);
  });
});

describe("le fil", () => {
  it("ne montre que ce que les gens suivis montrent", async () => {
    const moi = await compte("moi");
    const suivie = await compte("varda");
    const autre = await compte("inconnue");
    await ouvrir(suivie.cookie);
    await ouvrir(autre.cookie);

    await pousser(suivie.cookie, [{ id: "f1", majLe: 1, donnees: { title: "Cléo" } }]);
    await pousser(autre.cookie, [{ id: "f9", majLe: 1, donnees: { title: "Jamais vu" } }]);
    await app.inject({ method: "PUT", url: "/abonnements/varda", headers: { cookie: moi.cookie } });

    const r = await app.inject({ method: "GET", url: "/fil", headers: { cookie: moi.cookie } });
    expect(r.json().nouvelles.map((n: { film: { title: string } }) => n.film.title)).toEqual([
      "Cléo",
    ]);
  });

  it("n'emporte jamais les notes ni le journal", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [
      {
        id: "f1",
        majLe: 1,
        donnees: {
          title: "Cléo",
          review: "la scène du chapeau",
          notes: "SECRET",
          watches: [{ date: "2024-03-02" }],
          watchedAt: "2024-03-02",
        },
      },
    ]);
    await app.inject({ method: "PUT", url: "/abonnements/varda", headers: { cookie: moi.cookie } });

    const film = (
      await app.inject({ method: "GET", url: "/fil", headers: { cookie: moi.cookie } })
    ).json().nouvelles[0].film;
    expect(film.review).toBe("la scène du chapeau");
    expect("notes" in film).toBe(false);
    expect("watches" in film).toBe(false);
    expect("watchedAt" in film).toBe(false);
  });

  it("se tait quand la personne suivie se referme", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [{ id: "f1", majLe: 1, donnees: { title: "Cléo" } }]);
    await app.inject({ method: "PUT", url: "/abonnements/varda", headers: { cookie: moi.cookie } });

    await ouvrir(elle.cookie, "privee");
    const r = await app.inject({ method: "GET", url: "/fil", headers: { cookie: moi.cookie } });
    /* L'abonnement reste : c'est le fil qui se tait, et il reparlera si
       elle rouvre. */
    expect(r.json().nouvelles).toEqual([]);
  });

  it("une fiche écartée n'apparaît pas non plus", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [
      { id: "montrable", majLe: 1, donnees: { title: "Playtime" } },
      { id: "honteuse", majLe: 1, donnees: { title: "coupable" } },
    ]);
    await app.inject({
      method: "PUT",
      url: "/fiche/honteuse/cachee",
      headers: { cookie: elle.cookie },
      payload: { cachee: true },
    });
    await app.inject({ method: "PUT", url: "/abonnements/varda", headers: { cookie: moi.cookie } });

    const titres = (
      await app.inject({ method: "GET", url: "/fil", headers: { cookie: moi.cookie } })
    )
      .json()
      .nouvelles.map((n: { film: { title: string } }) => n.film.title);
    expect(titres).toEqual(["Playtime"]);
  });

  it("se lit page par page, du plus récent au plus ancien", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [{ id: "a", majLe: 1, donnees: { title: "premier" } }]);
    await pousser(elle.cookie, [{ id: "b", majLe: 1, donnees: { title: "second" } }]);
    await app.inject({ method: "PUT", url: "/abonnements/varda", headers: { cookie: moi.cookie } });

    const p1 = await app.inject({ method: "GET", url: "/fil", headers: { cookie: moi.cookie } });
    expect(p1.json().nouvelles.map((n: { film: { title: string } }) => n.film.title)).toEqual([
      "second",
      "premier",
    ]);

    const suite = await app.inject({
      method: "GET",
      url: `/fil?avant=${p1.json().nouvelles[0].id ? p1.json().jusqua : 0}`,
      headers: { cookie: moi.cookie },
    });
    expect(suite.json().nouvelles).toEqual([]);
  });

  it("il faut un compte pour avoir un fil", async () => {
    expect((await app.inject({ method: "GET", url: "/fil" })).statusCode).toBe(401);
  });
});
