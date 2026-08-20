/* ============================================================
   LOCAL PERSISTENCE — replaces the artifact runtime's window.storage.
   ============================================================ */
/** The storage keys, gathered so that none gets lost on the way. */
export const KEYS = {
  films: "films",
  notes: "notebook-notes",
  dividers: "shelf-dividers",
  onboarding: "onboarding",
  tmdbKey: "tmdb-key",
} as const;

/* ============================================================
   CE QUI VIT AU COFFRE, ET CE QUI RESTE EN VITRINE
   ============================================================

   La collection est descendue dans IndexedDB il y a longtemps
   (`services/collection`). Restaient en `localStorage` deux choses qui
   peuvent grossir sans limite : les pages du carnet, et l'agencement des
   murs — un document par vue, sous le préfixe `shelf-view:`.

   ELLES DESCENDENT ICI, ET NON CHEZ LEURS SIX APPELANTS. Le carnet,
   l'étagère, les fils, le vocabulaire et les décors passent tous par ce
   magasin ; c'est le seul point de passage obligé, donc le seul endroit
   où l'on ne peut pas oublier une clé. Le prix est une contrainte, et
   elle est réelle : IndexedDB est ASYNCHRONE là où `localStorage` ne
   l'est pas.

   D'OÙ LE MIROIR. On monte les clés coffrées en mémoire une fois, au
   démarrage (`hydrateVault`), et les lectures restent SYNCHRONES pour
   tout le monde. Les écritures touchent le miroir tout de suite et le
   coffre juste après, sans qu'on attende — c'est déjà la règle du
   projet pour ce qui n'est jamais sur le chemin d'un geste.

   CE QUI RESTE EN VITRINE Y RESTE. `onboarding`, la clé TMDB, la peau,
   la main, les marqueurs de synchro : petits, et lus avant même que le
   coffre soit ouvert. Un réglage local dans un magasin synchrone est le
   bon choix, pas une dette.

   VITRINE NE VEUT PAS DIRE « NE VOYAGE PAS », et ce paragraphe l'a
   laissé croire. La peau et la main sont en vitrine parce qu'elles se
   lisent AVANT la base — c'est une question de moment, pas de portée —
   et elles se synchronisent depuis (`documents.ts`). Ce sont deux
   questions différentes : où c'est écrit, et jusqu'où ça va.

   LE REPLI EST CONSERVÉ. Un autre onglet qui tient un verrou de version
   empêche d'ouvrir la base ; `hydrateVault` échoue alors sans bruit et
   tout retombe sur `localStorage`, exactement comme `collection.ts` sait
   déjà le faire. Un classeur en mode dégradé vaut mieux qu'un classeur
   qui ne s'ouvre pas.
   ============================================================ */

const VAULTED_KEYS = ["notebook-notes", "shelf-views"];
const VAULTED_PREFIXES = ["shelf-view:"];

/** Cette clé a-t-elle sa place au coffre ? */
export const isVaulted = (key: string): boolean =>
  VAULTED_KEYS.includes(key) || VAULTED_PREFIXES.some((p) => key.startsWith(p));

/* LE COFFRE S'IMPORTE À LA DEMANDE, ET CE N'EST PAS UN DÉTAIL.

   `db` importe `customDecor`, qui importe `server`, qui lit ce magasin
   au chargement de son module. Un import statique d'en haut refermait
   donc la boucle, et `store` était `undefined` au moment où `server`
   s'en servait — quatorze fichiers de tests sont tombés d'un coup sur un
   « Cannot read properties of undefined ». C'est exactement la raison
   pour laquelle `noteIfSyncable`, juste au-dessus, importe `documents`
   de la même façon. */
const vault = () => import("../db");

/* ON LANCE ET ON OUBLIE, DONC ON NE JETTE JAMAIS.

   Ce chemin n'est pas sur celui d'un geste : l'écran a déjà la valeur,
   le coffre la reçoit après. Une promesse rompue ici ne remonte nulle
   part et devient un « unhandled rejection » — ce qui est arrivé, parce
   que six fichiers de tests remplacent `db` par un objet partiel où
   `deleteDoc` n'existe pas. L'appel optionnel vaut mieux que six mocks
   à rallonger, et il dit la bonne chose : le rangement au coffre est
   un bonus, jamais une condition. */
const intoVault = (fn: "putDoc" | "deleteDoc", key: string, value?: unknown): void => {
  void vault()
    .then((db) => db[fn]?.(key, value))
    .catch(console.error);
};

/* Le miroir. `undefined` comme valeur veut dire « pas là » — on distingue
   l'absence du `null` stocké, parce que `documentsToSend` lit cette
   différence comme « effacé » et en fait une pierre tombale. */
const mirror = new Map<string, unknown>();
let vaultOpen = false;

/** Le coffre a-t-il répondu ? Faux tant qu'on n'a pas hydraté, ou en repli. */
export const vaultReady = (): boolean => vaultOpen;

/* Une seule hydratation, même si deux appelants la demandent. */
let hydration: Promise<void> | null = null;

/**
 * Monte les documents coffrés en mémoire, et fait descendre au coffre
 * ceux qui traînaient encore en vitrine.
 *
 * À APPELER AVANT LA PREMIÈRE LECTURE, et `App` s'en charge au même
 * endroit qu'il charge la collection. Une lecture antérieure ne casse
 * rien — elle retombe sur `localStorage`, où la valeur est encore tant
 * que la migration n'a pas eu lieu.
 */
export function hydrateVault(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    let putDoc: (k: string, v: unknown) => Promise<unknown>;
    try {
      const db = await vault();
      putDoc = db.putDoc;
      const keys = (await db.allDocKeys()) as string[];
      for (const key of keys) {
        if (!isVaulted(key)) continue;
        mirror.set(key, await db.getDoc(key));
      }
      vaultOpen = true;
    } catch {
      /* Base verrouillée par un autre onglet, navigation privée
         restrictive : on reste en vitrine, et rien ne se voit. */
      vaultOpen = false;
      return;
    }

    /* LA MIGRATION, ET SON EFFACEMENT — dans cet ordre, et jamais
       l'inverse. On écrit au coffre, on relit ce qui vient d'être
       écrit, et seulement alors on retire la copie de `localStorage`.
       Effacer d'abord perdrait la valeur si l'écriture échouait. */
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key || !isVaulted(key)) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      /* Le coffre gagne : s'il tient déjà cette clé, la copie en vitrine
         est un reste de la migration précédente, pas une valeur neuve. */
      if (!mirror.has(key)) {
        let value: unknown;
        try {
          value = JSON.parse(raw);
        } catch {
          continue;
        }
        try {
          await putDoc(key, value);
        } catch {
          continue;
        }
        mirror.set(key, value);
      }
      try {
        localStorage.removeItem(key);
      } catch {
        /* rien à faire, la valeur est au coffre de toute façon */
      }
    }
  })();
  return hydration;
}

/** Pour les tests : on repart d'un coffre fermé et d'un miroir vide. */
export function forgetVault(): void {
  mirror.clear();
  vaultOpen = false;
  hydration = null;
}

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
    /* LE MIROIR D'ABORD, ET SEULEMENT S'IL TIENT LA CLÉ. Hydraté ou non,
       une clé coffrée absente du miroir peut encore être en vitrine —
       c'est le cas pendant la toute première ouverture, avant migration,
       et c'est le cas pour toujours en repli. On retombe donc, au lieu
       de rendre le défaut. */
    if (isVaulted(k) && mirror.has(k)) {
      /* SEUL `undefined` VAUT ABSENCE. Un `null` rangé est une valeur, et
         `localStorage` la rendait telle quelle — la traiter comme un
         défaut ferait diverger les deux chemins sur la seule clé qui
         voyage jusqu'au serveur. */
      const v = mirror.get(k);
      return (v === undefined ? fallback : v) as T;
    }
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Cette clé existe-t-elle, quelque part ?
   *
   * SA RAISON D'ÊTRE EST UNE PIERRE TOMBALE. `documentsToSend` lisait
   * `localStorage.getItem` et traitait `null` comme « effacé » ; le jour
   * où un document est descendu au coffre, cette lecture aurait renvoyé
   * `null` pour un document bien vivant, et la synchro l'aurait EFFACÉ
   * sur les autres appareils. La question « est-elle là ? » doit donc
   * savoir regarder aux deux endroits.
   */
  has: (k: string): boolean => {
    if (isVaulted(k) && mirror.has(k)) return mirror.get(k) !== undefined;
    try {
      return localStorage.getItem(k) !== null;
    } catch {
      return false;
    }
  },

  /**
   * Toutes les clés connues, coffre et vitrine réunis.
   *
   * `sendAllDocuments` et `catchUpDocuments` parcouraient `localStorage`
   * par index pour découvrir ce qui se synchronise. Un document au
   * coffre leur serait resté invisible : jamais rattrapé, jamais envoyé.
   */
  keys: (): string[] => {
    const all = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k) all.add(k);
      }
    } catch {
      /* navigation privée verrouillée : le coffre suffira */
    }
    for (const [k, v] of mirror) if (v !== undefined) all.add(k);
    return [...all];
  },

  /* The immediate write. It stays the default path: most keys are tiny
     and written once in a while. */
  set: (k: string, v: unknown): boolean => {
    try {
      /* AU COFFRE, SI LA CLÉ Y A SA PLACE ET QU'IL A OUVERT.

         Le miroir prend la valeur TOUT DE SUITE — l'écran ne doit pas
         attendre une transaction — et le coffre la reçoit après, sans
         qu'on attende non plus. La datation, elle, part dans les deux
         cas : c'est elle qui fait voyager le document, et elle ne
         dépend pas de l'endroit où il dort.

         En repli (coffre fermé), on retombe en vitrine sans rien dire,
         et la migration se fera à la prochaine ouverture réussie. */
      if (isVaulted(k) && vaultOpen) {
        mirror.set(k, v);
        intoVault("putDoc", k, JSON.parse(JSON.stringify(v)));
        void noteIfSyncable(k);
        return true;
      }

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
      /* LES DEUX ENDROITS, TOUJOURS. Une clé coffrée peut avoir laissé
         une copie en vitrine — le temps d'une migration interrompue, ou
         d'un repli — et n'effacer qu'un des deux la ferait revenir
         d'entre les morts au prochain chargement. */
      if (isVaulted(k)) {
        mirror.delete(k);
        intoVault("deleteDoc", k);
      }
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
