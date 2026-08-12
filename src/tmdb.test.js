import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkApiKey, enrichRows } from "./tmdb";
import { VIA_SERVER, setTmdbKey } from "./services/tmdbKey";

const CACHE_KEY = "tmdb-cache";

/* A minimal TMDB response: only what `searchMovie` and `getDetails` read. */
const okFetch = () =>
  vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      String(url).includes("/search/movie")
        ? { results: [{ id: 42, title: "Le Samouraï", release_date: "1967-10-25" }] }
        : {
            id: 42,
            genres: [{ name: "Policier" }],
            release_date: "1967-10-25",
            poster_path: "/p.jpg",
            credits: { crew: [{ job: "Director", name: "Jean-Pierre Melville" }] },
            /* `append_to_response` ALSO asks for the keywords, and TMDB
               always returns them — be it as an empty list. Without them
               the mock triggers the fallback on the dedicated endpoint
               and therefore makes one call more than reality. */
            keywords: { keywords: [{ id: 1, name: "hitman" }] },
          },
  }));

const emptySearch = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ results: [] }),
  }));

const rows = [{ title: "Le Samouraï", year: 1967 }];
const cache = () => JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");

describe("enrichRows — cache", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("remembers a resolved film and asks TMDB nothing on re-import", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const first = await enrichRows(rows, "k");
    expect(first.resolved).toBe(1);
    expect(first.rows[0].director).toBe("Jean-Pierre Melville");

    const calls = fetchMock.mock.calls.length;
    const second = await enrichRows(rows, "k");
    expect(second.resolved).toBe(1);
    expect(fetchMock.mock.calls.length).toBe(calls); // rien n'est redemandé
  });

  it("does not remember a network failure: the next re-import tries again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const out = await enrichRows(rows, "k");
    expect(out.failed).toBe(1);
    expect(cache()).toEqual({});

    vi.stubGlobal("fetch", okFetch());
    expect((await enrichRows(rows, "k")).resolved).toBe(1);
  });

  it('remembers a "not found", but lets it go stale', async () => {
    vi.stubGlobal("fetch", emptySearch());
    const out = await enrichRows(rows, "k");
    expect(out.failed).toBe(1);

    // within thirty days, we ask for nothing again
    const fresh = emptySearch();
    vi.stubGlobal("fetch", fresh);
    await enrichRows(rows, "k");
    expect(fresh.mock.calls.length).toBe(0);

    // beyond that, the failure is forgotten and the search sets off again
    const stale = cache();
    const [k] = Object.keys(stale);
    stale[k] = { miss: Date.now() - 31 * 24 * 3600 * 1000 };
    localStorage.setItem(CACHE_KEY, JSON.stringify(stale));

    vi.stubGlobal("fetch", okFetch());
    expect((await enrichRows(rows, "k")).resolved).toBe(1);
  });

  it("retries the failures earlier versions remembered (null with no date)", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ "le samouraï|1967": null }));
    vi.stubGlobal("fetch", okFetch());
    expect((await enrichRows(rows, "k")).resolved).toBe(1);
  });
});

/* The Letterboxd feed gives the TMDB identifier of every screening.
   Searching for it anyway would be one call too many, and above all
   `searchMovie` keeps the FIRST result without comparing titles — that
   is where the false positives come from, and an identifier produces
   none. */
describe("enrichRows — when the row already carries its identifier", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const perId = [{ title: "Le Samouraï", year: 1967, tmdbId: 42 }];

  it("goes straight to the details, without going through the search", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const out = await enrichRows(perId, "k");
    expect(out.resolved).toBe(1);
    expect(out.rows[0].director).toBe("Jean-Pierre Melville");

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("/search/movie"))).toBe(false);
    // a single call where the title required two
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/movie/42");
  });

  it("remembers under the identifier and asks for nothing again", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await enrichRows(perId, "k");
    expect(Object.keys(cache())).toEqual(["id:42"]);

    const calls = fetchMock.mock.calls.length;
    await enrichRows(perId, "k");
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  /* Two films can carry the same title in the same year. Under a title
     key, the second would take the first one's director and poster —
     with nothing to flag it. */
  it("does not confuse two namesakes from the same year", async () => {
    vi.stubGlobal("fetch", okFetch());
    await enrichRows(
      [
        { title: "Carrie", year: 1976, tmdbId: 11 },
        { title: "Carrie", year: 1976, tmdbId: 22 },
      ],
      "k"
    );
    expect(Object.keys(cache()).sort()).toEqual(["id:11", "id:22"]);
  });
});

/* ------------------------------------------------------------
   THE HARVEST OF THE CAST
   ------------------------------------------------------------ */

/* A complete response: full credits, a crew mixed with trades we do not
   keep. */
const castFetch = () =>
  vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      String(url).includes("/search/movie")
        ? { results: [{ id: 42 }] }
        : {
            id: 42,
            genres: [],
            release_date: "1967-10-25",
            credits: {
              crew: [
                { job: "Director", name: "Melville" },
                { job: "Director of Photography", name: "Decaë" },
                { job: "Original Music Composer", name: "Rubinstein" },
                { job: "Screenplay", name: "Melville" },
                { job: "Third Assistant Editor", name: "Person" },
              ],
              cast: Array.from({ length: 20 }, (_, i) => ({ name: `Acteur ${i}` })),
            },
          },
  }));

describe("enrichRows — casting", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps only the first eight roles", async () => {
    vi.stubGlobal("fetch", castFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].cast).toHaveLength(8);
    expect(out[0].cast[0]).toBe("Acteur 0");
    expect(out[0].cast[7]).toBe("Acteur 7");
  });

  it("files the crew by trade, and throws away the trades one does not follow", async () => {
    vi.stubGlobal("fetch", castFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].crew).toEqual({
      image: ["Decaë"],
      musique: ["Rubinstein"],
      scénario: ["Melville"],
    });
  });

  /* The cache from before the harvest carries neither `cast` nor
     `crew`. It was served as it was, and the card came out as empty as
     it went in — hence "completing the cards does nothing": the call did
     take place, but it came back from `localStorage`. An entry of an
     out-of-date shape is not an answer: we throw it away and ask
     again. */
  it("asks again for an entry remembered before the harvest, instead of serving it truncated", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ "le samouraï|1967": { tmdbId: 42, director: "Melville", genres: [] } })
    );
    const fetchMock = castFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).toHaveBeenCalled();
    expect(out[0].cast).toHaveLength(8);
    expect(out[0].crew).toMatchObject({ image: ["Decaë"] });
  });

  it("does not invent a crew when TMDB gives none", async () => {
    vi.stubGlobal("fetch", okFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].cast).toEqual([]);
    expect(out[0].crew).toEqual({});
  });
});

/* ------------------------------------------------------------
   RUNTIME, LANGUAGE, COUNTRY, PUBLIC RATING
   ------------------------------------------------------------ */
const detailsFetch = (extra) =>
  vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      String(url).includes("/search/movie")
        ? { results: [{ id: 42 }] }
        : {
            id: 42,
            genres: [],
            release_date: "1967-10-25",
            credits: { crew: [], cast: [] },
            ...extra,
          },
  }));

describe("enrichRows — runtime, language, country, rating", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("harvests the four fields", async () => {
    vi.stubGlobal(
      "fetch",
      detailsFetch({
        runtime: 105,
        original_language: "fr",
        production_countries: [{ iso_3166_1: "FR" }, { iso_3166_1: "IT" }],
        vote_average: 7.6,
      })
    );
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0]).toMatchObject({
      runtime: 105,
      language: "fr",
      countries: ["FR", "IT"],
      tmdbRating: 7.6,
    });
  });

  it("keeps only two countries of a co-production that lines up six", async () => {
    vi.stubGlobal(
      "fetch",
      detailsFetch({
        production_countries: ["FR", "IT", "DE", "BE", "CH", "LU"].map((c) => ({ iso_3166_1: c })),
      })
    );
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].countries).toEqual(["FR", "IT"]);
  });

  /* TMDB returns 0 for a runtime it does not know. Keeping it would let
     a zero into the almanac's averages without anyone knowing why. */
  it('turns a runtime of zero into "unknown"', async () => {
    vi.stubGlobal("fetch", detailsFetch({ runtime: 0, vote_average: 0 }));
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].runtime).toBeNull();
    expect(out[0].tmdbRating).toBeNull();
  });

  /* The country was missing on almost the whole collection for this one
     reason: these fields arrived after the entries that were waiting for
     them, and the cache served the old answers without knowing it was
     behind. */
  it("asks again for an entry remembered before these fields", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ "le samouraï|1967": { tmdbId: 42, director: "Melville", genres: [] } })
    );
    const fetchMock = detailsFetch({
      runtime: 105,
      original_language: "fr",
      production_countries: [{ iso_3166_1: "FR" }],
      vote_average: 8.2,
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).toHaveBeenCalled();
    expect(out[0]).toMatchObject({
      runtime: 105,
      language: "fr",
      countries: ["FR"],
      tmdbRating: 8.2,
    });
  });

  /* An entry of the current shape, though, is still served without a
     call: the cache keeps its reason to exist. */
  it("serves an entry of the current shape without asking again", async () => {
    vi.stubGlobal("fetch", detailsFetch({ runtime: 105 }));
    await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    const fetchMock = detailsFetch({ runtime: 105 });
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out[0].runtime).toBe(105);
  });
});

/* ============================================================
   THE KEYWORDS — "absent" is NOT "empty"
   ============================================================

   Confusing the two froze whole collections. A response where the joined
   resource did not come back became `[]`, that is to say an ASSERTION —
   "we asked, this film has none". But everything that repairs
   (`isIncomplete`, the opened card, the import merge) targets absence
   only: the card became unrepairable, without any error being raised
   anywhere. */
describe("enrichRows — the keywords", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const detailPart = (extra) =>
    vi.fn(async (url) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () =>
        String(url).includes("/search/movie")
          ? { results: [{ id: 42, title: "Le Samouraï", release_date: "1967-10-25" }] }
          : String(url).includes("/keywords")
            ? { keywords: [{ id: 7, name: "de secours" }] }
            : { id: 42, release_date: "1967-10-25", credits: { crew: [] }, ...extra },
    }));

  it("brings back the keywords from the appended resource", async () => {
    vi.stubGlobal("fetch", detailPart({ keywords: { keywords: [{ id: 1, name: "hitman" }] } }));
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toEqual(["hitman"]);
  });

  /* Present but empty: that is a real answer. We write it, and the card
     will not be asked for again — failing which "complete" loops
     endlessly. */
  it("keeps the list empty when TMDB says there are none", async () => {
    vi.stubGlobal("fetch", detailPart({ keywords: { keywords: [] } }));
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toEqual([]);
  });

  /* Absent: we do not know. We fall back on the dedicated endpoint
     rather than invent an answer. */
  it("falls back on the dedicated endpoint when the appended resource is missing", async () => {
    vi.stubGlobal("fetch", detailPart({}));
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toEqual(["de secours"]);
  });

  /* And if the fallback fails in its turn, we return `undefined` —
     never `[]`. That is what leaves the card repairable. */
  it('returns "we do not know" rather than an empty list when everything fails', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () =>
          String(url).includes("/search/movie")
            ? { results: [{ id: 42, title: "Le Samouraï", release_date: "1967-10-25" }] }
            : String(url).includes("/keywords")
              ? { keywords: [] }
              : { id: 42, release_date: "1967-10-25", credits: { crew: [] } },
      }))
    );
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toBeUndefined();
  });
});

/* ============================================================
   BY ONESELF, OR THROUGH THE SERVER

   The switch is the only line in the whole binder that decides whether a
   request leaves for TMDB with a key, or for our server with a cookie.
   It does not show in use — both paths return the same thing — and would
   therefore break in silence.
   ============================================================ */
describe("the server's relay", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const response = (status, corps = {}, entetes = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(entetes),
    json: async () => corps,
  });

  it("goes through the server, with no key, with the cookie", async () => {
    const appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts) => {
        appels.push({ url: String(url), opts });
        return response(200, {});
      })
    );

    expect((await checkApiKey(VIA_SERVER)).ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0].url).toContain("/tmdb/configuration");
    expect(appels[0].url).not.toContain("api.themoviedb.org");
    /* The server's key is its own: we have nothing to send, and sending
       something would mean sending somebody's key to a place that does
       not want it. */
    expect(appels[0].url).not.toContain("api_key");
    /* Without this line the server sees a stranger: the cookie comes
       from an origin other than the page. */
    expect(appels[0].opts?.credentials).toBe("include");
  });

  it("drops back to the key on file when the relay recuses itself", async () => {
    /* 401: the session expired while the tab was asleep. 503: the
       server is running without a key on its side. Neither of the two
       says TMDB has nothing — and a key may be sleeping next door. */
    for (const code of [401, 403, 503]) {
      setTmdbKey("la-mienne");
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return String(url).includes("/tmdb/") ? response(code) : response(200, {});
        })
      );

      expect((await checkApiKey(VIA_SERVER)).ok, `code ${code}`).toBe(true);
      expect(appels, `code ${code}`).toHaveLength(2);
      expect(appels[1]).toContain("api.themoviedb.org");
      expect(appels[1]).toContain("api_key=la-mienne");
      setTmdbKey("");
    }
  });

  it("does NOT go round a path the relay does not know", async () => {
    /* A 404 from the relay is a list to be fixed, not an incident to
       recover from: quietly setting off towards TMDB would make the flaw
       invisible for ever. */
    setTmdbKey("la-mienne");
    const appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        appels.push(String(url));
        return response(404);
      })
    );

    expect((await checkApiKey(VIA_SERVER)).ok).toBe(false);
    expect(appels).toHaveLength(1);
  });

  /* ============================================================
     THE RELAY'S 429, AND HOW LONG ONE REALLY MUST WAIT
     ============================================================

     The relay has its own ceiling per minute, and "completing the cards"
     necessarily crosses it: it is long work, one request per film, five
     at a time. The 429 is therefore NORMAL on this path — what was not,
     is what followed.

     The relay's path waited one second, then two, then three, hard
     coded, without reading `retry-after`. Over a one-minute window, the
     three attempts fell back into the window that had just rejected
     them: three refusals, and the filling stopped there. */
  it("waits the delay the relay announces, and not an invented second", async () => {
    vi.useFakeTimers();
    try {
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return appels.length === 1
            ? response(429, {}, { "retry-after": "47" })
            : response(200, {});
        })
      );

      const promise = checkApiKey(VIA_SERVER);
      /* One second is no longer enough: that was exactly the flaw. */
      await vi.advanceTimersByTimeAsync(1500);
      expect(appels).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(46_000);
      expect(appels).toHaveLength(2);
      expect((await promise).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  /* The header may be missing — a server that does not lay it, or a
     response from another origin where it is not exposed. We then fall
     back on the staircase rather than give up. */
  it("falls back on a stepped wait when nothing is announced", async () => {
    vi.useFakeTimers();
    try {
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return appels.length === 1 ? response(429) : response(200, {});
        })
      );

      const promise = checkApiKey(VIA_SERVER);
      await vi.advanceTimersByTimeAsync(1500);
      expect(appels).toHaveLength(2);
      expect((await promise).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  /* An unreasonable delay must not hold a whole filling back on a
     single card: we hand back control rather than sleep for an hour. */
  it("never sleeps longer than a minute, whatever it is told", async () => {
    vi.useFakeTimers();
    try {
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return appels.length === 1
            ? response(429, {}, { "retry-after": "3600" })
            : response(200, {});
        })
      );

      const promise = checkApiKey(VIA_SERVER);
      await vi.advanceTimersByTimeAsync(61_000);
      expect(appels).toHaveLength(2);
      expect((await promise).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("with no account and no relay, nothing changes", async () => {
    const appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        appels.push(String(url));
        return response(200, {});
      })
    );

    await checkApiKey("la-mienne");
    expect(appels[0]).toContain("api.themoviedb.org");
    expect(appels[0]).toContain("api_key=la-mienne");
  });
});
