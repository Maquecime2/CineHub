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

const ADVICE =
  "Les affiches importées depuis votre disque sont les plus lourdes : préférez une adresse d'image (clic droit → copier l'adresse de l'image) ou l'enrichissement TMDB, qui ne stockent qu'un lien.";

/* Once per session, and not one more. A warning that repeats on every
   keystroke is a warning you learn to click through without reading. */
let warned = false;

const warnIfLarge = (size: number): void => {
  if (warned || size < WARN_THRESHOLD) return;
  warned = true;
  alert(
    `L'espace de stockage se remplit (${Math.round(size / 100_000) / 10} Mo sur environ 5).\n\n${ADVICE}\n\nPensez à exporter une sauvegarde depuis l'onglet Import.`
  );
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
      if (String((e as Error)?.name || "").includes("Quota")) {
        alert(`Espace de stockage plein.\n\n${ADVICE}`);
      }
      return false;
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
