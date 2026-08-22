import { describe, it, expect } from "vitest";
import { counterpointFor, THIN, type GapKind } from "./counterpoint";
import { makeFilm } from "./film";
import type { Film, Watch } from "../types";

/* A card with its log. The screenings are given in any order at all on
   purpose: nothing here may assume they arrive sorted. */
const seen = (title: string, watches: (Watch | string)[], extra: Partial<Film> = {}): Film =>
  makeFilm({
    title,
    watches: watches.map((w) => (typeof w === "string" ? { date: w, rating: null } : w)),
    ...extra,
  });

/* Enough evenings to get past `THIN`, on cards that carry nothing the
   three axes can catch: no year, no country, no director. Every test
   that wants a real gap starts from these, so that `tooThin` never
   silences the case being looked at. */
const ballast = (): Film[] =>
  Array.from({ length: THIN }, (_, i) =>
    seen(`ballast ${i}`, [`2024-01-${String(i + 1).padStart(2, "0")}`], {
      year: "",
      director: "",
      countries: [],
    })
  );

const of = (films: Film[], kind: GapKind, period: "always" | number = "always") =>
  counterpointFor(films, period).gaps.filter((g) => g.kind === kind);

describe("the decade never put on", () => {
  it("comes out when the collection holds one and no evening was spent there", () => {
    const films = [
      ...ballast(),
      seen("Ordet", [], { year: 1955, status: "watched" }),
      seen("Nuit et brouillard", [], { year: 1956, status: "watched" }),
    ];
    const gaps = of(films, "decade");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ key: "1950", seen: 0, cards: 0, held: 2 });
  });

  it("says nothing of a decade held by a single card: that is one film, not an era", () => {
    const films = [...ballast(), seen("Ordet", [], { year: 1955, status: "watched" })];
    expect(of(films, "decade")).toEqual([]);
  });

  it("says nothing of a decade that was actually watched", () => {
    const films = [
      ...ballast(),
      seen("Ordet", ["2024-05-01"], { year: 1955 }),
      seen("Nuit et brouillard", [], { year: 1956, status: "watched" }),
    ];
    expect(of(films, "decade")).toEqual([]);
  });

  it("invents no decade out of a year typed by hand", () => {
    const films = [
      ...ballast(),
      /* `year` IS TYPED BY HAND, so a typo really does reach the domain
         at runtime whatever the type says. That is the case guarded. */
      seen("A", [], { year: "196?" as unknown as Film["year"], status: "watched" }),
      seen("B", [], { year: "", status: "watched" }),
    ];
    expect(of(films, "decade")).toEqual([]);
  });
});

describe("the country visited once", () => {
  it("comes out on one card watched, and no longer on two", () => {
    const once = [...ballast(), seen("Tokyo", ["2024-06-01"], { countries: ["JP"] })];
    expect(of(once, "country")).toHaveLength(1);

    const twice = [...once, seen("Kyoto", ["2024-06-02"], { countries: ["JP"] })];
    expect(of(twice, "country")).toEqual([]);
  });

  it("SIX REWATCHES OF ONE FILM ARE NOT SIX VISITS: the gap holds", () => {
    const films = [
      ...ballast(),
      seen(
        "Voyage à Tokyo",
        ["2024-03-04", "2024-01-02", "2024-05-06", "2024-02-03", "2024-04-05", "2024-06-07"],
        { countries: ["JP"] }
      ),
    ];
    const gaps = of(films, "country");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ key: "JP", seen: 6, cards: 1 });
  });

  it("takes the oldest screening as the witness, whatever order the log is in", () => {
    const films = [
      ...ballast(),
      seen("Tokyo", ["2024-09-09", "2024-02-02", "2024-07-07"], { countries: ["JP"] }),
    ];
    const gap = of(films, "country")[0];
    expect(gap?.witness?.title).toBe("Tokyo");
  });

  it("has no witness for a country held and never watched", () => {
    const films = [...ballast(), seen("Oldboy", [], { countries: ["KR"], status: "watched" })];
    const gaps = of(films, "country");
    expect(gaps[0]).toMatchObject({ key: "KR", cards: 0, held: 1, witness: null });
  });
});

describe("the filmmaker held and left unwatched", () => {
  it("comes out when three cards are held and one evening was spent", () => {
    const films = [
      ...ballast(),
      seen("Voyage à Tokyo", ["2024-04-01"], { director: "Yasujirō Ozu" }),
      seen("Printemps tardif", [], { director: "Yasujirō Ozu", status: "watched" }),
      seen("Herbes flottantes", [], { director: "Yasujirō Ozu", status: "watched" }),
    ];
    const gaps = of(films, "director");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ key: "Yasujirō Ozu", cards: 1, held: 3 });
  });

  it("says nothing of a filmmaker held once and watched once", () => {
    const films = [...ballast(), seen("Solaris", ["2024-04-01"], { director: "Tarkovski" })];
    expect(of(films, "director")).toEqual([]);
  });

  it("A WATCHLIST CARD COUNTS AS HELD, and it is what makes the gap", () => {
    const watched = [...ballast(), seen("Solaris", ["2024-04-01"], { director: "Tarkovski" })];
    expect(of(watched, "director")).toEqual([]);

    const andOneWaiting = [
      ...watched,
      makeFilm({ title: "Stalker", director: "Tarkovski", status: "watchlist" }),
    ];
    const gaps = of(andOneWaiting, "director");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ key: "Tarkovski", cards: 1, held: 2, seen: 1 });
  });

  it("reads one field as several people", () => {
    const films = [
      ...ballast(),
      seen("Fargo", ["2024-04-01"], { director: "Joel Coen, Ethan Coen" }),
      seen("Barton Fink", [], { director: "Joel Coen, Ethan Coen", status: "watched" }),
    ];
    expect(of(films, "director").map((g) => g.key)).toEqual(["Ethan Coen", "Joel Coen"]);
  });

  it("READS TWO SPELLINGS AS ONE PERSON, shown under the most frequent", () => {
    const films = [
      ...ballast(),
      seen("Ozu A", ["2024-04-02"], { director: "Ozu" }),
      seen("Ozu B", [], { director: "ozu", status: "watched" }),
      seen("Ozu C", [], { director: "Ozu", status: "watched" }),
    ];
    const gaps = of(films, "director");
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ key: "Ozu", held: 3, cards: 1 });
  });
});

describe("the period", () => {
  it("is respected: a country visited twice in one year is a gap in the next", () => {
    const films = [
      ...ballast(),
      seen("Tokyo", ["2023-01-01"], { countries: ["JP"] }),
      seen("Kyoto", ["2023-02-01", "2024-02-01"], { countries: ["JP"] }),
    ];
    expect(counterpointFor(films, 2023).gaps.filter((g) => g.key === "JP")).toEqual([]);
    expect(of(films, "country", 2024).map((g) => g.key)).toContain("JP");
  });
});

describe("the order", () => {
  it("puts the natures in a fixed order, panoramic first", () => {
    const films = [
      ...ballast(),
      seen("Ordet", [], { year: 1955, status: "watched" }),
      seen("Vampyr", [], { year: 1958, status: "watched" }),
      seen("Tokyo", ["2024-06-01"], { countries: ["JP"], director: "Ozu" }),
      seen("Kyoto", [], { director: "Ozu", status: "watched" }),
    ];
    const kinds = counterpointFor(films, "always").gaps.map((g) => g.kind);
    expect(kinds).toEqual(
      [...kinds].sort(
        (a, b) =>
          ["decade", "country", "director"].indexOf(a) -
          ["decade", "country", "director"].indexOf(b)
      )
    );
  });

  it("IS DETERMINISTIC: two readings of one collection name the same gaps", () => {
    const films = [
      ...ballast(),
      seen("A", [], { year: 1955, status: "watched", countries: ["KR"] }),
      seen("B", [], { year: 1956, status: "watched", countries: ["KR"] }),
      seen("C", [], { year: 1965, status: "watched", countries: ["SE"] }),
      seen("D", [], { year: 1966, status: "watched", countries: ["SE"] }),
    ];
    expect(counterpointFor(films, "always")).toEqual(counterpointFor(films, "always"));
    /* Same amplitude on both sides: the raw key breaks the tie. */
    expect(of(films, "decade").map((g) => g.key)).toEqual(["1950", "1960"]);
  });
});

describe("what is said when nothing can be", () => {
  it("A THIN COLLECTION HAS NO HABITS, so it is given no gaps at all", () => {
    const films = [
      seen("Tokyo", ["2024-06-01"], { countries: ["JP"], year: 1953, director: "Ozu" }),
      seen("Kyoto", [], { director: "Ozu", status: "watched" }),
    ];
    const out = counterpointFor(films, "always");
    expect(out.tooThin).toBe(true);
    expect(out.gaps).toEqual([]);
    expect(out.weighed).toBe(1);
  });

  it("stops being thin at THIN cards watched and dated", () => {
    expect(counterpointFor(ballast(), "always").tooThin).toBe(false);
    expect(counterpointFor(ballast().slice(1), "always").tooThin).toBe(true);
  });

  it("AN EVEN COLLECTION IS NOT A THIN ONE: no gaps, and it says so", () => {
    const out = counterpointFor(ballast(), "always");
    expect(out.tooThin).toBe(false);
    expect(out.gaps).toEqual([]);
  });

  it("weighs neither an empty collection nor a card with no screening", () => {
    expect(counterpointFor([], "always")).toMatchObject({ weighed: 0, tooThin: true, gaps: [] });
  });

  it("survives a card carrying no country and no director", () => {
    const films = [...ballast(), seen("Nothing", ["2024-08-08"], { countries: [], director: "" })];
    expect(() => counterpointFor(films, "always")).not.toThrow();
  });
});
