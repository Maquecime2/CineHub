/* ============================================================
   Styles shared by several views. Anything belonging to a single
   component stays with it.
   ============================================================ */
import type { CSSProperties } from "react";
import { C, F, alpha } from "./tokens";

/* ============================================================
   WHAT A FINGER CAN REACH
   ============================================================

   The binder was drawn for a mouse, whose point is one pixel wide. A
   genre pill twenty-two pixels high is aimed at without thinking with a
   cursor; with a finger, whose contact is eight to ten millimetres
   across, it is missed one time in three — and on a row of pills spaced
   six pixels apart, missing means filtering something other than what
   you wanted.

   FORTY-FOUR PIXELS. That is Apple's value, taken up by criterion 2.5.5
   of the accessibility rules. It is not a comfort margin: it is the size
   below which the error rate goes up for good.

   WHY THIS IS NOT A STYLE SHEET. This whole project dresses in INLINE
   styles, and half its buttons begin with `all: unset` to erase the
   appearance the browser gives them. An inline declaration beats any CSS
   rule: a `(pointer: coarse)` media query set in the tokens would touch
   NONE of these pills. The only lever that reaches them is inline too,
   hence this object we spread about.

   THE QUESTION IS ASKED ONCE, ON LOAD, and not per component: a pointer
   does not become coarse along the way. That is also what lets constant
   style objects depend on it — they are read on import, well before any
   component has state. */
export const TAP = 44;

const coarse = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/** True under a finger. Read once, on import. */
export const COARSE = coarse();

/** To spread on a control too small for a finger. Empty with a mouse. */
export const tap: CSSProperties = COARSE
  ? {
      minHeight: TAP,
      /* `all: unset` makes the button inline: without this line the
         minimum height does not apply, and neither does the padding that
         centres the text. */
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    }
  : {};

/** The same for a square button — an icon alone, with no text. */
export const tapSquare: CSSProperties = COARSE ? { ...tap, minWidth: TAP } : {};

export const underlineInput: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  /* A field with four pixels of padding is twenty-eight high: it is the
     most-missed target in the whole application, and there is one at the
     head of almost every view. */
  padding: COARSE ? "12px 2px" : "4px 2px",
  /* Padding alone is not enough: several fields bring their body down to
     twelve or thirteen pixels, and then fall back below forty-four. The
     minimum height catches those. */
  minHeight: COARSE ? TAP : undefined,
  color: C.ink,
  fontFamily: F.body,
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

export const ruledTextarea: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${C.line}`,
  padding: COARSE ? "10px 2px" : "6px 2px",
  color: C.ink,
  fontFamily: F.hand,
  fontSize: 20,
  lineHeight: "30px",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
  backgroundImage: `repeating-linear-gradient(transparent, transparent 29px, ${alpha(C.line, 0.333)} 30px)`,
};
