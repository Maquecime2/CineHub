import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { DECOR_CEILING, MEDIA_CEILING, QuotaReached } from "../src/limits.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   LES PLAFONDS — ce qu'un compte peut faire héberger

   IL N'Y EN AVAIT AUCUN, et c'était sans conséquence tant que le
   classeur était personnel. Le dépôt d'un média se fait par TICKET
   SIGNÉ : le navigateur écrit directement dans le container, le serveur
   ne voit ni le nombre ni la taille. Sur une adresse ouverte au public,
   une place illimitée qu'on héberge est une facture illimitée, et il
   suffit d'une personne pour la faire.

   Ce qui se vérifie ici, dans l'ordre de ce qui compte :

   LE REGISTRE EST IDEMPOTENT. Redemander un ticket pour le même chemin
   ne consomme rien. Sans cela, une synchronisation répétée — c'est-à-
   dire l'usage normal — épuiserait le plafond de quelqu'un qui n'a
   rien déposé de neuf.

   LE PLAFOND EST DANS L'INSERT. Entre lire un total et écrire une
   ligne, deux requêtes concurrentes passent toutes les deux ; c'est la
   même raison qui a mis le plafond quotidien du mérite à l'intérieur du
   sien.

   ET RANGER LIBÈRE LA PLACE, sans quoi un plafond atteint une fois
   l'est pour toujours.
   ============================================================ */

let db: Db;

const anna = async () => store.createPerson(db, "anna");
const bruno = async () => store.createPerson(db, "bruno");

beforeEach(async () => {
  db = await testDb();
});

afterEach(async () => {
  await db.close();
});

describe("le registre des médias", () => {
  it("accorde, et compte", async () => {
    const a = await anna();
    expect(await store.noteMedia(db, a.id, `p/${a.id}/affiche-1`)).toBe(true);
    expect((await store.usageOf(db, a.id)).media).toBe(1);
  });

  /* CELUI-CI EST LE PLUS IMPORTANT. Une affiche redéposée à chaque
     synchronisation ne doit pas coûter un rang de plafond par passage. */
  it("ne compte qu'une fois le même chemin, redemandé dix fois", async () => {
    const a = await anna();
    for (let i = 0; i < 10; i += 1) {
      expect(await store.noteMedia(db, a.id, `p/${a.id}/affiche-1`)).toBe(true);
    }
    expect((await store.usageOf(db, a.id)).media).toBe(1);
  });

  it("refuse au-delà du plafond, et laisse repasser ce qui est déjà noté", async () => {
    const a = await anna();
    for (let i = 0; i < MEDIA_CEILING; i += 1) {
      expect(await store.noteMedia(db, a.id, `p/${a.id}/m${i}`)).toBe(true);
    }
    /* Plein : un chemin NEUF est refusé… */
    expect(await store.noteMedia(db, a.id, `p/${a.id}/de-trop`)).toBe(false);
    /* …mais un chemin DÉJÀ noté passe encore, sinon on ne pourrait plus
       resynchroniser ce qu'on a déjà déposé. */
    expect(await store.noteMedia(db, a.id, `p/${a.id}/m0`)).toBe(true);
    expect((await store.usageOf(db, a.id)).media).toBe(MEDIA_CEILING);
  });

  it("libère la place quand on range", async () => {
    const a = await anna();
    for (let i = 0; i < MEDIA_CEILING; i += 1) await store.noteMedia(db, a.id, `p/${a.id}/m${i}`);
    expect(await store.noteMedia(db, a.id, `p/${a.id}/neuf`)).toBe(false);

    await store.forgetMedia(db, a.id, `p/${a.id}/m0`);
    expect(await store.noteMedia(db, a.id, `p/${a.id}/neuf`)).toBe(true);
  });

  /* Le plafond est PAR PERSONNE. Un compte plein ne doit pas fermer la
     porte au voisin — c'est le genre de faute qu'une requête sans
     `WHERE person_id` produit sans bruit. */
  it("ne compte que ses propres médias", async () => {
    const a = await anna();
    const b = await bruno();
    await store.noteMedia(db, a.id, `p/${a.id}/x`);
    expect((await store.usageOf(db, b.id)).media).toBe(0);
    expect(await store.noteMedia(db, b.id, `p/${b.id}/x`)).toBe(true);
  });

  /* La cascade du schéma, vue depuis cette table : effacer un compte
     n'y laisse pas de lignes orphelines. */
  it("s'efface avec le compte", async () => {
    const a = await anna();
    await store.noteMedia(db, a.id, `p/${a.id}/x`);
    await store.deletePerson(db, a.id);
    const rest = await db.query("SELECT 1 FROM media WHERE person_id = $1", [a.id]);
    expect(rest).toHaveLength(0);
  });
});

describe("le plafond des décors", () => {
  it("compte ce qu'on tient, et ce qu'il pèse", async () => {
    const a = await anna();
    await store.createDecor(db, { ownerId: a.id, label: "une lampe", bytes: 1000 });
    await store.createDecor(db, { ownerId: a.id, label: "un tapis", bytes: 2000 });
    const u = await store.usageOf(db, a.id);
    expect(u.decors).toBe(2);
    expect(u.decorBytes).toBe(3000);
  });

  it("refuse au-delà du nombre, en nommant ce qui est plein", async () => {
    const a = await anna();
    for (let i = 0; i < DECOR_CEILING; i += 1) {
      await store.createDecor(db, { ownerId: a.id, label: `objet ${i}` });
    }
    await expect(store.createDecor(db, { ownerId: a.id, label: "de trop" })).rejects.toThrow(
      QuotaReached
    );
    try {
      await store.createDecor(db, { ownerId: a.id, label: "de trop" });
    } catch (e) {
      expect((e as QuotaReached).quel).toBe("decors");
    }
  });

  it("refuse au-delà du poids, en le nommant autrement", async () => {
    const a = await anna();
    /* Un seul objet énorme suffit : c'est le cas honnête que ce
       plafond-ci attrape, là où celui du nombre ne voit rien. */
    await expect(
      store.createDecor(db, { ownerId: a.id, label: "un mur entier", bytes: 500 * 1024 * 1024 })
    ).rejects.toThrow(QuotaReached);
    try {
      await store.createDecor(db, {
        ownerId: a.id,
        label: "un mur entier",
        bytes: 500 * 1024 * 1024,
      });
    } catch (e) {
      expect((e as QuotaReached).quel).toBe("decors-octets");
    }
  });

  /* UN DÉCOR RETIRÉ EST UNE PIERRE TOMBALE, pas une suppression — sinon
     la cascade reprendrait la pièce à ceux qui l'ont adoptée. Il ne doit
     donc plus compter dans le plafond de son auteur, et c'est le
     `NOT deleted` de la requête qui le dit. */
  it("ne compte plus un décor retiré", async () => {
    const a = await anna();
    const lampe = await store.createDecor(db, { ownerId: a.id, label: "une lampe", bytes: 500 });
    expect((await store.usageOf(db, a.id)).decors).toBe(1);

    await store.deleteDecor(db, a.id, lampe.id);
    const u = await store.usageOf(db, a.id);
    expect(u.decors).toBe(0);
    expect(u.decorBytes).toBe(0);
  });

  it("ne compte que les siens", async () => {
    const a = await anna();
    const b = await bruno();
    await store.createDecor(db, { ownerId: a.id, label: "une lampe", bytes: 900 });
    const u = await store.usageOf(db, b.id);
    expect(u.decors).toBe(0);
    expect(u.decorBytes).toBe(0);
  });
});

describe("ce que le plafond ne touche pas", () => {
  /* LA LIGNE DE `CLAUDE.md`, VUE D'ICI. Ces plafonds bornent ce que le
     SERVEUR héberge. Les fiches, elles, ne se bornent pas : ranger et
     noter ne se paient jamais, et la synchro des cartes n'a rien à voir
     avec la place qu'on occupe en médias. */
  it("laisse passer les fiches quand les médias sont pleins", async () => {
    const a = await anna();
    for (let i = 0; i < MEDIA_CEILING; i += 1) await store.noteMedia(db, a.id, `p/${a.id}/m${i}`);
    expect(await store.noteMedia(db, a.id, `p/${a.id}/neuf`)).toBe(false);

    await store.storeCard(db, a.id, {
      id: "film-1",
      data: { title: "Stalker" },
      updatedAt: new Date(),
    });
    expect(await store.countCards(db, a.id)).toBe(1);
  });
});
