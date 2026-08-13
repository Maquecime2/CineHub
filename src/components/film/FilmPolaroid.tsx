/* ============================================================
   POLAROID / FILM CARD
   ============================================================

   All the dimensions were written by hand. They now go through a single
   factor, read from the wall's look (`views/library/wallLook`): a card is
   an object, it grows as one block.

   The look is OPTIONAL, and its absence means "as before": the card also
   serves elsewhere than on the wall (the discoveries), and those places
   asked for nothing. */
import { useRef, useState, type ReactNode } from "react";
import { ListPlus, Check } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { tapeColor } from "../../theme/ink";
import { hash, tiltOf, usesPin, nudgeOf, pickFrom } from "../../domain/seeded";
import { watchCount, initialsOf } from "../../domain/film";
import { PushPin, Tape, FileNumber } from "../atmosphere";
import { InkStars } from "../ui";
import { PosterArt } from "./PosterArt";
import {
  NEUTRAL_WALL_LOOK,
  scaleOf,
  messOf,
  gapOf,
  type WallLook,
} from "../../views/library/wallLook";
import type { Film } from "../../types";

export function FilmPolaroid({
  film,
  onClick,
  look = NEUTRAL_WALL_LOOK,
  onFile,
  fileLabel,
  filing,
  selecting = false,
  selected = false,
}: {
  film: Film;
  onClick: () => void;
  look?: WallLook;
  /**
   * Opens the filing panel for this card. Absent, no badge appears — the
   * card also serves where there is nothing to file into (Discoveries).
   */
  onFile?: () => void;
  fileLabel?: string;
  /** The panel itself, when this is the card whose panel is open. */
  filing?: ReactNode;
  /** The wall is choosing several films: the card wears a mark. */
  selecting?: boolean;
  selected?: boolean;
}) {
  /* THE BADGE SHOWS ITSELF WHEN THE HAND IS NEAR, and stays out of the
     way otherwise: forty cards each wearing a permanent button would
     make a wall of buttons, which is not a wall of films. Focus counts
     as being near — a badge reachable only by mouse is a badge half the
     people never get. */
  const [near, setNear] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* On a touchscreen there is no hovering, so the badge answers to a
     LONG PRESS instead — the gesture that already means "and what else
     can this do?" everywhere else on a telephone. */
  const holdStart = () => {
    if (!onFile) return;
    press.current = setTimeout(() => {
      press.current = null;
      setNear(true);
      onFile();
    }, 500);
  };
  const holdEnd = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };

  const f = scaleOf(look);
  const px = (n: number) => Math.round(n * f);
  const seenFilms = watchCount(film);

  /* The disorder stays SOWN from the identifier — we only dose it. At
     "tidy", the factor is zero and the wall is dead straight without any
     card having lost its draw: going up one notch finds again exactly the
     wall one had. */
  const mess = messOf(look);
  const tilt = Number(tiltOf(film.id)) * mess;
  const nudge = Math.round(nudgeOf(film.id) * mess * f);

  const tape = tapeColor(film.id);
  // "at random" consults the draw; the other modes decide for the whole wall
  const hang = look?.hang || "auto";
  const pinned = hang === "auto" ? usesPin(film.id) : hang === "pin";
  const bare = hang === "none";

  const initials = initialsOf(film.title);
  // the shadow falls opposite the tilt — the photo is not pressed flat
  const rest = `${tilt > 0 ? -3 : 3}px 7px 15px rgba(30,20,10,0.3), 0 1px 2px rgba(30,20,10,0.4)`;
  const lift = `${tilt > 0 ? -6 : 6}px 18px 30px rgba(30,20,10,0.38), 0 2px 3px rgba(30,20,10,0.3)`;

  /* The gap to the neighbour below is the SAME as the one to the right
     (`gapOf`): the grid only sets the horizontal, the vertical is here, and
     a tight wall must be tight both ways. */
  return (
    <div
      style={{
        breakInside: "avoid",
        marginBottom: gapOf(look),
        paddingTop: nudge,
        /* The badge and the panel hang from HERE and not from the button
           below: a button inside a button is not valid, and the browser
           settles it by dropping one of the two. */
        position: "relative",
      }}
      onMouseEnter={() => setNear(true)}
      onMouseLeave={() => setNear(false)}
      onFocus={() => setNear(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setNear(false);
      }}
      onTouchStart={holdStart}
      onTouchEnd={holdEnd}
      onTouchMove={holdEnd}
      onTouchCancel={holdEnd}
    >
      <button
        onClick={onClick}
        aria-pressed={selecting ? selected : undefined}
        style={{
          all: "unset",
          cursor: "pointer",
          width: "100%",
          padding: `${px(12)}px ${px(12)}px ${px(18)}px`,
          position: "relative",
          background: `linear-gradient(158deg, #FBF6E9, ${C.card} 55%, ${C.paperDark})`,
          boxShadow: rest,
          transform: `rotate(${tilt}deg)`,
          display: "block",
          transition: "transform .25s cubic-bezier(.2,.8,.3,1), box-shadow .25s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "rotate(0deg) translateY(-7px) scale(1.035)";
          e.currentTarget.style.boxShadow = lift;
          e.currentTarget.style.zIndex = "5";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = `rotate(${tilt}deg)`;
          e.currentTarget.style.boxShadow = rest;
          e.currentTarget.style.zIndex = "auto";
        }}
      >
        {/* The pin and the tape keep their size: they are objects laid ON
            the card, not pieces of it. Only their anchor point follows
            the edge, which has moved. */}
        {bare ? null : pinned ? (
          <PushPin
            color={pickFrom([C.burgundy, C.cobalt, C.moss], Math.abs(hash(film.id)))}
            style={{ top: -7, left: "50%", marginLeft: -7 }}
          />
        ) : (
          <Tape
            color={tape}
            rotate={tilt > 0 ? -8 : 8}
            style={{ top: -10, left: "50%", marginLeft: -35 }}
          />
        )}
        {/* `lazy`: a card rarely appears alone — the wall lines up five
            hundred of them, and Discoveries forty. */}
        <PosterArt film={film} height={px(150)} initials={initials} lazy />
        <div style={{ paddingTop: px(14), textAlign: "left" }}>
          <div
            style={{
              fontFamily: F.title,
              fontWeight: 700,
              fontSize: px(18),
              color: C.ink,
              lineHeight: 1.15,
            }}
          >
            {film.title}
          </div>
          {/* the handwritten caption, written on the back then copied out front */}
          <div
            style={{
              fontFamily: F.hand,
              fontSize: px(17),
              color: C.inkFaded,
              marginTop: 2,
              transform: "rotate(-0.8deg)",
            }}
          >
            {film.year || "s.d."} · {film.director || "anonyme"}
          </div>
          {/* no stars on a film not yet seen: nothing to rate */}
          <div style={{ marginTop: px(8), display: "flex", alignItems: "center", gap: px(6) }}>
            {film.status === "watchlist" ? (
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: px(10),
                  color: C.cobalt,
                  letterSpacing: 1,
                }}
              >
                À VOIR
              </span>
            ) : (
              <InkStars value={film.rating || 0} size={px(12)} />
            )}
            {/* THE COUNT OF SCREENINGS, from two only — a "×1" under
                every thumbnail would be noise across the whole wall.

                It is laid JUST AFTER the stars and not pushed to the
                right: the bottom-right corner already belongs to the
                folder number and the shadow fold, which would have
                covered it. */}
            {seenFilms > 1 && (
              <span
                aria-label={`vu ${seenFilms} fois`}
                /* It used to take the size of the "TO WATCH" — ten
                   pixels, that of a service mention. But a wall card is
                   read from afar, and the count is INFORMATION there, not
                   a label: it lines up on the handwritten caption, beside
                   stars that already make twelve. */
                style={{
                  fontFamily: F.mono,
                  fontSize: px(14),
                  color: C.inkFaded,
                  lineHeight: 1,
                }}
              >
                ×{seenFilms}
              </span>
            )}
          </div>
        </div>
        <FileNumber id={film.id} style={{ bottom: 6, right: 10 }} />
        {/* a dog-eared corner: a fold of shadow bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: px(22),
            height: px(22),
            background: `linear-gradient(135deg, transparent 50%, ${C.paperDark} 50%, #cbb894 100%)`,
            boxShadow: "-1px -1px 2px rgba(30,20,10,0.18)",
          }}
        />
      </button>

      {/* THE MARK OF A CHOSEN CARD. It is laid on the corner rather than
          dimming the whole card: one chooses films by looking at them,
          and a wall of half-erased posters is a wall one can no longer
          read. */}
      {selecting && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: nudge + 4,
            left: 4,
            width: 22,
            height: 22,
            display: "grid",
            placeItems: "center",
            background: selected ? C.burgundy : alpha(C.card, 0.9),
            border: `1px solid ${selected ? C.burgundy : C.line}`,
            boxShadow: `0 1px 3px ${alpha(C.ink, 0.3)}`,
            pointerEvents: "none",
          }}
        >
          {selected && <Check size={13} color={C.card} />}
        </div>
      )}

      {/* THE BADGE THAT FILES. Not inside the card's button, and it stops
          the click going through: touching it must open the choosing of a
          list, never the film's card underneath. */}
      {onFile && !selecting && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onFile();
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          aria-label={fileLabel}
          title={fileLabel}
          style={{
            all: "unset",
            ...tap,
            position: "absolute",
            top: nudge + 4,
            right: 4,
            zIndex: 6,
            cursor: "pointer",
            padding: 5,
            color: C.card,
            background: C.moss,
            boxShadow: `0 1px 4px ${alpha(C.ink, 0.35)}`,
            opacity: near || filing ? 1 : 0,
            transition: "opacity var(--motion-fast) var(--motion-ease)",
          }}
        >
          <ListPlus size={13} />
        </button>
      )}

      {/* ANCHORED TO ITS BUTTON, THEREFORE IT STAYS IN THE COLUMN.
          `Layer` is the rule for anything `fixed` (see CLAUDE.md); a menu
          hanging from the thing that opened it is the stated exception —
          taking it out of the column would break the anchoring it exists
          for. */}
      {filing && (
        <div
          style={{
            position: "absolute",
            top: nudge + 30,
            right: 0,
            zIndex: 7,
            padding: "10px 12px 12px",
            background: C.paper,
            border: `1px solid ${C.line}`,
            boxShadow: `0 8px 22px ${alpha(C.ink, 0.3)}`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {filing}
        </div>
      )}
    </div>
  );
}
