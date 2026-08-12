/* ============================================================
   VIEW — FILM LIBRARY: the wall, or the shelf and its views.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pin, Plus, Trash2, LayoutGrid, Library, Paperclip, Dice5 } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput, tap, tapSquare } from "../../theme/styles";
import { hash, tiltOf } from "../../domain/seeded";
import { matchFilm } from "../../domain/search";
import { CoffeeRing, TapeResidue, StampCorner, InkUnderline } from "../../components/atmosphere";
import { Label } from "../../components/ui";
import { ShelfBoard } from "../../components/shelf/ShelfBoard";
import { THEMES } from "../../components/shelf/constants";
import { DecorStudio } from "../../components/shelf/DecorStudio";
import { SHELF_KINDS, sortIntoRows, patchViewDecor, clearViewDecor } from "../../shelf-views";
import { FilmWall } from "./FilmWall";
import { TonightDrawer } from "./TonightDrawer";
import { WallStudio } from "./WallStudio";
import { wallLookOf, DEFAULT_WALL_LOOK } from "./wallLook";
import { wallStyle } from "../../theme/surfaces";
import { catInk } from "../../components/shelf/constants";
import { WALLS } from "./walls";

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
        title="Changer de rangement"
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
                        title="Renommer"
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
                        title="Dupliquer ce rangement"
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
                          title="Supprimer cette vue"
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
                + NOUVELLE VUE
              </button>
              {/* Une étagère par cinéaste : une ligne et une boîte par
                  réalisateur. C'est une vue comme les autres une fois
                  posée — on la range ensuite à la main si l'on veut. */}
              <button
                onClick={() => {
                  onCreateByDirector();
                  setOpen(false);
                }}
                title="Une ligne et une boîte par réalisateur"
                style={{
                  all: "unset",
                  ...tap,
                  cursor: "pointer",
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                }}
              >
                + PAR RÉALISATEUR
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
              BOIS DE L'ÉTAGÈRE
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

            {/* Le bois est le choix rapide ; l'atelier est la porte à
                côté, pour qui veut peindre le mur et changer la matière
                de la planche. Il vit ICI, avec les pastilles, parce que
                le décor appartient à la VUE — pas à un rayon. */}
            <button
              onClick={() => {
                onDecor();
                setOpen(false);
              }}
              title="Peindre le mur, changer la matière des planches"
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
              ATELIER DÉCO…
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
  onShelfView,
  onPickView,
  onCreateView,
  onCreateDirectorView,
  onCopyView,
  onDeleteView,
}) {
  const cfg = WALLS[wall];
  /* Search, filter and sort live in App: opening a film unmounts this
     view, and a local state would be lost on the way back to the wall. */
  const { q, genreFilter, decadeFilter = null, sortBy, desc, grouped } = ui;
  const mode = ui.mode === "shelf" ? "shelf" : "wall";
  const set = (patch) => setUi({ ...ui, ...patch });
  const setQ = (v) => set({ q: v });
  const setGenreFilter = (v) => set({ genreFilter: v });
  const setDecadeFilter = (v) => set({ decadeFilter: v });
  const setGrouped = (fn) => set({ grouped: typeof fn === "function" ? fn(grouped) : fn });
  // clicking the active sort again simply reverses the direction
  const pickSort = (k) => set(k === sortBy ? { desc: !desc } : { sortBy: k, desc: true });

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

  /* The wall's look comes from disk and may be missing, or have been
     written by another version: `wallLookOf` always brings it back to a
     complete look, falling back on the defaults if need be. */
  const look = useMemo(() => wallLookOf(ui.look), [ui.look]);
  const skin = useMemo(
    () => wallStyle(look.decor, look.decor?.patternInk ? catInk(look.decor.patternInk) : undefined),
    [look.decor]
  );

  /* Genre and decade add up: they are two sieves laid one on the other,
     and not two buttons fighting over the list. */
  const passesFilters = useCallback(
    (f) =>
      (!genreFilter || (f.genres || []).includes(genreFilter)) &&
      (decadeFilter === null || decadeOf(f) === decadeFilter),
    [genreFilter, decadeFilter]
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
  const matches = useCallback((f) => !q || matchFilm(f, q), [q]);

  const dimSet = useMemo(() => {
    if (mode !== "shelf" || (!q && !genreFilter && decadeFilter === null)) return null;
    return new Set(scope.filter((f) => matches(f) && passesFilters(f)).map((f) => f.id));
  }, [mode, q, genreFilter, decadeFilter, scope, matches, passesFilters]);

  /* Tidying the shelf in one gesture. The sort is no longer a state
     that would fight with the categories: it is a verb that rewrites the
     arrangement once, then bows out. The categories and the laid objects
     keep their place; only the films move. */
  /* A tidying reads both ways: clicking the same verb again turns the
     row over rather than redo it identically. */
  const arrangedBy = ui.arrangedBy ?? null;
  const arrangedDesc = ui.arrangedDesc !== false;

  const arrangeBy = (key) => {
    if (!shelfView) return;
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
    let next = shelfView;
    for (const k of SHELF_KINDS) next = sortIntoRows(next, k, cmp);
    onShelfView(next);
    set({ arrangedBy: key, arrangedDesc: nextDesc });
  };

  const ARRANGE = [
    ["title", "A–Z"],
    ["year", "année"],
    ["rating", "note"],
    ["director", "réalisateur"],
    ["added", "ajout"],
  ];

  const filtered = useMemo(() => {
    let list = scope.filter((f) => (!q || matchFilm(f, q)) && passesFilters(f));
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
                : // les films jamais datés glissent en fin de liste plutôt qu'en tête
                  sortBy === "watched"
                  ? (b.watchedAt || "").localeCompare(a.watchedAt || "")
                  : (b.addedAt || 0) - (a.addedAt || 0);
      return desc ? cmp : -cmp;
    });
  }, [scope, q, passesFilters, sortBy, desc]);

  /* The grouping by director: one pile of cards per film-maker, the
     most frequented first — that is where habits can be read. */
  const groups = useMemo(() => {
    if (!grouped) return null;
    const by = new Map();
    for (const f of filtered) {
      const key = f.director?.trim() || "Réalisateur inconnu";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }
    return [...by.entries()].sort(
      (a, b) =>
        b[1].length - a[1].length ||
        (a[0] === "Réalisateur inconnu"
          ? 1
          : b[0] === "Réalisateur inconnu"
            ? -1
            : a[0].localeCompare(b[0]))
    );
  }, [filtered, grouped]);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 10, right: 120 }} rotate={12} />
      <CoffeeRing style={{ bottom: 40, left: -30, width: 100, height: 100 }} rotate={-40} />
      <CoffeeRing style={{ top: 340, right: -40, width: 190, height: 190 }} rotate={70} />
      <TapeResidue style={{ top: 96, right: 260 }} />
      <TapeResidue style={{ bottom: 120, left: 180, opacity: 0.3 }} rotate={7} w={64} />
      <StampCorner text={`${cfg.stamp} · ${films.length}`} />
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
        {cfg.title}
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
        {cfg.subtitle}
      </div>

      {/* Pas de `z-index` sur cette barre, et c'est délibéré.

          Elle en portait un — le même 2 que le reste du contenu, pour
          passer devant les taches de café. Mais un `z-index` sur un
          élément positionné ouvre un CONTEXTE D'EMPILEMENT, et tout ce
          qu'il contient s'y trouve enfermé : les 43 du menu des vues ne
          valaient plus qu'à l'intérieur de la barre, laquelle restait à 2
          parmi ses frères. L'étagère, elle aussi à 2 mais PLUS BAS dans le
          document, passait donc devant le bas du menu déroulant — juste
          là où se trouvent les pastilles de bois. Elles s'affichaient, et
          le clic allait au rayon derrière.

          Sans `z-index`, la barre n'enferme plus rien : le menu compare
          son 43 au 2 de l'étagère dans un contexte commun, et gagne. Les
          taches de café restent derrière sans qu'on ait à le demander —
          elles sont AVANT dans le document et ne captent aucun clic. */}
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
          <Label>Chercher</Label>
          <input
            style={underlineInput}
            placeholder="un titre, un·e cinéaste…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div data-tour="wall-filters">
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && (
              <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>
            )}
            {allGenres.map((g) => {
              // each genre carries its own ink — the labelling was not done on the same day
              const ink = [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate][
                Math.abs(hash(g)) % 5
              ];
              const on = genreFilter === g;
              return (
                <button
                  key={g}
                  onClick={() => setGenreFilter(on ? "" : g)}
                  style={{
                    all: "unset",
                    ...tap,
                    cursor: "pointer",
                    fontFamily: F.mono,
                    fontSize: 10.5,
                    padding: "4px 11px",
                    borderRadius: 14,
                    border: `1px solid ${ink}`,
                    color: on ? C.card : ink,
                    background: on ? ink : "transparent",
                    transform: `rotate(${(Math.abs(hash(g)) % 5) - 2}deg)`,
                    boxShadow: on ? `1px 2px 4px ${ink}55` : "none",
                    transition: "background .15s ease",
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
        {allDecades.length > 0 && (
          <div>
            <Label>Décennie</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {allDecades.map((d) => {
                const on = decadeFilter === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDecadeFilter(on ? null : d)}
                    style={{
                      all: "unset",
                      ...tap,
                      cursor: "pointer",
                      fontFamily: F.mono,
                      fontSize: 10.5,
                      padding: "4px 9px",
                      border: `1px solid ${on ? C.ink : C.line}`,
                      color: on ? C.card : C.inkFaded,
                      background: on ? C.ink : "transparent",
                      transform: `rotate(${(Math.abs(hash(String(d))) % 3) - 1}deg)`,
                    }}
                  >
                    {d}s
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div data-tour="wall-sort">
          {/* Sur le mur, trier est un état. Sur l'étagère, l'agencement EST
              l'état : ranger devient un geste qu'on donne une fois. */}
          <Label>{mode === "shelf" ? "Ranger" : "Trier"}</Label>
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
                        ? "cliquer pour inverser"
                        : "Réécrit l'agencement de cette vue"
                    }
                    style={{
                      cursor: "pointer",
                      color: arrangedBy === k ? C.burgundy : C.inkFaded,
                      borderBottom: `1px dashed ${C.line}`,
                    }}
                  >
                    {l}
                    {arrangedBy === k && (
                      <span style={{ marginLeft: 3 }}>{arrangedDesc ? "↓" : "↑"}</span>
                    )}
                  </span>
                ))
              : cfg.sorts.map(([k, l]) => (
                  <span
                    key={k}
                    onClick={() => pickSort(k)}
                    title={sortBy === k ? "cliquer pour inverser" : ""}
                    style={{
                      cursor: "pointer",
                      color: sortBy === k ? C.burgundy : C.inkFaded,
                      textDecoration: sortBy === k ? "underline" : "none",
                    }}
                  >
                    {l}
                    {sortBy === k && <span style={{ marginLeft: 3 }}>{desc ? "↓" : "↑"}</span>}
                  </span>
                ))}
          </div>
        </div>
        <div data-tour="wall-mode">
          <Label>Présentation</Label>
          <div style={{ display: "flex", marginTop: 2 }}>
            {[
              { k: "wall", l: "MUR", icon: LayoutGrid },
              { k: "shelf", l: "ÉTAGÈRE", icon: Library },
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
        {/* Le nombre de films par ligne ne se règle plus ici : il appartient
            à chaque rangée, dans sa gouttière. Ce qui se choisit à ce
            niveau, c'est la vue — l'étagère tout entière. */}
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
        {/* LA QUESTION DU SOIR — sur la liste « à voir », et là seulement.

            La vidéothèque n'a pas à la poser : ce qu'elle contient est
            déjà vu. C'est la pile des intentions qui, elle, ne savait
            que s'empiler. */}
        {wall === "watchlist" && (
          <div data-tour="soir-ouvrir">
            <Label>Ce soir</Label>
            <button
              onClick={() => setSoir(true)}
              title="Trouver quoi regarder ce soir"
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
              <Dice5 size={12} /> LEQUEL CE SOIR ?
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
              PAR RÉALISATEUR
            </button>
          </div>
        )}
        {mode === "wall" && (
          <div data-tour="wall-decor">
            <Label>Décor</Label>
            {/* En écho à « ATELIER DÉCO… » de l'étagère : le mur aussi se
                peint, et ses fiches aussi ont un calibre. */}
            <button
              onClick={() => setWallStudio(true)}
              title="Peindre le mur, régler la taille et le désordre des fiches"
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
              ATELIER DU MUR…
            </button>
          </div>
        )}
        {mode === "wall" && asideCount > 0 && (
          <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded }}>
            <button
              onClick={() => set({ mode: "shelf" })}
              style={{ all: "unset", cursor: "pointer", borderBottom: `1px dashed ${C.line}` }}
            >
              {asideCount} film{asideCount > 1 ? "s" : ""} de côté — voir l'étagère
            </button>
          </div>
        )}
      </div>

      {mode === "shelf" ? (
        <div data-tour="wall-films" style={{ position: "relative", zIndex: 2 }}>
          {/* L'étagère reçoit la collection ENTIÈRE du mur, jamais la liste
              filtrée : c'est l'agencement qui commande l'ordre, et la
              recherche ne fait qu'éteindre ce qu'elle ne trouve pas. */}
          <ShelfBoard
            films={scope}
            doc={shelfView}
            onDoc={onShelfView}
            onOpen={onOpen}
            onUpdateMany={onUpdateMany}
            dimSet={dimSet}
          />
          {studio && shelfView && (
            <DecorStudio
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
            {filtered.length === 0 ? (
              <WallEmpty films={films} cfg={cfg} />
            ) : grouped ? (
              groups.map(([director, list]) => (
                <div key={director} style={{ marginBottom: 46 }}>
                  <DirectorRule director={director} count={list.length} />
                  <FilmWall films={list} onOpen={onOpen} look={look} />
                </div>
              ))
            ) : (
              <FilmWall films={filtered} onOpen={onOpen} look={look} />
            )}
          </div>
          {wallStudio && (
            <WallStudio
              look={look}
              onChange={(patch) => set({ look: { ...look, ...patch } })}
              onReset={() => set({ look: DEFAULT_WALL_LOOK })}
              onClose={() => setWallStudio(false)}
            />
          )}
        </div>
      )}
      {/* Le tiroir est monté hors des deux présentations : la question du
          soir ne change pas selon qu'on regarde un mur ou une étagère. */}
      {soir && (
        <TonightDrawer
          films={allFilms.length ? allFilms : films}
          onClose={() => setSoir(false)}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

/* What one sees when the wall is empty — either the collection is, or
   the sieve lets nothing through. These are two different emptinesses,
   and they are not said the same way. */
function WallEmpty({ films, cfg }) {
  const never = films.length === 0;
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px 60px",
        color: C.inkFaded,
      }}
    >
      {/* LES CADRES FANTÔMES.

          Seulement quand la collection est VIDE POUR DE BON. Un tamis
          qui ne laisse rien passer n'est pas un mur nu : montrer là des
          emplacements à remplir laisserait croire qu'on a perdu des
          fiches, alors qu'il suffit d'élargir la recherche.

          Ils ne sont pas décoratifs : ils disent la FORME de ce qui
          viendra — six affiches, punaisées de travers — et une invite
          seule ne le dit pas. */}
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
        {never ? cfg.empty[0] : "Rien à afficher"}
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 19 }}>
        {never ? cfg.empty[1] : "Essayez une autre recherche."}
      </div>
    </div>
  );
}

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
