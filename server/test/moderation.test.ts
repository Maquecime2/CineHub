import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   LE BUREAU DE MODÉRATION

   La table `report` existait, la route pour SIGNALER aussi, et son
   `handled_at` n'a jamais été écrit une seule fois : rien ne savait
   lister ce qui attendait, donc rien ne pouvait le traiter. Un
   signalement qu'on ne peut pas lire vaut un signalement qu'on refuse.

   Ce qui se vérifie ici :

   LA FILE SE REGROUPE PAR CIBLE. Dix personnes signalant la même fiche
   font dix lignes — chacune a fait son geste — mais une seule chose à
   regarder. Le nombre d'échos dit par où commencer, et c'est pour ça
   qu'il commande le tri.

   CLORE FERME TOUTE LA CIBLE. En fermer une sur dix ferait revenir la
   même chose neuf fois.

   ET LE PLAIGNANT NE SORT PAS. On juge un contenu, pas une personne qui
   se plaint.
   ============================================================ */

let db: Db;

const anna = async () => store.createPerson(db, "anna");
const bruno = async () => store.createPerson(db, "bruno");
const chloe = async () => store.createPerson(db, "chloe");

beforeEach(async () => {
  db = await testDb();
});

afterEach(async () => {
  await db.close();
});

describe("la file d'attente", () => {
  it("ne montre que ce qui n'est pas traité", async () => {
    const a = await anna();
    const b = await bruno();
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "f1",
      aboutId: b.id,
      reason: "ça ne va pas",
    });

    expect(await store.reportsToHandle(db)).toHaveLength(1);
    await store.handleReports(db, "card", "f1");
    expect(await store.reportsToHandle(db)).toHaveLength(0);
  });

  /* Dix lignes, une chose à regarder. */
  it("regroupe par cible et compte les échos", async () => {
    const a = await anna();
    const b = await bruno();
    const c = await chloe();
    for (const who of [a, c]) {
      await store.report(db, who.id, {
        targetType: "card",
        targetId: "f1",
        aboutId: b.id,
        reason: "ça ne va pas",
      });
    }
    const queue = await store.reportsToHandle(db);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.echoes).toBe(2);
    expect(queue[0]!.about).toBe("bruno");
  });

  /* LE NOMBRE D'ÉCHOS DIT PAR OÙ COMMENCER, donc il commande le tri. */
  it("met devant ce qui est le plus signalé", async () => {
    const a = await anna();
    const b = await bruno();
    const c = await chloe();
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "peu",
      aboutId: b.id,
      reason: "bof",
    });
    for (const who of [a, c]) {
      await store.report(db, who.id, {
        targetType: "card",
        targetId: "beaucoup",
        aboutId: b.id,
        reason: "grave",
      });
    }
    const queue = await store.reportsToHandle(db);
    expect(queue.map((r) => r.target_id)).toEqual(["beaucoup", "peu"]);
  });

  /* On juge un contenu, pas un plaignant : son identifiant n'a rien à
     faire dans ce qui sort. */
  it("ne fait pas sortir qui a signalé", async () => {
    const a = await anna();
    const b = await bruno();
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "f1",
      aboutId: b.id,
      reason: "ça ne va pas",
    });
    const printed = JSON.stringify(await store.reportsToHandle(db));
    expect(printed).not.toContain(a.id);
    expect(printed).not.toContain("anna");
  });

  /* Un compte effacé emporte ses signalements par cascade, mais celui
     qui VISAIT quelqu'un d'autre doit rester lisible. */
  it("survit à la disparition du plaignant", async () => {
    const a = await anna();
    const b = await bruno();
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "f1",
      aboutId: b.id,
      reason: "ça ne va pas",
    });
    await store.deletePerson(db, a.id);
    const queue = await store.reportsToHandle(db);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.about).toBe("bruno");
  });
});

describe("traiter", () => {
  /* En fermer une sur dix ferait revenir la même chose neuf fois. */
  it("ferme toute la cible d'un coup", async () => {
    const a = await anna();
    const b = await bruno();
    const c = await chloe();
    for (const who of [a, c]) {
      await store.report(db, who.id, {
        targetType: "card",
        targetId: "f1",
        aboutId: b.id,
        reason: "ça ne va pas",
      });
    }
    expect(await store.handleReports(db, "card", "f1")).toBe(2);
    expect(await store.reportsToHandle(db)).toHaveLength(0);
  });

  it("ne ferme pas deux fois", async () => {
    const a = await anna();
    const b = await bruno();
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "f1",
      aboutId: b.id,
      reason: "ça ne va pas",
    });
    expect(await store.handleReports(db, "card", "f1")).toBe(1);
    expect(await store.handleReports(db, "card", "f1")).toBe(0);
  });

  /* RETIRER DU PARTAGE EST RÉVERSIBLE : c'est la colonne que l'auteur
     manipule lui-même. Rien n'est détruit. */
  it("retire la fiche visée du partage, chez la bonne personne", async () => {
    const a = await anna();
    const b = await bruno();
    /* Les deux ont une fiche portant le MÊME identifiant : il est unique
       par personne, pas globalement. Seule celle de la personne visée
       doit bouger. */
    for (const who of [a, b]) {
      await store.storeCard(db, who.id, {
        id: "f1",
        data: { title: "Stalker" },
        updatedAt: new Date(),
      });
    }
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "f1",
      aboutId: b.id,
      reason: "ça ne va pas",
    });

    expect(await store.hideReported(db, "f1")).toBe(true);
    expect(await store.hiddenCards(db, b.id)).toEqual(["f1"]);
    expect(await store.hiddenCards(db, a.id)).toEqual([]);
  });

  it("ne cache rien quand la fiche visée n'existe plus", async () => {
    const a = await anna();
    const b = await bruno();
    await store.report(db, a.id, {
      targetType: "card",
      targetId: "disparue",
      aboutId: b.id,
      reason: "ça ne va pas",
    });
    expect(await store.hideReported(db, "disparue")).toBe(false);
  });
});
