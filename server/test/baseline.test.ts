import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   CE QUE LA BASE PROMET

   Ces règles-là ne sont pas dans le code du serveur : elles sont dans le
   schéma, et c'est exprès. Une contrainte écrite dans une route se
   contourne par la route suivante ; une contrainte écrite dans la table
   tient quel que soit le chemin. Encore faut-il qu'elle tienne — d'où
   ces tests, qui parlent à un vrai Postgres.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

describe("poser le socle sur une base qui a déjà vécu", () => {
  it("ajoute ce qui manque au lieu de laisser la table en arrière", async () => {
    /* CE TEST EXISTE PARCE QUE LE SERVEUR A REFUSÉ DE DÉMARRER.
       `CREATE TABLE IF NOT EXISTS` ne fait rien du tout quand la table
       est là — pas même ajouter une colonne apparue depuis. Une suite
       qui part toujours d'une base vide ne peut pas s'en apercevoir :
       il faut refaire l'ancienne forme, puis reposer le socle. */
    const vierge = await testDb();
    await vierge.exec("DROP TABLE IF EXISTS fiche;");
    await vierge.exec(`
      CREATE TABLE fiche (
        personne_id uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
        id text NOT NULL,
        tmdb_id text,
        visibilite text NOT NULL DEFAULT 'privee',
        donnees jsonb NOT NULL,
        maj_le timestamptz NOT NULL,
        supprimee boolean NOT NULL DEFAULT false,
        PRIMARY KEY (personne_id, id)
      );`);

    const socle = await readFile(
      fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
      "utf8"
    );
    await vierge.exec(socle);

    const colonnes = await vierge.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'fiche'"
    );
    expect(colonnes.map((c) => c.column_name)).toContain("seq");

    /* Et la table marche vraiment, pas seulement à l'inspection. */
    const p = await store.createPerson(vierge, "rivette");
    await store.storeCard(vierge, p.id, { id: "f1", donnees: {}, majLe: new Date(1) });
    expect((await store.cardsSince(vierge, p.id, 0))[0]!.seq).toBeTruthy();
    await vierge.close();
  });
});

describe("le pseudonyme", () => {
  it("est unique, et c'est la base qui tranche la course", async () => {
    await store.createPerson(db, "varda");
    await expect(store.createPerson(db, "varda")).rejects.toThrow();
  });

  it("refuse ce qui ne peut pas vivre dans une adresse", async () => {
    /* Le pseudonyme sera l'adresse d'une collection partagée : il ne
       peut donc pas porter d'espace, de majuscule ni d'accent. */
    for (const mauvais of ["ab", "Varda", "agnès", "deux mots", "-varda", "varda-"]) {
      await expect(store.createPerson(db, mauvais)).rejects.toThrow();
    }
    await expect(store.createPerson(db, "agnes-varda")).resolves.toBeTruthy();
  });
});

describe("effacer un compte", () => {
  it("emporte tout ce qui pend dessous, sans routine de ménage", async () => {
    const p = await store.createPerson(db, "chris");
    await store.addKey(db, {
      id: "cle-1",
      personneId: p.id,
      publicKey: new Uint8Array([1, 2, 3]),
      compteur: 0,
      transports: ["internal"],
    });
    await store.openSession(db, p.id);
    await store.storeCard(db, p.id, {
      id: "f1",
      donnees: { title: "La Jetée" },
      majLe: new Date(1000),
    });

    await store.deletePerson(db, p.id);

    expect(await store.keyById(db, "cle-1")).toBeNull();
    const restes = await db.query("SELECT count(*)::int AS n FROM fiche");
    expect((restes[0] as { n: number }).n).toBe(0);
    const sessions = await db.query("SELECT count(*)::int AS n FROM session");
    expect((sessions[0] as { n: number }).n).toBe(0);
  });
});

describe("le défi d'une cérémonie", () => {
  it("ne se consomme qu'une fois", async () => {
    const id = await store.setChallenge(db, "hasard", { pseudo: "melville" });
    expect(await store.consumeChallenge(db, id)).toMatchObject({ valeur: "hasard" });
    /* Une signature interceptée ne doit pas pouvoir resservir. */
    expect(await store.consumeChallenge(db, id)).toBeNull();
  });

  it("s'éteint tout seul en vieillissant", async () => {
    await db.query(
      "INSERT INTO defi (id, valeur, expire_le) VALUES ('11111111-1111-1111-1111-111111111111', 'vieux', now() - interval '1 minute')"
    );
    expect(await store.consumeChallenge(db, "11111111-1111-1111-1111-111111111111")).toBeNull();
  });
});

describe("la session", () => {
  it("ne laisse dans la base qu'une empreinte, jamais le secret", async () => {
    const p = await store.createPerson(db, "tarkovski");
    const secret = await store.openSession(db, p.id);

    const rows = await db.query<{ empreinte: string }>("SELECT empreinte FROM session");
    expect(rows[0]!.empreinte).not.toBe(secret);
    /* Une fuite de la table ne donne aucune session utilisable. */
    expect(await store.personOfSession(db, rows[0]!.empreinte)).toBeNull();
    expect(await store.personOfSession(db, secret)).toMatchObject({ pseudo: "tarkovski" });
  });

  it("expirée, elle ne vaut plus rien", async () => {
    const p = await store.createPerson(db, "kubrick");
    const secret = "secret-a-la-main";
    await db.query(
      "INSERT INTO session (empreinte, personne_id, expire_le) VALUES ($1, $2, now() - interval '1 day')",
      [store.fingerprintOf(secret), p.id]
    );
    expect(await store.personOfSession(db, secret)).toBeNull();
  });
});

describe("ranger une fiche", () => {
  it("le dernier écrivain gagne, et c'est la base qui arbitre", async () => {
    const p = await store.createPerson(db, "akerman");
    await store.storeCard(db, p.id, {
      id: "f1",
      donnees: { title: "récent" },
      majLe: new Date(2000),
    });
    /* Un appareil en retard pousse sa version : elle doit être refusée
       sans erreur, et sans écraser la plus fraîche. */
    await store.storeCard(db, p.id, {
      id: "f1",
      donnees: { title: "ancien" },
      majLe: new Date(1000),
    });

    const fiches = await store.cardsSince(db, p.id, 0);
    expect(fiches).toHaveLength(1);
    expect(fiches[0]!.donnees).toMatchObject({ title: "récent" });
  });

  it("ne rend que ce qui a bougé depuis le rang demandé", async () => {
    const p = await store.createPerson(db, "ozu");
    await store.storeCard(db, p.id, { id: "premiere", donnees: {}, majLe: new Date(1000) });
    const tout = await store.cardsSince(db, p.id, 0);
    const curseur = Number(tout[0]!.seq);

    await store.storeCard(db, p.id, { id: "seconde", donnees: {}, majLe: new Date(5000) });
    const bougé = await store.cardsSince(db, p.id, curseur);
    expect(bougé.map((f) => f.id)).toEqual(["seconde"]);
  });

  it("une fiche modifiée reprend un rang neuf, et repasse devant", async () => {
    /* Sans cela, elle garderait sa place dans la file et les appareils
       déjà passés par là ne la reverraient jamais. */
    const p = await store.createPerson(db, "bresson");
    await store.storeCard(db, p.id, { id: "f1", donnees: {}, majLe: new Date(1000) });
    await store.storeCard(db, p.id, { id: "f2", donnees: {}, majLe: new Date(2000) });
    const apres = Number((await store.cardsSince(db, p.id, 0)).at(-1)!.seq);

    await store.storeCard(db, p.id, {
      id: "f1",
      donnees: { note: "retouchée" },
      majLe: new Date(9000),
    });
    const suite = await store.cardsSince(db, p.id, apres);
    expect(suite.map((f) => f.id)).toEqual(["f1"]);
  });

  it("le rang ignore les horloges des appareils, et c'est sa raison d'être", async () => {
    /* UN TÉLÉPHONE EN RETARD D'UNE HEURE. Sa fiche porte une date plus
       ancienne que tout ce qui précède ; suivre les dates la rendrait
       invisible aux autres appareils, rangée sur le serveur et vue de
       personne. Le rang, lui, est donné à l'arrivée. */
    const p = await store.createPerson(db, "wenders");
    await store.storeCard(db, p.id, {
      id: "a-l-heure",
      donnees: {},
      majLe: new Date(9_000_000),
    });
    const curseur = Number((await store.cardsSince(db, p.id, 0)).at(-1)!.seq);

    await store.storeCard(db, p.id, { id: "en-retard", donnees: {}, majLe: new Date(1000) });

    const vus = await store.cardsSince(db, p.id, curseur);
    expect(vus.map((f) => f.id)).toEqual(["en-retard"]);
  });

  it("une suppression se synchronise au lieu de disparaître", async () => {
    /* Effacer la ligne ferait revenir la fiche au prochain envoi de
       l'appareil qui ne sait pas encore. */
    const p = await store.createPerson(db, "resnais");
    await store.storeCard(db, p.id, { id: "f1", donnees: {}, majLe: new Date(1000) });
    await store.storeCard(db, p.id, {
      id: "f1",
      donnees: {},
      majLe: new Date(2000),
      supprimee: true,
    });

    const fiches = await store.cardsSince(db, p.id, 0);
    expect(fiches[0]!.supprimee).toBe(true);
    expect(await store.countCards(db, p.id)).toBe(0);
  });

  it("range un OBJET json, et non une chaîne qui en a l'air", async () => {
    /* CE TEST EXISTE PARCE QUE LE CONTRAIRE EST ARRIVÉ. Une chaîne
       confiée à une colonne `jsonb` sans conversion explicite est rangée
       telle quelle par certains pilotes : la fiche se retrouve
       doublement encodée, et tout ce qui la relit reçoit du texte au
       lieu d'un objet. Le défaut ne s'est vu que sur un vrai Postgres —
       d'où cette vérification du TYPE rangé, et non de la valeur relue,
       qui a l'air juste dans les deux cas. */
    const p = await store.createPerson(db, "marker");
    await store.storeCard(db, p.id, {
      id: "f1",
      donnees: { title: "La Jetée", rating: 5 },
      majLe: new Date(1000),
    });

    const t = await db.query<{ type: string }>(
      "SELECT jsonb_typeof(donnees) AS type FROM fiche WHERE personne_id = $1",
      [p.id]
    );
    expect(t[0]!.type).toBe("object");

    const relue = await store.cardsSince(db, p.id, 0);
    expect(relue[0]!.donnees).toEqual({ title: "La Jetée", rating: 5 });
  });

  it("deux personnes peuvent nommer leurs fiches pareil", async () => {
    /* L'identifiant vient du client : rien ne garantit qu'il soit unique
       entre deux collections, et rien n'a besoin de l'être. */
    const a = await store.createPerson(db, "duras");
    const b = await store.createPerson(db, "godard");
    await store.storeCard(db, a.id, { id: "même", donnees: { chez: "a" }, majLe: new Date(1) });
    await store.storeCard(db, b.id, { id: "même", donnees: { chez: "b" }, majLe: new Date(1) });

    expect((await store.cardsSince(db, a.id, 0))[0]!.donnees).toMatchObject({
      chez: "a",
    });
  });
});
