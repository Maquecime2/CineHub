/* The objects one lays on a board: the drop marker, the case, the decor
   and the category. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calque } from "../ui/Calque";
import { C, F, alpha } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { tiltOf } from "../../domain/seeded";
import { watchCount, initialsOf } from "../../domain/film";
import { PosterArt } from "../film/PosterArt";
import { PushPin } from "../atmosphere";
import { Palette } from "lucide-react";
import {
  BOX_W,
  BOX_H,
  GAP_X,
  GAP_Y,
  MARK_W,
  MARK_H,
  DROP_MARK_STYLE,
  MARK_PATHS,
  MARK_INK,
  decorSpec,
  WALL_GRIP,
  wallBoxOf,
  catInk,
} from "./constants";

/* THE IMAGE ONE CARRIES UNDER THE CURSOR.

   The browser makes a drag's preview all by itself, by photographing the
   grabbed element. But the case lives in a wrapper in
   `content-visibility: auto`: the photo taken in there overflows the
   element and returns a whole band — one thinks one is dragging the row
   when one is only moving a single film.

   So we give it the photo to take away: a COPY of the case, laid off
   screen for the time of the shot, without the tilt or the transparency
   that the drag applies to it elsewhere. It is grabbed at exactly the
   place the hand took it, so that nothing jumps at the start.

   The copy is erased on the next turn of the loop: the shot is taken
   during `dragstart`, removing it earlier would leave nothing to
   photograph. We go through a timeout rather than an animation frame,
   because a frame does not come when the page is not compositing — and
   the copy would then stay in the document. */
export const carryGhost = (e, node) => {
  const r = node.getBoundingClientRect();
  const ghost = node.cloneNode(true);
  ghost.style.position = "fixed";
  ghost.style.top = "0px";
  ghost.style.left = "-10000px";
  ghost.style.margin = "0";
  ghost.style.opacity = "1";
  ghost.style.transform = "none";
  ghost.style.contentVisibility = "visible";
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, e.clientX - r.left, e.clientY - r.top);
  setTimeout(() => ghost.remove(), 0);
};

/* THE DROP MARKER RENDERS INTO THE DOCUMENT BODY, AND IT MUST.

   It is placed in SCREEN coordinates, computed at every hover from the
   cases' rectangles. Rendered inside the view column, it inherited the
   containing block that `[data-enters]` makes during its animation: the
   same coordinates then designated another point, and the marker settled
   beside the slot aimed at — at the precise moment one drags, that is to
   say just after changing tab. */
export const DropMark = React.forwardRef(function DropMark(_props, ref) {
  return (
    <Calque>
      <div ref={ref} data-drop-mark aria-hidden style={DROP_MARK_STYLE}>
        <svg
          width={MARK_W}
          height={MARK_H}
          viewBox={`0 0 ${MARK_W} ${MARK_H}`}
          fill="none"
          style={{ display: "block" }}
        >
          {/* the shadow first, as a single offset group: it cannot be
            derived from the stroke since it reuses the same paths */}
          <g transform="translate(1.2 1.4)" opacity="0.18">
            {MARK_PATHS.map((p) => (
              <path key={p.d} d={p.d} stroke={C.ink} strokeWidth={p.w + 0.8} {...MARK_INK} />
            ))}
          </g>
          {MARK_PATHS.map((p) => (
            <path key={p.d} d={p.d} stroke={C.burgundy} strokeWidth={p.w} {...MARK_INK} />
          ))}
        </svg>
      </div>
    </Calque>
  );
});

/* A case seen edge-on: the spine carries the title, the face the poster.

   Memoised, and that is not a comfort optimisation: `dragover` fires
   several dozen events per second for the whole drag. Without it, every
   event rebuilds all the shelf's cases — and a shelf of a hundred films
   crawls. The functions received are therefore stable, and `kind` travels
   as a prop rather than in a closure.

   The case NO LONGER knows the drop marker: during a drag it receives no
   prop that changes, so React never touches it. The marker is a single
   element moved by hand, outside React. */
export const FilmBox = React.memo(function FilmBox({
  film,
  ctx,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  dim,
}) {
  const [hover, setHover] = useState(false);
  /* OPENING A CASE DESPITE THE DRAG AND DROP.

     `onClick` is not enough on a `draggable` element, and it is the
     browser that decides: as soon as the pointer moves two or three
     pixels between the press and the release, it considers a drag to have
     begun and NEVER EMITS the click. On a case of ninety-six pixels aimed
     at with a mouse, that tremor is the rule rather than the exception —
     hence a shelf that only opened one time in two, without any error
     showing.

     So we open on the pointer's RELEASE, judging for ourselves what a
     click is: no drag begun, and fewer than five pixels travelled. The
     threshold is the same as in the constellation, so that the gesture
     has the same tolerance everywhere.

     `onClick` stays, but for the KEYBOARD only. Enter and Space on a
     button emit a click whose `detail` is zero — no pointer produced it.
     It is the only way to keep the shelf accessible without opening twice
     with the mouse. */
  const pressAt = useRef(null);
  const dragged = useRef(false);
  const hue = hueOf(film.id);
  const initials = initialsOf(film.title);
  /* THE RATING ON THE EDGE.

     We counted the full stars and the hollow ones with two `repeat`s. But
     `repeat` truncates: a rating of 3.5 returned three full and ONE
     hollow — the half vanished, and the film appeared to be rated out of
     four. Even when right, two glyphs that differ only by their fill can
     no longer be told apart at ten pixels high.

     So we stack the same five stars twice: the unlit underneath, the lit
     over them, cut clean at the rating's fraction. The half is then a
     half-painted star — the only reading that does not require
     counting. */
  const fill = `${Math.min(Math.max(film.rating || 0, 0), 5) * 20}%`;
  /* The count is DERIVED from the card, it does not arrive as a prop:
     `FilmBox` is memoised because `dragover` replays it dozens of times a
     second, and a prop recomputed at every render would cancel the
     memoisation for the whole row. */
  const vus = watchCount(film);

  return (
    <div
      /* The wrapper carries the object's identity AND its drop zone: the
         drag code always walks up to here, so it can read what it is
         aiming at without our passing it back in a closure. */
      data-shelf-item={film.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        flexShrink: 0,
        /* A shelf of a hundred films means a hundred posters to lay out
           and paint when one sees only twenty of them.
           `content-visibility` tells the browser to compute nothing for
           what is off screen; the announced size being exactly a case's,
           the layout stays right and nothing jumps when scrolling. */
        contentVisibility: "auto",
        containIntrinsicSize: `${BOX_W + GAP_X}px ${BOX_H + GAP_Y}px`,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* The layer that tips when the neighbour parts. It is UNDER the
          wrapper and not merged with it: the wrapper is the drop target,
          and a target that slips away under the cursor makes the gesture
          oscillate instead of accompanying it.

          The only style the drag writes here is a `transform`; the
          transition and the pivot are declared once and for all, so that
          the parting animates without anybody having to touch the rest.
          The case tips on its foot, as on hover, and the curve barely
          overshoots before settling: a card one pushes aside always comes
          back by a hair — but softly, not with a snap.

          It is distinct from the case itself because React ALREADY holds
          the case's `transform`, for the hover tip: two hands on the same
          property, and one erases the other's work. */}
      <div
        data-lean
        style={{
          display: "flex",
          alignItems: "flex-end",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
        }}
      >
        <button
          draggable
          onDragStart={(e) => {
            dragged.current = true;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", film.id);
            carryGhost(e, e.currentTarget);
            onDragStart("film", film.id, e.currentTarget);
          }}
          onDragEnd={(e) => {
            dragged.current = false;
            onDragEnd(e);
          }}
          onPointerDown={(e) => {
            dragged.current = false;
            pressAt.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = pressAt.current;
            pressAt.current = null;
            if (!s || dragged.current) return;
            if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 5) return; // c'était un glissé
            onOpen(film.id);
          }}
          // keyboard only: a mouse click has already been handled on release
          onClick={(e) => {
            if (e.detail === 0) onOpen(film.id);
          }}
          title={`${film.title}${film.year ? ` (${film.year})` : ""}`}
          style={{
            all: "unset",
            boxSizing: "border-box",
            cursor: "pointer",
            position: "relative",
            /* `draggable` does not set a flag: it applies
               `-webkit-user-drag: element`, a plain style declaration —
               which `all: unset` erases like the rest. So the case was not
               grabbable; what one dragged was the poster, which the
               browser makes grabbable by itself, and the event bubbled up
               to here. With no poster, nothing left to grab: the shelf
               became immobile. So we restore what `all: unset` took
               away. */
            WebkitUserDrag: "element",
            // and the initials' text must not be selected when dragging
            userSelect: "none",
            WebkitUserSelect: "none",
            width: BOX_W,
            height: BOX_H,
            marginBottom: GAP_Y,
            marginRight: GAP_X,
            flexShrink: 0,
            borderRadius: "2px 3px 3px 2px",
            overflow: "hidden",
            // what repaints inside a case concerns only that case
            contain: "layout paint style",
            /* The hairline and the shadow are the skin's INK, and no
               longer the notebook's brown written by hand: on a night
               background, a brown-black stroke against a pale edge drew a
               dirty border instead of settling the case. */
            border: `1px solid ${alpha(C.ink, 0.35)}`,
            boxShadow: hover
              ? `3px 5px 10px ${alpha(C.ink, 0.34)}`
              : `2px 2px 0 ${alpha(C.ink, 0.16)}`,
            transform: hover ? "translateY(-7px) rotate(-1.2deg)" : "none",
            transformOrigin: "bottom center",
            /* `dim`: searching, on the shelf, no longer sorts the shelf —
               it dims what it does not find. Filtering would dismantle the
               arrangement at every letter typed. */
            opacity: dim ? 0.26 : film.archived ? 0.62 : 1,
            filter: dim ? "saturate(0.35)" : film.archived ? "saturate(0.5)" : "none",
            transition:
              "transform .18s ease, box-shadow .18s ease, opacity .15s ease, filter .15s ease",
          }}
        >
          <PosterArt film={film} height={BOX_H} initials={initials} plain />
          {/* The spine: it is what makes one read "case" and not
              "thumbnail". It NO LONGER carries the title.

              We wrote it vertically, in eight pixels, on eleven pixels of
              width: the only way to fit a long title in, and a way never
              to read it. A title one must tilt one's head to decipher,
              and which is cut off at a third, informs nobody — it dirties
              a band of colour which, for its part, was doing its job very
              well. The name is read in the case's tooltip, with the year,
              and in full. */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 11,
              background: hue,
              boxShadow: `inset -2px 0 4px ${alpha(C.ink, 0.4)}`,
              zIndex: 2,
            }}
          />
          {film.year !== "" && film.year != null && (
            <span
              style={{
                position: "absolute",
                top: 4,
                left: 15,
                // the label is the skin's paper, not kraft written by hand
                background: alpha(C.card, 0.88),
                color: C.ink,
                fontFamily: F.mono,
                fontSize: 9,
                padding: "1px 4px",
                zIndex: 3,
              }}
            >
              {film.year}
            </span>
          )}
          {film.bedside && <PushPin style={{ top: -5, right: -5, zIndex: 4 }} />}
          {film.status !== "watchlist" && (
            <span
              style={{
                position: "absolute",
                bottom: 0,
                left: 11,
                right: 0,
                padding: "3px 5px",
                /* The stars' band: a strip of the skin's ink, and the
                   stars in its paper. The hand-written brown-black it
                   carried laid, under a night skin, a dark bar on a pale
                   shelf — and the white stars on it ended up not showing
                   at all. */
                background: alpha(C.ink, 0.78),
                color: C.card,
                fontFamily: F.mono,
                fontSize: 9.5,
                letterSpacing: 1,
                zIndex: 3,
                /* The stars on the left, the screening count on the
                   right: the band does not grow, it shares itself out. */
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 4,
              }}
            >
              <span
                aria-label={`${film.rating || 0} sur 5`}
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontSize: 11,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: alpha(C.card, 0.32) }}>★★★★★</span>
                {/* The lit layer sits exactly over the unlit one: same
                    text, same tracking, so the two rows overlap to the
                    pixel and the cut falls where it should. */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: fill,
                    overflow: "hidden",
                    color: C.card,
                  }}
                >
                  ★★★★★
                </span>
              </span>
              {/* THE SCREENING COUNT, and only from two. A "×1" on every
                  edge would be noise across the whole library, and would
                  teach nobody anything: what one looks for is the films
                  one rewatches. */}
              {vus > 1 && (
                <span
                  aria-label={`vu ${vus} fois`}
                  style={{ fontSize: 9, letterSpacing: 0, opacity: 0.85, flexShrink: 0 }}
                >
                  ×{vus}
                </span>
              )}
            </span>
          )}
        </button>
      </div>
    </div>
  );
});

/* THE TILT OF AN UPRIGHT CARD.

   A planted card does not lie askew like a trinket set down: it LEANS.
   That is what distinguishes it from a printer's partition, and it is
   also what makes it read as cardstock rather than as a line drawn with a
   ruler.

   Two reasons not to give it the other decors' full lopsidedness. The
   first is its height: ±4.5° over forty-six pixels goes unnoticed, but
   over a hundred and forty-four the top travels eleven pixels from its
   foot and the card looks about to fall. The second is that it separates:
   what separates must stay readable as a vertical, otherwise the whole
   row seems lopsided.

   But half the lopsidedness was not enough either, because the randomness
   is SOWN: `tiltOf` can return a value near zero, and that particular card
   stood perfectly straight — which is what one could see. So we keep the
   variation, which gives each card its own hand, but we push it away from
   zero: at least one degree and two tenths, never more than two and two.
   The top drifts by three to six pixels — enough that one sees it
   leaning, too little that one believes it slipping.

   Both bounds hold to one decimal, like the angle we write: a bound finer
   than the rounding would be crossed by the rounding itself, and would
   therefore bound nothing.

   It pivots on its foot (`transformOrigin: bottom center`, below), like a
   real card wedged against the neighbouring edges. */
const LEAN_MIN = 1.2,
  LEAN_MAX = 2.2;

/* THE CARD, REWORKED SO THAT IT IS SEEN.

   It carried the box's paper: the same kraft, the same hairline, a
   three-pixel border of colour on its head. That was right — it is indeed
   the same archive card — but among twelve cases of the same paper, what
   separates had exactly the colour of what it separates, and one only
   found it by looking for it. Yet a divider serves no purpose other than
   being seen from the end of the row.

   Three changes, and all go the same way: giving the card back its
   COLOUR instead of reducing it to a border.

   1. THE TAB. A real file card does not signal itself by its edge, but by
      the coloured tab that sticks out at the head. So the three pixels of
      border become a real full head, pierced with its eyelet — the
      binder hole, which is what makes one read "file card" and not
      "vertical stroke".
   2. THE BODY. A wash of the same ink rather than the common kraft: pale
      enough to write on in dark ink, tinted enough that it no longer
      merges with the neighbouring edges.
   3. THE WIDTH. Twenty-six pixels was an edge's width; the card takes
      thirty, because a separator with the same set as what it separates
      separates nothing.

   The name, for its part, does not move: it is still read vertically,
   bottom to top, and starts under the tab — writing in the head would
   amount to writing on the tab, which is precisely the part one looks
   at. */
export const DIVIDER_W = 30,
  DIVIDER_HEAD = 18;

/* The square of a laid decor, at calibre M. It was hand-written in two
   places, one of which served only to measure: two figures that must stay
   equal and that nothing obliged to be. */
export const DECOR_BOX = 46;

/* The card and its mock-up in the cabinet must look alike enough that
   one recognises in the row what one pulled from the panel: so both read
   their styling here. */
/* THE WASH WAS DEEPENED. At thirteen per cent of ink, the card was a
   veil: what separates must be seen from afar, otherwise the row has no
   cuts left, only a shade. So we go up to a good quarter, and the
   hairline to three quarters — enough to hold its edge against twelve
   edges of kraft, not enough to become a flat fill that would steal the
   show from the cases.

   The opacity is written with `alpha` and no longer by gluing `22` behind
   the colour: the tint stays a hexadecimal today, but the drop shadow
   must follow the skin — and `color-mix` takes both. */
/* THE CARD IS OPAQUE. The wash stays a wash — a quarter of ink, not a
   flat fill — but it now rests on cardstock, and not on the void: with no
   background underneath, the wall showed through the divider, and its
   patterns crossed what is supposed to cut the row. */
export const dividerSkin = (ink) => ({
  backgroundColor: C.card,
  backgroundImage: `linear-gradient(160deg, ${alpha(ink, 0.26)}, ${alpha(ink, 0.44)})`,
  border: `1px solid ${alpha(ink, 0.75)}`,
  borderBottom: "none",
  borderRadius: "3px 3px 0 0",
  boxShadow: `2px 2px 0 ${alpha(C.ink, 0.2)}`,
});

/* The tab: the solid head, and the eyelet inside it. */
export const DividerHead = ({ ink, height }) => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height,
      background: ink,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // the card is a little paler just under the head, like a fold
      boxShadow: `0 1px 0 ${alpha(C.card, 0.45)}`,
    }}
  >
    <span
      style={{
        width: Math.max(3, Math.round(height * 0.32)),
        height: Math.max(3, Math.round(height * 0.32)),
        borderRadius: "50%",
        background: C.paper,
        opacity: 0.85,
      }}
    />
  </div>
);

export const leanOf = (id) => {
  const t = Number(tiltOf(id)) / 2;
  const side = t < 0 ? -1 : 1;
  return (side * Math.min(Math.max(Math.abs(t), LEAN_MIN), LEAN_MAX)).toFixed(1);
};

/* AN OBJECT'S ANGLE — the one that was set, otherwise the sown random
   one.

   The lopsidedness comes from the identifier: it is what makes a shelf
   look like a shelf and not like a catalogue plate, and there is nothing
   to set as long as one does not want to. But a frame one wants straight,
   an ivy hanging on the wrong side, an imported image lying on its side:
   at some point the hand must be able to pass in front of chance.

   `??` and not `||`: zero degrees is an answer, and the most requested of
   all — it is "put it back upright". */
export const angleOf = (item, tall = false) =>
  item.rot ?? (tall ? leanOf(item.id) : tiltOf(item.id));

/* THE ROOM A TURNED OBJECT TAKES — AND WHERE IT FALLS.

   First attempt: the bounding box's width, |W·cos θ| + |H·sin θ|, given to
   the wrapper. The arithmetic was right, and yet the cases pressed
   against the card stayed underneath.

   Because an object does not turn on its middle: it pivots on its FOOT
   (`transformOrigin: bottom center`), like a card wedged against the
   neighbouring edges. The bounding box does have the width we computed,
   but it is no longer centred on the object — it starts from the side the
   head leans towards. The wrapper, for its part, dutifully centred the
   card inside it: at the bottom all was well, at the top the card came
   out of the room it had claimed and covered its neighbour. The height
   had the same defect, worse: the bottom corner passed UNDER the board.

   So we measure the four corners after rotation about the foot, and
   return two things — the box's size, and the offset that puts it back
   astride the wrapper. The object is then translated by as much: what one
   sees occupies exactly what was reserved, from foot to head. */
export const rotatedBox = (w, h, deg) => {
  const r = (Number(deg) * Math.PI) / 180;
  const cos = Math.cos(r),
    sin = Math.sin(r);
  /* The corners, counted from the pivot: the foot at ordinate 0, the head
     at −h (the y axis goes down, on screen as in CSS). */
  const xs = [],
    ys = [];
  for (const x of [-w / 2, w / 2])
    for (const y of [0, -h]) {
      xs.push(x * cos - y * sin);
      ys.push(x * sin + y * cos);
    }
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  return {
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
    /* The box is aligned on the wrapper's LEFT EDGE, and not on its
       middle. The wrapper is worth the box plus the gap to the neighbour,
       and that gap belongs entirely to the right — it is a `marginRight`
       we moved house, not a margin to share. Centred, it was cut in two
       and the card found itself with six pixels too many on its left: a
       hole nothing justified, since on that side there is no gap to hold.

       So we aim the box's foot at abscissa zero: the card is laid to the
       left of the wrapper, its pivot is at `w/2`, and the box's leftmost
       corner fell at `minX` from that pivot. */
    // `|| 0`: `Math.round` returns a NEGATIVE zero, which would be written "-0px"
    dx: Math.round(-(w / 2 + minX)) || 0,
    dy: Math.round(-maxY) || 0,
  };
};

/* THE WIDTH A DECOR CLAIMS IN ITS ROW, gap to the neighbour included —
   exactly what `DecorItem` lays on its wrapper.

   It is here, and not recomputed by the splitting into lines, because
   there is only one possible place for a measurement: the one that draws
   it. The day the angle, the calibre or the card's set changes, the line
   will follow without anyone thinking about it.

   A case is worth one cell, a decor is worth as many as it occupies: that
   is all `splitRow` needs to know so as to stop letting an XXL object
   overflow its board. */
export const decorSpanOf = (item) => {
  const spec = decorSpec(item.motif);
  if (!spec) return 0;
  const s = item.size || 1;
  const w = Math.round((spec.tall ? DIVIDER_W : DECOR_BOX) * s);
  const h = Math.round((spec.tall ? BOX_H : DECOR_BOX) * s);
  return rotatedBox(w, h, angleOf(item, spec.tall)).width + GAP_X;
};

/* A decor laid on the board: it is dragged, moved and taken away like a
   case, but says nothing of a film. Six of the patterns are the decors
   the house already draws elsewhere; the rest comes from lucide. */
export const DecorItem = React.memo(function DecorItem({
  item,
  ctx,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  onEdit,
  onLabel,
}) {
  const spec = decorSpec(item.motif);
  const [writing, setWriting] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState(item.label || "");
  useEffect(() => {
    setDraft(item.label || "");
  }, [item.label]);

  const ink = catInk(item.color);
  const s = item.size || 1;
  const box = Math.round(DECOR_BOX * s);
  if (!spec) return null;
  const Draw = spec.draw;

  /* THE CARD'S TAB — the head height one sees from afar.
     See the long passage on the rework, below. */
  const head = Math.round(DIVIDER_HEAD * s);

  /* A card is named ON the card. The panel already knew how to do it, but
     one had to open it to discover it — and a blank card does not say it
     is waiting for a name. It is the category's gesture, whose tab one
     writes where one reads it; the palette stays beside, for what is not
     text. */
  /* NAMING STAYS AN OFFER, NOT A COMPULSORY STEP.

     The card wrote on itself: a click opened the field, and a blank card
     showed "name" in italics. That was right for whoever came to lay a
     category, and tiresome for everybody else — many dividers serve only
     to mark a cut, and have nothing to say. The click then fell into a
     field one had to get out of, and the colour or the size hid behind an
     icon one only found on hover.

     So we keep the gesture, but reserve it for the cards that HAVE a
     name: that one is written where one reads it. A blank card, for its
     part, opens its panel like any other object — and the panel already
     carries a NAME field for whoever wants to give it one. */
  const writes = !!spec.writes && !!onLabel && !!item.label;
  const commit = () => {
    setWriting(false);
    const v = draft.trim();
    if (v !== (item.label || "")) onLabel(item.id, v);
  };
  const w = spec.tall ? Math.round(DIVIDER_W * s) : box;
  const h = spec.tall ? Math.round(BOX_H * s) : box;
  const angle = angleOf(item, spec.tall);
  const frame = rotatedBox(w, h, angle);

  return (
    <div
      data-shelf-item={item.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        flexShrink: 0,
        /* The room claimed in the row follows the angle, in width as in
           height: see `rotatedBox`. A leaning head sticks out over the
           wood, and it is the row that must notice. */
        width: frame.width + GAP_X,
        height: frame.height + GAP_Y,
      }}
    >
      {/* the layer that tips at the parting, under the drop target */}
      <div
        data-lean
        style={{
          display: "flex",
          alignItems: "flex-end",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
        }}
      >
        <div
          /* A card one is in the middle of writing is not dragged: an
             ancestor's `draggable` swallows the text selection and the
             double click in the field triggers a drag. */
          draggable={!writing}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart("decor", item.id, e.currentTarget);
          }}
          onDragEnd={onDragEnd}
          onClick={() => (writes ? setWriting(true) : onEdit(item.id))}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title={
            writes
              ? item.label || "Cliquez pour nommer cet intercalaire"
              : spec.writes && item.label
                ? item.label
                : spec.label
          }
          style={{
            position: "relative",
            width: w,
            height: h,
            /* The card's foot rests on the board, never below it: `dy`
               makes up for what the rotation sent down. */
            marginBottom: GAP_Y,
            /* The gap to the neighbour is passed to the wrapper, with the
               room the angle claims: leaving it here would add it a second
               time, and a turned object would drift to the right. */
            flexShrink: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transform: `translate(${frame.dx}px, ${frame.dy}px) rotate(${angle}deg)`,
            transformOrigin: "bottom center",
            userSelect: "none",
            WebkitUserSelect: "none",
            // the card itself: its own ink, head included
            ...(spec.tall ? dividerSkin(ink) : null),
          }}
        >
          {spec.tall && <DividerHead ink={ink} height={head} />}

          {spec.tall ? (
            /* The name is read vertically, bottom to top: that is how one
               reads an edge in an archive box, and the only way to write
               long over twenty-six pixels of width. The field takes back
               exactly the same writing, so that one does not feel the text
               jumps place when one starts writing it. */
            writing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(item.label || "");
                    setWriting(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Nom de l'intercalaire"
                style={{
                  all: "unset",
                  boxSizing: "border-box",
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontFamily: F.mono,
                  fontSize: Math.max(8, Math.round(10 * s)),
                  letterSpacing: "0.08em",
                  color: C.ink,
                  /* The field begins UNDER the tab: writing in the head
                     would amount to writing on the coloured tab, which is
                     precisely what one looks at from afar. */
                  height: `calc(100% - ${head}px)`,
                  marginTop: head,
                  padding: "6px 0",
                  // the field's hairline runs along the edge, like a pencil stroke
                  borderLeft: `1px solid ${ink}`,
                }}
              />
            ) : (
              <span
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontFamily: F.mono,
                  fontSize: Math.max(8, Math.round(10 * s)),
                  letterSpacing: "0.08em",
                  /* The name goes to dark ink: on a body now tinted with
                     its own colour, writing it in that same colour made it
                     unreadable. */
                  color: C.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxHeight: `calc(100% - ${head}px)`,
                  marginTop: head,
                  padding: "6px 0",
                }}
              >
                {/* A blank card stays blank: it separates, and separating
                    does very well without a word. */}
                {item.label}
              </span>
            )
          ) : (
            <Draw color={ink} style={{ width: "100%", height: "100%" }} />
          )}

          {/* The palette stays reachable: writing takes the click, but
              the colour, the size and the inset are elsewhere. At the foot
              of the card, and only on hover — it is the gesture of a
              category's tab, which carries the same button beside its
              name. */}
          {writes && !writing && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item.id);
              }}
              title="Couleur, taille, retrait"
              aria-label={`Réglages de « ${item.label || "sans nom"} »`}
              style={{
                all: "unset",
                cursor: "pointer",
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 2,
                display: "flex",
                justifyContent: "center",
                color: ink,
                // it answers the CARD's hover: on its own, it would stay unfindable
                opacity: hover ? 0.75 : 0,
                transition: "opacity .15s ease",
              }}
            >
              <Palette size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/* The bounding box of a HANGING object. It pivots on its middle and not
   on its foot — nothing carries it, it hangs — hence a `rotatedBox` of a
   box half as tall, recentred: the offsets cancel out and only the size
   remains. It is the size the cell claims, and it too that clamps the
   drop to the shelf's edge. */
export const rotatedBoxOfWall = (item) => {
  const b = wallBoxOf(item.size);
  const { width, height } = rotatedBox(b, b, angleOf(item));
  return { width, height };
};

/* A HANGING OBJECT — it rests on nothing, but it can cast a shadow.

   The laid decor lives in its row's flow: it takes a place between two
   cases, and the parting pushes it like the others. This one is pinned to
   the back of the shelf, at a point chosen by letting it go. So it has
   neither wrapper, nor gap, nor drop zone — nothing is filed beside it.

   Unless it ASKS for it. A frame at the back of a full shelf disappears
   behind the edges, and there was nothing to do but move it where room
   was left. The checkbox in its panel gives it a footprint: the cases of
   the line it covers part to let it be seen. It is a choice per object,
   and by default it disturbs nobody — most pins do not have to push back
   a collection.

   It is painted BEFORE the rows and without a `z-index`: the cases,
   further on in the document, pass in front. That is what puts it at the
   back rather than on top, and it is also what one expects of a frame
   hung behind a shelf. */
export const WallItem = React.memo(function WallItem({ item, onDragStart, onDragEnd, onEdit }) {
  const spec = decorSpec(item.motif);
  if (!spec) return null;
  const ink = catInk(item.color);
  // the drawing, plus the grip margin that goes round it
  const box = wallBoxOf(item.size);
  const frame = rotatedBoxOfWall(item);
  const Draw = spec.draw;
  return (
    <div
      data-wall-item
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        /* WHERE was it picked up? Without this measurement, the object
           recentres itself under the cursor at the drop: one grabs it by a
           corner, lets it go where one thinks one sees it, and it jumps by
           half a width. So we keep the gap between the grab point and the
           centre, to deduct it on arrival. */
        const r = e.currentTarget.getBoundingClientRect();
        /* THIS ONE, WE ARE HOLDING.

           For the length of a gesture, hanging objects stop receiving the
           cursor: that is what allows them to overflow their shelf without
           stealing the neighbouring shelf's drops (see `tokens.ts`). But
           the rule also caught the object one had just grabbed, and a drag
           whose source stops being hit-testable on hover is a drag the
           browser cancels: once laid, a flying object could not be picked
           up again.

           So it marks itself as the one being held, and the rule spares
           it. The mark is written by hand on the node, like everything
           that moves during a drag — a React state here would re-render
           the shelf at the worst moment. */
        e.currentTarget.dataset.dragSelf = "1";
        onDragStart("wall", item.id, e.currentTarget, {
          dx: e.clientX - (r.left + r.width / 2),
          dy: e.clientY - (r.top + r.height / 2),
        });
      }}
      onDragEnd={(e) => {
        delete e.currentTarget.dataset.dragSelf;
        onDragEnd(e);
      }}
      onClick={() => onEdit(item.id)}
      title={spec.label}
      style={{
        position: "absolute",
        left: `${item.x}%`,
        top: `${item.y}%`,
        /* THE GRIP FOLLOWS THE ANGLE. It used to be the size of the
           drawing UPRIGHT, and the rotation, which does not move the
           layout, let everything outside that square stick out: a pennant
           lying down was seen along its whole length but could only be
           caught in the middle, and the rest let the cursor through to the
           cases. */
        width: frame.width,
        height: frame.height,
        marginLeft: -frame.width / 2,
        marginTop: -frame.height / 2,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        // the wall layer only lets the cursor through on its objects
        pointerEvents: "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          width: box,
          height: box,
          padding: WALL_GRIP,
          boxSizing: "border-box",
          // hung askew, like everything one hangs — unless it has been straightened
          transform: `rotate(${angleOf(item)}deg)`,
        }}
      >
        <Draw color={ink} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
});

/* THE CATEGORY — a box, and no longer a planted card.

   The divider of before separated without containing anything: one could
   not "put a film in Crime", only lay it after the card and hope the order
   would hold. The category is a container: one drags into it, out of it,
   it moves full.

   Its name is read horizontally, truncated with an ellipsis and backed by
   a tooltip. The card of before wrote it vertically and cut it clean at a
   case's height, with no fallback of any kind — unreadable as soon as one
   really named something.

   IT CUTS ITSELF INTO SEGMENTS. A box no longer wraps its content inside
   itself: it then grew in height without any board coming under its lines,
   and the shelf stopped being a shelf. It now receives the only SLICE that
   fits on the line (`items`), and repeats itself as it is on the next
   line — it is `splitRow` that cuts (see `lines.js`). `first` carries the
   header, `last` closes the card on the right; between the two, the edges
   stay open, and one sees that it is the same box continuing. */
export const CategoryBox = React.memo(function CategoryBox({
  cat,
  items,
  first = true,
  last = true,
  kind,
  rowId,
  films,
  dim,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  onCatOver,
  onOpen,
  onEdit,
  onEditDecor,
  onDecorLabel,
  acts,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cat.label);
  useEffect(() => {
    setDraft(cat.label);
  }, [cat.label]);

  const ink = catInk(cat.color);
  const ctx = useMemo(() => ({ kind, rowId, catId: cat.id }), [kind, rowId, cat.id]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== cat.label) acts.setCat(cat.id, { label: v });
    else setDraft(cat.label);
  };

  /* A box holds cases AND furniture: a divider dragged in there is the
     subdivision one needs when the filmography overflows. Only another box
     stays outside. */
  const boxes = (items || cat.items)
    .map((it) => {
      if (it.t === "d")
        return (
          <DecorItem
            key={it.id}
            item={it}
            ctx={ctx}
            onEdit={onEditDecor}
            onLabel={onDecorLabel}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverBox={onDragOverBox}
          />
        );
      const f = films.get(it.id);
      if (!f) return null;
      return (
        <FilmBox
          key={f.id}
          film={f}
          ctx={ctx}
          onOpen={onOpen}
          dim={dim(f)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOverBox={onDragOverBox}
        />
      );
    })
    .filter(Boolean);

  return (
    /* A box is built like a case: a wrapper carrying the gap, the
       identity and the drop zone, and the visible object inside. That is
       what makes the targets pave the row. */
    <div
      data-shelf-item={cat.id}
      draggable={!editing}
      /* A box contains cases, themselves grabbable: a film's `dragstart`
         BUBBLES UP to here. Without this guard, grabbing a film inside a
         category moved the whole category — the event arrived second and
         overwrote the first.

         We compare the WRAPPERS and no longer the nodes: `e.target ===
         e.currentTarget` only let the box be grabbed by its own back,
         never by its tab — that is to say never by the place the hand goes
         to find it. The drag started anyway, without anybody having
         recorded it, and ended in a drop that did nothing. */
      onDragStart={(e) => {
        if (editing || e.target.closest("[data-shelf-item]") !== e.currentTarget) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart("cat", cat.id, e.currentTarget);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onCatOver(e, ctx)}
      /* No more `maxWidth` nor wrapping: the slice received fits on the
         line by construction, `splitRow` made sure of it. The box too big
         for the line does not wrap inside itself, it OVERFLOWS onto the
         line below, which has its wood. */
      style={{
        flexShrink: 0,
        minWidth: 0,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      {/* The card IS the layer that tips: nothing else touches its
          `transform`, so it does not need a layer of its own. */}
      <div
        data-cat-card
        data-lean
        style={{
          position: "relative",
          flexShrink: 0,
          minWidth: 0,
          marginRight: GAP_X,
          marginBottom: GAP_Y,
          display: "flex",
          flexDirection: "column",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
          /* It is STILL a card: same paper, same hairline, same dry drop
             shadow as the upright divider of before. It has only stopped
             being a partition to become a sleeve — open at the bottom, so
             that the cases it holds rest on the shelf's board like the
             others. A closed sleeve would make them float, and the shelf
             would stop being a shelf. */
          /* THE GRADIENT FOLLOWS THE SKIN. It ended on a hand-written
             `#D8C69C` — the notebook's kraft, and it alone: under a night
             skin, the card lightened towards a beige that was no longer
             the colour of anything. Both ends are now tokens, and a wash
             of the card's ink over them ties it back to its category
             without repainting it. */
          background: `linear-gradient(160deg, ${alpha(ink, 0.1)}, ${alpha(ink, 0.16)}),
            linear-gradient(160deg, ${C.card}, ${C.paperDark})`,
          border: `1px solid ${C.line}`,
          borderBottom: "none",
          /* A box cut in two keeps its edges where it starts and where it
             ends, and loses them where it continues: it is the missing
             edge that says "the rest is further down". */
          borderLeft: first ? `1px solid ${C.line}` : "none",
          borderRight: last ? `1px solid ${C.line}` : "none",
          borderRadius: `${first ? 3 : 0}px ${last ? 3 : 0}px 0 0`,
          boxShadow: last ? `2px 2px 0 ${alpha(C.ink, 0.14)}` : `0 2px 0 ${alpha(C.ink, 0.14)}`,
          "--cat-open": `${ink}22`,
        }}
      >
        {/* The index tab: the colour is a tab stuck at the head of the
            card, not a flat fill that would eat the kraft. That is how one
            spots a folder in an archive box.

            It has thickened: four pixels was a hair one no longer saw as
            soon as a row moved away. Seven make it read as a tab without
            its becoming a banner. */}
        <div
          style={{
            height: 7,
            background: ink,
            borderRadius: `${first ? 2 : 0}px ${last ? 2 : 0}px 0 0`,
            opacity: 0.9,
          }}
        />
        {/* The continuation of a box does not carry its name over: the
            coloured tab and the open left edge are enough to recognise it,
            and a name repeated on every line would read as three boxes. */}
        {!first && <div style={{ height: 1, background: C.line, opacity: 0.5 }} />}
        {first && (
          <div
            onClick={() => setEditing(true)}
            title={cat.label}
            /* THE NAME IS READ. At ten point five, it was a footnote on
               the object that gives its name to the whole box. */
            style={{
              padding: "5px 10px",
              cursor: "text",
              color: ink,
              fontFamily: F.mono,
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: "0.06em",
              borderBottom: `1px solid ${C.line}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(cat.label);
                    setEditing(false);
                  }
                }}
                style={{
                  all: "unset",
                  flex: 1,
                  minWidth: 60,
                  fontFamily: F.mono,
                  // the same writing as the laid name: the text does not jump
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: C.ink,
                  borderBottom: `1px solid ${C.line}`,
                }}
              />
            ) : (
              /* Horizontal, truncated cleanly, and the tooltip carries the
               whole name. The divider of before wrote it vertically and cut
               it clean at 144 px, with no ellipsis and no recourse. */
              <span
                style={{
                  flex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 220,
                }}
              >
                {cat.label}
              </span>
            )}
            <span style={{ color: C.inkFaded, fontSize: 9 }}>{cat.items.length}</span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(cat.id);
              }}
              title="Couleur de la catégorie"
              style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}
            >
              <Palette size={11} />
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            /* No more wrapping here: what does not fit on the line is not
               in `items`, it is in the segment below. */
            flexWrap: "nowrap",
            alignItems: "flex-end",
            padding: `${first ? 8 : 4}px 6px 0`,
            minWidth: boxes.length ? 0 : BOX_W + 12,
            minHeight: BOX_H + 8,
          }}
        >
          {boxes.length === 0 && (
            <div
              style={{
                color: C.inkFaded,
                fontFamily: F.hand,
                fontSize: 15,
                padding: "0 6px 12px",
                alignSelf: "flex-end",
              }}
            >
              glissez-y des films
            </div>
          )}
          {boxes}
        </div>
      </div>
    </div>
  );
});
