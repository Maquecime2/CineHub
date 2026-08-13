/* ============================================================
   START-UP — everything that comes from outside is read here
   ============================================================

   No secret value is written into the code, and none has a default in
   production: a server that starts on a guessed configuration is a server
   that runs for a month before anyone notices it was signing for
   `localhost`.

   THE ENVIRONMENT VARIABLES MOVED TO ENGLISH, AND THE OLD NAMES STILL
   WORK. They are a contract with whoever deploys this — written into a
   `.env` file, a hosting dashboard, a systemd unit — and none of those
   live in this repository. Renaming them outright would take a working
   server down at its next restart, complaining about a missing variable
   that was in fact right there under its old name. So each one is read
   under both spellings; the old one can be dropped once the deployments
   have caught up.
   ============================================================ */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.ts";
import { openPostgres, applySchema } from "./db.ts";
import { configurePush } from "./push.ts";
import { configureMedia, mediaAvailable, readConnectionString } from "./media.ts";

/** The current name, or the one it used to have. */
const env = (current: string, legacy: string): string | undefined =>
  process.env[current] ?? process.env[legacy];

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL manque. Exemple : postgres://cinehub:cinehub@localhost:5432/cinehub");
  process.exit(1);
}

const development = process.env.NODE_ENV !== "production";
const domain = process.env.RP_ID || (development ? "localhost" : "");
const origin = env("ORIGIN", "ORIGINE") || (development ? "http://localhost:5173" : "");

if (!domain || !origin) {
  console.error("RP_ID et ORIGIN sont obligatoires hors développement.");
  process.exit(1);
}

/* NOTIFICATIONS ARE OPTIONAL FROM END TO END. With no VAPID keys, that
   module stays quiet, the route says so, and the binder does not even
   show the setting. They are made once and for all:

     npx web-push generate-vapid-keys

   The PRIVATE key never leaves the server; the public one is handed to
   every browser that subscribes, and that is its job. */
const vapidPub = env("VAPID_PUBLIC", "VAPID_PUBLIQUE");
const vapidPriv = env("VAPID_PRIVATE", "VAPID_PRIVEE");
configurePush(
  vapidPub && vapidPriv
    ? {
        publicKey: vapidPub,
        privateKey: vapidPriv,
        contact: process.env.VAPID_CONTACT || "mailto:person@example.org",
      }
    : null
);

/* THE MEDIA MIRROR IS OPTIONAL, exactly like the notifications above.
   With no connection string the routes answer "no service", the blobs
   stay in each browser's IndexedDB as they always have, and a card seen
   on a second computer goes on saying "stayed on the other device".

   THE CONNECTION STRING NEVER REACHES A BROWSER. The server signs a
   ticket for ONE blob, valid a quarter of an hour, and hands that over
   instead — which is the whole reason this is done here rather than with
   a `VITE_` variable baked into the bundle.

   The container itself must allow the site's origin in PUT and GET; that
   is set on Azure's side, and `.env.exemple` says so. */
configureMedia(readConnectionString(process.env.AZURE_BLOBS, process.env.AZURE_CONTAINER));

const db = await openPostgres(dbUrl);

/* The baseline schema is laid down at start-up rather than by a separate
   command: it is conditional from end to end, so replayable, and a server
   that starts on an empty database is a server that starts. */
const schema = await readFile(
  fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
  "utf8"
);
await applySchema(db, schema);

const devDoor = env("DEV_DOOR", "PORTE_DEV") === "1";

const app = await buildApp({
  db,
  domain,
  origin,
  /* Not compulsory: without it the relay declares itself unavailable and
     everyone keeps their own, as they do today. */
  tmdbKey: process.env.TMDB_KEY,
  /* The TMDB quota is the bill of whoever hosts this: so the relay's
     ceiling is set from outside. Empty, we take `relay.ts`'s default —
     six hundred a minute, enough to fill a whole collection without
     chopping it up. */
  tmdbCeiling: Number(env("TMDB_PER_MINUTE", "TMDB_PAR_MINUTE")) || undefined,
  /* TWO LOCKS, AND THE FIRST ONE DOES NOT OPEN FROM OUTSIDE. The service
     door only exists outside production AND on explicit request: setting
     `DEV_DOOR=1` on a production server is not enough. */
  devDoor: development && devDoor,
  /* A session cookie with no `Secure` on an HTTPS site travels in the
     clear at the first http:// link: that is exactly what the attribute
     exists to prevent. */
  secure: !development,
});

const port = Number(process.env.PORT || 8787);
await app.listen({ port, host: "0.0.0.0" });
/* THE ORIGINS ARE PRINTED AT START-UP, AND THAT IS NOT POLITENESS.

   A client whose origin is not on this list does not get an error: the
   browser refuses the response BEFORE handing it over, and the
   application shows "the server is not answering" when it is answering
   perfectly well. The only place the truth is readable is here. */
console.log(`Ciné Hub — serveur debout sur ${port}`);
for (const o of origin
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)) {
  console.log(`  origine acceptée : ${o}`);
}
if (!vapidPub || !vapidPriv) {
  console.log("  notifications : éteintes (VAPID_PUBLIC / VAPID_PRIVATE absentes)");
}
if (!mediaAvailable()) {
  console.log("  médias : gardés sur chaque appareil (AZURE_BLOBS / AZURE_CONTAINER absentes)");
}
if (devDoor && development) {
  console.log("  ⚠ porte de développement open : POST /dev/session");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
}
