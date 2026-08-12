import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { splitRow, useRowCap, FALLBACK_CAP } from "./lines";
import { BOX_W, GAP_X } from "./constants";
import { makeCat, makeDecor, filmItem } from "../../shelf-views";

/* A line is read as one sees it: each segment returned by its length in
   cells, and a box by the number of films it lays there. */
const shape = (lines) =>
  lines.map((line) =>
    line.map((s) =>
      s.t === "c"
        ? `${s.cat.id}[${s.items.length}]${s.first ? "^" : ""}${s.last ? "$" : ""}`
        : s.it.id
    )
  );

const films = (...ids) => ids.map(filmItem);

describe("splitRow — le découpage d'une rangée en lignes de bois", () => {
  it("pose autant de boîtiers que la ligne a de cases, puis passe à la suivante", () => {
    expect(shape(splitRow(films("a", "b", "c", "d", "e"), 2))).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("rend une ligne vide plutôt qu'aucune : elle a quand même sa planche", () => {
    expect(splitRow([], 4)).toEqual([[]]);
  });

  /* The heart of the matter: the box no longer wraps inside itself, it
     OVERFLOWS — and the line below comes with its wood. */
  it("coupe une boîte trop grande en segments, un par ligne", () => {
    const cat = makeCat({ id: "c1", items: films("a", "b", "c", "d", "e") });
    expect(shape(splitRow([cat], 2))).toEqual([["c1[2]^"], ["c1[2]"], ["c1[1]$"]]);
  });

  it("laisse la boîte démarrer sur les cases qui restent", () => {
    const cat = makeCat({ id: "c1", items: films("x", "y", "z") });
    expect(shape(splitRow([filmItem("a"), cat, filmItem("b")], 3))).toEqual([
      ["a", "c1[2]^"],
      ["c1[1]$", "b"],
    ]);
  });

  it("tient une boîte entière sur une ligne quand elle y tient", () => {
    const cat = makeCat({ id: "c1", items: films("x", "y") });
    expect(shape(splitRow([cat, filmItem("a")], 4))).toEqual([["c1[2]^$", "a"]]);
  });

  it("donne sa case à une boîte vide : elle porte l'invite", () => {
    const cat = makeCat({ id: "c1", items: [] });
    expect(shape(splitRow([cat, filmItem("a")], 2))).toEqual([["c1[0]^$", "a"]]);
  });

  it("compte le mobilier comme un boîtier", () => {
    const d = makeDecor({ id: "d1", motif: "plant" });
    expect(shape(splitRow([filmItem("a"), d, filmItem("b")], 2))).toEqual([["a", "d1"], ["b"]]);
  });

  /* A decor is worth one cell only as long as it is that size. At the
     large calibres it takes two or three, and paying for only one made the
     line overflow its board — the overflow pushing the whole page,
     horizontal scrollbar included. */
  it("fait payer au gros mobilier les cases qu'il occupe", () => {
    const petit = makeDecor({ id: "d1", motif: "plant" });
    const gros = makeDecor({ id: "d2", motif: "plant", size: 4.6 });
    // at calibre M it lets two cases fit; in XXXL it takes all three cells
    expect(shape(splitRow([petit, filmItem("a"), filmItem("b")], 3))).toEqual([["d1", "a", "b"]]);
    expect(shape(splitRow([gros, filmItem("a"), filmItem("b")], 3))).toEqual([["d2"], ["a", "b"]]);
  });

  it("renvoie à la ligne ce qu'un gros décor ne laisse plus tenir", () => {
    const gros = makeDecor({ id: "d1", motif: "plant", size: 2.2 });
    expect(shape(splitRow([filmItem("a"), gros, filmItem("b")], 3))).toEqual([["a", "d1"], ["b"]]);
  });

  /* The cost holds INSIDE a box too. It did not, and that is where the
     overflow came back from: the box cut its content by the number of
     objects, an XXXL decor swelled the card well beyond its board, and the
     card pushed the page. */
  it("fait payer ses cases au gros mobilier rangé dans une boîte", () => {
    const gros = makeDecor({ id: "d1", motif: "plant", size: 4.6 });
    const cat = makeCat({ id: "c1", items: [...films("a", "b"), gros, filmItem("c")] });
    // two films, then the decor alone on its line (three cells), then the rest
    expect(shape(splitRow([cat], 3))).toEqual([["c1[2]^"], ["c1[1]"], ["c1[1]$"]]);
  });

  it("emporte au moins un objet par tranche de boîte, même démesuré", () => {
    const gros = makeDecor({ id: "d1", motif: "plant", size: 4.6 });
    const cat = makeCat({ id: "c1", items: [gros, filmItem("a")] });
    expect(shape(splitRow([cat], 1))).toEqual([["c1[1]^"], ["c1[1]$"]]);
  });

  /* A board too narrow for the object has nothing better to offer than its
     whole line: opening an empty line in front of it would only push the
     problem one notch further, indefinitely. */
  it("donne la ligne entière à un décor plus large qu'elle", () => {
    const huge = makeDecor({ id: "d1", motif: "plant", size: 4.6 });
    expect(shape(splitRow([huge, filmItem("a")], 1))).toEqual([["d1"], ["a"]]);
  });

  it("tient avec une seule case par ligne", () => {
    const cat = makeCat({ id: "c1", items: films("x", "y") });
    expect(shape(splitRow([cat], 1))).toEqual([["c1[1]^"], ["c1[1]$"]]);
  });

  it("se rabat sur une case plutôt que de boucler sur un compte absurde", () => {
    expect(shape(splitRow(films("a", "b"), 0))).toEqual([["a"], ["b"]]);
    expect(shape(splitRow(films("a", "b"), -3))).toEqual([["a"], ["b"]]);
  });

  it("garde des clés distinctes pour deux segments de la même boîte", () => {
    const cat = makeCat({ id: "c1", items: films("x", "y", "z") });
    const keys = splitRow([cat], 2)
      .flat()
      .map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/* "auto" is no longer the absence of a count, it is the WIDTH's count.
   jsdom lays nothing out and has no `ResizeObserver`: we lend it one, and
   dictate the width to it. What we keep here is the arithmetic and the
   hold-back — the one that avoids rendering the row at every pixel of the
   window handle. */
describe("useRowCap — le compte d'une largeur", () => {
  const SLOT = BOX_W + GAP_X;
  let observed;

  const stub = () => {
    observed = [];
    class RO {
      constructor(cb) {
        this.cb = cb;
        observed.push(this);
      }
      observe(el) {
        this.el = el;
      }
      disconnect() {
        this.gone = true;
      }
    }
    vi.stubGlobal("ResizeObserver", RO);
  };

  const rowOf = (width) => ({
    current: { getBoundingClientRect: () => ({ width }) },
  });

  /* The LAST observer laid down, and not the first: React can mount an
     effect twice, and the first has then already been released. */
  const grow = (width) =>
    act(() => {
      observed.at(-1).cb([{ contentRect: { width } }]);
    });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("rend le compte écrit sans rien mesurer", () => {
    stub();
    const { result } = renderHook(() => useRowCap(rowOf(2000), 4));
    expect(result.current).toBe(4);
    expect(observed).toHaveLength(0);
  });

  it("mesure dès la pose, sans attendre un redimensionnement", () => {
    stub();
    // six full cells, plus the inner padding and one cell's floor
    const { result } = renderHook(() => useRowCap(rowOf(20 + 6 * SLOT + 40), null));
    expect(result.current).toBe(6);
  });

  it("suit la largeur quand elle change", () => {
    stub();
    const ref = rowOf(20 + 10 * SLOT);
    const { result } = renderHook(() => useRowCap(ref, null));
    expect(result.current).toBe(10);
    grow(20 + 3 * SLOT);
    expect(result.current).toBe(3);
  });

  it("ne descend jamais sous une case", () => {
    stub();
    const ref = rowOf(1000);
    const { result } = renderHook(() => useRowCap(ref, null));
    grow(30);
    expect(result.current).toBe(1);
  });

  it("ignore une largeur nulle : ce n'est pas une rangée étroite", () => {
    stub();
    const { result } = renderHook(() => useRowCap(rowOf(0), null));
    expect(result.current).toBe(FALLBACK_CAP);
  });

  it("se rabat sur un compte tenable là où l'on ne sait pas mesurer", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { result } = renderHook(() => useRowCap(rowOf(900), null));
    expect(result.current).toBe(FALLBACK_CAP);
  });

  it("lâche ce qu'il observait quand la rangée s'en va", () => {
    stub();
    const { unmount } = renderHook(() => useRowCap(rowOf(900), null));
    unmount();
    expect(observed.every((o) => o.gone)).toBe(true);
  });
});
