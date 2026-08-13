/* ============================================================
   THE MEDIA — a mirror, and the vault stays the original
   ============================================================

   Until now nothing binary left the machine that made it. The
   synchronisation carries cards and documents, both JSON; the blobs —
   imported posters, screenshots, decoration objects — stayed in
   IndexedDB. That is why `IdbImage` has a third state, and why it reads
   "stayed on the other device": it was the truth.

   This module copies them to a container. A COPY, and the word decides
   everything below:

   - INDEXEDDB REMAINS THE ORIGINAL. Nothing here is on the path of a
     gesture. Importing a poster writes to the vault and returns; the
     upload happens later, at the next synchronisation, and a container
     that cannot be reached costs a poster that has not arrived yet —
     never a poster that is lost.

   - THE BINDER GOES ON WORKING OFFLINE AND WITH NO ACCOUNT. Every
     function here answers rather than throwing, and answers "no" by
     default.

   The register is the one `documents.ts` keeps, for the same reason: the
   blobs are written by four different places, and giving each of them
   the job of remembering would be four places to forget it in.

   ------------------------------------------------------------
   A BLOB'S ADDRESS IS NOT ITS KEY

     decor:<id>       ->  decor/<server id>       shareable
     everything else  ->  p/<person id>/<key>     private

   A decor may be READ BY SOMEBODY ELSE, so it is filed apart and its
   right to be read is decided by the server. Everything else is guarded
   by the prefix alone. `remotePath` is where the two meet.
   ============================================================ */
import { store } from "./storage";
import { getImage, putImage } from "../db";
import {
  accountOpen,
  serverConfigured,
  mediaTicket,
  mediaTickets,
  mediaDeleteTicket,
} from "./server";
import { remoteIdOfDecor, DECOR_IMAGE_PREFIX } from "./customDecor";

/** What has already reached the container — so as not to send it twice. */
const SENT_KEY = "medias-envoyes";
/** What is waiting for the road. */
const PENDING_KEY = "medias-a-envoyer";

const sent = (): string[] => store.get<string[]>(SENT_KEY, []);
const pending = (): string[] => store.get<string[]>(PENDING_KEY, []);

/**
 * This blob has just been written HERE.
 *
 * Called wherever a blob is born — the poster picker, the two writes of
 * a screenshot, a decor being imported. It costs one line each time and
 * it is the only thing they have to remember.
 */
export function noteMedia(key: string): void {
  if (!key) return;
  const list = pending();
  if (!list.includes(key)) store.set(PENDING_KEY, [...list, key]);
}

/** It is over there now. */
function markSent(key: string): void {
  const done = sent();
  if (!done.includes(key)) store.set(SENT_KEY, [...done, key]);
  store.set(
    PENDING_KEY,
    pending().filter((k) => k !== key)
  );
}

/** How many are waiting — shown in the backup panel. */
export const mediaPending = (): number => pending().length;

/** A blob that has gone: it no longer waits, and no longer counts as sent. */
export function forgetMedia(key: string): void {
  store.set(
    SENT_KEY,
    sent().filter((k) => k !== key)
  );
  store.set(
    PENDING_KEY,
    pending().filter((k) => k !== key)
  );
}

/* Whose blobs these are. Written by `server.whoAmI`, read here: the
   private prefix needs the account's identifier, and this module has no
   business asking the server for it on every image. */
const ACCOUNT_KEY = "synchro-account";

/**
 * The address of a local key on the container, or `null` if it has none
 * — a decor that has not yet gone up has no server identity, and nothing
 * can be said about where its blob would live.
 */
export function remotePath(key: string): string | null {
  if (key.startsWith(DECOR_IMAGE_PREFIX)) {
    const remote = remoteIdOfDecor(key);
    return remote ? `decor/${remote}` : null;
  }
  const me = store.get<string>(ACCOUNT_KEY, "");
  return me ? `p/${me}/${key}` : null;
}

const usable = (): boolean => serverConfigured() && accountOpen();

/* ------------------------------------------------------------
   PUTTING DOWN
   ------------------------------------------------------------ */

/**
 * Sends what is waiting. Returns how many arrived.
 *
 * A FAILURE HERE MUST NOT SINK THE SYNCHRONISATION OF THE CARDS. The
 * caller (`services/sync`) catches nothing on our behalf: we throw for
 * nobody, and what did not go stays in the register for next time.
 */
export async function pushMedia(): Promise<number> {
  if (!usable()) return 0;
  const waiting = pending();
  if (waiting.length === 0) return 0;

  /* Fifty at a time: the route refuses more, and a person who has just
     imported three hundred screenshots is exactly the person this must
     not choke on. */
  const batch = waiting.slice(0, 50);
  const paths = new Map<string, string>();
  for (const key of batch) {
    const path = remotePath(key);
    if (path) paths.set(path, key);
  }
  if (paths.size === 0) return 0;

  let tickets: { path: string; url: string }[];
  try {
    tickets = await mediaTickets([...paths.keys()]);
  } catch {
    /* No container, offline, or a refusal: the blobs stay here, which is
       where they were safe anyway. */
    return 0;
  }

  let done = 0;
  for (const { path, url } of tickets) {
    const key = paths.get(path);
    if (!key) continue;
    const blob = await getImage(key).catch(() => null);
    /* The blob is gone from the vault since it was noted — erased with
       its card, most likely. Nothing to send, and nothing to keep
       waiting for either. */
    if (!blob) {
      forgetMedia(key);
      continue;
    }
    try {
      const r = await fetch(url, {
        method: "PUT",
        /* Without this header Azure refuses with a message about block
           types that says nothing to anybody reading it in a console. */
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "content-type": blob.type || "application/octet-stream",
        },
        body: blob,
      });
      if (!r.ok) continue;
      markSent(key);
      done += 1;
    } catch {
      /* Next time. */
    }
  }
  return done;
}

/**
 * Erases a blob's copy on the container.
 *
 * ONLY WHAT IS OURS TO ERASE, and it is the server that decides: the
 * route asks for WRITE permission, so a decor merely copied from
 * somebody answers 404 there — which is exactly right. Dropping our copy
 * does not reach the original on their shelf.
 *
 * Silent on every failure: this is called from a local tidy-up, and a
 * ghost left in the container is worth less than a purge that stops.
 */
export async function dropMedia(key: string): Promise<void> {
  if (!usable()) return;
  const path = remotePath(key);
  if (!path) return;
  try {
    const url = await mediaDeleteTicket(path);
    if (url) await fetch(url, { method: "DELETE" });
  } catch {
    /* Next purge. */
  }
}

/* ------------------------------------------------------------
   FETCHING BACK
   ------------------------------------------------------------ */

/**
 * Fetches a blob the vault does not hold, and files it there.
 *
 * `null` if there is none over there either — which is the moment
 * `IdbImage` is right to say the image stayed on the other device.
 *
 * THE CALLER PASSES WHAT TO DO WITH THE BYTES BEFORE THEY ARE KEPT
 * (`vet`). An SVG arriving from somebody else's shelf must go back
 * through the sanitiser before it is cached, let alone injected: it is
 * the only thing here that a wrong answer makes dangerous rather than
 * merely disappointing.
 */
export async function pullMedia(
  key: string,
  vet?: (blob: Blob) => Promise<Blob | null>
): Promise<Blob | null> {
  if (!usable()) return null;
  const path = remotePath(key);
  if (!path) return null;

  try {
    const url = await mediaTicket(path);
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) return null;
    const raw = await r.blob();
    const blob = vet ? await vet(raw) : raw;
    if (!blob) return null;
    await putImage(key, blob);
    /* It is over there, since we have just fetched it from there. */
    markSent(key);
    return blob;
  } catch {
    return null;
  }
}

/**
 * The vault first, the container next.
 *
 * This is the one function the screens call: it says "give me this
 * image", and where it comes from is nobody else's business.
 */
export async function readMedia(
  key: string,
  vet?: (blob: Blob) => Promise<Blob | null>
): Promise<Blob | null> {
  const here = await getImage(key).catch(() => null);
  if (here) return here;
  return pullMedia(key, vet);
}
