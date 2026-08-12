/* ============================================================
   THE REST OF THE BINDER — everything that is not a card
   ============================================================

   A video library is not a list of films. It is also the ARRANGEMENT of
   the shelves — which film on which board, in what order, under which
   divider —, the notebook's pages, the threads strung between works, the
   vocabulary we wrote ourselves, the decors we set out.

   The first synchronisation carried nothing but the cards. So the second
   device found the films again and not the way they were arranged: half
   the binder, and not the less personal half — arranging is this
   application's central gesture.

   WHY THIS MODULE EXISTS SEPARATELY. These documents carry NO date: they
   are objects written straight into `localStorage` by six different
   services, unstamped, and always have been. Giving them one in each of
   those would mean six places not to forget. So we keep a register: one
   key, one date, written here and nowhere else.

   THE WIRE FIELD NAMES (`cle`, `majLe`, `contenu`, `supprime`) ARE THE
   SERVER'S, not ours. They stay as they are until both sides are renamed
   in the same change.
   ============================================================ */
import { store } from "./storage";

/** The date register, alongside the documents themselves. */
const REGISTER_KEY = "documents-maj";
/** What is waiting to be sent — the keys, as for the cards. */
const PENDING_KEY = "documents-a-envoyer";

/* WHAT SYNCHRONISES, AND WHAT MUST ABSOLUTELY NOT.

   Everything that describes the COLLECTION travels. Everything that
   describes THIS device stays: the chosen skin (we do not impose the
   mood of the moment on our other screen), the guided tour's state, the
   invitation to install, and the synchronisation markers themselves —
   sending those would amount to synchronising on our own cursor. */
const SYNCABLE_PREFIXES = ["shelf-view:"];
const SYNCABLE_KEYS = [
  "shelf-views-index",
  "shelf-dividers",
  "notebook-notes",
  "fils",
  "motifs",
  "wall-prefs",
  "decor-custom",
  "decor-hidden",
];

export const isSyncable = (key: string): boolean =>
  SYNCABLE_KEYS.includes(key) || SYNCABLE_PREFIXES.some((p) => key.startsWith(p));

type Register = Record<string, number>;

const register = (): Register => store.get<Register>(REGISTER_KEY, {});
const pending = (): string[] => store.get<string[]>(PENDING_KEY, []);

/**
 * This document has just changed HERE.
 *
 * Called by the store itself (`services/storage`), not by the services
 * that write: it is the one compulsory point of passage, and therefore
 * the one place where it cannot be forgotten.
 */
export function noteDocument(key: string, now = Date.now()): void {
  if (!isSyncable(key)) return;
  store.set(REGISTER_KEY, { ...register(), [key]: now });
  const list = pending();
  if (!list.includes(key)) store.set(PENDING_KEY, [...list, key]);
}

/** A document's date, or zero if it has never been noted. */
export const dateOf = (key: string): number => register()[key] ?? 0;

/** What is left to send, ready for the road. */
export function documentsToSend(): {
  cle: string;
  majLe: number;
  contenu: unknown;
  supprime?: boolean;
}[] {
  return pending().map((key) => {
    const raw = localStorage.getItem(key);
    return {
      cle: key,
      majLe: dateOf(key) || Date.now(),
      /* A document deleted here goes out like the cards: as a tombstone.
         Otherwise the other device would push it back. */
      supprime: raw === null,
      contenu: raw === null ? null : safeParse(raw),
    };
  });
}

const safeParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function forgetSentDocuments(keys: string[]): void {
  const rest = pending().filter((c) => !keys.includes(c));
  store.set(PENDING_KEY, rest);
}

/**
 * Files a document that came from the server.
 *
 * Returns `true` if it was written. Last writer wins, as for the cards —
 * and on a strict tie we keep the local one, because doing nothing is
 * the only arbitration that surprises nobody.
 */
export function fileIncomingDocument(d: {
  cle: string;
  majLe: number;
  contenu: unknown;
  supprime?: boolean;
}): boolean {
  if (!isSyncable(d.cle)) return false;
  if (d.majLe <= dateOf(d.cle)) return false;

  if (d.supprime) localStorage.removeItem(d.cle);
  else store.set(d.cle, d.contenu);

  /* We note the date RECEIVED, and we do not put the key back on the
     waiting list: this document comes from elsewhere, it has no reason
     to go back there. */
  store.set(REGISTER_KEY, { ...register(), [d.cle]: d.majLe });
  forgetSentDocuments([d.cle]);
  return true;
}

/** On an account's first connection: everything we have must go out. */
export function sendAllDocuments(): void {
  const now = Date.now();
  const reg = register();
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isSyncable(key)) keys.push(key);
  }
  /* A date for those that never had one — otherwise the server would
     receive `majLe: 0` and refuse them all on the next round. */
  const next = { ...reg };
  for (const c of keys) if (!next[c]) next[c] = now;
  store.set(REGISTER_KEY, next);
  store.set(PENDING_KEY, keys);
}

export function forgetDocuments(): void {
  store.set(PENDING_KEY, []);
}
