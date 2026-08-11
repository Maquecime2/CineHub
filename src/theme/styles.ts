/* ============================================================
   Styles partagés par plusieurs vues. Tout ce qui est propre à un
   seul composant reste chez lui.
   ============================================================ */
import type { CSSProperties } from "react";
import { C, F, alpha } from "./tokens";

/* ============================================================
   CE QU'UN DOIGT PEUT ATTEINDRE
   ============================================================

   Le classeur a ete dessine pour une souris, dont la pointe fait un
   pixel. Une pastille de genre haute de vingt-deux pixels se vise sans y
   penser au curseur ; au doigt, dont le contact fait entre huit et dix
   millimetres, elle se manque une fois sur trois — et sur une rangee de
   pastilles espacees de six pixels, se manquer veut dire filtrer autre
   chose que ce qu'on voulait.

   QUARANTE-QUATRE PIXELS. C'est la valeur d'Apple, reprise par le
   critere 2.5.5 des regles d'accessibilite. Ce n'est pas une marge de
   confort : c'est la taille au-dessous de laquelle le taux d'erreur
   monte pour de bon.

   POURQUOI CE N'EST PAS UNE FEUILLE DE STYLE. Tout ce projet s'habille
   en styles EN LIGNE, et la moitie de ses boutons commencent par
   `all: unset` pour effacer l'apparence que le navigateur leur donne.
   Une declaration en ligne bat toute regle CSS : une media query
   `(pointer: coarse)` posee dans les jetons ne toucherait AUCUNE de ces
   pastilles. Le seul levier qui les atteigne est en ligne lui aussi,
   d'ou cet objet qu'on repand.

   LA QUESTION SE POSE UNE FOIS, AU CHARGEMENT, et non par composant :
   un pointeur ne devient pas grossier en cours de route. C'est aussi ce
   qui permet a des objets de style constants d'en dependre — ils sont
   lus a l'import, bien avant qu'un composant n'ait un etat. */
export const TAP = 44;

const coarse = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/** Vrai sous un doigt. Lu une fois, à l'import. */
export const COARSE = coarse();

/** À répandre sur un contrôle trop petit pour un doigt. Vide à la souris. */
export const tap: CSSProperties = COARSE
  ? {
      minHeight: TAP,
      /* `all: unset` rend le bouton inline : sans cette ligne, la hauteur
         minimale ne s'applique pas, et le rembourrage qui centre le texte
         non plus. */
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    }
  : {};

/** La même chose pour un bouton carré — une icône seule, sans texte. */
export const tapSquare: CSSProperties = COARSE ? { ...tap, minWidth: TAP } : {};

export const underlineInput: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  /* Un champ de quatre pixels de rembourrage fait vingt-huit de haut :
     c'est la cible la plus manquee de toute l'application, et il y en a
     un en tete de presque chaque vue. */
  padding: COARSE ? "12px 2px" : "4px 2px",
  /* Le rembourrage seul ne suffit pas : plusieurs champs redescendent
     leur corps a douze ou treize pixels, et retombent alors sous les
     quarante-quatre. La hauteur minimale rattrape ceux-la. */
  minHeight: COARSE ? TAP : undefined,
  color: C.ink,
  fontFamily: F.body,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

export const ruledTextarea: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  padding: COARSE ? "10px 2px" : "6px 2px",
  color: C.ink,
  fontFamily: F.hand,
  fontSize: 20,
  lineHeight: "30px",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
  backgroundImage: `repeating-linear-gradient(transparent, transparent 29px, ${alpha(C.line, 0.333)} 30px)`,
};
