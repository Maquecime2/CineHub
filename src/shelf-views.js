/* ============================================================
   LES VUES DE L'ÉTAGÈRE — le rangement, hors du film
   ============================================================

   Jusqu'ici, la place d'un boîtier était un numéro `order` écrit SUR le
   film. Un film n'ayant qu'un `order`, la collection n'avait qu'un seul
   rangement possible : impossible d'en tenir deux mises en scène.

   Le rangement déménage donc ici, dans un document « vue » : rangées,
   catégories, décors et thème. Les drapeaux du film (`bedside`,
   `archived`) disent sur QUEL rayon il se trouve ; la vue dit OÙ sur ce
   rayon. C'est la seule règle à retenir, et tout le reste en découle.

   Ce module est volontairement pur — aucun React, aucun localStorage.
   C'est la couche où une erreur ne se voit pas à l'écran mais corrompt
   des données, d'où les tests qui l'accompagnent. */

import { CAT_KEYS } from "./theme/palette";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const SHELF_KINDS = ["bedside", "main", "reserve"];

/* À quel rayon un film appartient. Repris tel quel de `ShelfBoard` : ce
   sont les drapeaux du film, et eux seuls, qui en décident.

   Sauf un cas, qui n'est pas une exception mais la définition du rayon :
   « films de bedside », c'est CEUX QU'ON REVOIT. Un film qu'on n'a pas
   encore vu ne peut pas en être. Le drapeau reste inscrit sur la fiche —
   on ne le perd pas en mettant un film à voir — mais tant qu'il est à
   voir, il se range dans la collection. Sans quoi la watchlist ouvrait
   un rayon « ceux qu'on revoit » qui ne veut rien dire, et ShelfBoard,
   qui le masque, y aurait perdu des films. */
const revu = (f) => f.status !== "watchlist";

export const belongs = {
  bedside: (f) => f.bedside && revu(f) && !f.archived,
  main: (f) => (!f.bedside || !revu(f)) && !f.archived,
  reserve: (f) => f.archived,
};

export const kindOf = (f) => (f.archived ? "reserve" : f.bedside && revu(f) ? "bedside" : "main");

/* Les couleurs offertes aux catégories. La liste n'est plus recopiée
   ici : elle se DÉDUIT du nuancier (`theme/palette`), qui reste pur et
   n'entraîne donc pas React dans ce module. On stocke toujours la CLÉ et
   jamais l'hexadécimal. */
export { CAT_KEYS };

/* De quoi on remplit une planche neuve. Ce n'est PLUS ce qu'elle affiche :
   une rangée naît « auto » et prend le compte de sa largeur (voir
   `useRowCap`, dans `components/shelf/lines.js`) — c'était l'ancien défaut
   de dix qui se voyait, sur un écran large, comme une rangée à moitié vide
   et un mystère dans la gouttière. Ce nombre-ci ne sert qu'à DÉBITER : une
   collection versée d'un coup prend des planches par dizaines plutôt qu'une
   seule sans fin. Ce qui est écrit dans la gouttière, lui, est toujours un
   choix qu'on a fait. */
export const DEFAULT_CAP = 10;

/* Le tiroir des mis de côté ne fait que 250 px de large : deux boîtiers y
   tiennent, pas dix. Lui donner le compte de la collection le ferait
   replier chaque rangée en colonne. */
export const DRAWER_CAP = 2;

/* Un compte n'est jamais un nombre imposé : c'est le MAXIMUM qu'une
   planche accepte. Elle peut en porter moins — parce qu'il n'y a plus de
   films, ou parce que la largeur disponible ne suit pas. Rien ne va
   jamais rappeler un boîtier en arrière pour la remplir. */
export const capFor = (kind) => (kind === "reserve" ? DRAWER_CAP : DEFAULT_CAP);

const chunk = (arr, n) => {
  if (!n || arr.length <= n) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* v2 : les rangées ont un compte, et le surplus déborde sur la suivante.
   Les vues de la v1 ont été fabriquées avec un rayon entier versé dans
   une seule rangée — il faut les reprendre au chargement, sans quoi elles
   restent une grosse ligne unique jusqu'à ce qu'on y touche. */
export const VIEW_VERSION = 2;

export function upgradeView(view) {
  if ((view.version || 1) >= VIEW_VERSION) return view;
  const shelves = {};
  for (const kind of SHELF_KINDS) {
    /* On ne touche plus aux rangées. Une vue de la v1 versait son rayon
       dans une seule rangée sans compte, et c'était le défaut : elle
       s'étirait en une bande sans fin. Elle se replie maintenant en
       lignes de bois, chacune avec sa planche — la grosse ligne unique
       est devenue une étagère, il n'y a plus rien à reprendre. */
    shelves[kind] = view.shelves?.[kind] || makeShelf();
  }
  return reflowView(drainUnplaced({ ...view, version: VIEW_VERSION, shelves }));
}

/* Un sas qui deborde n'est plus un sas, c'est un tas. Au-dela de ce qu'une
   planche accepte, son contenu prend des planches — juste avant lui, pour
   que l'ordre soit conserve. */
export function drainUnplaced(view) {
  const shelves = {};
  let changed = false;
  for (const kind of SHELF_KINDS) {
    const shelf = view.shelves[kind];
    const rows = shelf.rows;
    const sas = rows[rows.length - 1];
    const cap = capFor(kind);
    if (!sas || !isUnplaced(sas) || sas.items.length <= cap) {
      shelves[kind] = shelf;
      continue;
    }
    /* Les planches vides qui précèdent le sas sont des restes — celle que
       la migration laissait devant un rayon entier tombé dans le tas. On
       les reprend plutôt que de poser les nouvelles derrière elles. */
    let keep = rows.slice(0, -1);
    while (keep.length && !keep[keep.length - 1].items.length) keep = keep.slice(0, -1);
    // une planche, qui remplira sa largeur — pas des paquets de dix
    const born = [makeRow({ items: sas.items })];
    shelves[kind] = { ...shelf, rows: [...keep, ...born, { ...sas, items: [] }] };
    changed = true;
  }
  return changed ? { ...view, shelves } : view;
}

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

/* Une boîte n'a plus de compte à elle. Elle en avait un, et il en
   existait donc deux, qui se contredisaient : celui de la rangée disait
   combien d'objets tiennent sur la ligne, celui de la boîte combien de
   films tiennent DANS la boîte, et la boîte se repliait sur elle-même
   sans que rien ne vienne porter ses lignes du haut. Le compte est
   maintenant celui de la ligne de bois, et il n'y en a qu'un : la boîte
   prend les cases qui restent puis déborde sur la ligne du dessous. */
export const makeCat = ({ id, label = "Catégorie", color = CAT_KEYS[0], items = [] } = {}) => ({
  t: "c",
  id: id || `c_${uid()}`,
  label,
  color,
  items,
});

/* `label` ne sert qu'aux motifs qui écrivent — l'intercalaire, pour
   l'instant. Les autres le portent vide et ne le montrent jamais : un
   champ inerte sur un objet coûte moins cher qu'une seconde sorte de
   décor à faire voyager partout.

   `rot` est ABSENT et non pas zéro, et la différence compte : sans lui,
   l'objet prend le guingois semé de son identifiant — chaque bibelot de
   travers à sa façon, ce qui est tout ce qui empêche une étagère de
   ressembler à une planche de catalogue. Zéro veut dire « d'aplomb, et
   je l'ai voulu ». On n'écrit donc ce champ que lorsqu'une main l'a
   réglé, et une vue d'avant l'orientation reste identique au pixel. */
export const makeDecor = ({ id, motif, size = 1, color = "ochre", label = "" } = {}) => ({
  t: "d",
  id: id || `d_${uid()}`,
  motif,
  size,
  color,
  label,
});

/* Un décor ACCROCHÉ. Même objet qu'un décor posé, à deux nombres près :
   il ne vit pas dans une rangée mais sur le fond du rayon, et il lui
   faut donc une place à lui. `x` et `y` sont des POURCENTAGES du cadre
   du rayon — un rayon qui gagne une ligne, une fenêtre qu'on rétrécit,
   et l'objet garde sa place relative au lieu de sortir du cadre. */
export const makeWallDecor = ({ id, motif, size = 1, color = "ochre", x = 50, y = 30 } = {}) => ({
  ...makeDecor({ id, motif, size, color }),
  x,
  y,
});

export const filmItem = (id) => ({ t: "f", id });

/* Un rayon neuf : une rangée pour ranger, et la rangée d'arrivée qui
   recueille ce qu'on n'a pas encore placé. Cette dernière est une
   institution, pas un accident : sans elle, un film importé n'aurait
   nulle part où apparaître et deviendrait invisible. */
export const makeShelf = () => ({
  rows: [makeRow(), makeRow({ kind: "unplaced" })],
  /* Ce qui est accroché au fond. Un rayon d'avant les objets muraux n'a
     pas ce tableau : partout où on le lit, on lit `shelf.wall || []`
     plutôt que d'aller réécrire toutes les vues déjà enregistrées. */
  wall: [],
});

export const makeView = ({
  id,
  wall = "watched",
  name = "Nouvelle vue",
  theme = "kraft",
  now = 0,
} = {}) => ({
  id: id || `v_${uid()}`,
  version: VIEW_VERSION,
  wall,
  name,
  theme,
  createdAt: now,
  updatedAt: now,
  /* `decor` est VOLONTAIREMENT absent d'une vue neuve — voir plus bas. */
  shelves: { bedside: makeShelf(), main: makeShelf(), reserve: makeShelf() },
});

/* ------------------------------------------------------------
   LE DÉCOR — ce dont la vue est faite, au-delà du thème
   ------------------------------------------------------------

   `theme` ne réglait que trois choses, et le mur n'avait aucune
   peinture. Le décor ouvre le reste :

     decor?: {
       wall?:  { paint?, pattern?, patternInk?, texture? },
       plank?: { material?, finish? },
     }

   TOUT Y EST FACULTATIF, ET LE CHAMP LUI-MÊME AUSSI. C'est la même règle
   que `rot` sur un décor ou que `wall` sur un rayon : absent veut dire
   « comme avant », et une vue enregistrée avant ce jour doit rester
   identique au pixel. Rien n'écrit `decor` tant qu'une main n'a pas
   réglé quelque chose ; `theme` reste la source par défaut, et l'efface
   rend la vue à son thème.

   Aucune migration à écrire pour autant : toutes les transformations de
   ce module reconstruisent la vue par étalement (`{ ...view, ... }`), si
   bien qu'un champ de plus voyage sans qu'on ait à le nommer nulle part.
   Ce qui suit n'est donc que la façon de le LIRE et de l'ÉCRIRE, en un
   seul endroit. */

export const wallDecorOf = (view) => view.decor?.wall || null;
export const plankDecorOf = (view) => view.decor?.plank || null;

/* Retoucher une facette du décor. Une valeur nulle EFFACE le réglage —
   c'est ainsi que « revenir au thème » se dit, et la vue se débarrasse
   des objets vides au passage plutôt que de traîner un `decor: {}` qui
   voudrait dire la même chose qu'une absence. */
export function patchViewDecor(view, part, patch) {
  const before = view.decor?.[part] || {};
  const merged = { ...before, ...patch };
  for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];

  const decor = { ...view.decor };
  if (Object.keys(merged).length) decor[part] = merged;
  else delete decor[part];

  const next = { ...view };
  if (Object.keys(decor).length) next.decor = decor;
  else delete next.decor;
  return next;
}

/* Rendre la vue à son thème : plus de décor du tout. */
export function clearViewDecor(view) {
  if (!view.decor) return view;
  const next = { ...view };
  delete next.decor;
  return next;
}

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
          /* Seuls les films sont confrontés à la collection : un décor
             posé dans une boîte n'existe que dans la vue, rien au-dehors
             ne peut le démentir. Le filtrer comme un film le ferait
             disparaître au premier rendu. */
          const sub = filterSame(it.items, (s) => (s.t === "f" ? keepFilm(s.id) : true));
          return sub === it.items ? it : { ...it, items: sub };
        }),
        (it) => (it.t === "f" ? keepFilm(it.id) : true)
      );
      return items === row.items ? row : { ...row, items };
    });

    rows = ensureUnplaced(rows);

    /* Ce que la vue ignore encore. L'ordre d'arrivée est celui de la
       collection : c'est le seul dont on dispose ici. */
    const missing = [];
    for (const f of films)
      if (belongs[kind](f) && !seen.has(f.id)) {
        seen.add(f.id);
        missing.push(f.id);
      }

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
      if (found) {
        moved = found.item;
        shelves[kind] = found.shelf;
      }
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
    const row = makeRow({
      perRow: above && !isUnplaced(above) ? above.perRow : null,
      items: [moved],
    });
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
    /* Une boîte accepte tout, sauf une autre boîte : emboîter des
       conteneurs donnerait un arbre là où le modèle tient à un rangement
       plat, et il n'y a rien à y gagner qu'une profondeur de plus à
       parcourir partout.
       Les décors, eux, y entrent : un intercalaire dans une catégorie,
       c'est la sous-division dont on a besoin quand la boîte grossit. */
    if (moved.t === "c") return view;
    const items = insertAt(cat.items, moved, target.overId, target.side);
    const nextItems = [...row.items];
    nextItems[catAt] = { ...cat, items };
    rows = replaceRow(rows, rowAt, { ...row, items: nextItems });
    return withRows(view, shelves, kind, rows);
  }

  rows = replaceRow(rows, rowAt, {
    ...row,
    items: insertAt(row.items, moved, target.overId, target.side),
  });
  return withRows(view, shelves, kind, rows);
}

/* ACCROCHER — l'autre dépôt.

   Un objet mural ne s'insère pas entre deux voisins : il n'a pas de
   voisins. Il ne connaît qu'un rayon et un point, et c'est pourquoi il
   ne passe pas par `moveItem` — l'index, la couture, la boîte, la
   rangée d'arrivée, rien de tout cela n'a de sens pour lui. Le décrocher
   d'un rayon pour le raccrocher à un autre reste possible : on le retire
   de tous les murs avant de le poser sur le sien.

   `drag` : { id } pour un déplacement, { create } pour un objet qui sort
   du cabinet et n'existe pas encore. */
export function pinToWall(view, kind, drag, at) {
  const shelves = {};
  let moved = drag.create || null;

  for (const k of SHELF_KINDS) {
    const shelf = view.shelves[k];
    const wall = shelf.wall || [];
    // un objet déjà accroché ne l'est qu'à un seul mur : le premier trouvé
    const found = moved ? null : wall.find((it) => it.id === drag.id);
    if (!found) {
      shelves[k] = shelf;
      continue;
    }
    moved = found;
    shelves[k] = { ...shelf, wall: wall.filter((it) => it !== found) };
  }
  if (!moved) return view;

  const target = shelves[kind];
  const hung = { ...moved, x: at.x, y: at.y };
  return {
    ...view,
    shelves: { ...shelves, [kind]: { ...target, wall: [...(target.wall || []), hung] } },
  };
}

const replaceRow = (rows, at, row) => {
  const out = [...rows];
  out[at] = row;
  return out;
};

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
  shelves: {
    ...view.shelves,
    [kind]: { ...view.shelves[kind], rows: fn(view.shelves[kind].rows) },
  },
});

/* Rendre des films à la rangée d'arrivée du rayon. */
const toUnplaced = (rows, ids) => {
  if (!ids.length) return rows;
  const at = rows.length - 1;
  const out = [...rows];
  out[at] = { ...out[at], items: [...out[at].items, ...ids.map(filmItem)] };
  return out;
};

/* Tous les FILMS d'une rangée, catégories comprises — et eux seuls.

   C'est ce qui part vers la rangée d'arrivée quand on défait le meuble
   qui les portait. Les décors n'y vont pas : un bibelot est du mobilier,
   et le mobilier disparaît avec le meuble. C'était déjà le sort d'un
   décor posé à même une rangée qu'on supprime ; ceux qui vivent
   maintenant dans une boîte suivent la même règle. */
const filmsInRow = (row) =>
  row.items.flatMap((it) =>
    it.t === "f"
      ? [it.id]
      : it.t === "c"
        ? it.items.filter((s) => s.t === "f").map((s) => s.id)
        : []
  );

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
  if (!row || isUnplaced(row)) return view; // la rangée d'arrivée ne se supprime pas
  return mapShelf(view, kind, (rows) =>
    toUnplaced(
      rows.filter((r) => r.id !== rowId),
      filmsInRow(row)
    )
  );
}

export function clearRow(view, rowId) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  const row = view.shelves[kind].rows.find((r) => r.id === rowId);
  if (!row) return view;
  return mapShelf(view, kind, (rows) =>
    toUnplaced(
      rows.map((r) => (r.id === rowId ? { ...r, items: [] } : r)),
      filmsInRow(row)
    )
  );
}

export function addCat(view, rowId, cat) {
  const kind = shelfOfRow(view, rowId);
  if (!kind) return view;
  return mapShelf(view, kind, (rows) =>
    rows.map((r) => (r.id === rowId ? { ...r, items: [...r.items, cat] } : r))
  );
}

const findCat = (view, catId) => {
  for (const kind of SHELF_KINDS)
    for (const row of view.shelves[kind].rows)
      for (const it of row.items)
        if (it.t === "c" && it.id === catId) return { kind, row, cat: it };
  return null;
};

export function patchCat(view, catId, patch) {
  const found = findCat(view, catId);
  if (!found) return view;
  return mapShelf(view, found.kind, (rows) =>
    rows.map((r) =>
      r.id !== found.row.id
        ? r
        : { ...r, items: r.items.map((it) => (it.id === catId ? { ...it, ...patch } : it)) }
    )
  );
}

export function removeCat(view, catId) {
  const found = findCat(view, catId);
  if (!found) return view;
  // seuls les films retombent dans le sas ; les décors partent avec la boîte
  const ids = found.cat.items.filter((s) => s.t === "f").map((s) => s.id);
  return mapShelf(view, found.kind, (rows) =>
    toUnplaced(
      rows.map((r) =>
        r.id !== found.row.id ? r : { ...r, items: r.items.filter((it) => it.id !== catId) }
      ),
      ids
    )
  );
}

/* Un décor vit à deux profondeurs depuis qu'il entre dans les boîtes :
   posé sur la planche, ou rangé dans une catégorie. Ces deux fonctions
   partagent donc la même descente — sans quoi retoucher un intercalaire
   glissé dans une boîte ne trouverait rien et ne dirait rien.

   `edit` rend le tableau d'items retouché, ou le MÊME tableau quand le
   décor n'y est pas : c'est ce qui permet de savoir qu'on a trouvé sans
   parcourir deux fois. */
const mapDecorIn = (items, id, edit) => {
  const top = edit(items);
  if (top !== items) return top;
  let found = false;
  const out = items.map((it) => {
    if (found || it.t !== "c") return it;
    const sub = edit(it.items);
    if (sub === it.items) return it;
    found = true;
    return { ...it, items: sub };
  });
  return found ? out : items;
};

const withDecor = (view, id, edit) => {
  for (const kind of SHELF_KINDS) {
    /* Le mur d'abord : c'est un tableau plat, et le même `edit` y
       travaille sans rien savoir de plus. Sans cette passe, retoucher la
       couleur d'un cadre accroché ne trouvait rien et ne disait rien. */
    const shelf = view.shelves[kind];
    const wall = shelf.wall || [];
    const hung = edit(wall);
    if (hung !== wall) {
      return {
        ...view,
        shelves: { ...view.shelves, [kind]: { ...shelf, wall: hung } },
      };
    }
    for (const row of view.shelves[kind].rows) {
      const items = mapDecorIn(row.items, id, edit);
      if (items === row.items) continue;
      return mapShelf(view, kind, (rows) =>
        rows.map((r) => (r.id !== row.id ? r : { ...r, items }))
      );
    }
  }
  return view;
};

/* Retirer un décor : c'est le seul objet qu'un geste supprime vraiment,
   parce qu'il ne contient rien qu'on puisse regretter. */
export function removeDecor(view, id) {
  return withDecor(view, id, (items) =>
    items.some((it) => it.t === "d" && it.id === id) ? items.filter((it) => it.id !== id) : items
  );
}

export function patchDecor(view, id, patch) {
  return withDecor(view, id, (items) =>
    items.some((it) => it.t === "d" && it.id === id)
      ? items.map((it) => (it.id === id ? { ...it, ...patch } : it))
      : items
  );
}

/* ------------------------------------------------------------
   Le débordement — une planche pleine pousse sur la suivante
   ------------------------------------------------------------

   Le compte d'une rangée ne la REPLIE pas sur elle-même : il dit combien
   de boîtiers elle TIENT. Poser douze films sur une planche de cinq ne
   fabrique pas trois lignes sous une même planche — cela remplit la
   planche, et le reste va sur celle d'en dessous, en cascade. C'est ce
   que fait une étagère, et c'était le vrai défaut du premier jet :
   régler une ligne à cinq entassait tout le rayon en accordéon.

   Le surplus qui arrive au bout ouvre des rangées neuves AVANT la rangée
   d'arrivée — celle-ci reste ce qu'elle est, un sas, jamais un rayon. */
export function reflowShelf(view, kind) {
  const rows = view.shelves[kind].rows;
  const out = [];
  let carry = [];
  let lastCap = capFor(kind);
  let changed = false;

  for (const row of rows) {
    if (isUnplaced(row)) {
      // ce qui déborde encore prend des planches neuves, pas le sas
      for (const part of carry.length ? chunk(carry, lastCap) : []) {
        out.push(makeRow({ items: part }));
        changed = true;
      }
      carry = [];
      out.push(row);
      continue;
    }
    if (row.perRow) lastCap = row.perRow;
    let items = carry.length ? [...carry, ...row.items] : row.items;
    carry = [];
    if (row.perRow && items.length > row.perRow) {
      carry = items.slice(row.perRow);
      items = items.slice(0, row.perRow);
    }
    if (items === row.items) out.push(row);
    else {
      out.push({ ...row, items });
      changed = true;
    }
  }

  if (!changed) return view;
  return { ...view, shelves: { ...view.shelves, [kind]: { ...view.shelves[kind], rows: out } } };
}

export function reflowView(view) {
  let next = view;
  for (const kind of SHELF_KINDS) next = reflowShelf(next, kind);
  return next;
}

/* Étaler une collection sur des planches neuves. Sert à une vue qu'on
   vient de créer : la laisser entièrement dans le sas donnerait une
   étagère vide et un tas, ce qui n'est pas un rangement.

   UNE rangée, et non plus des paquets de dix. Une rangée ne montre que ce
   qu'elle CONTIENT : la débiter par dix, c'était poser dix boîtiers sur
   une planche qui en tient quinze et laisser un tiers de bois nu — un
   rayon neuf avait l'air à moitié vide sur un grand écran. Elle prend
   donc tout, remplit la largeur et se replie en autant de lignes de bois
   qu'il faut. On coupe ensuite là où l'on veut, en lâchant un boîtier sur
   une couture. `cap` reste pour qui veut des paquets choisis. */
export function layoutView(view, films, cap = null) {
  const shelves = {};
  for (const kind of SHELF_KINDS) {
    const ids = films.filter(belongs[kind]).map((f) => f.id);
    const rows = ids.length
      ? chunk(ids, cap).map((part) => makeRow({ perRow: cap, items: part.map(filmItem) }))
      : [makeRow({ perRow: cap })];
    shelves[kind] = { rows: [...rows, makeRow({ kind: "unplaced" })] };
  }
  return { ...view, shelves };
}

/* Le cinéaste d'un film, ou le nom qu'on donne à son absence. Le mur
   regroupé emploie déjà exactement ce libellé : deux endroits qui
   montrent la même chose doivent la nommer pareil. */
export const UNKNOWN_DIRECTOR = "Réalisateur inconnu";

export const directorOf = (film) => film.director?.trim() || UNKNOWN_DIRECTOR;

/* UNE ÉTAGÈRE PAR CINÉASTE — une ligne par réalisateur, et sur cette
   ligne une boîte à son nom qui tient ses films.

   La boîte n'est pas une décoration : c'est elle qui rend la ligne
   manipulable. Poser les films à même la rangée avec un simple libellé
   dans la gouttière aurait donné le même dessin, mais le premier
   glissement aurait mélangé deux cinéastes sans rien pour s'y opposer.
   Une boîte se déplace pleine, se referme, et refuse ce qui n'est pas un
   film — la ligne garde son sens toute seule.

   L'ordre est celui du mur regroupé, repris à l'identique : les plus
   fréquentés d'abord, puis l'alphabet, et les sans-nom en dernier. C'est
   là que se lisent les habitudes.

   Le résultat est une vue ORDINAIRE. Rien ne la marque, rien ne la
   régénère : une fois posée, elle se réarrange à la main comme les
   autres, et les films qui arrivent ensuite tombent dans la rangée
   d'arrivée. Une vue qui se referait toute seule à chaque chargement
   effacerait le rangement de l'utilisateur, ce que ce modèle refuse
   partout ailleurs. */
export function layoutByDirector(view, films, { cap = null } = {}) {
  const shelves = {};
  let colorAt = 0;

  for (const kind of SHELF_KINDS) {
    const n = cap || capFor(kind);

    const by = new Map();
    for (const f of films.filter(belongs[kind])) {
      const key = directorOf(f);
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }

    const rows = [...by.entries()]
      .sort(
        (a, b) =>
          b[1].length - a[1].length ||
          (a[0] === UNKNOWN_DIRECTOR
            ? 1
            : b[0] === UNKNOWN_DIRECTOR
              ? -1
              : a[0].localeCompare(b[0]))
      )
      .map(([name, list]) =>
        makeRow({
          /* Pas de compte écrit : la rangée prend celui de sa largeur, et
             la boîte du cinéaste s'y coupe en autant de lignes de bois
             qu'il faut — une filmographie de trente titres tient ainsi
             dans son carton au lieu de partir en bande sans fin. */
          items: [
            makeCat({
              label: name,
              color: CAT_KEYS[colorAt++ % CAT_KEYS.length],
              items: list.map((f) => filmItem(f.id)),
            }),
          ],
        })
      );

    if (!rows.length) rows.push(makeRow());
    shelves[kind] = { rows: [...rows, makeRow({ kind: "unplaced" })] };
  }

  return { ...view, shelves };
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
  slots.forEach(([r, i], n) => {
    rows[r].items[i] = sorted[n];
  });
  /* Dans une boîte, même règle qu'au premier niveau : les films se
     redistribuent dans les emplacements qu'ils occupaient, et ce qui
     n'est pas un film ne bouge pas. Trier le tableau entier passerait le
     comparateur — écrit pour des films — sur des intercalaires, et les
     ferait glisser au petit bonheur au milieu du classement. */
  for (const row of rows) {
    for (let i = 0; i < row.items.length; i++) {
      const it = row.items[i];
      if (it.t !== "c") continue;
      const at = [];
      for (let s = 0; s < it.items.length; s++) if (it.items[s].t === "f") at.push(s);
      if (!at.length) continue;
      const inner = at.map((s) => it.items[s]).sort(compare);
      const items = [...it.items];
      at.forEach((s, n) => {
        items[s] = inner[n];
      });
      row.items[i] = { ...it, items };
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
    /* Le mur d'avant réglait son compte pour tout le rayon. Quand il en
       avait un, c'était un CHOIX : on le reprend tel quel, écrit dans la
       gouttière. Quand il était sur « auto », on ne lui en invente pas un
       — les rangées naissent auto et remplissent leur largeur. */
    const legacyPref = (() => {
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
        ...placed.map((f) => ({
          type: "film",
          id: f.id,
          order: LEGACY_RANK(f.order),
          tie: -(f.addedAt || 0),
        })),
        ...tabs.map((d) => ({ type: "divider", divider: d, order: LEGACY_RANK(d.order), tie: 0 })),
      ].sort((a, b) => a.order - b.order || a.tie - b.tie);

      const rows = [];
      // le compte ÉCRIT dans la gouttière : seulement s'il fut voulu
      let want = kind === "reserve" ? null : legacyPref;
      let loose = []; // les films libres, en attente de planches
      let cat = null;

      /* On débite au compte VOULU, et sur « auto » on ne débite pas : une
         planche sans compte remplit sa largeur et se replie en lignes de
         bois, la couper par dix la laisserait à moitié nue. */
      const flushLoose = () => {
        for (const part of chunk(loose, want))
          if (part.length) rows.push(makeRow({ perRow: want, items: part }));
        loose = [];
      };

      for (const it of merged) {
        if (it.type === "divider") {
          /* Un intercalaire ouvrait une ligne et donnait son compte : il
             devient une RANGÉE, et son libellé la catégorie qui en occupe
             la tête et avale ce qui suivait. */
          flushLoose();
          cat = makeCat({
            label: it.divider.label || "Catégorie",
            color: CAT_KEYS[colorAt++ % CAT_KEYS.length],
          });
          want = it.divider.perRow || want;
          rows.push(makeRow({ perRow: want, items: [cat] }));
        } else if (cat) {
          cat.items.push(filmItem(it.id));
        } else {
          loose.push(filmItem(it.id));
        }
      }
      flushLoose();
      /* Les films jamais rangés à la main n'ont pas de place VOULUE, mais
         ils ont une place : c'est toute la collection de qui n'a jamais
         touché au rangement manuel. Les verser dans le sas d'arrivée
         faisait de l'étagère un rayon vide et un tas de cinquante
         boîtiers sur une ligne sans fin. Ils prennent donc des planches,
         comme les autres. Le sas ne sert qu'à ce qui ARRIVE ensuite. */
      loose = never.map((f) => filmItem(f.id));
      flushLoose();
      if (!rows.length) rows.push(makeRow({ perRow: want }));
      rows.push(makeRow({ kind: "unplaced" }));

      view.shelves[kind] = { rows };
    }
    views.push(view);

    /* Une seconde vue, offerte d'emblée : l'étagère par cinéaste. Elle
       arrive APRÈS le rangement d'origine, qui reste donc la vue ouverte
       par défaut — on propose un autre regard, on n'en impose pas un.
       Un mur sans le moindre film n'en a pas besoin : deux étagères vides
       à choisir ne sont pas un choix. */
    if (pool.length) {
      views.push(
        /* Sans `cap` : chaque rayon garde le sien, et le tiroir sa
           largeur de tiroir. Le compte hérité de l'ancien mur n'a de sens
           que pour la vue qui reproduit ce mur. */
        layoutByDirector(makeView({ wall, name: "Par réalisateur", theme: "kraft", now }), pool)
      );
    }
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
          it.t === "f"
            ? it
            : it.t === "c"
              ? {
                  ...it,
                  id: `c_${uid()}`,
                  /* Un décor rangé dans une boîte est du mobilier comme
                     celui posé sur la planche : il lui faut un identifiant
                     neuf, sans quoi les deux vues se partageraient le
                     même bibelot et le retirer d'un côté le retirerait
                     de l'autre. */
                  items: it.items.map((s) => (s.t === "f" ? { ...s } : { ...s, id: `d_${uid()}` })),
                }
              : { ...it, id: `d_${uid()}` }
        ),
      })),
    };
  }
  return {
    ...view,
    id: `v_${uid()}`,
    name: name || `${view.name} (copie)`,
    createdAt: now,
    updatedAt: now,
    shelves,
  };
}
