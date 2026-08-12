/* ============================================================
   PRIMITIVES — the small pieces reused from one view to the next.
   ============================================================ */
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Star, KeyRound } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { openTmdbSettings } from "../../services/tmdbKey";

/** The rating, in ink stars. Clicking an already full star halves it. */
export function InkStars({
  value = 0,
  onChange,
  size = 15,
}: {
  value?: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const editable = !!onChange;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <span
            key={n}
            onClick={editable ? () => onChange(n === value ? n - 0.5 : n) : undefined}
            style={{
              cursor: editable ? "pointer" : "default",
              position: "relative",
              lineHeight: 0,
            }}
          >
            <Star
              size={size}
              color={C.burgundy}
              fill={filled ? C.burgundy : "none"}
              strokeWidth={1.4}
            />
            {half && (
              <span style={{ position: "absolute", inset: 0, width: "50%", overflow: "hidden" }}>
                <Star size={size} color={C.burgundy} fill={C.burgundy} strokeWidth={1.4} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================
   THE CARDSTOCK — the shared container of a card's blocks
   ============================================================

   Each block had made itself its own box over time: the catalogue card
   had a rule and a background, the filmstrip and the red thread had
   nothing at all, and the text fields floated on the paper. Set side by
   side in columns, it no longer read as one card but as four different
   pages laid together.

   One container, then. What it carries keeps ITS OWN register — a large
   section's italic title is not a field's label, and confusing the two
   would erase what tells "La pellicule" from "Mots-clés". We unify the
   box, not what is written on it. */
export function Cardstock({
  children,
  style,
  onFocusCapture,
  tour,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** A field's cardstock also serves to know where one is writing. */
  onFocusCapture?: () => void;
  /** Name of the anchor the guided tour comes looking for here. */
  tour?: string;
}) {
  return (
    <div
      onFocusCapture={onFocusCapture}
      data-tour={tour}
      style={{
        border: `1px solid ${C.line}`,
        background: C.paperDark,
        padding: "13px 15px 15px",
        transition: "border-color .2s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   A KEY IS MISSING — the lack, said out loud
   ============================================================

   With no TMDB key, eight screens went dark in silence: Discoveries
   discovered nothing, the evening drawer suggested nothing, the poster
   picker offered no poster. An empty view does not say "a setting is
   missing" — it says "there is nothing here", and you close it again.

   This cartouche takes the place the content would have taken, and it
   carries what is needed to get out of the lack: a button that opens the
   drawer. So we never return `null` for want of a key; we return this. */
export function NoKey({ what, style }: { what: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.line}`,
        background: alpha(C.ochre, 0.07),
        padding: "12px 14px",
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 6,
        ...style,
      }}
    >
      <KeyRound size={13} color={C.inkFaded} style={{ transform: "translateY(2px)" }} />
      <span style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
        Il manque une key TMDB pour {what}.
      </span>
      {/* TWO REMEDIES, AND THE SECOND ASKS FOR NONE. Since the server
          relays TMDB, an open account does away with the key entirely —
          it is even the first thing an account brings, instead of copying
          elsewhere what we already had. Say it HERE, where the lack makes
          itself felt, rather than in a screen nobody opens. */}
      <button
        onClick={openTmdbSettings}
        style={{
          all: "unset",
          cursor: "pointer",
          fontFamily: F.hand,
          fontSize: 14,
          color: C.burgundy,
          textDecoration: "underline",
        }}
      >
        La régler ici
      </button>
      <span style={{ fontFamily: F.hand, fontSize: 14, color: C.inkFaded }}>
        — ou ouvrez un compte, qui vous en dispense.
      </span>
    </div>
  );
}

/* A large section's title: the icon, the name in pen, the rule running
   to the end, and room to set a button at the edge. It was the
   filmstrip's heading; the red thread had an almost identical one, give
   or take a rule. Only one now. */
export function SectionTitle({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
      {icon}
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 21,
          color: C.ink,
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      <div
        style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, transform: "translateY(-4px)" }}
      />
      {action}
    </div>
  );
}

/** The line of guidance under a section title, in a free hand. */
export function Guideline({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, margin: "0 0 12px" }}>
      {children}
    </div>
  );
}

/** A field's label, typed on a machine. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 10.5,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        color: C.inkFaded,
        marginBottom: 5,
      }}
    >
      {children}
    </div>
  );
}
/* A field that reads as a comma-separated list.

   Naively, we rendered `value={list.join(", ")}` and returned the split
   on every keystroke. But typing the comma produces a last empty piece,
   which the split throws away: the `join` immediately recomposed the same
   string WITHOUT the comma, and the caret moved back one notch. Opening a
   second genre became impossible.

   So we keep the TEXT as it is typed for as long as the field is alive,
   and only return the list split off to the side. The string is only
   recomposed from the list when that list changes elsewhere (TMDB filling
   the card in, a form being reset). */
export function CommaInput({
  value,
  onChange,
  style,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [seen, setSeen] = useState(joined);
  if (joined !== seen) {
    setSeen(joined);
    setText(joined);
  }
  return (
    <input
      style={style}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const list = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setSeen(list.join(", "));
        onChange(list);
      }}
      onBlur={() => setText(value.join(", "))}
    />
  );
}

export { Tally } from "./Tally";
export { Confirmation } from "./Confirmation";
export type { ConfirmRequest } from "./Confirmation";
