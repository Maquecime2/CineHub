import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appDEssai, baseDEssai } from "./aide.ts";
import * as depot from "../src/depot.ts";
import type { Base } from "../src/base.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   CE QU'ON DIT D'UNE ŒUVRE, ET COMMENT ON S'EN PROTÈGE

   Premier endroit du projet où le texte d'un inconnu peut apparaître
   sous un film qu'on aime. Ce qui se teste ici n'est donc pas
   l'affichage — c'est ce qui NE doit jamais remonter : les notes
   intimes, les collections fermées, les gens qu'on a fait taire.
   ============================================================ */

let base: Base;
let app: FastifyInstance;

async function compte(pseudo: string) {
  const personne = await depot.creerPersonne(base, pseudo);
  const secret = await depot.ouvrirSession(base, personne.id);
  return { personne, cookie: `session=${secret}` };
}

const pousser = (cookie: string, fiches: Record<string, unknown>[]) =>
  app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { fiches } });

const ouvrir = (cookie: string, partage = "publique") =>
  app.inject({ method: "PUT", url: "/partage", headers: { cookie }, payload: { partage } });

const echo = (cookie: string, tmdbId = "550") =>
  app.inject({ method: "GET", url: `/oeuvres/${tmdbId}`, headers: { cookie } });

beforeEach(async () => {
  base = await baseDEssai();
  app = await appDEssai(base);
});

afterEach(async () => {
  await app.close();
  await base.fermer();
});

describe("l'écho d'une œuvre", () => {
  it("rassemble ceux qui ont rangé le même film, et personne d'autre", async () => {
    const moi = await compte("moi");
    const une = await compte("varda");
    const deux = await compte("tati");
    await ouvrir(une.cookie);
    await ouvrir(deux.cookie);

    await pousser(une.cookie, [
      { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: 4 } },
      { id: "z", tmdbId: "999", majLe: 1, donnees: { title: "Autre film", rating: 1 } },
    ]);
    await pousser(deux.cookie, [
      { id: "b", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: 5 } },
    ]);

    const r = (await echo(moi.cookie)).json();
    expect(r.collections).toBe(2);
    expect(r.moyenne).toBe(4.5);
    expect(r.avis.map((a: { pseudo: string }) => a.pseudo).sort()).toEqual(["tati", "varda"]);
  });

  it("ne lit rien d'une collection qui n'est pas publique", async () => {
    const moi = await compte("moi");
    const discrete = await compte("discrete");
    await pousser(discrete.cookie, [
      { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", review: "PRIVÉ" } },
    ]);

    const r = (await echo(moi.cookie)).json();
    expect(r.collections).toBe(0);
    expect(r.avis).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("PRIVÉ");
  });

  it("n'emporte jamais les notes ni le journal", async () => {
    /* Le fragment `SANS_LE_PRIVE` ne sert pas ici : cette requête choisit
       ses champs un à un. Le vérifier séparément est donc nécessaire —
       c'est exactement le genre de filtre qu'une seconde route oublie. */
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [
      {
        id: "a",
        tmdbId: "550",
        majLe: 1,
        donnees: {
          title: "Fight Club",
          rating: 4,
          review: "la scène du savon",
          notes: "SECRET",
          watches: [{ date: "2024-03-02" }],
          watchedAt: "2024-03-02",
        },
      },
    ]);

    const r = (await echo(moi.cookie)).json();
    expect(r.avis[0].critique).toBe("la scène du savon");
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(JSON.stringify(r)).not.toContain("2024-03-02");
  });

  it("ne me rend pas mon propre avis", async () => {
    /* Sinon la moyenne « des autres » contient ma voix, et je me lis
       moi-même en croyant lire quelqu'un. */
    const moi = await compte("moi");
    await ouvrir(moi.cookie);
    await pousser(moi.cookie, [
      { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: 5 } },
    ]);

    const r = (await echo(moi.cookie)).json();
    expect(r.collections).toBe(0);
    expect(r.moyenne).toBe(null);
  });

  it("une fiche écartée du partage ne dit rien non plus", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [
      { id: "honteuse", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: 5 } },
    ]);
    await app.inject({
      method: "PUT",
      url: "/fiche/honteuse/cachee",
      headers: { cookie: elle.cookie },
      payload: { cachee: true },
    });

    expect((await echo(moi.cookie)).json().collections).toBe(0);
  });

  it("une note illisible ne fait pas tomber la moyenne des autres", async () => {
    /* `rating` traverse six cents clients et d'anciennes versions : il
       arrive vide, ou en toutes lettres. Un `::numeric` direct ferait
       échouer la requête ENTIÈRE — la moyenne de tout le monde perdue
       pour une seule vieille fiche. */
    const moi = await compte("moi");
    const cassee = await compte("cassee");
    const saine = await compte("saine");
    await ouvrir(cassee.cookie);
    await ouvrir(saine.cookie);
    await pousser(cassee.cookie, [
      { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: "" } },
    ]);
    await pousser(saine.cookie, [
      { id: "b", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: "3" } },
    ]);

    const r = (await echo(moi.cookie)).json();
    expect(r.collections).toBe(2);
    expect(r.notes).toBe(1);
    expect(r.moyenne).toBe(3);
  });

  it("une fiche qui ne dit rien compte sans se lire", async () => {
    const moi = await compte("moi");
    const elle = await compte("varda");
    await ouvrir(elle.cookie);
    await pousser(elle.cookie, [
      { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club" } },
    ]);

    const r = (await echo(moi.cookie)).json();
    expect(r.collections).toBe(1);
    expect(r.avis).toEqual([]);
  });

  it("il faut un compte, et un identifiant d'œuvre qui en soit un", async () => {
    const moi = await compte("moi");
    expect((await app.inject({ method: "GET", url: "/oeuvres/550" })).statusCode).toBe(401);
    expect((await echo(moi.cookie, "550;DROP")).statusCode).toBe(400);
  });
});

describe("bloquer", () => {
  it("coupe des deux côtés, même déclaré d'un seul", async () => {
    const moi = await compte("moi");
    const genant = await compte("genant");
    await ouvrir(moi.cookie);
    await ouvrir(genant.cookie);
    await pousser(moi.cookie, [
      { id: "a", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: 5 } },
    ]);
    await pousser(genant.cookie, [
      { id: "b", tmdbId: "550", majLe: 1, donnees: { title: "Fight Club", rating: 1 } },
    ]);

    await app.inject({ method: "PUT", url: "/blocages/genant", headers: { cookie: moi.cookie } });

    expect((await echo(moi.cookie)).json().collections).toBe(0);
    /* Et lui non plus ne me lit plus : un blocage à sens unique laisse
       l'autre continuer de lire, de répondre et de recommencer. */
    expect((await echo(genant.cookie)).json().collections).toBe(0);
  });

  it("rend introuvable, sans dire qu'on est bloqué", async () => {
    const moi = await compte("moi");
    const genant = await compte("genant");
    await ouvrir(genant.cookie);
    await app.inject({ method: "PUT", url: "/blocages/genant", headers: { cookie: moi.cookie } });

    const bloque = await app.inject({
      method: "GET",
      url: "/profils/genant",
      headers: { cookie: moi.cookie },
    });
    const inconnu = await app.inject({
      method: "GET",
      url: "/profils/jamais-vue",
      headers: { cookie: moi.cookie },
    });
    expect(bloque.statusCode).toBe(inconnu.statusCode);
    expect(bloque.json()).toEqual(inconnu.json());
  });

  it("défait les abonnements des deux côtés", async () => {
    const moi = await compte("moi");
    const genant = await compte("genant");
    await ouvrir(moi.cookie);
    await ouvrir(genant.cookie);
    await app.inject({
      method: "PUT",
      url: "/abonnements/genant",
      headers: { cookie: moi.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/abonnements/moi",
      headers: { cookie: genant.cookie },
    });

    await app.inject({ method: "PUT", url: "/blocages/genant", headers: { cookie: moi.cookie } });

    const mien = await app.inject({
      method: "GET",
      url: "/abonnements",
      headers: { cookie: moi.cookie },
    });
    const sien = await app.inject({
      method: "GET",
      url: "/abonnements",
      headers: { cookie: genant.cookie },
    });
    expect(mien.json().abonnements).toEqual([]);
    expect(sien.json().abonnements).toEqual([]);
  });

  it("empêche de suivre, et le fil se tait", async () => {
    const moi = await compte("moi");
    const genant = await compte("genant");
    await ouvrir(genant.cookie);
    await pousser(genant.cookie, [{ id: "b", majLe: 1, donnees: { title: "Cléo" } }]);
    await app.inject({
      method: "PUT",
      url: "/abonnements/genant",
      headers: { cookie: moi.cookie },
    });
    await app.inject({ method: "PUT", url: "/blocages/genant", headers: { cookie: moi.cookie } });

    const suivre = await app.inject({
      method: "PUT",
      url: "/abonnements/genant",
      headers: { cookie: moi.cookie },
    });
    expect(suivre.statusCode).toBe(404);
    const fil = await app.inject({ method: "GET", url: "/fil", headers: { cookie: moi.cookie } });
    expect(fil.json().nouvelles).toEqual([]);
  });

  it("se défait, et ne réabonne à personne", async () => {
    const moi = await compte("moi");
    const lui = await compte("lui");
    await ouvrir(lui.cookie);
    await app.inject({ method: "PUT", url: "/abonnements/lui", headers: { cookie: moi.cookie } });
    await app.inject({ method: "PUT", url: "/blocages/lui", headers: { cookie: moi.cookie } });
    await app.inject({ method: "DELETE", url: "/blocages/lui", headers: { cookie: moi.cookie } });

    expect(
      (
        await app.inject({ method: "GET", url: "/blocages", headers: { cookie: moi.cookie } })
      ).json().blocages
    ).toEqual([]);
    const liste = await app.inject({
      method: "GET",
      url: "/abonnements",
      headers: { cookie: moi.cookie },
    });
    expect(liste.json().abonnements).toEqual([]);
    /* Le profil est de nouveau trouvable : le silence était réversible. */
    expect(
      (await app.inject({ method: "GET", url: "/profils/lui", headers: { cookie: moi.cookie } }))
        .statusCode
    ).toBe(200);
  });

  it("reste possible quand l'autre s'est refermé, et sur soi jamais", async () => {
    const moi = await compte("moi");
    const lui = await compte("lui");
    /* `lui` n'a jamais rien partagé : passer par le profil public
       rendrait inbloquable quiconque se referme, puis ressort. */
    expect(
      (await app.inject({ method: "PUT", url: "/blocages/lui", headers: { cookie: moi.cookie } }))
        .statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "PUT", url: "/blocages/moi", headers: { cookie: moi.cookie } }))
        .statusCode
    ).toBe(400);
    expect(lui).toBeTruthy();
  });

  it("ne cache pas une collection dont on a l'adresse", async () => {
    /* Un blocage est un silence, pas un mur. Le dire ici évite de
       promettre une protection qui n'existe pas. */
    const moi = await compte("moi");
    const lui = await compte("lui");
    await ouvrir(lui.cookie);
    await app.inject({ method: "PUT", url: "/blocages/lui", headers: { cookie: moi.cookie } });
    expect((await app.inject({ method: "GET", url: "/chez/lui" })).statusCode).toBe(200);
  });
});

describe("signaler", () => {
  it("garde le signalement, et ne le compte qu'une fois", async () => {
    const moi = await compte("moi");
    const lui = await compte("lui");
    const corps = { pseudo: "lui", fiche: "a", motif: "propos haineux" };

    const un = await app.inject({
      method: "POST",
      url: "/signalements",
      headers: { cookie: moi.cookie },
      payload: corps,
    });
    const deux = await app.inject({
      method: "POST",
      url: "/signalements",
      headers: { cookie: moi.cookie },
      payload: corps,
    });
    expect(un.json()).toMatchObject({ note: true, neuf: true });
    /* La même réponse extérieure : savoir qu'on avait déjà signalé
       n'apporte rien à qui vient de le faire. */
    expect(deux.statusCode).toBe(200);
    expect(deux.json().note).toBe(true);

    const lignes = await base.requete<{ motif: string; vise_id: string }>(
      "SELECT motif, vise_id FROM signalement"
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.vise_id).toBe(lui.personne.id);
  });

  it("veut un motif, et une personne qui existe", async () => {
    const moi = await compte("moi");
    await compte("lui");
    const vide = await app.inject({
      method: "POST",
      url: "/signalements",
      headers: { cookie: moi.cookie },
      payload: { pseudo: "lui", fiche: "a", motif: "   " },
    });
    const fantome = await app.inject({
      method: "POST",
      url: "/signalements",
      headers: { cookie: moi.cookie },
      payload: { pseudo: "fantome", fiche: "a", motif: "quelque chose" },
    });
    expect(vide.statusCode).toBe(400);
    expect(fantome.statusCode).toBe(404);
  });

  it("survit à l'effacement de la fiche signalée, et pas à celui du compte", async () => {
    /* Le signalé est une colonne et non une déduction : une fiche
       effacée entre-temps emporterait sinon la seule chose qui rendait
       le signalement exploitable. Un compte effacé, lui, doit tout
       emporter — c'est le droit à l'effacement, et il prime. */
    const moi = await compte("moi");
    const lui = await compte("lui");
    await app.inject({
      method: "POST",
      url: "/signalements",
      headers: { cookie: moi.cookie },
      payload: { pseudo: "lui", fiche: "a", motif: "propos haineux" },
    });

    await app.inject({ method: "DELETE", url: "/mon-compte", headers: { cookie: lui.cookie } });
    expect(await base.requete("SELECT 1 FROM signalement")).toHaveLength(0);
  });
});
