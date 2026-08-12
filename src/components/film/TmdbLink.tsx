/* ============================================================
   THE RIGHT TMDB RECORD — sticking a card back to its real film
   ============================================================

   The import resolves five hundred titles in a row, and `searchMovie`
   keeps the first result without comparing anything at all. On a title
   carried by several films — "Resurrection", "Solaris", "La Bête" — it
   goes wrong regularly, and the card then lives with somebody else's
   identity: the wrong poster, the wrong crew, the wrong runtime.

   The symptom that gives the error away is the wake. TMDB, asked about
   the recorded identifier, recommends the REAL film, which then appears
   beside itself as though it were a neighbour. A card that offers itself
   is saying it is not the right one.

   Nothing allowed one to catch it: `refresh`, in the TMDB report, only
   fills the gaps and leans on the identifier already there — it confirms
   the error instead of undoing it. What was needed was a gesture that
   CHANGES the identifier, and rewrites behind it everything that follows
   from it. This is that gesture.

   Two precautions border it:

   - we rewrite ONLY what comes from TMDB (crew, runtime, country,
     rating, keywords). Your words, your notes, your motifs, your
     screenings are not concerned: they were already speaking of the right
     film, it was the label that was wrong;
   - the poster is replaced only if it came from TMDB too. A poster chosen
     by hand or dropped in from disk is a choice, not data. */
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

/* A poster "from TMDB": the one we have the right to replace without
   destroying anything chosen. All the rest — a pasted address, an image
   filed in IndexedDB — belongs to whoever put it there. */
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
      /* Without the year: we search precisely because the year written
         down may be the wrong film's. It stays shown on every suggestion,
         which is enough to decide. */
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
      /* The correction also enters the import cache, which still
         associated this title with the wrong identifier. Without that, a
         reimport of the same file patiently undoes the work. */
      rememberResolution(film.title, film.year, info);

      onUpdate({
        ...film,
        tmdbId: info.tmdbId,
        /* The year follows the identity: it is what tells two namesakes
           apart, and keeping it wrong would leave the card half
           corrected — the almanac and the constellation would still file
           it with the other film. */
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
                      {/* The original title and the language: two
                          namesakes are often told apart there, when the
                          year is not enough. */}
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
