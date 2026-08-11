/* ============================================================
   LA BONNE FICHE TMDB — recoller une fiche à son vrai film
   ============================================================

   L'import résout cinq cents titres d'affilée, et `searchMovie` retient
   le premier résultat sans comparer quoi que ce soit. Sur un titre
   porté par plusieurs films — « Resurrection », « Solaris », « La Bête »
   — il se trompe régulièrement, et la fiche vit ensuite avec l'identité
   d'un autre : la mauvaise affiche, la mauvaise équipe, la mauvaise
   durée.

   Le symptôme qui trahit l'erreur, c'est le sillage. TMDB, interrogé sur
   l'identifiant enregistré, recommande le VRAI film, qui apparaît alors
   à côté de lui-même comme s'il s'agissait d'un voisin. Une fiche qui
   se propose elle-même dit qu'elle n'est pas la bonne.

   Rien ne permettait de le rattraper : `rafraîchir`, dans le relevé
   TMDB, ne remplit que le vide et s'appuie sur l'identifiant déjà là —
   il conforte l'erreur au lieu de la défaire. Il fallait un geste qui
   CHANGE l'identifiant, et qui réécrive derrière lui tout ce qui en
   découle. C'est celui-ci.

   Deux prudences le bordent :

   - on ne réécrit QUE ce qui vient de TMDB (équipe, durée, pays, note,
     mots-clés). Vos mots, vos notes, vos motifs, vos séances ne sont pas
     concernés : ils parlaient déjà du bon film, c'est l'étiquette qui
     était fausse ;
   - l'affiche n'est remplacée que si elle venait de TMDB elle aussi.
     Une affiche choisie à la main ou déposée depuis le disque est un
     choix, pas une donnée. */
import { useState } from "react";
import { Search, Check } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { underlineInput } from "../../theme/styles";
import { Label } from "../ui";
import { useTmdbKey } from "../../services/tmdbKey";
import { isIdbPoster } from "../../db";
import { searchMovies, getDetails, rememberResolution } from "../../tmdb";
import type { Film } from "../../types";

/** Un homonyme proposé par TMDB. */
interface Candidat {
  tmdbId: number;
  title: string;
  original: string;
  year: number | null;
  poster: string;
  overview: string;
  lang: string;
}

const TMDB_FICHE = "https://www.themoviedb.org/movie/";

/* Une affiche « de TMDB » : celle qu'on a le droit de remplacer sans
   rien détruire de choisi. Tout le reste — une adresse collée, une image
   rangée dans IndexedDB — appartient à qui l'a mise là. */
const affichéeParTmdb = (poster?: string) =>
  !poster || (!isIdbPoster(poster) && poster.includes("image.tmdb.org"));

export function TmdbLink({ film, onUpdate }: { film: Film; onUpdate: (f: Film) => void }) {
  const apiKey = useTmdbKey();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidats, setCandidats] = useState<Candidat[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const chercher = async (titre?: string) => {
    if (!apiKey) {
      setMsg("Aucune clé TMDB — à régler au pied du rail d'onglets.");
      return;
    }
    const q = (titre ?? query).trim() || film.title;
    setBusy(true);
    setMsg("recherche…");
    setCandidats(null);
    try {
      /* Sans l'année : on cherche précisément parce que l'année inscrite
         peut être celle du mauvais film. Elle reste affichée sur chaque
         proposition, ce qui suffit à trancher. */
      const list = (await searchMovies({ title: q, apiKey })) as Candidat[];
      setCandidats(list);
      setMsg(list.length ? "" : "TMDB ne connaît aucun film de ce titre.");
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  const relier = async (c: Candidat) => {
    if (!apiKey) return;
    setBusy(true);
    setMsg("récupération de la fiche…");
    try {
      const info = await getDetails(c.tmdbId, apiKey);
      /* La correction entre aussi dans le cache d'import, qui associait
         encore ce titre au mauvais identifiant. Sans cela, un réimport
         du même fichier défait patiemment le travail. */
      rememberResolution(film.title, film.year, info);

      onUpdate({
        ...film,
        tmdbId: info.tmdbId,
        /* L'année suit l'identité : c'est elle qui distingue deux
           homonymes, et la garder fausse laisserait la fiche à moitié
           corrigée — l'almanach et la constellation la rangeraient
           encore avec l'autre film. */
        year: info.year || film.year,
        director: info.director || "",
        genres: info.genres || [],
        cast: info.cast || [],
        crew: info.crew || {},
        runtime: info.runtime ?? null,
        language: info.language || "",
        countries: info.countries || [],
        tmdbRating: info.tmdbRating ?? null,
        keywords: info.keywords || [],
        poster: affichéeParTmdb(film.poster) ? info.poster || film.poster : film.poster,
      });
      setMsg(`relié à « ${c.title} »${c.year ? ` (${c.year})` : ""}.`);
      setCandidats(null);
      setOpen(false);
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <Label>Sa fiche TMDB</Label>
        <button
          onClick={() => {
            setOpen((o) => !o);
            setQuery(film.title);
            if (!open && !candidats) chercher(film.title);
          }}
          style={{
            all: "unset",
            cursor: "pointer",
            marginLeft: "auto",
            color: C.inkFaded,
            fontFamily: F.mono,
            fontSize: 9.5,
          }}
        >
          {open ? "fermer" : "ce n'est pas le bon film"}
        </button>
      </div>

      <div
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          marginTop: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {film.tmdbId ? (
          <>
            <span>#{film.tmdbId}</span>
            <a
              href={`${TMDB_FICHE}${film.tmdbId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                color: C.pine,
                textDecoration: "none",
                borderBottom: `1px dotted ${C.pine}`,
              }}
            >
              voir sur TMDB
            </a>
          </>
        ) : (
          <span>aucun identifiant — la fiche n'est reliée à rien</span>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              style={{ ...underlineInput, flex: 1, minWidth: 0 }}
              value={query}
              placeholder="titre à chercher"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && chercher()}
            />
            <button
              onClick={() => chercher()}
              disabled={busy}
              title="chercher ce titre sur TMDB"
              style={{
                all: "unset",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.45 : 1,
                color: C.pine,
                display: "flex",
              }}
            >
              <Search size={13} />
            </button>
          </div>

          {msg && (
            <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 4 }}>
              {msg}
            </div>
          )}

          {candidats && candidats.length > 0 && (
            <div
              style={{
                marginTop: 8,
                maxHeight: 260,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {candidats.map((c) => {
                const actuel = String(film.tmdbId) === String(c.tmdbId);
                return (
                  <button
                    key={c.tmdbId}
                    onClick={() => !actuel && relier(c)}
                    disabled={busy || actuel}
                    title={c.overview || undefined}
                    style={{
                      all: "unset",
                      cursor: actuel || busy ? "default" : "pointer",
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      padding: 5,
                      border: `1px solid ${actuel ? C.burgundy : C.line}`,
                      background: actuel ? C.paperDark : "transparent",
                      opacity: busy && !actuel ? 0.5 : 1,
                    }}
                  >
                    {c.poster ? (
                      <img
                        src={c.poster}
                        alt=""
                        style={{ width: 34, display: "block", flex: "0 0 auto" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 34,
                          height: 51,
                          flex: "0 0 auto",
                          border: `1px dashed ${C.line}`,
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink }}>
                        {c.title}
                        {c.year ? ` (${c.year})` : ""}
                        {actuel && (
                          <Check
                            size={11}
                            color={C.burgundy}
                            style={{ marginLeft: 5, verticalAlign: "middle" }}
                          />
                        )}
                      </div>
                      {/* Le titre original et la langue : deux homonymes
                          se départagent souvent là, quand l'année ne
                          suffit pas. */}
                      <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                        #{c.tmdbId}
                        {c.original && c.original !== c.title ? ` · ${c.original}` : ""}
                        {c.lang ? ` · ${c.lang}` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
            choisir remplace l'équipe, la durée, le pays, la note et les mots-clés — vos mots, vos
            notes et vos séances ne bougent pas
          </div>
        </div>
      )}
    </div>
  );
}
