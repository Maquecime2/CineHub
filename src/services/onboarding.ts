/* ============================================================
   THE TOUR ALREADY TAKEN — what the binder remembers of the welcome

   Three things only: the tours carried through to the end, the fact of
   having waved one away, and the number of reminders already laid down.
   This is BROWSER state, not collection data: it does not go into the
   backup, and clearing site data plays the welcome again — which is
   exactly what we want for testing.

   ITS `semé` FIELD IS STORED. It became `seeded` when this module moved
   to English; `loadOnboarding` is the only door it comes in through, and
   it reads both spellings. Without that, the twelve demo films would be
   sown again into a collection somebody has already made their own.
   ============================================================ */
import { KEYS, store } from "./storage";

/** Past three reminders we stop insisting: that is a refusal, not an oversight. */
export const HINT_MAX = 3;

export interface OnboardingState {
  /** Ids of the tours finished: "global", "library", "detail"… */
  done: string[];
  /** The user waved a tour away at least once. */
  skipped: boolean;
  /** Number of index cards already shown. */
  hints: number;
  /**
   * The demonstration binder has been sown once.
   *
   * ALONGSIDE `isFirstRun` AND NEVER INSTEAD OF IT. A first opening is
   * recognised by "nothing done, nothing skipped" — that is to say by a
   * state that falls back to false as soon as the tour has been played
   * or waved away, but that becomes true again for anyone who has never
   * done either. Relying on it alone would bring the twelve example
   * films back the day after somebody emptied their collection by hand —
   * that is, at the worst possible moment.
   *
   * This flag never falls back, except through `resetOnboarding`.
   */
  seeded: boolean;
}

/** The shape stored before this module was translated. */
type StoredState = Partial<OnboardingState> & { semé?: unknown };

const EMPTY: OnboardingState = { done: [], skipped: false, hints: 0, seeded: false };

/* The fallback is not only the absence of a key: a value written by an
   earlier version can be missing a field, and a tour that crashes on
   opening is worse than no tour at all. */
export function loadOnboarding(): OnboardingState {
  const raw = store.get<StoredState>(KEYS.onboarding, EMPTY);
  return {
    done: Array.isArray(raw?.done) ? raw.done.filter((d) => typeof d === "string") : [],
    skipped: raw?.skipped === true,
    hints: typeof raw?.hints === "number" && raw.hints >= 0 ? raw.hints : 0,
    /* Same defensive fallback as `skipped`, and for the same reason: a
       value written by an earlier version does not carry this field, and
       the absence must read "not sown yet". */
    seeded: raw?.seeded === true || raw?.semé === true,
  };
}

function save(next: OnboardingState): OnboardingState {
  store.set(KEYS.onboarding, next);
  return next;
}

/** A tour carried through to the end. Finishing erases the need for a reminder. */
export function markDone(id: string): OnboardingState {
  const s = loadOnboarding();
  return save({
    ...s,
    done: s.done.includes(id) ? s.done : [...s.done, id],
  });
}

/** A tour waved away along the way: that is what triggers the reminder. */
export function markSkipped(): OnboardingState {
  return save({ ...loadOnboarding(), skipped: true });
}

/** One more reminder laid down — we count so as to know when to keep quiet. */
export function bumpHint(): OnboardingState {
  const s = loadOnboarding();
  return save({ ...s, hints: s.hints + 1 });
}

/** The example binder has been sown: we will never sow it again. */
export function markSeeded(): OnboardingState {
  return save({ ...loadOnboarding(), seeded: true });
}

/** Is the demonstration binder still to be sown? */
export function shouldSeed(s: OnboardingState = loadOnboarding()): boolean {
  return !s.seeded;
}

/** Forget everything: the welcome will play again on the next opening. */
export function resetOnboarding(): OnboardingState {
  return save({ ...EMPTY });
}

/**
 * UN CLASSEUR VIDÉ EXPRÈS N'EST PAS UN CLASSEUR NEUF.
 *
 * Le commentaire en tête de ce module dit qu'effacer les données du site
 * rejoue l'accueil, et que c'est ce qu'on veut — c'est vrai quand on
 * vide le stockage depuis le navigateur, où il n'y a aucune intention à
 * lire. Ce n'en est plus une quand quelqu'un vient de cliquer « tout
 * effacer » : il a demandé un classeur VIDE, pas une première visite. Et
 * comme le bouton efface tout le stockage, il emporte au passage la
 * marque qui disait « déjà ouvert ».
 *
 * Résultat, et c'est ce qui s'est passé : douze fiches de démonstration
 * étaient semées dans le classeur qu'on venait de vider, puis la synchro
 * les poussait sur le serveur qu'on venait de vider aussi. On effaçait
 * tout et on se retrouvait avec des films.
 *
 * D'où cet état, écrit APRÈS l'effacement : rien n'est semé, la visite
 * ne se relance pas, et le carton de rappel non plus — quelqu'un qui
 * sait effacer son classeur sait où est la visite.
 */
export function markStartedOver(): OnboardingState {
  return save({ done: [], skipped: true, hints: HINT_MAX, seeded: true });
}

/**
 * Faut-il poser le carton qui dit où trouver la visite ?
 *
 * LA CONDITION « APRÈS UN REFUS » A SAUTÉ, et c'est le changement de
 * produit, pas un assouplissement. La visite s'ouvrait d'elle-même à la
 * première seconde de la première visite : un voile opaque sur un mur
 * qu'on n'a pas encore regardé, avant même d'avoir pu toucher une
 * fiche. On MANIPULE d'abord, et le carton propose la visite à côté.
 *
 * Le carton devient donc la seule façon dont la visite s'annonce, d'où
 * la règle : tant qu'elle n'a pas été faite, et tant qu'on n'a pas déjà
 * insisté trois fois. Un refus reste un refus — `markSkipped` ne touche
 * plus à rien ici, mais le compteur, lui, court toujours.
 */
export function shouldHint(s: OnboardingState = loadOnboarding()): boolean {
  return !s.done.includes("global") && s.hints < HINT_MAX;
}

/** First opening: nothing done, nothing waved away. */
export function isFirstRun(s: OnboardingState = loadOnboarding()): boolean {
  return s.done.length === 0 && !s.skipped;
}
