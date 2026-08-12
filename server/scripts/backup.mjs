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

const dossier = process.env.SAUVEGARDES || "sauvegardes";
/* Seven, because a week is the real delay between a blunder and the
   moment one notices it. Keeping everything ends up filling the disk,
   which is another way of stopping the server. */
const GARDER = Number(process.env.SAUVEGARDES_GARDEES || 7);

await mkdir(dossier, { recursive: true });

const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const fichier = join(dossier, `cinehub-${horodatage}.dump`);

console.log(`sauvegarde → ${fichier}`);

/* `pg_dump` is called as a PROCESS, not as a library: it is Postgres's
   own tool, it knows its format better than we do, and a backup written
   by hand would be exactly the kind of thing that turns out to be wrong
   on the day of the restore. */
const code = await new Promise((resolve) => {
  const p = spawn(
    process.env.PG_DUMP || "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", fichier, url],
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

const { size } = await stat(fichier);
/* AN EMPTY BACKUP IS WORSE THAN NONE: it reassures. A valid Postgres
   dump always weighs more than a few hundred bytes, even on a fresh
   database. */
if (size < 1024) {
  console.error(`⚠ ${size} octets seulement — cette sauvegarde n'en est pas one.`);
  process.exit(1);
}
console.log(`  ${(size / 1024 / 1024).toFixed(2)} Mo`);

/* The rotation comes AFTER the size check: erasing the old ones on the
   strength of a new one that failed would be the one way to turn a
   backup failure into data loss. */
const anciennes = (await readdir(dossier))
  .filter((f) => f.startsWith("cinehub-") && f.endsWith(".dump"))
  .sort()
  .reverse()
  .slice(GARDER);
for (const f of anciennes) {
  await unlink(join(dossier, f));
  console.log(`  effacée : ${f}`);
}

console.log("\nPour la relire — sur one base VIDE, jamais by-dessus la vivante :");
console.log(`  createdb cinehub_essai`);
console.log(`  pg_restore --no-owner --dbname=cinehub_essai ${fichier}`);
console.log("Et at faire pour de vrai one fois, before d'en avoir besoin.");
