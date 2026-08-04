/* ============================================================
   LE CABINET DE CURIOSITÉS — les dessins

   Les décors d'avant venaient de deux endroits : les motifs que la
   maison dessine ailleurs (tache de café, scotch, punaise) et quatre
   pictogrammes lucide. Les premiers disaient « papeterie », les seconds
   « planche d'icônes ». Ni les uns ni les autres ne disaient ce qu'on
   pose vraiment sur une étagère : une plante, une statuette rapportée
   d'un voyage, un réveil qui ne sonne plus.

   Ce sont donc des objets, dessinés à la main dans le même trait que le
   reste du carnet — encre franche, aplats lavés, rien de plein. Chacun
   tient dans un carré de cent unités et POSE sur la ligne du bas : c'est
   ce qui les fait tenir debout côte à côte sur la planche, quelle que
   soit leur taille.

   Les objets muraux, eux, PENDENT du haut de leur carré : ils
   s'accrochent au fond du rayon et ne touchent aucune planche. Le clou
   ou la punaise est dessiné dedans, c'est lui qui dit qu'on les a
   plantés là.
   ============================================================ */

/* Un dessin : l'encre au trait, les aplats lavés en dessous. Toutes les
   pièces partagent le même carré, la même épaisseur de trait et les
   mêmes bouts ronds — c'est ce qui les fait lire comme une seule main. */
const Sketch = ({ color, style, children }) => (
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

/* L'aplat : la couleur de l'objet, mais lavée. Peindre au même ton que
   le trait donnerait une silhouette pleine — une vignette, pas un
   croquis. */
const wash = (color, o = 0.16) => ({ fill: color, fillOpacity: o, stroke: "none" });

/* ---------- CE QUI SE POSE ---------- */

export const Plant = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M36 66 L64 66 L60 92 L40 92 Z" {...wash(color)} />
    <path d="M36 66 L64 66 L60 92 L40 92 Z" />
    <path d="M34 70 L66 70" />
    <path d="M50 66 C50 52 50 44 50 34" />
    <path d="M50 50 C38 50 30 42 30 32 C42 32 50 40 50 50 Z" {...wash(color, 0.22)} />
    <path d="M50 50 C38 50 30 42 30 32 C42 32 50 40 50 50 Z" />
    <path d="M50 44 C62 44 71 36 71 26 C58 26 50 34 50 44 Z" {...wash(color, 0.22)} />
    <path d="M50 44 C62 44 71 36 71 26 C58 26 50 34 50 44 Z" />
    <path d="M50 34 C44 26 44 18 48 12 C55 18 56 27 50 34 Z" {...wash(color, 0.22)} />
    <path d="M50 34 C44 26 44 18 48 12 C55 18 56 27 50 34 Z" />
  </Sketch>
);

export const Cactus = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M38 74 L62 74 L59 92 L41 92 Z" {...wash(color)} />
    <path d="M38 74 L62 74 L59 92 L41 92 Z" />
    <path d="M42 74 L42 34 C42 26 58 26 58 34 L58 74 Z" {...wash(color, 0.2)} />
    <path d="M42 74 L42 34 C42 26 58 26 58 34 L58 74" />
    <path d="M42 56 C32 56 28 52 28 44" />
    <path d="M58 62 C70 62 74 57 74 48" />
    <path d="M50 40 L50 46 M50 54 L50 60" strokeWidth="2.4" />
  </Sketch>
);

export const Statuette = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M34 84 L66 84 L66 92 L34 92 Z" {...wash(color, 0.24)} />
    <path d="M34 84 L66 84 L66 92 L34 92 Z" />
    <path d="M40 84 C40 66 44 58 50 52 C56 58 60 66 60 84 Z" {...wash(color)} />
    <path d="M40 84 C40 66 44 58 50 52 C56 58 60 66 60 84" />
    <circle cx="50" cy="34" r="13" {...wash(color, 0.2)} />
    <circle cx="50" cy="34" r="13" />
    <path d="M46 52 L54 52" />
  </Sketch>
);

export const Cat = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M34 92 C34 70 40 58 50 58 C60 58 66 70 66 92 Z" {...wash(color)} />
    <path d="M34 92 C34 70 40 58 50 58 C60 58 66 70 66 92" />
    <circle cx="50" cy="40" r="16" {...wash(color, 0.2)} />
    <circle cx="50" cy="40" r="16" />
    <path d="M37 30 L34 16 L47 24 Z" {...wash(color, 0.2)} />
    <path d="M37 30 L34 16 L47 24 Z" />
    <path d="M63 30 L66 16 L53 24 Z" {...wash(color, 0.2)} />
    <path d="M63 30 L66 16 L53 24 Z" />
    <path d="M66 90 C78 88 80 76 74 70" />
    <path d="M45 40 L45 42 M55 40 L55 42" strokeWidth="3.8" />
  </Sketch>
);

export const Candle = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M32 92 C32 84 40 82 50 82 C60 82 68 84 68 92 Z" {...wash(color, 0.24)} />
    <path d="M32 92 C32 84 40 82 50 82 C60 82 68 84 68 92 Z" />
    <path d="M42 82 L42 40 L58 40 L58 82 Z" {...wash(color)} />
    <path d="M42 82 L42 40 L58 40 L58 82" />
    <path d="M50 40 L50 32" />
    <path d="M50 32 C56 26 56 18 50 10 C44 18 44 26 50 32 Z" {...wash(color, 0.3)} />
    <path d="M50 32 C56 26 56 18 50 10 C44 18 44 26 50 32 Z" />
  </Sketch>
);

export const Mug = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M30 52 L66 52 L62 92 L34 92 Z" {...wash(color)} />
    <path d="M30 52 L66 52 L62 92 L34 92 Z" />
    <path d="M66 58 C78 58 80 74 65 76" />
    <path d="M42 40 C38 34 46 30 42 22" strokeWidth="2.6" />
    <path d="M56 40 C52 34 60 30 56 22" strokeWidth="2.6" />
  </Sketch>
);

export const Clock = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <circle cx="50" cy="54" r="28" {...wash(color, 0.14)} />
    <circle cx="50" cy="54" r="28" />
    <path d="M50 54 L50 38 M50 54 L62 60" />
    <path d="M28 30 C22 22 26 14 34 16" />
    <path d="M72 30 C78 22 74 14 66 16" />
    <path d="M34 80 L28 92 M66 80 L72 92" />
  </Sketch>
);

export const Books = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M26 92 L26 78 L72 78 L72 92 Z" {...wash(color, 0.2)} />
    <path d="M26 92 L26 78 L72 78 L72 92 Z" />
    <path d="M30 78 L30 64 L76 64 L76 78 Z" {...wash(color, 0.14)} />
    <path d="M30 78 L30 64 L76 64 L76 78 Z" />
    <path d="M24 64 L24 50 L66 50 L66 64 Z" {...wash(color, 0.24)} />
    <path d="M24 64 L24 50 L66 50 L66 64 Z" />
    <path d="M34 85 L64 85 M38 71 L68 71 M32 57 L58 57" strokeWidth="2.2" />
  </Sketch>
);

/* ---------- CE QUI S'ACCROCHE ---------- */

export const Frame = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M50 6 L50 16" strokeWidth="2.4" />
    <circle cx="50" cy="6" r="3" fill={color} stroke="none" />
    <path d="M22 18 L78 18 L78 88 L22 88 Z" {...wash(color, 0.12)} />
    <path d="M22 18 L78 18 L78 88 L22 88 Z" />
    <path d="M32 28 L68 28 L68 78 L32 78 Z" />
    <path d="M32 68 L45 52 L55 62 L64 48 L68 54" strokeWidth="2.6" />
  </Sketch>
);

export const Postcard = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <g transform="rotate(-4 50 52)">
      <path d="M16 26 L84 26 L84 80 L16 80 Z" {...wash(color, 0.12)} />
      <path d="M16 26 L84 26 L84 80 L16 80 Z" />
      <path d="M52 26 L52 80" strokeWidth="2.2" />
      <path d="M60 40 L76 40 M60 50 L76 50 M60 60 L70 60" strokeWidth="2.2" />
      <path d="M24 70 C30 54 38 50 44 62" strokeWidth="2.4" />
    </g>
    <circle cx="50" cy="24" r="5" {...wash(color, 0.5)} />
    <circle cx="50" cy="24" r="5" />
  </Sketch>
);

export const Garland = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M6 16 C30 52 70 52 94 16" />
    <path d="M24 38 L24 48" strokeWidth="2.2" />
    <path d="M50 47 L50 57" strokeWidth="2.2" />
    <path d="M76 38 L76 48" strokeWidth="2.2" />
    <circle cx="24" cy="55" r="7" {...wash(color, 0.3)} />
    <circle cx="24" cy="55" r="7" />
    <circle cx="50" cy="64" r="7" {...wash(color, 0.3)} />
    <circle cx="50" cy="64" r="7" />
    <circle cx="76" cy="55" r="7" {...wash(color, 0.3)} />
    <circle cx="76" cy="55" r="7" />
  </Sketch>
);

export const WallClock = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M50 4 L50 14" strokeWidth="2.4" />
    <circle cx="50" cy="52" r="34" {...wash(color, 0.12)} />
    <circle cx="50" cy="52" r="34" />
    <circle cx="50" cy="52" r="26" strokeWidth="2" />
    <path d="M50 52 L50 32 M50 52 L64 60" />
    <path d="M50 22 L50 26 M80 52 L76 52 M50 82 L50 78 M20 52 L24 52" strokeWidth="2.4" />
  </Sketch>
);

export const Pennant = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M4 14 C34 26 66 26 96 14" />
    <path d="M22 21 L46 26 L30 60 Z" {...wash(color, 0.24)} />
    <path d="M22 21 L46 26 L30 60 Z" />
    <path d="M56 26 L80 20 L74 56 Z" {...wash(color, 0.16)} />
    <path d="M56 26 L80 20 L74 56 Z" />
  </Sketch>
);

export const Ivy = ({ color, ...p }) => (
  <Sketch color={color} {...p}>
    <path d="M30 10 L70 10 L64 30 L36 30 Z" {...wash(color, 0.2)} />
    <path d="M30 10 L70 10 L64 30 L36 30 Z" />
    <path d="M44 30 C40 46 48 54 42 72" />
    <path d="M58 30 C64 44 56 56 62 86" />
    <path d="M42 40 C34 38 32 32 34 28 C40 30 43 34 42 40 Z" {...wash(color, 0.24)} />
    <path d="M42 40 C34 38 32 32 34 28 C40 30 43 34 42 40 Z" />
    <path d="M45 60 C53 60 57 56 57 50 C50 50 45 54 45 60 Z" {...wash(color, 0.24)} />
    <path d="M45 60 C53 60 57 56 57 50 C50 50 45 54 45 60 Z" />
    <path d="M60 68 C52 68 48 63 48 57 C56 58 61 62 60 68 Z" {...wash(color, 0.24)} />
    <path d="M60 68 C52 68 48 63 48 57 C56 58 61 62 60 68 Z" />
  </Sketch>
);
