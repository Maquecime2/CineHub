/* ============================================================
   RETROUVER LES FICHES BASCULÉES PAR ERREUR
   ============================================================

   « Compléter les fiches » a longtemps fait passer « à voir » → « vu »
   les fiches qu'il enrichissait (voir `garderStatut` dans `importing`).
   Le bouton est réparé, mais les collections déjà basculées ne se
   réparent pas toutes seules : rien, dans les données, ne dit « ce film
   était à voir hier ».

   RIEN — SAUF UNE EMPREINTE. Une fiche basculée par ce chemin porte la
   trace de ce qui NE lui est jamais arrivé : l'enrichissement TMDB
   n'écrit ni séance, ni date, ni note, ni texte. Une fiche « vue » qui
   n'a aucune des quatre n'a jamais été ouverte par personne — elle est
   presque sûrement une envie, pas un souvenir.

   « Presque » est le mot important, et c'est pourquoi ce module ne fait
   que DÉSIGNER. Un film réellement vu, jamais noté, jamais daté et
   jamais commenté existe — rare, mais il existe. La liste se relit donc
   fiche par fiche avant qu'on écrive quoi que ce soit, et l'appelant
   décide. */
import type { Film } from "../types";

/** Les quatre traces qu'un visionnage laisse, et qu'un enrichissement ne laisse pas. */
export const porteUneTraceDeVisionnage = (f: Film): boolean =>
  (f.watches || []).length > 0 ||
  !!f.watchedAt ||
  (f.rating || 0) > 0 ||
  !!(f.review || "").trim() ||
  !!(f.notes || "").trim();

/**
 * Les fiches « vues » qui ressemblent à des envies.
 *
 * Triées comme on les relira : les venues de Letterboxd d'abord — ce sont
 * celles qu'un relevé de watchlist avait posées, et les plus probables —
 * puis par titre.
 */
export const basculéesParErreur = (films: Film[]): Film[] =>
  films
    .filter((f) => f.status === "watched" && !f.archived && !porteUneTraceDeVisionnage(f))
    .sort(
      (a, b) =>
        Number(b.source === "letterboxd") - Number(a.source === "letterboxd") ||
        a.title.localeCompare(b.title)
    );
