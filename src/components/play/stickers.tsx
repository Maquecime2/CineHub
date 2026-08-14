/* ============================================================
   LES VIGNETTES — onze dessins, une seule main
   ============================================================

   La même convention que les bibelots de l'étagère : la forme est écrite
   DEUX FOIS, une fois lavée pour le remplissage, une fois nue pour le
   trait par-dessus. Peindre dans le ton du trait donnerait une
   silhouette pleine — une icône, pas un croquis.

   Un même carré de cent unités pour toutes, une même épaisseur de trait,
   les mêmes bouts ronds : c'est ce qui fait qu'elles se lisent comme
   sorties du même stylo une fois collées côte à côte sur la planche.

   L'ENCRE VIENT DE LA RARETÉ, ET NON DU SUJET. Une commune est à
   l'encre, une rare à l'ocre, une dorée au bordeaux — de sorte qu'on
   voit ce qu'on a sans lire une légende. C'est aussi ce qui permet
   d'ajouter une douzième vignette sans inventer une douzième couleur.
   ============================================================ */
import type { CSSProperties, ReactNode } from "react";
import { C } from "../../theme/tokens";

const Sketch = ({
  color,
  children,
  style,
}: {
  color: string;
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth="3.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", width: "100%", height: "100%", overflow: "visible", ...style }}
  >
    {children}
  </svg>
);

const wash = (color: string, o = 0.16) => ({ fill: color, fillOpacity: o, stroke: "none" });

/** Le dessin de chaque vignette, sous la clé que le serveur emploie. */
const DRAWINGS: Record<string, (c: string) => ReactNode> = {
  "vig-projecteur": (c) => (
    <>
      <path d="M22 44 H62 V72 H22 Z" {...wash(c)} />
      <path d="M22 44 H62 V72 H22 Z" />
      <circle cx="36" cy="34" r="11" {...wash(c, 0.22)} />
      <circle cx="36" cy="34" r="11" />
      <circle cx="56" cy="36" r="8" />
      <path d="M62 54 L82 46 L82 68 L62 62 Z" {...wash(c, 0.1)} />
      <path d="M62 54 L82 46 L82 68 L62 62 Z" />
      <path d="M28 72 L28 82 M56 72 L56 82" />
    </>
  ),
  "vig-fauteuil": (c) => (
    <>
      <path d="M28 42 C28 32 72 32 72 42 L72 66 L28 66 Z" {...wash(c)} />
      <path d="M28 42 C28 32 72 32 72 42 L72 66 L28 66 Z" />
      <path d="M20 46 L28 46 L28 66 L20 66 Z" />
      <path d="M72 46 L80 46 L80 66 L72 66 Z" />
      <path d="M36 66 L36 84 M64 66 L64 84" />
    </>
  ),
  "vig-bobine": (c) => (
    <>
      <circle cx="50" cy="50" r="30" {...wash(c)} />
      <circle cx="50" cy="50" r="30" />
      <circle cx="50" cy="50" r="7" />
      <circle cx="50" cy="30" r="6" />
      <circle cx="67" cy="60" r="6" />
      <circle cx="33" cy="60" r="6" />
    </>
  ),
  "vig-ticket": (c) => (
    <>
      <path d="M18 38 H82 V50 A6 6 0 0 0 82 62 V74 H18 V62 A6 6 0 0 0 18 50 Z" {...wash(c)} />
      <path d="M18 38 H82 V50 A6 6 0 0 0 82 62 V74 H18 V62 A6 6 0 0 0 18 50 Z" />
      <path d="M56 40 L56 46 M56 52 L56 58 M56 64 L56 72" />
      <path d="M28 50 L44 50 M28 60 L40 60" />
    </>
  ),
  "vig-esquimau": (c) => (
    <>
      <path d="M34 22 H66 V64 A16 16 0 0 1 34 64 Z" {...wash(c)} />
      <path d="M34 22 H66 V64 A16 16 0 0 1 34 64 Z" />
      <path d="M50 80 L50 92" />
      <path d="M34 40 H66 M34 52 H66" />
    </>
  ),
  "vig-rideau": (c) => (
    <>
      <path d="M16 22 H84" />
      <path d="M22 22 C34 44 22 62 30 84 L18 84 L18 22 Z" {...wash(c)} />
      <path d="M22 22 C34 44 22 62 30 84 L18 84 L18 22 Z" />
      <path d="M78 22 C66 44 78 62 70 84 L82 84 L82 22 Z" {...wash(c)} />
      <path d="M78 22 C66 44 78 62 70 84 L82 84 L82 22 Z" />
      <path d="M38 26 C42 46 38 66 42 82 M62 26 C58 46 62 66 58 82" />
    </>
  ),
  "vig-clap": (c) => (
    <>
      <path d="M20 44 H80 V78 H20 Z" {...wash(c)} />
      <path d="M20 44 H80 V78 H20 Z" />
      <path d="M18 26 L78 18 L80 34 L20 42 Z" {...wash(c, 0.24)} />
      <path d="M18 26 L78 18 L80 34 L20 42 Z" />
      <path d="M34 24 L38 40 M52 22 L56 38 M70 20 L74 36" />
    </>
  ),
  "vig-cadran": (c) => (
    <>
      <circle cx="50" cy="52" r="28" {...wash(c)} />
      <circle cx="50" cy="52" r="28" />
      <path d="M50 34 L50 52 L64 60" />
      <path d="M38 18 L62 18" />
      <path d="M50 18 L50 24" />
    </>
  ),
  "vig-lanterne": (c) => (
    <>
      <path d="M34 30 H66 L72 70 H28 Z" {...wash(c)} />
      <path d="M34 30 H66 L72 70 H28 Z" />
      <path d="M28 70 H72 L72 78 H28 Z" />
      <path d="M42 24 C42 16 58 16 58 24 Z" />
      <path d="M46 44 C46 56 54 56 54 44" />
    </>
  ),
  "vig-palme": (c) => (
    <>
      <path d="M50 88 C50 60 50 40 50 22" />
      <path d="M50 46 C34 46 24 36 22 22 C38 22 50 32 50 46 Z" {...wash(c, 0.22)} />
      <path d="M50 46 C34 46 24 36 22 22 C38 22 50 32 50 46 Z" />
      <path d="M50 60 C36 60 27 52 25 40 C39 40 50 48 50 60 Z" {...wash(c, 0.16)} />
      <path d="M50 60 C36 60 27 52 25 40 C39 40 50 48 50 60 Z" />
      <path d="M50 46 C66 46 76 36 78 22 C62 22 50 32 50 46 Z" {...wash(c, 0.22)} />
      <path d="M50 46 C66 46 76 36 78 22 C62 22 50 32 50 46 Z" />
      <path d="M50 60 C64 60 73 52 75 40 C61 40 50 48 50 60 Z" {...wash(c, 0.16)} />
      <path d="M50 60 C64 60 73 52 75 40 C61 40 50 48 50 60 Z" />
    </>
  ),
  "vig-nitrate": (c) => (
    <>
      <path d="M26 24 H74 V80 H26 Z" {...wash(c)} />
      <path d="M26 24 H74 V80 H26 Z" />
      <path d="M32 32 h8 v8 h-8 Z M32 48 h8 v8 h-8 Z M32 64 h8 v8 h-8 Z" />
      <path d="M60 32 h8 v8 h-8 Z M60 48 h8 v8 h-8 Z M60 64 h8 v8 h-8 Z" />
      <path d="M46 40 C52 52 48 60 54 68" {...wash(c, 0.3)} />
      <path d="M46 40 C52 52 48 60 54 68" />
    </>
  ),
};

export const RARITY_INK: Record<string, string> = {
  common: C.ink,
  rare: C.ochre,
  gold: C.burgundy,
};

/** Y a-t-il un dessin pour cette clé ? Une vignette inconnue n'affole rien. */
export const isDrawn = (id: string): boolean => id in DRAWINGS;

export function StickerArt({ id, rarity }: { id: string; rarity?: string }) {
  const draw = DRAWINGS[id];
  const ink = RARITY_INK[rarity ?? "common"] ?? C.ink;
  /* UNE VIGNETTE VENUE D'UN SERVEUR PLUS RÉCENT NE CASSE PAS LA PLANCHE.
     Le catalogue vit là-bas ; un classeur qui n'a pas encore été
     rechargé peut recevoir une clé qu'il ne connaît pas, et un carré
     vide vaut mieux qu'un écran blanc. */
  if (!draw) return <div style={{ width: "100%", height: "100%" }} />;
  return <Sketch color={ink}>{draw(ink)}</Sketch>;
}
