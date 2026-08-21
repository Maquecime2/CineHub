import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { ceilingsFor, MEDIA_CEILING, DECOR_CEILING } from "../src/limits.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   LES TROIS PALIERS

   Le produit est le même des trois côtés : les mêmes écrans, les mêmes
   gestes, le même hall. Ce qui change est la PLACE qu'on occupe chez
   nous, parce que c'est la seule chose qui coûte.

   Ce qui se vérifie ici :

   LE DÉFAUT EST `free`. Un défaut à `plus` aurait ouvert les vannes à
   tout compte créé pendant que le paiement est en panne.

   L'ADMIN PASSE AU-DESSUS DE TOUT, et par `Infinity` : une comparaison
   contre l'infini ne se trompe jamais, là où un milliard finit par
   ressembler à une limite.

   ET LES IMPORTS SE COMPTENT SUR UNE FENÊTRE GLISSANTE. Un compteur
   remis à zéro le premier du mois donnerait deux imports à cheval sur
   deux jours.
   ============================================================ */

let db: Db;

beforeEach(async () => {
  db = await testDb();
});

afterEach(async () => {
  await db.close();
});

describe("ce qu'un palier accorde", () => {
  it("part de `free`, jamais de `plus`", async () => {
    const a = await store.createPerson(db, "anna");
    expect((await store.findById(db, a.id))?.plan).toBe("free");
  });

  it("donne au gratuit une part de la référence", async () => {
    const free = ceilingsFor({ plan: "free" });
    expect(free.media).toBeLessThan(MEDIA_CEILING);
    expect(free.decors).toBeLessThan(DECOR_CEILING);
    /* Une part, pas rien : un compte gratuit doit pouvoir se servir du
       produit, sinon ce n'est pas un palier, c'est une vitrine. */
    expect(free.media).toBeGreaterThan(0);
    expect(free.imports).toBeGreaterThan(0);
  });

  it("rend la référence à l'abonné, et ne compte plus ses imports", () => {
    const plus = ceilingsFor({ plan: "plus" });
    expect(plus.media).toBe(MEDIA_CEILING);
    expect(plus.decors).toBe(DECOR_CEILING);
    expect(plus.imports).toBe(Infinity);
  });

  /* `Infinity` et non un très grand nombre : un milliard finit par
     ressembler à une limite, et par en devenir une. */
  it("ne borne rien pour l'admin, quel que soit son palier", () => {
    for (const plan of ["free", "plus"]) {
      const boss = ceilingsFor({ plan, is_admin: true });
      expect(boss.media).toBe(Infinity);
      expect(boss.decors).toBe(Infinity);
      expect(boss.decorBytes).toBe(Infinity);
      expect(boss.imports).toBe(Infinity);
    }
  });

  /* Un palier inconnu — une colonne écrite à la main de travers, une
     migration à moitié faite — doit retomber sur le plus SERRÉ. */
  it("retombe sur le gratuit devant un palier qu'il ne connaît pas", () => {
    expect(ceilingsFor({ plan: "royal" })).toEqual(ceilingsFor({ plan: "free" }));
    expect(ceilingsFor({})).toEqual(ceilingsFor({ plan: "free" }));
  });
});

describe("le palier commande les plafonds", () => {
  it("desserre les médias quand on passe abonné", async () => {
    const a = await store.createPerson(db, "anna");
    const free = ceilingsFor({ plan: "free" });

    for (let i = 0; i < free.media; i += 1) {
      await store.noteMedia(db, a.id, `p/${a.id}/m${i}`);
    }
    expect(await store.noteMedia(db, a.id, `p/${a.id}/de-trop`)).toBe(false);

    await store.setPlan(db, a.id, "plus");
    expect(await store.noteMedia(db, a.id, `p/${a.id}/de-trop`)).toBe(true);
  });

  it("dit le palier et ses bornes dans l'occupation", async () => {
    const a = await store.createPerson(db, "anna");
    const before = await store.usageOf(db, a.id);
    expect(before.plan).toBe("free");
    expect(before.mediaCeiling).toBe(ceilingsFor({ plan: "free" }).media);

    await store.setPlan(db, a.id, "plus");
    const after = await store.usageOf(db, a.id);
    expect(after.plan).toBe("plus");
    expect(after.mediaCeiling).toBe(MEDIA_CEILING);
  });
});

/* ============================================================
   L'INFINI TRAVERSE LE FIL

   `ceilingsFor` était juste et l'écran mentait quand même : ces tests
   manquaient, et c'est très exactement par là que c'est passé. L'admin
   n'était éprouvé qu'au niveau de la FONCTION PURE — jamais à travers
   `usageOf`, jamais à travers `noteMedia`.

   Or `JSON.stringify(Infinity)` vaut `null`. Le tiroir d'un admin
   affichait donc « 12 / null » et se teignait en rouge, puisque
   `12 >= null` vaut `12 >= 0` : le serveur accordait l'infini et l'écran
   annonçait le contraire.

   ON ÉPROUVE DONC CE QUI SORT, et non ce qui se calcule.
   ============================================================ */
describe("ce que l'occupation met sur le fil", () => {
  const admin = async (pseudo: string) => {
    const p = await store.createPerson(db, pseudo);
    await store.markAdmins(db, [pseudo]);
    return p;
  };

  it("rend `null` et non `Infinity` pour un admin", async () => {
    const boss = await admin("chef");
    const u = await store.usageOf(db, boss.id);

    /* `null` est une VALEUR — « rien ne refuse » — et non un accident de
       sérialisation. `Infinity` ne serait pas seulement illisible : il
       deviendrait `null` plus loin, sans que personne l'ait décidé. */
    expect(u.mediaCeiling).toBeNull();
    expect(u.decorCeiling).toBeNull();
    expect(u.decorBytesCeiling).toBeNull();
    expect(u.importCeiling).toBeNull();
    expect(u.isAdmin).toBe(true);
  });

  /* CELUI-CI N'AURAIT RIEN ATTRAPÉ, ET IL RESTE. C'est le test du dessus
     qui mord — il lit l'objet AVANT sérialisation, là où traînait
     `Infinity`. Passé par JSON, le défaut se déguisait en la bonne
     réponse : `Infinity` y devient `null` tout seul. Ce test-ci ne garde
     donc pas la conversion, il garde le CONTRAT du fil — un plafond
     absent vaut `null`, et rien d'autre ne doit s'y substituer un jour
     (un `-1`, un `0`, un très grand nombre). */
  it("survit à un aller-retour JSON", async () => {
    const boss = await admin("chef");
    const wire = JSON.parse(JSON.stringify(await store.usageOf(db, boss.id)));
    expect(wire.mediaCeiling).toBeNull();
    expect(wire.isAdmin).toBe(true);
  });

  it("garde des nombres pour qui a un palier", async () => {
    const a = await store.createPerson(db, "anna");
    const u = JSON.parse(JSON.stringify(await store.usageOf(db, a.id)));
    expect(u.mediaCeiling).toBe(ceilingsFor({ plan: "free" }).media);
    expect(u.importCeiling).toBe(ceilingsFor({ plan: "free" }).imports);
    expect(u.isAdmin).toBe(false);
  });

  /* ET L'INFINI DOIT ÊTRE VRAI, pas seulement bien écrit : on dépasse le
     plafond du gratuit et rien ne refuse. */
  it("ne refuse jamais un média à l'admin", async () => {
    const boss = await admin("chef");
    const free = ceilingsFor({ plan: "free" });

    for (let i = 0; i <= free.media; i += 1) {
      expect(await store.noteMedia(db, boss.id, `p/${boss.id}/m${i}`)).toBe(true);
    }
    const u = await store.usageOf(db, boss.id);
    expect(u.media).toBeGreaterThan(free.media);
    expect(u.mediaCeiling).toBeNull();
  });

  it("ne compte pas les imports de l'admin", async () => {
    const boss = await admin("chef");
    for (let i = 0; i < 5; i += 1) {
      expect(await store.noteImport(db, boss.id)).toBe(true);
    }
    expect(await store.importsInWindow(db, boss.id)).toBe(0);
  });
});

describe("les imports", () => {
  it("en accorde un au gratuit, puis refuse", async () => {
    const a = await store.createPerson(db, "anna");
    const allowed = ceilingsFor({ plan: "free" }).imports;

    for (let i = 0; i < allowed; i += 1) {
      expect(await store.noteImport(db, a.id)).toBe(true);
    }
    expect(await store.noteImport(db, a.id)).toBe(false);
    expect(await store.importsInWindow(db, a.id)).toBe(allowed);
  });

  /* L'abonné n'est pas compté DU TOUT : on n'écrit même pas la ligne.
     Une table qui grossit pour personne est une table qu'on nettoiera un
     jour sans savoir pourquoi. */
  it("ne compte pas ceux de l'abonné", async () => {
    const a = await store.createPerson(db, "anna");
    await store.setPlan(db, a.id, "plus");

    for (let i = 0; i < 5; i += 1) {
      expect(await store.noteImport(db, a.id)).toBe(true);
    }
    expect(await store.importsInWindow(db, a.id)).toBe(0);
  });

  /* LA FENÊTRE GLISSE. Un import d'il y a deux mois ne doit plus peser
     sur celui d'aujourd'hui. */
  it("oublie ce qui est sorti de la fenêtre", async () => {
    const a = await store.createPerson(db, "anna");
    expect(await store.noteImport(db, a.id)).toBe(true);
    expect(await store.noteImport(db, a.id)).toBe(false);

    await db.query(
      "UPDATE import_run SET ran_at = now() - interval '31 days' WHERE person_id = $1",
      [a.id]
    );
    expect(await store.importsInWindow(db, a.id)).toBe(0);
    expect(await store.noteImport(db, a.id)).toBe(true);
  });

  it("compte par personne", async () => {
    const a = await store.createPerson(db, "anna");
    const b = await store.createPerson(db, "bruno");
    await store.noteImport(db, a.id);
    expect(await store.importsInWindow(db, b.id)).toBe(0);
    expect(await store.noteImport(db, b.id)).toBe(true);
  });

  it("s'efface avec le compte", async () => {
    const a = await store.createPerson(db, "anna");
    await store.noteImport(db, a.id);
    await store.deletePerson(db, a.id);
    expect(await db.query("SELECT 1 FROM import_run WHERE person_id = $1", [a.id])).toHaveLength(0);
  });
});
