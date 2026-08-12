/* ============================================================
   LA SAUVEGARDE — celle qu'on n'a jamais faite le jour où il faut
   ============================================================

   UNE SAUVEGARDE QU'ON N'A JAMAIS RESTAURÉE N'EST PAS UNE SAUVEGARDE.
   C'est la seule phrase de ce fichier qui compte. Le script écrit un
   `pg_dump` daté, en garde quelques-uns, et imprime la commande exacte
   pour le relire — parce qu'à trois heures du matin, personne
   n'invente la bonne ligne de `pg_restore`.

   FORMAT `custom` ET NON `.sql` : il se restaure table par table, il
   est compressé, et il ne dépend pas de l'ordre des instructions. Un
   `.sql` de six cents fiches se relit à l'œil, ce qui est agréable ;
   il se restaure mal, ce qui l'est moins.

   IL NE S'AGIT PAS D'UN ORDONNANCEUR. Ce script fait une sauvegarde,
   une fois. Le faire tourner tous les jours est le travail du système
   — `cron` ou le Planificateur de tâches Windows — et la commande est
   dans EXPLOITATION.md. Écrire un minuteur ici donnerait un processus
   de plus à surveiller, et une sauvegarde qui s'arrête avec lui.
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
/* Sept, parce qu'une semaine est le délai réel entre une bêtise et le
   moment où l'on s'en aperçoit. Garder tout finit par remplir le
   disque, ce qui est une autre façon d'arrêter le serveur. */
const GARDER = Number(process.env.SAUVEGARDES_GARDEES || 7);

await mkdir(dossier, { recursive: true });

const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const fichier = join(dossier, `cinehub-${horodatage}.dump`);

console.log(`sauvegarde → ${fichier}`);

/* `pg_dump` est appelé en PROCESSUS, pas en bibliothèque : c'est
   l'outil de Postgres, il connaît son format mieux que nous, et une
   sauvegarde écrite à la main serait exactement le genre de chose qui
   se révèle fausse le jour de la restauration. */
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
/* UNE SAUVEGARDE VIDE EST PIRE QU'AUCUNE : elle rassure. Un dump
   Postgres valide pèse toujours plus que quelques centaines d'octets,
   même sur une base neuve. */
if (size < 1024) {
  console.error(`⚠ ${size} octets seulement — cette sauvegarde n'en est pas une.`);
  process.exit(1);
}
console.log(`  ${(size / 1024 / 1024).toFixed(2)} Mo`);

/* La rotation vient APRÈS la vérification de taille : effacer les
   anciennes sur la foi d'une nouvelle qui a échoué serait la seule
   façon de transformer une panne de sauvegarde en perte de données. */
const anciennes = (await readdir(dossier))
  .filter((f) => f.startsWith("cinehub-") && f.endsWith(".dump"))
  .sort()
  .reverse()
  .slice(GARDER);
for (const f of anciennes) {
  await unlink(join(dossier, f));
  console.log(`  effacée : ${f}`);
}

console.log("\nPour la relire — sur une base VIDE, jamais par-dessus la vivante :");
console.log(`  createdb cinehub_essai`);
console.log(`  pg_restore --no-owner --dbname=cinehub_essai ${fichier}`);
console.log("Et le faire pour de vrai une fois, avant d'en avoir besoin.");
