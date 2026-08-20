/* ============================================================
   OUVRIR LE TIROIR DU COMPTE, DEPUIS N'IMPORTE OÙ
   ============================================================

   Quatre vues du hall disaient « il faut un compte — le bouton au pied
   du rail », ce qui revient à donner un itinéraire au lieu d'une porte.
   Elles offrent maintenant le geste sur place.

   MÊME ARRANGEMENT QUE LE CARTOUCHE DE LA CLÉ TMDB
   (`registerTmdbOpener`), et pour la même raison : faire descendre un
   rappel de fonction depuis `App` jusqu'à quatre vues chargées à la
   demande, c'est quatre `props` qui ne servent qu'à ça, traversant des
   composants que le compte ne regarde pas.

   Un seul inscrit à la fois : c'est un tiroir, pas un abonnement.
   ============================================================ */

let opener: (() => void) | null = null;

/** Monté par `App` avec le tiroir ; rend de quoi se désinscrire. */
export function registerAccountOpener(fn: () => void): () => void {
  opener = fn;
  return () => {
    if (opener === fn) opener = null;
  };
}

/** Ouvre le tiroir du compte, si quelqu'un sait comment. */
export const openAccountDrawer = (): void => opener?.();
