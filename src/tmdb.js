/* ============================================================
   TMDB — enriching imported cards (director, genres)
   Letterboxd exports hold only title / year / rating: the director has
   to be found again from TMDB.
   ============================================================ */

import { canonicalGenres } from "./domain/genres";
import { ADDRESS } from "./services/server";
import { writtenKey, VIA_SERVER } from "./services/tmdbKey";

const BASE = "https://api.themoviedb.org/3";
// w342: fine enough for a card, light enough for a wall of 500 posters
export const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
/* LES DEUX TAILLES D'UN PHOTOGRAMME. w300 pour la bande — vingt-cinq
   kilo-octets, six d'entre eux tiennent dans ce qu'une seule affiche
   coûte —, w1280 une fois ouvert. Ce sont des PRÉFIXES : la fiche ne
   stocke que le chemin, voir `getDetails`. */
export const FRAME_THUMB = "https://image.tmdb.org/t/p/w300";
export const FRAME_FULL = "https://image.tmdb.org/t/p/w1280";
const CACHE_KEY = "tmdb-cache";

/* THE SHAPE OF WHAT WE MEMORISE, AND WHY IT CARRIES A NUMBER.

   The cache is eternal by design: a film changes neither director nor
   year, and re-querying it would burn the quota for nothing. But that
   reasoning only holds for the fields we were ALREADY asking for. The
   day `getDetails` started bringing back the runtime, the country and
   the language, the entries memorised the day before became truncated
   answers — and the cache, which does not know it is behind, served them
   as complete ones.

   That is where "completing the cards does nothing" came from: the card
   was correctly recognised as incomplete, the call was correctly fired,
   and it came back from `localStorage` as empty as it went out. No
   error, no count at zero, nothing to catch hold of.

   The number settles that once and for all: an entry of another shape is
   not an answer, it is an absence. We throw it away and ask again. TO BE
   INCREMENTED as soon as a field is added to `getDetails`. */
/* 4: entries of shape 3 carry `keywords: []` where the joined resource
   had not come back — an emptiness passing itself off as an answer.
   Keeping them would make the repair impossible: we would ask again, and
   the cache would serve the same lie.

   5: `synopsis`. Entries of shape 4 hold none, and the field arrives
   empty rather than absent — so a card completed from one of them would
   look answered and never be asked again. The bump is what makes the
   whole cache re-earn its keep; nothing else here has to know.

   6: `frames`. Same reasoning, and the same trap: an entry of shape 5
   would hand back an empty list, which reads as "TMDB has no still" and
   is never asked again.

   7 : les photogrammes, tous et non plus six. Une entrée de forme 6 en
   tient six, et six n'est pas une réponse fausse — c'est ce qui rend
   celui-ci différent des précédents. Mais le cache est ÉTERNEL : sans ce
   numéro, un classeur rempli avant ce jour n'en verrait jamais plus de
   six, sans que rien ne le dise et sans qu'aucun geste puisse y mener. */
const SHAPE = 7;

// the cache avoids burning the quota again on every re-import of the same file
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

/* The key of a film we know by its identifier. It MUST be distinct from
   `title|year`: two films can carry the same title in the same year, and
   would then share a single entry — one would take the other's director
   and poster. */
export const cacheKeyOfId = (tmdbId) => `id:${tmdbId}`;

/* A MANUAL CORRECTION IS WRITTEN INTO THE CACHE, otherwise it only
   holds for a while: the cache still maps `title|year` to the wrong
   identifier, and the next import of the same title serves it up as if
   nothing had happened. So we write BOTH keys — the title's, which was
   wrong, and that of the identifier chosen. */
export function rememberResolution(title, year, info) {
  if (!info?.tmdbId) return;
  const cache = readCache();
  cache[cacheKeyOf(title, year)] = info;
  cache[cacheKeyOfId(info.tmdbId)] = info;
  writeCache(cache);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   BY ONESELF, OR THROUGH THE SERVER
   ============================================================

   The server has relayed eleven TMDB paths since it existed, keeps ITS
   key and only accepts people who are signed in — and the binder had
   never called it, for want of a single place to decide. Here it is:
   every call in this module goes through this function, and it is the
   only line to change for an account to do away with a key.

   `credentials: "include"`: the session cookie comes from a different
   origin than the page, and without this line the server sees a
   stranger.

   WE PUSH NO KEY to the relay — not even a local one if it exists. It
   has no business in a request to our own server, which would throw it
   away anyway: it is its own that it uses.

   AND WE STEP BACK DOWN IF THE RELAY RECUSES ITSELF. Three answers say
   the relay can do nothing for us, and none of them says TMDB has
   nothing: 401 and 403 (the session expired while the tab slept), and
   503 (the server runs with no key of its own). In those three cases a
   key that was set may be sleeping alongside — we go back down the
   direct route rather than leave the binder mute.

   A 404 does NOT step back down: it would mean a path missing from the
   relay's list, that is to say a list to correct. Quietly working around
   it would make the flaw invisible for ever. */
const RECUSED = new Set([401, 403, 503]);

/* HOW LONG TO WAIT, ACCORDING TO WHOEVER IS REFUSING.

   `retry-after` is counted in SECONDS, and it is the only right answer:
   an invented wait is either too short — we get refused again inside the
   same window, having burned an attempt for nothing — or too long, and
   we keep somebody waiting for no reason.

   The stepped fallback only serves when the header is missing: a server
   that does not set it, or an answer from another origin where it is not
   exposed (see `exposedHeaders` on the server side). We cap it at a
   minute: beyond that, better to hand back control than hold a whole
   completion run up on a single card. */
const MINUTE = 60_000;
const waitAfter = (res, attempt) => {
  const told = Number(res.headers.get("retry-after"));
  if (Number.isFinite(told) && told > 0) return Math.min(told * 1000, MINUTE);
  return 1000 * (attempt + 1);
};

async function get(path, params, apiKey, attempt = 0) {
  if (apiKey === VIA_SERVER) {
    const qs = new URLSearchParams(params);
    const res = await fetch(`${ADDRESS}/tmdb${path}?${qs}`, { credentials: "include" });
    if (res.ok) return res.json();
    /* OUR OWN SERVER CAN SAY 429 TOO, and not only TMDB: the relay has
       its own per-minute cap. Completing a collection necessarily
       crosses it — it is a long job, not a loop — and we must then wait
       for the time IT STATES, not a second drawn at random. That is what
       the direct route already did, further down; the relay route had
       lost it along the way. */
    if (res.status === 429 && attempt < 3) {
      await sleep(waitAfter(res, attempt));
      return get(path, params, apiKey, attempt + 1);
    }
    const ownKey = writtenKey();
    if (RECUSED.has(res.status) && ownKey) return get(path, params, ownKey, attempt);
    throw new Error(`TMDB ${res.status}`);
  }

  const qs = new URLSearchParams({ api_key: apiKey, ...params });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (res.status === 429 && attempt < 3) {
    await sleep(waitAfter(res, attempt));
    return get(path, params, apiKey, attempt + 1);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

/* Checks that a key is usable — serves the "test the key" button. */
export async function checkApiKey(apiKey) {
  try {
    await get("/configuration", {}, apiKey);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/* Search by title + year, with a fallback without the year (Letterboxd
   years are sometimes a year off from the TMDB release). */
export async function searchMovie({ title, year, apiKey }) {
  const params = { query: title, include_adult: "false" };
  let data = await get("/search/movie", year ? { ...params, year: String(year) } : params, apiKey);
  if (!data.results?.length && year) {
    data = await get("/search/movie", params, apiKey);
  }
  return data.results?.[0] || null;
}

/* SEVERAL RESULTS, AND NOT THE FIRST.

   `searchMovie` takes `results[0]` without looking: that is what is
   needed to enrich five hundred rows at once, and it is exactly where
   the identity mistakes come from. Two "Resurrection" thirty years
   apart, and the collection follows the wrong one all its life — wrong
   poster, wrong crew, and a wake offering the real film as though it
   were another.

   Correcting that means SEEING the homonyms. Hence this variant, which
   decides nothing and returns the list as it is: it is the human eye
   that decides, one card at a time. */
/* `year` has a default value, and it is not a convenience: without it,
   TypeScript infers it as MANDATORY from this JavaScript module, and the
   only caller — the identity correction — deliberately leaves it out,
   the year written on the card being precisely the one we suspect of
   being wrong. */
export async function searchMovies({ title, year = null, apiKey, limit = 12 }) {
  const params = { query: title, include_adult: "false" };
  let data = await get("/search/movie", year ? { ...params, year: String(year) } : params, apiKey);
  /* The fallback without the year matters MORE here than elsewhere:
     when we come to correct an identity, the year written on the card is
     often the very thing that is wrong. */
  if (!data.results?.length && year) data = await get("/search/movie", params, apiKey);
  return (data.results || []).slice(0, limit).map((m) => ({
    tmdbId: m.id,
    title: m.title || m.original_title || "",
    original: m.original_title || "",
    year: m.release_date ? Number(m.release_date.slice(0, 4)) || null : null,
    poster: m.poster_path ? `${POSTER_THUMB}${m.poster_path}` : "",
    overview: (m.overview || "").slice(0, 200),
    lang: m.original_language || "",
    /* COMBIEN DE GENS L'ONT NOTÉ — la seule mesure d'audience que TMDB
       expose, et celle sur laquelle les propositions se rangent
       (`domain/proposals`). `toCandidate` la ramenait déjà ; cette route
       la jetait, si bien que la même liste se rangeait autrement selon
       la porte par laquelle elle était arrivée. */
    voteCount: m.vote_count || 0,
  }));
}

/* THE THREE TRADES WE KEEP, and the TMDB job titles that designate
   them. Three and not thirty: a whole crew counts two hundred names, the
   overwhelming majority of which never link two films together and would
   weigh on `localStorage` for nothing.

   These do. A cinematographer followed from film to film says something
   about a collection; the third assistant set decorator says nothing.

   THE KEYS STAY FRENCH: they are `Film.crew`'s, written on every card. */
const CREW_JOBS = {
  image: ["Director of Photography", "Cinematography"],
  musique: ["Original Music Composer", "Music"],
  scénario: ["Screenplay", "Writer"],
};

/* The first eight roles, as TMDB ranks them — that is to say in billing
   order. Beyond that we get into the walk-ons and the crowd voices:
   noise, and weight. */
const ROLES = 8;

/* Le plafond des photogrammes. Voir `getDetails` : il borne l'absurde,
   pas le confort. */
const FRAMES = 80;

/* Detail + crew: that is where the director is. */
export async function getDetails(tmdbId, apiKey) {
  /* THE KEYWORDS COME IN THE SAME REQUEST, AND THAT IS THE WHOLE POINT.

     `append_to_response` accepts several resources separated by commas:
     asking for them here costs not one more call, not one more quota
     token, not one more millisecond. Harvesting them separately — which
     is what `fetchKeywords` does for the open card — would double the
     number of calls of a full import for the same thing. */
  /* LES PHOTOGRAMMES VOYAGENT DANS LA MÊME REQUÊTE, et c'est tout leur
     coût : `append_to_response` en accepte autant qu'on veut, donc pas un
     appel de plus, pas un jeton de quota de plus. `include_image_language`
     est un paramètre de PREMIER niveau — il s'applique à la ressource
     jointe, et `null` y désigne les images SANS TEXTE, qui sont celles
     qu'on veut : une image portant le titre incrusté en coréen n'est plus
     un plan du film, c'est une affiche. */
  const data = await get(
    `/movie/${tmdbId}`,
    { append_to_response: "credits,keywords,images", include_image_language: "null,en,fr" },
    apiKey
  );

  /* THE FALLBACK ON THE DEDICATED ENDPOINT.

     If the joined resource did not come back, we ask for it separately
     rather than returning "we do not know" and leaving the card empty
     for ever. One more call, and only in that case; `fetchKeywords` is
     cached anyway, and it is the same call as the open card's — often
     already paid for.

     We always tell absence from emptiness: if THAT second call fails in
     its turn, it returns `[]`, but we do not write it — we go back to
     `undefined`, so that the card stays repairable. */
  let keywords;
  if (data.keywords?.keywords) keywords = data.keywords.keywords;
  else {
    const fallback = await fetchKeywords(tmdbId, apiKey);
    keywords = fallback.length ? fallback : undefined;
  }

  const crewList = data.credits?.crew || [];
  const directors = crewList.filter((c) => c.job === "Director").map((c) => c.name);

  /* THE ANNOTATION BELOW IS NECESSARY, AND IT HOLDS FOR EVERY CALLER.

     This module is in JavaScript, and TypeScript infers an object's type
     from its DECLARATION: a `{}` filled in later, key by key, stays a
     `{}` in its eyes. `getDetails` therefore announced a `crew` with no
     possible key, and every caller had to restore the truth with an
     assertion of their own — one per call site, to be copied for every
     new one, and wrong the day the shape changed here.

     One line at the source avoids all the others. It sits in a `/**`
     block of its own: TypeScript reads ONLY those, and a `@type` buried
     in an ordinary comment is ignored without a word — which is exactly
     what happened while writing these lines. */
  /** @type {Record<string, string[]>} */
  const crew = {};
  for (const [trade, jobTitles] of Object.entries(CREW_JOBS)) {
    const names = [
      ...new Set(crewList.filter((c) => jobTitles.includes(c.job)).map((c) => c.name)),
    ];
    if (names.length) crew[trade] = names;
  }

  return {
    v: SHAPE,
    tmdbId: data.id,
    director: directors.join(", "),
    /* UNE SEULE ORTHOGRAPHE PAR GENRE. TMDB les sert dans la langue
       demandée, et un classeur rempli sur deux navigateurs réglés
       autrement se retrouvait avec « Science Fiction » ET
       « Science-Fiction » comme deux genres distincts. Voir
       `domain/genres` : on choisit une graphie, on ne traduit pas. */
    genres: canonicalGenres((data.genres || []).map((g) => g.name)),
    /* THE SUMMARY IS NOT TRUNCATED HERE, unlike `toCandidate`'s. There
       it is cut to 240 because a discovery sweep holds a few hundred at
       once and the full text would saturate the quota on its own; this
       one is asked for a single film and is written on its card, where
       reading it whole is the entire point. */
    synopsis: data.overview || "",
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
    // we store only a path (~30 bytes): the image stays at TMDB
    poster: data.poster_path ? `${POSTER_BASE}${data.poster_path}` : "",
    /* LES CHEMINS NUS, ET NON DES ADRESSES — la seule chose de ce module
       qui s'écarte de ce que fait `poster` juste au-dessus, et c'est
       délibéré : un photogramme se montre en deux tailles, petit dans la
       bande et grand une fois ouvert. Écrire l'adresse figerait la
       taille au moment de la moisson, et la changer demanderait de
       réécrire toutes les fiches. `theme` compose, la fiche stocke.

       TOUS, TRIÉS PAR LE VOTE — et il n'y avait que six.

       « Ça risque quoi ? » est la bonne question, et la réponse est
       presque rien. Un photogramme est un CHEMIN d'une trentaine
       d'octets : les soixante-dix-sept d'un film pèsent moins de trois
       kilo-octets sur une fiche qui en fait déjà plusieurs. Et la
       planche les charge en `loading="lazy"` (`stills/shots`), donc ce
       qu'on ne fait pas défiler n'est jamais demandé — le coût
       d'ouverture d'une fiche ne bouge pas.

       Le plafond reste, et il ne borne plus le confort mais l'ABSURDE :
       quelques fiches très courues en tiennent plusieurs centaines, et
       une fiche n'a pas à peser cela pour rien. Le tri par vote garde le
       meilleur en tête, donc ce qui tombe est toujours la queue. */
    frames: (data.images?.backdrops || [])
      .slice()
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, FRAMES)
      .map((b) => b.file_path)
      .filter(Boolean),
    cast: (data.credits?.cast || []).slice(0, ROLES).map((c) => c.name),
    crew,
    /* THE RUNTIME, AND WHY `null` RATHER THAN ZERO. TMDB sometimes
       returns 0 for a film whose runtime it does not know. Keeping it as
       it is would let a zero into the almanac's averages and pull "a
       screening's mean runtime" down without anyone knowing why. An
       unknown runtime must be able to be RULED OUT of a calculation,
       which a zero does not allow. */
    runtime: data.runtime || null,
    language: data.original_language || "",
    /* Two countries at most: a co-production sometimes lines up six,
       and the sixth financier says nothing about the film we watched. */
    countries: (data.production_countries || []).slice(0, 2).map((c) => c.iso_3166_1),
    // same reason as the runtime: 0 means "not rated yet"
    tmdbRating: data.vote_average || null,
    /* THE KEYWORDS, KEPT THIS TIME.

       They had long been harvested and thrown away at once: they only
       served to offer motifs to confirm on the open card. Yet they are
       the ONLY thematic information TMDB gives — motifs and your own
       keywords are set by hand, and on an imported collection they are
       empty. So a film's wake had nothing but people's names to bring
       together.

       They do not replace the motifs and do not mix with them: a motif
       is a word YOU chose to follow, a keyword is what TMDB wrote. They
       live side by side, like `themes` and `motifs`, and the wake weighs
       them differently.

       Twenty at most: popular cards sometimes carry a hundred, and the
       tail of the list is dust ("based on novel",
       "duringcreditsstinger") that would swell the storage for nothing.

       ABSENT IS NOT EMPTY, AND CONFLATING THEM FROZE EVERYTHING.

       The first draft wrote `(data.keywords?.keywords || [])`. When the
       grouped `append_to_response` brought nothing back — field missing
       from the answer — that returned an empty array, that is to say an
       ASSERTION: "we asked, this film has no keywords". The card then
       froze for good, since everything that repairs (`isIncomplete`, the
       open card, the import merge) only rewrites if the field is absent.
       A whole collection ended up with zero keywords without a single
       error being raised anywhere.

       `undefined` when we do not know, `[]` when we know there are none.
       The same discipline as `runtime` and `tmdbRating`, one notch
       further. */
    keywords: keywords ? keywords.slice(0, 20).map((k) => k.name) : undefined,
  };
}

export const POSTER_THUMB = "https://image.tmdb.org/t/p/w185";

/* ============================================================
   LE CHEMIN D'UN CÔTÉ, L'URL DE L'AUTRE
   ============================================================

   `Film.poster` est une URL COMPLÈTE, taille comprise, parce qu'une
   fiche est à soi et que l'affiche qu'on y a mise ne bouge plus. Une
   œuvre de LISTE ne peut pas se le permettre : elle est lue par tout le
   monde, dans une grille ici et une vignette là, et une taille figée le
   jour de l'écriture serait figée pour tous les lecteurs à venir. Elle
   range donc le CHEMIN — la même discipline que `Film.frames`, qui
   compose `w300` pour la bande et `w1280` pour l'agrandissement.

   Ces deux fonctions sont la charnière, et il n'y en a pas d'autre :
   `posterPathOf` pour écrire, `posterUrl` pour lire. */

/** L'URL d'une affiche de TMDB ramenée à son chemin — `""` si ce n'en
    est pas une. On ne devine rien d'une adresse qui n'est pas de TMDB :
    elle ne se recomposerait à aucune taille. */
export function posterPathOf(url) {
  if (!url) return "";
  const m = String(url).match(/^https:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/[\w.-]+)$/);
  return m ? m[1] : "";
}

/** Le chemin rendu affichable. `base` est ce qu'on veut EN FACE : la
    vignette pour une grille, la grande pour une couche. */
export function posterUrl(path, base = POSTER_THUMB) {
  return path ? `${base}${path}` : "";
}

/* Every poster known for a film — several countries, several designs.
   We favour the original language and French, then the posters with no
   text (`iso_639_1: null`), and rank by popularity. */
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

/* A FILM'S KEYWORDS, as TMDB carries them.

   They are not brought back by `getDetails` and that is deliberate: they
   file nowhere on the card. They only serve to OFFER motifs
   (`domain/motifs`), which a click approves or not — so we only store
   what has been read back.

   CACHED, like all its neighbours. As long as a single open card asked
   for them, hitting TMDB again on every opening cost only one round
   trip. "Which one tonight?" asks for dozens at once, to guess the tone
   of films we have not seen, and with no cache the same watchlist would
   ask for them all on every question put.

   The `try` is OUTSIDE, and that is what counts: a failure must not
   enter the cache. `cachedList` only writes what the fetcher returned —
   if the call throws, nothing is filed, and we try again next time. An
   empty list, on the other hand, is a real answer: there are films TMDB
   knows not one word about. */
export async function fetchKeywords(tmdbId, apiKey) {
  if (!tmdbId || !apiKey) return [];
  try {
    return await cachedList(`kw:${tmdbId}`, async () => {
      const data = await get(`/movie/${tmdbId}/keywords`, {}, apiKey);
      return data.keywords || [];
    });
  } catch {
    // a missing keyword is not a failure: the card opens without
    return [];
  }
}

/* ============================================================
   DISCOVERY — the calls that serve the recommendations.
   They do not resolve a known film: they look for unknown ones.
   ============================================================ */

const DISC_KEY = "tmdb-disc";
const DISC_TTL = 7 * 24 * 3600 * 1000; // one week: fresh enough, thrifty enough

/* A cache with an expiry, distinct from `tmdb-cache`: this one
   memorises lists of candidates, which age (a film comes out, a rating
   moves), where the title → tmdbId match is final. */
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

/* We never cache TMDB's raw answer: it is ten times bigger than what we
   keep of it, and the localStorage quota is already fought over by the
   posters. Only the normalised shape is stored. */
async function cachedList(cacheKey, fetcher) {
  const cache = readDisc();
  const hit = cache[cacheKey];
  if (hit && Date.now() - hit.t < DISC_TTL) return hit.v;
  const v = await fetcher();
  cache[cacheKey] = { t: Date.now(), v };
  // lazy purge: past 300 entries we throw the oldest away
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

/* The minimal shape that is enough to score AND to draw a card.
   `/discover` and `/recommendations` already return all of it: no extra
   detail call is needed to rank a candidate. */
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
  // truncated: multiplied by a few hundred candidates, the full summary
  // would be enough to saturate the quota on its own
  overview: (m.overview || "").slice(0, 240),
});

/* The genre table: `/discover` wants numeric identifiers, the
   collection knows only names. With no explicit language — like
   `getDetails`, which filled the cards — otherwise the names no longer
   match. */
export async function getGenreMap(apiKey) {
  const list = await cachedList("genres", async () => {
    const data = await get("/genre/movie/list", {}, apiKey);
    return data.genres || [];
  });
  const byName = new Map(list.map((g) => [g.name.toLowerCase(), g.id]));
  const byId = new Map(list.map((g) => [g.id, g.name]));
  return { byName, byId, list };
}

/* `/discover`: the only endpoint that accepts "few votes but well
   rated", that is to say the operational definition of a gem. */
export async function discover(params, apiKey) {
  const key = `d:${JSON.stringify(params)}`;
  return cachedList(key, async () => {
    const data = await get("/discover/movie", { include_adult: "false", ...params }, apiKey);
    return (data.results || []).map(toCandidate);
  });
}

/* `/recommendations` rather than `/similar`: the first rests on real
   behaviour, the second on a plain intersection of genres. */
export async function recommendationsFor(tmdbId, apiKey) {
  return cachedList(`r:${tmdbId}`, async () => {
    const data = await get(`/movie/${tmdbId}/recommendations`, {}, apiKey);
    return (data.results || []).map(toCandidate);
  });
}

/* A CANDIDATE'S DIRECTOR, and nothing else.

   `/discover` and `/recommendations` do not say: they return films, not
   crews. So the discovery desk's card showed "anonymous" under every
   poster, where the wall names.

   `/movie/{id}/credits` and not `getDetails`: we want one name only, and
   going through the full detail would bring back runtime, country,
   rating and eight billed names only to throw them away at once — all of
   it into the other cache, the one for definitive cards, where a
   candidate has no business.

   Cached like its neighbours in this section: forty suggestions make
   forty calls, and two searches always overlap a great deal. */
export async function directorOf(tmdbId, apiKey) {
  if (!tmdbId || !apiKey) return "";
  try {
    return await cachedList(`dir:${tmdbId}`, async () => {
      const data = await get(`/movie/${tmdbId}/credits`, {}, apiKey);
      const names = (data.crew || []).filter((c) => c.job === "Director").map((c) => c.name);
      return [...new Set(names)].join(", ");
    });
  } catch {
    // a missing name is not a failure: the suggestion stays readable
    return "";
  }
}

/* THE TMDB DEPARTMENT EACH OF OUR ROLES BELONGS TO. Same shape and same
   reason as `JOBS` below, one level up: `JOBS` names a credit, this
   names the trade TMDB files a PERSON under. */
const DEPARTMENTS = {
  réalisation: "Directing",
  interprétation: "Acting",
  image: "Camera",
  musique: "Sound",
  scénario: "Writing",
};

/**
 * The person behind a name.
 *
 * `results[0]` IS TMDB'S POPULARITY RANKING, AND NOTHING ELSE. Ask for a
 * director who shares a name with a better-known actor and the actor
 * wins — then their "Director" credits are asked for, and the Credits
 * view lists films the person one was looking at never signed. It looks
 * like a filter that leaks; it is the wrong person entirely.
 *
 * So when the capacity is known, the first result FILED UNDER THAT TRADE
 * wins, and popularity only decides among equals. It stays a fallback
 * and never a filter: TMDB leaves `known_for_department` empty on plenty
 * of sparse entries, and refusing those would turn a wrong answer into
 * no answer.
 *
 * THE TRADE IS PART OF THE CACHE KEY, for the same reason it is part of
 * `personFilmography`'s: two questions, two answers, and the old
 * `p:<name>` entries already written in people's browsers must not serve
 * one for the other.
 */
export async function searchPerson(name, apiKey, { role = "" } = {}) {
  const department = DEPARTMENTS[role] || "";
  return cachedList(`p:${name.toLowerCase()}${department ? `:${department}` : ""}`, async () => {
    const data = await get("/search/person", { query: name }, apiKey);
    const results = data.results || [];
    const hit =
      (department && results.find((r) => r.known_for_department === department)) || results[0];
    return hit ? { id: hit.id, name: hit.name } : null;
  });
}

/* A FACE, FOR THE CREDITS.
 *
 * `searchPerson` throws away the `profile_path` that comes in the same
 * answer, and we do not add it there: its cache entry `p:<name>` is
 * already written in people's browsers, and "what is missing" reads it.
 * An entry of its own costs one call and cannot serve a half-filled
 * shape for a full one.
 *
 * Returns `""` — a real answer — for somebody TMDB has no photograph of,
 * so that a face-less name is not asked for again every week.
 *
 * The failure is NOT caught here: `cachedList` only writes what the
 * fetcher gave back, so a network cut files nothing, and the caller
 * falls back on the initials.
 */
export async function personPortrait(name, apiKey) {
  if (!name || !apiKey) return "";
  return cachedList(`pp:${name.toLowerCase()}`, async () => {
    const data = await get("/search/person", { query: name }, apiKey);
    const hit = data.results?.[0];
    return hit?.profile_path ? `${POSTER_THUMB}${hit.profile_path}` : "";
  });
}

/* THE JOB TITLES, AS TMDB NAMES THEM, for each kinship role.

   An actor who has appeared in thirty films has not signed thirty films:
   asking for "their filmography" without saying in what capacity would
   mix the two, and the Credits view would show a cinematographer films
   they did not light. So the role is part of the question.

   `scénario` gathers two: TMDB tells "Screenplay" from "Writer"
   depending on the card, with no rule one could guess.

   THE KEYS STAY FRENCH: they are `KinshipRole`'s values. */
const JOBS = {
  image: ["Director of Photography"],
  musique: ["Original Music Composer"],
  scénario: ["Screenplay", "Writer"],
  réalisation: ["Director"],
};

/**
 * What this person did, in that capacity.
 *
 * The cache key carries the role: a person's acting credits and their
 * directing credits are two different answers, and filing them under the
 * same key would serve one for the other.
 */
export async function personFilmography(personId, apiKey, { role = "réalisation" } = {}) {
  return cachedList(`pc:${personId}:${role}`, async () => {
    const data = await get(`/person/${personId}/movie_credits`, {}, apiKey);
    const raw =
      role === "interprétation"
        ? data.cast || []
        : (data.crew || []).filter((c) => (JOBS[role] || JOBS.réalisation).includes(c.job));
    /* ONE FILM, ONE ENTRY. TMDB lists a crew credit PER JOB, so somebody
       who directed and also wrote comes back twice on the same film once
       `scénario` gathers two job titles — and a filmography that says a
       title twice reads as a mistake in the collection, not in the
       answer. Keyed on the id, which is the only thing that identifies a
       film here. */
    const seen = new Set();
    return raw.filter((c) => !seen.has(c.id) && seen.add(c.id)).map(toCandidate);
  });
}

/* ============================================================
   TOUT CE QUE CETTE PERSONNE A FAIT, ET DANS QUELLE CAPACITÉ

   `personFilmography` répond « quels films », pour UN rôle, et jette le
   reste : ni le `job`, ni le réalisateur du film. C'est ce qu'il faut à
   une filmographie, et c'est trop peu pour une piste — « P a éclairé
   trois films de D » demande les DEUX bouts, et demander le réalisateur
   de chaque film serait un appel PAR FILM.

   ICI ON GARDE LE RÔLE, ET C'EST TOUT CE QUI MANQUAIT. Le croisement
   (`crossedHints`, `domain/hints`) apparie ensuite deux génériques : si
   un film porte `réalisation` chez l'un et `image` chez l'autre, on sait
   qui a éclairé pour qui — sans avoir rien demandé sur le film. UN APPEL
   PAR NOM, jamais par film, ce que le plafond du relais impose.

   UNE CLÉ DE CACHE À ELLE, et le même magasin. `pc:<id>:<rôle>` tient
   des candidats sans rôle : y ranger ceci servirait l'un pour l'autre —
   le piège que `personFilmography` explique déjà pour les rôles. `cw:`
   partage en revanche le TTL d'une semaine et la purge au-delà de trois
   cents, ce que tout cache de ce fichier fait.

   PAS DE DÉDOUBLONNAGE PAR FILM, contrairement au voisin. Quelqu'un qui
   réalise ET écrit le même film tient deux rôles dessus, et c'est
   exactement ce qu'on vient lire : les fondre perdrait la moitié des
   croisements possibles.
   ============================================================ */
/* ============================================================
   LES MÉTIERS DU CROISEMENT — SA PROPRE TABLE, ET C'EST DÉLIBÉRÉ

   `JOBS` répond à « quels films cette personne a-t-elle signés, à ce
   titre » : c'est une FILMOGRAPHIE, et elle doit rester étroite. Y
   glisser « Assistant Director » ferait apparaître un poste d'assistant
   dans la filmographie de RÉALISATEUR de quelqu'un, à la vue Générique —
   la fuite exacte que `searchPerson` explique déjà pour la popularité.

   LE CROISEMENT POSE UNE AUTRE QUESTION : « qui a travaillé sur le film
   de qui ». D'où une table à lui.

   ET C'EST L'ASSISTANAT QUI MANQUAIT LE PLUS. Mesuré sur vingt
   cinéastes, les métiers qui apparaissent vraiment dans un croisement :
   assistant à la réalisation douze fois, scénario onze, seconde équipe
   trois, photographie trois. Bava sur l'« Inferno » d'Argento est
   crédité « Second Unit Director » — donc la filiation la plus célèbre
   du lot ne sortait pas, alors que la donnée était là. Assistant, puis
   seconde équipe, puis réalisateur, c'est le chemin ordinaire d'un
   apprentissage, et il dit bien plus qu'un poste à la photo.

   LES DEUX SE RANGENT SOUS UN SEUL RÔLE, `assistanat` : ils disent la
   même chose — ON A TRAVAILLÉ SOUS SES ORDRES — et les séparer aurait
   demandé à quelqu'un de trancher entre « premier assistant » et
   « seconde équipe » pour poser un lien qui ne fait pas la différence.

   LA PRODUCTION EST ÉCARTÉE, et elle est pourtant fréquente (onze fois
   sur la même mesure). Produire le film de quelqu'un est un rapport
   d'argent, pas un apprentissage : le proposer comme filiation ferait
   entrer sur la carte des liens que personne n'a voulus, exactement ce
   que l'interprétation coûterait.

   LA CORÉALISATION AUSSI, et c'est le refus le moins évident : elle est
   le cas le plus fréquent de tous. Mais deux cinéastes qui signent
   ensemble sont des PAIRS — un film à sketches relierait ses segments
   sans que personne l'ait demandé. C'est une affinité que la carte sait
   déjà dire, et c'est à la main qu'on la pose.
   ============================================================ */
const CROSS_JOBS = {
  ...JOBS,
  assistanat: [
    "Assistant Director",
    "First Assistant Director",
    "Second Assistant Director",
    "Second Unit Director",
    "Second Unit",
  ],
};

export async function personCrew(personId, apiKey) {
  /* LA CLÉ PORTE SON NUMÉRO, ET C'EST LE MÊME RÉFLEXE QUE
     `SYNCABLE_VERSION`. Élargir la table sans toucher à la clé aurait
     laissé les génériques déjà en cache — une SEMAINE de TTL — répondre
     l'ancienne réponse, sans l'assistanat : celui qui vient de mettre à
     jour ne verrait rien de neuf et croirait le correctif raté. Toute
     table élargie ici monte le numéro. */
  return cachedList(`cw2:${personId}`, async () => {
    const data = await get(`/person/${personId}/movie_credits`, {}, apiKey);
    const out = [];
    const seen = new Set();
    for (const c of data.crew || []) {
      for (const [role, jobs] of Object.entries(CROSS_JOBS)) {
        if (!jobs.includes(c.job)) continue;
        /* Un même rôle deux fois sur un film — « Screenplay » ET
           « Writer » — reste un seul rôle. */
        const id = `${c.id}|${role}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ film: c.id, role });
      }
    }
    return out;
  });
}

/* By far the most frequent case, and the one `reco` calls. */
export async function directorFilmography(personId, apiKey) {
  return personFilmography(personId, apiKey, { role: "réalisation" });
}

/* Runs tasks in small batches — the same worker pool as `enrichRows`,
   but generic, and swallowing the failures: one lost request must not
   cancel a whole search. */
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

/* A failed search expires: the TMDB catalogue fills out, and a title
   not found today must not stay so for ever. The successes do not move —
   a film changes neither director nor year. */
const MISS_TTL = 30 * 24 * 3600 * 1000;
const missEntry = () => ({ miss: Date.now() });
const isMiss = (v) => v != null && typeof v === "object" && typeof v.miss === "number";

/* What the cache has to say about a key: `hit` tells "nothing
   memorised" from "memorised as not found", which null alone conflated. */
function cacheLookup(cache, key) {
  if (!(key in cache)) return { hit: false };
  const v = cache[key];
  // failures from earlier versions were stored as null, with no date:
  // impossible to expire, so we prefer to retry them once.
  if (v == null) {
    delete cache[key];
    return { hit: false };
  }
  if (isMiss(v)) {
    if (Date.now() - v.miss < MISS_TTL) return { hit: true, info: null };
    delete cache[key];
    return { hit: false };
  }
  /* An answer of an expired shape is not an answer: it does not carry
     the fields we came for. We treat it as an absence. */
  if (v.v !== SHAPE) {
    delete cache[key];
    return { hit: false };
  }
  return { hit: true, info: v };
}

/* Resolves an import row; null if the film stays not found.
   An error (network, quota, key) comes back up as it is and is never
   memorised: the next re-import must be able to succeed. */
async function resolveOne(row, apiKey, cache) {
  /* WHEN THE ROW ALREADY KNOWS WHO IT IS, WE DO NOT SEARCH.

     The Letterboxd feed carries each screening's TMDB identifier.
     Searching anyway would cost one more call, and above all
     `searchMovie` takes the FIRST result without comparing titles: that
     is where the false positives come from. An identifier does not
     mistake itself. */
  const known = row.tmdbId
    ? cacheLookup(cache, cacheKeyOfId(row.tmdbId))
    : cacheLookup(cache, cacheKeyOf(row.title, row.year));
  if (known.hit) return known.info;

  if (row.tmdbId) {
    const info = await getDetails(row.tmdbId, apiKey);
    cache[cacheKeyOfId(row.tmdbId)] = info || missEntry();
    return info;
  }

  const key = cacheKeyOf(row.title, row.year);
  const hit = await searchMovie({ title: row.title, year: row.year, apiKey });
  const info = hit ? await getDetails(hit.id, apiKey) : null;
  cache[key] = info || missEntry();
  return info;
}

/**
 * Enriches a batch of rows. Never rejects: a film not resolved (network,
 * quota, title not found) comes back out as it is and the import carries
 * on without it.
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
            /* Entries memorised BEFORE the cast was harvested carry
               none: the fallback is an empty list, never `undefined` —
               and it is that value which then travels through the diff
               and the card. */
            cast: info.cast || [],
            crew: info.crew || {},
            runtime: info.runtime ?? null,
            language: info.language || "",
            countries: info.countries || [],
            tmdbRating: info.tmdbRating ?? null,
            synopsis: info.synopsis || "",
            /* No `|| []`: see `getDetails`. Falling back on the empty
               list would turn "we do not know" into "there are none",
               and would freeze the card for good. */
            keywords: info.keywords,
            frames: info.frames,
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
