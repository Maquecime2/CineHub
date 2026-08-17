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
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { EMPTY, Names } from "./Names";
import { tap } from "../../theme/styles";
import { getTmdbKey } from "../../services/tmdbKey";
import { getDetails, searchMovie } from "../../tmdb";
import { languageName, countryName } from "../../names";
import type { Film } from "../../types";

/** A "label → value" line, or nothing at all if we do not know. */
function Done({ name, children }: { name: string; children: ReactNode }) {
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
        {name}
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

/* The trades, by the id a card carries. Their names read from `roles`. */
const TRADES = ["image", "musique", "scénario"];

export function TmdbFacts({
  film,
  onUpdate,
  onOpenPerson,
}: {
  film: Film;
  onUpdate: (f: Film) => void;
  /** Absent: the names stay text. The card does not know how to navigate. */
  onOpenPerson?: (name: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const apiKey = getTmdbKey();
    if (!apiKey) {
      setMsg(t("tmdbKey.missing"));
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
          setMsg(t("facts.unknownTitle"));
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
      if (info.synopsis && !film.synopsis) changes.synopsis = info.synopsis;
      /* The keywords are written even when empty: it is the list itself,
         even of length zero, that says "we asked". See `types` and
         `domain/importing`. */
      if (info.keywords && film.keywords == null) changes.keywords = info.keywords;
      if (info.frames && film.frames == null) changes.frames = info.frames;
      if (!film.tmdbId) changes.tmdbId = id;

      const n = Object.keys(changes).length;
      if (n) onUpdate({ ...film, ...changes });
      /* Telling "nothing changed" from "TMDB has nothing": the first
         means the card was already up to date, the second that there is
         nothing to hope for from a second click. */
      setMsg(n ? t("facts.filledIn", { count: n }) : t("facts.nothingMore"));
    } catch (e) {
      setMsg(`TMDB indisponible (${(e as Error).message}).`);
    } finally {
      setBusy(false);
    }
  };

  const countries = (film.countries || []).map((c) => countryName(c, i18n.language)).join(", ");
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
        {t("facts.title")}
        <button
          onClick={refresh}
          disabled={busy}
          title={t("facts.refreshHint")}
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
          <RefreshCw size={11} /> {t("facts.refresh")}
        </button>
      </div>

      <Done name={t("facts.runtime")}>{film.runtime != null ? `${film.runtime} min` : EMPTY}</Done>
      <Done name={t("facts.country")}>{countries || EMPTY}</Done>
      <Done name={t("facts.language")}>
        {film.language ? languageName(film.language, i18n.language) : EMPTY}
      </Done>
      <Done name={t("facts.tmdbRating")}>
        {film.tmdbRating != null ? `${film.tmdbRating.toFixed(1)} / 10` : EMPTY}
      </Done>
      {TRADES.map((key) => (
        <Done key={key} name={t(`roles.${key}`).toUpperCase()}>
          <Names names={crew[key] || []} onOpenPerson={onOpenPerson} />
        </Done>
      ))}
      <Done name={t("facts.cast")}>
        <Names names={cast} separator=" · " onOpenPerson={onOpenPerson} />
      </Done>
      {/* THE KEYWORDS, SHOWN AND NOT HIDDEN. They feed the wake: when the
          wake only brings things together by name, this is where one sees
          why — the line is empty, and the "refresh" button just above goes
          and fetches them. A dash says "TMDB did not give it to us"; an
          absent line would say nothing at all. */}
      <Done name={t("facts.keywords")}>
        {film.keywords?.length ? film.keywords.join(" · ") : EMPTY}
      </Done>
      <Done name={t("facts.tmdbId")}>{film.tmdbId ?? EMPTY}</Done>

      {msg && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
