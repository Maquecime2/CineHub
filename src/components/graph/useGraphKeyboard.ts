/* ============================================================
   WALKING A GRAPH WITHOUT A MOUSE
   ============================================================

   A map made of hover, drag and click has NO path at all for somebody
   with no pointer. The arrows are wired to `neighbourInDirection`, which
   already exists and is already tested: it walks to the nearest node
   squarely in the direction asked for, and stays put when there is
   nothing on that side — which beats jumping anywhere at all.

   ONE NODE AT `tabIndex={0}` AND THE REST AT −1. A graph of forty nodes
   that each take a tab stop turns Tab into a forty-press ordeal to get
   past the map. The cursor is entered once, walked with the arrows, and
   left with Tab.

   This hook holds the CURSOR only. Selecting is the caller's business:
   a map where moving the cursor also selected would fire a side effect
   on every arrow press. */
import { useCallback, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { neighbourInDirection } from "../../domain/sky";
import type { Direction } from "../../domain/sky";

const ARROWS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export interface GraphKeyboard<P> {
  /** Le nœud sous le curseur, ou `null` tant qu'on n'est pas entré. */
  cursor: string | null;
  setCursor: (id: string | null) => void;
  /** 0 pour le nœud qui prend la tabulation, −1 pour tous les autres. */
  tabIndexOf: (id: string) => 0 | -1;
  onKeyDown: (e: ReactKeyboardEvent, node: P) => void;
}

export function useGraphKeyboard<P extends { id: string; x: number; y: number }>(
  placed: P[],
  { onPick, onLeave }: { onPick: (node: P) => void; onLeave?: () => void }
): GraphKeyboard<P> {
  const [cursor, setCursor] = useState<string | null>(null);

  /* Le curseur s'il existe encore, sinon le premier nœud : un graphe
     recomposé sous le curseur ne doit pas rendre la carte inatteignable
     à la tabulation. */
  const anchor = placed.some((p) => p.id === cursor) ? cursor : (placed[0]?.id ?? null);

  const tabIndexOf = useCallback((id: string) => (id === anchor ? 0 : -1), [anchor]) as (
    id: string
  ) => 0 | -1;

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent, node: P) => {
      const direction = ARROWS[e.key];
      if (direction) {
        e.preventDefault();
        const next = neighbourInDirection(placed, node.id, direction);
        if (!next) return;
        setCursor(next.id);
        /* The focus follows the cursor, or the next arrow press would be
           read by the node one has visually left. */
        const target = document.querySelector<SVGGElement>(`[data-node="${CSS.escape(next.id)}"]`);
        target?.focus();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(node);
        return;
      }
      if (e.key === "Escape") {
        setCursor(null);
        onLeave?.();
      }
    },
    [placed, onPick, onLeave]
  );

  return { cursor, setCursor, tabIndexOf, onKeyDown };
}
