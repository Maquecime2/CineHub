/* ============================================================
   ÉTAGÈRE — les mesures et les rayons.

   Le mur montre des fiches punaisées ; l'étagère montre des objets
   rangés. Ce n'est pas le même geste : sur le mur on regarde, sur
   l'étagère on range. D'où le glisser-déposer, et d'où les rayons
   qui sont eux-mêmes des destinations — déposer un boîtier dans un
   rayon, c'est lui donner son statut, pas seulement sa place.
   ============================================================ */
import type { CSSProperties, DragEvent } from "react";
import { C } from "../../theme/tokens";
import type { Divider, Film, ShelfKind } from "../../types";

interface ShelfKindConfig {
  title: string;
  tag: string;
  /** Ce que devient une fiche déposée dans ce rayon. */
  patch: Partial<Film>;
  tint?: string;
  border?: string;
}

export const SHELF_KIND: Record<ShelfKind, ShelfKindConfig> = {
  chevet: {
    title: "Films de chevet",
    tag: "ceux qu'on revoit",
    patch: { chevet: true, archived: false },
    tint: `${C.burgundy}0d`,
    border: C.burgundy,
  },
  main: { title: "La collection", tag: "", patch: { chevet: false, archived: false } },
  reserve: {
    title: "Mis de côté",
    tag: "gardés, pas jetés",
    patch: { chevet: false, archived: true },
    tint: "transparent",
    border: C.line,
  },
};

export const BOX_W = 96,
  BOX_H = 144;

/* Le repère se déplace en `transform` et jamais en `left`/`top` : une
   translation est un travail de composition, alors qu'écrire une position
   invalide la mise en page — que le `getBoundingClientRect` de l'événement
   suivant oblige alors à recalculer en entier. Sur cent boîtiers, cet
   aller-retour écriture/lecture coûtait plus cher que tout le reste. */
export const DROP_MARK_STYLE: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  width: 4,
  height: BOX_H,
  zIndex: 60,
  pointerEvents: "none",
  borderRadius: 2,
  /* Aplat, et non plus dégradé répété : un dégradé se re-rastérise, un
     aplat est peint une fois pour toutes. Le repère reste dans la page en
     permanence, transparent, pour que sa couche soit prête AVANT le
     glissement — sinon le navigateur la fabrique au premier mouvement,
     et c'est ce retard qu'on voyait. Apparition et déplacement ne coûtent
     alors plus qu'une composition : ni mise en page, ni dessin. */
  background: C.burgundy,
  opacity: 0,
  willChange: "transform, opacity",
  backfaceVisibility: "hidden",
  transition: "opacity .1s linear",
};

/** Ce que le glisser-déposer promène : un boîtier, ou un intercalaire. */
export type DragKind = "film" | "divider";

/** Les rappels que boîtiers et intercalaires partagent pendant un glissement. */
export interface ShelfDnd {
  onDragStart: (kind: DragKind, id: string, el: HTMLElement) => void;
  onDragEnd: () => void;
  onBoxOver: (e: DragEvent, shelf: ShelfKind, overId: string) => void;
  onShelfOver: (shelf: ShelfKind) => void;
  onDrop: (shelf: ShelfKind) => void;
}

/** Ce qui est posé sur un rayon : des boîtiers, et des cartons entre eux. */
export type ShelfItem =
  { type: "film"; id: string; film: Film } | { type: "divider"; id: string; divider: Divider };
