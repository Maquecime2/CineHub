/* ============================================================
   FINGER DRAGGING — a bridge, and not a second shelf
   ============================================================

   The shelf is tidied by dragging: one takes a case, one lays it between
   two others, and the row where one lets go gives it its status. That
   whole gesture is written in HTML5 drag-and-drop events — `dragstart`,
   `dragover`, `drop` — and those events DO NOT EXIST under a finger. No
   touch browser emits them. On a phone the shelf was therefore not
   clumsy: it was inert.

   THERE WERE TWO WAYS TO ANSWER, AND ONLY ONE HOLDS.

   The first: give `src/components/shelf/` a second set of handlers, a
   touch one, beside the first. That is a thousand lines that know how to
   place a marker, measure a row, push two neighbours aside and settle a
   hinge — duplicated, and doomed to diverge at the first fix carried on
   one side only.

   The second, this one: duplicate nothing, and TRANSLATE. The finger
   speaks in `pointerdown`/`pointermove`/`pointerup`; the shelf listens
   for `dragstart`/`dragover`/`drop`. So we listen to the one and emit the
   other, for real, on the node that lies under the finger — React
   attaches its listeners to the document root and makes no difference
   between an event from the browser and an event we send it. The shelf
   does not know it is being touched, and that is exactly the point: not
   one line of `shelf/` changes, and every fix made with the mouse
   benefits the finger the same day.

   NOTHING IS WIRED TO THE SHELF HERE. The bridge knows only one thing of
   the document: `[draggable="true"]`. What drags with the mouse drags
   with the finger, on the shelf as on the wall, and a future view that
   renders a grabbable object gets it without asking. */
import { useEffect } from "react";

/* WHAT WE DO NOT CATCH WHILE DRAGGING. A grabbable case carries buttons
   — open the card, rename a box. A long press on one of them must remain
   a press on that button.

   BUT THE HELD THING IS ITSELF A BUTTON, AND THAT IS THE WHOLE TRAP. A
   shelf case is written `<button draggable="true">`: it opens with the
   keyboard as much as with the mouse, and that is good. Setting aside
   every press "inside a button" therefore set it aside too, and finger
   dragging NEVER started on a row — the one thing this bridge existed to
   make possible.

   So we do not look at whether the press falls inside a button, but
   whether it falls inside a button LOCATED WITHIN the grabbable thing. */
const INERT = "button, a, input, textarea, select, [contenteditable]";

/* THE TIME IT TAKES TO SAY "I AM TAKING THIS" RATHER THAN "I AM
   SCROLLING".

   This is the central trade-off, and it has no good answer in pixels. A
   distance threshold — one grabs as soon as the finger has moved eight
   pixels — condemns scrolling: the shelf scrolls horizontally, and the
   first sweeping gesture would tear off a case instead of sliding the
   row.

   The held press settles it because it costs nothing to whoever wants to
   scroll: the finger leaves at once, and the grab never happens. It is
   also the gesture the system itself uses to reorder a list, hence the
   one people try without being told.

   Two hundred and sixty milliseconds: below that one grabs by accident
   while sweeping fast, above it one believes nothing is responding. */
const HOLD_MS = 260;

/* The finger trembles. As long as nothing has been grabbed, that tremble
   must stay a tremble — but beyond ten pixels it is a sweep, and the held
   press is abandoned in favour of scrolling. */
const SLOP = 10;

/* THE EDGE THAT SCROLLS.

   On a phone a row holds three cases: the slot being aimed at is almost
   always off screen. With the mouse one has the wheel; with the finger
   one has nothing, since the finger is already taken by the gesture.
   Without what follows, moving a film beyond what the screen shows is
   simply impossible.

   Eighty pixels of band, eighteen pixels per frame at the strongest —
   about a thousand per second, enough to cross a page without the
   feeling of fleeing. The speed follows how deep one is in the band:
   brushing the band barely advances, sticking to the edge races.

   `prefers-reduced-motion` DOES NOT CUT this scrolling. It is not an
   ornament moving on its own: it is the only path to an off-screen
   target, and removing it would make the gesture impossible to
   finish. */
const EDGE = 80;
const SPEED = 18;

/* The container that scrolls under what is being hovered. We walk up by
   hand rather than with `closest()`: the selector knows nothing of the
   computed style, and a container with nothing to scroll must not
   capture the gesture in the page's stead. */
const scroller = (node: Element | null): Element => {
  for (let el = node; el; el = el.parentElement) {
    if (!(el instanceof HTMLElement)) continue;
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return document.scrollingElement ?? document.documentElement;
};

/* The step of one frame, in pixels, signed: negative towards the top.
   Zero as long as the finger is in neither band. */
const pace = (y: number): number => {
  const top = EDGE - y;
  if (top > 0) return -SPEED * Math.min(1, top / EDGE);
  const bottom = y - (window.innerHeight - EDGE);
  if (bottom > 0) return SPEED * Math.min(1, bottom / EDGE);
  return 0;
};

/* WHAT `dataTransfer` MUST BE SO THAT NOBODY NOTICES.

   A hand-built `DragEvent` is born with `dataTransfer` at `null`, and
   the first handler along writes `e.dataTransfer.effectAllowed = "move"`
   — which throws. The drag clipboard is of no use here (the source is
   held by the shelf itself, not read from the transfer), but it must
   ANSWER. */
const fakeTransfer = () => {
  const data = new Map<string, string>();
  return {
    dropEffect: "move",
    effectAllowed: "move",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [] as readonly string[],
    setData: (k: string, v: string) => void data.set(k, v),
    getData: (k: string) => data.get(k) ?? "",
    clearData: () => data.clear(),
    setDragImage: () => {},
  } as unknown as DataTransfer;
};

/** Emit a real drag event, one that React will hear. */
const emit = (node: Element | null, type: string, x: number, y: number, dt: DataTransfer) => {
  if (!node) return;
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y };
  /* `DragEvent` does not exist everywhere — jsdom, where the tests run,
     does not implement it. A `MouseEvent` already carries everything the
     handlers really read (the type, the coordinates, the propagation);
     what was missing, `dataTransfer`, is laid on by hand just below
     anyway. */
  const Ctor = typeof DragEvent === "function" ? DragEvent : MouseEvent;
  const ev: Event = new Ctor(type, init);
  /* `dataTransfer` is a prototype accessor, and it is not fed by the
     constructor. We lay it on the instance. */
  Object.defineProperty(ev, "dataTransfer", { value: dt, configurable: true });
  node.dispatchEvent(ev);
};

/* What lies under the finger, the held thing aside: it is under the
   finger at all times, and would therefore receive itself. */
const under = (x: number, y: number, held: HTMLElement): Element | null => {
  const before = held.style.pointerEvents;
  held.style.pointerEvents = "none";
  const el = document.elementFromPoint(x, y);
  held.style.pointerEvents = before;
  return el;
};

interface Gesture {
  id: number;
  source: HTMLElement;
  x: number;
  y: number;
  dt: DataTransfer;
  timer: number | null;
  /** The press held: we are dragging for real. */
  live: boolean;
  /** The last hovered node, to tell it we are leaving. */
  over: Element | null;
  /** The scrolling frame under way, if there is one. */
  raf: number | null;
  /** The scrolling step, in pixels per frame; zero outside the bands. */
  pan: number;
}

/** Translates the finger into drag-and-drop, for every `[draggable="true"]`. */
export function usePointerDrag(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let g: Gesture | null = null;

    const clearTimer = () => {
      if (g?.timer != null) {
        window.clearTimeout(g.timer);
        g.timer = null;
      }
    };

    /* End of the gesture, whatever the reason. `dragend` is emitted even
       when the drop took place: it is what lays the shelf flat again
       (see `reset`, in ShelfBoard), and a gesture that ends without it
       leaves a translucent case and a root still marked. */
    const finish = (drop: { x: number; y: number } | null) => {
      if (!g) return;
      const { source, dt, live, over } = g;
      const done = g;
      g = null;
      clearTimerOf(done);
      stopPan(done);
      if (!live) return;
      if (drop) {
        const target = under(drop.x, drop.y, source);
        emit(target, "drop", drop.x, drop.y, dt);
      } else if (over) {
        emit(over, "dragleave", done.x, done.y, dt);
      }
      emit(source, "dragend", done.x, done.y, dt);
      delete source.dataset.pointerDrag;
    };

    const clearTimerOf = (x: Gesture) => {
      if (x.timer != null) window.clearTimeout(x.timer);
      x.timer = null;
    };

    const stopPan = (x: Gesture) => {
      if (x.raf != null) cancelAnimationFrame(x.raf);
      x.raf = null;
      x.pan = 0;
    };

    /* What hovering produces: the change of target, then the `dragover`
       that places the marker. Called by the moving finger, and by every
       scrolling frame — because under a still finger it is the shelf
       that moves, and the target changes just as much. */
    const hover = (x: number, y: number) => {
      if (!g) return;
      const target = under(x, y, g.source);
      if (target !== g.over) {
        if (g.over) emit(g.over, "dragleave", x, y, g.dt);
        if (target) emit(target, "dragenter", x, y, g.dt);
        g.over = target;
      }
      /* `dragover` fires continuously as long as the mouse moves: it is
         what places the marker, and therefore what must be repeated. */
      emit(target, "dragover", x, y, g.dt);
    };

    /* One scrolling frame: we push the container, we look at what has
       passed under the finger, we ask for another frame. If the
       container has not moved we are at the stop and the loop ends —
       replaying it empty would only replay the same `dragover`. */
    const frame = () => {
      if (!g?.live || !g.pan) return;
      g.raf = null;
      const el = scroller(g.over ?? under(g.x, g.y, g.source));
      const before = el.scrollTop;
      el.scrollTop = before + g.pan;
      if (el.scrollTop === before) {
        g.pan = 0;
        return;
      }
      hover(g.x, g.y);
      if (g?.live && g.pan) g.raf = requestAnimationFrame(frame);
    };

    const begin = () => {
      if (!g) return;
      g.live = true;
      /* `touch-action: none` arrives only HERE, and that is the whole
         balance of the gesture: laying it in advance on every case would
         make the shelf impossible to scroll with the finger. The rule
         lives in the tokens, on `[data-pointer-drag]`. */
      g.source.dataset.pointerDrag = "1";
      /* A physical feedback says the thing is taken. The iOS touch
         keyboard gives none; those who have it gain, the others lose
         nothing. */
      navigator.vibrate?.(12);
      emit(g.source, "dragstart", g.x, g.y, g.dt);
    };

    const onDown = (e: PointerEvent) => {
      if (g || e.button !== 0) return;
      const el = e.target as Element | null;
      if (!el) return;
      const source = el.closest<HTMLElement>('[draggable="true"]');
      if (!source) return;
      /* The first interactive element above the finger. If it IS the
         held thing there is no obstacle: it is the one being taken. If
         it is below it, it is a button laid on it, and it keeps its own
         gesture. */
      const inert = el.closest(INERT);
      if (inert && inert !== source && source.contains(inert)) return;
      g = {
        id: e.pointerId,
        source,
        x: e.clientX,
        y: e.clientY,
        dt: fakeTransfer(),
        timer: window.setTimeout(begin, HOLD_MS),
        live: false,
        over: null,
        raf: null,
        pan: 0,
      };
    };

    const onMove = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      if (!g.live) {
        /* The finger left before the press had held: this is a sweep,
           and it belongs to scrolling. */
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > SLOP) {
          clearTimer();
          g = null;
        }
        return;
      }
      /* From here on the gesture is ours, and the page must no longer
         move under it. Hence the non-passive listener further down:
         without it this call would have no effect and the browser would
         say so. */
      e.preventDefault();
      g.x = e.clientX;
      g.y = e.clientY;
      hover(e.clientX, e.clientY);
      /* Entering a band lights the loop up, leaving it puts it out;
         between the two, we merely correct the speed. */
      if (!g) return;
      g.pan = pace(e.clientY);
      if (g.pan && g.raf == null) g.raf = requestAnimationFrame(frame);
      else if (!g.pan) stopPan(g);
    };

    const onUp = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      finish({ x: e.clientX, y: e.clientY });
    };

    const onCancel = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      finish(null);
    };

    /* A held press opens a mobile browser's context menu, and that menu
       steals the gesture at the precise moment it begins. */
    const onContext = (e: Event) => {
      if (g?.live) e.preventDefault();
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("contextmenu", onContext);
    return () => {
      if (g) finish(null);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("contextmenu", onContext);
    };
  }, [enabled]);
}
