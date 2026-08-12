/* ============================================================
   THE LAYER — what floats above the page does not live in it
   ============================================================

   A panel covering the screen is written `position: fixed`, and a
   `position: fixed` believes itself anchored to the WINDOW. That is false
   as soon as an ancestor carries a transform: the transformed element
   becomes the containing block of every `fixed` inside it, and the panel
   then starts measuring the column instead of the screen, scrolling with
   it, and settling beside what it was aiming at.

   AND THE VIEW COLUMN IS TRANSFORMED. `[data-enters]` plays `sheetIn` on
   every change of tab or card: three hundred and forty milliseconds
   during which every drawer, every studio, every drop marker mounted
   INSIDE a view is anchored in the wrong place.

   THERE IS WORSE, AND IT IS PERMANENT. The column is also a STACKING
   CONTEXT (`position: relative; z-index: 2`). A panel living inside it
   can no longer compare itself to anything outside: its `z-index: 45`
   only ranks it among its column neighbours, and against the bottom bar
   or the modal, only the column's `2` counts. The layer budget written in
   CLAUDE.md therefore described a hierarchy those panels never had.

   Hence this layer: what floats above the page renders into the
   document's BODY, outside the column. The budget becomes true again,
   screen coordinates become screen coordinates again, and the panel stops
   depending on the tab that opened it.

   React keeps the logical tree: a portal only moves the rendering. Events
   go on bubbling to the parent that wrote it, state and context follow —
   nothing to rewire. */
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export function Calque({ children }: { children: ReactNode }) {
  /* Server rendering does not exist here, but the tests sometimes mount
     fragments with no complete document: we do not throw for that. */
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
