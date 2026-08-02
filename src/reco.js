/* ============================================================
   RECOMMANDATIONS — récolte puis classement.

   Deux étages nettement séparés :
     · `gatherCandidates` parle à TMDB et ne juge rien ;
     · `affinity` / `nicheScore` / `rank` sont purs et hors-ligne.

   Cette séparation permet de rejouer un classement quand on bouge
   un curseur, sans redemander quoi que ce soit au réseau.
   ============================================================ */

import { discover, recommendationsFor, searchPerson, directorFilmography, getGenreMap, pooled } from "./tmdb";
import { favorites, topDirectors, decadeOf } from "./taste";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* Le seuil de crédibilité. En dessous, « peu vu » ne veut plus rien dire :
   c'est du bruit de catalogue, pas une pépite. */
export const DEFAULT_MIN_VOTES = 30;

export const DEFAULT_QUERY = {
  yearFrom: "", yearTo: "",
  withGenres: [],        // noms, tels que stockés dans les fiches
  withoutGenres: [],
  language: "",          // code ISO ; "" = indifférent
  minVotes: DEFAULT_MIN_VOTES,
  minRating: 6,          // note TMDB plancher
  nichePref: 0.5,        // 0 = grand public · 1 = pépite
  driftPref: 0.5,        // 0 = dans mes goûts · 1 = hors des sentiers
  excludeWatchlist: true,
  // les facteurs de niche que l'on veut réellement faire jouer
  niche: { obscurity: true, foreign: true, age: true },
};

/* ============================================================
   1. RÉCOLTE
   ============================================================ */

/* Les requêtes `/discover` envoyées. Plusieurs tris plutôt qu'un seul : trier
   par note moyenne remonte les confidentiels, trier par popularité remonte les
   évidences — un curseur « niche » qui n'aurait qu'une seule source de
   candidats ne pourrait rien arbitrer du tout. */
function discoverPlans(query, taste, genreMap) {
  const ids = (names) => names.map((n) => genreMap.byName.get(n.toLowerCase())).filter(Boolean);

  const base = {
    "vote_count.gte": String(Math.max(1, query.minVotes || DEFAULT_MIN_VOTES)),
    "vote_average.gte": String(query.minRating || 0),
  };
  if (query.yearFrom) base["primary_release_date.gte"] = `${query.yearFrom}-01-01`;
  if (query.yearTo) base["primary_release_date.lte"] = `${query.yearTo}-12-31`;
  if (query.language) base.with_original_language = query.language;

  const withIds = ids(query.withGenres || []);
  const withoutIds = ids(query.withoutGenres || []);
  if (withIds.length) base.with_genres = withIds.join(",");
  if (withoutIds.length) base.without_genres = withoutIds.join(",");

  // à défaut de genres demandés, on part de ceux que la collection aime
  if (!withIds.length && !taste.isEmpty) {
    const liked = [...taste.genres.entries()].filter(([, w]) => w > 0.35).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const likedIds = ids(liked.map(([n]) => n));
    // `|` et non `,` : l'un OU l'autre, sinon l'intersection des trois est vide
    if (likedIds.length) base.with_genres = likedIds.join("|");
  }

  const plans = [
    { ...base, sort_by: "vote_average.desc", page: "1" },
    { ...base, sort_by: "vote_average.desc", page: "2" },
    { ...base, sort_by: "popularity.desc", page: "1" },
  ];

  // un plafond de votes force TMDB à ne renvoyer QUE du confidentiel : sans
  // lui, les mêmes classiques trustent les premières pages quel que soit le tri
  if (query.nichePref > 0.35) {
    plans.push({ ...base, "vote_count.lte": "1200", sort_by: "vote_average.desc", page: "1" });
    plans.push({ ...base, "vote_count.lte": "1200", sort_by: "vote_average.desc", page: "2" });
  }
  return plans;
}

/**
 * Interroge TMDB et fusionne tout ce qui remonte, sans rien classer.
 *
 * @param {object}   opts.taste    profil issu de buildTaste
 * @param {Array}    opts.films    la collection, pour les « parce que vous avez aimé »
 * @param {function} opts.isSeen   (candidate) => bool — l'exclusion appartient à l'appelant,
 *                                 qui seul connaît sa propre clé d'appariement
 * @returns {{ candidates: Array, genreMap, sourcesUsed }}
 */
export async function gatherCandidates({ query, taste, films, apiKey, isSeen = () => false, onProgress }) {
  const genreMap = await getGenreMap(apiKey);

  const favs = taste.isEmpty ? [] : favorites(films, 12);
  const dirs = taste.isEmpty ? [] : topDirectors(films, taste, 4);
  const plans = discoverPlans(query, taste, genreMap);

  const tasks = [
    ...plans.map((p) => async () => ({ kind: "discover", list: await discover(p, apiKey) })),
    ...favs.map((f) => async () => ({
      kind: "reco", from: { title: f.title, rating: f.rating },
      list: await recommendationsFor(f.tmdbId, apiKey),
    })),
    ...dirs.map((d) => async () => {
      const person = await searchPerson(d.name, apiKey);
      if (!person) return null;
      return { kind: "director", director: d.name, list: await directorFilmography(person.id, apiKey) };
    }),
  ];

  const results = await pooled(tasks, { concurrency: 5, onProgress });

  // fusion par tmdbId : un même film peut arriver par trois chemins, et c'est
  // précisément un bon signe — on garde donc toutes ses provenances
  const merged = new Map();
  for (const r of results) {
    if (!r?.list) continue;
    for (const c of r.list) {
      if (!c.tmdbId || !c.title) continue;
      const prev = merged.get(c.tmdbId);
      if (prev) { prev.sources.push(r); continue; }
      merged.set(c.tmdbId, { ...c, sources: [r] });
    }
  }

  const candidates = [...merged.values()]
    .filter((c) => !isSeen(c))
    .filter((c) => c.voteCount >= (query.minVotes || 0))
    .map((c) => ({ ...c, genres: c.genreIds.map((id) => genreMap.byId.get(id)).filter(Boolean) }));

  return { candidates, genreMap, sourcesUsed: { favs: favs.length, directors: dirs.length, plans: plans.length } };
}

/* ============================================================
   2. AFFINITÉ — à quel point cela vous ressemble
   ============================================================ */

export function affinity(c, taste) {
  if (taste.isEmpty) return 0.5;   // sans profil, tout se vaut : c'est le filtre qui décide

  // moyenne des poids de genre, les genres inconnus comptant pour zéro et non
  // comme une pénalité : découvrir un genre absent n'est pas un défaut d'affinité
  const gs = c.genres.map((g) => taste.genres.get(g) || 0);
  const genre = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;

  const dec = decadeOf(c.year);
  const decade = dec ? (taste.decades.get(dec) || 0) : 0;

  // remonté par un film que vous avez aimé : le signal le plus direct dont
  // on dispose, et le seul qui repose sur autre chose que des étiquettes
  const fromLiked = c.sources.filter((s) => s.kind === "reco");
  const recoBonus = fromLiked.length ? Math.min(1, 0.55 + 0.15 * fromLiked.length) : 0;

  const byDirector = c.sources.some((s) => s.kind === "director");
  const dirBonus = byDirector ? 0.9 : 0;

  // la note TMDB entre pour peu : elle dit la qualité perçue, pas l'accord
  const quality = clamp01((c.voteAverage - 5.5) / 3);

  const raw = 0.34 * genre + 0.12 * decade + 0.24 * recoBonus + 0.20 * dirBonus + 0.10 * quality;
  return clamp01((raw + 0.25) / 1.25);   // recentré : les poids négatifs peuvent tirer sous zéro
}

/* ============================================================
   3. NICHE — à quel point c'est hors des radars
   ============================================================ */

/* Un film de 1965 a mécaniquement moins de votes qu'un film de 2015 : compter
   les votes bruts ferait de tout vieux film une pépite. On rapporte donc le
   compte à ce qui est normal pour sa décennie. */
const EXPECTED_VOTES = (year) => {
  if (!year) return 2000;
  if (year < 1950) return 400;
  if (year < 1970) return 700;
  if (year < 1990) return 1200;
  if (year < 2005) return 2000;
  return 3000;
};

export function nicheFactors(c, taste) {
  // 1. obscurité — logarithmique : entre 200 et 2 000 votes il se passe bien
  // plus de choses qu'entre 40 000 et 50 000
  const obscurity = clamp01(1 - Math.log10(Math.max(c.voteCount, 1)) / Math.log10(50000));

  // 2. écart à la collection — délibérément indépendant de l'affinité :
  // c'est l'axe du dépaysement, pas celui du désaccord
  const newGenres = c.genres.length
    ? c.genres.filter((g) => !taste.seenGenres.has(g)).length / c.genres.length
    : 0;
  const dec = decadeOf(c.year);
  const newDecade = dec && !taste.seenDecades.has(dec) ? 1 : 0;
  const newLang = c.lang && taste.seenLanguages.size && !taste.seenLanguages.has(c.lang) ? 1 : 0;
  const drift = taste.isEmpty ? 0.5 : clamp01(0.5 * newGenres + 0.3 * newDecade + 0.2 * newLang);

  /* 3. non-anglophone. On sait rarement quelles langues la collection
     contient : les fiches importées ne portent pas ce champ. Sans cette
     connaissance on s'en tient au fait brut « ce n'est pas de l'anglais » —
     prétendre reconnaître une langue inédite alors qu'on n'en connaît aucune
     ferait dire au facteur, et à la justification affichée, plus que ce que
     les données permettent. */
  const knowsLangs = taste.seenLanguages.size > 0;
  const foreign = !c.lang || c.lang === "en" ? 0
    : !knowsLangs ? 0.7
    : taste.seenLanguages.has(c.lang) ? 0.6
    : 1;

  // 4. ancienneté — rampe sous 1980, doublée d'un « peu vu pour son époque »
  const old = !c.year ? 0 : clamp01((1985 - c.year) / 45);
  const rarity = clamp01(1 - c.voteCount / EXPECTED_VOTES(c.year));
  const age = clamp01(0.65 * old + 0.35 * old * rarity);

  return { obscurity, drift, foreign, age };
}

/* Les trois facteurs « obscurité / langue / ancienneté » composent le curseur
   niche. Le quatrième — l'écart à la collection — est piloté séparément :
   un film obscur peut être parfaitement dans vos habitudes, et un blockbuster
   coréen parfaitement dépaysant. Les confondre reviendrait à n'offrir qu'un
   seul bouton pour deux envies distinctes. */
export function nicheScore(factors, enabled = DEFAULT_QUERY.niche) {
  const parts = [];
  if (enabled.obscurity !== false) parts.push([factors.obscurity, 0.55]);
  if (enabled.foreign !== false) parts.push([factors.foreign, 0.25]);
  if (enabled.age !== false) parts.push([factors.age, 0.20]);
  if (!parts.length) return 0;
  const total = parts.reduce((a, [, w]) => a + w, 0);
  return parts.reduce((a, [v, w]) => a + v * w, 0) / total;
}

/* ============================================================
   4. CLASSEMENT
   ============================================================ */

/**
 * Classe les candidats. Pur : rejouable à chaque coup de curseur.
 * @returns les candidats enrichis de { affinity, niche, factors, score, reasons }
 */
export function rank(candidates, taste, query, limit = 40) {
  const nichePref = query.nichePref ?? 0.5;
  const driftPref = query.driftPref ?? 0.5;
  // ramené dans [-1, 1] : à gauche du curseur, l'écart devient une pénalité
  const driftCoef = (driftPref - 0.5) * 2;

  const scored = candidates.map((c) => {
    const factors = nicheFactors(c, taste);
    const aff = affinity(c, taste);
    const niche = nicheScore(factors, query.niche);
    /* Le curseur doit être symétrique : poussé à droite il réclame du
       confidentiel, poussé à gauche il doit réclamer du connu. L'affinité
       seule ne dit rien de la notoriété — un chef-d'œuvre invisible ressemble
       autant à vos goûts qu'un classique. D'où le terme de notoriété, qui ne
       pèse que du côté gauche du curseur. */
    const known = 1 - factors.obscurity;
    const score = (1 - nichePref) * (0.75 * aff + 0.25 * known)
      + nichePref * niche
      + driftCoef * factors.drift * 0.6;
    return { ...c, affinity: aff, niche, factors, score, reasons: reasonsFor(c, factors, taste) };
  });

  scored.sort((a, b) => b.score - a.score || b.voteAverage - a.voteAverage);

  /* Diversification : sans elle, un seul film adoré fait remonter ses dix
     recommandations d'affilée et la page ne parle plus que de lui. */
  const perSource = new Map();
  const kept = [];
  const spill = [];
  for (const c of scored) {
    const src = c.sources.find((s) => s.kind === "reco")?.from?.title
      || c.sources.find((s) => s.kind === "director")?.director;
    if (src) {
      const n = perSource.get(src) || 0;
      if (n >= 2) { spill.push(c); continue; }
      perSource.set(src, n + 1);
    }
    kept.push(c);
    if (kept.length >= limit) break;
  }
  // les évincés reviennent en fin de liste plutôt que de disparaître
  return [...kept, ...spill].slice(0, limit);
}

/* Une recommandation qu'on ne peut pas justifier n'en est pas une. */
export function reasonsFor(c, factors, taste) {
  const out = [];

  const liked = c.sources.filter((s) => s.kind === "reco").map((s) => s.from?.title).filter(Boolean);
  if (liked.length) {
    out.push(liked.length === 1
      ? `parce que vous avez aimé ${liked[0]}`
      : `dans le sillage de ${liked[0]} et ${liked.length - 1} autre${liked.length > 2 ? "s" : ""}`);
  }

  const dir = c.sources.find((s) => s.kind === "director")?.director;
  if (dir) out.push(`de ${dir}, que vous suivez`);

  if (factors.obscurity > 0.55) out.push(`${c.voteCount} votes seulement`);
  if (factors.foreign >= 1) out.push("dans une langue absente de votre collection");
  else if (factors.foreign > 0) out.push("non anglophone");

  if (factors.age > 0.5 && c.year) out.push(`un film de ${c.year}`);

  const newG = c.genres.filter((g) => !taste.seenGenres.has(g));
  if (newG.length && !taste.isEmpty) out.push(`un genre nouveau pour vous : ${newG[0]}`);
  else {
    const shared = c.genres.filter((g) => (taste.genres.get(g) || 0) > 0.4);
    if (shared.length) out.push(shared.slice(0, 2).join(", ").toLowerCase());
  }

  return out.slice(0, 3);
}
