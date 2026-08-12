/* ============================================================
   THE LOOK OF THE WALL — what is adjustable on the card display
   ============================================================

   The shelf has had its decor workshop for a long time; the wall was a
   frozen grid: two hundred and ten pixels of column, a poster of a
   hundred and fifty, and not one handle. All that follows is only that —
   the dimensions that were hard-coded, taken out of the component and
   named.

   A single factor commands the size: a card is an object, it grows as
   one block. Adjusting the poster, the title and the caption separately
   would above all allow building ungainly cards.

   The catalogues are dictionaries of factors, on the model of
   `DECOR_SIZES` (`components/shelf/constants.tsx`): a key persists and
   is read back, a bare number is not. */

/** The calibre of a card — a factor applied to ALL its dimensions. */
export const CARD_SIZES = {
  XS: { label: "minuscule", f: 0.62 },
  S: { label: "petit", f: 0.78 },
  M: { label: "moyen", f: 1 },
  L: { label: "grand", f: 1.25 },
  XL: { label: "très grand", f: 1.6 },
} as const;

/** The spacing between cards, independently of their size. */
export const SPREADS = {
  serre: { label: "serré", f: 0.5 },
  normal: { label: "normal", f: 1 },
  aere: { label: "aéré", f: 1.6 },
} as const;

/* The disorder is not removed, it is DOSED: the leans and the offsets
   stay sown by the film's identifier (`tiltOf`, `nudgeOf`), we merely
   multiply that draw. At zero the wall is dead straight without any card
   having changed its draw — going back up one notch finds exactly the
   disorder one had. */
export const MESSES = {
  range: { label: "rangé", f: 0 },
  naturel: { label: "naturel", f: 1 },
  disperse: { label: "dispersé", f: 1.9 },
} as const;

/** What holds the card to the wall. `auto` lets the draw decide. */
export const HANGS = {
  auto: { label: "au hasard" },
  pin: { label: "punaise" },
  tape: { label: "ruban" },
  none: { label: "rien" },
} as const;

export type CardSize = keyof typeof CARD_SIZES;
export type Spread = keyof typeof SPREADS;
export type Mess = keyof typeof MESSES;
export type Hang = keyof typeof HANGS;

/** The background decor, exactly the shape `wallStyle` knows how to read. */
export interface WallDecor {
  paint?: string | null;
  pattern?: string | null;
  patternInk?: string | null;
  texture?: string | null;
}

export interface WallLook {
  size: CardSize;
  spread: Spread;
  mess: Mess;
  hang: Hang;
  decor: WallDecor | null;
}

/* The wall used to open at `M`, and that was too big: at two hundred
   and ten pixels of column, a common screen showed only five or six of
   them. So we open one notch lower — the large calibres stay one click
   away for whoever wants to see the posters big again. */
export const DEFAULT_WALL_LOOK: WallLook = {
  size: "S",
  spread: "normal",
  mess: "naturel",
  hang: "auto",
  decor: null,
};

/* The look of whoever asks for none. It is NOT the wall's default: a
   card laid elsewhere (the discoveries, for instance) has no business
   shrinking because the wall opens smaller. Neutral means "as it was
   before anything could be adjusted at all". */
export const NEUTRAL_WALL_LOOK: WallLook = {
  size: "M",
  spread: "normal",
  mess: "naturel",
  hang: "auto",
  decor: null,
};

const keyOf = <T extends object>(cat: T, v: unknown, fallback: keyof T): keyof T =>
  typeof v === "string" && v in cat ? (v as keyof T) : fallback;

/* The preferences come from disk, written by a version that did not
   know these fields — or by a more recent one than that which reads them
   back. So we never trust what we read: every unknown key falls back on
   its default, and the wall displays. */
export function wallLookOf(saved?: Partial<WallLook> | null): WallLook {
  const s = saved || {};
  return {
    size: keyOf(CARD_SIZES, s.size, DEFAULT_WALL_LOOK.size),
    spread: keyOf(SPREADS, s.spread, DEFAULT_WALL_LOOK.spread),
    mess: keyOf(MESSES, s.mess, DEFAULT_WALL_LOOK.mess),
    hang: keyOf(HANGS, s.hang, DEFAULT_WALL_LOOK.hang),
    decor: s.decor && typeof s.decor === "object" ? s.decor : null,
  };
}

/* The three readings of a look. With no look at all, it is the neutral
   one that answers — never the wall's, which has no currency
   elsewhere. */

/** The size factor of a look, ready to multiply a dimension. */
export const scaleOf = (look?: WallLook | null): number =>
  CARD_SIZES[look?.size || NEUTRAL_WALL_LOOK.size].f;

/** The horizontal gap between two cards, in pixels. */
export const gapOf = (look?: WallLook | null): number =>
  Math.round(34 * scaleOf(look) * SPREADS[look?.spread || NEUTRAL_WALL_LOOK.spread].f);

/** By how much the sown disorder is multiplied. */
export const messOf = (look?: WallLook | null): number =>
  MESSES[look?.mess || NEUTRAL_WALL_LOOK.mess].f;
