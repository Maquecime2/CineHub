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
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
};
const writeCache = (c) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { console.error(e); }
};

export const cacheKeyOf = (title, year) => `${(title || "").toLowerCase().trim()}|${year || ""}`;

export const clearTmdbCache = () => { try { localStorage.removeItem(CACHE_KEY); } catch (e) { console.error(e); } };

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
  const directors = (data.credits?.crew || []).filter((c) => c.job === "Director").map((c) => c.name);
  return {
    tmdbId: data.id,
    director: directors.join(", "),
    genres: (data.genres || []).map((g) => g.name),
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
    // on ne stocke qu'un chemin (~30 octets) : l'image reste chez TMDB
    poster: data.poster_path ? `${POSTER_BASE}${data.poster_path}` : "",
  };
}

/* Résout une ligne d'import ; null si le film reste introuvable. */
async function resolveOne(row, apiKey, cache) {
  const key = cacheKeyOf(row.title, row.year);
  if (key in cache) return cache[key];
  const hit = await searchMovie({ title: row.title, year: row.year, apiKey });
  const info = hit ? await getDetails(hit.id, apiKey) : null;
  cache[key] = info;
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
  let done = 0, resolved = 0, failed = 0;

  const next = (() => { let i = 0; return () => i++; })();

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
