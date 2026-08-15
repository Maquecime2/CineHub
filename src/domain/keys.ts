/* ============================================================
   LES RACCOURCIS — et la seule chose qui les rend acceptables
   ============================================================

   Il n'y en avait qu'un, `Ctrl+K` pour la recherche, avec la bonne
   remarque en commentaire : un raccourci ne se devine pas, donc le
   chemin visible reste le bouton. Ce module en ajoute deux, et ils sont
   d'une autre nature — `/` et `?` sont des touches NUES.

   D'OÙ `isTyping`, QUI EST TOUT LE SUJET. Une touche nue interceptée
   pendant qu'on écrit une critique ouvre un tiroir au milieu d'une
   phrase et avale le caractère. C'est le défaut classique de ce genre de
   raccourci, il se voit tout de suite, et il fait détester la
   fonctionnalité entière.

   On regarde donc l'élément qui a le focus, et pas seulement son nom de
   balise : un `contenteditable` n'est ni un `input` ni un `textarea`, et
   le carnet s'en sert. `select` compte aussi — la barre d'espace et les
   lettres y naviguent.

   `Ctrl+K` n'a pas ce problème et garde sa règle à part : une
   combinaison ne se tape pas par accident, et on la veut disponible même
   depuis un champ, parce que c'est là qu'on est quand on cherche.
   ============================================================ */

/** Ce qu'un raccourci demande d'ouvrir. */
export type Shortcut = "search" | "help";

/** Le focus est-il dans quelque chose qui reçoit du texte ? */
export function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  /* DEUX FAÇONS DE LE SAVOIR, ET IL FAUT LES DEUX.

     `isContentEditable` est la bonne : elle remonte l'héritage toute
     seule, là où l'attribut ne dit que ce qui est écrit sur l'élément
     lui-même. Mais jsdom NE L'IMPLÉMENTE PAS — elle y vaut toujours
     `false` —, donc s'y fier seul rendait ce chemin invérifiable, et un
     chemin qu'on ne peut pas éprouver est exactement celui qui casse.

     `closest` remonte aussi, et fonctionne partout. Le `:not(…="false")`
     n'est pas une précaution en l'air : c'est ainsi qu'on rend un îlot
     non modifiable au milieu d'une zone qui l'est. */
  if ((el as HTMLElement).isContentEditable === true) return true;
  return el.closest?.('[contenteditable]:not([contenteditable="false"])') != null;
}

/**
 * Quel raccourci cette frappe demande, s'il y en a un.
 *
 * Rend `null` pour tout le reste — y compris pour une touche nue tapée
 * dans un champ, et pour toute frappe portant un modificateur qu'on n'a
 * pas prévu : `Alt+/` appartient au navigateur ou au système, et le
 * prendre au passage est le genre de vol qu'on ne pardonne pas.
 */
export function shortcutOf(e: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
}): Shortcut | null {
  /* La combinaison d'abord : elle marche même dans un champ. */
  if (e.key?.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) return "search";

  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (isTyping((e.target as Element | null) ?? null)) return null;

  /* `?` s'obtient avec Maj sur la plupart des dispositions, donc on ne
     peut pas refuser Maj ici — on lit le CARACTÈRE produit, qui est la
     seule chose portable entre un clavier français et un autre. */
  if (e.key === "/") return "search";
  if (e.key === "?") return "help";
  return null;
}
