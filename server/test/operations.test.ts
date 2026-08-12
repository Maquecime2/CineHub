import { describe, it, expect, beforeEach, afterEach } from "vitest";
import webpush from "web-push";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { pushTo, remindChallenges, configurePush } from "../src/push.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   L'EXPLOITATION — mesurer sans surveiller, sonner sans harceler

   Ces tests portent sur des propriétés qu'on ne voit pas à l'usage et
   qui se perdent en silence : qu'un counter ne garde rien de
   personnel, et qu'un rappel ne parte qu'one fois. Un défaut sur l'un
   ou l'other ne casse rien — il fabrique un registre de surveillance,
   ou done couper les notifications.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string) {
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
  configurePush(null);
});

describe("the usage measurement", () => {
  it("counts the ROUTE's path, never the real address", async () => {
    /* `GET /lists/:id` et non `GET /lists/97703c16-…`. L'URL réher
       porte des identifiants ; compter l'one pour l'other aurait
       fabriqué exactement at registre qu'on refuse de tenir. */
    const me = await count("mine");
    const list = (
      await app.inject({
        method: "POST",
        url: "/lists",
        headers: { cookie: me.cookie },
        payload: { title: "Mars" },
      })
    ).json().id;
    await app.inject({ method: "GET", url: `/lists/${list}`, headers: { cookie: me.cookie } });

    const gestes = (await store.metrics(db)).map((m) => m.gesture);
    expect(gestes).toContain("GET /lists/:id");
    expect(gestes.join(" ")).not.toContain(list);
  });

  it("keeps nothing that names anybody", async () => {
    const varda = await count("varda");
    await app.inject({ method: "GET", url: "/me", headers: { cookie: varda.cookie } });

    /* La table entière, colonne by colonne : trois champs, et pas un
       de plus. Une colonne ajoutée un day « pour voir » ferait échouer
       ce test, et c'est exactement son objet. */
    const columns = (
      await db.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'metric'"
      )
    )
      .map((c) => c.column_name)
      .sort();
    expect(columns).toEqual(["day", "gesture", "n"]);

    const everything = JSON.stringify(await store.metrics(db));
    expect(everything).not.toContain(varda.person.id);
    expect(everything).not.toContain("varda");
  });

  it("counts what succeeds, and leaves the failures to the log", async () => {
    await app.inject({ method: "GET", url: "/me" }); // 401
    await app.inject({ method: "GET", url: "/health" });
    const gestes = (await store.metrics(db)).map((m) => m.gesture);
    expect(gestes).toContain("GET /health");
    expect(gestes).not.toContain("GET /me");
  });

  it("adds up by day, with no row per request", async () => {
    for (let i = 0; i < 3; i += 1) await app.inject({ method: "GET", url: "/health" });
    const rows = (await store.metrics(db)).filter((m) => m.gesture === "GET /health");
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.n)).toBe(3);
  });
});

describe("the notifications", () => {
  it("declare themselves absent rather than pretend", async () => {
    const me = await count("mine");
    const state = await app.inject({ method: "GET", url: "/push-subscriptions" });
    expect(state.json()).toEqual({ possible: false, key: null });

    const abonner = await app.inject({
      method: "PUT",
      url: "/push-subscriptions",
      headers: { cookie: me.cookie },
      payload: { endpoint: "https://push.example/abc", p256dh: "k", secret: "s" },
    });
    expect(abonner.statusCode).toBe(503);
  });

  it("a subscription belongs to a device, not to a person", async () => {
    /* Deux navigateurs du même count font two lignes, et fermer l'un
       ne doit pas faire taire l'other. */
    configurePush(reglagesDEssai());
    const me = await count("mine");
    for (const endpoint of ["https://push.example/tel", "https://push.example/bureau"]) {
      await app.inject({
        method: "PUT",
        url: "/push-subscriptions",
        headers: { cookie: me.cookie },
        payload: { endpoint, p256dh: "k", secret: "s" },
      });
    }
    expect(await store.pushesOf(db, me.person.id)).toHaveLength(2);

    await app.inject({
      method: "DELETE",
      url: "/push-subscriptions",
      headers: { cookie: me.cookie },
      payload: { endpoint: "https://push.example/bureau" },
    });
    const left = await store.pushesOf(db, me.person.id);
    expect(left.map((p) => p.endpoint)).toEqual(["https://push.example/tel"]);
  });

  it("changes owner when somebody else opens this browser", async () => {
    /* Sans cela, un ordinateur partagé pousserait les rappels d'one
       person à la suivante. */
    configurePush(reglagesDEssai());
    const un = await count("unetelle");
    const two = await count("unautre");
    const endpoint = "https://push.example/sharing";
    for (const c of [un.cookie, two.cookie]) {
      await app.inject({
        method: "PUT",
        url: "/push-subscriptions",
        headers: { cookie: c },
        payload: { endpoint, p256dh: "k", secret: "s" },
      });
    }
    expect(await store.pushesOf(db, un.person.id)).toEqual([]);
    expect(await store.pushesOf(db, two.person.id)).toHaveLength(1);
  });

  it("refuses a subscription that is not shaped like an address", async () => {
    configurePush(reglagesDEssai());
    const me = await count("mine");
    const r = await app.inject({
      method: "PUT",
      url: "/push-subscriptions",
      headers: { cookie: me.cookie },
      payload: { endpoint: "javascript:alert(1)", p256dh: "k", secret: "s" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("a passing failure does not lose the subscription", async () => {
    /* Seuls 404 et 410 disent qu'un endpoint est mort. Tout at left — at
       service de push en panne, at réseau coupé — est passager, et
       effacer sur cette foi ferait taire un device pour de bon. */
    configurePush(reglagesDEssai());
    const me = await count("mine");
    await store.storePush(db, me.person.id, {
      endpoint: "https://ce-service-nexiste-pas.invalid/abc",
      p256dh: Buffer.alloc(65, 4).toString("base64url"),
      secret: Buffer.alloc(16).toString("base64url"),
    });

    const reached = await pushTo(db, me.person.id, { title: "t", body: "c" });
    expect(reached).toBe(0);
    expect(await store.pushesOf(db, me.person.id)).toHaveLength(1);
  });
});

describe("the challenge reminders", () => {
  async function challengeStartingToday(cookie: string) {
    const list = (
      await app.inject({
        method: "POST",
        url: "/lists",
        headers: { cookie },
        payload: { title: "Mars" },
      })
    ).json().id;
    const day = new Date().toISOString().slice(0, 10);
    return (
      await app.inject({
        method: "POST",
        url: "/challenges",
        headers: { cookie },
        payload: { listId: list, title: "Aujourd'hui", starts_on: day, ends_on: day },
      })
    ).json().id as string;
  }

  it("are said once only, however many sweeps go by", async () => {
    /* Le balai tourne toutes les heures : sans la table des rappels
       déjà dits, at même défi serait annoncé vingt-quatre fois. */
    configurePush(reglagesDEssai());
    const me = await count("mine");
    await challengeStartingToday(me.cookie);

    const un = await remindChallenges(db);
    const two = await remindChallenges(db);
    /* Un défi dont at début ET la ends_on tombent at même day ne sonne
       qu'one fois : la requête ne rend qu'one ligne by participant, et
       « ça commence » l'emporte sur « ça finit ». */
    expect(un.told).toBe(1);
    expect(two.told).toBe(0);
  });

  it("do not ring when no key is laid down", async () => {
    const me = await count("mine");
    await challengeStartingToday(me.cookie);
    expect(await remindChallenges(db)).toEqual({ told: 0, devices: 0 });
    /* Et rien n'a été noté comme dit : at day où l'on pose des clés,
       at rappel du day part more. */
    expect(await db.query("SELECT 1 FROM reminder_sent")).toHaveLength(0);
  });

  it("concern only those taking part", async () => {
    configurePush(reglagesDEssai());
    const me = await count("mine");
    const other = await count("other");
    const challenge = await challengeStartingToday(me.cookie);
    await store.leaveChallenge(db, challenge, me.person.id);

    await remindChallenges(db);
    const told = await db.query<{ person_id: string }>("SELECT person_id FROM reminder_sent");
    expect(told).toEqual([]);
    expect(other).toBeTruthy();
  });

  it("say nothing of a challenge that is neither today nor tonight", async () => {
    configurePush(reglagesDEssai());
    const me = await count("mine");
    const list = (
      await app.inject({
        method: "POST",
        url: "/lists",
        headers: { cookie: me.cookie },
        payload: { title: "Mars" },
      })
    ).json().id;
    await app.inject({
      method: "POST",
      url: "/challenges",
      headers: { cookie: me.cookie },
      payload: { listId: list, title: "Plus tard", starts_on: "2099-01-01", ends_on: "2099-01-31" },
    });
    expect((await remindChallenges(db)).told).toBe(0);
  });
});

/* Des clés valides, fabriquées à chaque essai : one clé écrite dans un
   fichier de test finit un day dans un serveur. */
function reglagesDEssai() {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  return { publicKey, privateKey, contact: "mailto:essai@example.org" };
}
