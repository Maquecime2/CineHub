/* ============================================================
   INKS DRAWN BY LOT

   The colours a card receives without anyone choosing them: the tape
   sticking it down, the toned emulsion of its fallback poster. Drawn
   from its identifier, therefore stable — and kept apart from
   `domain/seeded.ts`, which knows only numbers and nothing of the
   palette.
   ============================================================ */
import { hash, pickFrom } from "../domain/seeded";
import { C } from "./tokens";

export const TAPE_COLORS = [C.ochre, C.slate, C.burgundy] as const;

export const tapeColor = (id: string): string => pickFrom(TAPE_COLORS, Math.abs(hash(id)));

// toned emulsions: sepia, cyanotype, selenium, faded Cibachrome…
const HUES = [
  "#7a5230",
  "#6b4a4a",
  "#3f5a52",
  "#54506b",
  "#7a5b3a",
  "#2f4a68",
  "#6d4a2f",
  "#4a5c38",
  "#7b4a52",
] as const;

export const hueOf = (id: string): string => pickFrom(HUES, Math.abs(hash(id)));
