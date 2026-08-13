/* A ROW'S LINES OF WOOD.

   A row is not a band that wraps by itself: it is a STACK of lines, and
   every line has its board. Wrapping left to the browser did not know how
   to lay wood under the upper lines — the cases floated there, and a
   somewhat full box grew in height with nothing carrying it.

   So we cut it ourselves, into cells. A cell holds one case. A box is no
   longer an indivisible object that would wrap inside itself: it takes the
   cells left on the line, then CONTINUES on the next line — wood included.
   It is the only place in the file that decides where one goes to the next
   line. */
import { useEffect, useState } from "react";
import { BOX_W, GAP_X } from "./constants";
import { decorSpanOf } from "./items";

/* The cell: a case and its gap to the neighbour. It is this whole file's
   unit — the line holds `cap` of them, and nothing else measures here. */
const CELL = BOX_W + GAP_X;

/* WHAT AN OBJECT COSTS ITS LINE.

   A case is worth one cell, and that was the rule for everybody. It held
   as long as the decors were the size of a case; with the large calibres,
   an XXL object claims two or three cells and only paid for one. The line
   then overflowed its board, and the overflow pushed the PAGE — a
   horizontal scrollbar across the whole shelf for one trinket laid too
   big.

   So the decor pays its width, rounded up to the cell. What no longer fits
   goes to the next line, which is what one wants: a shelf is read top to
   bottom, never left to right. */
const costOf = (it) => (it.t === "d" ? Math.max(1, Math.ceil(decorSpanOf(it) / CELL)) : 1);

/* What we hold when nothing has been measured yet, and what we hold if
   the browser cannot measure. Ten, like the new row. */
export const FALLBACK_CAP = 10;

/* Cuts a row's objects into lines of `cap` cells.

   Returns an array of lines, each line being an array of segments:
   - `{ t:"f"|"d", it, key }` — an object, one cell;
   - `{ t:"c", cat, items, first, last, key }` — the SLICE of a box that
     fits on this line, with what is needed to know whether it carries the
     header (`first`) and whether it stops there (`last`).

   An empty row returns an empty line rather than none: it still has a
   board and a word to say. */
export function splitRow(items, cap) {
  const n = Math.max(1, Math.floor(cap) || 1);
  const lines = [];
  let cur = [];
  let free = n;

  const turn = () => {
    lines.push(cur);
    cur = [];
    free = n;
  };

  for (const it of items || []) {
    if (it.t === "c") {
      const total = it.items.length;
      // an empty box still takes up its cell: it carries the invitation
      if (total === 0) {
        if (free === 0) turn();
        cur.push({ t: "c", cat: it, items: [], first: true, last: true, key: it.id });
        free -= 1;
        continue;
      }
      let at = 0;
      let first = true;
      while (at < total) {
        /* We do not open a slice in a place where the first object
           already does not fit: it is the same guard as at the first
           level, and it is what sends the big decor to the next line
           rather than cramming it into the cell that was left. */
        if (cur.length && free < costOf(it.items[at])) turn();
        /* How much of what the box still holds fits into the cells that
           are left. We used to count OBJECTS; we now count their cost, as
           at the first level — an XXXL decor filed in a box swelled the
           card well beyond its board, and through it the whole page.

           `taken > 0`: a slice always takes at least one object, even if
           on its own it is wider than the line. Without that, a box
           containing an outsized object would never be cut. */
        let taken = 0;
        let used = 0;
        while (at + taken < total) {
          const c = costOf(it.items[at + taken]);
          if (taken > 0 && used + c > free) break;
          used += c;
          taken += 1;
          if (used >= free) break;
        }
        const end = at + taken;
        cur.push({
          t: "c",
          cat: it,
          items: it.items.slice(at, end),
          first,
          last: end >= total,
          key: `${it.id}@${at}`,
        });
        free = Math.max(0, free - used);
        at = end;
        first = false;
      }
      continue;
    }
    const cost = costOf(it);
    /* `cur.length` above all: an object wider than the whole line takes it
       as it is rather than opening an empty line in front of it — without
       which an XXXL decor on a narrow board would go round in circles,
       every new line being too small as well. */
    if (cur.length && free < cost) turn();
    cur.push({ t: it.t, it, key: it.id });
    free = Math.max(0, free - cost);
  }

  if (cur.length || lines.length === 0) lines.push(cur);
  return lines;
}

/* A ROW'S EFFECTIVE COUNT.

   A count set by hand is the count, and we measure nothing. In "auto",
   the count was nothing at all: we let the browser wrap, which is
   precisely what we no longer want. So we measure the row to know how many
   cases fit in it, and "auto" becomes a count like any other — the width's.

   `pad` is what the bands lose to inner padding; we take it off before
   dividing, otherwise the last cell would overflow the board.

   We only write the state when the number CHANGES: a `ResizeObserver`
   speaks at every pixel, and rendering the row at every pixel would make
   the window handle a plane. */
export function useRowCap(ref, perRow, pad = 20) {
  const [measured, setMeasured] = useState(null);

  useEffect(() => {
    if (perRow != null) return undefined;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const read = (w) => {
      /* A width of zero is not a narrow row, it is a row that has not been
         laid out yet — a folded shelf, a background tab. Believing it would
         give one cell per line. */
      if (!(w > 0)) return;
      const fit = Math.max(1, Math.floor((w - pad) / (BOX_W + GAP_X)));
      setMeasured((c) => (c === fit ? c : fit));
    };

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) read(e.contentRect.width);
    });
    ro.observe(el);
    read(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref, perRow, pad]);

  if (perRow != null) return Math.max(1, perRow);
  return measured ?? FALLBACK_CAP;
}
