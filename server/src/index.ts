/* ============================================================
   LE DÉMARRAGE — tout ce qui vient du dehors est lu ici
   ============================================================

   Aucune valeur secrète n'est écrite dans le code, et aucune n'a de
   valeur par défaut en production : un serveur qui démarre avec une
   configuration devinée est un serveur qui tourne un mois avant qu'on
   s'aperçoive qu'il signait pour `localhost`.
   ============================================================ */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { construireApp } from "./app.ts";
import { ouvrirPostgres, poserLeSocle } from "./base.ts";

const urlBase = process.env.DATABASE_URL;
if (!urlBase) {
  console.error("DATABASE_URL manque. Exemple : postgres://cinehub:cinehub@localhost:5432/cinehub");
  process.exit(1);
}

const developpement = process.env.NODE_ENV !== "production";
const domaine = process.env.RP_ID || (developpement ? "localhost" : "");
const origine = process.env.ORIGINE || (developpement ? "http://localhost:5173" : "");

if (!domaine || !origine) {
  console.error("RP_ID et ORIGINE sont obligatoires hors développement.");
  process.exit(1);
}

const base = await ouvrirPostgres(urlBase);

/* Le socle est posé au démarrage plutôt que par une commande à part :
   il est conditionnel de bout en bout, donc rejouable, et un serveur qui
   démarre sur une base vide est un serveur qui démarre. */
const socle = await readFile(
  fileURLToPath(new URL("../sql/001_socle.sql", import.meta.url)),
  "utf8"
);
await poserLeSocle(base, socle);

const app = await construireApp({
  base,
  domaine,
  origine,
  /* Elle n'est pas obligatoire : sans elle, le relais se déclare
     indisponible et chacun garde la sienne, comme aujourd'hui. */
  cleTmdb: process.env.TMDB_KEY,
  /* DEUX VERROUS, ET LE PREMIER NE S'OUVRE PAS DE L'EXTÉRIEUR. La porte
     de service n'existe que hors production ET sur demande explicite :
     poser `PORTE_DEV=1` sur un serveur en production ne suffit pas. */
  porteDev: developpement && process.env.PORTE_DEV === "1",
  /* Un cookie de session sans `Secure` sur un site en HTTPS voyage en
     clair au premier lien en http:// : c'est exactement ce contre quoi
     l'attribut existe. */
  securise: !developpement,
});

const port = Number(process.env.PORT || 8787);
await app.listen({ port, host: "0.0.0.0" });
/* LES ORIGINES SE LISENT AU DÉMARRAGE, ET CE N'EST PAS DE LA POLITESSE.

   Un client dont l'origine n'est pas dans cette liste ne reçoit pas une
   erreur : le navigateur refuse la réponse AVANT de la lui donner, et
   l'application affiche « le serveur ne répond pas » alors qu'il répond
   très bien. Le seul endroit où la vérité est lisible, c'est ici. */
console.log(`Ciné Hub — serveur debout sur ${port}`);
for (const o of origine
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)) {
  console.log(`  origine acceptée : ${o}`);
}
if (process.env.PORTE_DEV === "1" && developpement) {
  console.log("  ⚠ porte de développement ouverte : POST /dev/session");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await base.fermer();
    process.exit(0);
  });
}
