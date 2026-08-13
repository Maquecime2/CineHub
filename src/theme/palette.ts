/* ============================================================
   THE PALETTE — the tints a filed object can carry
   ============================================================

   WE STORE THE KEY AND NEVER THE HEX. That is the rule of this whole
   file: retouching a tint here repaints every category and every trinket
   already made in one go, instead of freezing them at the colour of the
   day they were made.

   THE KEYS THEMSELVES STAY FRENCH. They are what a decor carries on
   disk; translating them would repaint every object already filed with
   the fallback burgundy.

   ONE LIST ONLY. There used to be two, kept by hand: the keys in
   `shelf-views`, the colours in `constants` — and a key present in one
   but not the other fell back silently on burgundy. The keys are now
   DEDUCED from the colours, and there is nothing left to keep in step.

   Why here and not in `constants`: `shelf-views` forbids itself React,
   and `constants` is a file with JSX. The only place both can read from
   is a module that depends on neither.

   THE ORDER OF THE FIRST EIGHT DOES NOT MOVE. `CAT_KEYS[0]` is a new
   category's colour, and the shelf by filmmaker hands out its cardstock
   by walking this list: reordering it would reshuffle the colours of
   every view we rebuilt. Tints added therefore come after, whatever
   happens. The grouping by family only serves display — see
   `CAT_FAMILIES`. */

/* THIS SWATCH BOOK DOES NOT FOLLOW THE SITE'S SKIN, AND THAT IS
   DELIBERATE.

   The first eight tints used to take up `tokens`' values, back when
   those were hex codes. They have become references to CSS variables,
   which the skin of the day rewrites — and a colour held as a reference
   CANNOT serve here. Two reasons, each sufficient:

   1. These tints go into SVG data URIs (the wallpapers in `surfaces`,
      tinted by `catInk`). A `var()` written inside an embedded SVG
      document resolves to nothing: it does not have the document's root
      for a parent. The pattern would simply be invisible.

   2. We store the KEY. A cardstock painted `pine` must stay the same
      green from one skin to the next — that is the user's decision about
      THEIR filing, not a part of the site's dress. A skin that repainted
      the cardstock would move what does not belong to it.

   So the hex codes are written here, in plain sight. The first eight are
   the ones `tokens` carried before the skins, character for
   character. */
export const CAT_COLORS = {
  /* The original eight, hex code and name unchanged. */
  burgundy: "#8C3A34",
  ochre: "#B9862E",
  pine: "#3E5B4B",
  slate: "#5C6B78",
  cobalt: "#3A5C8C",
  vermillion: "#C4562E",
  moss: "#6E7A3A",
  ink: "#2B2620",

  // warm
  brique: "#A24B3C",
  rouille: "#9C5A2A",
  corail: "#D07A5E",
  safran: "#D3A44B",
  prune: "#6E3A4E",

  // cool
  ardoise: "#44586B",
  indigo: "#3C4372",
  canard: "#2F6068",
  turquoise: "#4E8C8A",
  lavande: "#7A7396",

  // natural
  olive: "#7C7A34",
  sapin: "#2F4A3C",
  terre: "#7A5B3A",
  sable: "#C0A468",
  fougere: "#5A8250",

  // neutral
  encre: "#4A443C",
  taupe: "#8A7F6E",
  gris: "#6E7276",
  craie: "#A9A093",
} as const;

export type CatKey = keyof typeof CAT_COLORS;

export const CAT_KEYS = Object.keys(CAT_COLORS) as CatKey[];

export const catInk = (key: string): string => CAT_COLORS[key as CatKey] || CAT_COLORS.burgundy;

/* What the picker shows. A grid of twenty-four pills with no order is a
   swatch book you scan without finding anything; by families, you look
   for "something warm" and you have it.

   It is a VIEW on `CAT_COLORS`, not a second list: a key forgotten here
   would stay perfectly valid, it would simply not be offered. The test
   makes sure none is. */
export const CAT_FAMILIES: { key: string; keys: CatKey[] }[] = [
  { key: "warm", keys: ["burgundy", "vermillion", "brique", "rouille", "corail", "prune"] },
  { key: "golden", keys: ["ochre", "safran", "sable", "terre"] },
  {
    key: "cool",
    keys: ["cobalt", "slate", "ardoise", "indigo", "canard", "turquoise", "lavande"],
  },
  { key: "green", keys: ["pine", "sapin", "moss", "fougere", "olive"] },
  { key: "neutral", keys: ["ink", "encre", "gris", "taupe", "craie"] },
];
