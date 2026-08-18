/* ============================================================
   A REAL POSTGRES, IN THE TESTS
   ============================================================

   PGlite is Postgres itself, compiled to WebAssembly: not an imitation,
   the engine — with its types, its constraints, its `jsonb`, its `ON
   CONFLICT`. The tests therefore run the SQL that will run in
   production: the pseudonym's shape constraint, the erasure cascade and
   the clause that refuses an older version are tried for real, with no
   Docker and no server to start.

   A fresh database per test: it lives in memory, it costs a few tens of
   milliseconds, and two tests never tread on each other.
   ============================================================ */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { buildApp } from "../src/app.ts";
import { applyAllSchemas, type Db } from "../src/db.ts";

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
  await applyAllSchemas(db, (file) =>
    readFile(fileURLToPath(new URL(`../sql/${file}`, import.meta.url)), "utf8")
  );
  return db;
}

export async function testApp(
  db: Db,
  /* `devDoor` est ici pour que le coffre de développement puisse être
     essayé DANS LES DEUX ÉTATS. Une porte de service dont on ne vérifie
     que l'ouverture est une porte dont on ne sait pas si elle ferme. */
  extra: {
    tmdbKey?: string;
    tmdbCeiling?: number;
    hintsCeiling?: number;
    devDoor?: boolean;
  } = {}
) {
  return buildApp({
    db,
    domain: "localhost",
    origin: "http://localhost:5173",
    secure: false,
    ...extra,
  });
}

/** A response's session cookie, ready to be sent back. */
export function cookieOf(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const line = Array.isArray(raw) ? raw[0] : (raw as string | undefined);
  return (line || "").split(";")[0] || "";
}
