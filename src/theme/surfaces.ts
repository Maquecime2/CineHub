/* ============================================================
   SURFACES — the matter a shelf can be made of
   ============================================================

   Paper, wood, metal, glass, stone. This module is the place — the only
   one — where a key becomes a texture, and it is deliberately kept apart
   from `palette`: a colour is a decision of the eye, a material is a
   decision of the hand.

   EVERYTHING IS DRAWN, nothing is downloaded. The patterns are SVG data
   URIs built here, from a filtered noise: an image file would have to be
   fetched, cached, and would not follow the ink it is tinted with.
   ============================================================ */

import type { CSSProperties } from "react";
import { C, GRAIN, alpha } from "./tokens";

/* The data URI, made once and for all. The percent sign BEFORE the hash
   — the other way round would re-escape the percent we have just
   written. Both necessarily come up: a colour starts with a hash, and
   `width='100%'` is in almost every pattern. */
/* EXPORTED, AND NOT COPIED WHERE THEY ARE NEEDED. The order of the two
   replacements above is a rule, not a taste, and a second hand-written
   copy of it somewhere else would look right and escape wrong. The hall's
   textures build their data URIs through these three and no others. */
export const svgUrl = (markup: string): string =>
  `url("data:image/svg+xml;utf8,${markup.replace(/%/g, "%25").replace(/#/g, "%23")}")`;

export const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`;

/* A filtered noise, from the same mould as `GRAIN` but adjustable.
   `freq` accepts two numbers: that is what tells a plaster grain
   (isotropic) from a wood grain (stretched horizontally). */
export const noise = (id: string, freq: string, octaves: number, alpha: number, seed = 3): string =>
  `<filter id='${id}'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/>` +
  `<feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${alpha} 0'/></filter>` +
  `<rect width='100%' height='100%' filter='url(#${id})'/>`;

/* ------------------------------------------------------------
   THE PAINT — the background of the wall
   ------------------------------------------------------------

   A very soft gradient rather than a flat tint: a wall is lit by
   something. It stays pale enough for a case laid in front of it to
   stand out — that is the constraint which ruled out the saturated
   tints, save the three dark ones, which own being a night sky. */

export type PaintKey = keyof typeof PAINTS;

/* We keep the IMAGE and not a ready-made `background`: the paint is
   only one layer among others on the row's frame, and a layer composes,
   it does not substitute. `dark` tells the caller the background is dark
   — enough to lighten what is written on it. */
const wall = (top: string, bottom: string, dark = false) => ({
  dark,
  image: `linear-gradient(170deg, ${top}, ${bottom})`,
});

export const PAINTS = {
  platre: wall("#F2EADA", "#E6DCC6"),
  lin: wall("#EDE6D6", "#DED3BC"),
  craie: wall("#F4F1E8", "#E8E3D5"),
  ocre: wall("#F0E3C6", "#E1CFA6"),
  terracotta: wall("#E4C4AE", "#CFA48A"),
  rose: wall("#EFD9D2", "#DDBEB6"),
  sauge: wall("#DBE2D2", "#C2CDB6"),
  eucalyptus: wall("#CEDBD4", "#B2C4BB"),
  ciel: wall("#D8E2EA", "#BCCBD8"),
  atelier: wall("#9FB0BF", "#7E92A4", true),
  anthracite: wall("#4A4E55", "#33363C", true),
  nuit: wall("#38414F", "#232936", true),
} as const;

export const paintOf = (key?: string) => PAINTS[key as PaintKey] || PAINTS.platre;

export const paintStyle = (key?: string): CSSProperties => ({
  backgroundImage: paintOf(key).image,
});

/* ------------------------------------------------------------
   THE WALLPAPER — a pattern that repeats
   ------------------------------------------------------------

   Every pattern is a function of the ink: the same weave gives as many
   moods as the palette has tints. We deliberately draw them PALE — a
   wall is behind the cases, not in front of them — and the opacity lives
   in the markup rather than on the layer, so that a texture laid on top
   does not dilute it a second time. */

export type PatternKey = keyof typeof PATTERNS;

type Pattern = { size: number; draw: (ink: string) => string };

export const PATTERNS: Record<string, Pattern> = {
  rayuresFines: {
    size: 12,
    draw: (ink) =>
      svg(12, 12, `<rect x='0' y='0' width='1.5' height='12' fill='${ink}' opacity='0.16'/>`),
  },
  rayuresLarges: {
    size: 48,
    draw: (ink) =>
      svg(48, 48, `<rect x='0' y='0' width='16' height='48' fill='${ink}' opacity='0.10'/>`),
  },
  quadrillage: {
    size: 22,
    draw: (ink) =>
      svg(
        22,
        22,
        `<g fill='none' stroke='${ink}' stroke-width='1' opacity='0.14'>` +
          `<path d='M0 0.5 H22 M0.5 0 V22'/></g>`
      ),
  },
  damier: {
    size: 32,
    draw: (ink) =>
      svg(
        32,
        32,
        `<g fill='${ink}' opacity='0.10'><rect x='0' y='0' width='16' height='16'/>` +
          `<rect x='16' y='16' width='16' height='16'/></g>`
      ),
  },
  pois: {
    size: 28,
    draw: (ink) =>
      svg(
        28,
        28,
        `<g fill='${ink}' opacity='0.16'><circle cx='7' cy='7' r='2.2'/>` +
          `<circle cx='21' cy='21' r='2.2'/></g>`
      ),
  },
  chevrons: {
    size: 24,
    draw: (ink) =>
      svg(
        24,
        24,
        `<path d='M0 18 L12 6 L24 18' fill='none' stroke='${ink}' stroke-width='2' opacity='0.13'/>`
      ),
  },
  ecailles: {
    size: 30,
    draw: (ink) =>
      svg(
        30,
        30,
        `<g fill='none' stroke='${ink}' stroke-width='1.4' opacity='0.14'>` +
          `<path d='M0 30 A15 15 0 0 1 30 30'/><path d='M-15 15 A15 15 0 0 1 15 15'/>` +
          `<path d='M15 15 A15 15 0 0 1 45 15'/></g>`
      ),
  },
  fleurs: {
    size: 40,
    draw: (ink) =>
      svg(
        40,
        40,
        `<g fill='${ink}' opacity='0.15'>` +
          `<g transform='translate(10 10)'><circle cx='0' cy='-4' r='2.4'/><circle cx='4' cy='0' r='2.4'/>` +
          `<circle cx='0' cy='4' r='2.4'/><circle cx='-4' cy='0' r='2.4'/></g>` +
          `<g transform='translate(30 30)'><circle cx='0' cy='-4' r='2.4'/><circle cx='4' cy='0' r='2.4'/>` +
          `<circle cx='0' cy='4' r='2.4'/><circle cx='-4' cy='0' r='2.4'/></g></g>`
      ),
  },
  tirets: {
    size: 20,
    draw: (ink) =>
      svg(
        20,
        20,
        `<g stroke='${ink}' stroke-width='1.6' stroke-linecap='round' opacity='0.15'>` +
          `<path d='M3 5 h6'/><path d='M13 14 h5'/></g>`
      ),
  },
};

export const PATTERN_KEYS = Object.keys(PATTERNS);

/* THE DEFAULT INK OF A PATTERN, AND WHY IT IS HARD-CODED.

   It used to be `C.inkFaded`. Since the tokens became references to CSS
   variables, that is no longer a colour usable here: the pattern leaves
   inside an SVG data URL, and a `var()` written in an embedded SVG
   document resolves to nothing — it does not have the document root for
   a parent. The pattern became invisible, without a word.

   It is the same constraint that keeps the objects' palette in
   hexadecimals (see `theme/palette`): whatever enters an embedded SVG
   must be a colour, not a reference to a colour. */
const DEFAULT_INK = "#6E6153";

/* `ink` is a RESOLVED colour, never a key — see the header. */
export const patternLayer = (key?: string, ink: string = DEFAULT_INK): CSSProperties | null => {
  const p = PATTERNS[key as string];
  if (!p) return null;
  return {
    backgroundImage: svgUrl(p.draw(ink)),
    backgroundRepeat: "repeat",
    backgroundSize: `${p.size}px ${p.size}px`,
  };
};

/* ------------------------------------------------------------
   LES PAPIERS — le fond de la page, et non la robe entière
   ------------------------------------------------------------

   CE QU'ILS SONT, ET CE QU'ILS NE SONT PAS. Une peau réécrit quatorze
   jetons de couleur, quatre polices et le fond de page : elle décide de
   tout. Un papier ne décide que du GRAIN de ce fond, et il le dessine
   avec l'encre du thème en cours. Les deux se composent donc : six
   papiers sur dix-sept peaux font quatre-vingt-douze classeurs, là où
   une dix-huitième peau en aurait fait un.

   C'EST POURQUOI ILS SONT ICI ET PAS DANS `skins.ts`. Un papier n'a ni
   palette, ni fonte, ni prix à tenir d'accord avec le serveur : il n'a
   qu'un dessin. `skins.test.ts` n'a rien à en dire, et c'est le signe
   qu'ils sont au bon endroit.

   ET L'ENCRE ARRIVE RÉSOLUE, comme pour les motifs juste au-dessus : ces
   dessins partent dans une URL de données, et un `var()` écrit dans un
   SVG embarqué ne résout rien — il n'a pas la racine du document pour
   parent. Un papier teinté par un jeton serait un papier invisible, sans
   un mot d'erreur.

   Les identifiants portent le préfixe de leur article de boutique
   (`paper-quadrille` → `quadrille`) : c'est `paperOf` qui coupe, une
   fois, plutôt que chaque appelant. */

type Paper = { size: number; draw: (ink: string) => string };

export const PAPERS: Record<string, Paper> = {
  quadrille: {
    size: 24,
    draw: (ink) =>
      svg(
        24,
        24,
        `<g fill='none' stroke='${ink}' stroke-width='1' opacity='0.13'>` +
          `<path d='M0 0.5 H24 M0.5 0 V24'/></g>`
      ),
  },
  millimetre: {
    size: 50,
    draw: (ink) =>
      svg(
        50,
        50,
        `<g fill='none' stroke='${ink}'>` +
          `<path stroke-width='0.5' opacity='0.10' d='M0 5.25 H50 M0 15.25 H50 M0 25.25 H50 M0 35.25 H50 M0 45.25 H50` +
          ` M5.25 0 V50 M15.25 0 V50 M25.25 0 V50 M35.25 0 V50 M45.25 0 V50'/>` +
          `<path stroke-width='1' opacity='0.16' d='M0 0.5 H50 M0.5 0 V50'/></g>`
      ),
  },
  /* Le vergé a ses pontuseaux — des lignes larges et espacées, sous des
     vergeures serrées. Le seul papier dont le dessin soit anisotrope, et
     c'est ce qui le rend reconnaissable. */
  verge: {
    size: 64,
    draw: (ink) =>
      svg(
        64,
        64,
        `<g fill='none' stroke='${ink}'>` +
          `<path stroke-width='0.6' opacity='0.09' d='M0 2 H64 M0 6 H64 M0 10 H64 M0 14 H64 M0 18 H64` +
          ` M0 22 H64 M0 26 H64 M0 30 H64 M0 34 H64 M0 38 H64 M0 42 H64 M0 46 H64 M0 50 H64` +
          ` M0 54 H64 M0 58 H64 M0 62 H64'/>` +
          `<path stroke-width='1.4' opacity='0.07' d='M8 0 V64 M32 0 V64 M56 0 V64'/></g>`
      ),
  },
  /* Le calque ne se dessine pas, il se VOILE : un lavis très pâle et
     deux traits de pliure. Un papier translucide n'a pas de trame. */
  calque: {
    size: 96,
    draw: (ink) =>
      svg(
        96,
        96,
        `<rect width='96' height='96' fill='${ink}' opacity='0.035'/>` +
          `<g fill='none' stroke='${ink}' stroke-width='0.8' opacity='0.07'>` +
          `<path d='M0 32 H96 M0 64 H96'/></g>`
      ),
  },
  ondule: {
    size: 26,
    draw: (ink) =>
      svg(
        26,
        26,
        `<g fill='none' stroke='${ink}' stroke-width='2.4' opacity='0.10'>` +
          `<path d='M0 6 Q6.5 0 13 6 T26 6'/><path d='M0 19 Q6.5 13 13 19 T26 19'/></g>`
      ),
  },
  /* LE KRAFT SOMBRE EST LE SEUL À POSER UNE COULEUR ET PAS UNE TRAME, et
     il tient donc sa propre teinte plutôt que l'encre du thème. C'est
     l'exception assumée du lot : sous une peau claire il assombrit la
     page, sous une peau sombre il ne fait presque rien — ce qui est
     exactement le comportement d'un papier plus épais. */
  "kraft-sombre": {
    size: 140,
    draw: (ink) =>
      svg(
        140,
        140,
        `<rect width='140' height='140' fill='${ink}' opacity='0.10'/>` +
          noise("kr", "0.7", 3, 0.1, 4)
      ),
  },
};

export const PAPER_KEYS = Object.keys(PAPERS);

/** `paper-verge` comme `verge` : la coupe se fait ici, une seule fois. */
export const paperOf = (key?: string | null): Paper | null =>
  key ? (PAPERS[key.replace(/^paper-/, "")] ?? null) : null;

/**
 * Le calque de papier, à poser SOUS le contenu et SUR le fond de peau.
 *
 * Rendu comme une couche à part et non comme un fond de la page : le
 * fond de page est une recette de la peau (des dégradés superposés), et
 * lui ajouter une image l'aurait remplacée au lieu de s'y ajouter.
 *
 * `ink` est une couleur RÉSOLUE, jamais un jeton — voir l'en-tête.
 */
export const paperLayer = (
  key?: string | null,
  ink: string = DEFAULT_INK
): CSSProperties | null => {
  const p = paperOf(key);
  if (!p) return null;
  return {
    backgroundImage: svgUrl(p.draw(ink)),
    backgroundRepeat: "repeat",
    backgroundSize: `${p.size}px ${p.size}px`,
  };
};

/* ------------------------------------------------------------
   THE TEXTURE — what goes over everything
   ------------------------------------------------------------

   In `multiply`, like the atmosphere's paper grain: a texture DARKENS
   the background instead of covering it, otherwise it would erase the
   paint one has just chosen. */

export type TextureKey = keyof typeof TEXTURES;

export const TEXTURES = {
  grain: {
    style: { backgroundImage: GRAIN, mixBlendMode: "multiply" } as CSSProperties,
  },
  crepi: {
    style: {
      backgroundImage: svgUrl(svg(180, 180, noise("c", "0.34", 3, 0.11, 11))),
      mixBlendMode: "multiply",
    } as CSSProperties,
  },
  toile: {
    style: {
      backgroundImage:
        `repeating-linear-gradient(0deg, ${alpha(C.ink, 0.047)} 0 1px, transparent 1px 4px), ` +
        `repeating-linear-gradient(90deg, ${alpha(C.ink, 0.047)} 0 1px, transparent 1px 4px)`,
      mixBlendMode: "multiply",
    } as CSSProperties,
  },
  beton: {
    style: {
      backgroundImage: svgUrl(svg(220, 220, noise("b", "0.012 0.02", 4, 0.16, 5))),
      mixBlendMode: "multiply",
    } as CSSProperties,
  },
} as const;

export const textureLayer = (key?: string): CSSProperties | null =>
  TEXTURES[key as TextureKey]?.style || null;

/* ------------------------------------------------------------
   THE ASSEMBLED WALL — the three layers in one gesture
   ------------------------------------------------------------

   Paint and wallpaper are NOT extra elements: they are background layers
   on the row's frame, which already carried one (the tint of the bedside
   row). That is deliberate, and it is the constraint that matters here:
   dropping a hung object measures `data-wall-layer` to convert a pixel
   into a percentage, and any extra child inside that frame would risk
   shifting what that rect is worth. A background shifts nothing.

   Only the texture stays a layer of its own: it blends in `multiply`,
   which a background cannot do by itself.

   The order of the layers is that of a stack — the wallpaper IN FRONT OF
   the paint, hence written before it. And `tint` last, as a background
   colour: it is the only one that is not an image.

   `ink` is a resolved colour, never a key. */
export function wallStyle(
  decor?: { paint?: string; pattern?: string; texture?: string } | null,
  ink: string = DEFAULT_INK,
  tint?: string | null
): { frame: CSSProperties; texture: CSSProperties | null } {
  const images: string[] = [];
  const sizes: string[] = [];

  const pattern = patternLayer(decor?.pattern, ink);
  if (pattern) {
    images.push(String(pattern.backgroundImage));
    sizes.push(String(pattern.backgroundSize));
  }
  if (decor?.paint) {
    images.push(paintOf(decor.paint).image);
    /* `auto` and not `cover`: a gradient has no dimensions of its own and
       already fills its box. The list of sizes only has to stay as long
       as the list of images, otherwise it repeats and the pattern takes
       the gradient's size. */
    sizes.push("auto");
  }

  const frame: CSSProperties = { background: tint || "transparent" };
  if (images.length) {
    frame.backgroundImage = images.join(", ");
    frame.backgroundSize = sizes.join(", ");
    frame.backgroundRepeat = "repeat";
  }

  return { frame, texture: textureLayer(decor?.texture) };
}

/* ------------------------------------------------------------
   THE MATERIALS — what the board is made of
   ------------------------------------------------------------

   A board was only two gradient stops. It now has a FAMILY, and the
   family decides what happens beyond the colour: wood has a stretched
   graining, metal thin bands and a high sheen, glass lets one see
   through and casts a lighter shadow, stone has a coarse grain.

   `finish` only applies to the materials that have something to varnish
   — it is an addition of gloss, not a sixth family. */

export type MaterialKey = keyof typeof MATERIALS;
export type FinishKey = keyof typeof FINISHES;
export type MaterialFamily = "bois" | "metal" | "verre" | "pierre" | "peint";

type Material = {
  family: MaterialFamily;
  top: string;
  bottom: string;
  /* The layer of matter, under the colour. Absent = a plain gradient,
     which is exactly the shelf from before the materials. */
  texture?: string;
  /* The drop shadow under the board. Glass wants a lighter one: what is
     translucent does not weigh. */
  shadow?: string;
  /* A line of light on the top edge. */
  sheen?: string;
  alpha?: number;
};

const VEINS = svgUrl(svg(240, 24, noise("w", "0.015 0.9", 3, 0.2, 7)));
const BRUSH = `repeating-linear-gradient(90deg, #FFFFFF16 0 1px, #00000012 1px 3px)`;
const STONE = svgUrl(svg(160, 160, noise("s", "0.5", 4, 0.14, 2)));

const wood = (top: string, bottom: string): Material => ({
  family: "bois",
  top,
  bottom,
  texture: VEINS,
  sheen: "#FFFFFF14",
});

export const MATERIALS: Record<string, Material> = {
  /* The woods. `chene`, `noyer` and `ceruse` take up, hex code for hex
     code, the tints of the original themes — a decor that chooses them
     must find its shelf again, down to the grain.

     THEIR KEYS STAY FRENCH: they are what a decor carries on disk. */
  chene: wood("#7A5B3A", "#5E442A"),
  noyer: wood("#5A3E28", "#3B2818"),
  teck: wood("#8B5E34", "#6A4423"),
  ebene: wood("#3A322C", "#211C18"),
  bouleau: wood("#D8C4A0", "#BCA47E"),
  ceruse: wood("#C9B99C", "#A8967A"),
  merisier: wood("#9B5B42", "#7A422F"),

  acier: {
    family: "metal",
    top: "#B9BFC4",
    bottom: "#8B9298",
    texture: BRUSH,
    sheen: "#FFFFFF55",
  },
  laiton: {
    family: "metal",
    top: "#D6B36A",
    bottom: "#9A7B33",
    texture: BRUSH,
    sheen: "#FFF3C980",
  },
  noirMat: {
    family: "metal",
    top: "#3B3D40",
    bottom: "#25272A",
    sheen: "#FFFFFF10",
  },

  verre: {
    family: "verre",
    top: "#DCE9EE",
    bottom: "#B9CFD8",
    alpha: 0.42,
    sheen: "#FFFFFF88",
    shadow: "0 2px 0 rgba(0,0,0,0.08)",
  },
  verreFume: {
    family: "verre",
    top: "#8E9096",
    bottom: "#6B6D73",
    alpha: 0.5,
    sheen: "#FFFFFF55",
    shadow: "0 2px 0 rgba(0,0,0,0.12)",
  },

  beton: {
    family: "pierre",
    top: "#B7B3AC",
    bottom: "#95918A",
    texture: STONE,
  },
  ardoise: {
    family: "pierre",
    top: "#5E646B",
    bottom: "#42474D",
    texture: STONE,
  },
  marbre: {
    family: "pierre",
    top: "#EDEAE4",
    bottom: "#D2CEC6",
    texture: svgUrl(svg(200, 40, noise("m", "0.008 0.4", 5, 0.13, 9))),
    sheen: "#FFFFFF66",
  },

  /* The painted: the board takes on a plain tint and no longer has any
     substance of its own. This is the family where the finish really
     shows. */
  blanc: { family: "peint", top: "#F4F1E9", bottom: "#DFDACD" },
  vert: { family: "peint", top: "#4E6B58", bottom: "#3A5142" },
  bleu: { family: "peint", top: "#3C4E68", bottom: "#2A374B" },
  rouge: { family: "peint", top: "#7E3A38", bottom: "#5E2A29" },
  moutarde: { family: "peint", top: "#C09338", bottom: "#96702A" },
};

export const MATERIAL_KEYS = Object.keys(MATERIALS);

export const FINISHES = {
  mat: { sheen: 0, shadow: "0 3px 0 rgba(0,0,0,0.18)" },
  satine: { sheen: 1, shadow: "0 3px 0 rgba(0,0,0,0.2)" },
  laque: { sheen: 1.8, shadow: "0 3px 1px rgba(0,0,0,0.26)" },
} as const;

const OAK = MATERIALS.chene as Material;
export const materialOf = (key?: string): Material => MATERIALS[key as string] || OAK;

/* The board's default shadow — the one from before the materials, to the
   pixel. It lives here because `materialStyle` must be able to return it
   as it is. */
export const PLANK_SHADOW = "0 3px 0 rgba(0,0,0,0.18)";

export const materialStyle = (key?: string, finish?: string): CSSProperties => {
  const m = materialOf(key);
  const f = FINISHES[finish as FinishKey] || FINISHES.satine;
  const base = `linear-gradient(${m.top}, ${m.bottom})`;

  /* The order of the layers is that of a stack: the sheen first (hence
     on top), the substance next, the colour at the bottom. The reverse
     would paint the colour OVER its own graining. */
  const layers: string[] = [];
  if (m.sheen && f.sheen)
    layers.push(
      `linear-gradient(${m.sheen} 0 ${Math.max(1, f.sheen)}px, transparent ${Math.max(1, f.sheen)}px)`
    );
  if (m.texture) layers.push(m.texture);
  layers.push(base);

  return {
    background: layers.join(", "),
    boxShadow: m.shadow || f.shadow,
    ...(m.alpha != null ? { opacity: m.alpha } : null),
  };
};
