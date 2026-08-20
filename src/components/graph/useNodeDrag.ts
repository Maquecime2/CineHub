/* ============================================================
   MOVING A STAR BY HAND
   ============================================================

   THE FOUR-PIXEL THRESHOLD IS THE WHOLE POINT of this hook. A pointer
   press followed by a release almost never lands on the exact same
   pixel: without a threshold, every click on a node is a one-pixel drag,
   the selection never fires, and the very thing the screen is for —
   clicking a star to light up the run — stops working while looking as
   though nothing is wrong.

   IT HOLDS OFFSETS AND NOT POSITIONS. The layout is `relax`'s business
   and stays deterministic; what somebody drags is a nudge laid ON TOP of
   it. So a node moved by hand does not jump back when the graph is
   recomputed, and none of it is written to disk — an arrangement of a
   map is not a document, it is the last minute of looking at it.

   Lifted out of the constellation's view rather than copied from it:
   the behaviour is the reusable half, the drawing is not. */
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Below this, in pixels, a press is a click and not a drag. */
export const DRAG_THRESHOLD = 4;

export interface Nudge {
  dx: number;
  dy: number;
}

export interface NodeDrag {
  /** Les décalages posés à la main, par identifiant de nœud. */
  nudges: Record<string, Nudge>;
  /** Le nœud qu'on déplace en ce moment, s'il y en a un. */
  dragging: string | null;
  /** À poser sur le nœud. Rend `true` au relâchement si c'était un CLIC. */
  onPointerDown: (id: string, e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  /** Rend `true` quand le geste n'a pas dépassé le seuil : c'est un clic. */
  onPointerUp: () => boolean;
  reset: () => void;
}

export function useNodeDrag(): NodeDrag {
  const [nudges, setNudges] = useState<Record<string, Nudge>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  /* In a ref and not in state: it is read inside the move handler, which
     must not wait for a render to know where the gesture started. */
  const from = useRef<{ x: number; y: number; base: Nudge } | null>(null);
  const moved = useRef(false);

  const onPointerDown = useCallback(
    (id: string, e: ReactPointerEvent) => {
      e.stopPropagation();
      moved.current = false;
      from.current = { x: e.clientX, y: e.clientY, base: nudges[id] || { dx: 0, dy: 0 } };
      setDragging(id);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [nudges]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const start = from.current;
      if (!dragging || !start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved.current = true;
      setNudges((n) => ({ ...n, [dragging]: { dx: start.base.dx + dx, dy: start.base.dy + dy } }));
    },
    [dragging]
  );

  const onPointerUp = useCallback(() => {
    from.current = null;
    setDragging(null);
    return !moved.current;
  }, []);

  const reset = useCallback(() => setNudges({}), []);

  return { nudges, dragging, onPointerDown, onPointerMove, onPointerUp, reset };
}
