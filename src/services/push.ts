/* ============================================================
   NOTIFICATIONS, SEEN FROM THE BINDER
   ============================================================

   OPTIONAL FROM END TO END, like the server itself. It takes a server,
   keys set on it, a registered service worker, and the system's
   permission: four conditions, three of which are entirely out of the
   application's hands. Any one of them missing simply makes
   `possible: false`, and the setting does not show — rather than a
   switch that does nothing.

   THE PERMISSION IS ONLY EVER ASKED FOR ON A CLICK, never on load. An
   application that demands the right to ring before you have done
   anything gets refused for good — the refusal is final in most
   browsers, and there is no second chance.

   THE WIRE IS SHARED WITH `server/`. The route `/poussees` and the JSON
   field names below are the server's vocabulary, not ours: they stay as
   they are until both sides are renamed in the same change. Translating
   them here alone would make every request 404 in silence.
   ============================================================ */
import { ADDRESS, serverConfigured } from "./server";

export interface PushState {
  /** The server sends them, and this browser knows how to receive them. */
  possible: boolean;
  /** Is this device subscribed? */
  subscribed: boolean;
  /** The permission was refused: we can no longer ask for anything. */
  denied: boolean;
}

const supported = (): boolean =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof window !== "undefined" &&
  "PushManager" in window &&
  "Notification" in window;

/** The server's public key, once read. `null` if it has none. */
async function serverKey(): Promise<string | null> {
  if (!serverConfigured()) return null;
  try {
    const r = await fetch(`${ADDRESS}/poussees`, { credentials: "include" });
    if (!r.ok) return null;
    const { possible, cle } = (await r.json()) as { possible: boolean; cle: string | null };
    return possible ? cle : null;
  } catch {
    return null;
  }
}

export async function pushState(): Promise<PushState> {
  const off = { possible: false, subscribed: false, denied: false };
  if (!supported() || !(await serverKey())) return off;
  const sw = await navigator.serviceWorker.getRegistration();
  if (!sw) return off;
  return {
    possible: true,
    subscribed: (await sw.pushManager.getSubscription()) !== null,
    denied: Notification.permission === "denied",
  };
}

/** Returns `false` if the permission was refused — the caller says so. */
export async function subscribeToPush(): Promise<boolean> {
  const key = await serverKey();
  const sw = await navigator.serviceWorker.getRegistration();
  if (!key || !sw) return false;

  if ((await Notification.requestPermission()) !== "granted") return false;

  /* `userVisibleOnly` is mandatory and is not a formality: we commit to
     every pushed message producing a visible notification. A silent push
     would be a tracking channel, and browsers refuse it — rightly. */
  const sub = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toBytes(key),
  });

  const raw = sub.toJSON() as { keys?: { p256dh?: string; auth?: string } };
  const r = await fetch(`${ADDRESS}/poussees`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      point: sub.endpoint,
      p256dh: raw.keys?.p256dh,
      secret: raw.keys?.auth,
    }),
  });
  if (!r.ok) {
    /* The server did not want this subscription: keeping it on the
       browser side would leave a device that believes it is subscribed
       and that nobody will ever call. */
    await sub.unsubscribe();
    return false;
  }
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  const sw = await navigator.serviceWorker.getRegistration();
  const sub = await sw?.pushManager.getSubscription();
  if (!sub) return;
  /* We tell the server BEFORE unsubscribing: afterwards we no longer
     have the address to give it, and its row would go on pushing into
     the void until the first 410. */
  await fetch(`${ADDRESS}/poussees`, {
    method: "DELETE",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ point: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

/* The VAPID key travels as base64url and `subscribe` wants bytes. The
   conversion is dull; forgetting it gives an error that says nothing. */
function toBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  /* The buffer is named explicitly: `Uint8Array.from` returns an array
     over `ArrayBufferLike`, which `subscribe` does not accept — it wants
     an unshared buffer, and saying so here avoids an `as` that would one
     day mask a real error. */
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
