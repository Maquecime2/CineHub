/* ============================================================
   L'ÉTAT D'UN DÉFI — ce qu'on peut en dire sans rien demander
   ============================================================

   Un défi est une liste plus une période. Tout ce qui suit se déduit de
   deux dates et d'un compte, donc se calcule sur place : rien ici ne
   parle au serveur, et l'affiche d'un défi se dessine avant que la
   première réponse ne soit revenue.

   LES DATES SONT DES CHAÎNES `AAAA-MM-JJ`, ET ON LES COMPARE COMME
   TELLES. C'est la seule façon de ne pas se tromper : construire un
   `Date` à partir de « 2026-03-01 » le pose à minuit UTC, et quiconque
   vit à l'ouest de Greenwich lit alors la veille. Un défi qui commence
   demain pour la moitié de la planète et aujourd'hui pour l'autre
   serait un défi qu'on ne peut pas mesurer. Rangées dans cet ordre, les
   chaînes se comparent dans le bon sens toutes seules.

   `mayExtend` REPRODUIT LES BORNES DE LA REQUÊTE SQL, exactement. C'est
   le point délicat du fichier : la vérité est là-bas, dans
   `store.extendChallenge`, qui porte ses cinq limites dans une seule
   instruction. Celle d'ici ne sert qu'à ne pas montrer un bouton qui va
   se faire refuser. Le test qui compte est celui qui rejoue les mêmes
   bornes — le jour où l'une des deux bouge, il tombe.
   ============================================================ */

export type ChallengeState = "upcoming" | "running" | "last-days" | "finished";

/** Le jour, chez celui qui regarde, en `AAAA-MM-JJ`. */
export function today(now: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** Combien de jours séparent deux jours donnés, du premier au second. */
export function daysBetween(from: string, to: string): number {
  const at = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((at(to) - at(from)) / 86400000);
}

/**
 * Où en est un défi.
 *
 * `last-days` n'est pas un état de plus pour le plaisir : c'est celui
 * qui mérite d'être vu de loin sur l'affiche, et un défi qui finit
 * demain ne se signale pas comme un défi qui finit dans trois semaines.
 */
export function stateOf(
  challenge: { starts_on: string; ends_on: string },
  now: string = today()
): ChallengeState {
  if (now < challenge.starts_on) return "upcoming";
  if (now > challenge.ends_on) return "finished";
  return daysBetween(now, challenge.ends_on) <= 2 ? "last-days" : "running";
}

/** Ce qu'il reste. Négatif une fois la période passée, et c'est voulu. */
export const daysLeft = (challenge: { ends_on: string }, now: string = today()): number =>
  daysBetween(now, challenge.ends_on);

/** La part faite, bornée à un : on ne dépasse pas cent pour cent. */
export const share = (done: number, works: number): number =>
  works > 0 ? Math.min(1, done / works) : 0;

/**
 * Le défi a-t-il besoin d'être soldé ?
 *
 * Aucune tâche de fond ne court côté serveur : c'est le PREMIER qui
 * ouvre un défi fini qui en clôt les comptes pour tout le monde, et la
 * clé du journal fait que le deuxième et le dixième ne paient personne
 * deux fois. Cette fonction dit seulement quand poser la question.
 */
export const needsSettling = (challenge: { ends_on: string }, now: string = today()): boolean =>
  now > challenge.ends_on;

/**
 * Peut-on encore prolonger ce défi ?
 *
 * LES MÊMES CINQ BORNES QUE `store.extendChallenge`, dans le même ordre.
 * Elles ne décident de rien — le serveur refusera de toute façon — mais
 * elles évitent de montrer un bouton qui coûte un pouvoir pour rien.
 */
export function mayExtend(
  challenge: {
    starts_on: string;
    ends_on: string;
    extensions?: number;
    by?: string | null;
    settled?: boolean;
  },
  mePseudo: string | null,
  now: string = today()
): boolean {
  if (!mePseudo || challenge.by !== mePseudo) return false;
  if ((challenge.extensions ?? 0) >= 2) return false;
  /* On prolonge, on ne ressuscite pas : au-delà d'une semaine après la
     fin, le défi appartient au passé. */
  if (daysBetween(challenge.ends_on, now) > 7) return false;
  if (challenge.settled) return false;
  return true;
}
