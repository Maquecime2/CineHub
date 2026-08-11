import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appDEssai, baseDEssai } from "./aide.ts";
import * as depot from "../src/depot.ts";
import type { Base } from "../src/base.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES LISTES, ET LES DÉFIS QU'ON EN TIRE

   Deux choses s'éprouvent ici, et la seconde compte davantage.

   L'ASYMÉTRIE : co-construire est un droit d'écriture, pas une
   propriété partagée. Un membre ajoute des films ; il ne renomme pas,
   ne publie pas, n'efface pas.

   L'AVANCEMENT SE CALCULE À PARTIR DU JOURNAL DES SÉANCES — celui-là
   même qui ne sort jamais d'une collection partagée. Il ne doit pas en
   sortir davantage ici : un nombre, pour des gens qui ont demandé à
   participer, et rien d'autre.
   ============================================================ */

let base: Base;
let app: FastifyInstance;

async function compte(pseudo: string) {
  const personne = await depot.creerPersonne(base, pseudo);
  const secret = await depot.ouvrirSession(base, personne.id);
  return { personne, cookie: `session=${secret}` };
}

const creerListe = async (cookie: string, corps: Record<string, unknown> = {}) =>
  (
    await app.inject({
      method: "POST",
      url: "/listes",
      headers: { cookie },
      payload: { titre: "Les mois de Varda", ...corps },
    })
  ).json().id as string;

const ajouter = (cookie: string, liste: string, tmdbId: string, titre = "Cléo") =>
  app.inject({
    method: "POST",
    url: `/listes/${liste}/oeuvres`,
    headers: { cookie },
    payload: { tmdbId, titre },
  });

const lireListe = (cookie: string, liste: string) =>
  app.inject({ method: "GET", url: `/listes/${liste}`, headers: { cookie } });

beforeEach(async () => {
  base = await baseDEssai();
  app = await appDEssai(base);
});

afterEach(async () => {
  await app.close();
  await base.fermer();
});

describe("une liste", () => {
  it("est fermée par défaut, et invisible aux autres", async () => {
    const moi = await compte("moi");
    const autre = await compte("autre");
    const id = await creerListe(moi.cookie);

    expect((await lireListe(moi.cookie, id)).json().liste.publique).toBe(false);
    /* Le même 404 que « n'existe pas » : distinguer dirait à un inconnu
       que cet identifiant désigne quelque chose. */
    const refus = await lireListe(autre.cookie, id);
    const fantome = await lireListe(autre.cookie, "00000000-0000-4000-8000-000000000000");
    expect(refus.statusCode).toBe(404);
    expect(refus.json()).toEqual(fantome.json());
  });

  it("contient des œuvres et non des fiches, et jamais deux fois la même", async () => {
    /* Une liste de fiches serait la liste des exemplaires de quelqu'un :
       elle ne voudrait rien dire chez un autre, et se viderait le jour
       où son auteur efface une fiche. */
    const moi = await compte("moi");
    const id = await creerListe(moi.cookie);
    expect((await ajouter(moi.cookie, id, "550")).json().neuf).toBe(true);
    expect((await ajouter(moi.cookie, id, "550")).json().neuf).toBe(false);

    const r = await lireListe(moi.cookie, id);
    expect(r.json().oeuvres).toHaveLength(1);
    expect(r.json().oeuvres[0]).toMatchObject({ tmdb_id: "550", par: "moi" });
  });

  it("refuse ce qui n'est pas un identifiant d'œuvre", async () => {
    const moi = await compte("moi");
    const id = await creerListe(moi.cookie);
    const r = await app.inject({
      method: "POST",
      url: `/listes/${id}/oeuvres`,
      headers: { cookie: moi.cookie },
      payload: { tmdbId: "Cléo de 5 à 7" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("une adresse mal tapée répond 404, et non une panne", async () => {
    const moi = await compte("moi");
    expect((await lireListe(moi.cookie, "pas-un-uuid")).statusCode).toBe(404);
  });
});

describe("co-construire", () => {
  it("laisse écrire, et pas administrer", async () => {
    const moi = await compte("moi");
    const ami = await compte("ami");
    const id = await creerListe(moi.cookie);
    await app.inject({
      method: "PUT",
      url: `/listes/${id}/membres/ami`,
      headers: { cookie: moi.cookie },
    });

    expect((await ajouter(ami.cookie, id, "550")).statusCode).toBe(200);
    /* Sans cette asymétrie, une liste à six mains n'a plus personne
       pour en répondre. */
    const renommer = await app.inject({
      method: "PUT",
      url: `/listes/${id}`,
      headers: { cookie: ami.cookie },
      payload: { titre: "à moi maintenant" },
    });
    const effacer = await app.inject({
      method: "DELETE",
      url: `/listes/${id}`,
      headers: { cookie: ami.cookie },
    });
    expect(renommer.statusCode).toBe(403);
    expect(effacer.statusCode).toBe(403);
  });

  it("on n'invite pas quelqu'un qu'on a fait taire", async () => {
    const moi = await compte("moi");
    await compte("genant");
    const id = await creerListe(moi.cookie);
    await app.inject({ method: "PUT", url: "/blocages/genant", headers: { cookie: moi.cookie } });

    const r = await app.inject({
      method: "PUT",
      url: `/listes/${id}/membres/genant`,
      headers: { cookie: moi.cookie },
    });
    expect(r.statusCode).toBe(404);
  });

  it("partir ne demande la permission de personne", async () => {
    const moi = await compte("moi");
    const ami = await compte("ami");
    const id = await creerListe(moi.cookie);
    await app.inject({
      method: "PUT",
      url: `/listes/${id}/membres/ami`,
      headers: { cookie: moi.cookie },
    });

    const parti = await app.inject({
      method: "DELETE",
      url: `/listes/${id}/membres/ami`,
      headers: { cookie: ami.cookie },
    });
    expect(parti.statusCode).toBe(200);
    expect((await lireListe(ami.cookie, id)).statusCode).toBe(404);
  });

  it("un visiteur d'une liste publique ne lit pas qui la tient", async () => {
    const moi = await compte("moi");
    const ami = await compte("ami");
    const passant = await compte("passant");
    const id = await creerListe(moi.cookie, { publique: true });
    await app.inject({
      method: "PUT",
      url: `/listes/${id}/membres/ami`,
      headers: { cookie: moi.cookie },
    });

    expect((await lireListe(passant.cookie, id)).json().membres).toEqual([]);
    expect((await lireListe(ami.cookie, id)).json().membres).toEqual(["ami"]);
  });
});

describe("un défi", () => {
  const vu = (date: string) => ({ watches: [{ date }] });

  async function defiDEssai() {
    const moi = await compte("moi");
    const liste = await creerListe(moi.cookie);
    await ajouter(moi.cookie, liste, "550");
    await ajouter(moi.cookie, liste, "551");
    const id = (
      await app.inject({
        method: "POST",
        url: "/defis",
        headers: { cookie: moi.cookie },
        payload: { listeId: liste, titre: "Mars", debut: "2026-03-01", fin: "2026-03-31" },
      })
    ).json().id as string;
    return { moi, liste, id };
  }

  it("compte ce qui a été vu PENDANT la période, et rien d'autre", async () => {
    const { moi, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: moi.cookie },
      payload: {
        fiches: [
          { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Cléo", ...vu("2026-03-12") } },
          /* Vu, mais l'an dernier : un défi mensuel qui compterait les
             films vus il y a trois ans serait déjà gagné en s'y
             inscrivant. */
          { id: "b", tmdbId: "551", majLe: 1, donnees: { title: "Autre", ...vu("2025-01-04") } },
        ],
      },
    });

    const r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: moi.cookie },
    });
    expect(r.json().avancement).toEqual([{ pseudo: "moi", faites: 1 }]);
    expect(r.json().defi.oeuvres).toBe(2);
  });

  it("compte aussi les vieilles fiches, d'avant le journal", async () => {
    const { moi, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: moi.cookie },
      payload: {
        fiches: [
          { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Cléo", watchedAt: "2026-03-09" } },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: moi.cookie },
    });
    expect(r.json().avancement[0].faites).toBe(1);
  });

  it("ne tombe pas sur un journal mal formé", async () => {
    /* `watches` traverse des clients de toutes les époques :
       `jsonb_array_elements` sur ce qui n'est pas un tableau ferait
       tomber la requête ENTIÈRE, et l'avancement de tout le monde avec. */
    const { moi, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: moi.cookie },
      payload: {
        fiches: [
          { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Cléo", watches: "autrefois" } },
          { id: "b", tmdbId: "551", majLe: 1, donnees: { title: "Autre", ...vu("2026-03-02") } },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: moi.cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().avancement[0].faites).toBe(1);
  });

  it("ne mesure que ceux qui ont demandé à y être", async () => {
    const { moi, liste, id } = await defiDEssai();
    const autre = await compte("autre");
    await app.inject({
      method: "PUT",
      url: `/listes/${liste}/membres/autre`,
      headers: { cookie: moi.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: autre.cookie },
      payload: {
        fiches: [
          { id: "x", tmdbId: "550", majLe: 1, donnees: { title: "Cléo", ...vu("2026-03-12") } },
        ],
      },
    });

    /* Membre de la liste, mais pas inscrit au défi : son journal n'est
       compté nulle part. */
    let r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: autre.cookie },
    });
    expect(r.json().avancement.map((a: { pseudo: string }) => a.pseudo)).toEqual(["moi"]);

    await app.inject({
      method: "PUT",
      url: `/defis/${id}/participation`,
      headers: { cookie: autre.cookie },
    });
    r = await app.inject({ method: "GET", url: `/defis/${id}`, headers: { cookie: autre.cookie } });
    expect(r.json().avancement).toContainEqual({ pseudo: "autre", faites: 1 });
  });

  it("ne rend jamais le journal lui-même, seulement un nombre", async () => {
    const { moi, id } = await defiDEssai();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: moi.cookie },
      payload: {
        fiches: [
          {
            id: "a",
            tmdbId: "550",
            majLe: 1,
            donnees: { title: "Cléo", notes: "SECRET", ...vu("2026-03-12") },
          },
        ],
      },
    });
    const r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: moi.cookie },
    });
    const texte = JSON.stringify(r.json());
    expect(texte).not.toContain("SECRET");
    expect(texte).not.toContain("2026-03-12");
  });

  it("qui le lance y participe", async () => {
    const { id } = await defiDEssai();
    const liste = (await app.inject({ method: "GET", url: `/defis/${id}` })).statusCode;
    expect(liste).toBe(401);
  });

  it("ne se bâtit pas sur la liste publique d'un inconnu", async () => {
    /* Sinon n'importe qui lance un défi sur la liste de quelqu'un, qui
       le verrait apparaître sans l'avoir voulu. */
    const proprio = await compte("proprio");
    const passant = await compte("passant");
    const liste = await creerListe(proprio.cookie, { publique: true });

    const r = await app.inject({
      method: "POST",
      url: "/defis",
      headers: { cookie: passant.cookie },
      payload: { listeId: liste, titre: "Mars", debut: "2026-03-01", fin: "2026-03-31" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("refuse une fin avant son début", async () => {
    const moi = await compte("moi");
    const liste = await creerListe(moi.cookie);
    const r = await app.inject({
      method: "POST",
      url: "/defis",
      headers: { cookie: moi.cookie },
      payload: { listeId: liste, titre: "À l'envers", debut: "2026-03-31", fin: "2026-03-01" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("se quitte toujours, même quand la liste s'est refermée", async () => {
    const { moi, liste, id } = await defiDEssai();
    const autre = await compte("autre");
    await app.inject({
      method: "PUT",
      url: `/listes/${liste}/membres/autre`,
      headers: { cookie: moi.cookie },
    });
    await app.inject({
      method: "PUT",
      url: `/defis/${id}/participation`,
      headers: { cookie: autre.cookie },
    });
    /* On le renvoie de la liste : il ne peut plus la lire, et se
       trouverait mesuré par un décompte dont il ne peut plus sortir. */
    await app.inject({
      method: "DELETE",
      url: `/listes/${liste}/membres/autre`,
      headers: { cookie: moi.cookie },
    });

    const parti = await app.inject({
      method: "DELETE",
      url: `/defis/${id}/participation`,
      headers: { cookie: autre.cookie },
    });
    expect(parti.statusCode).toBe(200);
    const r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: moi.cookie },
    });
    expect(r.json().avancement.map((a: { pseudo: string }) => a.pseudo)).toEqual(["moi"]);
  });

  it("s'efface avec sa liste", async () => {
    const { moi, liste, id } = await defiDEssai();
    await app.inject({
      method: "DELETE",
      url: `/listes/${liste}`,
      headers: { cookie: moi.cookie },
    });
    const r = await app.inject({
      method: "GET",
      url: `/defis/${id}`,
      headers: { cookie: moi.cookie },
    });
    expect(r.statusCode).toBe(404);
  });
});
