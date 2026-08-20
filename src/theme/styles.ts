/* ============================================================
   Styles shared by several views. Anything belonging to a single
   component stays with it.
   ============================================================ */
import type { CSSProperties } from "react";
import { C, F, alpha } from "./tokens";

/* ============================================================
   WHAT A FINGER CAN REACH
   ============================================================

   The binder was drawn for a mouse, whose point is one pixel wide. A
   genre pill twenty-two pixels high is aimed at without thinking with a
   cursor; with a finger, whose contact is eight to ten millimetres
   across, it is missed one time in three — and on a row of pills spaced
   six pixels apart, missing means filtering something other than what
   you wanted.

   FORTY-FOUR PIXELS. That is Apple's value, taken up by criterion 2.5.5
   of the accessibility rules. It is not a comfort margin: it is the size
   below which the error rate goes up for good.

   WHY THIS IS NOT A STYLE SHEET. This whole project dresses in INLINE
   styles, and half its buttons begin with `all: unset` to erase the
   appearance the browser gives them. An inline declaration beats any CSS
   rule: a `(pointer: coarse)` media query set in the tokens would touch
   NONE of these pills. The only lever that reaches them is inline too,
   hence this object we spread about.

   THE QUESTION IS ASKED ONCE, ON LOAD, and not per component: a pointer
   does not become coarse along the way. That is also what lets constant
   style objects depend on it — they are read on import, well before any
   component has state. */
export const TAP = 44;

const coarse = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/** True under a finger. Read once, on import. */
export const COARSE = coarse();

/* ============================================================
   `all: unset` REND UN BOUTON « inline », ET IL FAUT LE REDIRE
   ============================================================

   Une seule déclaration manquait, et elle manquait PARTOUT SAUF AU
   DOIGT. `inked` et `bare` prenaient leur `display: inline-flex` de
   `tap` — qui est VIDE sous une souris. Sur ordinateur, donc : pas de
   boîte flexible, donc le `gap: 6` de `inked` inerte, et l'icône posée
   sur la LIGNE DE BASE du texte au lieu d'être centrée avec lui. Tous
   les boutons à icône de l'application étaient de travers, et
   uniquement là où presque tout le monde les regarde.

   La mise en boîte appartient donc au bouton, et `tap` ne garde que ce
   qui le concerne : une cible qu'un doigt peut atteindre. */
/* `justifyContent` N'EST PAS DEDANS, ET C'EST LA MOITIÉ DE LA LEÇON. Un
   bouton qui s'ajuste à son contenu n'a rien à centrer horizontalement —
   la propriété n'y sert à rien. Elle ne compte QUE lorsqu'une largeur est
   imposée, c'est-à-dire précisément là où elle nuit : une ligne de
   résultat étirée sur toute la largeur voyait son affiche et son titre
   ramenés au milieu. Elle reste donc dans `tap`, où elle a une raison
   d'être — centrer une icône seule dans une cible de quarante-quatre
   pixels — et nulle part ailleurs. */
const BOX: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
};

/** To spread on a control too small for a finger. Empty with a mouse. */
export const tap: CSSProperties = COARSE
  ? { minHeight: TAP, ...BOX, justifyContent: "center" }
  : {};

/** The same for a square button — an icon alone, with no text. */
export const tapSquare: CSSProperties = COARSE ? { ...tap, minWidth: TAP } : {};

export const underlineInput: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  /* A field with four pixels of padding is twenty-eight high: it is the
     most-missed target in the whole application, and there is one at the
     head of almost every view. */
  padding: COARSE ? "12px 2px" : "4px 2px",
  /* Padding alone is not enough: several fields bring their body down to
     twelve or thirteen pixels, and then fall back below forty-four. The
     minimum height catches those. */
  minHeight: COARSE ? TAP : undefined,
  color: C.ink,
  fontFamily: F.body,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

/* ============================================================
   LES QUATRE PIÈCES DU VOLET COMMUNAUTAIRE
   ============================================================

   Le quiz et les listes s'étaient fabriqué chacun leur bouton, leur
   bouton creux, leur bouton nu et leur pastille — au caractère près les
   mêmes, en bas de deux fichiers qui ne se lisent jamais ensemble. Deux
   copies d'un même objet ne restent identiques que tant que personne n'y
   touche, et la troisième vue à venir en aurait fait une troisième.

   CE SONT DES STYLES ET NON DES COMPOSANTS, et c'est délibéré : les
   trente endroits qui s'en servent les ÉTALENT pour en surcharger une
   propriété — `{ ...inked(C.ink), ...hollow }`, `{ ...bare, color:
   C.burgundy }`. Un composant aurait exigé un passe-plat `style` pour
   rendre exactement le même service, en réécrivant trente balises au
   passage. `tap` y est déjà inclus : c'est tout l'intérêt de ne le
   décider qu'ici. */

/** Le bouton plein : un pavé d'encre, ce qu'on fait par-dessus tout. */
export const inked = (ink: string): CSSProperties => ({
  all: "unset",
  ...BOX,
  ...tap,
  cursor: "pointer",
  gap: 6,
  padding: "7px 12px",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.card,
  background: ink,
  border: `1px solid ${ink}`,
});

/** Le même bouton, creux : un second choix à côté d'un premier. */
export const hollow: CSSProperties = {
  color: C.ink,
  background: "transparent",
  border: `1px solid ${C.line}`,
};

/** Le bouton nu — une icône seule, sans pavé ni bordure. */
export const bare: CSSProperties = {
  all: "unset",
  ...BOX,
  ...tap,
  cursor: "pointer",
  color: C.inkFaded,
};

/** La pastille : un mot encadré, tapé à la machine. */
export const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 8px",
  border: `1px solid ${C.line}`,
  fontFamily: F.mono,
  fontSize: 10,
  color: C.inkFaded,
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
