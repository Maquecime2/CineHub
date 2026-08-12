import { describe, it, expect, vi, afterEach } from "vitest";
import {
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

const FLUX = `<?xml version='1.0' encoding='utf-8'?>
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

const parsed = () => parseLetterboxdRss(FLUX);
const find = (title: string) => parsed().rows.find((r) => r.title === title);

describe("lire le flux Letterboxd", () => {
  it("rend une séance complète, identifiant TMDB compris", () => {
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
  it("donne l'identifiant TMDB en nombre, pas en chaîne", () => {
    expect(find("Toy Story 4")!.tmdbId).toBe(301528);
  });

  /* The feed mixes published lists in with the screenings: without the
     sorting on the `guid`, "Mes films de 2026" would enter the film
     library as a film — it has a title and a link, nothing would give it
     away. */
  it("écarte les listes, qui ne sont pas des films", () => {
    expect(parsed().rows.map((r) => r.title)).not.toContain("Mes films de 2026");
    expect(parsed().rows).toHaveLength(2);
  });

  /* Zero means "rated zero" in the model. A film seen without a rating
     must come out as null, otherwise a re-import crushes an existing
     rating with a zero nobody gave. */
  it("distingue « pas de note » de « noté zéro »", () => {
    expect(find("The Backrooms")!.rating).toBeNull();
    expect(find("Toy Story 4")!.rating).toBe(3.5);
  });

  it("fond un revisionnage en une fiche, pas deux", () => {
    const rows = parsed().rows.filter((r) => r.title === "Toy Story 4");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.watchedAt).toBe("2026-06-25");
  });

  /* The feed gives the rating of EVERY screening. Reducing them to the
     last one meant throwing away the one thing that says an opinion has
     moved. */
  it("garde les deux séances d'un film revu, chacune avec sa note", () => {
    expect(find("Toy Story 4")!.watches).toEqual([
      { date: "2026-06-25", rating: 3.5, rewatch: true },
      { date: "2024-01-02", rating: 3 },
    ]);
  });

  it("consigne une séance même sans note", () => {
    expect(find("The Backrooms")!.watches).toEqual([{ date: "2026-05-22", rating: null }]);
  });

  /* A rewatch is not a reject: announcing it as a duplicate would make
     one believe we lost the very thing we have just kept. */
  it("compte ce qu'il a lu, sans prendre les revoyures pour des doublons", () => {
    expect(parsed().stats).toMatchObject({
      lines: 3,
      total: 2,
      duplicatesInFile: 0,
      withRating: 1,
      withoutRating: 1,
    });
  });

  // there is no watchlist feed: this path only returns what was seen
  it("annonce des films vus", () => {
    expect(parsed().kind).toBe("watched");
  });

  /* A broken relay does not answer with an error: it answers with a
     page. Reading it in silence would give "no screening at all", and we
     would search on the side of the username while the real culprit is
     the relay. */
  it("refuse une page HTML avec un message qui dit quoi vérifier", () => {
    expect(() => parseLetterboxdRss("<html><body>503 Service Unavailable</body></html>")).toThrow(
      /pseudo|relais/i
    );
  });
});

describe("l'adresse du flux", () => {
  /* The tests run under Vitest, hence in development mode: it is the
     relative path of the Vite proxy that must come out. */
  it("passe par le serveur de développement, sans relais ni tiers", () => {
    expect(feedUrl("essai")).toBe("/lb-rss/essai/rss/");
  });

  it("laisse coller un pseudo avec son arobase", () => {
    expect(feedUrl("@essai")).toBe("/lb-rss/essai/rss/");
  });

  it("a un relais par défaut qui sait où mettre l'adresse", () => {
    expect(DEFAULT_RELAY).toContain("{url}");
  });

  it("numérote les pages de watchlist à partir de un", () => {
    expect(watchlistUrl("@essai")).toBe("/lb-rss/essai/watchlist/page/1/");
    expect(watchlistUrl("essai", 3)).toBe("/lb-rss/essai/watchlist/page/3/");
  });
});

/* The watchlist has no feed: we read HTML. This template is the one
   Letterboxd serves TODAY, taken from a real page and reduced to three
   films — a title carrying a comma, one without a year, and a poster
   without a name. The pagination is reproduced as it is, ellipsis
   included: it is what says how many pages to read. */
const GRILLE = `<html><body><section>
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
const ANCIEN = `<html><body><ul class="poster-list">
  <li class="poster-container">
    <div class="film-poster" data-film-slug="vivre-sa-vie"
         data-film-release-year="1962"><img alt="Vivre sa vie"></div>
  </li>
</ul></body></html>`;

describe("lire une page de watchlist", () => {
  const page = () => parseWatchlistPage(GRILLE);

  it("rend chaque film avec son année et son adresse", () => {
    expect(page().rows[0]).toMatchObject({
      title: "Rachel, Rachel",
      year: 1968,
      uri: "https://letterboxd.com/film/rachel-rachel/",
    });
  });

  /* The year is stuck to the title, not in an attribute. Leaving it
     there would make "Le Samouraï (1967)" a film the collection would
     never recognise — and would recreate at every reading. */
  it("détache l'année du titre sans manger le reste", () => {
    expect(page().rows[1]).toMatchObject({ title: "Le Samouraï", year: 1967 });
  });

  /* A wish has neither rating nor screening. Returning them as zero
     rather than null would crush, on re-import, the rating of an
     already-seen film still lying about in the watchlist. */
  it("ne prête ni note ni séance à une envie", () => {
    expect(page().rows[1]).toMatchObject({ rating: null, watchedAt: null, watches: [] });
  });

  it("compte les affiches sans titre au lieu de les inventer", () => {
    expect(page().rows).toHaveLength(2);
    expect(page().skippedNoTitle).toBe(1);
  });

  /* The pagination carries an ellipsis between the third page and the
     last: it is the LARGEST number that counts, not the last one read,
     and certainly not the "…". */
  it("lit le nombre de pages dans la pagination, points de suspension compris", () => {
    expect(page().lastPage).toBe(4);
  });

  it("tient une watchlist courte pour une seule page", () => {
    expect(parseWatchlistPage(ANCIEN).lastPage).toBe(1);
  });

  it("comprend encore l'ancien gabarit, où l'année est un attribut", () => {
    expect(parseWatchlistPage(ANCIEN).rows[0]).toMatchObject({
      title: "Vivre sa vie",
      year: 1962,
      uri: "https://letterboxd.com/film/vivre-sa-vie/",
    });
  });

  /* THE point of the guard rail: a page that is not a watchlist must
     throw, not return zero films. Zero films would tell itself as an
     emptied watchlist, and the screen would flag the whole collection as
     removed. */
  it("refuse une page qui n'est pas une watchlist", () => {
    expect(() => parseWatchlistPage("<html><body>503 Service Unavailable</body></html>")).toThrow(
      /pseudo|relais|public/i
    );
  });

  /* An empty watchlist says so: Letterboxd lays a "No films yet" in
     `.empty-text`. That is what tells it apart from a failed page. */
  it("accepte en revanche une watchlist réellement vide", () => {
    const vide = `<html><body><p class="empty-text">No films yet</p></body></html>`;
    expect(parseWatchlistPage(vide).rows).toEqual([]);
  });
});

/* The whole reading, pages included. The network is replaced by a
   dictionary of pages: what we check here is the LOOP and the order, not
   the ability of `fetch` to go and get a page. */
describe("relever une watchlist entière", () => {
  const page = (noms: string[], dernière: number) =>
    `<html><body><ul class="grid">${noms
      .map(
        (n) =>
          `<li class="griditem"><div class="react-component" data-item-name="${n}"
             data-item-slug="${n.toLowerCase().replace(/\W+/g, "-")}"></div></li>`
      )
      .join("")}</ul>
     <div class="paginate-pages"><ul><li>1</li><li>${dernière}</li></ul></div></body></html>`;

  const servir = (pages: Record<string, string>) =>
    vi.stubGlobal("fetch", (url: string) => {
      const html = pages[url];
      return Promise.resolve({
        ok: html !== undefined,
        status: html === undefined ? 404 : 200,
        text: () => Promise.resolve(html ?? ""),
      } as Response);
    });

  afterEach(() => vi.unstubAllGlobals());

  it("suit la pagination et rend les films dans l'ordre des pages", async () => {
    servir({
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
  it("date les fiches dans l'ordre où elles ont été mises de côté", async () => {
    servir({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)", "Solaris (1972)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Le Miroir (1975)"], 2),
    });
    const { rows } = await fetchLetterboxdWatchlist("essai");
    const dates = rows.map((r) => r.addedAt!);
    expect(dates[0]).toBeGreaterThan(dates[1]!);
    expect(dates[1]).toBeGreaterThan(dates[2]!);
  });

  it("annonce l'avancée page après page", async () => {
    servir({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Solaris (1972)"], 2),
    });
    const vu: string[] = [];
    await fetchLetterboxdWatchlist("essai", undefined, {
      onProgress: (d, t) => vu.push(`${d}/${t}`),
    });
    expect(vu).toEqual(["1/2", "2/2"]);
  });

  it("refuse un pseudo vide avant de toucher au réseau", async () => {
    await expect(fetchLetterboxdWatchlist("  ")).rejects.toThrow(/pseudo/i);
  });
});
