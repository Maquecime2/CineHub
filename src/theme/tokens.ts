/* ============================================================
   TOKENS — what the site is made of, and what can change
   ============================================================

   `C` is no longer a list of hex codes but a list of REFERENCES. The
   colour itself lives in a CSS variable written on the document's root,
   and it is a SKIN that writes it there (see `theme/skins.ts`).

   Why this way, and not a React context: `C` is imported by twenty-nine
   files and read six hundred and thirteen times, almost always inside an
   inline style. Making it React state would have meant a hook in each of
   those files, and a re-render of the whole application on every change.
   A CSS variable asks nothing of anyone — you write it on the root, and
   every read that already exists picks up the new value on the next
   paint.

   THE FALLBACKS ARE THE ORIGINAL SKIN, character for character. A token
   read before any skin has been applied — the very first render, a test
   with no DOM — therefore gives exactly what it gave before the skins
   existed.
   ============================================================ */

export const C = {
  paper: "var(--c-paper)",
  paperDark: "var(--c-paper-dark)",
  card: "var(--c-card)",
  ink: "var(--c-ink)",
  inkFaded: "var(--c-ink-faded)",
  burgundy: "var(--c-burgundy)",
  ochre: "var(--c-ochre)",
  pine: "var(--c-pine)",
  slate: "var(--c-slate)",
  line: "var(--c-line)",
  // accents — livelier touches that pierce the background
  cobalt: "var(--c-cobalt)",
  vermillion: "var(--c-vermillion)",
  moss: "var(--c-moss)",
  /* The eighth tab needed it: the other seven tints were taken, and two
     tabs of the same colour cannot be told apart once the rail is
     squeezed into pills. */
  plum: "var(--c-plum)",
} as const;

/* THE FOUR ROLES OF TYPOGRAPHY.

   There were no roles: four families named in full, copied out two
   hundred and twenty-nine times. A skin changing its typeface therefore
   had to rewrite two hundred and twenty-nine lines.

   These are roles and not typefaces: `mono` is "what is typed on a
   machine" — the labels, the counters, the small capitals — and a skin
   can put a condensed grotesque there without anything that uses it
   having to know. */
export const F = {
  title: "var(--f-title)",
  body: "var(--f-body)",
  hand: "var(--f-hand)",
  mono: "var(--f-mono)",
} as const;

/* A COLOUR, MORE TRANSPARENT.

   We used to write `${C.ink}22` — the hexadecimal and its alpha channel
   stuck end to end. That was right as long as `C.ink` WAS a hexadecimal;
   `var(--c-ink)22` no longer means anything.

   `color-mix` does the same work without knowing anything of the shape
   of the colour: it works on a reference as on a hash, which lets the
   palette's tints (which do remain hexadecimals) go down the same path.

   The opacity is written in plain sight — `alpha(C.ink, 0.13)` rather
   than `22` — because nobody reads `0x22` as "thirteen per cent". */
export const alpha = (color: string, a: number): string =>
  `color-mix(in srgb, ${color} ${Math.round(a * 1000) / 10}%, transparent)`;

/* THE TWO THRESHOLDS, AND NOT THIRTY.

   They are here, with the colours and the typefaces, because they are of
   the same kind: what the site is made of and what can change. A value
   written by hand in a media query on one side and in a `matchMedia` on
   the other is two truths diverging at the first adjustment — and the
   rail turns out horizontal while the view still believes it vertical.

   Two thresholds only, and they designate GESTURES rather than devices:
   below `phone`, one holds the object in one hand and the thumb does not
   reach the top of the screen; below `tablet`, the window is too narrow
   for two columns but keeps its margins. Above that, it is the binder as
   it was drawn.

   `src/hooks/useViewport.ts` turns them into queries; the `--bp-*`
   below serve the handful of places that have no component to ask the
   question. */
export const BP = { phone: 640, tablet: 1024 } as const;

export const FONT_IMPORT = `
/* THE DEFAULT SKIN — the archivist notebook, kraft paper and red
   thread. It is here, hard-coded, and not in the catalogue of skins: the
   site must be what it has always been before even one line of
   JavaScript has run. A chosen skin rewrites these same variables on
   documentElement, where they win against these.

   The typefaces are no longer imported here: each skin has its own, and
   loading them all would cost half a dozen files never displayed. It is
   applySkin that lays the link to the ones of the day.

   Not a single backtick in this block, nor anywhere else between the two
   braces of this template string: it would close it in the middle of a
   sentence. The same warning is repeated further down, where the trap
   has already sprung once. */
:root {
  --c-paper: #EEE3CC;
  --c-paper-dark: #E2D3AE;
  --c-card: #F6EFDE;
  --c-ink: #2B2620;
  --c-ink-faded: #6E6153;
  --c-burgundy: #8C3A34;
  --c-ochre: #B9862E;
  --c-pine: #3E5B4B;
  --c-slate: #5C6B78;
  --c-line: #C9B98F;
  --c-cobalt: #3A5C8C;
  --c-vermillion: #C4562E;
  --c-moss: #6E7A3A;
  --c-plum: #6B4560;

  --f-title: 'Playfair Display', serif;
  --f-body: 'Lora', Georgia, serif;
  --f-hand: 'Caveat', cursive;
  --f-mono: 'Special Elite', monospace;

  /* The SHAPE of things, which colour alone does not say: a binder tab
     does not have the same angle as a pastel pill, and a printed poster
     wants no rounding anywhere. */
  --tag-radius: 3px;
  --tag-tracking: 1.5px;
  --tag-transform: none;

  /* MOTION, IN TWO DURATIONS AND NOT THIRTY.

     They are here, and not copied into every component, for a reason
     that is not vanity: the reduced-motion block further down brings
     them back to zero IN A SINGLE PLACE. A duration written inline in a
     React style cannot be cancelled by a stylesheet — it always wins —
     and every animation written that way would be a promise broken to
     whoever asked their system not to move.

     A notebook has no cross-fade: what moves here MOVES ACROSS, and the
     curve says so — it leaves fast and settles, like an object one puts
     back down on a table. */
  --motion-fast: .16s;
  --motion-slow: .34s;
  --motion-ease: cubic-bezier(.2,.8,.3,1);

  /* THE TWO THRESHOLDS, ON THE CSS SIDE. They double BP in tokens.ts,
     and the duplication is owned: a media query does not accept var(),
     so the rules further down rewrite the figure. These tokens serve the
     styles that want to KNOW it without making a condition of it. */
  --bp-phone: 640px;
  --bp-tablet: 1024px;

  /* WHAT THE SCREEN DOES NOT SHOW.

     A notch, a home bar, a rounded corner: on a phone the window is
     larger than the really visible surface. These four tokens say by how
     much, and are worth zero everywhere else — a desktop browser
     resolves env() to its fallback value.

     They are taken here rather than written inline because three layers
     need them and none must guess: the bottom tab bar, the search
     drawer, and the sheet of the film card. */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
}

::selection { background: ${alpha(C.ochre, 0.4)}; color: ${C.ink}; }

body { background: ${C.paper}; }

/* The tab rail may have to scroll in a short window. Its bar brings
   nothing — the edge of a binder has none — and it would eat eleven of
   the rail's forty-six pixels of width. We remove it without removing
   the scrolling: the wheel and the keyboard still work. */
[data-tab-rail] { scrollbar-width: none; }
[data-tab-rail]::-webkit-scrollbar { width: 0; height: 0; }

/* the wheel scrolls a folder, not a web page */
::-webkit-scrollbar { width: 11px; height: 11px; }
::-webkit-scrollbar-track { background: ${C.paperDark}; }
::-webkit-scrollbar-thumb { background: ${C.line}; border: 2px solid ${C.paperDark}; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: ${C.inkFaded}; }

@keyframes swayIn { from { opacity: 0; transform: translateY(10px) rotate(var(--tilt, 0deg)); } to { opacity: 1; transform: translateY(0) rotate(var(--tilt, 0deg)); } }

/* the case opening: the flap swings, the poster comes out of its slot,
   the card arrives last — in that order, otherwise nothing reads. */
@keyframes openLid { from { transform: rotateY(0deg); } to { transform: rotateY(-158deg); } }
@keyframes slideOut { from { opacity: 0; transform: translateX(-34px) rotate(-4deg); } to { opacity: 1; transform: none; } }
@keyframes caseIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes sheetIn { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
/* A DRAWER COMES IN FROM ITS SIDE, AND STRAIGHT.

   slideOut did the job for a page — it comes from the left and leans by
   four degrees, which gives a sheet the look of having been laid by
   hand. On a panel anchored to the right and as tall as the whole
   window, the same lean makes it overflow at both ends for the duration
   of the animation: a sheet settles askew, a drawer does not.

   (No backtick in this comment: it lives INSIDE a template literal, and
   the first one would close the whole stylesheet.) */
@keyframes drawerIn { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }

/* THE FRONT OF HOUSE LIGHTING UP — the one animation that travels.

   A cinema front runs its bulbs from one end to the other, and that is
   what a gain at the counter borrows: it does not blink in place, it
   PASSES. So the light is a background moved along, and not an opacity
   turned up and down.

   It plays ONCE, when something is earned, and never in a loop: a strip
   of bulbs chasing each other forever behind a page one is reading is a
   fairground, not a hall. Its duration is a multiple of the slow motion
   token so that the reduced-motion block below takes it out with the
   rest — an animation timed by hand would go on running for whoever had
   asked the whole site to hold still.

   The two stamps, on the other hand, do not travel: they FALL. A stamp
   is brought down flat and lifts a little ink around itself, so it comes
   in bigger than it lands, and settles. */
@keyframes runLights { from { background-position-x: 0; } to { background-position-x: 240px; } }
@keyframes stampDown { from { opacity: 0; transform: rotate(var(--stamp-tilt, -7deg)) scale(1.6); } 60% { opacity: 1; } to { opacity: var(--stamp-rest, 0.62); transform: rotate(var(--stamp-tilt, -7deg)) scale(1); } }
@keyframes riseAway { from { opacity: 0; transform: translateY(6px); } 30% { opacity: 1; } to { opacity: 0; transform: translateY(-22px); } }

/* During a drag, the drawer tab announces itself as a target. In CSS
   and not in React state: a setState here would re-render the whole row
   at the precise moment the mouse starts to move. */
html[data-dragging="1"] [data-drawer-tab] { background: ${C.ochre} !important; }

/* An open panel lays a full-screen veil to close itself on the first
   click beside it. But an object is DRAGGED from the cabinet onto a
   board: that veil would receive the drop instead of the shelf. During a
   drag it therefore gets out of the way, without ceasing to exist. */
html[data-dragging="1"] [data-veil] { pointer-events: none; }

/* The marker is laid down, it does not light up. Its transition lives
   HERE and not in the inline style, and deliberately so: the drag code
   must be able to cut it for one frame (to place the marker without it
   crossing the shelf from its previous spot) and then give it back by
   simply erasing the inline property — which would not work if the
   resting value came from the inline style too. */
[data-drop-mark] {
  transition: transform .24s cubic-bezier(.2,.88,.3,1), opacity .22s ease-out;
}

/* Drop targets announce themselves, also in CSS: a category about to
   receive a film lights up, an empty row signals itself, a seam between
   two rows deepens. It all goes through an attribute written by hand on
   the node — the same rule as the tab above, and for the same
   reason. */
[data-cat-over="1"] { background: var(--cat-open, ${alpha(C.ochre, 0.13)}) !important; }
[data-row-over="1"] { box-shadow: inset 0 0 0 1px ${alpha(C.ochre, 0.4)}; }
[data-seam-over="1"] { background: ${alpha(C.ochre, 0.27)}; }
[data-row-seam] { transition: background .12s ease, height .12s ease; }

/* The drop marker's ink comes from the view's theme. As a CSS variable
   and not a React prop: changing theme must touch nothing the drag
   manipulates.

   The shadow is excluded from it: it is made of those same paths,
   offset, and repainting them in the theme's ink took away its reason to
   exist — a pale stroke under the stroke, in the same colour, lays
   nothing on anything. */
[data-drop-mark] svg > path { stroke: var(--mark-ink, ${C.burgundy}); }
[data-drop-mark] svg > path[fill] { fill: var(--mark-ink, ${C.burgundy}); }

/* An object hung on the wall can be grabbed: it says so on hover, with a
   drop shadow and nothing else. No transform here — the tilt is written
   inline, and a second hand on the same property would erase the
   object's lean. */
[data-wall-item] { transition: filter .16s ease; }

/* DURING A DRAG, IT GETS OUT OF THE WAY.

   A hung object may now overflow its row, and what overflowed stayed
   grabbable: it covered the row below and received in its stead the
   drops meant for it. That is the flaw which justified keeping objects
   away from the edges; so we remove the flaw rather than the freedom.

   Same reasoning as the veil just above: for the time of the gesture,
   what is not a target stops being one.

   EXCEPT THE ONE BEING HELD. A drag whose source stops being hit-tested
   on hover is a drag the browser cancels outright: the rule, by applying
   to the grabbed object too, prevented picking a flying object back up
   once laid down. So it marks itself at the start of the gesture (see
   WallItem, in items.jsx), and the exception leaves it in place.

   No backtick in this comment, nor anywhere else between these two
   braces: this whole block is a template string, and one backtick would
   close it in the middle of a sentence. */
html[data-dragging="1"] [data-wall-item]:not([data-drag-self]) {
  pointer-events: none !important;
}
[data-wall-item]:hover { filter: drop-shadow(2px 3px 3px rgba(30,20,10,0.3)); }
[data-wall-item]:active { cursor: grabbing; }

/* WHAT ARRIVES ARRIVES BY SLIDING.

   A view that replaces another without a word does not read like a
   folder being opened: it blinks. Nine pixels and a breath are enough to
   say this has just replaced that — beyond that one waits, and an
   application opened thirty times a day must never make anyone wait.

   Carried by an attribute rather than a class: the same usage as the
   drop targets above, and it is laid in one line on any container.

   BACKWARDS AND NOT BOTH, AND HALF A SCREEN DEPENDS ON IT. An animation
   touching the transform property makes its element a CONTAINING BLOCK
   for everything it holds in position fixed — as long as it is in
   effect. The both fill mode leaves it in effect FOREVER once finished:
   the view container became the window of every fixed panel it carries,
   which then started scrolling with the page. The drawer tab one had to
   go and find at the bottom, the card of a case that did not appear:
   that was it.

   The forwards fill mode brought nothing here — the arrival image of
   sheetIn is exactly the natural state of the element. That leaves
   backwards, the only useful one: no flicker before the first step. */
[data-enters] { animation: sheetIn var(--motion-slow) var(--motion-ease) backwards; }

@media (prefers-reduced-motion: reduce) {
  [data-case] *, [data-case] { animation-duration: .01ms !important; animation-delay: 0ms !important; }
  [data-drop-mark], [data-lean], [data-row-seam], [data-wall-item] { transition: none !important; }
  /* WHERE THE TWO DURATIONS GO OUT — once for all those that go through
     the tokens. Everything written inline escapes this rule: that is why
     new durations do not belong there. */
  :root { --motion-fast: 0s; --motion-slow: 0s; }
  [data-enters] { animation: none !important; }
}

/* ============================================================
   THE PHONE
   ============================================================

   The binder was drawn for a desk. This block does not redraw it: it
   removes the few things which, on a hand-held screen, prevent reaching
   the rest.

   The layout does not go through here. It is in inline styles like all
   the rest of the project, and it is useViewport that decides it — a
   media query cannot tell React to render a bar rather than a rail. What
   remains here are the adjustments CSS is the ONLY one able to make.

   (No backtick in this whole block: it lives INSIDE a template string,
   and the first one would close it in the middle of a sentence. The trap
   sprang once more while writing these lines.) */

/* The scrolling gesture must not become a page reload, nor drag the
   whole window along when a list reaches its end. */
html, body { overscroll-behavior-y: contain; }

/* A finger drag on a grabbable object must not be read as scrolling.
   usePointerDrag lays the attribute at the moment it takes over, and not
   before: laying it from the start on every case would make the shelf
   impossible to scroll. */
[data-pointer-drag="1"] { touch-action: none; }

/* What is held with the finger must not, on top of that, select itself
   or open the iOS long-press menu. */
[data-pointer-drag="1"], html[data-dragging="1"] {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

@media (max-width: 639px) {
  /* THE HAND-DRAWN SCROLLBAR MAKES NO SENSE HERE. Eleven pixels wide on
     a window of three hundred and ninety, for a bar the system already
     slides away on its own and that no finger ever catches. */
  ::-webkit-scrollbar { width: 0; height: 0; }

  /* A field whose text is smaller than sixteen pixels triggers an
     automatic zoom on focus under iOS, and the page never returns to its
     size. That is the only reason for this rule — it is in no way a
     typographic preference. */
  input, select, textarea { font-size: max(16px, 1em); }

  /* The view column leaves room for the bottom bar, home indicator
     included. In CSS rather than inline: the bar exists only on the
     phone, and the column has no business knowing it exists. */
  [data-enters] { padding-bottom: calc(58px + var(--safe-bottom)); }
}

/* WHAT THE BROWSER DRAWS IN OUR STEAD.

   An open drop-down list, a checkbox, a scrollbar: those pieces are not
   painted by the page but by the browser, and it paints them LIGHT until
   told otherwise. On the five dark skins, a select list came out grey on
   a dark background — illegible, and out of reach of CSS since that menu
   is not in the document.

   color-scheme is the only handle we have on it. It reads from
   data-dark, which applySkin already writes, and it IS PASSED ON to
   descendants: the test bench, which shows fourteen skins at once on
   fragments, carries the same attribute and gets the same result without
   one more line. */
[data-dark="1"] { color-scheme: dark; }
[data-dark="0"] { color-scheme: light; }

/* L'ENCRE D'UN TAMPON, ET POURQUOI ELLE VIT ICI.

   (Aucun accent grave dans ce commentaire : il est DANS un littéral
   gabarit, et le premier fermerait la feuille de style au milieu d'une
   phrase. L'avertissement est déjà écrit plus haut ; il vient de mordre
   une fois de plus.)

   Un tampon s'imprime en multiply : c'est ce qui lui donne l'air d'avoir
   été absorbé par le papier au lieu d'être posé dessus, et c'est juste
   sur les douze peaux claires.

   Sur les cinq peaux sombres, multiply ne peut que NOIRCIR — et l'encre
   y est claire, puisqu'elle suit les jetons. Le cachet disparaissait
   donc exactement là où le fond était le plus soigné : sur le velours du
   comptoir, à peine un rectangle plus foncé.

   Ces trois valeurs vivent donc ici, comme le grain et les taches, et le
   même attribut les bascule. Elles sont lues en var() DANS des styles en
   ligne — un style en ligne bat toujours une feuille de style, donc une
   règle visant une classe n'aurait rien pu contre elles. */
:root { --stamp-blend: multiply; --stamp-ink: .78; --stamp-page: .62; }
[data-dark="1"] { --stamp-blend: normal; --stamp-ink: .95; --stamp-page: .8; }

/* WHERE color-scheme IS NOT ENOUGH. The entries of a list inherit the
   transparent background of their select, which the browser then
   resolves onto ITS OWN canvas and not onto the skin's card. So we give
   them an opaque background, taken from the tokens like all the rest. */
select option { background: ${C.card}; color: ${C.ink}; }

/* The blue of a ticked box is the browser's, and it goes with none of
   the fourteen skins. The red thread goes with them all. */
input[type="checkbox"], input[type="radio"] { accent-color: ${C.burgundy}; }

/* LAST RESORT FOR THE FIELDS NOBODY HAS DRESSED. An inline style always
   wins against this rule, which therefore only catches those that have
   none: those fell back on the browser black, invisible on a dark
   skin. */
input, select, textarea { color: ${C.ink}; }

input::placeholder, textarea::placeholder { color: ${alpha(C.inkFaded, 0.53)}; font-style: italic; }

/* the editable field has no native placeholder: we draw it */
[contenteditable][data-placeholder]:empty::before {
  content: attr(data-placeholder);
  color: ${alpha(C.inkFaded, 0.53)};
  font-style: italic;
  pointer-events: none;
}
`;

export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.055 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";
