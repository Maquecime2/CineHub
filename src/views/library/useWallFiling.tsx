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
import { ListPlus, Tag, Trash2, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../../components/ui/Layer";
import { Confirmation } from "../../components/ui";
import type { ConfirmRequest } from "../../components/ui";
import { ListFiler, type Fileable } from "../../components/film/ListFiler";
import { FilingPopover } from "../../components/film/FilingPopover";
import type { Filing as FilingHere } from "../../components/film/filing";
import { useMyLists } from "../../hooks/useMyLists";
import { allMotifs, motifLabel } from "../../domain/motifs";
import type { Film } from "../../types";
import { posterPathOf } from "../../tmdb";
import type { Filing } from "./FilmWall";

/* A list holds WORKS, not copies: a card typed in by hand has no
   identity in common with the same film at somebody else's. So the ones
   without a `tmdbId` are set aside — and counted, so that they can be
   named rather than silently dropped. */
const fileable = (films: Film[]) => films.filter((f) => f.tmdbId);

const worksOf = (films: Film[]): Fileable[] =>
  fileable(films).map((f) => ({
    tmdbId: f.tmdbId!,
    title: f.title,
    year: f.year,
    posterPath: posterPathOf(f.poster),
  }));

export function useWallFiling(
  films: Film[],
  /* SUPPRIMER PLUSIEURS FICHES D'UN COUP. Le geste existait au fond
     d'une fiche ouverte, une par une — donc pour faire du ménage il
     fallait ouvrir, descendre, confirmer, revenir, recommencer. Ici on
     coche et on efface.

     La collection est réécrite UNE fois pour tout le lot : voir
     `deleteFilms` dans `App`. */
  onDeleteFilms?: (ids: string[]) => void,
  /* ÉTIQUETER EN LOT — le troisième verbe de la barre, et le dernier à
     être arrivé. On classait et on effaçait par trente ; poser un motif
     se faisait encore fiche par fiche, alors que c'est exactement le
     geste qu'on fait en série — on vient de voir six films d'un même
     cinéaste et on veut les marquer d'un mot.

     UN MOTIF, PAS UN THÈME LIBRE. Les deux sont locaux, mais le
     vocabulaire des motifs est CLOS : trente champs de texte remplis à
     la main, c'est trente occasions de faute de frappe, et un mot mal
     orthographié sur six fiches ne se rattrape qu'à la main. Un
     catalogue fini n'a pas ce défaut.

     Les fiches sont réécrites UNE fois pour tout le lot : voir
     `updateMany` dans `App`. */
  onUpdateMany?: (patches: Record<string, Partial<Film>>) => void
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
  /* Le choix du mot, ouvert par la barre. `null` : fermé. */
  const [tagging, setTagging] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [asking, setAsking] = useState<ConfirmRequest | null>(null);

  const byId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);

  const close = useCallback(() => setOpen(null), []);

  const stop = () => {
    setSelecting(false);
    setChosen(new Set());
    setOpen(null);
    setTagging(false);
  };

  /* POSER UN MOT SUR TOUT LE LOT, en une écriture.
     `Set` plutôt qu'un `push` : reposer un motif que la fiche porte déjà
     ne doit pas le doubler, et la barre reste utilisable deux fois de
     suite sans rien salir. Les fiches qui l'ont déjà ne sont pas dans
     les correctifs — inutile de les réécrire. */
  const tagAll = (motifId: string) => {
    if (!onUpdateMany) return;
    const patches: Record<string, Partial<Film>> = {};
    for (const id of chosen) {
      const f = byId.get(id);
      if (!f || (f.motifs ?? []).includes(motifId)) continue;
      patches[id] = { motifs: [...new Set([...(f.motifs ?? []), motifId])] };
    }
    if (Object.keys(patches).length) onUpdateMany(patches);
    setTagging(false);
  };

  const choose = useCallback(
    (id: string) =>
      setChosen((was) => {
        const next = new Set(was);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    []
  );

  const openFor = useCallback(
    (id: string | null, at?: DOMRect) => setOpen(id && at ? { id, at } : null),
    []
  );

  const onFile = useCallback((film: Film, at: DOMRect) => setOpen({ id: film.id, at }), []);

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

  /* THE BUNDLE IS MEMOISED, AND IT IS NOT A DETAIL.
     It goes down to every card on the wall, and a fresh object literal
     at each render made `FilmPolaroid`'s `memo` a pure formality — one
     letter typed in the search redrew five hundred cards, gradients,
     shadows and rotations included. Which is also why the three
     functions above are held rather than written here. */
  const fileThis = t("lists.fileThis");
  const bundle: Filing = useMemo(
    () => ({
      openFor: open?.id ?? null,
      onOpenFor: openFor,
      label: fileThis,
      selecting,
      chosen,
      onChoose: choose,
    }),
    [open?.id, openFor, fileThis, selecting, chosen, choose]
  );

  /* ONE PANEL FOR THE WHOLE WALL, in a layer, placed from the badge that
     opened it. Hung inside its card it was clipped by the grid, and a
     windowed wall unmounted it the moment one scrolled. */
  const panel = (
    <>
      {open && openFilm ? (
        <FilingPopover at={open.at} onClose={close}>
          <ListFiler compact works={worksOf([openFilm])} strangers={openFilm.tmdbId ? 0 : 1} />
        </FilingPopover>
      ) : null}

      {/* LE CHOIX DU MOT, posé au-dessus de la barre.

          UNE LISTE ET PAS UN CHAMP : le vocabulaire est clos, donc on le
          MONTRE. Un champ de texte sur trente fiches, c'est trente
          occasions de faute de frappe, et un mot mal orthographié ne se
          rattrape qu'à la main.

          Par `Layer`, comme la barre elle-même : `position: fixed` dans
          la colonne de vue ne serait pas fixe du tout (voir CLAUDE.md). */}
      {tagging && (
        <Layer>
          <div
            onClick={() => setTagging(false)}
            data-veil
            style={{ position: "fixed", inset: 0, zIndex: 44 }}
          />
          <div
            role="dialog"
            /* AVEC SON `count`, sinon rien ne sort. La clé n'existe
               qu'au pluriel (`_one` / `_other`) : appelée sans compte,
               i18next ne peut pas choisir et rend la CLÉ telle quelle.
               Ça ne se voit pas à l'œil — seule une synthèse vocale lit
               cette étiquette, et elle aurait annoncé
               « lists.tagTitle ». */
            aria-label={t("lists.tagTitle", { count: chosen.size })}
            style={{
              position: "fixed",
              left: "50%",
              bottom: "calc(96px + var(--safe-bottom))",
              transform: "translateX(-50%)",
              zIndex: 45,
              width: "min(420px, 92vw)",
              maxHeight: "46vh",
              overflowY: "auto",
              background: C.card,
              border: `1px solid ${C.line}`,
              boxShadow: `2px 8px 24px ${alpha(C.ink, 0.34)}`,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                color: C.inkFaded,
                marginBottom: 8,
              }}
            >
              {t("lists.tagTitle", { count: chosen.size })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allMotifs().map((m) => (
                <button
                  key={m.id}
                  onClick={() => tagAll(m.id)}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    padding: "5px 10px",
                    fontFamily: F.body,
                    fontSize: 13,
                    color: C.ink,
                    border: `1px solid ${C.line}`,
                  }}
                >
                  {motifLabel(m, t)}
                </button>
              ))}
            </div>
          </div>
        </Layer>
      )}
    </>
  );

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

            {chosen.size > 0 && onUpdateMany && (
              <button
                onClick={() => setTagging(true)}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  gap: 5,
                  padding: "6px 10px",
                  fontFamily: F.mono,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: C.inkFaded,
                  border: `1px solid ${C.line}`,
                }}
              >
                <Tag size={12} /> {t("lists.tagChosen", { count: chosen.size })}
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

  /* The shelf raises the SAME panel by the same means — one film,
     anchored to the badge that asked. It is the badge on the wall that
     is threaded as a prop and the one on the shelf that is read from a
     context; what they open is one object.

     Memoised for the same reason as the bundle: a context value rebuilt
     at every render re-renders every case on the shelf that reads it. */
  const context: FilingHere = useMemo(() => ({ label: fileThis, onFile }), [fileThis, onFile]);

  return { bundle, bar, panel, context };
}
