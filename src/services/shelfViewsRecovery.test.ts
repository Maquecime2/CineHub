/* ============================================================
   RÉCUPÉRER DES VUES VENUES DE « LA PIÈCE »
   ============================================================

   Le cas réel, et il s'est produit : une version de ce classeur a fondu
   les deux murs en quatre rayons, réécrit les documents SUR PLACE et
   changé la forme de l'index. Revenu ici, `loadViewIndex` ne reconnaît
   plus rien, « un index absent » fait tomber `ensureViews` dans
   `buildViewsFromLegacy` — et le classeur FABRIQUE des vues neuves
   par-dessus des vraies qui dorment au coffre.

   Rien n'est effacé : `ensureViews` n'écrit que des `store.set`. Ce qui
   se garde ici est qu'on les RETROUVE, et qu'on ne perde pas au passage
   ce qui était rangé sur la pile.
   ============================================================ */
import { describe, it, expect, beforeEach } from "vitest";
import { ensureViews, orphanViews, adoptViews, VIEW_INDEX, viewKey } from "./shelfViews";
import { store } from "./storage";

const row = (...ids: string[]) => ({
  id: `r_${ids.join("")}`,
  kind: "normal",
  perRow: null,
  label: "",
  items: ids.map((id) => ({ t: "f", id })),
});
const airlock = { id: "u", kind: "unplaced", perRow: null, label: "", items: [] };
const bare = { rows: [airlock], wall: [] };

/** Un document tel que « la pièce » l'a écrit : pas de `wall`, un `pile`. */
const room = (id: string, { pile = [] as unknown[], main = [] as unknown[] } = {}) => ({
  id,
  version: 3,
  name: `vue ${id}`,
  theme: "kraft",
  createdAt: 1,
  updatedAt: 2,
  shelves: {
    pile: { rows: [...pile, airlock], wall: [] },
    bedside: bare,
    main: { rows: [...main, airlock], wall: [] },
    reserve: bare,
  },
});

const nothing = { films: [], dividers: [], wallPrefs: {} };

beforeEach(() => {
  localStorage.clear();
  for (const k of store.keys()) store.remove(k);
});

describe("un index de « la pièce » se lit encore", () => {
  it("reprend les vues nommées au lieu d'en fabriquer d'autres", () => {
    store.set(viewKey("v1"), room("v1", { main: [row("a", "b")] }));
    store.set(VIEW_INDEX, { version: 3, order: ["v1"] });

    const out = ensureViews(nothing);
    /* L'identité est gardée : ce sont VOS vues, pas des neuves qui leur
       ressemblent. */
    expect(Object.keys(out.docs)).toEqual(["v1"]);
    expect(out.byWall.watched).toEqual(["v1"]);
  });

  it("REPOSE LA PILE, et ne la laisse pas disparaître", () => {
    store.set(viewKey("v2"), room("v2", { pile: [row("x", "y")] }));
    store.set(VIEW_INDEX, { version: 3, order: ["v2"] });

    const out = ensureViews(nothing);
    expect(out.byWall.watchlist).toEqual(["v2"]);
    const doc = out.docs.v2 as { shelves: { main: { rows: { items: { id: string }[] }[] } } };
    expect(doc.shelves.main.rows.flatMap((r) => r.items.map((i) => i.id))).toEqual(["x", "y"]);
  });

  it("réécrit l'index À LA FORME D'ICI, une fois", () => {
    store.set(viewKey("v1"), room("v1", { main: [row("a")] }));
    store.set(VIEW_INDEX, { version: 3, order: ["v1"] });
    ensureViews(nothing);
    /* Sans cette écriture on referait la reprise à chaque ouverture, et
       c'est l'index illisible qui partirait à la synchro. */
    expect(store.get<{ byWall?: unknown }>(VIEW_INDEX, {}).byWall).toBeTruthy();
  });
});

describe("les vues devenues orphelines", () => {
  it("SE VOIENT, alors que la garde d'avant les rejetait toutes", () => {
    store.set(viewKey("perdue"), room("perdue", { main: [row("a")] }));
    store.set(VIEW_INDEX, { version: 2, byWall: { watched: [], watchlist: [] } });
    /* La garde exigeait `wall` ; un document de « la pièce » n'en porte
       plus, donc le panneau annonçait « rien à récupérer » exactement
       quand il y avait tout à récupérer. */
    expect(orphanViews().map((v) => v.id)).toEqual(["perdue"]);
  });

  it("se reprennent EN SE RETRANSFORMANT", () => {
    store.set(viewKey("mixte"), room("mixte", { main: [row("a")], pile: [row("x")] }));
    store.set(VIEW_INDEX, { version: 2, byWall: { watched: [], watchlist: [] } });

    /* Les deux côtés sont garnis : on ne choisit pas, on rend DEUX vues
       — sinon la pile s'effacerait au premier `reconcileView`. */
    expect(adoptViews(["mixte"])).toBe(2);
    const idx = store.get<{ byWall: Record<string, string[]> }>(VIEW_INDEX, {
      byWall: { watched: [], watchlist: [] },
    });
    expect(idx.byWall.watched).toEqual(["mixte"]);
    expect(idx.byWall.watchlist).toEqual(["mixte-a-voir"]);
  });

  it("ne propose pas ce que l'index nomme déjà, dans l'une ou l'autre forme", () => {
    store.set(viewKey("v1"), room("v1"));
    store.set(VIEW_INDEX, { version: 3, order: ["v1"] });
    expect(orphanViews()).toEqual([]);
  });
});
