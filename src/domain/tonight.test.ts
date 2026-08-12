import { describe, it, expect } from "vitest";
import { rankTheEvening, listLanguages, SLOTS } from "./tonight";
import { makeFilm } from "./film";
import type { Film } from "../types";

const toWatch = (title: string, partial: Partial<Film> = {}) =>
  makeFilm({ title, status: "watchlist", ...partial });

const watched = (title: string, partial: Partial<Film> = {}) =>
  makeFilm({ title, status: "watched", ...partial });

/** The order of the titles suggested — the only thing we want to read. */
const order = (props: ReturnType<typeof rankTheEvening>) => props.map((p) => p.film.title);

const NO_CRAVING = { minutes: null, mood: [], languages: [] };

describe("who gets into the evening", () => {
  it("returns nothing from an empty collection", () => {
    expect(rankTheEvening([], NO_CRAVING)).toEqual([]);
  });

  it("only suggests from the watchlist", () => {
    const out = rankTheEvening([watched("Déjà vu"), toWatch("En attente")], NO_CRAVING);
    expect(order(out)).toEqual(["En attente"]);
  });

  it("leaves cards that were set aside where they are", () => {
    const out = rankTheEvening(
      [toWatch("Rangé", { archived: true }), toWatch("Sur la pile")],
      NO_CRAVING
    );
    expect(order(out)).toEqual(["Sur la pile"]);
  });
});

describe("the time available", () => {
  it("puts first the one that fits the slot", () => {
    const out = rankTheEvening(
      [toWatch("Fleuve", { runtime: 210 }), toWatch("Court", { runtime: 95 })],
      { ...NO_CRAVING, minutes: 120 }
    );
    expect(order(out)[0]).toBe("Court");
  });

  it("accepts a slight overrun rather than rejecting it", () => {
    // 125 min for two hours: a quarter of an hour late, not a mistake
    const out = rankTheEvening(
      [toWatch("Un peu long", { runtime: 125 }), toWatch("Beaucoup trop long", { runtime: 200 })],
      { ...NO_CRAVING, minutes: 120 }
    );
    expect(order(out)).toEqual(["Un peu long", "Beaucoup trop long"]);
    expect(out[0]!.overrun).toBe(5);
    expect(out[0]!.reasons.join(" ")).toContain("de trop");
  });

  it("does not rule out an unknown runtime, and says so", () => {
    const out = rankTheEvening([toWatch("Sans durée", { runtime: null })], {
      ...NO_CRAVING,
      minutes: 90,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.unknownRuntime).toBe(true);
    expect(out[0]!.reasons).toContain("durée inconnue");
  });

  it("files the unknown runtime after what fits, before what overruns", () => {
    const out = rankTheEvening(
      [
        toWatch("Inconnue", { runtime: null }),
        toWatch("Tient", { runtime: 100 }),
        toWatch("Déborde", { runtime: 190 }),
      ],
      { ...NO_CRAVING, minutes: 120 }
    );
    expect(order(out)).toEqual(["Tient", "Inconnue", "Déborde"]);
  });

  it("does not count the time when none is asked for", () => {
    const out = rankTheEvening(
      [toWatch("Fleuve", { runtime: 240 }), toWatch("Court", { runtime: 80 })],
      NO_CRAVING
    );
    // nothing tells them apart on runtime: it is the age that decides
    expect(out).toHaveLength(2);
    expect(out[0]!.overrun).toBe(0);
  });
});

describe("the mood", () => {
  it("brings up what carries it", () => {
    const out = rankTheEvening(
      [toWatch("Gai", { motifs: ["burlesque"] }), toWatch("Triste", { motifs: ["melancolie"] })],
      { ...NO_CRAVING, mood: ["melancolie"] }
    );
    expect(order(out)[0]).toBe("Triste");
    expect(out[0]!.reasons).toContain("mélancolie");
  });

  it("also reads the guessed motifs, which no unwatched card carries", () => {
    /* A film we have not seen carries no motifs: that is the whole point
       of guessing from TMDB keywords. */
    const f = toWatch("Deviné");
    const out = rankTheEvening(
      [f, toWatch("Rien")],
      { ...NO_CRAVING, mood: ["melancolie"] },
      new Map([[f.id, ["melancolie"]]])
    );
    expect(order(out)[0]).toBe("Deviné");
  });

  it("prefers the one answering two moods out of two", () => {
    const out = rankTheEvening(
      [
        toWatch("Une seule", { motifs: ["melancolie"] }),
        toWatch("Les deux", { motifs: ["melancolie", "contemplatif"] }),
      ],
      { ...NO_CRAVING, mood: ["melancolie", "contemplatif"] }
    );
    expect(order(out)[0]).toBe("Les deux");
  });

  it("asks for nothing when no mood is set", () => {
    const out = rankTheEvening(
      [toWatch("A", { motifs: ["melancolie"] }), toWatch("B")],
      NO_CRAVING
    );
    expect(out).toHaveLength(2);
  });
});

describe("the language", () => {
  it("rules out what is not in the language asked for", () => {
    const out = rankTheEvening(
      [toWatch("Japonais", { language: "ja" }), toWatch("Suédois", { language: "sv" })],
      { ...NO_CRAVING, languages: ["ja"] }
    );
    expect(order(out)).toEqual(["Japonais"]);
  });

  it("keeps an unknown language rather than punishing incompleteness", () => {
    const out = rankTheEvening(
      [toWatch("Sans langue", { language: "" }), toWatch("Suédois", { language: "sv" })],
      { ...NO_CRAVING, languages: ["ja"] }
    );
    expect(order(out)).toEqual(["Sans langue"]);
  });
});

describe("the age on the list", () => {
  it("breaks the tie in favour of the one we had forgotten", () => {
    const old = toWatch("Oublié", { runtime: 100, addedAt: 1_000 });
    const fresh = toWatch("D'hier", { runtime: 100, addedAt: 9_000_000_000 });
    const out = rankTheEvening([fresh, old], { ...NO_CRAVING, minutes: 120 });
    expect(order(out)[0]).toBe("Oublié");
  });
});

describe("with no taste profile", () => {
  it("still ranks, without inventing an affinity", () => {
    // fewer than three films watched: `taste.isEmpty`
    const out = rankTheEvening([toWatch("A", { runtime: 90, genres: ["Drame"] })], {
      ...NO_CRAVING,
      minutes: 120,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons.join(" ")).not.toContain("vous aimez");
  });
});

describe("listLanguages", () => {
  it("only returns the watchlist's languages, the best furnished first", () => {
    const out = listLanguages([
      toWatch("A", { language: "ja" }),
      toWatch("B", { language: "fr" }),
      toWatch("C", { language: "fr" }),
      watched("D", { language: "de" }),
      toWatch("E", { language: "" }),
    ]);
    expect(out).toEqual([
      { code: "fr", n: 2 },
      { code: "ja", n: 1 },
    ]);
  });
});

describe("the slots", () => {
  it("run from the shortest to the longest", () => {
    const m = SLOTS.map((c) => c.minutes);
    expect(m).toEqual([...m].sort((a, b) => a - b));
  });
});
