/* What these tests guard is not a display: it is the COST of a drag.

   `dragover` fires continuously while one holds something, motionless
   mouse included. Everything the hover allows itself to do is therefore
   paid for sixty times a second, without interruption, for the whole
   gesture — and the shelf has already killed a tab for having forgotten
   it. The two measurements below are the ones that had killed it: the
   rectangles read again, and the cases rebuilt.

   So we count calls rather than inspecting HTML. That is unusual, but it
   is the only thing the render does not say and that the user, for their
   part, felt immediately. */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

/* `hueOf` is called in `FilmBox`'s body, once per render and per case:
   counting it means counting case renders without having to instrument
   React. */
const hueCalls = { n: 0 };
vi.mock("../../theme/ink", async () => {
  const real = await vi.importActual("../../theme/ink");
  return {
    ...real,
    hueOf: (id) => {
      hueCalls.n += 1;
      return real.hueOf(id);
    },
  };
});

/* `isUnplaced` is called in `ShelfRow`'s body: it counts ROW renders, the
   layer `dnd`'s identity actually reaches. The cases, for their part,
   receive the handlers one by one — already stable — and are protected
   whatever happens to the bundle. */
const rowCalls = { n: 0 };
vi.mock("../../shelf-views", async () => {
  const real = await vi.importActual("../../shelf-views");
  return {
    ...real,
    isUnplaced: (row) => {
      rowCalls.n += 1;
      return real.isUnplaced(row);
    },
  };
});

const { ShelfBoard } = await import("./ShelfBoard");
const { makeView } = await import("../../shelf-views");

const films = Array.from({ length: 40 }, (_, i) => ({
  id: `f${i}`,
  title: `Film ${i}`,
  addedAt: 1000 + i,
  status: "watched",
  rating: 3,
  genres: [],
  bedside: false,
  archived: false,
}));

/* A real `DragEvent` does not exist under jsdom; React only listens for
   the event's name and its target anyway. An `Event` that bubbles is
   enough, augmented with the only fields the code reads. */
const fire = (node, type, extra = {}) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, {
    clientX: 0,
    clientY: 0,
    dataTransfer: { setData() {}, setDragImage() {} },
    ...extra,
  });
  node.dispatchEvent(e);
};

const renderBoard = () => {
  let doc = makeView({ id: "v1", films });
  const onDoc = vi.fn((next) => {
    doc = next;
  });
  const utils = render(
    <ShelfBoard films={films} doc={doc} onDoc={onDoc} onOpen={() => {}} onUpdateMany={() => {}} />
  );
  return {
    ...utils,
    onDoc,
    get doc() {
      return doc;
    },
  };
};

/* Every node counts its own measurements. jsdom returns zero rectangles,
   which does not matter: we are not checking WHERE the marker goes, only
   how many times we asked the browser to compute it. */
const countRects = (container) => {
  const seen = new Map();
  container.querySelectorAll("*").forEach((node) => {
    seen.set(node, 0);
    node.getBoundingClientRect = () => {
      seen.set(node, seen.get(node) + 1);
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
    };
  });
  return seen;
};

const grab = (container) => {
  const wrap = container.querySelector("[data-shelf-item]");
  const handle = wrap.querySelector("[draggable]") || wrap;
  fire(handle, "dragstart");
  return wrap;
};

beforeEach(() => {
  hueCalls.n = 0;
  rowCalls.n = 0;
  cleanup();
});

describe("ShelfBoard — le coût d'un glissement", () => {
  it("ne mesure une enveloppe qu'UNE fois, quel que soit le nombre de survols", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const rects = countRects(container);

    for (let i = 0; i < 50; i += 1) fire(wrap, "dragover", { clientX: 10 + (i % 3) });

    /* Before, it was fifty — a full layout forced by hovering, against
       wrappers in `content-visibility: auto` that had just been
       skipped. */
    expect(rects.get(wrap)).toBe(1);
  });

  it("remesure au glissement SUIVANT : le cache ne vaut que pour un geste", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const rects = countRects(container);

    fire(wrap, "dragover", { clientX: 10 });
    expect(rects.get(wrap)).toBe(1);

    fire(wrap, "dragend");
    fire(wrap.querySelector("[draggable]") || wrap, "dragstart");
    fire(wrap, "dragover", { clientX: 10 });

    // the shelf may have been filed differently in between: we measure again
    expect(rects.get(wrap)).toBe(2);
  });

  it("ne mesure pas non plus la rangée à chaque survol de son fond", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const strip = container.querySelector("[data-shelf-row]");
    const rects = countRects(container);

    /* The row's back already de-duplicates; we force it to come round
       again by alternating with a case, which breaks its hover memory. */
    for (let i = 0; i < 20; i += 1) {
      fire(strip, "dragover");
      fire(wrap, "dragover", { clientX: 10 });
    }

    expect(rects.get(strip)).toBe(1);
  });

  it("ne refait ni rangée ni boîtier quand l'étagère se rend à nouveau pendant le geste", () => {
    const { container } = renderBoard();
    grab(container);
    const rowsBefore = rowCalls.n;
    const boxesBefore = hueCalls.n;
    expect(rowsBefore).toBeGreaterThan(0);
    expect(boxesBefore).toBeGreaterThan(0);

    /* Hovering the drawer's tab while holding a case opens the drawer:
       it is the only `setState` a drag triggers, and it therefore renders
       the whole of `ShelfBoard` in the middle of the gesture. That render
       must cost only the drawer.

       The `dnd` bundle goes down as far as the rows; if it changes
       identity at every render, their `React.memo` keeps nothing any more
       and the rows are rebuilt — and with them, the wrappers the
       measurements kept above designated. That is where the two fixes
       meet. */
    /* The drawer renders into the document's BODY and not into the render
       container: it is a `Calque`, so that its screen coordinates do not
       depend on the view column and its transform. So we look for it where
       it really is. */
    const tab = document.querySelector("[data-drawer-tab]");
    expect(tab).toBeTruthy();
    // `act`: without it the triggered render would stay pending and the count would lie
    act(() => {
      fire(tab, "dragover");
    });

    expect(rowCalls.n).toBe(rowsBefore);
    expect(hueCalls.n).toBe(boxesBefore);
  });
});
