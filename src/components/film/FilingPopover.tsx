/* ============================================================
   THE FILING PANEL — one, in a layer, anchored to what opened it
   ============================================================

   The first draft hung this panel inside the poster's own card, on the
   grounds that a menu anchored to its button belongs beside its button
   (which is the stated exception in CLAUDE.md). Three things went wrong,
   and all three came from that one decision:

   IT WAS CLIPPED. The wall is a grid, the cards are laid in it, and a
   panel taller than its cell was cut off by the neighbours.

   IT VANISHED MID-GESTURE. Past sixty films the wall is windowed: a card
   scrolled out of view is unmounted and replaced by a spacer. The panel
   went with the card one was reading.

   IT CLOSED ON SUCCESS. `onDone` shut the panel the instant a film was
   filed, so the one thing the panel had to say — "filed", or "already
   there" — was destroyed by the act of saying it. In the multiple
   selection it took the whole footer bar with it.

   So: ONE panel, rendered through `Layer` in the document body, placed
   from the rectangle of the badge that opened it, and closed only by the
   person who opened it — outside click, Escape, or the cross. Filing
   leaves it open, because filing is exactly when it has something to
   report, and because one list is rarely the only one.
   ============================================================ */
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { C, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../ui/Layer";

const WIDTH = 244;
/** Room enough that the panel is never flattened against an edge. */
const MARGIN = 10;

export function FilingPopover({
  at,
  onClose,
  children,
}: {
  /** Where the badge is, in screen coordinates. */
  at: DOMRect;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const outside = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", key);
    /* On the CAPTURE phase and on the next frame: the click that opened
       this panel is still travelling, and listening on the way up would
       close it in the same gesture that opened it. */
    const id = requestAnimationFrame(() => document.addEventListener("mousedown", outside, true));
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", outside, true);
      cancelAnimationFrame(id);
    };
  }, [onClose]);

  /* PLACED IN SCREEN COORDINATES, AND KEPT INSIDE THE WINDOW. A poster
     at the right edge of the wall would otherwise open a panel half of
     which is off screen — and the wall's right edge is where a good half
     of the posters are. */
  const left = Math.min(Math.max(MARGIN, at.right - WIDTH), window.innerWidth - WIDTH - MARGIN);
  const below = at.bottom + 6;
  const room = window.innerHeight - below - MARGIN;
  /* Not enough room underneath: it opens upwards instead, which is what
     the bottom row of a wall always needs. */
  const flip = room < 220 && at.top > room;

  return (
    <Layer>
      <div
        ref={box}
        role="dialog"
        style={{
          position: "fixed",
          left,
          ...(flip ? { bottom: window.innerHeight - at.top + 6 } : { top: below }),
          width: WIDTH,
          maxHeight: flip ? at.top - MARGIN * 2 : room,
          overflowY: "auto",
          /* Between the shelf panels (30–45) and the modal (50): it is
             raised above the page, and it does not cover a modal. */
          zIndex: 46,
          padding: "10px 12px 12px",
          background: C.paper,
          border: `1px solid ${C.line}`,
          boxShadow: `0 10px 26px ${alpha(C.ink, 0.32)}`,
          animation: "fadeIn var(--motion-fast) var(--motion-ease) backwards",
        }}
      >
        <button
          onClick={onClose}
          aria-label="fermer"
          style={{
            all: "unset",
            ...tap,
            cursor: "pointer",
            float: "right",
            color: C.inkFaded,
          }}
        >
          <X size={13} />
        </button>
        {children}
      </div>
    </Layer>
  );
}
