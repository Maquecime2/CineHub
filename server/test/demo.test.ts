import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import { DEMO_FILMS, demoPosters, resolveDemoPosters } from "../src/demo.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   LA VITRINE

   Les douze fiches d'exemple sont la seule chose qu'on montre à qui n'a
   pas de compte. Ce qui se vérifie ici tient en trois lignes :

   SANS CLÉ TMDB, ON NE FAIT RIEN — et surtout on n'écrit rien. Une
   instance sans clé doit démarrer sans bruit et dessiner les initiales
   comme avant.

   ON NE CHERCHE QU'UNE FOIS. Un démarrage ne refait pas le travail du
   précédent, y compris pour les films que TMDB n'a pas su rendre : leur
   ligne vide est la trace de la recherche, pas son absence.

   ET UNE LIGNE VIDE NE SORT PAS. Servir une adresse tronquée donnerait
   le rectangle cassé que toute cette affaire cherche à éviter.
   ============================================================ */

let db: Db;

beforeEach(async () => {
  db = await testDb();
});

afterEach(async () => {
  await db.close();
});

describe("résoudre les affiches", () => {
  it("ne fait rien, et n'écrit rien, sans clé", async () => {
    expect(await resolveDemoPosters(db, undefined)).toBe(0);
    expect(await db.query("SELECT 1 FROM demo_poster")).toHaveLength(0);
  });

  /* Sans ce test, un film que TMDB ne connaît pas sous son titre
     d'origine serait recherché à chaque démarrage, pour toujours. */
  it("ne recherche pas ce qui a déjà été cherché", async () => {
    for (const f of DEMO_FILMS) {
      await db.query("INSERT INTO demo_poster (demo_id, path) VALUES ($1, $2)", [f.id, ""]);
    }
    /* Une clé bidon : si la fonction cherchait, elle partirait sur le
       réseau et ce test deviendrait lent et instable. Il rend 0 sans
       rien tenter, ce qui est précisément la garantie. */
    expect(await resolveDemoPosters(db, "clé-de-test")).toBe(0);
  });
});

describe("servir les affiches", () => {
  it("rend une adresse complète, prête à poser dans une balise", async () => {
    await db.query("INSERT INTO demo_poster (demo_id, path) VALUES ($1, $2)", [
      "demo-stalker",
      "/abc.jpg",
    ]);
    const posters = await demoPosters(db);
    expect(posters["demo-stalker"]).toMatch(/^https:\/\/image\.tmdb\.org\/.+\/abc\.jpg$/);
  });

  /* Une ligne vide veut dire « cherché, pas trouvé ». La servir donnerait
     une adresse tronquée, donc le rectangle cassé qu'on évite. */
  it("laisse dehors ce qui n'a pas été trouvé", async () => {
    await db.query("INSERT INTO demo_poster (demo_id, path) VALUES ($1, $2)", ["demo-alien", ""]);
    expect(await demoPosters(db)).toEqual({});
  });

  it("ne rend rien du tout sur une base neuve", async () => {
    expect(await demoPosters(db)).toEqual({});
  });
});
