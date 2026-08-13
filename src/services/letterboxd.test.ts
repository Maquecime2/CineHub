import { describe, it, expect, vi, afterEach } from "vitest";
import fr from "../i18n/fr";
import en from "../i18n/en";
import {
  LetterboxdError,
  parseLetterboxdRss,
  parseWatchlistPage,
  fetchLetterboxdWatchlist,
  feedUrl,
  watchlistUrl,
  DEFAULT_RELAY,
} from "./letterboxd";

/* An extract of a REAL feed, frozen here. No network call in these
   tests: what we check is the reading, and a live feed would change
   content between two runs. It deliberately carries the four cases that
   matter — a rated screening, a list, a film seen without a rating, and
   a rewatch of the same film on two dates. */
const item = (guid: string, inner: string) =>
  `<item><guid isPermaLink="false">${guid}</guid>${inner}</item>`;

const FEED = `<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">
<channel><title>Letterboxd - Essai</title>
${item(
  "letterboxd-watch-1",
  `<title>Toy Story 4, 2019 - ★★★½</title>
   <link>https://letterboxd.com/essai/film/toy-story-4/</link>
   <letterboxd:watchedDate>2026-06-25</letterboxd:watchedDate>
   <letterboxd:rewatch>Yes</letterboxd:rewatch>
   <letterboxd:filmTitle>Toy Story 4</letterboxd:filmTitle>
   <letterboxd:filmYear>2019</letterboxd:filmYear>
   <letterboxd:memberRating>3.5</letterboxd:memberRating>
   <tmdb:movieId>301528</tmdb:movieId>`
)}
${item(
  "letterboxd-list-99",
  `<title>Mes films de 2026</title>
   <link>https://letterboxd.com/essai/list/2026/</link>
   <letterboxd:filmTitle>Mes films de 2026</letterboxd:filmTitle>`
)}
${item(
  "letterboxd-watch-2",
  `<title>The Backrooms, 2022</title>
   <link>https://letterboxd.com/essai/film/the-backrooms/</link>
   <letterboxd:watchedDate>2026-05-22</letterboxd:watchedDate>
   <letterboxd:filmTitle>The Backrooms</letterboxd:filmTitle>
   <letterboxd:filmYear>2022</letterboxd:filmYear>
   <tmdb:movieId>979600</tmdb:movieId>`
)}
${item(
  "letterboxd-watch-3",
  `<title>Toy Story 4, 2019 - ★★★</title>
   <link>https://letterboxd.com/essai/film/toy-story-4/1/</link>
   <letterboxd:watchedDate>2024-01-02</letterboxd:watchedDate>
   <letterboxd:filmTitle>Toy Story 4</letterboxd:filmTitle>
   <letterboxd:filmYear>2019</letterboxd:filmYear>
   <letterboxd:memberRating>3.0</letterboxd:memberRating>
   <tmdb:movieId>301528</tmdb:movieId>`
)}
</channel></rss>`;

const parsed = () => parseLetterboxdRss(FEED);
const find = (title: string) => parsed().rows.find((r) => r.title === title);

describe("reading the Letterboxd feed", () => {
  it("returns a complete screening, TMDB identifier included", () => {
    expect(find("The Backrooms")).toMatchObject({
      title: "The Backrooms",
      year: 2022,
      watchedAt: "2026-05-22",
      tmdbId: 979600,
      uri: "https://letterboxd.com/essai/film/the-backrooms/",
    });
  });

  /* The identifier is what lets `diffImport` match without going
     through the title, and TMDB stop searching. It is the only field of
     the feed that existed in no CSV. */
  it("gives the TMDB identifier as a number, not a string", () => {
    expect(find("Toy Story 4")!.tmdbId).toBe(301528);
  });

  /* The feed mixes published lists in with the screenings: without the
     sorting on the `guid`, "Mes films de 2026" would enter the film
     library as a film — it has a title and a link, nothing would give it
     away. */
  it("sets aside the lists, which are not films", () => {
    expect(parsed().rows.map((r) => r.title)).not.toContain("Mes films de 2026");
    expect(parsed().rows).toHaveLength(2);
  });

  /* Zero means "rated zero" in the model. A film seen without a rating
     must come out as null, otherwise a re-import crushes an existing
     rating with a zero nobody gave. */
  it('tells "no rating" from "rated zero"', () => {
    expect(find("The Backrooms")!.rating).toBeNull();
    expect(find("Toy Story 4")!.rating).toBe(3.5);
  });

  it("melts a rewatch into one card, not two", () => {
    const rows = parsed().rows.filter((r) => r.title === "Toy Story 4");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.watchedAt).toBe("2026-06-25");
  });

  /* The feed gives the rating of EVERY screening. Reducing them to the
     last one meant throwing away the one thing that says an opinion has
     moved. */
  it("keeps both screenings of a rewatched film, each with its rating", () => {
    expect(find("Toy Story 4")!.watches).toEqual([
      { date: "2026-06-25", rating: 3.5, rewatch: true },
      { date: "2024-01-02", rating: 3 },
    ]);
  });

  it("logs a screening even with no rating", () => {
    expect(find("The Backrooms")!.watches).toEqual([{ date: "2026-05-22", rating: null }]);
  });

  /* A rewatch is not a reject: announcing it as a duplicate would make
     one believe we lost the very thing we have just kept. */
  it("counts what it has read, without taking rewatches for duplicates", () => {
    expect(parsed().stats).toMatchObject({
      lines: 3,
      total: 2,
      duplicatesInFile: 0,
      withRating: 1,
      withoutRating: 1,
    });
  });

  // there is no watchlist feed: this path only returns what was seen
  it("announces films seen", () => {
    expect(parsed().kind).toBe("watched");
  });

  /* A broken relay does not answer with an error: it answers with a
     page. Reading it in silence would give "no screening at all", and we
     would search on the side of the username while the real culprit is
     the relay. */
  it("refuses an HTML page with a code that says what to check", () => {
    expect(() => parseLetterboxdRss("<html><body>503 Service Unavailable</body></html>")).toThrow(
      LetterboxdError
    );
    expect(codeOf(() => parseLetterboxdRss("<html><body>503</body></html>"))).toBe("notAFeed");
  });
});

describe("the feed's address", () => {
  /* The tests run under Vitest, hence in development mode: it is the
     relative path of the Vite proxy that must come out. */
  it("goes through the development server, with no relay and no third party", () => {
    expect(feedUrl("essai")).toBe("/lb-rss/essai/rss/");
  });

  it("lets a handle be pasted with its at-sign", () => {
    expect(feedUrl("@essai")).toBe("/lb-rss/essai/rss/");
  });

  it("has a default relay that knows where to put the address", () => {
    expect(DEFAULT_RELAY).toContain("{url}");
  });

  it("numbers the watchlist pages from one", () => {
    expect(watchlistUrl("@essai")).toBe("/lb-rss/essai/watchlist/page/1/");
    expect(watchlistUrl("essai", 3)).toBe("/lb-rss/essai/watchlist/page/3/");
  });
});

/* The watchlist has no feed: we read HTML. This template is the one
   Letterboxd serves TODAY, taken from a real page and reduced to three
   films — a title carrying a comma, one without a year, and a poster
   without a name. The pagination is reproduced as it is, ellipsis
   included: it is what says how many pages to read. */
const GRID = `<html><body><section>
  <div class="poster-grid"><ul class="grid -p125">
    <li class="griditem">
      <div class="react-component" data-component-class="LazyPoster"
           data-item-name="Rachel, Rachel (1968)" data-item-slug="rachel-rachel"
           data-item-link="/film/rachel-rachel/"></div>
    </li>
    <li class="griditem">
      <div class="react-component" data-item-name="Le Samouraï (1967)"
           data-item-slug="le-samourai"></div>
    </li>
    <li class="griditem">
      <div class="react-component" data-item-slug="sans-nom"></div>
    </li>
  </ul></div>
  <div class="paginate-pages"><ul>
    <li class="paginate-page paginate-current"><span>1</span></li>
    <li class="paginate-page"><a href="/x/watchlist/page/2/">2</a></li>
    <li class="paginate-page unseen-pages">&hellip;</li>
    <li class="paginate-page"><a href="/x/watchlist/page/4/">4</a></li>
  </ul></div>
</section></body></html>`;

/* The old template, still served here and there: the year is an
   attribute there and the title lives in the poster's `alt`. */
const OLD = `<html><body><ul class="poster-list">
  <li class="poster-container">
    <div class="film-poster" data-film-slug="vivre-sa-vie"
         data-film-release-year="1962"><img alt="Vivre sa vie"></div>
  </li>
</ul></body></html>`;

describe("reading one watchlist page", () => {
  const page = () => parseWatchlistPage(GRID);

  it("returns each film with its year and its address", () => {
    expect(page().rows[0]).toMatchObject({
      title: "Rachel, Rachel",
      year: 1968,
      uri: "https://letterboxd.com/film/rachel-rachel/",
    });
  });

  /* The year is stuck to the title, not in an attribute. Leaving it
     there would make "Le Samouraï (1967)" a film the collection would
     never recognise — and would recreate at every reading. */
  it("pulls the year off the title without eating the rest", () => {
    expect(page().rows[1]).toMatchObject({ title: "Le Samouraï", year: 1967 });
  });

  /* A wish has neither rating nor screening. Returning them as zero
     rather than null would crush, on re-import, the rating of an
     already-seen film still lying about in the watchlist. */
  it("lends neither rating nor screening to a wish", () => {
    expect(page().rows[1]).toMatchObject({ rating: null, watchedAt: null, watches: [] });
  });

  it("counts the untitled posters instead of inventing them", () => {
    expect(page().rows).toHaveLength(2);
    expect(page().skippedNoTitle).toBe(1);
  });

  /* The pagination carries an ellipsis between the third page and the
     last: it is the LARGEST number that counts, not the last one read,
     and certainly not the "…". */
  it("reads the number of pages from the pagination, ellipsis included", () => {
    expect(page().lastPage).toBe(4);
  });

  it("takes a short watchlist for a single page", () => {
    expect(parseWatchlistPage(OLD).lastPage).toBe(1);
  });

  it("still understands the old template, where the year is an attribute", () => {
    expect(parseWatchlistPage(OLD).rows[0]).toMatchObject({
      title: "Vivre sa vie",
      year: 1962,
      uri: "https://letterboxd.com/film/vivre-sa-vie/",
    });
  });

  /* THE point of the guard rail: a page that is not a watchlist must
     throw, not return zero films. Zero films would tell itself as an
     emptied watchlist, and the screen would flag the whole collection as
     removed. */
  it("refuses a page that is not a watchlist", () => {
    expect(codeOf(() => parseWatchlistPage("<html><body>503</body></html>"))).toBe("notAWatchlist");
  });

  /* An empty watchlist says so: Letterboxd lays a "No films yet" in
     `.empty-text`. That is what tells it apart from a failed page. */
  it("accepts, on the other hand, a genuinely empty watchlist", () => {
    const empty = `<html><body><p class="empty-text">No films yet</p></body></html>`;
    expect(parseWatchlistPage(empty).rows).toEqual([]);
  });
});

/* The whole reading, pages included. The network is replaced by a
   dictionary of pages: what we check here is the LOOP and the order, not
   the ability of `fetch` to go and get a page. */
describe("taking down a whole watchlist", () => {
  const page = (names: string[], last: number) =>
    `<html><body><ul class="grid">${names
      .map(
        (n) =>
          `<li class="griditem"><div class="react-component" data-item-name="${n}"
             data-item-slug="${n.toLowerCase().replace(/\W+/g, "-")}"></div></li>`
      )
      .join("")}</ul>
     <div class="paginate-pages"><ul><li>1</li><li>${last}</li></ul></div></body></html>`;

  const serve = (pages: Record<string, string>) =>
    vi.stubGlobal("fetch", (url: string) => {
      const html = pages[url];
      return Promise.resolve({
        ok: html !== undefined,
        status: html === undefined ? 404 : 200,
        text: () => Promise.resolve(html ?? ""),
      } as Response);
    });

  afterEach(() => vi.unstubAllGlobals());

  it("follows the pagination and returns the films in page order", async () => {
    serve({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)", "Solaris (1972)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Le Miroir (1975)"], 2),
    });
    const { rows, stats, kind } = await fetchLetterboxdWatchlist("essai");
    expect(kind).toBe("watchlist");
    expect(rows.map((r) => r.title)).toEqual(["Stalker", "Solaris", "Le Miroir"]);
    expect(stats.total).toBe(3);
  });

  /* THE ORDER IS DATA: the page serves the watchlist from the most
     recently added to the oldest. Without carrying it over, the three
     cards would be born at the same millisecond and the "by addition"
     sort would be at random. */
  it("dates the cards in the order they were set aside", async () => {
    serve({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)", "Solaris (1972)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Le Miroir (1975)"], 2),
    });
    const { rows } = await fetchLetterboxdWatchlist("essai");
    const dates = rows.map((r) => r.addedAt!);
    expect(dates[0]).toBeGreaterThan(dates[1]!);
    expect(dates[1]).toBeGreaterThan(dates[2]!);
  });

  it("announces the progress page after page", async () => {
    serve({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Solaris (1972)"], 2),
    });
    const seen: string[] = [];
    await fetchLetterboxdWatchlist("essai", undefined, {
      onProgress: (d, t) => seen.push(`${d}/${t}`),
    });
    expect(seen).toEqual(["1/2", "2/2"]);
  });

  it("refuses an empty handle before touching the network", async () => {
    await expect(fetchLetterboxdWatchlist("  ")).rejects.toBeInstanceOf(LetterboxdError);
  });
});

/* THE CODE IS THE CONTRACT, and a code nobody wrote a sentence for shows
   `letterboxd.notAFeed` on screen. Neither catalogue may forget one. */
const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (e) {
    return e instanceof LetterboxdError ? e.code : undefined;
  }
  return undefined;
};

describe("every failure code has a sentence", () => {
  const CODES = [
    "noHandle",
    "relaySilent",
    "notAFeed",
    "notAWatchlist",
    "feedStatus",
    "watchlistStatus",
  ];
  it.each(CODES)("%s reads in both languages", (code) => {
    for (const [name, tree] of [
      ["fr", fr],
      ["en", en],
    ] as const)
      expect(
        (tree.letterboxd as Record<string, string>)[code]?.trim(),
        `${code} is missing in ${name}`
      ).toBeTruthy();
  });
});
