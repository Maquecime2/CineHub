/* ============================================================
   ENCRES TIRÉES AU SORT

   Les couleurs qu'une fiche reçoit sans qu'on les choisisse : le ruban qui
   la scotche, l'émulsion virée de son affiche de secours. Tirées de son
   identifiant, donc stables — et séparées de `domain/seeded.ts`, qui ne
   connaît que des nombres et ignore tout de la palette.
   ============================================================ */
import { hash, pickFrom } from "../domain/seeded";
import { C } from "./tokens";

export const TAPE_COLORS = [C.ochre, C.slate, C.burgundy] as const;

export const tapeColor = (id: string): string => pickFrom(TAPE_COLORS, Math.abs(hash(id)));

// émulsions virées : sépia, cyanotype, sélénium, cibachrome fané…
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
