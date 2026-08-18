/* ============================================================
   LA VEILLE LETTERBOXD, SUR LE DISQUE
   ============================================================

   Reprendre ses séances était un GESTE : ouvrir l'import, taper son
   pseudo, cliquer, relire un bordereau. C'est la bonne porte pour AMORCER
   un classeur, et une corvée pour les six films vus depuis la dernière
   fois — `services/letterboxd.ts` le dit déjà dans son propre en-tête.
   Ce document est ce qu'il faut retenir pour que l'application aille
   regarder toute seule.

   IL EST SYNCABLE, ET CE N'EST PAS POUR LE PSEUDO. Un pseudonyme se
   retape en dix secondes. Ce qui devait absolument voyager est
   `dismissed` : la liste de ce qu'on a REFUSÉ. Sans elle, le second
   appareil repropose exactement les mêmes films, à chaque passe, pour
   toujours — et une proposition qu'on a déjà écartée deux fois cesse
   d'être une proposition pour devenir un reproche.

   D'où la montée de `SYNCABLE_VERSION` qui l'accompagne
   (`services/documents.ts`) : sans elle, `catchUpDocuments` ne rejoue pas
   le rattrapage et les classeurs déjà connectés n'enverraient JAMAIS ce
   document.
   ============================================================ */
import { store } from "./storage";
import { USER_KEY } from "./letterboxd";

export const WATCH_KEY = "letterboxd";

/* CE QU'ON REFUSE NE GRANDIT PAS SANS FIN. `dismissed` ne fait
   qu'augmenter et il voyage à chaque synchronisation : borné, il reste
   quelques kilo-octets ; non borné, il devient le plus gros document du
   classeur chez quelqu'un qui refuse tout depuis deux ans. Cinq cents
   est très au-delà de ce que le flux peut proposer (une centaine
   d'entrées, dont la moitié sont des listes), donc rien d'utile ne tombe
   par le bout. */
const DISMISSED_MAX = 500;

export interface LetterboxdWatch {
  /** Le pseudonyme, sans le `@`. Vide : il n'y a rien à relever. */
  handle: string;
  /** La veille se coupe, et se coupe pour tous les appareils à la fois. */
  on: boolean;
  /** La dernière lecture RÉUSSIE du flux. Un échec ne la bouge pas. */
  feedAt: number;
  /** La dernière lecture réussie de la watchlist. Voir `useLetterboxd`. */
  watchlistAt: number;
  /** Les `filmKey` qu'on a écartés, et qu'on ne repropose plus. */
  dismissed: string[];
}

/* UN DOCUMENT VENU D'AILLEURS N'EST PAS UN DOCUMENT DE CONFIANCE. Il
   arrive du serveur, donc d'une version de l'application qu'on ne
   connaît pas — plus vieille, plus neuve, ou écrite à moitié par une
   synchro coupée. On ne lit donc que ce qu'on sait lire, et on rend une
   forme complète : le reste du fichier peut alors ignorer que le
   document puisse être bancal. */
export function normalizeWatch(raw: unknown): LetterboxdWatch {
  const d = (raw ?? {}) as Partial<LetterboxdWatch>;
  const dismissed = Array.isArray(d.dismissed)
    ? [...new Set(d.dismissed.filter((k): k is string => typeof k === "string" && !!k))]
    : [];
  return {
    handle: typeof d.handle === "string" ? d.handle.trim().replace(/^@/, "") : "",
    on: d.on === true,
    feedAt: Number.isFinite(d.feedAt) ? Number(d.feedAt) : 0,
    watchlistAt: Number.isFinite(d.watchlistAt) ? Number(d.watchlistAt) : 0,
    /* Les plus RÉCENTS sont en queue — c'est l'ordre dans lequel
       `dismiss` empile — donc c'est le début qu'on coupe. */
    dismissed: dismissed.slice(-DISMISSED_MAX),
  };
}

/**
 * Ce qu'on sait de la veille.
 *
 * LE PSEUDO DÉJÀ TAPÉ EST REPRIS. `letterboxd-user` existe depuis
 * l'import manuel et vit sur cet appareil : le laisser de côté aurait
 * demandé de retaper un pseudonyme qu'on a sous les yeux dans l'écran
 * d'import. La veille, elle, reste ÉTEINTE — hériter d'un réglage, oui ;
 * allumer une tâche de fond que personne n'a demandée, non.
 */
export function loadWatch(): LetterboxdWatch {
  const kept = normalizeWatch(store.get<unknown>(WATCH_KEY, null));
  if (kept.handle) return kept;
  const local = store.get<string>(USER_KEY, "").trim().replace(/^@/, "");
  return local ? { ...kept, handle: local } : kept;
}

/* QUI VEUT SAVOIR QUE LE RÉGLAGE A CHANGÉ.

   PIERRE TOMBALE. `useLetterboxd` ne s'abonnait à rien : sa boucle ne
   dépend que de `ready`, et `run` est stable. Donc cocher « relever ce
   compte automatiquement » ne déclenchait RIEN — il fallait attendre le
   quart d'heure suivant, ou changer d'onglet et revenir. On cochait, on
   regardait le rail, il ne s'y passait rien, et la seule conclusion
   possible était que la fonctionnalité ne marchait pas.

   Copie de `onWritten` (`services/saving`), qui existe pour la raison
   exacte : avancer une passe au lieu d'attendre la sienne. */
const listeners = new Set<() => void>();

export const onWatchChanged = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Écrit la veille. `store.set` date le document et le met en file tout seul. */
export function saveWatch(watch: LetterboxdWatch): void {
  store.set(WATCH_KEY, normalizeWatch(watch));
  for (const fn of listeners) fn();
}

/** Modifie la veille sans avoir à la relire d'abord. */
export function patchWatch(patch: Partial<LetterboxdWatch>): LetterboxdWatch {
  const next = normalizeWatch({ ...loadWatch(), ...patch });
  saveWatch(next);
  return next;
}

/**
 * Écarte des propositions, pour de bon et sur tous les appareils.
 *
 * On empile en QUEUE et on ne dédoublonne qu'à la lecture : refuser deux
 * fois le même film est parfaitement ordinaire — la proposition revient
 * tant qu'elle n'a pas été écartée sur CET appareil-là — et devoir s'en
 * souvenir ici obligerait chaque appelant à connaître l'état.
 */
export function dismiss(keys: string[]): LetterboxdWatch {
  if (!keys.length) return loadWatch();
  const current = loadWatch();
  return patchWatch({ dismissed: [...current.dismissed, ...keys] });
}
