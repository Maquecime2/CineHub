/* ============================================================
   RECOMMENDATIONS — harvest, then ranking.

   Two clearly separated storeys:
     · `gatherCandidates` talks to TMDB and judges nothing;
     · `affinity` / `nicheScore` / `rank` are pure and offline.

   That separation is what lets a ranking be replayed when a slider
   moves, without asking the network for anything again.
   ============================================================ */

import {
  discover,
  recommendationsFor,
  searchPerson,
  directorFilmography,
  getGenreMap,
  pooled,
} from "./tmdb";
import { favorites, topDirectors, decadeOf } from "./taste";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* The credibility floor. Below it, "little seen" no longer means
   anything: it is catalogue noise, not a gem. */
export const DEFAULT_MIN_VOTES = 30;

/* CE QUI SÉPARE UN LONG D'UN COURT, en minutes. Quarante est la
   frontière d'usage — celle des académies et des festivals — et non un
   chiffre choisi ici. Elle est exportée parce que la vue l'ANNONCE :
   « écarte tout ce qui dure moins de quarante minutes » se lit, là où un
   seuil caché se soupçonne. */
export const FEATURE_MIN = 40;

export const DEFAULT_QUERY = {
  yearFrom: "",
  yearTo: "",
  withGenres: [], // names, as stored on the cards
  withoutGenres: [],
  language: "", // ISO code; "" = no preference
  minVotes: DEFAULT_MIN_VOTES,
  minRating: 6, // TMDB rating floor
  nichePref: 0.5, // 0 = mainstream · 1 = gem
  driftPref: 0.5, // 0 = within my taste · 1 = off the beaten track
  excludeWatchlist: true,
  /* Les courts métrages sont légion sous le plancher de votes — c'est
     là qu'ils vivent — et on ne cherche pas un film pour ce soir en
     ouvrant une planche de bobines de huit minutes. */
  noShorts: true,
  // the niche factors we actually want to bring into play
  niche: { obscurity: true, foreign: true, age: true },
};

/* ============================================================
   1. HARVEST
   ============================================================ */

/* The `/discover` queries sent. Several sorts rather than one: sorting
   by average rating brings up the confidential, sorting by popularity
   brings up the obvious — a "niche" slider with a single source of
   candidates could arbitrate nothing at all. */
/* Exportée pour être éprouvée, et pour cela seulement : ce qu'elle
   compose part sur le réseau, donc une erreur de paramètre ne se voit
   qu'au nombre de résultats — c'est-à-dire jamais. */
export function discoverPlans(query, taste, genreMap) {
  const ids = (names) => names.map((n) => genreMap.byName.get(n.toLowerCase())).filter(Boolean);

  const base = {
    "vote_count.gte": String(Math.max(1, query.minVotes || DEFAULT_MIN_VOTES)),
    "vote_average.gte": String(query.minRating || 0),
  };
  if (query.yearFrom) base["primary_release_date.gte"] = `${query.yearFrom}-01-01`;
  if (query.yearTo) base["primary_release_date.lte"] = `${query.yearTo}-12-31`;
  if (query.language) base.with_original_language = query.language;
  /* `/discover` sait filtrer sur la durée, donc on ne ramène pas les
     courts pour les jeter ensuite : les écarter au tri gâcherait des
     pages entières de résultats — et donc du quota — pour rien. */
  if (query.noShorts) base["with_runtime.gte"] = String(FEATURE_MIN);

  const withIds = ids(query.withGenres || []);
  const withoutIds = ids(query.withoutGenres || []);
  if (withIds.length) base.with_genres = withIds.join(",");
  if (withoutIds.length) base.without_genres = withoutIds.join(",");

  // failing any requested genres, we start from those the collection likes
  if (!withIds.length && !taste.isEmpty) {
    const liked = [...taste.genres.entries()]
      .filter(([, w]) => w > 0.35)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const likedIds = ids(liked.map(([n]) => n));
    // `|` and not `,`: one OR the other, otherwise the intersection of the three is empty
    if (likedIds.length) base.with_genres = likedIds.join("|");
  }

  const plans = [
    { ...base, sort_by: "vote_average.desc", page: "1" },
    { ...base, sort_by: "vote_average.desc", page: "2" },
    { ...base, sort_by: "popularity.desc", page: "1" },
  ];

  // a vote ceiling forces TMDB to return ONLY the confidential: without
  // it, the same classics hog the first pages whatever the sort
  if (query.nichePref > 0.35) {
    plans.push({ ...base, "vote_count.lte": "1200", sort_by: "vote_average.desc", page: "1" });
    plans.push({ ...base, "vote_count.lte": "1200", sort_by: "vote_average.desc", page: "2" });
  }
  return plans;
}

/**
 * Queries TMDB and merges everything that comes back, ranking nothing.
 *
 * @param {object}   opts.taste    profile coming from buildTaste
 * @param {Array}    opts.films    the collection, for the "because you loved" lines
 * @param {function} opts.isSeen   (candidate) => bool — the exclusion belongs to the
 *                                 caller, who alone knows their own matching key
 * @returns {{ candidates: Array, genreMap, sourcesUsed }}
 */
export async function gatherCandidates({
  query,
  taste,
  films,
  apiKey,
  isSeen = () => false,
  onProgress,
}) {
  const genreMap = await getGenreMap(apiKey);

  const favs = taste.isEmpty ? [] : favorites(films, 12);
  const dirs = taste.isEmpty ? [] : topDirectors(films, taste, 4);
  const plans = discoverPlans(query, taste, genreMap);

  const tasks = [
    ...plans.map((p) => async () => ({ kind: "discover", list: await discover(p, apiKey) })),
    ...favs.map((f) => async () => ({
      kind: "reco",
      from: { title: f.title, rating: f.rating },
      list: await recommendationsFor(f.tmdbId, apiKey),
    })),
    ...dirs.map((d) => async () => {
      const person = await searchPerson(d.name, apiKey);
      if (!person) return null;
      return {
        kind: "director",
        director: d.name,
        list: await directorFilmography(person.id, apiKey),
      };
    }),
  ];

  const results = await pooled(tasks, { concurrency: 5, onProgress });

  // merging by tmdbId: the same film can arrive by three paths, and that
  // is precisely a good sign — so we keep all its provenances
  const merged = new Map();
  for (const r of results) {
    if (!r?.list) continue;
    for (const c of r.list) {
      if (!c.tmdbId || !c.title) continue;
      const prev = merged.get(c.tmdbId);
      if (prev) {
        prev.sources.push(r);
        continue;
      }
      merged.set(c.tmdbId, { ...c, sources: [r] });
    }
  }

  const candidates = [...merged.values()]
    .filter((c) => !isSeen(c))
    .filter((c) => c.voteCount >= (query.minVotes || 0))
    .map((c) => ({ ...c, genres: c.genreIds.map((id) => genreMap.byId.get(id)).filter(Boolean) }));

  return {
    candidates,
    genreMap,
    sourcesUsed: { favs: favs.length, directors: dirs.length, plans: plans.length },
  };
}

/* ============================================================
   2. AFFINITY — how much it looks like you
   ============================================================ */

export function affinity(c, taste) {
  if (taste.isEmpty) return 0.5; // with no profile everything is equal: the filter decides

  // mean of the genre weights, unknown genres counting as zero and not as
  // a penalty: discovering an absent genre is not a lack of affinity
  const gs = c.genres.map((g) => taste.genres.get(g) || 0);
  const genre = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : 0;

  const dec = decadeOf(c.year);
  const decade = dec ? taste.decades.get(dec) || 0 : 0;

  // brought up by a film you loved: the most direct signal we have, and
  // the only one resting on something other than tags
  const fromLiked = c.sources.filter((s) => s.kind === "reco");
  const recoBonus = fromLiked.length ? Math.min(1, 0.55 + 0.15 * fromLiked.length) : 0;

  const byDirector = c.sources.some((s) => s.kind === "director");
  const dirBonus = byDirector ? 0.9 : 0;

  // the TMDB rating counts for little: it says perceived quality, not agreement
  const quality = clamp01((c.voteAverage - 5.5) / 3);

  const raw = 0.34 * genre + 0.12 * decade + 0.24 * recoBonus + 0.2 * dirBonus + 0.1 * quality;
  return clamp01((raw + 0.25) / 1.25); // recentred: negative weights can pull below zero
}

/* ============================================================
   3. NICHE — how far off the radar it is
   ============================================================ */

/* A 1965 film mechanically has fewer votes than a 2015 one: counting raw
   votes would make every old film a gem. So we relate the count to what
   is normal for its decade. */
const EXPECTED_VOTES = (year) => {
  if (!year) return 2000;
  if (year < 1950) return 400;
  if (year < 1970) return 700;
  if (year < 1990) return 1200;
  if (year < 2005) return 2000;
  return 3000;
};

export function nicheFactors(c, taste) {
  // 1. obscurity — logarithmic: between 200 and 2,000 votes a great deal
  // happens; between 20,000 and 200,000, almost nothing
  const obscurity = clamp01(1 - Math.log10(Math.max(c.voteCount, 1)) / Math.log10(50000));

  // 2. distance from the collection — deliberately independent of
  // affinity: this is the axis of the change of scene, not disagreement
  const newGenres = c.genres.length
    ? c.genres.filter((g) => !taste.seenGenres.has(g)).length / c.genres.length
    : 0;
  const dec = decadeOf(c.year);
  const newDecade = dec && !taste.seenDecades.has(dec) ? 1 : 0;
  const newLang = c.lang && taste.seenLanguages.size && !taste.seenLanguages.has(c.lang) ? 1 : 0;
  const drift = taste.isEmpty ? 0.5 : clamp01(0.5 * newGenres + 0.3 * newDecade + 0.2 * newLang);

  /* 3. non-English. We rarely know which languages the collection
     holds: imported cards do not carry that field. Without that
     knowledge we stick to the bare fact "this is not English" —
     claiming to recognise an unheard-of language while knowing none
     at all would make the factor, and the reason displayed, say more
     than the data allows. */
  const knowsLangs = taste.seenLanguages.size > 0;
  const foreign =
    !c.lang || c.lang === "en" ? 0 : !knowsLangs ? 0.7 : taste.seenLanguages.has(c.lang) ? 0.6 : 1;

  // 4. age — a ramp below 1980, doubled by a "little seen for its time"
  const old = !c.year ? 0 : clamp01((1985 - c.year) / 45);
  const rarity = clamp01(1 - c.voteCount / EXPECTED_VOTES(c.year));
  const age = clamp01(0.65 * old + 0.35 * old * rarity);

  return { obscurity, drift, foreign, age };
}

/* The three factors "obscurity / language / age" make up the niche
   slider. The fourth — distance from the collection — is driven
   separately: an obscure film can be perfectly within your habits, and
   a Korean blockbuster perfectly disorienting. Conflating them would
   amount to offering one slider where there are two questions. */
export function nicheScore(factors, enabled = DEFAULT_QUERY.niche) {
  const parts = [];
  if (enabled.obscurity !== false) parts.push([factors.obscurity, 0.55]);
  if (enabled.foreign !== false) parts.push([factors.foreign, 0.25]);
  if (enabled.age !== false) parts.push([factors.age, 0.2]);
  if (!parts.length) return 0;
  const total = parts.reduce((a, [, w]) => a + w, 0);
  return parts.reduce((a, [v, w]) => a + v * w, 0) / total;
}

/* ============================================================
   4. CLASSEMENT
   ============================================================ */

/**
 * Ranks the candidates. Pure: replayable on every slider move.
 * @returns the candidates enriched with { affinity, niche, factors, score, reasons }
 */
export function rank(candidates, taste, query, limit = 40) {
  const nichePref = query.nichePref ?? 0.5;
  const driftPref = query.driftPref ?? 0.5;
  // brought into [-1, 1]: left of the slider, the gap becomes a penalty
  const driftCoef = (driftPref - 0.5) * 2;

  const scored = candidates.map((c) => {
    const factors = nicheFactors(c, taste);
    const aff = affinity(c, taste);
    const niche = nicheScore(factors, query.niche);
    /* The slider must be symmetric: pushed right it asks for the
       confidential, pushed left it must ask for the well known.
       Affinity alone says nothing about fame — an invisible masterpiece
       resembles your taste as much as a classic. Hence the fame term,
       which only weighs on the slider's left-hand side. */
    const known = 1 - factors.obscurity;
    const score =
      (1 - nichePref) * (0.75 * aff + 0.25 * known) +
      nichePref * niche +
      driftCoef * factors.drift * 0.6;
    return { ...c, affinity: aff, niche, factors, score, reasons: reasonsFor(c, factors, taste) };
  });

  scored.sort((a, b) => b.score - a.score || b.voteAverage - a.voteAverage);

  /* Diversification: without it, a single beloved film brings up its ten
     recommendations in a row and the page talks about nothing else. */
  const perSource = new Map();
  const kept = [];
  const spill = [];
  for (const c of scored) {
    const src =
      c.sources.find((s) => s.kind === "reco")?.from?.title ||
      c.sources.find((s) => s.kind === "director")?.director;
    if (src) {
      const n = perSource.get(src) || 0;
      if (n >= 2) {
        spill.push(c);
        continue;
      }
      perSource.set(src, n + 1);
    }
    kept.push(c);
    if (kept.length >= limit) break;
  }
  // those bumped come back at the end of the list rather than vanishing
  return [...kept, ...spill].slice(0, limit);
}

/* A recommendation one cannot justify is not one. */
export function reasonsFor(c, factors, taste) {
  const out = [];

  const liked = c.sources
    .filter((s) => s.kind === "reco")
    .map((s) => s.from?.title)
    .filter(Boolean);
  if (liked.length) {
    out.push(
      liked.length === 1
        ? `parce que vous avez aimé ${liked[0]}`
        : `dans le sillage de ${liked[0]} et ${liked.length - 1} autre${liked.length > 2 ? "s" : ""}`
    );
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
