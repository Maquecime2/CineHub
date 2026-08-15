/* ============================================================
   CE QU'ON N'A PAS ENCORE VU AU HALL
   ============================================================

   Le fil se remplit pendant qu'on range ses fiches, et rien ne le
   disait : il fallait aller voir, donc y penser, donc savoir qu'il y
   avait quelque chose — ce qui est précisément la question.

   ------------------------------------------------------------
   UNE DATE, PAS UN COMPTEUR
   ------------------------------------------------------------

   On retient l'INSTANT de la dernière visite, et non le nombre d'items
   lus. Un compteur se désynchronise dès qu'une nouvelle arrive entre la
   lecture et l'écriture, et il faudrait alors décider ce qu'on fait
   d'un total négatif. Une date ne se désynchronise pas : ce qui est
   plus récent qu'elle n'a pas été vu, et c'est vrai quel que soit
   l'ordre des choses.

   ELLE EST PROPRE À L'APPAREIL, et donc pas synchronisée : ce qu'on a
   lu sur le téléphone, on peut vouloir le retrouver sur l'ordinateur.
   D'où une clé qui n'est pas dans la liste de `documents`.

   ------------------------------------------------------------
   ON NE COMPTE PAS SES PROPRES NOUVELLES
   ------------------------------------------------------------

   Le fil contient ce que les gens qu'on suit ont vu. Si le serveur y
   glissait un jour nos propres fiches, la pastille s'allumerait à chaque
   film qu'on range — c'est-à-dire tout le temps, donc jamais utilement.
   Le filtre est ici plutôt qu'à l'appel, pour que la règle vive avec la
   question qu'elle sert.
   ============================================================ */
import { store } from "./storage";

const KEY = "hall-seen";

/** Quand on a regardé le fil pour la dernière fois, en millisecondes. */
export const hallSeenAt = (): number => {
  const v = store.get<number>(KEY, 0);
  return typeof v === "number" && v > 0 ? v : 0;
};

/** On vient de le regarder. */
export const markHallSeen = (at = Date.now()): void => {
  store.set(KEY, at);
};

/**
 * Combien de nouvelles sont arrivées depuis la dernière visite.
 *
 * `mine` est le pseudonyme de la personne, quand elle en a un : ses
 * propres fiches ne sont pas des nouvelles pour elle.
 */
export function unseenNews(
  news: readonly { at: number; pseudo: string }[],
  mine?: string | null
): number {
  const since = hallSeenAt();
  /* PREMIÈRE VISITE : on ne réclame rien. Sans marqueur, tout le fil
     serait « neuf », et la pastille s'allumerait avec un chiffre qui ne
     veut rien dire pour quelqu'un qui vient d'arriver. */
  if (since === 0) return 0;
  return news.filter((n) => n.at > since && n.pseudo !== mine).length;
}
