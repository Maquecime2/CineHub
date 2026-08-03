import type { FilmStatus } from "../../types";

/** Les clés de tri proposées sous l'en-tête d'un mur. */
export type SortKey = "watched" | "added" | "title" | "year" | "rating" | "director";

/**
 * L'état de consultation d'un mur. Il vit dans `App` et non dans la vue :
 * ouvrir un film démonte la vue, et un état local serait perdu au retour.
 *
 * Le nombre de boîtiers par ligne n'y figure pas : depuis les vues
 * d'étagère, il se règle ligne par ligne et vit dans la vue elle-même.
 */
export interface WallUi {
  q: string;
  genreFilter: string;
  sortBy: SortKey;
  desc: boolean;
  grouped: boolean;
  mode: "wall" | "shelf";
}

export interface WallConfig {
  stamp: string;
  title: string;
  subtitle: string;
  underline: number;
  defaultSort: SortKey;
  sorts: [SortKey, string][];
  /** Titre puis invite, quand le rayon est vide. */
  empty: [string, string];
}

/* Le même mur sert la vidéothèque et la liste « à voir » : seules changent
   l'en-tête, les tris proposés et l'invite quand il n'y a rien. */
export const WALLS: Record<FilmStatus, WallConfig> = {
  watched: {
    stamp: "CATALOGUE",
    title: "Votre vidéothèque",
    subtitle: "un mur d'affiches, de notes et de souvenirs de séances",
    underline: 330,
    // la dernière séance d'abord : c'est l'ordre dans lequel on se souvient
    defaultSort: "watched",
    sorts: [
      ["watched", "vus récemment"],
      ["added", "ajoutés"],
      ["title", "A–Z"],
      ["year", "année"],
      ["rating", "note"],
      ["director", "réalisateur"],
    ],
    empty: ["Le mur est encore vide", "Épinglez votre premier film pour commencer la collection."],
  },
  watchlist: {
    stamp: "À VOIR",
    title: "Le coin des envies",
    subtitle: "les films mis de côté, en attente d'une séance",
    underline: 300,
    defaultSort: "added",
    sorts: [
      ["added", "ajoutés"],
      ["title", "A–Z"],
      ["year", "année"],
      ["director", "réalisateur"],
    ],
    empty: [
      "Aucune envie en attente",
      "Importez votre watchlist Letterboxd, ou épinglez un film « à voir ».",
    ],
  },
};
