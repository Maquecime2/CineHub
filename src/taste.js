/* ============================================================
   THE TASTE PROFILE — what the collection says of the eye
   ============================================================

   Not a recommendation, a MEASUREMENT: which genres, which decades,
   which languages come back, and with what ratings. `reco` and `tonight`
   both read it, and neither redefines it.
   ============================================================ */

/* A rating is not a frequency: watching ten films by a filmmaker and
   rating them all two stars says something quite different from watching
   two and loving them. So the weight carries the sign of the judgement,
   and an unrated card is worth a mild positive rather than a zero. */
export const weightOf = (rating) => (!rating ? 0.35 : (rating - 2.5) / 2.5);

const bump = (map, key, w) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + w);
};

/* Brings the largest absolute value back to 1: two collections of very
   different sizes then give comparable profiles, and a threshold written
   in the code means the same thing in both. */
const normalize = (map) => {
  let max = 0;
  map.forEach((v) => {
    max = Math.max(max, Math.abs(v));
  });
  if (!max) return map;
  const out = new Map();
  map.forEach((v, k) => out.set(k, v / max));
  return out;
};

/* A "director" field can carry several names ("Coen, Coen"). */
export const directorsOf = (f) =>
  (f.director || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const decadeOf = (year) => (year ? Math.floor(Number(year) / 10) * 10 : null);

/**
 * Builds the profile from the films WATCHED. The watchlist does not
 * express an observed taste but an intention — it only serves to avoid
 * recommending what has already been set aside.
 */
export function buildTaste(films = []) {
  const watched = films.filter((f) => f.status !== "watchlist");

  const directors = new Map();
  const genres = new Map();
  const themes = new Map();
  const decades = new Map();
  const languages = new Map();

  let yearSum = 0,
    yearN = 0,
    ratedN = 0;

  for (const f of watched) {
    const w = weightOf(f.rating);
    if (f.rating) ratedN++;
    directorsOf(f).forEach((d) => bump(directors, d, w));
    (f.genres || []).forEach((g) => bump(genres, g, w));
    // keywords are typed by hand: rare, but never imposed
    (f.themes || []).forEach((t) => bump(themes, t, w * 1.4));
    const dec = decadeOf(f.year);
    if (dec) bump(decades, dec, w);
    // missing from the cards imported so far: the language profile stays
    if (f.lang) bump(languages, f.lang, w);
    if (f.year) {
      yearSum += Number(f.year);
      yearN++;
    }
  }

  const meanYear = yearN ? yearSum / yearN : null;
  const spread = yearN
    ? Math.sqrt(
        watched.reduce((a, f) => (f.year ? a + (Number(f.year) - meanYear) ** 2 : a), 0) / yearN
      )
    : null;

  return {
    directors: normalize(directors),
    genres: normalize(genres),
    themes: normalize(themes),
    decades: normalize(decades),
    languages: normalize(languages),
    // the known sets serve to rule out candidates already seen, but also
    // to measure the change of scene: what is not in them is new
    seenGenres: new Set(genres.keys()),
    seenDecades: new Set(decades.keys()),
    seenLanguages: new Set(languages.keys()),
    meanYear,
    spread,
    total: watched.length,
    rated: ratedN,
    // au-dessous de quoi le profil ne dit rien de fiable
    isEmpty: watched.length < 3,
  };
}

/* The best-rated films — the raw material of the "because you loved"
   suggestions. */
export function favorites(films = [], n = 12) {
  return films
    .filter((f) => f.status !== "watchlist" && f.tmdbId && (f.rating || 0) >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, n);
}

/* The leading filmmakers. A single film rated 5 does not make a
   filmmaker you follow: we ask either for several cards, or for a very
   clear endorsement. */
export function topDirectors(films = [], taste, n = 5) {
  const counts = new Map();
  films
    .filter((f) => f.status !== "watchlist")
    .forEach((f) => {
      directorsOf(f).forEach((d) => counts.set(d, (counts.get(d) || 0) + 1));
    });
  return [...taste.directors.entries()]
    .filter(([d, w]) => w > 0 && (counts.get(d) >= 2 || w > 0.75))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, weight]) => ({ name, weight, count: counts.get(name) || 0 }));
}
