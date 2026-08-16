/* ============================================================
   CE QUI S'ENREGISTRE, ET QUI LE DIT
   ============================================================

   RIEN N'ÉTAIT PERDU, ET RIEN NE LE DISAIT — c'est tout le problème
   qu'on répare. Chaque frappe d'une critique écrivait la collection
   entière sur le disque, immédiatement, sans un mot ; et le seul retour
   visible du produit était « 1 fiche attend le réseau », dans le tiroir
   du compte, qui parle du MIROIR SERVEUR et pas de l'enregistrement. On
   lisait donc « pas sauvegardé » là où il fallait lire « pas encore
   recopié ailleurs ».

   DEUX CHOSES SÉPARÉES, ET ELLES LE RESTENT :

   1. L'ÉCRITURE LOCALE, qui est la vérité de ce classeur. Elle passait
      à chaque touche ; elle passe maintenant un peu après la dernière —
      le temps de finir un mot. Le coffre écrit six cents fiches à
      chaque fois, et le faire trente fois par phrase était du travail
      pour rien.

   2. LE MIROIR SERVEUR, qui reste une passe périodique (`useSync`).

   ------------------------------------------------------------
   POURQUOI PAS `store.setSoon`, QUI EXISTE DÉJÀ

   Il diffère l'écriture d'UNE CLÉ dans le magasin, et il est débranché
   depuis que la collection est descendue dans le coffre : la commenter
   là-bas dit qu'il faudrait grouper l'écriture DU COFFRE, ce que le
   magasin ne voit pas. C'est exactement ce que fait ce module — il
   diffère le GESTE, pas la clé, donc il marche aussi bien pour la
   collection, pour le carnet et pour une vue d'étagère.

   ------------------------------------------------------------
   CE QUI GARANTIT QU'ON NE PERD RIEN

   UN SEUL GESTE EN ATTENTE À LA FOIS, et c'est le dernier : ils portent
   tous l'état complet, pas un delta. Garder le précédent reviendrait à
   réécrire un texte plus vieux par-dessus le neuf.

   ET IL PART AVANT QUE LA PAGE NE FERME. `pagehide` et le passage en
   arrière-plan le vident — c'est la même précaution que `storage.flush`,
   et sur téléphone c'est la seule qui compte : un onglet qu'on quitte ne
   reçoit pas d'autre avertissement.
   ============================================================ */

/**
 * Le temps qu'on laisse à une frappe avant d'écrire.
 *
 * Un tiers de seconde : plus court, on réécrit à chaque mot ; plus long,
 * la mention « enregistré » arrive après qu'on a détourné les yeux, et
 * elle ne rassure plus personne.
 */
const DELAY = 350;

/** Combien de temps « enregistré » reste lisible avant de s'effacer. */
const SAID_MS = 1800;

export type SaveState = "clean" | "pending" | "saved";

type Run = () => Promise<unknown> | void;

let state: SaveState = "clean";
/** Ce qui attend, par clé. Une clé = une chose qu'on réécrit en entier. */
const waiting = new Map<string, { run: Run; timer: ReturnType<typeof setTimeout> }>();
let fade: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

/* QUI VEUT SAVOIR QU'ON VIENT D'ÉCRIRE. La synchro s'en sert pour
   partir peu après la dernière frappe au lieu d'attendre sa passe de
   cinq minutes — c'est ce qui fait que « en attente » a disparu de
   l'écran avant qu'on pense à aller le lire. */
const afterWrite = new Set<() => void>();

export const onWritten = (fn: () => void): (() => void) => {
  afterWrite.add(fn);
  return () => afterWrite.delete(fn);
};

const move = (next: SaveState) => {
  if (state === next) return;
  state = next;
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (e) {
      console.error("[cinehub] un abonné de l'enregistrement a levé", e);
    }
  }
};

export const saveState = (): SaveState => state;

export const watchSaving = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

async function fire(only?: string): Promise<void> {
  const keys = only === undefined ? [...waiting.keys()] : waiting.has(only) ? [only] : [];
  if (keys.length === 0) return;

  const runs: Run[] = [];
  for (const key of keys) {
    const held = waiting.get(key);
    if (!held) continue;
    clearTimeout(held.timer);
    waiting.delete(key);
    runs.push(held.run);
  }

  try {
    for (const run of runs) await run();
  } finally {
    /* « ENREGISTRÉ » MÊME SI L'ÉCRITURE A LEVÉ, et c'est délibéré : le
       magasin retombe déjà sur `localStorage` quand le coffre refuse, et
       il a sa propre façon de le dire. Annoncer un échec ici ferait deux
       messages pour un incident, dont un que cette couche ne sait pas
       expliquer. */
    move("saved");
    if (fade) clearTimeout(fade);
    fade = setTimeout(() => move("clean"), SAID_MS);
    for (const fn of [...afterWrite]) {
      try {
        fn();
      } catch (e) {
        console.error("[cinehub] un abonné de l'après-écriture a levé", e);
      }
    }
  }
}

/**
 * Écrire, mais pas tout de suite.
 *
 * Le geste remplace celui qui attendait : ils portent l'état complet, et
 * garder le précédent réécrirait un texte plus vieux par-dessus le neuf.
 */
export function saveSoon(key: string, run: Run): void {
  const held = waiting.get(key);
  if (held) clearTimeout(held.timer);
  if (fade) {
    clearTimeout(fade);
    fade = null;
  }
  move("pending");
  waiting.set(key, { run, timer: setTimeout(() => void fire(key), DELAY) });
}

/**
 * Renoncer à ce qui attendait sur cette clé.
 *
 * Appelé par une écriture IMMÉDIATE de la même chose : elle est plus
 * récente, elle porte l'état complet, et laisser partir l'ancienne
 * reviendrait à écraser le neuf par du vieux trois cents millisecondes
 * plus tard. C'est ce qui faisait disparaître une capture insérée dans
 * une critique.
 */
export function dropSoon(key: string): void {
  const held = waiting.get(key);
  if (!held) return;
  clearTimeout(held.timer);
  waiting.delete(key);
  if (waiting.size === 0) move("clean");
}

/** Tout de suite : au flou d'un champ, à la fermeture, avant de partir. */
export const flushSaves = (key?: string): Promise<void> => fire(key);

/* Le navigateur ne prévient pas deux fois. `pagehide` couvre la
   fermeture et la navigation ; le passage en arrière-plan couvre le
   téléphone, qui peut ne jamais rendre la main. */
if (typeof window !== "undefined") {
  addEventListener("pagehide", () => void fire());
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void fire();
  });
}
