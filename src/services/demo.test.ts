/* ============================================================
   THE EXAMPLE BINDER KEEPS ITS PROMISE

   These twelve films exist only to give the guided tour something to
   show. The one fault one can commit against them is therefore to forget
   one of the landmarks they filled — and that fault does not show on a
   reading: it shows seven hundred milliseconds of opaque veil later, at
   the home of somebody opening the application for the first time.

   Each test below names the tour step it protects.
   ============================================================ */
import { describe, it, expect } from "vitest";
import i18n from "../i18n";
import { DEMO_PREFIX, binderStillDemo, isDemo, demoFilms, demoNotes, withoutDemo } from "./demo";

/* The example reads in the reader's language now; `setupTests` pins the
   suite to French, which is what these assertions were written against. */
const say = i18n.t.bind(i18n);
import { MOTIFS } from "../domain/motifs";
import { makeFilm } from "../domain/film";

const films = demoFilms(say);

describe("the demonstration binder", () => {
  it("counts a dozen cards", () => {
    expect(films.length).toBeGreaterThanOrEqual(10);
  });

  it("is known by its prefix, and nothing else", () => {
    expect(films.every(isDemo)).toBe(true);
    expect(isDemo(makeFilm({ title: "à moi" }))).toBe(false);
  });

  it("returns fresh cards on every call", () => {
    expect(demoFilms(say)[0]).not.toBe(films[0]);
  });

  it("has no identifier twice", () => {
    expect(new Set(films.map((f) => f.id)).size).toBe(films.length);
  });
});

describe("it covers what the tour shows", () => {
  /* Step "Ce qui attend": with no card set aside, the "À voir" tab
     opens an empty wall and the bubble circles nothing. */
  it("has at least one film set aside", () => {
    expect(films.filter((f) => f.status === "watchlist").length).toBeGreaterThan(0);
  });

  /* Step "Une fiche s'ouvre": there must be a crowd on BOTH walls. */
  it("has films seen too", () => {
    expect(films.filter((f) => f.status === "watched").length).toBeGreaterThan(5);
  });

  /* Step "Le fil rouge", and the whole constellation. */
  it("runs threads between its cards, both ways", () => {
    const pairs = films.flatMap((f) =>
      (f.linkedWorks || []).filter((w) => w.pairId).map((w) => w.pairId!)
    );
    expect(pairs.length).toBeGreaterThan(0);
    /* A thread is written on both sides: each `pairId` appears twice. */
    for (const p of new Set(pairs)) expect(pairs.filter((x) => x === p)).toHaveLength(2);
  });

  it("links a work that is not a film", () => {
    const outside = films.flatMap((f) => (f.linkedWorks || []).filter((w) => w.type !== "film"));
    expect(outside.length).toBeGreaterThan(0);
  });

  /* The two ends of a thread must point at each other, failing which
     the constellation draws edges leading nowhere. */
  it("never points at a card that is not there", () => {
    const ids = new Set(films.map((f) => f.id));
    for (const f of films)
      for (const w of f.linkedWorks || []) if (w.filmId) expect(ids.has(w.filmId)).toBe(true);
  });

  /* Step "Mots-clés et motifs": a pattern unknown to the catalogue is
     ignored when displaying, hence invisible — and the step shows
     emptiness. */
  it("lays motifs that really exist in the catalogue", () => {
    const known = new Set(MOTIFS.map((m) => m.id));
    const placed = films.flatMap((f) => f.motifs);
    expect(placed.length).toBeGreaterThan(5);
    for (const m of placed) expect(known.has(m), `motif inconnu : ${m}`).toBe(true);
  });

  /* Step "L'almanach": a single year does not make a vintage, and
     "TOUJOURS" would have nothing to compare. */
  it("has screenings across at least three years", () => {
    const years = new Set(films.flatMap((f) => f.watches.map((w) => w.date.slice(0, 4))));
    expect(years.size).toBeGreaterThanOrEqual(3);
  });

  it("has a rewatched film, so the log has something to say", () => {
    expect(films.some((f) => f.watches.length > 1)).toBe(true);
  });

  /* `watchedAt` is the reflection of `watches`: letting them diverge
     would make the library's sort lie from the first opening. */
  it("agrees watchedAt with the most recent screening", () => {
    for (const f of films) expect(f.watchedAt).toBe(f.watches[0]?.date ?? null);
  });

  /* Step "Dans le sillage" and the constellation's kinships: they hold
     on to the people in the credits, and not only to the film-makers. */
  it("has a cinematographer and a composer", () => {
    expect(films.some((f) => (f.crew.image || []).length)).toBe(true);
    expect(films.some((f) => (f.crew.musique || []).length)).toBe(true);
  });

  it("brings at least one name back, or nothing draws near", () => {
    const count = (names: string[]) => {
      const n = new Map<string, number>();
      for (const x of names) n.set(x, (n.get(x) || 0) + 1);
      return [...n.values()];
    };
    expect(Math.max(...count(films.map((f) => f.director)))).toBeGreaterThan(1);
    expect(Math.max(...count(films.flatMap((f) => f.crew.image || [])))).toBeGreaterThan(1);
  });

  /* Step "La fiche catalogue": it shows what TMDB brings back. */
  it("fills in the catalogue of the cards seen", () => {
    for (const f of films.filter((x) => x.status === "watched")) {
      expect(f.runtime, f.title).toBeGreaterThan(0);
      expect(f.cast.length, f.title).toBeGreaterThan(0);
      expect(f.genres.length, f.title).toBeGreaterThan(0);
      expect((f.keywords || []).length, f.title).toBeGreaterThan(0);
      expect(f.countries.length, f.title).toBeGreaterThan(0);
      expect(f.language, f.title).not.toBe("");
      expect(f.tmdbRating, f.title).toBeGreaterThan(0);
    }
  });

  /* Step "Vos mots", and the gap to the almanac's public rating. */
  it("carries ratings and reviews", () => {
    const seenFilms = films.filter((f) => f.status === "watched");
    expect(seenFilms.every((f) => f.rating > 0)).toBe(true);
    expect(seenFilms.every((f) => f.review.trim() !== "")).toBe(true);
    expect(seenFilms.some((f) => f.notes.trim() !== "")).toBe(true);
  });

  /* RATINGS ARE OUT OF FIVE, AND NOTHING IN THE TYPE SAYS SO.
     `Film.rating` is a bare `number`; it is `InkStars`, the almanac's
     histogram (eleven bins, 0 to 5) and `écartAuPublic` — which doubles
     the rating to compare it with TMDB — that carry the scale. A rating
     of 9 therefore passed every check, and came out as "vous : 17,8 sur
     10" on the board of gaps. Half a point is the finest step the star
     knows how to lay. */
  it("rates out of five, in half points", () => {
    for (const f of films) {
      expect(f.rating, f.title).toBeLessThanOrEqual(5);
      expect((f.rating * 2) % 1, f.title).toBe(0);
      for (const w of f.watches) {
        if (w.rating == null) continue;
        expect(w.rating, `${f.title} — ${w.date}`).toBeLessThanOrEqual(5);
        expect((w.rating * 2) % 1, `${f.title} — ${w.date}`).toBe(0);
      }
    }
  });

  /* NO POSTERS, AND IT IS DELIBERATE: a dead address would give twelve
     broken rectangles where the application draws a tinted emulsion. The
     test is there so that nobody pastes "just one" later without
     wondering what becomes of it offline. */
  it("depends on no remote image", () => {
    for (const f of films) expect(f.poster, f.title).toBe("");
  });
});

describe("the demonstration notebook", () => {
  it("has one page, prefixed like the rest", () => {
    const notes = demoNotes(say);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.id.startsWith(DEMO_PREFIX))).toBe(true);
  });
});

describe("it is taken away in one gesture", () => {
  it("recognises a binder that is nothing but the example", () => {
    expect(binderStillDemo(films)).toBe(true);
  });

  it("stays quiet as soon as one card is yours", () => {
    expect(binderStillDemo([...films, makeFilm({ title: "à moi" })])).toBe(false);
  });

  it("stays quiet on an empty binder too", () => {
    expect(binderStillDemo([])).toBe(false);
  });

  it("leaves nothing behind it", () => {
    expect(withoutDemo(films)).toHaveLength(0);
  });

  it("does not touch what is not the example", () => {
    const mine = makeFilm({ title: "à moi" });
    expect(withoutDemo([...films, mine])).toEqual([mine]);
  });
});
