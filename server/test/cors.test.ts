import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import { CORS_METHODS } from "../src/app.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LE PRÉFLIGHT, ET L'ANGLE MORT QU'IL CREUSE

   CE TEST EXISTE PARCE QUE LA MÊME FAUTE A ÉTÉ FAITE DEUX FOIS.

   `@fastify/cors` n'autorise par défaut que GET, HEAD et POST. Une
   méthode absente de la liste fait refuser la requête PAR LE NAVIGATEUR,
   avant l'envoi : le serveur n'en voit jamais la trace, ses journaux sont
   vides, et l'application affiche « pas de réponse » alors que tout
   répond.

   Et LA SUITE DE TESTS NE LE VOIT PAS NON PLUS. `app.inject()` appelle la
   route directement, sans préflight, donc elle ne pose jamais la question
   qui échoue. La première fois, c'est le PUT de la collection qui est
   tombé ; un commentaire a été écrit au-dessus de la liste pour prévenir.
   La seconde fois, ce sont les deux PATCH du comptoir, et le commentaire
   n'a arrêté personne : tout était vert, et rien ne marchait.

   UN COMMENTAIRE N'EST PAS UN GARDE-FOU. Celui-ci lit la table des
   routes que Fastify a réellement enregistrées et la compare à la liste.
   Il ne vérifie pas le préflight lui-même — il vérifie la seule chose
   qui puisse diverger sans bruit.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});
afterEach(async () => {
  await app.close();
  await db.close();
});

/** Les méthodes que porte au moins une route, lues dans l'arbre de Fastify. */
function methodsInUse(instance: FastifyInstance): Set<string> {
  const tree = instance.printRoutes({ commonPrefix: false });
  const found = new Set<string>();
  for (const line of tree.split("\n")) {
    const m = /\(([A-Z, ]+)\)\s*$/.exec(line.trim());
    if (!m) continue;
    for (const verb of m[1]!.split(",")) found.add(verb.trim());
  }
  return found;
}

describe("les méthodes autorisées au préflight", () => {
  it("couvrent toutes les routes enregistrées", () => {
    const used = methodsInUse(app);
    /* Le filet ne vaut rien s'il ne lit rien : on s'assure d'abord que
       l'arbre a bien été analysé. */
    expect(used.size).toBeGreaterThan(3);

    const missing = [...used].filter((verb) => !CORS_METHODS.includes(verb)).sort();
    expect(
      missing,
      `ces méthodes sont servies mais absentes de CORS_METHODS : ${missing.join(", ")} — ` +
        `un navigateur les refusera avant l'envoi, et aucun autre test ne le dira`
    ).toEqual([]);
  });

  it("nomment bien PATCH, que le comptoir emploie", () => {
    /* Une garde nommée plutôt que déduite : si les deux routes du
       comptoir disparaissaient, le test ci-dessus resterait vert avec
       une liste amputée, et la prochaine PATCH retomberait dans le
       trou. */
    expect(methodsInUse(app)).toContain("PATCH");
    expect(CORS_METHODS).toContain("PATCH");
  });

  it("n'autorisent rien que personne ne sert", () => {
    /* Dans l'autre sens, et c'est plus qu'un ménage : une méthode
       ouverte au préflight sans route derrière est une porte annoncée
       sur un mur. `HEAD` et `OPTIONS` font exception — Fastify les sert
       tout seul. */
    const used = methodsInUse(app);
    const extra = CORS_METHODS.filter(
      (verb) => !used.has(verb) && verb !== "OPTIONS" && verb !== "HEAD"
    );
    expect(extra).toEqual([]);
  });
});
