/* ============================================================
   LE CALQUE — ce qui flotte au-dessus de la page n'y habite pas
   ============================================================

   Un panneau qui recouvre l'écran s'écrit `position: fixed`, et un
   `position: fixed` se croit ancré à la FENÊTRE. C'est faux dès qu'un
   ancêtre porte une transformation : l'élément transformé devient le
   bloc conteneur de tous les `fixed` qu'il contient, et le panneau se
   met alors à mesurer la colonne au lieu de l'écran, à défiler avec
   elle, et à se poser à côté de ce qu'il visait.

   OR LA COLONNE DE VUE EST TRANSFORMÉE. `[data-enters]` joue `sheetIn`
   à chaque changement d'onglet ou de fiche : trois cent quarante
   millisecondes pendant lesquelles tout tiroir, tout atelier, tout
   repère de dépôt monté DANS une vue est ancré au mauvais endroit.

   IL Y A PIRE, ET C'EST PERMANENT. La colonne est aussi un CONTEXTE
   D'EMPILEMENT (`position: relative; z-index: 2`). Un panneau qui vit
   dedans ne peut plus se comparer à quoi que ce soit du dehors : son
   `z-index: 45` ne le classe que parmi ses voisins de colonne, et
   contre la barre du bas ou la modale, seul le `2` de la colonne
   compte. Le budget de couches écrit dans CLAUDE.md décrivait donc une
   hiérarchie que ces panneaux-là n'avaient jamais.

   D'où ce calque : ce qui flotte au-dessus de la page se rend dans le
   CORPS du document, hors de la colonne. Le budget redevient vrai, les
   coordonnées d'écran redeviennent des coordonnées d'écran, et le
   panneau cesse de dépendre de l'onglet qui l'a ouvert.

   React garde l'arbre logique : un portail ne déplace que le rendu. Les
   événements continuent de remonter au parent qui l'a écrit, l'état et
   le contexte suivent — rien à recâbler. */
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export function Calque({ children }: { children: ReactNode }) {
  /* Le rendu serveur n'existe pas ici, mais les tests montent parfois
     des fragments sans document complet : on ne jette pas pour ça. */
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
