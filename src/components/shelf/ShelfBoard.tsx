import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { uid } from "../../domain/film";
import { Shelf } from "./Shelf";
import { ReserveDrawer } from "./ReserveDrawer";
import { CasePreview } from "./CasePreview";
import { BOX_H, DROP_MARK_STYLE, SHELF_KIND } from "./constants";
import type { DragKind, ShelfDnd } from "./constants";
import type { Divider, Film, FilmStatus, PerRow, ShelfKind } from "../../types";

/** Un objet rangé sur un rayon, avec de quoi le trier. */
type Placed = { order: number; tie: number } & (
  { type: "film"; id: string; film: Film } | { type: "divider"; id: string; divider: Divider }
);

interface ShelfBoardProps {
  films: Film[];
  dividers: Divider[];
  onDividers: (next: Divider[]) => void;
  wall: FilmStatus;
  onOpen: (id: string) => void;
  /** Applique un lot de changements, indexé par identifiant de fiche. */
  onUpdateMany: (patches: Record<string, Partial<Film>>) => void;
  manual: boolean;
  onManual: () => void;
  perRow: PerRow;
}

/* Le rangement à la main. Déposer écrit un `order` sur chaque boîtier du
   rayon d'arrivée : sans numéro stable, l'ordre repartirait au tri par
   défaut au prochain rendu. */
export function ShelfBoard({
  films,
  dividers,
  onDividers,
  wall,
  onOpen,
  onUpdateMany,
  manual,
  onManual,
  perRow,
}: ShelfBoardProps) {
  /* Un glissement ne change AUCUN état React. C'était le dernier retard
     visible : `setDragId` au départ du glissement re-rendait le rayon, ce
     qui salissait la mise en page — et le premier `getBoundingClientRect`
     du premier survol devait alors la recalculer entièrement avant que le
     repère puisse s'afficher. D'où un trait qui tardait à apparaître.

     Tout ce qui bouge pendant un glissement est donc écrit à la main : le
     boîtier pâli, le repère, et l'attribut `data-dragging` du document qui
     sert aux quelques effets CSS (la languette du tiroir). */
  const dragRef = useRef<{ type: DragKind; id: string; node: HTMLElement | null } | null>(null);
  const overRef = useRef<{ id: string | null; side: "before" | "after" | null; kind?: ShelfKind }>({
    id: null,
    side: null,
  });
  const markRef = useRef<HTMLDivElement | null>(null); // le repère de dépôt, hors React
  const [preview, setPreview] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  const rank = (o: number | null | undefined) => (o == null ? Number.MAX_SAFE_INTEGER : o);
  const belongs: Record<ShelfKind, (f: Film) => boolean> = {
    chevet: (f) => f.chevet && !f.archived,
    main: (f) => !f.chevet && !f.archived,
    reserve: (f) => f.archived,
  };

  /* Un rayon n'est plus une liste de films mais une liste d'objets rangés :
     boîtiers et intercalaires partagent la même numérotation, sans quoi on
     ne pourrait pas glisser un carton *entre* deux films. */
  const shelves = useMemo(() => {
    const mine = (dividers || []).filter((d) => d.wall === wall);
    const build = (kind: ShelfKind): Placed[] => {
      const boxes: Placed[] = films.filter(belongs[kind]).map((f) => ({
        type: "film",
        id: f.id,
        film: f,
        order: rank(f.order),
        tie: -(f.addedAt || 0),
      }));
      // hors rangement manuel, l'ordre affiché est celui du tri : un
      // intercalaire n'y aurait pas de place définie, il attend son tour
      if (!manual) return boxes;
      const tabs: Placed[] = mine
        .filter((d) => d.shelf === kind)
        .map((d) => ({ type: "divider", id: d.id, divider: d, order: rank(d.order), tie: 0 }));
      return [...boxes, ...tabs].sort((a, b) => a.order - b.order || a.tie - b.tie);
    };
    return { chevet: build("chevet"), main: build("main"), reserve: build("reserve") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [films, dividers, wall, manual]);

  const hideMark = () => {
    if (markRef.current) markRef.current.style.opacity = "0";
  };

  const reset = useCallback(() => {
    const d = dragRef.current;
    if (d?.node) d.node.style.opacity = "";
    dragRef.current = null;
    overRef.current = { id: null, side: null };
    hideMark();
    delete document.documentElement.dataset.dragging;
  }, []);

  const onDragStart = useCallback((type: DragKind, id: string, node: HTMLElement) => {
    dragRef.current = { type, id, node };
    if (node) node.style.opacity = "0.35"; // le boîtier soulevé, sans passer par React
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* `dragover` tire en continu tant que la souris bouge, et même immobile.

     Ce gestionnaire ne touche plus à l'état React : il déplace un unique
     élément à la main. Faire passer le repère par un `setState`, c'était
     redemander à React de reconstruire les cent boîtiers du rayon à chaque
     frimousse de la souris — même mémoïsés, cent comparaisons de props par
     événement, soixante fois par seconde. Ici, un déplacement de rectangle
     et rien d'autre : React dort pendant tout le glissement. */
  const onBoxOver = useCallback((e: DragEvent, kind: ShelfKind, id: string) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const s = e.clientX < r.left + r.width / 2 ? "before" : "after";
    if (overRef.current.id === id && overRef.current.side === s) return;
    overRef.current = { id, side: s, kind };
    const m = markRef.current;
    if (m) {
      m.style.transform = `translate3d(${Math.round(
        s === "before" ? r.left - 7 : r.right + 3
      )}px, ${Math.round(r.bottom - BOX_H)}px, 0)`;
      if (m.style.opacity !== "1") m.style.opacity = "1";
    }
  }, []);

  const onShelfOver = useCallback(() => {}, []); // le repère suffit à dire où l'on va

  /* Écrire l'ordre d'arrivée.

     La version précédente renumérotait le rayon entier à chaque dépôt :
     cent fiches réécrites, cent boîtiers reconstruits, et toute la
     collection re-sérialisée dans localStorage — d'où un dépôt qui traîne,
     et qui pouvait carrément échouer en butant sur le quota quand les
     affiches sont stockées en data URI.

     On ne déplace plus qu'un objet : il reçoit un numéro pris ENTRE ses
     deux voisins. Les intervalles de 10 laissent de la place pour une
     bonne dizaine d'insertions successives au même endroit ; quand il n'y
     en a plus (ou qu'un objet n'a jamais été numéroté), on renumérote le
     rayon, mais seulement ce jour-là. */
  const NUM = (it: Placed) => (it.type === "film" ? it.film.order : it.divider.order);

  const renumber = (kind: ShelfKind, list: Placed[], movedId: string | null) => {
    const patches: Record<string, Partial<Film>> = {};
    const others = (dividers || []).filter(
      (d) => !(d.wall === wall && list.some((it) => it.type === "divider" && it.id === d.id))
    );
    const tabs: Divider[] = [];
    list.forEach((it, i) => {
      if (it.type === "film") patches[it.id] = { order: i * 10 };
      else tabs.push({ ...it.divider, wall, shelf: kind, order: i * 10 });
    });
    if (movedId) patches[movedId] = { ...patches[movedId], ...SHELF_KIND[kind].patch };
    if (Object.keys(patches).length) onUpdateMany(patches);
    onDividers([...others, ...tabs]);
  };

  /* Le numéro à donner à ce qui arrive en position `at`, ou null s'il n'y a
     plus de place et qu'il faut renuméroter. `rest` est le rayon sans lui. */
  const gap = (rest: Placed[], at: number): number | null => {
    if (rest.some((it) => NUM(it) == null)) return null; // rayon jamais numéroté
    const prev = at > 0 ? NUM(rest[at - 1] as Placed) : null;
    const next = at < rest.length ? NUM(rest[at] as Placed) : null;
    if (prev == null && next == null) return 0;
    if (prev == null) return (next as number) - 10;
    if (next == null) return prev + 10;
    if (next - prev < 0.0001) return null; // plus d'intervalle
    return (prev + next) / 2;
  };

  /* Deux gestes différents portés par le même glissement.

     Lâcher un film DANS un rayon ou dans le tiroir, c'est le classer : on
     dit ce qu'il est, pas où il se range. Le tri en cours — par note, par
     année — n'a aucune raison d'être abandonné pour autant.

     Le lâcher ENTRE deux boîtiers, c'est lui donner une place précise :
     là, aucun tri automatique ne peut la tenir, et le rangement passe à
     la main. `positioned` fait la différence. */
  const place = (
    kind: ShelfKind,
    item: Placed,
    rest: Placed[],
    at: number,
    positioned: boolean
  ) => {
    if (!positioned && !manual) {
      if (item.type === "film") onUpdateMany({ [item.id]: { ...SHELF_KIND[kind].patch } });
      else
        onDividers(
          (dividers || []).map((d) => (d.id === item.id ? { ...d, wall, shelf: kind } : d))
        );
      return reset(); // le tri reste celui qu'on avait choisi
    }

    /* On passe du tri automatique au rangement à la main : les numéros
       existants ne suivent pas l'ordre affiché (trier par note ne réordonne
       pas les `order`), donc chercher un intervalle entre deux voisins
       n'aurait aucun sens. On fige l'ordre qu'on a sous les yeux. */
    if (positioned && !manual) {
      renumber(
        kind,
        [...rest.slice(0, at), item, ...rest.slice(at)],
        item.type === "film" ? item.id : null
      );
      onManual();
      return reset();
    }

    const order = gap(rest, at);
    if (order == null) {
      renumber(
        kind,
        [...rest.slice(0, at), item, ...rest.slice(at)],
        item.type === "film" ? item.id : null
      );
    } else if (item.type === "film") {
      onUpdateMany({ [item.id]: { order, ...SHELF_KIND[kind].patch } });
    } else {
      onDividers(
        (dividers || []).map((d) => (d.id === item.id ? { ...d, wall, shelf: kind, order } : d))
      );
    }
    if (positioned) onManual();
    reset();
  };

  const drop = (kind: ShelfKind) => {
    const drag = dragRef.current;
    if (!drag) return;
    const target = shelves[kind].filter((it) => it.id !== drag.id);
    const film = drag.type === "film" ? films.find((f) => f.id === drag.id) : undefined;
    const divider =
      drag.type === "divider" ? (dividers || []).find((d) => d.id === drag.id) : undefined;
    if (!film && !divider) return reset();
    const source: Placed =
      drag.type === "film"
        ? { type: "film", id: drag.id, film: film as Film, order: 0, tie: 0 }
        : { type: "divider", id: drag.id, divider: divider as Divider, order: 0, tie: 0 };

    /* Le dépôt ne vise une place que s'il a été lâché sur un boîtier DE CE
       rayon : sur le fond du rayon, sur la languette du tiroir, ou sur un
       repère resté d'un autre rayon, il ne dit rien de la position. */
    const { id: over, side: atSide } = overRef.current;
    let at = target.length;
    let positioned = false;
    if (over && over !== drag.id) {
      const i = target.findIndex((it) => it.id === over);
      if (i >= 0) {
        at = atSide === "after" ? i + 1 : i;
        positioned = true;
      }
    }
    place(kind, source, target, at, positioned);
  };

  /* Posé en bout de rayon. Une seule écriture : `renumber` reconstruit la
     liste des intercalaires à partir du rayon, le nouveau carton compris. */
  const addDivider = (kind: ShelfKind) => {
    const list = shelves[kind];
    const order = gap(list, list.length);
    const tab: Divider = {
      id: uid(),
      wall,
      shelf: kind,
      label: "Intercalaire",
      order: order == null ? 0 : order,
    };
    if (order == null)
      renumber(
        kind,
        [...list, { type: "divider", id: tab.id, divider: tab, order: 0, tie: 0 }],
        null
      );
    else onDividers([...(dividers || []), tab]);
    onManual();
    reset();
  };

  /* Poser un carton juste avant un boîtier donné, sans passer par le haut
     du rayon. C'est un rangement à la main : il prend l'ordre affiché. */
  const insertDividerBefore = (kind: ShelfKind, beforeId: string) => {
    const list = shelves[kind];
    const at = Math.max(
      0,
      list.findIndex((it) => it.id === beforeId)
    );
    const rest = list;
    const order = manual ? gap(rest, at) : null;
    const tab: Divider = {
      id: uid(),
      wall,
      shelf: kind,
      label: "Intercalaire",
      perRow: null,
      order: order == null ? 0 : order,
    };
    if (order == null)
      renumber(
        kind,
        [
          ...rest.slice(0, at),
          { type: "divider", id: tab.id, divider: tab, order: 0, tie: 0 },
          ...rest.slice(at),
        ],
        null
      );
    else onDividers([...(dividers || []), tab]);
    onManual();
    reset();
  };

  const renameDivider = (id: string, label: string) =>
    onDividers((dividers || []).map((d) => (d.id === id ? { ...d, label } : d)));
  const setDividerPerRow = (id: string, next: number | null) =>
    onDividers((dividers || []).map((d) => (d.id === id ? { ...d, perRow: next } : d)));
  const removeDivider = (id: string) => onDividers((dividers || []).filter((d) => d.id !== id));

  const dnd: ShelfDnd = {
    onDragStart,
    onDragEnd: reset,
    onShelfOver,
    onBoxOver,
    onDrop: drop,
  };
  const shared = {
    onOpen: setPreview,
    dnd,
    perRow,
    manual,
    onAddDivider: addDivider,
    onRename: renameDivider,
    onRemoveDivider: removeDivider,
    onSetPerRow: setDividerPerRow,
    onInsertDivider: insertDividerBefore,
  };
  const countOf = (kind: ShelfKind) => films.filter(belongs[kind]).length;
  const previewFilm = preview ? films.find((f) => f.id === preview) : undefined;

  return (
    <div onDragEnd={reset}>
      {/* le repère de dépôt : un seul, déplacé à la main pendant le glissement */}
      <div ref={markRef} aria-hidden style={DROP_MARK_STYLE} />
      <Shelf
        kind="chevet"
        items={shelves.chevet}
        count={countOf("chevet")}
        {...shared}
        empty="Aucun film de chevet — glissez-en un ici."
      />
      <Shelf
        kind="main"
        items={shelves.main}
        count={countOf("main")}
        {...shared}
        empty="Le rayon est vide."
      />
      <ReserveDrawer
        items={shelves.reserve}
        count={countOf("reserve")}
        open={drawer}
        setOpen={setDrawer}
        dnd={dnd}
        onOpen={setPreview}
        onRename={renameDivider}
        onRemoveDivider={removeDivider}
        onAddDivider={addDivider}
        onSetPerRow={setDividerPerRow}
        onInsertDivider={insertDividerBefore}
        manual={manual}
      />
      {previewFilm && (
        <CasePreview film={previewFilm} onClose={() => setPreview(null)} onOpenFile={onOpen} />
      )}
    </div>
  );
}
