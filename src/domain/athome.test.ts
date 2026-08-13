import { describe, it, expect } from "vitest";
import { atHomeSuggestions } from "./athome";
import { makeFilm } from "./film";
import type { Film, Watch } from "../types";

import i18n from "../i18n";
import { say } from "./wording";

/** What a `Wording` really reads as on screen. The suite runs in French. */
const said = (w: Parameters<typeof say>[0]) => say(w, i18n.t.bind(i18n));

/* A fixed reference date: everything this module computes is a duration
   since today, and a test that ages is a test that will one day pass
   without anyone knowing why. */
const TODAY = Date.parse("2026-08-07T12:00:00Z");
const daysAgo = (days: number): string =>
  new Date(TODAY - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

const watched = (title: string, watches: Watch[], extra: Partial<Film> = {}): Film =>
  makeFilm({ title, status: "watched", watches, ...extra });

const suggestions = (films: Film[], howMany = 6) => atHomeSuggestions(films, TODAY, howMany);

const titles = (films: Film[], howMany = 6) => suggestions(films, howMany).map((s) => s.film.title);

describe("who gets into the suggestions", () => {
  it("returns nothing from an empty collection", () => {
    expect(suggestions([])).toEqual([]);
  });

  it("ignores the watchlist: that is the 'which one tonight' question", () => {
    const toWatch = makeFilm({
      title: "En attente",
      status: "watchlist",
      rating: 5,
      watches: [{ date: daysAgo(1000), rating: 5 }],
    });
    expect(titles([toWatch])).toEqual([]);
  });

  it("ignores cards that have been set aside", () => {
    const f = watched("Rangé", [{ date: daysAgo(1000), rating: 5 }], {
      archived: true,
      rating: 5,
    });
    expect(titles([f])).toEqual([]);
  });

  it("ignores a card with no dated screening: there is no forgetting to measure", () => {
    expect(titles([watched("Sans date", [], { rating: 5 })])).toEqual([]);
  });
});

describe("to watch again", () => {
  it("brings back what we loved and set aside", () => {
    const f = watched("Adoré", [{ date: daysAgo(1000), rating: 5 }], { rating: 5 });
    const s = suggestions([f]);
    expect(s).toHaveLength(1);
    expect(s[0]!.nature).toBe("rewatch");
    expect(said(s[0]!.label)).toBe("À revoir");
    expect(said(s[0]!.reason)).toContain("2 ans");
  });

  it("leaves a recently watched film alone", () => {
    // suggesting it would look like insistence
    expect(titles([watched("Frais", [{ date: daysAgo(100), rating: 5 }], { rating: 5 })])).toEqual(
      []
    );
  });

  it("does not bring back a disappointment", () => {
    expect(titles([watched("Bof", [{ date: daysAgo(1000), rating: 2 }], { rating: 2 })])).toEqual(
      []
    );
  });

  it("keeps the BEST rating ever given, not the latest", () => {
    /* A film loved at the first screening and cooled on at the second is
       still a film we loved: `rating` alone would have ruled it out. */
    const f = watched(
      "Réévalué",
      [
        { date: daysAgo(1000), rating: 5 },
        { date: daysAgo(900), rating: 3 },
      ],
      { rating: 3 }
    );
    expect(titles([f])).toEqual(["Réévalué"]);
  });

  it("puts the best-rated first", () => {
    const films = [
      watched("Quatre", [{ date: daysAgo(1000), rating: 4 }], { rating: 4 }),
      watched("Cinq", [{ date: daysAgo(1000), rating: 5 }], { rating: 5 }),
    ];
    expect(titles(films)[0]).toBe("Cinq");
  });
});

describe("a neglected motif", () => {
  const withMotif = (n: number, days: number, rating: number, motifs: string[]) =>
    watched(`Film ${n}`, [{ date: daysAgo(days), rating }], { rating, motifs });

  it("flags a vein we have not crossed again", () => {
    const films = [withMotif(1, 900, 3, ["melancholy"]), withMotif(2, 800, 3.5, ["melancholy"])];
    const s = suggestions(films).find((x) => x.nature === "motif");
    expect(s).toBeDefined();
    expect(said(s!.label)).toBe("Mélancolie");
    expect(said(s!.reason)).toContain("2 films portent ce motif");
  });

  it("says nothing about a motif carried by a single card", () => {
    // an isolated motif is an accident, not a neglected vein
    const s = suggestions([withMotif(1, 900, 3, ["melancholy"])]);
    expect(s.some((x) => x.nature === "motif")).toBe(false);
  });

  it("stays quiet when the vein was crossed recently", () => {
    const films = [withMotif(1, 900, 3, ["melancholy"]), withMotif(2, 30, 3, ["melancholy"])];
    expect(suggestions(films).some((x) => x.nature === "motif")).toBe(false);
  });

  it("ignores a motif unknown to the catalogue rather than showing it bare", () => {
    const films = [
      withMotif(1, 900, 3, ["motif-fantome"]),
      withMotif(2, 800, 3, ["motif-fantome"]),
    ];
    expect(suggestions(films).some((x) => x.nature === "motif")).toBe(false);
  });

  it("suggests the best-rated of the vein, not the dustiest", () => {
    const films = [withMotif(1, 1200, 2, ["melancholy"]), withMotif(2, 900, 5, ["melancholy"])];
    const s = suggestions(films).find((x) => x.nature === "motif");
    expect(s!.film.title).toBe("Film 2");
  });
});

describe("a neglected filmmaker", () => {
  const byThem = (n: number, days: number, rating: number, director: string) =>
    watched(`Film ${n}`, [{ date: daysAgo(days), rating }], { rating, director });

  it("brings back someone we used to follow", () => {
    const films = [byThem(1, 900, 4, "Ozu"), byThem(2, 800, 5, "Ozu")];
    const s = suggestions(films).find((x) => x.nature === "director");
    expect(s).toBeDefined();
    expect(said(s!.label)).toBe("Ozu");
    expect(said(s!.reason)).toContain("2 films chez vous");
  });

  it("does not invent a followed filmmaker out of a single film", () => {
    const s = suggestions([byThem(1, 900, 5, "Ozu")]);
    expect(s.some((x) => x.nature === "director")).toBe(false);
  });

  it("does not bring back someone we did not like", () => {
    const films = [byThem(1, 900, 2, "Bof"), byThem(2, 800, 2.5, "Bof")];
    expect(suggestions(films).some((x) => x.nature === "director")).toBe(false);
  });

  it("splits a field with several hands in it", () => {
    const films = [byThem(1, 900, 5, "Coen, Coen"), byThem(2, 800, 5, "Coen, Coen")];
    const names = suggestions(films)
      .filter((x) => x.nature === "director")
      .map((x) => said(x.label));
    expect(names).toEqual(["Coen"]);
  });
});

/* ============================================================
   THE THRESHOLDS FOLLOW THE PRACTICE

   THESE TESTS HAVE ALREADY EARNED THEIR KEEP. The first draft wrote "two
   years" and "eighteen months" as literals — reasonable durations for a
   collection kept for ten years, and ones that disqualified EVERYTHING on
   a binder opened eighteen months ago. The whole section stayed empty,
   with nothing to say why. An absolute threshold does not measure
   forgetting: it measures the age of the binder.
   ============================================================ */
describe("the thresholds follow the span of the practice", () => {
  it("suggests on a young binder, where a hardcoded two years returned nothing", () => {
    /* Eighteen months of practice: a third makes six months. A film loved
       and not seen again for thirteen months really is a forgetting — for
       that particular collection. */
    const films = [
      watched("Le plus ancien", [{ date: daysAgo(540), rating: 3 }], { rating: 3 }),
      watched("Adoré et oublié", [{ date: daysAgo(400), rating: 5 }], { rating: 5 }),
      watched("Vu hier", [{ date: daysAgo(1), rating: 4 }], { rating: 4 }),
    ];
    expect(titles(films)).toContain("Adoré et oublié");
  });

  it("keeps a floor: a brand new binder has nothing forgotten in it", () => {
    /* Three weeks of practice: a third would make seven days, which is
       not a forgetting but an untimely reminder. The floor holds, and the
       section stays empty — which is the right answer. */
    const films = [
      watched("A", [{ date: daysAgo(21), rating: 5 }], { rating: 5 }),
      watched("B", [{ date: daysAgo(1), rating: 5 }], { rating: 5 }),
    ];
    expect(titles(films)).toEqual([]);
  });

  it("keeps the two-year ceiling on a long practice", () => {
    /* Fifteen years of log: a third would make five years, and we would
       see nothing of the last decade any more. Past a few years, two
       years really is the right measure of forgetting. */
    const films = [
      watched("Antique", [{ date: daysAgo(5475), rating: 3 }], { rating: 3 }),
      watched("Il y a trois ans", [{ date: daysAgo(1100), rating: 5 }], { rating: 5 }),
      watched("L'an dernier", [{ date: daysAgo(365), rating: 5 }], { rating: 5 }),
    ];
    const t = titles(films);
    expect(t).toContain("Il y a trois ans");
    expect(t).not.toContain("L'an dernier");
  });
});

describe("the assembly", () => {
  it("never suggests the same film twice", () => {
    /* The same film can be "to watch again", carry a neglected motif AND
       come from a neglected filmmaker: three reasons, a single card. */
    const films = [
      watched("A", [{ date: daysAgo(1000), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
      watched("B", [{ date: daysAgo(900), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
    ];
    const ids = suggestions(films).map((s) => s.film.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("interleaves the natures rather than laying them end to end", () => {
    const films = [
      watched("A", [{ date: daysAgo(1000), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
      watched("B", [{ date: daysAgo(900), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
      watched("C", [{ date: daysAgo(950), rating: 4.5 }], {
        rating: 4.5,
        director: "Varda",
        motifs: ["contemplative"],
      }),
      watched("D", [{ date: daysAgo(920), rating: 4.5 }], {
        rating: 4.5,
        director: "Varda",
        motifs: ["contemplative"],
      }),
    ];
    const natures = suggestions(films).map((s) => s.nature);
    // the three angles appear, rather than three "to watch again" in a row
    expect(new Set(natures).size).toBeGreaterThan(1);
  });

  /* THIS TEST HAS ALREADY EARNED ITS KEEP. For a film picked out by
     several natures, the first draft kept whichever came first — and "to
     watch again" always came first. So it hoovered up every film, and the
     other two natures, left without a subject, never appeared. The flaw
     was invisible on any single card: it only showed at the scale of the
     list. */
  it("lets the most specific reason win over 'to watch again'", () => {
    /* A is loved (hence "to watch again"), carries a neglected motif AND
       comes from a neglected filmmaker. It must not appear under the
       poorest of the three reasons. */
    const films = [
      watched("A", [{ date: daysAgo(1000), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
      watched("B", [{ date: daysAgo(900), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
    ];
    const forA = suggestions(films).find((s) => s.film.title === "A")!;
    expect(forA.nature).toBe("motif");
    // and "to watch again" has not vanished for all that: it picks up the rest
    expect(suggestions(films).map((s) => s.nature)).toContain("rewatch");
  });

  it("stops at the number asked for", () => {
    const films = Array.from({ length: 20 }, (_, i) =>
      watched(`F${i}`, [{ date: daysAgo(1000 + i), rating: 5 }], { rating: 5 })
    );
    expect(suggestions(films, 3)).toHaveLength(3);
  });

  it("does not spin when there is less to say than was asked for", () => {
    const films = [watched("Seul", [{ date: daysAgo(1000), rating: 5 }], { rating: 5 })];
    expect(suggestions(films, 10)).toHaveLength(1);
  });

  it("returns distinct keys, usable as identity", () => {
    const films = [
      watched("A", [{ date: daysAgo(1000), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
      watched("B", [{ date: daysAgo(900), rating: 5 }], {
        rating: 5,
        director: "Ozu",
        motifs: ["melancholy"],
      }),
    ];
    const keys = suggestions(films).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
