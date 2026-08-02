import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import {
  Pin, Paperclip, Plus, X, Trash2, ArrowLeft, Upload,
  Star, BookOpen, Palette, Clapperboard, Sparkles, Link2,
  LayoutGrid, Library, Archive, ArchiveRestore, Moon,
} from "lucide-react";
import Papa from "papaparse";
import { enrichRows, checkApiKey, listPosters, POSTER_BASE, POSTER_THUMB } from "./tmdb";
import { buildTaste } from "./taste";
import { gatherCandidates, rank, DEFAULT_QUERY } from "./reco";
import {
  IDB_PREFIX, isIdbPoster, idbKeyOf, putImage, getImage, deleteImage,
  posterStats, pruneOrphans, exportBackup, importBackup,
} from "./db";
import { C, FONT_IMPORT, GRAIN } from "./theme/tokens";
import { tapeColor, hueOf } from "./theme/ink";
import { hash, seededRand, tiltOf, usesPin, nudgeOf, fileNoOf, tornClip } from "./domain/seeded";
import { uid, makeFilm, migrate } from "./domain/film";
import { slugOf, filmKey, parseRating, parseLetterboxdCsv, diffImport } from "./domain/importing";
import { workKey, buildSky, relax } from "./domain/sky";
import { store } from "./services/storage";
import { underlineInput, ruledTextarea } from "./theme/styles";
import {
  PaperGrain, CoffeeRing, TapeResidue, InkUnderline, FileNumber,
  Tape, PushPin, StampCorner,
} from "./components/atmosphere";
import { InkStars, Label } from "./components/ui";
import { PosterArt } from "./components/film/PosterArt";
import { FilmPolaroid } from "./components/film/FilmPolaroid";
import { FilmModal } from "./components/film/FilmModal";
import { FolderTabs } from "./components/layout/FolderTabs";
import { FilmWall } from "./views/library/FilmWall";
import { WALLS } from "./views/library/walls";
import { SHELF_KIND, BOX_W, BOX_H, DROP_MARK_STYLE } from "./components/shelf/constants";
import { ShelfItems } from "./components/shelf/ShelfItems";
import { Shelf } from "./components/shelf/Shelf";
import { ReserveDrawer } from "./components/shelf/ReserveDrawer";
import { CasePreview } from "./components/shelf/CasePreview";

/* Ces symboles vivaient ici avant le découpage ; d'autres modules les
   importent encore depuis ce fichier. Réexportés le temps de la migration. */
export { makeFilm, migrate, slugOf, filmKey, parseRating, parseLetterboxdCsv, diffImport };


const LINK_TYPES = [
  { key: "book", label: "Livre", icon: BookOpen },
  { key: "painting", label: "Peinture", icon: Palette },
  { key: "film", label: "Film", icon: Clapperboard },
  { key: "other", label: "Autre œuvre", icon: Sparkles },
];

/* Le rangement à la main. Déposer écrit un `order` sur chaque boîtier du
   rayon d'arrivée : sans numéro stable, l'ordre repartirait au tri par
   défaut au prochain rendu. */
function ShelfBoard({ films, dividers, onDividers, wall, onOpen, onUpdateMany, manual, onManual, perRow }) {
  /* Un glissement ne change AUCUN état React. C'était le dernier retard
     visible : `setDragId` au départ du glissement re-rendait le rayon, ce
     qui salissait la mise en page — et le premier `getBoundingClientRect`
     du premier survol devait alors la recalculer entièrement avant que le
     repère puisse s'afficher. D'où un trait qui tardait à apparaître.

     Tout ce qui bouge pendant un glissement est donc écrit à la main : le
     boîtier pâli, le repère, et l'attribut `data-dragging` du document qui
     sert aux quelques effets CSS (la languette du tiroir). */
  const dragRef = useRef(null);                  // { type: "film" | "divider", id, node }
  const overRef = useRef({ id: null, side: null });
  const markRef = useRef(null);                  // le repère de dépôt, hors React
  const [preview, setPreview] = useState(null);
  const [drawer, setDrawer] = useState(false);

  const rank = (o) => (o == null ? Number.MAX_SAFE_INTEGER : o);
  const belongs = {
    chevet: (f) => f.chevet && !f.archived,
    main: (f) => !f.chevet && !f.archived,
    reserve: (f) => f.archived,
  };

  /* Un rayon n'est plus une liste de films mais une liste d'objets rangés :
     boîtiers et intercalaires partagent la même numérotation, sans quoi on
     ne pourrait pas glisser un carton *entre* deux films. */
  const shelves = useMemo(() => {
    const mine = (dividers || []).filter((d) => d.wall === wall);
    const build = (kind) => {
      const boxes = films.filter(belongs[kind]).map((f) => ({ type: "film", id: f.id, film: f, order: rank(f.order), tie: -(f.addedAt || 0) }));
      // hors rangement manuel, l'ordre affiché est celui du tri : un
      // intercalaire n'y aurait pas de place définie, il attend son tour
      if (!manual) return boxes;
      const tabs = mine.filter((d) => d.shelf === kind).map((d) => ({ type: "divider", id: d.id, divider: d, order: rank(d.order), tie: 0 }));
      return [...boxes, ...tabs].sort((a, b) => a.order - b.order || a.tie - b.tie);
    };
    return { chevet: build("chevet"), main: build("main"), reserve: build("reserve") };
  }, [films, dividers, wall, manual]);

  const hideMark = () => { if (markRef.current) markRef.current.style.opacity = "0"; };

  const reset = useCallback(() => {
    const d = dragRef.current;
    if (d?.node) d.node.style.opacity = "";
    dragRef.current = null; overRef.current = { id: null, side: null };
    hideMark();
    delete document.documentElement.dataset.dragging;
  }, []);

  const onDragStart = useCallback((type, id, node) => {
    dragRef.current = { type, id, node };
    if (node) node.style.opacity = "0.35";     // le boîtier soulevé, sans passer par React
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* `dragover` tire en continu tant que la souris bouge, et même immobile.

     Ce gestionnaire ne touche plus à l'état React : il déplace un unique
     élément à la main. Faire passer le repère par un `setState`, c'était
     redemander à React de reconstruire les cent boîtiers du rayon à chaque
     frimousse de la souris — même mémoïsés, cent comparaisons de props par
     événement, soixante fois par seconde. Ici, un déplacement de rectangle
     et rien d'autre : React dort pendant tout le glissement. */
  const onBoxOver = useCallback((e, kind, id) => {
    if (!dragRef.current) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const s = e.clientX < r.left + r.width / 2 ? "before" : "after";
    if (overRef.current.id === id && overRef.current.side === s) return;
    overRef.current = { id, side: s, kind };
    const m = markRef.current;
    if (m) {
      m.style.transform = `translate3d(${Math.round(s === "before" ? r.left - 7 : r.right + 3)}px, ${Math.round(r.bottom - BOX_H)}px, 0)`;
      if (m.style.opacity !== "1") m.style.opacity = "1";
    }
  }, []);

  const onShelfOver = useCallback(() => {}, []);   // le repère suffit à dire où l'on va

  /* Écrire l'ordre d'arrivée.

     La version précédente renumérotait le rayon entier à chaque dépôt :
     cent fiches réécrites, cent boîtiers reconstruits, et toute la
     collection re-sérialisée dans localStorage — d'où un dépôt qui traîne,
     et qui pouvait carrément échouer en butant sur le quota quand les
     affiches sont stockées en data URI.

     On ne déplace plus qu'un objet : il reçoit un numéro pris ENTRE ses
     deux voisins. Les intervalles de 10 laissent de la place pour une
     bonne dizaine d'insertions successives au même endroit ; quand il n'y
     en a plus (ou qu'un objet n'a jamais été numéroté), on renumérote le
     rayon, mais seulement ce jour-là. */
  const NUM = (it) => (it.type === "film" ? it.film.order : it.divider.order);

  const renumber = (kind, list, movedId) => {
    const patches = {};
    const others = (dividers || []).filter((d) => !(d.wall === wall && list.some((it) => it.type === "divider" && it.id === d.id)));
    const tabs = [];
    list.forEach((it, i) => {
      if (it.type === "film") patches[it.id] = { order: i * 10 };
      else tabs.push({ ...it.divider, wall, shelf: kind, order: i * 10 });
    });
    if (movedId) patches[movedId] = { ...patches[movedId], ...SHELF_KIND[kind].patch };
    if (Object.keys(patches).length) onUpdateMany(patches);
    onDividers([...others, ...tabs]);
  };

  /* Le numéro à donner à ce qui arrive en position `at`, ou null s'il n'y a
     plus de place et qu'il faut renuméroter. `rest` est le rayon sans lui. */
  const gap = (rest, at) => {
    if (rest.some((it) => NUM(it) == null)) return null;   // rayon jamais numéroté
    const prev = at > 0 ? NUM(rest[at - 1]) : null;
    const next = at < rest.length ? NUM(rest[at]) : null;
    if (prev == null && next == null) return 0;
    if (prev == null) return next - 10;
    if (next == null) return prev + 10;
    if (next - prev < 0.0001) return null;                 // plus d'intervalle
    return (prev + next) / 2;
  };

  /* Deux gestes différents portés par le même glissement.

     Lâcher un film DANS un rayon ou dans le tiroir, c'est le classer : on
     dit ce qu'il est, pas où il se range. Le tri en cours — par note, par
     année — n'a aucune raison d'être abandonné pour autant.

     Le lâcher ENTRE deux boîtiers, c'est lui donner une place précise :
     là, aucun tri automatique ne peut la tenir, et le rangement passe à
     la main. `positioned` fait la différence. */
  const place = (kind, item, rest, at, positioned) => {
    if (!positioned && !manual) {
      if (item.type === "film") onUpdateMany({ [item.id]: { ...SHELF_KIND[kind].patch } });
      else onDividers((dividers || []).map((d) => (d.id === item.id ? { ...d, wall, shelf: kind } : d)));
      return reset();   // le tri reste celui qu'on avait choisi
    }

    /* On passe du tri automatique au rangement à la main : les numéros
       existants ne suivent pas l'ordre affiché (trier par note ne réordonne
       pas les `order`), donc chercher un intervalle entre deux voisins
       n'aurait aucun sens. On fige l'ordre qu'on a sous les yeux. */
    if (positioned && !manual) {
      renumber(kind, [...rest.slice(0, at), item, ...rest.slice(at)], item.type === "film" ? item.id : null);
      onManual();
      return reset();
    }

    const order = gap(rest, at);
    if (order == null) {
      renumber(kind, [...rest.slice(0, at), item, ...rest.slice(at)], item.type === "film" ? item.id : null);
    } else if (item.type === "film") {
      onUpdateMany({ [item.id]: { order, ...SHELF_KIND[kind].patch } });
    } else {
      onDividers((dividers || []).map((d) => (d.id === item.id ? { ...d, wall, shelf: kind, order } : d)));
    }
    if (positioned) onManual();
    reset();
  };

  const drop = (kind) => {
    const drag = dragRef.current;
    if (!drag) return;
    const target = shelves[kind].filter((it) => it.id !== drag.id);
    const source = drag.type === "film"
      ? { type: "film", id: drag.id, film: films.find((f) => f.id === drag.id) }
      : { type: "divider", id: drag.id, divider: (dividers || []).find((d) => d.id === drag.id) };
    if (!source.film && !source.divider) return reset();

    /* Le dépôt ne vise une place que s'il a été lâché sur un boîtier DE CE
       rayon : sur le fond du rayon, sur la languette du tiroir, ou sur un
       repère resté d'un autre rayon, il ne dit rien de la position. */
    const { id: over, side: atSide } = overRef.current;
    let at = target.length;
    let positioned = false;
    if (over && over !== drag.id) {
      const i = target.findIndex((it) => it.id === over);
      if (i >= 0) { at = atSide === "after" ? i + 1 : i; positioned = true; }
    }
    place(kind, source, target, at, positioned);
  };

  /* Posé en bout de rayon. Une seule écriture : `renumber` reconstruit la
     liste des intercalaires à partir du rayon, le nouveau carton compris. */
  const addDivider = (kind) => {
    const list = shelves[kind];
    const order = gap(list, list.length);
    const tab = { id: uid(), wall, shelf: kind, label: "Intercalaire", order: order == null ? 0 : order };
    if (order == null) renumber(kind, [...list, { type: "divider", id: tab.id, divider: tab }], null);
    else onDividers([...(dividers || []), tab]);
    onManual();
    reset();
  };
  /* Poser un carton juste avant un boîtier donné, sans passer par le haut
     du rayon. C'est un rangement à la main : il prend l'ordre affiché. */
  const insertDividerBefore = (kind, beforeId) => {
    const list = shelves[kind];
    const at = Math.max(0, list.findIndex((it) => it.id === beforeId));
    const rest = list;
    const order = manual ? gap(rest, at) : null;
    const tab = { id: uid(), wall, shelf: kind, label: "Intercalaire", perRow: null, order: order == null ? 0 : order };
    if (order == null) renumber(kind, [...rest.slice(0, at), { type: "divider", id: tab.id, divider: tab }, ...rest.slice(at)], null);
    else onDividers([...(dividers || []), tab]);
    onManual();
    reset();
  };

  const renameDivider = (id, label) => onDividers((dividers || []).map((d) => (d.id === id ? { ...d, label } : d)));
  const setDividerPerRow = (id, perRow) => onDividers((dividers || []).map((d) => (d.id === id ? { ...d, perRow } : d)));
  const removeDivider = (id) => onDividers((dividers || []).filter((d) => d.id !== id));

  const dnd = {
    onDragStart, onDragEnd: reset, onShelfOver,
    onBoxOver, onDrop: drop,
  };
  const shared = {
    onOpen: setPreview, dnd, perRow, manual,
    onAddDivider: addDivider, onRename: renameDivider, onRemoveDivider: removeDivider,
    onSetPerRow: setDividerPerRow, onInsertDivider: insertDividerBefore,
  };
  const countOf = (kind) => films.filter(belongs[kind]).length;

  return (
    <div onDragEnd={reset}>
      {/* le repère de dépôt : un seul, déplacé à la main pendant le glissement */}
      <div ref={markRef} aria-hidden style={DROP_MARK_STYLE} />
      <Shelf kind="chevet" items={shelves.chevet} count={countOf("chevet")} {...shared}
        empty="Aucun film de chevet — glissez-en un ici." />
      <Shelf kind="main" items={shelves.main} count={countOf("main")} {...shared}
        empty="Le rayon est vide." />
      <ReserveDrawer
        items={shelves.reserve} count={countOf("reserve")}
        open={drawer} setOpen={setDrawer} dnd={dnd} onOpen={setPreview}
        onRename={renameDivider} onRemoveDivider={removeDivider} onAddDivider={addDivider}
        onSetPerRow={setDividerPerRow} onInsertDivider={insertDividerBefore} manual={manual}
      />
      {preview && films.find((f) => f.id === preview) && (
        <CasePreview film={films.find((f) => f.id === preview)} onClose={() => setPreview(null)} onOpenFile={onOpen} />
      )}
    </div>
  );
}

function LibraryView({ films, onOpen, wall = "watched", ui, setUi, onUpdateMany, dividers, onDividers }) {
  const cfg = WALLS[wall];
  /* Recherche, filtre et tri vivent dans App : ouvrir un film démonte cette
     vue, et un état local serait perdu au retour au mur. */
  const { q, genreFilter, sortBy, desc, grouped } = ui;
  const mode = ui.mode === "shelf" ? "shelf" : "wall";
  const perRow = ui.perRow || "auto";
  const set = (patch) => setUi({ ...ui, ...patch });
  const setQ = (v) => set({ q: v });
  const setGenreFilter = (v) => set({ genreFilter: v });
  const setGrouped = (fn) => set({ grouped: typeof fn === "function" ? fn(grouped) : fn });
  // recliquer le tri actif inverse simplement le sens
  const pickSort = (k) => set(k === sortBy ? { desc: !desc } : { sortBy: k, desc: true });

  const allGenres = useMemo(() => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(), [films]);

  /* Un film mis de côté n'a rien à faire sur le mur : c'est justement ce
     qu'on lui a demandé. Il reste visible sur l'étagère, dans son rayon. */
  const scope = useMemo(() => (mode === "shelf" ? films : films.filter((f) => !f.archived)), [films, mode]);
  const asideCount = useMemo(() => films.filter((f) => f.archived).length, [films]);

  const filtered = useMemo(() => {
    let list = scope.filter((f) => {
      const mq = !q || f.title.toLowerCase().includes(q.toLowerCase()) || (f.director || "").toLowerCase().includes(q.toLowerCase());
      const mg = !genreFilter || (f.genres || []).includes(genreFilter);
      return mq && mg;
    });
    return [...list].sort((a, b) => {
      const cmp =
        // A–Z se lit dans l'ordre naturel : c'est `desc` qui l'inverse
        sortBy === "title" ? -a.title.localeCompare(b.title)
        : sortBy === "director" ? -((a.director || "zzz").localeCompare(b.director || "zzz") || a.title.localeCompare(b.title))
        : sortBy === "year" ? (b.year || 0) - (a.year || 0)
        : sortBy === "rating" ? (b.rating || 0) - (a.rating || 0)
        // les films jamais datés glissent en fin de liste plutôt qu'en tête
        : sortBy === "watched" ? (b.watchedAt || "").localeCompare(a.watchedAt || "")
        : (b.addedAt || 0) - (a.addedAt || 0);
      return desc ? cmp : -cmp;
    });
  }, [scope, q, genreFilter, sortBy, desc]);

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
    return [...by.entries()].sort((a, b) =>
      b[1].length - a[1].length ||
      (a[0] === "Réalisateur inconnu" ? 1 : b[0] === "Réalisateur inconnu" ? -1 : a[0].localeCompare(b[0]))
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
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>{cfg.title}</div>
      <InkUnderline width={cfg.underline} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>{cfg.subtitle}</div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end", marginTop: 26, marginBottom: 34, borderBottom: `1px dashed ${C.line}`, paddingBottom: 18, position: "relative", zIndex: 2 }}>
        <div style={{ minWidth: 200 }}>
          <Label>Chercher</Label>
          <input style={underlineInput} placeholder="un titre, un·e cinéaste…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>}
            {allGenres.map((g) => {
              // chaque genre porte sa propre encre — l'étiquetage n'a pas été fait le même jour
              const ink = [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate][Math.abs(hash(g)) % 5];
              const on = genreFilter === g;
              return (
                <button key={g} onClick={() => setGenreFilter(on ? "" : g)} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5, padding: "4px 11px", borderRadius: 14, border: `1px solid ${ink}`, color: on ? C.card : ink, background: on ? ink : "transparent", transform: `rotate(${(Math.abs(hash(g)) % 5) - 2}deg)`, boxShadow: on ? `1px 2px 4px ${ink}55` : "none", transition: "background .15s ease" }}>{g}</button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Trier</Label>
          <div style={{ display: "flex", gap: 14, fontFamily: "'Special Elite', monospace", fontSize: 11 }}>
            {/* le rangement à la main n'existe que là où l'on peut ranger */}
            {(mode === "shelf" ? [...cfg.sorts, ["manual", "à la main"]] : cfg.sorts).map(([k, l]) => (
              <span key={k} onClick={() => pickSort(k)} title={sortBy === k ? "cliquer pour inverser" : ""} style={{ cursor: "pointer", color: sortBy === k ? C.burgundy : C.inkFaded, textDecoration: sortBy === k ? "underline" : "none" }}>
                {l}{sortBy === k && <span style={{ marginLeft: 3 }}>{desc ? "↓" : "↑"}</span>}
              </span>
            ))}
          </div>
        </div>
        <div>
          <Label>Présentation</Label>
          <div style={{ display: "flex", marginTop: 2 }}>
            {[{ k: "wall", l: "MUR", icon: LayoutGrid }, { k: "shelf", l: "ÉTAGÈRE", icon: Library }].map(({ k, l, icon: Icon }) => (
              <button key={k} onClick={() => set({ mode: k })} style={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                fontFamily: "'Special Elite', monospace", fontSize: 10.5,
                background: mode === k ? C.ink : "transparent", color: mode === k ? C.card : C.inkFaded,
                border: `1px solid ${mode === k ? C.ink : C.line}`, marginLeft: k === "shelf" ? -1 : 0,
              }}><Icon size={12} /> {l}</button>
            ))}
          </div>
        </div>
        {mode === "shelf" && (
          <div>
            <Label>Par ligne</Label>
            <div style={{ display: "flex", marginTop: 2 }}>
              {["auto", 4, 6, 8, 10, 12].map((n, i) => (
                <button key={n} onClick={() => set({ perRow: n })} style={{
                  all: "unset", cursor: "pointer", padding: "5px 9px", minWidth: 12, textAlign: "center",
                  fontFamily: "'Special Elite', monospace", fontSize: 10.5,
                  background: perRow === n ? C.ink : "transparent", color: perRow === n ? C.card : C.inkFaded,
                  border: `1px solid ${perRow === n ? C.ink : C.line}`, marginLeft: i === 0 ? 0 : -1,
                }}>{n === "auto" ? "AUTO" : n}</button>
              ))}
            </div>
          </div>
        )}
        {mode === "wall" && <div>
          <Label>Classer</Label>
          <button
            onClick={() => setGrouped((g) => !g)}
            style={{
              all: "unset", cursor: "pointer", padding: "5px 12px", marginTop: 2,
              fontFamily: "'Special Elite', monospace", fontSize: 10.5,
              background: grouped ? C.pine : "transparent", color: grouped ? C.card : C.inkFaded,
              border: `1px solid ${grouped ? C.pine : C.line}`,
            }}
          >PAR RÉALISATEUR</button>
        </div>}
        {mode === "wall" && asideCount > 0 && (
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded }}>
            <button onClick={() => set({ mode: "shelf" })} style={{ all: "unset", cursor: "pointer", borderBottom: `1px dashed ${C.line}` }}>
              {asideCount} film{asideCount > 1 ? "s" : ""} de côté — voir l'étagère
            </button>
          </div>
        )}
      </div>

      {mode === "shelf" ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {sortBy !== "manual" && (dividers || []).some((d) => d.wall === wall) && (
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded, marginTop: 8 }}>
              Vos intercalaires réapparaissent avec le rangement « à la main » — un tri les déplacerait sans les respecter.
            </div>
          )}
          <ShelfBoard
            films={filtered} onOpen={onOpen} onUpdateMany={onUpdateMany}
            dividers={dividers} onDividers={onDividers} wall={wall} perRow={perRow}
            manual={sortBy === "manual"}
            onManual={() => { if (sortBy !== "manual") set({ sortBy: "manual", desc: true }); }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.inkFaded, position: "relative", zIndex: 2 }}>
          <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 6 }}>{films.length === 0 ? cfg.empty[0] : "Rien à afficher"}</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19 }}>{films.length === 0 ? cfg.empty[1] : "Essayez une autre recherche."}</div>
        </div>
      ) : grouped ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {groups.map(([director, list]) => (
            <div key={director} style={{ marginBottom: 46 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 26, color: C.ink }}>{director}</div>
                <div style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, transform: "translateY(-6px)" }} />
                <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded }}>{list.length} film{list.length > 1 ? "s" : ""}</div>
              </div>
              <FilmWall films={list} onOpen={onOpen} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 2 }}>
          <FilmWall films={filtered} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PANNEAU D'ENQUÊTE — fils tendus mesurés en SVG
   ============================================================ */
function ThreadBoard({ film, onRemove, films = [], onOpen }) {
  // les fiches encore présentes derrière les renvois : une fiche supprimée
  // laisse le lien lisible mais inerte plutôt qu'un bouton qui casse
  const linkedFilms = useMemo(() => {
    const byId = new Map(films.map((f) => [f.id, f]));
    return Object.fromEntries((film.linkedWorks || [])
      .filter((w) => w.filmId && byId.has(w.filmId))
      .map((w) => [w.filmId, byId.get(w.filmId)]));
  }, [films, film.linkedWorks]);

  const boardRef = useRef(null);
  const pinRef = useRef(null);
  const cardRefs = useRef({});
  const [paths, setPaths] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });
  const works = film.linkedWorks || [];

  const recompute = useCallback(() => {
    const board = boardRef.current;
    const pin = pinRef.current;
    if (!board || !pin) return;
    const bRect = board.getBoundingClientRect();
    const pRect = pin.getBoundingClientRect();
    const x0 = pRect.left + pRect.width / 2 - bRect.left;
    const y0 = pRect.bottom - bRect.top - 2;
    const next = works.map((w) => {
      const el = cardRefs.current[w.id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x1 = r.left + r.width / 2 - bRect.left;
      const y1 = r.top - bRect.top + 4;
      // caténaire : le fil pend d'autant plus qu'il est long, et jamais symétriquement
      const span = Math.abs(x1 - x0);
      const sag = 26 + span * 0.16 + seededRand(Math.abs(hash(w.id))) * 22;
      const c1x = x0 + (x1 - x0) * 0.28, c2x = x0 + (x1 - x0) * 0.72;
      const lowest = Math.max(y0, y1) + sag;
      return {
        id: w.id,
        d: `M ${x0} ${y0} C ${c1x} ${lowest}, ${c2x} ${lowest * 0.96}, ${x1} ${y1}`,
        knot: { x: x1, y: y1 },
      };
    }).filter(Boolean);
    setPaths(next);
    setSvgSize({ w: bRect.width, h: bRect.height });
  }, [works]);

  useLayoutEffect(() => {
    const t = setTimeout(recompute, 30);
    window.addEventListener("resize", recompute);
    return () => { clearTimeout(t); window.removeEventListener("resize", recompute); };
  }, [recompute]);

  return (
    <div ref={boardRef} style={{ position: "relative", paddingTop: 30 }}>
      <svg width={svgSize.w} height={svgSize.h} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}>
        {paths.map((p) => (
          <g key={p.id}>
            {/* l'ombre du fil, décalée : il flotte au-dessus du papier */}
            <path d={p.d} fill="none" stroke="#2B262033" strokeWidth="3" strokeLinecap="round" transform="translate(1.5,3)" />
            {/* l'âme sombre de la corde, puis la torsade éclairée par-dessus */}
            <path d={p.d} fill="none" stroke="#6B241F" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
            <path d={p.d} fill="none" stroke="#C4562E" strokeWidth="2.6" strokeDasharray="2.5 4" strokeLinecap="round" opacity="0.8" />
            {/* le nœud là où le fil mord la fiche */}
            <circle cx={p.knot.x} cy={p.knot.y} r="3.2" fill="#6B241F" opacity="0.9" />
          </g>
        ))}
      </svg>

      <div ref={pinRef} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.ink, color: C.card, padding: "7px 16px", position: "relative", zIndex: 2 }}>
        <PushPin color={C.burgundy} style={{ position: "static", marginRight: 2 }} />
        <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1 }}>{film.title.toUpperCase()}</span>
      </div>

      {works.length === 0 ? (
        <div style={{ color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 19, marginTop: 26 }}>rien d'épinglé pour l'instant…</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "40px 28px", marginTop: 40, position: "relative", zIndex: 2 }}>
          {works.map((w) => {
            const type = LINK_TYPES.find((t) => t.key === w.type) || LINK_TYPES[3];
            const Icon = type.icon;
            const tilt = tiltOf(w.id);
            const pinned = usesPin(w.id);
            return (
              <div
                key={w.id}
                ref={(el) => { if (el) cardRefs.current[w.id] = el; }}
                style={{ position: "relative", background: C.card, padding: "12px 16px 14px", boxShadow: "2px 5px 12px rgba(30,20,10,0.25)", transform: `rotate(${tilt / 2}deg)`, width: 200 }}
              >
                {pinned ? <PushPin style={{ top: -7, left: "50%", marginLeft: -7 }} /> : <Tape color={tapeColor(w.id)} rotate={tilt > 0 ? -8 : 8} width={54} style={{ top: -9, left: "50%", marginLeft: -27 }} />}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Icon size={15} color={C.burgundy} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {/* un renvoi vers une fiche du mur s'ouvre ; une simple
                        mention reste du texte, y compris si la fiche a disparu */}
                    {linkedFilms[w.filmId] ? (
                      <button
                        onClick={() => onOpen(w.filmId)}
                        style={{ all: "unset", cursor: "pointer", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: C.burgundy, lineHeight: 1.2, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
                      >{w.title}</button>
                    ) : (
                      <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: C.ink, lineHeight: 1.2 }}>{w.title}</div>
                    )}
                    <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginTop: 3 }}>
                      {type.label}{w.creator ? ` — ${w.creator}` : ""}
                      {linkedFilms[w.filmId] && <span style={{ color: C.burgundy }}> · fiche liée</span>}
                      {w.filmId && !linkedFilms[w.filmId] && <span style={{ color: C.inkFaded }}> · fiche supprimée</span>}
                    </div>
                    {w.note && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 5 }}>« {w.note} »</div>}
                  </div>
                  <button onClick={() => onRemove(w.id)} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}><X size={12} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CAPTURES D'ÉCRAN

   Les images vivent dans IndexedDB ; la fiche ne retient qu'une clé.
   Une capture peut être appelée dans le texte d'une critique par un
   jeton [img:N] : dans la vue de lecture, ce jeton devient une vignette
   minuscule, et la cliquer ouvre la vraie image dans le carrousel.
   ============================================================ */

/* Une image d'IndexedDB, servie en URL d'objet le temps de l'affichage. */
function IdbImage({ imageKey, alt = "", style, onClick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let objectUrl = null, alive = true;
    getImage(imageKey).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(console.error);
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageKey]);
  if (!url) return <div style={{ ...style, background: C.paperDark }} />;
  return <img src={url} alt={alt} onClick={onClick} style={style} />;
}

const STILL_TOKEN = /\[img:(\d+)\]/g;

/* Une regex globale porte un curseur (`lastIndex`) : la partager entre un
   `exec` en boucle et un rendu React reviendrait à muter un état de module
   pendant le rendu. Les parcours pas-à-pas prennent donc leur propre copie. */
const stillTokenScanner = () => new RegExp(STILL_TOKEN.source, "g");

/* La visionneuse plein écran, avec navigation au clavier. */
function StillLightbox({ stills, index, onClose, onIndex }) {
  const still = stills[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % stills.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + stills.length) % stills.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stills.length, onClose, onIndex]);
  if (!still) return null;

  return (
    /* Fermer ne se déclenche que sur le fond lui-même (`e.target` = le voile),
       jamais sur ce qu'il contient : viser à côté de l'image ne referme plus
       la visionneuse par accident. */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(20,15,10,0.88)", zIndex: 80, display: "flex", alignItems: "stretch", justifyContent: "center" }}
    >
      {/* `all: unset` remet le bouton en inline : sans `flex`, le rembourrage
          vertical ne compte pas et la cible reste une mince bande */}
      <button onClick={onClose} title="fermer (Échap)" style={{ all: "unset", position: "absolute", top: 10, right: 14, cursor: "pointer", color: C.paper, padding: 16, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}><X size={22} /></button>

      {/* colonnes de navigation pleine hauteur : une cible large, pas un chevron */}
      {stills.length > 1 && (
        <button
          onClick={() => onIndex((index - 1 + stills.length) % stills.length)}
          title="précédente (←)"
          style={{ all: "unset", cursor: "pointer", width: "16%", minWidth: 90, display: "flex", alignItems: "center", justifyContent: "center", color: `${C.paper}99`, fontSize: 44, fontFamily: "'Playfair Display', serif" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = C.paper; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = `${C.paper}99`; }}
        >‹</button>
      )}

      {/* la zone centrale est entièrement sûre, marges comprises */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 10px", minWidth: 0 }}>
        <div style={{ background: C.card, padding: 10, boxShadow: "0 14px 40px rgba(0,0,0,0.6)", maxWidth: "100%" }}>
          <IdbImage imageKey={still.key} style={{ display: "block", maxWidth: "100%", maxHeight: "72vh", objectFit: "contain" }} />
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 21, color: C.paper, marginTop: 12, textAlign: "center" }}>
          {still.caption || `capture ${index + 1}`}
          <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, opacity: 0.7, marginLeft: 10 }}>{index + 1} / {stills.length}</span>
        </div>
        <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: `${C.paper}66`, marginTop: 10, letterSpacing: 1 }}>
          ÉCHAP POUR FERMER
        </div>
      </div>

      {stills.length > 1 && (
        <button
          onClick={() => onIndex((index + 1) % stills.length)}
          title="suivante (→)"
          style={{ all: "unset", cursor: "pointer", width: "16%", minWidth: 90, display: "flex", alignItems: "center", justifyContent: "center", color: `${C.paper}99`, fontSize: 44, fontFamily: "'Playfair Display', serif" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = C.paper; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = `${C.paper}99`; }}
        >›</button>
      )}
    </div>
  );
}

/* Les URL d'objet des captures, mutualisées : le même blob sert la bande,
   les vignettes en ligne et la visionneuse. Révoquées au démontage. */
function useStillUrls(stills) {
  const [urls, setUrls] = useState({});
  const keys = (stills || []).map((s) => s.key).join("|");
  useEffect(() => {
    let alive = true;
    const made = [];
    Promise.all((stills || []).map(async (s) => {
      // vignette si elle existe : inutile de décoder du 4K pour 110 px
      const blob = await getImage(s.thumbKey || s.key).catch(() => null)
        || await getImage(s.key).catch(() => null);
      if (!blob) return null;
      const u = URL.createObjectURL(blob);
      made.push(u);
      return [s.key, u];
    })).then((pairs) => {
      if (!alive) { made.forEach(URL.revokeObjectURL); return; }
      setUrls(Object.fromEntries(pairs.filter(Boolean)));
    });
    return () => { alive = false; made.forEach(URL.revokeObjectURL); };
  }, [keys]);
  return urls;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Texte (avec jetons) → HTML affichable. La vignette est un bloc atomique
   non éditable : le curseur la franchit d'un coup, comme un caractère. */
function textToHtml(text, stills, urls) {
  return escapeHtml(text || "")
    .replace(STILL_TOKEN, (full, n) => {
      const still = stills[Number(n) - 1];
      if (!still) return `<span data-missing="1" style="font-family:'Special Elite',monospace;font-size:11px;color:${C.burgundy}">[capture ${n} manquante]</span>`;
      const src = urls[still.key] || "";
      return `<img data-still="${n}" src="${src}" alt="" contenteditable="false" draggable="false"` +
        ` style="display:inline-block;vertical-align:middle;height:64px;margin:2px 4px;` +
        `border:1px solid ${C.burgundy};padding:2px;background:${C.card};` +
        `box-shadow:1px 2px 5px rgba(30,20,10,0.3);transform:rotate(-1.2deg);cursor:zoom-in" />`;
    })
    .replace(/\n/g, "<br>");
}

/* HTML → texte (avec jetons). `stopAt` permet de mesurer la position du
   curseur dans le texte sérialisé, pour y réinsérer proprement. */
function htmlToText(root, stopAt) {
  let out = "";
  let done = false;
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (done) return;
      if (stopAt && n === stopAt.node && n.nodeType === 3) { out += n.nodeValue.slice(0, stopAt.offset); done = true; return; }
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === "IMG" && n.dataset.still) out += `[img:${n.dataset.still}]`;
      else if (n.nodeName === "BR") out += "\n";
      else {
        if (/^(DIV|P)$/.test(n.nodeName) && out && !out.endsWith("\n")) out += "\n";
        walk(n);
        if (done) return;
      }
      if (stopAt && n === stopAt.node) { done = true; return; }
    }
  };
  walk(root);
  return out;
}

/* Place le curseur à une position exprimée en caractères du texte sérialisé. */
function placeCaret(root, target) {
  let seen = 0, placed = false;
  const sel = window.getSelection();
  const range = document.createRange();
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (placed) return;
      if (n.nodeType === 3) {
        const len = n.nodeValue.length;
        if (seen + len >= target) { range.setStart(n, target - seen); placed = true; return; }
        seen += len;
      } else if (n.nodeName === "IMG" && n.dataset.still) {
        seen += `[img:${n.dataset.still}]`.length;
        if (seen >= target) { range.setStartAfter(n); placed = true; return; }
      } else if (n.nodeName === "BR") {
        seen += 1;
        if (seen >= target) { range.setStartAfter(n); placed = true; return; }
      } else walk(n);
    }
  };
  walk(root);
  if (!placed) range.selectNodeContents(root), range.collapse(false);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* Le texte d'une critique, en lecture seule (sert encore au carnet). */
function RichText({ text, stills, onOpenStill, placeholder }) {
  if (!text?.trim()) return <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19, color: C.inkFaded }}>{placeholder}</div>;

  const parts = [];
  let last = 0, m;
  const scanner = stillTokenScanner();
  while ((m = scanner.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: text.slice(last, m.index) });
    parts.push({ kind: "still", n: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });

  return (
    <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, lineHeight: "30px", color: C.ink, whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) => {
        if (p.kind === "text") return <span key={i}>{p.value}</span>;
        const still = stills[p.n - 1];
        if (!still) return <span key={i} style={{ color: C.burgundy, fontFamily: "'Special Elite', monospace", fontSize: 11 }}>[capture {p.n} manquante]</span>;
        return (
          <button
            key={i}
            onClick={() => onOpenStill(p.n - 1)}
            title={still.caption || `capture ${p.n}`}
            style={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
              verticalAlign: "middle", margin: "0 3px", padding: 2,
              background: C.card, border: `1px solid ${C.burgundy}`,
              boxShadow: "1px 2px 4px rgba(30,20,10,0.28)", transform: "rotate(-1.5deg)",
            }}
          >
            <IdbImage imageKey={still.thumbKey || still.key} style={{ display: "block", height: 22, width: "auto", objectFit: "contain" }} />
            <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 9, color: C.burgundy, paddingRight: 3 }}>{p.n}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Le champ d'écriture : on y tape normalement, et les captures insérées
   s'y affichent en vignette au milieu des phrases. Un textarea ne peut
   contenir que du texte brut — d'où un champ éditable riche, dont la
   source de vérité reste la chaîne à jetons enregistrée dans la fiche. */
function RichField({ label, value, onChange, stills, onOpenStill, onInsertToken, placeholder, minHeight = 120 }) {
  const ref = useRef(null);
  const lastEmitted = useRef(value);   // ce que le champ vient de produire
  const pendingCaret = useRef(null);   // où replacer le curseur après un rendu
  const urls = useStillUrls(stills);

  /* Renvoie le texte augmenté du jeton, sans rien écrire : c'est l'appelant
     qui décide quand enregistrer. Une fonction qui déclencherait elle-même
     une sauvegarde écraserait les captures enregistrées juste avant. */
  const withTokenAtCursor = (token) => {
    const el = ref.current;
    const sel = window.getSelection();
    let at = value.length;
    if (el && sel?.rangeCount && el.contains(sel.anchorNode)) {
      at = htmlToText(el, { node: sel.anchorNode, offset: sel.anchorOffset }).length;
    }
    pendingCaret.current = at + token.length;
    return `${value.slice(0, at)}${token}${value.slice(at)}`;
  };
  useEffect(() => { onInsertToken?.(withTokenAtCursor); });

  /* On ne réécrit le contenu que si la valeur vient d'ailleurs (insertion,
     chargement, suppression d'une capture) : réécrire à chaque frappe ferait
     sauter le curseur. */
  const lastSig = useRef("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // les URL des blobs arrivent après coup : sans les suivre, les vignettes
    // resteraient des images vides larges de quelques pixels
    const sig = (stills || []).map((s) => urls[s.key] || "").join("|");
    const textChanged = value !== lastEmitted.current;
    const urlsChanged = sig !== lastSig.current;
    if (!textChanged && !urlsChanged && el.dataset.ready === "1") return;

    // un re-rendu déplace le curseur : on note où il était pour l'y remettre
    const sel = window.getSelection();
    const focused = document.activeElement === el;
    const keep = pendingCaret.current != null ? pendingCaret.current
      : focused && sel?.rangeCount && el.contains(sel.anchorNode)
        ? htmlToText(el, { node: sel.anchorNode, offset: sel.anchorOffset }).length
        : null;

    el.innerHTML = textToHtml(value, stills, urls);
    el.dataset.ready = "1";
    lastEmitted.current = value;
    lastSig.current = sig;

    if (keep != null && (focused || pendingCaret.current != null)) {
      el.focus();
      placeCaret(el, keep);
    }
    pendingCaret.current = null;
  }, [value, urls, stills]);

  const emit = () => {
    const text = htmlToText(ref.current);
    lastEmitted.current = text;
    onChange(text);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        onClick={(e) => {
          // cliquer une vignette ouvre la capture, sans casser la saisie
          const n = e.target?.dataset?.still;
          if (n) { e.preventDefault(); onOpenStill(Number(n) - 1); }
        }}
        onPaste={(e) => {
          // le collage d'images est traité plus haut ; ici on force le texte brut
          const hasImage = [...(e.clipboardData?.items || [])].some((i) => i.kind === "file" && i.type.startsWith("image/"));
          if (hasImage) return;
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        style={{
          ...ruledTextarea, minHeight, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
          cursor: "text", display: "block",
        }}
      />
    </div>
  );
}

/* La pellicule : toutes les captures du film, en bande. Chaque vignette
   porte son numéro — celui qu'on écrit entre crochets dans le texte. */
function StillsStrip({ film, onUpdate, onOpen, onInsert, highlight, onAddFiles, busy }) {
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);
  const stills = film.stills || [];

  /* Retirer une capture décale les numéros : les jetons [img:N] du texte
     sont réécrits pour continuer de désigner les bonnes images. */
  const remove = async (idx) => {
    const still = stills[idx];
    const renumber = (t) => (t || "").replace(STILL_TOKEN, (full, n) => {
      const k = Number(n);
      if (k === idx + 1) return "";
      return k > idx + 1 ? `[img:${k - 1}]` : full;
    });
    onUpdate({
      ...film,
      stills: stills.filter((_, i) => i !== idx),
      review: renumber(film.review),
      notes: renumber(film.notes),
    });
    await deleteImage(still.key).catch(console.error);
    if (still.thumbKey) await deleteImage(still.thumbKey).catch(console.error);
  };

  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Clapperboard size={15} color={C.burgundy} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 24, color: C.ink }}>La pellicule</div>
        <div style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, transform: "translateY(-4px)" }} />
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { onAddFiles(e.target.files); e.target.value = ""; }} />
        <button onClick={() => fileRef.current.click()} style={{ all: "unset", cursor: "pointer", padding: "6px 13px", background: C.burgundy, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 10.5, display: "flex", alignItems: "center", gap: 5 }}>
          <Plus size={12} /> {busy ? `${busy}…` : "AJOUTER DES CAPTURES"}
        </button>
      </div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 2, marginBottom: 12 }}>
        {stills.length === 0
          ? "aucune capture — Ctrl+V colle directement une image du presse-papier"
          : "Ctrl+V pour coller · « insérer » place la vignette à l'endroit du curseur"}
      </div>

      {stills.length > 0 && (
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
          {stills.map((s, i) => {
            const lit = highlight === i;
            return (
              <div key={s.id} style={{ flexShrink: 0, width: 190, background: C.card, padding: "9px 9px 10px", boxShadow: lit ? `0 0 0 2px ${C.burgundy}, 3px 7px 16px rgba(30,20,10,0.3)` : "2px 5px 12px rgba(30,20,10,0.24)", transform: `rotate(${tiltOf(s.id) / 3}deg)`, transition: "box-shadow .2s ease" }}>
                <div style={{ position: "relative", cursor: "zoom-in" }} onClick={() => onOpen(i)}>
                  {/* fond sombre : la capture garde son format, on ne la rogne pas */}
                  <IdbImage imageKey={s.thumbKey || s.key} style={{ display: "block", width: "100%", height: 108, objectFit: "contain", background: "#1c1712" }} />
                  <span style={{ position: "absolute", top: 5, left: 5, background: C.card, color: C.burgundy, fontFamily: "'Special Elite', monospace", fontSize: 10, padding: "1px 6px", border: `1px solid ${C.burgundy}` }}>{i + 1}</span>
                </div>
                {editing === s.id ? (
                  <input
                    autoFocus style={{ ...underlineInput, fontSize: 13, marginTop: 6 }} defaultValue={s.caption}
                    onBlur={(e) => { onUpdate({ ...film, stills: stills.map((x) => (x.id === s.id ? { ...x, caption: e.target.value } : x)) }); setEditing(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  />
                ) : (
                  <div onClick={() => setEditing(s.id)} style={{ cursor: "text", fontFamily: "'Caveat', cursive", fontSize: 16, color: s.caption ? C.ink : C.inkFaded, marginTop: 5, minHeight: 22 }}>
                    {s.caption || "légender…"}
                  </div>
                )}
                {/* ce qui est réellement stocké — définition et poids d'origine */}
                {s.w > 0 && (
                  <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9, color: C.inkFaded, marginTop: 3 }}>
                    {s.w}×{s.h} · {s.bytes > 1e6 ? `${(s.bytes / 1e6).toFixed(1)} Mo` : `${Math.round(s.bytes / 1024)} Ko`}
                    {s.type === "image/png" && <span style={{ color: C.pine }}> · sans perte</span>}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontFamily: "'Special Elite', monospace", fontSize: 9.5 }}>
                  <button onClick={() => onInsert(i + 1)} style={{ all: "unset", cursor: "pointer", color: C.pine }}>insérer</button>
                  <button onClick={() => remove(i)} style={{ all: "unset", cursor: "pointer", color: C.inkFaded, marginLeft: "auto" }}>retirer</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MOTS-CLÉS — le champ `themes` du modèle, rendu vraiment utilisable.
   Il existait depuis le début mais n'était saisissable qu'à la création,
   en une ligne séparée par des virgules. Ici : ajout, suppression, et
   suggestions tirées des mots-clés déjà employés ailleurs, pour éviter
   qu'« Solitude » et « solitude » deviennent deux étiquettes distinctes.
   ============================================================ */
const tagInk = (t) => [C.pine, C.cobalt, C.vermillion, C.ochre, C.moss][Math.abs(hash(t)) % 5];

function TagChip({ tag, onRemove, onClick, active, small }) {
  const ink = tagInk(tag);
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "'Special Elite', monospace", fontSize: small ? 9.5 : 10.5,
        border: `1px solid ${ink}`, borderRadius: 12, padding: small ? "2px 8px" : "3px 10px",
        color: active ? C.card : ink, background: active ? ink : "transparent",
        cursor: onClick ? "pointer" : "default",
        transform: `rotate(${(Math.abs(hash(tag)) % 5) - 2}deg)`,
      }}
    >
      {tag}
      {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ all: "unset", cursor: "pointer", display: "flex" }}><X size={9} /></button>}
    </span>
  );
}

function TagEditor({ tags = [], allTags = [], onChange }) {
  const [draft, setDraft] = useState("");
  const clean = (s) => s.trim().replace(/\s+/g, " ");

  const add = (raw) => {
    const t = clean(raw);
    if (!t) return;
    // on réutilise la casse déjà en usage plutôt que d'en créer une variante
    const existing = allTags.find((x) => x.toLowerCase() === t.toLowerCase());
    const final = existing || t;
    if (!tags.some((x) => x.toLowerCase() === final.toLowerCase())) onChange([...tags, final]);
    setDraft("");
  };

  const suggestions = draft.trim()
    ? allTags.filter((t) => t.toLowerCase().includes(draft.trim().toLowerCase()) && !tags.includes(t)).slice(0, 6)
    : [];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {tags.map((t) => <TagChip key={t} tag={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />)}
        {tags.length === 0 && <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded }}>aucun mot-clé</span>}
      </div>
      <div style={{ position: "relative" }}>
        <input
          style={{ ...underlineInput, fontSize: 14 }}
          value={draft}
          placeholder="ajouter un mot-clé, puis Entrée"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(draft); }
            if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
          }}
        />
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 10, background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 6px 14px rgba(30,20,10,0.3)", minWidth: 160 }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => add(s)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "6px 11px", fontFamily: "'Lora', serif", fontSize: 13, color: C.ink, borderBottom: `1px solid ${C.line}` }}>{s}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   VUE — DOSSIER FILM
   ============================================================ */
/* L'image est ramenée à une taille d'affiche avant d'être rangée. IndexedDB
   pourrait encaisser l'original, mais 700 px suffisent largement au plus grand
   affichage : autant garder la base légère et le rendu instantané. */
/* Dimensions réelles d'un fichier image, pour pouvoir afficher ce qui a
   effectivement été conservé plutôt que de le promettre. */
const imageSize = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
  img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
  img.src = url;
});

const shrinkImage = (file, maxW = 700) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      // un Blob, pas une chaîne base64 : c'est tout l'intérêt d'IndexedDB
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encodage impossible"))), "image/jpeg", 0.82);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function PosterPicker({ film, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState(null);   // affiches proposées par TMDB
  const [galleryMsg, setGalleryMsg] = useState("");
  const ref = useRef(null);
  const apiKey = store.get("tmdb-key", "");

  /* La voie par défaut : TMDB connaît en général plusieurs affiches par film
     (pays, rééditions, versions sans texte). Autant les proposer plutôt que
     d'imposer la première venue. */
  const loadGallery = async () => {
    if (!apiKey) { setGalleryMsg("Aucune clé TMDB — renseignez-la dans l'onglet Import."); return; }
    setGalleryMsg("recherche…"); setGallery(null);
    try {
      const { tmdbId, posters } = await listPosters({ tmdbId: film.tmdbId, title: film.title, year: film.year, apiKey });
      if (tmdbId && !film.tmdbId) onUpdate({ ...film, tmdbId });
      setGallery(posters);
      setGalleryMsg(posters.length ? "" : "Aucune affiche trouvée pour ce film.");
    } catch (e) {
      setGalleryMsg(`TMDB indisponible (${e.message}).`);
    }
  };

  const choose = async (posterUrl) => {
    if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
    onUpdate({ ...film, poster: posterUrl });
    setOpen(false); setGallery(null);
  };

  // ouvrir le panneau propose directement les affiches TMDB
  useEffect(() => { if (open && gallery === null && !galleryMsg && apiKey) loadGallery(); }, [open]);

  const fromFile = async (file) => {
    setBusy(true);
    try {
      // l'affiche aussi est conservée telle quelle : pas de ré-encodage
      const key = `${film.id}-${Date.now()}`;   // clé neuve : le cache d'image ne resservira pas l'ancienne
      await putImage(key, file);
      if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
      onUpdate({ ...film, poster: IDB_PREFIX + key });
    } catch (e) {
      console.error(e);
      alert("Cette image n'a pas pu être enregistrée.");
    }
    setBusy(false); setOpen(false);
  };

  const clear = async () => {
    if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
    onUpdate({ ...film, poster: "" });
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ all: "unset", cursor: "pointer", display: "block", marginTop: 8, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10, letterSpacing: 0.5 }}>
        {film.poster ? "changer l'affiche" : "coller une affiche"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.line}`, background: C.paperDark, padding: "12px 14px" }}>
      {/* les affiches officielles d'abord : c'est le cas courant */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Label>Affiches TMDB</Label>
        <button onClick={loadGallery} style={{ all: "unset", cursor: "pointer", marginLeft: "auto", color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 9.5 }}>
          {gallery ? "relancer" : "chercher"}
        </button>
      </div>
      {galleryMsg && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, marginTop: 2 }}>{galleryMsg}</div>}
      {gallery?.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 7, marginTop: 8, maxHeight: 230, overflowY: "auto" }}>
          {gallery.map((p) => (
            <button
              key={p.full} onClick={() => choose(p.full)} title={`langue : ${p.lang}`}
              style={{ all: "unset", cursor: "pointer", border: film.poster === p.full ? `2px solid ${C.burgundy}` : `1px solid ${C.line}`, lineHeight: 0 }}
            >
              <img src={p.thumb} alt="" style={{ width: "100%", display: "block", height: "auto" }} />
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: C.line, margin: "14px 0 10px" }} />
      <Label>Ou une adresse d'image</Label>
      <input
        style={underlineInput} value={url} placeholder="https://…jpg"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key !== "Enter" || !url.trim()) return;
          if (isIdbPoster(film.poster)) await deleteImage(idbKeyOf(film.poster));
          onUpdate({ ...film, poster: url.trim() }); setUrl(""); setOpen(false);
        }}
      />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginTop: 4 }}>
        clic droit sur une affiche → « copier l'adresse de l'image », puis Entrée
      </div>

      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && fromFile(e.target.files[0])} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={() => ref.current.click()} disabled={busy} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", border: `1px solid ${C.line}`, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>
          {busy ? "…" : "DEPUIS MON DISQUE"}
        </button>
        {film.poster && (
          <button onClick={clear} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", border: `1px solid ${C.burgundy}`, color: C.burgundy, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>RETIRER</button>
        )}
        <button onClick={() => setOpen(false)} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>fermer</button>
      </div>
    </div>
  );
}

function DetailView({ film, onBack, onUpdate, onDelete, films = [], onLinkFilm, onRemoveLink, onOpen }) {
  const [linkType, setLinkType] = useState("book");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkCreator, setLinkCreator] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [picked, setPicked] = useState(null);   // fiche existante retenue
  // le vocabulaire déjà employé dans la collection, pour ne pas le fragmenter
  const allTags = useMemo(() => Array.from(new Set(films.flatMap((f) => f.themes || []))).sort(), [films]);

  const stills = film.stills || [];
  const [lightbox, setLightbox] = useState(null);          // index de la capture ouverte
  const [focusField, setFocusField] = useState("review");  // champ où « insérer » écrit
  const [busy, setBusy] = useState(0);
  const inserters = useRef({});                            // insertion à la position du curseur
  const insertToken = (n) => {
    const next = inserters.current[focusField]?.(`[img:${n}]`);
    if (next != null) onUpdate({ ...film, [focusField]: next });
  };

  /* Ranger des images dans la pellicule. `insert` sert au collage : coller
     une capture pendant qu'on écrit doit aussi poser le jeton au curseur,
     sinon il faudrait redescendre la chercher dans la bande. */
  const addStills = async (files, { insert = false } = {}) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    const added = [];
    for (const file of list) {
      try {
        /* Le fichier d'origine est stocké TEL QUEL : aucun redimensionnement,
           aucun ré-encodage. Un PNG reste un PNG, pixel pour pixel. C'est la
           visionneuse et la sauvegarde qui s'en servent.
           À côté, une vignette légère sert la bande et le texte : afficher
           une image 4K dans une case de 110 px serait ruineux pour rien. */
        const key = `still-${film.id}-${uid()}`;
        const thumbKey = `${key}-thumb`;
        await putImage(key, file);
        await putImage(thumbKey, await shrinkImage(file, 480));
        const dim = await imageSize(file);
        added.push({ id: uid(), key, thumbKey, caption: "", ...dim, bytes: file.size, type: file.type });
      } catch (e) { console.error(e); }
      setBusy((b) => b - 1);
    }
    setBusy(0);
    if (!added.length) return;

    // une seule écriture : captures et texte partent ensemble, sinon la
    // seconde mise à jour repartirait d'une fiche sans les captures
    const patch = { ...film, stills: [...stills, ...added] };
    if (insert) {
      const tokens = added.map((_, i) => `[img:${stills.length + i + 1}]`).join("");
      const next = inserters.current[focusField]?.(tokens);
      if (next != null) patch[focusField] = next;
    }
    onUpdate(patch);
  };

  /* Le collage est écouté sur toute la fiche : selon les navigateurs, un
     Ctrl+V hors champ de saisie ne remonte pas jusqu'à un conteneur. */
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.items || [])]
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter(Boolean);
      if (!files.length) return;   // un collage de texte reste un collage de texte
      e.preventDefault();
      // le champ de critique est un div éditable, pas un textarea
      const el = document.activeElement;
      const inField = el?.isContentEditable || ["TEXTAREA", "INPUT"].includes(el?.tagName);
      addStills(files, { insert: inField });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [film, stills.length, focusField]);

  /* Quand on cherche un film, on propose ceux de la collection — vidéothèque
     et watchlist confondues. Rien n'oblige à en choisir un : le champ reste
     libre pour les films qu'on ne possède pas encore. */
  const already = new Set((film.linkedWorks || []).map((w) => w.filmId).filter(Boolean));
  const suggestions = useMemo(() => {
    if (linkType !== "film") return [];
    const q = linkTitle.trim().toLowerCase();
    if (!q) return [];
    return films
      .filter((f) => f.id !== film.id && !already.has(f.id))
      .filter((f) => f.title.toLowerCase().includes(q) || (f.director || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [films, film.id, linkTitle, linkType, film.linkedWorks]);

  const addLink = () => {
    // une fiche retenue devient un vrai lien réciproque, pas une étiquette
    if (picked) {
      onLinkFilm(film.id, picked.id, linkNote);
      setPicked(null); setLinkTitle(""); setLinkCreator(""); setLinkNote("");
      return;
    }
    if (!linkTitle.trim()) return;
    const work = { id: uid(), type: linkType, title: linkTitle.trim(), creator: linkCreator.trim(), note: linkNote.trim() };
    onUpdate({ ...film, linkedWorks: [...(film.linkedWorks || []), work] });
    setLinkTitle(""); setLinkCreator(""); setLinkNote("");
  };
  const removeLink = (id) => onRemoveLink(film.id, id);

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 900, position: "relative" }}>
      <StampCorner text="DOSSIER" />
      <button onClick={onBack} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 11.5, marginBottom: 22 }}>
        <ArrowLeft size={14} /> RETOUR AU MUR
      </button>

      <div style={{ display: "flex", gap: 30, flexWrap: "wrap" }}>
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: C.card, padding: "12px 12px 16px", boxShadow: "3px 6px 14px rgba(30,20,10,0.28)", position: "relative" }}>
            <Tape color={C.burgundy} rotate={-5} style={{ top: -10, left: "50%", marginLeft: -35 }} />
            <PosterArt film={film} height={290} clipSeed={11} initials={film.title.slice(0, 2).toUpperCase()} />
          </div>
          <PosterPicker film={film} onUpdate={onUpdate} />
          <div style={{ marginTop: 16, border: `1px solid ${C.line}`, padding: "12px 14px", background: C.paperDark }}>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>FICHE CATALOGUE</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 20, color: C.ink, marginTop: 4 }}>{film.title}</div>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, marginTop: 3 }}>{film.year || "s.d."} — {film.director || "anonyme"}</div>
            {film.status === "watchlist" ? (
              <button
                onClick={() => onUpdate({ ...film, status: "watched", watchedAt: new Date().toISOString().slice(0, 10) })}
                style={{ all: "unset", cursor: "pointer", marginTop: 12, display: "block", textAlign: "center", padding: "8px 0", background: C.pine, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 10.5, letterSpacing: 1, boxSizing: "border-box", width: "100%" }}
              >JE L'AI VU</button>
            ) : (
              <>
                <div style={{ marginTop: 10 }}><InkStars value={film.rating || 0} onChange={(v) => onUpdate({ ...film, rating: v })} size={18} /></div>
                <button
                  onClick={() => onUpdate({ ...film, status: "watchlist" })}
                  style={{ all: "unset", cursor: "pointer", marginTop: 8, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}
                >remettre « à voir »</button>
              </>
            )}
            {film.watchedAt && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, marginTop: 6 }}>vu le {film.watchedAt}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {(film.genres || []).map((g) => <span key={g} style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.burgundy}`, color: C.burgundy, borderRadius: 12, padding: "2px 8px" }}>{g}</span>)}
            </div>
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
              <Label>Mots-clés</Label>
              <TagEditor tags={film.themes || []} allTags={allTags} onChange={(themes) => onUpdate({ ...film, themes })} />
            </div>
            {/* Les deux rangements de l'étagère, atteignables sans y aller :
                ils changent le rayon, pas la fiche. */}
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => onUpdate({ ...film, chevet: !film.chevet, archived: film.chevet ? film.archived : false })}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Special Elite', monospace", fontSize: 10, color: film.chevet ? C.burgundy : C.inkFaded }}
              >
                <Moon size={12} /> {film.chevet ? "retirer des films de chevet" : "film de chevet"}
              </button>
              <button
                onClick={() => onUpdate({ ...film, archived: !film.archived, chevet: film.archived ? film.chevet : false })}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Special Elite', monospace", fontSize: 10, color: film.archived ? C.slate : C.inkFaded }}
              >
                {film.archived ? <><ArchiveRestore size={12} /> remettre en rayon</> : <><Archive size={12} /> mettre de côté</>}
              </button>
            </div>
            <button onClick={() => onDelete(film.id)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10, marginTop: 16 }}>
              <Trash2 size={12} /> supprimer définitivement
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 300, position: "relative" }}>
          <Paperclip size={26} color={C.inkFaded} style={{ position: "absolute", top: -14, left: -22, transform: "rotate(-25deg)", opacity: 0.7 }} />
          {/* le champ actif reçoit les captures qu'on insère */}
          <div onFocusCapture={() => setFocusField("review")} style={{ outline: focusField === "review" && stills.length > 0 ? `1px dashed ${C.line}` : "none", outlineOffset: 8 }}>
            <RichField
              label="Critique personnelle" minHeight={120}
              value={film.review || ""} onChange={(review) => onUpdate({ ...film, review })}
              stills={stills} onOpenStill={setLightbox}
              onInsertToken={(fn) => { inserters.current.review = fn; }}
              placeholder="Écrivez ici, à main levée…"
            />
          </div>
          <div onFocusCapture={() => setFocusField("notes")} style={{ marginTop: 22, outline: focusField === "notes" && stills.length > 0 ? `1px dashed ${C.line}` : "none", outlineOffset: 8 }}>
            <RichField
              label="Notes libres" minHeight={70}
              value={film.notes || ""} onChange={(notes) => onUpdate({ ...film, notes })}
              stills={stills} onOpenStill={setLightbox}
              onInsertToken={(fn) => { inserters.current.notes = fn; }}
              placeholder="Scènes, citations, fragments…"
            />
          </div>
        </div>
      </div>

      <StillsStrip
        film={film} onUpdate={onUpdate}
        onOpen={setLightbox} onInsert={insertToken}
        highlight={lightbox}
        onAddFiles={addStills} busy={busy}
      />
      {lightbox != null && (
        <StillLightbox stills={stills} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
      )}

      <div style={{ marginTop: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link2 size={15} color={C.burgundy} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 24, color: C.ink }}>Le fil rouge</div>
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded, marginTop: -2, marginBottom: 8 }}>
          les œuvres qui répondent à ce film — livres, peintures, autres films
        </div>

        <ThreadBoard film={film} onRemove={removeLink} films={films} onOpen={onOpen} />

        <div style={{ marginTop: 30, border: `1px dashed ${C.line}`, padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <Label>Type</Label>
            <select value={linkType} onChange={(e) => { setLinkType(e.target.value); setPicked(null); }} style={{ ...underlineInput, fontFamily: "'Special Elite', monospace", fontSize: 12, width: 120 }}>
              {LINK_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
            <Label>{linkType === "film" ? "Chercher dans la collection" : "Titre de l'œuvre"}</Label>
            {picked ? (
              // fiche retenue : on montre qu'il s'agit d'un vrai renvoi, pas d'un texte
              <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.burgundy}`, padding: "5px 10px", marginTop: 2 }}>
                <Link2 size={13} color={C.burgundy} />
                <span style={{ fontFamily: "'Lora', serif", fontSize: 14, color: C.ink }}>{picked.title}{picked.year ? ` (${picked.year})` : ""}</span>
                <button onClick={() => setPicked(null)} style={{ all: "unset", cursor: "pointer", color: C.inkFaded, marginLeft: "auto" }}><X size={12} /></button>
              </div>
            ) : (
              <input style={underlineInput} value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder={linkType === "film" ? "un titre déjà au mur, ou un titre libre" : "Titre"} />
            )}
            {suggestions.length > 0 && !picked && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 6px 14px rgba(30,20,10,0.3)", maxHeight: 210, overflowY: "auto" }}>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setPicked(s); setLinkCreator(s.director || ""); }}
                    style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "7px 11px", borderBottom: `1px solid ${C.line}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.paperDark; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontFamily: "'Lora', serif", fontSize: 13.5, color: C.ink }}>{s.title}</span>
                    <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginLeft: 6 }}>
                      {s.year || "s.d."}{s.director ? ` · ${s.director}` : ""}{s.status === "watchlist" ? " · à voir" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {linkType === "film" && !picked && linkTitle.trim() && suggestions.length === 0 && (
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginTop: 3 }}>pas au mur — sera relié comme simple mention</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 140 }}><Label>Auteur·rice / artiste</Label><input style={underlineInput} value={linkCreator} onChange={(e) => setLinkCreator(e.target.value)} placeholder="Nom" disabled={!!picked} /></div>
          <div style={{ flex: 1.4, minWidth: 180 }}><Label>Pourquoi ce lien ?</Label><input style={underlineInput} value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder="La résonance entre les deux" /></div>
          <button onClick={addLink} style={{ all: "unset", cursor: "pointer", background: C.burgundy, color: C.card, padding: "8px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} /> relier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VUE — CONSTELLATION : une carte du ciel tracée à l'encre.
   Chaque film est une étoile, chaque œuvre liée un astre plus
   discret. Une œuvre citée par deux films devient un pont : c'est
   là que les constellations se forment.
   ============================================================ */
const LINK_INK = { film: C.burgundy, book: C.cobalt, painting: C.moss, other: C.ochre };

function ConstellationView({ films, onOpen }) {
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const [moved, setMoved] = useState({});
  const svgRef = useRef(null);
  // d'où le pointeur est parti : au-delà de quelques pixels, c'est un glissé, pas un clic
  const pressAt = useRef(null);

  const [tags, setTags] = useState([]);
  const [genres, setGenres] = useState([]);

  const allTags = useMemo(() => Array.from(new Set(films.flatMap((f) => f.themes || []))).sort(), [films]);
  const allGenres = useMemo(() => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(), [films]);
  const toggle = (setter) => (v) => setter((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const W = 1100, H = 760;
  const { nodes, links } = useMemo(() => buildSky(films, { tags, genres }), [films, tags, genres]);
  const linkedTotal = useMemo(() => films.filter((f) => (f.linkedWorks || []).length > 0).length, [films]);
  const placed = useMemo(() => relax(nodes, links, W, H), [nodes, links]);

  const pos = useCallback((p) => moved[p.id] || p, [moved]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed]);

  // l'ensemble des astres qu'un survol met en lumière
  const lit = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    links.forEach((l) => { if (l.a === hover) set.add(l.b); if (l.b === hover) set.add(l.a); });
    return set;
  }, [hover, links]);

  const toSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const radiusOf = (n) => (n.kind === "film" ? 7 + (n.rating || 0) * 1.6 : 4 + Math.min(n.refs, 4));

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <StampCorner text="CARTE DU CIEL" />
      <CoffeeRing style={{ top: 150, right: 90 }} rotate={-25} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>La constellation</div>
      <InkUnderline width={300} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>
        seulement ce que vous avez relié à la main — attrapez une étoile pour la déplacer
      </div>

      {/* filtres : mots-clés et genres. Ils réduisent le ciel, ils ne le peuplent pas. */}
      {(allTags.length > 0 || allGenres.length > 0) && (
        <div style={{ marginTop: 20, position: "relative", zIndex: 3, borderBottom: `1px dashed ${C.line}`, paddingBottom: 14 }}>
          {allTags.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <Label>Mots-clés {tags.length > 0 && <span style={{ color: C.pine }}>· cumulatifs</span>}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {allTags.map((t) => <TagChip key={t} tag={t} active={tags.includes(t)} onClick={() => toggle(setTags)(t)} />)}
              </div>
            </div>
          )}
          {allGenres.length > 0 && (
            <div>
              <Label>Genres</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {allGenres.map((g) => {
                  const on = genres.includes(g);
                  return (
                    <button key={g} onClick={() => toggle(setGenres)(g)} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10, padding: "3px 10px", borderRadius: 12, border: `1px solid ${C.burgundy}`, color: on ? C.card : C.burgundy, background: on ? C.burgundy : "transparent" }}>{g}</button>
                  );
                })}
              </div>
            </div>
          )}
          {(tags.length > 0 || genres.length > 0) && (
            <button onClick={() => { setTags([]); setGenres([]); }} style={{ all: "unset", cursor: "pointer", marginTop: 10, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10 }}>tout afficher</button>
          )}
        </div>
      )}

      {placed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: C.inkFaded, position: "relative", zIndex: 2 }}>
          <Sparkles size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 6 }}>
            {tags.length || genres.length ? "Aucun fil sous ces filtres" : "Le ciel est encore noir"}
          </div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19, maxWidth: 460, margin: "0 auto" }}>
            {tags.length || genres.length
              ? "Aucun des films reliés ne porte ces mots-clés — élargissez la sélection."
              : "Ouvrez un film, descendez au « fil rouge » et reliez-lui un livre, une peinture ou un autre film. Seuls les films reliés apparaissent ici."}
          </div>
        </div>
      ) : (
        <>
          {/* la légende, façon cartouche de carte ancienne */}
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.inkFaded, marginTop: 18, letterSpacing: 1, position: "relative", zIndex: 2 }}>
            {placed.filter((n) => n.kind === "film").length} FILM(S) RELIÉ(S) · {links.length} FIL(S)
            {(tags.length || genres.length) > 0 && ` · ${linkedTotal} RELIÉ(S) AU TOTAL`}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, marginBottom: 10, position: "relative", zIndex: 2 }}>
            {[["film", "Film"], ["book", "Livre"], ["painting", "Peinture"], ["other", "Autre œuvre"]].map(([k, l]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: LINK_INK[k], boxShadow: `0 0 6px ${LINK_INK[k]}88` }} />
                {l.toUpperCase()}
              </span>
            ))}
          </div>

          <div style={{
            position: "relative", zIndex: 2, background: `radial-gradient(ellipse at 50% 45%, ${C.card}cc, transparent 72%)`,
            border: `1px dashed ${C.line}`, boxShadow: "inset 0 0 40px rgba(30,20,10,0.06)",
          }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", display: "block", cursor: drag ? "grabbing" : "default", touchAction: "none" }}
              onPointerMove={(e) => { if (!drag) return; const p = toSvg(e); setMoved((m) => ({ ...m, [drag]: { ...byId.get(drag), x: p.x, y: p.y } })); }}
              onPointerUp={() => setDrag(null)}
              onPointerLeave={() => { setDrag(null); setHover(null); }}
            >
              {/* le quadrillage effacé d'une carte astronomique */}
              <defs>
                <pattern id="sky-grid" width="55" height="55" patternUnits="userSpaceOnUse">
                  <path d="M55 0 L0 0 0 55" fill="none" stroke={C.line} strokeWidth="0.6" opacity="0.4" />
                </pattern>
                <filter id="halo" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width={W} height={H} fill="url(#sky-grid)" />

              {/* les fils : caténaire légère, comme sur le panneau d'enquête */}
              {links.map((l, i) => {
                const a = pos(byId.get(l.a)), b = pos(byId.get(l.b));
                if (!a || !b) return null;
                const on = !lit || (lit.has(l.a) && lit.has(l.b));
                const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.abs(b.x - a.x) * 0.09 + 10;
                // fiche à fiche : un trait plein, c'est le lien le plus fort
                const peer = l.kind === "peer";
                return (
                  <path
                    key={i}
                    d={`M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`}
                    fill="none"
                    stroke={peer ? C.burgundy : C.vermillion}
                    strokeWidth={peer ? 2 : 1.4}
                    strokeDasharray={peer ? "none" : "2.5 4"}
                    strokeLinecap="round"
                    opacity={on ? (peer ? 0.8 : 0.6) : 0.08}
                    style={{ transition: "opacity .18s ease" }}
                  />
                );
              })}

              {placed.map((n) => {
                const p = pos(n);
                const r = radiusOf(n);
                const ink = n.kind === "film" ? C.burgundy : LINK_INK[n.type] || C.ochre;
                const on = !lit || lit.has(n.id);
                const isHover = hover === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: n.kind === "film" ? "pointer" : "grab", opacity: on ? 1 : 0.22, transition: "opacity .18s ease" }}
                    onPointerEnter={() => !drag && setHover(n.id)}
                    onPointerLeave={() => !drag && setHover(null)}
                    onPointerDown={(e) => { e.preventDefault(); pressAt.current = { x: e.clientX, y: e.clientY }; setDrag(n.id); }}
                    onClick={(e) => {
                      if (n.kind !== "film") return;
                      const s = pressAt.current;
                      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 4) return; // c'était un glissé
                      onOpen(n.filmId);
                    }}
                  >
                    {/* halo : les astres les plus cités brillent le plus fort */}
                    <circle r={r + 7} fill={ink} opacity={isHover ? 0.22 : 0.1} filter="url(#halo)" />
                    <circle r={r} fill={ink} stroke={C.card} strokeWidth="1.6" />
                    {n.kind === "film" && <circle r={r + 4.5} fill="none" stroke={ink} strokeWidth="0.9" opacity="0.5" strokeDasharray="2 3" />}
                    <text
                      x={0} y={-r - 11} textAnchor="middle"
                      style={{
                        fontFamily: n.kind === "film" ? "'Playfair Display', serif" : "'Special Elite', monospace",
                        fontSize: n.kind === "film" ? 15 : 10.5,
                        fontWeight: n.kind === "film" ? 700 : 400,
                        fill: C.ink, pointerEvents: "none",
                      }}
                    >
                      {n.label.length > 30 ? n.label.slice(0, 29) + "…" : n.label}
                    </text>
                    {isHover && n.sub && (
                      <text x={0} y={r + 18} textAnchor="middle" style={{ fontFamily: "'Caveat', cursive", fontSize: 16, fill: C.inkFaded, pointerEvents: "none" }}>
                        {n.sub}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", marginTop: 14, position: "relative", zIndex: 2 }}>
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded }}>
              {placed.filter((n) => n.kind === "film").length} film(s), {placed.filter((n) => n.kind === "work").length} œuvre(s) — {placed.filter((n) => n.refs > 1).length} pont(s) entre deux films
            </span>
            {Object.keys(moved).length > 0 && (
              <button onClick={() => setMoved({})} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.burgundy, borderBottom: `1px solid ${C.burgundy}` }}>
                REMETTRE LE CIEL EN PLACE
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   VUE — CARNET
   ============================================================ */
function NotebookView({ notes, onAdd, onUpdate, onDelete }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const create = () => {
    if (!body.trim() && !title.trim()) return;
    onAdd({ id: uid(), title: title.trim() || "Sans titre", body, createdAt: Date.now() });
    setTitle(""); setBody("");
  };
  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 720, position: "relative" }}>
      <StampCorner text="CARNET" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 42, color: C.ink }}>Le carnet</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: C.inkFaded, marginTop: -4, marginBottom: 26 }}>des pensées libres, qui n'appartiennent à aucun film en particulier</div>

      <div style={{ background: C.card, padding: 20, boxShadow: "3px 5px 12px rgba(30,20,10,0.22)", transform: "rotate(-0.6deg)" }}>
        <input style={{ ...underlineInput, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 19, fontWeight: 700 }} placeholder="Titre de la note" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...ruledTextarea, minHeight: 90, marginTop: 8 }} placeholder="Écrivez librement…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={create} style={{ all: "unset", cursor: "pointer", marginTop: 14, background: C.pine, color: C.card, padding: "8px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11 }}>+ AJOUTER LA PAGE</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 30 }}>
        {notes.length === 0 && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19, color: C.inkFaded }}>le carnet attend sa première page…</div>}
        {[...notes].sort((a, b) => b.createdAt - a.createdAt).map((n) => (
          <div key={n.id} style={{ background: C.card, padding: 18, boxShadow: "2px 4px 10px rgba(30,20,10,0.2)", transform: `rotate(${tiltOf(n.id) / 3}deg)`, position: "relative" }}>
            <button onClick={() => onDelete(n.id)} style={{ all: "unset", position: "absolute", top: 12, right: 14, cursor: "pointer", color: C.inkFaded }}><Trash2 size={13} /></button>
            <input style={{ ...underlineInput, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 18, border: "none" }} value={n.title} onChange={(e) => onUpdate({ ...n, title: e.target.value })} />
            <textarea style={{ ...ruledTextarea, minHeight: 50, border: "none" }} value={n.body} onChange={(e) => onUpdate({ ...n, body: e.target.value })} />
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded, marginTop: 6 }}>{new Date(n.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   VUE — IMPORT LETTERBOXD
   ============================================================ */
/* une ligne de bordereau : intitulé à gauche, chiffre tamponné à droite */
function Tally({ label, value, ink = C.ink }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "'Lora', serif", fontSize: 13.5, color: C.inkFaded }}>
      <span>{label}</span>
      <span style={{ flex: 1, borderBottom: `1px dotted ${C.line}`, transform: "translateY(-3px)" }} />
      <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 14, color: ink }}>{value}</span>
    </div>
  );
}

const humanSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`);

/* Le local est rapide et gratuit, mais un navigateur qu'on nettoie efface
   tout : la sauvegarde est le filet, pas une option décorative. */
function BackupPanel({ films, notes, dividers, onRestore }) {
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState("");
  const ref = useRef(null);

  useEffect(() => { posterStats().then(setStats).catch(() => setStats(null)); }, [films]);

  const download = async () => {
    setMsg("préparation…");
    const data = await exportBackup({ films, notes, dividers });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cine-hub-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`sauvegarde de ${films.length} fiche(s) téléchargée.`);
  };

  const restore = async (file) => {
    setMsg("lecture…");
    try {
      const { films: f, notes: n, dividers: d } = await importBackup(JSON.parse(await file.text()));
      setMsg(`${onRestore({ films: f, notes: n, dividers: d })} fiche(s) restaurée(s).`);
    } catch (e) {
      setMsg(e.message || "Sauvegarde illisible.");
    }
  };

  return (
    <div style={{ marginTop: 34, border: `1px solid ${C.line}`, background: C.card, padding: "16px 20px" }}>
      <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, marginBottom: 10 }}>COFFRE À AFFICHES ET SAUVEGARDE</div>
      {stats && (
        <>
          <Tally label="affiches rangées dans la base" value={stats.count} />
          <Tally label="place occupée" value={humanSize(stats.bytes)} />
          {stats.quota?.quota && <Tally label="place disponible" value={humanSize(stats.quota.quota - (stats.quota.usage || 0))} ink={C.pine} />}
        </>
      )}
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, margin: "10px 0 12px", lineHeight: 1.35 }}>
        Tout est stocké sur cette machine, captures en qualité d'origine. Exportez de temps en temps : vider les données du navigateur effacerait la collection.
      </div>
      <input ref={ref} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && restore(e.target.files[0])} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={download} style={{ all: "unset", cursor: "pointer", padding: "8px 14px", background: C.pine, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 10.5 }}>EXPORTER MA COLLECTION</button>
        <button onClick={() => ref.current.click()} style={{ all: "unset", cursor: "pointer", padding: "8px 14px", border: `1px solid ${C.line}`, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10.5 }}>RESTAURER UNE SAUVEGARDE</button>
      </div>
      {msg && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.pine, marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

function ImportView({ films, onImport, notes, dividers, onRestore }) {
  const [rows, setRows] = useState([]);          // lignes lues, éventuellement enrichies
  const [stats, setStats] = useState(null);      // ce que le fichier contenait
  const [importStatus, setImportStatus] = useState("watched"); // vus / à voir
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);        // bilan après écriture

  const [apiKey, setApiKey] = useState(() => store.get("tmdb-key", ""));
  const [useTmdb, setUseTmdb] = useState(() => !!store.get("tmdb-key", ""));
  const [keyState, setKeyState] = useState("");
  const [progress, setProgress] = useState(null); // { done, total }
  const [tmdbReport, setTmdbReport] = useState(null);
  const fileRef = useRef(null);

  const reset = () => { setRows([]); setStats(null); setFileName(""); setError(""); setTmdbReport(null); setProgress(null); };

  const handleFile = async (file) => {
    reset(); setDone(null); setFileName(file.name);
    try {
      const { rows: parsed, stats: s, kind } = await parseLetterboxdCsv(file);
      setRows(parsed); setStats(s); setImportStatus(kind);
      if (parsed.length === 0) setError("Aucune ligne exploitable trouvée dans ce fichier.");
    } catch {
      setError("Impossible de lire ce fichier CSV.");
    }
  };

  const testKey = async () => {
    setKeyState("…");
    const r = await checkApiKey(apiKey.trim());
    setKeyState(r.ok ? "clé valide" : "clé refusée");
  };

  // Le réalisateur n'est pas dans le CSV : on va le chercher avant de comparer,
  // pour que l'aperçu montre déjà les fiches telles qu'elles seront écrites.
  const runTmdb = async () => {
    const key = apiKey.trim();
    if (!key) return;
    store.set("tmdb-key", key);
    setProgress({ done: 0, total: rows.length });
    const res = await enrichRows(rows, key, { onProgress: (d, t) => setProgress({ done: d, total: t }) });
    setRows(res.rows);
    setTmdbReport({ resolved: res.resolved, failed: res.failed });
    setProgress(null);
  };

  // Rien n'est écrit tant que ce diff n'a pas été validé.
  const diff = useMemo(
    () => (rows.length ? diffImport(films, rows, importStatus) : null),
    [films, rows, importStatus]
  );

  const confirm = () => {
    onImport(diff);
    setDone({ created: diff.toCreate.length, updated: diff.toUpdate.length, unchanged: diff.unchanged.length });
    reset();
  };

  const enriched = rows.filter((r) => r.director).length;

  return (
    <div style={{ padding: "34px 44px 70px", maxWidth: 680, position: "relative" }}>
      <StampCorner text="ARCHIVES" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 42, color: C.ink }}>Bordereau d'import</div>
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: C.inkFaded, marginTop: -4, marginBottom: 22 }}>un fichier à la fois, dans l'ordre indiqué ci-dessous</div>

      {/* L'export Letterboxd est un zip de plusieurs CSV : chacun ne contient
          qu'une partie de l'histoire, d'où l'ordre conseillé. */}
      <div style={{ border: `1px solid ${C.line}`, background: C.card, padding: "16px 20px", marginBottom: 22 }}>
        <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, marginBottom: 4 }}>QUELS FICHIERS DÉPOSER</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: C.inkFaded, marginBottom: 12 }}>
          Letterboxd vous livre un zip : dézippez-le, puis déposez ces fichiers un par un.
        </div>
        {[
          { n: "watched.csv", d: "tous les films vus — la base de la collection", ink: C.pine, ordre: "1" },
          { n: "ratings.csv", d: "vos notes ; complète les fiches déjà créées", ink: C.burgundy, ordre: "2" },
          { n: "watchlist.csv", d: "vos envies ; atterrit dans l'onglet « À voir »", ink: C.cobalt, ordre: "3" },
        ].map((f) => (
          <div key={f.n} style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 7 }}>
            <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 12, color: C.card, background: f.ink, width: 18, height: 18, lineHeight: "18px", textAlign: "center", borderRadius: "50%", flexShrink: 0 }}>{f.ordre}</span>
            <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 12, color: f.ink }}>{f.n}</span>
            <span style={{ fontFamily: "'Lora', serif", fontSize: 12.5, color: C.inkFaded }}>{f.d}</span>
          </div>
        ))}
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded, marginTop: 12, lineHeight: 1.35 }}>
          L'ordre compte peu, mais watched.csv d'abord évite d'oublier les films vus sans note.
          diary.csv est optionnel : il n'ajoute que les dates de séance.
          Rien n'est jamais dupliqué — repassez les fichiers autant de fois que vous voulez.
        </div>
      </div>

      <div style={{ border: `2px dashed ${C.line}`, padding: 34, textAlign: "center", background: C.paperDark }}>
        <Upload size={24} color={C.burgundy} style={{ marginBottom: 10 }} />
        <div style={{ color: C.ink, fontFamily: "'Lora', serif", fontSize: 14, marginBottom: 14 }}>letterboxd.com → Settings → Import &amp; Export → Export your data</div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        <button onClick={() => fileRef.current.click()} style={{ all: "unset", cursor: "pointer", background: C.burgundy, color: C.card, padding: "9px 18px", fontFamily: "'Special Elite', monospace", fontSize: 11.5 }}>CHOISIR UN FICHIER</button>
        {fileName && <div style={{ color: C.inkFaded, fontSize: 12, marginTop: 10, fontFamily: "'Special Elite', monospace" }}>{fileName}</div>}
      </div>

      {error && <div style={{ marginTop: 16, color: C.burgundy, fontFamily: "'Caveat', cursive", fontSize: 19 }}>{error}</div>}

      {done && (
        <div style={{ marginTop: 20, border: `1px solid ${C.pine}`, background: C.card, padding: "14px 18px" }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.pine, letterSpacing: 1, marginBottom: 8 }}>IMPORT TERMINÉ</div>
          <Tally label="fiches créées" value={done.created} ink={C.pine} />
          <Tally label="fiches mises à jour" value={done.updated} ink={C.ochre} />
          <Tally label="déjà à jour, inchangées" value={done.unchanged} />
        </div>
      )}

      {/* ---- vérification de la lecture du fichier ---- */}
      {stats && (
        <div style={{ marginTop: 24, border: `1px solid ${C.line}`, background: C.card, padding: "16px 20px" }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, marginBottom: 10 }}>CE QUE CONTIENT LE FICHIER</div>
          <Tally label="lignes lues" value={stats.lines} />
          <Tally label="films distincts" value={stats.total} />
          <Tally label="avec une note" value={stats.withRating} ink={stats.withRating ? C.pine : C.inkFaded} />
          <Tally label="sans note" value={stats.withoutRating} />
          {stats.duplicatesInFile > 0 && <Tally label="revoyures regroupées" value={stats.duplicatesInFile} ink={C.ochre} />}
          {stats.skippedNoTitle > 0 && <Tally label="lignes sans titre, ignorées" value={stats.skippedNoTitle} ink={C.burgundy} />}

          <div style={{ marginTop: 16 }}>
            <Label>Ces films sont</Label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {[{ k: "watched", l: "des films vus" }, { k: "watchlist", l: "à voir" }].map((o) => (
                <button key={o.k} onClick={() => setImportStatus(o.k)} style={{
                  all: "unset", cursor: "pointer", padding: "6px 14px",
                  fontFamily: "'Special Elite', monospace", fontSize: 11,
                  background: importStatus === o.k ? C.cobalt : "transparent",
                  color: importStatus === o.k ? C.card : C.inkFaded,
                  border: `1px solid ${importStatus === o.k ? C.cobalt : C.line}`,
                }}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- réalisateurs via TMDB ---- */}
      {rows.length > 0 && (
        <div style={{ marginTop: 20, border: `1px solid ${C.line}`, background: C.paperDark, padding: "16px 20px" }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1 }}>RÉALISATEUR·RICE, GENRES ET AFFICHES</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: C.inkFaded, margin: "6px 0 12px" }}>
            Letterboxd n'exporte ni le réalisateur ni les affiches. TMDB retrouve les deux (clé gratuite sur themoviedb.org).
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Label>Clé API TMDB</Label>
              <input style={underlineInput} value={apiKey} type="password" placeholder="collez votre clé ici"
                onChange={(e) => { setApiKey(e.target.value); setKeyState(""); setUseTmdb(!!e.target.value.trim()); }} />
            </div>
            <button onClick={testKey} disabled={!apiKey.trim()} style={{ all: "unset", cursor: apiKey.trim() ? "pointer" : "not-allowed", padding: "7px 14px", border: `1px solid ${C.line}`, color: C.inkFaded, fontFamily: "'Special Elite', monospace", fontSize: 10.5 }}>TESTER</button>
          </div>
          {keyState && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: keyState === "clé valide" ? C.pine : C.burgundy, marginTop: 6 }}>{keyState}</div>}

          {progress ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 6, background: C.line, position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, right: `${100 - (progress.done / progress.total) * 100}%`, background: C.ochre, transition: "right .2s linear" }} />
              </div>
              <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.inkFaded, marginTop: 6 }}>{progress.done} / {progress.total} interrogés…</div>
            </div>
          ) : (
            <button onClick={runTmdb} disabled={!apiKey.trim() || !useTmdb} style={{ all: "unset", cursor: apiKey.trim() ? "pointer" : "not-allowed", marginTop: 14, background: apiKey.trim() ? C.ochre : C.line, color: C.card, padding: "9px 16px", fontFamily: "'Special Elite', monospace", fontSize: 11 }}>
              COMPLÉTER LES {rows.length} FICHE(S)
            </button>
          )}

          {tmdbReport && (
            <div style={{ marginTop: 12 }}>
              <Tally label="réalisateurs trouvés" value={tmdbReport.resolved} ink={C.pine} />
              {tmdbReport.failed > 0 && <Tally label="films non identifiés" value={tmdbReport.failed} ink={C.burgundy} />}
            </div>
          )}
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, marginTop: 10 }}>
            L'import fonctionne aussi sans clé : les fiches seront simplement créées sans réalisateur.
          </div>
        </div>
      )}

      {/* ---- diff avant écriture ---- */}
      {diff && (
        <div style={{ marginTop: 22 }}>
          <Label>Ce qui va être écrit</Label>
          <div style={{ display: "flex", gap: 26, margin: "10px 0 14px", fontFamily: "'Special Elite', monospace" }}>
            {[["nouveaux", diff.toCreate.length, C.pine], ["mis à jour", diff.toUpdate.length, C.ochre], ["inchangés", diff.unchanged.length, C.inkFaded]].map(([l, n, ink]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, color: ink }}>{n}</div>
                <div style={{ fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>{l.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {diff.toUpdate.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded, marginBottom: 4 }}>fiches existantes retouchées (vos critiques et notes libres sont conservées)</div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${C.line}`, background: C.card }}>
                {diff.toUpdate.map(({ film, changes }) => (
                  <div key={film.id} style={{ padding: "7px 14px", borderBottom: `1px solid ${C.line}`, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink }}>
                    {film.title} {film.year && <span style={{ color: C.inkFaded }}>({film.year})</span>}
                    <span style={{ color: C.ochre, fontFamily: "'Special Elite', monospace", fontSize: 10.5, marginLeft: 8 }}>
                      {"rating" in changes && `note ${film.rating || 0} → ${changes.rating}`}
                      {changes.director && ` · réalisateur : ${changes.director}`}
                      {changes.watchedAt && ` · vu le ${changes.watchedAt}`}
                      {changes.status && " · passe en « vu »"}
                      {changes.genres && " · genres"}
                      {changes.poster && " · affiche"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {diff.toCreate.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.line}`, background: C.card }}>
              {diff.toCreate.slice(0, 60).map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${C.line}`, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink }}>
                  <span>
                    {f.title} {f.year && <span style={{ color: C.inkFaded }}>({f.year})</span>}
                    {f.director && <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded }}> — {f.director}</span>}
                  </span>
                  {importStatus === "watched" && f.rating > 0 && <InkStars value={f.rating} size={11} />}
                </div>
              ))}
              {diff.toCreate.length > 60 && <div style={{ padding: "8px 14px", fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded }}>…et {diff.toCreate.length - 60} autres</div>}
            </div>
          )}

          {enriched === 0 && (
            <div style={{ marginTop: 10, fontFamily: "'Caveat', cursive", fontSize: 17, color: C.burgundy }}>
              Aucun réalisateur pour l'instant — complétez via TMDB ci-dessus avant de valider, sinon les fiches resteront « anonyme ».
            </div>
          )}

          <button
            onClick={confirm}
            disabled={diff.toCreate.length === 0 && diff.toUpdate.length === 0}
            style={{
              all: "unset", marginTop: 16, padding: "11px 20px",
              cursor: diff.toCreate.length || diff.toUpdate.length ? "pointer" : "not-allowed",
              background: diff.toCreate.length || diff.toUpdate.length ? C.pine : C.line,
              color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 11.5, letterSpacing: 1,
            }}
          >
            {diff.toCreate.length || diff.toUpdate.length
              ? `VALIDER — ${diff.toCreate.length} CRÉÉE(S), ${diff.toUpdate.length} MISE(S) À JOUR`
              : "TOUT EST DÉJÀ À JOUR"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 26, fontFamily: "'Caveat', cursive", fontSize: 17, color: C.inkFaded }}>
        {films.length} film(s) déjà au catalogue — un réimport met à jour les fiches existantes au lieu de les dupliquer.
      </div>

      <BackupPanel films={films} notes={notes} dividers={dividers} onRestore={onRestore} />
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */
/* ============================================================
   VUE — RECOMMANDATIONS : un bulletin de commande adressé aux
   archives. On y règle ce qu'on cherche — et surtout à quelle
   profondeur — puis on dépouille ce qui remonte.
   ============================================================ */

/* Les langues proposées : celles qui reviennent le plus souvent quand on
   sort du circuit anglophone. La liste n'a pas à être exhaustive, seulement
   à éviter d'avoir à taper un code ISO de mémoire. */
const RECO_LANGS = [
  ["", "toutes"], ["ja", "japonais"], ["fr", "français"], ["ko", "coréen"], ["it", "italien"],
  ["es", "espagnol"], ["de", "allemand"], ["zh", "chinois"], ["ru", "russe"], ["sv", "suédois"],
  ["da", "danois"], ["fa", "persan"], ["hi", "hindi"], ["pt", "portugais"], ["pl", "polonais"], ["en", "anglais"],
];

/* Un curseur annoté à ses deux bouts : sans les étiquettes, personne ne sait
   si pousser à droite rend le résultat plus pointu ou moins. */
function Dial({ label, left, right, value, onChange, ink = C.burgundy }) {
  return (
    <div style={{ minWidth: 230, flex: 1 }}>
      <Label>{label}</Label>
      <input
        type="range" min="0" max="1" step="0.05" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: ink, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginTop: -2 }}>
        <span>{left}</span><span>{right}</span>
      </div>
    </div>
  );
}

function Chip({ label, on, onClick, ink = C.burgundy }) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5,
        padding: "3px 10px", borderRadius: 12, border: `1px solid ${on ? ink : C.line}`,
        background: on ? ink : "transparent", color: on ? C.card : C.inkFaded,
      }}
    >{label}</button>
  );
}

/* La carte de résultat : l'affiche du mur, telle quelle, augmentée du motif
   de la recommandation et d'un bouton pour la ranger. La fiche film est un
   `<button>` entier — le geste « mettre de côté » vit donc à côté, pas dedans. */
function RecoCard({ c, onAdd, added }) {
  const asFilm = useMemo(
    () => makeFilm({ id: `tmdb-${c.tmdbId}`, title: c.title, year: c.year || "", poster: c.poster, genres: c.genres, rating: 0 }),
    [c.tmdbId]
  );
  return (
    <div>
      <FilmPolaroid film={asFilm} onClick={() => window.open(`https://www.themoviedb.org/movie/${c.tmdbId}`, "_blank", "noopener")} />
      <div style={{ marginTop: -22, marginBottom: 30, padding: "0 4px" }}>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, lineHeight: 1.25 }}>
          {c.reasons.join(" · ")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded }}>
            TMDB {c.voteAverage.toFixed(1)} · niche {Math.round(c.niche * 100)}%
          </span>
          <button
            onClick={() => onAdd(c)} disabled={added}
            style={{
              all: "unset", cursor: added ? "default" : "pointer", marginLeft: "auto",
              fontFamily: "'Special Elite', monospace", fontSize: 10, letterSpacing: 0.5,
              padding: "4px 10px", border: `1px solid ${added ? C.line : C.pine}`,
              color: added ? C.inkFaded : C.card, background: added ? "transparent" : C.pine,
            }}
          >{added ? "mis de côté" : "mettre de côté"}</button>
        </div>
      </div>
    </div>
  );
}

function RecoView({ films, onAddToWatchlist }) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [raw, setRaw] = useState(null);        // candidats bruts, indépendants des curseurs
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(() => new Set());
  const set = (k, v) => setQuery((q) => ({ ...q, [k]: v }));

  const apiKey = store.get("tmdb-key", "");
  const taste = useMemo(() => buildTaste(films), [films]);
  const allGenres = useMemo(() => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(), [films]);

  /* Ce qui est déjà au mur ne doit jamais revenir en suggestion. Les fiches
     anciennes n'ont pas de tmdbId : on retombe sur la clé titre + année, la
     même que l'import utilise pour ne pas dupliquer. */
  const isSeen = useMemo(() => {
    const ids = new Set(films.filter((f) => (query.excludeWatchlist || f.status !== "watchlist")).map((f) => f.tmdbId).filter(Boolean));
    const keys = new Set(films.filter((f) => (query.excludeWatchlist || f.status !== "watchlist")).map(filmKey));
    return (c) => ids.has(c.tmdbId) || keys.has(filmKey({ title: c.title, year: c.year }));
  }, [films, query.excludeWatchlist]);

  const search = async () => {
    if (!apiKey) return;
    setError(""); setRaw(null); setProgress({ done: 0, total: 1 });
    try {
      const { candidates } = await gatherCandidates({
        query, taste, films, apiKey, isSeen,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRaw(candidates);
      if (!candidates.length) setError("Rien ne remonte avec ces réglages — élargissez les années ou baissez la note minimale.");
    } catch (e) {
      setError(`TMDB n'a pas répondu : ${e.message || e}`);
    }
    setProgress(null);
  };

  /* Le classement est pur : bouger un curseur reclasse la même récolte, sans
     redemander quoi que ce soit au réseau. C'est ce qui rend les curseurs
     lisibles — on voit l'effet du réglage, pas celui d'un nouveau tirage. */
  const results = useMemo(() => (raw ? rank(raw, taste, query, 40) : null), [raw, taste, query]);

  const addOne = (c) => {
    onAddToWatchlist(makeFilm({
      title: c.title, year: c.year || "", poster: c.poster, genres: c.genres,
      status: "watchlist", tmdbId: c.tmdbId, source: "tmdb",
    }));
    setAdded((s) => new Set(s).add(c.tmdbId));
  };

  const toggleIn = (key) => (g) =>
    set(key, query[key].includes(g) ? query[key].filter((x) => x !== g) : [...query[key], g]);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 20, right: 160 }} rotate={-18} />
      <StampCorner text="BULLETIN DE COMMANDE" />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>Le bureau des découvertes</div>
      <InkUnderline width={370} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>
        des films à voir, choisis d'après ce que dit votre collection
      </div>

      {!apiKey ? (
        <div style={{ marginTop: 26, border: `1px dashed ${C.line}`, background: C.card, padding: "18px 22px", maxWidth: 560 }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.burgundy, letterSpacing: 1, marginBottom: 6 }}>CLÉ TMDB MANQUANTE</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 13.5, color: C.inkFaded, lineHeight: 1.5 }}>
            Les recommandations viennent de TMDB. Rendez-vous dans l'onglet « Import Letterboxd »
            pour y coller votre clé — elle reste dans ce navigateur et sert aussi à l'enrichissement des fiches.
          </div>
        </div>
      ) : (
        <>
          {/* ---- le bulletin ---- */}
          <div style={{ marginTop: 24, border: `1px solid ${C.line}`, background: C.card, padding: "20px 24px", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
              <Dial label="Degré de niche" left="grand public" right="pépite" value={query.nichePref} onChange={(v) => set("nichePref", v)} />
              <Dial label="Dépaysement" left="dans mes goûts" right="hors des sentiers" value={query.driftPref} onChange={(v) => set("driftPref", v)} ink={C.cobalt} />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
              <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>CE QUI FAIT LA NICHE</span>
              {[["obscurity", "peu vu"], ["foreign", "non anglophone"], ["age", "ancien"]].map(([k, l]) => (
                <Chip key={k} label={l} on={query.niche[k] !== false} onClick={() => set("niche", { ...query.niche, [k]: query.niche[k] === false })} />
              ))}
            </div>

            <div style={{ height: 1, background: C.line, margin: "18px 0 16px" }} />

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ width: 92 }}><Label>De</Label><input style={underlineInput} value={query.yearFrom} onChange={(e) => set("yearFrom", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1920" /></div>
              <div style={{ width: 92 }}><Label>À</Label><input style={underlineInput} value={query.yearTo} onChange={(e) => set("yearTo", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2026" /></div>
              <div style={{ width: 150 }}>
                <Label>Langue d'origine</Label>
                <select value={query.language} onChange={(e) => set("language", e.target.value)} style={{ ...underlineInput, fontFamily: "'Special Elite', monospace", fontSize: 12 }}>
                  {RECO_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <Label>Note TMDB ≥</Label>
                <input type="number" min="0" max="10" step="0.5" style={underlineInput} value={query.minRating} onChange={(e) => set("minRating", Number(e.target.value))} />
              </div>
              <div style={{ width: 120 }}>
                <Label>Votes ≥</Label>
                <input type="number" min="0" step="10" style={underlineInput} value={query.minVotes} onChange={(e) => set("minVotes", Number(e.target.value))} />
              </div>
            </div>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
              le plancher de votes évite de confondre « confidentiel » et « oublié pour de bonnes raisons »
            </div>

            {allGenres.length > 0 && (
              <>
                <div style={{ marginTop: 16 }}>
                  <Label>Genres recherchés</Label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {allGenres.map((g) => <Chip key={g} label={g} on={query.withGenres.includes(g)} onClick={() => toggleIn("withGenres")(g)} />)}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Label>Genres écartés</Label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {allGenres.map((g) => <Chip key={g} label={g} ink={C.slate} on={query.withoutGenres.includes(g)} onClick={() => toggleIn("withoutGenres")(g)} />)}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20, flexWrap: "wrap" }}>
              <button
                onClick={search} disabled={!!progress}
                style={{ all: "unset", cursor: progress ? "default" : "pointer", background: progress ? C.line : C.burgundy, color: C.card, padding: "10px 22px", fontFamily: "'Special Elite', monospace", fontSize: 12, letterSpacing: 1 }}
              >{progress ? `CONSULTATION… ${progress.done}/${progress.total}` : "CHERCHER"}</button>
              <Chip label="ignorer aussi ma watchlist" ink={C.pine} on={query.excludeWatchlist} onClick={() => set("excludeWatchlist", !query.excludeWatchlist)} />
              {taste.isEmpty && (
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.burgundy }}>
                  collection trop mince pour un profil — seuls les filtres joueront
                </span>
              )}
            </div>
          </div>

          {error && <div style={{ marginTop: 18, color: C.burgundy, fontFamily: "'Caveat', cursive", fontSize: 19 }}>{error}</div>}

          {results && results.length > 0 && (
            <>
              <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded, letterSpacing: 1, margin: "30px 0 18px" }}>
                {results.length} PROPOSITIONS · {raw.length} CANDIDATS DÉPOUILLÉS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0 34px", alignItems: "start", position: "relative", zIndex: 2 }}>
                {results.map((c) => <RecoCard key={c.tmdbId} c={c} onAdd={addOne} added={added.has(c.tmdbId)} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [films, setFilms] = useState([]);
  const [notes, setNotes] = useState([]);
  /* Les intercalaires sont du mobilier, pas des fiches : ils vivent à côté
     des films, repérés par le rayon et l'étagère où on les a posés. */
  const [dividers, setDividers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // les fiches d'avant les champs status/watchedAt/tmdbId sont complétées ici
    const migrated = migrate(store.get("films", []));
    setFilms(migrated);
    store.set("films", migrated);
    setNotes(store.get("notebook-notes", []));
    setDividers(store.get("shelf-dividers", []));
    setLoaded(true);
  }, []);

  const saveFilms = (next) => { setFilms(next); store.set("films", next); };
  const saveNotes = (next) => { setNotes(next); store.set("notebook-notes", next); };
  const saveDividers = (next) => { setDividers(next); store.set("shelf-dividers", next); };

  const addFilm = (film) => { saveFilms([film, ...films]); setShowModal(false); };
  const updateFilm = (film) => saveFilms(films.map((f) => (f.id === film.id ? film : f)));
  /* Ranger un boîtier renumérote tout un rayon : une écriture, pas trente. */
  const updateMany = (patches) => saveFilms(films.map((f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f)));
  const deleteFilm = (id) => {
    const next = films.filter((f) => f.id !== id);
    saveFilms(next);
    pruneOrphans(next).catch(console.error);  // l'affiche part avec la fiche
    setView("library"); setSelectedId(null);
  };

  /* Relier deux fiches, c'est écrire des deux côtés : ouvrir l'un ou l'autre
     doit montrer le même fil. Les deux moitiés partagent un pairId, ce qui
     permet de les défaire ensemble. */
  const linkFilms = (fromId, toId, note = "") => {
    const a = films.find((f) => f.id === fromId);
    const b = films.find((f) => f.id === toId);
    if (!a || !b || a.id === b.id) return;
    if ((a.linkedWorks || []).some((w) => w.filmId === b.id)) return;  // déjà relié

    const pairId = uid();
    const card = (target) => ({
      id: uid(), pairId, type: "film", filmId: target.id,
      title: target.title, creator: target.director || "", note: note.trim(),
    });
    saveFilms(films.map((f) =>
      f.id === a.id ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(b)] }
      : f.id === b.id ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(a)] }
      : f
    ));
  };

  /* Défaire un lien : la moitié réciproque part avec lui. */
  const removeLink = (ownerId, workId) => {
    const owner = films.find((f) => f.id === ownerId);
    const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
    if (!work) return;
    saveFilms(films.map((f) => {
      if (f.id === ownerId) return { ...f, linkedWorks: f.linkedWorks.filter((w) => w.id !== workId) };
      if (work.pairId && f.id === work.filmId) return { ...f, linkedWorks: (f.linkedWorks || []).filter((w) => w.pairId !== work.pairId) };
      return f;
    }));
  };

  const restoreBackup = ({ films: f, notes: n, dividers: d }) => {
    const migrated = migrate(f);
    saveFilms(migrated);
    if (n?.length) saveNotes(n);
    if (d?.length) saveDividers(d);
    return migrated.length;
  };

  /* Applique le diff déjà validé à l'écran : les mises à jour sont fusionnées
     champ par champ, jamais un remplacement de fiche. */
  const importFilms = ({ toCreate, toUpdate }) => {
    const patches = new Map(toUpdate.map(({ film, changes }) => [film.id, changes]));
    const merged = films.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id) } : f));
    saveFilms([...toCreate, ...merged]);
  };

  const selectedFilm = films.find((f) => f.id === selectedId);
  // l'état des deux murs survit à l'ouverture d'une fiche
  /* Recherche et filtre sont de l'humeur du moment ; la présentation, le tri
     et la largeur des rayons sont un rangement. Ranger son étagère puis la
     retrouver en désordre au rechargement, ce serait ne pas l'avoir rangée —
     ces trois-là sont donc gardés sur le disque. */
  const [wallUi, setWallUi] = useState(() => {
    const saved = store.get("wall-prefs", {});
    const one = (wall) => ({
      q: "", genreFilter: "", grouped: false,
      sortBy: saved[wall]?.sortBy || WALLS[wall].defaultSort,
      desc: saved[wall]?.desc ?? true,
      mode: saved[wall]?.mode || "wall",
      perRow: saved[wall]?.perRow || "auto",
    });
    return { watched: one("watched"), watchlist: one("watchlist") };
  });
  const setUiFor = (wall) => (next) => setWallUi((s) => {
    const merged = { ...s, [wall]: next };
    const keep = ({ mode, perRow, sortBy, desc }) => ({ mode, perRow, sortBy, desc });
    store.set("wall-prefs", { watched: keep(merged.watched), watchlist: keep(merged.watchlist) });
    return merged;
  });

  const watched = useMemo(() => films.filter((f) => f.status !== "watchlist"), [films]);
  const watchlist = useMemo(() => films.filter((f) => f.status === "watchlist"), [films]);
  // la carte du ciel ne relie que ce qui est en rayon
  const constellationFilms = useMemo(() => watched.filter((f) => !f.archived), [watched]);
  // le mur d'où l'on vient : « je l'ai vu » depuis la watchlist doit ramener au bon endroit
  const backView = selectedFilm?.status === "watchlist" ? "watchlist" : "library";

  if (!loaded) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 22 }}>
        <style>{FONT_IMPORT}</style>
        ouverture du classeur…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", position: "relative",
      // le kraft n'est pas uniforme : des nappes plus claires là où la lumière tombe
      background: `
        radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
        radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
        radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
        ${C.paper}`,
    }}>
      <style>{FONT_IMPORT}</style>
      <PaperGrain />
      <FolderTabs view={view} setView={(v) => { setView(v); setSelectedId(null); }} onAdd={() => setShowModal(true)} />
      <div style={{ flex: 1, position: "relative", zIndex: 2 }}>
        {view === "library" && !selectedId && <LibraryView wall="watched" films={watched} ui={wallUi.watched} setUi={setUiFor("watched")} onUpdateMany={updateMany} dividers={dividers} onDividers={saveDividers} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "watchlist" && !selectedId && <LibraryView wall="watchlist" films={watchlist} ui={wallUi.watchlist} setUi={setUiFor("watchlist")} onUpdateMany={updateMany} dividers={dividers} onDividers={saveDividers} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "detail" && selectedFilm && (
          <DetailView
            film={selectedFilm}
            films={films}
            onBack={() => { setView(backView); setSelectedId(null); }}
            onUpdate={updateFilm}
            onDelete={deleteFilm}
            onLinkFilm={linkFilms}
            onRemoveLink={removeLink}
            onOpen={(id) => setSelectedId(id)}
          />
        )}
        {view === "reco" && <RecoView films={films} onAddToWatchlist={addFilm} />}
        {view === "constellation" && <ConstellationView films={constellationFilms} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "notebook" && <NotebookView notes={notes} onAdd={(n) => saveNotes([n, ...notes])} onUpdate={(n) => saveNotes(notes.map((x) => (x.id === n.id ? n : x)))} onDelete={(id) => saveNotes(notes.filter((x) => x.id !== id))} />}
        {view === "import" && <ImportView onImport={importFilms} films={films} notes={notes} dividers={dividers} onRestore={restoreBackup} />}
      </div>
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}
    </div>
  );
}
