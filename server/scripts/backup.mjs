/* ============================================================
   THE BACKUP — the one nobody ever made on the day it was needed
   ============================================================

   A BACKUP NOBODY HAS EVER RESTORED IS NOT A BACKUP. That is the only
   sentence in this file that counts. The script writes a dated
   `pg_dump`, keeps a few of them, and prints the exact command to read
   one back — because at three in the morning nobody invents the right
   `pg_restore` line.

   `custom` FORMAT AND NOT `.sql`: it restores table by table, it is
   compressed, and it does not depend on the order of the statements. A
   `.sql` of six hundred cards can be read by eye, which is pleasant; it
   restores badly, which is less so.

   THIS IS NOT A SCHEDULER. The script makes one backup, once. Running
   it every day is the system's job — `cron`, or the Windows Task
   Scheduler — and the command is in EXPLOITATION.md. Writing a timer
   here would give one more process to watch, and a backup that stops
   with it.
   ============================================================ */
import { spawn } from "node:child_process";
import { mkdir, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manque : rien à sauvegarder.");
  process.exit(1);
}

/* The environment variables are a contract with whoever deploys this,
   written into a cron line or a systemd unit that does not live in this
   repository. So each one is read under both spellings; the French one
   can be dropped once the deployments have caught up. */
const folder = process.env.BACKUPS || process.env.SAUVEGARDES || "sauvegardes";
/* Seven, because a week is the real delay between a blunder and the
   moment one notices it. Keeping everything ends up filling the disk,
   which is another way of stopping the server. */
const KEEP = Number(process.env.BACKUPS_KEPT || process.env.SAUVEGARDES_GARDEES || 7);

await mkdir(folder, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = join(folder, `cinehub-${stamp}.dump`);

console.log(`sauvegarde → ${file}`);

/* `pg_dump` is called as a PROCESS, not as a library: it is Postgres's
   own tool, it knows its format better than we do, and a backup written
   by hand would be exactly the kind of thing that turns out to be wrong
   on the day of the restore. */
const code = await new Promise((resolve) => {
  const p = spawn(
    process.env.PG_DUMP || "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", file, url],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  p.on("error", (e) => {
    console.error(
      `pg_dump introuvable (${e.message}). Sous Windows il vit dans` +
        ' "C:\\\\Program Files\\\\PostgreSQL\\\\17\\\\bin" — posez PG_DUMP sur son chemin complet.'
    );
    resolve(1);
  });
  p.on("close", resolve);
});

if (code !== 0) process.exit(code || 1);

const { size } = await stat(file);
/* AN EMPTY BACKUP IS WORSE THAN NONE: it reassures. A valid Postgres
   dump always weighs more than a few hundred bytes, even on a fresh
   database. */
if (size < 1024) {
  console.error(`⚠ ${size} octets seulement — cette sauvegarde n'en est pas une.`);
  process.exit(1);
}
console.log(`  ${(size / 1024 / 1024).toFixed(2)} Mo`);

/* The rotation comes AFTER the size check: erasing the old ones on the
   strength of a new one that failed would be the one way to turn a
   backup failure into data loss. */
const old = (await readdir(folder))
  .filter((f) => f.startsWith("cinehub-") && f.endsWith(".dump"))
  .sort()
  .reverse()
  .slice(KEEP);
for (const f of old) {
  await unlink(join(folder, f));
  console.log(`  effacée : ${f}`);
}

console.log("\nPour la relire — sur une base VIDE, jamais par-dessus la vivante :");
console.log(`  createdb cinehub_essai`);
console.log(`  pg_restore --no-owner --dbname=cinehub_essai ${file}`);
console.log("Et à le faire pour de vrai une fois, avant d'en avoir besoin.");
