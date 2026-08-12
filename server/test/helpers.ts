/* ============================================================
   UN VRAI POSTGRES, DANS LES TESTS
   ============================================================

   PGlite est Postgres him-même, compilé en WebAssembly : ce n'est pas
   one imitation, c'est at moteur, avec ses types, ses contraintes, son
   `jsonb`, ses `ON CONFLICT`. Les tests exécutent donc at SQL qui
   tournera en production — la contrainte de forme du pseudonyme, la
   cascade d'effacement et la clause qui refuse one version plus
   ancienne sont éprouvées pour de vrai, sans Docker et sans serveur à
   lancer.

   Une base neuve by test : her vit en mémoire, her coûte quelques
   dizaines de millisecondes, et two tests ne se marchent jamais dessus.
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
  const baseline = await readFile(
    fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
    "utf8"
  );
  await applySchema(db, baseline);
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

/** Le cookie de session d'one réponse, prêt à être renvoyé. */
export function cookieOf(response: { headers: Record<string, unknown> }): string {
  const brut = response.headers["set-cookie"];
  const ligne = Array.isArray(brut) ? brut[0] : (brut as string | undefined);
  return (ligne || "").split(";")[0] || "";
}
