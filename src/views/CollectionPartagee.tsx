/* ============================================================
   LA COLLECTION DE QUELQU'UN D'AUTRE
   ============================================================

   La première page de ce projet qui ne soit pas la vôtre. Elle s'ouvre
   depuis un lien reçu, souvent dans un navigateur où le classeur n'a
   jamais mis les pieds : rien n'y est chargé, aucun compte n'y existe,
   et il ne faut rien lui demander.

   ELLE NE MONTRE PAS UN MUR, ET C'EST UN CHOIX. Le mur d'ici est un
   outil : on y filtre, on y trie, on y range. Chez quelqu'un d'autre,
   il n'y a rien à ranger — on regarde. La page est donc une planche
   contact : des affiches, des titres, des notes, et la seule chose
   qu'on ait envie de lire chez un autre — ce qu'il en a pensé.

   ON N'EMPRUNTE PAS SA VIDÉOTHÈQUE POUR AUTANT : rien n'est écrit dans
   le classeur du visiteur. Une collection partagée se regarde, elle ne
   se télécharge pas.
   ============================================================ */
import { useEffect, useState } from "react";
import { Clapperboard, Star } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { PosterArt } from "../components/film/PosterArt";
import { collectionDe, ErreurServeur, type FilmPartage } from "../services/serveur";
import { tiltOf } from "../domain/seeded";
import { initialsOf as initialesDe } from "../domain/film";

/* L'ADRESSE D'UNE COLLECTION PARTAGÉE.

   `#/chez/varda` — dans le FRAGMENT, et pas dans le chemin. Le classeur
   est publié en pages statiques : un chemin inconnu y rend un 404 du
   serveur avant que la moindre ligne de JavaScript ne tourne, alors
   qu'un fragment ne quitte jamais le navigateur. C'est ce qui permet à
   un lien de fonctionner sans un octet de configuration côté
   hébergeur. */
export interface Adresse {
  pseudo: string;
  jeton: string | null;
}

export function lireLAdresse(fragment: string = location.hash): Adresse | null {
  const m = /^#\/chez\/([a-z0-9-]{3,30})(?:\?jeton=([A-Za-z0-9_-]+))?$/.exec(fragment.trim());
  return m ? { pseudo: m[1]!, jeton: m[2] ?? null } : null;
}

export function CollectionPartagee({ adresse }: { adresse: Adresse }) {
  const [films, setFilms] = useState<FilmPartage[] | null>(null);
  const [souci, setSouci] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    collectionDe(adresse.pseudo, adresse.jeton)
      .then((r) => vivant && setFilms(r.films))
      .catch((e) => {
        if (!vivant) return;
        /* LE SERVEUR RÉPOND 404 POUR TROIS RAISONS et n'en dit pas
           plus — compte inconnu, collection fermée, lien périmé. On
           reprend ce silence plutôt que d'inventer une explication qui
           aurait une chance sur trois d'être juste. */
        setSouci(
          (e as ErreurServeur).code === 404
            ? "Pas de collection à cette adresse. Le lien a peut-être été refermé."
            : "Cette collection n'a pas pu être ouverte."
        );
      });
    return () => {
      vivant = false;
    };
  }, [adresse.pseudo, adresse.jeton]);

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
            La vidéothèque de {adresse.pseudo}
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

function Affiche({ film }: { film: FilmPartage }) {
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
