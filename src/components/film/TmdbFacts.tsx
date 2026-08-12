/* ============================================================
   WHAT TMDB KNOWS OF THIS FILM — and which showed nowhere
   ============================================================

   The harvest had long been bringing back the runtime, the language, the
   country, the public's rating, the cast and three crew trades. The card
   showed NONE of them: those fields fed the almanac and the
   constellation, and had no place where they could be read one by one.

   That is more than a display gap, it is a diagnostic blind spot. When
   the almanac announced three countries for two hundred films, there was
   no way to know whether TMDB was not giving them, whether the harvest
   was not asking for them, or whether the cache was serving old truncated
   answers (it was the third). A card that shows its holes gets repaired;
   a mute card has to be guessed at.

   Hence the button too: it asks TMDB for THIS film again, without going
   through the import cache — so with nothing to purge, and without having
   to relaunch the other five hundred to check a hunch about one.

   We only fill the gaps, as everywhere else in the merge: data corrected
   by hand is never overwritten by TMDB. */
import { useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { getTmdbKey } from "../../services/tmdbKey";
import { getDetails, searchMovie } from "../../tmdb";
import { languageName, countryName } from "../../names";
import type { Film } from "../../types";

/** A "label → value" line, or nothing at all if we do not know. */
function Fait({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    /* `flexWrap`: the label reserves 74 px and the value cannot go below
       its content — in a narrow column, the line overflowed. It now
       stacks. */
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        padding: "2px 0",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          color: C.inkFaded,
          letterSpacing: 0.5,
          minWidth: 74,
        }}
      >
        {nom}
      </span>
      <span
        style={{ fontFamily: F.body, fontSize: 12.5, color: C.ink, flex: "1 1 120px", minWidth: 0 }}
      >
        {children}
      </span>
    </div>
  );
}

/* What we say of an absent field. A dash, and not silence: silence gets
   confused with "this field does not exist", whereas here it means "TMDB
   did not give it to us", which calls for the button. */
const EMPTY = <span style={{ color: C.line }}>—</span>;

const TRADES: [key: string, nom: string][] = [
  ["image", "IMAGE"],
  ["musique", "MUSIQUE"],
  ["scénario", "SCÉNARIO"],
];

/* A LIST OF NAMES THAT LEADS SOMEWHERE.

   These names were text joined by commas: one read "Henri Decaë" without
   being able to ask what else one had of his, whereas the collection had
   known since the start. Each of them now opens its folder in the
   Credits.

   A dotted ink line, and not a link blue: the art direction is a
   notebook, and a notebook does not underline in blue what can be
   followed — it writes it in ink. */
function Names({
  names,
  separator = ", ",
  onOpenPerson,
}: {
  names: string[];
  separator?: string;
  onOpenPerson?: (nom: string) => void;
}) {
  if (!names.length) return EMPTY;
  return (
    <>
      {names.map((nom, i) => (
        <span key={`${nom}-${i}`}>
          {i > 0 && separator}
          {onOpenPerson ? (
            <button
              onClick={() => onOpenPerson(nom)}
              title={`Ce que j'ai de ${nom}`}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                borderBottom: `1px dotted ${C.inkFaded}`,
                transition: "color var(--motion-fast) ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = C.burgundy;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "";
              }}
            >
              {nom}
            </button>
          ) : (
            nom
          )}
        </span>
      ))}
    </>
  );
}

export function TmdbFacts({
  film,
  onUpdate,
  onOpenPerson,
}: {
  film: Film;
  onUpdate: (f: Film) => void;
  /** Absent: the names stay text. The card does not know how to navigate. */
  onOpenPerson?: (nom: string) => void;
}) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const rafraîchir = async () => {
    const apiKey = getTmdbKey();
    if (!apiKey) {
      setMsg("Aucune clé TMDB — à régler au pied du rail d'onglets.");
      return;
    }
    setBusy(true);
    setMsg("interrogation…");
    try {
      /* The identifier when we have it: it avoids a search, and above all
         the false positives of `searchMovie`, which takes the first result
         without comparing titles. */
      let id = film.tmdbId;
      if (!id) {
        const hit = await searchMovie({ title: film.title, year: film.year, apiKey });
        if (!hit) {
          setMsg("TMDB ne connaît pas ce titre.");
          return;
        }
        id = hit.id;
      }
      const info = await getDetails(id, apiKey);

      const changes: Partial<Film> = {};
      if (info.runtime != null && film.runtime == null) changes.runtime = info.runtime;
      if (info.language && !film.language) changes.language = info.language;
      if (info.countries?.length && !(film.countries || []).length)
        changes.countries = info.countries;
      if (info.tmdbRating != null && film.tmdbRating == null) changes.tmdbRating = info.tmdbRating;
      if (info.cast?.length && !(film.cast || []).length) changes.cast = info.cast;
      if (info.crew && Object.keys(info.crew).length && !Object.keys(film.crew || {}).length)
        changes.crew = info.crew;
      if (info.genres?.length && !(film.genres || []).length) changes.genres = info.genres;
      if (info.director && !film.director) changes.director = info.director;
      /* The keywords are written even when empty: it is the list itself,
         even of length zero, that says "we asked". See `types` and
         `domain/importing`. */
      if (info.keywords && film.keywords == null) changes.keywords = info.keywords;
      if (!film.tmdbId) changes.tmdbId = id;

      const n = Object.keys(changes).length;
      if (n) onUpdate({ ...film, ...changes });
      /* Telling "nothing changed" from "TMDB has nothing": the first
         means the card was already up to date, the second that there is
         nothing to hope for from a second click. */
      setMsg(
        n ? `${n} champ(s) complété(s).` : "TMDB ne donne rien de plus que ce qui est déjà là."
      );
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  const pays = (film.countries || []).map(countryName).join(", ");
  const crew = film.crew || {};
  const cast = film.cast || [];

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          letterSpacing: 1,
          marginBottom: 6,
        }}
      >
        RELEVÉ TMDB
        <button
          onClick={rafraîchir}
          disabled={busy}
          title="redemander cette fiche à TMDB"
          style={{
            all: "unset",
            ...tap,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.45 : 1,
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: F.mono,
            fontSize: 10,
            color: C.pine,
          }}
        >
          <RefreshCw size={11} /> rafraîchir
        </button>
      </div>

      <Fait nom="DURÉE">{film.runtime != null ? `${film.runtime} min` : EMPTY}</Fait>
      <Fait nom="PAYS">{pays || EMPTY}</Fait>
      <Fait nom="LANGUE">{film.language ? languageName(film.language) : EMPTY}</Fait>
      <Fait nom="NOTE TMDB">
        {film.tmdbRating != null ? `${film.tmdbRating.toFixed(1)} / 10` : EMPTY}
      </Fait>
      {TRADES.map(([key, nom]) => (
        <Fait key={key} nom={nom}>
          <Names names={crew[key] || []} onOpenPerson={onOpenPerson} />
        </Fait>
      ))}
      <Fait nom="CASTING">
        <Names names={cast} separator=" · " onOpenPerson={onOpenPerson} />
      </Fait>
      {/* THE KEYWORDS, SHOWN AND NOT HIDDEN. They feed the wake: when the
          wake only brings things together by name, this is where one sees
          why — the line is empty, and the "refresh" button just above goes
          and fetches them. A dash says "TMDB did not give it to us"; an
          absent line would say nothing at all. */}
      <Fait nom="MOTS-CLÉS">{film.keywords?.length ? film.keywords.join(" · ") : EMPTY}</Fait>
      <Fait nom="ID TMDB">{film.tmdbId ?? EMPTY}</Fait>

      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
