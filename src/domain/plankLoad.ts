/* ============================================================
   LA PLANCHE PLOIE SOUS LA CHARGE

   Une étagère dont toutes les tablettes sont rigoureusement droites est
   un plan, pas un meuble. Or le classeur SAIT déjà ce que chaque rayon
   porte : `ShelfRow` connaît sa capacité et le nombre de boîtiers rangés
   dessus. Ce module met ce rapport en une seule valeur, et rien d'autre
   ne le calcule.

   ON NE MARQUE QUE L'EXCEPTION. C'est la règle que `domain/patina` a
   écrite pour l'usure (« `fresh` NE SE DESSINE PAS ») et elle vaut ici
   mot pour mot : si chaque planche ploie, aucune ne ploie. Une tablette
   à moitié vide reste donc parfaitement droite, et le seuil est ce qui
   le garantit.

   PUR, SANS TEMPS, SANS GRAINE. Le ploiement ne se sème pas : deux
   rayons également chargés ploient pareil, parce que c'est la CHARGE
   qu'on donne à lire et non le hasard. C'est la seule marque de la vue
   dont ce soit vrai, et c'est pourquoi elle est ailleurs que les autres.
   ============================================================ */

/**
 * SOUS LES DEUX TIERS, LE BOIS NE SENT RIEN.
 *
 * Un rayon aux trois quarts plein est le cas ORDINAIRE d'un classeur
 * qu'on remplit ; le faire ployer ferait de l'ordinaire une exception, et
 * il n'y aurait plus rien pour dire ce qu'est un rayon vraiment chargé.
 */
export const SAG_FROM = 0.66;

/**
 * La charge d'un rayon, de 0 à 1 — ce que le dessin lit, pour n'avoir à
 * connaître ni le seuil ni la capacité.
 *
 * `cap` de 0 ou moins rend 0 : une planche dont on ignore la capacité ne
 * porte rien de mesurable, et inventer une division la ferait ployer à
 * l'infini.
 */
export const sagOf = (filled: number, cap: number): number => {
  if (!(cap > 0) || !(filled > 0)) return 0;
  const ratio = Math.min(filled / cap, 1);
  if (ratio <= SAG_FROM) return 0;
  return (ratio - SAG_FROM) / (1 - SAG_FROM);
};
