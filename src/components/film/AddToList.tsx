/* ============================================================
   FILING THIS FILM IN A LIST
   ============================================================

   THE GESTURE STARTS FROM THE CARD, and not from the lists view: it is
   here that one has the film before one's eyes, and above all its work
   identifier. Filling a list from the lists view would have required
   rebuilding an entire TMDB search there — the same work, in a place
   where there is nothing to look at.

   Hence the corollary: a card WITHOUT a `tmdbId` is filed nowhere, and
   that is not a defect. A list contains works, not copies; a film entered
   by hand has no identity in common with the same film at somebody
   else's.
   ============================================================ */
import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Label } from "../ui";
import { myLists, addToList, serverConfigured, type List } from "../../services/server";
import type { Film } from "../../types";

export function AddToList({ film, signedIn }: { film: Film; signedIn: boolean }) {
  const [lists, setListes] = useState<List[]>([]);
  const [choice, setChoix] = useState("");
  const [told, setDit] = useState<string | null>(null);

  useEffect(() => {
    if (!serverConfigured() || !signedIn || !film.tmdbId) return;
    let alive = true;
    myLists()
      .then((r) => alive && setListes(r.listes))
      /* A server breakdown must not make the card speak: the section
         disappears, the binder carries on. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn, film.tmdbId]);

  if (!film.tmdbId || lists.length === 0) return null;

  const file = async () => {
    if (!choice) return;
    const r = await addToList(choice, {
      tmdbId: film.tmdbId!,
      titre: film.title,
      annee: film.year,
    });
    /* "Already in it" is not an error: it is the same gesture, and it
       deserves the same calm answer. */
    setDit(r.neuf ? "rangé" : "y était déjà");
  };

  return (
    <div data-tour="detail-listes" style={{ marginTop: 18 }}>
      <Label>Ranger dans une liste</Label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        <select
          value={choice}
          onChange={(e) => {
            setChoix(e.target.value);
            setDit(null);
          }}
          style={{
            ...tap,
            fontFamily: F.mono,
            fontSize: 11,
            color: C.ink,
            background: "transparent",
            border: `1px solid ${C.line}`,
            padding: "5px 8px",
            maxWidth: 220,
          }}
        >
          <option value="">choisir…</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.titre}
            </option>
          ))}
        </select>
        <button
          onClick={file}
          disabled={!choice}
          style={{
            all: "unset",
            ...tap,
            cursor: choice ? "pointer" : "not-allowed",
            gap: 5,
            padding: "6px 10px",
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1,
            color: C.card,
            background: choice ? C.moss : C.line,
          }}
        >
          <ListPlus size={12} /> RANGER
        </button>
        {told && (
          <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>{told}</span>
        )}
      </div>
    </div>
  );
}
