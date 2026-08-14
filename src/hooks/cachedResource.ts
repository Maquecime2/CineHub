/* ============================================================
   UNE RÉPONSE DU SERVEUR, LUE UNE FOIS POUR TOUT L'ÉCRAN
   ============================================================

   Cette forme existait déjà, écrite trois fois à l'identique — « mes
   listes », la bourse, le catalogue. À chaque fois : un cache de module,
   une promesse en vol pour que deux demandeurs du même instant ne fassent
   qu'une requête, un jeu de guetteurs pour que tout le monde apprenne en
   même temps, et un hook de quatre lignes par-dessus. La quatrième copie
   allait s'écrire ; on écrit le patron à la place.

   IL S'AGIT D'UN CACHE, DONC IL A TORT PARFOIS. Une liste faite sur un
   autre appareil paraît au prochain `refresh()`, pas à la seconde où elle
   naît. C'est le prix, et il est petit — l'autre solution était un mur
   qui martèle.

   ET IL A UNE FENÊTRE DE FRAÎCHEUR, ce que les trois copies n'avaient
   pas. Sans elle, un cache ne se relit JAMAIS de lui-même : c'était
   voulu pour la bourse, dont chaque mouvement passe par un `refresh()`
   explicite. Ça ne l'est pas pour le fil ou les défis, que quelqu'un
   d'autre fait bouger. Les vues du hall, elles, faisaient l'inverse et
   relisaient TOUT à chaque montage — donc à chaque aller-retour
   d'onglet. La fenêtre range les deux excès : on ressert de mémoire dans
   la minute, on redemande après.

   RIEN N'EST DEMANDÉ QUAND `ready` DIT NON, et rien n'est retenu non
   plus : sans serveur ni compte, la question n'a pas de sens, et la
   retenir empêcherait de la reposer le jour où le compte s'ouvre.
   ============================================================ */
import { useEffect, useState } from "react";

/** Par défaut : on ressert de mémoire pendant une minute. */
const FRESH_FOR = 60_000;

export interface CachedResource<T> {
  /** Demande au serveur, sauf si quelqu'un le fait déjà ou si c'est frais. */
  load(): Promise<T>;
  /** Après une écriture : on redemande pour de bon, et tout le monde l'apprend. */
  refresh(): Promise<T>;
  /** Ce qu'on sait déjà, sans aller-retour — pour un premier rendu. */
  known(): T | null;
  /** Y a-t-il quelqu'un à qui demander ? */
  ready(): boolean;
  /** La mémoire a-t-elle passé sa fenêtre de fraîcheur ? */
  stale(): boolean;
  /** S'abonner aux réponses. Rend de quoi se désabonner. */
  subscribe(fn: (v: T | null) => void): () => void;
}

export function cachedResource<T>({
  read,
  onQuiet,
  ready,
  freshFor = FRESH_FOR,
}: {
  read: () => Promise<T>;
  /** Ce qu'on retient quand le serveur refuse ou se tait. */
  onQuiet: T;
  /** Y a-t-il seulement quelqu'un à qui demander ? */
  ready?: () => boolean;
  freshFor?: number;
}): CachedResource<T> {
  let cache: T | null = null;
  /** Quand la réponse en mémoire a été obtenue. Zéro : jamais. */
  let at = 0;
  let inFlight: Promise<T> | null = null;

  const watchers = new Set<(v: T | null) => void>();

  const tell = (v: T | null) => {
    cache = v;
    at = Date.now();
    for (const fn of watchers) fn(v);
  };

  const stale = () => at === 0 || Date.now() - at > freshFor;

  const load = (): Promise<T> => {
    if (inFlight) return inFlight;
    /* Ni demandé ni retenu : voir en tête. */
    if (ready && !ready()) return Promise.resolve(onQuiet);
    if (cache !== null && !stale()) return Promise.resolve(cache);

    inFlight = read()
      .then((v) => {
        tell(v);
        return v;
      })
      /* UN SERVEUR QUI REFUSE NE DOIT PAS FAIRE PARLER LE CLASSEUR : la
         fonction ne paraît pas, et le reste continue. */
      .catch(() => {
        tell(onQuiet);
        return onQuiet;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  const refresh = (): Promise<T> => {
    inFlight = null;
    at = 0;
    return load();
  };

  return {
    load,
    refresh,
    known: () => cache,
    ready: () => !ready || ready(),
    stale,
    subscribe: (fn) => {
      watchers.add(fn);
      return () => void watchers.delete(fn);
    },
  };
}

/**
 * Lire une ressource dans un composant.
 *
 * Hors de la fabrique, et non pas méthode de l'objet qu'elle rend : un
 * hook se reconnaît à son nom, et c'est à cette reconnaissance que
 * tiennent les règles qui l'empêchent d'être appelé de travers.
 */
export function useCached<T>(res: CachedResource<T>, active = true): T | null {
  const [value, setValue] = useState<T | null>(res.known());

  useEffect(() => {
    if (!active || !res.ready()) return;
    const stop = res.subscribe(setValue);
    /* Déjà lu et encore frais : on ne redemande pas à chaque montage —
       c'est tout l'intérêt de le tenir hors du composant. */
    const known = res.known();
    if (known !== null) setValue(known);
    if (known === null || res.stale()) void res.load();
    return stop;
  }, [res, active]);

  return value;
}
