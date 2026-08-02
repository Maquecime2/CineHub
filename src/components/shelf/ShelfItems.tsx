import { FilmBox } from "./FilmBox";
import { ShelfDivider } from "./ShelfDivider";
import type { ShelfDnd, ShelfItem } from "./constants";
import type { PerRow, ShelfKind } from "../../types";

interface ShelfItemsProps {
  items: ShelfItem[];
  kind: ShelfKind;
  dnd: ShelfDnd;
  onOpen: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemoveDivider: (id: string) => void;
  onSetPerRow: (id: string, perRow: number | null) => void;
  onInsertDivider?: ((shelf: ShelfKind, beforeId: string) => void) | undefined;
  perRow: PerRow;
}

/** Une entrée de rangée : soit un objet à poser, soit un retour à la ligne. */
type Row = { it: ShelfItem; key: string; br?: false } | { br: true; key: string; it?: undefined };

/* Ce qui est posé sur un rayon. Sorti de `Shelf` pour que le tiroir des mis
   de côté affiche exactement les mêmes objets, avec le même glisser-déposer :
   deux contenants, un seul contenu. */
export function ShelfItems({
  items,
  kind,
  dnd,
  onOpen,
  onRename,
  onRemoveDivider,
  onSetPerRow,
  onInsertDivider,
  perRow,
}: ShelfItemsProps) {
  /* Le retour à la ligne n'est pas laissé au hasard de la largeur : on le
     pose nous-mêmes, tous les n boîtiers. `n` vaut le réglage du rayon, ou
     celui que porte l'intercalaire qui a ouvert la ligne — c'est ainsi que
     chaque rangée peut avoir son propre compte. */
  const rows: Row[] = [];
  let cap: number | null = perRow === "auto" ? null : perRow;
  let n = 0;
  items.forEach((it) => {
    if (it.type === "divider") {
      /* Le carton reste DANS la ligne — il sépare deux films côte à côte,
         il ne casse pas la rangée. Il remet seulement le compte à zéro :
         ce qui le suit forme la rangée suivante, au compte qu'il porte. */
      rows.push({ it, key: it.id });
      cap = it.divider.perRow || (perRow === "auto" ? null : perRow);
      n = 0;
    } else {
      if (cap && n > 0 && n % cap === 0) rows.push({ br: true, key: `br-${it.id}` });
      rows.push({ it, key: it.id });
      n += 1;
    }
  });

  return rows.map((r) =>
    r.br ? (
      <div key={r.key} style={{ flexBasis: "100%", height: 0 }} />
    ) : r.it.type === "divider" ? (
      <ShelfDivider
        key={r.key}
        divider={r.it.divider}
        kind={kind}
        onDragStart={dnd.onDragStart}
        onDragEnd={dnd.onDragEnd}
        onDragOverBox={dnd.onBoxOver}
        onRename={onRename}
        onRemove={onRemoveDivider}
        onSetPerRow={onSetPerRow}
        shelfPerRow={perRow}
      />
    ) : (
      <FilmBox
        key={r.key}
        film={r.it.film}
        kind={kind}
        onOpen={onOpen}
        onDragStart={dnd.onDragStart}
        onDragEnd={dnd.onDragEnd}
        onDragOverBox={dnd.onBoxOver}
        onInsertDivider={onInsertDivider}
      />
    )
  );
}
