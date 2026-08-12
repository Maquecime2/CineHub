import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   CE QUE LA BASE PROMET

   Ces règles-là ne sont pas dans at code du serveur : elles sont dans at
   schéma, et c'est exprès. Une contrainte écrite dans one route se
   contourne by la route suivante ; one contrainte écrite dans la table
   tient quel que soit at chemin. Encore faut-il qu'her tienne — d'où
   ces tests, qui parlent à un vrai Postgres.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

describe("laying the baseline on a database that has already lived", () => {
  it("adds what is missing instead of leaving the table behind", async () => {
    /* CE TEST EXISTE PARCE QUE LE SERVEUR A REFUSÉ DE DÉMARRER.
       `CREATE TABLE IF NOT EXISTS` ne done rien du everything when la table
       est là — pas même addWork one colonne apparue since. Une suite
       qui part toujours d'one base vide ne peut pas s'en apercevoir :
       il faut refaire l'ancienne forme, puis reposer at baseline. */
    const blank = await testDb();
    await blank.exec("DROP TABLE IF EXISTS card;");
    await blank.exec(`
      CREATE TABLE card (
        person_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        id text NOT NULL,
        tmdb_id text,
        visibilite text NOT NULL DEFAULT 'privee',
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted boolean NOT NULL DEFAULT false,
        PRIMARY KEY (person_id, id)
      );`);

    const baseline = await readFile(
      fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
      "utf8"
    );
    await blank.exec(baseline);

    const columns = await blank.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'card'"
    );
    expect(columns.map((c) => c.column_name)).toContain("seq");

    /* Et la table marche vraiment, pas seulement à l'inspection. */
    const p = await store.createPerson(blank, "rivette");
    await store.storeCard(blank, p.id, { id: "f1", data: {}, updatedAt: new Date(1) });
    expect((await store.cardsSince(blank, p.id, 0))[0]!.seq).toBeTruthy();
    await blank.close();
  });
});

describe("the pseudonym", () => {
  it("is unique, and it is the database that settles the race", async () => {
    await store.createPerson(db, "varda");
    await expect(store.createPerson(db, "varda")).rejects.toThrow();
  });

  it("refuses what cannot live in an address", async () => {
    /* Le pseudonyme sera l'adresse d'one collection partagée : il ne
       peut donc pas porter d'espace, de majuscule ni d'accent. */
    for (const mauvais of ["ab", "Varda", "agnès", "two mots", "-varda", "varda-"]) {
      await expect(store.createPerson(db, mauvais)).rejects.toThrow();
    }
    await expect(store.createPerson(db, "agnes-varda")).resolves.toBeTruthy();
  });
});

describe("erasing an account", () => {
  it("carries off everything hanging under it, with no housekeeping routine", async () => {
    const p = await store.createPerson(db, "chris");
    await store.addKey(db, {
      id: "key-1",
      personId: p.id,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
      transports: ["internal"],
    });
    await store.openSession(db, p.id);
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "La Jetée" },
      updatedAt: new Date(1000),
    });

    await store.deletePerson(db, p.id);

    expect(await store.keyById(db, "key-1")).toBeNull();
    const restes = await db.query("SELECT count(*)::int AS n FROM card");
    expect((restes[0] as { n: number }).n).toBe(0);
    const sessions = await db.query("SELECT count(*)::int AS n FROM session");
    expect((sessions[0] as { n: number }).n).toBe(0);
  });
});

describe("a ceremony's challenge", () => {
  it("is consumed once only", async () => {
    const id = await store.setChallenge(db, "hasard", { pseudo: "melville" });
    expect(await store.consumeChallenge(db, id)).toMatchObject({ value: "hasard" });
    /* Une signature interceptée ne doit pas pouvoir resservir. */
    expect(await store.consumeChallenge(db, id)).toBeNull();
  });

  it("goes out on its own as it ages", async () => {
    await db.query(
      "INSERT INTO webauthn_challenge (id, value, expires_at) VALUES ('11111111-1111-1111-1111-111111111111', 'vieux', now() - interval '1 minute')"
    );
    expect(await store.consumeChallenge(db, "11111111-1111-1111-1111-111111111111")).toBeNull();
  });
});

describe("the session", () => {
  it("leaves only a digest in the database, never the secret", async () => {
    const p = await store.createPerson(db, "tarkovski");
    const secret = await store.openSession(db, p.id);

    const rows = await db.query<{ digest: string }>("SELECT digest FROM session");
    expect(rows[0]!.digest).not.toBe(secret);
    /* Une fuite de la table ne donne aucune session utilisable. */
    expect(await store.personOfSession(db, rows[0]!.digest)).toBeNull();
    expect(await store.personOfSession(db, secret)).toMatchObject({ pseudo: "tarkovski" });
  });

  it("expired, it is worth nothing any more", async () => {
    const p = await store.createPerson(db, "kubrick");
    const secret = "secret-a-la-main";
    await db.query(
      "INSERT INTO session (digest, person_id, expires_at) VALUES ($1, $2, now() - interval '1 day')",
      [store.fingerprintOf(secret), p.id]
    );
    expect(await store.personOfSession(db, secret)).toBeNull();
  });
});

describe("filing a card", () => {
  it("the last writer wins, and it is the database that arbitrates", async () => {
    const p = await store.createPerson(db, "akerman");
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "récent" },
      updatedAt: new Date(2000),
    });
    /* Un device en retard push_subscription sa version : her doit être refusée
       sans error, et sans écraser la plus fraîche. */
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "ancien" },
      updatedAt: new Date(1000),
    });

    const cards = await store.cardsSince(db, p.id, 0);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.data).toMatchObject({ title: "récent" });
  });

  it("returns only what has moved since the rank asked for", async () => {
    const p = await store.createPerson(db, "ozu");
    await store.storeCard(db, p.id, { id: "premiere", data: {}, updatedAt: new Date(1000) });
    const everything = await store.cardsSince(db, p.id, 0);
    const curseur = Number(everything[0]!.seq);

    await store.storeCard(db, p.id, { id: "seconde", data: {}, updatedAt: new Date(5000) });
    const bougé = await store.cardsSince(db, p.id, curseur);
    expect(bougé.map((f) => f.id)).toEqual(["seconde"]);
  });

  it("a modified card takes a fresh rank, and goes to the front again", async () => {
    /* Sans cela, her garderait sa place dans la file et les appareils
       déjà passés by là ne la reverraient jamais. */
    const p = await store.createPerson(db, "bresson");
    await store.storeCard(db, p.id, { id: "f1", data: {}, updatedAt: new Date(1000) });
    await store.storeCard(db, p.id, { id: "f2", data: {}, updatedAt: new Date(2000) });
    const apres = Number((await store.cardsSince(db, p.id, 0)).at(-1)!.seq);

    await store.storeCard(db, p.id, {
      id: "f1",
      data: { note: "retouchée" },
      updatedAt: new Date(9000),
    });
    const suite = await store.cardsSince(db, p.id, apres);
    expect(suite.map((f) => f.id)).toEqual(["f1"]);
  });

  it("the rank ignores the devices' clocks, and that is its reason for being", async () => {
    /* UN TÉLÉPHONE EN RETARD D'UNE HEURE. Sa card porte one date plus
       ancienne que everything ce qui précède ; suivre les dates la rendrait
       invisible aux autres appareils, rangée sur at serveur et vue de
       person. Le rang, him, est donné à l'arrivée. */
    const p = await store.createPerson(db, "wenders");
    await store.storeCard(db, p.id, {
      id: "a-l-heure",
      data: {},
      updatedAt: new Date(9_000_000),
    });
    const curseur = Number((await store.cardsSince(db, p.id, 0)).at(-1)!.seq);

    await store.storeCard(db, p.id, { id: "en-retard", data: {}, updatedAt: new Date(1000) });

    const vus = await store.cardsSince(db, p.id, curseur);
    expect(vus.map((f) => f.id)).toEqual(["en-retard"]);
  });

  it("a deletion synchronises instead of disappearing", async () => {
    /* Effacer la ligne ferait revenir la card au prochain envoi de
       l'device qui ne sait pas more. */
    const p = await store.createPerson(db, "resnais");
    await store.storeCard(db, p.id, { id: "f1", data: {}, updatedAt: new Date(1000) });
    await store.storeCard(db, p.id, {
      id: "f1",
      data: {},
      updatedAt: new Date(2000),
      deleted: true,
    });

    const cards = await store.cardsSince(db, p.id, 0);
    expect(cards[0]!.deleted).toBe(true);
    expect(await store.countCards(db, p.id)).toBe(0);
  });

  it("files a json OBJECT, and not a string that looks like one", async () => {
    /* CE TEST EXISTE PARCE QUE LE CONTRAIRE EST ARRIVÉ. Une chaîne
       confiée à one colonne `jsonb` sans conversion explicite est rangée
       telle quelle by certains pilotes : la card se retrouve
       doublement encodée, et everything ce qui la relit reçoit du texte au
       lieu d'un objet. Le défaut ne s'est vu que sur un vrai Postgres —
       d'où cette vérification du TYPE rangé, et non de la value relue,
       qui a l'air juste dans les two cas. */
    const p = await store.createPerson(db, "marker");
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "La Jetée", rating: 5 },
      updatedAt: new Date(1000),
    });

    const t = await db.query<{ type: string }>(
      "SELECT jsonb_typeof(data) AS type FROM card WHERE person_id = $1",
      [p.id]
    );
    expect(t[0]!.type).toBe("object");

    const relue = await store.cardsSince(db, p.id, 0);
    expect(relue[0]!.data).toEqual({ title: "La Jetée", rating: 5 });
  });

  it("two people may name their cards the same", async () => {
    /* L'identifiant vient du client : rien ne garantit qu'il soit unique
       entre two collections, et rien n'a besoin de l'être. */
    const a = await store.createPerson(db, "duras");
    const b = await store.createPerson(db, "godard");
    await store.storeCard(db, a.id, { id: "même", data: { chez: "a" }, updatedAt: new Date(1) });
    await store.storeCard(db, b.id, { id: "même", data: { chez: "b" }, updatedAt: new Date(1) });

    expect((await store.cardsSince(db, a.id, 0))[0]!.data).toMatchObject({
      chez: "a",
    });
  });
});
