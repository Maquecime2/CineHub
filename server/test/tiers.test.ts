import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { ceilingsFor } from "../src/limits.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   ACCORDER UN PALIER, ET REGARDER QUI PEUT STOCKER QUOI

   DEUX PORTES POUR UN GESTE, ET CE N'EST PAS UN DOUBLON. Celle du
   développement sert la boucle « créer, basculer, essayer » : elle
   n'existe pas en ligne, et n'a donc pas à demander de rôle. Celle de
   l'admin sert la vraie vie — honorer un abonnement ne peut pas
   dépendre d'un drapeau fermé en production.

   CE QUE CE FICHIER GARDE AVANT TOUT : ni l'une ni l'autre n'écrit
   `is_admin`. Le rôle ne s'obtient QUE par l'environnement du
   déploiement, et une route qui le distribuerait défairait la seule
   garantie que ce serveur donne sur lui-même.

   Et la table de l'admin ne recalcule rien : ses plafonds sortent de
   `ceilingsFor`, qui prend la PERSONNE et non le palier — sans quoi
   l'infini de l'admin serait le premier perdu.
   ============================================================ */

let db: Db;

beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

const boss = async () => {
  const p = await store.createPerson(db, "maquecime");
  await store.markAdmins(db, ["maquecime"]);
  return { person: p, cookie: `session=${await store.openSession(db, p.id)}` };
};

describe("la porte de développement pose un palier", () => {
  it("bascule un compte en abonné, et le dit", async () => {
    const app = await testApp(db, { devDoor: true });
    await store.createPerson(db, "anna");

    const r = await app.inject({
      method: "POST",
      url: "/dev/plan",
      payload: { pseudo: "anna", plan: "plus" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().plan).toBe("plus");
    /* Elle rend l'occupation : c'est ce qu'on vient regarder. */
    expect(r.json().mediaCeiling).toBe(ceilingsFor({ plan: "plus" }).media);
    await app.close();
  });

  it("refuse un palier qui n'existe pas", async () => {
    const app = await testApp(db, { devDoor: true });
    await store.createPerson(db, "anna");
    const r = await app.inject({
      method: "POST",
      url: "/dev/plan",
      payload: { pseudo: "anna", plan: "royal" },
    });
    expect(r.statusCode).toBe(400);
    await app.close();
  });

  /* LE TEST LE PLUS IMPORTANT DU FICHIER, comme dans `coffers`. */
  it("n'existe pas sans la porte de développement", async () => {
    const app = await testApp(db, { devDoor: false });
    await store.createPerson(db, "anna");
    const r = await app.inject({
      method: "POST",
      url: "/dev/plan",
      payload: { pseudo: "anna", plan: "plus" },
    });
    expect(r.statusCode).toBe(404);
    await app.close();
  });

  it("ne donne pas le rôle avec le palier", async () => {
    const app = await testApp(db, { devDoor: true });
    const anna = await store.createPerson(db, "anna");
    await app.inject({
      method: "POST",
      url: "/dev/plan",
      payload: { pseudo: "anna", plan: "plus" },
    });
    expect((await store.findById(db, anna.id))?.is_admin).toBeFalsy();
    await app.close();
  });
});

describe("la porte de l'admin", () => {
  it("accorde un palier, et il tient", async () => {
    const app = await testApp(db, {});
    const { cookie } = await boss();
    const anna = await store.createPerson(db, "anna");

    const r = await app.inject({
      method: "PUT",
      url: "/people/anna/plan",
      headers: { cookie },
      payload: { plan: "plus" },
    });
    expect(r.statusCode).toBe(200);
    expect((await store.usageOf(db, anna.id)).plan).toBe("plus");
    await app.close();
  });

  it("se refuse à qui n'a pas le rôle", async () => {
    const app = await testApp(db, {});
    const anna = await store.createPerson(db, "anna");
    const cookie = `session=${await store.openSession(db, anna.id)}`;
    const r = await app.inject({
      method: "PUT",
      url: "/people/anna/plan",
      headers: { cookie },
      payload: { plan: "plus" },
    });
    expect(r.statusCode).toBe(403);
    expect((await store.usageOf(db, anna.id)).plan).toBe("free");
    await app.close();
  });

  it("ne connaît personne de ce nom", async () => {
    const app = await testApp(db, {});
    const { cookie } = await boss();
    const r = await app.inject({
      method: "PUT",
      url: "/people/fantome/plan",
      headers: { cookie },
      payload: { plan: "plus" },
    });
    expect(r.statusCode).toBe(404);
    await app.close();
  });
});

describe("la table de qui peut stocker quoi", () => {
  it("dit le palier et les bornes de chacun", async () => {
    const app = await testApp(db, {});
    const { cookie } = await boss();
    const anna = await store.createPerson(db, "anna");
    await store.createPerson(db, "bruno");
    await store.setPlan(db, anna.id, "plus");
    await store.noteMedia(db, anna.id, `p/${anna.id}/x`);

    const rows = (await app.inject({ method: "GET", url: "/people", headers: { cookie } })).json()
      .people as Record<string, unknown>[];
    const by = (p: string) => rows.find((r) => r.pseudo === p)!;

    expect(by("anna").plan).toBe("plus");
    expect(by("anna").media).toBe(1);
    expect(by("anna").mediaCeiling).toBe(ceilingsFor({ plan: "plus" }).media);
    expect(by("bruno").mediaCeiling).toBe(ceilingsFor({ plan: "free" }).media);
    await app.close();
  });

  /* L'ADMIN SORT SANS BORNE, ET PAR `null`. C'est le même contrat que
     `usageOf` : `Infinity` ne traverse pas le JSON, et un écran qui
     déduirait les bornes du seul `plan` verrait un admin « free » et
     lui collerait le plafond du gratuit. */
  it("ne borne pas l'admin, et le met sur le fil en `null`", async () => {
    const app = await testApp(db, {});
    const { cookie } = await boss();
    const r = await app.inject({ method: "GET", url: "/people", headers: { cookie } });
    const chef = (r.json().people as Record<string, unknown>[]).find(
      (p) => p.pseudo === "maquecime"
    )!;
    expect(chef.isAdmin).toBe(true);
    expect(chef.plan).toBe("free");
    expect(chef.mediaCeiling).toBeNull();
    expect(chef.importCeiling).toBeNull();
    await app.close();
  });

  it("ne se lit pas sans le rôle", async () => {
    const app = await testApp(db, {});
    const anna = await store.createPerson(db, "anna");
    const cookie = `session=${await store.openSession(db, anna.id)}`;
    expect(
      (await app.inject({ method: "GET", url: "/people", headers: { cookie } })).statusCode
    ).toBe(403);
    await app.close();
  });
});
