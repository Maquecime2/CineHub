import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appDEssai, baseDEssai } from "./aide.ts";
import * as depot from "../src/depot.ts";
import type { Base } from "../src/base.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LE PARTAGE

   `GET /chez/:pseudo` est la SEULE route de ce serveur qui réponde à
   quelqu'un sans compte. Tout ce qui suit se demande donc, à chaque
   ligne, ce qu'un inconnu peut en tirer : ce qu'il voit, ce qu'il ne
   doit jamais voir, et ce que la réponse lui apprend sur les gens qui
   ne partagent pas.
   ============================================================ */

let base: Base;
let app: FastifyInstance;

async function connecte(pseudo: string) {
  const personne = await depot.creerPersonne(base, pseudo);
  const secret = await depot.ouvrirSession(base, personne.id);
  return { personne, cookie: `session=${secret}` };
}

/** Une fiche complète, notes et journal compris. */
const pousser = (cookie: string, fiches: Record<string, unknown>[]) =>
  app.inject({ method: "PUT", url: "/collection", headers: { cookie }, payload: { fiches } });

const regler = (cookie: string, partage: string) =>
  app.inject({ method: "PUT", url: "/partage", headers: { cookie }, payload: { partage } });

beforeEach(async () => {
  base = await baseDEssai();
  app = await appDEssai(base);
});

afterEach(async () => {
  await app.close();
  await base.fermer();
});

describe("par défaut, on ne partage rien", () => {
  it("une collection est muette tant qu'on ne l'a pas ouverte", async () => {
    const { cookie } = await connecte("varda");
    await pousser(cookie, [{ id: "f1", majLe: 1, donnees: { title: "Cléo de 5 à 7" } }]);

    const r = await app.inject({ method: "GET", url: "/chez/varda" });
    expect(r.statusCode).toBe(404);
  });

  it("et un compte qui n'existe pas répond exactement pareil", async () => {
    /* Sinon la route devient un annuaire : « 404 » d'un côté, « privé »
       de l'autre, et l'on sait qui est inscrit. */
    const { cookie } = await connecte("varda");
    await pousser(cookie, [{ id: "f1", majLe: 1, donnees: {} }]);

    const privee = await app.inject({ method: "GET", url: "/chez/varda" });
    const inconnue = await app.inject({ method: "GET", url: "/chez/jamais-vue" });
    expect(privee.statusCode).toBe(inconnue.statusCode);
    expect(privee.json()).toEqual(inconnue.json());
  });
});

describe("ce qu'un visiteur voit", () => {
  it("les films, la note et la critique — jamais les notes ni le journal", async () => {
    const { cookie } = await connecte("varda");
    await pousser(cookie, [
      {
        id: "f1",
        tmdbId: 42,
        majLe: 1,
        donnees: {
          title: "Cléo de 5 à 7",
          rating: 5,
          review: "la scène du chapeau",
          notes: "SECRET : à revoir avec P.",
          watches: [{ date: "2024-03-02", rating: 5 }],
          watchedAt: "2024-03-02",
        },
      },
    ]);
    await regler(cookie, "publique");

    const r = await app.inject({ method: "GET", url: "/chez/varda" });
    expect(r.statusCode).toBe(200);
    const film = r.json().films[0];

    expect(film).toMatchObject({
      title: "Cléo de 5 à 7",
      rating: 5,
      review: "la scène du chapeau",
    });
    /* LES TROIS QUI NE SORTENT JAMAIS. Le carnet intime, le journal des
       séances, et la date de la dernière — qui dit à elle seule avec
       quelle régularité on passe ses soirées. */
    expect("notes" in film).toBe(false);
    expect("watches" in film).toBe(false);
    expect("watchedAt" in film).toBe(false);
    /* Et rien de la personne au-delà de son pseudonyme. */
    expect(Object.keys(r.json()).sort()).toEqual(["films", "pseudo"]);
  });

  it("une fiche écartée reste chez elle", async () => {
    const { cookie } = await connecte("varda");
    await pousser(cookie, [
      { id: "montrable", majLe: 1, donnees: { title: "Playtime" } },
      { id: "honteuse", majLe: 1, donnees: { title: "un plaisir coupable" } },
    ]);
    await regler(cookie, "publique");
    await app.inject({
      method: "PUT",
      url: "/fiche/honteuse/cachee",
      headers: { cookie },
      payload: { cachee: true },
    });

    const r = await app.inject({ method: "GET", url: "/chez/varda" });
    expect(r.json().films.map((f: { title: string }) => f.title)).toEqual(["Playtime"]);
  });

  it("une fiche effacée ne revient pas par la porte du partage", async () => {
    const { cookie } = await connecte("varda");
    await pousser(cookie, [{ id: "f1", majLe: 1, donnees: { title: "Playtime" } }]);
    await pousser(cookie, [{ id: "f1", majLe: 2, supprimee: true, donnees: {} }]);
    await regler(cookie, "publique");

    const r = await app.inject({ method: "GET", url: "/chez/varda" });
    expect(r.json().films).toEqual([]);
  });
});

describe("le partage par lien", () => {
  it("s'ouvre à qui a le jeton, et à personne d'autre", async () => {
    const { cookie } = await connecte("varda");
    await pousser(cookie, [{ id: "f1", majLe: 1, donnees: { title: "Le Bonheur" } }]);
    const { jeton } = (await regler(cookie, "lien")).json();
    expect(jeton).toBeTruthy();

    const sans = await app.inject({ method: "GET", url: "/chez/varda" });
    expect(sans.statusCode).toBe(404);

    const faux = await app.inject({ method: "GET", url: "/chez/varda?jeton=jinvente" });
    expect(faux.statusCode).toBe(404);

    const avec = await app.inject({ method: "GET", url: `/chez/varda?jeton=${jeton}` });
    expect(avec.statusCode).toBe(200);
    expect(avec.json().films[0].title).toBe("Le Bonheur");
  });

  it("se referme, et le lien distribué ne vaut plus rien", async () => {
    const { cookie } = await connecte("varda");
    await pousser(cookie, [{ id: "f1", majLe: 1, donnees: {} }]);
    const { jeton } = (await regler(cookie, "lien")).json();

    await regler(cookie, "privee");
    expect(
      (await app.inject({ method: "GET", url: `/chez/varda?jeton=${jeton}` })).statusCode
    ).toBe(404);
  });

  it("rouvrir donne un jeton NEUF : se raviser veut dire quelque chose", async () => {
    /* Reprendre l'ancien ferait revivre tous les liens distribués la
       fois d'avant — y compris celui qu'on avait voulu couper. */
    const { cookie } = await connecte("varda");
    const premier = (await regler(cookie, "lien")).json().jeton;
    await regler(cookie, "privee");
    const second = (await regler(cookie, "lien")).json().jeton;

    expect(second).not.toBe(premier);
    expect(
      (await app.inject({ method: "GET", url: `/chez/varda?jeton=${premier}` })).statusCode
    ).toBe(404);
  });
});

describe("qui décide", () => {
  it("personne d'autre que soi", async () => {
    const a = await connecte("duras");
    const b = await connecte("godard");
    await pousser(a.cookie, [{ id: "f1", majLe: 1, donnees: { title: "India Song" } }]);

    /* B ne peut ni ouvrir la collection de A, ni y cacher une fiche :
       il n'a de prise que sur la sienne. */
    await regler(b.cookie, "publique");
    expect((await app.inject({ method: "GET", url: "/chez/duras" })).statusCode).toBe(404);

    const vol = await app.inject({
      method: "PUT",
      url: "/fiche/f1/cachee",
      headers: { cookie: b.cookie },
      payload: { cachee: true },
    });
    expect(vol.statusCode).toBe(404);
  });

  it("et il faut un compte pour régler quoi que ce soit", async () => {
    expect((await app.inject({ method: "PUT", url: "/partage", payload: {} })).statusCode).toBe(
      401
    );
  });

  it("un réglage inventé est refusé", async () => {
    const { cookie } = await connecte("varda");
    const r = await regler(cookie, "au-monde-entier-sauf-mon-frere");
    expect(r.statusCode).toBe(400);
  });
});
