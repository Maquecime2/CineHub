/* ============================================================
   THE STORE — the only door the collection comes in and out through
   ============================================================

   Until now, two lines of `App.jsx` read and wrote the films straight
   into `localStorage`. It worked, and it could not go on, for three
   reasons that have nothing to do with each other.

   THE CEILING. `localStorage` stops at around five megabytes for the
   WHOLE application, and it only stores text. A reasonably furnished
   collection, with its reviews and its screening logs, already takes a
   good share of that — to the point where the store warns the user when
   a write fails. IndexedDB files objects as they are and has several
   gigabytes; the images are already in it.

   THE DATE. A collection that synchronises needs to know WHICH cards
   moved. That date cannot be set by the twenty places that modify a
   film: one omission, and the card never goes out. It is set HERE, in
   passing, on the only cards whose value really changed (`stamp`).

   THE SEAM. The day a server exists, it is this module that will learn
   to push and to pull — not the views. They ask for the collection and
   hand it back; where it comes from is none of their business.

   WHAT STAYS TRUE: nothing goes anywhere. The store writes on this
   machine and on this machine only.
   ============================================================ */
import { getDoc, putDoc } from "../db";
import { migrate, stamp } from "../domain/film";
import { store } from "./storage";
import type { Film } from "../types";

/** The collection's key, in either store. Its VALUE stays `"films"`. */
export const FILMS_KEY = "films";

/* ============================================================
   TOMBSTONES
   ============================================================

   Deleting a card takes it out of the array, and that is all: NOTHING
   remains to say it existed. As long as a binder is alone, that is
   enough. As soon as there are two, it is a hole: the other device,
   which knows nothing of the deletion, pushes its copy back on the next
   send, and the film comes back to life. You delete it, it returns; you
   delete it again, it returns again.

   So for every card that left we keep its identifier and the time of its
   departure. That is the strict minimum — no title, no rating: a
   tombstone is not a copy of the card.

   They do not pile up indefinitely: past a year, a device that has not
   spoken for that long has other problems than this one, and
   resurrecting a year-old card is the least of them. */
export const GRAVES_KEY = "films-effaces";

const GRAVE_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

export interface Grave {
  id: string;
  /** When the card was removed, in milliseconds. */
  at: number;
}

/** The shape stored before this module was translated. */
type StoredGrave = Partial<Grave> & { le?: unknown };

let graves: Grave[] = [];

export const knownGraves = (): Grave[] => graves;

/* ============================================================
   WHAT IS WAITING TO BE SENT
   ============================================================

   First idea, and a bad one: compare `updatedAt` against the date of
   the last send. It lasted three minutes — the time it took a test to
   show that a card PULLED DOWN from the server went straight back up to
   it. Its date comes from the other device, whose clock is not ours:
   comparing it against our own marker means nothing, and depending on
   which way the offset runs you send everything or you send nothing.

   So we keep a LIST: the identifiers of the cards modified HERE since
   the last accepted send. No clock, no subtraction, nothing to
   interpret. It is written by the store, at the one place that can tell
   a local modification from a card received.

   It survives a reload, otherwise a note written offline on a Friday
   would never go out. */
export const PENDING_KEY = "films-a-envoyer";

let pending = new Set<string>();

export const pendingToSend = (): string[] => [...pending];

const notePending = (ids: string[]): void => {
  if (!ids.length) return;
  for (const id of ids) pending.add(id);
  store.set(PENDING_KEY, [...pending]);
};

/**
 * Everything is to be sent.
 *
 * ON AN ACCOUNT'S FIRST CONNECTION, and only there. The waiting list
 * only holds what gets modified AFTER it was put in place: a collection
 * of six hundred films already filed is not on it, so the first send
 * contained nothing at all. The binder called itself up to date, the
 * server stayed empty, and nobody was lying.
 */
export function sendEverything(): void {
  pending = new Set(latest.map((f) => f.id));
  for (const t of graves) pending.add(t.id);
  store.set(PENDING_KEY, [...pending]);
}

/** After an accepted send. Whatever moved again in the meantime stays in. */
export function forgetWhatWentOut(ids: string[]): void {
  for (const id of ids) pending.delete(id);
  store.set(PENDING_KEY, [...pending]);
}

const noteDepartures = (before: Film[], after: Film[], now: number): void => {
  if (!before.length) return;
  const remaining = new Set(after.map((f) => f.id));
  const gone = before.filter((f) => !remaining.has(f.id));
  if (!gone.length) return;
  const cutoff = now - GRAVE_LIFETIME_MS;
  graves = [
    ...graves.filter((t) => t.at > cutoff && remaining.has(t.id) === false),
    ...gone.map((f) => ({ id: f.id, at: now })),
  ];
  store.set(GRAVES_KEY, graves);
  /* A departure is something to say, just as much as a note written. */
  notePending(gone.map((f) => f.id));
};

/* WE KEEP A WORKING COPY, and it is not an optimisation. `stamp` needs
   the PREVIOUS state to say what changed; re-reading IndexedDB on every
   write would give that too, but at the cost of an asynchronous round
   trip before every save, on a path where we write on every
   keystroke. */
let latest: Film[] = [];

/* Some browsers' private mode refuses IndexedDB. We cannot refuse the
   application over it: we fall back on `localStorage`, with its ceiling
   — that is worse, and it is better than nothing. The answer is
   remembered, the question is only asked once. */
let vault: boolean | null = null;

/* WHAT DOES NOT ANSWER WITHIN TWO SECONDS WILL NOT ANSWER.

   A database locked by another tab is already handled at the source
   (`db.js` rejects instead of waiting), but the opening screen is the
   one place in the application where a pending promise is caught by
   nothing: it leaves the binder shut, with no message and no recourse.
   This timeout is the belt that goes with the braces. */
const TIMEOUT_MS = 2000;

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("vault muet")), TIMEOUT_MS)),
  ]);

const vaultAvailable = async (): Promise<boolean> => {
  if (vault !== null) return vault;
  try {
    await withTimeout(getDoc(FILMS_KEY));
    vault = true;
  } catch {
    vault = false;
  }
  return vault;
};

/**
 * Loads the collection, wherever it comes from.
 *
 * THE ORDER MATTERS: IndexedDB first, `localStorage` second. A
 * collection already moved down into the vault is more recent there
 * than the copy left upstairs, and reading the second would bring back
 * to life cards deleted the day before.
 */
export async function loadFilms(): Promise<Film[]> {
  let raw: Partial<Film>[] | null = null;

  if (await vaultAvailable()) {
    try {
      const doc = await getDoc(FILMS_KEY);
      if (Array.isArray(doc)) raw = doc as Partial<Film>[];
    } catch {
      /* The vault answered on opening and then refused the read: we step
         down a level rather than lose the collection. */
      vault = false;
    }
  }

  /* Nothing in the vault: either a first opening, or a collection that
     has not moved yet. Either way, what counts is upstairs. */
  const migrating = raw === null;
  if (raw === null) raw = store.get<Partial<Film>[]>(FILMS_KEY, []);

  const films = migrate(raw);
  latest = films;
  /* The tombstones stay in `localStorage`: a few dozen bytes per card
     that left, and they must survive an unavailable vault as well as a
     reload. */
  /* `le` became `at` when this module was translated, and a tombstone
     is written to disk. Reading only the new spelling would drop every
     grave already laid — and each of those cards would come back to life
     on the next pull from a device that still has it. */
  const storedGraves = store.get<StoredGrave[]>(GRAVES_KEY, []);
  graves = (Array.isArray(storedGraves) ? storedGraves : [])
    .map((t) => ({ id: String(t?.id ?? ""), at: typeof t?.at === "number" ? t.at : t?.le }))
    .filter((t): t is Grave => !!t.id && typeof t.at === "number");
  pending = new Set(store.get<string[]>(PENDING_KEY, []).filter((x) => typeof x === "string"));

  /* The move happens on the first load that can manage it, and the old
     copy is NOT erased in the same breath: until we have written to the
     vault successfully once, it is the only copy. It is `saveFilms` that
     removes it, afterwards. */
  if (migrating && films.length && (await vaultAvailable())) {
    await write(films);
  }

  return films;
}

/** The bare write, with no stamping: the move uses it as it is. */
async function write(films: Film[]): Promise<void> {
  if (await vaultAvailable()) {
    try {
      /* A plain copy: IndexedDB clones the value, and a frozen object or
         one carrying functions would make that fail. `JSON` guarantees a
         cloneable structure, and a card is nothing but data. */
      await putDoc(FILMS_KEY, JSON.parse(JSON.stringify(films)));
      /* The vault took it: the upstairs copy has no reason to exist any
         more, and it takes up the room that was missing. */
      localStorage.removeItem(FILMS_KEY);
      return;
    } catch {
      vault = false;
    }
  }
  /* `set` AND NOT `setSoon`, AND IT IS DELIBERATE.

     `main` had put the collection on deferred writing, so as not to
     re-serialise six hundred cards on every keystroke. That reasoning
     was aimed at `localStorage`, which was then the collection's only
     home; since, it has moved into the vault, and this line is now only
     the FALLBACK for the day the vault refuses.

     But that is precisely the day not to defer: we have just learned
     that the copy downstairs does not exist, and this one is the only
     one. Four hundred milliseconds of window on the last remaining copy
     is a bad bargain — and two tests already say so.

     Batching stays available (`store.setSoon`) for whoever writes a
     rebuildable value often; that is not the case here. */
  store.set(FILMS_KEY, films);
}

/**
/**
 * Saves the collection and returns what was written.
 *
 * The return value is not a courtesy: the modified cards carry their new
 * date in it, and it is THAT array the application must keep in memory.
 * Returning the one we were given would make the screen and the disk
 * drift apart on the very first write.
 */
export async function saveFilms(films: Film[]): Promise<Film[]> {
  const now = Date.now();
  const stamped = stamp(latest, films, now);
  /* Departures are read HERE and nowhere else: it is the only place that
     sees the before and the after. A deletion signalled by every caller
     would be a deletion one caller forgets to signal — and a card that
     comes back to life on the next send. */
  noteDepartures(latest, stamped, now);
  /* WHAT MOVED IS READ FROM THE OBJECTS' IDENTITY, not from their date.
     `stamp` returns the SAME object for an unchanged card: an object
     different from the previous one is therefore a modified card, and a
     card absent from before is a new one. That is exact.

     Comparing `updatedAt` against "now" seemed equivalent and was not:
     two saves within the same millisecond — which happens on the
     slightest sequence of gestures — made cards that had not moved look
     modified. */
  const before = new Map(latest.map((f) => [f.id, f]));
  notePending(stamped.filter((f) => before.get(f.id) !== f).map((f) => f.id));
  latest = stamped;
  await write(stamped);
  return stamped;
}

/**
/**
 * Writes a collection from ELSEWHERE, without re-dating it.
 *
 * `saveFilms` dates what changed — that is its job, and it is exactly
 * what must not happen here. The cards coming down from the server
 * already carry their date; re-dating them to now would make them look
 * like local modifications, they would go back up to the server, which
 * would send them back, indefinitely.
 *
 * Departures are not noted either: a card missing from a pull was not
 * deleted here, it simply was not in the batch.
 */
export async function replaceFilms(films: Film[]): Promise<void> {
  latest = films;
  await write(films);
}

/**
/**
 * The collection as the disk knows it, without re-reading it.
 *
 * Synchronisation needs it at moments when the screen is not the source:
 * just after a pull, for instance.
 */
export const knownCollection = (): Film[] => latest;

/** For the tests, and for a restore that starts from scratch. */
export function forgetCache(films: Film[] = []): void {
  latest = films;
  vault = null;
}
