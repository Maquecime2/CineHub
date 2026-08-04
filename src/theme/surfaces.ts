/* ============================================================
   LES SURFACES — de quoi sont faits le mur et le bois
   ============================================================

   Une vue ne choisissait qu'un `theme` : deux stops de dégradé pour la
   planche, une teinte de papier, une encre. Le mur, lui, n'avait aucune
   peinture. Ce module est l'endroit — le seul — où une CLÉ devient une
   apparence.

   Deux règles le tiennent :

   1. ON NE SERT QUE DES STYLES. Ni `layout.jsx` ni le panneau de réglage
      n'ont à connaître un dégradé ou une turbulence ; ils demandent
      « peinture lin » et reçoivent des `CSSProperties`. C'est ce qui
      permet à la vignette d'aperçu de l'Atelier d'être, littéralement,
      la même surface que l'étagère — deux catalogues finiraient par
      diverger, et c'est toujours l'aperçu qui aurait tort.

   2. TOUT EST PROCÉDURAL. Les textures sont du SVG en adresse-données,
      selon la technique déjà éprouvée par `GRAIN` : aucun fichier à
      livrer, aucune requête, et un motif se reteinte sans qu'on ait à
      redessiner une image.

   Le catalogue de teintes, lui, N'EST PAS ici. `patternLayer` reçoit une
   couleur déjà résolue plutôt qu'une clé : les surfaces ignorent la
   palette des objets, et la palette ignore les surfaces. */

import type { CSSProperties } from "react";
import { C, GRAIN } from "./tokens";

/* L'adresse-données, faite une bonne fois. Le pourcent AVANT le dièse —
   l'ordre inverse ré-échapperait le pourcent qu'on vient d'écrire. Les
   deux y passent forcément : une couleur commence par un dièse, et
   `width='100%'` est dans presque chaque motif. */
const svgUrl = (markup: string): string =>
  `url("data:image/svg+xml;utf8,${markup.replace(/%/g, "%25").replace(/#/g, "%23")}")`;

const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`;

/* Un bruit filtré, du même moule que `GRAIN` mais réglable. `freq`
   accepte deux nombres : c'est ce qui distingue un grain de plâtre
   (isotrope) d'un veinage de bois (étiré à l'horizontale). */
const noise = (id: string, freq: string, octaves: number, alpha: number, seed = 3): string =>
  `<filter id='${id}'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/>` +
  `<feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${alpha} 0'/></filter>` +
  `<rect width='100%' height='100%' filter='url(#${id})'/>`;

/* ------------------------------------------------------------
   LA PEINTURE — le fond du mur
   ------------------------------------------------------------

   Un dégradé très doux plutôt qu'un aplat : un mur est éclairé par
   quelque chose. Il reste assez pâle pour qu'un boîtier posé devant se
   détache — c'est la contrainte qui a écarté les teintes saturées, sauf
   les trois sombres, qui assument d'être un fond de nuit. */

export type PaintKey = keyof typeof PAINTS;

const wall = (label: string, top: string, bottom: string, dark = false) => ({
  label,
  dark,
  background: `linear-gradient(#0000, #0000), linear-gradient(170deg, ${top}, ${bottom})`,
});

export const PAINTS = {
  platre: wall("Plâtre", "#F2EADA", "#E6DCC6"),
  lin: wall("Lin", "#EDE6D6", "#DED3BC"),
  craie: wall("Craie", "#F4F1E8", "#E8E3D5"),
  ocre: wall("Ocre pâle", "#F0E3C6", "#E1CFA6"),
  terracotta: wall("Terracotta", "#E4C4AE", "#CFA48A"),
  rose: wall("Rose ancien", "#EFD9D2", "#DDBEB6"),
  sauge: wall("Sauge", "#DBE2D2", "#C2CDB6"),
  eucalyptus: wall("Eucalyptus", "#CEDBD4", "#B2C4BB"),
  ciel: wall("Ciel délavé", "#D8E2EA", "#BCCBD8"),
  atelier: wall("Bleu de travail", "#9FB0BF", "#7E92A4", true),
  anthracite: wall("Anthracite", "#4A4E55", "#33363C", true),
  nuit: wall("Nuit", "#38414F", "#232936", true),
} as const;

export const paintOf = (key?: string) => PAINTS[key as PaintKey] || PAINTS.platre;

export const paintStyle = (key?: string): CSSProperties => ({
  background: paintOf(key).background,
});

/* ------------------------------------------------------------
   LE PAPIER PEINT — une trame qui se répète
   ------------------------------------------------------------

   Chaque motif est une fonction de l'encre : la même trame donne autant
   d'ambiances que la palette a de teintes. On les dessine volontairement
   PÂLES — un mur est derrière les boîtiers, pas devant eux — et
   l'opacité vit dans le markup plutôt que sur la couche, pour qu'une
   texture posée par-dessus ne la dilue pas une seconde fois. */

export type PatternKey = keyof typeof PATTERNS;

type Pattern = { label: string; size: number; draw: (ink: string) => string };

export const PATTERNS: Record<string, Pattern> = {
  rayuresFines: {
    label: "Rayures fines",
    size: 12,
    draw: (ink) =>
      svg(12, 12, `<rect x='0' y='0' width='1.5' height='12' fill='${ink}' opacity='0.16'/>`),
  },
  rayuresLarges: {
    label: "Rayures larges",
    size: 48,
    draw: (ink) =>
      svg(48, 48, `<rect x='0' y='0' width='16' height='48' fill='${ink}' opacity='0.10'/>`),
  },
  quadrillage: {
    label: "Quadrillage",
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
    label: "Damier",
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
    label: "Pois",
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
    label: "Chevrons",
    size: 24,
    draw: (ink) =>
      svg(
        24,
        24,
        `<path d='M0 18 L12 6 L24 18' fill='none' stroke='${ink}' stroke-width='2' opacity='0.13'/>`
      ),
  },
  ecailles: {
    label: "Écailles",
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
    label: "Petites fleurs",
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
    label: "Tirets",
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

/* `ink` est une couleur RÉSOLUE, jamais une clé — voir l'en-tête. */
export const patternLayer = (key?: string, ink: string = C.inkFaded): CSSProperties | null => {
  const p = PATTERNS[key as string];
  if (!p) return null;
  return {
    backgroundImage: svgUrl(p.draw(ink)),
    backgroundRepeat: "repeat",
    backgroundSize: `${p.size}px ${p.size}px`,
  };
};

/* ------------------------------------------------------------
   LA TEXTURE — ce qui passe par-dessus tout
   ------------------------------------------------------------

   En `multiply`, comme le grain de papier de l'atmosphère : une texture
   ASSOMBRIT le fond au lieu de le recouvrir, sinon elle effacerait la
   peinture qu'on vient de choisir. */

export type TextureKey = keyof typeof TEXTURES;

export const TEXTURES = {
  grain: {
    label: "Grain",
    style: { backgroundImage: GRAIN, mixBlendMode: "multiply" } as CSSProperties,
  },
  crepi: {
    label: "Crépi",
    style: {
      backgroundImage: svgUrl(svg(180, 180, noise("c", "0.34", 3, 0.11, 11))),
      mixBlendMode: "multiply",
    } as CSSProperties,
  },
  toile: {
    label: "Toile",
    style: {
      backgroundImage:
        `repeating-linear-gradient(0deg, ${C.ink}0C 0 1px, transparent 1px 4px), ` +
        `repeating-linear-gradient(90deg, ${C.ink}0C 0 1px, transparent 1px 4px)`,
      mixBlendMode: "multiply",
    } as CSSProperties,
  },
  beton: {
    label: "Béton",
    style: {
      backgroundImage: svgUrl(svg(220, 220, noise("b", "0.012 0.02", 4, 0.16, 5))),
      mixBlendMode: "multiply",
    } as CSSProperties,
  },
} as const;

export const textureLayer = (key?: string): CSSProperties | null =>
  TEXTURES[key as TextureKey]?.style || null;

/* ------------------------------------------------------------
   LES MATÉRIAUX — de quoi la planche est faite
   ------------------------------------------------------------

   Une planche n'était que deux stops de dégradé. Elle a maintenant une
   FAMILLE, et la famille décide de ce qui se passe au-delà de la
   couleur : le bois a un veinage étiré, le métal des bandes fines et un
   reflet haut, le verre laisse voir à travers et pose une ombre plus
   légère, la pierre a un grain gros.

   `finish` ne s'applique qu'aux matériaux qui ont quelque chose à
   vernir — c'est un ajout d'éclat, pas une sixième famille. */

export type MaterialKey = keyof typeof MATERIALS;
export type FinishKey = keyof typeof FINISHES;
export type MaterialFamily = "bois" | "metal" | "verre" | "pierre" | "peint";

type Material = {
  label: string;
  family: MaterialFamily;
  top: string;
  bottom: string;
  /* La couche de matière, sous la couleur. Absente = un aplat dégradé,
     ce qui est exactement l'étagère d'avant les matériaux. */
  texture?: string;
  /* L'ombre portée sous la planche. Le verre en veut une plus légère :
     ce qui est translucide ne pèse pas. */
  shadow?: string;
  /* Un liseré de lumière sur l'arête haute. */
  sheen?: string;
  alpha?: number;
};

const VEINS = svgUrl(svg(240, 24, noise("w", "0.015 0.9", 3, 0.2, 7)));
const BRUSH = `repeating-linear-gradient(90deg, #FFFFFF16 0 1px, #00000012 1px 3px)`;
const STONE = svgUrl(svg(160, 160, noise("s", "0.5", 4, 0.14, 2)));

const wood = (label: string, top: string, bottom: string): Material => ({
  label,
  family: "bois",
  top,
  bottom,
  texture: VEINS,
  sheen: "#FFFFFF14",
});

export const MATERIALS: Record<string, Material> = {
  /* Les bois. `chene`, `noyer`, `ceruse` reprennent au hexadécimal près
     les teintes des thèmes d'origine — un décor qui les choisit doit
     retrouver son étagère, au veinage près. */
  chene: wood("Chêne", "#7A5B3A", "#5E442A"),
  noyer: wood("Noyer", "#5A3E28", "#3B2818"),
  teck: wood("Teck", "#8B5E34", "#6A4423"),
  ebene: wood("Ébène", "#3A322C", "#211C18"),
  bouleau: wood("Bouleau", "#D8C4A0", "#BCA47E"),
  ceruse: wood("Cérusé", "#C9B99C", "#A8967A"),
  merisier: wood("Merisier", "#9B5B42", "#7A422F"),

  acier: {
    label: "Acier brossé",
    family: "metal",
    top: "#B9BFC4",
    bottom: "#8B9298",
    texture: BRUSH,
    sheen: "#FFFFFF55",
  },
  laiton: {
    label: "Laiton",
    family: "metal",
    top: "#D6B36A",
    bottom: "#9A7B33",
    texture: BRUSH,
    sheen: "#FFF3C980",
  },
  noirMat: {
    label: "Noir mat",
    family: "metal",
    top: "#3B3D40",
    bottom: "#25272A",
    sheen: "#FFFFFF10",
  },

  verre: {
    label: "Verre",
    family: "verre",
    top: "#DCE9EE",
    bottom: "#B9CFD8",
    alpha: 0.42,
    sheen: "#FFFFFF88",
    shadow: "0 2px 0 rgba(0,0,0,0.08)",
  },
  verreFume: {
    label: "Verre fumé",
    family: "verre",
    top: "#8E9096",
    bottom: "#6B6D73",
    alpha: 0.5,
    sheen: "#FFFFFF55",
    shadow: "0 2px 0 rgba(0,0,0,0.12)",
  },

  beton: {
    label: "Béton ciré",
    family: "pierre",
    top: "#B7B3AC",
    bottom: "#95918A",
    texture: STONE,
  },
  ardoise: {
    label: "Ardoise",
    family: "pierre",
    top: "#5E646B",
    bottom: "#42474D",
    texture: STONE,
  },
  marbre: {
    label: "Marbre",
    family: "pierre",
    top: "#EDEAE4",
    bottom: "#D2CEC6",
    texture: svgUrl(svg(200, 40, noise("m", "0.008 0.4", 5, 0.13, 9))),
    sheen: "#FFFFFF66",
  },

  /* Le peint : la planche prend une teinte franche et n'a plus de
     matière propre. C'est la famille où la finition se voit vraiment. */
  blanc: { label: "Laqué blanc", family: "peint", top: "#F4F1E9", bottom: "#DFDACD" },
  vert: { label: "Vert atelier", family: "peint", top: "#4E6B58", bottom: "#3A5142" },
  bleu: { label: "Bleu nuit", family: "peint", top: "#3C4E68", bottom: "#2A374B" },
  rouge: { label: "Rouge grenat", family: "peint", top: "#7E3A38", bottom: "#5E2A29" },
  moutarde: { label: "Moutarde", family: "peint", top: "#C09338", bottom: "#96702A" },
};

export const MATERIAL_KEYS = Object.keys(MATERIALS);

export const FAMILY_LABELS: Record<MaterialFamily, string> = {
  bois: "Bois",
  metal: "Métal",
  verre: "Verre",
  pierre: "Pierre",
  peint: "Peint",
};

export const FINISHES = {
  mat: { label: "Mat", sheen: 0, shadow: "0 3px 0 rgba(0,0,0,0.18)" },
  satine: { label: "Satiné", sheen: 1, shadow: "0 3px 0 rgba(0,0,0,0.2)" },
  laque: { label: "Laqué", sheen: 1.8, shadow: "0 3px 1px rgba(0,0,0,0.26)" },
} as const;

const CHENE = MATERIALS.chene as Material;
export const materialOf = (key?: string): Material => MATERIALS[key as string] || CHENE;

/* L'ombre par défaut de la planche — celle d'avant les matériaux, au
   pixel près. Elle vit ici parce que `materialStyle` doit pouvoir la
   rendre telle quelle. */
export const PLANK_SHADOW = "0 3px 0 rgba(0,0,0,0.18)";

export const materialStyle = (key?: string, finish?: string): CSSProperties => {
  const m = materialOf(key);
  const f = FINISHES[finish as FinishKey] || FINISHES.satine;
  const base = `linear-gradient(${m.top}, ${m.bottom})`;

  /* L'ordre des couches est celui d'un empilement : le reflet en
     premier (donc au-dessus), la matière ensuite, la couleur au fond.
     L'inverse peindrait la couleur PAR-DESSUS son propre veinage. */
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
