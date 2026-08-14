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
import { getImage, putImage, allImageKeys } from "../db";
import { accountOpen, serverConfigured, mediaTickets, mediaDeleteTicket } from "./server";
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

/* THE REGISTERS ARE SETTLED ONCE PER BATCH, NOT ONCE PER BLOB.
 *
 * Both lists live in one `localStorage` entry each, so touching one blob
 * used to re-serialise the whole array — and the array is as long as the
 * vault. Fifty screenshots meant fifty rewrites of a growing list of a
 * thousand keys, which is quadratic work on the main thread, in a
 * synchronous API, while somebody is looking at the shelf.
 *
 * `arrived` is what got there, `vanished` what is no longer in the vault
 * to send. One read, one write, whatever the size of the batch. */
function settle(arrived: string[], vanished: string[]): void {
  if (!arrived.length && !vanished.length) return;
  const leaving = new Set([...arrived, ...vanished]);
  const done = new Set(sent());
  for (const k of vanished) done.delete(k);
  for (const k of arrived) done.add(k);
  store.set(SENT_KEY, [...done]);
  store.set(
    PENDING_KEY,
    pending().filter((k) => !leaving.has(k))
  );
}

/** It is over there now. */
const markSent = (key: string): void => settle([key], []);

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
/* WHY THE LAST UPLOAD FAILED, IN WORDS SOMEBODY CAN ACT ON.

   Every failure here used to be swallowed — deliberately, so that a
   container in trouble could not sink a synchronisation of cards that
   worked. But swallowed is not the same as invisible: the browser's
   network panel showed rows of failed PUTs of 0 B, and the application
   said "up to date". Nothing anywhere named the cause, which for a
   container freshly made is almost always the same one — no CORS rule,
   so the browser refuses the request BEFORE sending it and reports
   nothing that reaches our `catch`.

   So the reason is kept, and the drawer says it. */
/* THE TIRAGE HAS ITS OWN WORD, AND IT IS NOT COSMETIC. Both sentences
   for the two kinds below speak of a DEPOSIT — "your posters are not
   going out", "the container refused the upload". Routing a failed READ
   into them would have told somebody their images were failing to
   leave, at the exact moment the images were failing to arrive: a wrong
   sentence sends the reader looking in the wrong direction, which is
   worse than the silence it replaces. */
export type MediaTrouble = {
  kind: "cors" | "refused" | "read-refused" | "none";
  detail?: string;
};

let lastTrouble: MediaTrouble = { kind: "none" };
export const mediaTrouble = (): MediaTrouble => lastTrouble;

/* THE ROLL CALL — because `noteMedia` only knows about the future.
 *
 * The register is filled at the moment a blob is WRITTEN, and that leaves
 * a whole population outside it: everything already in the vault when the
 * mirror was plugged in. Those blobs are in no register, so `pushMedia`
 * never looks at them, and no number of synchronisations changes that —
 * the screenshots of a binder kept for a year simply never left.
 *
 * The decors never had the problem: `pushNewDecor` runs at every
 * synchronisation and notes their blob when the object gets its server
 * identity. This is the same catching-up, for everything else.
 *
 * It reads KEYS, never blobs, and skips what the two registers already
 * name — so it costs one `getAllKeys` per synchronisation, and says
 * nothing on the second run.
 *
 * The decor keys are left out on purpose: their address depends on a
 * server identity they may not have yet (`remotePath` answers `null`),
 * and enrolling them here would park them in the register for good,
 * inflating the "waiting" count with blobs nobody is waiting for.
 * `pushNewDecor` notes them at the right moment.
 */
async function enrolExistingMedia(): Promise<void> {
  const keys: unknown[] = await allImageKeys().catch(() => []);
  const known = new Set([...sent(), ...pending()]);
  const fresh = keys.filter(
    (k): k is string => typeof k === "string" && !known.has(k) && !k.startsWith(DECOR_IMAGE_PREFIX)
  );
  if (fresh.length) store.set(PENDING_KEY, [...pending(), ...fresh]);
}

/* Fifty at a time: the route refuses more. */
const BATCH = 50;

/* AND AT MOST SO MANY BATCHES IN ONE SYNCHRONISATION.
 *
 * `pushMedia` used to send ONE batch and return, so a binder catching up
 * on a thousand screenshots needed twenty synchronisations to do it —
 * which reads, from the outside, exactly like a mirror that never
 * finishes. It now drains the queue, and stops on the first batch that
 * moves nothing: a container refusing every PUT is refused twenty times
 * over otherwise. */
const ROUNDS = 40;

/* HOW MANY BLOBS TRAVEL AT ONCE.
 *
 * One at a time made the catching-up as long as the sum of a thousand
 * round trips, most of it spent waiting rather than sending. Four is
 * chosen against the browser's own ceiling — six connections per host —
 * and leaves room for the synchronisation of the cards, which is going
 * on at the same time and matters more: a poster that arrives a minute
 * later costs nothing, a card that does not arrive costs a note.
 *
 * It is deliberately not tunable. A number one can raise is a number
 * somebody raises to twenty, and twenty parallel uploads on a telephone
 * is how a browser tab runs out of memory holding twenty blobs. */
const LANES = 4;

/**
 * Runs `job` over `items`, `lanes` of them in flight at a time.
 *
 * A pool rather than a `Promise.all` over slices of four: with slices,
 * every lane waits for the slowest of its group before the next one
 * starts, which on a batch holding one 4 MB screenshot among forty small
 * ones is most of the time spent idle. Here a lane that finishes takes
 * the next item immediately.
 *
 * `job` MUST NOT THROW — a rejection here would escape into `pushMedia`,
 * whose whole promise is that a container in trouble cannot sink the
 * synchronisation of the cards. The one caller catches everything.
 */
async function inLanes<T>(
  items: T[],
  lanes: number,
  job: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const lane = async (): Promise<void> => {
    /* `next++` reads and increments with nothing able to run in between:
       JavaScript hands the lane back only at an `await`. Two lanes can
       therefore never be given the same item. */
    while (next < items.length) await job(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(lanes, items.length) }, lane));
}

export async function pushMedia(): Promise<number> {
  if (!usable()) return 0;
  await enrolExistingMedia();

  let done = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const { sent: moved, progress } = await pushBatch();
    done += moved;
    /* Nothing left to send, or nothing getting through. Either way there
       is no sense in asking for fifty more tickets. */
    if (progress === 0) break;
  }
  return done;
}

interface BatchResult {
  /** How many reached the container. */
  sent: number;
  /** How many left the queue, ghosts included — the drain's signal. */
  progress: number;
}

async function pushBatch(): Promise<BatchResult> {
  const none = { sent: 0, progress: 0 };
  const waiting = pending();
  if (waiting.length === 0) return none;

  const batch = waiting.slice(0, BATCH);
  const paths = new Map<string, string>();
  for (const key of batch) {
    const path = remotePath(key);
    if (path) paths.set(path, key);
  }
  /* Every key in this batch is addressless — decors with no server
     identity yet. Going round again would hand back the same fifty. */
  if (paths.size === 0) return none;

  let tickets: { path: string; url: string }[];
  try {
    tickets = await mediaTickets([...paths.keys()]);
  } catch {
    /* No container, offline, or a refusal: the blobs stay here, which is
       where they were safe anyway. */
    return none;
  }

  const arrived: string[] = [];
  const vanished: string[] = [];
  /* THE REASON IS DECIDED AFTER THE BATCH, NOT DURING IT.
     Sequentially, "the last failure wins" was a defensible rule because
     the last failure was a knowable thing. In lanes it is whichever
     request happened to finish last, which is weather. So the failures
     are collected and read at the end, in a fixed order of severity. */
  let silent = false;
  let refused: string | null = null;

  await inLanes(tickets, LANES, async ({ path, url }) => {
    const key = paths.get(path);
    if (!key) return;
    const blob = await getImage(key).catch(() => null);
    /* The blob is gone from the vault since it was noted — erased with
       its card, most likely. Nothing to send, and nothing to keep
       waiting for either. */
    if (!blob) {
      vanished.push(key);
      return;
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
      if (!r.ok) {
        /* AZURE ANSWERED, AND SAID NO. A 403 is almost always a clock:
           the signature is timed, and a machine several minutes off is
           refused with no other explanation. The status is kept as it
           stands — inventing a diagnosis would be worse than quoting
           one. */
        refused ??= `${r.status} ${r.statusText}`.trim();
        return;
      }
      arrived.push(key);
    } catch {
      /* THE REQUEST NEVER WENT OUT, and for a container that has just
         been created there is one overwhelmingly likely reason: no CORS
         rule on it, so the browser refuses the PUT before sending it and
         tells JavaScript nothing at all. That silence is the whole
         difficulty — it is indistinguishable, here, from being offline,
         which is why the sentence names the likely cause rather than
         asserting it. */
      silent = true;
    }
  });

  /* A request that never went out says more than one that was answered:
     it names a container the browser will not talk to at all, where a
     403 names one blob's signature. So it is read first — and a batch
     where everything arrived says so, whatever came before. */
  if (silent) lastTrouble = { kind: "cors" };
  else if (refused) lastTrouble = { kind: "refused", detail: refused };
  else if (arrived.length) lastTrouble = { kind: "none" };

  settle(arrived, vanished);
  /* A BATCH THAT ONLY BURIED GHOSTS IS STILL PROGRESS. The queue got
     shorter, so the drain must go round again — counting arrivals alone
     would stop it in front of a run of blobs erased with their cards. */
  return { sent: arrived.length, progress: arrived.length + vanished.length };
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
/* ------------------------------------------------------------
   ONE REQUEST FOR A SCREENFUL OF TICKETS
   ------------------------------------------------------------

   `pullMedia` asked for its ticket alone, which read innocently: one
   image, one ticket. On a screen it is not one image. A film's strip
   mounts every thumbnail at once, so twenty stills asked for twenty
   tickets in the same instant — and the server's general ceiling is a
   hundred requests a minute.

   A binder arriving on a second computer, where EVERYTHING is still to
   be fetched, went through that ceiling in seconds. From then on every
   ticket came back 429, `mediaTicket` turned it into `null`, and the
   screen said "stayed on the other device" over blobs sitting in the
   container. Measured on a real collection: 348 blobs expected, 210
   missing here, and the first hundred tickets asked for came back with
   the file's size. Not one of them was actually absent.

   So the tickets asked for within the same MOMENT leave together,
   exactly as the sending side has always done.

   AND THE MOMENT IS MEASURED IN MILLISECONDS, NOT IN TICKS. The first
   version of this closed the window on the next microtask, which
   batched nothing at all: every caller reaches here only after its own
   `getImage` has come back, and an IndexedDB read is a round trip. The
   twenty thumbnails of a strip therefore arrive in twenty different
   ticks, spread over a few milliseconds — a microtask window catches
   exactly one of them each time, and we were back to one request per
   image with a comment claiming otherwise.

   Twenty milliseconds is chosen against what it costs: it is below the
   threshold where somebody sees a delay, and it is far longer than the
   spread of a screenful of vault reads. */
const WINDOW_MS = 20;

let batch: { paths: Set<string>; wait: Promise<Map<string, string>> } | null = null;

function readTicket(path: string): Promise<string | null> {
  if (!batch) {
    const paths = new Set<string>();
    const wait = new Promise<void>((go) => setTimeout(go, WINDOW_MS)).then(async () => {
      batch = null;
      const asked = [...paths];
      const found = new Map<string, string>();
      /* The route takes fifty at a time, and a screen can hold more. */
      for (let i = 0; i < asked.length; i += BATCH) {
        try {
          for (const t of await mediaTickets(asked.slice(i, i + BATCH), "read")) {
            found.set(t.path, t.url);
          }
        } catch (e) {
          /* NAMED, NOT SWALLOWED, AND WITH ITS STATUS. This is the
             failure that cost a collection its screenshots while the
             drawer said nothing: a 429 and an absent image looked
             exactly alike on screen. */
          const err = e as { code?: number; message?: string };
          const code = err?.code ? `${err.code} ` : "";
          lastTrouble = {
            kind: "read-refused",
            detail: `${code}${err?.message || "tickets refusés"}`.trim(),
          };
        }
      }
      return found;
    });
    batch = { paths, wait };
  }
  batch.paths.add(path);
  return batch.wait.then((found) => found.get(path) ?? null);
}

export async function pullMedia(
  key: string,
  vet?: (blob: Blob) => Promise<Blob | null>
): Promise<Blob | null> {
  if (!usable()) return null;
  const path = remotePath(key);
  if (!path) return null;

  try {
    const url = await readTicket(path);
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
