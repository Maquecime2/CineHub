/* ============================================================
   POLAROID / FICHE FILM
   ============================================================

   Toutes les cotes étaient écrites en dur. Elles passent maintenant par
   un facteur unique, lu dans l'allure du mur (`views/library/wallLook`) :
   une fiche est un objet, elle grandit d'un bloc.

   L'allure est FACULTATIVE, et son absence vaut « comme avant » : la
   fiche sert aussi ailleurs qu'au mur (les découvertes), et ces
   endroits-là n'ont rien demandé. */
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
  const vus = watchCount(film);

  /* Le désordre reste SEMÉ par l'identifiant — on ne fait que le doser.
     À « rangé », le facteur vaut zéro et le mur est au cordeau sans
     qu'aucune fiche n'ait perdu son tirage : remonter d'un cran retrouve
     exactement le mur qu'on avait. */
  const mess = messOf(look);
  const tilt = Number(tiltOf(film.id)) * mess;
  const nudge = Math.round(nudgeOf(film.id) * mess * f);

  const tape = tapeColor(film.id);
  // « au hasard » consulte le tirage ; les autres modes tranchent pour tout le mur
  const hang = look?.hang || "auto";
  const pinned = hang === "auto" ? usesPin(film.id) : hang === "pin";
  const bare = hang === "none";

  const initials = initialsOf(film.title);
  // l'ombre tombe du côté opposé à l'inclinaison — la photo n'est pas plaquée à plat
  const rest = `${tilt > 0 ? -3 : 3}px 7px 15px rgba(30,20,10,0.3), 0 1px 2px rgba(30,20,10,0.4)`;
  const lift = `${tilt > 0 ? -6 : 6}px 18px 30px rgba(30,20,10,0.38), 0 2px 3px rgba(30,20,10,0.3)`;

  /* L'écart au voisin du dessous est le MÊME que celui du voisin de droite
     (`gapOf`) : la grille ne pose que l'horizontal, le vertical est ici, et
     un mur serré doit l'être dans les deux sens. */
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
        {/* La punaise et le ruban gardent leur taille : ce sont des objets
            posés SUR la fiche, pas des morceaux d'elle. Seul leur point
            d'accroche suit le bord, qui a bougé. */}
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
        <PosterArt film={film} height={px(150)} initials={initials} />
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
          {/* pas d'étoiles sur un film pas encore vu : rien à noter */}
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
            {/* LE COMPTE DES SÉANCES, à partir de deux seulement — un
                « ×1 » sous chaque vignette serait du bruit sur tout le mur.

                Il se pose JUSTE APRÈS les étoiles et non poussé à droite :
                le coin bas-droite appartient déjà au numéro de dossier et
                au pli d'ombre, qui l'auraient recouvert. */}
            {vus > 1 && (
              <span
                aria-label={`vu ${vus} fois`}
                /* Il tenait la taille du « À VOIR » — dix pixels, celle
                   d'une mention de service. Mais une fiche du mur se lit
                   de loin, et le compte y est une INFORMATION, pas une
                   étiquette : il se cale sur la légende manuscrite, à
                   côté d'étoiles qui font déjà douze. */
                style={{
                  fontFamily: F.mono,
                  fontSize: px(14),
                  color: C.inkFaded,
                  lineHeight: 1,
                }}
              >
                ×{vus}
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
