/* ============================================================
   THE HALL — the objects one handles before the screening
   ============================================================

   The binder is an archivist's notebook. Its shared side — the quizzes,
   the challenges, the counter — is THE FOYER OF A CINEMA: the same
   paper, the same ink, the same board, but other objects. A ticket, a
   display case, a bill posted on the glass, a book of stubs.

   That is not decoration for its own sake. Every screen over there has
   to be able to answer "what am I handling", and a screen that cannot is
   a screen that is not finished. These pieces are the answers.

   WHY HERE AND NOT IN THE VIEWS. `atmosphere/index` already gathers the
   marks of use — grain, coffee, tape, pins, the stamp corner. These are
   of the same kind and obey the same rule: never interactive, laid
   behind and around what one reads. Kept in a second file only because
   the foyer is a place, and a place is worth a heading of its own; both
   are imported side by side without anyone having to choose.

   THE FOUR RULES THEY ALL OBEY:

   - NOT ONE COLOUR OUTSIDE `C`, not one duration outside the motion
     tokens. Fourteen skins rewrite the first, five of them dark; the
     reduced-motion block cancels the second IN A SINGLE PLACE, and a
     duration written by hand escapes it for good.
   - AN EMBEDDED SVG DOES NOT RESOLVE A `var()` — `surfaces` learnt it
     the hard way. So anything tinted here is built with CSS gradients,
     which do read the tokens; the SVG route is kept for the noises,
     which are black and need no ink.
   - THE COSTLY EFFECTS BELONG TO MOMENTS, NOT TO LISTS. `Halftone` and
     `velvet` are laid ONCE on a screen, in the background. Putting
     either on the rows of a leaderboard of fifty would repaint fifty
     blended layers on every scroll.
   - THE DISORDER IS SOWN. Anything that leans takes its angle from
     `seeded`, never from a draw: the same ticket must lean the same way
     tomorrow.
   ============================================================ */
import type { CSSProperties, ReactNode } from "react";
import { C, F, alpha } from "../../theme/tokens";
import { noise, svg, svgUrl } from "../../theme/surfaces";

/* ------------------------------------------------------------
   THE PERFORATION — what film stock has, and paper borrows
   ------------------------------------------------------------

   The skins file has promised these since its first line, in the
   sentence that says a contact sheet has its perforations, and nobody
   had ever drawn them. Here they are, in two forms, and the difference
   between them matters.

   `perforated` PAINTS holes: a row of paper-coloured discs over an ink
   strip. It is cheap, it composes with anything behind it, and it is
   what one wants along the edge of a card.

   `punched` CUTS them, through `mask-image` — the one CSS property this
   project had never used. The hole is then a real hole: what lies
   behind shows through it. That is the only way a tear line reads as a
   tear line rather than as a drawn dotted rule, and it is the reason a
   ticket stub looks detachable. It costs a compositing layer, so it is
   reserved for the one line per object that needs it. */

/** A strip of painted holes. `axis` is the direction the strip runs in. */
export function perforated(
  axis: "x" | "y",
  {
    pitch = 13,
    radius = 3,
    hole = C.paper,
    ink = "transparent",
  }: { pitch?: number; radius?: number; hole?: string; ink?: string } = {}
): CSSProperties {
  return {
    background: ink,
    backgroundImage: `radial-gradient(circle at 50% 50%, ${hole} 0 ${radius}px, transparent ${radius + 0.6}px)`,
    backgroundSize: axis === "y" ? `100% ${pitch}px` : `${pitch}px 100%`,
    backgroundRepeat: axis === "y" ? "repeat-y" : "repeat-x",
  };
}

/** A line of real holes, cut out of whatever carries it. */
export function punched(
  axis: "x" | "y",
  { pitch = 11, radius = 2.6 }: { pitch?: number; radius?: number } = {}
): CSSProperties {
  /* Black keeps, transparent cuts. The mask repeats along the axis and
     covers the whole of the other one, so a single declaration serves a
     line of any length. */
  const mask = `radial-gradient(circle at 50% 50%, transparent 0 ${radius}px, #000 ${radius + 0.5}px)`;
  const size = axis === "y" ? `100% ${pitch}px` : `${pitch}px 100%`;
  return {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: size,
    WebkitMaskSize: size,
    maskRepeat: axis === "y" ? "repeat-y" : "repeat-x",
    WebkitMaskRepeat: axis === "y" ? "repeat-y" : "repeat-x",
  } as CSSProperties;
}

/* ------------------------------------------------------------
   THE TICKET — a stub, a tear line, a counterfoil
   ------------------------------------------------------------

   The object the whole counter is built on. What one has earned is
   written on the left, what one may spend on the right, and the line
   between them is punched rather than drawn: a ticket one could not
   imagine tearing would only be a rectangle with two numbers in it.

   The notch at each end of the tear line is what makes the eye read
   "detachable" before it has read a single word — two half-discs of the
   page's own colour, bitten out of the card. */
export function Ticket({
  stub,
  counterfoil,
  tilt = 0,
  style,
}: {
  stub: ReactNode;
  counterfoil: ReactNode;
  /** Already sown by the caller, from `seeded`. */
  tilt?: number;
  style?: CSSProperties;
}) {
  const notch: CSSProperties = {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: "50%",
    background: C.paper,
    boxShadow: `inset 0 0 0 1px ${alpha(C.ink, 0.12)}`,
    left: "50%",
    marginLeft: -6.5,
    zIndex: 2,
  };
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        background: `linear-gradient(158deg, ${C.card}, ${C.paperDark})`,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 3px 8px rgba(30,20,10,0.18)",
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        ...style,
      }}
    >
      <div style={{ flex: 1, padding: "12px 16px", minWidth: 0 }}>{stub}</div>

      {/* THE TEAR LINE. A strip one pixel wide, its holes really cut, so
          the card shows through them instead of a paint of the same
          colour — which would go wrong under the first dark skin. */}
      <div
        style={{
          width: 1,
          flexShrink: 0,
          background: alpha(C.ink, 0.45),
          ...punched("y"),
        }}
      />
      <div style={{ ...notch, top: -7 }} />
      <div style={{ ...notch, bottom: -7 }} />

      <div style={{ flex: 1, padding: "12px 16px", minWidth: 0 }}>{counterfoil}</div>
    </div>
  );
}

/* ------------------------------------------------------------
   THE HALFTONE — what tells a print from a render
   ------------------------------------------------------------

   A grid of dots in multiply, very faint. It is laid over a background,
   never over text, and it is the cheapest thing on this page that makes
   a surface look PRINTED — a poster on a board, a bill on a glass.

   Its opacity follows the skin's own dosage of stains: the Bauhaus and
   the printed-poster skins want no ageing, and it is not the tint of the
   dots that could tell them so. */
export function Halftone({
  ink = C.ink,
  size = 4,
  style,
}: {
  ink?: string;
  /** The pitch of the grid. Below three it turns to a flat grey. */
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "multiply",
        opacity: "calc(0.5 * var(--atm-grain, 1))",
        backgroundImage: `radial-gradient(circle at 50% 50%, ${alpha(ink, 0.5)} 0 0.8px, transparent 1.1px)`,
        backgroundSize: `${size}px ${size}px`,
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------
   THE STAPLE — two teeth of metal, and the shadow they cast
   ------------------------------------------------------------
   What holds a folded programme together. Drawn with a border and a
   shadow rather than an image: at nine pixels across, an SVG would cost
   a request's worth of markup to say what two rules already say. */
export function Staple({ rotate = -22, style }: { rotate?: number; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        width: 11,
        height: 3,
        background: alpha(C.slate, 0.85),
        boxShadow: `0 3px 0 -1px ${alpha(C.slate, 0.7)}, 0 1px 2px rgba(0,0,0,0.35)`,
        transform: `rotate(${rotate}deg)`,
        pointerEvents: "none",
        zIndex: 3,
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------
   THE FOLD — a sheet that has been in a pocket
   ------------------------------------------------------------
   A crease is not a line: it is a narrow band lit on one side and dark
   on the other, because the paper no longer lies flat there. Drawn as
   such, in three stops of a gradient. */
export function Fold({
  at = "33%",
  style,
}: {
  /** Where the crease falls across the sheet. */
  at?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: at,
        width: 3,
        marginLeft: -1.5,
        pointerEvents: "none",
        background: `linear-gradient(90deg, ${alpha(C.ink, 0.09)}, ${alpha(C.card, 0.85)} 55%, ${alpha(C.ink, 0.05)})`,
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------
   THE FRONT OF HOUSE — the bulbs above the box office
   ------------------------------------------------------------

   A row of lamps. Dark at rest, and it stays that way: what makes it
   worth having is that it lights up ONCE, when something has been
   earned, and goes out again. A strip of bulbs chasing each other behind
   a page one is reading would be a fairground.

   The travelling light is a background moved along, so a single
   composited layer carries it. Its duration is a multiple of the slow
   motion token — reduced motion brings it to zero with everything else,
   and the row simply stays lit for nobody. */
export function Marquee({ lit, style }: { lit?: boolean; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        height: 9,
        overflow: "hidden",
        backgroundImage: [
          `radial-gradient(circle at 6px 50%, ${alpha(C.ochre, lit ? 0.95 : 0.35)} 0 2.4px, transparent 3px)`,
          `radial-gradient(circle at 6px 50%, ${alpha(C.ochre, 0.55)} 0 4.5px, transparent 6px)`,
        ].join(","),
        backgroundSize: "12px 100%, 12px 100%",
        backgroundRepeat: "repeat-x",
        animation: lit ? "runLights calc(var(--motion-slow) * 4) var(--motion-ease) 1" : undefined,
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------
   THE VELVET — the ground a display case is set against
   ------------------------------------------------------------

   Not a colour: a recipe, in the manner of the skins' page backgrounds.
   A recess in the paper, lit from above, with a fine noise so it does
   not read as a flat panel of paint.

   IL ÉTAIT EN VELOURS PRUNE, ET IL TRANCHAIT. `C.plum` est bien un
   jeton, donc il suivait chaque peau — mais un accent SATURÉ sur une
   grande surface reste un accent hors de sa place, quelle que soit la
   peau : les dix-sept en faisaient une tache. Une teinte d'accent se
   porte en petit ; une surface se porte en papier.

   Il est donc creusé dans le papier plutôt que tendu d'étoffe. Le
   présentoir se lit toujours comme un creux — c'est l'ombre interne qui
   le dit, pas la couleur — et il ne se bat plus avec ce qu'on pose
   dessus. Le tint reste réglable : la collection partagée s'en sert en
   bordeaux, sur une bande étroite où l'accent est à sa place.

   It returns a style and not a component because it is a GROUND — it is
   spread onto the thing it belongs to, and a wrapping element would put
   a box between a section and its own background.

   The noise is black and needs no ink, which is what lets it go through
   an embedded SVG at all. */
export function velvet(tint: string = C.paperDark): CSSProperties {
  return {
    backgroundColor: tint,
    backgroundImage: [
      `radial-gradient(ellipse at 50% -20%, ${alpha(C.card, 0.35)}, transparent 62%)`,
      `linear-gradient(170deg, ${alpha(C.ink, 0.04)}, ${alpha(C.ink, 0.17)})`,
      svgUrl(svg(180, 180, noise("velvet-n", "0.9", 2, 0.04))),
    ].join(","),
    /* The inner vignette of the constellation's frame: it is what closes
       a surface without drawing a border around it. */
    boxShadow: "inset 0 0 40px rgba(20,14,8,0.2)",
  };
}

/* ------------------------------------------------------------
   THE GLASS — what stands between the goods and the hand
   ------------------------------------------------------------
   A single oblique highlight, laid over a display case. Almost nothing,
   and the case reads as closed. */
export const glass: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background: `linear-gradient(104deg, ${alpha(C.card, 0.16)} 0 22%, transparent 34% 66%, ${alpha(C.card, 0.08)} 78%)`,
};

/* ------------------------------------------------------------
   THE CONTROLLER'S STAMP — the mark somebody wears
   ------------------------------------------------------------

   `StampCorner` next door stamps a PAGE — big, askew, across a corner.
   This one stamps a NAME, in a line of text, and the difference in scale
   is the whole of it: at eleven pixels the double inset border of the
   other turns to mud, so the ring is single and the letters are what one
   reads.

   It falls when it appears — a stamp is brought down flat and settles —
   and the fall is cancelled with all the rest for whoever asked for
   stillness. */
export function Stamp({
  text,
  ink = C.burgundy,
  tilt = -6,
  title,
}: {
  text: string;
  ink?: string;
  tilt?: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={
        {
          display: "inline-block",
          padding: "1px 5px",
          border: `1.5px solid ${ink}`,
          borderRadius: 2,
          color: ink,
          fontFamily: F.mono,
          fontSize: 8.5,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          verticalAlign: "middle",
          /* Les deux valeurs viennent des jetons : `multiply` sur du
             papier clair, rien du tout sur une peau sombre — où il ne
             pourrait que noircir une encre claire. Voir `tokens`. */
          mixBlendMode: "var(--stamp-blend)" as never,
          opacity: "var(--stamp-ink)" as never,
          "--stamp-tilt": `${tilt}deg`,
          "--stamp-rest": "var(--stamp-ink)",
          transform: `rotate(${tilt}deg)`,
          animation: "stampDown var(--motion-slow) var(--motion-ease) backwards",
        } as CSSProperties
      }
    >
      {text}
    </span>
  );
}

/* What a gain says, on its way out: a figure in a free hand that rises
   off the counter and is gone. It is the only feedback of the kind in
   the project, and it is deliberately not a toast — a notebook does not
   pop things up in a corner, it writes on the page where the thing
   happened. */
export function Gain({ amount, style }: { amount: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        fontFamily: F.hand,
        fontSize: 22,
        color: C.ochre,
        pointerEvents: "none",
        animation: "riseAway calc(var(--motion-slow) * 3) var(--motion-ease) forwards",
        ...style,
      }}
    >
      +{amount}
    </span>
  );
}
