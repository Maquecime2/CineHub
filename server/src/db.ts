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

   THE TABLE AND COLUMN NAMES STAY FRENCH throughout this package, and
   they are the one thing here that is not code: they are written into a
   database that may already hold somebody's collection. Renaming them is
   a schema migration, not a translation, and it is deliberately left out
   of this pass. Everything around them speaks English. */
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
   One migration for now, and a file you read rather than a stack of
   unreadable increments. When there is a second one, this is where the
   list will be kept — and the day there are many, the table that says
   which ones are laid down. */
export async function applySchema(db: Db, schemaSql: string): Promise<void> {
  await db.exec(schemaSql);
}
