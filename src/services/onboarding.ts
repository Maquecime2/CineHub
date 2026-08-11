/* ============================================================
   LA VISITE DÉJÀ FAITE — ce que le classeur retient de l'accueil

   Trois choses seulement : les visites menées à leur terme, le fait
   d'en avoir écarté une, et le nombre de rappels déjà posés. C'est un
   état de NAVIGATEUR, pas une donnée de collection : il ne part donc
   pas dans la sauvegarde, et effacer ses données rejoue l'accueil —
   ce qui est exactement ce qu'on veut pour tester.
   ============================================================ */
import { KEYS, store } from "./storage";

/** Au-delà de trois rappels, on n'insiste plus : c'est un refus, pas un oubli. */
export const HINT_MAX = 3;

export interface OnboardingState {
  /** Identifiants des visites terminées : "global", "library", "detail"… */
  done: string[];
  /** L'utilisateur a écarté une visite au moins une fois. */
  skipped: boolean;
  /** Nombre de cartes-bristol déjà montrées. */
  hints: number;
  /**
   * Le classeur de démonstration a été semé une fois.
   *
   * À CÔTÉ DE `isFirstRun` ET JAMAIS À SA PLACE. La première ouverture
   * se reconnaît à « rien de fait, rien d'écarté » — c'est-à-dire à un
   * état qui retombe à faux dès qu'on a joué ou écarté la visite, mais
   * qui redevient vrai pour qui n'a jamais rien fait de tout cela. S'y
   * fier seul ferait revenir les douze films d'exemple le lendemain du
   * jour où quelqu'un a vidé sa collection à la main — c'est-à-dire au
   * pire moment possible.
   *
   * Ce drapeau-ci ne retombe jamais, sauf `resetOnboarding`.
   */
  semé: boolean;
}

const EMPTY: OnboardingState = { done: [], skipped: false, hints: 0, semé: false };

/* Le repli n'est pas seulement l'absence de clé : une valeur écrite par
   une version antérieure peut manquer un champ, et une visite qui
   plante à l'ouverture est pire que pas de visite du tout. */
export function loadOnboarding(): OnboardingState {
  const raw = store.get<Partial<OnboardingState>>(KEYS.onboarding, EMPTY);
  return {
    done: Array.isArray(raw?.done) ? raw.done.filter((d) => typeof d === "string") : [],
    skipped: raw?.skipped === true,
    hints: typeof raw?.hints === "number" && raw.hints >= 0 ? raw.hints : 0,
    /* Même repli défensif que `skipped`, et pour la même raison : une
       valeur écrite par une version antérieure ne porte pas ce champ,
       et l'absence doit se lire « pas encore semé ». */
    semé: raw?.semé === true,
  };
}

function save(next: OnboardingState): OnboardingState {
  store.set(KEYS.onboarding, next);
  return next;
}

/** Une visite menée jusqu'au bout. Terminer efface le besoin de rappel. */
export function markDone(id: string): OnboardingState {
  const s = loadOnboarding();
  return save({
    ...s,
    done: s.done.includes(id) ? s.done : [...s.done, id],
  });
}

/** Une visite écartée en cours de route : c'est ce qui déclenche le rappel. */
export function markSkipped(): OnboardingState {
  return save({ ...loadOnboarding(), skipped: true });
}

/** Un rappel de plus posé — on compte pour savoir quand se taire. */
export function bumpHint(): OnboardingState {
  const s = loadOnboarding();
  return save({ ...s, hints: s.hints + 1 });
}

/** Le classeur d'exemple a été semé : on ne le ressèmera plus jamais. */
export function markSemé(): OnboardingState {
  return save({ ...loadOnboarding(), semé: true });
}

/** Reste-t-il à semer le classeur de démonstration ? */
export function doitSemer(s: OnboardingState = loadOnboarding()): boolean {
  return !s.semé;
}

/** Tout oublier : l'accueil se rejouera à la prochaine ouverture. */
export function resetOnboarding(): OnboardingState {
  return save({ ...EMPTY });
}

/** Faut-il poser la carte-bristol qui dit où retrouver la visite ? */
export function shouldHint(s: OnboardingState = loadOnboarding()): boolean {
  return s.skipped && !s.done.includes("global") && s.hints < HINT_MAX;
}

/** Première ouverture : rien de fait, rien d'écarté. */
export function isFirstRun(s: OnboardingState = loadOnboarding()): boolean {
  return s.done.length === 0 && !s.skipped;
}
