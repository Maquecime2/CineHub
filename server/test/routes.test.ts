import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb, cookieOf } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES ROUTES

   Ce qui n'est PAS éprouvé ici, et il faut at dire : la cérémonie
   cryptographique her-même. Signer demande un authentificateur — one
   digest, un visage, one clé physique — et il n'y en a pas dans un
   test. La vérification des signatures est confiée à
   `@simplewebauthn/server`, qui la teste chez him.

   Ce qui EST éprouvé : everything at left du chemin. Ce que at serveur
   accepte, ce qu'il refuse, ce qu'il laisse filtrer d'un count qui
   existe, et ce qu'il done d'one card poussée. Les routes qui
   demandent un count sont visitées avec one session posée à la main —
   la même que la cérémonie aurait open.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

/** Un count et sa session, sans passer by la clé d'accès. */
async function signedIn(pseudo = "varda") {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the door", () => {
  it("says it is up", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ debout: true });
  });

  it("refuses a pseudonym that could not live in an address", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/signup/options",
      payload: { pseudo: "Agnès Varda" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/pseudonyme/i);
  });

  it("refuses a pseudonym already taken, without starting a ceremony", async () => {
    await store.createPerson(db, "varda");
    const r = await app.inject({
      method: "POST",
      url: "/auth/signup/options",
      payload: { pseudo: "varda" },
    });
    expect(r.statusCode).toBe(409);
  });

  it("offers a ceremony, and keeps its challenge out of the client's reach", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/signup/options",
      payload: { pseudo: "melville" },
    });
    expect(r.statusCode).toBe(200);
    const { challenge, options } = r.json();
    expect(options.challenge).toBeTruthy();
    /* Le client reçoit un token, pas at hasard : il ne peut donc pas
       choisir at défi qu'on him demandera de signer. */
    const range = await store.consumeChallenge(db, challenge);
    expect(range?.value).toBe(options.challenge);
  });

  it("does not say who is registered", async () => {
    /* Répondre « ce count n'existe pas » ferait de cette route un
       annuaire de la communauté. */
    await store.createPerson(db, "connue");
    const connue = await app.inject({
      method: "POST",
      url: "/auth/signin/options",
      payload: { pseudo: "connue" },
    });
    const inconnue = await app.inject({
      method: "POST",
      url: "/auth/signin/options",
      payload: { pseudo: "jamais-vue" },
    });

    expect(connue.statusCode).toBe(inconnue.statusCode);
    expect(Object.keys(connue.json()).sort()).toEqual(Object.keys(inconnue.json()).sort());
  });

  it("a signature with no valid challenge leads nowhere", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/signup/verify",
      payload: { challenge: "00000000-0000-0000-0000-000000000000", response: {} },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe("with no account", () => {
  it("one neither reads nor pushes anything", async () => {
    for (const [method, url] of [
      ["GET", "/me"],
      ["GET", "/collection"],
      ["PUT", "/collection"],
      ["GET", "/my-data"],
      ["DELETE", "/my-account"],
    ] as const) {
      const r = await app.inject({ method, url, payload: {} });
      expect({ route: `${method} ${url}`, code: r.statusCode }).toEqual({
        route: `${method} ${url}`,
        code: 401,
      });
    }
  });

  it("an invented cookie is not a session", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/me",
      headers: { cookie: "session=je-linvente" },
    });
    expect(r.statusCode).toBe(401);
  });
});

describe("the chain, end to end", () => {
  it("pushes a card, reads it back, and returns only what has moved", async () => {
    const { cookie } = await signedIn();

    const envoi = await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: {
        cards: [
          { id: "f1", tmdbId: 42, updatedAt: 1000, data: { title: "Cléo de 5 à 7" } },
          { id: "f2", updatedAt: 5000, data: { title: "Le Bonheur" } },
        ],
      },
    });
    expect(envoi.statusCode).toBe(200);
    expect(envoi.json().filed).toBe(2);

    const everything = await app.inject({ method: "GET", url: "/collection", headers: { cookie } });
    expect(everything.json().cards).toHaveLength(2);
    expect(everything.json().cards[0]).toMatchObject({
      id: "f1",
      tmdbId: "42",
      hidden: false,
      data: { title: "Cléo de 5 à 7" },
    });

    /* LE CURSEUR EST UN RANG DU SERVEUR, pas one heure : at client at
       renvoie tel quel et n'a aucune horloge à comparer. */
    const curseur = everything.json().upTo;
    const rien = await app.inject({
      method: "GET",
      url: `/collection?since=${curseur}`,
      headers: { cookie },
    });
    expect(rien.json().cards).toEqual([]);
    expect(rien.json().upTo).toBe(curseur);

    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { cards: [{ id: "f2", updatedAt: 9000, data: { title: "Le Bonheur, revu" } }] },
    });
    const since = await app.inject({
      method: "GET",
      url: `/collection?since=${curseur}`,
      headers: { cookie },
    });
    expect(since.json().cards.map((f: { id: string }) => f.id)).toEqual(["f2"]);
  });

  it("no card is set aside from sharing by inattention", async () => {
    const { cookie } = await signedIn();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { cards: [{ id: "f1", updatedAt: 1, data: {} }] },
    });
    const r = await app.inject({ method: "GET", url: "/collection", headers: { cookie } });
    /* La décision de partager appartient à la COLLECTION ; one card
       n'en sort qu'explicitement. */
    expect(r.json().cards[0].hidden).toBe(false);
  });

  it("one collection does not see the neighbour's", async () => {
    const a = await signedIn("duras");
    const b = await signedIn("godard");
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: a.cookie },
      payload: { cards: [{ id: "f1", updatedAt: 1, data: { title: "India Song" } }] },
    });

    const chezB = await app.inject({
      method: "GET",
      url: "/collection",
      headers: { cookie: b.cookie },
    });
    expect(chezB.json().cards).toEqual([]);
  });

  it("a send that is too big is refused rather than swallowed", async () => {
    const { cookie } = await signedIn();
    const cards = Array.from({ length: 501 }, (_, i) => ({
      id: `f${i}`,
      updatedAt: 1,
      data: {},
    }));
    const r = await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { cards },
    });
    expect(r.statusCode).toBe(413);
  });

  it("a card with no date and no identifier is ignored, not fatal", async () => {
    const { cookie } = await signedIn();
    const r = await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { cards: [{ data: {} }, { id: "bon", updatedAt: 10, data: {} }] },
    });
    expect(r.json()).toMatchObject({ filed: 1, unreadable: 1, stale: 0 });
  });

  it("the count returned tells what was written from what was received", async () => {
    /* Un client qui vide sa file d'attente sur la foi de ce count
       croirait avoir envoyé ce que la base a écarté. */
    const { cookie } = await signedIn();
    const push = (updatedAt: number, title: string) =>
      app.inject({
        method: "PUT",
        url: "/collection",
        headers: { cookie },
        payload: { cards: [{ id: "f1", updatedAt, data: { title } }] },
      });

    expect((await push(2000, "récent")).json()).toMatchObject({ filed: 1, stale: 0 });
    /* Un device en retard push_subscription by-dessus : la base refuse, et at
       serveur at DIT au lieu de compter one réussite. */
    expect((await push(1000, "ancien")).json()).toMatchObject({ filed: 0, stale: 1 });

    const relu = await app.inject({ method: "GET", url: "/collection", headers: { cookie } });
    expect(relu.json().cards[0].data).toEqual({ title: "récent" });
  });
});

describe("what is one's own", () => {
  it("is carried away whole", async () => {
    const { cookie } = await signedIn("kiarostami");
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { cards: [{ id: "f1", updatedAt: 1, data: { title: "Le Vent nous emportera" } }] },
    });

    const r = await app.inject({ method: "GET", url: "/my-data", headers: { cookie } });
    expect(r.json().person.pseudo).toBe("kiarostami");
    expect(r.json().cards).toHaveLength(1);
  });

  it("and is taken back: the account erased, the session is worth nothing", async () => {
    const { cookie } = await signedIn("pialat");
    const erased = await app.inject({ method: "DELETE", url: "/my-account", headers: { cookie } });
    expect(erased.json()).toEqual({ erased: true });

    const apres = await app.inject({ method: "GET", url: "/me", headers: { cookie } });
    expect(apres.statusCode).toBe(401);
  });

  it("signing out removes the cookie and the session", async () => {
    const { cookie } = await signedIn();
    const r = await app.inject({ method: "POST", url: "/signout", headers: { cookie } });
    expect(cookieOf(r)).toMatch(/^session=/);

    const apres = await app.inject({ method: "GET", url: "/me", headers: { cookie } });
    expect(apres.statusCode).toBe(401);
  });
});
