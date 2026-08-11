/* ============================================================
   IndexedDB — le coffre à images.

   localStorage plafonne à ~5 Mo pour toute l'application et ne sait
   stocker que du texte : une affiche devait y être encodée en base64,
   soit un tiers de poids en plus. IndexedDB stocke le Blob tel quel et
   dispose de plusieurs gigaoctets. Les fiches, elles, restent en
   localStorage : elles sont petites, et l'accès synchrone y est commode.
   ============================================================ */

import {
  listCustomDecor,
  customDecorImageKeys,
  setCustomDecor,
  listHiddenDecor,
  setHiddenDecor,
} from "./services/customDecor";

const DB_NAME = "cine-hub";
/* Version 2 : un second magasin, `docs`, pour ce qui n'est pas une image.
   La collection y descend — voir `services/collection`. Une base déjà
   créée passe par `onupgradeneeded` sans rien perdre : on n'ajoute qu'un
   magasin, on ne touche pas à celui des images. */
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
    /* DEUX ONGLETS, ET LE CLASSEUR N'OUVRE PLUS.

       Changer la version de la base demande un verrou exclusif. Tant
       qu'un autre onglet tient une connexion à l'ancienne version, le
       navigateur ne refuse pas : IL ATTEND, en silence, et `onsuccess`
       ne vient jamais. Une promesse qui ne se résout ni ne se rejette
       laisse l'application sur son écran d'ouverture, indéfiniment —
       observé, la première fois, avec deux onglets ouverts sur le site.

       On rejette donc explicitement : le dépôt sait retomber sur le
       `localStorage`, et mieux vaut un classeur qui s'ouvre en mode
       dégradé qu'un classeur qui n'ouvre pas. */
    req.onblocked = () => reject(new Error("base verrouillée par un autre onglet"));
    req.onsuccess = () => {
      const db = req.result;
      /* ET SURTOUT : NE PAS ÊTRE CELUI QUI BLOQUE. Quand un autre onglet
         demande la version suivante, on ferme la nôtre au lieu de la
         retenir. Sans cette ligne, c'est l'onglet d'à côté qui reste sur
         son écran d'ouverture. */
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

/* Le mode privé de certains navigateurs refuse IndexedDB : mieux vaut le
   savoir avant de proposer un stockage qui n'existe pas. */
export async function idbAvailable() {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
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
    t.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/* Le magasin s'appelle encore « posters » — il stocke désormais aussi les
   captures d'écran, mais renommer casserait les bases déjà créées. */
/* ---------- les documents ----------
   Tout ce qui n'est pas une image et ne tient plus dans les cinq
   mégaoctets du `localStorage` : la collection, d'abord. On range des
   objets JavaScript tels quels — IndexedDB les clone, sans passer par
   une chaîne de caractères. */
export const putDoc = (key, valeur) => tx("readwrite", (s) => s.put(valeur, key), DOCS);
export const getDoc = (key) => tx("readonly", (s) => s.get(key), DOCS);
export const deleteDoc = (key) => tx("readwrite", (s) => s.delete(key), DOCS);

export const putImage = (key, blob) => tx("readwrite", (s) => s.put(blob, key));
export const getImage = (key) => tx("readonly", (s) => s.get(key));
export const deleteImage = (key) => tx("readwrite", (s) => s.delete(key));
export const allImageKeys = () => tx("readonly", (s) => s.getAllKeys());

// anciens noms, conservés pour les appels existants
export const putPoster = putImage;
export const getPoster = getImage;
export const deletePoster = deleteImage;
export const allPosterKeys = allImageKeys;

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
  } catch {
    /* estimate() n'est pas partout */
  }
  return { count: keys.length, bytes, quota };
}

/* Toutes les clés d'images qu'une collection référence : affiches ET captures.
   Oublier les captures ici les ferait effacer à la première purge. */
export function referencedKeys(films) {
  const keys = new Set();
  for (const f of films) {
    if (isIdbPoster(f.poster)) keys.add(idbKeyOf(f.poster));
    for (const s of f.stills || []) {
      if (s.key) keys.add(s.key);
      if (s.thumbKey) keys.add(s.thumbKey); // la vignette est dérivée mais référencée
    }
  }
  return keys;
}

/* Efface les images devenues orphelines (films supprimés).

   Les objets de déco importés vivent dans le même magasin sans qu'aucun
   film ne les cite : sans cette ligne, la première purge emporterait tout
   le cabinet de l'utilisateur. */
export async function pruneOrphans(films) {
  const kept = referencedKeys(films);
  for (const k of customDecorImageKeys()) kept.add(k);
  const keys = await allImageKeys();
  const dead = keys.filter((k) => !kept.has(k));
  for (const k of dead) await deleteImage(k);
  return dead.length;
}

/* ---------- sauvegarde ----------
   Un seul fichier .json contenant fiches, notes et affiches encodées :
   de quoi repartir après un nettoyage du navigateur ou sur une autre machine. */

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
  /* Les objets importés partent avec le reste : ce sont des images que
     l'utilisateur a apportées, pas des réglages qu'on saurait refaire. */
  for (const key of [...referencedKeys(films), ...customDecor.map((d) => d.imageKey)]) {
    const blob = await getImage(key);
    if (blob) images[key] = await blobToDataUrl(blob);
  }
  return {
    format: "cine-hub-backup",
    customDecor,
    // et le tri qu'on a fait dans le cabinet : ce sont des choix, pas des images
    hiddenDecor: listHiddenDecor(),
    /* v3 ajoutait les intercalaires de l'étagère : ce sont des données
       saisies à la main, pas des réglages, elles ont leur place ici.
       v4 leur succède avec les vues, qui portent désormais tout le
       rangement. Les intercalaires continuent d'être émis : une v4
       relue par une version antérieure y retrouve son étagère.
       v5 ajoute les objets de déco importés — le cabinet qu'on s'est
       fait soi-même est aussi peu refaisable qu'une fiche.
       v6 ajoute les fils de la constellation : un fil est une question
       qu'on a posée à sa collection, et rien ne saurait la reposer.
       v7 ajoute le vocabulaire : les motifs qu'on s'est écrits, et ceux du
       catalogue qu'on a écartés. Le catalogue, lui, n'y est pas — il vit
       dans le code, et le recopier ici figerait la version du jour. */
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
  // v1 ne connaissait que les affiches, sous la clé « posters »
  const images = data.images || data.posters || {};
  for (const [key, dataUrl] of Object.entries(images)) {
    await putImage(key, await dataUrlToBlob(dataUrl));
  }
  /* Les objets importés remplacent le cabinet en place plutôt que de s'y
     ajouter : une sauvegarde restaure un état, elle ne fusionne pas.
     Antérieur à v5, le fichier n'en a pas — et le cabinet reste vide,
     ce qu'il était de toute façon à cette époque-là. */
  setCustomDecor(data.customDecor || []);
  setHiddenDecor(data.hiddenDecor || []);
  /* v1 et v2 ne connaissaient pas l'étagère : pas d'intercalaires à
     restaurer. v3 en a mais pas de vues — `views: null` dit à l'appelant
     de les refabriquer depuis les intercalaires plutôt que de laisser
     l'étagère vide. */
  return {
    films: data.films || [],
    notes: data.notes || [],
    dividers: data.dividers || [],
    views: data.views?.byWall ? data.views : null,
    // antérieur à v6 : pas de fils, et il n'y en avait pas à cette époque
    fils: data.fils || [],
    // idem pour le vocabulaire, arrivé en v7
    motifs: data.motifs || null,
  };
}
