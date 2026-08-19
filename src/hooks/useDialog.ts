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
   DEUX COUCHES EMPILÉES, ET UNE SEULE ÉCOUTE

   L'ÉCOUTEUR EST POSÉ SUR `document`, EN CAPTURE, UNE FOIS PAR COUCHE
   MONTÉE. Tant qu'il n'y en avait jamais deux à la fois, c'était sans
   conséquence — et le projet s'en gardait, `StepPanel` écrivant noir sur
   blanc qu'il n'est ni un `Layer` ni un dialogue. Le jour où une feuille
   en ouvre une seconde — la carte des cinéastes et le formulaire d'un
   lien — un défaut paraît, et il ne se voit PAS à la souris :

   ÉCHAP FERME LES DEUX D'UN COUP. Les deux écouteurs sont sur le MÊME
   nœud, et `stopPropagation` n'arrête pas les autres écouteurs d'un même
   nœud — il faudrait `stopImmediatePropagation`, et l'ordre
   d'inscription serait alors le mauvais, puisque la couche du dessous
   s'inscrit la PREMIÈRE. On referme donc la carte en croyant refermer le
   formulaire, et le travail en cours part avec.

   LE PIÈGE À FOCUS, LUI, TIENT TOUT SEUL, et il faut le dire pour que
   personne ne « corrige » ce qui marche : les deux écouteurs rapatrient
   le curseur chacun chez soi, mais celui de la couche du DESSUS s'étant
   inscrit en dernier, c'est lui qui parle en dernier. Le focus finit au
   bon endroit — après un aller-retour que rien ne montre.

   D'OÙ UNE PILE, AU NIVEAU DU MODULE. La couche montée en dernier est la
   seule à écouter ; les autres se taisent sans se démonter. C'est le
   pendant clavier du budget de `z-index` : ce qui est visuellement
   au-dessus est ce qui a la main.

   ------------------------------------------------------------
   LE PIÈGE APPARTIENT À LA VIE DE LA COUCHE, PAS À L'IDENTITÉ DE SON
   RAPPEL — ET C'EST CE QUI FAISAIT TOMBER LE DOSSIER

   L'effet dépendait de `onClose`. Or presque tous les appelants écrivent
   une flèche EN LIGNE (`onClose={() => setLightbox(null)}`) : une
   identité neuve à chaque rendu, donc un piège DÉMONTÉ puis REMONTÉ à
   chaque rendu. À chaque tour, le démontage rend la main à ce qui
   l'avait (`came.focus()`) et le remontage la reprend (`node.focus()`).

   Invisible partout — sauf là où perdre le focus ÉCRIT. Cliquer une
   vignette posée dans une critique ouvrait la visionneuse ; la
   visionneuse prenait la main ; le champ éditable perdait la sienne,
   donc il enregistrait ; enregistrer redessinait la fiche, donc rendait
   un `onClose` neuf, donc remontait le piège, donc reprenait la main :
   la boucle se nourrissait elle-même. Cent quatre remontages pour un
   seul clic, et React finissait par lever « Maximum update depth
   exceeded » — la vue tombait dans sa digue.

   LE RAPPEL VIT DONC DANS UNE RÉFÉRENCE, et l'effet ne court qu'au
   montage. C'est la même façon de faire que `useSync` avec le sien.

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

/* LES COUCHES OUVERTES, DANS L'ORDRE OÙ ELLES SE SONT OUVERTES. Au
   niveau du module et non dans un contexte React : les couches vivent
   dans des portails différents et ne se voient pas l'une l'autre par
   l'arbre. Voir l'en-tête. */
const STACK: HTMLElement[] = [];

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

  /* CE QUE FAIT ÉCHAP, TOUJOURS À JOUR, ET HORS DES DÉPENDANCES. Voir
     l'en-tête : le mettre dans la liste remonte le piège à chaque rendu
     de l'appelant, et le focus se met à faire des allers-retours. */
  const shut = useRef(onClose);
  useEffect(() => {
    shut.current = onClose;
  });

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

    STACK.push(node);

    const onKey = (e: KeyboardEvent) => {
      /* SEULE LA COUCHE DU DESSUS A LA MAIN. Sans cette ligne, celle du
         dessous rapatrie le focus qu'elle ne voit pas chez elle, et
         Échap ferme les deux d'un coup. */
      if (STACK[STACK.length - 1] !== node) return;
      if (e.key === "Escape" && shut.current) {
        e.stopPropagation();
        shut.current();
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
      /* PAR IDENTITÉ ET NON PAR `pop()` : deux couches peuvent se
         démonter dans un ordre que personne ne contrôle — une vue qui
         change emporte les siennes en vrac. */
      const at = STACK.indexOf(node);
      if (at >= 0) STACK.splice(at, 1);
      /* LA MAIN REVIENT D'OÙ ELLE VENAIT. Sans cette ligne, fermer un
         panneau renvoie au tout début du document, et il faut retraverser
         la page pour retrouver le bouton qu'on vient d'utiliser. */
      came?.focus?.();
    };
    /* AU MONTAGE, ET UNE SEULE FOIS. `autoFocus` est un booléen que
       personne ne fait varier en cours de route. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  return box;
}
