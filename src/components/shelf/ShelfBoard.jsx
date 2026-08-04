/* Le rangement à la main : c'est ici que vit tout le glisser-déposer. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "../../theme/tokens";
import {
  SHELF_KINDS,
  CAT_KEYS,
  belongs,
  makeCat,
  makeDecor,
  reconcileView,
  moveItem,
  patchRow,
  addRow,
  removeRow,
  clearRow,
  addCat,
  patchCat,
  removeCat,
  patchDecor,
  removeDecor,
} from "../../shelf-views";
import { SHELF_KIND, BOX_H, GAP_X, GAP_Y, MARK_W, MARK_H, themeOf } from "./constants";
import { DropMark } from "./items";
import { Shelf, ReserveDrawer, CasePreview, DecorCabinet, ItemPalette } from "./layout";

export function ShelfBoard({ films, doc, onDoc, onOpen, onUpdateMany, dimSet }) {
  /* Un glissement ne change AUCUN état React. C'était le dernier retard
     visible : `setDragId` au départ du glissement re-rendait le rayon, ce
     qui salissait la mise en page — et le premier `getBoundingClientRect`
     du premier survol devait alors la recalculer entièrement avant que le
     repère puisse s'afficher. D'où un trait qui tardait à apparaître.

     Tout ce qui bouge pendant un glissement est donc écrit à la main : le
     boîtier pâli, le repère, les voisins écartés, les cibles qui
     s'éclairent, et l'attribut `data-dragging` du document. */
  const dragRef = useRef(null); // { type, id, node, create? }
  const overRef = useRef({}); // { kind, rowId, catId, overId, side, afterRowId }
  const markRef = useRef(null); // le repère de dépôt, hors React
  const spreadRef = useRef([]); // les couches écartées, à remettre d'aplomb
  const litRef = useRef(null); // la cible actuellement éclairée
  const measureRef = useRef(new WeakMap()); // les rectangles du glissement en cours
  const tailRef = useRef(new WeakMap()); // le dernier objet de chaque rangée survolée
  const [preview, setPreview] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [cabinet, setCabinet] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [editDecor, setEditDecor] = useState(null);

  const filmsById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);

  /* La vue affichée est la vue enregistrée RAMENÉE à la collection réelle :
     films disparus retirés, films neufs recueillis dans la rangée
     d'arrivée. Purement au rendu — on n'écrit rien tant que l'utilisateur
     n'a pas lui-même rangé quelque chose. */
  const view = useMemo(() => (doc ? reconcileView(doc, films) : null), [doc, films]);
  const theme = themeOf(view?.theme);

  const dim = useCallback((f) => !!dimSet && !dimSet.has(f.id), [dimSet]);

  const acts = useMemo(
    () => ({
      setRow: (id, patch) => onDoc(patchRow(view, id, patch)),
      addRow: (refId, where, kind) =>
        onDoc(addRow(view, kind || shelfKindOfRow(view, refId), refId, where)),
      removeRow: (id) => onDoc(removeRow(view, id)),
      clearRow: (id) => onDoc(clearRow(view, id)),
      addCat: (rowId) => onDoc(addCat(view, rowId, makeCat({ color: CAT_KEYS[0] }))),
      setCat: (id, patch) => onDoc(patchCat(view, id, patch)),
      removeCat: (id) => onDoc(removeCat(view, id)),
      setDecor: (id, patch) => onDoc(patchDecor(view, id, patch)),
      removeDecor: (id) => onDoc(removeDecor(view, id)),
    }),
    [view, onDoc]
  );

  /* Mesurer une fois, pour tout le glissement.

     `dragover` tire en continu, souris immobile comprise. Chaque
     gestionnaire de survol avait besoin d'un rectangle, et le redemandait
     à chaque événement — soixante fois par seconde pour un curseur qui ne
     bouge pas.

     Une lecture de rectangle n'est pas un renseignement qu'on consulte,
     c'est une question à laquelle le navigateur doit répondre JUSTE : il
     entérine donc toute mise en page en attente avant de répondre. Or les
     enveloppes portent `content-visibility: auto` (voir `items.jsx`), qui
     dit précisément au navigateur de NE PAS mettre en page ce qui est hors
     écran. Lui réclamer un rectangle le forçait à calculer la rangée
     entière qu'il venait délibérément de sauter, et qu'il sauterait de
     nouveau aussitôt après. Cent boîtiers mis en page puis jetés, soixante
     fois par seconde, sans jamais rendre la main : l'onglet ralentissait
     jusqu'à mourir avec le boîtier encore en l'air.

     On peut retenir ces mesures parce que le fichier s'interdit ailleurs de
     bouger les cibles — voir le long passage sur l'écartement, plus bas :
     seule une couche INTÉRIEURE bascule, l'enveloppe ne bouge pas d'un
     cheveu de tout le glissement. Le cache repose entièrement sur cette
     promesse. Si une transformation atterrit un jour sur l'enveloppe
     elle-même, ces mesures deviennent fausses en même temps que le geste
     redevient oscillant : c'est le même invariant qui tient les deux.

     Un `WeakMap` neuf à chaque glissement, et rien à ranger : la page peut
     changer entre deux gestes, elle ne changera pas pendant l'un d'eux. */
  const rectOf = (node) => {
    const seen = measureRef.current;
    let r = seen.get(node);
    if (!r) seen.set(node, (r = node.getBoundingClientRect()));
    return r;
  };

  /* Le dernier objet d'une rangée. Même raisonnement, même durée de vie :
     la rangée ne se remplit pas pendant qu'on la survole, et parcourir ses
     enfants à chaque événement pour retrouver le même nœud n'apprenait
     rien à personne. `null` est une réponse valable — on la retient donc
     aussi, sinon une rangée vide serait reparcourue à chaque frimousse.

     Son propre registre, et non celui des rectangles : une rangée est à la
     fois quelque chose qu'on mesure et quelque chose dont on cherche le
     dernier enfant, et un seul registre lui rendrait l'une des deux
     réponses à la place de l'autre. */
  const tailOf = (strip) => {
    const seen = tailRef.current;
    if (seen.has(strip)) return seen.get(strip);
    const items = strip.querySelectorAll(":scope > [data-shelf-item]");
    const last = items[items.length - 1] || null;
    seen.set(strip, last);
    return last;
  };

  const hideMark = () => {
    if (markRef.current) markRef.current.style.opacity = "0";
  };

  /* Poser le repère.

     Une fois posé, il n'a plus qu'à glisser d'une fente à l'autre : on
     écrit le `transform`, la transition de la feuille de styles fait le
     reste, et il file d'un intervalle au suivant au lieu de sauter.

     La PREMIÈRE pose est le cas délicat. Le repère est un élément unique
     qui vit dans la page en permanence : il porte encore la position du
     glissement d'avant. Le laisser glisser depuis là, c'est un trait qui
     traverse l'étagère en biais avant de se poser. On coupe donc la
     transition, on l'installe un peu au-dessus de sa place et un peu
     écrasé, on force le navigateur à entériner cet état de départ, et
     seulement alors on rend la transition et on vise la place juste : il
     redescend de ses sept pixels en se dépliant, ce qui ressemble à
     quelque chose qu'on dépose plutôt qu'à quelque chose qui s'allume.

     C'est la lecture de rectangle qui force cette prise en compte, et
     c'est délibérément elle plutôt qu'une attente de trame. Un double
     `requestAnimationFrame` ferait le même travail sans rien coûter en
     mise en page — mais il ferait dépendre l'apparition du repère de la
     bonne volonté des trames PENDANT une boucle de glissement native, ce
     que tous les navigateurs ne garantissent pas ; là où les trames sont
     affamées, le repère ne naîtrait jamais. Le coût, lui, est nul à
     l'échelle de ce fichier : une seule fois par glissement, quand le
     survol d'un boîtier en lit déjà une à chaque événement.

     Les deux gestes n'ont pas la même vitesse, et c'est voulu. La dépose
     peut prendre son temps : elle n'a rien à rattraper, on la regarde.
     Le glissement d'une fente à l'autre, lui, court après la souris — au
     même tempo il traînerait derrière elle. D'où une durée longue écrite
     en ligne pour la seule pose, que le premier déplacement efface pour
     retomber sur le tempo vif de la feuille de styles. */
  const SETTLE = "transform .36s cubic-bezier(.16,.86,.26,1), opacity .3s ease-out";

  /* `rot` : entre deux RANGÉES, le repère se couche. C'est le même
     élément et le même dessin — seule la chaîne de transformation
     change, donc rien de neuf à peindre. */
  const placeMark = (x, y, rot = 0) => {
    const m = markRef.current;
    if (!m) return;
    const turn = rot ? ` rotate(${rot}deg)` : "";
    const at = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)${turn}`;
    if (m.style.opacity === "1") {
      if (m.style.transition) m.style.transition = ""; // la pose est finie, on reprend le pas vif
      m.style.transform = at;
      return;
    }

    m.style.transition = "none";
    m.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y) - 9}px, 0)${turn} scaleY(0.86)`;
    m.getBoundingClientRect();
    m.style.transition = SETTLE;
    m.style.transform = at;
    m.style.opacity = "1";
  };

  /* Les deux voisins du point de dépôt s'écartent pour faire la place :
     c'est le geste des deux doigts qui ouvrent une rangée de boîtiers
     avant d'y glisser le suivant. Ils ne glissent pas à plat — ils
     BASCULENT, pivotant sur leur pied comme des boîtiers debout qu'on
     couche l'un vers la gauche, l'autre vers la droite. C'est l'idiome
     de toute la page : le survol d'un boîtier le fait déjà se pencher.

     Comme le repère, cela s'écrit à la main sur les nœuds — un `setState`
     ici rendrait à nouveau tout le rayon à chaque frémissement de souris,
     ce que toute cette partie s'emploie à éviter.

     Le geste bascule une COUCHE À L'INTÉRIEUR de l'enveloppe, jamais
     l'enveloppe elle-même, et c'est toute la différence entre un
     écartement et un tremblement.

     L'enveloppe est la cible de dépôt. La faire basculer, c'était
     déplacer la cible sous le curseur : les deux voisins s'écartant de
     sept pixels chacun, un trou de quatorze s'ouvrait entre eux — juste
     là où la main visait. Le curseur y tombait, ne survolait plus aucun
     boîtier, l'événement retombait sur la rangée qui rappelait tout le
     monde à sa place, le curseur se retrouvait sur le boîtier, qui
     rouvrait le trou. Vingt fois par seconde. Le geste se mordait la
     queue parce qu'il effaçait sa propre condition.

     Les cibles sont donc fixes pour toute la durée du glissement : elles
     pavent la rangée et rien ne les bouge. Seule l'image bascule. C'est
     aussi ce qui permet de mesurer les rectangles au repos sans avoir à
     défalquer quoi que ce soit — l'écartement ne les touche plus. */
  const SPREAD = 7,
    TILT = 1.4;

  /* La couche qui bascule, sous une enveloppe donnée. */
  const leanLayer = (wrap) => wrap?.querySelector(":scope > [data-lean]") || null;

  const clearSpread = () => {
    spreadRef.current.forEach((node) => {
      node.style.transform = "";
    });
    spreadRef.current = [];
  };

  const setSpread = (left, right) => {
    clearSpread();
    const next = [];
    [
      [left, -1],
      [right, 1],
    ].forEach(([wrap, dir]) => {
      const layer = leanLayer(wrap);
      if (!layer) return;
      layer.style.transform = `translateX(${dir * SPREAD}px) rotate(${dir * TILT}deg)`;
      next.push(layer);
    });
    spreadRef.current = next;
  };

  /* Le voisin immédiat. Aux bords d'une catégorie il n'y a PAS de frère :
     le boîtier suivant est dehors, un cran plus haut dans l'arbre. On
     remonte alors jusqu'à la boîte elle-même et on prend son voisin à
     elle — la catégorie s'écarte d'un bloc, et c'est exactement ce qu'on
     veut voir : la boîte s'ouvre pour accueillir. */
  const neighbour = (wrap, dir) => {
    const sib = dir < 0 ? wrap.previousElementSibling : wrap.nextElementSibling;
    if (sib && sib.hasAttribute("data-shelf-item")) return sib;
    const box = wrap.parentElement?.closest("[data-shelf-item]");
    if (!box) return null;
    const out = dir < 0 ? box.previousElementSibling : box.nextElementSibling;
    return out && out.hasAttribute("data-shelf-item") ? out : null;
  };

  /* Éclairer une cible, et une seule. En attribut plutôt qu'en état : les
     règles vivent dans la feuille de styles, et React ne sait rien de ce
     qui s'allume pendant qu'on glisse. */
  const light = (node, attr) => {
    if (litRef.current === node) return;
    if (litRef.current) {
      delete litRef.current.dataset.catOver;
      delete litRef.current.dataset.rowOver;
      delete litRef.current.dataset.seamOver;
    }
    litRef.current = node;
    if (node) node.dataset[attr] = "1";
  };

  const reset = useCallback(() => {
    const d = dragRef.current;
    if (d?.node && !d.create) d.node.style.opacity = "";
    dragRef.current = null;
    overRef.current = {};
    /* Les mesures ne valaient que pour CE glissement : le suivant trouvera
       peut-être une étagère rangée autrement, et il la remesurera. */
    measureRef.current = new WeakMap();
    tailRef.current = new WeakMap();
    hideMark();
    clearSpread();
    light(null);
    delete document.documentElement.dataset.dragging;
  }, []);

  const onDragStart = useCallback((type, id, node) => {
    dragRef.current = { type, id, node };
    if (node) node.style.opacity = "0.35"; // le boîtier soulevé, sans passer par React
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* Sortir un décor du cabinet, c'est le FAIRE, pas le déplacer : il
     n'existe nulle part tant qu'on ne l'a pas lâché. */
  const onDecorDragStart = useCallback((motif, node) => {
    dragRef.current = { type: "decor", id: null, node, create: makeDecor({ motif }) };
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* Une boîte ne contient que des films — `moveItem` le refuse net. Le
     repère ne doit donc jamais INVITER autre chose à y entrer : une boîte
     ou un décor qu'on promène au-dessus d'une catégorie voyait la fente
     s'ouvrir devant lui, et le lâcher ne faisait rien. Un dépôt qui
     s'annonce et n'arrive pas est pire que pas de cible du tout. Ce qui
     ne peut pas entrer se range donc À CÔTÉ de la boîte. */
  const goesInside = (drag) => drag.type === "film";

  /* Viser la fente avant ou après un objet du rayon.

     `wrap` est toujours une enveloppe [data-shelf-item] : elle porte
     l'écart qui suit l'objet, jamais l'objet seul. On retire donc cet
     écart pour retrouver la tranche — sinon le partage en deux moitiés se
     ferait autour d'un milieu décalé, et le repère hésiterait sur le bord
     au lieu de trancher.

     Ce gestionnaire ne touche pas à l'état React : il déplace un unique
     élément à la main. Faire passer le repère par un `setState`, c'était
     redemander à React de reconstruire les cent boîtiers du rayon à chaque
     frimousse de la souris — même mémoïsés, cent comparaisons de props par
     événement, soixante fois par seconde. */
  const aimBeside = (wrap, clientX, ctx) => {
    const id = wrap.dataset.shelfItem;
    /* Le rectangle d'une enveloppe est toujours celui du repos :
       l'écartement bascule une couche à l'intérieur d'elle et ne la
       déplace pas. Rien à défalquer, donc, et surtout rien qui puisse se
       mettre à osciller au gré de sa propre animation. */
    const r = rectOf(wrap);
    const left = r.left,
      right = r.right - GAP_X;
    const o = overRef.current;

    /* Le milieu du boîtier est une charnière, et une charnière franche
       claque. À son aplomb, le moindre tremblement de la main renvoyait
       le repère d'un bord à l'autre — deux fentes distantes de cent
       pixels, désignées l'une après l'autre par un curseur qui n'a pas
       bougé d'un cheveu, et les voisins qui s'écartaient dans un sens
       puis dans l'autre à chaque aller.

       On ne change donc d'avis qu'en dépassant FRANCHEMENT le milieu, et
       seulement quand on tenait déjà ce boîtier : la bande morte ne
       s'applique pas au premier survol, où il n'y a pas d'avis à garder
       et où le partage en deux moitiés est le bon. */
    const HYST = 6;
    const mid = (left + right) / 2;
    const held = o.overId === id ? o.side : null;
    const s = held
      ? clientX < mid - HYST
        ? "before"
        : clientX > mid + HYST
          ? "after"
          : held
      : clientX < mid
        ? "before"
        : "after";

    if (o.overId === id && o.side === s && (o.catId || null) === (ctx.catId || null)) return;
    overRef.current = { ...ctx, overId: id, side: s };
    light(null);

    // le repère est centré dans l'espace qui s'ouvre entre les deux voisins
    placeMark(
      (s === "before" ? left - 5 : right + 5) - MARK_W / 2,
      r.bottom - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2
    );
    if (s === "before") setSpread(neighbour(wrap, -1), wrap);
    else setSpread(wrap, neighbour(wrap, 1));
  };

  /* `dragover` tire en continu tant que la souris bouge, et même immobile. */
  const onBoxOver = useCallback((e, ctx) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = e.currentTarget;
    /* Un boîtier DANS une boîte : si ce qu'on tire ne peut pas y entrer,
       on ne vise pas la fente qu'on a sous les yeux — on remonte à la
       boîte et on vise à côté d'elle, au niveau de la rangée. */
    if (ctx.catId && !goesInside(drag)) {
      const box = wrap.parentElement?.closest("[data-shelf-item]");
      if (box) aimBeside(box, e.clientX, { kind: ctx.kind, rowId: ctx.rowId, catId: null });
      return;
    }
    aimBeside(wrap, e.clientX, ctx);
  }, []);

  /* Le corps d'une catégorie : on entre DANS la boîte, à la suite. */
  const onCatOver = useCallback((e, ctx) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = e.currentTarget;
    // une boîte ne se range pas dans une boîte : elle se range à côté
    if (!goesInside(drag)) {
      aimBeside(wrap, e.clientX, { kind: ctx.kind, rowId: ctx.rowId, catId: null });
      return;
    }
    const o = overRef.current;
    if (o.catId === ctx.catId && !o.overId) return;
    overRef.current = { ...ctx, overId: null, side: null };
    clearSpread();
    /* C'est le CARTON qui s'éclaire, pas l'enveloppe : celle-ci n'est
       qu'une zone, elle n'a ni papier ni bord à teinter. */
    const card = wrap.querySelector("[data-cat-card]");
    light(card, "catOver");
    const r = rectOf(card || wrap);
    // le pied des boîtiers d'une boîte est à un écart au-dessus de son bas
    placeMark(r.right - 5 - MARK_W / 2, r.bottom - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2);
  }, []);

  /* Le vide d'une rangée : à la suite de ce qui s'y trouve déjà. */
  const onRowOver = useCallback((e, ctx) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const o = overRef.current;
    if (o.rowId === ctx.rowId && !o.overId && !o.catId && !o.afterRowId) return;
    overRef.current = { ...ctx, overId: null, side: null };
    clearSpread();
    light(e.currentTarget, "rowOver");
    const strip = e.currentTarget;
    const last = tailOf(strip);
    const r = rectOf(strip);
    /* `content-visibility` peut avoir sauté la mise en page du dernier
       boîtier ; un rectangle vide n'apprendrait rien, on se rabat alors
       sur le bord de la rangée. */
    const lr = last && rectOf(last);
    // les rectangles d'enveloppe portent l'écart : on le retire pour viser la tranche
    const x = lr && lr.width ? lr.right - GAP_X + 5 : r.left + GAP_Y;
    const y = (lr && lr.height ? lr.bottom : r.bottom) - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2;
    placeMark(x - MARK_W / 2, y);
  }, []);

  /* La couture entre deux rangées : y lâcher quelque chose ouvre une
     rangée neuve. Le repère se couche pour le dire. */
  const onSeamOver = useCallback((e, kind, afterRowId) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    if (overRef.current.afterRowId === afterRowId) return;
    overRef.current = { kind, afterRowId, rowId: null, catId: null, overId: null };
    clearSpread();
    light(e.currentTarget, "seamOver");
    const r = rectOf(e.currentTarget);
    placeMark(r.left + r.width / 2 - MARK_W / 2, r.top + r.height / 2 - MARK_H / 2, 90);
  }, []);

  const onShelfOver = useCallback(() => {}, []); // le repère suffit à dire où l'on va

  /* Déposer.

     Il n'y a plus de numéros à distribuer ni de rayon à renuméroter : la
     place d'un boîtier est sa position dans un tableau, et l'écriture ne
     touche qu'un document — celui de la vue. Ce que le film garde en
     propre, ce sont ses drapeaux : ils disent SUR QUEL rayon il est, et
     ils valent pour toutes les vues à la fois. */
  const drop = (kind) => {
    const drag = dragRef.current;
    if (!drag || !view) return reset();
    const o = overRef.current;

    let target;
    if (o.kind === kind && o.afterRowId) {
      target = { kind, afterRowId: o.afterRowId };
    } else if (o.kind === kind && o.rowId) {
      target = { kind, rowId: o.rowId, catId: o.catId, overId: o.overId, side: o.side };
    } else {
      /* Lâché sur le fond d'un rayon, sur la languette du tiroir, ou sur
         un repère resté d'ailleurs : on ne sait pas OÙ, seulement sur
         quel rayon. La rangée d'arrivée est faite pour ça. */
      const rows = view.shelves[kind].rows;
      target = { kind, rowId: rows[rows.length - 1].id };
    }

    const next = moveItem(view, drag.create ? { create: drag.create } : { id: drag.id }, target);
    if (next !== view) onDoc(next);
    if (drag.type === "film") onUpdateMany({ [drag.id]: { ...SHELF_KIND[kind].patch } });
    reset();
  };

  /* `drop` lit la vue et la collection : elle est donc forcément refaite à
     chaque rendu, et c'est très bien — elle ne sert qu'une fois, au lâcher.

     Ce qui ne va pas, c'est de la faire voyager telle quelle. Le paquet
     `dnd` descend en prop jusqu'aux RANGÉES ; une seule fonction neuve
     dedans, et le paquet entier est neuf, si bien que le `React.memo` de
     chaque rangée voit des props différentes et refait son travail — pour
     une fonction qu'on n'a même pas appelée.

     Les boîtiers, eux, y échappent : ils reçoivent les gestionnaires un par
     un, et ceux-là sont déjà stables. La perte se limite donc aux rangées.
     Elle vaut quand même d'être colmatée, parce qu'une rangée refaite
     remplace ses enveloppes — et que les mesures retenues plus haut
     désignaient précisément ces enveloppes-là. Le seul rendu qu'un
     glissement déclenche (la languette du tiroir qui s'ouvre) suffirait
     alors à jeter le cache au milieu du geste.

     On range donc la fonction du jour derrière une poignée qui, elle, ne
     change jamais. Le paquet devient constant pour toute la vie du
     composant, et la promesse tient.

     Le rangement se fait après coup plutôt qu'en plein rendu : un rendu
     doit pouvoir être joué deux fois sans rien laisser derrière lui. Le
     décalage est sans conséquence ici — la poignée n'est tirée qu'au
     lâcher, longtemps après que l'écran s'est posé. */
  const dropRef = useRef(drop);
  useEffect(() => {
    dropRef.current = drop;
  });
  const onDrop = useCallback((kind) => dropRef.current(kind), []);

  const dnd = useMemo(
    () => ({
      onDragStart,
      onDragEnd: reset,
      onShelfOver,
      onBoxOver,
      onCatOver,
      onRowOver,
      onSeamOver,
      onDrop,
    }),
    [onDragStart, reset, onShelfOver, onBoxOver, onCatOver, onRowOver, onSeamOver, onDrop]
  );

  const countOf = (kind) => films.filter(belongs[kind]).length;

  if (!view) return null;

  const cat = editCat && findCatIn(view, editCat);
  const decor = editDecor && findDecorIn(view, editDecor);

  const shared = {
    dnd,
    acts,
    films: filmsById,
    theme,
    dim,
    onOpen: setPreview,
    onEditCat: setEditCat,
    onEditDecor: setEditDecor,
  };

  return (
    /* `--mark-ink` : l'encre du repère vient du thème de la vue, par
       variable CSS. Un changement de thème n'a ainsi rien à demander à
       React au milieu d'un glissement. */
    <div onDragEnd={reset} style={{ "--mark-ink": theme.accent }}>
      {/* le repère de dépôt : un seul, déplacé à la main pendant le glissement */}
      <DropMark ref={markRef} />
      <Shelf
        kind="chevet"
        shelf={view.shelves.chevet}
        count={countOf("chevet")}
        onCabinet={setCabinet}
        {...shared}
      />
      <Shelf
        kind="main"
        shelf={view.shelves.main}
        count={countOf("main")}
        onCabinet={setCabinet}
        {...shared}
      />
      <ReserveDrawer
        shelf={view.shelves.reserve}
        count={countOf("reserve")}
        open={drawer}
        setOpen={setDrawer}
        {...shared}
      />
      {cabinet && (
        <DecorCabinet
          kind={cabinet}
          onClose={() => setCabinet(null)}
          onDragStart={onDecorDragStart}
          onDragEnd={reset}
        />
      )}
      {cat && (
        <ItemPalette
          title="CATÉGORIE"
          color={cat.color}
          removeLabel="défaire la catégorie"
          onColor={(k) => acts.setCat(cat.id, { color: k })}
          onRemove={() => {
            acts.removeCat(cat.id);
            setEditCat(null);
          }}
          onClose={() => setEditCat(null)}
        />
      )}
      {decor && (
        <ItemPalette
          title="OBJET"
          color={decor.color}
          size={decor.size}
          removeLabel="retirer l'objet"
          onColor={(k) => acts.setDecor(decor.id, { color: k })}
          onSize={(v) => acts.setDecor(decor.id, { size: v })}
          onRemove={() => {
            acts.removeDecor(decor.id);
            setEditDecor(null);
          }}
          onClose={() => setEditDecor(null)}
        />
      )}
      {preview && filmsById.get(preview) && (
        <CasePreview
          film={filmsById.get(preview)}
          onClose={() => setPreview(null)}
          onOpenFile={onOpen}
        />
      )}
    </div>
  );
}

/* Retrouver un meuble dans la vue — le panneau d'édition n'en connaît
   que l'identifiant. */
const shelfKindOfRow = (view, rowId) =>
  SHELF_KINDS.find((k) => view.shelves[k].rows.some((r) => r.id === rowId)) || "main";

const findCatIn = (view, id) => {
  for (const k of SHELF_KINDS)
    for (const row of view.shelves[k].rows)
      for (const it of row.items) if (it.t === "c" && it.id === id) return it;
  return null;
};

const findDecorIn = (view, id) => {
  for (const k of SHELF_KINDS)
    for (const row of view.shelves[k].rows)
      for (const it of row.items) if (it.t === "d" && it.id === id) return it;
  return null;
};

/* LE CHOIX DE LA VUE — une étagère peut être rangée de plusieurs façons.

   Les films sont les mêmes ; ce qui change, c'est la mise en scène :
   l'ordre, les catégories, la largeur des lignes, les objets posés et le
   bois des planches. On passe de l'une à l'autre sans rien déplacer. */
