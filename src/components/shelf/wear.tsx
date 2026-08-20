/* ============================================================
   L'USURE, RENDUE DISPONIBLE LÀ OÙ UN BOÎTIER SE DESSINE

   `domain/patina` dit ce que le temps a fait d'un film ; il lui faut pour
   cela UN nombre qui ne dépend pas de la fiche mais de tout le classeur —
   au bout de combien de jours « il y a longtemps » commence, ici, pour
   cette collection (`neglectDaysFor`, `domain/athome`).

   IL ARRIVE PAR UN CONTEXTE, ET C'EST LE PRÉCÉDENT DE `filing`. Un
   boîtier se dessine au fond de `Shelf` → `ShelfRow` → `Line` → `FilmBox`,
   toutes mémoïsées, toutes rejouées des dizaines de fois par seconde sous
   un glissement. Filer une prop de plus dans cette chaîne serait une
   raison de plus pour une ligne entière de se redessiner en plein geste.
   Le contexte, lui, est lu par la feuille qui en a besoin, change une
   fois par chargement, et ne coûte rien au glissement.

   IL VAUT `null` PAR DÉFAUT, et c'est le cas qui doit rester sans effort :
   sans classeur autour, aucun boîtier ne prend de marque, et rien n'a
   besoin d'être monté pour que l'étagère s'affiche.

   ─────────────────────────────────────────────────────────────
   CE QUI EST INTERDIT ICI, ET POURQUOI C'EST LE POINT DUR

   « LES EFFETS CHERS APPARTIENNENT AUX MOMENTS, PAS AUX LISTES. » Une
   étagère montre quatre cents boîtiers. Un `filter`, un `mixBlendMode` ou
   une ombre multiple par case ferait ramper le défilement et le
   glissement avec lui — la patine se paierait sur le seul geste que cette
   vue sait faire.

   On ne s'autorise donc QUE des `background` : un aplat ou un dégradé CSS,
   un seul paint, sur un élément déjà là ou sur un `<span>` absolu. Un
   dégradé CSS lit les jetons, c'est même la raison pour laquelle le hall
   les préfère.

   ET AUCUNE MARQUE NE PASSE PAR UN `transform`. Les deux mains sont
   prises : `data-lean` porte le penchement du glissement, le bouton porte
   le relèvement du survol. Une troisième écrirait par-dessus l'une des
   deux. Surtout, le wrapper `data-shelf-item` ne doit pas bouger d'un
   cheveu — le cache de rectangles de `ShelfBoard` repose entièrement sur
   cette promesse.
   ============================================================ */
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { C, alpha } from "../../theme/tokens";
import { patinaOf, type Wear } from "../../domain/patina";

/**
 * Au bout de combien de jours « il y a longtemps » commence, pour CE
 * classeur. `null` : on ne sait pas, et rien ne se marque.
 */
const WearContext = createContext<number | null>(null);

export const WearProvider = ({
  neglectDays,
  children,
}: {
  neglectDays: number | null;
  children: ReactNode;
}) => <WearContext.Provider value={neglectDays}>{children}</WearContext.Provider>;

/** Le seuil d'oubli de ce classeur, ou `null` si personne ne l'a posé. */
export const useNeglectDays = (): number | null => useContext(WearContext);

/**
 * LA PATINE MONTE SUR LA TRANCHE QUI EXISTE DÉJÀ — zéro nœud de plus.
 *
 * Le bandeau de couleur est déjà là, déjà absolu, déjà `aria-hidden`. On
 * lui superpose un dégradé au pied : ce qu'on prend en main s'use par le
 * bas, là où le pouce passe. Une séance ne marque rien ; c'est une
 * DIFFÉRENCE entre deux boîtiers voisins, pas un compteur.
 *
 * L'encre est celle de la peau, et le grain est semé : la marque d'un
 * boîtier ne bouge jamais.
 */
export const spineBackground = (hue: string, wear: Wear | null): string => {
  const p = wear ? patinaOf(wear.times) : 0;
  if (p <= 0) return hue;
  const reach = Math.round(34 + 26 * p + 8 * ((wear?.grain ?? 0) - 0.5));
  return `linear-gradient(to top, ${alpha(C.ink, 0.12 + 0.34 * p)} 0%, ${alpha(
    C.ink,
    0
  )} ${reach}%), ${hue}`;
};

/**
 * LE BOÎTIER ENDORMI RECULE VERS LE FOND, il ne se salit pas.
 *
 * On a d'abord voulu de la poussière — pâle, donc écrite en clair. Sous
 * cinq des quatorze peaux, un aplat clair sur une affiche devenait une
 * TACHE, et le boîtier le moins fréquenté était devenu le plus visible du
 * rayon : l'inverse exact de ce qu'on voulait dire.
 *
 * Il prend donc l'encre du PAPIER, c'est-à-dire du fond : le boîtier
 * s'éloigne dans l'ombre de l'étagère, et ce mouvement se lit dans le
 * même sens sous toutes les peaux, sombres comprises. Le voile est plus
 * dense en haut, où se dépose ce qui se dépose.
 */
export const dormantVeil = (wear: Wear): CSSProperties => ({
  position: "absolute",
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
  background: `linear-gradient(to bottom, ${alpha(C.paper, 0.42)} 0%, ${alpha(
    C.paper,
    0.2
  )} ${18 + Math.round(wear.grain * 10)}%, ${alpha(C.paper, 0.12)} 100%)`,
});

/**
 * CE QU'ON N'A PAS VU EST ENCORE SOUS CELLOPHANE.
 *
 * Un reflet en biais, et non un bandeau « à voir » : le classeur dit déjà
 * ce statut par ailleurs, et un second libellé sur l'objet ferait deux
 * choses à lire pour une seule à savoir. Le biais est semé, sinon quatre
 * cents boîtiers renverraient tous la lumière du même angle et le rayon
 * se lirait comme un décor imprimé.
 */
export const sealedSheen = (wear: Wear): CSSProperties => ({
  position: "absolute",
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
  background: `linear-gradient(${Math.round(96 + wear.grain * 34)}deg, ${alpha(
    C.paper,
    0
  )} 34%, ${alpha(C.paper, 0.34)} 45%, ${alpha(C.paper, 0.06)} 53%, ${alpha(C.paper, 0)} 62%)`,
});
