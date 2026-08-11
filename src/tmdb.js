/* ============================================================
   TMDB — enrichissement des fiches importées (réalisateur, genres)
   Les exports Letterboxd ne contiennent que titre / année / note :
   le réalisateur, lui, doit être retrouvé auprès de TMDB.
   ============================================================ */

const BASE = "https://api.themoviedb.org/3";
// w342 : assez fin pour une carte, assez léger pour un mur de 500 affiches
export const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const CACHE_KEY = "tmdb-cache";

/* LA FORME DE CE QU'ON MÉMORISE, ET POURQUOI ELLE PORTE UN NUMÉRO.

   Le cache est éternel par dessein : un film ne change ni de
   réalisateur ni d'année, et le réinterroger brûlerait le quota pour
   rien. Mais ce raisonnement ne vaut que pour les champs qu'on
   demandait DÉJÀ. Le jour où `getDetails` s'est mis à rapporter la
   durée, le pays et la langue, les entrées mémorisées la veille sont
   devenues des réponses tronquées — et le cache, qui ne sait pas qu'il
   est en retard, les servait comme des réponses complètes.

   C'est de là que venait « compléter les fiches ne fait rien » : la
   fiche était bien reconnue incomplète, l'appel était bien lancé, et il
   revenait du `localStorage` aussi vide qu'il était parti. Aucune
   erreur, aucun compte à zéro, rien à quoi se raccrocher.

   Le numéro règle cela une fois pour toutes : une entrée d'une autre
   forme n'est pas une réponse, c'est une absence. On la jette et on
   redemande. À INCRÉMENTER dès qu'un champ s'ajoute à `getDetails`. */
const SHAPE = 3;

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

/* La clé d'un film qu'on connaît par son identifiant. Elle DOIT être
   distincte de `titre|année` : deux films peuvent porter le même titre la
   même année, et se partageraient alors une entrée — l'un prendrait le
   réalisateur et l'affiche de l'autre. */
export const cacheKeyOfId = (tmdbId) => `id:${tmdbId}`;

export const clearTmdbCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    console.error(e);
  }
};

/* UNE CORRECTION MANUELLE S'INSCRIT DANS LE CACHE, sinon elle ne tient
   qu'un temps : le cache associe encore `titre|année` au mauvais
   identifiant, et le prochain import du même titre le ressert comme si
   de rien n'était. On écrit donc les DEUX clés — celle du titre, qui
   était fausse, et celle de l'identifiant retenu. */
export function rememberResolution(title, year, info) {
  if (!info?.tmdbId) return;
  const cache = readCache();
  cache[cacheKeyOf(title, year)] = info;
  cache[cacheKeyOfId(info.tmdbId)] = info;
  writeCache(cache);
}

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

/* PLUSIEURS RÉSULTATS, ET NON LE PREMIER.

   `searchMovie` prend `results[0]` sans regarder : c'est ce qu'il faut
   pour enrichir cinq cents lignes d'un coup, et c'est exactement d'où
   viennent les erreurs d'identité. Deux « Resurrection » à trente ans
   d'écart, et la collection suit le mauvais toute sa vie — mauvaise
   affiche, mauvaise équipe, et un sillage qui propose le vrai film comme
   s'il s'agissait d'un autre.

   Corriger cela demande de VOIR les homonymes. D'où cette variante, qui
   ne décide rien et rend la liste telle quelle : c'est l'œil humain qui
   tranche, une fiche à la fois. */
/* `year` a une valeur par défaut, et ce n'est pas une commodité : sans
   elle, TypeScript la déduit OBLIGATOIRE depuis ce module en JavaScript,
   et le seul appelant — la correction d'identité — la laisse
   délibérément de côté, l'année inscrite sur la fiche étant justement
   celle qu'on soupçonne d'être fausse. */
export async function searchMovies({ title, year = null, apiKey, limit = 12 }) {
  const params = { query: title, include_adult: "false" };
  let data = await get("/search/movie", year ? { ...params, year: String(year) } : params, apiKey);
  /* Le repli sans année est ici PLUS important qu'ailleurs : quand on
     vient corriger une identité, l'année inscrite sur la fiche est
     souvent celle du mauvais film. */
  if (!data.results?.length && year) data = await get("/search/movie", params, apiKey);
  return (data.results || []).slice(0, limit).map((m) => ({
    tmdbId: m.id,
    title: m.title || m.original_title || "",
    original: m.original_title || "",
    year: m.release_date ? Number(m.release_date.slice(0, 4)) || null : null,
    poster: m.poster_path ? `${POSTER_THUMB}${m.poster_path}` : "",
    overview: (m.overview || "").slice(0, 200),
    lang: m.original_language || "",
  }));
}

/* LES TROIS MÉTIERS QU'ON RETIENT, et les intitulés TMDB qui les
   désignent. Trois et pas trente : une équipe entière compte deux cents
   noms, dont l'écrasante majorité ne relie jamais deux films entre eux
   et pèserait pour rien dans le `localStorage`.

   Ceux-là, si. Un chef opérateur suivi de film en film dit quelque chose
   d'une collection ; le troisième assistant décorateur ne dit rien. */
const MÉTIERS = {
  image: ["Director of Photography", "Cinematography"],
  musique: ["Original Music Composer", "Music"],
  scénario: ["Screenplay", "Writer"],
};

/* Les huit premiers rôles, tels que TMDB les classe — c'est-à-dire par
   ordre d'apparition au générique. Au-delà, on entre dans les silhouettes
   et les voix de foule : du bruit, et du poids. */
const ROLES = 8;

/* Détail + équipe : c'est là que se trouve le réalisateur. */
export async function getDetails(tmdbId, apiKey) {
  /* LES MOTS-CLÉS VIENNENT DANS LA MÊME REQUÊTE, ET C'EST TOUT L'INTÉRÊT.

     `append_to_response` accepte plusieurs ressources séparées par des
     virgules : les demander ici ne coûte pas un appel de plus, pas un
     jeton de quota de plus, pas une milliseconde de plus. Les récolter à
     part — ce que fait `fetchKeywords` pour la fiche ouverte — doublerait
     le nombre d'appels d'un import complet pour la même chose. */
  const data = await get(`/movie/${tmdbId}`, { append_to_response: "credits,keywords" }, apiKey);
  const équipe = data.credits?.crew || [];
  const directors = équipe.filter((c) => c.job === "Director").map((c) => c.name);

  /* L'ANNOTATION CI-DESSOUS EST NÉCESSAIRE, ET ELLE VAUT POUR TOUS LES
     APPELANTS.

     Ce module est en JavaScript, et TypeScript infère le type d'un objet
     à sa DÉCLARATION : un `{}` rempli plus loin, clé par clé, reste un
     `{}` à ses yeux. `getDetails` annonçait donc un `crew` sans aucune
     clé possible, et chaque appelant devait rétablir la vérité par une
     assertion de son côté — une par point d'appel, à recopier à chaque
     nouveau, et fausse le jour où la forme changerait ici.

     Une ligne à la source évite toutes les autres. Elle est dans un
     bloc `/**` bien à elle : TypeScript ne lit QUE ceux-là, et un `@type`
     noyé dans un commentaire ordinaire est ignoré sans un mot — ce qui
     est exactement ce qui vient d'arriver en écrivant ces lignes. */
  /** @type {Record<string, string[]>} */
  const crew = {};
  for (const [métier, intitulés] of Object.entries(MÉTIERS)) {
    const noms = [...new Set(équipe.filter((c) => intitulés.includes(c.job)).map((c) => c.name))];
    if (noms.length) crew[métier] = noms;
  }

  return {
    v: SHAPE,
    tmdbId: data.id,
    director: directors.join(", "),
    genres: (data.genres || []).map((g) => g.name),
    year: data.release_date ? Number(data.release_date.slice(0, 4)) : null,
    // on ne stocke qu'un chemin (~30 octets) : l'image reste chez TMDB
    poster: data.poster_path ? `${POSTER_BASE}${data.poster_path}` : "",
    cast: (data.credits?.cast || []).slice(0, ROLES).map((c) => c.name),
    crew,
    /* LA DURÉE, ET POURQUOI `null` PLUTÔT QUE ZÉRO. TMDB rend parfois 0
       pour un film dont il ignore la durée. Le garder tel quel ferait
       entrer un zéro dans les moyennes de l'almanach et tirerait « la
       durée moyenne d'une séance » vers le bas sans qu'on sache
       pourquoi. Une durée inconnue doit pouvoir être ÉCARTÉE d'un
       calcul, ce qu'un zéro ne permet pas. */
    runtime: data.runtime || null,
    language: data.original_language || "",
    /* Deux pays au plus : une coproduction en aligne parfois six, et le
       sixième financier ne dit rien du film qu'on a vu. */
    countries: (data.production_countries || []).slice(0, 2).map((c) => c.iso_3166_1),
    // même raison que la durée : 0 veut dire « pas encore noté »
    tmdbRating: data.vote_average || null,
    /* LES MOTS-CLÉS, GARDÉS CETTE FOIS.

       Ils étaient récoltés depuis longtemps et jetés aussitôt : ils ne
       servaient qu'à proposer des motifs à confirmer sur la fiche
       ouverte. Or ce sont les SEULS renseignements thématiques que TMDB
       donne — les motifs et les mots-clés à vous se posent à la main, et
       sur une collection importée ils sont vides. Le sillage d'un film
       n'avait donc que des noms de personnes à rapprocher.

       Ils ne remplacent pas les motifs et ne s'y mélangent pas : un
       motif est un mot que VOUS avez choisi de suivre, un mot-clé est ce
       que TMDB a écrit. Ils vivent côte à côte, comme `themes` et
       `motifs`, et le sillage les pèse différemment.

       Vingt au plus : les fiches populaires en portent parfois cent, et
       la queue de liste est de la poussière (« based on novel »,
       « duringcreditsstinger ») qui gonflerait le stockage pour rien. */
    keywords: (data.keywords?.keywords || []).slice(0, 20).map((k) => k.name),
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

/* LES MOTS-CLÉS D'UN FILM, tels que TMDB les porte.

   Ils ne sont pas rapatriés par `getDetails` et c'est délibéré : ils ne
   se rangent nulle part sur la fiche. Ils ne servent qu'à PROPOSER des
   motifs (`domain/motifs`), qu'un clic valide ou non — on ne stocke donc
   que ce qui a été relu.

   MIS EN CACHE, comme tous ses voisins. Tant qu'une seule fiche ouverte
   les demandait, refrapper TMDB à chaque ouverture ne coûtait qu'un
   aller-retour. « Lequel ce soir ? » en demande des dizaines d'un coup
   pour deviner le ton de films qu'on n'a pas vus, et sans cache la même
   watchlist les redemanderait tous à chaque question posée.

   Le `try` est DEHORS, et c'est ce qui compte : une panne ne doit pas
   entrer dans le cache. `cachedList` n'écrit que ce que le fetcher a
   rendu — si l'appel jette, rien n'est rangé, et l'on retente la
   prochaine fois. Une liste vide, elle, est une vraie réponse : il
   existe des films dont TMDB ne sait aucun mot. */
export async function fetchKeywords(tmdbId, apiKey) {
  if (!tmdbId || !apiKey) return [];
  try {
    return await cachedList(`kw:${tmdbId}`, async () => {
      const data = await get(`/movie/${tmdbId}/keywords`, {}, apiKey);
      return data.keywords || [];
    });
  } catch {
    // un mot-clé manquant n'est pas une panne : la fiche s'ouvre sans
    return [];
  }
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

/* LE RÉALISATEUR D'UN CANDIDAT, et lui seul.

   `/discover` et `/recommendations` ne le disent pas : ils rendent des
   films, pas des équipes. La fiche du bureau des découvertes affichait
   donc « anonyme » sous chaque affiche, là où le mur, lui, nomme.

   `/movie/{id}/credits` et non `getDetails` : on ne veut qu'un nom, et
   passer par le détail complet rapporterait durée, pays, note et huit
   noms au générique pour les jeter aussitôt — le tout dans l'autre
   cache, celui des fiches définitives, où un candidat n'a rien à faire.

   Mis en cache comme ses voisins de section : quarante propositions font
   quarante appels, et deux recherches se recoupent toujours beaucoup. */
export async function directorOf(tmdbId, apiKey) {
  if (!tmdbId || !apiKey) return "";
  try {
    return await cachedList(`dir:${tmdbId}`, async () => {
      const data = await get(`/movie/${tmdbId}/credits`, {}, apiKey);
      const noms = (data.crew || []).filter((c) => c.job === "Director").map((c) => c.name);
      return [...new Set(noms)].join(", ");
    });
  } catch {
    // un nom manquant n'est pas une panne : la proposition reste lisible
    return "";
  }
}

export async function searchPerson(name, apiKey) {
  return cachedList(`p:${name.toLowerCase()}`, async () => {
    const data = await get("/search/person", { query: name }, apiKey);
    const hit = data.results?.[0];
    return hit ? { id: hit.id, name: hit.name } : null;
  });
}

/* LES POSTES, TELS QUE TMDB LES NOMME, pour chaque rôle de parenté.

   Un acteur qui a tourné dans trente films n'a pas signé trente films :
   demander « sa filmographie » sans dire à quel titre mélangerait les
   deux, et le Générique montrerait à un chef opérateur des films qu'il
   n'a pas éclairés. Le rôle fait donc partie de la question.

   `scénario` en réunit deux : TMDB distingue « Screenplay » de
   « Writer » selon les fiches, sans règle qu'on puisse deviner. */
const POSTES = {
  image: ["Director of Photography"],
  musique: ["Original Music Composer"],
  scénario: ["Screenplay", "Writer"],
  réalisation: ["Director"],
};

/**
 * Ce que cette personne a fait, à ce titre-là.
 *
 * La clé de cache porte le rôle : les crédits d'interprétation et ceux
 * de réalisation d'une même personne sont deux réponses différentes, et
 * les ranger sous la même clé ferait servir l'une pour l'autre.
 */
export async function personFilmography(personId, apiKey, { role = "réalisation" } = {}) {
  return cachedList(`pc:${personId}:${role}`, async () => {
    const data = await get(`/person/${personId}/movie_credits`, {}, apiKey);
    if (role === "interprétation") return (data.cast || []).map(toCandidate);
    const postes = POSTES[role] || POSTES.réalisation;
    return (data.crew || []).filter((c) => postes.includes(c.job)).map(toCandidate);
  });
}

/* Le cas de loin le plus fréquent, et celui que `reco` appelle. */
export async function directorFilmography(personId, apiKey) {
  return personFilmography(personId, apiKey, { role: "réalisation" });
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
  /* Une réponse d'une forme périmée n'est pas une réponse : elle ne
     porte pas les champs qu'on vient chercher. On la traite comme une
     absence — voir `SHAPE`. */
  if (v.v !== SHAPE) {
    delete cache[key];
    return { hit: false };
  }
  return { hit: true, info: v };
}

/* Résout une ligne d'import ; null si le film reste introuvable.
   Une erreur (réseau, quota, clé) remonte telle quelle et n'est jamais
   mémorisée : le réimport suivant doit pouvoir réussir. */
async function resolveOne(row, apiKey, cache) {
  /* QUAND LA LIGNE SAIT DÉJÀ QUI ELLE EST, ON NE CHERCHE PAS.

     Le flux Letterboxd porte l'identifiant TMDB de chaque séance. Le
     chercher quand même coûterait un appel de plus, et surtout
     `searchMovie` prend le PREMIER résultat sans comparer les titres :
     c'est de là que viennent les faux positifs. Un identifiant ne se
     trompe pas. */
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
            /* Les entrées mémorisées AVANT que le casting soit récolté
               n'en portent pas : le repli est une liste vide, jamais
               `undefined` — c'est cette valeur-là qui traverse ensuite
               le diff et la fiche. */
            cast: info.cast || [],
            crew: info.crew || {},
            runtime: info.runtime ?? null,
            language: info.language || "",
            countries: info.countries || [],
            tmdbRating: info.tmdbRating ?? null,
            keywords: info.keywords || [],
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
