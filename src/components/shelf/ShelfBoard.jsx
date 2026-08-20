/* Filing by hand: this is where all the drag and drop lives. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import {
  SHELF_KINDS,
  CAT_KEYS,
  belongs,
  makeCat,
  makeDecor,
  makeWallDecor,
  reconcileView,
  moveItem,
  forgetByHand,
  pinToWall,
  patchRow,
  addRow,
  removeRow,
  clearRow,
  addCat,
  patchCat,
  removeCat,
  patchDecor,
  removeDecor,
  wallDecorOf,
  plankDecorOf,
} from "../../shelf-views";
import {
  SHELF_KIND,
  BOX_H,
  GAP_X,
  GAP_Y,
  MARK_W,
  MARK_H,
  themeOf,
  decorSpec,
  isWallMotif,
  wallBoxOf,
} from "./constants";
import { DropMark, angleOf, rotatedBoxOfWall } from "./items";
import { QuickFile } from "./QuickFile";
import { Shelf, ReserveDrawer, DecorCabinet, ItemPalette } from "./layout";
import { WearProvider } from "./wear";
import { ShelfLegend } from "./ShelfLegend";
import { ShelfMirror } from "./mirror";
import { readBoxes } from "../../domain/shelfReading";
import { neglectDaysFor } from "../../domain/athome";

/* A pattern whose tint changes nothing: an imported image that is not
   line work, or an SVG whose ink we could not name. The house patterns
   are all drawn to take a colour. */
const noTint = (motif) => {
  const spec = decorSpec(motif);
  return !!spec?.custom && !spec.tintable;
};

/* What hangs rather than being laid down — the question every drag
   handler asks itself before doing anything at all. */
const hangs = (drag) => drag?.type === "wall";

export function ShelfBoard({ films, doc, onDoc, onOpen, onUpdateMany, dimSet, placed }) {
  const { t } = useTranslation();
  /* A drag changes NO React state. It was the last visible lag:
     `setDragId` at the start of the drag re-rendered the shelf, which
     dirtied the layout — and the first `getBoundingClientRect` of the
     first hover then had to recompute it entirely before the marker could
     show. Hence a line that was slow to appear.

     Everything that moves during a drag is therefore written by hand: the
     paled case, the marker, the parted neighbours, the targets that light
     up, and the document's `data-dragging` attribute. */
  const dragRef = useRef(null); // { type, id, node, create? }
  const overRef = useRef({}); // { kind, rowId, catId, overId, side, afterRowId }
  const markRef = useRef(null); // the drop marker, outside React
  const quickRef = useRef(null); // le classeur rapide, ouvert à la main
  const wantQuick = useRef(false); // une fiche est en vol : on ouvrira au premier mouvement
  const spreadRef = useRef([]); // the layers pushed aside, to be set straight again
  const litRef = useRef(null); // the target currently lit
  const measureRef = useRef(new WeakMap()); // les rectangles du glissement en cours
  const tailRef = useRef(new WeakMap()); // the last object of each row hovered
  const [drawer, setDrawer] = useState(false);
  const [cabinet, setCabinet] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [editDecor, setEditDecor] = useState(null);

  const filmsById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);

  /* The view shown is the saved view BROUGHT BACK to the real
     collection: vanished films removed, new films gathered into the
     arrivals row. Purely at render time — we write nothing as long as the
     user has not filed something themselves. */
  const view = useMemo(() => (doc ? reconcileView(doc, films) : null), [doc, films]);
  const theme = themeOf(view?.theme);

  const dim = useCallback((f) => !!dimSet && !dimSet.has(f.id), [dimSet]);

  const acts = useMemo(
    () => ({
      setRow: (id, patch) => onDoc(patchRow(view, id, patch)),
      addRow: (refId, where, kind) =>
        onDoc(addRow(view, kind || shelfKindOfRow(view, refId), refId, where)),
      removeRow: (id) => onDoc(removeRow(view, id)),
      clearRow: (id) => onDoc(clearRow(view, id)),
      addCat: (rowId) => onDoc(addCat(view, rowId, makeCat({ color: CAT_KEYS[0] }))),
      setCat: (id, patch) => onDoc(patchCat(view, id, patch)),
      removeCat: (id) => onDoc(removeCat(view, id)),
      setDecor: (id, patch) => onDoc(patchDecor(view, id, patch)),
      removeDecor: (id) => onDoc(removeDecor(view, id)),
    }),
    [view, onDoc]
  );

  /* Measure once, for the whole drag.

     `dragover` fires continuously, motionless mouse included. Every hover
     handler needed a rectangle, and asked for it again at every event —
     sixty times a second for a cursor that is not moving.

     Reading a rectangle is not a piece of information one consults, it is
     a question the browser must answer CORRECTLY: so it commits any
     pending layout before answering. Now the wrappers carry
     `content-visibility: auto` (see `items.jsx`), which tells the browser
     precisely NOT to lay out what is off screen. Demanding a rectangle
     from it forced it to compute the whole row it had just deliberately
     skipped, and would skip again immediately after. A hundred cases laid
     out then thrown away, sixty times a second, without ever yielding:
     the tab slowed down until it died with the case still in the air.

     We can keep these measurements because the file forbids itself
     elsewhere to move the targets — see the long passage on parting,
     below: only an INNER layer tips, the wrapper does not move by a hair
     for the whole drag. The cache rests entirely on that promise. If a
     transform ever lands on the wrapper itself, these measurements become
     wrong at the same time as the gesture becomes wobbly again: it is the
     same invariant that holds both.

     A fresh `WeakMap` at every drag, and nothing to tidy: the page may
     change between two gestures, it will not change during one. */
  const rectOf = (node) => {
    const seen = measureRef.current;
    let r = seen.get(node);
    if (!r) seen.set(node, (r = node.getBoundingClientRect()));
    return r;
  };

  /* The last object of a row. The same reasoning, the same lifetime: the
     row does not fill up while one is hovering it, and walking its
     children at every event to find the same node again taught nobody
     anything. `null` is a valid answer — so we keep it too, otherwise an
     empty row would be walked again at every twitch.

     Its own registry, and not the rectangles': a row is at once something
     one measures and something whose last child one looks for, and a
     single registry would give it one of the two answers in place of the
     other. */
  const tailOf = (strip) => {
    const seen = tailRef.current;
    if (seen.has(strip)) return seen.get(strip);
    const items = strip.querySelectorAll(":scope > [data-shelf-item]");
    const last = items[items.length - 1] || null;
    seen.set(strip, last);
    return last;
  };

  const hideMark = () => {
    if (markRef.current) markRef.current.style.opacity = "0";
  };

  /* Laying the marker down.

     Once laid, it has only to slide from one slot to the next: we write
     the `transform`, the style sheet's transition does the rest, and it
     runs from one gap to the following one instead of jumping.

     The FIRST laying is the delicate case. The marker is a single element
     that lives in the page permanently: it still carries the position of
     the previous drag. Letting it slide from there means a line crossing
     the shelf at an angle before settling. So we cut the transition,
     install it a little above its place and a little squashed, force the
     browser to commit that starting state, and only then give the
     transition back and aim at the right place: it comes back down its
     seven pixels while unfolding, which looks like something one puts
     down rather than something that lights up.

     It is the rectangle read that forces this commit, and it is
     deliberately that rather than waiting for a frame. A double
     `requestAnimationFrame` would do the same work without costing
     anything in layout — but it would make the marker's appearance depend
     on the goodwill of frames DURING a native drag loop, which not every
     browser guarantees; where frames are starved, the marker would never
     be born. The cost, for its part, is nil at this file's scale: once
     per drag, when hovering a case already reads one at every event.

     The two gestures do not have the same speed, and that is intended.
     The laying can take its time: it has nothing to catch up with, we are
     watching it. The slide from one slot to the next, on the other hand,
     is chasing the mouse — at the same tempo it would lag behind it.
     Hence a long duration written inline for the laying alone, which the
     first move erases so as to fall back on the style sheet's brisk
     tempo. */
  const SETTLE = "transform .36s cubic-bezier(.16,.86,.26,1), opacity .3s ease-out";

  /* `rot`: between two ROWS, the marker lies down. It is the same element
     and the same drawing — only the transform chain changes, so nothing
     new to paint. */
  const placeMark = (x, y, rot = 0) => {
    const m = markRef.current;
    if (!m) return;
    const turn = rot ? ` rotate(${rot}deg)` : "";
    const at = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)${turn}`;
    if (m.style.opacity === "1") {
      if (m.style.transition) m.style.transition = ""; // la pose est finie, on reprend le pas vif
      m.style.transform = at;
      return;
    }

    m.style.transition = "none";
    m.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y) - 9}px, 0)${turn} scaleY(0.86)`;
    m.getBoundingClientRect();
    m.style.transition = SETTLE;
    m.style.transform = at;
    m.style.opacity = "1";
  };

  /* The two neighbours of the drop point part to make room: it is the
     gesture of two fingers opening a row of cases before sliding the next
     one in. They do not slide flat — they TIP, pivoting on their foot
     like standing cases laid over, one to the left, the other to the
     right. It is the whole page's idiom: hovering a case already makes it
     lean.

     Like the marker, this is written by hand on the nodes — a `setState`
     here would again render the whole shelf at every quiver of the mouse,
     which this entire part works to avoid.

     The gesture tips a LAYER INSIDE the wrapper, never the wrapper
     itself, and that is the whole difference between a parting and a
     tremor.

     The wrapper is the drop target. Tipping it meant moving the target
     under the cursor: with the two neighbours parting by seven pixels
     each, a hole of fourteen opened between them — right where the hand
     was aiming. The cursor fell into it, no longer hovered any case, the
     event fell back on the row which called everybody back into place,
     the cursor found itself on the case again, which reopened the hole.
     Twenty times a second. The gesture bit its own tail because it erased
     its own condition.

     The targets are therefore fixed for the whole duration of the drag:
     they pave the row and nothing moves them. Only the image tips. That
     is also what allows the rectangles to be measured at rest without
     having to deduct anything — the parting no longer touches them. */
  const SPREAD = 7,
    TILT = 1.4;

  /* The layer that tips, under a given wrapper. */
  const leanLayer = (wrap) => wrap?.querySelector(":scope > [data-lean]") || null;

  const clearSpread = () => {
    spreadRef.current.forEach((node) => {
      node.style.transform = "";
    });
    spreadRef.current = [];
  };

  const setSpread = (left, right) => {
    clearSpread();
    const next = [];
    [
      [left, -1],
      [right, 1],
    ].forEach(([wrap, dir]) => {
      const layer = leanLayer(wrap);
      if (!layer) return;
      layer.style.transform = `translateX(${dir * SPREAD}px) rotate(${dir * TILT}deg)`;
      next.push(layer);
    });
    spreadRef.current = next;
  };

  /* The immediate neighbour. At a category's edges there is NO sibling:
     the next case is outside, one notch higher in the tree. So we go up to
     the box itself and take its own neighbour — the category parts as one
     block, and that is exactly what one wants to see: the box opens to
     receive. */
  const neighbour = (wrap, dir) => {
    const sib = dir < 0 ? wrap.previousElementSibling : wrap.nextElementSibling;
    if (sib && sib.hasAttribute("data-shelf-item")) return sib;
    const box = wrap.parentElement?.closest("[data-shelf-item]");
    if (!box) return null;
    const out = dir < 0 ? box.previousElementSibling : box.nextElementSibling;
    return out && out.hasAttribute("data-shelf-item") ? out : null;
  };

  /* Lighting one target, and only one. As an attribute rather than as
     state: the rules live in the style sheet, and React knows nothing of
     what lights up while one drags. */
  const light = (node, attr) => {
    if (litRef.current === node) return;
    if (litRef.current) {
      delete litRef.current.dataset.catOver;
      delete litRef.current.dataset.rowOver;
      delete litRef.current.dataset.seamOver;
    }
    litRef.current = node;
    if (node) node.dataset[attr] = "1";
  };

  const reset = useCallback(() => {
    const d = dragRef.current;
    if (d?.node && !d.create) d.node.style.opacity = "";
    /* The marking of the hanging object one was holding (see `WallItem`)
       is undone by its own `dragend`. We clear it here anyway: that
       `dragend` does not always arrive — a node replaced by the drop's
       render never receives it — and a forgotten mark would make that one
       object alone able to steal a drop at the next gesture. */
    for (const el of document.querySelectorAll("[data-drag-self]")) delete el.dataset.dragSelf;
    wantQuick.current = false;
    if (quickRef.current) quickRef.current.style.display = "none";
    dragRef.current = null;
    overRef.current = {};
    /* The measurements were only valid for THIS drag: the next one may
       find a shelf filed differently, and will measure it again. */
    measureRef.current = new WeakMap();
    tailRef.current = new WeakMap();
    hideMark();
    clearSpread();
    light(null);
    delete document.documentElement.dataset.dragging;
  }, []);

  const onDragStart = useCallback((type, id, node, grab) => {
    dragRef.current = { type, id, node, grab };
    if (node) node.style.opacity = "0.35"; // the case lifted, without going through React
    document.documentElement.dataset.dragging = "1";
    /* LE CLASSEUR RAPIDE S'ARME ICI, ET S'OUVRE AU PREMIER MOUVEMENT.

       Il s'ouvrait dès `dragstart`, et c'était un défaut : à cet
       instant précis le navigateur est en train de capturer l'image de
       glissement, et le curseur est encore SUR la case qu'on vient
       d'attraper. Faire apparaître un panneau pile dessous faisait
       avorter le glissement une fois sur deux — sur les cases du bord
       où le panneau se posait, c'est-à-dire les premières de chaque
       rangée.

       On note donc l'intention, et c'est le premier `dragover` qui
       ouvre : à ce moment le glissement est établi, et plus rien ne
       peut l'interrompre. Déplacer le panneau d'un bord à l'autre
       n'aurait fait que déplacer le défaut sur les dernières cases.

       POUR UNE FICHE SEULEMENT : on ne range pas un bibelot dans une
       catégorie de films, et un panneau qui s'ouvre sur un objet qu'il
       ne peut pas recevoir est un panneau qui ment. */
    wantQuick.current = type === "film";
  }, []);

  /* Taking a decor out of the cabinet is MAKING it, not moving it: it
     exists nowhere until it has been let go. The pattern decides its
     family, and its family decides all the rest: a wall object ignores the
     slots between the cases and knows only the back of the shelf. */
  const onDecorDragStart = useCallback((motif, node) => {
    const wall = isWallMotif(motif);
    // some patterns do not reach the common calibre — the strip of tape
    const size = decorSpec(motif)?.defaultSize;
    dragRef.current = {
      type: wall ? "wall" : "decor",
      id: null,
      node,
      create: wall ? makeWallDecor({ motif, size }) : makeDecor({ motif, size }),
    };
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* What a box accepts: anything but another box — `moveItem` holds the
     rule, and this only reflects it. The two must say the same thing: a
     marker that invites where the model will refuse announces a drop that
     will not happen, and that is worse than no target at all. A box
     carried over another is therefore aimed BESIDE it; a decor, for its
     part, goes in. */
  const goesInside = (drag) => drag.type !== "cat";

  /* Aiming at the slot before or after an object on the shelf.

     `wrap` is always a [data-shelf-item] wrapper: it carries the gap that
     follows the object, never the object alone. So we take that gap off to
     find the edge again — otherwise the split into two halves would be
     made around an offset middle, and the marker would dither on the edge
     instead of deciding.

     This handler does not touch React state: it moves a single element by
     hand. Putting the marker through a `setState` meant asking React to
     rebuild the shelf's hundred cases at every twitch of the mouse — even
     memoised, a hundred prop comparisons per event, sixty times a
     second. */
  const aimBeside = (wrap, clientX, ctx) => {
    const id = wrap.dataset.shelfItem;
    /* A wrapper's rectangle is always the resting one: the parting tips a
       layer inside it and does not move it. Nothing to deduct, then, and
       above all nothing that could start oscillating to the rhythm of its
       own animation. */
    const r = rectOf(wrap);
    const left = r.left,
      right = r.right - GAP_X;
    const o = overRef.current;

    /* The middle of the case is a hinge, and a clean hinge slams. Right
       above it, the slightest tremor of the hand sent the marker from one
       edge to the other — two slots a hundred pixels apart, designated one
       after the other by a cursor that had not moved a hair, and the
       neighbours parting one way then the other at every trip.

       So we only change our mind by passing the middle DECISIVELY, and
       only when we already held that case: the dead band does not apply
       to the first hover, where there is no opinion to keep and where the
       split into two halves is the right one. */
    const HYST = 6;
    const mid = (left + right) / 2;
    const held = o.overId === id ? o.side : null;
    const s = held
      ? clientX < mid - HYST
        ? "before"
        : clientX > mid + HYST
          ? "after"
          : held
      : clientX < mid
        ? "before"
        : "after";

    if (o.overId === id && o.side === s && (o.catId || null) === (ctx.catId || null)) return;
    overRef.current = { ...ctx, overId: id, side: s };
    light(null);

    // the marker is centred in the space that opens between the two neighbours
    placeMark(
      (s === "before" ? left - 5 : right + 5) - MARK_W / 2,
      r.bottom - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2
    );
    if (s === "before") setSpread(neighbour(wrap, -1), wrap);
    else setSpread(wrap, neighbour(wrap, 1));
  };

  /* `dragover` fires continuously while the mouse moves, and even still. */
  const onBoxOver = useCallback((e, ctx) => {
    const drag = dragRef.current;
    if (!drag || hangs(drag)) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = e.currentTarget;
    /* A case INSIDE a box: if what one is dragging cannot go in, we do not
       aim at the slot before our eyes — we go up to the box and aim beside
       it, at the row's level. */
    if (ctx.catId && !goesInside(drag)) {
      const box = wrap.parentElement?.closest("[data-shelf-item]");
      if (box) aimBeside(box, e.clientX, { kind: ctx.kind, rowId: ctx.rowId, catId: null });
      return;
    }
    aimBeside(wrap, e.clientX, ctx);
  }, []);

  /* A category's body: one goes INTO the box, at the end. */
  const onCatOver = useCallback((e, ctx) => {
    const drag = dragRef.current;
    if (!drag || hangs(drag)) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = e.currentTarget;
    // a box is not filed inside a box: it is filed beside it
    if (!goesInside(drag)) {
      aimBeside(wrap, e.clientX, { kind: ctx.kind, rowId: ctx.rowId, catId: null });
      return;
    }
    const o = overRef.current;
    if (o.catId === ctx.catId && !o.overId) return;
    overRef.current = { ...ctx, overId: null, side: null };
    clearSpread();
    /* It is the CARDSTOCK that lights up, not the wrapper: the latter is
       only a zone, it has neither paper nor edge to tint. */
    const card = wrap.querySelector("[data-cat-card]");
    light(card, "catOver");
    const r = rectOf(card || wrap);
    // the foot of a box's cases is one gap above its bottom
    placeMark(r.right - 5 - MARK_W / 2, r.bottom - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2);
  }, []);

  /* A row's emptiness: at the end of what is already there. */
  const onRowOver = useCallback((e, ctx) => {
    if (!dragRef.current || hangs(dragRef.current)) return;
    e.preventDefault();
    e.stopPropagation();
    const o = overRef.current;
    if (o.rowId === ctx.rowId && !o.overId && !o.catId && !o.afterRowId) return;
    overRef.current = { ...ctx, overId: null, side: null };
    clearSpread();
    light(e.currentTarget, "rowOver");
    const strip = e.currentTarget;
    const last = tailOf(strip);
    const r = rectOf(strip);
    /* `content-visibility` may have skipped the last case's layout; an
       empty rectangle would teach nothing, so we fall back on the row's
       edge. */
    const lr = last && rectOf(last);
    // wrapper rectangles carry the gap: we take it off to aim at the edge
    const x = lr && lr.width ? lr.right - GAP_X + 5 : r.left + GAP_Y;
    const y = (lr && lr.height ? lr.bottom : r.bottom) - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2;
    placeMark(x - MARK_W / 2, y);
  }, []);

  /* The seam between two rows: letting something go there opens a new
     row. The marker lies down to say so. */
  const onSeamOver = useCallback((e, kind, afterRowId) => {
    if (!dragRef.current || hangs(dragRef.current)) return;
    e.preventDefault();
    e.stopPropagation();
    if (overRef.current.afterRowId === afterRowId) return;
    overRef.current = { kind, afterRowId, rowId: null, catId: null, overId: null };
    clearSpread();
    light(e.currentTarget, "seamOver");
    const r = rectOf(e.currentTarget);
    placeMark(r.left + r.width / 2 - MARK_W / 2, r.top + r.height / 2 - MARK_H / 2, 90);
  }, []);

  const onShelfOver = useCallback(() => {}, []); // the marker is enough to say where one is going

  /* Dropping.

     There are no numbers to hand out any more, nor a shelf to renumber:
     a case's place is its position in an array, and the write touches
     only one document — the view's. What the film keeps of its own are
     its flags: they say WHICH shelf it is on, and they hold for every
     view at once. */
  const drop = (kind, e, onWall = false) => {
    const drag = dragRef.current;
    if (!drag || !view) return reset();

    /* A wall object is not dropped into a row. A row's `drop` sees it go
       past first — it is deeper in the tree — and must LET IT RISE:
       without this return, a frame let go just above a case would be filed
       between two edges. So we reset nothing here, the drag is not
       over. */
    if (hangs(drag)) {
      if (!onWall) return;
      /* We measure THE WALL LAYER, never the shelf's frame: it is the
         wall layer that the percentages refer to once the object is laid.
         Measuring the frame amounted to counting in a box larger by its
         ten pixels of margin, and everything one laid ended up shifted up
         and to the left. */
      const layer = e.currentTarget.querySelector("[data-wall-layer]");
      const r = (layer || e.currentTarget).getBoundingClientRect();
      /* And we give the object back where one SAW it: the cursor does not
         hold it by its centre but by the place one picked it up. */
      const { dx = 0, dy = 0 } = drag.grab || {};

      /* WE NOW CLAMP ONLY TO THE WALL.

         The object was held half its width from the edge, so that it
         would fit whole inside its shelf. That was a precaution against a
         real defect: an object that overflows stays grabbable where it
         overflows, and it then intercepted drops meant for the shelf
         below — one aimed at the collection and dropped into the bedside
         films.

         But the precaution cost more than the defect. It forbade pinning
         anything near an edge: a garland in a corner, an ivy hanging from
         an upright, everything came back towards the middle without one
         understanding why. Now the defect can be settled at its source —
         during a drag, NO hanging object receives the cursor any more (see
         `tokens.ts`), and it can therefore no longer steal anybody's drop.

         What remains is the only clamp that describes something real: the
         object's centre stays within its shelf. What sticks out sticks
         out — that is what one wants of an object hooked to an upright. */
      const pct = (v, span) => (Math.min(Math.max(v, 0), span) / span) * 100;
      const next = pinToWall(view, kind, drag.create ? { create: drag.create } : { id: drag.id }, {
        x: pct(e.clientX - dx - r.left, r.width),
        y: pct(e.clientY - dy - r.top, r.height),
      });
      if (next !== view) onDoc(next);
      return reset();
    }

    const o = overRef.current;

    let target;
    if (o.kind === kind && o.afterRowId) {
      target = { kind, afterRowId: o.afterRowId };
    } else if (o.kind === kind && o.rowId) {
      target = { kind, rowId: o.rowId, catId: o.catId, overId: o.overId, side: o.side };
    } else {
      /* Let go on a shelf's back, on the drawer's tab, or on a marker left
         over from elsewhere: we do not know WHERE, only on which shelf.
         The arrivals row is made for that. */
      const rows = view.shelves[kind].rows;
      target = { kind, rowId: rows[rows.length - 1].id };
    }

    /* REPOSER UNE FICHE SOI-MÊME PÉRIME L'INSTANTANÉ. À partir
       d'ici la disposition à l'écran est celle qu'on veut : « revenir
       au rangement à la main » rendrait une version plus ancienne que
       le geste qu'on vient de faire. Voir `forgetByHand`. */
    const next = forgetByHand(
      moveItem(view, drag.create ? { create: drag.create } : { id: drag.id }, target)
    );
    if (next !== view) onDoc(next);
    if (drag.type === "film") onUpdateMany({ [drag.id]: { ...SHELF_KIND[kind].patch } });
    reset();
  };

  /* LE FILET DE SÉCURITÉ DU CLASSEUR RAPIDE.

     Le panneau s'ouvre à la main et se referme dans `reset`, qui est
     appelé par `drop` et par `dragend`. Or ce fichier dit lui-même,
     à propos du marquage des objets pendus, que « ce `dragend` n'arrive
     pas toujours — un nœud remplacé par le rendu du dépôt n'en reçoit
     jamais ». C'est exactement le cas du classeur rapide : on y lâche
     une fiche, elle change de rangée, son nœud est remplacé.

     UN PANNEAU RESTÉ OUVERT NE FAIT PAS QUE TRAÎNER : il est en
     `position: fixed` par-dessus la colonne, donc il INTERCEPTE le
     premier appui sur ce qu'il recouvre. Un objet qu'on ne peut plus
     attraper, sans rien à l'écran qui l'explique, est le pire des
     défauts à retrouver.

     L'écoute est posée sur le document, en capture, et ne fait que
     refermer : elle ne peut donc rien casser d'autre. */
  useEffect(() => {
    const shut = () => {
      wantQuick.current = false;
      if (quickRef.current) quickRef.current.style.display = "none";
    };
    const open = () => {
      if (!wantQuick.current || !quickRef.current) return;
      quickRef.current.style.display = "block";
    };
    document.addEventListener("dragover", open, true);
    document.addEventListener("dragend", shut, true);
    document.addEventListener("drop", shut, true);
    return () => {
      document.removeEventListener("dragover", open, true);
      document.removeEventListener("dragend", shut, true);
      document.removeEventListener("drop", shut, true);
    };
  }, []);

  /* LES BOÎTES DE LA VUE, À PLAT.

     Calculées au rendu ordinaire et non pendant le glissement : elles ne
     bougent pas tant qu'on tient une fiche, et les chercher au moment du
     survol coûterait un balayage par mouvement de souris. */
  const quickBoxes = useMemo(() => {
    const out = [];
    if (!view) return out;
    for (const kind of SHELF_KINDS) {
      for (const row of view.shelves?.[kind]?.rows || []) {
        for (const it of row.items || []) {
          if (it.t !== "c") continue;
          out.push({
            kind,
            rowId: row.id,
            catId: it.id,
            label: it.label,
            color: it.color,
            count: (it.items || []).filter((x) => x.t === "f").length,
          });
        }
      }
    }
    return out;
  }, [view]);

  /* RANGER DEPUIS LE PANNEAU EST UN DÉPÔT COMME UN AUTRE : même modèle,
     même écriture, et le film prend les marques du rayon où sa boîte se
     trouve — sans quoi il serait rangé sur une étagère et marqué comme
     appartenant à une autre. */
  const dropInBox = (box) => {
    const drag = dragRef.current;
    if (!drag || drag.type !== "film" || !view) return reset();
    const next = forgetByHand(moveItem(view, { id: drag.id }, box));
    if (next !== view) onDoc(next);
    onUpdateMany({ [drag.id]: { ...SHELF_KIND[box.kind].patch } });
    reset();
  };

  /* `drop` reads the view and the collection: so it is necessarily
     rebuilt at every render, and that is quite all right — it serves only
     once, at the release.

     What is wrong is making it travel as it is. The `dnd` bundle goes down
     as a prop as far as the ROWS; a single new function inside it and the
     whole bundle is new, so that each row's `React.memo` sees different
     props and does its work again — for a function we did not even call.

     The cases escape it: they receive the handlers one by one, and those
     are already stable. The loss is therefore limited to the rows. It is
     still worth plugging, because a rebuilt row replaces its wrappers —
     and the measurements kept above designated precisely those wrappers.
     The only render a drag triggers (the drawer's tab opening) would then
     be enough to throw the cache away in the middle of the gesture.

     So we file the day's function behind a handle which, for its part,
     never changes. The bundle becomes constant for the component's whole
     life, and the promise holds.

     The filing is done afterwards rather than in mid-render: a render must
     be playable twice without leaving anything behind it. The lag is
     inconsequential here — the handle is only pulled at the release, long
     after the screen has settled. */
  const dropRef = useRef(drop);
  useEffect(() => {
    dropRef.current = drop;
  });
  /* The handle passes on EVERYTHING it receives. It only forwarded the
     shelf, and the two following arguments fell by the wayside: dropping
     into a row put up with it, since it reads its target in `overRef` —
     but the wall has only the event to know where one let go, and the flag
     to know that one was aiming at the shelf's back and not a slot between
     two edges. Without them, `onWall` fell back on its default and nothing
     hung anywhere any more. */
  const onDrop = useCallback((...args) => dropRef.current(...args), []);

  const dnd = useMemo(
    () => ({
      onDragStart,
      onDragEnd: reset,
      onShelfOver,
      onBoxOver,
      onCatOver,
      onRowOver,
      onSeamOver,
      onDrop,
    }),
    [onDragStart, reset, onShelfOver, onBoxOver, onCatOver, onRowOver, onSeamOver, onDrop]
  );

  /* Naming a card is done ON the card, without opening a panel: it is a
     direct write, like a category's tab.

     It is memoised, and that is not for comfort. It goes down as far as
     the ROWS, whose `React.memo` is all that stops them being rebuilt in
     the middle of a gesture — and an arrow rewritten at every render is a
     prop that changes at every render. The only `setState` a drag
     triggers (the drawer opening) was then enough to rebuild every row,
     hence to replace the wrappers the drag's measurements designated.
     That is the defect `ShelfBoard.test.jsx` guards. */
  const onDecorLabel = useCallback((id, label) => acts.setDecor(id, { label }), [acts]);

  /* AU BOUT DE COMBIEN DE JOURS « IL Y A LONGTEMPS » COMMENCE, ICI.

     Un nombre pour tout le classeur, et non un par fiche : il descend
     donc par CONTEXTE et non par la chaîne des props (voir `wear.tsx`).
     Il se recalcule quand la collection change — pas quand on glisse,
     puisqu'un glissement ne touche à aucun état React. */
  const neglectDays = useMemo(() => neglectDaysFor(films), [films]);

  const countOf = (kind) => films.filter(belongs[kind]).length;

  /* LES RAYONS, À PLAT — la légende et le miroir les lisent tous les
     trois, dans l'ordre où on les regarde. */
  const shelvesInOrder = useMemo(() => {
    if (!doc) return [];
    const kinds = doc.wall === "watchlist" ? ["main", "reserve"] : SHELF_KINDS;
    return kinds
      .filter((kind) => doc.shelves?.[kind])
      .map((kind) => ({ kind, rows: doc.shelves[kind].rows || [] }));
  }, [doc]);

  /* LA LÉGENDE PORTE LES BOÎTES DE TOUS LES RAYONS, et non d'un seul :
     une catégorie n'appartient pas à une planche, c'est un rangement
     qu'on retrouve où qu'il soit posé. */
  const legend = useMemo(
    () =>
      shelvesInOrder.flatMap(({ rows }) =>
        rows.flatMap((row) => readBoxes(row.items, dimSet || null))
      ),
    [shelvesInOrder, dimSet]
  );

  if (!view) return null;

  const cat = editCat && findCatIn(view, editCat);
  const decor = editDecor && findDecorIn(view, editDecor);

  const shared = {
    dnd,
    acts,
    films: filmsById,
    theme,
    /* The wall's decor, or nothing. It is the same for both shelves: what
       one paints is the room, not a board. */
    wallDecor: wallDecorOf(view),
    plankDecor: plankDecorOf(view),
    dim,
    /* CE QUE LA RECHERCHE TROUVE, pour que chaque rayon puisse dire
       COMBIEN il en tient. `dim` répond fiche par fiche et ne sait pas
       compter une fiche disparue ; l'ensemble, lui, le sait.

       Son nom dit son CONTENU et non son usage : `dimSet` tient les
       fiches qui RÉPONDENT, celles qu'on ne ternit pas. Le lire à
       l'envers comptait exactement le complément. */
    matching: dimSet || null,
    /* UNE MARCHE EN MOINS. Ouvrir une case posait `CellPreview`, un
       aperçu — titre, note, critique — après lequel il fallait encore
       cliquer pour la fiche puis pour le dossier : trois écrans pour
       lire une réponse. Depuis que la fiche rapide vient avant le
       dossier partout, cet aperçu disait moins qu'elle, plus tôt. Le
       clic va donc directement à `onOpen`, que `LibraryView` mène à la
       couche. */
    onOpen,
    onEditCat: setEditCat,
    onEditDecor: setEditDecor,
    onDecorLabel,
  };

  return (
    /* `--mark-ink`: the marker's ink comes from the view's theme, through
       a CSS variable. A change of theme thus has nothing to ask of React
       in the middle of a drag. */
    <WearProvider neglectDays={neglectDays}>
      <div
        onDragEnd={reset}
        style={{
          "--mark-ink": theme.accent,
          /* NO CLIPPING HERE.

           This block contains a case's drawer and card, which are
           `position: fixed`. An `overflow` other than `visible` would make
           it a clipping box: the two would stay hooked to the window but
           would only be seen through a frame which, for its part, scrolls
           — a drawer one has to go and find at the bottom of the page, a
           card that does not appear at all. The decors' overflow is
           clipped one notch lower, on each shelf (`Shelf`), and the window
           takes care of the rest (`index.css`). */
        }}
      >
        {/* the drop marker: a single one, moved by hand during the drag */}
        <DropMark ref={markRef} />
        {/* LE MIROIR EN LISTE — masqué à l'œil, jamais au lecteur
            d'écran. Il vient EN TÊTE : c'est le premier chemin qu'on
            rencontre, et l'annoncer après quatre cents boîtiers qu'on ne
            peut pas parcourir n'aurait servi à personne. */}
        <ShelfMirror
          shelves={shelvesInOrder}
          films={filmsById}
          neglectDays={neglectDays}
          onOpen={onOpen}
        />
        <ShelfLegend boxes={legend} />
        {/* "Bedside films" are the ones one rewatches: the shelf has no
          reason to be on the wall of films to watch, where it only opened
          to stay empty. `belongs` already files the flagged cards over
          there, so they are not lost. */}
        {view.wall !== "watchlist" && (
          <Shelf
            kind="bedside"
            shelf={view.shelves.bedside}
            wall={view.shelves.bedside.wall}
            count={countOf("bedside")}
            {...shared}
          />
        )}
        <Shelf
          kind="main"
          shelf={view.shelves.main}
          wall={view.shelves.main.wall}
          count={countOf("main")}
          {...shared}
        />
        <ReserveDrawer
          shelf={view.shelves.reserve}
          count={countOf("reserve")}
          open={drawer}
          setOpen={setDrawer}
          {...shared}
        />
        {/* LE CABINET S'OUVRE D'ICI, ET D'UN SEUL ENDROIT.

          Il y avait un bouton « + DÉCOR » au haut de CHAQUE rayon, et
          chacun annonçait viser le sien — alors que c'est le lâcher qui
          décide. Trois portes pour une pièce, dont deux mentaient sur ce
          qu'il y avait derrière.

          Le bouton est en `position: fixed`, comme le tiroir qu'il
          ouvre : il ne bouge pas avec les planches, ne défile pas avec
          elles, et reste à portée quel que soit le rayon qu'on regarde. */}
        <button
          data-tour="shelf-cabinet"
          onClick={() => setCabinet((open) => !open)}
          aria-expanded={!!cabinet}
          title={t("shelf.cabinet")}
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            position: "fixed",
            right: 40,
            top: 84,
            zIndex: 44,
            fontFamily: F.mono,
            fontSize: 9.5,
            letterSpacing: 1,
            padding: "5px 10px",
            color: cabinet ? C.card : C.inkFaded,
            background: cabinet ? C.ink : C.card,
            border: `1px dashed ${C.line}`,
            boxShadow: "1px 2px 6px rgba(30,20,10,0.2)",
          }}
        >
          + DÉCOR
        </button>
        <QuickFile ref={quickRef} boxes={quickBoxes} onDrop={dropInBox} />
        {cabinet && (
          <DecorCabinet
            placed={placed}
            onClose={() => setCabinet(null)}
            onDragStart={onDecorDragStart}
            onDragEnd={reset}
          />
        )}
        {cat && (
          <ItemPalette
            title={t("shelf.category")}
            color={cat.color}
            removeLabel={t("shelf.undoCategory")}
            onColor={(k) => acts.setCat(cat.id, { color: k })}
            onRemove={() => {
              acts.removeCat(cat.id);
              setEditCat(null);
            }}
            onClose={() => setEditCat(null)}
          />
        )}
        {decor && (
          <ItemPalette
            title={t("shelf.objectStamp")}
            color={decor.color}
            size={decor.size}
            /* The field only appears for the patterns that write: passing
             `onLabel` to a pin would give it a name nothing would ever
             show. */
            {...(decorSpec(decor.motif)?.writes
              ? { label: decor.label, onLabel: (v) => acts.setDecor(decor.id, { label: v }) }
              : null)}
            removeLabel="retirer l'objet"
            /* The orientation. `seededRot` gives the angle the object
             carries as long as nobody has set it: without it, the panel
             would announce zero under an object visibly askew. */
            rot={decor.rot}
            seededRot={angleOf({ id: decor.id }, decorSpec(decor.motif)?.tall)}
            onRot={(deg) => acts.setDecor(decor.id, { rot: deg })}
            /* An imported pattern we cannot tint — a PNG, an SVG with no
             named line — has no colour to choose: offering it one anyway
             would be offering a row of dead buttons. */
            onColor={noTint(decor.motif) ? undefined : (k) => acts.setDecor(decor.id, { color: k })}
            onSize={(v) => acts.setDecor(decor.id, { size: v })}
            onRemove={() => {
              acts.removeDecor(decor.id);
              setEditDecor(null);
            }}
            onClose={() => setEditDecor(null)}
          />
        )}
      </div>
    </WearProvider>
  );
}

/* Finding a piece of furniture in the view — the editing panel knows only
   its identifier. */
const shelfKindOfRow = (view, rowId) =>
  SHELF_KINDS.find((k) => view.shelves[k].rows.some((r) => r.id === rowId)) || "main";

const findCatIn = (view, id) => {
  for (const k of SHELF_KINDS)
    for (const row of view.shelves[k].rows)
      for (const it of row.items) if (it.t === "c" && it.id === id) return it;
  return null;
};

const findDecorIn = (view, id) => {
  for (const k of SHELF_KINDS) {
    for (const it of view.shelves[k].wall || []) if (it.id === id) return it;
    for (const row of view.shelves[k].rows) {
      for (const it of row.items) {
        if (it.t === "d" && it.id === id) return it;
        if (it.t === "c")
          for (const sub of it.items) if (sub.t === "d" && sub.id === id) return sub;
      }
    }
  }
  return null;
};

/* CHOOSING THE VIEW — a shelf can be filed in several ways.

   The films are the same; what changes is the staging: the order, the
   categories, the width of the lines, the objects laid down and the wood
   of the boards. One goes from one to the other without moving
   anything. */
