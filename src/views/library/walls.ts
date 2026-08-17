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
  /** Les genres retenus. Vide : tous. */
  genreFilter: string[];
  /** Les décennies retenues, en texte. Vide : toutes. */
  decadeFilter: string[];
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
/* CATALOGUE KEYS, NOT SENTENCES. `stamp`, `title`, `subtitle`, the name
   of each sort and the two lines of the empty wall all read from the
   catalogue: `LibraryView` resolves them. Only `defaultSort` and the sort
   IDS are data — they are written into the saved wall settings. */
export const WALLS: Record<FilmStatus, WallConfig> = {
  watched: {
    stamp: "walls.watched.stamp",
    title: "walls.watched.title",
    subtitle: "walls.watched.subtitle",
    underline: 330,
    // the latest screening first: that is the order in which one remembers
    defaultSort: "watched",
    sorts: [
      ["watched", "walls.sort.watched"],
      ["added", "walls.sort.added"],
      ["title", "walls.sort.title"],
      ["year", "walls.sort.year"],
      ["rating", "walls.sort.rating"],
      ["director", "walls.sort.director"],
    ],
    empty: ["walls.watched.emptyTitle", "walls.watched.emptyBody"],
  },
  watchlist: {
    stamp: "walls.watchlist.stamp",
    title: "walls.watchlist.title",
    subtitle: "walls.watchlist.subtitle",
    underline: 300,
    defaultSort: "added",
    sorts: [
      ["added", "walls.sort.added"],
      ["title", "walls.sort.title"],
      ["year", "walls.sort.year"],
      ["director", "walls.sort.director"],
    ],
    empty: ["walls.watchlist.emptyTitle", "walls.watchlist.emptyBody"],
  },
};
