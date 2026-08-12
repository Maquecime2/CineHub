import { useEffect, useMemo, useState } from "react";
import { C, F } from "../theme/tokens";
import { underlineInput, tap } from "../theme/styles";
import { Label, SectionTitle, Guideline, NoKey } from "../components/ui";
import { StampCorner, InkUnderline, CoffeeRing } from "../components/atmosphere";
import { useTmdbKey } from "../services/tmdbKey";
import { buildTaste } from "../taste";
import { gatherCandidates, rank, DEFAULT_QUERY } from "../reco";
import { directorOf, pooled } from "../tmdb";
import { makeFilm, initialsOf } from "../domain/film";
import { FilmPolaroid } from "../components/film/FilmPolaroid";
import { PosterArt } from "../components/film/PosterArt";
import { filmKey } from "../domain/importing";
import { atHomeSuggestions, type Nature } from "../domain/athome";
import type { Film, Year } from "../types";

/** Un film proposé par TMDB, une fois classé. */
interface Candidate {
  tmdbId: number;
  title: string;
  year: Year;
  poster: string;
  genres: string[];
  /** Les motifs de la suggestion, prêts à lire. */
  reasons: string[];
  /** Note TMDB, et part de niche calculée par `rank`. */
  voteAverage: number;
  niche: number;
}

/** Les réglages du bulletin de commande. Voir `DEFAULT_QUERY` dans reco.js. */
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

/** Les deux listes de genres, seules clés de `Query` qui portent un tableau. */
type GenreKey = "withGenres" | "withoutGenres";

/** Les trois facteurs qui composent la « niche », et leur intitulé. */
const NICHE_FACTORS: [keyof Query["niche"], string][] = [
  ["obscurity", "peu vu"],
  ["foreign", "non anglophone"],
  ["age", "ancien"],
];
/* ============================================================
   VUE — RECOMMANDATIONS : un bulletin de commande adressé aux
   archives. On y règle ce qu'on cherche — et surtout à quelle
   profondeur — puis on dépouille ce qui remonte.
   ============================================================ */

/* Les langues proposées : celles qui reviennent le plus souvent quand on
   sort du circuit anglophone. La liste n'a pas à être exhaustive, seulement
   à éviter d'avoir à taper un code ISO de mémoire. */
const RECO_LANGS = [
  ["", "toutes"],
  ["ja", "japonais"],
  ["fr", "français"],
  ["ko", "coréen"],
  ["it", "italien"],
  ["es", "espagnol"],
  ["de", "allemand"],
  ["zh", "chinois"],
  ["ru", "russe"],
  ["sv", "suédois"],
  ["da", "danois"],
  ["fa", "persan"],
  ["hi", "hindi"],
  ["pt", "portugais"],
  ["pl", "polonais"],
  ["en", "anglais"],
];

/* Un curseur annoté à ses deux bouts : sans les étiquettes, personne ne sait
   si push à droite rend le résultat plus pointu ou moins. */
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

/* La carte de résultat : l'affiche du mur, telle quelle, augmentée du motif
   de la recommandation et d'un bouton pour la ranger. La fiche film est un
   `<button>` entier — le geste « mettre de côté » vit donc à côté, pas dedans. */
function RecoCard({
  c,
  director,
  onAdd,
  added,
}: {
  c: Candidate;
  /* Rapporté après coup (voir `useDirectors`), d'où les TROIS états : un
     nom, la chaîne vide quand TMDB n'en connaît pas — la fiche dira
     « anonyme » —, et `undefined` tant que la réponse n'est pas là. Les
     confondre ferait annoncer « anonyme » à chaque affiche pendant une
     seconde, c'est-à-dire dire faux le temps du chargement. */
  director?: string;
  onAdd: () => void;
  added: boolean;
}) {
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
      <FilmPolaroid
        film={asFilm}
        onClick={() =>
          window.open(`https://www.themoviedb.org/movie/${c.tmdbId}`, "_blank", "noopener")
        }
      />
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
            {added ? "mis de côté" : "mettre de côté"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* LES RÉALISATEURS DES PROPOSITIONS, rapportés APRÈS le classement.

   `/discover` rend des films sans équipe : le nom demande un appel de
   plus, par film. Le faire à la récolte le paierait pour des centaines
   de candidats dont trente-neuf sur quarante seront écartés ; le faire
   ici ne le paie que pour ce qui est affiché, et le cache d'une semaine
   fait le reste quand deux recherches se recoupent.

   Un seul état, cumulatif : bouger un curseur reclasse la même récolte,
   et les noms déjà connus doivent survivre au reclassement. */
function useDirectors(results: Candidate[] | null, apiKey: string) {
  const [noms, setNoms] = useState<Record<number, string>>({});

  const ids = (results || []).map((c) => c.tmdbId);
  // la clé de l'effet est la LISTE, pas le tableau : `results` est un
  // nouvel objet à chaque coup de curseur, la liste des identifiants non
  const clé = ids.join(",");

  useEffect(() => {
    if (!apiKey || !ids.length) return;
    let vivant = true;
    const manquants = ids.filter((id) => !(id in noms));
    if (!manquants.length) return;
    pooled(
      manquants.map((id) => async () => {
        const nom = await directorOf(id, apiKey);
        // on publie au fil de l'eau : quarante affiches ne doivent pas
        // attendre la dernière réponse pour se nommer toutes ensemble
        if (vivant) setNoms((n) => (id in n ? n : { ...n, [id]: nom }));
      }),
      { concurrency: 5 }
    );
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clé, apiKey]);

  return noms;
}

/* ------------------------------------------------------------
   CHEZ VOUS — ce que la collection propose d'elle-même
   ------------------------------------------------------------

   Le bureau des découvertes ne savait regarder que dehors, et, sans clé
   TMDB, il ne montrait RIEN : un titre, et un encadré expliquant
   comment le rendre utile. Un onglet entier réduit à un mode d'emploi.

   Ces propositions-ci ne demandent le réseau à personne. Elles passent
   donc AVANT — et cet onglet a désormais quelque chose à dire dès la
   première visite. */
function ChezVous({
  suggestions,
  onOpen,
}: {
  suggestions: ReturnType<typeof atHomeSuggestions>;
  onOpen: (id: string) => void;
}) {
  return (
    <div data-tour="reco-maison" style={{ marginTop: 26, position: "relative", zIndex: 2 }}>
      <SectionTitle>Chez vous</SectionTitle>
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
          <button key={s.key} onClick={() => onOpen(s.film.id)} style={carteMaison}>
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
                    color: TEINTE[s.nature],
                  }}
                >
                  {s.label}
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
                {/* LA RAISON EN CLAIR. Une proposition qui ne dit pas
                    pourquoi n'est qu'un tirage au sort de plus. */}
                <div
                  style={{
                    fontFamily: F.hand,
                    fontSize: 14.5,
                    color: C.inkFaded,
                    marginTop: 4,
                    lineHeight: 1.2,
                  }}
                >
                  {s.reason}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Une teinte par nature : on doit voir d'un coup d'œil que la liste
   regarde la collection sous trois angles, et non qu'elle répète la
   même chose six fois. */
const TEINTE: Record<Nature, string> = {
  rewatch: C.burgundy,
  motif: C.plum,
  director: C.pine,
};

const carteMaison = {
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
}: {
  films: Film[];
  onAddToWatchlist: (f: Film) => void;
  /** Ouvre une fiche de la collection — les propositions « chez vous ». */
  onOpen?: (id: string) => void;
}) {
  const [query, setQuery] = useState<Query>(DEFAULT_QUERY);
  const [raw, setRaw] = useState<Candidate[] | null>(null); // candidats bruts, indépendants des curseurs
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<Set<number>>(() => new Set());
  const set = <K extends keyof Query>(k: K, v: Query[K]) => setQuery((q) => ({ ...q, [k]: v }));

  const apiKey = useTmdbKey();
  const taste = useMemo(() => buildTaste(films), [films]);
  /* Calculé ICI et non dans le bloc : le message de clé manquante doit
     savoir s'il y a quelque chose au-dessus de lui pour en parler. */
  const maison = useMemo(() => atHomeSuggestions(films), [films]);
  const allGenres = useMemo(
    () => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(),
    [films]
  );

  /* Ce qui est déjà au mur ne doit jamais revenir en suggestion. Les fiches
     anciennes n'ont pas de tmdbId : on retombe sur la clé titre + année, la
     même que l'import utilise pour ne pas dupliquer. */
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
      if (!candidates.length)
        setError(
          "Rien ne remonte avec ces réglages — élargissez les années ou baissez la note minimale."
        );
    } catch (e) {
      setError(`TMDB n'a pas répondu : ${(e as Error).message || e}`);
    }
    setProgress(null);
  };

  /* Le classement est pur : bouger un curseur reclasse la même récolte, sans
     redemander quoi que ce soit au réseau. C'est ce qui rend les curseurs
     lisibles — on voit l'effet du réglage, pas celui d'un nouveau tirage. */
  const results = useMemo(() => (raw ? rank(raw, taste, query, 40) : null), [raw, taste, query]);
  const directors = useDirectors(results, apiKey);

  const addOne = (c: Candidate) => {
    onAddToWatchlist(
      makeFilm({
        title: c.title,
        year: c.year || "",
        poster: c.poster,
        genres: c.genres,
        // on le connaît maintenant : la fiche rangée part nommée, au lieu
        // d'attendre un « compléter les fiches » pour redemander la même chose
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
      <StampCorner text="BULLETIN DE COMMANDE" />
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 46,
          color: C.ink,
          position: "relative",
          zIndex: 2,
        }}
      >
        Le bureau des découvertes
      </div>
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
        des films à voir, choisis d'après ce que dit votre collection
      </div>

      {/* CHEZ VOUS, AVANT LE RESTE, et hors du test de clé : ces
          propositions-là ne demandent rien au réseau. */}
      {onOpen && maison.length > 0 && <ChezVous suggestions={maison} onOpen={onOpen} />}

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
            CLÉ TMDB MANQUANTE
          </div>
          <div
            style={{
              fontFamily: F.body,
              fontSize: 13.5,
              color: C.inkFaded,
              lineHeight: 1.5,
            }}
          >
            {maison.length > 0
              ? "Les propositions ci-dessus viennent de votre collection et n'ont besoin de rien. Pour en chercher au-dehors, il faut une clé — elle reste dans ce navigateur et sert aussi à l'enrichissement des fiches."
              : "Chercher des films au-dehors demande une clé — elle reste dans ce navigateur et sert aussi à l'enrichissement des fiches."}
          </div>
          <NoKey what="chercher au-dehors" style={{ marginTop: 10 }} />
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
                label="Degré de niche"
                left="grand public"
                right="pépite"
                value={query.nichePref}
                onChange={(v) => set("nichePref", v)}
              />
              <Dial
                label="Dépaysement"
                left="dans mes goûts"
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
                CE QUI FAIT LA NICHE
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
                <Label>À</Label>
                <input
                  style={underlineInput}
                  value={query.yearTo}
                  onChange={(e) => set("yearTo", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2026"
                />
              </div>
              <div style={{ width: 150 }}>
                <Label>Langue d'origine</Label>
                <select
                  value={query.language}
                  onChange={(e) => set("language", e.target.value)}
                  style={{
                    ...underlineInput,
                    fontFamily: F.mono,
                    fontSize: 12,
                  }}
                >
                  {RECO_LANGS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: 120 }}>
                <Label>Note TMDB ≥</Label>
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
                <Label>Votes ≥</Label>
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
                  <Label>Genres recherchés</Label>
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
                  <Label>Genres écartés</Label>
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
                label="ignorer aussi ma watchlist"
                ink={C.pine}
                on={query.excludeWatchlist}
                onClick={() => set("excludeWatchlist", !query.excludeWatchlist)}
              />
              {taste.isEmpty && (
                <span style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy }}>
                  collection trop mince pour un profil — seuls les filtres joueront
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
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
