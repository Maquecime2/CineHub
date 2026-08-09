/* ============================================================
   POSER LE CLASSEUR SUR L'ÉCRAN D'ACCUEIL

   Ce qui se décide ici : à qui l'on propose l'installation, et quand
   l'on se tait. Le reste — le geste lui-même — appartient au navigateur.

   C'est un état de NAVIGATEUR et non une donnée de collection, comme
   l'accueil : il ne part pas dans la sauvegarde, et effacer ses données
   repropose l'installation. C'est exactement ce qu'on veut pour
   l'essayer.
   ============================================================ */
import { store } from "./storage";

const CLÉ = "installation";

/** Deux refus suffisent à dire non. On ne redemande plus après. */
export const REFUS_MAX = 2;

export interface ÉtatInstallation {
  /** Nombre de fois où l'invitation a été écartée. */
  refus: number;
  /** L'invitation a déjà été montrée dans cette session de navigateur. */
  posée: boolean;
}

const VIDE: ÉtatInstallation = { refus: 0, posée: false };

export const lireInstallation = (): ÉtatInstallation => {
  const brut = store.get<Partial<ÉtatInstallation>>(CLÉ, VIDE);
  return {
    refus: typeof brut?.refus === "number" && brut.refus >= 0 ? brut.refus : 0,
    posée: brut?.posée === true,
  };
};

export const noterRefus = (): ÉtatInstallation => {
  const état = lireInstallation();
  const suite = { ...état, refus: état.refus + 1 };
  store.set(CLÉ, suite);
  return suite;
};

/** L'installation a eu lieu : on ne repropose jamais. */
export const noterPosée = (): ÉtatInstallation => {
  const suite = { ...lireInstallation(), posée: true };
  store.set(CLÉ, suite);
  return suite;
};

/* DÉJÀ POSÉE ? Deux façons de le savoir, et il faut les deux : Android
   et le bureau répondent par le mode d'affichage, iOS par une propriété
   à lui que personne d'autre n'implémente. */
export const déjàInstallée = (): boolean => {
  if (typeof window === "undefined") return false;
  const autonome =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const pomme = (window.navigator as { standalone?: boolean }).standalone === true;
  return autonome || pomme;
};

/* IOS NE DEMANDE JAMAIS RIEN. Safari n'émet pas `beforeinstallprompt` et
   n'ouvrira aucune boîte de dialogue : la seule voie est Partager →
   « Sur l'écran d'accueil ». On ne peut donc pas proposer un bouton, on
   ne peut qu'EXPLIQUER — et il faut savoir qu'on est là pour le faire.

   On reconnaît aussi les iPad récents, qui se déclarent Macintosh et ne
   se trahissent que par leur écran tactile. */
export const estIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
};

/** Faut-il encore parler d'installation ? */
export const peutProposer = (état: ÉtatInstallation = lireInstallation()): boolean =>
  !état.posée && état.refus < REFUS_MAX && !déjàInstallée();
