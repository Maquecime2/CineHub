/* ============================================================
   UN VRAI POSTGRES, DANS LES TESTS
   ============================================================

   PGlite est Postgres lui-même, compilé en WebAssembly : ce n'est pas
   une imitation, c'est le moteur, avec ses types, ses contraintes, son
   `jsonb`, ses `ON CONFLICT`. Les tests exécutent donc le SQL qui
   tournera en production — la contrainte de forme du pseudonyme, la
   cascade d'effacement et la clause qui refuse une version plus
   ancienne sont éprouvées pour de vrai, sans Docker et sans serveur à
   lancer.

   Une base neuve par test : elle vit en mémoire, elle coûte quelques
   dizaines de millisecondes, et deux tests ne se marchent jamais dessus.
   ============================================================ */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { construireApp } from "../src/app.ts";
import { poserLeSocle, type Base } from "../src/base.ts";

export async function baseDEssai(): Promise<Base> {
  const pg = new PGlite();
  const base: Base = {
    requete: async <T>(texte: string, valeurs: unknown[] = []) => {
      const r = await pg.query<T>(texte, valeurs as never[]);
      return r.rows;
    },
    executer: async (script: string) => {
      await pg.exec(script);
    },
    fermer: () => pg.close(),
  };
  const socle = await readFile(
    fileURLToPath(new URL("../sql/001_socle.sql", import.meta.url)),
    "utf8"
  );
  await poserLeSocle(base, socle);
  return base;
}

export async function appDEssai(base: Base) {
  return construireApp({
    base,
    domaine: "localhost",
    origine: "http://localhost:5173",
    securise: false,
  });
}

/** Le cookie de session d'une réponse, prêt à être renvoyé. */
export function cookieDe(reponse: { headers: Record<string, unknown> }): string {
  const brut = reponse.headers["set-cookie"];
  const ligne = Array.isArray(brut) ? brut[0] : (brut as string | undefined);
  return (ligne || "").split(";")[0] || "";
}
