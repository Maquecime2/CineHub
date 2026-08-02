/* ============================================================
   TMDB — enrichissement des fiches importées (réalisateur, genres)
   Les exports Letterboxd ne contiennent que titre / année / note :
   le réalisateur, lui, doit être retrouvé auprès de TMDB.
   ============================================================ */

const BASE = "https://api.themoviedb.org/3";
// w342 : assez fin pour une carte, assez léger pour un mur de 500 affiches
export const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const CACHE_KEY = "tmdb-cache";

// le cache évite de reconsommer le quota à chaque réimport du même fichier
const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeCache = (c) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch (e) {
    console.error(e);
  }
};

export const cacheKeyOf = (title, year) => `${(title || "").toLowerCase().trim()}|${year || ""}`;

export const clearTmdbCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.error(e);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Un GET tolérant : 429 = on respire et on retente, le reste échoue franchement. */
async function get(path, params, apiKey, attempt = 0) {
  const qs = new URLSearchParams({ api_key: apiKey, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * (attempt + 1);
    await sleep(wait);
    return get(path, params, apiKey, attempt + 1);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

/* Vérifie qu'une clé est utilisable — sert au bouton « tester la clé ». */
export async function checkApiKey(apiKey) {
  try {
    await get("/configuration", {}, apiKey);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/* Recherche par titre + année, avec repli sans année (les années Letterboxd
   sont parfois décalées d'un an par rapport à la sortie TMDB). */
export async function searchMovie({ title, year, apiKey }) {
  const params = { query: title, include_adult: "false" };
  let data = await get("/search/movie", year ? { ...params, year: String(year) } : params, apiKey);
  if (!data.results?.length && year) {
    data = await get("/search/movie", params, apiKey);
  }
  return data.results?.[0] || null;
}

/* Détail + équipe : c'est là que se trouve le réalisateur. */
export async function getDetails(tmdbId, apiKey) {
  const data = await get(`/movie/${tmdbId}`, { append_to_response: "credits" }, apiKey);
  const directors = (data.credits?.crew || [])
    .filter((c) => c.job === "Director")
    .map((c) => c.name);
  return {
    tmdbId: data.id,
    director: directors.join(", "),
    genres: (data.genres || []).map((g) => g.name),
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
    // on ne stocke qu'un chemin (~30 octets) : l'image reste chez TMDB
    poster: data.poster_path ? `${POSTER_BASE}${data.poster_path}` : "",
  };
}

export const POSTER_THUMB = "https://image.tmdb.org/t/p/w185";

/* Toutes les affiches connues pour un film — plusieurs pays, plusieurs
   graphismes. On privilégie la langue d'origine et le français, puis les
   affiches sans texte (`iso_639_1: null`), et on classe par popularité. */
export async function listPosters({ tmdbId, title, year, apiKey }) {
  let id = tmdbId;
  if (!id) {
    const hit = await searchMovie({ title, year, apiKey });
    if (!hit) return { tmdbId: null, posters: [] };
    id = hit.id;
  }
  const data = await get(`/movie/${id}/images`, { include_image_language: "fr,en,null" }, apiKey);
  const posters = (data.posters || [])
    .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
    .slice(0, 24)
    .map((p) => ({
      thumb: `${POSTER_THUMB}${p.file_path}`,
      full: `${POSTER_BASE}${p.file_path}`,
      lang: p.iso_639_1 || "—",
      ratio: p.aspect_ratio,
    }));
  return { tmdbId: id, posters };
}

/* ============================================================
   DÉCOUVERTE — les appels qui servent aux recommandations.
   Ils ne résolvent pas un film connu : ils en cherchent d'inconnus.
   ============================================================ */

const DISC_KEY = "tmdb-disc";
const DISC_TTL = 7 * 24 * 3600 * 1000; // une semaine : assez frais, assez économe

/* Un cache à péremption, distinct de `tmdb-cache` : celui-ci mémorise des
   listes de candidats, qui vieillissent (un film sort, une note bouge), là où
   l'appariement titre → tmdbId, lui, est définitif. */
const readDisc = () => {
  try {
    return JSON.parse(localStorage.getItem(DISC_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeDisc = (c) => {
  try {
    localStorage.setItem(DISC_KEY, JSON.stringify(c));
  } catch {
    try {
      localStorage.removeItem(DISC_KEY);
    } catch {
      /* tant pis */
    }
  }
};

/* On ne met jamais en cache la réponse brute de TMDB : elle est dix fois plus
   grosse que ce qu'on en garde, et le quota localStorage est déjà disputé par
   les affiches. Seule la forme normalisée est stockée. */
async function cachedList(cacheKey, fetcher) {
  const cache = readDisc();
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.t < DISC_TTL) return hit.v;
  const v = await fetcher();
  cache[cacheKey] = { t: Date.now(), v };
  // purge paresseuse : au-delà de 300 entrées on jette les plus vieilles
  const keys = Object.keys(cache);
  if (keys.length > 300) {
    keys
      .sort((a, b) => cache[a].t - cache[b].t)
      .slice(0, keys.length - 300)
      .forEach((k) => delete cache[k]);
  }
  writeDisc(cache);
  return v;
}

export const clearDiscoverCache = () => {
  try {
    localStorage.removeItem(DISC_KEY);
  } catch (e) {
    console.error(e);
  }
};

/* La forme minimale qui suffit à scorer ET à afficher une carte. `/discover`
   et `/recommendations` renvoient déjà tout cela : aucun appel de détail
   supplémentaire n'est nécessaire pour classer un candidat. */
const toCandidate = (m) => ({
  tmdbId: m.id,
  title: m.title || m.original_title || "",
  year: m.release_date ? Number(m.release_date.slice(0, 4)) || null : null,
  poster: m.poster_path ? `${POSTER_BASE}${m.poster_path}` : "",
  genreIds: m.genre_ids || (m.genres || []).map((g) => g.id) || [],
  lang: m.original_language || "",
  voteCount: m.vote_count || 0,
  voteAverage: m.vote_average || 0,
  popularity: m.popularity || 0,
  // tronqué : multiplié par quelques centaines de candidats, le résumé
  // complet suffirait à saturer le quota à lui seul
  overview: (m.overview || "").slice(0, 240),
});

/* La table des genres : `/discover` veut des identifiants numériques, la
   collection ne connaît que des noms. Sans langue explicite — comme
   `getDetails`, qui a rempli les fiches — sinon les noms ne s'apparient plus. */
export async function getGenreMap(apiKey) {
  const list = await cachedList("genres", async () => {
    const data = await get("/genre/movie/list", {}, apiKey);
    return data.genres || [];
  });
  const byName = new Map(list.map((g) => [g.name.toLowerCase(), g.id]));
  const byId = new Map(list.map((g) => [g.id, g.name]));
  return { byName, byId, list };
}

/* `/discover` : le seul endpoint qui accepte « peu de votes mais bien noté »,
   c'est-à-dire la définition opérationnelle d'une pépite. */
export async function discover(params, apiKey) {
  const key = `d:${JSON.stringify(params)}`;
  return cachedList(key, async () => {
    const data = await get("/discover/movie", { include_adult: "false", ...params }, apiKey);
    return (data.results || []).map(toCandidate);
  });
}

/* `/recommendations` plutôt que `/similar` : le premier s'appuie sur les
   comportements réels, le second sur une simple intersection de genres. */
export async function recommendationsFor(tmdbId, apiKey) {
  return cachedList(`r:${tmdbId}`, async () => {
    const data = await get(`/movie/${tmdbId}/recommendations`, {}, apiKey);
    return (data.results || []).map(toCandidate);
  });
}

export async function searchPerson(name, apiKey) {
  return cachedList(`p:${name.toLowerCase()}`, async () => {
    const data = await get("/search/person", { query: name }, apiKey);
    const hit = data.results?.[0];
    return hit ? { id: hit.id, name: hit.name } : null;
  });
}

/* La filmographie de réalisateur·rice — uniquement le poste de réalisation :
   un acteur qui a tourné dans trente films n'a pas signé trente films. */
export async function directorFilmography(personId, apiKey) {
  return cachedList(`pc:${personId}`, async () => {
    const data = await get(`/person/${personId}/movie_credits`, {}, apiKey);
    return (data.crew || []).filter((c) => c.job === "Director").map(toCandidate);
  });
}

/* Exécute des tâches par petits paquets — même worker-pool que `enrichRows`,
   mais générique, et qui avale les échecs : une requête perdue ne doit pas
   annuler toute une recherche. */
export async function pooled(tasks, { concurrency = 5, onProgress } = {}) {
  const out = new Array(tasks.length).fill(null);
  let done = 0;
  const next = (() => {
    let i = 0;
    return () => i++;
  })();
  const worker = async () => {
    for (let i = next(); i < tasks.length; i = next()) {
      try {
        out[i] = await tasks[i]();
      } catch (e) {
        console.warn("TMDB", e.message || e);
      }
      onProgress?.(++done, tasks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return out;
}

/* Un échec de recherche se périme : le catalogue TMDB s'étoffe, et un titre
   introuvable aujourd'hui ne doit pas l'être pour toujours. Les succès, eux,
   ne bougent pas — un film ne change ni de réalisateur ni d'année. */
const MISS_TTL = 30 * 24 * 3600 * 1000;
const missEntry = () => ({ miss: Date.now() });
const isMiss = (v) => v != null && typeof v === "object" && typeof v.miss === "number";

/* Ce que le cache a à dire sur une clé : `hit` distingue « rien de mémorisé »
   d'un « mémorisé comme introuvable », que null seul confondait. */
function cacheLookup(cache, key) {
  if (!(key in cache)) return { hit: false };
  const v = cache[key];
  // les échecs des versions précédentes étaient stockés en null, sans date :
  // impossible de les périmer, on préfère les retenter une fois.
  if (v == null) {
    delete cache[key];
    return { hit: false };
  }
  if (isMiss(v)) {
    if (Date.now() - v.miss < MISS_TTL) return { hit: true, info: null };
    delete cache[key];
    return { hit: false };
  }
  return { hit: true, info: v };
}

/* Résout une ligne d'import ; null si le film reste introuvable.
   Une erreur (réseau, quota, clé) remonte telle quelle et n'est jamais
   mémorisée : le réimport suivant doit pouvoir réussir. */
async function resolveOne(row, apiKey, cache) {
  const key = cacheKeyOf(row.title, row.year);
  const known = cacheLookup(cache, key);
  if (known.hit) return known.info;
  const hit = await searchMovie({ title: row.title, year: row.year, apiKey });
  const info = hit ? await getDetails(hit.id, apiKey) : null;
  cache[key] = info || missEntry();
  return info;
}

/**
 * Enrichit un lot de lignes. Ne rejette jamais : un film non résolu (réseau,
 * quota, titre introuvable) ressort tel quel et l'import continue sans lui.
 * Retourne { rows, resolved, failed }.
 */
export async function enrichRows(rows, apiKey, { onProgress, concurrency = 5 } = {}) {
  const cache = readCache();
  const out = rows.slice();
  let done = 0,
    resolved = 0,
    failed = 0;

  const next = (() => {
    let i = 0;
    return () => i++;
  })();

  const worker = async () => {
    for (let i = next(); i < rows.length; i = next()) {
      try {
        const info = await resolveOne(rows[i], apiKey, cache);
        if (info) {
          resolved++;
          out[i] = {
            ...rows[i],
            director: info.director || "",
            genres: info.genres || [],
            poster: info.poster || "",
            tmdbId: info.tmdbId,
            year: rows[i].year || info.year || "",
          };
        } else failed++;
      } catch (e) {
        failed++;
        console.warn("TMDB", rows[i]?.title, e.message || e);
      }
      done++;
      onProgress?.(done, rows.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  writeCache(cache);
  return { rows: out, resolved, failed };
}
