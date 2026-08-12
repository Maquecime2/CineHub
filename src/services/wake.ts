/* ============================================================
   HARVESTING THE WAKE — the few requests, and nothing else

   Kept apart from the sorting (`domain/wakeAfar`) for the usual reason:
   what touches the network can only be tested by simulating it, what
   ranks can simply be tested. This module decides nothing — it asks, and
   returns what it was told.

   FIVE REQUESTS AT MOST, and all of them cached by `tmdb.js` (seven
   days). Opening a card must not cost a harvest: these are suggestions
   beside a film, not a sweep of the catalogue.
   ============================================================ */
import {
  recommendationsFor,
  searchPerson,
  personFilmography,
  fetchKeywords,
  discover,
  pooled,
} from "../tmdb";
import type { Harvest } from "../domain/wakeAfar";
import type { Film } from "../types";
import type { Link } from "../domain/wake";

/* The paths we follow, in the order they count. We do NOT ask for the
   writing or the supporting parts: five requests fit in a second, fifteen
   make you wait — and the first two trades plus the directing already
   carry the essentials of what brings films together.

   `role` and the `crew` keys stay French: they are what is written on
   disk, and what TMDB's harvest files a card under. */
const PATHS: { link: Link; role: string; from: (f: Film) => string | undefined }[] = [
  { link: "cinematography", role: "image", from: (f) => f.crew?.image?.[0] },
  { link: "music", role: "musique", from: (f) => f.crew?.musique?.[0] },
  { link: "directing", role: "réalisation", from: (f) => f.director?.split(",")[0]?.trim() },
  { link: "actor", role: "interprétation", from: (f) => f.cast?.[0] },
];

/**
 * What TMDB has around this film: its recommendations, and what its four
 * leading craftspeople did elsewhere.
 *
 * Returns raw harvests — the merging, the exclusion of what we already
 * own and the ranking are `mergeAfar`'s business.
 *
 * A request that fails is LOST, not fatal: `pooled` swallows the
 * failures, and a cinematographer who cannot be found must not carry the
 * recommendations off with them.
 */
export async function harvestTheWake(pivot: Film, apiKey: string): Promise<Harvest[]> {
  if (!apiKey) return [];

  const tasks: (() => Promise<Harvest | null>)[] = [];

  if (pivot.tmdbId)
    tasks.push(async () => ({
      via: "crowd",
      /* No value: "vu par les mêmes gens" stands alone, and the name that
         would follow is the film you already have in front of you. */
      value: "",
      candidates: await recommendationsFor(pivot.tmdbId, apiKey),
    }));

  for (const path of PATHS) {
    const name = path.from(pivot);
    if (!name) continue;
    tasks.push(async () => {
      const person = await searchPerson(name, apiKey);
      if (!person) return null;
      return {
        via: path.link,
        value: name,
        candidates: await personFilmography(person.id, apiKey, { role: path.role }),
      };
    });
  }

  /* THE SUBJECT PATH, which was missing entirely.

     The four paths above all lead to PEOPLE: so the "elsewhere" column
     could only return filmographies, and "same subject" never appeared
     in it. `/discover` accepts keywords — but it needs their
     IDENTIFIERS, which `film.keywords` does not keep (it only has the
     labels, which read). So we ask for them again here: the call is
     cached, and it is the same one the open card makes.

     Three keywords joined by a vertical bar, that is to say an OR:
     requiring all three at once would return almost nothing, and the
     first three are the most specific of the lot. */
  if (pivot.tmdbId)
    tasks.push(async () => {
      const words = await fetchKeywords(pivot.tmdbId, apiKey);
      const ids = words
        .map((m: { id?: number }) => m.id)
        .filter(Boolean)
        .slice(0, 3);
      if (!ids.length) return null;
      return {
        via: "keyword",
        value: words
          .slice(0, 3)
          .map((m: { name?: string }) => m.name)
          .filter(Boolean)
          .join(", "),
        candidates: await discover(
          { with_keywords: ids.join("|"), sort_by: "vote_count.desc" },
          apiKey
        ),
      };
    });

  const results = await pooled(tasks, { concurrency: 5 });
  return results.filter((r): r is Harvest => !!r?.candidates?.length);
}
