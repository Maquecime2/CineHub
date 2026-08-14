/* ============================================================
   FILING FROM THE WALL — one film, or thirty
   ============================================================

   Everything the wall needs in order to file films lives here rather
   than in `LibraryView`, which already holds the search, the filters,
   the sort, the grouping and two presentations. This is a driver: it
   holds who is chosen, which badge is open, and it hands back the object
   `FilmWall` passes down to each card.

   IT ANSWERS `undefined` WHEN THERE IS NOTHING TO FILE INTO — no server,
   no account, or a server that would not say. The wall then draws
   exactly what it drew before, with no badge and no bar: a feature that
   needs the network must be INVISIBLE without it, not disabled.

   THE PANEL IS NOT CLOSED BY FILING, and that is the fix for the thing
   that read as a bug. Closing on success destroyed the one message the
   panel existed to deliver — "filed", "already there" — and in the
   multiple selection it took the footer bar down with it, which looked
   exactly like the whole feature falling over. A panel is closed by the
   person who opened it.
   ============================================================ */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListPlus, Trash2, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../../components/ui/Layer";
import { Confirmation } from "../../components/ui";
import type { ConfirmRequest } from "../../components/ui";
import { ListFiler, type Fileable } from "../../components/film/ListFiler";
import { FilingPopover } from "../../components/film/FilingPopover";
import type { Filing as FilingHere } from "../../components/film/filing";
import { useMyLists } from "../../hooks/useMyLists";
import type { Film } from "../../types";
import type { Filing } from "./FilmWall";

/* A list holds WORKS, not copies: a card typed in by hand has no
   identity in common with the same film at somebody else's. So the ones
   without a `tmdbId` are set aside — and counted, so that they can be
   named rather than silently dropped. */
const fileable = (films: Film[]) => films.filter((f) => f.tmdbId);

const worksOf = (films: Film[]): Fileable[] =>
  fileable(films).map((f) => ({ tmdbId: f.tmdbId!, title: f.title, year: f.year }));

export function useWallFiling(
  films: Film[],
  /* SUPPRIMER PLUSIEURS FICHES D'UN COUP. Le geste existait au fond
     d'une fiche ouverte, une par une — donc pour faire du ménage il
     fallait ouvrir, descendre, confirmer, revenir, recommencer. Ici on
     coche et on efface.

     La collection est réécrite UNE fois pour tout le lot : voir
     `deleteFilms` dans `App`. */
  onDeleteFilms?: (ids: string[]) => void
): {
  bundle: Filing | undefined;
  /** The "choose" button and the footer bar, for the wall to place. */
  bar: ReactNode;
  /** The single panel, in a layer. */
  panel: ReactNode;
  /** What the SHELF reads, which cannot be threaded down to its cases. */
  context: FilingHere | null;
} {
  const { t } = useTranslation();
  const lists = useMyLists();
  const [open, setOpen] = useState<{ id: string; at: DOMRect } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [asking, setAsking] = useState<ConfirmRequest | null>(null);

  const byId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);

  const close = useCallback(() => setOpen(null), []);

  const stop = () => {
    setSelecting(false);
    setChosen(new Set());
    setOpen(null);
  };

  const choose = (id: string) =>
    setChosen((was) => {
      const next = new Set(was);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /* CHOISIR N'EST PAS UNE FONCTION DE SERVEUR. Ce garde-fou renvoyait
     tout à `null` tant que « mes listes » n'avait pas répondu — donc la
     barre de sélection entière n'existait pas sans compte, ni sans
     réseau. C'était sans conséquence tant qu'elle ne servait qu'à
     classer dans une liste, qui est bien une fonction de serveur.

     Elle sert maintenant aussi à SUPPRIMER, et une fiche est de la
     donnée locale : la lier au réseau aurait rendu le ménage impossible
     hors ligne. Seul le classeur de listes attend donc `lists`
     maintenant ; le reste de la barre est là de toute façon. */

  const picked = [...chosen].map((id) => byId.get(id)).filter((f): f is Film => !!f);
  const openFilm = open ? byId.get(open.id) : undefined;

  const bundle: Filing = {
    openFor: open?.id ?? null,
    onOpenFor: (id, at) => setOpen(id && at ? { id, at } : null),
    label: t("lists.fileThis"),
    selecting,
    chosen,
    onChoose: choose,
  };

  /* ONE PANEL FOR THE WHOLE WALL, in a layer, placed from the badge that
     opened it. Hung inside its card it was clipped by the grid, and a
     windowed wall unmounted it the moment one scrolled. */
  const panel =
    open && openFilm ? (
      <FilingPopover at={open.at} onClose={close}>
        <ListFiler compact works={worksOf([openFilm])} strangers={openFilm.tmdbId ? 0 : 1} />
      </FilingPopover>
    ) : null;

  const bar = (
    <>
      {!selecting ? (
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
      ) : (
        <Layer>
          {/* `position: fixed` INSIDE THE VIEW COLUMN WOULD NOT BE FIXED
              AT ALL: `[data-enters]` carries a transform while it
              animates in, and anything fixed inside it anchors to the
              column instead of the window (see CLAUDE.md). Hence
              `Layer`, which renders this in the document body. */}
          <div
            data-tour="wall-choose-bar"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 45,
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              flexWrap: "wrap",
              padding: "12px 16px calc(12px + var(--safe-bottom))",
              background: C.paper,
              borderTop: `1px solid ${C.line}`,
              boxShadow: `0 -6px 22px ${alpha(C.ink, 0.22)}`,
              animation: "drawerIn var(--motion-fast) var(--motion-ease) backwards",
            }}
          >
            <div style={{ flex: "1 1 170px", minWidth: 0, paddingTop: 4 }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.ink, letterSpacing: 1 }}>
                {chosen.size === 0
                  ? t("lists.selectNone")
                  : t("lists.selected", { count: chosen.size })}
              </div>
            </div>

            {/* THE PANEL STAYS PUT ONCE SOMETHING IS FILED. It used to
                clear the selection on success, which closed the bar,
                which erased the confirmation — the gesture undid the
                only proof it had worked. One chooses thirty films to
                file them into two lists as often as one. */}
            {chosen.size > 0 && lists && (
              <div style={{ flex: "0 1 250px", minWidth: 210 }}>
                <ListFiler
                  compact
                  works={worksOf(picked)}
                  strangers={picked.length - fileable(picked).length}
                />
              </div>
            )}

            {/* EFFACER, et c'est le seul geste de cette barre qui ne se
                défait pas — d'où la carte de confirmation, qui nomme
                combien de fiches partent. Les affiches suivent : une
                affiche sans fiche n'est plus une affiche, c'est du poids
                dans la mémoire du navigateur. */}
            {chosen.size > 0 && onDeleteFilms && (
              <button
                onClick={() =>
                  setAsking({
                    title: t("lists.deleteTitle", { count: chosen.size }),
                    body: t("lists.deleteBody"),
                    action: t("lists.deleteAction"),
                    severe: true,
                    onConfirm: () => {
                      onDeleteFilms([...chosen]);
                      setAsking(null);
                      stop();
                    },
                  })
                }
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  gap: 5,
                  padding: "6px 10px",
                  fontFamily: F.mono,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: C.burgundy,
                  border: `1px solid ${alpha(C.burgundy, 0.5)}`,
                }}
              >
                <Trash2 size={12} /> {t("lists.deleteChosen", { count: chosen.size })}
              </button>
            )}

            <button
              onClick={stop}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                gap: 5,
                padding: "6px 8px",
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: C.inkFaded,
              }}
            >
              <X size={13} /> {t("lists.selectDone")}
            </button>
          </div>
        </Layer>
      )}
      <Confirmation request={asking} onClose={() => setAsking(null)} />
    </>
  );

  return {
    bundle,
    bar,
    panel,
    /* The shelf raises the SAME panel by the same means — one film,
       anchored to the badge that asked. It is the badge on the wall that
       is threaded as a prop and the one on the shelf that is read from a
       context; what they open is one object. */
    context: {
      label: t("lists.fileThis"),
      onFile: (film, at) => setOpen({ id: film.id, at }),
    },
  };
}
