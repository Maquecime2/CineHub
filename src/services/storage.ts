/* ============================================================
   LOCAL PERSISTENCE — replaces the artifact runtime's window.storage.
   ============================================================ */

/** The localStorage keys, gathered so that none gets lost on the way. */
export const KEYS = {
  films: "films",
  notes: "notebook-notes",
  dividers: "shelf-dividers",
  onboarding: "onboarding",
  tmdbKey: "tmdb-key",
} as const;

/* The date register lives in `documents`, which itself writes through
   this store: we load it on the fly so as not to tie the two modules to
   each other at load time. The promise is not awaited — dating a
   document must never delay writing it. */
const noteIfSyncable = async (key: string): Promise<void> => {
  const { isSyncable, noteDocument } = await import("./documents");
  if (isSyncable(key)) noteDocument(key);
};

/* ------------------------------------------------------------
   THE QUOTA IS SEEN COMING, IT IS NOT DISCOVERED
   ------------------------------------------------------------

   The warning only arrived AFTER the write had failed. By then the
   damage is done: the change is on screen, it is not on the disk, and
   nothing says so — you close the tab believing you saved, and you
   reopen yesterday's collection.

   So we measure BEFORE. `JSON.stringify` is called to write anyway; its
   length costs nothing more, and it lets us warn while there is still
   room to act — export a backup, lighten some posters.

   The threshold is in UTF-16: `localStorage` counts code units, not
   bytes, and most browsers cap around five million. We warn at four
   fifths. */
const WARN_THRESHOLD = 4_000_000;

/* ------------------------------------------------------------
   L'AVERTISSEMENT NE BLOQUE PLUS, ET IL SE TRADUIT
   ------------------------------------------------------------

   C'était un `alert()`, avec sa phrase écrite en français DANS LE CODE.
   Trois défauts en une ligne : il arrête la page au milieu d'une frappe,
   il n'apparaît dans aucun catalogue donc il est en français pour tout
   le monde, et une boîte du navigateur est exactement ce que cette
   application passe son temps à ne pas être.

   CE MODULE NE PEUT PAS TRADUIRE LUI-MÊME : il est chargé avant l'écran,
   il n'a ni React ni catalogue, et lui en donner un le ferait dépendre
   de la moitié de l'application pour poser une phrase. Il SIGNALE donc,
   et quelqu'un d'autre le dit — même arrangement que le cartouche de la
   clé TMDB (`registerTmdbOpener`), pour la même raison.

   Un seul abonné à la fois : c'est `App` qui le monte, et il n'y en a
   qu'un.
   ------------------------------------------------------------ */
type QuotaWatcher = (bytes: number) => void;

let watcher: QuotaWatcher | null = null;

/** Monté par `App`; rend de quoi se désabonner. */
export function watchQuota(fn: QuotaWatcher): () => void {
  watcher = fn;
  /* CE QUI A ÉTÉ MANQUÉ AVANT L'ABONNEMENT N'EST PAS PERDU. Le premier
     dépassement peut arriver pendant le chargement, donc avant que
     l'écran soit là pour l'entendre. On le rejoue. */
  if (warnedAt !== null) fn(warnedAt);
  return () => {
    if (watcher === fn) watcher = null;
  };
}

/* Une fois par session, et pas une de plus : un avertissement qui revient
   à chaque frappe est un avertissement qu'on apprend à écarter sans le
   lire. On garde la TAILLE plutôt qu'un booléen, pour pouvoir la rejouer
   à qui s'abonne trop tard. */
let warnedAt: number | null = null;

const warnIfLarge = (size: number): void => {
  if (warnedAt !== null || size < WARN_THRESHOLD) return;
  warnedAt = size;
  watcher?.(size);
};

/** Pour les tests, et pour repartir de zéro. */
export const forgetQuotaWarning = (): void => {
  warnedAt = null;
};

/* ------------------------------------------------------------
   WRITE LATER, AND ONLY ONCE
   ------------------------------------------------------------

   `saveFilms` re-serialises the WHOLE collection on every edit, and it
   is called from a dozen places — filing a shelf, ticking a screening,
   setting a motif. On five hundred cards, every keystroke in a review
   wrote the entire binder.

   We keep the last value per key and write once, a little later. What
   makes this safe is the FLUSH: leaving the page, switching tabs or
   hiding the window writes immediately. Without it, deferring would
   amount to betting on the user's patience. */
const DELAY = 400;

const pending = new Map<string, unknown>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Writes everything that is waiting. No effect when nothing is. */
export function flush(): void {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending.size === 0) return;
  const batch = [...pending];
  pending.clear();
  for (const [k, v] of batch) store.set(k, v);
}

export const store = {
  get: <T>(k: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  /* The immediate write. It stays the default path: most keys are tiny
     and written once in a while. */
  set: (k: string, v: unknown): boolean => {
    try {
      /* MEASURE BEFORE WRITING, DATE AFTER HAVING WRITTEN: the two
         halves of this line come from two different pieces of work and
         compose without getting in each other's way. */
      const text = JSON.stringify(v);
      warnIfLarge(text.length);
      localStorage.setItem(k, text);
      /* THE DATE IS SET HERE, AND THAT IS THE WHOLE POINT OF SETTING IT
         HERE.

         Six services write documents — the shelf, the notebook, the
         threads, the vocabulary, the decors, the wall's preferences —
         and none of them dates what it writes. Asking each to remember
         is guaranteeing that one will forget, and that a whole section
         of the binder will never synchronise with nothing to say so.

         The import is deferred for a dull and real reason: the date
         register writes itself through this store, and a direct import
         would make a loop between the two modules. */
      void noteIfSyncable(k);
      return true;
    } catch (e) {
      console.error(e);
      /* L'ÉCRITURE A ÉCHOUÉ, ce qui est pire que « ça se remplit » : ce
         qui est à l'écran n'est PAS sur le disque. On le signale par le
         même canal, avec la taille qu'on n'a pas pu écrire — l'écran
         saura dire laquelle des deux phrases il faut.

         `warnedAt` est forcé : la jauge a pu ne jamais être franchie
         (une seule grosse valeur suffit à faire déborder), et se taire
         ici serait se taire au seul moment qui compte vraiment. */
      if (String((e as Error)?.name || "").includes("Quota")) {
        warnedAt = -1;
        watcher?.(-1);
      }
      return false;
    }
  },

  /**
   * EFFACER UNE CLÉ, ET LE DIRE.
   *
   * Ce magasin n'avait que `get` et `set`. Les six services qui écrivent
   * des documents passent tous par `set`, donc tous sont datés — mais
   * celui qui EFFACE n'avait pas de porte, et appelait
   * `localStorage.removeItem` en direct. Aucune pierre tombale n'était
   * donc posée : le document restait sur le serveur pour toujours.
   *
   * Cela se lit en base. Une collection y montrait vingt-deux vues
   * d'étagère quand son index n'en nommait plus que quatre : dix-huit
   * vues supprimées ici, jamais effacées là-bas, qu'un ordinateur neuf
   * aurait redescendues sans que rien ne les liste.
   *
   * `documentsToSend` savait déjà quoi en faire — une clé en attente et
   * absente du disque part comme tombe. Il ne manquait que de la mettre
   * en attente, et c'est ce que cette ligne fait.
   */
  remove: (k: string): void => {
    try {
      localStorage.removeItem(k);
      void noteIfSyncable(k);
    } catch (e) {
      console.error(e);
    }
  },

  /**
   * The deferred write, for what is large and often retouched.
   *
   * Successive calls on the same key replace each other: ten edits in a
   * row make one write. The caller puts its state on screen as before —
   * only the disk waits.
   */
  setSoon: (k: string, v: unknown): void => {
    pending.set(k, v);
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(flush, DELAY);
  },

  /** What is still waiting to be written — for the tests, and for doubt. */
  pending: (): number => pending.size,
};

/* THE TWO EVENTS THAT MATTER, AND WHY BOTH.

   `pagehide` covers closing and navigating away. `visibilitychange`
   covers the rest — switching tabs, locking the screen, putting the
   phone down — and it is the only one mobile browsers are reliable
   about: a mobile tab can be dropped from memory without `pagehide`
   ever firing.

   `window` can be missing (tests outside the DOM), hence the guard. */
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
