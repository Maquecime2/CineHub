/* ============================================================
   THE SHELF VIEWS — the arrangement, kept out of the film
   ============================================================

   Until now, a case's place was an `order` number written ON the film.
   Since a film has only one `order`, the collection had only one
   possible arrangement: two stagings could not be kept at once.

   So the arrangement moves out here, into a "view" document: rows,
   categories, decors and theme. The film's flags (`bedside`, `archived`)
   say WHICH shelf it is on; the view says WHERE on that shelf. That is
   the only rule to remember, and all the rest follows from it.

   This module is deliberately pure — no React, no localStorage. It is
   the layer where a mistake does not show on screen but corrupts data,
   hence the tests that go with it. */

import { CAT_KEYS } from "./theme/palette";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const SHELF_KINDS = ["bedside", "main", "reserve"];

/* Which shelf a film belongs to. Taken as it was from `ShelfBoard`: it
   is the film's flags, and they alone, that decide.

   Except in one case, which is not an exception but the shelf's very
   definition: "bedside films" means THE ONES WE WATCH AGAIN. A film we
   have not seen yet cannot be one. The flag stays written on the card —
   we do not lose it by putting a film on the watchlist — but as long as
   it is to watch, it files in the main collection. Otherwise the
   watchlist opened a "the ones we watch again" shelf that means nothing,
   and ShelfBoard, which hides it, would have lost films in it. */
const revu = (f) => f.status !== "watchlist";

export const belongs = {
  bedside: (f) => f.bedside && revu(f) && !f.archived,
  main: (f) => (!f.bedside || !revu(f)) && !f.archived,
  reserve: (f) => f.archived,
};

export const kindOf = (f) => (f.archived ? "reserve" : f.bedside && revu(f) ? "bedside" : "main");

/* The colours offered to the categories. The list is no longer copied
   here: it is DEDUCED from the swatch book (`theme/palette`), which
   stays pure and therefore does not drag React into this module. We
   always store the KEY and never the hex value. */
export { CAT_KEYS };

/* What we fill a new board with. It is NO LONGER what it displays: a row
   is born "auto" and takes the count of its own width (see `useRowCap`,
   in `components/shelf/lines.js`) — that was the old default of ten,
   which showed on a wide screen as a half-empty row and a mystery in the
   gutter. This number only serves to CUT UP: a collection poured in at
   once takes boards by the dozen rather than one endless board. What is
   written in the gutter, on the other hand, is always a choice
   somebody made. */
export const DEFAULT_CAP = 10;

/* The set-aside drawer is only 250 px wide: two cases fit in it, not
   ten. Giving it the collection's count would fold every row into a
   column. */
export const DRAWER_CAP = 2;

/* A count is never an imposed number: it is the MAXIMUM a board
   accepts. It can carry fewer — because there are no films left, or
   because the available width does not follow. Nothing will ever call a
   case back to fill it. */
export const capFor = (kind) => (kind === "reserve" ? DRAWER_CAP : DEFAULT_CAP);

const chunk = (arr, n) => {
  if (!n || arr.length <= n) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* v2: rows have a count, and the surplus spills onto the next one. The
   v1 views were built with a whole shelf poured into a single row — they
   have to be taken in hand on load, otherwise they stay one big single
   line until somebody touches them. */
export const VIEW_VERSION = 2;

export function upgradeView(view) {
  if ((view.version || 1) >= VIEW_VERSION) return view;
  const shelves = {};
  for (const kind of SHELF_KINDS) {
    /* We no longer touch the rows. A v1 view poured its shelf into a
       single row with no count, and that was the flaw: it stretched into
       an endless band. It now folds into wooden lines, each with its
       board — the one big line has become a shelf, and there is nothing
       left to take in hand. */
    shelves[kind] = view.shelves?.[kind] || makeShelf();
  }
  return reflowView(drainUnplaced({ ...view, version: VIEW_VERSION, shelves }));
}

/* An airlock that overflows is no longer an airlock, it is a heap. Past
   what a board accepts, its content takes boards — just before it, so
   that the order is kept. */
export function drainUnplaced(view) {
  const shelves = {};
  let changed = false;
  for (const kind of SHELF_KINDS) {
    const shelf = view.shelves[kind];
    const rows = shelf.rows;
    const sas = rows[rows.length - 1];
    const cap = capFor(kind);
    if (!sas || !isUnplaced(sas) || sas.items.length <= cap) {
      shelves[kind] = shelf;
      continue;
    }
    /* The empty boards before the airlock are leftovers — the one the
       migration left in front of a whole shelf fallen into the heap. We
       take them back rather than laying the new ones behind them. */
    let keep = rows.slice(0, -1);
    while (keep.length && !keep[keep.length - 1].items.length) keep = keep.slice(0, -1);
    // one board, which will fill its width — not packets of ten
    const born = [makeRow({ items: sas.items })];
    shelves[kind] = { ...shelf, rows: [...keep, ...born, { ...sas, items: [] }] };
    changed = true;
  }
  return changed ? { ...view, shelves } : view;
}

/* ------------------------------------------------------------
   Constructeurs
   ------------------------------------------------------------ */

export const makeRow = ({ id, kind = "normal", perRow = null, label = "", items = [] } = {}) => ({
  id: id || `r_${uid()}`,
  kind,
  perRow,
  label,
  items,
});

/* A box no longer has a count of its own. It used to, and so there were
   two, which contradicted each other: the row's said how many objects
   fit on the line, the box's how many films fit IN the box, and the box
   folded in on itself with nothing to carry its upper lines. The count
   is now the wooden line's, and there is only one: the box takes the
   cells that are left and then spills onto the line below. */
export const makeCat = ({ id, label = "Catégorie", color = CAT_KEYS[0], items = [] } = {}) => ({
  t: "c",
  id: id || `c_${uid()}`,
  label,
  color,
  items,
});

/* `label` only serves the motifs that write — the divider, for now. The
   others carry it empty and never show it: an inert field on an object
   costs less than a second sort of decor to carry everywhere.

   `rot` is ABSENT and not zero, and the difference matters: without it,
   the object takes the lean sown from its identifier — every trinket
   askew in its own way, which is all that keeps a shelf from looking
   like a catalogue plate. Zero means "upright, and I meant it". So we
   only write this field once a hand has set it, and a view from before
   orientation stays identical to the pixel. */
export const makeDecor = ({ id, motif, size = 1, color = "ochre", label = "" } = {}) => ({
  t: "d",
  id: id || `d_${uid()}`,
  motif,
  size,
  color,
  label,
});

/* A HUNG decor. The same object as one laid down, give or take two
   numbers: it does not live in a row but on the shelf's back, and so it
   needs a place of its own. `x` and `y` are PERCENTAGES of the shelf's
   frame — a shelf that gains a line, a window shrunk, and the object
   keeps its relative place instead of leaving the frame. */
export const makeWallDecor = ({ id, motif, size = 1, color = "ochre", x = 50, y = 30 } = {}) => ({
  ...makeDecor({ id, motif, size, color }),
  x,
  y,
});

export const filmItem = (id) => ({ t: "f", id });

/* A new shelf: one row for filing, and the arrivals row that gathers
   what has not been placed yet. The latter is an institution, not an
   accident: without it, an imported film would have nowhere to appear
   and would become invisible. */
export const makeShelf = () => ({
  rows: [makeRow(), makeRow({ kind: "unplaced" })],
  /* What is hung on the back. A shelf from before the wall objects does
     not have this array: everywhere it is read, we read `shelf.wall ||
     []` rather than going and rewriting every view already saved. */
  wall: [],
});

export const makeView = ({
  id,
  wall = "watched",
  name = "Nouvelle vue",
  theme = "kraft",
  now = 0,
} = {}) => ({
  id: id || `v_${uid()}`,
  version: VIEW_VERSION,
  wall,
  name,
  theme,
  createdAt: now,
  updatedAt: now,
  /* `decor` is DELIBERATELY absent from a new view — see below. */
  shelves: { bedside: makeShelf(), main: makeShelf(), reserve: makeShelf() },
});

/* ------------------------------------------------------------
   THE DECOR — what the view is made of, beyond the theme
   ------------------------------------------------------------

   `theme` only set three things, and the wall had no paint at all. The
   decor opens up the rest:

     decor?: {
       wall?:  { paint?, pattern?, patternInk?, texture? },
       plank?: { material?, finish? },
     }

   EVERYTHING IN IT IS OPTIONAL, AND SO IS THE FIELD ITSELF. It is the
   same rule as `rot` on a decor or `wall` on a shelf: absent means "as
   before", and a view saved before today must stay identical to the
   pixel. Nothing writes `decor` until a hand has set something; `theme`
   stays the default source, and erasing gives the view back to its
   theme.

   No migration to write for all that: every transformation in this
   module rebuilds the view by spreading (`{ ...view, ... }`), so that
   one more field travels without our having to name it anywhere. What
   follows is therefore only the way to READ it and to WRITE it, in one
   place. */

export const wallDecorOf = (view) => view.decor?.wall || null;
export const plankDecorOf = (view) => view.decor?.plank || null;

/* Retouching one facet of the decor. A null value ERASES the setting —
   that is how "go back to the theme" is said, and the view rids itself
   of the empty objects on the way rather than dragging a `decor: {}`
   around that would mean the same thing as an absence. */
export function patchViewDecor(view, part, patch) {
  const before = view.decor?.[part] || {};
  const merged = { ...before, ...patch };
  for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];

  const decor = { ...view.decor };
  if (Object.keys(merged).length) decor[part] = merged;
  else delete decor[part];

  const next = { ...view };
  if (Object.keys(decor).length) next.decor = decor;
  else delete next.decor;
  return next;
}

/* Give the view back to its theme: no decor at all. */
export function clearViewDecor(view) {
  if (!view.decor) return view;
  const next = { ...view };
  delete next.decor;
  return next;
}

/* ------------------------------------------------------------
   Petits outils de structure
   ------------------------------------------------------------ */

/* A `map` that returns the original array when nothing moved. That is
   what lets `reconcileView` avoid building a new object on every render
   — otherwise memoising the rows would be pointless and an unrelated
   `setState` would repaint the shelf's hundred cases. */
const mapSame = (arr, fn) => {
  let changed = false;
  const out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = fn(arr[i], i);
    if (out[i] !== arr[i]) changed = true;
  }
  return changed ? out : arr;
};

const filterSame = (arr, keep) => {
  const out = arr.filter(keep);
  return out.length === arr.length ? arr : out;
};

export const isUnplaced = (row) => row.kind === "unplaced";

/* Every film id in a view, categories included. */
export function filmIdsOf(view) {
  const ids = [];
  for (const kind of SHELF_KINDS) {
    for (const row of view.shelves[kind].rows) {
      for (const it of row.items) {
        if (it.t === "f") ids.push(it.id);
        else if (it.t === "c") for (const sub of it.items) if (sub.t === "f") ids.push(sub.id);
      }
    }
  }
  return ids;
}

/* ------------------------------------------------------------
   Reconciliation — the view against the real collection
   ------------------------------------------------------------

   A view is an arrangement, not a source of truth: films are born,
   change shelf and die elsewhere. So we bring it back to reality on
   every render, without ever writing — the write only happens on the
   next real mutation, through `commitView`.

   Three wrongs to right, in that order:
     - an id that no longer points at anything, or no longer at this
       shelf: we take it out;
     - an id present twice: we keep only the first;
     - a film on the shelf that appears nowhere: it falls into the
       arrivals row. That is the invariant "nothing is ever invisible",
       and it is what makes archiving reversible. */
export function reconcileView(view, films) {
  const byId = new Map(films.map((f) => [f.id, f]));
  const seen = new Set();

  let shelvesChanged = false;
  const shelves = {};

  for (const kind of SHELF_KINDS) {
    const shelf = view.shelves[kind] || makeShelf();
    const here = (id) => {
      const f = byId.get(id);
      return !!f && belongs[kind](f);
    };
    /* A film can occupy only one place: the first comer keeps it. We
       mark everything we saw on the way, so as to know afterwards who is
       missing. */
    const keepFilm = (id) => {
      if (!here(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    };

    let rows = mapSame(shelf.rows, (row) => {
      const items = filterSame(
        mapSame(row.items, (it) => {
          if (it.t !== "c") return it;
          /* Only films are checked against the collection: a decor laid
             in a box exists only in the view, and nothing outside can
             contradict it. Filtering it like a film would make it
             disappear on the first render. */
          const sub = filterSame(it.items, (s) => (s.t === "f" ? keepFilm(s.id) : true));
          return sub === it.items ? it : { ...it, items: sub };
        }),
        (it) => (it.t === "f" ? keepFilm(it.id) : true)
      );
      return items === row.items ? row : { ...row, items };
    });

    rows = ensureUnplaced(rows);

    /* What the view does not know about yet. The order of arrival is the
       collection's: it is the only one available here. */
    const missing = [];
    for (const f of films)
      if (belongs[kind](f) && !seen.has(f.id)) {
        seen.add(f.id);
        missing.push(f.id);
      }

    if (missing.length) {
      const at = rows.length - 1;
      const last = rows[at];
      rows = [...rows.slice(0, at), { ...last, items: [...last.items, ...missing.map(filmItem)] }];
    }

    if (rows !== shelf.rows) {
      shelves[kind] = { ...shelf, rows };
      shelvesChanged = true;
    } else {
      shelves[kind] = shelf;
    }
  }

  return shelvesChanged ? { ...view, shelves } : view;
}

/* Exactly one arrivals row, always last. If the user has none (a view
   built by hand, a document from an earlier version), we lay one down;
   if they have several, we melt them together. */
function ensureUnplaced(rows) {
  const idx = rows.map((r, i) => (isUnplaced(r) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 1 && idx[0] === rows.length - 1) return rows;
  if (!idx.length) return [...rows, makeRow({ kind: "unplaced" })];
  const first = rows[idx[0]];
  const merged = makeRow({
    id: first.id,
    kind: "unplaced",
    perRow: first.perRow,
    label: first.label,
    items: idx.flatMap((i) => rows[i].items),
  });
  return [...rows.filter((r) => !isUnplaced(r)), merged];
}

/* ------------------------------------------------------------
   Moving — the one mutation
   ------------------------------------------------------------

   Every drop goes through here: between two cases, into a category, into
   a row's empty space, onto a seam (which creates a row), or into the
   arrivals row. We first take the item out of wherever it came from,
   THEN compute the destination index: post-removal indices are the only
   correct ones, and `overId` never designates the item being moved.

   `drag`: { id } for a move, { create } for a creation (a decor taken
   out of the cabinet does not exist yet).
   `target`: { kind, rowId, catId, overId, side } or { kind, afterRowId }
   for a seam. */
export function moveItem(view, drag, target) {
  const created = drag.create || null;
  let moved = created;

  const shelves = {};
  for (const kind of SHELF_KINDS) shelves[kind] = view.shelves[kind];

  if (!created) {
    for (const kind of SHELF_KINDS) {
      const found = takeItem(shelves[kind], drag.id);
      if (found) {
        moved = found.item;
        shelves[kind] = found.shelf;
      }
    }
  }
  if (!moved) return view;

  const kind = target.kind;
  let rows = shelves[kind].rows;

  // a seam: the row does not exist yet, we open it
  if (target.afterRowId !== undefined) {
    const at = rows.findIndex((r) => r.id === target.afterRowId);
    const above = at >= 0 ? rows[at] : null;
    // the new row inherits the cap of the one above: a line opened under
    // a line of 6 almost always wants 6 as well
    const row = makeRow({
      perRow: above && !isUnplaced(above) ? above.perRow : null,
      items: [moved],
    });
    const insertAt = at >= 0 ? at + 1 : Math.max(0, rows.length - 1);
    rows = [...rows.slice(0, insertAt), row, ...rows.slice(insertAt)];
    return withRows(view, shelves, kind, rows);
  }

  const rowAt = rows.findIndex((r) => r.id === target.rowId);
  if (rowAt < 0) return view;
  const row = rows[rowAt];

  if (target.catId) {
    const catAt = row.items.findIndex((it) => it.t === "c" && it.id === target.catId);
    if (catAt < 0) return view;
    const cat = row.items[catAt];
    /* A box accepts anything, except another box: nesting containers
       would give a tree where the model holds to a flat arrangement, and
       there is nothing to gain from it but one more depth to walk
       everywhere.
       Decors, on the other hand, do go in: a divider inside a category
       is the subdivision needed when the box grows. */
    if (moved.t === "c") return view;
    const items = insertAt(cat.items, moved, target.overId, target.side);
    const nextItems = [...row.items];
    nextItems[catAt] = { ...cat, items };
    rows = replaceRow(rows, rowAt, { ...row, items: nextItems });
    return withRows(view, shelves, kind, rows);
  }

  rows = replaceRow(rows, rowAt, {
    ...row,
    items: insertAt(row.items, moved, target.overId, target.side),
  });
  return withRows(view, shelves, kind, rows);
}

/* HANGING — the other kind of drop.

   A wall object does not slot in between two neighbours: it has no
   neighbours. It knows only a shelf and a point, and that is why it does
   not go through `moveItem` — the index, the seam, the box, the arrivals
   row, none of that means anything to it. Unhooking it from one shelf to
   hook it onto another stays possible: we take it off every wall before
   laying it on its own.

   `drag`: { id } for a move, { create } for an object coming out of the
   cabinet that does not exist yet. */
export function pinToWall(view, kind, drag, at) {
  const shelves = {};
  let moved = drag.create || null;

  for (const k of SHELF_KINDS) {
    const shelf = view.shelves[k];
    const wall = shelf.wall || [];
    // an object already hung is hung on one wall only: the first found
    const found = moved ? null : wall.find((it) => it.id === drag.id);
    if (!found) {
      shelves[k] = shelf;
      continue;
    }
    moved = found;
    shelves[k] = { ...shelf, wall: wall.filter((it) => it !== found) };
  }
  if (!moved) return view;

  const target = shelves[kind];
  const hung = { ...moved, x: at.x, y: at.y };
  return {
    ...view,
    shelves: { ...shelves, [kind]: { ...target, wall: [...(target.wall || []), hung] } },
  };
}

const replaceRow = (rows, at, row) => {
  const out = [...rows];
  out[at] = row;
  return out;
};

const withRows = (view, shelves, kind, rows) => ({
  ...view,
  shelves: { ...shelves, [kind]: { ...shelves[kind], rows } },
});

/* Insert before/after `overId`, or at the end of the container if there
   is nobody to aim at (a row's empty space, a still-empty category). */
function insertAt(items, item, overId, side) {
  if (!overId) return [...items, item];
  const i = items.findIndex((it) => it.id === overId);
  if (i < 0) return [...items, item];
  const at = side === "after" ? i + 1 : i;
  return [...items.slice(0, at), item, ...items.slice(at)];
}

/* Take an item off a shelf, wherever it is — at the top level or inside
   a category. Returns `null` if the shelf does not contain it. */
function takeItem(shelf, id) {
  for (let r = 0; r < shelf.rows.length; r++) {
    const row = shelf.rows[r];
    const at = row.items.findIndex((it) => it.id === id);
    if (at >= 0) {
      const item = row.items[at];
      const items = [...row.items.slice(0, at), ...row.items.slice(at + 1)];
      return { item, shelf: { ...shelf, rows: replaceRow(shelf.rows, r, { ...row, items }) } };
    }
    for (let c = 0; c < row.items.length; c++) {
      const cat = row.items[c];
      if (cat.t !== "c") continue;
      const sub = cat.items.findIndex((it) => it.id === id);
      if (sub < 0) continue;
      const item = cat.items[sub];
      const catItems = [...cat.items.slice(0, sub), ...cat.items.slice(sub + 1)];
      const items = [...row.items];
      items[c] = { ...cat, items: catItems };
      return { item, shelf: { ...shelf, rows: replaceRow(shelf.rows, r, { ...row, items }) } };
    }
  }
  return null;
}

/* ------------------------------------------------------------
   The furniture: rows, categories, decors
   ------------------------------------------------------------

   All these operations share one rule: a film is never destroyed by a
   filing gesture. Emptying a line, deleting it, undoing a category — the
   cases that were in it fall back into the arrivals row. What really
   gets deleted is the furniture: the line, the box, the trinket. */

const shelfOfRow = (view, rowId) =>
  SHELF_KINDS.find((k) => view.shelves[k].rows.some((r) => r.id === rowId)) || null;

const mapShelf = (view, kind, fn) => ({
  ...view,
  shelves: {
    ...view.shelves,
    [kind]: { ...view.shelves[kind], rows: fn(view.shelves[kind].rows) },
  },
});

/* Give films back to the shelf's arrivals row. */
const toUnplaced = (rows, ids) => {
  if (!ids.length) return rows;
  const at = rows.length - 1;
  const out = [...rows];
  out[at] = { ...out[at], items: [...out[at].items, ...ids.map(filmItem)] };
  return out;
};

/* Every FILM in a row, categories included — and them alone.

   That is what goes to the arrivals row when the piece of furniture
   carrying them is undone. The decors do not go: a trinket is furniture,
   and furniture disappears with the furniture. That was already the fate
   of a decor laid straight on a row being deleted; those that now live
   inside a box follow the same rule. */
const filmsInRow = (row) =>
  row.items.flatMap((it) =>
    it.t === "f"
      ? [it.id]
      : it.t === "c"
        ? it.items.filter((s) => s.t === "f").map((s) => s.id)
        : []
  );

export function patchRow(view, rowId, patch) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  return mapShelf(view, kind, (rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
}

/* Open a line. `where` is "before", "after" or "end" — and "end" means
   before the arrivals row, which always keeps the last word. */
export function addRow(view, kind, refRowId, where = "after") {
  const rows = view.shelves[kind].rows;
  const ref = rows.findIndex((r) => r.id === refRowId);
  const above = ref >= 0 ? rows[ref] : rows[Math.max(0, rows.length - 2)];
  const row = makeRow({ perRow: above && !isUnplaced(above) ? above.perRow : null });
  let at;
  if (where === "end" || ref < 0) at = Math.max(0, rows.length - 1);
  else at = where === "before" ? ref : ref + 1;
  // never after the arrivals row
  at = Math.min(at, rows.length - 1);
  return mapShelf(view, kind, (rs) => [...rs.slice(0, at), row, ...rs.slice(at)]);
}

export function removeRow(view, rowId) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  const row = view.shelves[kind].rows.find((r) => r.id === rowId);
  if (!row || isUnplaced(row)) return view; // the arrivals row cannot be deleted
  return mapShelf(view, kind, (rows) =>
    toUnplaced(
      rows.filter((r) => r.id !== rowId),
      filmsInRow(row)
    )
  );
}

export function clearRow(view, rowId) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  const row = view.shelves[kind].rows.find((r) => r.id === rowId);
  if (!row) return view;
  return mapShelf(view, kind, (rows) =>
    toUnplaced(
      rows.map((r) => (r.id === rowId ? { ...r, items: [] } : r)),
      filmsInRow(row)
    )
  );
}

export function addCat(view, rowId, cat) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  return mapShelf(view, kind, (rows) =>
    rows.map((r) => (r.id === rowId ? { ...r, items: [...r.items, cat] } : r))
  );
}

const findCat = (view, catId) => {
  for (const kind of SHELF_KINDS)
    for (const row of view.shelves[kind].rows)
      for (const it of row.items)
        if (it.t === "c" && it.id === catId) return { kind, row, cat: it };
  return null;
};

export function patchCat(view, catId, patch) {
  const found = findCat(view, catId);
  if (!found) return view;
  return mapShelf(view, found.kind, (rows) =>
    rows.map((r) =>
      r.id !== found.row.id
        ? r
        : { ...r, items: r.items.map((it) => (it.id === catId ? { ...it, ...patch } : it)) }
    )
  );
}

export function removeCat(view, catId) {
  const found = findCat(view, catId);
  if (!found) return view;
  // only films fall back into the airlock; decors go with the box
  const ids = found.cat.items.filter((s) => s.t === "f").map((s) => s.id);
  return mapShelf(view, found.kind, (rows) =>
    toUnplaced(
      rows.map((r) =>
        r.id !== found.row.id ? r : { ...r, items: r.items.filter((it) => it.id !== catId) }
      ),
      ids
    )
  );
}

/* A decor lives at two depths now that it goes into the boxes: laid on
   the board, or filed inside a category. So these two functions share
   the same descent — otherwise retouching a divider slipped into a box
   would find nothing and say nothing.

   `edit` returns the retouched item array, or the SAME array when the
   decor is not in it: that is what lets us know we found it without
   walking through twice. */
const mapDecorIn = (items, id, edit) => {
  const top = edit(items);
  if (top !== items) return top;
  let found = false;
  const out = items.map((it) => {
    if (found || it.t !== "c") return it;
    const sub = edit(it.items);
    if (sub === it.items) return it;
    found = true;
    return { ...it, items: sub };
  });
  return found ? out : items;
};

const withDecor = (view, id, edit) => {
  for (const kind of SHELF_KINDS) {
    /* The wall first: it is a flat array, and the same `edit` works on
       it knowing nothing more. Without this pass, retouching the colour
       of a hung frame found nothing and said nothing. */
    const shelf = view.shelves[kind];
    const wall = shelf.wall || [];
    const hung = edit(wall);
    if (hung !== wall) {
      return {
        ...view,
        shelves: { ...view.shelves, [kind]: { ...shelf, wall: hung } },
      };
    }
    for (const row of view.shelves[kind].rows) {
      const items = mapDecorIn(row.items, id, edit);
      if (items === row.items) continue;
      return mapShelf(view, kind, (rows) =>
        rows.map((r) => (r.id !== row.id ? r : { ...r, items }))
      );
    }
  }
  return view;
};

/* Removing a decor: it is the only object a gesture really deletes,
   because it contains nothing anyone could regret. */
export function removeDecor(view, id) {
  return withDecor(view, id, (items) =>
    items.some((it) => it.t === "d" && it.id === id) ? items.filter((it) => it.id !== id) : items
  );
}

export function patchDecor(view, id, patch) {
  return withDecor(view, id, (items) =>
    items.some((it) => it.t === "d" && it.id === id)
      ? items.map((it) => (it.id === id ? { ...it, ...patch } : it))
      : items
  );
}

/* ------------------------------------------------------------
   Overflow — a full board pushes onto the next
   ------------------------------------------------------------

   A row's count does not FOLD it in on itself: it says how many cases it
   HOLDS. Laying twelve films on a board of five does not make three
   lines under one board — it fills the board, and the rest goes onto the
   one below, cascading. That is what a shelf does, and it was the first
   draft's real flaw: setting a line to five piled the whole shelf into
   an accordion.

   The surplus that reaches the end opens new rows BEFORE the arrivals
   row — that one stays what it is, an airlock, never a shelf. */
export function reflowShelf(view, kind) {
  const rows = view.shelves[kind].rows;
  const out = [];
  let carry = [];
  let lastCap = capFor(kind);
  let changed = false;

  for (const row of rows) {
    if (isUnplaced(row)) {
      // what still overflows takes new boards, not the airlock
      for (const part of carry.length ? chunk(carry, lastCap) : []) {
        out.push(makeRow({ items: part }));
        changed = true;
      }
      carry = [];
      out.push(row);
      continue;
    }
    if (row.perRow) lastCap = row.perRow;
    let items = carry.length ? [...carry, ...row.items] : row.items;
    carry = [];
    if (row.perRow && items.length > row.perRow) {
      carry = items.slice(row.perRow);
      items = items.slice(0, row.perRow);
    }
    if (items === row.items) out.push(row);
    else {
      out.push({ ...row, items });
      changed = true;
    }
  }

  if (!changed) return view;
  return { ...view, shelves: { ...view.shelves, [kind]: { ...view.shelves[kind], rows: out } } };
}

export function reflowView(view) {
  let next = view;
  for (const kind of SHELF_KINDS) next = reflowShelf(next, kind);
  return next;
}

/* Spreading a collection over new boards. Serves a view just created:
   leaving it entirely in the airlock would give an empty shelf and a
   heap, which is not an arrangement.

   ONE row, and no longer packets of ten. A row shows only what it
   CONTAINS: cutting it up by tens meant laying ten cases on a board that
   holds fifteen and leaving a third of the wood bare — a new shelf
   looked half empty on a large screen. So it takes everything, fills the
   width and folds into as many wooden lines as it needs. We cut where we
   want afterwards, by dropping a case on a seam. `cap` stays for whoever
   wants packets of their own choosing. */
export function layoutView(view, films, cap = null) {
  const shelves = {};
  for (const kind of SHELF_KINDS) {
    const ids = films.filter(belongs[kind]).map((f) => f.id);
    const rows = ids.length
      ? chunk(ids, cap).map((part) => makeRow({ perRow: cap, items: part.map(filmItem) }))
      : [makeRow({ perRow: cap })];
    shelves[kind] = { rows: [...rows, makeRow({ kind: "unplaced" })] };
  }
  return { ...view, shelves };
}

/* A film's filmmaker, or the name we give to their absence. The grouped
   wall already uses exactly this label: two places showing the same
   thing must name it the same way. */
export const UNKNOWN_DIRECTOR = "Réalisateur inconnu";

export const directorOf = (film) => film.director?.trim() || UNKNOWN_DIRECTOR;

/* ONE SHELF PER FILMMAKER — one line per director, and on that line a
   box in their name holding their films.

   The box is not a decoration: it is what makes the line workable.
   Laying the films straight on the row with a simple label in the gutter
   would have given the same drawing, but the first drag would have mixed
   two filmmakers with nothing to stand in the way. A box moves full,
   closes, and refuses anything that is not a film — the line keeps its
   meaning on its own.

   The order is the grouped wall's, taken over as it is: the most
   frequented first, then the alphabet, and the nameless last. That is
   where the habits read.

   The result is an ORDINARY view. Nothing marks it, nothing regenerates
   it: once laid down, it is rearranged by hand like the others, and the
   films that arrive later fall into the arrivals row. A view that rebuilt
   itself on every load would erase the user's arrangement, which this
   model refuses everywhere else. */
export function layoutByDirector(view, films, { cap = null } = {}) {
  const shelves = {};
  let colorAt = 0;

  for (const kind of SHELF_KINDS) {
    const n = cap || capFor(kind);

    const by = new Map();
    for (const f of films.filter(belongs[kind])) {
      const key = directorOf(f);
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }

    const rows = [...by.entries()]
      .sort(
        (a, b) =>
          b[1].length - a[1].length ||
          (a[0] === UNKNOWN_DIRECTOR
            ? 1
            : b[0] === UNKNOWN_DIRECTOR
              ? -1
              : a[0].localeCompare(b[0]))
      )
      .map(([name, list]) =>
        makeRow({
          /* No count written: the row takes that of its width, and the
             filmmaker's box cuts itself into as many wooden lines as it
             needs — a filmography of thirty titles thus fits in its
             cardstock instead of running off in an endless band. */
          items: [
            makeCat({
              label: name,
              color: CAT_KEYS[colorAt++ % CAT_KEYS.length],
              items: list.map((f) => filmItem(f.id)),
            }),
          ],
        })
      );

    if (!rows.length) rows.push(makeRow());
    shelves[kind] = { rows: [...rows, makeRow({ kind: "unplaced" })] };
  }

  return { ...view, shelves };
}

/* ------------------------------------------------------------
   Filing — sorting turned into a verb
   ------------------------------------------------------------

   "Sort" was a mode: it fought with the dividers, which had no defined
   place outside the hand-made arrangement. Filing is now a one-off
   gesture: it rewrites the arrangement once, and the arrangement stays.

   The categories and the decors do not move an inch — they are objects
   somebody put there on purpose. Only the films circulate: those at the
   top level redistribute themselves into the slots they already
   occupied, those in a category sort among themselves. */
export function sortIntoRows(view, kind, compare) {
  const shelf = view.shelves[kind];
  const slots = [];
  for (let r = 0; r < shelf.rows.length; r++) {
    if (isUnplaced(shelf.rows[r])) continue;
    const row = shelf.rows[r];
    for (let i = 0; i < row.items.length; i++) if (row.items[i].t === "f") slots.push([r, i]);
  }
  const sorted = slots.map(([r, i]) => shelf.rows[r].items[i]).sort(compare);

  const rows = shelf.rows.map((row) => ({ ...row, items: [...row.items] }));
  slots.forEach(([r, i], n) => {
    rows[r].items[i] = sorted[n];
  });
  /* Inside a box, the same rule as at the top level: the films
     redistribute themselves into the slots they occupied, and what is
     not a film does not move. Sorting the whole array would run the
     comparator — written for films — over dividers, and would slide them
     about at random in the middle of the ranking. */
  for (const row of rows) {
    for (let i = 0; i < row.items.length; i++) {
      const it = row.items[i];
      if (it.t !== "c") continue;
      const at = [];
      for (let s = 0; s < it.items.length; s++) if (it.items[s].t === "f") at.push(s);
      if (!at.length) continue;
      const inner = at.map((s) => it.items[s]).sort(compare);
      const items = [...it.items];
      at.forEach((s, n) => {
        items[s] = inner[n];
      });
      row.items[i] = { ...it, items };
    }
  }
  return { ...view, shelves: { ...view.shelves, [kind]: { ...shelf, rows } } };
}

/* ------------------------------------------------------------
   Migration — l'ancien rangement devient une vue
   ------------------------------------------------------------ */

/* The comparator of the old `shelves` memo, reproduced identically: the
   migration must return exactly what the "by hand" shelf displayed,
   otherwise the user would find their shelf reshuffled. */
const LEGACY_RANK = (o) => (o == null ? Number.MAX_SAFE_INTEGER : o);

export function buildViewsFromLegacy({ films = [], dividers = [], wallPrefs = {}, now = 0 } = {}) {
  const views = [];
  for (const wall of ["watched", "watchlist"]) {
    const pool = films.filter((f) => (f.status === "watchlist") === (wall === "watchlist"));
    /* The old wall set its count for the whole shelf. When it had one,
       that was a CHOICE: we take it as it is, written into the gutter.
       When it was on "auto", we do not invent one for it — rows are born
       auto and fill their width. */
    const legacyPref = (() => {
      const p = wallPrefs[wall]?.perRow;
      return p && p !== "auto" ? p : null;
    })();

    const view = makeView({ wall, name: "Rangement d'origine", theme: "kraft", now });
    let colorAt = 0;

    for (const kind of SHELF_KINDS) {
      const mine = pool.filter(belongs[kind]);
      /* Films never arranged by hand carry `order: null`, which the old
         sort pushed to the end of the shelf. Melting them into the rest
         would have them swallowed by the LAST category migrated, when
         they have never been placed anywhere: they go into the arrivals
         row. */
      const placed = mine.filter((f) => typeof f.order === "number");
      const never = mine.filter((f) => typeof f.order !== "number");

      const tabs = dividers.filter((d) => d.wall === wall && d.shelf === kind);
      const merged = [
        ...placed.map((f) => ({
          type: "film",
          id: f.id,
          order: LEGACY_RANK(f.order),
          tie: -(f.addedAt || 0),
        })),
        ...tabs.map((d) => ({ type: "divider", divider: d, order: LEGACY_RANK(d.order), tie: 0 })),
      ].sort((a, b) => a.order - b.order || a.tie - b.tie);

      const rows = [];
      // the count WRITTEN in the gutter: only if it was meant
      let want = kind === "reserve" ? null : legacyPref;
      let loose = []; // les films libres, en attente de planches
      let cat = null;

      /* We cut up at the count MEANT, and on "auto" we do not cut up: a
         board with no count fills its width and folds into wooden lines,
         and cutting it by tens would leave it half bare. */
      const flushLoose = () => {
        for (const part of chunk(loose, want))
          if (part.length) rows.push(makeRow({ perRow: want, items: part }));
        loose = [];
      };

      for (const it of merged) {
        if (it.type === "divider") {
          /* A divider opened a line and gave it its count: it becomes a
             ROW, and its label the category that takes its head and
             swallows what followed. */
          flushLoose();
          cat = makeCat({
            label: it.divider.label || "Catégorie",
            color: CAT_KEYS[colorAt++ % CAT_KEYS.length],
          });
          want = it.divider.perRow || want;
          rows.push(makeRow({ perRow: want, items: [cat] }));
        } else if (cat) {
          cat.items.push(filmItem(it.id));
        } else {
          loose.push(filmItem(it.id));
        }
      }
      flushLoose();
      /* Films never arranged by hand have no MEANT place, but they do
         have a place: it is the whole collection of anyone who never
         touched the manual arrangement. Pouring them into the arrivals
         airlock made the shelf an empty run and a heap of fifty cases on
         one endless line. So they take boards, like the others. The
         airlock only serves what ARRIVES afterwards. */
      loose = never.map((f) => filmItem(f.id));
      flushLoose();
      if (!rows.length) rows.push(makeRow({ perRow: want }));
      rows.push(makeRow({ kind: "unplaced" }));

      view.shelves[kind] = { rows };
    }
    views.push(view);

    /* A second view, offered from the start: the shelf by filmmaker. It
       comes AFTER the original arrangement, which therefore stays the
       view opened by default — we offer another way of looking, we do
       not impose one. A wall without a single film does not need it: two
       empty shelves to choose between are not a choice. */
    if (pool.length) {
      views.push(
        /* No `cap`: each shelf keeps its own, and the drawer its
           drawer's width. The count inherited from the old wall only
           means anything for the view that reproduces that wall. */
        layoutByDirector(makeView({ wall, name: "Par réalisateur", theme: "kraft", now }), pool)
      );
    }
  }
  return views;
}

/* Cloning a view: new identifiers for everything that is arrangement,
   the same identifiers for the films — they are the same films, filed
   differently. */
export function duplicateView(view, { name, now = 0 } = {}) {
  const shelves = {};
  for (const kind of SHELF_KINDS) {
    shelves[kind] = {
      ...view.shelves[kind],
      rows: view.shelves[kind].rows.map((row) => ({
        ...row,
        id: `r_${uid()}`,
        items: row.items.map((it) =>
          it.t === "f"
            ? it
            : it.t === "c"
              ? {
                  ...it,
                  id: `c_${uid()}`,
                  /* A decor filed in a box is furniture just like one
                     laid on the board: it needs a fresh identifier,
                     otherwise the two views would share the same trinket
                     and removing it on one side would remove it on the
                     other. */
                  items: it.items.map((s) => (s.t === "f" ? { ...s } : { ...s, id: `d_${uid()}` })),
                }
              : { ...it, id: `d_${uid()}` }
        ),
      })),
    };
  }
  return {
    ...view,
    id: `v_${uid()}`,
    name: name || `${view.name} (copie)`,
    createdAt: now,
    updatedAt: now,
    shelves,
  };
}
