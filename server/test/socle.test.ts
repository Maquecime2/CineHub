import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { baseDEssai } from "./aide.ts";
import * as depot from "../src/depot.ts";
import type { Base } from "../src/base.ts";

/* ============================================================
   CE QUE LA BASE PROMET

   Ces règles-là ne sont pas dans le code du serveur : elles sont dans le
   schéma, et c'est exprès. Une contrainte écrite dans une route se
   contourne par la route suivante ; une contrainte écrite dans la table
   tient quel que soit le chemin. Encore faut-il qu'elle tienne — d'où
   ces tests, qui parlent à un vrai Postgres.
   ============================================================ */

let base: Base;
beforeEach(async () => {
  base = await baseDEssai();
});
afterEach(async () => {
  await base.fermer();
});

describe("le pseudonyme", () => {
  it("est unique, et c'est la base qui tranche la course", async () => {
    await depot.creerPersonne(base, "varda");
    await expect(depot.creerPersonne(base, "varda")).rejects.toThrow();
  });

  it("refuse ce qui ne peut pas vivre dans une adresse", async () => {
    /* Le pseudonyme sera l'adresse d'une collection partagée : il ne
       peut donc pas porter d'espace, de majuscule ni d'accent. */
    for (const mauvais of ["ab", "Varda", "agnès", "deux mots", "-varda", "varda-"]) {
      await expect(depot.creerPersonne(base, mauvais)).rejects.toThrow();
    }
    await expect(depot.creerPersonne(base, "agnes-varda")).resolves.toBeTruthy();
  });
});

describe("effacer un compte", () => {
  it("emporte tout ce qui pend dessous, sans routine de ménage", async () => {
    const p = await depot.creerPersonne(base, "chris");
    await depot.ajouterCle(base, {
      id: "cle-1",
      personneId: p.id,
      clePublique: new Uint8Array([1, 2, 3]),
      compteur: 0,
      transports: ["internal"],
    });
    await depot.ouvrirSession(base, p.id);
    await depot.rangerFiche(base, p.id, {
      id: "f1",
      donnees: { title: "La Jetée" },
      majLe: new Date(1000),
    });

    await depot.effacerPersonne(base, p.id);

    expect(await depot.cleParId(base, "cle-1")).toBeNull();
    const restes = await base.requete("SELECT count(*)::int AS n FROM fiche");
    expect((restes[0] as { n: number }).n).toBe(0);
    const sessions = await base.requete("SELECT count(*)::int AS n FROM session");
    expect((sessions[0] as { n: number }).n).toBe(0);
  });
});

describe("le défi d'une cérémonie", () => {
  it("ne se consomme qu'une fois", async () => {
    const id = await depot.poserDefi(base, "hasard", { pseudo: "melville" });
    expect(await depot.consommerDefi(base, id)).toMatchObject({ valeur: "hasard" });
    /* Une signature interceptée ne doit pas pouvoir resservir. */
    expect(await depot.consommerDefi(base, id)).toBeNull();
  });

  it("s'éteint tout seul en vieillissant", async () => {
    await base.requete(
      "INSERT INTO defi (id, valeur, expire_le) VALUES ('11111111-1111-1111-1111-111111111111', 'vieux', now() - interval '1 minute')"
    );
    expect(await depot.consommerDefi(base, "11111111-1111-1111-1111-111111111111")).toBeNull();
  });
});

describe("la session", () => {
  it("ne laisse dans la base qu'une empreinte, jamais le secret", async () => {
    const p = await depot.creerPersonne(base, "tarkovski");
    const secret = await depot.ouvrirSession(base, p.id);

    const lignes = await base.requete<{ empreinte: string }>("SELECT empreinte FROM session");
    expect(lignes[0]!.empreinte).not.toBe(secret);
    /* Une fuite de la table ne donne aucune session utilisable. */
    expect(await depot.personneDeSession(base, lignes[0]!.empreinte)).toBeNull();
    expect(await depot.personneDeSession(base, secret)).toMatchObject({ pseudo: "tarkovski" });
  });

  it("expirée, elle ne vaut plus rien", async () => {
    const p = await depot.creerPersonne(base, "kubrick");
    const secret = "secret-a-la-main";
    await base.requete(
      "INSERT INTO session (empreinte, personne_id, expire_le) VALUES ($1, $2, now() - interval '1 day')",
      [depot.empreinteDe(secret), p.id]
    );
    expect(await depot.personneDeSession(base, secret)).toBeNull();
  });
});

describe("ranger une fiche", () => {
  it("le dernier écrivain gagne, et c'est la base qui arbitre", async () => {
    const p = await depot.creerPersonne(base, "akerman");
    await depot.rangerFiche(base, p.id, {
      id: "f1",
      donnees: { title: "récent" },
      majLe: new Date(2000),
    });
    /* Un appareil en retard pousse sa version : elle doit être refusée
       sans erreur, et sans écraser la plus fraîche. */
    await depot.rangerFiche(base, p.id, {
      id: "f1",
      donnees: { title: "ancien" },
      majLe: new Date(1000),
    });

    const fiches = await depot.fichesDepuis(base, p.id, new Date(0));
    expect(fiches).toHaveLength(1);
    expect(fiches[0]!.donnees).toMatchObject({ title: "récent" });
  });

  it("ne rend que ce qui a bougé depuis la date demandée", async () => {
    const p = await depot.creerPersonne(base, "ozu");
    await depot.rangerFiche(base, p.id, { id: "vieille", donnees: {}, majLe: new Date(1000) });
    await depot.rangerFiche(base, p.id, { id: "neuve", donnees: {}, majLe: new Date(5000) });

    const bougé = await depot.fichesDepuis(base, p.id, new Date(2000));
    expect(bougé.map((f) => f.id)).toEqual(["neuve"]);
  });

  it("une suppression se synchronise au lieu de disparaître", async () => {
    /* Effacer la ligne ferait revenir la fiche au prochain envoi de
       l'appareil qui ne sait pas encore. */
    const p = await depot.creerPersonne(base, "resnais");
    await depot.rangerFiche(base, p.id, { id: "f1", donnees: {}, majLe: new Date(1000) });
    await depot.rangerFiche(base, p.id, {
      id: "f1",
      donnees: {},
      majLe: new Date(2000),
      supprimee: true,
    });

    const fiches = await depot.fichesDepuis(base, p.id, new Date(0));
    expect(fiches[0]!.supprimee).toBe(true);
    expect(await depot.compterFiches(base, p.id)).toBe(0);
  });

  it("deux personnes peuvent nommer leurs fiches pareil", async () => {
    /* L'identifiant vient du client : rien ne garantit qu'il soit unique
       entre deux collections, et rien n'a besoin de l'être. */
    const a = await depot.creerPersonne(base, "duras");
    const b = await depot.creerPersonne(base, "godard");
    await depot.rangerFiche(base, a.id, { id: "même", donnees: { chez: "a" }, majLe: new Date(1) });
    await depot.rangerFiche(base, b.id, { id: "même", donnees: { chez: "b" }, majLe: new Date(1) });

    expect((await depot.fichesDepuis(base, a.id, new Date(0)))[0]!.donnees).toMatchObject({
      chez: "a",
    });
  });
});
