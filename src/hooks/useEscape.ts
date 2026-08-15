/* ============================================================
   ÉCHAP FERME — et il fermait six fois sur douze
   ============================================================

   Le tiroir de recherche, celui du carnet, le cartouche de la clé, la
   visite et la visionneuse écoutaient déjà `Escape`, chacun pour soi.
   Six autres ne l'écoutaient pas du tout : le sélecteur de peaux, celui
   de la langue, le tiroir du compte, les mentions, la modale d'un film
   et le menu de la visite. Rien ne le disait, et c'est le genre de trou
   qu'on ne remarque qu'en y tombant — on tape Échap, il ne se passe
   rien, et on cherche la croix des yeux.

   UN CROCHET PLUTÔT QU'UN GESTIONNAIRE GLOBAL, et c'est délibéré : un
   seul écouteur au niveau de la fenêtre devrait savoir lequel des huit
   panneaux est au-dessus, donc tenir une pile, donc se tromper le jour
   où l'on en ajoute un neuvième. Ici, chaque panneau écoute pendant
   qu'il est monté, et le dernier monté est le dernier abonné.

   `capture` VOLONTAIREMENT ABSENT : sans lui, un champ qui traite déjà
   `Escape` — annuler une saisie en cours — le fait EN PREMIER, et le
   panneau ne se ferme qu'au second appui. C'est l'ordre qu'on veut :
   on annule ce qu'on écrit avant de fermer ce dans quoi on l'écrit.
   ============================================================ */
import { useEffect } from "react";

export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Un autre écouteur a déjà pris cette touche pour lui : on ne
         ferme pas par-dessus son travail. */
      if (e.defaultPrevented) return;
      onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}
