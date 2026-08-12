import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb, cookieOf } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LES ROUTES

   Ce qui n'est PAS éprouvé ici, et il faut le dire : la cérémonie
   cryptographique elle-même. Signer demande un authentificateur — une
   empreinte, un visage, une clé physique — et il n'y en a pas dans un
   test. La vérification des signatures est confiée à
   `@simplewebauthn/server`, qui la teste chez lui.

   Ce qui EST éprouvé : tout le reste du chemin. Ce que le serveur
   accepte, ce qu'il refuse, ce qu'il laisse filtrer d'un compte qui
   existe, et ce qu'il fait d'une fiche poussée. Les routes qui
   demandent un compte sont visitées avec une session posée à la main —
   la même que la cérémonie aurait ouverte.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

/** Un compte et sa session, sans passer par la clé d'accès. */
async function signedIn(pseudo = "varda") {
  const personne = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, personne.id);
  return { personne, cookie: `session=${secret}` };
}

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("la porte", () => {
  it("dit qu'elle est debout", async () => {
    const r = await app.inject({ method: "GET", url: "/sante" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ debout: true });
  });

  it("refuse un pseudonyme qui ne pourra pas vivre dans une adresse", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/inscription/options",
      payload: { pseudo: "Agnès Varda" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().erreur).toMatch(/pseudonyme/i);
  });

  it("refuse un pseudonyme déjà pris, sans lancer de cérémonie", async () => {
    await store.createPerson(db, "varda");
    const r = await app.inject({
      method: "POST",
      url: "/auth/inscription/options",
      payload: { pseudo: "varda" },
    });
    expect(r.statusCode).toBe(409);
  });

  it("propose une cérémonie, et retient son défi hors de portée du client", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/inscription/options",
      payload: { pseudo: "melville" },
    });
    expect(r.statusCode).toBe(200);
    const { defi, options } = r.json();
    expect(options.challenge).toBeTruthy();
    /* Le client reçoit un jeton, pas le hasard : il ne peut donc pas
       choisir le défi qu'on lui demandera de signer. */
    const range = await store.consumeChallenge(db, defi);
    expect(range?.valeur).toBe(options.challenge);
  });

  it("ne dit pas qui est inscrit", async () => {
    /* Répondre « ce compte n'existe pas » ferait de cette route un
       annuaire de la communauté. */
    await store.createPerson(db, "connue");
    const connue = await app.inject({
      method: "POST",
      url: "/auth/connexion/options",
      payload: { pseudo: "connue" },
    });
    const inconnue = await app.inject({
      method: "POST",
      url: "/auth/connexion/options",
      payload: { pseudo: "jamais-vue" },
    });

    expect(connue.statusCode).toBe(inconnue.statusCode);
    expect(Object.keys(connue.json()).sort()).toEqual(Object.keys(inconnue.json()).sort());
  });

  it("une signature sans défi valable ne mène nulle part", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/inscription/verification",
      payload: { defi: "00000000-0000-0000-0000-000000000000", reponse: {} },
    });
    expect(r.statusCode).toBe(400);
  });
});

describe("sans compte", () => {
  it("on ne lit ni ne pousse rien", async () => {
    for (const [method, url] of [
      ["GET", "/moi"],
      ["GET", "/collection"],
      ["PUT", "/collection"],
      ["GET", "/mes-donnees"],
      ["DELETE", "/mon-compte"],
    ] as const) {
      const r = await app.inject({ method, url, payload: {} });
      expect({ route: `${method} ${url}`, code: r.statusCode }).toEqual({
        route: `${method} ${url}`,
        code: 401,
      });
    }
  });

  it("un cookie inventé ne vaut pas une session", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/moi",
      headers: { cookie: "session=je-linvente" },
    });
    expect(r.statusCode).toBe(401);
  });
});

describe("la chaîne, de bout en bout", () => {
  it("pousse une fiche, la relit, et ne rend que ce qui a bougé", async () => {
    const { cookie } = await signedIn();

    const envoi = await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: {
        fiches: [
          { id: "f1", tmdbId: 42, majLe: 1000, donnees: { title: "Cléo de 5 à 7" } },
          { id: "f2", majLe: 5000, donnees: { title: "Le Bonheur" } },
        ],
      },
    });
    expect(envoi.statusCode).toBe(200);
    expect(envoi.json().rangees).toBe(2);

    const tout = await app.inject({ method: "GET", url: "/collection", headers: { cookie } });
    expect(tout.json().fiches).toHaveLength(2);
    expect(tout.json().fiches[0]).toMatchObject({
      id: "f1",
      tmdbId: "42",
      cachee: false,
      donnees: { title: "Cléo de 5 à 7" },
    });

    /* LE CURSEUR EST UN RANG DU SERVEUR, pas une heure : le client le
       renvoie tel quel et n'a aucune horloge à comparer. */
    const curseur = tout.json().jusqua;
    const rien = await app.inject({
      method: "GET",
      url: `/collection?depuis=${curseur}`,
      headers: { cookie },
    });
    expect(rien.json().fiches).toEqual([]);
    expect(rien.json().jusqua).toBe(curseur);

    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { fiches: [{ id: "f2", majLe: 9000, donnees: { title: "Le Bonheur, revu" } }] },
    });
    const depuis = await app.inject({
      method: "GET",
      url: `/collection?depuis=${curseur}`,
      headers: { cookie },
    });
    expect(depuis.json().fiches.map((f: { id: string }) => f.id)).toEqual(["f2"]);
  });

  it("aucune fiche n'est écartée du partage par distraction", async () => {
    const { cookie } = await signedIn();
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { fiches: [{ id: "f1", majLe: 1, donnees: {} }] },
    });
    const r = await app.inject({ method: "GET", url: "/collection", headers: { cookie } });
    /* La décision de partager appartient à la COLLECTION ; une fiche
       n'en sort qu'explicitement. */
    expect(r.json().fiches[0].cachee).toBe(false);
  });

  it("une collection ne voit pas celle du voisin", async () => {
    const a = await signedIn("duras");
    const b = await signedIn("godard");
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie: a.cookie },
      payload: { fiches: [{ id: "f1", majLe: 1, donnees: { title: "India Song" } }] },
    });

    const chezB = await app.inject({
      method: "GET",
      url: "/collection",
      headers: { cookie: b.cookie },
    });
    expect(chezB.json().fiches).toEqual([]);
  });

  it("un envoi trop gros est refusé plutôt qu'avalé", async () => {
    const { cookie } = await signedIn();
    const fiches = Array.from({ length: 501 }, (_, i) => ({
      id: `f${i}`,
      majLe: 1,
      donnees: {},
    }));
    const r = await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { fiches },
    });
    expect(r.statusCode).toBe(413);
  });

  it("une fiche sans date ni identifiant est ignorée, pas fatale", async () => {
    const { cookie } = await signedIn();
    const r = await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { fiches: [{ donnees: {} }, { id: "bon", majLe: 10, donnees: {} }] },
    });
    expect(r.json()).toMatchObject({ rangees: 1, illisibles: 1, perimees: 0 });
  });

  it("le compte rendu distingue ce qui est écrit de ce qui est reçu", async () => {
    /* Un client qui vide sa file d'attente sur la foi de ce compte
       croirait avoir envoyé ce que la base a écarté. */
    const { cookie } = await signedIn();
    const pousser = (majLe: number, titre: string) =>
      app.inject({
        method: "PUT",
        url: "/collection",
        headers: { cookie },
        payload: { fiches: [{ id: "f1", majLe, donnees: { titre } }] },
      });

    expect((await pousser(2000, "récent")).json()).toMatchObject({ rangees: 1, perimees: 0 });
    /* Un appareil en retard pousse par-dessus : la base refuse, et le
       serveur le DIT au lieu de compter une réussite. */
    expect((await pousser(1000, "ancien")).json()).toMatchObject({ rangees: 0, perimees: 1 });

    const relu = await app.inject({ method: "GET", url: "/collection", headers: { cookie } });
    expect(relu.json().fiches[0].donnees).toEqual({ titre: "récent" });
  });
});

describe("ce qui est à soi", () => {
  it("s'emporte en entier", async () => {
    const { cookie } = await signedIn("kiarostami");
    await app.inject({
      method: "PUT",
      url: "/collection",
      headers: { cookie },
      payload: { fiches: [{ id: "f1", majLe: 1, donnees: { title: "Le Vent nous emportera" } }] },
    });

    const r = await app.inject({ method: "GET", url: "/mes-donnees", headers: { cookie } });
    expect(r.json().personne.pseudo).toBe("kiarostami");
    expect(r.json().fiches).toHaveLength(1);
  });

  it("et se reprend : le compte effacé, la session ne vaut plus rien", async () => {
    const { cookie } = await signedIn("pialat");
    const efface = await app.inject({ method: "DELETE", url: "/mon-compte", headers: { cookie } });
    expect(efface.json()).toEqual({ efface: true });

    const apres = await app.inject({ method: "GET", url: "/moi", headers: { cookie } });
    expect(apres.statusCode).toBe(401);
  });

  it("la déconnexion retire le cookie et la session", async () => {
    const { cookie } = await signedIn();
    const r = await app.inject({ method: "POST", url: "/deconnexion", headers: { cookie } });
    expect(cookieOf(r)).toMatch(/^session=/);

    const apres = await app.inject({ method: "GET", url: "/moi", headers: { cookie } });
    expect(apres.statusCode).toBe(401);
  });
});
