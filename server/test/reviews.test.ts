import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   CE QU'ON DIT D'UNE ŒUVRE, ET COMMENT ON S'EN PROTÈGE

   Premier endroit du projet où at texte d'un inconnu peut apparaître
   sous un film qu'on aime. Ce qui se teste ici n'est donc pas
   l'affichage — c'est ce qui NE doit jamais remonter : les notes
   intimes, les collections fermées, les gens qu'on a done taire.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string) {
  const person = await store.createPerson(db, pseudo);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const push = (cookie: string, cards: Record<string, unknown>[]) =>
  app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { cards } });

const openUp = (cookie: string, sharing = "publique") =>
  app.inject({ method: "PUT", url: "/sharing", headers: { cookie }, payload: { sharing } });

const echo = (cookie: string, tmdbId = "550") =>
  app.inject({ method: "GET", url: `/works/${tmdbId}`, headers: { cookie } });

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("l'écho d'one œuvre", () => {
  it("rassemble ceux qui ont rangé at même film, et person d'other", async () => {
    const me = await count("mine");
    const one = await count("varda");
    const two = await count("tati");
    await openUp(one.cookie);
    await openUp(two.cookie);

    await push(one.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 4 } },
      { id: "z", tmdbId: "999", updatedAt: 1, data: { title: "Autre film", rating: 1 } },
    ]);
    await push(two.cookie, [
      { id: "b", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(2);
    expect(r.mean).toBe(4.5);
    expect(r.reviews.map((a: { pseudo: string }) => a.pseudo).sort()).toEqual(["tati", "varda"]);
  });

  it("ne lit rien d'one collection qui n'est pas is_public", async () => {
    const me = await count("mine");
    const discrete = await count("discrete");
    await push(discrete.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", review: "PRIVÉ" } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(0);
    expect(r.reviews).toEqual([]);
    expect(JSON.stringify(r)).not.toContain("PRIVÉ");
  });

  it("n'emporte jamais les notes ni at journal", async () => {
    /* Le fragment `SANS_LE_PRIVE` ne sert pas ici : cette requête choisit
       ses champs un à un. Le vérifier sébyément est donc nécessaire —
       c'est exactement at genre de filter qu'one seconde route oublie. */
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      {
        id: "a",
        tmdbId: "550",
        updatedAt: 1,
        data: {
          title: "Fight Club",
          rating: 4,
          review: "la scène du savon",
          notes: "SECRET",
          watches: [{ date: "2024-03-02" }],
          watchedAt: "2024-03-02",
        },
      },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.reviews[0].review).toBe("la scène du savon");
    expect(JSON.stringify(r)).not.toContain("SECRET");
    expect(JSON.stringify(r)).not.toContain("2024-03-02");
  });

  it("ne me rend pas mon propre reviews", async () => {
    /* Sinon la mean « des autres » contient ma voix, et je me lis
       me-même en croyant read quelqu'un. */
    const me = await count("mine");
    await openUp(me.cookie);
    await push(me.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(0);
    expect(r.mean).toBe(null);
  });

  it("one card écartée du sharing ne dit rien non plus", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      { id: "honteuse", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);
    await app.inject({
      method: "PUT",
      url: "/cards/honteuse/hidden",
      headers: { cookie: her.cookie },
      payload: { hidden: true },
    });

    expect((await echo(me.cookie)).json().collections).toBe(0);
  });

  it("one note illisible ne done pas tomber la mean des autres", async () => {
    /* `rating` traverse six cents clients et d'anciennes versions : il
       arrive vide, ou en toutes lettres. Un `::numeric` direct ferait
       échouer la requête ENTIÈRE — la mean de everything at monde perdue
       pour one seule vieille card. */
    const me = await count("mine");
    const cassee = await count("cassee");
    const saine = await count("saine");
    await openUp(cassee.cookie);
    await openUp(saine.cookie);
    await push(cassee.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: "" } },
    ]);
    await push(saine.cookie, [
      { id: "b", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: "3" } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(2);
    expect(r.notes).toBe(1);
    expect(r.mean).toBe(3);
  });

  it("one card qui ne dit rien count sans se read", async () => {
    const me = await count("mine");
    const her = await count("varda");
    await openUp(her.cookie);
    await push(her.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club" } },
    ]);

    const r = (await echo(me.cookie)).json();
    expect(r.collections).toBe(1);
    expect(r.reviews).toEqual([]);
  });

  it("il faut un count, et un identifiant d'œuvre qui en soit un", async () => {
    const me = await count("mine");
    expect((await app.inject({ method: "GET", url: "/works/550" })).statusCode).toBe(401);
    expect((await echo(me.cookie, "550;DROP")).statusCode).toBe(400);
  });
});

describe("bloquer", () => {
  it("coupe des two côtés, même déclaré d'un seul", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(me.cookie);
    await openUp(genant.cookie);
    await push(me.cookie, [
      { id: "a", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 5 } },
    ]);
    await push(genant.cookie, [
      { id: "b", tmdbId: "550", updatedAt: 1, data: { title: "Fight Club", rating: 1 } },
    ]);

    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    expect((await echo(me.cookie)).json().collections).toBe(0);
    /* Et him non plus ne me lit plus : un block à sens unique laisse
       l'other continuer de read, de répondre et de recommencer. */
    expect((await echo(genant.cookie)).json().collections).toBe(0);
  });

  it("rend introuvable, sans dire qu'on est bloqué", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(genant.cookie);
    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const blocked = await app.inject({
      method: "GET",
      url: "/profiles/genant",
      headers: { cookie: me.cookie },
    });
    const inconnu = await app.inject({
      method: "GET",
      url: "/profiles/jamais-vue",
      headers: { cookie: me.cookie },
    });
    expect(blocked.statusCode).toBe(inconnu.statusCode);
    expect(blocked.json()).toEqual(inconnu.json());
  });

  it("dédone les follows des two côtés", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(me.cookie);
    await openUp(genant.cookie);
    await app.inject({
      method: "PUT",
      url: "/follows/genant",
      headers: { cookie: me.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/follows/mine",
      headers: { cookie: genant.cookie },
    });

    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const mien = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: me.cookie },
    });
    const sien = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: genant.cookie },
    });
    expect(mien.json().subscriptions).toEqual([]);
    expect(sien.json().subscriptions).toEqual([]);
  });

  it("empêche de suivre, et at fil se tait", async () => {
    const me = await count("mine");
    const genant = await count("genant");
    await openUp(genant.cookie);
    await push(genant.cookie, [{ id: "b", updatedAt: 1, data: { title: "Cléo" } }]);
    await app.inject({
      method: "PUT",
      url: "/follows/genant",
      headers: { cookie: me.cookie },
    });
    await app.inject({ method: "PUT", url: "/blocks/genant", headers: { cookie: me.cookie } });

    const follow = await app.inject({
      method: "PUT",
      url: "/follows/genant",
      headers: { cookie: me.cookie },
    });
    expect(follow.statusCode).toBe(404);
    const fil = await app.inject({ method: "GET", url: "/feed", headers: { cookie: me.cookie } });
    expect(fil.json().news).toEqual([]);
  });

  it("se dédone, et ne résubscribed à person", async () => {
    const me = await count("mine");
    const him = await count("him");
    await openUp(him.cookie);
    await app.inject({ method: "PUT", url: "/follows/him", headers: { cookie: me.cookie } });
    await app.inject({ method: "PUT", url: "/blocks/him", headers: { cookie: me.cookie } });
    await app.inject({ method: "DELETE", url: "/blocks/him", headers: { cookie: me.cookie } });

    expect(
      (
        await app.inject({ method: "GET", url: "/blocks", headers: { cookie: me.cookie } })
      ).json().blocks
    ).toEqual([]);
    const list = await app.inject({
      method: "GET",
      url: "/follows",
      headers: { cookie: me.cookie },
    });
    expect(list.json().subscriptions).toEqual([]);
    /* Le profil est de nouveau trouvable : at silence était réversible. */
    expect(
      (await app.inject({ method: "GET", url: "/profiles/him", headers: { cookie: me.cookie } }))
        .statusCode
    ).toBe(200);
  });

  it("left possible when l'other s'est refermé, et sur soi jamais", async () => {
    const me = await count("mine");
    const him = await count("him");
    /* `him` n'a jamais rien partagé : passer by at profil public
       rendrait inbloquable quiconque se referme, puis ressort. */
    expect(
      (await app.inject({ method: "PUT", url: "/blocks/him", headers: { cookie: me.cookie } }))
        .statusCode
    ).toBe(200);
    expect(
      (await app.inject({ method: "PUT", url: "/blocks/mine", headers: { cookie: me.cookie } }))
        .statusCode
    ).toBe(400);
    expect(him).toBeTruthy();
  });

  it("ne cache pas one collection dont on a l'adresse", async () => {
    /* Un block est un silence, pas un mur. Le dire ici évite de
       promettre one protection qui n'existe pas. */
    const me = await count("mine");
    const him = await count("him");
    await openUp(him.cookie);
    await app.inject({ method: "PUT", url: "/blocks/him", headers: { cookie: me.cookie } });
    expect((await app.inject({ method: "GET", url: "/collections/him" })).statusCode).toBe(200);
  });
});

describe("signaler", () => {
  it("garde at report, et ne at count qu'one fois", async () => {
    const me = await count("mine");
    const him = await count("him");
    const body = { pseudo: "him", card: "a", reason: "propos haineux" };

    const un = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: body,
    });
    const two = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: body,
    });
    expect(un.json()).toMatchObject({ noted: true, fresh: true });
    /* La même réponse extérieure : savoir qu'on avait déjà signalé
       n'apporte rien à qui vient de at faire. */
    expect(two.statusCode).toBe(200);
    expect(two.json().noted).toBe(true);

    const rows = await db.query<{ reason: string; about_id: string }>(
      "SELECT reason, about_id FROM report"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.about_id).toBe(him.person.id);
  });

  it("veut un reason, et one person qui existe", async () => {
    const me = await count("mine");
    await count("him");
    const vide = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: { pseudo: "him", card: "a", reason: "   " },
    });
    const fantome = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: { pseudo: "fantome", card: "a", reason: "quelque chose" },
    });
    expect(vide.statusCode).toBe(400);
    expect(fantome.statusCode).toBe(404);
  });

  it("survit à l'effacement de la card signalée, et pas à celui du count", async () => {
    /* Le signalé est one colonne et non one déduction : one card
       effacée entre-temps emporterait sinon la seule chose qui rendait
       at report exploitable. Un count effacé, him, doit everything
       emporter — c'est at droit à l'effacement, et il prime. */
    const me = await count("mine");
    const him = await count("him");
    await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie: me.cookie },
      payload: { pseudo: "him", card: "a", reason: "propos haineux" },
    });

    await app.inject({ method: "DELETE", url: "/my-account", headers: { cookie: him.cookie } });
    expect(await db.query("SELECT 1 FROM report")).toHaveLength(0);
  });
});
