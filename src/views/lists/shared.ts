/* Le peu que les quatre pièces du domaine partagent — le mur des
   listes, la liste ouverte, le tableau et l'assistant. Il est court
   EXPRÈS : quand un fichier de partage grossit, il cesse de dire ce qui
   est commun et devient l'endroit où l'on range ce qu'on ne sait pas
   placer.

   Rien ici ne connaît React, et rien n'écrit : ce sont des DATES, et la
   raison pour laquelle elles vivent ici plutôt que dans `domain/` est
   qu'aucune n'est une règle du produit — ce sont des DÉFAUTS d'écran, et
   ils se corrigent tous d'un clic. */

const two = (n: number) => String(n).padStart(2, "0");

/** Une date au format que le serveur attend — `AAAA-MM-JJ`, et jamais un
    horodatage : un défi porte des JOURS, et un fuseau glissé là-dedans
    décalerait la période d'un jour pour la moitié du monde. C'est la
    même précaution que `domain/challenges`, qui compare ces dates COMME
    DES CHAÎNES pour ne pas repasser par UTC. */
export function day(d: Date): string {
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** The month one is in, from the first to the last day: it is the period
    one wants nine times out of ten, and it is corrected in one click. */
export function currentMonth(): { start: string; end: string } {
  const d = new Date();
  return {
    start: `${d.getFullYear()}-${two(d.getMonth() + 1)}-01`,
    end: day(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** D'aujourd'hui à dans `n` jours. */
export function nextDays(n: number): { start: string; end: string } {
  const d = new Date();
  return { start: day(d), end: day(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)) };
}

/** D'aujourd'hui au dernier jour de l'année en cours. */
export function restOfYear(): { start: string; end: string } {
  const d = new Date();
  return { start: day(d), end: `${d.getFullYear()}-12-31` };
}

/* ------------------------------------------------------------
   LES MISES EN TRAIN
   ------------------------------------------------------------

   CE N'ÉTAIT PAS LE TITRE QUI MANQUAIT, C'ÉTAIT LA PREMIÈRE RÉPONSE.
   Lancer un défi demandait de remplir six champs à plat — un titre, deux
   dates au calendrier, une nature, une cible — avant même de savoir si
   l'on avait envie du résultat. Ces trois-là répondent à tout d'un coup,
   et rien n'y est verrouillé : ce sont des DÉFAUTS, pas des formules.

   `target: null` veut dire « toute la liste ». C'est le seul cas où la
   cible peut être absente, et le SCHÉMA l'interdit dès qu'il n'y a pas
   de liste à compter — d'où `needsList`, qui retire la proposition
   plutôt que de la laisser se faire refuser. */
export interface Warmup {
  /** La clé de la phrase, dans les deux catalogues. */
  key: string;
  target: number | null;
  period: () => { start: string; end: string };
  needsList?: boolean;
}

export const WARMUPS: Warmup[] = [
  { key: "fiveThisMonth", target: 5, period: currentMonth },
  { key: "threeInTwoWeeks", target: 3, period: () => nextDays(14) },
  { key: "wholeListThisYear", target: null, period: restOfYear, needsList: true },
];
