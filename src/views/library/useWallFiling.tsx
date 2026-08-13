/* ============================================================
   RANGER DEPUIS LE MUR — un film, ou trente
   ============================================================

   Everything the wall needs in order to file films lives here rather
   than in `LibraryView`, which already holds the search, the filters,
   the sort, the grouping and two presentations. This is a driver: it
   holds who is chosen, whose panel is open, and it hands back the object
   `FilmWall` passes down to each card.

   IT ANSWERS `null` WHEN THERE IS NOTHING TO FILE INTO — no server, no
   account, or a server that would not say. The wall then draws exactly
   what it drew before, with no badge and no bar: a feature that needs
   the network must be INVISIBLE without it, not disabled.
   ============================================================ */
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListPlus, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../../components/ui/Layer";
import { ListFiler, type Fileable } from "../../components/film/ListFiler";
import { useMyLists } from "../../hooks/useMyLists";
import type { Film } from "../../types";
import type { Filing } from "./FilmWall";

/* A list holds WORKS, not copies: a card typed in by hand has no
   identity in common with the same film at somebody else's. So the ones
   without a `tmdbId` are set aside — and counted, so that they can be
   named rather than silently dropped. */
const fileable = (films: Film[]) => films.filter((f) => f.tmdbId);

export function useWallFiling(films: Film[]): {
  bundle: Filing | undefined;
  bar: ReactNode;
} {
  const { t } = useTranslation();
  const lists = useMyLists();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());

  const byId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);

  const stop = () => {
    setSelecting(false);
    setChosen(new Set());
    setOpenFor(null);
  };

  const choose = (id: string) =>
    setChosen((was) => {
      const next = new Set(was);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /* `lists` is `null` while it is being read, and stays `null` if the
     server refused: in both cases the wall is the wall it was. */
  if (!lists) return { bundle: undefined, bar: null };

  const picked = [...chosen].map((id) => byId.get(id)).filter((f): f is Film => !!f);
  const worksOf = (list: Film[]): Fileable[] =>
    fileable(list).map((f) => ({ tmdbId: f.tmdbId!, title: f.title, year: f.year }));

  const bundle: Filing = {
    openFor,
    onOpenFor: setOpenFor,
    label: t("lists.fileThis"),
    selecting,
    chosen,
    onChoose: choose,
    panelFor: (film) => (
      <ListFiler
        compact
        works={worksOf([film])}
        strangers={film.tmdbId ? 0 : 1}
        onDone={() => setOpenFor(null)}
      />
    ),
  };

  const bar = (
    <Layer>
      {/* `position: fixed` INSIDE THE VIEW COLUMN WOULD NOT BE FIXED AT
          ALL: `[data-enters]` carries a transform while it animates in,
          and anything fixed inside it anchors to the column instead of
          the window (see CLAUDE.md). Hence `Layer`, which renders this
          in the document body. */}
      <div
        data-tour="wall-choose-bar"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 45,
          display: selecting ? "flex" : "none",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          padding: "12px 16px calc(12px + var(--safe-bottom))",
          background: C.paper,
          borderTop: `1px solid ${C.line}`,
          boxShadow: `0 -6px 22px ${alpha(C.ink, 0.22)}`,
        }}
      >
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.ink, letterSpacing: 1 }}>
            {chosen.size === 0
              ? t("lists.selectNone")
              : t("lists.selected", { count: chosen.size })}
          </div>
        </div>
        {chosen.size > 0 && (
          <ListFiler
            compact
            works={worksOf(picked)}
            strangers={picked.length - fileable(picked).length}
            onDone={stop}
          />
        )}
        <button onClick={stop} style={{ all: "unset", ...tap, cursor: "pointer", padding: 8 }}>
          <X size={14} color={C.inkFaded} />{" "}
          <span style={{ fontFamily: F.mono, fontSize: 10 }}>{t("lists.selectDone")}</span>
        </button>
      </div>
    </Layer>
  );

  return {
    bundle,
    bar: (
      <>
        {!selecting && (
          <button
            data-tour="wall-choose"
            onClick={() => setSelecting(true)}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              gap: 5,
              marginBottom: 10,
              padding: "5px 9px",
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 1,
              color: C.inkFaded,
              border: `1px dashed ${C.line}`,
            }}
          >
            <ListPlus size={11} /> {t("lists.select")}
          </button>
        )}
        {bar}
      </>
    ),
  };
}
