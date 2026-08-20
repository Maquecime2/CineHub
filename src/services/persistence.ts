/* ============================================================
   LE REMPART — demander au navigateur de GARDER le classeur
   ============================================================

   Tout le travail de rangement a porté sur l'ENDROIT : la collection est
   passée de `localStorage` à IndexedDB, les affiches y sont des Blobs,
   `collection.ts` a effacé l'ancienne copie derrière lui. Rien de tout
   cela ne répond à la question qui décide : est-ce que le navigateur a
   le droit d'effacer ce qu'on vient d'écrire ?

   PAR DÉFAUT, OUI. Un stockage « best-effort » — c'est le mot de la
   spécification — s'évince sous pression disque, et Safari efface un
   site qu'on n'a pas visité depuis sept jours, `localStorage` ET
   IndexedDB ensemble. Un classeur entier, sans un mot, pendant des
   vacances. Une seule chose s'y oppose : demander la persistance, ce que
   personne n'avait fait.

   ------------------------------------------------------------
   POURQUOI PAS AU CHARGEMENT
   ------------------------------------------------------------

   `persist()` s'accorde sur des SIGNAUX D'ENGAGEMENT — application
   installée, site en favori, temps passé — et une demande faite à la
   première seconde de la première visite est celle qui a le moins de
   chances d'aboutir. Pire, Firefox la présente comme une demande de
   permission : posée sur un écran qu'on n'a pas encore lu, elle se
   refuse d'un réflexe, et un refus ne se redemande pas.

   On demande donc APRÈS un geste qui engage — un import abouti, un
   compte ouvert : à ce moment le navigateur a de quoi dire oui, et la
   personne a de quoi comprendre la question.

   ------------------------------------------------------------
   ON NE DEMANDE QU'UNE FOIS
   ------------------------------------------------------------

   Le drapeau est dans `localStorage` et n'est PAS synchronisable : la
   permission appartient à ce navigateur-ci, la porter sur un autre
   appareil n'aurait aucun sens. Il est écrit en dur plutôt qu'ajouté à
   `KEYS`, pour la même raison que `onboarding` s'en approche — c'est de
   l'état de navigateur, pas du contenu.

   Et si c'est DÉJÀ accordé, on ne demande rien du tout : `persisted()`
   d'abord, `persist()` seulement ensuite. Chrome accorde souvent en
   silence, et repasser par la demande n'ajouterait qu'une invite là où
   il n'y a plus de question.
   ============================================================ */

/** Ce que le navigateur répond, une fois traduit en français du produit. */
export type Vault =
  /** Le classeur est à l'abri de l'éviction automatique. */
  | "kept"
  /** Le navigateur se réserve le droit d'effacer. C'est le défaut. */
  | "fragile"
  /** Trop vieux pour savoir. On ne promet ni ne s'alarme. */
  | "unknown";

const ASKED_KEY = "storage-persistence-asked";

/* Ni `navigator.storage`, ni `persisted`, ni `persist` ne sont partout —
   et l'environnement de test n'a pas de `navigator` du tout. Une seule
   garde, lue par les deux fonctions. */
const manager = (): StorageManager | null => {
  try {
    return typeof navigator !== "undefined" && navigator.storage ? navigator.storage : null;
  } catch {
    return null;
  }
};

/**
 * L'état actuel, sans rien demander ni rien changer.
 *
 * `unknown` plutôt que `fragile` quand le navigateur ne sait pas
 * répondre : afficher « ton classeur peut être effacé » à quelqu'un dont
 * le navigateur n'a simplement pas l'API serait une alarme inventée.
 */
export async function vaultState(): Promise<Vault> {
  const m = manager();
  if (!m?.persisted) return "unknown";
  try {
    return (await m.persisted()) ? "kept" : "fragile";
  } catch {
    return "unknown";
  }
}

/** A-t-on déjà posé la question sur ce navigateur ? */
export const alreadyAsked = (): boolean => {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    /* Navigation privée verrouillée : on considère n'avoir jamais
       demandé. Redemander est sans effet, se taire serait définitif. */
    return false;
  }
};

/** Pour les tests, et pour `startOver` qui remet le navigateur à neuf. */
export const forgetAsking = (): void => {
  try {
    localStorage.removeItem(ASKED_KEY);
  } catch {
    /* rien à oublier */
  }
};

/**
 * Demande la persistance, une fois, après un geste qui engage.
 *
 * Rend l'état APRÈS la demande, pour que l'appelant puisse le dire sans
 * relire. Ne jette jamais : c'est appelé sur le chemin d'un import
 * réussi, et une promesse rompue ici ferait passer une réussite pour un
 * échec.
 *
 * `force` saute le drapeau — c'est le bouton « protéger mon classeur »,
 * où la question vient de la personne et non de nous.
 */
export async function keepTheVault({ force = false } = {}): Promise<Vault> {
  const state = await vaultState();
  /* Déjà accordé, ou pas d'API : il n'y a rien à demander. On ne pose
     pas non plus le drapeau — rien n'a été demandé. */
  if (state !== "fragile") return state;
  if (!force && alreadyAsked()) return state;

  const m = manager();
  if (!m?.persist) return "unknown";

  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* Le drapeau est un confort, pas une condition. */
  }

  try {
    return (await m.persist()) ? "kept" : "fragile";
  } catch {
    return "fragile";
  }
}
