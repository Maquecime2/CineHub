/* ============================================================
   THE LETTERBOXD FEED — collecting one's latest screenings, no file
   ============================================================

   The CSV import asks one to go to Letterboxd, request an export,
   download a ZIP and drop a file. That is the right way to PRIME a film
   library, and a chore for adding the six films seen since last time. A
   member's public feed is enough for that second gesture, and it carries
   more than the CSV: the rating, the date of the screening, and above
   all the film's TMDB IDENTIFIER.

   WHAT THE FEED DOES NOT DO, and what must be said on screen rather than
   left to be discovered:

     - it returns A HUNDRED entries, half of which are lists; that leaves
       some fifty screenings, not the whole film library;
     - there is no watchlist feed (`/watchlist/rss/` answers 403): this
       path only brings back films SEEN.

   THE WATCHLIST, THEN. For want of a feed, we read the public pages
   `/{pseudo}/watchlist/page/N/` — HTML, not XML, with all the fragility
   that implies: Letterboxd may rework its template without warning.
   Hence two precautions here, and a single rule to keep in mind while
   reading them: AN ERROR IS BETTER THAN AN EMPTY LIST. A misread page
   returning "zero films" would tell itself as an emptied watchlist, and
   the screen would flag the whole collection as removed.

   So the CSV is not replaced, it is completed.

   WHY A RELAY. Letterboxd returns no `Access-Control-Allow-Origin`
   header on its feed: the browser refuses to read the response, whatever
   is done on the application's side. An intermediary is needed, one that
   does allow the reading. There are two here, and the rest of the
   application has no business knowing which one serves:

     - IN DEVELOPMENT, the Vite server relays by itself (see
       `server.proxy` in `vite.config.ts`). No third party, nothing to
       set up.
     - ONLINE, the site is a STATIC GitHub Pages: there is no server of
       ours to relay. So we go through a public relay, and the address is
       a setting — whoever deploys their own (see
       `docs/relais-letterboxd.md`) pastes it in and depends on nobody
       any more. */
import { store } from "./storage";
import { filmKey, parseRating } from "../domain/importing";
import { mergeWatches } from "../domain/film";
import type { ImportRow, ParsedCsv, Year } from "../types";

export const USER_KEY = "letterboxd-user";
export const RELAY_KEY = "letterboxd-relay";

/* The default relay. A third party sees the request go by: that is
   acceptable HERE because the feed is already public and no secret
   travels through — but it is also why the address stays editable. */
export const DEFAULT_RELAY = "https://corsproxy.io/?url={url}";

const cleanUser = (user: string) => user.trim().replace(/^@/, "");

/* The path, once and for all: the two addresses below differ only by
   it, and it is the only thing that changes between the dev server,
   which relays by itself, and the public relay. */
const lbUrl = (path: string, relay?: string): string => {
  if (import.meta.env.DEV) return `/lb-rss/${path}`;
  const tpl = (relay ?? store.get(RELAY_KEY, DEFAULT_RELAY)).trim() || DEFAULT_RELAY;
  return tpl.replace("{url}", encodeURIComponent(`https://letterboxd.com/${path}`));
};

/** The address to call to read `user`'s feed, relay included. */
export function feedUrl(user: string, relay?: string): string {
  return lbUrl(`${encodeURIComponent(cleanUser(user))}/rss/`, relay);
}

/** The address of one watchlist page. Letterboxd numbers them from 1. */
export function watchlistUrl(user: string, page = 1, relay?: string): string {
  return lbUrl(`${encodeURIComponent(cleanUser(user))}/watchlist/page/${page}/`, relay);
}

/* A namespaced field is read by its FULL name, prefix included:
   `querySelector("letterboxd:filmTitle")` would not find it — there the
   colon is a pseudo-class operator, not a letter. */
const tagOf = (item: Element, name: string): string =>
  item.getElementsByTagName(name)[0]?.textContent?.trim() || "";

/** Reads the feed and returns it in the shape the CSV import already produces. */
export function parseLetterboxdRss(xml: string): ParsedCsv {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  /* A broken relay does not return an error: it returns an HTML page,
     which the XML reader refuses. Without this check we would read "zero
     films" and search a long while on the side of the username. */
  if (doc.querySelector("parsererror") || !doc.querySelector("rss, channel"))
    throw new Error(
      "La réponse n'est pas un flux Letterboxd. Vérifiez le pseudo, ou le relais si vous en avez réglé un."
    );

  const items = [...doc.getElementsByTagName("item")];
  /* The feed mixes screenings and published lists. Only the prefix of
     the `guid` tells them apart — the rest of an entry is alike enough
     for a list to pass as a film. */
  const watches = items.filter((it) => tagOf(it, "guid").startsWith("letterboxd-watch-"));

  let skippedNoTitle = 0;
  let extraWatches = 0;
  const byKey = new Map<string, ImportRow>();

  for (const it of watches) {
    const title = tagOf(it, "letterboxd:filmTitle");
    if (!title) {
      skippedNoTitle++;
      continue;
    }
    const yearRaw = tagOf(it, "letterboxd:filmYear");
    const tmdbId = tagOf(it, "tmdb:movieId");
    /* A film may be seen without being rated: the entry then has NO
       `memberRating`, and `parseRating` returns null — which does not
       mean zero, and will therefore crush no existing rating. */
    const rating = parseRating(tagOf(it, "letterboxd:memberRating") || null);
    const date = tagOf(it, "letterboxd:watchedDate") || null;
    const rewatch = /^yes$/i.test(tagOf(it, "letterboxd:rewatch"));
    const row: ImportRow = {
      title,
      year: yearRaw ? Number(yearRaw) || "" : "",
      rating,
      watchedAt: date,
      uri: tagOf(it, "link") || null,
      // an entry of the feed IS a screening, with that day's rating
      watches: date ? [{ date, rating, ...(rewatch && { rewatch }) }] : [],
      /* The feed's real gift: nothing left to guess by title search,
         neither for TMDB nor for the matching (`diffImport` tests the
         identifier BEFORE the title). */
      tmdbId: tmdbId ? Number(tmdbId) || tmdbId : null,
    };
    /* A rewatch takes up two entries, and the feed gives the rating of
       EACH — enough to watch an opinion move over ten years. So we stack
       them, like the CSV diary: the card stays unique, it is the log
       that grows longer. */
    const k = filmKey(row);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, row);
      continue;
    }
    const watches = mergeWatches(prev.watches, row.watches);
    extraWatches += Math.max(0, watches.length - (prev.watches?.length || 0));
    const recent = (row.watchedAt || "") >= (prev.watchedAt || "");
    byKey.set(k, {
      ...prev,
      ...(recent ? row : null),
      rating: (recent ? row.rating : prev.rating) ?? prev.rating ?? row.rating,
      watches,
    });
  }

  const rows = [...byKey.values()];
  return {
    rows,
    // there is no watchlist feed: this path only returns what was seen
    kind: "watched",
    stats: {
      lines: watches.length,
      total: rows.length,
      // a rewatch is one screening more, not a reject
      duplicatesInFile: watches.length - skippedNoTitle - rows.length - extraWatches,
      withRating: rows.filter((r) => r.rating != null).length,
      withoutRating: rows.filter((r) => r.rating == null).length,
      skippedNoTitle,
    },
  };
}

/** Reads a member's feed. Rejects with a message displayable as it is. */
export async function fetchLetterboxdFeed(user: string, relay?: string): Promise<ParsedCsv> {
  if (!user.trim()) throw new Error("Indiquez d'abord votre pseudo Letterboxd.");
  let res: Response;
  try {
    res = await fetch(feedUrl(user, relay));
  } catch {
    /* A `fetch` failure never says why — CORS, network, dead relay all
       look alike. We name the most likely cause instead of returning
       "Failed to fetch". */
    throw new Error("Le relais n'a pas répondu. Il est peut-être hors service — voyez « relais ».");
  }
  if (!res.ok) throw new Error(`Le flux a répondu ${res.status}. Le pseudo est-il le bon ?`);
  return parseLetterboxdRss(await res.text());
}

/* ============================================================
   THE WATCHLIST — read from the pages, for want of a feed
   ============================================================ */

/* A film is not described the same way twice depending on the age of
   the template: the old one lays the attributes on `.film-poster`, the
   recent one on a React component, and the title hides sometimes in an
   attribute, sometimes in the poster's `alt`. So we read the first value
   that shows up instead of betting on a single one. */
const attrOf = (el: Element, names: string[]): string => {
  for (const n of names) {
    const v = el.getAttribute(n)?.trim();
    if (v) return v;
  }
  return "";
};

/* The current template does not give the year separately: it is stuck
   to the title, "Rachel, Rachel (1968)". We detach it — otherwise it
   would enter the matching key by the wrong end and a film already in
   the collection would be recreated instead of recognised. */
const splitYear = (name: string): { title: string; year: Year } => {
  const m = name.match(/^(.*?)\s*\((\d{4})\)$/);
  return m ? { title: m[1]!.trim(), year: Number(m[2]) } : { title: name, year: "" };
};

/** What one watchlist page teaches: its films, and how many there are. */
export interface WatchlistPage {
  rows: ImportRow[];
  lastPage: number;
  skippedNoTitle: number;
}

/** Reads one watchlist page. Throws rather than return a doubtful empty list. */
export function parseWatchlistPage(html: string): WatchlistPage {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const posters = [...doc.querySelectorAll("[data-film-slug], [data-item-slug]")];

  /* The guard rail. A genuinely empty watchlist SAYS SO — Letterboxd
     lays a "No films yet" in `.empty-text`; a broken relay, a private
     profile or a wrong username return something else entirely. Without
     that distinction the two cases would look alike, and the second
     would tell itself as the first. */
  if (!posters.length && !doc.querySelector(".empty-text, .empty-watchlist, ul.poster-list"))
    throw new Error(
      "Cette page n'a pas la forme d'une watchlist Letterboxd. Vérifiez le pseudo, que le profil est public, ou le relais si vous en avez réglé un."
    );

  let skippedNoTitle = 0;
  const rows: ImportRow[] = [];
  for (const el of posters) {
    const name =
      attrOf(el, ["data-item-name", "data-film-name", "data-film-title"]) ||
      el.querySelector("img")?.getAttribute("alt")?.trim() ||
      "";
    if (!name) {
      skippedNoTitle++;
      continue;
    }
    /* The year comes from the attribute when it exists (old template),
       from the title otherwise (current template). */
    const yearRaw = attrOf(el, ["data-film-release-year", "data-item-release-year"]);
    const named = splitYear(name);
    const slug = attrOf(el, ["data-item-slug", "data-film-slug"]);
    rows.push({
      title: named.title,
      year: yearRaw ? Number(yearRaw) || "" : named.year,
      /* A wish is neither rated nor seen. `null` and the empty log are
         not holes to be filled: they are the only values that keep
         `diffImport` from crushing a rating or a screening already
         written on a card for the same film. */
      rating: null,
      watchedAt: null,
      uri: slug ? `https://letterboxd.com/film/${slug}/` : null,
      watches: [],
    });
  }

  /* The pagination gives the number of pages at once: better read it
     than grope along to the first empty page. A short watchlist has no
     pagination at all — it is then one page, and one only. */
  const pages = [...doc.querySelectorAll(".paginate-pages li")]
    .map((li) => Number(li.textContent?.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return { rows, lastPage: Math.max(1, ...pages), skippedNoTitle };
}

/* Letterboxd serves 28 films per page: a watchlist of a thousand films
   would make thirty-six of them. The ceiling is not a limit of taste, it
   is insurance against a misread pagination that would set the loop
   spinning. */
const MAX_PAGES = 40;

interface WatchlistOptions {
  /** Called after each page, so that the screen shows the progress. */
  onProgress?: (done: number, total: number) => void;
}

async function fetchPage(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Le relais n'a pas répondu. Il est peut-être hors service — voyez « relais ».");
  }
  if (!res.ok)
    throw new Error(
      `La watchlist a répondu ${res.status}. Le pseudo est-il le bon, et le profil public ?`
    );
  return res.text();
}

/** Reads a member's watchlist, page after page. Message displayable as it is. */
export async function fetchLetterboxdWatchlist(
  user: string,
  relay?: string,
  { onProgress }: WatchlistOptions = {}
): Promise<ParsedCsv> {
  if (!user.trim()) throw new Error("Indiquez d'abord votre pseudo Letterboxd.");

  const first = parseWatchlistPage(await fetchPage(watchlistUrl(user, 1, relay)));
  const total = Math.min(first.lastPage, MAX_PAGES);
  onProgress?.(1, total);

  let lines = first.rows.length + first.skippedNoTitle;
  let skippedNoTitle = first.skippedNoTitle;
  const byKey = new Map<string, ImportRow>();
  const keep = (rows: ImportRow[]) => rows.forEach((r) => byKey.set(filmKey(r), r));
  keep(first.rows);

  /* The pages are read one AFTER the other. In parallel we would gain a
     few seconds and offer a public relay a burst of thirty requests —
     which is the surest way to have the next one refused. */
  for (let p = 2; p <= total; p++) {
    const page = parseWatchlistPage(await fetchPage(watchlistUrl(user, p, relay)));
    keep(page.rows);
    lines += page.rows.length + page.skippedNoTitle;
    skippedNoTitle += page.skippedNoTitle;
    onProgress?.(p, total);
  }

  /* THE ORDER IS DATA. The page dates no wish, but it serves them in
     the order they were set aside, the most recent first — that is the
     "When Added / Newest First" sort Letterboxd applies to a watchlist
     by default. Without carrying it over, the five hundred cards of one
     reading would be born at the same millisecond and the shelf's "by
     addition" sort would give an arbitrary order. So we space them one
     minute apart, going back in time from now. */
  const base = Date.now();
  const rows = [...byKey.values()].map((r, i) => ({ ...r, addedAt: base - i * 60_000 }));
  return {
    rows,
    kind: "watchlist",
    stats: {
      lines,
      total: rows.length,
      duplicatesInFile: lines - skippedNoTitle - rows.length,
      // a wish is never rated: these two counts are there for the form
      withRating: 0,
      withoutRating: rows.length,
      skippedNoTitle,
    },
  };
}
