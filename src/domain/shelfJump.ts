/* ============================================================
   LE TOUR DES TROUVÉS — avancer, reculer, savoir où l'on en est

   Sur l'étagère, chercher ne filtre pas : ça TERNIT. `ShelfFind` a donc
   dû inventer un geste pour MENER jusqu'au boîtier trouvé, et ce geste
   était à sens unique. Sur douze trouvés, revenir sur celui qu'on venait
   de dépasser demandait onze pas.

   Le tour lui-même est de l'arithmétique — un anneau, deux sens, une
   remise à zéro — et il n'a besoin d'aucun document pour se dire. Il
   part donc ici, où il se teste sans DOM. `ShelfFind` ne garde que ce
   qu'un module pur ne peut pas faire : lire l'ordre réel à l'écran et
   faire défiler.

   `at` EST « CELUI QU'ON MONTRE », ET `-1` EST « AUCUN ». Le premier jet
   tenait « le prochain à montrer », ce qui rendait le recul
   indescriptible : reculer depuis « le prochain » aurait sauté deux
   crans en arrière, et on ne s'en serait aperçu qu'en le faisant.
   ============================================================ */

/** Où l'on vient d'arriver, et le boîtier qui s'y trouve. */
export interface Jump {
  /** L'index dans les trouvés, à partir de 0. L'écran l'écrit +1. */
  index: number;
  id: string;
}

/**
 * Le trouvé suivant (`dir` de 1) ou précédent (`dir` de -1), en partant
 * de `at`.
 *
 * `ids` est l'ordre RÉEL à l'écran, dans son entier ; `matching` dit
 * lesquels répondent. Les croiser ici plutôt que d'attendre une liste
 * déjà filtrée garde l'appelant honnête : il ne peut pas se tromper
 * d'ordre, puisqu'il n'en compose aucun.
 *
 * `null` quand rien ne répond — et c'est le seul cas d'échec. Un `at`
 * hors bornes n'en est pas un : on revient dans l'anneau.
 */
export function nextMatch(
  ids: readonly string[],
  matching: ReadonlySet<string> | null,
  at: number,
  dir: 1 | -1
): Jump | null {
  if (!matching) return null;
  const found = ids.filter((id) => matching.has(id));
  if (found.length === 0) return null;

  /* AUCUN COURANT : on entre par le bout que le geste désigne. Avancer
     depuis nulle part mène au premier, reculer au dernier — sans quoi le
     premier « précédent » d'une recherche neuve renverrait au deuxième. */
  const from = at < 0 || at >= found.length ? (dir === 1 ? -1 : 0) : at;
  const index = (((from + dir) % found.length) + found.length) % found.length;
  return { index, id: found[index] as string };
}

/**
 * A-t-on changé de recherche ?
 *
 * `ShelfFind` garde son rang dans un `ref` — personne ne le lit à
 * l'écran, et le poser en état redessinerait la colonne à chaque saut.
 * Mais un rang gardé d'une recherche à l'autre fait partir « aller au
 * suivant » au septième résultat d'un ensemble qu'on vient tout juste de
 * composer. On compare donc les deux ensembles, et on repart de rien
 * dès qu'ils diffèrent.
 *
 * On compare le CONTENU et non l'identité de l'objet : `dimSet` est
 * refait par un `useMemo` à chaque frappe, donc deux ensembles égaux
 * sont presque toujours deux objets différents.
 */
export function sameSearch(a: ReadonlySet<string> | null, b: ReadonlySet<string> | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}
