/* ============================================================
   FINDING THE CARDS FLIPPED BY MISTAKE
   ============================================================

   "Complete the cards" spent a long time flipping the cards it enriched
   from "to watch" → "watched" (see `keepStatus` in `importing`). The
   button is fixed, but collections already flipped do not repair
   themselves: nothing in the data says "this film was on the watchlist
   yesterday".

   NOTHING — EXCEPT A FINGERPRINT. A card flipped along that path carries
   the trace of what NEVER happened to it: TMDB enrichment writes no
   screening, no date, no rating, no text. A "watched" card with none of
   the four has never been opened by anyone — it is almost certainly a
   wish, not a memory.

   "Almost" is the important word, and that is why this module only ever
   POINTS THINGS OUT. A film genuinely watched, never rated, never dated
   and never commented on does exist — rare, but it exists. So the list is
   read back card by card before anything is written, and the caller
   decides. */
import type { Film } from "../types";

/** The four traces a viewing leaves, and that an enrichment does not. */
export const hasWatchTrace = (f: Film): boolean =>
  (f.watches || []).length > 0 ||
  !!f.watchedAt ||
  (f.rating || 0) > 0 ||
  !!(f.review || "").trim() ||
  !!(f.notes || "").trim();

/**
 * The "watched" cards that look like wishes.
 *
 * Sorted the way they will be read back: the ones from Letterboxd first —
 * those are the ones a watchlist export had laid down, and the most
 * likely — then by title.
 */
export const flippedByMistake = (films: Film[]): Film[] =>
  films
    .filter((f) => f.status === "watched" && !f.archived && !hasWatchTrace(f))
    .sort(
      (a, b) =>
        Number(b.source === "letterboxd") - Number(a.source === "letterboxd") ||
        a.title.localeCompare(b.title)
    );
