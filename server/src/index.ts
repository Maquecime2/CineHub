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
import { buildApp } from "./app.ts";
import { openPostgres, applySchema } from "./db.ts";
import { configurePush } from "./push.ts";

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

/* LES NOTIFICATIONS SONT FACULTATIVES DE BOUT EN BOUT. Sans clés VAPID,
   ce module se tait, la route l'annonce, et le classeur ne montre même
   pas le réglage. On les fabrique une fois pour toutes :

     npx web-push generate-vapid-keys

   La clé PRIVÉE ne quitte pas le serveur ; la publique est distribuée à
   chaque navigateur qui s'abonne, et c'est son rôle. */
const vapidPub = process.env.VAPID_PUBLIQUE;
const vapidPriv = process.env.VAPID_PRIVEE;
configurePush(
  vapidPub && vapidPriv
    ? {
        publique: vapidPub,
        privee: vapidPriv,
        contact: process.env.VAPID_CONTACT || "mailto:personne@example.org",
      }
    : null
);

const base = await openPostgres(urlBase);

/* Le socle est posé au démarrage plutôt que par une commande à part :
   il est conditionnel de bout en bout, donc rejouable, et un serveur qui
   démarre sur une base vide est un serveur qui démarre. */
const socle = await readFile(
  fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
  "utf8"
);
await applySchema(base, socle);

const app = await buildApp({
  base,
  domaine,
  origine,
  /* Elle n'est pas obligatoire : sans elle, le relais se déclare
     indisponible et chacun garde la sienne, comme aujourd'hui. */
  tmdbKey: process.env.TMDB_KEY,
  /* Le quota TMDB est la facture de qui héberge : le plafond du relais
     se règle donc de l'extérieur. Vide, on prend le défaut de
     `relais.ts` — six cents par minute, de quoi remplir une collection
     entière sans la hacher. */
  tmdbCeiling: Number(process.env.TMDB_PAR_MINUTE) || undefined,
  /* DEUX VERROUS, ET LE PREMIER NE S'OUVRE PAS DE L'EXTÉRIEUR. La porte
     de service n'existe que hors production ET sur demande explicite :
     poser `PORTE_DEV=1` sur un serveur en production ne suffit pas. */
  devDoor: developpement && process.env.PORTE_DEV === "1",
  /* Un cookie de session sans `Secure` sur un site en HTTPS voyage en
     clair au premier lien en http:// : c'est exactement ce contre quoi
     l'attribut existe. */
  secure: !developpement,
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
if (!vapidPub || !vapidPriv) {
  console.log("  notifications : éteintes (VAPID_PUBLIQUE / VAPID_PRIVEE absentes)");
}
if (process.env.PORTE_DEV === "1" && developpement) {
  console.log("  ⚠ porte de développement ouverte : POST /dev/session");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await base.close();
    process.exit(0);
  });
}
