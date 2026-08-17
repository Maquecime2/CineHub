/* ============================================================
   THE DATABASE — one single way of asking a question
   ============================================================

   No ORM. The schema is a SQL file you read (`sql/001_baseline.sql`) and
   the queries are SQL written by hand, with numbered parameters. Two
   reasons, and neither of them is aesthetics.

   First: this server has nothing complicated to ask for. A dozen
   queries, all of them short. An ORM would bring one more language to
   learn, a code generator to run, and its own attack surface — the very
   one we removed by leaving it out.

   Second: numbered parameters do not concatenate. A value passed as `$1`
   can never become syntax, whatever the string. That is the only defence
   that holds against injection, and here it is the NORMAL way to write —
   not a precaution somebody has to remember to take.

   The interface is deliberately tiny: real Postgres implements it in
   production, and a Postgres compiled to WebAssembly implements it in the
   tests. The same queries run on both sides — so the tests exercise the
   real SQL, constraints included, and not an imitation.

   THE TABLE AND COLUMN NAMES WERE FRENCH, AND THEY WERE MIGRATED — not
   translated. They are written into a database that may already hold
   somebody's collection, so the renaming is done in SQL, conditionally,
   at the top of `sql/001_baseline.sql`: a base laid down under the old
   names catches up on its own at the next start, and one laid down under
   the new ones does not budge. That is the only way this file can claim
   both spellings at once. */
export interface Db {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]>;
  /* A PREPARED STATEMENT CARRIES ONE COMMAND ONLY, and that is a rule of
     the protocol rather than a limit of the library: the baseline schema,
     which holds a score of them, therefore cannot go through `query`.
     Hence this second door, reserved for scripts — no parameters, so no
     value from outside, so no injection possible. */
  exec(script: string): Promise<void>;
  close(): Promise<void>;
}

/** One row, or nothing. The most frequent case. */
export async function one<T = Record<string, unknown>>(
  db: Db,
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const rows = await db.query<T>(text, values);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------
   POSTGRES, THE REAL ONE
   ------------------------------------------------------------ */
export async function openPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    /* The server is small and the queries are brief: ten connections are
       enough, and a managed host bills for open connections. */
    max: 10,
    onnotice: () => {},
  });
  return {
    query: async <T>(text: string, values: unknown[] = []) =>
      sql.unsafe(text, values as never[]) as unknown as Promise<T[]>,
    exec: async (script: string) => {
      /* `simple()` goes through the simple protocol, the only one that
         accepts several commands at once. It accepts NO parameter in
         exchange — which is exactly what we want here. */
      await sql.unsafe(script).simple();
    },
    close: () => sql.end(),
  };
}

/* ------------------------------------------------------------
   THE BASELINE, LAID DOWN
   ------------------------------------------------------------
   Files you read rather than a stack of unreadable increments. There are
   two now, and THE LIST IS HERE so that nobody has to remember it in
   three places — le serveur au démarrage, les tests, et le contrôle qui
   relit le schéma s'en servent tous.

   TOUJOURS PAS DE TABLE DE MIGRATIONS, et c'est encore le bon choix :
   chaque fichier est conditionnel de bout en bout, donc rejouable, donc
   il n'y a rien à retenir de ce qui a déjà été posé. Le jour où l'un
   d'eux cessera de l'être — une donnée à transformer plutôt qu'une
   colonne à ajouter — c'est ce jour-là qu'il faudra la table, et pas
   avant. */
export const SCHEMA_FILES = [
  "001_baseline.sql",
  "002_collection.sql",
  "003_quiz_timer.sql",
  "004_challenge_kinds.sql",
] as const;

export async function applySchema(db: Db, schemaSql: string): Promise<void> {
  await db.exec(schemaSql);
}

/**
 * Tous les fichiers de schéma, dans l'ordre, lus depuis `sql/`.
 *
 * L'ORDRE COMPTE : `002` étend une contrainte que `001` pose et
 * s'appuie sur des tables qu'il crée. Une boucle sur un `readdir` aurait
 * marché aujourd'hui et se serait trompée le jour d'un `010`.
 */
export async function applyAllSchemas(
  db: Db,
  read: (file: string) => Promise<string>
): Promise<void> {
  for (const file of SCHEMA_FILES) await applySchema(db, await read(file));
}
