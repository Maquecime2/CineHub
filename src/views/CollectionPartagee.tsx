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
import { Clapperboard, Star } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { PosterArt } from "../components/film/PosterArt";
import { collectionOf, ServerError, type SharedFilm } from "../services/server";
import { tiltOf } from "../domain/seeded";
import { initialsOf as initialesDe } from "../domain/film";

/* THE ADDRESS OF A SHARED COLLECTION.

   `#/chez/varda` — in the FRAGMENT, and not in the path. The binder is
   published as static pages: an unknown path there returns a 404 from
   the server before the slightest line of JavaScript runs, whereas a
   fragment never leaves the browser. That is what lets a link work
   without one byte of configuration on the host's side. */
export interface Address {
  pseudo: string;
  jeton: string | null;
}

export function readAddress(fragment: string = location.hash): Address | null {
  const m = /^#\/chez\/([a-z0-9-]{3,30})(?:\?jeton=([A-Za-z0-9_-]+))?$/.exec(fragment.trim());
  return m ? { pseudo: m[1]!, jeton: m[2] ?? null } : null;
}

export function CollectionPartagee({ address }: { address: Address }) {
  const [films, setFilms] = useState<SharedFilm[] | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    collectionOf(address.pseudo, address.jeton)
      .then((r) => vivant && setFilms(r.films))
      .catch((e) => {
        if (!vivant) return;
        /* THE SERVER ANSWERS 404 FOR THREE REASONS and says no more —
           unknown account, closed collection, expired link. We take up
           that silence rather than invent an explanation that would have
           one chance in three of being right. */
        setSouci(
          (e as ServerError).code === 404
            ? "Pas de collection à cette adresse. Le lien a peut-être été refermé."
            : "Cette collection n'a pas pu être ouverte."
        );
      });
    return () => {
      vivant = false;
    };
  }, [address.pseudo, address.jeton]);

  return (
    <div style={{ minHeight: "100vh", padding: "34px 20px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <Clapperboard size={22} color={C.burgundy} />
          <h1
            style={{
              margin: 0,
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 38,
              color: C.ink,
            }}
          >
            La vidéothèque de {address.pseudo}
          </h1>
        </div>
        <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, margin: "4px 0 26px" }}>
          {films
            ? `${films.length} film${films.length > 1 ? "s" : ""} — regardés, notés, rangés par quelqu'un d'autre.`
            : souci || "Ouverture…"}
        </div>

        {films && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
              gap: 22,
            }}
          >
            {films.map((f) => (
              <Affiche key={f.id} film={f} />
            ))}
          </div>
        )}

        {/* Le classeur se présente, sans se vendre : quelqu'un qui arrive
            par un lien ne sait pas ce qu'est cette application. */}
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
            OUVRIR LA MIENNE
          </a>
        </div>
      </div>
    </div>
  );
}

function Affiche({ film }: { film: SharedFilm }) {
  const note = Number(film.rating) || 0;
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
        {/* L'affiche prend la fiche telle qu'elle arrive : une adresse
            TMDB traverse, une image importée d'un disque reste chez son
            propriétaire — et `PosterArt` sait déjà dessiner à sa place. */}
        <PosterArt film={film as never} initials={initialesDe(String(film.title || ""))} />
        <figcaption style={{ padding: "8px 3px 2px" }}>
          <div style={{ fontFamily: F.title, fontSize: 14, color: C.ink, lineHeight: 1.25 }}>
            {String(film.title || "")}
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 2 }}>
            {[film.year, film.director].filter(Boolean).join(" · ")}
          </div>
          {note > 0 && (
            <div style={{ display: "flex", gap: 1, marginTop: 4 }} aria-label={`${note} sur 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={11}
                  color={C.burgundy}
                  fill={note >= n ? C.burgundy : "none"}
                  strokeWidth={1.4}
                />
              ))}
            </div>
          )}
          {/* La critique est la seule chose qu'on ait vraiment envie de
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
