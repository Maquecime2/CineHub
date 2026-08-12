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
import { mergeRemote, toSend } from "../domain/merge";
import type { RemoteCard } from "../domain/merge";

import {
  knownCollection,
  pendingToSend,
  forgetWhatWentOut,
  sendEverything,
  replaceFilms,
  knownGraves,
} from "./collection";
import { store } from "./storage";
import {
  documentsToSend,
  forgetSentDocuments,
  forgetDocuments,
  fileIncomingDocument,
  sendAllDocuments,
} from "./documents";
import {
  DOCS_PER_SEND,
  ServerError,
  PER_SEND,
  push,
  whoAmI,
  serverConfigured,
  pushDocs,
  pullFrom,
  pullDocsFrom,
  type Person,
} from "./server";
import type { Film } from "../types";

const CLÉ_CURSEUR = "synchro-rang";
/* Deux rangs, parce que les deux tables comptent chacune pour elle. */
const CLÉ_CURSEUR_DOCS = "synchro-rang-documents";
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
  personne: Person | null;
  /** Quand la dernière synchronisation complète a réussi. */
  le: number | null;
  /** Ce qui reste à envoyer, s'il en reste. */
  enAttente: number;
  /**
   * Des documents sont entrés — agencements, carnet, fils, décors.
   *
   * Les vues les lisent AU MONTAGE et ne les observent pas : sans ce
   * signal, l'étagère resterait celle d'avant jusqu'au prochain
   * rechargement de la page, et l'on croirait la synchronisation
   * incomplète alors qu'elle a tout ramené.
   */
  documentsEntrés?: number;
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
  if (!serverConfigured()) {
    return { état: "absent", personne: null, le: null, enAttente: 0 };
  }

  /* SANS RÉSEAU, ON NE SAIT PAS QUI L'ON EST — et « je ne sais pas »
     n'est pas « personne ». Le compte reste, ce qui attend reste, et
     l'écran dit « en attente » au lieu de proposer de s'inscrire à
     quelqu'un qui est déjà inscrit. */
  let personne: Person | null;
  try {
    personne = await whoAmI();
  } catch {
    return {
      état: "en-attente",
      personne: null,
      le: dernierBilan().le,
      enAttente: pendingToSend().length,
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
    store.set(CLÉ_CURSEUR_DOCS, 0);
    sendEverything();
    sendAllDocuments();
    store.set(CLÉ_COMPTE, personne.id);
  }

  try {
    /* ---------- 1. TIRER ---------- */
    let rang = curseur();
    let films = knownCollection();
    let encore = true;
    let tours = 0;

    while (encore && tours < 50) {
      const reçu = await pullFrom(rang);
      if (reçu.fiches.length) {
        /* LE FORMAT DE FIL RESTE CELUI DU SERVEUR, et la traduction se
           fait ICI. `domain/merge` parle anglais comme tout le domaine ;
           le serveur, lui, envoie encore `majLe`/`supprimee`/`donnees`.
           Adapter à la frontière laisse le domaine indépendant du
           protocole — et le jour où le serveur changera de vocabulaire,
           c'est cette fonction-ci qui disparaîtra, pas `mergeRemote`. */
        const venues: RemoteCard[] = (
          reçu.fiches as { id: string; majLe: number; supprimee?: boolean; donnees?: unknown }[]
        ).map((f) => ({
          id: f.id,
          updatedAt: f.majLe,
          deleted: f.supprimee,
          data: (f.donnees ?? {}) as never,
        }));
        const { films: fusionnés } = mergeRemote(films, venues);
        films = fusionnés;
        /* ÉCRIT SANS RE-DATER : ces fiches viennent d'ailleurs et
           portent déjà leur date. Passer par l'enregistrement ordinaire
           les daterait de maintenant, elles se croiraient modifiées
           ici, et repartiraient au serveur en boucle. */
        await replaceFilms(films);
        poser(films);
      }
      rang = reçu.jusqua;
      encore = reçu.encore === true;
      tours += 1;
    }
    store.set(CLÉ_CURSEUR, rang);

    /* ---------- 2. POUSSER ---------- */
    /* `toSend` rend le vocabulaire du domaine ; le serveur attend le
       sien. Même frontière, même traduction, en sens inverse. */
    const paquet = toSend(knownCollection(), knownGraves(), pendingToSend()).map((e) => ({
      id: e.id,
      tmdbId: e.tmdbId,
      majLe: e.updatedAt,
      ...(e.deleted ? { supprimee: true } : {}),
      donnees: e.data,
    }));

    for (let i = 0; i < paquet.length; i += PER_SEND) {
      const tranche = paquet.slice(i, i + PER_SEND);
      await push(tranche);
      /* ON OUBLIE TRANCHE PAR TRANCHE, et seulement ce qui est
         RÉELLEMENT parti dans cette tranche-là. Vider la liste entière
         à la fin perdrait tout si la troisième tranche échoue ; la
         vider avant l'envoi perdrait la fiche si l'envoi échoue.

         Et l'on ne retire que ce qui n'a pas rebougé entre-temps : une
         note écrite pendant que le paquet voyageait doit repartir au
         tour suivant. */
      const parId = new Map(knownCollection().map((f) => [f.id, f]));
      forgetWhatWentOut(
        tranche
          .filter((e) => {
            const ici = parId.get(e.id);
            return !ici || ici.updatedAt === e.majLe;
          })
          .map((e) => e.id)
      );
    }

    /* ---------- 3. LE RESTE DU CLASSEUR ----------
       Après les fiches, et pas avant : un agencement d'étagère cite des
       identifiants de films, et une étagère qui arrive la première
       désignerait des fiches que l'on n'a pas encore. */
    let rangDocs = Number(store.get(CLÉ_CURSEUR_DOCS, 0)) || 0;
    let encoreDocs = true;
    let toursDocs = 0;
    let entrés = 0;
    while (encoreDocs && toursDocs < 50) {
      const reçu = await pullDocsFrom(rangDocs);
      for (const d of reçu.documents) if (fileIncomingDocument(d)) entrés += 1;
      rangDocs = reçu.jusqua;
      encoreDocs = reçu.encore === true;
      toursDocs += 1;
    }
    store.set(CLÉ_CURSEUR_DOCS, rangDocs);

    const paquetDocs = documentsToSend();
    for (let i = 0; i < paquetDocs.length; i += DOCS_PER_SEND) {
      const tranche = paquetDocs.slice(i, i + DOCS_PER_SEND);
      await pushDocs(tranche);
      forgetSentDocuments(tranche.map((d) => d.cle));
    }

    /* Un agencement qui change demande un rechargement de la vue : les
       étagères sont lues au montage, pas observées. On le dit à
       l'appelant plutôt que de recharger la page sous ses doigts. */
    const le = Date.now();
    store.set(CLÉ_BILAN, { le, documentsEntrés: entrés });
    return { état: "à-jour", personne, le, enAttente: 0, documentsEntrés: entrés };
  } catch (e) {
    const erreur = e as ServerError;
    const attend = toSend(knownCollection(), knownGraves(), pendingToSend()).length;
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
  serverConfigured() ? toSend(knownCollection(), knownGraves(), pendingToSend()).length : 0;

/** Repartir de zéro : après une déconnexion, ou un changement de compte. */
export function oublierLaSynchro(): void {
  store.set(CLÉ_CURSEUR, 0);
  store.set(CLÉ_CURSEUR_DOCS, 0);
  forgetDocuments();
  store.set(CLÉ_COMPTE, "");
  store.set(CLÉ_BILAN, { le: null });
}
