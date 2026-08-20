/* ============================================================
   LOOKING CLOSER AT A MAP
   ============================================================

   A graph drawn at a fixed `viewBox` is a picture. At forty nodes the
   names overlap, and the only remedy the screen offered was to give up
   reading them — which is how a map becomes decoration.

   IT MOVES THE WINDOW, NOT THE LAYOUT. The state here is three numbers,
   `{x, y, k}`, and they only ever reach the `viewBox` attribute. The
   positions themselves stay `relax`'s business and stay memoised on
   `[nodes, links]` — SO NOTHING FROM THIS HOOK MAY EVER ENTER THAT
   DEPENDENCY LIST. `relax` is O(n²) over 320 passes; a zoom that
   recomputed it would make the cheapest gesture on the screen the most
   expensive one, for a layout that has not moved a pixel.

   EVERY DELTA IS DIVIDED BY `k`, AND THAT IS THE WHOLE ARITHMETIC. A
   pointer moves in CLIENT pixels; the map is read in VIEW units. At
   k = 1 the two happen to agree, which is exactly why the confusion
   survives untested — it only shows up once somebody zooms.

   THE WHEEL IS A SHORTCUT AND NEVER THE CONTROL. A bare wheel belongs to
   the page: a map that swallowed it would trap the scroll of whoever
   merely meant to reach what is below. So only `ctrl`/`meta` zooms, and
   the buttons the caller draws are the honest way in. */
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";

/** Below 1, the map is smaller than its frame — there is nothing to see. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (v: number, low: number, high: number): number =>
  v < low ? low : v > high ? high : v;

export interface MapView {
  /** What goes in `viewBox`, already written out. */
  viewBox: string;
  k: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** True as soon as the window is not the whole map: what `reset` undoes. */
  moved: boolean;
  zoomBy: (factor: number) => void;
  reset: () => void;
  /** Bring a point of the map inside the window, if it has fallen out. */
  focusOn: (x: number, y: number) => void;
  onWheel: (e: ReactWheelEvent) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  panning: boolean;
}

/**
 * The window onto a `W × H` map.
 *
 * `x` / `y` are the top-left corner in view units, `k` the magnification;
 * the window is therefore `W/k × H/k` and is always kept inside the map,
 * so one cannot pan away into nothing and lose the thing entirely.
 */
export function useMapView(W: number, H: number): MapView {
  const [{ x, y, k }, setView] = useState({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(false);
  /* In a ref: the move handler must know where the gesture started
     without waiting for a render, exactly as `useNodeDrag` does. */
  const from = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const w = W / k;
  const h = H / k;

  /* THE WINDOW IS PENNED IN. Panning past the edge would show empty
     paper and, worse, would let somebody lose a map they cannot find
     their way back to without pressing reset. */
  const settle = useCallback(
    (nx: number, ny: number, nk: number) => ({
      k: nk,
      x: clamp(nx, 0, W - W / nk),
      y: clamp(ny, 0, H - H / nk),
    }),
    [W, H]
  );

  /* Zooming keeps the CENTRE of the window where it was: magnifying
     towards the top-left corner would make the thing one is looking at
     slide off the screen at every press. */
  const zoomBy = useCallback(
    (factor: number) =>
      setView((v) => {
        const nk = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
        if (nk === v.k) return v;
        const cx = v.x + W / v.k / 2;
        const cy = v.y + H / v.k / 2;
        return settle(cx - W / nk / 2, cy - H / nk / 2, nk);
      }),
    [W, H, settle]
  );

  const reset = useCallback(() => setView({ x: 0, y: 0, k: 1 }), []);

  const focusOn = useCallback(
    (fx: number, fy: number) =>
      setView((v) => {
        const vw = W / v.k;
        const vh = H / v.k;
        /* NOTHING MOVES IF NOTHING HAS TO. Recentring on every arrow
           press would make the map slide under a cursor that was already
           in plain sight. */
        if (fx >= v.x && fx <= v.x + vw && fy >= v.y && fy <= v.y + vh) return v;
        return settle(fx - vw / 2, fy - vh / 2, v.k);
      }),
    [W, H, settle]
  );

  const onWheel = useCallback(
    (e: ReactWheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    },
    [zoomBy]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      /* Only a press that missed every node gets here: `useNodeDrag`
         stops the propagation of the ones that did not. */
      if (k === 1) return;
      from.current = { px: e.clientX, py: e.clientY, x, y };
      setPanning(true);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [k, x, y]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const start = from.current;
      if (!start) return;
      /* Client pixels into view units — see the header. The sign is
         inverted because dragging the paper rightwards moves the WINDOW
         leftwards. */
      const dx = (e.clientX - start.px) / k;
      const dy = (e.clientY - start.py) / k;
      setView((v) => settle(start.x - dx, start.y - dy, v.k));
    },
    [k, settle]
  );

  const onPointerUp = useCallback(() => {
    from.current = null;
    setPanning(false);
  }, []);

  return {
    viewBox: `${x} ${y} ${w} ${h}`,
    k,
    canZoomIn: k < MAX_ZOOM,
    canZoomOut: k > MIN_ZOOM,
    moved: k !== 1 || x !== 0 || y !== 0,
    zoomBy,
    reset,
    focusOn,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    panning,
  };
}
