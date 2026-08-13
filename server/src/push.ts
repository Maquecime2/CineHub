/* ============================================================
   PUSH NOTIFICATIONS — one a month, at most
   ============================================================

   ONE REASON ONLY TO RING: a challenge that starts, a challenge that
   ends. No "someone you follow rated a film", no "come back, your
   collection is waiting". An application that finds itself reasons to
   ring ends up uninstalled, and the binder would become the thing it has
   refused to be since day one.

   THEY ARE OPTIONAL FROM END TO END. With no VAPID keys set, this module
   stays quiet, the routes answer "no service", and nothing else changes.
   The server is already a comfort; this is a comfort on top of a comfort.

   WHAT THE SERVER CAN AND CANNOT DO. It pushes to an endpoint the browser
   gave it, encrypted with keys the browser made. It does not know whether
   the message was read, nor whether the device is switched on; it only
   learns, from a 404 or a 410, that a subscription is dead — and erases
   it then, rather than retrying until the end of time.
   ============================================================ */
import webpush from "web-push";
import type { Db } from "./db.ts";
import * as store from "./store.ts";

export interface Vapid {
  publicKey: string;
  privateKey: string;
  /** Whom the push service should write to if there is trouble. */
  contact: string;
}

let configured: Vapid | null = null;

export function configurePush(v: Vapid | null): void {
  configured = v;
  if (v) webpush.setVapidDetails(v.contact, v.publicKey, v.privateKey);
}

export const pushAvailable = (): boolean => configured !== null;
export const publicKeyForPush = (): string | null => configured?.publicKey ?? null;

/**
 * Pushes a message to all of somebody's devices.
 *
 * Returns the number of devices reached. Dead subscriptions are erased on
 * the way: this is the only moment we learn that they are dead, and not
 * doing it here would keep them forever.
 */
export async function pushTo(
  db: Db,
  personId: string,
  /* `title` and `body` ARE THE PAYLOAD the browser's service worker
     reads (`public/push.js` shows `m.title` and `m.body`). The two
     spellings have to change together: renaming one side alone silences
     every notification, and neither side reports an error. */
  message: { title: string; body: string; url?: string }
): Promise<number> {
  if (!configured) return 0;
  const subscriptions = await store.pushesOf(db, personId);
  let reached = 0;

  for (const a of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.secret } },
        JSON.stringify(message)
      );
      reached += 1;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      /* 404 and 410: that endpoint no longer exists — browser
         uninstalled, permission withdrawn, subscription expired. Any
         other error is transient (the push service is down, the network
         is cut) and must on no account lose the subscription. */
      if (code === 404 || code === 410) await store.forgetPush(db, a.endpoint);
    }
  }
  return reached;
}

/**
 * The daily sweep: the challenges that start or end.
 *
 * Returns what it did, so the caller can log it without this module
 * having to know about a log.
 */
export async function remindChallenges(db: Db): Promise<{ told: number; devices: number }> {
  if (!configured) return { told: 0, devices: 0 };
  let told = 0;
  let devices = 0;

  for (const r of await store.remindersDueToday(db)) {
    /* The lock is the insert, not a check: two simultaneous sweeps — a
       restart in the middle of a send — would both slip through a plain
       "has this already been said?". */
    const subject = `challenge:${r.challenge_id}:${r.when}`;
    if (!(await store.reminderIsNew(db, r.person_id, subject))) continue;

    told += 1;
    devices += await pushTo(db, r.person_id, {
      title: r.when === "starts_on" ? "Un défi commence" : "Dernier jour",
      body:
        r.when === "starts_on"
          ? `« ${r.title} » démarre aujourd'hui.`
          : `« ${r.title} » s'achève ce soir.`,
      url: "#",
    });
  }
  return { told, devices };
}
