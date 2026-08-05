import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { splitRow, useRowCap, FALLBACK_CAP } from "./lines";
import { BOX_W, GAP_X } from "./constants";
import { makeCat, makeDecor, filmItem } from "../../shelf-views";

/* Une ligne se lit comme on la voit : chaque segment rendu par sa longueur
   en cases, et une boîte par le nombre de films qu'elle y pose. */
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

  /* Le cœur de l'affaire : la boîte ne se replie plus sur elle-même, elle
     DÉBORDE — et la ligne du dessous vient avec son bois. */
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

  /* Un décor ne vaut une case que tant qu'il en fait la taille. Aux
     grands calibres il en occupe deux ou trois, et n'en payer qu'une
     faisait déborder la ligne de sa planche — le débord poussant la page
     entière, barre de défilement horizontale comprise. */
  it("fait payer au gros mobilier les cases qu'il occupe", () => {
    const petit = makeDecor({ id: "d1", motif: "plant" });
    const gros = makeDecor({ id: "d2", motif: "plant", size: 4.6 });
    // au calibre M il laisse tenir deux boîtiers ; en XXXL il prend les trois cases
    expect(shape(splitRow([petit, filmItem("a"), filmItem("b")], 3))).toEqual([["d1", "a", "b"]]);
    expect(shape(splitRow([gros, filmItem("a"), filmItem("b")], 3))).toEqual([["d2"], ["a", "b"]]);
  });

  it("renvoie à la ligne ce qu'un gros décor ne laisse plus tenir", () => {
    const gros = makeDecor({ id: "d1", motif: "plant", size: 2.2 });
    expect(shape(splitRow([filmItem("a"), gros, filmItem("b")], 3))).toEqual([["a", "d1"], ["b"]]);
  });

  /* Le coût vaut aussi DANS une boîte. Il n'y valait pas, et c'est par
     là que le débord revenait : la boîte tranchait son contenu au nombre
     d'objets, un décor en XXXL y gonflait le carton bien au-delà de sa
     planche, et le carton poussait la page. */
  it("fait payer ses cases au gros mobilier rangé dans une boîte", () => {
    const gros = makeDecor({ id: "d1", motif: "plant", size: 4.6 });
    const cat = makeCat({ id: "c1", items: [...films("a", "b"), gros, filmItem("c")] });
    // deux films, puis le décor seul sur sa ligne (trois cases), puis le reste
    expect(shape(splitRow([cat], 3))).toEqual([["c1[2]^"], ["c1[1]"], ["c1[1]$"]]);
  });

  it("emporte au moins un objet par tranche de boîte, même démesuré", () => {
    const gros = makeDecor({ id: "d1", motif: "plant", size: 4.6 });
    const cat = makeCat({ id: "c1", items: [gros, filmItem("a")] });
    expect(shape(splitRow([cat], 1))).toEqual([["c1[1]^"], ["c1[1]$"]]);
  });

  /* Une planche trop étroite pour l'objet n'a rien de mieux à offrir que
     sa ligne entière : ouvrir une ligne vide devant lui ne ferait que
     repousser le problème d'un cran, indéfiniment. */
  it("donne la ligne entière à un décor plus large qu'elle", () => {
    const énorme = makeDecor({ id: "d1", motif: "plant", size: 4.6 });
    expect(shape(splitRow([énorme, filmItem("a")], 1))).toEqual([["d1"], ["a"]]);
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

/* « auto » n'est plus l'absence de compte, c'est le compte de la LARGEUR.
   jsdom ne met rien en page et n'a pas de `ResizeObserver` : on lui en
   prête un, et on lui dicte la largeur. Ce qu'on garde ici, c'est
   l'arithmétique et la retenue — celle qui évite de rendre la rangée à
   chaque pixel de la poignée de fenêtre. */
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

  /* Le DERNIER observateur posé, et non le premier : React peut monter un
     effet deux fois, et le premier a alors déjà été lâché. */
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
    // six cases pleines, plus la marge intérieure et un fond de case
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
