/* ============================================================
   POSTER — the real one if we have it, the tinted emulsion otherwise.
   The grain and the torn edge stay over the image: a poster glued into a
   notebook, not a catalogue thumbnail.
   ============================================================ */
import React, { useEffect, useState } from "react";
import { F, GRAIN } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { tornClip } from "../../domain/seeded";
import { isIdbPoster, idbKeyOf } from "../../db";
import { POSTER_BASE, POSTER_THUMB } from "../../tmdb";
import type { Film } from "../../types";

interface PosterArtProps {
  film: Film;
  /** Counts only for the substitute emulsion; ignored if there is a poster. */
  height?: number;
  initials: string;
  clipSeed?: number;
  plain?: boolean;
  /**
   * Defer decoding the image. True everywhere many are shown at once;
   * false on an isolated card, which one wants to see straight away. By
   * default, the `plain` mode — the shelf — turns it on.
   */
  lazy?: boolean;
}

/* `height` counts only for the substitute emulsion, in landscape. A real
   poster is 2:3 portrait: forcing it into a band would reduce it to a
   slice. When there is one, the area therefore takes the poster's shape. */
/* `plain`: the same poster, but in a clean rectangle. On the shelf, the
   torn edge of a glued cut-out would fight with the case's arris; the
   card keeps the tear. All the rest — IndexedDB, fallback, grain — is
   shared, and must stay so. */
export const PosterArt = React.memo(function PosterArt({
  film,
  height = 0,
  initials,
  clipSeed = 0,
  plain = false,
  lazy = plain,
}: PosterArtProps) {
  const [broken, setBroken] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const hue = hueOf(film.id);

  // an "idb:" poster lives in IndexedDB: we take it out as an object URL
  // for as long as it is shown, and release it on leaving so as not to leak.
  useEffect(() => {
    if (!isIdbPoster(film.poster)) {
      setBlobUrl(null);
      return;
    }
    let url: string | null = null,
      alive = true;
    import("../../db")
      .then(({ getImage }) => getImage(idbKeyOf(film.poster)))
      .then((blob) => {
        if (!alive || !blob) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => setBroken(true));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [film.poster]);

  useEffect(() => {
    setBroken(false);
  }, [film.poster]);

  const src = broken ? null : isIdbPoster(film.poster) ? blobUrl : film.poster || null;
  /* A case is 96 px wide: loading the poster into it at 342 px means
     decoding three times more pixels than we show. TMDB serves the same
     image smaller, one only has to ask. */
  const smallSrc = plain && src ? src.replace(POSTER_BASE, POSTER_THUMB) : src;
  return (
    <div
      style={{
        overflow: "hidden",
        ...(plain
          ? // the case already sets the dimensions: the poster pours into them
            { position: "absolute", inset: 0, background: "#1c1712" }
          : {
              position: "relative",
              clipPath: tornClip(film.id, clipSeed),
              ...(src ? { aspectRatio: "2 / 3" } : { height }),
            }),
      }}
    >
      {src ? (
        <img
          src={smallSrc ?? undefined}
          alt=""
          onError={() => setBroken(true)}
          /* On the shelf, one poster per case: a hundred images to
             decode, to keep in memory and to rasterise. `lazy` decodes
             only what is on screen, `async` does not block the main
             thread — and it is that thread that must stay free to follow
             the mouse. */
          /* THE WALL LOADED EVERYTHING, AND IT WAS THE MOST EXPENSIVE.

             `plain` designated the shelf, and the rest — including the
             poster wall, which shows five hundred — decoded `eager`. The
             criterion was not the right one: what counts is not the shape
             of the cut-out but the NUMBER of images on screen. `lazy` now
             says so in so many words, and its default value keeps the
             previous behaviour everywhere else. */
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          // `contain`: a poster in an unusual format is shown whole,
          // never cropped — even if it leaves a border on the sides
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "saturate(0.88) contrast(1.04)",
          }}
        />
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(160deg, ${hue}, ${hue}dd 60%, #1c1712)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 30% 22%, rgba(255,240,210,0.28), transparent 62%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontSize: height > 170 ? 50 : 40,
                color: "#f3ead8cc",
                textShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}
            >
              {initials}
            </span>
          </div>
        </>
      )}
      {/* `mixBlendMode` forces the browser to recompose everything
          underneath on every repaint. On an isolated card that is
          painless; on a shelf of a hundred cases being dragged, it is
          what costs the most. At 96 px wide the blend does not show:
          the cases take the grain as a plain overlay. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRAIN,
          opacity: plain ? 0.22 : src ? 0.32 : 0.5,
          ...(plain ? null : { mixBlendMode: "overlay" }),
          pointerEvents: "none",
        }}
      />
    </div>
  );
});
