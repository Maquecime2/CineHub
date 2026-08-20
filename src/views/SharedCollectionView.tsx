/* ============================================================
   SOMEBODY ELSE'S COLLECTION
   ============================================================

   The first page of this project that is not yours. It opens from a
   received link, often in a browser where the binder has never set foot:
   nothing is loaded there, no account exists there, and nothing must be
   asked of it.

   IT DOES NOT SHOW A WALL, AND THAT IS A CHOICE. The wall here is a
   tool: one filters on it, sorts on it, files on it. At somebody else's,
   there is nothing to file — one looks. So the page is a contact sheet:
   posters, titles, ratings, and the one thing one actually wants to read
   at somebody else's — what they thought of it.

   WE DO NOT BORROW THEIR FILM LIBRARY FOR ALL THAT: nothing is written
   into the visitor's binder. A shared collection is looked at, it is not
   downloaded.
   ============================================================ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clapperboard, Star } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { PosterArt } from "../components/film/PosterArt";
import { collectionOf, ServerError, type SharedFilm } from "../services/server";
import { tiltOf } from "../domain/seeded";
import { Halftone, Marquee, Stamp, velvet } from "../components/atmosphere/hall";
import { STAMP_INK, stampLabel } from "../components/play/stamps";
import { initialsOf as initialesDe } from "../domain/film";

/* THE ADDRESS OF A SHARED COLLECTION.

   `#/chez/varda` — in the FRAGMENT, and not in the path. The binder is
   published as static pages: an unknown path there returns a 404 from
   the server before the slightest line of JavaScript runs, whereas a
   fragment never leaves the browser. That is what lets a link work
   without one byte of configuration on the host's side. */
export interface Address {
  pseudo: string;
  token: string | null;
}

export function readAddress(fragment: string = location.hash): Address | null {
  const m = /^#\/chez\/([a-z0-9-]{3,30})(?:\?jeton=([A-Za-z0-9_-]+))?$/.exec(fragment.trim());
  return m ? { pseudo: m[1]!, token: m[2] ?? null } : null;
}

export function SharedCollectionView({ address }: { address: Address }) {
  const { t } = useTranslation();
  const [films, setFilms] = useState<SharedFilm[] | null>(null);
  const [stamp, setStamp] = useState<string | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    collectionOf(address.pseudo, address.token)
      .then((r) => {
        if (!alive) return;
        setFilms(r.films);
        setStamp(r.stamp);
      })
      .catch((e) => {
        if (!alive) return;
        /* THE SERVER ANSWERS 404 FOR THREE REASONS and says no more —
           unknown account, closed collection, expired link. We take up
           that silence rather than invent an explanation that would have
           one chance in three of being right. */
        setSouci(
          (e as ServerError).code === 404 ? t("shared.noCollection") : t("shared.couldNotOpen")
        );
      });
    return () => {
      alive = false;
    };
  }, [address.pseudo, address.token]);

  return (
    <div style={{ minHeight: "100vh", padding: "34px 20px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* LE FRONTON D'UNE SALLE, et pas un en-tête de page.

            C'est très souvent le PREMIER écran qu'un inconnu voit du
            produit : quelqu'un envoie un lien, on l'ouvre, et on juge en
            trois secondes. Une ligne de titre sur du papier disait « une
            page web » ; un fronton dit « une salle », ce que le classeur
            est. Le reste de la vue — les affiches, le papier — n'a pas
            besoin d'en dire plus. */}
        <div style={{ ...velvet(C.burgundy), position: "relative", padding: "0 0 18px" }}>
          <Marquee />
          <Halftone />
          <div style={{ position: "relative", padding: "16px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <Clapperboard size={22} color={C.card} />
              <h1
                style={{
                  margin: 0,
                  fontFamily: F.title,
                  fontStyle: "italic",
                  fontWeight: 700,
                  fontSize: 38,
                  color: C.card,
                }}
              >
                {t("shared.heading", { pseudo: address.pseudo })}
              </h1>
              {stamp && (
                <Stamp text={t(stampLabel(stamp))} ink={STAMP_INK[stamp] ?? C.ochre} tilt={-6} />
              )}
            </div>
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 18,
                color: alpha(C.card, 0.8),
                marginTop: 4,
              }}
            >
              {films ? t("shared.count", { count: films.length }) : souci || t("shared.opening")}
            </div>
          </div>
        </div>
        <div style={{ height: 26 }} />

        {films && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: 22,
            }}
          >
            {films.map((f) => (
              <Poster key={f.id} film={f} />
            ))}
          </div>
        )}

        {/* The binder introduces itself, without selling itself:
            somebody arriving by a link does not know what this
            application is. */}
        <div
          style={{
            marginTop: 50,
            paddingTop: 16,
            borderTop: `1px dashed ${C.line}`,
            fontFamily: F.mono,
            fontSize: 9.5,
            letterSpacing: 1,
            color: alpha(C.inkFaded, 0.8),
          }}
        >
          CINÉ HUB — une vidéothèque qui vit chez soi.{" "}
          <a href={location.pathname} style={{ color: C.burgundy }}>
            {t("shared.openMine")}
          </a>
        </div>
      </div>
    </div>
  );
}

function Poster({ film }: { film: SharedFilm }) {
  const { t } = useTranslation();
  const noted = Number(film.rating) || 0;
  return (
    <figure style={{ margin: 0, transform: `rotate(${tiltOf(String(film.id))}deg)` }}>
      <div
        style={{
          background: C.card,
          padding: 7,
          border: `1px solid ${C.line}`,
          boxShadow: `2px 5px 14px ${alpha(C.ink, 0.22)}`,
        }}
      >
        {/* The poster takes the card as it comes: a TMDB address gets
            through, an image imported from a disk stays at its owner's —
            and `PosterArt` already knows how to draw in its stead. */}
        <PosterArt film={film as never} initials={initialesDe(String(film.title || ""))} />
        <figcaption style={{ padding: "8px 3px 2px" }}>
          <div style={{ fontFamily: F.title, fontSize: 14, color: C.ink, lineHeight: 1.25 }}>
            {String(film.title || "")}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 2 }}>
            {[film.year, film.director].filter(Boolean).join(" · ")}
          </div>
          {noted > 0 && (
            <div
              style={{ display: "flex", gap: 1, marginTop: 4 }}
              aria-label={t("common.ratingOutOf", { rating: noted })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={11}
                  color={C.burgundy}
                  fill={noted >= n ? C.burgundy : "none"}
                  strokeWidth={1.4}
                />
              ))}
            </div>
          )}
          {/* La review est la seule chose qu'on ait vraiment envie de
              lire chez quelqu'un d'autre. */}
          {film.review ? (
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 15,
                color: C.inkFaded,
                marginTop: 6,
                lineHeight: 1.35,
              }}
            >
              {String(film.review)}
            </div>
          ) : null}
        </figcaption>
      </div>
    </figure>
  );
}
