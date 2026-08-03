/* ============================================================
   LES VUES DE L'ÉTAGÈRE — le rangement, hors du film
   ============================================================

   Jusqu'ici, la place d'un boîtier était un numéro `order` écrit SUR le
   film. Un film n'ayant qu'un `order`, la collection n'avait qu'un seul
   rangement possible : impossible d'en tenir deux mises en scène.

   Le rangement déménage donc ici, dans un document « vue » : rangées,
   catégories, décors et thème. Les drapeaux du film (`chevet`,
   `archived`) disent sur QUEL rayon il se trouve ; la vue dit OÙ sur ce
   rayon. C'est la seule règle à retenir, et tout le reste en découle.

   Ce module est volontairement pur — aucun React, aucun localStorage.
   C'est la couche où une erreur ne se voit pas à l'écran mais corrompt
   des données, d'où les tests qui l'accompagnent. */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const SHELF_KINDS = ["chevet", "main", "reserve"];

/* À quel rayon un film appartient. Repris tel quel de `ShelfBoard` : ce
   sont les drapeaux du film, et eux seuls, qui en décident. */
export const belongs = {
  chevet: (f) => f.chevet && !f.archived,
  main: (f) => !f.chevet && !f.archived,
  reserve: (f) => f.archived,
};

export const kindOf = (f) => (f.archived ? "reserve" : f.chevet ? "chevet" : "main");

/* Les couleurs offertes aux catégories. On stocke la CLÉ et jamais
   l'hexadécimal : retoucher la palette repeint alors toutes les
   catégories déjà créées. */
export const CAT_KEYS = ["burgundy", "ochre", "pine", "slate", "cobalt", "vermillion", "moss", "ink"];

/* Les caps proposés par la gouttière. `null` = au fil de la largeur. */
export const ROW_CAPS = [null, 3, 4, 5, 6, 8, 10, 12];

export const VIEW_VERSION = 1;

/* ------------------------------------------------------------
   Constructeurs
   ------------------------------------------------------------ */

export const makeRow = ({ id, kind = "normal", perRow = null, label = "", items = [] } = {}) => ({
  id: id || `r_${uid()}`,
  kind,
  perRow,
  label,
  items,
});

export const makeCat = ({ id, label = "Catégorie", color = CAT_KEYS[0], perRow = null, items = [] } = {}) => ({
  t: "c",
  id: id || `c_${uid()}`,
  label,
  color,
  perRow,
  items,
});

export const makeDecor = ({ id, motif, size = 1, color = "ochre" } = {}) => ({
  t: "d",
  id: id || `d_${uid()}`,
  motif,
  size,
  color,
});

export const filmItem = (id) => ({ t: "f", id });

/* Un rayon neuf : une rangée pour ranger, et la rangée d'arrivée qui
   recueille ce qu'on n'a pas encore placé. Cette dernière est une
   institution, pas un accident : sans elle, un film importé n'aurait
   nulle part où apparaître et deviendrait invisible. */
export const makeShelf = () => ({ rows: [makeRow(), makeRow({ kind: "unplaced" })] });

export const makeView = ({ id, wall = "watched", name = "Nouvelle vue", theme = "kraft", now = 0 } = {}) => ({
  id: id || `v_${uid()}`,
  version: VIEW_VERSION,
  wall,
  name,
  theme,
  createdAt: now,
  updatedAt: now,
  shelves: { chevet: makeShelf(), main: makeShelf(), reserve: makeShelf() },
});

/* ------------------------------------------------------------
   Petits outils de structure
   ------------------------------------------------------------ */

/* `map` qui rend le tableau d'origine quand rien n'a bougé. C'est ce qui
   permet à `reconcileView` de ne pas fabriquer un nouvel objet à chaque
   rendu — sans quoi la mémoïsation des rangées ne servirait à rien et un
   `setState` sans rapport repeindrait les cent boîtiers du rayon. */
const mapSame = (arr, fn) => {
  let changed = false;
  const out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = fn(arr[i], i);
    if (out[i] !== arr[i]) changed = true;
  }
  return changed ? out : arr;
};

const filterSame = (arr, keep) => {
  const out = arr.filter(keep);
  return out.length === arr.length ? arr : out;
};

export const isUnplaced = (row) => row.kind === "unplaced";

/* Tous les ids de films d'une vue, catégories comprises. */
export function filmIdsOf(view) {
  const ids = [];
  for (const kind of SHELF_KINDS) {
    for (const row of view.shelves[kind].rows) {
      for (const it of row.items) {
        if (it.t === "f") ids.push(it.id);
        else if (it.t === "c") for (const sub of it.items) if (sub.t === "f") ids.push(sub.id);
      }
    }
  }
  return ids;
}

/* ------------------------------------------------------------
   Réconciliation — la vue face à la collection réelle
   ------------------------------------------------------------

   Une vue est un agencement, pas une source de vérité : les films
   naissent, changent de rayon et meurent ailleurs. On la ramène donc à
   la réalité à chaque rendu, sans jamais écrire — l'écriture n'a lieu
   qu'à la prochaine vraie mutation, via `commitView`.

   Trois torts à réparer, dans cet ordre :
     - un id qui ne désigne plus rien, ou plus ce rayon : on le retire ;
     - un id présent deux fois : on ne garde que le premier ;
     - un film du rayon qui ne figure nulle part : il tombe dans la
       rangée d'arrivée. C'est l'invariant « rien n'est jamais
       invisible », et c'est lui qui rend l'archivage réversible. */
export function reconcileView(view, films) {
  const byId = new Map(films.map((f) => [f.id, f]));
  const seen = new Set();

  let shelvesChanged = false;
  const shelves = {};

  for (const kind of SHELF_KINDS) {
    const shelf = view.shelves[kind] || makeShelf();
    const here = (id) => {
      const f = byId.get(id);
      return !!f && belongs[kind](f);
    };
    /* Un film ne peut occuper qu'une place : le premier venu la garde.
       On marque au passage tout ce qu'on a vu, pour savoir ensuite qui
       manque à l'appel. */
    const keepFilm = (id) => {
      if (!here(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    };

    let rows = mapSame(shelf.rows, (row) => {
      const items = filterSame(
        mapSame(row.items, (it) => {
          if (it.t !== "c") return it;
          const sub = filterSame(it.items, (s) => s.t === "f" && keepFilm(s.id));
          return sub === it.items ? it : { ...it, items: sub };
        }),
        (it) => (it.t === "f" ? keepFilm(it.id) : true),
      );
      return items === row.items ? row : { ...row, items };
    });

    rows = ensureUnplaced(rows);

    /* Ce que la vue ignore encore. L'ordre d'arrivée est celui de la
       collection : c'est le seul dont on dispose ici. */
    const missing = [];
    for (const f of films) if (belongs[kind](f) && !seen.has(f.id)) { seen.add(f.id); missing.push(f.id); }

    if (missing.length) {
      const at = rows.length - 1;
      const last = rows[at];
      rows = [...rows.slice(0, at), { ...last, items: [...last.items, ...missing.map(filmItem)] }];
    }

    if (rows !== shelf.rows) {
      shelves[kind] = { ...shelf, rows };
      shelvesChanged = true;
    } else {
      shelves[kind] = shelf;
    }
  }

  return shelvesChanged ? { ...view, shelves } : view;
}

/* Exactement une rangée d'arrivée, toujours en dernier. Si l'utilisateur
   n'en a aucune (vue fabriquée à la main, document d'une version
   antérieure), on la pose ; s'il en a plusieurs, on les fond. */
function ensureUnplaced(rows) {
  const idx = rows.map((r, i) => (isUnplaced(r) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 1 && idx[0] === rows.length - 1) return rows;
  if (!idx.length) return [...rows, makeRow({ kind: "unplaced" })];
  const first = rows[idx[0]];
  const merged = makeRow({
    id: first.id,
    kind: "unplaced",
    perRow: first.perRow,
    label: first.label,
    items: idx.flatMap((i) => rows[i].items),
  });
  return [...rows.filter((r) => !isUnplaced(r)), merged];
}

/* ------------------------------------------------------------
   Déplacer — l'unique mutation
   ------------------------------------------------------------

   Tous les dépôts passent par ici : entre deux boîtiers, dans une
   catégorie, dans le vide d'une rangée, sur une couture (qui crée une
   rangée), ou dans la rangée d'arrivée. On retire d'abord l'item d'où
   qu'il vienne, PUIS on calcule l'index de destination : les indices
   d'après-retrait sont les seuls justes, et `overId` ne désigne jamais
   l'item déplacé.

   `drag` : { id } pour un déplacement, { create } pour une création
   (un décor sorti du cabinet n'existe pas encore).
   `target` : { kind, rowId, catId, overId, side } ou { kind, afterRowId }
   pour une couture. */
export function moveItem(view, drag, target) {
  const created = drag.create || null;
  let moved = created;

  const shelves = {};
  for (const kind of SHELF_KINDS) shelves[kind] = view.shelves[kind];

  if (!created) {
    for (const kind of SHELF_KINDS) {
      const found = takeItem(shelves[kind], drag.id);
      if (found) { moved = found.item; shelves[kind] = found.shelf; }
    }
  }
  if (!moved) return view;

  const kind = target.kind;
  let rows = shelves[kind].rows;

  // une couture : la rangée n'existe pas encore, on l'ouvre
  if (target.afterRowId !== undefined) {
    const at = rows.findIndex((r) => r.id === target.afterRowId);
    const above = at >= 0 ? rows[at] : null;
    // la nouvelle rangée hérite du cap de celle du dessus : une ligne
    // ouverte sous une ligne de 6 veut presque toujours 6 elle aussi
    const row = makeRow({ perRow: above && !isUnplaced(above) ? above.perRow : null, items: [moved] });
    const insertAt = at >= 0 ? at + 1 : Math.max(0, rows.length - 1);
    rows = [...rows.slice(0, insertAt), row, ...rows.slice(insertAt)];
    return withRows(view, shelves, kind, rows);
  }

  const rowAt = rows.findIndex((r) => r.id === target.rowId);
  if (rowAt < 0) return view;
  const row = rows[rowAt];

  if (target.catId) {
    const catAt = row.items.findIndex((it) => it.t === "c" && it.id === target.catId);
    if (catAt < 0) return view;
    const cat = row.items[catAt];
    // une catégorie ne contient que des films : y lâcher autre chose
    // reviendrait à emboîter des boîtes, ce que le modèle refuse
    if (moved.t !== "f") return view;
    const items = insertAt(cat.items, moved, target.overId, target.side);
    const nextItems = [...row.items];
    nextItems[catAt] = { ...cat, items };
    rows = replaceRow(rows, rowAt, { ...row, items: nextItems });
    return withRows(view, shelves, kind, rows);
  }

  rows = replaceRow(rows, rowAt, { ...row, items: insertAt(row.items, moved, target.overId, target.side) });
  return withRows(view, shelves, kind, rows);
}

const replaceRow = (rows, at, row) => { const out = [...rows]; out[at] = row; return out; };

const withRows = (view, shelves, kind, rows) => ({
  ...view,
  shelves: { ...shelves, [kind]: { ...shelves[kind], rows } },
});

/* Insérer devant/derrière `overId`, ou en fin de conteneur s'il n'y a
   personne à viser (le vide d'une rangée, une catégorie encore vide). */
function insertAt(items, item, overId, side) {
  if (!overId) return [...items, item];
  const i = items.findIndex((it) => it.id === overId);
  if (i < 0) return [...items, item];
  const at = side === "after" ? i + 1 : i;
  return [...items.slice(0, at), item, ...items.slice(at)];
}

/* Retirer un item d'un rayon, où qu'il soit — au premier niveau ou dans
   une catégorie. Rend `null` si le rayon ne le contient pas. */
function takeItem(shelf, id) {
  for (let r = 0; r < shelf.rows.length; r++) {
    const row = shelf.rows[r];
    const at = row.items.findIndex((it) => it.id === id);
    if (at >= 0) {
      const item = row.items[at];
      const items = [...row.items.slice(0, at), ...row.items.slice(at + 1)];
      return { item, shelf: { ...shelf, rows: replaceRow(shelf.rows, r, { ...row, items }) } };
    }
    for (let c = 0; c < row.items.length; c++) {
      const cat = row.items[c];
      if (cat.t !== "c") continue;
      const sub = cat.items.findIndex((it) => it.id === id);
      if (sub < 0) continue;
      const item = cat.items[sub];
      const catItems = [...cat.items.slice(0, sub), ...cat.items.slice(sub + 1)];
      const items = [...row.items];
      items[c] = { ...cat, items: catItems };
      return { item, shelf: { ...shelf, rows: replaceRow(shelf.rows, r, { ...row, items }) } };
    }
  }
  return null;
}

/* ------------------------------------------------------------
   Le mobilier : rangées, catégories, décors
   ------------------------------------------------------------

   Toutes ces opérations partagent une règle : un film n'est jamais
   détruit par un geste de rangement. Vider une ligne, la supprimer,
   défaire une catégorie — les boîtiers qui s'y trouvaient retombent dans
   la rangée d'arrivée. Ce qu'on supprime vraiment, ce sont les meubles :
   la ligne, la boîte, le bibelot. */

const shelfOfRow = (view, rowId) =>
  SHELF_KINDS.find((k) => view.shelves[k].rows.some((r) => r.id === rowId)) || null;

const mapShelf = (view, kind, fn) => ({
  ...view,
  shelves: { ...view.shelves, [kind]: { ...view.shelves[kind], rows: fn(view.shelves[kind].rows) } },
});

/* Rendre des films à la rangée d'arrivée du rayon. */
const toUnplaced = (rows, ids) => {
  if (!ids.length) return rows;
  const at = rows.length - 1;
  const out = [...rows];
  out[at] = { ...out[at], items: [...out[at].items, ...ids.map(filmItem)] };
  return out;
};

/* Tous les films d'une rangée, catégories comprises. */
const filmsInRow = (row) =>
  row.items.flatMap((it) => (it.t === "f" ? [it.id] : it.t === "c" ? it.items.map((s) => s.id) : []));

export function patchRow(view, rowId, patch) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  return mapShelf(view, kind, (rows) => rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
}

/* Ouvrir une ligne. `where` vaut "before", "after" ou "end" — et « end »
   veut dire avant la rangée d'arrivée, qui garde toujours le dernier mot. */
export function addRow(view, kind, refRowId, where = "after") {
  const rows = view.shelves[kind].rows;
  const ref = rows.findIndex((r) => r.id === refRowId);
  const above = ref >= 0 ? rows[ref] : rows[Math.max(0, rows.length - 2)];
  const row = makeRow({ perRow: above && !isUnplaced(above) ? above.perRow : null });
  let at;
  if (where === "end" || ref < 0) at = Math.max(0, rows.length - 1);
  else at = where === "before" ? ref : ref + 1;
  // jamais après la rangée d'arrivée
  at = Math.min(at, rows.length - 1);
  return mapShelf(view, kind, (rs) => [...rs.slice(0, at), row, ...rs.slice(at)]);
}

export function removeRow(view, rowId) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  const row = view.shelves[kind].rows.find((r) => r.id === rowId);
  if (!row || isUnplaced(row)) return view;   // la rangée d'arrivée ne se supprime pas
  return mapShelf(view, kind, (rows) => toUnplaced(rows.filter((r) => r.id !== rowId), filmsInRow(row)));
}

export function clearRow(view, rowId) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  const row = view.shelves[kind].rows.find((r) => r.id === rowId);
  if (!row) return view;
  return mapShelf(view, kind, (rows) =>
    toUnplaced(rows.map((r) => (r.id === rowId ? { ...r, items: [] } : r)), filmsInRow(row)));
}

export function addCat(view, rowId, cat) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  return mapShelf(view, kind, (rows) =>
    rows.map((r) => (r.id === rowId ? { ...r, items: [...r.items, cat] } : r)));
}

const findCat = (view, catId) => {
  for (const kind of SHELF_KINDS)
    for (const row of view.shelves[kind].rows)
      for (const it of row.items) if (it.t === "c" && it.id === catId) return { kind, row, cat: it };
  return null;
};

export function patchCat(view, catId, patch) {
  const found = findCat(view, catId);
  if (!found) return view;
  return mapShelf(view, found.kind, (rows) =>
    rows.map((r) => (r.id !== found.row.id ? r
      : { ...r, items: r.items.map((it) => (it.id === catId ? { ...it, ...patch } : it)) })));
}

export function removeCat(view, catId) {
  const found = findCat(view, catId);
  if (!found) return view;
  const ids = found.cat.items.map((s) => s.id);
  return mapShelf(view, found.kind, (rows) =>
    toUnplaced(rows.map((r) => (r.id !== found.row.id ? r
      : { ...r, items: r.items.filter((it) => it.id !== catId) })), ids));
}

/* Retirer un décor : c'est le seul objet qu'un geste supprime vraiment,
   parce qu'il ne contient rien qu'on puisse regretter. */
export function removeDecor(view, id) {
  for (const kind of SHELF_KINDS) {
    for (const row of view.shelves[kind].rows) {
      if (row.items.some((it) => it.t === "d" && it.id === id))
        return mapShelf(view, kind, (rows) =>
          rows.map((r) => (r.id !== row.id ? r : { ...r, items: r.items.filter((it) => it.id !== id) })));
    }
  }
  return view;
}

export function patchDecor(view, id, patch) {
  for (const kind of SHELF_KINDS) {
    for (const row of view.shelves[kind].rows) {
      if (row.items.some((it) => it.t === "d" && it.id === id))
        return mapShelf(view, kind, (rows) =>
          rows.map((r) => (r.id !== row.id ? r
            : { ...r, items: r.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })));
    }
  }
  return view;
}

/* ------------------------------------------------------------
   Ranger — le tri devenu un verbe
   ------------------------------------------------------------

   « Trier » était un mode : il se battait avec les intercalaires, qui
   n'avaient pas de place définie hors du rangement à la main. Ranger est
   maintenant un geste ponctuel : il réécrit l'agencement une fois, et
   l'agencement reste.

   Les catégories et les décors ne bougent pas d'un pouce — ce sont des
   objets qu'on a posés là exprès. Seuls les films circulent : ceux du
   premier niveau se redistribuent dans les emplacements qu'ils
   occupaient déjà, ceux d'une catégorie se trient entre eux. */
export function sortIntoRows(view, kind, compare) {
  const shelf = view.shelves[kind];
  const slots = [];
  for (let r = 0; r < shelf.rows.length; r++) {
    if (isUnplaced(shelf.rows[r])) continue;
    const row = shelf.rows[r];
    for (let i = 0; i < row.items.length; i++) if (row.items[i].t === "f") slots.push([r, i]);
  }
  const sorted = slots.map(([r, i]) => shelf.rows[r].items[i]).sort(compare);

  const rows = shelf.rows.map((row) => ({ ...row, items: [...row.items] }));
  slots.forEach(([r, i], n) => { rows[r].items[i] = sorted[n]; });
  for (const row of rows) {
    for (let i = 0; i < row.items.length; i++) {
      const it = row.items[i];
      if (it.t === "c") row.items[i] = { ...it, items: [...it.items].sort(compare) };
    }
  }
  return { ...view, shelves: { ...view.shelves, [kind]: { ...shelf, rows } } };
}

/* ------------------------------------------------------------
   Migration — l'ancien rangement devient une vue
   ------------------------------------------------------------ */

/* Le comparateur du mémo `shelves` d'avant, reproduit à l'identique : la
   migration doit rendre exactement ce que l'étagère « à la main »
   affichait, sans quoi l'utilisateur retrouverait son rayon rebattu. */
const LEGACY_RANK = (o) => (o == null ? Number.MAX_SAFE_INTEGER : o);

export function buildViewsFromLegacy({ films = [], dividers = [], wallPrefs = {}, now = 0 } = {}) {
  const views = [];
  for (const wall of ["watched", "watchlist"]) {
    const pool = films.filter((f) => (f.status === "watchlist") === (wall === "watchlist"));
    const legacyCap = (() => {
      const p = wallPrefs[wall]?.perRow;
      return p && p !== "auto" ? p : null;
    })();

    const view = makeView({ wall, name: "Rangement d'origine", theme: "kraft", now });
    let colorAt = 0;

    for (const kind of SHELF_KINDS) {
      const mine = pool.filter(belongs[kind]);
      /* Les films jamais rangés à la main portent `order: null`, que
         l'ancien tri repoussait en fin de rayon. Les fondre dans la
         suite les ferait avaler par la DERNIÈRE catégorie migrée, alors
         qu'ils n'ont jamais été placés nulle part : ils vont dans la
         rangée d'arrivée. */
      const placed = mine.filter((f) => typeof f.order === "number");
      const never = mine.filter((f) => typeof f.order !== "number");

      const tabs = dividers.filter((d) => d.wall === wall && d.shelf === kind);
      const merged = [
        ...placed.map((f) => ({ type: "film", id: f.id, order: LEGACY_RANK(f.order), tie: -(f.addedAt || 0) })),
        ...tabs.map((d) => ({ type: "divider", divider: d, order: LEGACY_RANK(d.order), tie: 0 })),
      ].sort((a, b) => a.order - b.order || a.tie - b.tie);

      const rows = [];
      let row = makeRow({ perRow: legacyCap });
      let cat = null;

      for (const it of merged) {
        if (it.type === "divider") {
          /* Un intercalaire ouvrait une ligne et donnait son cap : il
             devient donc une RANGÉE, et son libellé devient la
             catégorie qui en occupe la tête et avale ce qui suivait. */
          if (row.items.length) rows.push(row);
          cat = makeCat({
            label: it.divider.label || "Catégorie",
            color: CAT_KEYS[colorAt++ % CAT_KEYS.length],
          });
          row = makeRow({ perRow: it.divider.perRow || legacyCap, items: [cat] });
        } else if (cat) {
          cat.items.push(filmItem(it.id));
        } else {
          row.items.push(filmItem(it.id));
        }
      }
      if (row.items.length) rows.push(row);
      if (!rows.length) rows.push(makeRow({ perRow: legacyCap }));
      rows.push(makeRow({ kind: "unplaced", items: never.map((f) => filmItem(f.id)) }));

      view.shelves[kind] = { rows };
    }
    views.push(view);
  }
  return views;
}

/* Cloner une vue : nouveaux identifiants pour tout ce qui est
   agencement, mêmes identifiants pour les films — ce sont les mêmes
   films, rangés autrement. */
export function duplicateView(view, { name, now = 0 } = {}) {
  const shelves = {};
  for (const kind of SHELF_KINDS) {
    shelves[kind] = {
      ...view.shelves[kind],
      rows: view.shelves[kind].rows.map((row) => ({
        ...row,
        id: `r_${uid()}`,
        items: row.items.map((it) =>
          it.t === "f" ? it : it.t === "c"
            ? { ...it, id: `c_${uid()}`, items: it.items.map((s) => ({ ...s })) }
            : { ...it, id: `d_${uid()}` },
        ),
      })),
    };
  }
  return { ...view, id: `v_${uid()}`, name: name || `${view.name} (copie)`, createdAt: now, updatedAt: now, shelves };
}
