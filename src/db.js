/* ============================================================
   IndexedDB — le coffre à images.

   localStorage plafonne à ~5 Mo pour toute l'application et ne sait
   stocker que du texte : une affiche devait y être encodée en base64,
   soit un tiers de poids en plus. IndexedDB stocke le Blob tel quel et
   dispose de plusieurs gigaoctets. Les fiches, elles, restent en
   localStorage : elles sont petites, et l'accès synchrone y est commode.
   ============================================================ */

const DB_NAME = "cine-hub";
const DB_VERSION = 1;
const POSTERS = "posters";

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/* Le mode privé de certains navigateurs refuse IndexedDB : mieux vaut le
   savoir avant de proposer un stockage qui n'existe pas. */
export async function idbAvailable() {
  try { await openDb(); return true; } catch { return false; }
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(POSTERS, mode);
    const store = t.objectStore(POSTERS);
    let result;
    try { result = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const putPoster = (key, blob) => tx("readwrite", (s) => s.put(blob, key));
export const getPoster = (key) => tx("readonly", (s) => s.get(key));
export const deletePoster = (key) => tx("readwrite", (s) => s.delete(key));
export const allPosterKeys = () => tx("readonly", (s) => s.getAllKeys());

/* Combien de place occupent réellement les affiches — affiché dans les
   réglages d'import, parce qu'un quota invisible est un quota qu'on dépasse. */
export async function posterStats() {
  const keys = await allPosterKeys();
  let bytes = 0;
  for (const k of keys) {
    const blob = await getPoster(k);
    if (blob) bytes += blob.size;
  }
  let quota = null;
  try {
    const est = await navigator.storage?.estimate?.();
    quota = est ? { usage: est.usage, quota: est.quota } : null;
  } catch { /* estimate() n'est pas partout */ }
  return { count: keys.length, bytes, quota };
}

/* Efface les affiches devenues orphelines (films supprimés). */
export async function pruneOrphans(films) {
  const kept = new Set(films.filter((f) => isIdbPoster(f.poster)).map((f) => idbKeyOf(f.poster)));
  const keys = await allPosterKeys();
  const dead = keys.filter((k) => !kept.has(k));
  for (const k of dead) await deletePoster(k);
  return dead.length;
}

/* ---------- sauvegarde ----------
   Un seul fichier .json contenant fiches, notes et affiches encodées :
   de quoi repartir après un nettoyage du navigateur ou sur une autre machine. */

const blobToDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(blob);
});

const dataUrlToBlob = async (url) => (await fetch(url)).blob();

export async function exportBackup({ films, notes }) {
  const posters = {};
  for (const f of films) {
    if (!isIdbPoster(f.poster)) continue;
    const blob = await getPoster(idbKeyOf(f.poster));
    if (blob) posters[idbKeyOf(f.poster)] = await blobToDataUrl(blob);
  }
  return {
    format: "cine-hub-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    films, notes, posters,
  };
}

export async function importBackup(data) {
  if (data?.format !== "cine-hub-backup") throw new Error("Ce fichier n'est pas une sauvegarde Ciné Hub.");
  for (const [key, dataUrl] of Object.entries(data.posters || {})) {
    await putPoster(key, await dataUrlToBlob(dataUrl));
  }
  return { films: data.films || [], notes: data.notes || [] };
}
