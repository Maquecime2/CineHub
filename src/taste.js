/* ============================================================
   PROFIL DE GOÛT — ce que la collection dit de vous.

   Pur, sans réseau, sans état : une collection entre, un profil
   sort. Tout le reste (récolte TMDB, scoring) s'appuie dessus.
   ============================================================ */

/* Une note n'est pas une fréquence : voir dix films d'un cinéaste et les
   détester ne fait pas de lui un goût. Le poids traduit donc l'adhésion, pas
   l'exposition — et il devient négatif en dessous de 2,5 étoiles.

   Un film vu mais non noté (rating 0) compte quand même, faiblement : dans un
   import Letterboxd, la majorité des fiches n'ont pas de note, et les ignorer
   viderait le profil de la plupart de sa matière. */
export const weightOf = (rating) => (!rating ? 0.35 : (rating - 2.5) / 2.5);

const bump = (map, key, w) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + w);
};

/* Ramène la plus forte valeur absolue à 1 : deux collections de tailles très
   différentes produisent alors des scores comparables. */
const normalize = (map) => {
  let max = 0;
  map.forEach((v) => { max = Math.max(max, Math.abs(v)); });
  if (!max) return map;
  const out = new Map();
  map.forEach((v, k) => out.set(k, v / max));
  return out;
};

/* Un champ « réalisateur » peut porter plusieurs noms (« Coen, Coen »). */
export const directorsOf = (f) =>
  (f.director || "").split(",").map((s) => s.trim()).filter(Boolean);

export const decadeOf = (year) => (year ? Math.floor(Number(year) / 10) * 10 : null);

/**
 * Construit le profil à partir des films VUS. La watchlist n'exprime pas un
 * goût constaté mais une intention — elle sert seulement à ne pas
 * recommander ce qui est déjà mis de côté.
 *
 * @param {Array} films toute la collection, watchlist comprise
 */
export function buildTaste(films = []) {
  const watched = films.filter((f) => f.status !== "watchlist");

  const directors = new Map();
  const genres = new Map();
  const themes = new Map();
  const decades = new Map();
  const languages = new Map();

  let yearSum = 0, yearN = 0, ratedN = 0;

  for (const f of watched) {
    const w = weightOf(f.rating);
    if (f.rating) ratedN++;
    directorsOf(f).forEach((d) => bump(directors, d, w));
    (f.genres || []).forEach((g) => bump(genres, g, w));
    // les mots-clés sont saisis à la main : rares, mais jamais subis
    (f.themes || []).forEach((t) => bump(themes, t, w * 1.4));
    const dec = decadeOf(f.year);
    if (dec) bump(decades, dec, w);
    // absent des fiches importées jusqu'ici : le profil de langue reste
    // souvent vide, et le scoring doit s'en accommoder
    if (f.lang) bump(languages, f.lang, w);
    if (f.year) { yearSum += Number(f.year); yearN++; }
  }

  const meanYear = yearN ? yearSum / yearN : null;
  const spread = yearN
    ? Math.sqrt(watched.reduce((a, f) => (f.year ? a + (Number(f.year) - meanYear) ** 2 : a), 0) / yearN)
    : null;

  return {
    directors: normalize(directors),
    genres: normalize(genres),
    themes: normalize(themes),
    decades: normalize(decades),
    languages: normalize(languages),
    // les ensembles connus servent à écarter les candidats déjà vus, mais
    // aussi à mesurer le dépaysement : ce qui n'y figure pas est nouveau
    seenGenres: new Set(genres.keys()),
    seenDecades: new Set(decades.keys()),
    seenLanguages: new Set(languages.keys()),
    meanYear, spread,
    total: watched.length,
    rated: ratedN,
    // au-dessous de quoi le profil ne dit rien de fiable
    isEmpty: watched.length < 3,
  };
}

/* Les films les mieux notés — la matière première des « parce que vous avez
   aimé X ». On exige un tmdbId : sans lui, TMDB n'a rien à quoi se raccrocher. */
export function favorites(films = [], n = 12) {
  return films
    .filter((f) => f.status !== "watchlist" && f.tmdbId && (f.rating || 0) >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, n);
}

/* Les cinéastes de tête. Un seul film noté 5 ne fait pas un cinéaste de
   chevet : on demande soit plusieurs fiches, soit une adhésion très nette. */
export function topDirectors(films = [], taste, n = 5) {
  const counts = new Map();
  films.filter((f) => f.status !== "watchlist").forEach((f) => {
    directorsOf(f).forEach((d) => counts.set(d, (counts.get(d) || 0) + 1));
  });
  return [...taste.directors.entries()]
    .filter(([d, w]) => w > 0 && (counts.get(d) >= 2 || w > 0.75))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, weight]) => ({ name, weight, count: counts.get(name) || 0 }));
}
