/* ============================================================
   CE QU'ON MET SUR UNE CARTE QU'ON PARTAGE
   ============================================================

   Une fiche partagée quitte le classeur : elle part dans une
   conversation, sur un réseau, chez quelqu'un qui n'a pas l'application.
   C'est le seul canal d'acquisition gratuit du produit, et c'est aussi
   la seule chose qui sorte VOLONTAIREMENT — d'où le soin.

   CE MODULE NE DESSINE RIEN. Il décide ce qui figure, dans quel ordre,
   et où couper. Le dessin est dans `services/shareImage` ; séparer les
   deux permet d'éprouver le choix des mots, qui est la partie qui se
   trompe — un canevas ne se teste pas, une troncature si.

   ------------------------------------------------------------
   CE QUI N'Y VA PAS, ET C'EST LA MOITIÉ DU SUJET
   ------------------------------------------------------------

   PAS DE SÉANCES, PAS DE DATES, PAS DE LISTES. Une carte partagée dit
   ce qu'on pense d'un film, pas quand on l'a vu ni combien de fois : ce
   sont des habitudes, et une habitude publiée ne se reprend pas. On
   partage un avis, on ne publie pas un journal.

   LA CRITIQUE EST COUPÉE COURT, et pas seulement pour tenir dans le
   cadre : une critique entière lue ailleurs qu'à sa place perd son
   contexte, et son auteur ne l'avait pas écrite pour ça. Deux phrases
   donnent envie ; la suite appartient au classeur.
   ============================================================ */
import type { Film } from "../types";

export interface CardFacts {
  title: string;
  /** « 1979 · Andreï Tarkovski », ou l'un des deux, ou rien. */
  line: string;
  /** De 0 à 5, arrondi au demi. `null` quand la fiche n'est pas notée. */
  rating: number | null;
  /** Un extrait de la critique, ou une chaîne vide. */
  excerpt: string;
}

/** Au-delà, on coupe : voir l'en-tête pour pourquoi c'est court. */
export const EXCERPT_MAX = 180;

/**
 * Coupe à la limite SANS casser un mot, et pose une ellipse.
 *
 * On recule jusqu'à la dernière espace plutôt que de trancher net : un
 * mot amputé donne l'air d'un bogue, pas d'un extrait. Et si le texte
 * n'a aucune espace avant la limite — un seul mot très long —, on
 * tranche quand même, parce qu'il faut bien s'arrêter.
 */
export function shorten(text: string, max = EXCERPT_MAX): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/** Ce qu'une fiche donne à voir une fois sortie du classeur. */
export function cardFacts(film: Film): CardFacts {
  const year = film.year ? String(film.year) : "";
  const director = (film.director || "").trim();
  return {
    title: (film.title || "").trim(),
    /* Le point médian ne paraît que s'il a quelque chose des deux côtés :
       « 1979 · » tout seul est une coquille à l'écran de quelqu'un. */
    line: [year, director].filter(Boolean).join(" · "),
    rating: typeof film.rating === "number" && film.rating > 0 ? film.rating : null,
    excerpt: shorten(film.review || ""),
  };
}
