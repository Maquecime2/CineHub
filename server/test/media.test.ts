import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { configureMedia, readConnectionString, readPath, allowed } from "../src/media.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES TICKETS D'ACCÈS AUX MÉDIAS

   The container's key never leaves the server: the browser is handed a
   signature for ONE blob, valid a quarter of an hour. So what has to be
   tried here is not Azure — it is WHO GETS A SIGNATURE, which is the
   only thing standing between somebody's screenshots and everybody
   else.

   Two branches, two kinds of proof, and both are tried:

   `p/<person id>/…` — the path IS the proof, and a prefix that is not
   yours gets nothing. This is the simplest guarantee in the whole
   system and the one it would be worst to lose.

   `decor/<id>` — the path proves nothing at all, and the database is
   asked instead. Reading is `canReadDecor`; WRITING is the author and
   nobody else, which is the part a copy must not be allowed to buy.

   And anything falling in neither branch is refused — not because we
   have thought of what else could be asked for, but because we have
   not.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

/* A fake account key: the signature is never checked here, only the
   decision to produce one at all. It is not a secret and stands for
   nothing real. */
const FAUX = Buffer.from("cine-hub-pour-les-tests").toString("base64");
const CHAINE = `DefaultEndpointsProtocol=https;AccountName=cinehub;AccountKey=${FAUX};EndpointSuffix=core.windows.net`;

async function account(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const ticket = (cookie: string, path: string) =>
  app.inject({
    method: "GET",
    url: `/media/ticket?path=${encodeURIComponent(path)}`,
    headers: { cookie },
  });

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
  configureMedia(readConnectionString(CHAINE, "medias"));
});

afterEach(async () => {
  /* The module holds its settings in a module-level variable: left set,
     the next test file would inherit a container it never asked for. */
  configureMedia(null);
  await app.close();
  await db.close();
});

describe("la lecture d'un chemin", () => {
  it("reconnaît les deux branches, et rien d'autre", () => {
    const who = "3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8";
    expect(readPath(`p/${who}/still-abc-1`)).toEqual({
      kind: "private",
      personId: who,
      key: "still-abc-1",
    });
    expect(readPath(`decor/${who}`)).toEqual({ kind: "decor", decorId: who });

    for (const wrong of [
      "",
      "p//x",
      `p/${who}/`,
      `p/${who}/../../secret`,
      `p/pas-un-uuid/x`,
      "decor/pas-un-uuid",
      `decor/${who}/encore`,
      `${who}/x`,
      `p/${who}/${"x".repeat(121)}`,
    ]) {
      expect(readPath(wrong), wrong).toBeNull();
    }
  });

  it("refuse une chaîne de connexion incomplète plutôt que d'en deviner la moitié", () => {
    expect(readConnectionString(undefined, "medias")).toBeNull();
    expect(readConnectionString(CHAINE, undefined)).toBeNull();
    expect(readConnectionString("AccountName=cinehub", "medias")).toBeNull();
    expect(readConnectionString(CHAINE, "medias")?.account).toBe("cinehub");
  });
});

describe("les tickets", () => {
  it("ne parle à personne sans session", async () => {
    for (const [method, url] of [
      ["POST", "/media/tickets"],
      ["GET", "/media/ticket?path=x"],
      ["DELETE", "/media?path=x"],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode, url).toBe(401);
    }
  });

  it("se tait quand aucun container n'est réglé", async () => {
    configureMedia(null);
    const anna = await account("anna");
    const r = await ticket(anna.cookie, `p/${anna.person.id}/une-affiche`);
    expect(r.statusCode).toBe(503);
  });

  it("signe pour son propre préfixe", async () => {
    const anna = await account("anna");
    const r = await app.inject({
      method: "POST",
      url: "/media/tickets",
      headers: { cookie: anna.cookie },
      payload: { paths: [`p/${anna.person.id}/still-abc-1`] },
    });
    expect(r.statusCode).toBe(200);
    const { tickets } = r.json();
    expect(tickets).toHaveLength(1);
    expect(tickets[0].url).toContain("/medias/p/");
    /* Écriture : Azure compte « créer » et « écrire » séparément. */
    expect(tickets[0].url).toMatch(/sp=(?=[^&]*c)(?=[^&]*w)/);
  });

  it("ne signe RIEN pour le préfixe de quelqu'un d'autre", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");

    const vol = await app.inject({
      method: "POST",
      url: "/media/tickets",
      headers: { cookie: bruno.cookie },
      payload: { paths: [`p/${anna.person.id}/still-abc-1`] },
    });
    expect(vol.json().tickets).toEqual([]);
    expect((await ticket(bruno.cookie, `p/${anna.person.id}/still-abc-1`)).statusCode).toBe(404);
  });

  it("écarte un chemin fautif sans couler tout le paquet", async () => {
    const anna = await account("anna");
    const r = await app.inject({
      method: "POST",
      url: "/media/tickets",
      headers: { cookie: anna.cookie },
      payload: {
        paths: [`p/${anna.person.id}/bon`, "n'importe quoi", `p/${anna.person.id}/bon-aussi`],
      },
    });
    /* Cinquante captures partent d'un coup : qu'une seule soit fautive
       vaut un ticket manquant, pas quarante-neuf. */
    expect(r.json().tickets.map((t: { path: string }) => t.path)).toEqual([
      `p/${anna.person.id}/bon`,
      `p/${anna.person.id}/bon-aussi`,
    ]);
  });

  it("refuse un paquet vide ou démesuré", async () => {
    const anna = await account("anna");
    for (const paths of [[], new Array(51).fill(`p/${anna.person.id}/x`), "pas un tableau"]) {
      const r = await app.inject({
        method: "POST",
        url: "/media/tickets",
        headers: { cookie: anna.cookie },
        payload: { paths },
      });
      expect(r.statusCode).toBe(400);
    }
  });
});

describe("les tickets d'un décor", () => {
  it("suivent le droit de le lire, pas le préfixe", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lampe = await store.createDecor(db, { ownerId: anna.person.id, label: "une lampe" });
    const chemin = `decor/${lampe.id}`;

    expect((await ticket(bruno.cookie, chemin)).statusCode).toBe(404);
    await store.editDecor(db, anna.person.id, lampe.id, { is_public: true });
    expect((await ticket(bruno.cookie, chemin)).statusCode).toBe(200);

    /* Et un blocage l'emporte sur la vitrine, jusqu'ici compris. */
    await store.block(db, bruno.person.id, anna.person.id);
    expect((await ticket(bruno.cookie, chemin)).statusCode).toBe(404);
  });

  it("n'ouvrent l'écriture qu'à son auteur — copie comprise", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lampe = await store.createDecor(db, { ownerId: anna.person.id, label: "une lampe" });
    await store.editDecor(db, anna.person.id, lampe.id, { is_public: true });
    await store.copyDecor(db, bruno.person.id, lampe.id);
    const chemin = `decor/${lampe.id}`;

    /* Avoir pris une copie donne le droit de LIRE, jamais celui de
       réécrire la pièce chez son auteur. */
    expect(await allowed(db, bruno.person.id, chemin, "read")).toBe(true);
    expect(await allowed(db, bruno.person.id, chemin, "write")).toBe(false);
    expect(await allowed(db, anna.person.id, chemin, "write")).toBe(true);

    const efface = await app.inject({
      method: "DELETE",
      url: `/media?path=${encodeURIComponent(chemin)}`,
      headers: { cookie: bruno.cookie },
    });
    expect(efface.statusCode).toBe(404);
  });

  it("un décor retiré ne se lit plus, même par son auteur", async () => {
    const anna = await account("anna");
    const lampe = await store.createDecor(db, { ownerId: anna.person.id, label: "une lampe" });
    await store.deleteDecor(db, anna.person.id, lampe.id);
    expect((await ticket(anna.cookie, `decor/${lampe.id}`)).statusCode).toBe(404);
  });
});

describe("le rayon des décors", () => {
  it("crée la ligne AVANT le blob, et rend son chemin", async () => {
    const anna = await account("anna");
    const r = await app.inject({
      method: "POST",
      url: "/decor",
      headers: { cookie: anna.cookie },
      payload: { label: "une lampe", kind: "svg", tintable: true },
    });
    expect(r.statusCode).toBe(201);
    const { decor, path } = r.json();
    /* C'est cette ligne qui donne à l'objet l'identité que deux
       personnes peuvent nommer — le blob suit. */
    expect(path).toBe(`decor/${decor.id}`);
    expect(decor.is_public).toBe(false);
    expect((await ticket(anna.cookie, path)).statusCode).toBe(200);
  });

  it("refuse un nom vide ou une espèce inconnue", async () => {
    const anna = await account("anna");
    for (const payload of [
      { label: "  " },
      { label: "x".repeat(61) },
      { label: "ok", kind: "gif" },
    ]) {
      const r = await app.inject({
        method: "POST",
        url: "/decor",
        headers: { cookie: anna.cookie },
        payload,
      });
      expect(r.statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it("montre le rayon des autres, sans y mettre les siens", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lampe = await store.createDecor(db, { ownerId: anna.person.id, label: "une lampe" });
    await store.editDecor(db, anna.person.id, lampe.id, { is_public: true });
    await store.createDecor(db, { ownerId: bruno.person.id, label: "un cadre" });
    await store.follow(db, bruno.person.id, anna.person.id);

    const chezLesAutres = (
      await app.inject({ method: "GET", url: "/decor/shared", headers: { cookie: bruno.cookie } })
    ).json();
    expect(chezLesAutres.decor.map((d: { label: string }) => d.label)).toEqual(["une lampe"]);

    const chezMoi = (
      await app.inject({ method: "GET", url: "/decor", headers: { cookie: bruno.cookie } })
    ).json();
    expect(chezMoi.decor.map((d: { label: string }) => d.label)).toEqual(["un cadre"]);
  });

  it("distingue reprendre sa copie et retirer sa pièce", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lampe = await store.createDecor(db, { ownerId: anna.person.id, label: "une lampe" });
    await store.editDecor(db, anna.person.id, lampe.id, { is_public: true });

    const prise = await app.inject({
      method: "POST",
      url: `/decor/${lampe.id}/copy`,
      headers: { cookie: bruno.cookie },
    });
    expect(prise.statusCode).toBe(200);

    /* Bruno rend sa copie : l'original ne bouge pas. */
    const rendu = await app.inject({
      method: "DELETE",
      url: `/decor/${lampe.id}`,
      headers: { cookie: bruno.cookie },
    });
    expect(rendu.json().withdrawn).toBe(false);
    expect((await store.decorById(db, lampe.id))?.label).toBe("une lampe");

    /* Anna la retire : la pièce s'en va pour tout le monde. */
    const retrait = await app.inject({
      method: "DELETE",
      url: `/decor/${lampe.id}`,
      headers: { cookie: anna.cookie },
    });
    expect(retrait.json().withdrawn).toBe(true);
    expect(await store.decorById(db, lampe.id)).toBeNull();
  });

  it("ne se renomme pas chez son auteur", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lampe = await store.createDecor(db, { ownerId: anna.person.id, label: "une lampe" });
    await store.editDecor(db, anna.person.id, lampe.id, { is_public: true });
    await store.copyDecor(db, bruno.person.id, lampe.id);

    const r = await app.inject({
      method: "PUT",
      url: `/decor/${lampe.id}`,
      headers: { cookie: bruno.cookie },
      payload: { label: "chez moi" },
    });
    expect(r.statusCode).toBe(404);
    expect((await store.decorById(db, lampe.id))?.label).toBe("une lampe");
  });
});
