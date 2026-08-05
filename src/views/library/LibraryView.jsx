/* ============================================================
   VUE — VIDÉOTHÈQUE : le mur, ou l'étagère et ses vues.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pin, Plus, Trash2, LayoutGrid, Library, Paperclip } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { hash } from "../../domain/seeded";
import { CoffeeRing, TapeResidue, StampCorner, InkUnderline } from "../../components/atmosphere";
import { Label } from "../../components/ui";
import { ShelfBoard } from "../../components/shelf/ShelfBoard";
import { THEMES } from "../../components/shelf/constants";
import { DecorStudio } from "../../components/shelf/DecorStudio";
import { SHELF_KINDS, sortIntoRows, patchViewDecor, clearViewDecor } from "../../shelf-views";
import { FilmWall } from "./FilmWall";
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
    <div style={{ position: "relative" }}>
      <Label>Vue</Label>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Changer de rangement"
        style={{
          all: "unset",
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

/** La décennie d'un film — `null` quand l'année manque. */
const decadeOf = (f) => {
  const y = Number(f.year);
  return Number.isFinite(y) && y > 0 ? Math.floor(y / 10) * 10 : null;
};

export function LibraryView({
  films,
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
  /* Recherche, filtre et tri vivent dans App : ouvrir un film démonte cette
     vue, et un état local serait perdu au retour au mur. */
  const { q, genreFilter, decadeFilter = null, sortBy, desc, grouped } = ui;
  const mode = ui.mode === "shelf" ? "shelf" : "wall";
  const set = (patch) => setUi({ ...ui, ...patch });
  const setQ = (v) => set({ q: v });
  const setGenreFilter = (v) => set({ genreFilter: v });
  const setDecadeFilter = (v) => set({ decadeFilter: v });
  const setGrouped = (fn) => set({ grouped: typeof fn === "function" ? fn(grouped) : fn });
  // recliquer le tri actif inverse simplement le sens
  const pickSort = (k) => set(k === sortBy ? { desc: !desc } : { sortBy: k, desc: true });

  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );

  /* Les décennies ne sont pas une liste fixe : on n'offre que celles que
     la collection contient réellement, de la plus ancienne à la plus
     récente. Un film sans année n'en a aucune — il disparaît dès qu'on
     choisit une décennie, et c'est bien ce qu'on demande. */
  const allDecades = useMemo(
    () => Array.from(new Set(films.map(decadeOf).filter((d) => d !== null))).sort((a, b) => a - b),
    [films]
  );

  /* L'atelier déco, ouvert par-dessus l'étagère plutôt que dans le menu
     de vue : on y règle une surface et on veut VOIR le rayon changer
     derrière, ce qu'un menu refermé sur lui-même interdit. */
  const [studio, setStudio] = useState(false);

  /* L'atelier du mur, son exact pendant côté fiches. Deux états et non un
     seul : les deux ateliers ne règlent pas la même chose et ne s'ouvrent
     pas dans la même présentation. */
  const [wallStudio, setWallStudio] = useState(false);

  /* L'allure du mur vient du disque et peut manquer, ou avoir été écrite
     par une autre version : `wallLookOf` la ramène toujours à une allure
     complète, quitte à retomber sur les défauts. */
  const look = useMemo(() => wallLookOf(ui.look), [ui.look]);
  const skin = useMemo(
    () => wallStyle(look.decor, look.decor?.patternInk ? catInk(look.decor.patternInk) : undefined),
    [look.decor]
  );

  /* Genre et décennie se cumulent : ce sont deux tamis posés l'un sur
     l'autre, et non deux boutons qui se disputent la liste. */
  const passesFilters = useCallback(
    (f) =>
      (!genreFilter || (f.genres || []).includes(genreFilter)) &&
      (decadeFilter === null || decadeOf(f) === decadeFilter),
    [genreFilter, decadeFilter]
  );

  /* Un film mis de côté n'a rien à faire sur le mur : c'est justement ce
     qu'on lui a demandé. Il reste visible sur l'étagère, dans son rayon. */
  const scope = useMemo(
    () => (mode === "shelf" ? films : films.filter((f) => !f.archived)),
    [films, mode]
  );
  const asideCount = useMemo(() => films.filter((f) => f.archived).length, [films]);

  /* Sur l'étagère, chercher n'est pas filtrer.

     Retirer les films qui ne correspondent pas démonterait l'agencement à
     chaque lettre tapée, et rendrait les rangées absurdes — une ligne de
     six qui n'en montre plus qu'un. On garde donc tout en place et on
     ÉTEINT ce qui ne répond pas : la collection reste lisible comme une
     étagère, et ce qu'on cherche s'y détache. */
  const matches = useCallback(
    (f) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return f.title.toLowerCase().includes(s) || (f.director || "").toLowerCase().includes(s);
    },
    [q]
  );

  const dimSet = useMemo(() => {
    if (mode !== "shelf" || (!q && !genreFilter && decadeFilter === null)) return null;
    return new Set(scope.filter((f) => matches(f) && passesFilters(f)).map((f) => f.id));
  }, [mode, q, genreFilter, decadeFilter, scope, matches, passesFilters]);

  /* Ranger l'étagère d'un geste. Le tri n'est plus un état qui se battrait
     avec les catégories : c'est un verbe qui réécrit l'agencement une
     fois, puis s'efface. Les catégories et les objets posés gardent leur
     place ; seuls les films circulent. */
  /* Un rangement se relit dans les deux sens : recliquer le même verbe
     retourne la rangée plutôt que de la refaire à l'identique. */
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
    let list = scope.filter((f) => {
      const mq =
        !q ||
        f.title.toLowerCase().includes(q.toLowerCase()) ||
        (f.director || "").toLowerCase().includes(q.toLowerCase());
      return mq && passesFilters(f);
    });
    return [...list].sort((a, b) => {
      const cmp =
        // A–Z se lit dans l'ordre naturel : c'est `desc` qui l'inverse
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

  /* Le regroupement par réalisateur : une pile de fiches par cinéaste, les
     plus fréquentés d'abord — c'est là que se lisent les habitudes. */
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
        <div style={{ minWidth: 200 }}>
          <Label>Chercher</Label>
          <input
            style={underlineInput}
            placeholder="un titre, un·e cinéaste…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && (
              <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>
            )}
            {allGenres.map((g) => {
              // chaque genre porte sa propre encre — l'étiquetage n'a pas été fait le même jour
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
        <div>
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
        <div>
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
        {mode === "wall" && (
          <div>
            <Label>Classer</Label>
            <button
              onClick={() => setGrouped((g) => !g)}
              style={{
                all: "unset",
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
          <div>
            <Label>Décor</Label>
            {/* En écho à « ATELIER DÉCO… » de l'étagère : le mur aussi se
                peint, et ses fiches aussi ont un calibre. */}
            <button
              onClick={() => setWallStudio(true)}
              title="Peindre le mur, régler la taille et le désordre des fiches"
              style={{
                all: "unset",
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
        <div style={{ position: "relative", zIndex: 2 }}>
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
        /* LE MUR — la surface d'abord, les fiches dessus.

           Le fond est peint par le MÊME moteur que celui des rayons
           (`wallStyle`) : peinture, papier peint et texture. Il déborde
           du contenu de vingt pixels pour que les fiches ne soient pas
           collées à l'arête, et la texture reste un calque à elle, qui
           se fond en `multiply` — un fond ne sait pas faire ça seul. */
        <div style={{ position: "relative", zIndex: 2, padding: look.decor ? 20 : 0, ...skin.frame }}>
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
    </div>
  );
}

/* Ce qu'on voit quand le mur est vide — la collection l'est, ou bien le
   tamis ne laisse rien passer. Ce sont deux vides différents, et ils ne
   se disent pas de la même façon. */
function WallEmpty({ films, cfg }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: C.inkFaded,
      }}
    >
      <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
      <div
        style={{
          fontFamily: F.title,
          fontSize: 20,
          color: C.ink,
          marginBottom: 6,
        }}
      >
        {films.length === 0 ? cfg.empty[0] : "Rien à afficher"}
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 19 }}>
        {films.length === 0 ? cfg.empty[1] : "Essayez une autre recherche."}
      </div>
    </div>
  );
}

/* Le filet qui sépare deux réalisateurs, quand le mur est classé. */
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
