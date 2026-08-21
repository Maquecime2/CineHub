/* ============================================================
   LA BANDE DE DROITE — LE CALCUL QU'ON A RATÉ DEUX FOIS
   ============================================================

   Ce n'est pas de la mise en page qu'on épingle ici, c'est une CIBLE DE
   DÉPÔT. Le tiroir des mis de côté tient le bord droit ; quatre panneaux
   s'y ancrent et passent au-dessus de lui dans la pile. Quand l'un d'eux
   couvre l'onglet, le seul geste qui range un film dans le tiroir en
   glissant devient injoignable — et rien ne le dit : le film part dans
   une catégorie, et on croit avoir fait ce qu'on voulait.

   Le premier correctif n'a réservé que la largeur du TIROIR. Or l'onglet
   VOYAGE AVEC LUI (`right: open ? DRAWER_W : 0`), donc onze pixels se
   recouvraient encore, exactement sur la cible. C'est cette arithmétique
   qui est tenue ici, et pas l'apparence du panneau.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { DRAWER_W, DRAWER_TAB_W, clearOfReserve } from "./constants";

/* `clearOfReserve` rend un `clamp(0px, calc(…), <offset>px)` : sous une
   fenêtre large, c'est la borne HAUTE qui s'applique, et c'est elle qui
   porte toute la règle. On la lit plutôt que de monter un navigateur. */
const offsetOf = (css: string): number => {
  const last = /,\s*(\d+(?:\.\d+)?)px\)$/.exec(css);
  if (!last) throw new Error(`pas d'offset lisible dans « ${css} »`);
  return Number(last[1]);
};

/* Le bord gauche que le `clamp` garantit : la borne basse du calcul. */
const guardOf = (css: string): number => {
  const mid = /calc\(100vw - (\d+(?:\.\d+)?)px\)/.exec(css);
  if (!mid) throw new Error(`pas de garde de largeur dans « ${css} »`);
  return Number(mid[1]);
};

describe("un panneau ancré à droite laisse le tiroir atteignable", () => {
  const W = 190; // la largeur du classeur rapide

  it("laisse l'onglet entier libre quand le tiroir est FERMÉ", () => {
    /* Onglet fermé : il occupe 0 → DRAWER_TAB_W. */
    expect(offsetOf(clearOfReserve(false, W))).toBeGreaterThanOrEqual(DRAWER_TAB_W);
  });

  it("laisse l'onglet entier libre quand le tiroir est OUVERT", () => {
    /* LE CŒUR DU TEST. Ouvert, l'onglet n'est plus au bord : il est posé
       à `DRAWER_W` et s'étend jusqu'à `DRAWER_W + DRAWER_TAB_W`. Un
       panneau qui ne réserve que `DRAWER_W` mord dessus. */
    expect(offsetOf(clearOfReserve(true, W))).toBeGreaterThanOrEqual(DRAWER_W + DRAWER_TAB_W);
  });

  it("réserve strictement plus de place le tiroir ouvert que fermé", () => {
    expect(offsetOf(clearOfReserve(true, W))).toBeGreaterThan(offsetOf(clearOfReserve(false, W)));
  });

  it("garde le panneau dans l'écran, sa largeur comprise", () => {
    /* Tiroir ouvert sur 360 px, l'offset seul poussait le bord gauche à
       −98 px : le panneau sortait par la gauche, libellés coupés. La
       garde borne le `right` à ce que la largeur laisse. */
    expect(guardOf(clearOfReserve(true, W))).toBeGreaterThanOrEqual(W);
  });

  it("suit la largeur du panneau, et ne la suppose pas", () => {
    /* Quatre panneaux de quatre largeurs passent par là — 190, 224, 240
       et 300. Une garde écrite pour le plus étroit laisserait les trois
       autres sortir de l'écran. */
    expect(guardOf(clearOfReserve(true, 300))).toBeGreaterThan(guardOf(clearOfReserve(true, 190)));
  });
});
