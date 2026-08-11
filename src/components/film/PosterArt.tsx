/* ============================================================
   AFFICHE — la vraie si on en a une, l'émulsion virée sinon.
   Le grain et le bord déchiré restent par-dessus l'image : une
   affiche collée dans un carnet, pas une vignette de catalogue.
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
  /** Ne vaut que pour l'émulsion de substitution ; ignoré s'il y a une affiche. */
  height?: number;
  initials: string;
  clipSeed?: number;
  plain?: boolean;
  /**
   * Différer le décodage de l'image. Vrai partout où l'on en montre
   * beaucoup à la fois ; faux sur une fiche isolée, qu'on veut voir
   * tout de suite. Par défaut, le mode `plain` — l'étagère — l'active.
   */
  lazy?: boolean;
}

/* `height` ne vaut que pour l'émulsion de substitution, en paysage. Une vraie
   affiche est en portrait 2:3 : la forcer dans une bande la réduirait à une
   tranche. Quand il y en a une, la zone prend donc le format de l'affiche. */
/* `plain` : la même affiche, mais dans un rectangle franc. Sur l'étagère, le
   bord déchiré d'une découpe collée se battrait avec l'arête du boîtier ; la
   fiche, elle, garde le déchiré. Tout le reste — IndexedDB, repli, grain —
   est commun, et doit le rester. */
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

  // une affiche « idb: » vit dans IndexedDB : on la sort en URL d'objet le
  // temps de l'afficher, et on la relâche en partant pour ne pas fuiter.
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
  /* Un boîtier fait 96 px de large : y charger l'affiche en 342 px, c'est
     décoder trois fois plus de pixels que ce qu'on montre. TMDB sert la
     même image en plus petit, il suffit de le lui demander. */
  const smallSrc = plain && src ? src.replace(POSTER_BASE, POSTER_THUMB) : src;
  return (
    <div
      style={{
        overflow: "hidden",
        ...(plain
          ? // le boîtier impose déjà ses dimensions : l'affiche s'y coule
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
          /* Sur l'étagère, une affiche par boîtier : cent images à décoder,
             à garder en mémoire et à rastériser. `lazy` n'en décode que ce
             qui est à l'écran, `async` ne bloque pas le fil principal — et
             c'est ce fil qui doit rester libre pour suivre la souris. */
          /* LE MUR CHARGEAIT TOUT, ET C'ÉTAIT LE PLUS CHER.

             `plain` désignait l'étagère, et le reste — dont le mur
             d'affiches, qui en montre cinq cents — décodait en `eager`.
             Le critère n'était pas le bon : ce qui compte n'est pas la
             forme de la découpe mais le NOMBRE d'images à l'écran.
             `lazy` le dit maintenant en toutes lettres, et sa valeur par
             défaut garde le comportement d'avant partout ailleurs. */
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          // `contain` : une affiche au format inhabituel est montrée entière,
          // jamais rognée — quitte à laisser un liseré sur les côtés
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
      {/* `mixBlendMode` oblige le navigateur à recomposer tout ce qui est
          dessous à chaque repeint. Sur une fiche isolée c'est indolore ;
          sur un rayon de cent boîtiers qu'on fait glisser, c'est ce qui
          coûte le plus cher. À 96 px de large le fondu ne se voit pas :
          les boîtiers prennent le grain en simple superposition. */}
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
