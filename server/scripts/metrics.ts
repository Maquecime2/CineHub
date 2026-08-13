/* ============================================================
   READING THE MEASUREMENT — there is no dashboard, and that is meant
   ============================================================

   These figures have no route: exposing them would need a notion of
   administrator this server does not have, and inventing one for a
   dashboard would be the wrong reason to add a power. They are read
   here, from the machine that holds the database.

   WHAT THEY WILL NEVER SAY: how many people. Answering that would mean
   keeping what we refuse to keep. They say what gets used and what
   costs — which is what we measure for.
   ============================================================ */
import { openPostgres } from "../src/db.ts";
import { metrics } from "../src/store.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manque.");
  process.exit(1);
}

const jours = Number(process.argv[2] || 30);
const db = await openPostgres(url);
const rows = await metrics(db, jours);

const total = new Map<string, number>();
for (const l of rows) total.set(l.gesture, (total.get(l.gesture) ?? 0) + Number(l.n));

console.log(
  `Sur ${jours} jours — ${lignes.length} lignes, ${[...total.values()].reduce((a, b) => a + b, 0)} appels\n`
);
for (const [gesture, n] of [...total].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(8)}  ${gesture}`);
}

await db.close();
