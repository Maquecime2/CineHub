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
import { buildApp } from "../src/app.ts";
import { applySchema, type Db } from "../src/db.ts";

export async function testDb(): Promise<Db> {
  const pg = new PGlite();
  const db: Db = {
    query: async <T>(text: string, values: unknown[] = []) => {
      const r = await pg.query<T>(text, values as never[]);
      return r.rows;
    },
    exec: async (script: string) => {
      await pg.exec(script);
    },
    close: () => pg.close(),
  };
  const socle = await readFile(
    fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
    "utf8"
  );
  await applySchema(db, socle);
  return db;
}

export async function testApp(db: Db, extra: { tmdbKey?: string; tmdbCeiling?: number } = {}) {
  return buildApp({
    db,
    domain: "localhost",
    origin: "http://localhost:5173",
    secure: false,
    ...extra,
  });
}

/** Le cookie de session d'une réponse, prêt à être renvoyé. */
export function cookieOf(reponse: { headers: Record<string, unknown> }): string {
  const brut = reponse.headers["set-cookie"];
  const ligne = Array.isArray(brut) ? brut[0] : (brut as string | undefined);
  return (ligne || "").split(";")[0] || "";
}
