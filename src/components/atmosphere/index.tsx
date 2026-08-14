/* ============================================================
   ATMOSPHERE — grain, stains, texture

   Nothing here is interactive: these are the marks of use of a real
   object, laid behind and around the content. Gathered into one file
   because they are never used on their own — a page lays three or four
   of them at a time.
   ============================================================ */
import type { CSSProperties } from "react";
import { C, F, GRAIN, alpha } from "../../theme/tokens";
import { fileNoOf } from "../../domain/seeded";

/* THE PAPER ITSELF — fibres, grain, vignetting.

   The three layers do not disappear, they FADE: their opacity is
   multiplied by a setting from the skin. The Bauhaus sets zero and the
   paper no longer exists; a night skin keeps a third of the grain. A
   boolean would not have allowed the third.

   The fallback value is 1: with no skin applied — on the very first
   render — the paper is the one it has always been. */
export function PaperGrain() {
  return (
    <>
      {/* the paper's fibres — long, irregular streaks */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: "calc(0.5 * var(--atm-grain, 1))",
          mixBlendMode: "multiply",
          backgroundImage: `repeating-linear-gradient(94deg, ${alpha(C.line, 0.133)} 0 1px, transparent 1px 5px), repeating-linear-gradient(3deg, ${alpha(C.line, 0.094)} 0 1px, transparent 1px 9px)`,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: GRAIN,
          mixBlendMode: "multiply",
          opacity: "calc(0.7 * var(--atm-grain, 1))",
          zIndex: 1,
        }}
      />
      {/* vignetting — the edges of a page handled too often */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: "var(--atm-vignette, 1)",
          mixBlendMode: "multiply",
          background: `radial-gradient(ellipse at 50% 42%, transparent 42%, ${alpha(C.paperDark, 0.733)} 88%, #b9a67e88 100%)`,
        }}
      />
    </>
  );
}

/* THE STAINS — coffee ring, tape residue.

   They say "stationery" louder than any colour: the Bauhaus or a printed
   poster want none of them, and it is not their tint that can say so. So
   they too fade, through a setting from the skin. */
export function CoffeeRing({ style, rotate = 0 }: { style?: CSSProperties; rotate?: number }) {
  return (
    <svg
      width="150"
      height="150"
      viewBox="0 0 150 150"
      style={{
        position: "absolute",
        opacity: "calc(0.4 * var(--atm-stain, 1))",
        pointerEvents: "none",
        transform: `rotate(${rotate}deg)`,
        mixBlendMode: "multiply",
        ...style,
      }}
    >
      {/* an irregular ring: coffee never dries in a perfect circle */}
      <path
        d="M75 14 C 108 14 137 40 138 74 C 139 110 110 138 75 137 C 40 136 12 108 13 73 C 14 39 42 14 75 14 Z"
        fill="none"
        stroke={C.ochre}
        strokeWidth="3.2"
        opacity="0.55"
        strokeLinecap="round"
        strokeDasharray="140 9 60 4"
      />
      <circle cx="75" cy="75" r="52" fill="none" stroke={C.ochre} strokeWidth="1.1" opacity="0.3" />
      <circle cx="75" cy="75" r="58" fill={C.ochre} opacity="0.07" />
    </svg>
  );
}

/* torn tape residue — a lighter, shinier rectangle on the background */
export function TapeResidue({
  style,
  rotate = -18,
  w = 90,
}: {
  style?: CSSProperties;
  rotate?: number;
  w?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: 26,
        pointerEvents: "none",
        opacity: "calc(0.5 * var(--atm-stain, 1))",
        transform: `rotate(${rotate}deg)`,
        background: `linear-gradient(${alpha(C.card, 0.533)}, ${alpha(C.paperDark, 0.333)})`,
        clipPath: "polygon(4% 0,96% 6%,100% 96%,2% 100%)",
        ...style,
      }}
    />
  );
}

/* a freehand underline drawn under a title */
export function InkUnderline({
  width = 260,
  color = C.burgundy,
  style,
}: {
  width?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={width}
      height="14"
      viewBox={`0 0 ${width} 14`}
      style={{ display: "block", marginTop: -2, overflow: "visible", ...style }}
    >
      <path
        d={`M2 9 C ${width * 0.22} 3, ${width * 0.4} 12, ${width * 0.62} 6 S ${width * 0.88} 4, ${width - 3} 8`}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d={`M${width * 0.1} 12.5 C ${width * 0.4} 9, ${width * 0.6} 14, ${width * 0.86} 11`}
        fill="none"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

/* an inventory number stamped in a corner */
export function FileNumber({ id, style }: { id: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        fontFamily: F.mono,
        fontSize: 8.5,
        letterSpacing: 1.2,
        color: C.inkFaded,
        opacity: 0.55,
        transform: "rotate(-1.5deg)",
        pointerEvents: "none",
        ...style,
      }}
    >
      N° {fileNoOf(id)}
    </div>
  );
}

export function Tape({
  color,
  rotate = -4,
  width = 70,
  style,
}: {
  color: string;
  rotate?: number;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width,
        height: 22,
        background: color,
        opacity: 0.75,
        transform: `rotate(${rotate}deg)`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        backgroundImage:
          "repeating-linear-gradient(115deg, rgba(255,255,255,0.15) 0 3px, transparent 3px 7px)",
        clipPath: "polygon(2% 0,98% 0,100% 40%,97% 100%,3% 100%,0 60%)",
        ...style,
      }}
    />
  );
}

export function PushPin({ color = C.burgundy, style }: { color?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 15,
        height: 15,
        borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, #fff9, ${color} 65%)`,
        boxShadow: "0 3px 4px rgba(0,0,0,0.45)",
        zIndex: 3,
        ...style,
      }}
    />
  );
}

export function StampCorner({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 22,
        right: 34,
        color: C.burgundy,
        border: `2.5px solid ${C.burgundy}`,
        boxShadow: `inset 0 0 0 1px ${C.paper}, inset 0 0 0 3px ${alpha(C.burgundy, 0.533)}`,
        padding: "7px 13px",
        fontFamily: F.mono,
        fontSize: 11,
        letterSpacing: 1.8,
        transform: "rotate(-7deg)",
        /* Le grand cachet de page suit la même règle que le petit : un
           `multiply` sur une peau sombre l'éteint. Voir `tokens`. */
        opacity: "var(--stamp-page)" as never,
        pointerEvents: "none",
        borderRadius: 2,
        mixBlendMode: "var(--stamp-blend)" as never,
        zIndex: 3,
      }}
    >
      {text}
    </div>
  );
}
