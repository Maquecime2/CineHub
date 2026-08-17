/* ============================================================
   PUTTING A FILM INTO A RUN
   ============================================================

   IT SEARCHES THE WHOLE COLLECTION AND NOT ONLY "TO WATCH". Planning a
   rewatch is an ordinary plan — Ozu 1949, then Hou, then Ozu 1953 — and
   a picker that hid what one has seen would have made the commonest
   lineage of all impossible to write down.

   What is still true is that the ones one has NOT seen are the likelier
   answer, so they come first and say so. Anything else is a second
   thought, never a refusal. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, underlineInput } from "../../theme/styles";
import { searchFilms } from "../../domain/search";
import { primaryDirector } from "../../domain/lineageMap";
import type { Film } from "../../types";

interface FilmPickerProps {
  films: Film[];
  onPick: (film: Film) => void;
  /** Ce que dit le bouton d'ajout, selon qu'on ouvre un parcours ou qu'on l'allonge. */
  label: string;
  tour?: string;
}

export function FilmPicker({ films, onPick, label, tour }: FilmPickerProps) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");

  const found = useMemo(() => {
    if (!q.trim()) return [];
    const hits = searchFilms(films, q, t, 24);
    /* Not yet seen first, and the order WITHIN each half is left as the
       search ranked it: re-sorting on a second criterion would undo the
       relevance one just typed for. */
    return [...hits]
      .sort((a, b) => Number(b.status === "watchlist") - Number(a.status === "watchlist"))
      .slice(0, 8);
  }, [films, q, t]);

  return (
    <div data-tour={tour}>
      <label
        style={{
          display: "block",
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1,
          color: C.inkFaded,
          marginBottom: 4,
        }}
      >
        {label}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("lineage.pickPlaceholder")}
          style={{ ...underlineInput, marginTop: 4 }}
        />
      </label>

      {q.trim() && found.length === 0 && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {t("lineage.pickNothing")}
        </div>
      )}

      {found.length > 0 && (
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
          {found.map((film) => {
            const director = primaryDirector(film);
            return (
              <li key={film.id}>
                <button
                  onClick={() => {
                    onPick(film);
                    setQ("");
                  }}
                  style={{
                    ...bare,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    width: "100%",
                    padding: "5px 2px",
                    borderBottom: `1px solid ${alpha(C.line, 0.6)}`,
                    color: C.ink,
                  }}
                >
                  <Plus size={12} color={C.inkFaded} />
                  <span style={{ fontFamily: F.body, fontSize: 14 }}>{film.title}</span>
                  {director && (
                    <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                      {director.name}
                    </span>
                  )}
                  {film.status === "watchlist" && (
                    <span style={{ fontFamily: F.mono, fontSize: 9, color: C.ochre }}>
                      {t("lineage.notSeenYet")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
