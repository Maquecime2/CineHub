/* ============================================================
   GOING AND ASKING WHO TAUGHT WHOM
   ============================================================

   `domain/hints` turns a triple into a hint and says nothing about how
   a triple is come by. This is that half: two questions, a cache, and
   a failure that is allowed to reach the screen.

   THE BINDER ONLY EVER KNOWS NAMES, so the hinge is TMDB's person id.
   `searchPerson` already finds it, and it already carries the correction
   worth remembering: it does NOT take `results[0]`, because that is
   TMDB's POPULARITY ranking — asking for a director who shares a name
   with a better-known actor returned the actor. The trade therefore goes
   into the question AND into the cache key. Nothing to redo here, only
   to call it with `role: "réalisation"`.

   THE FAILURE RISES. `Trouble` and `Nothing` are not the same screen,
   and the view can only tell them apart if the throw crosses. This is a
   LOADING and not a decoration, so no `.catch(() => {})` — the rule
   `CLAUDE.md` states for a page and denies to a portrait.

   AN EMPTY ANSWER IS AN ANSWER, and this is the only line of the file
   that is not obvious. Wikidata knows nothing at all about most
   film-makers. Filing "nothing" as "never asked" would send the harvest
   back for the same fifty names every single time it is run, for ever —
   the rule already written for `keywords` and for `frames`.
   ============================================================ */
import { searchPerson, pooled } from "../tmdb";
import { ADDRESS } from "./server";
import { hintFromLink } from "../domain/hints";
import type { Hint, RawLink } from "../domain/hints";

const CACHE_KEY = "lineage-hints";
/* One week, and the figure is `tmdb.js`'s `DISC_TTL`: a filiation does
   not change, but a Q-item gains statements. */
const TTL = 7 * 24 * 3600 * 1000;
const KEPT = 300;

/* FIFTY, AND THE SERVER SAYS SO TOO (`MAX_SEEDS` in `wikidata.ts`).
   Written on both sides on purpose: the client batches politely, the
   route refuses anyway — a bound that only the caller respects is not a
   bound. */
const BATCH = 50;

interface Entry {
  t: number;
  v: RawLink[];
}

const read = (): Record<string, Entry> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};

const write = (cache: Record<string, Entry>): void => {
  try {
    /* Lazy purge, past three hundred entries the oldest go — the copy of
       `readDisc`/`writeDisc`, so that a quota exception cannot make a
       harvest fail after the answers are already in hand. */
    const keys = Object.keys(cache);
    if (keys.length > KEPT) {
      keys
        .sort((a, b) => (cache[a]?.t ?? 0) - (cache[b]?.t ?? 0))
        .slice(0, keys.length - KEPT)
        .forEach((k) => delete cache[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* Nothing to do: the cache is a comfort, and losing it costs a
         request. */
    }
  }
};

/** Asks the relay about a batch of ids. Throws if it will not answer. */
async function askRelay(ids: string[]): Promise<RawLink[]> {
  const res = await fetch(`${ADDRESS}/lineage/hints?tmdb=${ids.join(",")}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`lineage/hints: ${res.status}`);
  const body = (await res.json()) as { links?: RawLink[] };
  return Array.isArray(body.links) ? body.links : [];
}

export interface HintsProgress {
  (done: number, total: number): void;
}

/**
 * The hints Wikidata has on these film-makers, by name.
 *
 * Nothing is filtered against what is already stated: `usefulHints` does
 * that, and only the caller holds the current bonds.
 */
export async function hintsFor(
  names: string[],
  apiKey: string,
  onProgress?: HintsProgress
): Promise<Hint[]> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!wanted.length) return [];

  /* ONE: the names we can put a TMDB id on. `pooled` swallows a lost
     request, which is right here — a name we could not resolve is one
     film-maker with no hints, not a harvest that failed. */
  /* The count is kept here rather than handed to `pooled`: its
     `onProgress` is inferred from a JavaScript module and is not visible
     to `tsc`, and adding a type to `tmdb.js` for one caller would be a
     wide change for a progress bar. */
  const total = wanted.length + 1;
  let done = 0;
  const found = await pooled(
    wanted.map((name) => async () => {
      try {
        return await searchPerson(name, apiKey, { role: "réalisation" });
      } finally {
        onProgress?.((done += 1), total);
      }
    }),
    { concurrency: 5 }
  );
  const ids = [
    ...new Set(
      (found as ({ id: number } | null)[]).filter((p) => p && p.id).map((p) => String(p!.id))
    ),
  ];
  if (!ids.length) return [];

  /* TWO: what the cache already holds, and only the rest is asked. */
  const cache = read();
  const now = Date.now();
  const rows: RawLink[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const hit = cache[id];
    if (hit && now - hit.t < TTL) rows.push(...hit.v);
    else missing.push(id);
  }

  if (missing.length) {
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const links = await askRelay(batch);
      /* EVERY ID ASKED GETS AN ENTRY, including the ones no row came
         back for: that is the difference between "nothing" and "never
         asked". */
      for (const id of batch) cache[id] = { t: now, v: [] };
      for (const link of links) {
        if (link.seed && cache[link.seed]) cache[link.seed]!.v.push(link);
      }
      rows.push(...links);
    }
    write(cache);
  }
  onProgress?.(total, total);

  return rows.map(hintFromLink).filter((h): h is Hint => h !== null);
}

/** Forgets everything memorised — for a "look again" the screen offers. */
export function forgetHints(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* Already unreachable: nothing memorised, nothing to forget. */
  }
}
