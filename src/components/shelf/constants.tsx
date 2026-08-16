/* ============================================================
   VIEW — SHELF

   The wall shows pinned cards; the shelf shows filed objects. It is not
   the same gesture: on the wall one looks, on the shelf one files. Hence
   the drag and drop, and hence the shelves being destinations
   themselves — dropping a case in a shelf gives it its status, not only
   its place.
   ============================================================ */
import type { ComponentType, CSSProperties } from "react";
import { C, alpha } from "../../theme/tokens";
import {
  Plant,
  Cactus,
  Statuette,
  Cat,
  Candle,
  Mug,
  Clock,
  Books,
  Frame,
  Postcard,
  WallClock,
  Garland,
  Pennant,
  Ivy,
  Tape,
} from "./objects";
import { CustomDraw } from "./CustomDraw";
import { WonDraw } from "./WonDraw";
import { isWonMotif, listWonDecor, wonDecorByKey } from "../../services/wonDecor";
import type { WonDecor } from "../../services/wonDecor";
import {
  customDecorByKey,
  isCustomMotif,
  isDecorHidden,
  listCustomDecor,
} from "../../services/customDecor";
import type { CustomDecor } from "../../services/customDecor";
import type { Film, ShelfKind } from "../../types";

interface ShelfKindConfig {
  /* The title and the tag live in the catalogue, under
     `shelf.kinds.<key>`: a shelf is a rule about cards, not a place to
     keep a sentence. */
  /** What a card dropped in this shelf becomes. */
  patch: Partial<Film>;
  tint?: string;
  border?: string;
}

export const SHELF_KIND: Record<ShelfKind, ShelfKindConfig> = {
  bedside: {
    patch: { bedside: true, archived: false },
    tint: `${alpha(C.burgundy, 0.051)}`,
    border: C.burgundy,
  },
  main: { patch: { bedside: false, archived: false } },
  reserve: {
    patch: { bedside: false, archived: true },
    tint: "transparent",
    border: C.line,
  },
};

export const BOX_W = 96,
  BOX_H = 144;

/* The gap between two cases, and the one that separates them from the
   board. It is no longer a figure copied into three styles: the drag
   needs to KNOW it.

   The gap now lives INSIDE the object's wrapper, and that is the whole
   remedy to the marker's nervousness. Before, a case's drop zone stopped
   at its edge: the nine pixels separating it from the next belonged to
   the row. Crossing them — which one does at every case when sweeping
   across the shelf — therefore designated the whole row, and the marker
   shot off to the end of the line before coming back. A row of ten cases
   meant nine round trips per sweep.

   The wrappers now pave the row without a hole: at any instant one is
   hovering exactly one object, or the row's clean emptiness. */
export const GAP_X = 9,
  GAP_Y = 12;

/* The colours a category can carry live in `theme/palette`, with the
   keys they define — there was a second list here to maintain by hand,
   and a key forgotten on one side fell back on burgundy without a word.
   We hand them back under the name this file already served them by. */
export { CAT_COLORS, CAT_FAMILIES, catInk } from "../../theme/palette";

/* A view can change its wood. Only three things are themed: the board,
   the tint of the shelf's paper, and the accent ink — enough to change
   the mood, too little to undo the notebook. `kraft` reproduces exactly
   the shelf from before the themes: a migrated view must be identical to
   the pixel. */
export const THEMES = {
  kraft: { wood: ["#7A5B3A", "#5E442A"], tint: null, accent: C.burgundy },
  noyer: { wood: ["#5A3E28", "#3B2818"], tint: "#2B262008", accent: C.ochre },
  ceruse: { wood: ["#C9B99C", "#A8967A"], tint: null, accent: C.pine },
  nuit: { wood: ["#3A4250", "#252B36"], tint: "#5C6B7814", accent: C.cobalt },
  atelier: {
    wood: ["#8A6A3E", "#6B4F2A"],
    tint: "#B9862E10",
    accent: C.vermillion,
  },
};
export const themeOf = (key: string) => THEMES[key as keyof typeof THEMES] || THEMES.kraft;

/* THE CABINET OF CURIOSITIES — what one puts on a shelf and which is not
   a film.

   The first patterns were the decors the house draws elsewhere — coffee
   stain, strip of tape, pin — and four lucide pictograms. The former said
   "stationery", the latter "icon sheet", and none said what one actually
   puts on a shelf. They are now everyday objects, drawn by hand in
   `objects.jsx`.

   Two families, and it is the pattern that decides: what is LAID DOWN
   stands upright on a board, among the cases; what HANGS is pinned to the
   back of the shelf, wherever one wants, and takes nobody's place. */
export interface DecorType {
  key: string;
  /**
   * Present ONLY on an imported object, where it is what its owner typed.
   * A house object has none: its name lives in the catalogue, under
   * `shelf.decor.<key>`, because it has one in each language. Read the
   * two through `decorLabel` rather than picking a side here.
   */
  label?: string;
  /** Comes from the user's disk, and not from `objects.jsx`. */
  custom?: boolean;
  /** For an imported pattern: does colour still speak to it? */
  tintable?: boolean;
  /* A house drawing. The decors of `atmosphere` do not all have the same
     signature — one wants `width`, another `w`, a third a `rotate` — and
     listing them here would only copy out a contract that belongs to each
     drawing. `ComponentType` without a constraint says what we really
     know: it is a component, and the caller passes it what it has. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw?: ComponentType<any>;
  /** Stands as tall as a case rather than square. */
  tall?: boolean;
  /** Carries a name, and therefore opens a text field in its panel. */
  writes?: boolean;
  /** Hangs at the back of the shelf instead of standing on a board. */
  wall?: boolean;
  /** The size it takes on arrival, when `M` does not suit it. */
  defaultSize?: number;
}

export const DECOR_TYPES: DecorType[] = [
  /* THE DIVIDER — the upright card from before the categories, back as a
     trinket.

     It separated without containing anything, and that is precisely what
     it lacked to be a category: one could not "put a film in Crime", only
     lay it after the card and hope the order would hold. The box has
     taken that role. But separating without containing stays a useful
     gesture — in a box that has grown, a shelf by director where one
     wants to mark the decades. So the card comes back for what it always
     knew how to do, and nothing more.

     `tall`: it stands as tall as a case instead of the other decors'
     square — that is what makes it read as a partition planted between
     two edges, and not as a trinket set in front.
     `writes`: the only pattern to carry a name, hence the only one to
     open a text field in its panel. */
  { key: "divider", tall: true, writes: true },

  // what is laid down
  { key: "plant", draw: Plant },
  { key: "cactus", draw: Cactus },
  { key: "statuette", draw: Statuette },
  { key: "cat", draw: Cat },
  { key: "candle", draw: Candle },
  { key: "mug", draw: Mug },
  { key: "clock", draw: Clock },
  { key: "books", draw: Books },

  // what hangs
  { key: "frame", draw: Frame, wall: true },
  { key: "postcard", draw: Postcard, wall: true },
  { key: "wallclock", draw: WallClock, wall: true },
  { key: "garland", draw: Garland, wall: true },
  { key: "pennant", draw: Pennant, wall: true },
  { key: "ivy", draw: Ivy, wall: true },
  /* It arrives in XS: a strip of tape at the other wall objects' size
     would make a banner, and nobody sticks up a banner. */
  { key: "tape", draw: Tape, wall: true, defaultSize: 0.42 },
];

/* The two families, ready to display: the cabinet presents them under two
   headings, because one does not lay them down with the same gesture. */
export const SHELF_DECOR = DECOR_TYPES.filter((d) => !d.wall);
export const WALL_DECOR = DECOR_TYPES.filter((d) => d.wall);
export const DECOR_BY_KEY: Record<string, DecorType> = Object.fromEntries(
  DECOR_TYPES.map((d) => [d.key, d])
);

/* THE CATALOGUE, IMPORTED PATTERNS INCLUDED.

   `DECOR_BY_KEY` stays the table of house patterns — fixed, known at
   compile time. But an object laid on the shelf can now designate a
   pattern that came from disk, and looking for its drawing has become a
   gesture: it is `decorSpec` that does it, and it alone. Reading
   `DECOR_BY_KEY` directly means seeing only half the cabinet.

   The drawing component is memoised by key: `decorSpec` is called when
   rendering every object, and making a new component every time would
   remount the whole image at every hover. */
const drawCache = new Map<string, ComponentType<{ color?: string; style?: CSSProperties }>>();

const customDraw = (key: string) => {
  let Draw = drawCache.get(key);
  if (!Draw) {
    Draw = (props) => <CustomDraw motif={key} {...props} />;
    drawCache.set(key, Draw);
  }
  return Draw;
};

/* LES OBJETS GAGNÉS ONT LEUR PROPRE DESSIN ET LEUR PROPRE CACHE. Le
   même raisonnement que juste au-dessus : `decorSpec` est appelé au
   rendu de chaque objet posé, et fabriquer un composant à chaque fois
   remonterait toute l'image à chaque survol. */
const wonCache = new Map<string, ComponentType<{ color?: string; style?: CSSProperties }>>();

const wonDraw = (key: string) => {
  let Draw = wonCache.get(key);
  if (!Draw) {
    Draw = (props) => <WonDraw motif={key} {...props} />;
    wonCache.set(key, Draw);
  }
  return Draw;
};

/* CE QU'ON A TIRÉ, VU COMME UN BIBELOT DU CABINET.

   `custom: true` parce que le panneau s'en sert pour dire « celui-ci
   n'est pas de la maison » — un objet gagné ne l'est pas davantage
   qu'un objet déposé. Ce qui les sépare est ailleurs : celui-ci ne
   s'efface pas et ne se partage pas, et le panneau ne lui offre donc ni
   l'un ni l'autre. */
const wonSpecOf = (d: WonDecor): DecorType => ({
  key: d.key,
  /* Le libellé vient de la base, dans les deux langues : ces objets
     s'écrivent après la compilation, aucune clé ne peut les attendre.
     Le français est le repli, comme partout ailleurs ici. */
  label: d.label.fr,
  wall: d.wall,
  custom: true,
  tintable: d.tintable,
  draw: wonDraw(d.key),
});

const specOf = (d: CustomDecor): DecorType => ({
  key: d.key,
  label: d.label,
  wall: d.wall,
  custom: true,
  tintable: d.tintable,
  draw: customDraw(d.key),
});

/**
 * What to write under an object.
 *
 * WHAT THE USER TYPED IS NEVER TRANSLATED: an imported object keeps its
 * own name in both languages, exactly like a card's title or a note. Only
 * the house objects, which we named ourselves, have two names.
 */
export const decorLabel = (d: DecorType, t: (key: string) => string): string =>
  d.label ?? t(`shelf.decor.${d.key}`);

/** An object's pattern, whether it comes from the house or from an import. */
export const decorSpec = (motif: string): DecorType | undefined => {
  const house = DECOR_BY_KEY[motif];
  if (house) return house;
  /* TROIS ORIGINES MAINTENANT, ET L'ORDRE N'EST PAS INDIFFÉRENT : la
     maison d'abord, parce qu'elle est un objet en mémoire et non une
     recherche ; les deux autres ensuite, sur leur préfixe. Un motif qui
     ne tombe dans aucune des trois rend `undefined`, et l'étagère
     dessine un vide plutôt que d'échouer. */
  if (isWonMotif(motif)) {
    const won = wonDecorByKey(motif);
    return won ? wonSpecOf(won) : undefined;
  }
  const mine = isCustomMotif(motif) ? customDecorByKey(motif) : undefined;
  return mine ? specOf(mine) : undefined;
};

/* The cabinet's two families: imported patterns included, hidden patterns
   excluded. The filter is here and not in `decorSpec` — a hidden pattern
   leaves the PANEL, it is not erased from the shelves where it is already
   laid. */
export const shelfDecorTypes = (): DecorType[] =>
  [
    ...SHELF_DECOR,
    ...listWonDecor()
      .filter((d) => !d.wall)
      .map(wonSpecOf),
    ...listCustomDecor()
      .filter((d) => !d.wall)
      .map(specOf),
  ].filter((d) => !isDecorHidden(d.key));
export const wallDecorTypes = (): DecorType[] =>
  [
    ...WALL_DECOR,
    ...listWonDecor()
      .filter((d) => d.wall)
      .map(wonSpecOf),
    ...listCustomDecor()
      .filter((d) => d.wall)
      .map(specOf),
  ].filter((d) => !isDecorHidden(d.key));

export const isWallMotif = (motif: string): boolean => !!decorSpec(motif)?.wall;
/* The size of a hanging object, drawing and grip included.

   `WALL_GRIP` is the transparent margin that goes round the drawing: an
   ivy is only a stroke of ink, and aiming at the stroke itself demanded a
   precision one does not have in the middle of a shelf.

   It lives here and not in the drawing because the DROP needs it as much
   as the display does: it is that half-width that stops an object
   overflowing onto the neighbouring shelf. */
export const WALL_ART = 64,
  WALL_GRIP = 11;
export const wallBoxOf = (size = 1): number => Math.round(WALL_ART * size) + 2 * WALL_GRIP;

/* The sizes. `XS` came with the strip of tape: a piece of tape is not an
   object one looks at, it is a trace one notices, and even the small
   calibre made a placard of it. It serves just as well for all the rest —
   a pin, a postcard slipped into a corner. */
export const DECOR_SIZES: [string, number][] = [
  ["XS", 0.42],
  ["S", 0.7],
  ["M", 1],
  ["L", 1.5],
  ["XL", 2.2],
  ["XXL", 3.2],
  ["XXXL", 4.6],
];

/* The marker moves by `transform` and never by `left`/`top`: a
   translation is compositing work, whereas writing a position invalidates
   the layout — which the next event's `getBoundingClientRect` then forces
   to be recomputed in full. Over a hundred cases, that write/read round
   trip cost more than all the rest. */
/* Shorter than the case, and centred on it: the marker does not have to
   border the whole edge to designate a slot. A full-height bar read as a
   shelf border; this stretch reads as a mark laid between two things. */
export const MARK_W = 26,
  MARK_H = BOX_H - 30;

export const DROP_MARK_STYLE: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  width: MARK_W,
  height: MARK_H,
  zIndex: 60,
  pointerEvents: "none",
  /* The marker stays in the page permanently, transparent, so that its
     layer is ready BEFORE the drag — otherwise the browser makes it at
     the first move, and that is the lag one could see. Appearing and
     moving then cost no more than compositing.

     The drawing, for its part, can be as detailed as one likes: it is
     painted a single time into the layer, at the page's birth, and never
     again — a flat fill was not a necessity, only a caution. */
  opacity: 0,
  willChange: "transform, opacity",
  backfaceVisibility: "hidden",
  // it settles onto the board: it is by the foot that it unfolds
  transformOrigin: "bottom center",
  // the transition is in the style sheet — see the comment over there
};

/* THE DROP MARKER — a typesetter's mark, not a dotted line.

   It was a seam: a broken line of large dots, drawn as in the margin of a
   pattern. The intention was good — saying "this slots in here" with a
   hand rather than an arrow — but a dotted line blinking between two
   cases ends up looking like a word processor's caret, and there was a
   lot of drawing to say a simple thing.

   It is now the mark a proofreader draws on a proof to say "here, and
   nowhere else": a solid hairline of ink, a serif capping it, and at the
   foot an insertion chevron resting on the board. Three strokes, no
   movement, no repetition. It no longer blinks — it slides from one slot
   to the next, and it is that slide that shows what one is aiming at.

   Everything is relative to `MARK_H`: the case's height alone decides. */
export const AXIS = 13;

const HEAD = 9,
  FOOT = MARK_H - 11,
  SERIF = 4.5,
  CARET = 6.5;

/* The hairline, the serif, the chevron. Three paths rather than one: they
   carry neither the same thickness nor the same function, and the shadow
   takes all three back without having to redraw them. */
export const MARK_PATHS: { d: string; w: number }[] = [
  { d: `M${AXIS} ${HEAD} L${AXIS} ${FOOT}`, w: 2.2 },
  { d: `M${AXIS - SERIF} ${HEAD} L${AXIS + SERIF} ${HEAD}`, w: 2.2 },
  { d: `M${AXIS - CARET} ${MARK_H - 2} L${AXIS} ${FOOT} L${AXIS + CARET} ${MARK_H - 2}`, w: 2.6 },
];

/* The shadow is only the offset copy of the stroke, bottom right like
   every shadow on the page: that is what lays the marker ON the shelf
   rather than inside it. */
export const MARK_INK: CSSProperties = {
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
