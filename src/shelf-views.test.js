import { describe, it, expect } from "vitest";
import {
  countPlacedMotifs,
  SHELF_KINDS,
  CAT_KEYS,
  belongs,
  kindOf,
  makeView,
  makeRow,
  makeCat,
  makeDecor,
  makeWallDecor,
  pinToWall,
  filmItem,
  isUnplaced,
  reconcileView,
  moveItem,
  sortIntoRows,
  keepByHand,
  heldByHand,
  restoreByHand,
  forgetByHand,
  buildViewsFromLegacy,
  duplicateView,
  filmIdsOf,
  patchRow,
  addRow,
  removeRow,
  clearRow,
  addCat,
  patchCat,
  removeCat,
  patchDecor,
  removeDecor,
  reflowShelf,
  layoutView,
  layoutByDirector,
  UNKNOWN_DIRECTOR,
  upgradeView,
  DEFAULT_CAP,
  reflowView,
  wallDecorOf,
  plankDecorOf,
  patchViewDecor,
  clearViewDecor,
} from "./shelf-views";

/* A film reduced to what the shelf needs. */
const film = (id, extra = {}) => ({
  id,
  title: id,
  addedAt: 1000,
  status: "watched",
  bedside: false,
  archived: false,
  order: null,
  ...extra,
});

const unplacedOf = (view, kind) => view.shelves[kind].rows.at(-1);
const rowsOf = (view, kind) => view.shelves[kind].rows;
const idsIn = (row) => row.items.map((it) => it.id);

/* ALL the object identifiers of a view, opened boxes included.

   It served to write "this trinket is nowhere any more", and that was
   said until now by looking for its id in the JSON of the whole view.
   But a view is full of randomly drawn identifiers, and "d1" ends up
   falling in the middle of one of them — `r_nd1p7is9…` — one day out of
   a few dozen. The test then failed with nothing broken.

   So we look at identifiers as identifiers, and not as a substring of a
   big text. */
const allItemIds = (view) =>
  Object.values(view.shelves)
    .flatMap((s) => s.rows)
    .flatMap((r) => r.items)
    .flatMap((it) => (it.t === "c" ? [it.id, ...(it.items || []).map((i) => i.id)] : [it.id]));

/* A box, wherever it is laid in the view. */
const catIn = (view, catId, kind = "main") =>
  rowsOf(view, kind)
    .flatMap((r) => r.items)
    .find((it) => it.t === "c" && it.id === catId);

describe("which shelf a film belongs to", () => {
  it("the film's flags, and they alone, decide the shelf", () => {
    expect(kindOf(film("a"))).toBe("main");
    expect(kindOf(film("a", { bedside: true }))).toBe("bedside");
    expect(kindOf(film("a", { archived: true }))).toBe("reserve");
    // archived wins: a bedside film set aside is set aside
    expect(kindOf(film("a", { bedside: true, archived: true }))).toBe("reserve");
    expect(belongs.bedside(film("a", { bedside: true, archived: true }))).toBe(false);
  });

  it("a film to watch is never a bedside one: you do not rewatch what you have not seen", () => {
    const toWatch = film("a", { bedside: true, status: "watchlist" });
    expect(kindOf(toWatch)).toBe("main");
    expect(belongs.bedside(toWatch)).toBe(false);
    // and it does not vanish for all that: the collection takes it in
    expect(belongs.main(toWatch)).toBe(true);
  });
});

describe("reconcileView", () => {
  it("gathers into the arrivals row every film the view does not know", () => {
    const view = makeView({ wall: "watched" });
    const films = [film("f1"), film("f2")];
    const next = reconcileView(view, films);
    expect(idsIn(unplacedOf(next, "main"))).toEqual(["f1", "f2"]);
  });

  it("returns the SAME object when nothing has changed", () => {
    const films = [film("f1")];
    const once = reconcileView(makeView(), films);
    // referential stability is what allows memoising the rows: a new
    // object on every render would repaint the whole shelf
    expect(reconcileView(once, films)).toBe(once);
  });

  it("takes out a deleted film, wherever it sits", () => {
    const cat = makeCat({ items: [filmItem("f2")] });
    const view = makeView();
    view.shelves.main.rows[0].items = [filmItem("f1"), cat];
    const next = reconcileView(view, [film("f1")]);
    expect(filmIdsOf(next)).toEqual(["f1"]);
  });

  it("moves an archived film from the main shelf to the drawer's arrivals", () => {
    const view = makeView();
    view.shelves.main.rows[0].items = [filmItem("f1")];
    const next = reconcileView(view, [film("f1", { archived: true })]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual([]);
    expect(idsIn(unplacedOf(next, "reserve"))).toEqual(["f1"]);
  });

  it("de-duplicates: a film takes one place and no more", () => {
    const view = makeView();
    view.shelves.main.rows[0].items = [filmItem("f1"), filmItem("f1")];
    const next = reconcileView(view, [film("f1")]);
    expect(filmIdsOf(next)).toEqual(["f1"]);
  });

  it("guarantees a single arrivals row, and last", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ kind: "unplaced", items: [filmItem("f1")] }),
      makeRow({ items: [filmItem("f2")] }),
      makeRow({ kind: "unplaced", items: [filmItem("f3")] }),
    ];
    const next = reconcileView(view, [film("f1"), film("f2"), film("f3")]);
    const rows = rowsOf(next, "main");
    expect(rows.filter(isUnplaced)).toHaveLength(1);
    expect(isUnplaced(rows.at(-1))).toBe(true);
    expect(idsIn(rows.at(-1)).sort()).toEqual(["f1", "f3"]);
  });
});

describe("moveItem", () => {
  const seed = () => {
    const view = makeView();
    const cat = makeCat({ id: "c1", items: [filmItem("f3")] });
    view.shelves.main.rows = [
      makeRow({ id: "r1", items: [filmItem("f1"), filmItem("f2"), cat] }),
      makeRow({ id: "r2", items: [] }),
      makeRow({ id: "r3", kind: "unplaced", items: [] }),
    ];
    return view;
  };

  it("reorders within a row", () => {
    const next = moveItem(
      seed(),
      { id: "f2" },
      { kind: "main", rowId: "r1", overId: "f1", side: "before" }
    );
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "f1", "c1"]);
  });

  it("moves to another row, at the end when nothing is aimed at", () => {
    const next = moveItem(seed(), { id: "f1" }, { kind: "main", rowId: "r2" });
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "c1"]);
    expect(idsIn(rowsOf(next, "main")[1])).toEqual(["f1"]);
  });

  it("puts a film into a category", () => {
    const next = moveItem(seed(), { id: "f1" }, { kind: "main", rowId: "r1", catId: "c1" });
    const cat = rowsOf(next, "main")[0].items.find((i) => i.id === "c1");
    expect(cat.items.map((i) => i.id)).toEqual(["f3", "f1"]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "c1"]);
  });

  it("takes a film back out of a category", () => {
    const next = moveItem(
      seed(),
      { id: "f3" },
      { kind: "main", rowId: "r1", overId: "f1", side: "before" }
    );
    const cat = rowsOf(next, "main")[0].items.find((i) => i.id === "c1");
    expect(cat.items).toEqual([]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f3", "f1", "f2", "c1"]);
  });

  it("refuses to nest a category inside a category", () => {
    const view = seed();
    const next = moveItem(view, { id: "c1" }, { kind: "main", rowId: "r1", catId: "c1" });
    expect(next).toBe(view);
  });

  /* What the refusal above forces the shelf to do: a box walked over
     another one is stored NEXT TO it. */
  it("files a category beside another, in the row", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeCat({ id: "c2", items: [] }));
    const next = moveItem(
      view,
      { id: "c2" },
      { kind: "main", rowId: "r1", overId: "c1", side: "before" }
    );
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f1", "f2", "c2", "c1"]);
  });

  /* A decor, though, GOES IN: it is the subdivision one needs when a
     box grows. Only a box stays outside. */
  it("puts a decor into a category", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    const next = moveItem(view, { id: "d1" }, { kind: "main", rowId: "r1", catId: "c1" });
    expect(catIn(next, "c1").items.map((i) => i.id)).toEqual(["f3", "d1"]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f1", "f2", "c1"]);
  });

  it("aims it at the wanted place in the box, like a case", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    const next = moveItem(
      view,
      { id: "d1" },
      { kind: "main", rowId: "r1", catId: "c1", overId: "f3", side: "before" }
    );
    expect(catIn(next, "c1").items.map((i) => i.id)).toEqual(["d1", "f3"]);
  });

  it("lets it file itself beside the box too", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    const next = moveItem(
      view,
      { id: "d1" },
      { kind: "main", rowId: "r1", overId: "c1", side: "after" }
    );
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f1", "f2", "c1", "d1"]);
    expect(catIn(next, "c1").items.map((i) => i.id)).toEqual(["f3"]);
  });

  it("takes a decor out of a box without touching the films left in it", () => {
    let view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    view = moveItem(view, { id: "d1" }, { kind: "main", rowId: "r1", catId: "c1" });
    const out = moveItem(view, { id: "d1" }, { kind: "main", rowId: "r2" });
    expect(catIn(out, "c1").items.map((i) => i.id)).toEqual(["f3"]);
    expect(idsIn(rowsOf(out, "main")[1])).toEqual(["d1"]);
  });

  it("moves a whole category to another row", () => {
    const next = moveItem(seed(), { id: "c1" }, { kind: "main", rowId: "r2" });
    expect(idsIn(rowsOf(next, "main")[1])).toEqual(["c1"]);
    const cat = rowsOf(next, "main")[1].items[0];
    expect(cat.items.map((i) => i.id)).toEqual(["f3"]);
  });

  it("a seam opens a row that inherits the setting of the one above", () => {
    const view = seed();
    view.shelves.main.rows[0].perRow = 6;
    const next = moveItem(view, { id: "f1" }, { kind: "main", afterRowId: "r1" });
    const rows = rowsOf(next, "main");
    expect(rows).toHaveLength(4);
    expect(idsIn(rows[1])).toEqual(["f1"]);
    expect(rows[1].perRow).toBe(6);
  });

  it("creates a decor taken from the cabinet", () => {
    const decor = makeDecor({ id: "d1", motif: "coffee" });
    const next = moveItem(seed(), { create: decor }, { kind: "main", rowId: "r2" });
    expect(rowsOf(next, "main")[1].items[0]).toMatchObject({ t: "d", motif: "coffee" });
  });

  it("crossing the shelves", () => {
    const view = seed();
    const next = moveItem(
      view,
      { id: "f1" },
      { kind: "bedside", rowId: rowsOf(view, "bedside")[0].id }
    );
    expect(idsIn(rowsOf(next, "bedside")[0])).toEqual(["f1"]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "c1"]);
  });

  it("does nothing when the aimed-at row does not exist", () => {
    const view = seed();
    expect(moveItem(view, { id: "f1" }, { kind: "main", rowId: "inconnue" })).toBe(view);
  });
});

describe("the furniture", () => {
  const seed = () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({
        id: "r1",
        perRow: 6,
        items: [
          filmItem("f1"),
          makeCat({ id: "c1", items: [filmItem("f2")] }),
          makeDecor({ id: "d1", motif: "pin" }),
        ],
      }),
      makeRow({ id: "r2", items: [] }),
      makeRow({ id: "r3", kind: "unplaced", items: [] }),
    ];
    return view;
  };

  it("sets and names a line", () => {
    const next = patchRow(seed(), "r1", { perRow: 4, label: "Les cultes" });
    expect(rowsOf(next, "main")[0]).toMatchObject({ perRow: 4, label: "Les cultes" });
  });

  it("opens a line above, below, or at the end — never after the arrivals", () => {
    const before = addRow(seed(), "main", "r1", "before");
    expect(rowsOf(before, "main")[0].id).not.toBe("r1");

    const after = addRow(seed(), "main", "r1", "after");
    expect(rowsOf(after, "main")[1].id).not.toBe("r2");

    const end = addRow(seed(), "main", null, "end");
    const rows = rowsOf(end, "main");
    expect(isUnplaced(rows.at(-1))).toBe(true);
    expect(rows).toHaveLength(4);
  });

  it("the new line inherits the count of the one above", () => {
    const next = addRow(seed(), "main", "r1", "after");
    expect(rowsOf(next, "main")[1].perRow).toBe(6);
  });

  it("deleting a line gives its films back to the arrivals, a category's included", () => {
    const next = removeRow(seed(), "r1");
    expect(rowsOf(next, "main").map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(idsIn(unplacedOf(next, "main")).sort()).toEqual(["f1", "f2"]);
  });

  it("refuses to delete the arrivals row", () => {
    const view = seed();
    expect(removeRow(view, "r3")).toBe(view);
  });

  it("emptying a line keeps it but gives its films back", () => {
    const next = clearRow(seed(), "r1");
    expect(rowsOf(next, "main")[0].items).toEqual([]);
    expect(idsIn(unplacedOf(next, "main")).sort()).toEqual(["f1", "f2"]);
  });

  it("undoing a category gives its films back and touches nothing else", () => {
    const next = removeCat(seed(), "c1");
    expect(rowsOf(next, "main")[0].items.map((i) => i.id)).toEqual(["f1", "d1"]);
    expect(idsIn(unplacedOf(next, "main"))).toEqual(["f2"]);
  });

  /* A line is not "a category and its continuation": it is a free list.
     One must be able to lay as many as one wants, side by side, and
     slide films between them — which is what the previous divider, which
     necessarily opened the line, forbade. */
  it("accepts as many categories as one wants on one line", () => {
    let view = seed();
    view = addCat(view, "r1", makeCat({ id: "c2", label: "Polars" }));
    view = addCat(view, "r1", makeCat({ id: "c3", label: "Westerns" }));
    const items = rowsOf(view, "main")[0].items;
    expect(items.filter((i) => i.t === "c").map((i) => i.label)).toEqual([
      "Catégorie",
      "Polars",
      "Westerns",
    ]);

    // and they reorder freely, including in front of a film
    const moved = moveItem(
      view,
      { id: "c3" },
      { kind: "main", rowId: "r1", overId: "f1", side: "before" }
    );
    expect(rowsOf(moved, "main")[0].items.map((i) => i.id)).toEqual(["c3", "f1", "c1", "d1", "c2"]);
  });

  it("a film goes into one, then over to the other", () => {
    let view = addCat(seed(), "r1", makeCat({ id: "c2" }));
    view = moveItem(view, { id: "f1" }, { kind: "main", rowId: "r1", catId: "c1" });
    view = moveItem(view, { id: "f1" }, { kind: "main", rowId: "r1", catId: "c2" });
    const items = rowsOf(view, "main")[0].items;
    expect(items.find((i) => i.id === "c1").items.map((i) => i.id)).toEqual(["f2"]);
    expect(items.find((i) => i.id === "c2").items.map((i) => i.id)).toEqual(["f1"]);
  });

  it("repaints and renames a category", () => {
    const next = patchCat(seed(), "c1", { color: "moss", label: "Polars" });
    expect(rowsOf(next, "main")[0].items[1]).toMatchObject({ color: "moss", label: "Polars" });
  });

  it("a decor, for its part, is taken away for good", () => {
    const next = removeDecor(seed(), "d1");
    expect(rowsOf(next, "main")[0].items.map((i) => i.id)).toEqual(["f1", "c1"]);
    expect(patchDecor(next, "d1", { size: 2 })).toBe(next);
  });

  it("resizes a decor", () => {
    const next = patchDecor(seed(), "d1", { size: 1.5, color: "cobalt" });
    expect(rowsOf(next, "main")[0].items[2]).toMatchObject({ size: 1.5, color: "cobalt" });
  });
});

describe("overflow", () => {
  it("a full plank pushes the surplus onto the next", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({
        id: "r1",
        perRow: 2,
        items: [filmItem("a"), filmItem("b"), filmItem("c"), filmItem("d")],
      }),
      makeRow({ id: "r2", perRow: 2, items: [] }),
      makeRow({ id: "r3", kind: "unplaced", items: [] }),
    ];
    const rows = rowsOf(reflowShelf(view, "main"), "main");
    expect(rows.map(idsIn)).toEqual([["a", "b"], ["c", "d"], []]);
  });

  it("cascades, and opens fresh planks before the arrivals airlock", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ id: "r1", perRow: 2, items: ["a", "b", "c", "d", "e", "f", "g"].map(filmItem) }),
      makeRow({ id: "r2", kind: "unplaced", items: [filmItem("z")] }),
    ];
    const rows = rowsOf(reflowShelf(view, "main"), "main");
    expect(rows.map(idsIn)).toEqual([["a", "b"], ["c", "d"], ["e", "f"], ["g"], ["z"]]);
    // the airlock stays the airlock: it has not taken in the surplus
    expect(isUnplaced(rows.at(-1))).toBe(true);
    expect(rows.filter(isUnplaced)).toHaveLength(1);
  });

  it("touches nothing when everything already fits", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ perRow: 4, items: [filmItem("a")] }),
      makeRow({ kind: "unplaced" }),
    ];
    expect(reflowShelf(view, "main")).toBe(view);
  });

  it('an "auto" row does not overflow — it follows the width', () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ perRow: null, items: ["a", "b", "c"].map(filmItem) }),
      makeRow({ kind: "unplaced" }),
    ];
    expect(reflowShelf(view, "main")).toBe(view);
  });

  it("a category counts as one object, and is never cut", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({
        perRow: 2,
        items: [
          filmItem("a"),
          makeCat({ id: "c1", items: [filmItem("x"), filmItem("y")] }),
          filmItem("b"),
        ],
      }),
      makeRow({ kind: "unplaced" }),
    ];
    const rows = rowsOf(reflowShelf(view, "main"), "main");
    expect(rows[0].items.map((i) => i.id)).toEqual(["a", "c1"]);
    expect(rows[1].items.map((i) => i.id)).toEqual(["b"]);
    expect(rows[0].items[1].items.map((i) => i.id)).toEqual(["x", "y"]);
  });
});

describe("upgradeView — taking up a view already saved", () => {
  /* The case met for real: a view built by v1, where a whole shelf had
     been poured into ONE row with no count. Without being taken up at
     load time, it stays a single big line. */
  const v1 = () => {
    const view = makeView();
    view.version = 1;
    view.shelves.main.rows = [
      makeRow({
        id: "r1",
        perRow: null,
        items: Array.from({ length: 25 }, (_, i) => filmItem(`f${i}`)),
      }),
      makeRow({ id: "u", kind: "unplaced", items: [] }),
    ];
    return view;
  };

  /* The single big line of v1 is no longer a flaw to repair: with no
     count, it folds itself into wooden lines, each with its board. So we
     leave it as it is rather than cut it up by tens, which would leave
     every board half bare. */
  it("leaves a shelf poured in at once as it is: it folds itself back", () => {
    const out = upgradeView(v1());
    const rows = rowsOf(out, "main");
    expect(out.version).toBe(2);
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([25]);
    expect(rows.every((r) => r.perRow == null)).toBe(true);
  });

  it("does not touch it again once taken up", () => {
    const once = upgradeView(v1());
    expect(upgradeView(once)).toBe(once);
  });

  it("loses no film on the way", () => {
    const before = filmIdsOf(v1()).sort();
    expect(filmIdsOf(upgradeView(v1())).sort()).toEqual(before);
  });

  it("respects a count the user has already chosen", () => {
    const view = v1();
    view.shelves.main.rows[0].perRow = 4;
    const rows = rowsOf(upgradeView(view), "main");
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([
      4, 4, 4, 4, 4, 4, 1,
    ]);
  });
});

describe("layoutView", () => {
  it("spreads a collection over a plank that will fill its width", () => {
    const films = Array.from({ length: 23 }, (_, i) => film(`f${i}`));
    const out = layoutView(makeView(), films);
    const rows = rowsOf(out, "main");
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([23]);
    expect(idsIn(unplacedOf(out, "main"))).toEqual([]);
    // nothing imposed: the row will take the count of its width
    expect(rows.every((r) => r.perRow == null)).toBe(true);
  });

  it("sorts by the film's flags", () => {
    const out = layoutView(makeView(), [
      film("a"),
      film("b", { bedside: true }),
      film("c", { archived: true }),
    ]);
    expect(idsIn(rowsOf(out, "main")[0])).toEqual(["a"]);
    expect(idsIn(rowsOf(out, "bedside")[0])).toEqual(["b"]);
    expect(idsIn(rowsOf(out, "reserve")[0])).toEqual(["c"]);
  });
});

/* A decor stored INSIDE a box: several functions of the model only knew
   how to search at the first level, and would have lost it in
   silence. */
describe("a decor inside a category", () => {
  const seed = () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({
        id: "r1",
        items: [
          makeCat({
            id: "c1",
            items: [filmItem("f1"), makeDecor({ id: "d1", motif: "underline" }), filmItem("f2")],
          }),
        ],
      }),
      makeRow({ id: "r2", kind: "unplaced", items: [] }),
    ];
    return view;
  };

  it("survives reconciliation — nothing outside can contradict it", () => {
    const out = reconcileView(seed(), [film("f1"), film("f2")]);
    expect(catIn(out, "c1").items.map((i) => i.id)).toEqual(["f1", "d1", "f2"]);
  });

  it("does not count as a film", () => {
    expect(filmIdsOf(seed()).sort()).toEqual(["f1", "f2"]);
  });

  it("is edited and removed where it stands", () => {
    expect(catIn(patchDecor(seed(), "d1", { label: "Polars" }), "c1").items[1].label).toBe(
      "Polars"
    );
    expect(catIn(removeDecor(seed(), "d1"), "c1").items.map((i) => i.id)).toEqual(["f1", "f2"]);
  });

  it("does not move when the box is filed", () => {
    const out = sortIntoRows(seed(), "main", (a, b) => a.id.localeCompare(b.id));
    // the decor keeps its place; only the films redistribute around it
    expect(catIn(out, "c1").items.map((i) => i.id)).toEqual(["f1", "d1", "f2"]);
  });

  it("leaves with the box one undoes, the films going back to the airlock", () => {
    const out = removeCat(seed(), "c1");
    expect(idsIn(unplacedOf(out, "main")).sort()).toEqual(["f1", "f2"]);
    expect(filmIdsOf(out).sort()).toEqual(["f1", "f2"]);
    // the trinket is furniture: it vanishes with the piece of furniture
    expect(allItemIds(out)).not.toContain("d1");
  });

  it("gets a fresh identifier when the view is duplicated", () => {
    const copy = duplicateView(seed(), { now: 1 });
    const inner = copy.shelves.main.rows[0].items[0].items;
    expect(inner.map((i) => i.t)).toEqual(["f", "d", "f"]);
    // the films are the same films; the trinket, though, is another trinket
    expect(inner[0].id).toBe("f1");
    expect(inner[1].id).not.toBe("d1");
  });
});

describe("the objects hung on the wall", () => {
  const wallOf = (view, kind = "main") => view.shelves[kind].wall || [];

  it("hangs at the point it is given, without touching the rows", () => {
    const v = makeView();
    const before = rowsOf(v, "main");
    const next = pinToWall(
      v,
      "main",
      { create: makeWallDecor({ motif: "frame" }) },
      { x: 20, y: 40 }
    );
    expect(wallOf(next)).toHaveLength(1);
    expect(wallOf(next)[0]).toMatchObject({ motif: "frame", x: 20, y: 40 });
    expect(rowsOf(next, "main")).toBe(before);
  });

  it("unhooks from one shelf to hang on the other, without doubling itself", () => {
    let v = pinToWall(
      makeView(),
      "main",
      { create: makeWallDecor({ id: "w1", motif: "frame" }) },
      { x: 10, y: 10 }
    );
    v = pinToWall(v, "bedside", { id: "w1" }, { x: 80, y: 60 });
    expect(wallOf(v, "main")).toHaveLength(0);
    expect(wallOf(v, "bedside")).toEqual([expect.objectContaining({ id: "w1", x: 80, y: 60 })]);
  });

  it("is edited and removed like a decor laid down", () => {
    let v = pinToWall(
      makeView(),
      "main",
      { create: makeWallDecor({ id: "w1", motif: "frame" }) },
      { x: 10, y: 10 }
    );
    v = patchDecor(v, "w1", { color: "cobalt" });
    expect(wallOf(v)[0].color).toBe("cobalt");
    v = removeDecor(v, "w1");
    expect(wallOf(v)).toHaveLength(0);
  });

  it("does not move when given an id no wall carries", () => {
    const v = makeView();
    expect(pinToWall(v, "main", { id: "personne" }, { x: 5, y: 5 })).toBe(v);
  });
});

describe("layoutByDirector", () => {
  const cast = [
    film("a", { director: "Varda" }),
    film("b", { director: "Varda" }),
    film("c", { director: "Akerman" }),
    film("d", { director: "  " }),
    film("e", { director: "Varda" }),
    film("f", { director: "Akerman" }),
    film("g", { director: "Denis" }),
  ];

  const catsOf = (view, kind) =>
    rowsOf(view, kind)
      .filter((r) => !isUnplaced(r))
      .flatMap((r) => r.items)
      .filter((it) => it.t === "c");

  it("gives one line and one box per director", () => {
    const out = layoutByDirector(makeView(), cast);
    const placed = rowsOf(out, "main").filter((r) => !isUnplaced(r));
    expect(placed).toHaveLength(4);
    // a line carries ONLY its box: it is the box that holds the films
    expect(placed.every((r) => r.items.length === 1 && r.items[0].t === "c")).toBe(true);
    expect(catsOf(out, "main").map((c) => c.label)).toEqual([
      "Varda",
      "Akerman",
      "Denis",
      UNKNOWN_DIRECTOR,
    ]);
  });

  it("orders like the grouped wall: the most visited, then the alphabet, the nameless last", () => {
    const cats = catsOf(layoutByDirector(makeView(), cast), "main");
    expect(cats.map((c) => c.items.length)).toEqual([3, 2, 1, 1]);
    // Denis and the unknown have one film each: the unknown comes after
    expect(cats.at(-1).label).toBe(UNKNOWN_DIRECTOR);
  });

  it("loses no film, and leaves none in the arrivals row", () => {
    const out = layoutByDirector(makeView(), cast);
    expect(filmIdsOf(out).sort()).toEqual(cast.map((f) => f.id).sort());
    expect(idsIn(unplacedOf(out, "main"))).toEqual([]);
  });

  it("sorts by the flags, each shelf having its own film-makers", () => {
    const out = layoutByDirector(makeView(), [
      film("a", { director: "Varda" }),
      film("b", { director: "Varda", bedside: true }),
      film("c", { director: "Akerman", archived: true }),
    ]);
    expect(catsOf(out, "main").map((c) => c.label)).toEqual(["Varda"]);
    expect(catsOf(out, "bedside").map((c) => c.label)).toEqual(["Varda"]);
    expect(catsOf(out, "reserve").map((c) => c.label)).toEqual(["Akerman"]);
  });

  it("makes an empty shelf out of an empty wall, never a view with no row", () => {
    const out = layoutByDirector(makeView(), []);
    for (const kind of SHELF_KINDS) {
      const rows = rowsOf(out, kind);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(isUnplaced(rows.at(-1))).toBe(true);
    }
  });

  it("survives reconcileView without moving anything", () => {
    const out = layoutByDirector(makeView(), cast);
    // the view is already right: the reconciliation must have nothing to say
    expect(reconcileView(out, cast)).toBe(out);
  });
});

describe("sortIntoRows", () => {
  it("sorts the films without moving categories or decors", () => {
    const view = makeView();
    const cat = makeCat({ id: "c1", items: [filmItem("b"), filmItem("a")] });
    const decor = makeDecor({ id: "d1", motif: "pin" });
    view.shelves.main.rows = [
      makeRow({ id: "r1", items: [filmItem("z"), cat, filmItem("m"), decor] }),
      makeRow({ id: "r2", items: [filmItem("c")] }),
      makeRow({ id: "r3", kind: "unplaced", items: [filmItem("zz")] }),
    ];
    const next = sortIntoRows(view, "main", (x, y) => x.id.localeCompare(y.id));
    const rows = rowsOf(next, "main");
    // the positions of the category and of the decor are unchanged
    expect(rows[0].items.map((i) => i.id)).toEqual(["c", "c1", "m", "d1"]);
    expect(rows[1].items.map((i) => i.id)).toEqual(["z"]);
    expect(rows[0].items[1].items.map((i) => i.id)).toEqual(["a", "b"]);
    // the destination row is not tidied: this is not a tidying
    expect(idsIn(rows[2])).toEqual(["zz"]);
  });
});

/* ============================================================
   LE RANGEMENT À LA MAIN, GARDÉ AVANT D'ÊTRE ÉCRASÉ

   Le défaut : « RANGER » réécrivait une étagère rangée à la main sur
   des semaines, et l'enregistrait aussitôt. Rien à récupérer.

   Ce qui est éprouvé ici est le CYCLE DE VIE de la copie, parce que
   c'est tout ce qui peut se tromper : la prendre au bon moment, ne pas
   la reprendre au mauvais, et savoir quand elle ne vaut plus rien.
   ============================================================ */
describe("keeping the hand arrangement", () => {
  const shelfOf = (view) => rowsOf(view, "main").map((r) => idsIn(r));

  const arranged = () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ id: "r1", items: [filmItem("z"), filmItem("a")] }),
      makeRow({ id: "r2", items: [filmItem("m")] }),
    ];
    return view;
  };

  it("photographs the arrangement, then leaves it alone", () => {
    const kept = keepByHand(arranged());
    expect(heldByHand(kept)).not.toBeNull();
    /* La copie ne touche pas au présent : c'est le tri qui suit qui le
       réécrit. */
    expect(shelfOf(kept)).toEqual([["z", "a"], ["m"]]);
  });

  it("does NOT photograph the second time, which would keep a sort", () => {
    /* Trier par année puis par note est ordinaire. Si le second tri
       reprenait une copie, elle photographierait le PREMIER TRI — qui
       n'est le rangement de personne — et le rangement à la main serait
       perdu aussi sûrement qu'avant. */
    const first = keepByHand(arranged());
    const sorted = sortIntoRows(first, "main", (x, y) => x.id.localeCompare(y.id));
    const second = keepByHand(sorted);
    expect(heldByHand(second)).toEqual(heldByHand(first));
    expect(second.byHand.at).toBe(first.byHand.at);
  });

  it("gives the arrangement back, and stops offering it", () => {
    const kept = keepByHand(arranged());
    const sorted = sortIntoRows(kept, "main", (x, y) => x.id.localeCompare(y.id));
    expect(shelfOf(sorted)).toEqual([["a", "m"], ["z"]]);

    const back = restoreByHand(sorted);
    expect(shelfOf(back)).toEqual([["z", "a"], ["m"]]);
    /* Rendue, la copie n'a plus de raison d'être : elle EST le présent,
       et un bouton qui reproposerait la même chose ne dirait rien. */
    expect(heldByHand(back)).toBeNull();
    expect("byHand" in back).toBe(false);
  });

  it("forgets it as soon as one places a card by hand again", () => {
    /* C'est la règle qui rend le bouton honnête. Sans elle, « revenir au
       rangement à la main » rendrait une version PLUS ANCIENNE que le
       geste qu'on vient de faire, et l'écraserait. */
    const kept = keepByHand(arranged());
    expect(heldByHand(forgetByHand(kept))).toBeNull();
    /* Et sur une vue qui n'en tient pas, c'est sans effet — pas une
       copie de plus, pas un rendu de plus. */
    const plain = arranged();
    expect(forgetByHand(plain)).toBe(plain);
  });

  it("says nothing rather than guessing, when there is nothing kept", () => {
    const plain = arranged();
    expect(heldByHand(plain)).toBeNull();
    expect(restoreByHand(plain)).toBe(plain);
  });
});

describe("buildViewsFromLegacy", () => {
  const films = [
    film("f1", { order: 10, addedAt: 1 }),
    film("f2", { order: 20, addedAt: 2 }),
    film("f3", { order: 30, addedAt: 3 }),
    film("f4", { order: 40, addedAt: 4 }),
    film("nul1", { order: null, addedAt: 5 }),
    film("nul2", { order: null, addedAt: 6 }),
  ];
  const dividers = [
    { id: "d1", wall: "watched", shelf: "main", label: "Cultes", perRow: 4, order: 15 },
    { id: "d2", wall: "watched", shelf: "main", label: "Polars", perRow: 8, order: 35 },
  ];
  const wallPrefs = { watched: { perRow: 6 }, watchlist: { perRow: "auto" } };

  const build = () => buildViewsFromLegacy({ films, dividers, wallPrefs });

  it("each divider becomes a row whose category swallows what followed it", () => {
    const view = build().find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main");
    // f1 alone before the first cardstock, then Cultes(f2,f3), then Polars(f4)
    expect(idsIn(rows[0])).toEqual(["f1"]);
    expect(rows[0].perRow).toBe(6);

    expect(rows[1].items[0]).toMatchObject({ t: "c", label: "Cultes" });
    expect(rows[1].perRow).toBe(4);
    expect(rows[1].items[0].items.map((i) => i.id)).toEqual(["f2", "f3"]);

    expect(rows[2].items[0]).toMatchObject({ t: "c", label: "Polars" });
    expect(rows[2].perRow).toBe(8);
    expect(rows[2].items[0].items.map((i) => i.id)).toEqual(["f4"]);
  });

  it("films never filed take planks, without falling into the last category", () => {
    const view = build().find((v) => v.wall === "watched");
    // the point of the fix: `order: null` was worth MAX_SAFE_INTEGER in
    // the old sort, so they would have fallen into "Polars"
    expect(rowsOf(view, "main")[2].items[0].items.map((i) => i.id)).toEqual(["f4"]);
    /* And neither do they pile up in the airlock: for whoever has never
       tidied by hand, that is their WHOLE collection — the shelf would
       then have shown nothing but an empty row and an endless line. */
    expect(idsIn(unplacedOf(view, "main"))).toEqual([]);
    expect(idsIn(rowsOf(view, "main")[3])).toEqual(["nul1", "nul2"]);
  });

  it("a collection never filed by hand takes a plank, not the airlock", () => {
    const never = Array.from({ length: 25 }, (_, i) => film(`x${i}`, { order: null, addedAt: i }));
    const view = buildViewsFromLegacy({ films: never }).find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main");
    // with no wanted count, a single row: it will fill its width
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([25]);
    expect(idsIn(unplacedOf(view, "main"))).toEqual([]);
  });

  it("cuts, on the other hand, to the count the earlier wall had chosen", () => {
    const never = Array.from({ length: 25 }, (_, i) => film(`x${i}`, { order: null, addedAt: i }));
    const view = buildViewsFromLegacy({
      films: never,
      wallPrefs: { watched: { perRow: 6 } },
    }).find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main").filter((r) => !isUnplaced(r));
    expect(rows.map((r) => r.items.length)).toEqual([6, 6, 6, 6, 1]);
    expect(rows.every((r) => r.perRow === 6)).toBe(true);
  });

  it("an airlock already overflowing empties onto planks, keeping the order", () => {
    const view = makeView();
    view.version = 1;
    view.shelves.main.rows = [
      makeRow({ perRow: 10, items: [] }),
      makeRow({ kind: "unplaced", items: Array.from({ length: 23 }, (_, i) => filmItem(`s${i}`)) }),
    ];
    const rows = rowsOf(upgradeView(view), "main");
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([23]);
    expect(idsIn(rows.at(-1))).toEqual([]);
    expect(filmIdsOf(upgradeView(view))).toEqual(Array.from({ length: 23 }, (_, i) => `s${i}`));
  });

  it("gives neighbouring categories distinct colours", () => {
    const view = build().find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main");
    expect(rows[1].items[0].color).not.toBe(rows[2].items[0].color);
    expect(CAT_KEYS).toContain(rows[1].items[0].color);
  });

  it("offers the original filing, then the shelf by film-maker to a wall that has films", () => {
    const views = build();
    /* The original first: it is the one that stays the view opened by
       default, and the second glance does not impose itself. The
       watchlist wall is empty in this test set, and two empty shelves
       are not a choice. */
    expect(views.map((v) => `${v.wall} · ${v.name}`)).toEqual([
      "watched · Rangement d'origine",
      "watched · Par réalisateur",
      "watchlist · Rangement d'origine",
    ]);
    for (const v of views) expect(Object.keys(v.shelves).sort()).toEqual([...SHELF_KINDS].sort());
  });

  it("is deterministic: two runs give the same arrangement", () => {
    const strip = (v) => JSON.stringify(v, (k, x) => (k === "id" ? "#" : x));
    expect(build().map(strip)).toEqual(build().map(strip));
  });

  it("forgets no film — each view on its own covers its wall's collection", () => {
    const ids = films.map((f) => f.id).sort();
    const views = build();
    for (const v of views.filter((v) => v.wall === "watched"))
      expect(filmIdsOf(v).sort()).toEqual(ids);
    // and the wall opposite claims nothing that is not its own
    expect(views.filter((v) => v.wall === "watchlist").flatMap(filmIdsOf)).toEqual([]);
  });
});

describe("duplicateView", () => {
  it("renews the arrangement identifiers and keeps the films'", () => {
    const view = makeView();
    view.shelves.main.rows[0].items = [
      makeCat({ id: "c1", items: [filmItem("f1")] }),
      filmItem("f2"),
    ];
    const copy = duplicateView(view);

    expect(copy.id).not.toBe(view.id);
    expect(copy.shelves.main.rows[0].id).not.toBe(view.shelves.main.rows[0].id);
    expect(copy.shelves.main.rows[0].items[0].id).not.toBe("c1");
    expect(filmIdsOf(copy)).toEqual(filmIdsOf(view));
    // and the original has not moved
    expect(view.shelves.main.rows[0].items[0].id).toBe("c1");
  });
});

/* ------------------------------------------------------------
   The decor — a field that exists only if it has been touched
   ------------------------------------------------------------ */

describe("the view's decor", () => {
  it("is absent from a fresh view", () => {
    expect(makeView()).not.toHaveProperty("decor");
    expect(wallDecorOf(makeView())).toBeNull();
    expect(plankDecorOf(makeView())).toBeNull();
  });

  it("is written facet by facet, without touching the others", () => {
    let v = patchViewDecor(makeView(), "wall", { paint: "sauge" });
    v = patchViewDecor(v, "plank", { material: "laiton" });
    v = patchViewDecor(v, "wall", { pattern: "pois" });

    expect(wallDecorOf(v)).toEqual({ paint: "sauge", pattern: "pois" });
    expect(plankDecorOf(v)).toEqual({ material: "laiton" });
  });

  /* A `decor: {}` and an absence of decor would mean the same thing;
     two ways of saying one thing is one too many, and it is the one that
     reads as "there is a decor" that we set aside. */
  it("disappears entirely when its last setting is erased", () => {
    const v = patchViewDecor(makeView(), "wall", { paint: "nuit" });
    expect(patchViewDecor(v, "wall", { paint: null })).not.toHaveProperty("decor");
  });

  it("clears at one go to come back to the theme", () => {
    let v = patchViewDecor(makeView(), "wall", { paint: "nuit" });
    v = patchViewDecor(v, "plank", { material: "verre" });
    const back = clearViewDecor(v);
    expect(back).not.toHaveProperty("decor");
    expect(back.theme).toBe("kraft");
    // and the original has not moved
    expect(v.decor.wall.paint).toBe("nuit");
  });

  /* The reason why there is no migration to write: every transformation
     rebuilds the view by spreading. If one of them ever started listing
     the fields by hand, this test is what would say so. */
  it("survives the arrangement transformations", () => {
    let v = patchViewDecor(makeView(), "wall", { paint: "terracotta", texture: "crepi" });
    v.shelves.main.rows[0].items = [filmItem("f1")];

    const films = [{ id: "f1", status: "watched" }];
    for (const pass of [
      (x) => upgradeView({ ...x, version: 1 }),
      (x) => reflowView(x),
      (x) => reconcileView(x, films),
      (x) => duplicateView(x),
      (x) => moveItem(x, { id: "f1" }, { kind: "bedside", rowId: x.shelves.bedside.rows[0].id }),
    ]) {
      expect(wallDecorOf(pass(v))).toEqual({ paint: "terracotta", texture: "crepi" });
    }
  });
});

/* ============================================================
   LE PLAFOND DE POSE

   On pose autant d'exemplaires qu'on en possède. Le compte se fait sur
   TOUTES les vues à la fois — une vue est une disposition de la même
   collection, pas une étagère de plus — et il traverse les boîtes, qui
   étaient la façon la plus simple de le contourner.
   ============================================================ */
describe("countPlacedMotifs", () => {
  const viewWith = (id, items, wall = []) => {
    const v = makeView({ id, wall: "watched", name: id, now: 1 });
    v.shelves.main.rows[0].items.push(...items);
    v.shelves.main.wall = wall;
    return v;
  };

  it("ne compte rien sur un classeur vide", () => {
    expect(countPlacedMotifs({})).toEqual({});
    expect(countPlacedMotifs(undefined)).toEqual({});
  });

  it("compte les objets posés, par motif", () => {
    const v = viewWith("v1", [
      makeDecor({ id: "d1", motif: "won:lampe" }),
      makeDecor({ id: "d2", motif: "won:lampe" }),
      makeDecor({ id: "d3", motif: "plante" }),
    ]);
    expect(countPlacedMotifs({ v1: v })).toEqual({ "won:lampe": 2, plante: 1 });
  });

  /* LE POINT DU BLOC : deux vues sont deux dispositions, pas deux
     étagères. Compter par vue aurait donné un exemplaire gratuit par
     vue créée. */
  it("additionne à travers les vues", () => {
    const a = viewWith("v1", [makeDecor({ id: "d1", motif: "won:lampe" })]);
    const b = viewWith("v2", [makeDecor({ id: "d2", motif: "won:lampe" })]);
    expect(countPlacedMotifs({ v1: a, v2: b })["won:lampe"]).toBe(2);
  });

  it("compte aussi ce qui est accroché au fond", () => {
    const v = viewWith("v1", [], [makeWallDecor({ id: "w1", motif: "won:cadran" })]);
    expect(countPlacedMotifs({ v1: v })["won:cadran"]).toBe(1);
  });

  /* RANGER DANS UNE BOÎTE NE FAIT PAS DISPARAÎTRE : sans cette ligne, le
     plafond se contourne en glissant l'objet dans une catégorie. */
  it("voit ce qui est rangé dans une boîte", () => {
    const box = makeCat({ id: "c1", items: [makeDecor({ id: "d1", motif: "won:lampe" })] });
    const v = viewWith("v1", [box]);
    expect(countPlacedMotifs({ v1: v })["won:lampe"]).toBe(1);
  });

  it("ne compte pas les films", () => {
    const v = viewWith("v1", [filmItem("f1"), makeDecor({ id: "d1", motif: "won:lampe" })]);
    expect(countPlacedMotifs({ v1: v })).toEqual({ "won:lampe": 1 });
  });
});
