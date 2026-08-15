/* ============================================================
   IndexedDB — the image vault.

   localStorage caps at ~5 MB for the whole application and can only
   store text: a poster had to be base64-encoded into it, a third more
   weight. IndexedDB stores the Blob as it is and has several gigabytes.
   The cards themselves stay in localStorage: they are small, and
   synchronous access is convenient there.
   ============================================================ */

import {
  listCustomDecor,
  customDecorImageKeys,
  setCustomDecor,
  listHiddenDecor,
  setHiddenDecor,
} from "./services/customDecor";

const DB_NAME = "cine-hub";
/* Version 2: a second store, `docs`, for what is not an image. */
const DB_VERSION = 2;
const POSTERS = "posters";
const DOCS = "docs";

export const IDB_PREFIX = "idb:";
export const isIdbPoster = (poster) => typeof poster === "string" && poster.startsWith(IDB_PREFIX);
export const idbKeyOf = (poster) => poster.slice(IDB_PREFIX.length);

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(POSTERS)) db.createObjectStore(POSTERS);
      if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS);
    };
    /* TWO TABS, AND THE BINDER NO LONGER OPENS.

       Changing the database's version requires an exclusive lock. As
       long as another tab holds a connection to the old version, the
       browser does not refuse: IT WAITS, in silence, and `onsuccess`
       never comes. A promise that neither resolves nor rejects leaves
       the application on its opening screen, indefinitely — observed,
       the first time, with two tabs open on the site.

       So we reject explicitly: the store knows how to fall back on
       `localStorage`, and a binder that opens in a degraded mode beats a
       binder that does not open. */
    req.onblocked = () => reject(new Error("database locked by another tab"));
    req.onsuccess = () => {
      const db = req.result;
      /* AND ABOVE ALL: DO NOT BE THE ONE BLOCKING. When another tab asks
         for the next version, we close ours instead of holding on to it.
         Without this line, it is the tab next door that stays on its
         opening screen. */
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn, magasin = POSTERS) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(magasin, mode);
    const store = t.objectStore(magasin);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    /* AN ABSENT KEY IS `undefined`, NOT THE REQUEST THAT WENT LOOKING.
     *
     * This read `result?.result !== undefined ? result.result : result`,
     * which is right for a `fn` that returns something other than a
     * request — and catastrophic for `get` on a key that is not there:
     * `request.result` is then `undefined`, so it fell back on the
     * REQUEST OBJECT, and an `IDBRequest` is truthy.
     *
     * Every caller reads that as "the image is here". `readMedia` did:
     * `const here = await getImage(key); if (here) return here;` — so it
     * never once asked the mirror, for any missing image, for anybody.
     * A binder arriving on a second computer showed "stayed on the other
     * device" over every screenshot, and not one ticket request ever
     * left the page. Further down, `URL.createObjectURL` was handed the
     * request and threw "Overload resolution failed", which `IdbImage`
     * caught and turned back into the same sentence.
     *
     * What the fallback is FOR is `fn`s that return no request at all.
     * So we ask whether we HOLD a request, instead of guessing from the
     * value — which is what the `undefined` test was doing.
     *
     * By the shape and not by `instanceof IDBRequest`: the class is a
     * browser global, and the test environment has no IndexedDB at all.
     * A rule that cannot be exercised is how this line got here. */
    const isRequest = result && typeof result === "object" && "result" in result;
    t.oncomplete = () => resolve(isRequest ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/* The store is still called "posters" — it now holds the screenshots
   too, but renaming it would break the databases already created. */
/* ---------- the documents ----------
   Everything that is not an image and no longer fits in `localStorage`'s
   five megabytes: the collection, first of all. We file JavaScript
   objects as they are — IndexedDB clones them, without going through a
   string. */
export const putDoc = (key, value) => tx("readwrite", (s) => s.put(value, key), DOCS);
export const getDoc = (key) => tx("readonly", (s) => s.get(key), DOCS);
export const deleteDoc = (key) => tx("readwrite", (s) => s.delete(key), DOCS);
/* TOUT CE QUE LE MAGASIN TIENT, la collection comprise. Le tri est
   l'affaire de l'appelant : `services/storage` ne monte en mémoire que
   ce qu'il a déclaré coffrable, et `films` n'en est pas. */
export const allDocKeys = () => tx("readonly", (s) => s.getAllKeys(), DOCS);

export const putImage = (key, blob) => tx("readwrite", (s) => s.put(blob, key));
export const getImage = (key) => tx("readonly", (s) => s.get(key));
export const deleteImage = (key) => tx("readwrite", (s) => s.delete(key));
export const allImageKeys = () => tx("readonly", (s) => s.getAllKeys());

/* THE OLD `*Poster` NAMES ARE GONE, and the comment that kept them —
   "kept for the existing calls" — had not been true for a long time:
   there were none left. The only place still using them was
   `posterStats`, just below, that is to say this file calling its own
   aliases.

   `deleteDoc` and `idbAvailable` went with them, for the same reason.
   The second had a replacement opposite without anyone saying so:
   `services/collection` answers the same question with `vaultAvailable`,
   with a timeout on top — a database locked by another tab never
   answers, and `idbAvailable` would have waited forever. */

/* How much room the posters really take — shown in the import settings,
   because an invisible quota is a quota you go past. */
export async function posterStats() {
  const keys = await allImageKeys();
  let bytes = 0;
  for (const k of keys) {
    const blob = await getImage(k);
    if (blob) bytes += blob.size;
  }
  let quota = null;
  try {
    const est = await navigator.storage?.estimate?.();
    quota = est ? { usage: est.usage, quota: est.quota } : null;
  } catch {
    /* estimate() is not everywhere */
  }
  return { count: keys.length, bytes, quota };
}

/* Every image key a collection references: posters AND stills. Forgetting
   the stills here would have them erased on the first purge. */
export function referencedKeys(films) {
  const keys = new Set();
  for (const f of films) {
    if (isIdbPoster(f.poster)) keys.add(idbKeyOf(f.poster));
    for (const s of f.stills || []) {
      if (s.key) keys.add(s.key);
      if (s.thumbKey) keys.add(s.thumbKey); // the thumbnail is derived but referenced
    }
  }
  return keys;
}

/* Erases the images that have become orphans (films deleted).

   Imported decor objects live in the same store without any film citing
   them: without this line, the first purge would carry off the user's
   whole cabinet. */
export async function pruneOrphans(films) {
  const kept = referencedKeys(films);
  /* Decor objects live in the same store with no film citing them —
     INCLUDING the ones taken from a friend, which `customDecorImageKeys`
     lists like any other. Without this line the first purge would carry
     off the whole cabinet. */
  for (const k of customDecorImageKeys()) kept.add(k);
  const keys = await allImageKeys();
  const dead = keys.filter((k) => !kept.has(k));

  /* THE MIRROR IS TIDIED TOO, or the container fills up with ghosts
     nobody names any more. Only what is OURS to erase: `DELETE /media`
     asks for write permission, so a decor merely copied from somebody
     answers 404 there, which is exactly right — dropping our copy does
     not reach the original. */
  const { forgetMedia, dropMedia } = await import("./services/media");

  for (const k of dead) {
    await deleteImage(k);
    forgetMedia(k);
    /* Offline, no account, no container: the ghost stays over there and
       the next purge on a connected day will get it. Not worth failing a
       local tidy-up for. */
    await dropMedia(k);
  }
  return dead.length;
}

/* ---------- backup ----------
   A single .json file holding cards, notes and encoded posters: enough
   to start again after clearing the browser, or on another machine. */

const blobToDataUrl = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

const dataUrlToBlob = async (url) => (await fetch(url)).blob();

export async function exportBackup({
  films,
  notes,
  dividers = [],
  views = null,
  fils = [],
  motifs = null,
}) {
  const images = {};
  const customDecor = listCustomDecor();
  /* Imported objects go out with the rest: they are images the user
     brought in, not settings we would know how to rebuild. */
  for (const key of [...referencedKeys(films), ...customDecor.map((d) => d.imageKey)]) {
    const blob = await getImage(key);
    if (blob) images[key] = await blobToDataUrl(blob);
  }
  return {
    format: "cine-hub-backup",
    customDecor,
    // and the sorting done in the cabinet: those are choices, not images
    hiddenDecor: listHiddenDecor(),
    /* v3 added the shelf's dividers: they are data typed by hand, not
       settings, and they belong here. v4 succeeds it with the views,
       which now carry the whole arrangement. The dividers go on being
       emitted: a v4 read back by an earlier version finds its shelf
       again.
       v5 adds the imported decor objects — a cabinet you made yourself is
       as unrepeatable as a card.
       v6 adds the constellation's threads: a thread is a question you put
       to your collection, and nothing could put it again.
       v7 adds the vocabulary: the motifs you wrote yourself, and those of
       the catalogue you set aside. The catalogue itself is not in it — it
       lives in the code, and copying it here would freeze the version of
       the day. */
    version: 7,
    exportedAt: new Date().toISOString(),
    films,
    notes,
    dividers,
    views,
    fils,
    motifs,
    images,
  };
}

export async function importBackup(data) {
  if (data?.format !== "cine-hub-backup")
    throw new Error("Ce fichier n'est pas une sauvegarde Ciné Hub.");
  // v1 knew only the posters, under the "posters" key
  const images = data.images || data.posters || {};
  for (const [key, dataUrl] of Object.entries(images)) {
    await putImage(key, await dataUrlToBlob(dataUrl));
  }
  /* Imported objects replace the cabinet in place rather than adding to
     it: a backup restores a state, it does not merge.
     Earlier than v5, the file has none — and the cabinet stays empty,
     which is what it was at that time anyway. */
  setCustomDecor(data.customDecor || []);
  setHiddenDecor(data.hiddenDecor || []);
  /* v1 and v2 knew nothing of the shelf: no dividers to restore. v3 has
     some but no views — `views: null` tells the caller to rebuild them
     from the dividers rather than leaving the shelf empty. */
  return {
    films: data.films || [],
    notes: data.notes || [],
    dividers: data.dividers || [],
    views: data.views?.byWall ? data.views : null,
    // earlier than v6: no threads, and there were none at that time
    fils: data.fils || [],
    // likewise for the vocabulary, which arrived in v7
    motifs: data.motifs || null,
  };
}
