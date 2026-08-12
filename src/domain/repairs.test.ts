import { describe, it, expect } from "vitest";
import { makeFilm } from "./film";
import { flippedByMistake, hasWatchTrace } from "./repairs";
import type { Film } from "../types";

const film = (p: Partial<Film>): Film => makeFilm(p as never);

describe("hasWatchTrace", () => {
  it("sees no trace on a card nobody has opened", () => {
    expect(hasWatchTrace(film({ title: "Stalker", status: "watched" }))).toBe(false);
  });

  /* The five traces, one by one: it is the whole list that makes the sort
     safe — a single one left out flips a real memory. */
  it.each([
    ["a screening", { watches: [{ date: "2024-01-01", rating: 0 }] }],
    ["a date", { watchedAt: "2024-01-01" }],
    ["a rating", { rating: 4 }],
    ["a review", { review: "immense" }],
    ["a free note", { notes: "vu au cinéma" }],
  ])("recognises %s", (_, field) => {
    expect(hasWatchTrace(film({ title: "Stalker", status: "watched", ...field }))).toBe(true);
  });

  it("does not take empty text for a trace", () => {
    expect(hasWatchTrace(film({ title: "Stalker", status: "watched", review: "   " }))).toBe(false);
  });
});

describe("flippedByMistake", () => {
  const bare = (title: string, p: Partial<Film> = {}) => film({ title, status: "watched", ...p });

  it("only points out 'watched' cards with no trace", () => {
    const suspect = bare("Solaris");
    const seen = bare("Le Miroir", { rating: 5 });
    const wish = film({ title: "Andreï Roublev", status: "watchlist" });
    expect(flippedByMistake([suspect, seen, wish]).map((f) => f.title)).toEqual(["Solaris"]);
  });

  it("leaves cards that were set aside where they are", () => {
    expect(flippedByMistake([bare("Solaris", { archived: true })])).toEqual([]);
  });

  it("shows the ones from Letterboxd first, then by title", () => {
    const films = [
      bare("Zerkalo"),
      bare("Andreï Roublev"),
      bare("Solaris", { source: "letterboxd" }),
    ];
    expect(flippedByMistake(films).map((f) => f.title)).toEqual([
      "Solaris",
      "Andreï Roublev",
      "Zerkalo",
    ]);
  });
});
