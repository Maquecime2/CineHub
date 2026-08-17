import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../theme/tokens";
import { underlineInput, tap, inked, hollow } from "../theme/styles";
import { FilmQuickView } from "../components/film/FilmQuickView";
import { normalize } from "../domain/search";
import { Label, SectionTitle, Guideline, NoKey } from "../components/ui";
import { StampCorner, InkUnderline, CoffeeRing } from "../components/atmosphere";
import { useTmdbKey } from "../services/tmdbKey";
import { buildTaste } from "../taste";
import { gatherCandidates, rank, DEFAULT_QUERY } from "../reco";
import { directorOf, pooled } from "../tmdb";
import { makeFilm, initialsOf } from "../domain/film";
import { say } from "../domain/wording";
import { languageName } from "../names";
import { FilmPolaroid } from "../components/film/FilmPolaroid";
import { PosterArt } from "../components/film/PosterArt";
import { filmKey } from "../domain/importing";
import { atHomeSuggestions, type Nature } from "../domain/athome";
import type { Film, Year } from "../types";

/** A film proposed by TMDB, once ranked. */
interface Candidate {
  tmdbId: number;
  title: string;
  year: Year;
  poster: string;
  genres: string[];
  /** The reasons for the suggestion, ready to read. */
  reasons: string[];
  /** TMDB rating, and the niche share computed by `rank`. */
  voteAverage: number;
  niche: number;
  /* IL TRAVERSAIT DÉJÀ TOUTE LA CHAÎNE et n'était déclaré nulle part :
     `toCandidate` le ramène, `gatherCandidates` et `rank` l'étalent avec
     le reste. On proposait donc des films en n'en disant que le titre,
     l'année et deux chiffres — en tenant le résumé dans la main. */
  overview?: string;
}

/** The settings of the order form. See `DEFAULT_QUERY` in reco.js. */
interface Query {
  yearFrom: string;
  yearTo: string;
  withGenres: string[];
  withoutGenres: string[];
  language: string;
  minVotes: number;
  minRating: number;
  nichePref: number;
  driftPref: number;
  excludeWatchlist: boolean;
  niche: { obscurity: boolean; foreign: boolean; age: boolean };
}

/** The two genre lists, the only keys of `Query` carrying an array. */
type GenreKey = "withGenres" | "withoutGenres";

/** The three factors that make up the "niche", and their labels. */
const NICHE_FACTORS: [keyof Query["niche"], string][] = [
  ["obscurity", "peu vu"],
  ["foreign", "non anglophone"],
  ["age", "ancien"],
];
/* ============================================================
   VIEW — RECOMMENDATIONS: an order form addressed to the archives.
   One sets on it what one is looking for — and above all at what
   depth — then one goes through what comes back.
   ============================================================ */

/* The languages offered: those that come back most often when one
   leaves the English-speaking circuit. The list does not have to be
   exhaustive, only to spare having to type an ISO code from memory. */
/* Only the ISO codes: their names come from `names.ts`, which asks
   `Intl` in whichever language is in force. Writing sixteen names here
   would be sixteen more to translate, and `Intl` already knows them. */
const RECO_LANGS = [
  "",
  "ja",
  "fr",
  "ko",
  "it",
  "es",
  "de",
  "zh",
  "ru",
  "sv",
  "da",
  "fa",
  "hi",
  "pt",
  "pl",
  "en",
];

/* A slider annotated at both ends: without the labels, nobody knows
   whether pushing to the right makes the result sharper or less so. */
function Dial({
  label,
  left,
  right,
  value,
  onChange,
  ink = C.burgundy,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
  ink?: string;
}) {
  return (
    <div style={{ minWidth: 230, flex: 1 }}>
      <Label>{label}</Label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: ink, cursor: "pointer" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: F.hand,
          fontSize: 15,
          color: C.inkFaded,
          marginTop: -2,
        }}
      >
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function Chip({
  label,
  on,
  onClick,
  ink = C.burgundy,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  ink?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        ...tap,
        cursor: "pointer",
        fontFamily: F.mono,
        fontSize: 10.5,
        padding: "3px 10px",
        borderRadius: 12,
        border: `1px solid ${on ? ink : C.line}`,
        background: on ? ink : "transparent",
        color: on ? C.card : C.inkFaded,
      }}
    >
      {label}
    </button>
  );
}

/* The result card: the wall's poster, as it is, augmented with the
   reason for the recommendation and a button to file it. The film card
   is a whole `<button>` — so the "set aside" gesture lives beside it,
   not inside it. */
function RecoCard({
  c,
  director,
  onAdd,
  added,
  onQuick,
}: {
  c: Candidate;
  /* Brought back afterwards (see `useDirectors`), hence the THREE
     states: a name, the empty string when TMDB knows none — the card
     will say "anonyme" —, and `undefined` as long as the answer is not
     there. Confusing them would announce "anonyme" on every poster for a
     second, that is to say say something false while loading. */
  director?: string;
  onAdd: () => void;
  added: boolean;
  onQuick: () => void;
}) {
  const { t } = useTranslation();
  const asFilm = useMemo(
    () =>
      makeFilm({
        id: `tmdb-${c.tmdbId}`,
        title: c.title,
        year: c.year || "",
        poster: c.poster,
        genres: c.genres,
        director: director === undefined ? "…" : director,
        rating: 0,
      }),
    [c.tmdbId, director]
  );
  return (
    <div>
      {/* L'AFFICHE OUVRE LA VUE RAPIDE, ET PLUS TMDB DANS UN AUTRE
          ONGLET. Quitter le site pour savoir de quoi parle un film qu'on
          nous propose ici perd la recherche qu'on venait de régler — et
          tout ce que cette page allait chercher, elle le tenait déjà. */}
      <FilmPolaroid film={asFilm} onClick={onQuick} />
      <div style={{ marginTop: -22, marginBottom: 30, padding: "0 4px" }}>
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            lineHeight: 1.25,
          }}
        >
          {c.reasons.join(" · ")}
        </div>
        {c.overview && (
          <div
            style={{
              fontFamily: F.body,
              fontSize: 11.5,
              lineHeight: 1.4,
              color: alpha(C.ink, 0.7),
              marginTop: 4,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {c.overview}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
            TMDB {c.voteAverage.toFixed(1)} · niche {Math.round(c.niche * 100)}%
          </span>
          <button
            onClick={onAdd}
            disabled={added}
            style={{
              all: "unset",
              ...tap,
              cursor: added ? "default" : "pointer",
              marginLeft: "auto",
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 0.5,
              padding: "4px 10px",
              border: `1px solid ${added ? C.line : C.pine}`,
              color: added ? C.inkFaded : C.card,
              background: added ? "transparent" : C.pine,
            }}
          >
            {added ? t("wakePanel.setAsideDone") : t("wakePanel.setAside")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* THE DIRECTORS OF THE PROPOSALS, brought back AFTER the ranking.

   `/discover` returns films with no crew: the name requires one more
   call, per film. Doing it at harvest time would pay for it on hundreds
   of candidates of which thirty-nine out of forty will be set aside;
   doing it here only pays for what is displayed, and the one-week cache
   does the rest when two searches overlap.

   A single state, cumulative: moving a slider re-ranks the same harvest,
   and the names already known must survive the re-ranking. */
function useDirectors(results: Candidate[] | null, apiKey: string) {
  const [names, setNoms] = useState<Record<number, string>>({});

  const ids = (results || []).map((c) => c.tmdbId);
  // the effect's key is the LIST, not the array: `results` is a new
  // object at every slider move, the list of identifiers is not
  const key = ids.join(",");

  useEffect(() => {
    if (!apiKey || !ids.length) return;
    let alive = true;
    const manquants = ids.filter((id) => !(id in names));
    if (!manquants.length) return;
    pooled(
      manquants.map((id) => async () => {
        const name = await directorOf(id, apiKey);
        // we publish as we go: forty posters must not wait for the last
        // answer to name themselves all at once
        if (alive) setNoms((n) => (id in n ? n : { ...n, [id]: name }));
      }),
      { concurrency: 5 }
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, apiKey]);

  return names;
}

/* ------------------------------------------------------------
   AT YOUR PLACE — what the collection proposes on its own
   ------------------------------------------------------------

   The discoveries desk only knew how to look outwards, and, with no TMDB
   key, it showed NOTHING: a title, and a box explaining how to make it
   useful. A whole tab reduced to a set of instructions.

   These proposals ask the network of nobody. So they come FIRST — and
   this tab now has something to say from the first visit. */
function AtHome({
  suggestions,
  onOpen,
}: {
  suggestions: ReturnType<typeof atHomeSuggestions>;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-tour="reco-maison" style={{ marginTop: 26, position: "relative", zIndex: 2 }}>
      <SectionTitle>{t("reco.atYourPlace")}</SectionTitle>
      <Guideline>
        Deux cents fiches vues, et l'on tourne autour des douze dernières. Voici les autres — rien
        d'ici ne sort du navigateur.
      </Guideline>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        {suggestions.map((s) => (
          <button key={s.key} onClick={() => onOpen(s.film.id)} style={houseMap}>
            <div style={{ display: "flex", gap: 11 }}>
              <div style={{ width: 54, flexShrink: 0 }}>
                <PosterArt film={s.film} height={81} initials={initialsOf(s.film.title)} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 8.5,
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    color: TINT[s.nature],
                  }}
                >
                  {say(s.label, t)}
                </div>
                <div
                  style={{
                    fontFamily: F.title,
                    fontWeight: 700,
                    fontSize: 14,
                    color: C.ink,
                    marginTop: 2,
                    lineHeight: 1.15,
                  }}
                >
                  {s.film.title}
                </div>
                {/* THE REASON IN THE CLEAR. A proposal that does not
                    say why is only one more lottery draw. */}
                <div
                  style={{
                    fontFamily: F.hand,
                    fontSize: 14.5,
                    color: C.inkFaded,
                    marginTop: 4,
                    lineHeight: 1.2,
                  }}
                >
                  {say(s.reason, t)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* One tint per kind: one must see at a glance that the list looks at
   the collection from three angles, and not that it repeats the same
   thing six times. */
const TINT: Record<Nature, string> = {
  rewatch: C.burgundy,
  motif: C.plum,
  director: C.pine,
};

const houseMap = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  display: "block",
  background: C.card,
  border: `1px solid ${C.line}`,
  borderRadius: 2,
  padding: "10px 12px",
  boxShadow: "1px 2px 6px rgba(0,0,0,0.1)",
  transition: "transform var(--motion-fast) var(--motion-ease)",
};

export function RecoView({
  films,
  onAddToWatchlist,
  onOpen,
  onOpenPerson,
}: {
  films: Film[];
  onAddToWatchlist: (f: Film) => void;
  /** Opens a card of the collection — the "chez vous" proposals. */
  onOpen?: (id: string) => void;
  /** Ouvre la page de quelqu'un au générique, depuis la vue rapide. */
  onOpenPerson?: (key: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState<Query>(DEFAULT_QUERY);
  const [raw, setRaw] = useState<Candidate[] | null>(null); // the raw candidates, independent of the dials
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<number>>(() => new Set());
  /** La proposition qu'on regarde en entier, par-dessus la planche. */
  const [quick, setQuick] = useState<Candidate | null>(null);
  const set = <K extends keyof Query>(k: K, v: Query[K]) => setQuery((q) => ({ ...q, [k]: v }));

  const apiKey = useTmdbKey();
  const taste = useMemo(() => buildTaste(films), [films]);
  /* Computed HERE and not in the block: the missing-key message must
     know whether there is something above it to speak of. */
  const house = useMemo(() => atHomeSuggestions(films), [films]);
  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );

  /* What is already on the wall must never come back as a suggestion.
     The old cards have no tmdbId: we fall back on the title + year key,
     the same one the import uses so as not to duplicate. */
  const isSeen = useMemo(() => {
    const ids = new Set(
      films
        .filter((f) => query.excludeWatchlist || f.status !== "watchlist")
        .map((f) => f.tmdbId)
        .filter(Boolean)
    );
    const keys = new Set(
      films.filter((f) => query.excludeWatchlist || f.status !== "watchlist").map(filmKey)
    );
    return (c: Candidate) =>
      ids.has(c.tmdbId) || keys.has(filmKey({ title: c.title, year: c.year }));
  }, [films, query.excludeWatchlist]);

  const search = async () => {
    if (!apiKey) return;
    setError("");
    setRaw(null);
    setProgress({ done: 0, total: 1 });
    try {
      const { candidates } = await gatherCandidates({
        query,
        taste,
        films,
        apiKey,
        isSeen,
        onProgress: (done: number, total: number) => setProgress({ done, total }),
      });
      setRaw(candidates);
      if (!candidates.length) setError(t("reco.nothingComesBack"));
    } catch (e) {
      setError(`TMDB n'a pas répondu : ${(e as Error).message || e}`);
    }
    setProgress(null);
  };

  /* The ranking is pure: moving a slider re-ranks the same harvest,
     without asking the network for anything again. That is what makes
     the sliders legible — one sees the effect of the setting, not that
     of a new draw. */
  const results = useMemo(() => (raw ? rank(raw, taste, query, 40) : null), [raw, taste, query]);
  const directors = useDirectors(results, apiKey);

  const addOne = (c: Candidate) => {
    onAddToWatchlist(
      makeFilm({
        title: c.title,
        year: c.year || "",
        poster: c.poster,
        genres: c.genres,
        // we know it now: the filed card leaves named, instead of
        // waiting for a "complete the cards" to ask for the same thing again
        director: directors[c.tmdbId] || "",
        status: "watchlist",
        tmdbId: c.tmdbId,
        source: "tmdb",
      })
    );
    setAdded((s) => new Set(s).add(c.tmdbId));
  };

  const toggleIn = (key: GenreKey) => (g: string) =>
    set(key, query[key].includes(g) ? query[key].filter((x) => x !== g) : [...query[key], g]);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 20, right: 160 }} rotate={-18} />
      <StampCorner text={t("reco.stamp")} />
      <h1
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 46,
          color: C.ink,
          position: "relative",
          zIndex: 2,
          margin: 0,
        }}
      >
        {t("reco.heading")}
      </h1>
      <InkUnderline width={370} />
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 22,
          color: C.inkFaded,
          marginTop: 2,
          position: "relative",
          zIndex: 2,
        }}
      >
        {t("reco.subheading")}
      </div>

      {/* AT YOUR PLACE, BEFORE THE REST, and outside the key check:
          these proposals ask nothing of the network. */}
      {onOpen && house.length > 0 && <AtHome suggestions={house} onOpen={onOpen} />}

      {!apiKey ? (
        <div
          style={{
            marginTop: 26,
            border: `1px dashed ${C.line}`,
            background: C.card,
            padding: "18px 22px",
            maxWidth: 560,
          }}
        >
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              color: C.burgundy,
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            {t("reco.missingTmdbKey")}
          </div>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 13.5,
              color: C.inkFaded,
              lineHeight: 1.5,
            }}
          >
            {house.length > 0 ? t("reco.needsKeyWithHome") : t("reco.needsKey")}
          </div>
          <NoKey what={t("reco.searchOutside")} style={{ marginTop: 10 }} />
        </div>
      ) : (
        <>
          {/* ---- le bulletin ---- */}
          <div
            data-tour="reco-bulletin"
            style={{
              marginTop: 24,
              border: `1px solid ${C.line}`,
              background: C.card,
              padding: "20px 24px",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div data-tour="reco-dials" style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
              <Dial
                label={t("reco.obscurity")}
                left="grand public"
                right={t("reco.gem")}
                value={query.nichePref}
                onChange={(v) => set("nichePref", v)}
              />
              <Dial
                label={t("reco.changeOfScene")}
                left={t("reco.withinMyTastes")}
                right="hors des sentiers"
                value={query.driftPref}
                onChange={(v) => set("driftPref", v)}
                ink={C.cobalt}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 16,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: C.inkFaded,
                  letterSpacing: 1,
                }}
              >
                {t("reco.whatMakesTheNiche")}
              </span>
              {NICHE_FACTORS.map(([k, l]) => (
                <Chip
                  key={k}
                  label={l}
                  on={query.niche[k] !== false}
                  onClick={() => set("niche", { ...query.niche, [k]: query.niche[k] === false })}
                />
              ))}
            </div>

            <div style={{ height: 1, background: C.line, margin: "18px 0 16px" }} />

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ width: 92 }}>
                <Label>De</Label>
                <input
                  style={underlineInput}
                  value={query.yearFrom}
                  onChange={(e) => set("yearFrom", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1920"
                />
              </div>
              <div style={{ width: 92 }}>
                <Label>{t("reco.to")}</Label>
                <input
                  style={underlineInput}
                  value={query.yearTo}
                  onChange={(e) => set("yearTo", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2026"
                />
              </div>
              <div style={{ width: 150 }}>
                <Label>{t("reco.originalLanguage")}</Label>
                <select
                  value={query.language}
                  onChange={(e) => set("language", e.target.value)}
                  style={{
                    ...underlineInput,
                    fontFamily: F.mono,
                    fontSize: 12,
                  }}
                >
                  {RECO_LANGS.map((v) => (
                    <option key={v} value={v}>
                      {v ? languageName(v, i18n.language) : t("reco.allLanguages")}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <Label>{t("reco.tmdbRatingAtLeast")}</Label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  style={underlineInput}
                  value={query.minRating}
                  onChange={(e) => set("minRating", Number(e.target.value))}
                />
              </div>
              <div style={{ width: 120 }}>
                <Label>{t("reco.votesAtLeast")}</Label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  style={underlineInput}
                  value={query.minVotes}
                  onChange={(e) => set("minVotes", Number(e.target.value))}
                />
              </div>
            </div>
            <div
              style={{
                fontFamily: F.hand,
                fontSize: 15,
                color: C.inkFaded,
                marginTop: 6,
              }}
            >
              le plancher de votes évite de confondre « confidentiel » et « oublié pour de bonnes
              raisons »
            </div>

            {allGenres.length > 0 && (
              <>
                <div style={{ marginTop: 16 }}>
                  <Label>{t("reco.genresSought")}</Label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {allGenres.map((g) => (
                      <Chip
                        key={g}
                        label={g}
                        on={query.withGenres.includes(g)}
                        onClick={() => toggleIn("withGenres")(g)}
                      />
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Label>{t("reco.genresSetAside")}</Label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {allGenres.map((g) => (
                      <Chip
                        key={g}
                        label={g}
                        ink={C.slate}
                        on={query.withoutGenres.includes(g)}
                        onClick={() => toggleIn("withoutGenres")(g)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={search}
                disabled={!!progress}
                style={{
                  all: "unset",
                  ...tap,
                  cursor: progress ? "default" : "pointer",
                  background: progress ? C.line : C.burgundy,
                  color: C.card,
                  padding: "10px 22px",
                  fontFamily: F.mono,
                  fontSize: 12,
                  letterSpacing: 1,
                }}
              >
                {progress ? `CONSULTATION… ${progress.done}/${progress.total}` : "CHERCHER"}
              </button>
              <Chip
                label={t("reco.ignoreWatchlist")}
                ink={C.pine}
                on={query.excludeWatchlist}
                onClick={() => set("excludeWatchlist", !query.excludeWatchlist)}
              />
              {taste.isEmpty && (
                <span style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy }}>
                  {t("reco.tooThinForAProfile")}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 18,
                color: C.burgundy,
                fontFamily: F.hand,
                fontSize: 19,
              }}
            >
              {error}
            </div>
          )}

          {results && results.length > 0 && (
            <>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 11,
                  color: C.inkFaded,
                  letterSpacing: 1,
                  margin: "30px 0 18px",
                }}
              >
                {results.length} PROPOSITIONS · {(raw ?? []).length} CANDIDATS DÉPOUILLÉS
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: "0 34px",
                  alignItems: "start",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {results.map((c) => (
                  <RecoCard
                    key={c.tmdbId}
                    c={c}
                    director={directors[c.tmdbId]}
                    onAdd={() => addOne(c)}
                    added={added.has(c.tmdbId)}
                    onQuick={() => setQuick(c)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* LA PROPOSITION EN ENTIER. Pas au classeur, donc `inBinder` est
          faux : ni note, ni séance, ni statut. Le réalisateur y est
          cliquable, ce que la planche ne savait pas faire — c'est même
          la question qu'on se pose devant une découverte. */}
      {quick && (
        <FilmQuickView
          film={makeFilm({
            id: `tmdb-${quick.tmdbId}`,
            title: quick.title,
            year: quick.year || "",
            poster: quick.poster,
            genres: quick.genres,
            synopsis: quick.overview || "",
            director: directors[quick.tmdbId] || "",
            tmdbRating: quick.voteAverage || null,
            tmdbId: quick.tmdbId,
          })}
          inBinder={false}
          onOpenPerson={onOpenPerson ? (name) => onOpenPerson(normalize(name)) : undefined}
          action={
            <button
              onClick={() => {
                addOne(quick);
                setQuick(null);
              }}
              disabled={added.has(quick.tmdbId)}
              style={{ ...inked(C.pine), ...(added.has(quick.tmdbId) ? hollow : null) }}
            >
              {added.has(quick.tmdbId) ? t("wakePanel.setAsideDone") : t("wakePanel.setAside")}
            </button>
          }
          onClose={() => setQuick(null)}
        />
      )}
    </div>
  );
}
