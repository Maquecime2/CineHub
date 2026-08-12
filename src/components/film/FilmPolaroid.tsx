/* ============================================================
   POLAROID / FILM CARD
   ============================================================

   All the dimensions were written by hand. They now go through a single
   factor, read from the wall's look (`views/library/wallLook`): a card is
   an object, it grows as one block.

   The look is OPTIONAL, and its absence means "as before": the card also
   serves elsewhere than on the wall (the discoveries), and those places
   asked for nothing. */
import { C, F } from "../../theme/tokens";
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
}: {
  film: Film;
  onClick: () => void;
  look?: WallLook;
}) {
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
    <div style={{ breakInside: "avoid", marginBottom: gapOf(look), paddingTop: nudge }}>
      <button
        onClick={onClick}
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
          {/* la légende manuscrite, écrite au dos puis recopiée devant */}
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
        {/* coin corné : un pli d'ombre en bas à droite */}
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
    </div>
  );
}
