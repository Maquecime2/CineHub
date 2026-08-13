import { describe, it, expect } from "vitest";
import { wakeAtHome, linksBetween, scoreOf, WEIGHTS, familyOf, byQuotas } from "./wake";
import type { Quotas } from "./wake";
import { makeFilm } from "./film";
import type { Film } from "../types";

import i18n from "../i18n";
import { say } from "./wording";

/** What a `Wording` really reads as on screen. The suite runs in French. */
const said = (w: Parameters<typeof say>[0]) => say(w, i18n.t.bind(i18n));

const film = (title: string, extra: Partial<Film> = {}): Film =>
  makeFilm({ title, status: "watched", ...extra });

/* Wide by default: most cases want to see EVERYTHING the wake found, and
   not what a quota lets through. The quotas have their own section. */
const titles = (
  pivot: Film,
  films: Film[],
  quotas: Partial<Quotas> = { people: 50, subjects: 50 }
) => wakeAtHome(pivot, films, quotas).map((v) => v.film.title);

describe("who gets into the wake", () => {
  it("returns nothing from an empty collection", () => {
    expect(wakeAtHome(film("Seul"), [])).toEqual([]);
  });

  it("does not suggest itself", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    expect(titles(pivot, [pivot])).toEqual([]);
  });

  it("rules out a card with no link at all: closeness has to be sayable", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    const stranger = film("Étranger", { director: "Agnès Varda" });
    expect(titles(pivot, [stranger])).toEqual([]);
  });

  it("rules out filed cards: archiving them is asking not to see them again", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    const filed = film("Rangé", { director: "Denis Villeneuve", archived: true });
    expect(titles(pivot, [filed])).toEqual([]);
  });

  it("keeps the watchlist: 'set aside, and close' is worth knowing", () => {
    const pivot = film("Pivot", { director: "Denis Villeneuve" });
    const toWatch = makeFilm({
      title: "En attente",
      status: "watchlist",
      director: "Denis Villeneuve",
    });
    expect(titles(pivot, [toWatch])).toEqual(["En attente"]);
  });
});

describe("what brings two cards together", () => {
  it("recognises a name written with an accent on one side only", () => {
    const a = film("A", { crew: { musique: ["Zbigniew Preisner"] } });
    const b = film("B", { crew: { musique: ["zbigniew preïsner"] } });
    expect(linksBetween(a, b).map((l) => l.type)).toEqual(["music"]);
  });

  it("splits a directing credit with several hands in it", () => {
    const a = film("A", { director: "Joel Coen, Ethan Coen" });
    const b = film("B", { director: "Ethan Coen" });
    expect(linksBetween(a, b)).toEqual([{ type: "directing", value: "Ethan Coen" }]);
  });

  it("files the links from the rarest to the most commonplace", () => {
    const shared = {
      director: "X",
      crew: { image: ["Deakins"] },
      themes: ["désert"],
    };
    const a = film("A", shared);
    const b = film("B", shared);
    expect(linksBetween(a, b).map((l) => l.type)).toEqual(["cinematography", "directing", "theme"]);
  });

  /* The case that motivated the whole `keywords` field: on an imported
     collection, `motifs` and `themes` are empty — they are set by hand.
     Without keywords, the wake could only bring names together. */
  it("brings two cards together by a TMDB keyword, with nothing typed", () => {
    const a = film("A", { keywords: ["time loop", "sequel"] });
    const b = film("B", { keywords: ["time loop"] });
    expect(linksBetween(a, b)).toEqual([{ type: "keyword", value: "time loop" }]);
  });

  it("does not say the same thing twice when a motif covers the keyword", () => {
    /* "hero-dies" carries "death of hero" in its `tmdb` list: counting
       both would make two remarks for a single fact. */
    const a = film("A", { motifs: ["hero-dies"], keywords: ["death of hero"] });
    const b = film("B", { motifs: ["hero-dies"], keywords: ["death of hero"] });
    /* The link now carries the motif's ID and not the French of the
       day: a catalogue motif has one name per language, and the display
       resolves it from `motifId`. */
    expect(linksBetween(a, b)).toEqual([
      { type: "motif", value: "hero-dies", motifId: "hero-dies" },
    ]);
  });

  it("keeps a keyword that no shared motif covers", () => {
    const a = film("A", { motifs: ["hero-dies"], keywords: ["neo-noir"] });
    const b = film("B", { motifs: ["hero-dies"], keywords: ["neo-noir"] });
    expect(linksBetween(a, b).map((l) => l.type)).toEqual(["motif", "keyword"]);
  });

  it("puts a motif chosen by hand ahead of a keyword we merely received", () => {
    const pivot = film("Pivot", { motifs: ["hero-dies"], keywords: ["neo-noir"] });
    const byMotif = film("Par motif", { motifs: ["hero-dies"] });
    const byKeyword = film("Par mot-clé", { keywords: ["neo-noir"] });
    expect(titles(pivot, [byKeyword, byMotif])).toEqual(["Par motif", "Par mot-clé"]);
  });

  it("ignores a motif the catalogue does not know, without dropping the card", () => {
    const a = film("A", { motifs: ["hero-dies", "motif-fantome"] });
    const b = film("B", { motifs: ["hero-dies", "motif-fantome"] });
    expect(linksBetween(a, b)).toHaveLength(1);
  });

  /* THE CREW KEYS ARE STORED IN FRENCH, and this test is what holds them
     there. `crew` is written to disk as `{ image, musique, scénario }`;
     translating those keys along with the rest of the module would have
     made every shared cinematographer silently invisible — the lookup
     would find nothing, and no error would ever be raised. */
  it("reads the crew under the keys the cards actually carry", () => {
    const a = film("A", {
      crew: { image: ["Deakins"], musique: ["Zimmer"], scénario: ["Kaufman"] },
    });
    const b = film("B", {
      crew: { image: ["Deakins"], musique: ["Zimmer"], scénario: ["Kaufman"] },
    });
    expect(linksBetween(a, b).map((l) => l.type)).toEqual(["cinematography", "music", "writing"]);
  });
});

describe("the weighting", () => {
  it("puts a shared cinematographer ahead of a shared director", () => {
    const pivot = film("Pivot", { director: "X", crew: { image: ["Deakins"] } });
    const sameEye = film("Même œil", { crew: { image: ["Deakins"] } });
    const sameDirector = film("Même réal", { director: "X" });
    expect(titles(pivot, [sameDirector, sameEye])).toEqual(["Même œil", "Même réal"]);
  });

  it("downgrades an actor according to their billing rank", () => {
    const pivot = film("Pivot", { cast: ["Tête", "B", "C", "D", "E", "F", "G", "Queue"] });
    const lead = film("Tête d'affiche", { cast: ["Tête"] });
    const bitPart = film("Second rôle", { cast: ["Queue"] });
    const out = wakeAtHome(pivot, [bitPart, lead]);
    expect(out[0]!.film.title).toBe("Tête d'affiche");
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
  });

  it("caps the motifs: six commonplaces are not worth a shared gaze", () => {
    const many = ["hero-dies", "sacrifice", "everyone-dies", "sole-survivor"];
    const pivot = film("Pivot", { motifs: many, crew: { image: ["Deakins"] } });
    const motifs = film("Motifs", { motifs: many });
    const eye = film("Œil", { crew: { image: ["Deakins"] } });
    /* Four motifs at 2 points would make 8 with no cap, and would crush
       the cinematographer's 3 points. Capped at 5, they go ahead — but
       only just, and one motif fewer would no longer be enough. */
    const scores = wakeAtHome(pivot, [motifs, eye]);
    expect(scores[0]!.score).toBeLessThan(4 * WEIGHTS.motif);
  });

  it("taste re-ranks but does not eliminate: a hated film is still suggested", () => {
    const pivot = film("Pivot", { crew: { image: ["Deakins"] } });
    const loved = film("Aimé", { crew: { image: ["Deakins"] }, rating: 5 });
    const hated = film("Détesté", { crew: { image: ["Deakins"] }, rating: 0.5 });
    expect(titles(pivot, [hated, loved])).toEqual(["Aimé", "Détesté"]);
  });
});

describe("what gets written under the poster", () => {
  it("names the strongest link and counts the rest", () => {
    const pivot = film("Pivot", {
      crew: { image: ["Roger Deakins"] },
      motifs: ["hero-dies", "sacrifice"],
    });
    const neighbour = film("Voisin", {
      crew: { image: ["Roger Deakins"] },
      motifs: ["hero-dies", "sacrifice"],
    });
    expect(said(wakeAtHome(pivot, [neighbour])[0]!.reason)).toBe(
      "même chef op — Roger Deakins, + 2 motifs"
    );
  });

  it("counts nothing when there is only one link", () => {
    const pivot = film("Pivot", { director: "Chantal Akerman" });
    const neighbour = film("Voisin", { director: "Chantal Akerman" });
    expect(said(wakeAtHome(pivot, [neighbour])[0]!.reason)).toBe(
      "même réalisation — Chantal Akerman"
    );
  });
});

describe("the ranking is stable", () => {
  it("does not depend on the array's order", () => {
    const pivot = film("Pivot", { director: "X", crew: { musique: ["M"] } });
    const a = film("Alpha", { director: "X" });
    const b = film("Bravo", { director: "X" });
    const c = film("Charlie", { crew: { musique: ["M"] } });
    expect(titles(pivot, [a, b, c])).toEqual(titles(pivot, [c, b, a]));
  });

  it("breaks a tie between twin cards by the title", () => {
    const pivot = film("Pivot", { director: "X" });
    const a = film("Alpha", { director: "X" });
    const b = film("Bravo", { director: "X" });
    expect(titles(pivot, [b, a])).toEqual(["Alpha", "Bravo"]);
  });

  it("stops at the number asked for", () => {
    const pivot = film("Pivot", { director: "X" });
    const many = Array.from({ length: 20 }, (_, i) => film(`F${i}`, { director: "X" }));
    expect(wakeAtHome(pivot, many, { people: 2, subjects: 1, crowd: 0 })).toHaveLength(3);
  });
});

describe("the quotas: the people on one side, the subjects on the other", () => {
  const pivot = film("Pivot", {
    director: "X",
    crew: { image: ["Deakins"], musique: ["Zimmer"] },
    cast: ["Vedette"],
    motifs: ["hero-dies"],
    keywords: ["neo-noir"],
  });
  const people = [
    film("G1", { director: "X" }),
    film("G2", { crew: { image: ["Deakins"] } }),
    film("G3", { crew: { musique: ["Zimmer"] } }),
    film("G4", { cast: ["Vedette"] }),
  ];
  const subjects = [
    film("S1", { motifs: ["hero-dies"] }),
    film("S2", { keywords: ["neo-noir"] }),
    film("S3", { motifs: ["hero-dies"], keywords: ["neo-noir"] }),
  ];

  it("files each neighbour under its strongest link", () => {
    expect(familyOf(linksBetween(pivot, people[1]!))).toBe("people");
    expect(familyOf(linksBetween(pivot, subjects[0]!))).toBe("subjects");
  });

  /* The flaw the quotas correct: proper names weigh more than a motif, so
     much so that ranking by score alone returned filmographies and never
     a subject. */
  it("reserves places for the subjects that score alone would have taken", () => {
    const out = wakeAtHome(pivot, [...people, ...subjects], {
      people: 2,
      subjects: 2,
      crowd: 0,
    });
    const families = out.map((v) => familyOf(v.links));
    expect(families.filter((f) => f === "people")).toHaveLength(2);
    expect(families.filter((f) => f === "subjects")).toHaveLength(2);
  });

  /* A collection with no motifs and no keywords must not be punished for
     a lack it cannot make good on the spot. */
  it("hands the other family what one family does not take", () => {
    const out = wakeAtHome(pivot, people, { people: 2, subjects: 2, crowd: 0 });
    expect(out).toHaveLength(4);
    expect(out.every((v) => familyOf(v.links) === "people")).toBe(true);
  });

  it("does not return more than what exists", () => {
    expect(wakeAtHome(pivot, [people[0]!], { people: 5, subjects: 5, crowd: 0 })).toHaveLength(1);
  });
});

describe("byQuotas", () => {
  const item = (name: string, f: "people" | "subjects") => ({ name, f });
  const family = (i: { f: "people" | "subjects" }) => i.f;

  /* Served family by family, you would read five "same crew" and then
     five "same subject": two lists glued together, not an answer. */
  it("returns the whole thing in ranking order, not family by family", () => {
    const sorted = [
      item("a", "people"),
      item("b", "subjects"),
      item("c", "people"),
      item("d", "subjects"),
    ];
    expect(
      byQuotas(sorted, family, { people: 2, subjects: 2, crowd: 0 }).map((i) => i.name)
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("returns nothing from an empty list", () => {
    expect(byQuotas([], family, { people: 5, subjects: 5, crowd: 0 })).toEqual([]);
  });
});

describe("scoreOf", () => {
  it("returns zero with no link at all", () => {
    const a = film("A");
    expect(scoreOf(a, film("B"), [])).toBe(0);
  });
});
