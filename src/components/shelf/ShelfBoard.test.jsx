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
import { MARK_H, GAP_Y, BOX_H } from "./constants";

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

const renderBoard = (props = {}) => {
  let doc = makeView({ id: "v1", films });
  const onDoc = vi.fn((next) => {
    doc = next;
  });
  /* LE TIROIR EST REMONTE DANS LA VUE, et le harnais joue donc la vue :
     glisser sur l'onglet du tiroir l'ouvre, et sans `setDrawer` le
     geste n'aurait personne a qui parler. */
  let drawer = false;
  const setDrawer = (v) => {
    drawer = v;
  };
  const utils = render(
    <ShelfBoard
      films={films}
      doc={doc}
      onDoc={onDoc}
      onOpen={() => {}}
      onUpdateMany={() => {}}
      drawer={drawer}
      setDrawer={setDrawer}
      {...props}
    />
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

describe("ShelfBoard — the cost of one drag", () => {
  it("measures a box ONCE only, however many times it is hovered", () => {
    const { container } = renderBoard();
    const wrap = grab(container);
    const rects = countRects(container);

    for (let i = 0; i < 50; i += 1) fire(wrap, "dragover", { clientX: 10 + (i % 3) });

    /* Before, it was fifty — a full layout forced by hovering, against
       wrappers in `content-visibility: auto` that had just been
       skipped. */
    expect(rects.get(wrap)).toBe(1);
  });

  it("measures again on the NEXT drag: the cache is good for one gesture only", () => {
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

  it("does not measure the row on every hover of its background either", () => {
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

  it("rebuilds neither row nor case when the shelf renders again during the gesture", () => {
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
       container: it is a `Layer`, so that its screen coordinates do not
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

/* ============================================================
   LE RECUL — ce qu'il a le droit de changer, et ce qu'il n'a pas

   Le glissement compare des rectangles CLIENT a des coordonnees CLIENT :
   a echelle constante les deux sont reduits ensemble et le cache reste
   juste. Ce qui casse est le MELANGE — une constante de MOBILIER
   soustraite d'un rectangle client. Ces trois cas gardent la frontiere,
   et c'est exactement celle qu'on se trompera a refaire dans six mois.
   ============================================================ */

/* Un rectangle DE MISE EN PAGE, rendu comme le navigateur le rendrait a
   l'echelle `k` : tout y est multiplie, parce qu'un rectangle client
   d'un sous-arbre transforme est deja reduit. */
const stub = (node, k, box = { left: 100, top: 200, width: 160, height: 144 }) => {
  const r = {
    left: box.left * k,
    top: box.top * k,
    width: box.width * k,
    height: box.height * k,
  };
  const rect = { ...r, right: r.left + r.width, bottom: r.top + r.height };
  node.getBoundingClientRect = () => rect;
  return rect;
};

/** Le `translate3d` du repere de depot, en nombres. */
const markAt = () => {
  const mark = document.querySelector("[data-drop-mark]") || document.querySelector("svg");
  const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(mark?.style?.transform || "");
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};

describe("ShelfBoard — le recul", () => {
  /* LE BOUTON DU CABINET EST HORS DE LA COLONNE.

     Il etait le SEUL `position: fixed` du projet rendu dedans, en
     infraction a une regle ecrite depuis longtemps. Un sous-arbre
     transforme devient le bloc conteneur de ses `fixed` : sans ce
     rapatriement, le bouton serait parti avec les planches des le
     premier cran. */
  it("rend le bouton du cabinet HORS de la colonne de vue", () => {
    const { container } = renderBoard({ zoom: 0.55 });
    const inColumn = container.querySelector('[data-tour="shelf-cabinet"]');
    const anywhere = document.body.querySelector('[data-tour="shelf-cabinet"]');
    expect(inColumn).toBeNull();
    expect(anywhere).not.toBeNull();
  });

  /* LE REPERE VISE LE MEME ENDROIT DE LA CASE, quel que soit le cran.

     C'est tout le contrat de `mm()` : le pied du boitier est a `GAP_Y +
     BOX_H` du bas de son rectangle, et ces deux-la sont du MOBILIER. Non
     multiplies, le repere se posait de plus en plus bas a mesure qu'on
     reculait — sans qu'aucune erreur soit levee.

     ON MESURE SON CENTRE, ET C'EST LA FRONTIERE ELLE-MEME QU'ON LIT.
     `MARK_H` ne se multiplie PAS : le repere est une aide au pointeur et
     garde sa taille d'ecran, comme la bande morte. Son coin haut ne peut
     donc pas coincider d'un cran a l'autre, et exiger qu'il le fasse
     serait exiger que le repere retrecisse. Ce qui doit coincider est
     l'endroit qu'il DESIGNE. */
  it("vise le meme point de la case a 100 % et a 55 %", () => {
    const read = (k) => {
      cleanup();
      const { container } = renderBoard({ zoom: k });
      const wrap = grab(container);
      const r = stub(wrap, k);
      fire(wrap, "dragover", { clientX: r.left + 2 });
      const at = markAt();
      /* Le centre du repere, ramene en unites de MEUBLE sous le pied du
         boitier. `MARK_H` est en pixels d'ecran des deux cotes. */
      return at && { y: (r.bottom - (at.y + MARK_H / 2)) / k };
    };
    const full = read(1);
    const back = read(0.55);
    expect(full).not.toBeNull();
    expect(back).not.toBeNull();
    /* En unites de MEUBLE, les deux poses sont la meme. */
    expect(back.y).toBeCloseTo(full.y, 6);
    /* Et ce point est celui qu'on visait : le milieu du boitier. */
    expect(full.y).toBeCloseTo(GAP_Y + BOX_H / 2, 6);
  });

  /* LA BANDE MORTE RESTE EN PIXELS D'ECRAN.

     Un poignet tremble en pixels d'ecran, pas en pixels de planche : la
     reduire rendrait la charniere a son claquement d'origine des le
     premier cran. Trois pixels de part et d'autre du milieu ne doivent
     donc JAMAIS faire changer d'avis, a 55 % comme a 100 %. */
  it("garde une bande morte de six pixels d'ecran a tout cran", () => {
    for (const k of [1, 0.55]) {
      cleanup();
      const { container } = renderBoard({ zoom: k });
      const wrap = grab(container);
      const r = stub(wrap, k);
      const mid = (r.left + (r.right - 9 * k)) / 2;

      // on se pose franchement a gauche : le repere prend un cote
      fire(wrap, "dragover", { clientX: mid - 40 });
      const held = markAt();
      expect(held).not.toBeNull();

      // trois pixels d'ecran de l'autre cote : on ne change pas d'avis
      fire(wrap, "dragover", { clientX: mid + 3 });
      expect(markAt()).toEqual(held);
    }
  });
});
