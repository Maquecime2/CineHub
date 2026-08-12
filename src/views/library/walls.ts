import type { FilmStatus } from "../../types";

/** The sort keys offered under a wall's header. */
export type SortKey = "watched" | "added" | "title" | "year" | "rating" | "director";

/**
 * The browsing state of a wall. It lives in `App` and not in the view:
 * opening a film unmounts the view, and a local state would be lost on
 * the way back.
 *
 * The number of cases per line is not there: since the shelf views, it is
 * adjusted line by line and lives in the view itself.
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
  /** Title then prompt, when the shelf is empty. */
  empty: [string, string];
}

/* The same wall serves the film library and the "à voir" list: only the
   header, the offered sorts and the prompt when there is nothing
   change. */
export const WALLS: Record<FilmStatus, WallConfig> = {
  watched: {
    stamp: "CATALOGUE",
    title: "Votre vidéothèque",
    subtitle: "un mur d'affiches, de notes et de souvenirs de séances",
    underline: 330,
    // the latest screening first: that is the order in which one remembers
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
