/* ============================================================
   LA SYNCHRONISATION — le local d'abord, toujours
   ============================================================

   L'ORDRE DES DEUX MOITIÉS N'EST PAS INDIFFÉRENT : on TIRE d'abord, on
   POUSSE ensuite. Tirer en premier fait entrer ce que les autres
   appareils savent, et la fusion décide alors en connaissance de cause.
   Pousser d'abord enverrait des fiches qui vont être remplacées trois
   secondes plus tard — du travail pour rien, et une fenêtre pendant
   laquelle le serveur porte une version qu'on s'apprête à abandonner.

   LE CURSEUR EST UN RANG, PAS UNE HEURE. Le serveur numérote ce qu'il
   reçoit ; on retient le dernier numéro vu. Aucune horloge n'est
   comparée à aucune autre, ce qui est la seule façon de survivre à deux
   appareils qui ne sont pas à la même minute.

   RIEN NE SE PERD QUAND ÇA ÉCHOUE. Le curseur n'avance qu'après une
   lecture réussie ; le repère d'envoi, qu'après un envoi accepté. Un
   réseau coupé au milieu laisse donc l'appareil exactement où il était,
   et le prochain passage refait le même travail — c'est ce qui tient
   lieu de file d'attente, sans file d'attente à tenir.
   ============================================================ */
import { fusionner, àEnvoyer } from "../domain/fusion";
import {
  collectionConnue,
  enAttenteDEnvoi,
  oublierCeQuiEstParti,
  toutÀEnvoyer,
  remplacerFilms,
  tombesConnues,
} from "./collection";
import { store } from "./storage";
import {
  ErreurServeur,
  PAR_ENVOI,
  pousser,
  quiSuisJe,
  serveurConfigure,
  tirerDepuis,
  type Personne,
} from "./serveur";
import type { Film } from "../types";

const CLÉ_CURSEUR = "synchro-rang";
/* À QUI APPARTIENT CE QU'ON A DÉJÀ SYNCHRONISÉ. Sans cette mémoire, se
   connecter à un second compte reprendrait le rang de lecture du
   premier — le classeur croirait avoir tout vu d'une collection qu'il
   n'a jamais lue, et ne pousserait rien de la sienne. */
const CLÉ_COMPTE = "synchro-compte";

/** Le dernier rang de serveur intégré ici. */
const curseur = (): number => Number(store.get(CLÉ_CURSEUR, 0)) || 0;

export type État =
  /** Aucun serveur réglé : la fonction n'existe pas pour cette personne. */
  | "absent"
  /** Un serveur, mais pas de compte : rien ne part, et c'est un choix. */
  | "hors-compte"
  | "en-cours"
  | "à-jour"
  /** Des choses attendent — hors ligne, ou serveur muet. */
  | "en-attente"
  | "erreur";

export interface Bilan {
  état: État;
  personne: Personne | null;
  /** Quand la dernière synchronisation complète a réussi. */
  le: number | null;
  /** Ce qui reste à envoyer, s'il en reste. */
  enAttente: number;
  message?: string;
}

const CLÉ_BILAN = "synchro-bilan";

export const dernierBilan = (): { le: number | null } => store.get(CLÉ_BILAN, { le: null });

/**
 * Un tour complet. Ne jette jamais : rend ce qui s'est passé.
 *
 * `poser` reçoit la collection fusionnée — c'est à l'appelant de la
 * mettre à l'écran, parce que lui seul sait s'il est encore là pour la
 * recevoir.
 */
export async function synchroniser(poser: (films: Film[]) => void): Promise<Bilan> {
  if (!serveurConfigure()) {
    return { état: "absent", personne: null, le: null, enAttente: 0 };
  }

  /* SANS RÉSEAU, ON NE SAIT PAS QUI L'ON EST — et « je ne sais pas »
     n'est pas « personne ». Le compte reste, ce qui attend reste, et
     l'écran dit « en attente » au lieu de proposer de s'inscrire à
     quelqu'un qui est déjà inscrit. */
  let personne: Personne | null;
  try {
    personne = await quiSuisJe();
  } catch {
    return {
      état: "en-attente",
      personne: null,
      le: dernierBilan().le,
      enAttente: enAttenteDEnvoi().length,
    };
  }
  if (!personne) {
    return { état: "hors-compte", personne: null, le: dernierBilan().le, enAttente: 0 };
  }

  /* PREMIÈRE RENCONTRE AVEC CE COMPTE : tout ce qui est ici doit
     partir. La liste d'attente ne connaît que ce qu'on a modifié
     DEPUIS qu'elle existe ; une collection déjà rangée n'y figure pas,
     et le premier envoi serait vide. */
  if (store.get(CLÉ_COMPTE, "") !== personne.id) {
    store.set(CLÉ_CURSEUR, 0);
    toutÀEnvoyer();
    store.set(CLÉ_COMPTE, personne.id);
  }

  try {
    /* ---------- 1. TIRER ---------- */
    let rang = curseur();
    let films = collectionConnue();
    let encore = true;
    let tours = 0;

    while (encore && tours < 50) {
      const reçu = await tirerDepuis(rang);
      if (reçu.fiches.length) {
        const { films: fusionnés } = fusionner(films, reçu.fiches as never);
        films = fusionnés;
        /* ÉCRIT SANS RE-DATER : ces fiches viennent d'ailleurs et
           portent déjà leur date. Passer par l'enregistrement ordinaire
           les daterait de maintenant, elles se croiraient modifiées
           ici, et repartiraient au serveur en boucle. */
        await remplacerFilms(films);
        poser(films);
      }
      rang = reçu.jusqua;
      encore = reçu.encore === true;
      tours += 1;
    }
    store.set(CLÉ_CURSEUR, rang);

    /* ---------- 2. POUSSER ---------- */
    const paquet = àEnvoyer(collectionConnue(), tombesConnues(), enAttenteDEnvoi());

    for (let i = 0; i < paquet.length; i += PAR_ENVOI) {
      const tranche = paquet.slice(i, i + PAR_ENVOI);
      await pousser(tranche);
      /* ON OUBLIE TRANCHE PAR TRANCHE, et seulement ce qui est
         RÉELLEMENT parti dans cette tranche-là. Vider la liste entière
         à la fin perdrait tout si la troisième tranche échoue ; la
         vider avant l'envoi perdrait la fiche si l'envoi échoue.

         Et l'on ne retire que ce qui n'a pas rebougé entre-temps : une
         note écrite pendant que le paquet voyageait doit repartir au
         tour suivant. */
      const parId = new Map(collectionConnue().map((f) => [f.id, f]));
      oublierCeQuiEstParti(
        tranche
          .filter((e) => {
            const ici = parId.get(e.id);
            return !ici || ici.updatedAt === e.majLe;
          })
          .map((e) => e.id)
      );
    }

    const le = Date.now();
    store.set(CLÉ_BILAN, { le });
    return { état: "à-jour", personne, le, enAttente: 0 };
  } catch (e) {
    const erreur = e as ErreurServeur;
    const attend = àEnvoyer(collectionConnue(), tombesConnues(), enAttenteDEnvoi()).length;
    /* LE ZÉRO VEUT DIRE « LA REQUÊTE N'EST JAMAIS PARTIE » : hors ligne,
       serveur éteint. Ce n'est pas une erreur à montrer en rouge, c'est
       un état normal d'application locale — d'où « en attente ». */
    if (erreur.code === 0) {
      return { état: "en-attente", personne, le: dernierBilan().le, enAttente: attend };
    }
    return {
      état: "erreur",
      personne,
      le: dernierBilan().le,
      enAttente: attend,
      message: erreur.message,
    };
  }
}

/** Ce qui attend, sans rien demander au réseau. */
export const enAttente = (): number =>
  serveurConfigure() ? àEnvoyer(collectionConnue(), tombesConnues(), enAttenteDEnvoi()).length : 0;

/** Repartir de zéro : après une déconnexion, ou un changement de compte. */
export function oublierLaSynchro(): void {
  store.set(CLÉ_CURSEUR, 0);
  store.set(CLÉ_COMPTE, "");
  store.set(CLÉ_BILAN, { le: null });
}
