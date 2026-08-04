/* ============================================================
   POLAROID / FICHE FILM
   ============================================================ */
import { C } from "../../theme/tokens";
import { tapeColor } from "../../theme/ink";
import { hash, tiltOf, usesPin, nudgeOf, pickFrom } from "../../domain/seeded";
import { PushPin, Tape, FileNumber } from "../atmosphere";
import { InkStars } from "../ui";
import { PosterArt } from "./PosterArt";
import type { Film } from "../../types";

export function FilmPolaroid({ film, onClick }: { film: Film; onClick: () => void }) {
  const tilt = tiltOf(film.id);
  const tape = tapeColor(film.id);
  const pinned = usesPin(film.id);
  const initials = film.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const nudge = nudgeOf(film.id);
  // l'ombre tombe du côté opposé à l'inclinaison — la photo n'est pas plaquée à plat
  const rest = `${Number(tilt) > 0 ? -3 : 3}px 7px 15px rgba(30,20,10,0.3), 0 1px 2px rgba(30,20,10,0.4)`;
  const lift = `${Number(tilt) > 0 ? -6 : 6}px 18px 30px rgba(30,20,10,0.38), 0 2px 3px rgba(30,20,10,0.3)`;

  return (
    <div style={{ breakInside: "avoid", marginBottom: 34, paddingTop: nudge }}>
      <button
        onClick={onClick}
        style={{
          all: "unset",
          cursor: "pointer",
          width: "100%",
          padding: "12px 12px 18px",
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
        {pinned ? (
          <PushPin
            color={pickFrom([C.burgundy, C.cobalt, C.moss], Math.abs(hash(film.id)))}
            style={{ top: -7, left: "50%", marginLeft: -7 }}
          />
        ) : (
          <Tape
            color={tape}
            rotate={Number(tilt) > 0 ? -8 : 8}
            style={{ top: -10, left: "50%", marginLeft: -35 }}
          />
        )}
        <PosterArt film={film} height={150} initials={initials} />
        <div style={{ paddingTop: 14, textAlign: "left" }}>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 700,
              fontSize: 18,
              color: C.ink,
              lineHeight: 1.15,
            }}
          >
            {film.title}
          </div>
          {/* la légende manuscrite, écrite au dos puis recopiée devant */}
          <div
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 17,
              color: C.inkFaded,
              marginTop: 2,
              transform: "rotate(-0.8deg)",
            }}
          >
            {film.year || "s.d."} · {film.director || "anonyme"}
          </div>
          {/* pas d'étoiles sur un film pas encore vu : rien à noter */}
          <div style={{ marginTop: 8 }}>
            {film.status === "watchlist" ? (
              <span
                style={{
                  fontFamily: "'Special Elite', monospace",
                  fontSize: 10,
                  color: C.cobalt,
                  letterSpacing: 1,
                }}
              >
                À VOIR
              </span>
            ) : (
              <InkStars value={film.rating || 0} size={12} />
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
            width: 22,
            height: 22,
            background: `linear-gradient(135deg, transparent 50%, ${C.paperDark} 50%, #cbb894 100%)`,
            boxShadow: "-1px -1px 2px rgba(30,20,10,0.18)",
          }}
        />
      </button>
    </div>
  );
}
