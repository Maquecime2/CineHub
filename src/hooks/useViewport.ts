/* ============================================================
   THE FORMAT — the size of the window, and the hand that touches it
   ============================================================

   The binder was drawn for a desk: a rail of tabs on the edge, cases of
   ninety-six pixels, drag-and-drop with the mouse. None of that reads on
   a phone, and to know it one must put the question to the window.

   IT IS ASKED ONCE, AND NOT PER COMPONENT. A `resize` listened to in
   every view is that many subscriptions and that many re-renders at
   every pixel of resizing. `matchMedia` speaks only when the threshold
   is CROSSED: three listeners for the whole application, and one
   re-render at the exact moment the layout must change.

   `useSyncExternalStore` rather than a `useState` inside a `useEffect`:
   the value is read on the first render, not on the second. A rail born
   vertical only to turn horizontal one frame later is a jump one
   sees. */
import { useSyncExternalStore } from "react";
import { BP } from "../theme/tokens";

/** What the window answers. The three sizes are mutually exclusive. */
export interface Viewport {
  /** Below the `BP.phone` threshold: a single column, navigation at the foot. */
  phone: boolean;
  /** Between the two thresholds: the rail holds, the grids tighten. */
  tablet: boolean;
  /** Above `BP.tablet`: the binder as it was drawn. */
  desk: boolean;
  /* THIS IS NOT THE SAME QUESTION AS WIDTH. A tablet laid in landscape
     is wide AND touch-driven; a browser shrunk to three hundred pixels
     is narrow and driven with the mouse. Forty-four pixel targets and
     finger dragging answer to `coarse`, layouts answer to width.
     Confusing them means giving finger-sized buttons to a mouse. */
  coarse: boolean;
}

const QUERIES = {
  phone: `(max-width: ${BP.phone - 1}px)`,
  tablet: `(min-width: ${BP.phone}px) and (max-width: ${BP.tablet - 1}px)`,
  desk: `(min-width: ${BP.tablet}px)`,
  coarse: "(pointer: coarse)",
} as const;

type Key = keyof typeof QUERIES;
const KEYS = Object.keys(QUERIES) as Key[];

/* An environment without `matchMedia` must render the desk rather than
   nothing: jsdom does not implement it on its own. The question is asked
   at every call and not once and for all at import time — otherwise a
   test that lays down its stub after the module has loaded would be
   stuck with the answer frozen at the first instant. */
const supported = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function";

const lists: Partial<Record<Key, MediaQueryList>> = {};
const listOf = (k: Key): MediaQueryList | undefined => {
  if (!supported()) return undefined;
  let l = lists[k];
  if (!l) {
    l = window.matchMedia(QUERIES[k]);
    lists[k] = l;
  }
  return l;
};

const DESK: Viewport = { phone: false, tablet: false, desk: true, coarse: false };

/* THE SNAPSHOT IS CACHED, AND THAT IS MANDATORY.
   `useSyncExternalStore` compares the old and the new value by identity.
   Building a fresh object at every read would make it believe in a
   change at every render — and it loops. So we recompose the object only
   when a query has really spoken. */
let snapshot: Viewport = DESK;
let dirty = true;

const read = (): Viewport => {
  if (!supported()) return DESK;
  if (dirty) {
    const next = Object.fromEntries(
      KEYS.map((k) => [k, listOf(k)?.matches ?? false])
    ) as unknown as Viewport;
    /* No query answers — a stubbed `matchMedia` that always returns
       false, which is what most test doubles do. We then fall back on
       the desk rather than on a nameless format. */
    if (!next.phone && !next.tablet) next.desk = true;
    snapshot = next;
    dirty = false;
  }
  return snapshot;
};

const subscribe = (onChange: () => void): (() => void) => {
  if (!supported()) return () => {};
  const fire = () => {
    dirty = true;
    onChange();
  };
  const attached = KEYS.map((k) => listOf(k)).filter((l): l is MediaQueryList => !!l);
  attached.forEach((l) => l.addEventListener("change", fire));
  return () => attached.forEach((l) => l.removeEventListener("change", fire));
};

/** The current format. A single subscription for the whole application. */
export const useViewport = (): Viewport => useSyncExternalStore(subscribe, read, () => DESK);

/** For tests: forget what was measured and measure again. */
export const resetViewport = (): void => {
  KEYS.forEach((k) => delete lists[k]);
  dirty = true;
};
