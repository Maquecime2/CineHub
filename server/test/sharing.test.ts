import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   SHARING

   `GET /collections/:pseudo` is the ONLY route in this server that
   answers somebody with no account. Everything that follows therefore
   asks, at every line, what a stranger can get out of it: what they
   see, what they must never see, and what the answer teaches them about
   the people who do not share.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function signedIn(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

/** A complete card, free notes and log included. */
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
    /* Otherwise the route becomes a directory: "404" on one side,
       "private" on the other, and one knows who is registered. */
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
    /* THE THREE THAT NEVER GO OUT. The private diary, the screening
       log, and the date of the last one — which says on its own how
       regularly somebody spends their evenings. */
    expect("notes" in film).toBe(false);
    expect("watches" in film).toBe(false);
    expect("watchedAt" in film).toBe(false);
    /* And nothing of the person beyond their pseudonym. */
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
     A CARD SET ASIDE STAYS SET ASIDE, EVEN WHEN IT IS EDITED
     ============================================================

     The fault this test catches could not be seen: `storeCard` rewrote
     `hidden` from the push, but the client does not model that field and
     never sends it. So it was always false, and ANY change to the card
     made it public again — a note added, a star, a screening.

     Nothing would have flagged it: the card looks no different at home,
     only at other people's. It is exactly the species of fault that gets
     discovered by somebody else. */
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

    /* We edit it, as a note written this evening would: `updatedAt` is
       more recent, so the push is accepted and overwrites. */
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
    /* Taking the old one back would revive every link handed out the
       time before — the one we meant to cut, included. */
    const { cookie } = await signedIn("varda");
    const first = (await setSharing(cookie, "lien")).json().token;
    await setSharing(cookie, "privee");
    const second = (await setSharing(cookie, "lien")).json().token;

    expect(second).not.toBe(first);
    expect(
      (await app.inject({ method: "GET", url: `/collections/varda?token=${first}` })).statusCode
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
