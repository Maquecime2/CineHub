/* ============================================================
   VIEW — FILM LIBRARY: the wall, or the shelf and its views.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pin,
  Plus,
  Trash2,
  LayoutGrid,
  Library,
  Paperclip,
  Dice5,
  FolderInput,
} from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, underlineInput, tap, tapSquare } from "../../theme/styles";
import { hash, tiltOf } from "../../domain/seeded";
import { matchFilm } from "../../domain/search";
import { CoffeeRing, TapeResidue, StampCorner, InkUnderline } from "../../components/atmosphere";
import { Label } from "../../components/ui";
import { ShelfBoard } from "../../components/shelf/ShelfBoard";
import { ShelfFind } from "../../components/shelf/ShelfFind";
import { StepBack } from "../../components/shelf/StepBack";
import { THEMES } from "../../components/shelf/constants";
import { DecorStudio } from "../../components/shelf/DecorStudio";
import {
  SHELF_KINDS,
  sortIntoRows,
  patchViewDecor,
  clearViewDecor,
  keepByHand,
  heldByHand,
  restoreByHand,
} from "../../shelf-views";
import { FilmWall } from "./FilmWall";
import { NextUp } from "../../components/program/NextUp";
import { useWallFiling } from "./useWallFiling";
import { FilingProvider } from "../../components/film/filing";
import { TonightDrawer } from "./TonightDrawer";
import { WallStudio } from "./WallStudio";
import { wallLookOf, DEFAULT_WALL_LOOK } from "./wallLook";
import { wallStyle } from "../../theme/surfaces";
import { catInk } from "../../components/shelf/constants";
import { WALLS } from "./walls";
import { Sieve } from "../../components/ui/Sieve";
import { Confirmation } from "../../components/ui/Confirmation";
import { FilmQuickView } from "../../components/film/FilmQuickView";
import { normalize } from "../../domain/search";

function ViewSwitcher({
  views,
  active,
  onPick,
  onCreate,
  onCreateByDirector,
  onCopy,
  onDelete,
  onRename,
  onTheme,
  onDecor,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(active?.name || "");
  useEffect(() => {
    setDraft(active?.name || "");
  }, [active?.name]);
  if (!active) return null;

  const commit = () => {
    setRenaming(false);
    const v = draft.trim();
    if (v && v !== active.name) onRename(v);
    else setDraft(active.name);
  };

  return (
    <div data-tour="wall-views" style={{ position: "relative" }}>
      <Label>Vue</Label>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("library.changeArrangement")}
        style={{
          all: "unset",
          ...tap,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 2,
          padding: "5px 12px",
          maxWidth: 190,
          fontFamily: F.mono,
          fontSize: 10.5,
          color: C.ink,
          background: C.paperDark,
          border: `1px solid ${C.line}`,
          borderRadius: "3px 3px 0 0",
        }}
      >
        <Library size={12} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {active.name}
        </span>
      </button>

      {open && (
        <>
          <div
            onClick={() => {
              setOpen(false);
              setRenaming(false);
            }}
            data-veil
            style={{ position: "fixed", inset: 0, zIndex: 42 }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "100%",
              zIndex: 43,
              width: 244,
              padding: "10px 12px",
              background: C.card,
              border: `1px solid ${C.line}`,
              boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
            }}
          >
            {views.map((v) => {
              const on = v.id === active.id;
              return (
                <div
                  key={v.id}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}
                >
                  {on && renaming ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") {
                          setDraft(active.name);
                          setRenaming(false);
                        }
                      }}
                      style={{
                        all: "unset",
                        ...tap,
                        flex: 1,
                        fontFamily: F.body,
                        fontSize: 13,
                        color: C.ink,
                        borderBottom: `1px solid ${C.line}`,
                      }}
                    />
                  ) : (
                    <button
                      onClick={() => {
                        onPick(v.id);
                        setOpen(false);
                      }}
                      style={{
                        all: "unset",
                        ...tap,
                        cursor: "pointer",
                        flex: 1,
                        fontFamily: F.body,
                        fontSize: 13,
                        color: on ? C.burgundy : C.ink,
                        textDecoration: on ? "underline" : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={v.name}
                    >
                      {v.name}
                    </button>
                  )}
                  {on && !renaming && (
                    <>
                      <button
                        onClick={() => setRenaming(true)}
                        title={t("library.rename")}
                        style={{
                          all: "unset",
                          ...tap,
                          cursor: "pointer",
                          color: C.inkFaded,
                          display: "flex",
                        }}
                      >
                        <Paperclip size={11} />
                      </button>
                      <button
                        onClick={() => onCopy(v.id)}
                        title={t("library.duplicateArrangement")}
                        style={{
                          all: "unset",
                          ...tap,
                          cursor: "pointer",
                          color: C.inkFaded,
                          display: "flex",
                        }}
                      >
                        <Plus size={12} />
                      </button>
                      {views.length > 1 && (
                        <button
                          onClick={() => onDelete(v.id)}
                          title={t("library.deleteThisView")}
                          style={{
                            all: "unset",
                            ...tap,
                            cursor: "pointer",
                            color: C.burgundy,
                            display: "flex",
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px dashed ${C.line}`,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <button
                onClick={() => {
                  onCreate();
                  setOpen(false);
                }}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                }}
              >
                {t("shelf.newViewStamp")}
              </button>
              {/* One shelf per film-maker: a line and a box per director.
                  It is a view like any other once laid down — one files
                  it by hand afterwards if one wants. */}
              <button
                onClick={() => {
                  onCreateByDirector();
                  setOpen(false);
                }}
                title={t("library.oneRowPerDirector")}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                }}
              >
                {t("library.byDirectorAdd")}
              </button>
            </div>

            <div
              style={{
                fontFamily: F.mono,
                fontSize: 8.5,
                letterSpacing: 1,
                color: C.inkFaded,
                margin: "12px 0 5px",
              }}
            >
              {t("library.shelfWood")}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {Object.entries(THEMES).map(([k, t]) => (
                <button
                  key={k}
                  onClick={() => onTheme(k)}
                  title={t.label}
                  style={{
                    all: "unset",
                    ...tapSquare,
                    cursor: "pointer",
                    width: 26,
                    height: 20,
                    background: `linear-gradient(${t.wood[0]}, ${t.wood[1]})`,
                    border: active.theme === k ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                  }}
                />
              ))}
            </div>

            {/* The wood is the quick choice; the workshop is the door
                next to it, for whoever wants to paint the wall and change
                the plank's material. It lives HERE, with the swatches,
                because the decor belongs to the VIEW — not to a shelf. */}
            <button
              onClick={() => {
                onDecor();
                setOpen(false);
              }}
              title={t("library.decorHint")}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginTop: 10,
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 0.5,
                color: C.burgundy,
              }}
            >
              {t("library.decorStudio")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A film's decade — `null` when the year is missing. */
const decadeOf = (f) => {
  const y = Number(f.year);
  return Number.isFinite(y) && y > 0 ? Math.floor(y / 10) * 10 : null;
};

export function LibraryView({
  films,
  /* The WHOLE collection, and not the displayed wall alone: the evening
     drawer builds a taste profile, and a profile is read on the films
     SEEN — which the "à voir" list precisely does not contain. */
  allFilms = [],
  onOpen,
  wall = "watched",
  ui,
  setUi,
  onUpdateMany,
  shelfView,
  shelfViews,
  /* Ce qui est déjà posé, tous murs et toutes vues confondus : voir
     `countPlacedMotifs`. Le cabinet s'en sert pour dire ce qu'il reste. */
  placed,
  onOpenPerson,
  onShelfView,
  onPickView,
  onCreateView,
  onCreateDirectorView,
  onCopyView,
  onDeleteView,
  onDeleteFilms,
  /* Les deux portes du mur vide. Facultatives : `WallEmpty` n'en dessine
     aucune sans elles, et le carré reste ce qu'il était. */
  onImport,
  onAdd,
  onUpdateFilm,
  /* LE PROGRAMME ÉPINGLÉ, LU ET JAMAIS ÉCRIT. C'est ici qu'on choisit
     quoi regarder — jamais sur l'écran du programme, où l'on va pour
     COMPOSER — donc c'est ici que la suite doit se dire. Facultatif :
     un mur monté seul (un test, la vue partagée) n'en a pas. */
  courses = [],
  onOpenRun,
}) {
  const { t } = useTranslation();
  /* ============================================================
     LA FICHE RAPIDE VIENT AVANT LE DOSSIER, QUOI QU'IL ARRIVE
     ============================================================

     Un clic sur une affiche ouvrait le dossier — l'écran d'ÉCRITURE,
     avec ses champs, ses onglets et ses séances. Or neuf fois sur dix on
     clique pour SAVOIR : de quoi ça parle, qui l'a fait, combien de
     temps ça dure, l'ai-je noté. On ouvrait donc un formulaire pour lire
     une réponse, et il fallait revenir en arrière pour continuer.

     LES QUATRE SURFACES PASSENT PAR ICI — le mur, l'étagère, le mur
     « à voir » (c'est la même vue, montée deux fois) et le tiroir du
     soir. C'est le seul endroit qui les voie toutes, et c'est ce qui
     évite que trois d'entre elles s'accordent et que la quatrième
     oublie.

     LE DOSSIER RESTE À UN GESTE, depuis la couche. Rien n'est retiré :
     on ajoute une marche avant l'écriture. */
  const [quick, setQuick] = useState(null);
  /* La seule carte de cette vue : le premier tri d'une étagère rangée à
     la main réécrit des semaines de gestes. */
  const [request, setRequest] = useState(null);
  const lookAt = (id) => {
    const found =
      (films || []).find((f) => f.id === id) || (allFilms || []).find((f) => f.id === id);
    /* Une fiche qu'on ne retrouve pas ouvre le dossier comme avant :
       mieux vaut la vieille porte qu'aucune. */
    if (found) setQuick(found);
    else onOpen(id);
  };
  const cfg = WALLS[wall];
  /* Search, filter and sort live in App: opening a film unmounts this
     view, and a local state would be lost on the way back to the wall. */
  const { q, sortBy, desc, grouped } = ui;
  /* AU PLURIEL, ET ON TOLÈRE LE SINGULIER D'AVANT. Ces deux filtres ne
     sont pas sur le disque — `keep()` dans `App` ne garde que le mode et
     le tri — mais un état de vue survit à un rechargement de module en
     développement, et un `.includes` sur une chaîne répondrait n'importe
     quoi plutôt que d'échouer. */
  const asList = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);
  const genreFilter = asList(ui.genreFilter);
  const decadeFilter = asList(ui.decadeFilter).map(String);
  const mode = ui.mode === "shelf" ? "shelf" : "wall";
  const set = (patch) => setUi({ ...ui, ...patch });
  const setQ = (v) => set({ q: v });
  const setGenreFilter = (v) => set({ genreFilter: v });
  const setDecadeFilter = (v) => set({ decadeFilter: v });
  const sieved = genreFilter.length + decadeFilter.length;
  /* CE QUE LES TAMIS CONTIENNENT, en une chaîne. Les deux tableaux sont
     refaits à chaque rendu, donc en dépendre directement ne mémorise
     rien ; c'est leur CONTENU qui décide, et il tient dans une clé. */
  const genreKey = genreFilter.join("|");
  const decadeKey = decadeFilter.join("|");
  const setGrouped = (fn) => set({ grouped: typeof fn === "function" ? fn(grouped) : fn });
  // clicking the active sort again simply reverses the direction
  const pickSort = (k) => set(k === sortBy ? { desc: !desc } : { sortBy: k, desc: true });

  /* Filing into a list: the badge on each poster and the bar for a
     multiple choice. It answers nothing at all without a server or an
     account — the wall is then exactly the wall it was. */
  const filing = useWallFiling(films, onDeleteFilms, onUpdateMany);

  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );

  /* The decades are not a fixed list: we offer only those the
     collection actually contains, from the oldest to the most recent. A
     film with no year has none — it vanishes as soon as a decade is
     chosen, and that is indeed what is being asked. */
  const allDecades = useMemo(
    () => Array.from(new Set(films.map(decadeOf).filter((d) => d !== null))).sort((a, b) => a - b),
    [films]
  );

  /* The decor workshop, opened over the shelf rather than inside the
     view menu: one adjusts a surface there and wants to SEE the row
     change behind, which a menu closed on itself forbids. */
  const [studio, setStudio] = useState(false);

  /* The wall workshop, its exact counterpart on the cards' side. Two
     states and not one: the two workshops do not adjust the same thing
     and do not open in the same display. */
  const [wallStudio, setWallStudio] = useState(false);

  /* The evening drawer. Local to the view and not in `ui`: it is not a
     wall setting one finds again on coming back, it is a question one
     asks once. */
  const [soir, setSoir] = useState(false);

  /* LE TIROIR DES MIS DE CÔTÉ, ICI ET NON DANS `ShelfBoard`.

     Il y était, et la recherche est ici : `ShelfFind` ne pouvait donc
     pas l'ouvrir, alors qu'un film mis de côté est COMPTÉ parmi les
     trouvés et rendu invisible tant que le tiroir est fermé. Sauter
     dessus ne faisait rien, sans un mot.

     Local à la vue et non dans `ui`, comme le tiroir du soir : ce n'est
     pas un réglage de mur qu'on retrouve en revenant, c'est un geste. */
  const [drawer, setDrawer] = useState(false);

  /* The wall's look comes from disk and may be missing, or have been
     written by another version: `wallLookOf` always brings it back to a
     complete look, falling back on the defaults if need be. */
  const look = useMemo(() => wallLookOf(ui.look), [ui.look]);
  const skin = useMemo(
    () => wallStyle(look.decor, look.decor?.patternInk ? catInk(look.decor.patternInk) : undefined),
    [look.decor]
  );

  /* DEUX TAMIS POSÉS L'UN SUR L'AUTRE, et non deux boutons qui se
     disputent la liste. DANS un tamis les cases s'ADDITIONNENT — police
     OU noir — et d'un tamis à l'autre elles se MULTIPLIENT : les années
     70 ET l'un des deux genres. C'est la seule lecture qui rende la
     multi-sélection utile ; l'intersection dans un même tamis ne rendrait
     presque jamais rien, un film portant rarement deux genres qu'on a
     tous les deux cochés. */
  const passesFilters = useCallback(
    (f) =>
      (genreFilter.length === 0 || (f.genres || []).some((g) => genreFilter.includes(g))) &&
      (decadeFilter.length === 0 || decadeFilter.includes(String(decadeOf(f)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [genreKey, decadeKey]
  );

  /* A film set aside has no business on the wall: that is precisely
     what was asked of it. It stays visible on the shelf, in its row. */
  const scope = useMemo(
    () => (mode === "shelf" ? films : films.filter((f) => !f.archived)),
    [films, mode]
  );
  const asideCount = useMemo(() => films.filter((f) => f.archived).length, [films]);

  /* On the shelf, searching is not filtering.

     Removing the films that do not match would dismantle the arrangement
     at every letter typed, and make the rows absurd — a line of six
     showing only one. So we keep everything in place and DIM what does
     not answer: the collection stays readable as a shelf, and what one
     is looking for stands out on it. */
  const matches = useCallback((f) => !q || matchFilm(f, q, t), [q, t]);

  const dimSet = useMemo(() => {
    if (mode !== "shelf" || (!q && sieved === 0)) return null;
    return new Set(scope.filter((f) => matches(f) && passesFilters(f)).map((f) => f.id));
  }, [mode, q, sieved, scope, matches, passesFilters]);

  /* Tidying the shelf in one gesture. The sort is no longer a state
     that would fight with the categories: it is a verb that rewrites the
     arrangement once, then bows out. The categories and the laid objects
     keep their place; only the films move. */
  /* A tidying reads both ways: clicking the same verb again turns the
     row over rather than redo it identically. */
  const arrangedBy = ui.arrangedBy ?? null;
  const arrangedDesc = ui.arrangedDesc !== false;

  /* LE PREMIER TRI DEMANDE, ET LUI SEUL. Il réécrit un rangement fait à
     la main sur des semaines ; les suivants ne réécrivent qu'un tri, qui
     n'est le rangement de personne. Une carte qui reviendrait à chaque
     fois ne se lirait plus au troisième essai. */
  const doArrange = (key) => {
    const nextDesc = key === arrangedBy ? !arrangedDesc : true;
    const sign = nextDesc ? 1 : -1;
    const by = new Map(films.map((f) => [f.id, f]));
    const base = (x, y) => {
      const a = by.get(x.id),
        b = by.get(y.id);
      if (!a || !b) return 0;
      return key === "title"
        ? a.title.localeCompare(b.title)
        : key === "director"
          ? (a.director || "zzz").localeCompare(b.director || "zzz") ||
            a.title.localeCompare(b.title)
          : key === "year"
            ? (b.year || 0) - (a.year || 0)
            : key === "rating"
              ? (b.rating || 0) - (a.rating || 0)
              : (b.addedAt || 0) - (a.addedAt || 0);
    };
    const cmp = (x, y) => sign * base(x, y);
    /* LA COPIE SE PREND AVANT, ET UNE SEULE FOIS : `keepByHand` ne fait
       rien s'il y en a déjà une. */
    let next = keepByHand(shelfView);
    for (const k of SHELF_KINDS) next = sortIntoRows(next, k, cmp);
    onShelfView(next);
    set({ arrangedBy: key, arrangedDesc: nextDesc });
  };

  const arrangeBy = (key) => {
    if (!shelfView) return;
    if (heldByHand(shelfView)) return doArrange(key);
    setRequest({
      title: t("library.confirmArrangeTitle"),
      body: t("library.confirmArrangeBody"),
      action: t("library.confirmArrangeAction"),
      onConfirm: () => doArrange(key),
    });
  };

  /* REVENIR, TANT QU'ON N'A PAS REPOSÉ UNE FICHE SOI-MÊME. Le bouton
     disparaît alors, parce que la disposition à l'écran est redevenue
     celle qu'on voulait — voir `forgetByHand`. */
  const restoreHand = () => {
    if (!shelfView) return;
    onShelfView(restoreByHand(shelfView));
    set({ arrangedBy: null });
  };

  /* Catalogue keys, like the wall's sorts in `walls.ts`: the left-hand
     item is the ID that gets written into the view's settings, the
     right-hand one is only what is read. */
  const ARRANGE = [
    ["title", "walls.sort.title"],
    ["year", "walls.sort.year"],
    ["rating", "walls.sort.rating"],
    ["director", "walls.sort.director"],
    ["added", "walls.sort.addedShort"],
  ];

  const filtered = useMemo(() => {
    let list = scope.filter((f) => (!q || matchFilm(f, q, t)) && passesFilters(f));
    return [...list].sort((a, b) => {
      const cmp =
        // A–Z reads in the natural order: it is `desc` that reverses it
        sortBy === "title"
          ? -a.title.localeCompare(b.title)
          : sortBy === "director"
            ? -(
                (a.director || "zzz").localeCompare(b.director || "zzz") ||
                a.title.localeCompare(b.title)
              )
            : sortBy === "year"
              ? (b.year || 0) - (a.year || 0)
              : sortBy === "rating"
                ? (b.rating || 0) - (a.rating || 0)
                : // films that were never dated slide to the end of the list, not the head
                  sortBy === "watched"
                  ? (b.watchedAt || "").localeCompare(a.watchedAt || "")
                  : (b.addedAt || 0) - (a.addedAt || 0);
      return desc ? cmp : -cmp;
    });
  }, [scope, q, passesFilters, sortBy, desc, t]);

  /* The grouping by director: one pile of cards per film-maker, the
     most frequented first — that is where habits can be read. */
  const groups = useMemo(() => {
    if (!grouped) return null;
    const UNKNOWN_DIRECTOR = t("library.unknownDirector");
    const by = new Map();
    for (const f of filtered) {
      const key = f.director?.trim() || UNKNOWN_DIRECTOR;
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }
    return [...by.entries()].sort(
      (a, b) =>
        b[1].length - a[1].length ||
        (a[0] === UNKNOWN_DIRECTOR ? 1 : b[0] === UNKNOWN_DIRECTOR ? -1 : a[0].localeCompare(b[0]))
    );
  }, [filtered, grouped, t]);

  return (
    <FilingProvider value={filing.context}>
      <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
        <CoffeeRing style={{ top: 10, right: 120 }} rotate={12} />
        <CoffeeRing style={{ bottom: 40, left: -30, width: 100, height: 100 }} rotate={-40} />
        <CoffeeRing style={{ top: 340, right: -40, width: 190, height: 190 }} rotate={70} />
        <TapeResidue style={{ top: 96, right: 260 }} />
        <TapeResidue style={{ bottom: 120, left: 180, opacity: 0.3 }} rotate={7} w={64} />
        <StampCorner text={`${t(cfg.stamp)} · ${films.length}`} />
        <div
          style={{
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 46,
            color: C.ink,
            position: "relative",
            zIndex: 2,
          }}
        >
          {t(cfg.title)}
        </div>
        <InkUnderline width={cfg.underline} />
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 22,
            color: C.inkFaded,
            marginTop: 2,
            position: "relative",
            zIndex: 2,
          }}
        >
          {t(cfg.subtitle)}
        </div>

        <div style={{ position: "relative", zIndex: 2, marginTop: 18 }}>
          <NextUp
            courses={courses}
            films={allFilms.length ? allFilms : films}
            onOpenFilm={onOpen}
            onOpenRun={onOpenRun ?? (() => {})}
          />
        </div>

        {/* No `z-index` on this bar, and that is deliberate.

          It carried one — the same 2 as the rest of the content, so as to
          pass in front of the coffee stains. But a `z-index` on a
          positioned element opens a STACKING CONTEXT, and everything it
          contains is shut inside: the views menu's 43 was worth something
          only within the bar, which stayed at 2 among its siblings. The
          shelf, also at 2 but LOWER in the document, therefore passed in
          front of the bottom of the drop-down — exactly where the wood
          swatches are. They showed, and the click went to the shelf
          behind.

          With no `z-index`, the bar shuts nothing in: the menu compares
          its 43 with the shelf's 2 in a shared context, and wins. The
          coffee stains stay behind without being asked — they come
          BEFORE in the document and catch no click. */}
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginTop: 26,
            marginBottom: 34,
            borderBottom: `1px dashed ${C.line}`,
            paddingBottom: 18,
            position: "relative",
          }}
        >
          <div data-tour="wall-search" style={{ minWidth: 200 }}>
            <Label>{t("library.search")}</Label>
            <input
              style={underlineInput}
              placeholder={t("library.searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {/* SUR L'ÉTAGÈRE SEULEMENT, et c'est le mode qui le veut :
                le mur, lui, FILTRE — ce qui reste à l'écran EST le
                résultat, et le compter serait compter ce qu'on voit.
                L'étagère ternit, donc elle doit dire. */}
            {mode === "shelf" && <ShelfFind matching={dimSet} onReveal={() => setDrawer(true)} />}
          </div>
          {/* DEUX TAMIS REPLIÉS, LÀ OÙ IL Y AVAIT DEUX RANGÉES. Dix-neuf
              genres et onze décennies toujours dépliés poussaient les
              affiches sous la ligne de flottaison, pour deux bandeaux
              qu'on ne lit pas — on les balaie. Un filtre est fermé la
              plupart du temps : c'est une chose qu'on ouvre pour
              choisir. Et il en accepte PLUSIEURS, ce qui n'était pas
              possible : on ne choisit plus entre deux décennies voisines
              pour une même période. */}
          <Sieve
            tour="wall-filters"
            label={t("library.genre")}
            options={allGenres.map((g) => ({
              value: g,
              label: g,
              /* Chaque genre porte son encre — l'étiquetage n'a pas été
                 fait le même jour, et la couleur est ce qui les
                 distingue au balayage. */
              ink: [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate][Math.abs(hash(g)) % 5],
            }))}
            chosen={genreFilter}
            onChange={setGenreFilter}
          />
          <Sieve
            label={t("library.decade")}
            options={allDecades.map((d) => ({ value: String(d), label: `${d}s` }))}
            chosen={decadeFilter}
            onChange={setDecadeFilter}
          />
          <div data-tour="wall-sort">
            {/* On the wall, sorting is a state. On the shelf, the arrangement
              IS the state: filing becomes a gesture one makes once. */}
            <Label>{mode === "shelf" ? t("library.arrange") : t("library.sort")}</Label>
            <div
              style={{
                display: "flex",
                gap: 14,
                fontFamily: F.mono,
                fontSize: 11,
              }}
            >
              {mode === "shelf"
                ? ARRANGE.map(([k, l]) => (
                    <span
                      key={k}
                      onClick={() => arrangeBy(k)}
                      title={
                        arrangedBy === k
                          ? t("library.clickToReverse")
                          : t("library.rewritesArrangement")
                      }
                      style={{
                        cursor: "pointer",
                        color: arrangedBy === k ? C.burgundy : C.inkFaded,
                        borderBottom: `1px dashed ${C.line}`,
                      }}
                    >
                      {t(l)}
                      {arrangedBy === k && (
                        <span style={{ marginLeft: 3 }}>{arrangedDesc ? "↓" : "↑"}</span>
                      )}
                    </span>
                  ))
                : cfg.sorts.map(([k, l]) => (
                    <span
                      key={k}
                      onClick={() => pickSort(k)}
                      title={sortBy === k ? t("library.clickToReverse") : ""}
                      style={{
                        cursor: "pointer",
                        color: sortBy === k ? C.burgundy : C.inkFaded,
                        textDecoration: sortBy === k ? "underline" : "none",
                      }}
                    >
                      {t(l)}
                      {sortBy === k && <span style={{ marginLeft: 3 }}>{desc ? "↓" : "↑"}</span>}
                    </span>
                  ))}
            </div>
            {/* TANT QU'ON N'A PAS REPOSÉ UNE FICHE SOI-MÊME. Il n'y a
                rien à proposer avant le premier tri, et plus rien à
                proposer dès qu'on range de nouveau à la main. */}
            {mode === "shelf" && heldByHand(shelfView) && (
              <button
                onClick={restoreHand}
                style={{
                  ...bare,
                  ...tap,
                  cursor: "pointer",
                  marginTop: 6,
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.burgundy,
                  borderBottom: `1px dashed ${C.burgundy}`,
                }}
              >
                {t("library.backToHand")}
              </button>
            )}
          </div>
          <div data-tour="wall-mode">
            <Label>{t("library.presentation")}</Label>
            <div style={{ display: "flex", marginTop: 2 }}>
              {[
                { k: "wall", l: t("library.wall"), icon: LayoutGrid },
                { k: "shelf", l: t("library.shelf"), icon: Library },
              ].map(({ k, l, icon: Icon }) => (
                <button
                  key={k}
                  onClick={() => set({ mode: k })}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 12px",
                    fontFamily: F.mono,
                    fontSize: 10.5,
                    background: mode === k ? C.ink : "transparent",
                    color: mode === k ? C.card : C.inkFaded,
                    border: `1px solid ${mode === k ? C.ink : C.line}`,
                    marginLeft: k === "shelf" ? -1 : 0,
                  }}
                >
                  <Icon size={12} /> {l}
                </button>
              ))}
            </div>
          </div>
          {/* The number of films per line is no longer set here: it belongs
            to each row, in its gutter. What is chosen at this level is
            the view — the whole shelf. */}
          {mode === "shelf" && (
            <ViewSwitcher
              views={shelfViews}
              active={shelfView}
              onPick={onPickView}
              onCreate={onCreateView}
              onCreateByDirector={onCreateDirectorView}
              onCopy={onCopyView}
              onDelete={onDeleteView}
              onRename={(name) => onShelfView({ ...shelfView, name })}
              onTheme={(theme) => onShelfView({ ...shelfView, theme })}
              onDecor={() => setStudio(true)}
            />
          )}
          {/* LE RECUL — à côté du sélecteur de vue, parce que c'est la
              même question posée de deux façons : QUELLE étagère on
              regarde, et de QUELLE distance. */}
          {mode === "shelf" && (
            <div>
              <Label>{t("shelf.stepBack.title")}</Label>
              <StepBack value={ui.zoom ?? 1} onChange={(zoom) => set({ zoom })} />
            </div>
          )}
          {/* THE EVENING'S QUESTION — on the "à voir" list, and there only.

            The film library has no call to ask it: what it holds has
            already been seen. It is the pile of intentions that knew
            nothing but how to pile up. */}
          {wall === "watchlist" && (
            <div data-tour="soir-ouvrir">
              <Label>{t("library.tonight")}</Label>
              <button
                onClick={() => setSoir(true)}
                title={t("library.findWhatToWatch")}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  marginTop: 2,
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.card,
                  background: C.burgundy,
                  border: `1px solid ${C.burgundy}`,
                }}
              >
                <Dice5 size={12} /> {t("library.whichTonightStamp")}
              </button>
            </div>
          )}
          {mode === "wall" && (
            <div>
              <Label>Classer</Label>
              <button
                onClick={() => setGrouped((g) => !g)}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  padding: "5px 12px",
                  marginTop: 2,
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  background: grouped ? C.pine : "transparent",
                  color: grouped ? C.card : C.inkFaded,
                  border: `1px solid ${grouped ? C.pine : C.line}`,
                }}
              >
                {t("library.byDirector")}
              </button>
            </div>
          )}
          {mode === "wall" && (
            <div data-tour="wall-decor">
              <Label>{t("library.decor")}</Label>
              {/* Echoing the shelf's "ATELIER DÉCO…": the wall is painted too,
                and its cards have a size of their own. */}
              <button
                onClick={() => setWallStudio(true)}
                title={t("library.wallStudioHint")}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  padding: "5px 12px",
                  marginTop: 2,
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.burgundy,
                  border: `1px solid ${C.line}`,
                }}
              >
                {t("library.wallStudio")}
              </button>
            </div>
          )}
          {mode === "wall" && asideCount > 0 && (
            <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded }}>
              <button
                onClick={() => set({ mode: "shelf" })}
                style={{ all: "unset", cursor: "pointer", borderBottom: `1px dashed ${C.line}` }}
              >
                {t("library.setAside", { count: asideCount })}
              </button>
            </div>
          )}
        </div>

        {mode === "shelf" ? (
          <div data-tour="wall-films" style={{ position: "relative", zIndex: 2 }}>
            {/* FILING IS A PROPERTY OF A FILM, NOT OF A PRESENTATION. It
              existed on the wall alone, which made it look like a
              feature of one view; the shelf reads the same driver
              through a context, and raises the same panel. */}
            {filing.panel}
            {/* The shelf receives the wall's WHOLE collection, never the
              filtered list: it is the arrangement that commands the
              order, and the search only dims what it does not find. */}
            <ShelfBoard
              films={scope}
              doc={shelfView}
              onDoc={onShelfView}
              placed={placed}
              onOpen={lookAt}
              onUpdateMany={onUpdateMany}
              dimSet={dimSet}
              drawer={drawer}
              setDrawer={setDrawer}
              zoom={ui.zoom ?? 1}
            />
            {studio && shelfView && (
              <DecorStudio
                drawerOpen={drawer}
                view={shelfView}
                onChange={(part, patch) => onShelfView(patchViewDecor(shelfView, part, patch))}
                onReset={() => onShelfView(clearViewDecor(shelfView))}
                onClose={() => setStudio(false)}
              />
            )}
          </div>
        ) : (
          /* THE WALL — the surface first, the cards on top.

           The background is painted by the SAME engine as the rows'
           (`wallStyle`): paint, wallpaper and texture. It overflows the
           content by twenty pixels so that the cards are not stuck to
           the edge, and the texture stays a layer of its own, blending
           in `multiply` — a background cannot do that alone. */
          <div
            data-tour="wall-films"
            style={{ position: "relative", zIndex: 2, padding: look.decor ? 20 : 0, ...skin.frame }}
          >
            {skin.texture && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  mixBlendMode: "multiply",
                  pointerEvents: "none",
                  ...skin.texture,
                }}
              />
            )}
            <div style={{ position: "relative" }}>
              {filtered.length > 0 && filing.bar}
              {filtered.length === 0 ? (
                <WallEmpty films={films} cfg={cfg} onImport={onImport} onAdd={onAdd} />
              ) : grouped ? (
                groups.map(([director, list]) => (
                  <div key={director} style={{ marginBottom: 46 }}>
                    <DirectorRule director={director} count={list.length} />
                    <FilmWall films={list} onOpen={lookAt} look={look} filing={filing.bundle} />
                  </div>
                ))
              ) : (
                <FilmWall films={filtered} onOpen={lookAt} look={look} filing={filing.bundle} />
              )}
              {filing.panel}
            </div>
            {wallStudio && (
              <WallStudio
                drawerOpen={drawer}
                look={look}
                onChange={(patch) => set({ look: { ...look, ...patch } })}
                onReset={() => set({ look: DEFAULT_WALL_LOOK })}
                onClose={() => setWallStudio(false)}
              />
            )}
          </div>
        )}
        {/* The drawer is mounted outside both presentations: the evening's
          question does not change with whether one is looking at a wall
          or at a shelf. */}
        {soir && (
          <TonightDrawer
            films={allFilms.length ? allFilms : films}
            onClose={() => setSoir(false)}
            onOpen={lookAt}
          />
        )}

        <Confirmation request={request} onClose={() => setRequest(null)} />

        {quick && (
          <FilmQuickView
            film={quick}
            onEnrich={onUpdateFilm}
            onOpenPerson={(name) => onOpenPerson(normalize(name))}
            onOpenFilm={() => {
              setQuick(null);
              onOpen(quick.id);
            }}
            onClose={() => setQuick(null)}
          />
        )}
      </div>
    </FilingProvider>
  );
}

/* What one sees when the wall is empty — either the collection is, or
   the sieve lets nothing through. These are two different emptinesses,
   and they are not said the same way. */
function WallEmpty({ films, cfg, onImport, onAdd }) {
  const { t } = useTranslation();
  const never = films.length === 0;
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px 60px",
        color: C.inkFaded,
      }}
    >
      {/* THE GHOST FRAMES.

          Only when the collection is EMPTY FOR GOOD. A sieve that lets
          nothing through is not a bare wall: showing places to fill there
          would make one believe cards had been lost, when widening the
          search is all it takes.

          They are not decorative: they say the SHAPE of what is coming —
          six posters, pinned askew — and an invitation on its own does
          not say it. */}
      {never && (
        <div
          aria-hidden
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 34,
            opacity: 0.5,
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: 74,
                height: 111,
                border: `1.5px dashed ${C.line}`,
                borderRadius: 2,
                /* The lean comes from the same vein as all the site's
                   disorder: derived, never drawn at random on each
                   render — a wall that wriggles is not a wall.

                   THE INDEX GOES IN FRONT, AND THAT IS NECESSARY. The
                   project's hash is a Horner: two strings differing only
                   by their LAST character have two hashes differing only
                   by as much, and the modulo preserves it. `fantome-0` …
                   `fantome-5` therefore gave −2.0 −1.9 −1.8 …: a regular
                   ramp, that is to say exactly the opposite of the
                   disorder we were after. Placed at the head, the index
                   propagates through the whole computation and
                   scatters. */
                transform: `rotate(${tiltOf(`${i}-cadre-vide`)}deg)`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -5,
                  left: "50%",
                  marginLeft: -5,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: `1.5px dashed ${C.line}`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
      <div
        style={{
          fontFamily: F.title,
          fontSize: 20,
          color: C.ink,
          marginBottom: 6,
        }}
      >
        {t(never ? cfg.empty[0] : "library.nothingToShow")}
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 19 }}>
        {t(never ? cfg.empty[1] : "library.tryAnotherSearch")}
      </div>

      {/* LES PORTES, ET SEULEMENT SUR UN VRAI VIDE.

          Un classeur vidé à la main ne resème jamais l'exemple — et il a
          raison — donc il tombait sur ce carré, qui disait ce qu'il y
          avait à savoir et ne proposait rien à faire. C'est le seul
          écran du produit qui ne mène nulle part, et c'est celui d'une
          première fois.

          RIEN SOUS UN TAMIS QUI NE LAISSE RIEN PASSER : là, il y a des
          films, ils sont juste filtrés. Proposer un import y répondrait
          à côté de la question. */}
      {never && (onImport || onAdd) && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 22,
          }}
        >
          {onImport && (
            <button onClick={onImport} style={emptyDoor(C.card, C.pine, C.pine)}>
              <FolderInput size={12} /> {t("library.emptyImport")}
            </button>
          )}
          {onAdd && (
            <button onClick={onAdd} style={emptyDoor(C.ink, "transparent", C.line)}>
              <Plus size={12} /> {t("library.emptyAdd")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* Même forme pour les deux portes du vide : ce sont deux propositions,
   et la première n'est mise en avant que par son encre. */
const emptyDoor = (ink, fill, line) => ({
  all: "unset",
  ...tap,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  color: ink,
  background: fill,
  border: `1px solid ${line}`,
});

/* The thin line separating two directors, when the wall is grouped. */
function DirectorRule({ director, count }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 26,
          color: C.ink,
        }}
      >
        {director}
      </div>
      <div
        style={{
          flex: 1,
          borderBottom: `1px dashed ${C.line}`,
          transform: "translateY(-6px)",
        }}
      />
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          color: C.inkFaded,
        }}
      >
        {count} film{count > 1 ? "s" : ""}
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
