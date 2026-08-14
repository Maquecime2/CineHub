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
import { holdMedia, releaseMedia } from "../../services/media";
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
   *
   * IT ALSO DECIDES THE EXPENSIVE EFFECTS, see below: it is the only
   * prop that answers "how many of these are on screen at once", which
   * is the question those effects turn on.
   */
  lazy?: boolean;
  /**
   * How wide the poster is actually drawn, in CSS pixels. Only used to
   * tell the browser which size to fetch (`sizes`); with nothing, the
   * full-size image is asked for as before.
   */
  width?: number;
}

/* A hold that failed holds nothing, so there is nothing to release. It
   still has to be caught: an untouched rejection is an unhandled one. */
const ignore = (): void => {};

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
  width = 0,
}: PosterArtProps) {
  const [broken, setBroken] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const hue = hueOf(film.id);

  /* An "idb:" poster lives in IndexedDB. We ask the mirror to HOLD it —
     the object URL is shared and outlives this card, which is what makes
     a wall one can scroll back up: see `holdMedia`. What we owe in
     return is exactly one release per successful hold.

     The dynamic `import()` that used to be here split nothing —
     `services/media` is pulled in statically by the stills anyway — and
     only cost every poster an extra microtask before it could start. */
  useEffect(() => {
    if (!isIdbPoster(film.poster)) {
      setBlobUrl(null);
      return;
    }
    const key = idbKeyOf(film.poster);
    let alive = true;
    const wait = holdMedia(key);
    void wait.then((url) => {
      if (!alive) return;
      if (url) setBlobUrl(url);
      else setBroken(true);
    });
    /* Released THROUGH the same promise, never beside it: unmounting
       before the vault answers would otherwise release a hold that had
       not happened yet, and the count would never come back to zero. */
    return () => {
      alive = false;
      void wait.then((url) => {
        if (url) releaseMedia(key);
      }, ignore);
    };
  }, [film.poster]);

  useEffect(() => {
    setBroken(false);
  }, [film.poster]);

  const src = broken ? null : isIdbPoster(film.poster) ? blobUrl : film.poster || null;
  /* A case is 96 px wide: loading the poster into it at 342 px means
     decoding three times more pixels than we show. TMDB serves the same
     image smaller, one only has to ask. */
  const remote = !!src && src.includes(POSTER_BASE);
  const thumb = remote ? src!.replace(POSTER_BASE, POSTER_THUMB) : src;
  const smallSrc = plain ? thumb : src;
  /* AND THE WALL WAS ASKING FOR THE BIG ONE TOO, for the same reason the
     shelf used to: the substitution was tied to `plain`, which names the
     shelf and nothing else. But a card of a hundred and fifty pixels
     decodes just as many pixels too many as a case does.

     We do not choose for the browser, though — the wall's calibre is
     adjustable, and at "grand" on a dense screen the small one would be
     soft. `srcset` states the two sizes that exist, `sizes` states how
     wide we are actually drawing it, and the browser does the arithmetic
     with a screen density we do not have here. Without a stated width
     nothing is proposed, and the behaviour is the one from before. */
  const srcSet = remote && !plain && width ? `${thumb} 185w, ${src} 342w` : undefined;
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
          srcSet={srcSet}
          sizes={srcSet ? `${width}px` : undefined}
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
            /* THE TINT IS A MOMENT'S EFFECT, AND IT WAS ON EVERY CARD.
               A `filter` forces a compositing pass per image: on the
               fiche it costs nothing, on a wall of five hundred it is
               five hundred passes, redone at every repaint of the
               scroll. Same criterion as `loading` just below — what
               counts is the NUMBER on screen, which is what `lazy`
               says. */
            ...(lazy ? null : { filter: "saturate(0.88) contrast(1.04)" }),
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
          the cases take the grain as a plain overlay.

          AND THE WALL WAS NOT A CASE, SO IT KEPT THE BLEND. `plain`
          named the shelf; the poster wall, which shows five hundred at
          once, fell on the other side of the test and blended every one
          of them. The criterion is the same one the tint and `loading`
          now use — `lazy`, which is the project's word for "there are
          many of these on screen". The grain is merely laid on instead,
          a shade lighter to make up for the blend it no longer gets. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRAIN,
          opacity: lazy ? (src ? 0.22 : 0.42) : src ? 0.32 : 0.5,
          ...(lazy ? null : { mixBlendMode: "overlay" }),
          pointerEvents: "none",
        }}
      />
    </div>
  );
});
