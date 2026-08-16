/* ============================================================
   UNE COUCHE QUI SE TIENT — focus, échappement, retour
   ============================================================

   TROIS CHOSES MANQUAIENT, ET ELLES MANQUAIENT SÉPARÉMENT. Le sélecteur
   de peaux, celui de langue, le panneau de clef, le tiroir de compte, le
   carnet, le studio de mur, le tiroir « ce soir », la visionneuse
   d'images : aucun ne piégeait le focus, aucun ne le rendait au bouton
   qui l'avait ouvert, et `Escape` était géré dans certains et pas dans
   d'autres.

   PRISES UNE PAR UNE, CHACUNE A L'AIR D'UN DÉTAIL. Ensemble, elles font
   qu'ouvrir un panneau au clavier laisse le curseur DERRIÈRE le voile :
   on tabule dans une page qu'on ne voit plus, on ferme sans savoir qu'on
   a fermé, et on se retrouve au début du document. Ce n'est pas de
   l'ornement d'accessibilité, c'est la couche qui ne marche pas.

   ELLES SONT ENSEMBLE PARCE QU'ELLES SONT LE MÊME GESTE. « Ceci prend la
   main » veut dire les trois à la fois, et un panneau qui n'en prend que
   deux est un panneau dont personne ne se souviendra laquelle manque.

   ------------------------------------------------------------
   CE QUE CE CROCHET NE FAIT PAS

   Il ne dessine rien, et il ne pose ni `role` ni `aria-modal` : ce sont
   des attributs du nœud, et c'est l'appelant qui écrit son nœud. Les
   poser ici aurait voulu dire toucher au DOM après coup pour ce que le
   JSX dit mieux.
   ============================================================ */
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/* CE QUI PEUT RECEVOIR LE FOCUS. La liste est celle de la plateforme, et
   `:not([disabled])` en fait partie : un bouton désarmé qu'on atteint
   par tabulation est un cul-de-sac. */
const CATCHABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])," +
  ' textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Rend la référence à poser sur le nœud de la couche.
 *
 * @param onClose ce que fait `Escape`. Absent : la couche ne se ferme
 *   pas au clavier, ce qui est le bon comportement d'une confirmation
 *   dont on veut une réponse.
 * @param options.autoFocus le premier élément à saisir. `false` laisse
 *   le focus sur le nœud lui-même — pour un panneau qu'on lit avant
 *   d'agir, où saisir le premier bouton donne l'impression qu'il est
 *   sur le point d'être pressé.
 */
export function useDialog(
  onClose?: () => void,
  options: { autoFocus?: boolean } = {}
): RefObject<HTMLDivElement | null> {
  const box = useRef<HTMLDivElement | null>(null);
  const { autoFocus = true } = options;

  useEffect(() => {
    const node = box.current;
    if (!node) return;

    /* CE QUI AVAIT LA MAIN AVANT, retenu tout de suite : le lire à la
       fermeture donnerait le nœud de la couche elle-même, qui est en
       train de disparaître. */
    const came = document.activeElement as HTMLElement | null;

    const inside = () => [...node.querySelectorAll<HTMLElement>(CATCHABLE)];

    if (autoFocus) {
      const first = inside()[0];
      (first ?? node).focus?.();
    } else {
      /* Le nœud doit pouvoir être saisi pour recevoir la main : sans
         `tabindex`, `focus()` sur un `div` ne fait rien du tout. */
      if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      node.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const stops = inside();
      if (stops.length === 0) {
        /* Rien à saisir : on garde la main sur la couche plutôt que de
           la laisser filer dans la page du dessous. */
        e.preventDefault();
        return;
      }
      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      const here = document.activeElement;

      /* LE PIÈGE EST UN CYCLE, pas un blocage : on revient au début
         plutôt que d'empêcher de tabuler. Bloquer aurait donné une
         couche dont on ne peut pas atteindre le dernier bouton. */
      if (e.shiftKey && (here === first || !node.contains(here))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (here === last || !node.contains(here))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      /* LA MAIN REVIENT D'OÙ ELLE VENAIT. Sans cette ligne, fermer un
         panneau renvoie au tout début du document, et il faut retraverser
         la page pour retrouver le bouton qu'on vient d'utiliser. */
      came?.focus?.();
    };
  }, [onClose, autoFocus]);

  return box;
}
