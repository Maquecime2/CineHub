/* ============================================================
   FILING THIS FILM IN A LIST, FROM ITS CARD
   ============================================================

   This place remains — it is where one has the film open — but it is no
   longer the ONLY one: the same gesture now sits on a poster's badge and
   under a multiple selection. The choosing itself lives in `ListFiler`,
   which all three share; what is left here is the one thing proper to
   the card, namely knowing whether this film can be filed at all.

   The old note said that filling a list from the lists view would have
   meant rebuilding a whole TMDB search there. That is now exactly what
   `ListsView` does — the relay made it cheap — so the note has gone with
   the reasoning it carried.

   WHAT HAS NOT CHANGED: a card without a `tmdbId` is filed nowhere. A
   list holds works, not copies; a film entered by hand has no identity
   in common with the same film at somebody else's.
   ============================================================ */
import { serverConfigured } from "../../services/server";
import { ListFiler } from "./ListFiler";
import type { Film } from "../../types";

export function AddToList({ film, signedIn }: { film: Film; signedIn: boolean }) {
  if (!serverConfigured() || !signedIn || !film.tmdbId) return null;

  return (
    <div data-tour="detail-lists" style={{ marginTop: 18 }}>
      <ListFiler works={[{ tmdbId: film.tmdbId, title: film.title, year: film.year }]} />
    </div>
  );
}
