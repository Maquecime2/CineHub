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
let waiting: Run | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
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

async function fire(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const run = waiting;
  waiting = null;
  if (!run) return;
  try {
    await run();
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
export function saveSoon(run: Run): void {
  waiting = run;
  if (fade) {
    clearTimeout(fade);
    fade = null;
  }
  move("pending");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void fire(), DELAY);
}

/** Tout de suite : au flou d'un champ, à la fermeture, avant de partir. */
export const flushSaves = (): Promise<void> => fire();

/* Le navigateur ne prévient pas deux fois. `pagehide` couvre la
   fermeture et la navigation ; le passage en arrière-plan couvre le
   téléphone, qui peut ne jamais rendre la main. */
if (typeof window !== "undefined") {
  addEventListener("pagehide", () => void fire());
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void fire();
  });
}
