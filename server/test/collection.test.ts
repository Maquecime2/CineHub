import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb, testApp } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   LE CATALOGUE QUI VIT EN BASE

   Une seule partie du présentoir se crée sans écrire de code : les
   pochettes et leurs objets. Ce fichier éprouve ce que cette
   ouverture a de risqué, et rien d'autre — le reste du comptoir est
   couvert par `shop.test.ts` et `sell.test.ts`.

   TROIS CHOSES, ET TOUTES LES TROIS SONT DES REFUS :

   Que l'écriture soit réservée au rôle, sans quoi n'importe qui se
   fabrique une pochette à un jeton.

   Qu'une pochette créée tire dans SES objets, et pas dans le stock
   d'origine — c'était le comportement qu'il fallait déplacer, et un
   tirage qui va se servir ailleurs marcherait sans qu'on le voie.

   Qu'on RETIRE au lieu d'effacer, parce que les identifiants sont
   écrits dans les collections de tout le monde.
   ============================================================ */

let db: Db;
let app: Awaited<ReturnType<typeof testApp>>;

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});
afterEach(async () => {
  await app.close();
  await db.close();
});

/** Quelqu'un, avec ou sans le rôle, et sa session. */
async function person(pseudo: string, admin = false) {
  const p = await store.createPerson(db, pseudo);
  if (admin) await store.markAdmins(db, [pseudo]);
  const secret = await store.openSession(db, p.id);
  return { id: p.id, cookie: `session=${secret}` };
}

const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("qui peut écrire le catalogue", () => {
  it("refuse une pochette à qui n'a pas le rôle", async () => {
    const me = await person("badiou");
    const r = await app.inject({
      method: "POST",
      url: "/shop/packs",
      headers: { cookie: me.cookie },
      payload: { id: "pack-noel", price: 1, labelFr: "Noël", labelEn: "Yule" },
    });
    expect(r.statusCode).toBe(403);
    expect(await store.listPacks(db)).toHaveLength(1);
  });

  it("accepte celle d'un admin", async () => {
    const boss = await person("maquecime", true);
    const r = await app.inject({
      method: "POST",
      url: "/shop/packs",
      headers: { cookie: boss.cookie },
      payload: { id: "pack-noel", price: 40, labelFr: "Noël", labelEn: "Yule" },
    });
    expect(r.statusCode).toBe(200);
    expect((await store.listPacks(db)).map((p) => p.id)).toContain("pack-noel");
  });

  /* L'IDENTIFIANT FINIT DANS UNE CLÉ DE BLOB ET DANS UNE URL. Il est
     donc taillé au dépôt, et pas au moment où on essaie de s'en servir —
     une pochette qu'on ne peut pas illustrer une heure après l'avoir
     créée est une pochette qu'on recommence. */
  it("refuse un identifiant qui n'est pas un mot simple", async () => {
    const boss = await person("maquecime", true);
    for (const id of ["Pack Noël", "../secret", "a", ""]) {
      const r = await app.inject({
        method: "POST",
        url: "/shop/packs",
        headers: { cookie: boss.cookie },
        payload: { id, price: 40, labelFr: "x", labelEn: "x" },
      });
      expect([400, 409]).toContain(r.statusCode);
    }
  });

  /* Le CHECK du schéma est ce qui rend la borne vraie ; la route ne fait
     que la dire en français. On éprouve le CHECK. */
  it("refuse un prix nul", async () => {
    await expect(
      store.upsertPack(db, { id: "pack-fou", price: 0, labelFr: "x", labelEn: "x" })
    ).rejects.toThrow();
  });
});

describe("une pochette créée", () => {
  async function garnie() {
    await store.upsertPack(db, {
      id: "pack-noel",
      price: 10,
      labelFr: "Noël",
      labelEn: "Yule",
    });
    await store.upsertDecor(db, {
      id: "vig-sapin",
      packId: "pack-noel",
      rarity: "common",
      media: "decor/vig-sapin.png",
      labelFr: "Sapin",
      labelEn: "Fir",
    });
    return "pack-noel";
  }

  it("tire dans SES objets et pas dans le stock d'origine", async () => {
    const me = await person("chantal");
    await store.award(db, me.id, "quiz", "seed", 100);
    await garnie();
    const { drawn } = await store.buy(db, me.id, "pack-noel", sequence(0, 0));
    expect(drawn).toEqual(["vig-sapin"]);
  });

  /* LES JETONS SONT DÉJÀ PARTIS QUAND LE TIRAGE COMMENCE. Une pochette
     qu'un admin crée et oublie de garnir ne doit donc pas lever : elle
     rend un paquet vide, qui se voit et se répare. */
  it("rend un paquet vide plutôt qu'une exception quand elle est vide", async () => {
    const me = await person("agnes");
    await store.award(db, me.id, "quiz", "seed", 100);
    await store.upsertPack(db, {
      id: "pack-vide",
      price: 10,
      labelFr: "Vide",
      labelEn: "Empty",
    });
    const { drawn, purse } = await store.buy(db, me.id, "pack-vide", sequence(0));
    expect(drawn).toEqual([]);
    /* Et elle a bien été payée : le refus serait une autre décision, pas
       un effet de bord. */
    expect(purse.tokens).toBe(90);
  });

  it("refuse encore le découvert", async () => {
    const me = await person("maurice");
    await store.award(db, me.id, "quiz", "seed", 5);
    await garnie();
    await expect(store.buy(db, me.id, "pack-noel", sequence(0))).rejects.toThrow(store.ShopRefusal);
  });

  it("s'achète autant de fois qu'on veut, contrairement à ce qu'on porte", async () => {
    const me = await person("jacques");
    await store.award(db, me.id, "quiz", "seed", 100);
    await garnie();
    await store.buy(db, me.id, "pack-noel", sequence(0, 0));
    await store.buy(db, me.id, "pack-noel", sequence(0, 0));
    expect((await store.holdingsOf(db, me.id)).decors[0]!.copies).toBe(2);
  });
});

describe("retirer, et pas effacer", () => {
  it("sort la pochette de l'étal sans toucher aux collections", async () => {
    const me = await person("marguerite");
    await store.award(db, me.id, "quiz", "seed", 100);
    await store.buy(db, me.id, "pack-trois", sequence(0, 0, 0));

    expect(await store.retirePack(db, "pack-trois", true)).toBe(true);
    expect((await store.listPacks(db)).map((p) => p.id)).not.toContain("pack-trois");
    /* CE QU'ON POSSÈDE RESTE. C'est toute la raison du retrait. */
    expect((await store.holdingsOf(db, me.id)).decors).toHaveLength(1);
    /* Et l'admin, lui, la voit toujours — sans quoi il ne pourrait plus
       la remettre. */
    expect((await store.listPacks(db, true)).map((p) => p.id)).toContain("pack-trois");
  });

  it("refuse d'acheter une pochette retirée", async () => {
    const me = await person("robert");
    await store.award(db, me.id, "quiz", "seed", 100);
    await store.retirePack(db, "pack-trois", true);
    await expect(store.buy(db, me.id, "pack-trois", sequence(0))).rejects.toThrow(
      store.ShopRefusal
    );
  });

  it("remet ce qui a été retiré", async () => {
    await store.retirePack(db, "pack-trois", true);
    await store.retirePack(db, "pack-trois", false);
    expect((await store.listPacks(db)).map((p) => p.id)).toContain("pack-trois");
  });

  it("sort un objet du tirage sans le sortir des collections", async () => {
    await store.retireDecor(db, "vig-palme", true);
    const live = (await store.listDecors(db, "pack-trois")).filter((s) => !s.retired);
    expect(live.map((s) => s.id)).not.toContain("vig-palme");
    /* La définition existe encore, donc l'album sait encore la nommer. */
    expect((await store.listDecors(db, "pack-trois")).map((s) => s.id)).toContain("vig-palme");
  });
});

/* ============================================================
   EFFACER POUR DE BON

   Le studio a désormais les DEUX gestes, et celui-ci est irréversible.
   Ce qu'on éprouve ici n'est pas qu'il marche — c'est ce qu'il COÛTE,
   parce que c'est cela qu'on oublie six mois plus tard : la vignette
   quitte la collection de ceux qui l'avaient.

   Le fantôme est l'autre moitié. `decor_won` n'a pas de clé étrangère
   vers `decor_def` : n'effacer que la définition laisserait une ligne de
   possession qui ne désigne plus rien, invisible et impossible à jeter.
   ============================================================ */
describe("effacer pour de bon", () => {
  it("dit combien de gens la possèdent, avant", async () => {
    const me = await person("chantal");
    await store.award(db, me.id, "quiz", "seed", 100);
    await store.buy(db, me.id, "pack-trois", sequence(0, 0, 0));
    const won = (await store.holdingsOf(db, me.id)).decors[0]!.decor_id;
    expect(await store.ownersOfDecor(db, won)).toBe(1);
  });

  it("emporte la vignette ET la possession, sans laisser de fantôme", async () => {
    const me = await person("agnes");
    await store.award(db, me.id, "quiz", "seed", 100);
    await store.buy(db, me.id, "pack-trois", sequence(0, 0, 0));
    const won = (await store.holdingsOf(db, me.id)).decors[0]!.decor_id;

    expect(await store.deleteDecorDef(db, won)).toBe(true);
    expect((await store.listDecors(db, "pack-trois")).map((s) => s.id)).not.toContain(won);
    /* LA DIFFÉRENCE AVEC LE RETRAIT, en une ligne : la collection maigrit. */
    expect((await store.holdingsOf(db, me.id)).decors).toHaveLength(0);
    expect(await store.ownersOfDecor(db, won)).toBe(0);
  });

  it("rend faux pour une vignette qui n'existe pas", async () => {
    expect(await store.deleteDecorDef(db, "vig-fantome")).toBe(false);
  });

  it("emporte la pochette, ses vignettes et ce qu'on en avait tiré", async () => {
    const me = await person("claire");
    await store.award(db, me.id, "quiz", "seed", 100);
    await store.buy(db, me.id, "pack-trois", sequence(0, 0, 0));

    expect(await store.deletePackDef(db, "pack-trois")).toBe(true);
    expect((await store.listPacks(db, true)).map((p) => p.id)).not.toContain("pack-trois");
    expect(await store.listDecors(db, "pack-trois")).toHaveLength(0);
    expect((await store.holdingsOf(db, me.id)).decors).toHaveLength(0);
  });
});

/* ------------------------------------------------------------
   CE QU'ON PORTE, MAINTENANT QU'IL Y EN A QUATRE
   ------------------------------------------------------------ */

describe("porter un papier, un titre, une peau", () => {
  it("refuse ce qu'on n'a pas acheté", async () => {
    const me = await person("leos");
    expect(await store.wear(db, me.id, "paper", "paper-verge")).toBe(false);
    expect(await store.wear(db, me.id, "title", "title-doyen")).toBe(false);
  });

  it("accepte ce qu'on a acheté, et le retire", async () => {
    const me = await person("claire");
    await store.award(db, me.id, "quiz", "seed", 300);
    await store.buy(db, me.id, "paper-verge", sequence(0));
    expect(await store.wear(db, me.id, "paper", "paper-verge")).toBe(true);
    expect((await store.holdingsOf(db, me.id)).worn.paper).toBe("paper-verge");
    expect(await store.wear(db, me.id, "paper", null)).toBe(true);
    expect((await store.holdingsOf(db, me.id)).worn.paper).toBeNull();
  });

  /* LA PEAU RANGE SA CLÉ ET NON SON ARTICLE, et c'était cassé : le
     présentoir envoyait déjà la clé, et la vérification de possession
     cherchait cette clé dans `owned`, qui ne contient que des articles.
     Porter une peau achetée était donc refusé, toujours, et aucune
     épreuve ne s'en apercevait — elles n'essayaient que des tampons,
     pour qui les deux se confondent. */
  it("porte une peau achetée, en rangeant sa clé", async () => {
    const me = await person("olivier");
    await store.award(db, me.id, "quiz", "seed", 300);
    await store.buy(db, me.id, "skin-sepia", sequence(0));
    expect(await store.wear(db, me.id, "skin", "skin-sepia")).toBe(true);
    expect((await store.holdingsOf(db, me.id)).worn.skin).toBe("sepia");
  });

  it("ne se paie pas deux fois pour un papier", async () => {
    const me = await person("bruno");
    await store.award(db, me.id, "quiz", "seed", 300);
    await store.buy(db, me.id, "paper-verge", sequence(0));
    await expect(store.buy(db, me.id, "paper-verge", sequence(0))).rejects.toThrow(
      store.ShopRefusal
    );
    expect((await store.purseOf(db, me.id)).tokens).toBe(230);
  });
});
