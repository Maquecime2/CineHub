import { describe, it, expect } from "vitest";
import { slugOf, filmKey, parseRating, diffImport, parseLetterboxdCsv } from "./importing";
import { makeFilm, withWatches, isIncomplete, withoutKeywords } from "./film";
import type { Film, ImportRow } from "../types";

const row = (partial: Partial<ImportRow> = {}): ImportRow => ({
  title: "Un film",
  year: 1975,
  rating: null,
  watchedAt: null,
  uri: null,
  ...partial,
});

describe("slugOf", () => {
  it("neutralises case, accents and punctuation", () => {
    expect(slugOf("Le Samouraï")).toBe(slugOf("le samourai"));
    expect(slugOf("WALL·E")).toBe("walle");
  });

  it("neutralises the leading article", () => {
    expect(slugOf("The Godfather")).toBe(slugOf("Godfather"));
    expect(slugOf("La Jetée")).toBe(slugOf("Jetée"));
    expect(slugOf("Le Samouraï")).toBe(slugOf("Samourai"));
  });

  /* KNOWN BUG, behaviour deliberately pinned down.

     In `^(le|la|les|the|a|an|l')`, the alternation is ordered and does not
     require a word boundary. Two consequences:

     - "Les" matches `le` first and leaves an orphan "s";
     - `a` comes before `l'` and is followed by no `\b`, so EVERY title
       starting with an "a" loses its first letter ("Alien" → "lien").

     Matching stays consistent as long as both sides go through `slugOf`:
     it is only against a variant with no article ("L'Avventura" versus
     "Avventura") that the key diverges.

     Fixing the regex would change the key of every card already saved
     that is affected: on the next re-import they would no longer match
     and would be recreated as duplicates. So the fix asks for a data
     migration, not merely a "les|le" and a `\b`. This test pins the
     existing behaviour down so that a future fix is a visible choice. */
  it("eats one letter too many on « Les » and on titles in « a » — accepted gap", () => {
    expect(slugOf("Les Diaboliques")).toBe("sdiaboliques");
    expect(slugOf("Alien")).toBe("lien");
    expect(slugOf("L'Avventura")).not.toBe(slugOf("Avventura"));

    // matching stays right as long as both sides are written the same way
    expect(slugOf("Les Diaboliques")).toBe(slugOf("les diaboliques"));
    expect(slugOf("Alien")).toBe(slugOf("ALIEN"));
  });

  it("only strips the article at the head", () => {
    // "la" in the middle must not vanish, otherwise distinct titles merge
    expect(slugOf("Fanny et Alexandre")).toBe("fannyetalexandre");
  });

  it("accepts a missing title without throwing", () => {
    expect(slugOf()).toBe("");
    expect(slugOf("")).toBe("");
  });
});

describe("filmKey", () => {
  it("matches two spellings of the same film released the same year", () => {
    expect(filmKey({ title: "Le Samouraï", year: 1967 })).toBe(
      filmKey({ title: "Le Samourai", year: 1967 })
    );
  });

  it("separates two films with the same title but different years", () => {
    // remakes must not overwrite the original
    expect(filmKey({ title: "Psycho", year: 1960 })).not.toBe(
      filmKey({ title: "Psycho", year: 1998 })
    );
  });

  it("treats a missing year as a value in its own right", () => {
    expect(filmKey({ title: "Psycho" })).toBe("psycho|");
  });
});

describe("parseRating", () => {
  it("tells 'not rated' from a rating of zero", () => {
    // that is the distinction that decides whether a re-import overwrites an existing rating
    expect(parseRating(null)).toBeNull();
    expect(parseRating("")).toBeNull();
    expect(parseRating("   ")).toBeNull();
    expect(parseRating(0)).toBe(0);
  });

  it("accepts the decimal comma", () => {
    expect(parseRating("3,5")).toBe(3.5);
  });

  it("rounds to the half point", () => {
    expect(parseRating(3.7)).toBe(3.5);
    expect(parseRating(3.8)).toBe(4);
  });

  it("bounds between 0 and 5", () => {
    expect(parseRating(9)).toBe(5);
    expect(parseRating(-2)).toBe(0);
  });

  it("rejects what is not a number", () => {
    expect(parseRating("abc")).toBeNull();
    expect(parseRating(NaN)).toBeNull();
  });
});

/* A DATE IS NOT A SCREENING, and it is from that confusion that the "×2"
   under films seen only once came: watched.csv dated the card from the day
   it had been ADDED, diary.csv from the day the film had been seen, and
   the card picked up both. */
describe("parseLetterboxdCsv — what counts as a screening", () => {
  const file = (name: string, content: string) => new File([content], name, { type: "text/csv" });

  it("draws no screening from watched.csv, but dates the card with it", async () => {
    const { rows, kind } = await parseLetterboxdCsv(
      file(
        "watched.csv",
        "Date,Name,Year,Letterboxd URI\n2021-04-12,Stalker,1979,https://boxd.it/x\n"
      )
    );
    expect(kind).toBe("watched");
    expect(rows[0]!.watches).toEqual([]);
    expect(rows[0]!.watchedAt).toBe("2021-04-12");
  });

  it("draws no screening from ratings.csv either", async () => {
    const { rows } = await parseLetterboxdCsv(
      file("ratings.csv", "Date,Name,Year,Rating\n2021-04-12,Stalker,1979,4.5\n")
    );
    expect(rows[0]!.watches).toEqual([]);
    expect(rows[0]!.rating).toBe(4.5);
  });

  it("draws the screening from diary.csv, which alone says WHEN", async () => {
    const { rows } = await parseLetterboxdCsv(
      file(
        "diary.csv",
        "Date,Name,Year,Rating,Rewatch,Watched Date\n2024-02-01,Stalker,1979,4.0,Yes,2024-01-30\n"
      )
    );
    expect(rows[0]!.watches).toEqual([{ date: "2024-01-30", rating: 4, rewatch: true }]);
    expect(rows[0]!.watchedAt).toBe("2024-01-30");
  });

  /* The bug's exact scenario: the two files one after the other. The card
     must end up with ONE screening, the diary's. */
  it("counts only one screening for a film that went through watched.csv then diary.csv", async () => {
    const watched = await parseLetterboxdCsv(
      file("watched.csv", "Date,Name,Year\n2021-04-12,Stalker,1979\n")
    );
    const diary = await parseLetterboxdCsv(
      file("diary.csv", "Date,Name,Year,Watched Date\n2024-02-01,Stalker,1979,2024-01-30\n")
    );
    const created = diffImport([], watched.rows, "watched").toCreate[0]!;
    const { toUpdate } = diffImport([created], diary.rows, "watched");
    expect(toUpdate[0]!.changes.watches).toHaveLength(1);
  });
});

describe("diffImport", () => {
  it("creates the films missing from the video library", () => {
    const { toCreate, toUpdate, unchanged } = diffImport(
      [],
      [row({ title: "Stalker", year: 1979, rating: 4.5 })],
      "watched"
    );
    expect(toUpdate).toHaveLength(0);
    expect(unchanged).toHaveLength(0);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toMatchObject({
      title: "Stalker",
      rating: 4.5,
      status: "watched",
      source: "letterboxd",
    });
  });

  /* The test that counts: the promise made to the user is that a
     re-import never destroys what they wrote by hand. */
  it("never touches work written by hand", () => {
    const existing: Film = makeFilm({
      title: "Stalker",
      year: 1979,
      rating: 4,
      review: "Une critique longuement écrite",
      notes: "des fragments",
      themes: ["Mémoire", "Zone"],
      linkedWorks: [
        { id: "w1", type: "book", title: "Pique-nique", creator: "Strougatski", note: "" },
      ],
    });

    const { toUpdate } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, rating: 5 })],
      "watched"
    );

    expect(toUpdate).toHaveLength(1);
    // only the rating changes; nothing else is offered for writing
    expect(toUpdate[0]!.changes).toEqual({ rating: 5 });
  });

  it("fills an empty field without overwriting a filled one", () => {
    const existing = makeFilm({
      title: "Stalker",
      year: 1979,
      director: "A. Tarkovski",
      poster: "mon-affiche.jpg",
    });

    const { toUpdate } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          director: "Andrei Tarkovsky",
          poster: "tmdb.jpg",
          genres: ["Science-fiction"],
        }),
      ],
      "watched"
    );

    const changes = toUpdate[0]!.changes;
    // the director and the poster were already set: we do not touch them
    expect(changes.director).toBeUndefined();
    expect(changes.poster).toBeUndefined();
    // the genres were missing: we accept them
    expect(changes.genres).toEqual(["Science-fiction"]);
  });

  it("matches by tmdbId first, even if the title has changed", () => {
    const existing = makeFilm({ title: "Ancien titre", year: 1979, tmdbId: 1234 });
    const { toCreate, toUpdate } = diffImport(
      [existing],
      [row({ title: "Titre localisé tout autre", year: 1979, tmdbId: 1234, rating: 5 })],
      "watched"
    );
    expect(toCreate).toHaveLength(0);
    expect(toUpdate[0]!.film.id).toBe(existing.id);
  });

  it("moves the screening date forward, never back", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, watchedAt: "2024-01-01" });

    const newer = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, watchedAt: "2025-06-01" })],
      "watched"
    );
    expect(newer.toUpdate[0]!.changes.watchedAt).toBe("2025-06-01");

    // a ratings.csv imported after a diary must not bring an old date back
    const older = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, watchedAt: "2023-01-01" })],
      "watched"
    );
    expect(older.unchanged).toHaveLength(1);
  });

  /* THE LOG IS COMPLETED, IT IS NOT REPLACED: a diary.csv brings old
     screenings we did not have, and they must come in without dislodging
     the ones we already had. */
  it("adds to the log the screenings the import brings", () => {
    const existing = withWatches(makeFilm({ title: "Stalker", year: 1979 }), [
      { date: "2024-01-01", rating: 4 },
    ]);
    const { toUpdate } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          watchedAt: "2019-03-02",
          watches: [{ date: "2019-03-02", rating: 3 }],
        }),
      ],
      "watched"
    );
    expect(toUpdate[0]!.changes.watches).toHaveLength(2);
    // an older screening does not push the last-screening date back
    expect(toUpdate[0]!.changes.watchedAt).toBeUndefined();
  });

  /* THE REPAIR. Completing does not know how to undo: a card that has
     picked up a screening that was not one would keep it forever.
     Declaring the file SOLE MASTER is the only path that removes a
     screening without one having been removed by hand. */
  it("replaces the log when the file is authoritative", () => {
    const existing = withWatches(makeFilm({ title: "Stalker", year: 1979 }), [
      { date: "2021-04-12", rating: null }, // the phantom screening, from watched.csv
      { date: "2024-01-30", rating: 4 },
    ]);
    const { toUpdate } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          watchedAt: "2024-01-30",
          watches: [{ date: "2024-01-30", rating: 4 }],
        }),
      ],
      "watched",
      { authoritativeWatches: true }
    );
    expect(toUpdate[0]!.changes.watches).toEqual([{ date: "2024-01-30", rating: 4 }]);
  });

  /* Erasing the most recent screening must move the card's date BACK:
     leaving it in place would date the film from a screening we have just
     declared non-existent. */
  it("moves the date back when the authoritative file erases the last screening", () => {
    const existing = withWatches(makeFilm({ title: "Stalker", year: 1979 }), [
      { date: "2019-03-02", rating: 3 },
      { date: "2025-06-01", rating: null },
    ]);
    const { toUpdate } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          watchedAt: "2019-03-02",
          watches: [{ date: "2019-03-02", rating: 3 }],
        }),
      ],
      "watched",
      { authoritativeWatches: true }
    );
    expect(toUpdate[0]!.changes.watchedAt).toBe("2019-03-02");
  });

  it("touches nothing when the authoritative file says the same thing", () => {
    const screenings = [{ date: "2024-01-30", rating: 4 }];
    const existing = withWatches(makeFilm({ title: "Stalker", year: 1979, rating: 4 }), screenings);
    const { unchanged } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          rating: 4,
          watchedAt: "2024-01-30",
          watches: screenings,
        }),
      ],
      "watched",
      { authoritativeWatches: true }
    );
    expect(unchanged).toHaveLength(1);
  });

  it("carries over the order of addition the source knows", () => {
    const { toCreate } = diffImport(
      [],
      [
        row({ title: "Récent", year: 2020, addedAt: 5_000 }),
        row({ title: "Ancien", year: 1960, addedAt: 1_000 }),
      ],
      "watchlist"
    );
    expect(toCreate.map((f) => f.addedAt)).toEqual([5_000, 1_000]);
  });

  /* THE IDEMPOTENCE POINT. Running the same file through again must not
     count anything twice — otherwise the counter swells on every
     re-import, and nobody notices for six months. */
  it("counts nothing twice when the same file is run through again", () => {
    const screenings = [{ date: "2024-01-01", rating: 4 }];
    const existing = withWatches(makeFilm({ title: "Stalker", year: 1979, rating: 4 }), screenings);
    const { toUpdate, unchanged } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          rating: 4,
          watchedAt: "2024-01-01",
          watches: screenings,
        }),
      ],
      "watched"
    );
    expect(toUpdate).toHaveLength(0);
    expect(unchanged).toHaveLength(1);
  });

  it("sets the log on a film it has just created", () => {
    const { toCreate } = diffImport(
      [],
      [
        row({
          title: "Stalker",
          year: 1979,
          watchedAt: "2024-01-01",
          watches: [
            { date: "2019-03-02", rating: 3 },
            { date: "2024-01-01", rating: 4 },
          ],
        }),
      ],
      "watched"
    );
    expect(toCreate[0]!.watches).toHaveLength(2);
    expect(toCreate[0]!.watchedAt).toBe("2024-01-01");
  });

  it("records no screening for a film that is only 'to watch'", () => {
    const { toCreate } = diffImport(
      [],
      [row({ title: "Stalker", year: 1979, watches: [{ date: "2024-01-01", rating: 4 }] })],
      "watchlist"
    );
    expect(toCreate[0]!.watches).toEqual([]);
    expect(toCreate[0]!.watchedAt).toBeNull();
  });

  it("flips 'to watch' to 'watched' when the film appears in an export of watched films", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, status: "watchlist" });
    const { toUpdate } = diffImport([existing], [row({ title: "Stalker", year: 1979 })], "watched");
    expect(toUpdate[0]!.changes.status).toBe("watched");
  });

  /* ============================================================
     `keepStatus` — THE SWITCH THAT SAVES A WATCHLIST

     "Complete the cards" enriches from TMDB and passed `"watched"` for
     want of anything better, believing that status inert since it creates
     nothing. It emptied whole watchlists into the video library, at the
     touch of one button, on the most incomplete cards — that is to say,
     precisely the ones we had not seen.
     ============================================================ */
  it("leaves an existing card's status alone when asked to", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, status: "watchlist" });
    const { toUpdate, unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979 })],
      "watched",
      { keepStatus: true }
    );
    expect(toUpdate).toHaveLength(0);
    expect(unchanged).toHaveLength(1);
  });

  it("still lets the other fields through while keeping the status", () => {
    /* The switch guards the status and nothing else: an enrichment must
       go on filling what is missing. */
    const existing = makeFilm({ title: "Stalker", year: 1979, status: "watchlist" });
    const { toUpdate } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, runtime: 161 })],
      "watched",
      { keepStatus: true }
    );
    expect(toUpdate[0]!.changes).toEqual({ runtime: 161 });
    expect(toUpdate[0]!.changes.status).toBeUndefined();
  });

  it("still decides the shelf of the cards it creates", () => {
    /* `status` serves two purposes; `keepStatus` only disarms the second.
       A card the import creates must still land where it was asked to. */
    const { toCreate } = diffImport([], [row({ title: "Neuf", year: 1979 })], "watched", {
      keepStatus: true,
    });
    expect(toCreate[0]!.status).toBe("watched");
  });

  it("does not put a watched film back to 'to watch' on a watchlist import", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, status: "watched" });
    const { unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979 })],
      "watchlist"
    );
    expect(unchanged).toHaveLength(1);
  });

  it("files as 'unchanged' what brings nothing", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, rating: 4 });
    const { toCreate, toUpdate, unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, rating: 4 })],
      "watched"
    );
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
    expect(unchanged).toHaveLength(1);
  });

  it("does not overwrite an existing rating when the CSV carries none", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, rating: 4.5 });
    const { unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, rating: null })],
      "watched"
    );
    expect(unchanged).toHaveLength(1);
  });
});

describe("diffImport — the cast", () => {
  it("sets cast and crew on a created card", () => {
    const r = row({ cast: ["Delon"], crew: { image: ["Decaë"] } });
    const { toCreate } = diffImport([], [r], "watched");
    expect(toCreate[0]).toMatchObject({ cast: ["Delon"], crew: { image: ["Decaë"] } });
  });

  it("leaves a created card with no cast holding empty shapes, never undefined", () => {
    const { toCreate } = diffImport([], [row()], "watched");
    expect(toCreate[0]!.cast).toEqual([]);
    expect(toCreate[0]!.crew).toEqual({});
  });

  it("fills the cast of a card that had none", () => {
    const old = makeFilm({ title: "Un film", year: 1975, cast: [], crew: {} });
    const r = row({ cast: ["Delon"], crew: { musique: ["Rubinstein"] } });
    const { toUpdate } = diffImport([old], [r], "watched");
    expect(toUpdate[0]!.changes).toMatchObject({
      cast: ["Delon"],
      crew: { musique: ["Rubinstein"] },
    });
  });

  it("does not replace a cast that is already there", () => {
    const old = makeFilm({
      title: "Un film",
      year: 1975,
      cast: ["Quelqu'un"],
      crew: { image: ["Untel"] },
    });
    const r = row({ cast: ["Delon"], crew: { image: ["Decaë"] } });
    const { toUpdate, unchanged } = diffImport([old], [r], "watched");
    expect(toUpdate).toEqual([]);
    expect(unchanged).toHaveLength(1);
  });

  /* The diff is what we show BEFORE writing: a newly harvested cast must
     appear in it as a proposed change, and not be written on the sly. */
  it("brings out under 'modified' a card that only the cast changes", () => {
    const old = makeFilm({ title: "Un film", year: 1975 });
    const { toUpdate, unchanged } = diffImport([old], [row({ cast: ["Delon"] })], "watched");
    expect(unchanged).toEqual([]);
    expect(Object.keys(toUpdate[0]!.changes)).toEqual(["cast"]);
  });
});

describe("diffImport — runtime, language, countries, public rating", () => {
  it("fills what is missing", () => {
    const old = makeFilm({ title: "Un film", year: 1975 });
    const r = row({ runtime: 116, language: "fr", countries: ["FR"], tmdbRating: 7.8 });
    expect(diffImport([old], [r], "watched").toUpdate[0]!.changes).toMatchObject({
      runtime: 116,
      language: "fr",
      countries: ["FR"],
      tmdbRating: 7.8,
    });
  });

  it("never corrects what is already there", () => {
    const old = makeFilm({
      title: "Un film",
      year: 1975,
      runtime: 100,
      language: "ja",
      countries: ["JP"],
      tmdbRating: 6,
    });
    const r = row({ runtime: 116, language: "fr", countries: ["FR"], tmdbRating: 7.8 });
    expect(diffImport([old], [r], "watched").unchanged).toHaveLength(1);
  });

  /* An unknown runtime is `null`, never 0: a zero would enter the
     almanac's averages and skew them silently. */
  it("does not write a missing runtime", () => {
    const old = makeFilm({ title: "Un film", year: 1975 });
    const { unchanged } = diffImport([old], [row({ runtime: null })], "watched");
    expect(unchanged).toHaveLength(1);
  });

  /* The `||` trap: a card the public rated 0 IS filled in. Querying it
     again on every import would bring it out under "modified" for
     nothing, indefinitely. */
  it("leaves a public rating of zero alone", () => {
    const old = makeFilm({ title: "Un film", year: 1975, tmdbRating: 0 });
    const { unchanged } = diffImport([old], [row({ tmdbRating: 7.8 })], "watched");
    expect(unchanged).toHaveLength(1);
  });
});

/* ============================================================
   THE KEYWORDS — the writing chain, end to end
   ============================================================

   It is the only THEMATIC piece of information that arrives on its own:
   motifs and themes are set by hand, and on an imported collection they
   stay empty. Without keywords, a film's wake can only bring people's
   names together.

   Hence these tests: the flaw, if there is one, is in the merging — not
   in the connecting, which has tests of its own. */
describe("diffImport — the keywords", () => {
  it("fills a card that never had any", () => {
    const old = makeFilm({ title: "Un film", year: 1975 });
    expect(old.keywords).toBeUndefined();
    const { toUpdate } = diffImport([old], [row({ keywords: ["time loop"] })], "watched");
    expect(toUpdate[0]!.changes).toMatchObject({ keywords: ["time loop"] });
  });

  /* THE CASE THAT LOOPS. A film TMDB has no keyword for must come back
     with an EMPTY list: that is what says "we asked". Without that write,
     the card stays "never asked" and "complete" asks for it again on
     every pass, without end. */
  it("writes the list even when empty, otherwise completion goes round in circles", () => {
    const old = makeFilm({ title: "Un film", year: 1975 });
    const { toUpdate } = diffImport([old], [row({ keywords: [] })], "watched");
    expect(toUpdate[0]!.changes).toMatchObject({ keywords: [] });
  });

  /* ▲ THE REPAIR. A harvesting fault froze whole collections at `[]` —
     "asked, there are none" — and nothing could touch them any more,
     since everything that fills only targets absence. So we fill the
     EMPTINESS too, as soon as we bring content back. */
  it("repairs a card frozen empty when we finally bring keywords back", () => {
    const frozen = makeFilm({ title: "Un film", year: 1975, keywords: [] });
    const { toUpdate } = diffImport([frozen], [row({ keywords: ["neo-noir"] })], "watched");
    expect(toUpdate[0]!.changes).toMatchObject({ keywords: ["neo-noir"] });
  });

  it("does not ask again for a card that has already answered empty", () => {
    const old = makeFilm({ title: "Un film", year: 1975, keywords: [] });
    const { unchanged } = diffImport([old], [row({ keywords: [] })], "watched");
    expect(unchanged).toHaveLength(1);
  });

  it("does not overwrite keywords already set", () => {
    const old = makeFilm({ title: "Un film", year: 1975, keywords: ["neo-noir"] });
    const { unchanged } = diffImport([old], [row({ keywords: ["autre chose"] })], "watched");
    expect(unchanged).toHaveLength(1);
  });

  it("sets them on a card created by the import", () => {
    const { toCreate } = diffImport([], [row({ keywords: ["heist"] })], "watched");
    expect(toCreate[0]!.keywords).toEqual(["heist"]);
  });
});

describe("isIncomplete — what 'complete the cards' goes after", () => {
  it("keeps a complete card that has no keywords", () => {
    const f = makeFilm({ title: "Un film", cast: ["Quelqu'un"], runtime: 100 });
    expect(isIncomplete(f)).toBe(true);
  });

  /* Without this distinction, a card TMDB has no keyword for would be
     queried again forever — the flaw `isIncomplete`'s header already
     warns about for countries and language. */
  it("leaves alone a card that has answered empty", () => {
    const f = makeFilm({ title: "Un film", cast: ["Quelqu'un"], runtime: 100, keywords: [] });
    expect(isIncomplete(f)).toBe(false);
  });
});

describe("withoutKeywords — what the explicit catch-up targets", () => {
  /* Broader than `isIncomplete`, and that is its whole point: that one
     rules out emptiness so as not to loop on every pass, but a collection
     frozen at `[]` needs to be targeted all the same. */
  it("keeps a card that has never been queried", () => {
    expect(withoutKeywords(makeFilm({ title: "Un film" }))).toBe(true);
  });

  it("keeps a card frozen empty, which `isIncomplete` lets through", () => {
    const frozen = makeFilm({ title: "Un film", cast: ["Quelqu'un"], runtime: 100, keywords: [] });
    expect(isIncomplete(frozen)).toBe(false);
    expect(withoutKeywords(frozen)).toBe(true);
  });

  it("leaves alone a card that carries some", () => {
    expect(withoutKeywords(makeFilm({ title: "Un film", keywords: ["neo-noir"] }))).toBe(false);
  });
});
