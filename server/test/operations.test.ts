import { describe, it, expect, beforeEach, afterEach } from "vitest";
import webpush from "web-push";
import { testApp, testDb } from "./helpers.ts";
import * as depot from "../src/store.ts";
import { pushTo, remindChallenges, configurePush } from "../src/push.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   L'EXPLOITATION — mesurer sans surveiller, sonner sans harceler

   Ces tests portent sur des propriétés qu'on ne voit pas à l'usage et
   qui se perdent en silence : qu'un compteur ne garde rien de
   personnel, et qu'un rappel ne parte qu'une fois. Un défaut sur l'un
   ou l'autre ne casse rien — il fabrique un registre de surveillance,
   ou fait couper les notifications.
   ============================================================ */

let base: Db;
let app: FastifyInstance;

async function compte(pseudo: string) {
  const personne = await depot.createPerson(base, pseudo);
  const secret = await depot.openSession(base, personne.id);
  return { personne, cookie: `session=${secret}` };
}

beforeEach(async () => {
  base = await testDb();
  app = await testApp(base);
});

afterEach(async () => {
  await app.close();
  await base.close();
  configurePush(null);
});

describe("la mesure d'usage", () => {
  it("compte le chemin de ROUTE, jamais l'adresse réelle", async () => {
    /* `GET /listes/:id` et non `GET /listes/97703c16-…`. L'URL réelle
       porte des identifiants ; compter l'une pour l'autre aurait
       fabriqué exactement le registre qu'on refuse de tenir. */
    const moi = await compte("moi");
    const liste = (
      await app.inject({
        method: "POST",
        url: "/listes",
        headers: { cookie: moi.cookie },
        payload: { titre: "Mars" },
      })
    ).json().id;
    await app.inject({ method: "GET", url: `/listes/${liste}`, headers: { cookie: moi.cookie } });

    const gestes = (await depot.mesures(base)).map((m) => m.geste);
    expect(gestes).toContain("GET /listes/:id");
    expect(gestes.join(" ")).not.toContain(liste);
  });

  it("ne garde rien qui désigne quelqu'un", async () => {
    const varda = await compte("varda");
    await app.inject({ method: "GET", url: "/moi", headers: { cookie: varda.cookie } });

    /* La table entière, colonne par colonne : trois champs, et pas un
       de plus. Une colonne ajoutée un jour « pour voir » ferait échouer
       ce test, et c'est exactement son objet. */
    const colonnes = (
      await base.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'mesure'"
      )
    )
      .map((c) => c.column_name)
      .sort();
    expect(colonnes).toEqual(["geste", "jour", "n"]);

    const tout = JSON.stringify(await depot.mesures(base));
    expect(tout).not.toContain(varda.personne.id);
    expect(tout).not.toContain("varda");
  });

  it("compte ce qui réussit, et laisse les échecs au journal", async () => {
    await app.inject({ method: "GET", url: "/moi" }); // 401
    await app.inject({ method: "GET", url: "/sante" });
    const gestes = (await depot.mesures(base)).map((m) => m.geste);
    expect(gestes).toContain("GET /sante");
    expect(gestes).not.toContain("GET /moi");
  });

  it("s'additionne par jour, sans une ligne par requête", async () => {
    for (let i = 0; i < 3; i += 1) await app.inject({ method: "GET", url: "/sante" });
    const lignes = (await depot.mesures(base)).filter((m) => m.geste === "GET /sante");
    expect(lignes).toHaveLength(1);
    expect(Number(lignes[0]!.n)).toBe(3);
  });
});

describe("les notifications", () => {
  it("se déclarent absentes plutôt que de faire semblant", async () => {
    const moi = await compte("moi");
    const etat = await app.inject({ method: "GET", url: "/poussees" });
    expect(etat.json()).toEqual({ possible: false, cle: null });

    const abonner = await app.inject({
      method: "PUT",
      url: "/poussees",
      headers: { cookie: moi.cookie },
      payload: { point: "https://push.example/abc", p256dh: "k", secret: "s" },
    });
    expect(abonner.statusCode).toBe(503);
  });

  it("un abonnement appartient à un appareil, pas à une personne", async () => {
    /* Deux navigateurs du même compte font deux lignes, et fermer l'un
       ne doit pas faire taire l'autre. */
    configurePush(reglagesDEssai());
    const moi = await compte("moi");
    for (const point of ["https://push.example/tel", "https://push.example/bureau"]) {
      await app.inject({
        method: "PUT",
        url: "/poussees",
        headers: { cookie: moi.cookie },
        payload: { point, p256dh: "k", secret: "s" },
      });
    }
    expect(await depot.pushesOf(base, moi.personne.id)).toHaveLength(2);

    await app.inject({
      method: "DELETE",
      url: "/poussees",
      headers: { cookie: moi.cookie },
      payload: { point: "https://push.example/bureau" },
    });
    const reste = await depot.pushesOf(base, moi.personne.id);
    expect(reste.map((p) => p.point)).toEqual(["https://push.example/tel"]);
  });

  it("change de propriétaire quand quelqu'un d'autre ouvre ce navigateur", async () => {
    /* Sans cela, un ordinateur partagé pousserait les rappels d'une
       personne à la suivante. */
    configurePush(reglagesDEssai());
    const un = await compte("unetelle");
    const deux = await compte("unautre");
    const point = "https://push.example/partage";
    for (const c of [un.cookie, deux.cookie]) {
      await app.inject({
        method: "PUT",
        url: "/poussees",
        headers: { cookie: c },
        payload: { point, p256dh: "k", secret: "s" },
      });
    }
    expect(await depot.pushesOf(base, un.personne.id)).toEqual([]);
    expect(await depot.pushesOf(base, deux.personne.id)).toHaveLength(1);
  });

  it("refuse un abonnement qui n'a pas la forme d'une adresse", async () => {
    configurePush(reglagesDEssai());
    const moi = await compte("moi");
    const r = await app.inject({
      method: "PUT",
      url: "/poussees",
      headers: { cookie: moi.cookie },
      payload: { point: "javascript:alert(1)", p256dh: "k", secret: "s" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("une panne passagère ne fait pas perdre l'abonnement", async () => {
    /* Seuls 404 et 410 disent qu'un point est mort. Tout le reste — le
       service de push en panne, le réseau coupé — est passager, et
       effacer sur cette foi ferait taire un appareil pour de bon. */
    configurePush(reglagesDEssai());
    const moi = await compte("moi");
    await depot.storePush(base, moi.personne.id, {
      point: "https://ce-service-nexiste-pas.invalid/abc",
      p256dh: Buffer.alloc(65, 4).toString("base64url"),
      secret: Buffer.alloc(16).toString("base64url"),
    });

    const atteints = await pushTo(base, moi.personne.id, { titre: "t", corps: "c" });
    expect(atteints).toBe(0);
    expect(await depot.pushesOf(base, moi.personne.id)).toHaveLength(1);
  });
});

describe("les rappels de défi", () => {
  async function defiQuiCommenceAujourdhui(cookie: string) {
    const liste = (
      await app.inject({
        method: "POST",
        url: "/listes",
        headers: { cookie },
        payload: { titre: "Mars" },
      })
    ).json().id;
    const jour = new Date().toISOString().slice(0, 10);
    return (
      await app.inject({
        method: "POST",
        url: "/defis",
        headers: { cookie },
        payload: { listeId: liste, titre: "Aujourd'hui", debut: jour, fin: jour },
      })
    ).json().id as string;
  }

  it("ne se disent qu'une fois, quel que soit le nombre de passages", async () => {
    /* Le balai tourne toutes les heures : sans la table des rappels
       déjà dits, le même défi serait annoncé vingt-quatre fois. */
    configurePush(reglagesDEssai());
    const moi = await compte("moi");
    await defiQuiCommenceAujourdhui(moi.cookie);

    const un = await remindChallenges(base);
    const deux = await remindChallenges(base);
    /* Un défi dont le début ET la fin tombent le même jour ne sonne
       qu'une fois : la requête ne rend qu'une ligne par participant, et
       « ça commence » l'emporte sur « ça finit ». */
    expect(un.dits).toBe(1);
    expect(deux.dits).toBe(0);
  });

  it("ne sonnent pas quand aucune clé n'est posée", async () => {
    const moi = await compte("moi");
    await defiQuiCommenceAujourdhui(moi.cookie);
    expect(await remindChallenges(base)).toEqual({ dits: 0, appareils: 0 });
    /* Et rien n'a été noté comme dit : le jour où l'on pose des clés,
       le rappel du jour part encore. */
    expect(await base.query("SELECT 1 FROM rappel_envoye")).toHaveLength(0);
  });

  it("ne concernent que ceux qui participent", async () => {
    configurePush(reglagesDEssai());
    const moi = await compte("moi");
    const autre = await compte("autre");
    const defi = await defiQuiCommenceAujourdhui(moi.cookie);
    await depot.leaveChallenge(base, defi, moi.personne.id);

    await remindChallenges(base);
    const dits = await base.query<{ personne_id: string }>("SELECT personne_id FROM rappel_envoye");
    expect(dits).toEqual([]);
    expect(autre).toBeTruthy();
  });

  it("ne parlent pas d'un défi qui n'est ni aujourd'hui ni ce soir", async () => {
    configurePush(reglagesDEssai());
    const moi = await compte("moi");
    const liste = (
      await app.inject({
        method: "POST",
        url: "/listes",
        headers: { cookie: moi.cookie },
        payload: { titre: "Mars" },
      })
    ).json().id;
    await app.inject({
      method: "POST",
      url: "/defis",
      headers: { cookie: moi.cookie },
      payload: { listeId: liste, titre: "Plus tard", debut: "2099-01-01", fin: "2099-01-31" },
    });
    expect((await remindChallenges(base)).dits).toBe(0);
  });
});

/* Des clés valides, fabriquées à chaque essai : une clé écrite dans un
   fichier de test finit un jour dans un serveur. */
function reglagesDEssai() {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  return { publique: publicKey, privee: privateKey, contact: "mailto:essai@example.org" };
}
