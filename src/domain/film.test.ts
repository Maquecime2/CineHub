import { describe, it, expect } from "vitest";
import {
  hasChanged,
  editLinkedWork,
  stamp,
  makeFilm,
  mergeWatches,
  migrate,
  publicPart,
  ratingDrift,
  uid,
  watchCount,
  withWatches,
} from "./film";
import type { Film, LinkedWork } from "../types";

describe("uid", () => {
  it("does not repeat itself", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
  });

  it("sorts in birth order, including within the same millisecond", () => {
    /* That is half the point of a UUID v7: a database index receiving
       increasing keys does not fragment.

       Two hundred cards from the same import are born in the SAME
       millisecond: with no counter, their order falls back on randomness,
       and the promise no longer holds where it is most useful. */
    const ids = Array.from({ length: 200 }, () => uid());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(200);
  });

  it("announces its version, for whoever reads it on the other side", () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("with no cryptographic generator, the card still gets written", () => {
    const vrai = crypto.randomUUID;
    // @ts-expect-error — we simulate a browser that does not have it
    crypto.randomUUID = undefined;
    try {
      expect(uid().length).toBeGreaterThan(8);
    } finally {
      crypto.randomUUID = vrai;
    }
  });
});

describe("dating what has changed", () => {
  const base = (p: Partial<Film> = {}): Film => makeFilm({ id: "a", updatedAt: 1000, ...p });

  it("an identical copy is not a change", () => {
    const f = base();
    expect(hasChanged(f, { ...f })).toBe(false);
  });

  it("a composite value that moves is one", () => {
    const f = base();
    expect(hasChanged(f, { ...f, motifs: ["pluie"] })).toBe(true);
    expect(hasChanged(f, { ...f, watches: [{ date: "2020-01-01", rating: 4 }] })).toBe(true);
  });

  it("the modification date itself does not count as a change", () => {
    /* Otherwise every write would cause another, indefinitely. */
    const f = base();
    expect(hasChanged(f, { ...f, updatedAt: 9999 })).toBe(false);
  });

  it("stamp touches only what moved, and returns the rest intact", () => {
    const a = base({ id: "a" });
    const b = base({ id: "b" });
    const suite = stamp([a, b], [{ ...a, rating: 5 }, { ...b }], 5000);
    expect(suite[0]!.updatedAt).toBe(5000);
    expect(suite[1]).toBe(b);
  });

  it("nothing moved: it is the array we were given that comes back", () => {
    const a = base();
    const received = [a];
    expect(stamp([a], received, 5000)).toBe(received);
  });

  it("a card never seen before is a card that has changed", () => {
    const neuve = base({ id: "neuf" });
    expect(stamp([], [neuve], 5000)[0]!.updatedAt).toBe(5000);
  });
});

describe("what gets shared", () => {
  it("the private notebook and the screening log do not go out", () => {
    const f = makeFilm({
      title: "Beau travail",
      notes: "à revoir avec P.",
      watches: [{ date: "2021-03-02", rating: 5 }],
      review: "la danse de la fin",
      rating: 5,
    });
    const published = publicPart(f) as Record<string, unknown>;
    expect("notes" in published).toBe(false);
    expect("watches" in published).toBe(false);
    /* What one publishes when one publishes: that is the point of a
       shared video library. */
    expect(published.review).toBe("la danse de la fin");
    expect(published.rating).toBe(5);
    expect(published.title).toBe("Beau travail");
  });

  it("a field added tomorrow goes out with the rest, rather than being forgotten", () => {
    /* That is why we name what we SET ASIDE, and not what we keep. */
    const f = { ...makeFilm({ title: "Elephant" }), nouveauChamp: "présent" } as unknown as Film;
    expect((publicPart(f) as Record<string, unknown>).nouveauChamp).toBe("présent");
  });
});

describe("makeFilm", () => {
  it("gives a complete card even with nothing supplied", () => {
    const f = makeFilm();
    expect(f.id).toBeTruthy();
    expect(f.status).toBe("watched");
    expect(f.genres).toEqual([]);
    expect(f.order).toBeNull();
  });

  it("lets the supplied content win over the default values", () => {
    expect(makeFilm({ title: "Stalker", status: "watchlist" })).toMatchObject({
      title: "Stalker",
      status: "watchlist",
    });
  });

  it("does not share its arrays between two cards", () => {
    // a shared default array would make one genre appear across the whole collection
    const a = makeFilm();
    const b = makeFilm();
    a.genres.push("Drame");
    expect(b.genres).toEqual([]);
  });
});

describe("migrate", () => {
  it("completes cards from before the recent fields", () => {
    const vieille = { id: "x", title: "Stalker", rating: 4 };
    const [f] = migrate([vieille]);
    expect(f).toMatchObject({
      id: "x",
      title: "Stalker",
      rating: 4,
      status: "watched",
      bedside: false,
      archived: false,
      order: null,
    });
    expect(f!.stills).toEqual([]);
    expect(f!.linkedWorks).toEqual([]);
  });

  /* ============================================================
     THE TRANSLATION MUST COST A BINDER ALREADY KEPT NOTHING

     Two fields changed name when the code moved to English, and both are
     written to disk: `chevet` became `bedside`, and `Relation`'s values
     changed vocabulary. `migrate` is the only door a card comes in
     through — so this is where reading the old spellings back is proved,
     or nowhere.
     ============================================================ */
  it("reads `chevet` back on a card from before the translation", () => {
    const [f] = migrate([{ id: "x", title: "Stalker", chevet: true } as never]);
    expect(f!.bedside).toBe(true);
    // and the old spelling does not survive the read-back
    expect(f as unknown as Record<string, unknown>).not.toHaveProperty("chevet");
  });

  it("does not take the absence of `chevet` for a top shelf", () => {
    expect(migrate([{ id: "x", title: "Stalker" }])[0]!.bedside).toBe(false);
  });

  it("translates the relations written before the switch, without losing direction", () => {
    const [f] = migrate([
      {
        id: "a",
        title: "Stalker",
        linkedWorks: [
          { id: "w1", type: "film", filmId: "b", relation: "suite-de" },
          { id: "w2", type: "film", filmId: "c", relation: "écho" },
        ],
      } as never,
    ]);
    expect(f!.linkedWorks.map((w) => w.relation)).toEqual(["sequel-to", "echo"]);
  });

  it("leaves an already translated relation intact", () => {
    const [f] = migrate([
      {
        id: "a",
        title: "Stalker",
        linkedWorks: [{ id: "w1", type: "film", filmId: "b", relation: "precedes" }],
      } as never,
    ]);
    expect(f!.linkedWorks[0]!.relation).toBe("precedes");
  });

  /* A link with no relation is the ordinary case — the kind of the
     thread is optional. The migration must not invent one for it. */
  it("does not invent a relation where there was none", () => {
    const [f] = migrate([
      {
        id: "a",
        title: "Stalker",
        linkedWorks: [{ id: "w1", type: "livre", title: "Roadside Picnic" }],
      } as never,
    ]);
    expect(f!.linkedWorks[0]!.relation).toBeUndefined();
  });

  /* Of a card from before the log we know only one thing: it was seen on
     such a day, and rated so. Writing that down is truer than leaving a
     counter at zero under a film that carries a screening date. */
  it("builds a first screening from the date already known", () => {
    const [f] = migrate([{ id: "x", title: "Stalker", rating: 4, watchedAt: "2019-03-02" }]);
    expect(f!.watches).toEqual([{ date: "2019-03-02", rating: 4 }]);
  });

  it("invents no screening for a film that was never dated", () => {
    expect(migrate([{ id: "x", title: "Stalker" }])[0]!.watches).toEqual([]);
  });

  /* THE TEST THAT GUARDS AGAINST RESURRECTION. A log emptied by hand is
     an EMPTY array, not a missing field: confusing the two would fill it
     again on the next load — and `migrate` writes straight back to
     storage, so the screening would come back for good. */
  it("leaves empty a log that was emptied, even if the date remains", () => {
    const emptied = { id: "x", title: "Stalker", rating: 4, watchedAt: "2019-03-02", watches: [] };
    expect(migrate([emptied])[0]!.watches).toEqual([]);
    expect(migrate(migrate([emptied]))[0]!.watches).toEqual([]);
  });

  it("files the log from the most recent to the oldest", () => {
    const [f] = migrate([
      {
        id: "x",
        title: "Stalker",
        watches: [
          { date: "2019-03-02", rating: 4 },
          { date: "2024-01-01", rating: 5 },
        ],
      },
    ]);
    expect(f!.watches.map((w) => w.date)).toEqual(["2024-01-01", "2019-03-02"]);
  });
});

describe("motifs, on a card from before", () => {
  it("come up empty without erasing anything else", () => {
    const [f] = migrate([{ title: "Playtime", themes: ["ville"] }]);
    expect(f?.motifs).toEqual([]);
    expect(f?.themes).toEqual(["ville"]);
  });

  it("do not rewrite those already set", () => {
    const [f] = migrate([{ title: "x", motifs: ["hero-dies"] }]);
    expect(f?.motifs).toEqual(["hero-dies"]);
  });

  /* ============================================================
     THE MOTIF IDENTIFIERS CHANGED LANGUAGE

     This is the riskiest migration of the whole translation: sixty-nine
     identifiers, written on every card in the binder, and nothing in the
     data says which spelling they belong to. `migrate` is the only door —
     so the proof is made here.
     ============================================================ */
  it("translates the identifiers written before the switch", () => {
    const [f] = migrate([{ title: "x", motifs: ["heros-meurt", "melancolie"] } as never]);
    expect(f?.motifs).toEqual(["hero-dies", "melancholy"]);
  });

  it("lets through a motif the catalogue does not know", () => {
    /* Same rule as on display: an unknown motif is ignored, never erased
       from the card. A motif YOU created carries an identifier taken from
       its label, and has no business in the table of old spellings. */
    const [f] = migrate([{ title: "x", motifs: ["il-pleut-sans-arret"] } as never]);
    expect(f?.motifs).toEqual(["il-pleut-sans-arret"]);
  });

  it("creates no duplicate when both spellings live side by side", () => {
    /* A card synchronised between a migrated device and one that is not
       yet can carry both. They designate the same motif: the card keeps
       only one. */
    const [f] = migrate([{ title: "x", motifs: ["heros-meurt", "hero-dies"] } as never]);
    expect(f?.motifs).toEqual(["hero-dies"]);
  });

  it("does not choke on a `motifs` field that is not a list", () => {
    const [f] = migrate([{ title: "x", motifs: "melancolie" } as never]);
    expect(f?.motifs).toEqual([]);
  });
});

describe("the screening log", () => {
  const w = (date: string, rating: number | null = null) => ({ date, rating });

  /* The date is the key, and that is what makes a re-import harmless:
     running the same diary.csv through three times does not make a film
     seen nine times. */
  it("counts only one screening per date", () => {
    expect(mergeWatches([w("2024-01-01", 4)], [w("2024-01-01", 4)])).toHaveLength(1);
  });

  it("completes a screening without erasing a rating already known", () => {
    expect(mergeWatches([w("2024-01-01", 4)], [w("2024-01-01", null)])).toEqual([
      { date: "2024-01-01", rating: 4 },
    ]);
  });

  it("lets a more recent rating correct the previous one", () => {
    expect(mergeWatches([w("2024-01-01", 4)], [w("2024-01-01", 5)])).toEqual([
      { date: "2024-01-01", rating: 5 },
    ]);
  });

  /* `watchedAt` is no longer the truth but the log's reflection: the two
     cannot drift apart since they are only ever written together. */
  it("realigns the last-screening date with the log", () => {
    const f = withWatches(makeFilm({ watchedAt: "1999-01-01" }), [
      w("2019-03-02", 4),
      w("2024-01-01", 5),
    ]);
    expect(f.watchedAt).toBe("2024-01-01");
    expect(watchCount(f)).toBe(2);
  });

  it("returns the date to null when the last screening is removed", () => {
    expect(withWatches(makeFilm({ watchedAt: "2024-01-01" }), []).watchedAt).toBeNull();
  });

  it("rules out a screening with no date, which is not a screening", () => {
    expect(mergeWatches([{ date: "", rating: 4 }])).toEqual([]);
  });
});

describe("how the rating varies from one screening to the next", () => {
  it("measures the gap with the time before", () => {
    expect(
      ratingDrift([
        { date: "2024-01-01", rating: 5 },
        { date: "2019-03-02", rating: 3.5 },
      ])
    ).toEqual([1.5, null]);
  });

  /* An unrated screening has nothing to say: it does not break the
     chain, we compare against the last time we gave a verdict. */
  it("steps over a screening that was not rated", () => {
    expect(
      ratingDrift([
        { date: "2024-01-01", rating: 5 },
        { date: "2022-01-01", rating: null },
        { date: "2019-03-02", rating: 4 },
      ])
    ).toEqual([1, null, null]);
  });

  it("brings the year back to a number", () => {
    // sorting by year was doing arithmetic on strings that came out of the CSV
    expect(migrate([{ title: "a", year: "1979" as unknown as number }])[0]!.year).toBe(1979);
  });

  it("keeps the year empty when it is unknown", () => {
    expect(migrate([{ title: "a", year: "" }])[0]!.year).toBe("");
    expect(migrate([{ title: "a", year: null as unknown as number }])[0]!.year).toBe("");
    // an unreadable year must not become NaN
    expect(migrate([{ title: "a", year: "s.d." as unknown as number }])[0]!.year).toBe("");
  });

  it("knows only two statuses", () => {
    expect(migrate([{ title: "a", status: "watchlist" }])[0]!.status).toBe("watchlist");
    expect(
      migrate([{ title: "a", status: "n'importe quoi" as unknown as "watched" }])[0]!.status
    ).toBe("watched");
  });

  it("preserves an arrangement already made by hand", () => {
    expect(migrate([{ title: "a", order: 0 }])[0]!.order).toBe(0);
    expect(migrate([{ title: "a", order: 7 }])[0]!.order).toBe(7);
  });

  it("accepts a missing collection", () => {
    expect(migrate(null)).toEqual([]);
    expect(migrate(undefined)).toEqual([]);
  });
});

describe("editLinkedWork", () => {
  const work = (over: Partial<LinkedWork> = {}): LinkedWork => ({
    id: "w1",
    type: "book",
    title: "Lol V. Stein",
    creator: "Duras",
    note: "le même vide",
    ...over,
  });

  /* A card's first thread. The `!` is deliberate: every test case sets
     one, and an absence must break the test rather than be worked around
     by a question mark that would silence it. */
  const worksOf = (films: Film[], id: string) => films.find((f) => f.id === id)!.linkedWorks;
  const firstOf = (films: Film[], id: string) => worksOf(films, id)[0]!;

  /* A free mention: nothing contradicts it elsewhere, so it is written
     entirely by hand. */
  describe("a free mention", () => {
    const base = () => [makeFilm({ id: "a", linkedWorks: [work()] })];

    it("rewrites everything it is given", () => {
      const out = editLinkedWork(base(), "a", "w1", {
        type: "film",
        title: "Hiroshima mon amour",
        creator: "Resnais",
        note: "la mémoire trouée",
      });
      expect(firstOf(out, "a")).toMatchObject({
        id: "w1",
        type: "film",
        title: "Hiroshima mon amour",
        creator: "Resnais",
        note: "la mémoire trouée",
      });
    });

    it("keeps what the patch does not mention", () => {
      const out = editLinkedWork(base(), "a", "w1", { note: "autrement" });
      expect(firstOf(out, "a")).toMatchObject({
        title: "Lol V. Stein",
        creator: "Duras",
        type: "book",
        note: "autrement",
      });
    });

    it("trims the whitespace", () => {
      const out = editLinkedWork(base(), "a", "w1", { title: "  Le Vice-consul  ", note: "  x  " });
      expect(firstOf(out, "a")).toMatchObject({ title: "Le Vice-consul", note: "x" });
    });

    it("refuses to empty it of its title — a thread with no title has nothing left to say", () => {
      const films = base();
      expect(editLinkedWork(films, "a", "w1", { title: "   " })).toBe(films);
    });
  });

  /* A cross-reference to a card on the wall: its title belongs to the
     card opposite, its note belongs to the link. */
  describe("a reciprocal cross-reference", () => {
    const base = () => [
      makeFilm({
        id: "a",
        linkedWorks: [work({ id: "wa", type: "film", filmId: "b", pairId: "p", title: "B" })],
      }),
      makeFilm({
        id: "b",
        linkedWorks: [work({ id: "wb", type: "film", filmId: "a", pairId: "p", title: "A" })],
      }),
    ];

    it("carries the note to both ends of the thread", () => {
      const out = editLinkedWork(base(), "a", "wa", { note: "deux regards sur un musée" });
      expect(firstOf(out, "a").note).toBe("deux regards sur un musée");
      expect(firstOf(out, "b").note).toBe("deux regards sur un musée");
    });

    it("ignores title, author and type: they belong to the card opposite", () => {
      const out = editLinkedWork(base(), "a", "wa", {
        title: "MENSONGE",
        creator: "MENSONGE",
        type: "book",
        note: "n",
      });
      expect(firstOf(out, "a")).toMatchObject({ title: "B", creator: "Duras", type: "film" });
      // and the half opposite keeps its own, which was never in question
      expect(firstOf(out, "b")).toMatchObject({ title: "A", type: "film", note: "n" });
    });

    /* The relation belongs to the link, like the note — but it FLIPS
       from one end to the other. Writing the same one on both sides would
       dire à chaque film qu'il est la suite de l'autre, ce qui ne se voit
       qu'en ouvrant la seconde fiche. */
    it("flips the relation on the half opposite", () => {
      const out = editLinkedWork(base(), "a", "wa", { relation: "sequel-to", force: 3 });
      expect(firstOf(out, "a")).toMatchObject({ relation: "sequel-to", force: 3 });
      expect(firstOf(out, "b")).toMatchObject({ relation: "precedes", force: 3 });
    });

    it("keeps a symmetric relation as it is", () => {
      const out = editLinkedWork(base(), "a", "wa", { relation: "diptych" });
      expect(firstOf(out, "b").relation).toBe("diptych");
    });

    it("does not touch the threads of other cards", () => {
      const films = [...base(), makeFilm({ id: "c", linkedWorks: [work({ id: "wc" })] })];
      const out = editLinkedWork(films, "a", "wa", { note: "n" });
      expect(firstOf(out, "c").note).toBe("le même vide");
    });

    /* An orphaned half — the card opposite deleted outside this path —
       must not stop us annotating the one that remains. */
    it("still annotates when the card opposite has vanished", () => {
      const seul = [
        makeFilm({
          id: "a",
          linkedWorks: [work({ id: "wa", type: "film", filmId: "disparu", pairId: "p" })],
        }),
      ];
      expect(firstOf(editLinkedWork(seul, "a", "wa", { note: "n" }), "a").note).toBe("n");
    });
  });

  it("leaves the collection intact when the thread does not exist", () => {
    const films = [makeFilm({ id: "a", linkedWorks: [work()] })];
    expect(editLinkedWork(films, "a", "inconnu", { note: "n" })).toBe(films);
    expect(editLinkedWork(films, "inconnu", "w1", { note: "n" })).toBe(films);
  });
});
