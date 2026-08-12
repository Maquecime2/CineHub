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
   haute (voir `NoKey`).
   ============================================================ */
import { useSyncExternalStore } from "react";
import { KEYS, store } from "./storage";
import { compteOuvert, suivreLeCompte } from "./serveur";

/* La valeur vit en mémoire autant que sur le disque : `useSyncExternalStore`
   veut un instantané STABLE, et relire le localStorage à chaque appel
   rendrait une chaîne neuve à chaque rendu — donc une boucle. */
let courante: string = store.get<string>(KEYS.tmdbKey, "");

type Écoute = () => void;
const écoutes = new Set<Écoute>();

const subscribe = (fn: Écoute): (() => void) => {
  écoutes.add(fn);
  /* On écoute AUSSI l'ouverture et la fermeture d'un compte : depuis
     que le serveur relaie TMDB, se connecter suffit à donner de quoi
     l'interroger, et les huit écrans doivent s'en apercevoir sans
     recharger — exactement comme ils s'aperçoivent d'une clé posée. */
  const oublier = suivreLeCompte(fn);
  return () => {
    écoutes.delete(fn);
    oublier();
  };
};

/* ============================================================
   UN COMPTE VAUT UNE CLÉ
   ============================================================

   Le serveur relaie onze chemins de TMDB, garde SA clé, et n'accepte
   que les gens connectés. Quelqu'un de connecté n'a donc besoin
   d'aucune clé : les Découvertes, le sillage, les affiches et le
   remplissage marchent sans qu'on ait rien à demander à personne.

   Plutôt que d'apprendre à huit écrans qu'il existe désormais deux
   façons d'avoir le droit d'interroger TMDB, on répond à la seule
   question qu'ils posent — « avec quoi j'appelle ? » — et l'on rend un
   jeton qui dit « par le serveur ». `src/tmdb.js` le reconnaît et
   n'envoie rien de plus ; personne d'autre n'a à le connaître.

   Ce n'est PAS un secret et ne doit jamais s'afficher : les deux écrans
   qui montrent ou modifient la clé écrite (le tiroir de réglage,
   l'onglet Import) passent par `cleEcrite`. */
export const PAR_LE_SERVEUR = "par-le-serveur";

/** La clé réellement saisie — pour l'afficher et pour la corriger. */
export const cleEcrite = (): string => courante;

/**
 * De quoi interroger TMDB, hors composant : la clé posée, ou le jeton
 * du relais quand un compte est ouvert. Vide si l'on n'a ni l'un ni
 * l'autre.
 */
export const getTmdbKey = (): string =>
  courante.trim() ? courante : compteOuvert() ? PAR_LE_SERVEUR : "";

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
 * De quoi interroger TMDB, dans un composant. Rerend quand la clé
 * change — le tiroir de réglage, l'onglet Import, une autre vue — et
 * quand un compte s'ouvre ou se ferme.
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
