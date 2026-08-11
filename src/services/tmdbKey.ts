/* ============================================================
   LA CLÉ TMDB — un seul endroit où elle se lit, un seul où elle s'écrit

   Elle ne se posait que dans l'onglet Import, et HUIT écrans la
   lisaient : les Découvertes, le tiroir du soir, le Générique, la fiche,
   le choix d'affiche, l'identité d'un film, les faits TMDB, le
   remplissage. Chacun faisait son `store.get("tmdb-key", "")` dans son
   coin, au montage, une fois — de sorte que poser la clé dans Import ne
   réveillait rien : il fallait recharger la page pour que les autres
   vues s'en aperçoivent, et personne ne le devinait.

   Pire, celui qui n'avait pas de clé se taisait. Une vue vide ne dit pas
   « il manque un réglage », elle dit « il n'y a rien » — et la seule
   chose à faire est alors de fermer l'onglet.

   Ce module tient donc la clé en UN point, prévient tout le monde quand
   elle change, et donne à chaque vue de quoi dire son manque à voix
   haute (voir `SansCle`).
   ============================================================ */
import { useSyncExternalStore } from "react";
import { KEYS, store } from "./storage";

/* La valeur vit en mémoire autant que sur le disque : `useSyncExternalStore`
   veut un instantané STABLE, et relire le localStorage à chaque appel
   rendrait une chaîne neuve à chaque rendu — donc une boucle. */
let courante: string = store.get<string>(KEYS.tmdbKey, "");

type Écoute = () => void;
const écoutes = new Set<Écoute>();

const subscribe = (fn: Écoute): (() => void) => {
  écoutes.add(fn);
  return () => {
    écoutes.delete(fn);
  };
};

/**
 * La clé, hors composant — pour le code qui n'est pas un rendu (récoltes,
 * services, fonctions d'enrichissement).
 */
export const getTmdbKey = (): string => courante;

/** Y a-t-il de quoi parler à TMDB ? */
export const hasTmdbKey = (): boolean => courante.trim().length > 0;

/**
 * Poser (ou effacer) la clé. Écrit sur le disque ET réveille les écrans
 * ouverts : c'est tout l'objet du module.
 */
export function setTmdbKey(key: string): void {
  const next = (key || "").trim();
  if (next === courante) return;
  courante = next;
  store.set(KEYS.tmdbKey, next);
  for (const fn of écoutes) fn();
}

/**
 * La clé dans un composant. Rerend quand elle change, où qu'elle ait été
 * changée — le tiroir de réglage, l'onglet Import, une autre vue.
 */
export function useTmdbKey(): string {
  return useSyncExternalStore(subscribe, getTmdbKey, getTmdbKey);
}

/* ------------------------------------------------------------
   OUVRIR LE RÉGLAGE, DEPUIS N'IMPORTE OÙ

   Huit écrans doivent pouvoir dire « la régler ici » et que ça marche.
   Leur faire descendre un `onOuvrirReglage` depuis `App` traverserait
   des composants qui n'ont rien à voir avec TMDB — la fiche, le carton,
   la pellicule — juste pour transporter un rappel.

   Le tiroir s'inscrit donc lui-même, et le cartouche l'appelle. Un seul
   inscrit à la fois : c'est un tiroir, pas un abonnement.
   ------------------------------------------------------------ */
let ouvreur: (() => void) | null = null;

/** Monté par `App` avec le tiroir de réglage ; rend de quoi se désinscrire. */
export function inscrireOuvreurTmdb(fn: () => void): () => void {
  ouvreur = fn;
  return () => {
    if (ouvreur === fn) ouvreur = null;
  };
}

/** Ouvre le tiroir de réglage de la clé, si quelqu'un sait le faire. */
export const ouvrirReglageTmdb = (): void => ouvreur?.();
