import { describe, it, expect } from "vitest";
import {
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

/* Un film réduit à ce dont l'étagère a besoin. */
const film = (id, extra = {}) => ({
  id,
  title: id,
  addedAt: 1000,
  status: "watched",
  chevet: false,
  archived: false,
  order: null,
  ...extra,
});

const unplacedOf = (view, kind) => view.shelves[kind].rows.at(-1);
const rowsOf = (view, kind) => view.shelves[kind].rows;
const idsIn = (row) => row.items.map((it) => it.id);

/* TOUS les identifiants d'objets d'une vue, boîtes ouvertes comprises.

   Il servait à écrire « ce bibelot n'est plus nulle part », et cela se
   disait jusqu'ici en cherchant son id dans le JSON de la vue entière.
   Mais une vue est pleine d'identifiants tirés au sort, et « d1 » finit
   par tomber au milieu de l'un d'eux — `r_nd1p7is9…` — un jour sur
   quelques dizaines. Le test échouait alors sans que rien ne soit cassé.

   On regarde donc les identifiants comme des identifiants, et non comme
   une sous-chaîne d'un gros texte. */
const allItemIds = (view) =>
  Object.values(view.shelves)
    .flatMap((s) => s.rows)
    .flatMap((r) => r.items)
    .flatMap((it) => (it.t === "c" ? [it.id, ...(it.items || []).map((i) => i.id)] : [it.id]));

/* Une boîte, où qu'elle soit posée dans la vue. */
const catIn = (view, catId, kind = "main") =>
  rowsOf(view, kind)
    .flatMap((r) => r.items)
    .find((it) => it.t === "c" && it.id === catId);

describe("appartenance à un rayon", () => {
  it("les drapeaux du film, et eux seuls, décident du rayon", () => {
    expect(kindOf(film("a"))).toBe("main");
    expect(kindOf(film("a", { chevet: true }))).toBe("chevet");
    expect(kindOf(film("a", { archived: true }))).toBe("reserve");
    // archivé l'emporte : un film de chevet mis de côté est mis de côté
    expect(kindOf(film("a", { chevet: true, archived: true }))).toBe("reserve");
    expect(belongs.chevet(film("a", { chevet: true, archived: true }))).toBe(false);
  });

  it("un film à voir n'est jamais de chevet : on ne revoit pas ce qu'on n'a pas vu", () => {
    const aVoir = film("a", { chevet: true, status: "watchlist" });
    expect(kindOf(aVoir)).toBe("main");
    expect(belongs.chevet(aVoir)).toBe(false);
    // et il ne disparaît pas pour autant : la collection le recueille
    expect(belongs.main(aVoir)).toBe(true);
  });
});

describe("reconcileView", () => {
  it("recueille dans la rangée d'arrivée tout film que la vue ignore", () => {
    const view = makeView({ wall: "watched" });
    const films = [film("f1"), film("f2")];
    const next = reconcileView(view, films);
    expect(idsIn(unplacedOf(next, "main"))).toEqual(["f1", "f2"]);
  });

  it("rend le MÊME objet quand rien n'a changé", () => {
    const films = [film("f1")];
    const once = reconcileView(makeView(), films);
    // la stabilité référentielle est ce qui permet de mémoïser les
    // rangées : un nouvel objet à chaque rendu repeindrait tout le rayon
    expect(reconcileView(once, films)).toBe(once);
  });

  it("retire un film supprimé, où qu'il se trouve", () => {
    const cat = makeCat({ items: [filmItem("f2")] });
    const view = makeView();
    view.shelves.main.rows[0].items = [filmItem("f1"), cat];
    const next = reconcileView(view, [film("f1")]);
    expect(filmIdsOf(next)).toEqual(["f1"]);
  });

  it("déménage un film archivé du rayon principal vers l'arrivée du tiroir", () => {
    const view = makeView();
    view.shelves.main.rows[0].items = [filmItem("f1")];
    const next = reconcileView(view, [film("f1", { archived: true })]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual([]);
    expect(idsIn(unplacedOf(next, "reserve"))).toEqual(["f1"]);
  });

  it("dédoublonne : un film n'occupe qu'une place", () => {
    const view = makeView();
    view.shelves.main.rows[0].items = [filmItem("f1"), filmItem("f1")];
    const next = reconcileView(view, [film("f1")]);
    expect(filmIdsOf(next)).toEqual(["f1"]);
  });

  it("garantit une seule rangée d'arrivée, en dernier", () => {
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

  it("réordonne dans une rangée", () => {
    const next = moveItem(
      seed(),
      { id: "f2" },
      { kind: "main", rowId: "r1", overId: "f1", side: "before" }
    );
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "f1", "c1"]);
  });

  it("déplace vers une autre rangée, en fin quand rien n'est visé", () => {
    const next = moveItem(seed(), { id: "f1" }, { kind: "main", rowId: "r2" });
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "c1"]);
    expect(idsIn(rowsOf(next, "main")[1])).toEqual(["f1"]);
  });

  it("fait entrer un film dans une catégorie", () => {
    const next = moveItem(seed(), { id: "f1" }, { kind: "main", rowId: "r1", catId: "c1" });
    const cat = rowsOf(next, "main")[0].items.find((i) => i.id === "c1");
    expect(cat.items.map((i) => i.id)).toEqual(["f3", "f1"]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "c1"]);
  });

  it("fait ressortir un film d'une catégorie", () => {
    const next = moveItem(
      seed(),
      { id: "f3" },
      { kind: "main", rowId: "r1", overId: "f1", side: "before" }
    );
    const cat = rowsOf(next, "main")[0].items.find((i) => i.id === "c1");
    expect(cat.items).toEqual([]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f3", "f1", "f2", "c1"]);
  });

  it("refuse d'emboîter une catégorie dans une catégorie", () => {
    const view = seed();
    const next = moveItem(view, { id: "c1" }, { kind: "main", rowId: "r1", catId: "c1" });
    expect(next).toBe(view);
  });

  /* Ce que le refus ci-dessus oblige l'étagère à faire : une boîte qu'on
     promène au-dessus d'une autre se range À CÔTÉ d'elle. */
  it("range une catégorie à côté d'une autre, dans la rangée", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeCat({ id: "c2", items: [] }));
    const next = moveItem(
      view,
      { id: "c2" },
      { kind: "main", rowId: "r1", overId: "c1", side: "before" }
    );
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f1", "f2", "c2", "c1"]);
  });

  /* Un décor, lui, ENTRE : c'est la sous-division dont on a besoin quand
     une boîte grossit. Seule une boîte reste dehors. */
  it("fait entrer un décor dans une catégorie", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    const next = moveItem(view, { id: "d1" }, { kind: "main", rowId: "r1", catId: "c1" });
    expect(catIn(next, "c1").items.map((i) => i.id)).toEqual(["f3", "d1"]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f1", "f2", "c1"]);
  });

  it("le vise à la place voulue dans la boîte, comme un boîtier", () => {
    const view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    const next = moveItem(
      view,
      { id: "d1" },
      { kind: "main", rowId: "r1", catId: "c1", overId: "f3", side: "before" }
    );
    expect(catIn(next, "c1").items.map((i) => i.id)).toEqual(["d1", "f3"]);
  });

  it("le laisse aussi se ranger à côté de la boîte", () => {
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

  it("ressort un décor d'une boîte sans toucher aux films qui restent", () => {
    let view = seed();
    view.shelves.main.rows[0].items.push(makeDecor({ id: "d1", motif: "coffee" }));
    view = moveItem(view, { id: "d1" }, { kind: "main", rowId: "r1", catId: "c1" });
    const out = moveItem(view, { id: "d1" }, { kind: "main", rowId: "r2" });
    expect(catIn(out, "c1").items.map((i) => i.id)).toEqual(["f3"]);
    expect(idsIn(rowsOf(out, "main")[1])).toEqual(["d1"]);
  });

  it("déplace une catégorie entière vers une autre rangée", () => {
    const next = moveItem(seed(), { id: "c1" }, { kind: "main", rowId: "r2" });
    expect(idsIn(rowsOf(next, "main")[1])).toEqual(["c1"]);
    const cat = rowsOf(next, "main")[1].items[0];
    expect(cat.items.map((i) => i.id)).toEqual(["f3"]);
  });

  it("une couture ouvre une rangée qui hérite du cap de celle du dessus", () => {
    const view = seed();
    view.shelves.main.rows[0].perRow = 6;
    const next = moveItem(view, { id: "f1" }, { kind: "main", afterRowId: "r1" });
    const rows = rowsOf(next, "main");
    expect(rows).toHaveLength(4);
    expect(idsIn(rows[1])).toEqual(["f1"]);
    expect(rows[1].perRow).toBe(6);
  });

  it("crée un décor sorti du cabinet", () => {
    const decor = makeDecor({ id: "d1", motif: "coffee" });
    const next = moveItem(seed(), { create: decor }, { kind: "main", rowId: "r2" });
    expect(rowsOf(next, "main")[1].items[0]).toMatchObject({ t: "d", motif: "coffee" });
  });

  it("traverse les rayons", () => {
    const view = seed();
    const next = moveItem(
      view,
      { id: "f1" },
      { kind: "chevet", rowId: rowsOf(view, "chevet")[0].id }
    );
    expect(idsIn(rowsOf(next, "chevet")[0])).toEqual(["f1"]);
    expect(idsIn(rowsOf(next, "main")[0])).toEqual(["f2", "c1"]);
  });

  it("ne fait rien si la rangée visée n'existe pas", () => {
    const view = seed();
    expect(moveItem(view, { id: "f1" }, { kind: "main", rowId: "inconnue" })).toBe(view);
  });
});

describe("le mobilier", () => {
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

  it("règle et nomme une ligne", () => {
    const next = patchRow(seed(), "r1", { perRow: 4, label: "Les cultes" });
    expect(rowsOf(next, "main")[0]).toMatchObject({ perRow: 4, label: "Les cultes" });
  });

  it("ouvre une ligne au-dessus, en dessous, ou à la fin — jamais après l'arrivée", () => {
    const before = addRow(seed(), "main", "r1", "before");
    expect(rowsOf(before, "main")[0].id).not.toBe("r1");

    const after = addRow(seed(), "main", "r1", "after");
    expect(rowsOf(after, "main")[1].id).not.toBe("r2");

    const end = addRow(seed(), "main", null, "end");
    const rows = rowsOf(end, "main");
    expect(isUnplaced(rows.at(-1))).toBe(true);
    expect(rows).toHaveLength(4);
  });

  it("la nouvelle ligne hérite du compte de celle du dessus", () => {
    const next = addRow(seed(), "main", "r1", "after");
    expect(rowsOf(next, "main")[1].perRow).toBe(6);
  });

  it("supprimer une ligne rend ses films à l'arrivée, y compris ceux d'une catégorie", () => {
    const next = removeRow(seed(), "r1");
    expect(rowsOf(next, "main").map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(idsIn(unplacedOf(next, "main")).sort()).toEqual(["f1", "f2"]);
  });

  it("refuse de supprimer la rangée d'arrivée", () => {
    const view = seed();
    expect(removeRow(view, "r3")).toBe(view);
  });

  it("vider une ligne la garde mais rend ses films", () => {
    const next = clearRow(seed(), "r1");
    expect(rowsOf(next, "main")[0].items).toEqual([]);
    expect(idsIn(unplacedOf(next, "main")).sort()).toEqual(["f1", "f2"]);
  });

  it("défaire une catégorie rend ses films et ne touche pas au reste", () => {
    const next = removeCat(seed(), "c1");
    expect(rowsOf(next, "main")[0].items.map((i) => i.id)).toEqual(["f1", "d1"]);
    expect(idsIn(unplacedOf(next, "main"))).toEqual(["f2"]);
  });

  /* Une ligne n'est pas « une catégorie et sa suite » : c'est une liste
     libre. On doit pouvoir en poser autant qu'on veut, côte à côte, et
     glisser des films entre elles — c'est ce que l'intercalaire d'avant,
     qui ouvrait forcément la ligne, interdisait. */
  it("accepte autant de catégories qu'on veut sur une même ligne", () => {
    let view = seed();
    view = addCat(view, "r1", makeCat({ id: "c2", label: "Polars" }));
    view = addCat(view, "r1", makeCat({ id: "c3", label: "Westerns" }));
    const items = rowsOf(view, "main")[0].items;
    expect(items.filter((i) => i.t === "c").map((i) => i.label)).toEqual([
      "Catégorie",
      "Polars",
      "Westerns",
    ]);

    // et elles se réordonnent librement, y compris devant un film
    const moved = moveItem(
      view,
      { id: "c3" },
      { kind: "main", rowId: "r1", overId: "f1", side: "before" }
    );
    expect(rowsOf(moved, "main")[0].items.map((i) => i.id)).toEqual(["c3", "f1", "c1", "d1", "c2"]);
  });

  it("un film entre dans l'une puis passe dans l'autre", () => {
    let view = addCat(seed(), "r1", makeCat({ id: "c2" }));
    view = moveItem(view, { id: "f1" }, { kind: "main", rowId: "r1", catId: "c1" });
    view = moveItem(view, { id: "f1" }, { kind: "main", rowId: "r1", catId: "c2" });
    const items = rowsOf(view, "main")[0].items;
    expect(items.find((i) => i.id === "c1").items.map((i) => i.id)).toEqual(["f2"]);
    expect(items.find((i) => i.id === "c2").items.map((i) => i.id)).toEqual(["f1"]);
  });

  it("repeint et renomme une catégorie", () => {
    const next = patchCat(seed(), "c1", { color: "moss", label: "Polars" });
    expect(rowsOf(next, "main")[0].items[1]).toMatchObject({ color: "moss", label: "Polars" });
  });

  it("le décor, lui, se retire pour de bon", () => {
    const next = removeDecor(seed(), "d1");
    expect(rowsOf(next, "main")[0].items.map((i) => i.id)).toEqual(["f1", "c1"]);
    expect(patchDecor(next, "d1", { size: 2 })).toBe(next);
  });

  it("redimensionne un décor", () => {
    const next = patchDecor(seed(), "d1", { size: 1.5, color: "cobalt" });
    expect(rowsOf(next, "main")[0].items[2]).toMatchObject({ size: 1.5, color: "cobalt" });
  });
});

describe("le débordement", () => {
  it("une planche pleine pousse le surplus sur la suivante", () => {
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

  it("cascade, et ouvre des planches neuves avant le sas d'arrivée", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ id: "r1", perRow: 2, items: ["a", "b", "c", "d", "e", "f", "g"].map(filmItem) }),
      makeRow({ id: "r2", kind: "unplaced", items: [filmItem("z")] }),
    ];
    const rows = rowsOf(reflowShelf(view, "main"), "main");
    expect(rows.map(idsIn)).toEqual([["a", "b"], ["c", "d"], ["e", "f"], ["g"], ["z"]]);
    // le sas reste le sas : il n'a pas recueilli le surplus
    expect(isUnplaced(rows.at(-1))).toBe(true);
    expect(rows.filter(isUnplaced)).toHaveLength(1);
  });

  it("ne touche à rien quand tout tient déjà", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ perRow: 4, items: [filmItem("a")] }),
      makeRow({ kind: "unplaced" }),
    ];
    expect(reflowShelf(view, "main")).toBe(view);
  });

  it("une rangée « auto » ne déborde pas — elle suit la largeur", () => {
    const view = makeView();
    view.shelves.main.rows = [
      makeRow({ perRow: null, items: ["a", "b", "c"].map(filmItem) }),
      makeRow({ kind: "unplaced" }),
    ];
    expect(reflowShelf(view, "main")).toBe(view);
  });

  it("une catégorie compte pour un objet, et n'est jamais coupée", () => {
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

describe("upgradeView — reprendre une vue deja enregistree", () => {
  /* Le cas rencontre pour de vrai : une vue fabriquee par la v1, ou tout
     un rayon avait ete verse dans UNE rangee sans compte. Sans reprise au
     chargement, elle reste une seule grosse ligne. */
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

  /* La grosse ligne unique de la v1 n'est plus un défaut à réparer : sans
     compte, elle se replie d'elle-même en lignes de bois, chacune avec sa
     planche. On la laisse donc telle quelle plutôt que de la débiter par
     dix, ce qui laisserait chaque planche à moitié nue. */
  it("laisse en l'état un rayon versé d'un coup : il se replie tout seul", () => {
    const out = upgradeView(v1());
    const rows = rowsOf(out, "main");
    expect(out.version).toBe(2);
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([25]);
    expect(rows.every((r) => r.perRow == null)).toBe(true);
  });

  it("n'y touche plus une fois reprise", () => {
    const once = upgradeView(v1());
    expect(upgradeView(once)).toBe(once);
  });

  it("ne perd aucun film au passage", () => {
    const before = filmIdsOf(v1()).sort();
    expect(filmIdsOf(upgradeView(v1())).sort()).toEqual(before);
  });

  it("respecte un compte deja choisi par l'utilisateur", () => {
    const view = v1();
    view.shelves.main.rows[0].perRow = 4;
    const rows = rowsOf(upgradeView(view), "main");
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([
      4, 4, 4, 4, 4, 4, 1,
    ]);
  });
});

describe("layoutView", () => {
  it("étale une collection sur une planche qui remplira sa largeur", () => {
    const films = Array.from({ length: 23 }, (_, i) => film(`f${i}`));
    const out = layoutView(makeView(), films);
    const rows = rowsOf(out, "main");
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([23]);
    expect(idsIn(unplacedOf(out, "main"))).toEqual([]);
    // rien d'imposé : la rangée prendra le compte de sa largeur
    expect(rows.every((r) => r.perRow == null)).toBe(true);
  });

  it("répartit selon les drapeaux du film", () => {
    const out = layoutView(makeView(), [
      film("a"),
      film("b", { chevet: true }),
      film("c", { archived: true }),
    ]);
    expect(idsIn(rowsOf(out, "main")[0])).toEqual(["a"]);
    expect(idsIn(rowsOf(out, "chevet")[0])).toEqual(["b"]);
    expect(idsIn(rowsOf(out, "reserve")[0])).toEqual(["c"]);
  });
});

/* Un décor rangé DANS une boîte : plusieurs fonctions du modèle ne
   savaient chercher qu'au premier niveau, et l'auraient perdu en
   silence. */
describe("un décor dans une catégorie", () => {
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

  it("survit à la réconciliation — rien dehors ne peut le démentir", () => {
    const out = reconcileView(seed(), [film("f1"), film("f2")]);
    expect(catIn(out, "c1").items.map((i) => i.id)).toEqual(["f1", "d1", "f2"]);
  });

  it("ne compte pas pour un film", () => {
    expect(filmIdsOf(seed()).sort()).toEqual(["f1", "f2"]);
  });

  it("se retouche et se retire là où il est", () => {
    expect(catIn(patchDecor(seed(), "d1", { label: "Polars" }), "c1").items[1].label).toBe(
      "Polars"
    );
    expect(catIn(removeDecor(seed(), "d1"), "c1").items.map((i) => i.id)).toEqual(["f1", "f2"]);
  });

  it("ne bouge pas quand on range la boîte", () => {
    const out = sortIntoRows(seed(), "main", (a, b) => a.id.localeCompare(b.id));
    // le décor garde sa place ; seuls les films se redistribuent autour
    expect(catIn(out, "c1").items.map((i) => i.id)).toEqual(["f1", "d1", "f2"]);
  });

  it("part avec la boîte qu'on défait, les films revenant au sas", () => {
    const out = removeCat(seed(), "c1");
    expect(idsIn(unplacedOf(out, "main")).sort()).toEqual(["f1", "f2"]);
    expect(filmIdsOf(out).sort()).toEqual(["f1", "f2"]);
    // le bibelot est du mobilier : il disparaît avec le meuble
    expect(allItemIds(out)).not.toContain("d1");
  });

  it("reçoit un identifiant neuf quand la vue est dupliquée", () => {
    const copy = duplicateView(seed(), { now: 1 });
    const inner = copy.shelves.main.rows[0].items[0].items;
    expect(inner.map((i) => i.t)).toEqual(["f", "d", "f"]);
    // les films sont les mêmes films ; le bibelot, lui, est un autre bibelot
    expect(inner[0].id).toBe("f1");
    expect(inner[1].id).not.toBe("d1");
  });
});

describe("les objets accrochés au mur", () => {
  const wallOf = (view, kind = "main") => view.shelves[kind].wall || [];

  it("accroche au point qu'on lui donne, sans toucher aux rangées", () => {
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

  it("décroche d'un rayon pour raccrocher à l'autre, sans se dédoubler", () => {
    let v = pinToWall(
      makeView(),
      "main",
      { create: makeWallDecor({ id: "w1", motif: "frame" }) },
      { x: 10, y: 10 }
    );
    v = pinToWall(v, "chevet", { id: "w1" }, { x: 80, y: 60 });
    expect(wallOf(v, "main")).toHaveLength(0);
    expect(wallOf(v, "chevet")).toEqual([expect.objectContaining({ id: "w1", x: 80, y: 60 })]);
  });

  it("se laisse retoucher et retirer comme un décor posé", () => {
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

  it("ne bouge pas quand on lui donne un id qu'aucun mur ne porte", () => {
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

  it("donne une ligne et une boîte par réalisateur", () => {
    const out = layoutByDirector(makeView(), cast);
    const placed = rowsOf(out, "main").filter((r) => !isUnplaced(r));
    expect(placed).toHaveLength(4);
    // une ligne ne porte QUE sa boîte : c'est elle qui tient les films
    expect(placed.every((r) => r.items.length === 1 && r.items[0].t === "c")).toBe(true);
    expect(catsOf(out, "main").map((c) => c.label)).toEqual([
      "Varda",
      "Akerman",
      "Denis",
      UNKNOWN_DIRECTOR,
    ]);
  });

  it("ordonne comme le mur regroupé : les plus fréquentés, puis l'alphabet, les sans-nom en dernier", () => {
    const cats = catsOf(layoutByDirector(makeView(), cast), "main");
    expect(cats.map((c) => c.items.length)).toEqual([3, 2, 1, 1]);
    // Denis et l'inconnu ont un film chacun : l'inconnu passe apres
    expect(cats.at(-1).label).toBe(UNKNOWN_DIRECTOR);
  });

  it("ne perd aucun film, et n'en laisse aucun dans la rangée d'arrivée", () => {
    const out = layoutByDirector(makeView(), cast);
    expect(filmIdsOf(out).sort()).toEqual(cast.map((f) => f.id).sort());
    expect(idsIn(unplacedOf(out, "main"))).toEqual([]);
  });

  it("répartit selon les drapeaux, chaque rayon ayant ses propres cinéastes", () => {
    const out = layoutByDirector(makeView(), [
      film("a", { director: "Varda" }),
      film("b", { director: "Varda", chevet: true }),
      film("c", { director: "Akerman", archived: true }),
    ]);
    expect(catsOf(out, "main").map((c) => c.label)).toEqual(["Varda"]);
    expect(catsOf(out, "chevet").map((c) => c.label)).toEqual(["Varda"]);
    expect(catsOf(out, "reserve").map((c) => c.label)).toEqual(["Akerman"]);
  });

  it("d'un mur vide fait une étagère vide, jamais une vue sans rangée", () => {
    const out = layoutByDirector(makeView(), []);
    for (const kind of SHELF_KINDS) {
      const rows = rowsOf(out, kind);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(isUnplaced(rows.at(-1))).toBe(true);
    }
  });

  it("survit à reconcileView sans rien deplacer", () => {
    const out = layoutByDirector(makeView(), cast);
    // la vue est deja juste : la reconciliation ne doit rien avoir a dire
    expect(reconcileView(out, cast)).toBe(out);
  });
});

describe("sortIntoRows", () => {
  it("trie les films sans déplacer catégories ni décors", () => {
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
    // les emplacements de la catégorie et du décor sont inchangés
    expect(rows[0].items.map((i) => i.id)).toEqual(["c", "c1", "m", "d1"]);
    expect(rows[1].items.map((i) => i.id)).toEqual(["z"]);
    expect(rows[0].items[1].items.map((i) => i.id)).toEqual(["a", "b"]);
    // la rangée d'arrivée n'est pas rangée : ce n'est pas un rangement
    expect(idsIn(rows[2])).toEqual(["zz"]);
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

  it("chaque intercalaire devient une rangée dont la catégorie avale ce qui suivait", () => {
    const view = build().find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main");
    // f1 seul avant le premier carton, puis Cultes(f2,f3), puis Polars(f4)
    expect(idsIn(rows[0])).toEqual(["f1"]);
    expect(rows[0].perRow).toBe(6);

    expect(rows[1].items[0]).toMatchObject({ t: "c", label: "Cultes" });
    expect(rows[1].perRow).toBe(4);
    expect(rows[1].items[0].items.map((i) => i.id)).toEqual(["f2", "f3"]);

    expect(rows[2].items[0]).toMatchObject({ t: "c", label: "Polars" });
    expect(rows[2].perRow).toBe(8);
    expect(rows[2].items[0].items.map((i) => i.id)).toEqual(["f4"]);
  });

  it("les films jamais rangés prennent des planches, sans tomber dans la dernière catégorie", () => {
    const view = build().find((v) => v.wall === "watched");
    // le point de correction : `order: null` valait MAX_SAFE_INTEGER dans
    // l'ancien tri, donc ils seraient tombés dans « Polars »
    expect(rowsOf(view, "main")[2].items[0].items.map((i) => i.id)).toEqual(["f4"]);
    /* Et ils ne s'entassent pas non plus dans le sas : celui de qui n'a
       jamais rangé à la main, c'est TOUTE sa collection — l'étagère
       n'aurait alors montré qu'un rayon vide et une ligne sans fin. */
    expect(idsIn(unplacedOf(view, "main"))).toEqual([]);
    expect(idsIn(rowsOf(view, "main")[3])).toEqual(["nul1", "nul2"]);
  });

  it("une collection jamais rangée à la main prend une planche, pas le sas", () => {
    const jamais = Array.from({ length: 25 }, (_, i) => film(`x${i}`, { order: null, addedAt: i }));
    const view = buildViewsFromLegacy({ films: jamais }).find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main");
    // sans compte voulu, une seule rangée : elle remplira sa largeur
    expect(rows.filter((r) => !isUnplaced(r)).map((r) => r.items.length)).toEqual([25]);
    expect(idsIn(unplacedOf(view, "main"))).toEqual([]);
  });

  it("débite en revanche au compte que le mur d'avant avait choisi", () => {
    const jamais = Array.from({ length: 25 }, (_, i) => film(`x${i}`, { order: null, addedAt: i }));
    const view = buildViewsFromLegacy({
      films: jamais,
      wallPrefs: { watched: { perRow: 6 } },
    }).find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main").filter((r) => !isUnplaced(r));
    expect(rows.map((r) => r.items.length)).toEqual([6, 6, 6, 6, 1]);
    expect(rows.every((r) => r.perRow === 6)).toBe(true);
  });

  it("un sas déjà débordé se vide sur des planches, en gardant l'ordre", () => {
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

  it("donne des couleurs distinctes aux catégories voisines", () => {
    const view = build().find((v) => v.wall === "watched");
    const rows = rowsOf(view, "main");
    expect(rows[1].items[0].color).not.toBe(rows[2].items[0].color);
    expect(CAT_KEYS).toContain(rows[1].items[0].color);
  });

  it("offre le rangement d'origine, puis l'étagère par cinéaste au mur qui a des films", () => {
    const views = build();
    /* L'origine d'abord : c'est elle qui reste la vue ouverte par défaut,
       et le second regard ne s'impose pas. Le mur watchlist est vide dans
       ce jeu d'essai, et deux étagères vides ne sont pas un choix. */
    expect(views.map((v) => `${v.wall} · ${v.name}`)).toEqual([
      "watched · Rangement d'origine",
      "watched · Par réalisateur",
      "watchlist · Rangement d'origine",
    ]);
    for (const v of views) expect(Object.keys(v.shelves).sort()).toEqual([...SHELF_KINDS].sort());
  });

  it("est déterministe : deux exécutions donnent le même agencement", () => {
    const strip = (v) => JSON.stringify(v, (k, x) => (k === "id" ? "#" : x));
    expect(build().map(strip)).toEqual(build().map(strip));
  });

  it("n'oublie aucun film — chaque vue couvre à elle seule la collection de son mur", () => {
    const ids = films.map((f) => f.id).sort();
    const views = build();
    for (const v of views.filter((v) => v.wall === "watched"))
      expect(filmIdsOf(v).sort()).toEqual(ids);
    // et le mur d'en face ne revendique rien qui ne soit à lui
    expect(views.filter((v) => v.wall === "watchlist").flatMap(filmIdsOf)).toEqual([]);
  });
});

describe("duplicateView", () => {
  it("renouvelle les identifiants d'agencement et garde ceux des films", () => {
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
    // et l'original n'a pas bougé
    expect(view.shelves.main.rows[0].items[0].id).toBe("c1");
  });
});

/* ------------------------------------------------------------
   Le décor — un champ qui n'existe que si on y a touché
   ------------------------------------------------------------ */

describe("le décor de la vue", () => {
  it("est absent d'une vue neuve", () => {
    expect(makeView()).not.toHaveProperty("decor");
    expect(wallDecorOf(makeView())).toBeNull();
    expect(plankDecorOf(makeView())).toBeNull();
  });

  it("s'écrit facette par facette, sans toucher aux autres", () => {
    let v = patchViewDecor(makeView(), "wall", { paint: "sauge" });
    v = patchViewDecor(v, "plank", { material: "laiton" });
    v = patchViewDecor(v, "wall", { pattern: "pois" });

    expect(wallDecorOf(v)).toEqual({ paint: "sauge", pattern: "pois" });
    expect(plankDecorOf(v)).toEqual({ material: "laiton" });
  });

  /* Un `decor: {}` et une absence de décor voudraient dire la même
     chose ; deux façons de dire une chose, c'est une de trop, et c'est
     celle qui se lit comme « il y a un décor » qu'on écarte. */
  it("disparaît entièrement quand son dernier réglage s'efface", () => {
    const v = patchViewDecor(makeView(), "wall", { paint: "nuit" });
    expect(patchViewDecor(v, "wall", { paint: null })).not.toHaveProperty("decor");
  });

  it("s'efface d'un coup pour revenir au thème", () => {
    let v = patchViewDecor(makeView(), "wall", { paint: "nuit" });
    v = patchViewDecor(v, "plank", { material: "verre" });
    const back = clearViewDecor(v);
    expect(back).not.toHaveProperty("decor");
    expect(back.theme).toBe("kraft");
    // et l'original n'a pas bougé
    expect(v.decor.wall.paint).toBe("nuit");
  });

  /* La raison pour laquelle il n'y a aucune migration à écrire : toutes
     les transformations reconstruisent la vue par étalement. Si l'une
     d'elles se mettait un jour à énumérer les champs à la main, c'est
     ce test qui le dirait. */
  it("survit aux transformations d'agencement", () => {
    let v = patchViewDecor(makeView(), "wall", { paint: "terracotta", texture: "crepi" });
    v.shelves.main.rows[0].items = [filmItem("f1")];

    const films = [{ id: "f1", status: "watched" }];
    for (const passe of [
      (x) => upgradeView({ ...x, version: 1 }),
      (x) => reflowView(x),
      (x) => reconcileView(x, films),
      (x) => duplicateView(x),
      (x) => moveItem(x, { id: "f1" }, { kind: "chevet", rowId: x.shelves.chevet.rows[0].id }),
    ]) {
      expect(wallDecorOf(passe(v))).toEqual({ paint: "terracotta", texture: "crepi" });
    }
  });
});
