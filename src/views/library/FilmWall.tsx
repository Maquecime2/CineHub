import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FilmPolaroid } from "../../components/film/FilmPolaroid";
import { DEFAULT_WALL_LOOK, scaleOf, gapOf, type WallLook } from "./wallLook";
import type { Film } from "../../types";

/* The wall of cards.

   It used CSS columns, which fill a column from top to bottom before
   moving to the next: the sorted order became illegible to an eye that
   reads from left to right, to the point of making one believe the sort
   was not working. A grid orders the cards line by line; the vertical
   offset of each card (nudgeOf) is enough to keep the wanted disorder.

   The column width is no longer a number written here: it follows the
   calibre of the cards, otherwise a shrunk card would float in the
   middle of a column that stayed wide. The spacing is adjusted
   separately — two walls of the same calibre may be tight or airy. */

/* ============================================================
   THE WALL ONLY MOUNTS WHAT ONE LOOKS AT
   ============================================================

   Five hundred cards is five hundred polaroids mounted at once: a
   poster, a piece of tape or a pin, stars, a folder number. The first
   render blocked the thread, and every turn of the wheel repainted what
   nobody was looking at.

   WE DO NOT VIRTUALISE THE GRID, AND THAT IS DELIBERATE. The number of
   columns is decided by `auto-fill` — hence by the browser, according to
   the available width — and the heights vary from one card to another
   (the sown offset, the poster's format). Computing rows in JavaScript
   would mean reimplementing the layout in order to guess it, and
   guessing it wrong every other day.

   So we keep the grid as it is, and we empty the CELLS one does not see
   — leaving them exactly the height they had. The layout does not move
   by a pixel, the scrolling never jumps, the scrollbar keeps its size,
   and `WallStudio` goes on seeing the whole wall since every cell is
   there.

   The disorder stays intact: `tiltOf` and `nudgeOf` are sown by the
   film's identifier, never by its render rank — a card that leaves view
   and comes back comes back IDENTICAL. */

/* Enough to mount a good screen height in advance, on each side: we do
   not want to see the cards appear, only to avoid carrying them all. */
const EDGE_MARGIN = "900px";

/* Below this number we do nothing: the observation costs more than it
   brings back, and a wall of forty cards has never struggled. */
const THRESHOLD = 60;

const Cell = memo(function Cell({
  film,
  look,
  onOpen,
  filing,
}: {
  film: Film;
  look: WallLook;
  onOpen: (id: string) => void;
  filing?: Filing;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  /* `null`: the cell is mounted. A number: it is emptied, and that is
     the height it had at the moment it was emptied.

     A STATE AND NOT A REF, because the value is READ DURING THE RENDER —
     it is what gives the emptiness its height. A ref read during a
     render does not tell React it must redraw, and nothing guarantees
     the right one is read: the first draft did it, and the linter was
     right to refuse. */
  const [emptiedAt, setEmptiedAt] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    /* A browser without `IntersectionObserver` keeps the wall from
       before: heavier, but whole. A degradation must never make the
       content vanish. */
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting) setEmptiedAt(null);
        /* We measure BEFORE emptying, while the cell still has its
           content — afterwards there would be nothing left to
           measure. */
        else setEmptiedAt(el.getBoundingClientRect().height || 1);
      },
      { rootMargin: EDGE_MARGIN }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={emptiedAt == null ? undefined : { height: emptiedAt }}>
      {emptiedAt == null && <Card film={film} look={look} onOpen={onOpen} filing={filing} />}
    </div>
  );
});

/* ------------------------------------------------------------
   FILING, SEEN FROM THE WALL
   ------------------------------------------------------------
   Everything the wall needs to know about it travels as ONE object, and
   not as six props threaded through `Cell`: the wall does not decide any
   of this, it only passes it on. */
export interface Filing {
  /** Which card's badge is open, if any. */
  openFor: string | null;
  /** The rectangle is the badge's, in screen coordinates: the panel is
      rendered once, in a layer, and placed from it. */
  onOpenFor: (id: string | null, at?: DOMRect) => void;
  label: string;
  /** Choosing several: the card wears a mark and the click chooses. */
  selecting: boolean;
  chosen: ReadonlySet<string>;
  onChoose: (id: string) => void;
}

/* MEMOISED, and its two handlers HELD.

   `FilmPolaroid` is memoised too, and that is worth nothing if what one
   hands it is rebuilt at every render. Written inline, `onClick` and
   `onFile` were new functions on every pass — so every letter typed in
   the search redrew all the mounted cards. The chain only holds end to
   end: `films` keeps its objects, `Filing` is memoised in
   `useWallFiling`, `onOpen` is held in `App`, and these two here. */
const Card = memo(function Card({
  film,
  look,
  onOpen,
  filing,
}: {
  film: Film;
  look: WallLook;
  onOpen: (id: string) => void;
  filing?: Filing;
}) {
  const id = film.id;
  const open = filing?.openFor === id;
  const selecting = filing?.selecting ?? false;
  const onChoose = filing?.onChoose;
  const onOpenFor = filing?.onOpenFor;

  /* WHILE CHOOSING, A CARD NO LONGER OPENS — it is picked. Keeping both
     on the same click would make every choice a coin toss between
     choosing and leaving the wall. */
  const click = useCallback(
    () => (selecting && onChoose ? onChoose(id) : onOpen(id)),
    [selecting, onChoose, onOpen, id]
  );
  const file = useCallback(
    (at: DOMRect) => onOpenFor?.(open ? null : id, at),
    [onOpenFor, open, id]
  );

  if (!filing) return <FilmPolaroid film={film} look={look} onClick={click} />;

  return (
    <FilmPolaroid
      film={film}
      look={look}
      onClick={click}
      onFile={file}
      fileLabel={filing.label}
      fileOpen={open}
      selecting={filing.selecting}
      selected={filing.chosen.has(film.id)}
    />
  );
});

export function FilmWall({
  films,
  onOpen,
  look = DEFAULT_WALL_LOOK,
  filing,
}: {
  films: Film[];
  onOpen: (id: string) => void;
  look?: WallLook;
  filing?: Filing;
}) {
  const gap = gapOf(look);
  const windowed = films.length >= THRESHOLD;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(210 * scaleOf(look))}px, 1fr))`,
        gap: `0 ${gap}px`,
        alignItems: "start",
      }}
    >
      {films.map((f) =>
        windowed ? (
          <Cell key={f.id} film={f} look={look} onOpen={onOpen} filing={filing} />
        ) : (
          <Card key={f.id} film={f} look={look} onOpen={onOpen} filing={filing} />
        )
      )}
    </div>
  );
}
