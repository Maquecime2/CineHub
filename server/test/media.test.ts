import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { configureMedia, readConnectionString, readPath, allowed } from "../src/media.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE MEDIA ACCESS TICKETS

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
const FAKE = Buffer.from("cine-hub-for-the-tests").toString("base64");
const STRING = `DefaultEndpointsProtocol=https;AccountName=cinehub;AccountKey=${FAKE};EndpointSuffix=core.windows.net`;

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
  configureMedia(readConnectionString(STRING, "media"));
});

afterEach(async () => {
  /* The module holds its settings in a module-level variable: left set,
     the next test file would inherit a container it never asked for. */
  configureMedia(null);
  await app.close();
  await db.close();
});

describe("reading a path", () => {
  it("recognises the three branches, and nothing else", () => {
    const who = "3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8";
    expect(readPath(`p/${who}/still-abc-1`)).toEqual({
      kind: "private",
      personId: who,
      key: "still-abc-1",
    });
    expect(readPath(`decor/${who}`)).toEqual({ kind: "decor", decorId: who });
    expect(readPath(`bank/${who}/question-1`)).toEqual({
      kind: "bank",
      categoryId: who,
      key: "question-1",
    });
    /* LA BRANCHE DES IMAGES DE FIN DE PARTIE. Quatre cles fixes, une
       par palier, et le mot est ECRIT DANS LA REGEX comme `decor` et
       `sticker` : `bank/<n'importe quoi>` rendrait la branche
       extensible par le client, ce qui est precisement ce que la regle
       « tout ce qui ne tombe dans aucune branche est refuse » evite. */
    expect(readPath("bank/cheer/perfect")).toEqual({
      kind: "bank",
      categoryId: "cheer",
      key: "perfect",
    });

    for (const wrong of [
      "",
      "p//x",
      `p/${who}/`,
      `p/${who}/../../secret`,
      `p/not-a-uuid/x`,
      "decor/not-a-uuid",
      `decor/${who}/more`,
      "bank/not-a-uuid/x",
      /* Un mot voisin n'ouvre rien : la liste est close. */
      "bank/cheers/perfect",
      "bank/cheer",
      "bank/cheer/",
      `bank/${who}`,
      `bank/${who}/`,
      `bank/${who}/../../secret`,
      `${who}/x`,
      `p/${who}/${"x".repeat(121)}`,
    ]) {
      expect(readPath(wrong), wrong).toBeNull();
    }
  });

  it("refuses an incomplete connection string rather than guessing half of it", () => {
    expect(readConnectionString(undefined, "media")).toBeNull();
    expect(readConnectionString(STRING, undefined)).toBeNull();
    expect(readConnectionString("AccountName=cinehub", "media")).toBeNull();
    expect(readConnectionString(STRING, "media")?.account).toBe("cinehub");
  });
});

describe("the tickets", () => {
  it("speaks to nobody without a session", async () => {
    for (const [method, url] of [
      ["POST", "/media/tickets"],
      ["GET", "/media/ticket?path=x"],
      ["DELETE", "/media?path=x"],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode, url).toBe(401);
    }
  });

  it("stays quiet when no container is set", async () => {
    configureMedia(null);
    const anna = await account("anna");
    const r = await ticket(anna.cookie, `p/${anna.person.id}/a-poster`);
    expect(r.statusCode).toBe(503);
  });

  it("signs for one's own prefix", async () => {
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
    expect(tickets[0].url).toContain("/media/p/");
    /* Writing: Azure counts "create" and "write" separately. */
    expect(tickets[0].url).toMatch(/sp=(?=[^&]*c)(?=[^&]*w)/);
  });

  it("signs NOTHING for somebody else's prefix", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");

    const theft = await app.inject({
      method: "POST",
      url: "/media/tickets",
      headers: { cookie: bruno.cookie },
      payload: { paths: [`p/${anna.person.id}/still-abc-1`] },
    });
    expect(theft.json().tickets).toEqual([]);
    expect((await ticket(bruno.cookie, `p/${anna.person.id}/still-abc-1`)).statusCode).toBe(404);
  });

  it("sets a faulty path aside without sinking the whole batch", async () => {
    const anna = await account("anna");
    const r = await app.inject({
      method: "POST",
      url: "/media/tickets",
      headers: { cookie: anna.cookie },
      payload: {
        paths: [`p/${anna.person.id}/good`, "anything at all", `p/${anna.person.id}/good-too`],
      },
    });
    /* Fifty screenshots go up at once: one of them being wrong is worth
       one missing ticket, not forty-nine. */
    expect(r.json().tickets.map((t: { path: string }) => t.path)).toEqual([
      `p/${anna.person.id}/good`,
      `p/${anna.person.id}/good-too`,
    ]);
  });

  it("refuses an empty or outsized batch", async () => {
    const anna = await account("anna");
    for (const paths of [[], new Array(51).fill(`p/${anna.person.id}/x`), "not an array"]) {
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

describe("a decor's tickets", () => {
  it("follow the right to read it, not the prefix", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    const path = `decor/${lamp.id}`;

    expect((await ticket(bruno.cookie, path)).statusCode).toBe(404);
    await store.editDecor(db, anna.person.id, lamp.id, { is_public: true });
    expect((await ticket(bruno.cookie, path)).statusCode).toBe(200);

    /* And a block beats the display, here included. */
    await store.block(db, bruno.person.id, anna.person.id);
    expect((await ticket(bruno.cookie, path)).statusCode).toBe(404);
  });

  it("open writing to its author alone — a copy included", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    await store.editDecor(db, anna.person.id, lamp.id, { is_public: true });
    await store.copyDecor(db, bruno.person.id, lamp.id);
    const path = `decor/${lamp.id}`;

    /* Having taken a copy gives the right to READ, never the right to
       rewrite the piece at its author's. */
    expect(await allowed(db, bruno.person.id, path, "read")).toBe(true);
    expect(await allowed(db, bruno.person.id, path, "write")).toBe(false);
    expect(await allowed(db, anna.person.id, path, "write")).toBe(true);

    const erase = await app.inject({
      method: "DELETE",
      url: `/media?path=${encodeURIComponent(path)}`,
      headers: { cookie: bruno.cookie },
    });
    expect(erase.statusCode).toBe(404);
  });

  it("a withdrawn decor is no longer read, even by its author", async () => {
    const anna = await account("anna");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    await store.deleteDecor(db, anna.person.id, lamp.id);
    expect((await ticket(anna.cookie, `decor/${lamp.id}`)).statusCode).toBe(404);
  });
});

describe("the bank's tickets", () => {
  /* THE WHOLE POINT OF THE THIRD PREFIX, in one test: a picture written
     by an admin is READ by everybody who draws it. Under `p/<anna>/…`
     this would have meant signing on somebody else's private prefix, and
     the simplest guarantee in the system would have gone with it. */
  it("open reading to any account, and writing to an admin", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    await store.markAdmins(db, ["anna"]);
    const category = await store.createCategory(db, { label: "nouvelle vague" });
    const path = `bank/${category}/question-1`;

    /* Common stock: bruno has drawn nothing yet and reads it all the
       same. There is no secret in a film poster, and the alternative was
       a second permission system guarding one. */
    expect((await ticket(bruno.cookie, path)).statusCode).toBe(200);
    expect((await ticket(anna.cookie, path)).statusCode).toBe(200);

    expect(await allowed(db, anna.person.id, path, "write")).toBe(true);
    expect(await allowed(db, bruno.person.id, path, "write")).toBe(false);
  });

  it("garde les images de fin de partie du meme cote que le reste du stock", async () => {
    /* MEME BRANCHE, MEMES REGLES, ET C'EST TOUT L'INTERET DE N'AVOIR
       AJOUTE QU'UN MOT : tout compte les lit — l'ecran de fin d'une
       partie ne demande rien a personne — et seul le role les depose.
       Une cinquieme branche aurait demande a `allowed` une decision de
       plus, pour la meme reponse. */
    const anna = await account("anna");
    const bruno = await account("bruno");
    await store.markAdmins(db, ["anna"]);
    const path = "bank/cheer/perfect";

    expect((await ticket(bruno.cookie, path)).statusCode).toBe(200);
    expect(await allowed(db, anna.person.id, path, "write")).toBe(true);
    expect(await allowed(db, bruno.person.id, path, "write")).toBe(false);
  });

  it("takes the writing back with the role", async () => {
    const anna = await account("anna");
    await store.markAdmins(db, ["anna"]);
    const category = await store.createCategory(db, { label: "nouvelle vague" });
    const path = `bank/${category}/question-1`;

    expect(await allowed(db, anna.person.id, path, "write")).toBe(true);
    await db.query("UPDATE person SET is_admin = false WHERE pseudo = 'anna'");
    expect(await allowed(db, anna.person.id, path, "write")).toBe(false);
    expect(await allowed(db, anna.person.id, path, "read")).toBe(true);
  });
});

describe("the decor shelf", () => {
  /* LA PORTE D'ENTRÉE EST FERMÉE, ET C'EST CE QU'ON ÉPROUVE.

     `POST /decor` créait la ligne, puis le classeur demandait un ticket
     d'écriture et envoyait l'image : c'était la SEULE façon dont un
     bibelot entrait. Les objets neufs sortent maintenant d'une pochette,
     tirés par le serveur.

     Une route retirée ne casse aucun test tant que personne n'écrit
     celui-ci : le client cesse simplement de l'appeler, et la route
     survit des mois en attendant qu'on s'en aperçoive. Ici, elle doit
     répondre 404, et si elle revient un jour, cette ligne le dira. */
  it("n'a plus de porte pour déposer un objet", async () => {
    const anna = await account("anna");
    const r = await app.inject({
      method: "POST",
      url: "/decor",
      headers: { cookie: anna.cookie },
      payload: { label: "a lamp", kind: "svg", tintable: true },
    });
    expect(r.statusCode).toBe(404);
  });

  /* ET TOUT LE RESTE TIENT. Fermer l'entrée n'est pas vider la pièce :
     ce qui a été déposé se lit, se partage, se prend en copie et
     s'efface comme avant. Un ticket d'écriture reste signé pour un objet
     qu'on possède — remplacer l'image d'un bibelot qu'on a déjà n'est
     pas en déposer un neuf, et la synchronisation d'un second appareil
     en dépend. */
  it("laisse lire, et signer, ce qui est déjà là", async () => {
    const anna = await account("anna");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    expect((await ticket(anna.cookie, `decor/${lamp.id}`)).statusCode).toBe(200);
  });

  it("shows other people's shelf, without putting one's own on it", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    await store.editDecor(db, anna.person.id, lamp.id, { is_public: true });
    await store.createDecor(db, { ownerId: bruno.person.id, label: "a frame" });
    await store.follow(db, bruno.person.id, anna.person.id);

    const elsewhere = (
      await app.inject({ method: "GET", url: "/decor/shared", headers: { cookie: bruno.cookie } })
    ).json();
    expect(elsewhere.decor.map((d: { label: string }) => d.label)).toEqual(["a lamp"]);

    const mine = (
      await app.inject({ method: "GET", url: "/decor", headers: { cookie: bruno.cookie } })
    ).json();
    expect(mine.decor.map((d: { label: string }) => d.label)).toEqual(["a frame"]);
  });

  it("tells giving back a copy from withdrawing a piece", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    await store.editDecor(db, anna.person.id, lamp.id, { is_public: true });

    const taken = await app.inject({
      method: "POST",
      url: `/decor/${lamp.id}/copy`,
      headers: { cookie: bruno.cookie },
    });
    expect(taken.statusCode).toBe(200);

    /* Bruno gives his copy back: the original does not move. */
    const given = await app.inject({
      method: "DELETE",
      url: `/decor/${lamp.id}`,
      headers: { cookie: bruno.cookie },
    });
    expect(given.json().withdrawn).toBe(false);
    expect((await store.decorById(db, lamp.id))?.label).toBe("a lamp");

    /* Anna withdraws it: the piece goes for everybody. */
    const withdrawal = await app.inject({
      method: "DELETE",
      url: `/decor/${lamp.id}`,
      headers: { cookie: anna.cookie },
    });
    expect(withdrawal.json().withdrawn).toBe(true);
    expect(await store.decorById(db, lamp.id)).toBeNull();
  });

  it("is not renamed at its author's", async () => {
    const anna = await account("anna");
    const bruno = await account("bruno");
    const lamp = await store.createDecor(db, { ownerId: anna.person.id, label: "a lamp" });
    await store.editDecor(db, anna.person.id, lamp.id, { is_public: true });
    await store.copyDecor(db, bruno.person.id, lamp.id);

    const r = await app.inject({
      method: "PUT",
      url: `/decor/${lamp.id}`,
      headers: { cookie: bruno.cookie },
      payload: { label: "mine now" },
    });
    expect(r.statusCode).toBe(404);
    expect((await store.decorById(db, lamp.id))?.label).toBe("a lamp");
  });
});
