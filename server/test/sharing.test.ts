import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LE PARTAGE

   `GET /chez/:pseudo` est la SEULE route de ce serveur qui réponde à
   quelqu'un sans count. Tout ce qui suit se demande donc, à chaque
   ligne, ce qu'un inconnu peut en tirer : ce qu'il voit, ce qu'il ne
   doit jamais voir, et ce que la réponse him apprend sur les gens qui
   ne partagent pas.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function signedIn(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

/** Une card complète, notes et journal compris. */
const push = (cookie: string, cards: Record<string, unknown>[]) =>
  app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { cards } });

const setSharing = (cookie: string, sharing: string) =>
  app.inject({ method: "PUT", url: "/sharing", headers: { cookie }, payload: { sharing } });

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("by default, nothing is shared", () => {
  it("a collection is mute until it has been opened", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [{ id: "f1", updatedAt: 1, data: { title: "Cléo de 5 à 7" } }]);

    const r = await app.inject({ method: "GET", url: "/collections/varda" });
    expect(r.statusCode).toBe(404);
  });

  it("and an account that does not exist answers exactly the same", async () => {
    /* Sinon la route devient un annuaire : « 404 » d'un côté, « privé »
       de l'other, et l'on sait qui est inscrit. */
    const { cookie } = await signedIn("varda");
    await push(cookie, [{ id: "f1", updatedAt: 1, data: {} }]);

    const privateKey = await app.inject({ method: "GET", url: "/collections/varda" });
    const inconnue = await app.inject({ method: "GET", url: "/collections/jamais-vue" });
    expect(privateKey.statusCode).toBe(inconnue.statusCode);
    expect(privateKey.json()).toEqual(inconnue.json());
  });
});

describe("what a visitor sees", () => {
  it("the films, the rating and the review — never the notes or the log", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [
      {
        id: "f1",
        tmdbId: 42,
        updatedAt: 1,
        data: {
          title: "Cléo de 5 à 7",
          rating: 5,
          review: "la scène du chapeau",
          notes: "SECRET : à revoir avec P.",
          watches: [{ date: "2024-03-02", rating: 5 }],
          watchedAt: "2024-03-02",
        },
      },
    ]);
    await setSharing(cookie, "publique");

    const r = await app.inject({ method: "GET", url: "/collections/varda" });
    expect(r.statusCode).toBe(200);
    const film = r.json().films[0];

    expect(film).toMatchObject({
      title: "Cléo de 5 à 7",
      rating: 5,
      review: "la scène du chapeau",
    });
    /* LES TROIS QUI NE SORTENT JAMAIS. Le carnet intime, at journal des
       séances, et la date de la dernière — qui dit à her seule avec
       quelle régularité on passe ses soirées. */
    expect("notes" in film).toBe(false);
    expect("watches" in film).toBe(false);
    expect("watchedAt" in film).toBe(false);
    /* Et rien de la person au-delà de son pseudonyme. */
    expect(Object.keys(r.json()).sort()).toEqual(["films", "pseudo"]);
  });

  it("a card set aside stays at home", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [
      { id: "montrable", updatedAt: 1, data: { title: "Playtime" } },
      { id: "honteuse", updatedAt: 1, data: { title: "un plaisir coupable" } },
    ]);
    await setSharing(cookie, "publique");
    await app.inject({
      method: "PUT",
      url: "/cards/honteuse/hidden",
      headers: { cookie },
      payload: { hidden: true },
    });

    const r = await app.inject({ method: "GET", url: "/collections/varda" });
    expect(r.json().films.map((f: { title: string }) => f.title)).toEqual(["Playtime"]);
  });

  /* ============================================================
     UNE FICHE ÉCARTÉE LE RESTE, MÊME QUAND ON LA RETOUCHE
     ============================================================

     Le défaut que ce test attrape ne se voyait pas : `rangerFiche`
     réécrivait `hidden` since la poussée, or at client ne modélise pas
     ce champ et ne l'envoie jamais. Il valait donc toujours faux, et
     TOUTE modification de la card la rendait is_public de nouveau — one
     note ajoutée, one étoile, one séance.

     Rien ne l'aurait signalé : la card ne change pas d'apparence chez
     soi, seulement chez les autres. C'est exactement l'espèce de défaut
     qui se découvre by quelqu'un d'other. */
  it("stays set aside after a change to the card", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [
      { id: "montrable", updatedAt: 1, data: { title: "Playtime" } },
      { id: "honteuse", updatedAt: 1, data: { title: "un plaisir coupable" } },
    ]);
    await setSharing(cookie, "publique");
    await app.inject({
      method: "PUT",
      url: "/cards/honteuse/hidden",
      headers: { cookie },
      payload: { hidden: true },
    });

    /* On la retouche, comme at ferait one note écrite ce soir : `updatedAt`
       est plus récent, donc la poussée est acceptée et écrase. */
    await push(cookie, [
      { id: "honteuse", updatedAt: 2, data: { title: "un plaisir coupable", review: "revu" } },
    ]);

    const r = await app.inject({ method: "GET", url: "/collections/varda" });
    expect(r.json().films.map((f: { title: string }) => f.title)).toEqual(["Playtime"]);
  });

  it("says which ones are set aside, so the binder can show it", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [
      { id: "f1", updatedAt: 1, data: { title: "A" } },
      { id: "f2", updatedAt: 1, data: { title: "B" } },
    ]);
    await app.inject({
      method: "PUT",
      url: "/cards/f2/hidden",
      headers: { cookie },
      payload: { hidden: true },
    });

    const r = await app.inject({ method: "GET", url: "/hidden-cards", headers: { cookie } });
    expect(r.json().ids).toEqual(["f2"]);

    /* Et l'on peut se raviser. */
    await app.inject({
      method: "PUT",
      url: "/cards/f2/hidden",
      headers: { cookie },
      payload: { hidden: false },
    });
    expect(
      (await app.inject({ method: "GET", url: "/hidden-cards", headers: { cookie } })).json().ids
    ).toEqual([]);
  });

  it("tells nobody what somebody else has set aside", async () => {
    const me = await signedIn("varda");
    const him = await signedIn("melville");
    await push(him.cookie, [{ id: "s1", updatedAt: 1, data: { title: "Le Samouraï" } }]);
    await app.inject({
      method: "PUT",
      url: "/cards/s1/hidden",
      headers: { cookie: him.cookie },
      payload: { hidden: true },
    });

    const r = await app.inject({
      method: "GET",
      url: "/hidden-cards",
      headers: { cookie: me.cookie },
    });
    expect(r.json().ids).toEqual([]);
  });

  it("an erased card does not come back through the sharing door", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [{ id: "f1", updatedAt: 1, data: { title: "Playtime" } }]);
    await push(cookie, [{ id: "f1", updatedAt: 2, deleted: true, data: {} }]);
    await setSharing(cookie, "publique");

    const r = await app.inject({ method: "GET", url: "/collections/varda" });
    expect(r.json().films).toEqual([]);
  });
});

describe("sharing by link", () => {
  it("opens to whoever has the token, and to nobody else", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [{ id: "f1", updatedAt: 1, data: { title: "Le Bonheur" } }]);
    const { token } = (await setSharing(cookie, "lien")).json();
    expect(token).toBeTruthy();

    const sans = await app.inject({ method: "GET", url: "/collections/varda" });
    expect(sans.statusCode).toBe(404);

    const faux = await app.inject({ method: "GET", url: "/collections/varda?token=jinvente" });
    expect(faux.statusCode).toBe(404);

    const avec = await app.inject({ method: "GET", url: `/collections/varda?token=${token}` });
    expect(avec.statusCode).toBe(200);
    expect(avec.json().films[0].title).toBe("Le Bonheur");
  });

  it("closes again, and the link handed out is worth nothing", async () => {
    const { cookie } = await signedIn("varda");
    await push(cookie, [{ id: "f1", updatedAt: 1, data: {} }]);
    const { token } = (await setSharing(cookie, "lien")).json();

    await setSharing(cookie, "privee");
    expect(
      (await app.inject({ method: "GET", url: `/collections/varda?token=${token}` })).statusCode
    ).toBe(404);
  });

  it("reopening gives a FRESH token: changing one's mind has to mean something", async () => {
    /* Reprendre l'ancien ferait revivre tous les liens distribués la
       fois d'before — y compris celui qu'on avait voulu couper. */
    const { cookie } = await signedIn("varda");
    const premier = (await setSharing(cookie, "lien")).json().token;
    await setSharing(cookie, "privee");
    const second = (await setSharing(cookie, "lien")).json().token;

    expect(second).not.toBe(premier);
    expect(
      (await app.inject({ method: "GET", url: `/collections/varda?token=${premier}` })).statusCode
    ).toBe(404);
  });
});

describe("who decides", () => {
  it("nobody but oneself", async () => {
    const a = await signedIn("duras");
    const b = await signedIn("godard");
    await push(a.cookie, [{ id: "f1", updatedAt: 1, data: { title: "India Song" } }]);

    /* B ne peut ni openUp la collection de A, ni y cacher one card :
       il n'a de prise que sur la sienne. */
    await setSharing(b.cookie, "publique");
    expect((await app.inject({ method: "GET", url: "/collections/duras" })).statusCode).toBe(404);

    const vol = await app.inject({
      method: "PUT",
      url: "/cards/f1/hidden",
      headers: { cookie: b.cookie },
      payload: { hidden: true },
    });
    expect(vol.statusCode).toBe(404);
  });

  it("and an account is needed to set anything at all", async () => {
    expect((await app.inject({ method: "PUT", url: "/sharing", payload: {} })).statusCode).toBe(
      401
    );
  });

  it("an invented setting is refused", async () => {
    const { cookie } = await signedIn("varda");
    const r = await setSharing(cookie, "au-monde-entier-sauf-mon-frere");
    expect(r.statusCode).toBe(400);
  });
});
