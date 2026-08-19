/* ============================================================
   LA MAIN, OU LA MACHINE
   ============================================================

   Deux cent trois endroits de l'application écrivent en `F.hand`, et le
   reproche fait à la cursive est juste : jolie sur une ligne, elle est
   LENTE À LIRE dans un bloc de texte et dans un sous-titre de neuf
   pixels. Mais elle est aussi ce qui distingue ce classeur d'une
   application ordinaire, et on ne tranche pas cela à l'aveugle.

   D'OÙ UN RÉGLAGE, ET NON UNE DÉCISION. Il tient en une variable :
   `--f-hand` est lue par les deux cent trois endroits, donc la basculer
   les change TOUS sans qu'un seul fichier de vue soit touché. C'est
   exactement ce que la couche de jetons promettait, et la première
   occasion de s'en servir.

   IL VIT À CÔTÉ DE LA PEAU ET NON DEDANS. Une peau choisit sa cursive
   parmi les siennes ; ce réglage-ci dit si l'on veut une cursive DU
   TOUT. Les ranger ensemble aurait obligé à réécrire dix-sept peaux pour
   ajouter un choix qui n'en concerne aucune, et à recommencer à la
   dix-huitième. `skinVars` le consulte, ce qui suffit : changer de peau
   ou changer d'avis repasse par le même endroit.

   IL VOYAGE AVEC ELLE, ET POUR LA MÊME RAISON. Les deux réglages vivent
   dans le MÊME panneau : en faire voyager un et pas l'autre se lirait
   comme une panne, pas comme une distinction. Voir `applySkin` pour
   l'argument entier, la conversion de l'ancienne forme et pourquoi elle
   ne date rien. */

import { store } from "../services/storage";

export const HAND_KEY = "site-hand";

/** `plume` : la cursive de la peau. `plain` : la police de labeur. */
export type Hand = "plume" | "plain";

export const HANDS: Hand[] = ["plume", "plain"];

const isHand = (v: unknown): v is Hand => v === "plume" || v === "plain";

/* La plume est le défaut : c'est ce que le classeur a toujours été, et
   un réglage neuf ne change pas l'aspect de qui ne l'a pas demandé. */
let current: Hand = "plume";

/* CE QUI EST SUR LE DISQUE, sous sa forme neuve ou sous l'ancienne.
   `store` range du JSON — `"plain"` — quand ce module écrivait le mot
   en clair. Lire l'ancienne forme par `store.get` rendrait le défaut, et
   `documentsToSend` enverrait `null` : la main de l'autre appareil
   repasserait à la plume sans que personne l'ait demandé. */
const kept = (): Hand | null => {
  try {
    const raw = localStorage.getItem(HAND_KEY);
    if (!raw) return null;
    try {
      const v = JSON.parse(raw) as unknown;
      return isHand(v) ? v : null;
    } catch {
      /* L'ancienne forme : on la convertit sur place, SANS la dater —
         le rattrapage l'enverra à l'aube, donc en perdant contre ce que
         le serveur tient déjà. */
      if (!isHand(raw)) return null;
      localStorage.setItem(HAND_KEY, JSON.stringify(raw));
      return raw;
    }
  } catch {
    /* Un stockage refusé — navigation privée, réglage du navigateur — ne
       doit pas empêcher l'application de s'afficher. */
    return null;
  }
};

current = kept() ?? "plume";

export const readHand = (): Hand => current;

/* ------------------------------------------------------------
   S'ABONNER, POUR QUE LE SÉLECTEUR SE VOIE CHANGER
   ------------------------------------------------------------
   Le reste de l'application n'a rien à écouter : les variables CSS
   descendent toutes seules. Seul le bouton qui porte le choix a besoin
   de se redessiner, et `useSyncExternalStore` veut un abonnement. */
const listeners = new Set<() => void>();

export const watchHand = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const tell = (): void => {
  for (const fn of listeners) fn();
};

export function setHand(next: Hand): void {
  if (!isHand(next) || next === current) return;
  current = next;
  /* PAR `store`, ET NON PAR `localStorage` EN DIRECT : c'est le seul
     point de passage qui date un document et le met en file. */
  store.set(HAND_KEY, next);
  tell();
}

/**
 * Relire ce que la synchro vient d'écrire.
 *
 * `fileIncomingDocument` écrit par `store.set` et ne prévient personne :
 * le mot en mémoire resterait celui d'avant, et la variable `--f-hand`
 * avec lui, jusqu'au prochain rechargement de la page. `App` appelle
 * ceci quand un tirage a rapporté des documents — même chemin que les
 * étagères et le carnet, qui se relisent au lieu de s'observer.
 */
export function refreshHand(): void {
  const next = kept() ?? "plume";
  if (next === current) return;
  current = next;
  tell();
}
