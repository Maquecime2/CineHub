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
import { DEMO_PREFIX, binderStillDemo, isDemo, demoFilms, demoNotes, withoutDemo } from "./demo";
import { MOTIFS } from "../domain/motifs";
import { makeFilm } from "../domain/film";

const films = demoFilms();

describe("le classeur de démonstration", () => {
  it("compte une douzaine de fiches", () => {
    expect(films.length).toBeGreaterThanOrEqual(10);
  });

  it("se reconnaît à son préfixe, et rien d'autre", () => {
    expect(films.every(isDemo)).toBe(true);
    expect(isDemo(makeFilm({ title: "à moi" }))).toBe(false);
  });

  it("rend des fiches neuves à chaque appel", () => {
    expect(demoFilms()[0]).not.toBe(films[0]);
  });

  it("n'a pas deux fois le même identifiant", () => {
    expect(new Set(films.map((f) => f.id)).size).toBe(films.length);
  });
});

describe("il couvre ce que la visite montre", () => {
  /* Step "Ce qui attend": with no card set aside, the "À voir" tab
     opens an empty wall and the bubble circles nothing. */
  it("a au moins un film mis de côté", () => {
    expect(films.filter((f) => f.status === "watchlist").length).toBeGreaterThan(0);
  });

  /* Step "Une fiche s'ouvre": there must be a crowd on BOTH walls. */
  it("a aussi des films vus", () => {
    expect(films.filter((f) => f.status === "watched").length).toBeGreaterThan(5);
  });

  /* Step "Le fil rouge", and the whole constellation. */
  it("tend des fils entre ses fiches, dans les deux sens", () => {
    const paires = films.flatMap((f) =>
      (f.linkedWorks || []).filter((w) => w.pairId).map((w) => w.pairId!)
    );
    expect(paires.length).toBeGreaterThan(0);
    /* A thread is written on both sides: each `pairId` appears twice. */
    for (const p of new Set(paires)) expect(paires.filter((x) => x === p)).toHaveLength(2);
  });

  it("relie une œuvre qui n'est pas un film", () => {
    const hors = films.flatMap((f) => (f.linkedWorks || []).filter((w) => w.type !== "film"));
    expect(hors.length).toBeGreaterThan(0);
  });

  /* The two ends of a thread must point at each other, failing which
     the constellation draws edges leading nowhere. */
  it("ne renvoie jamais vers une fiche absente", () => {
    const ids = new Set(films.map((f) => f.id));
    for (const f of films)
      for (const w of f.linkedWorks || []) if (w.filmId) expect(ids.has(w.filmId)).toBe(true);
  });

  /* Step "Mots-clés et motifs": a pattern unknown to the catalogue is
     ignored when displaying, hence invisible — and the step shows
     emptiness. */
  it("pose des motifs qui existent vraiment au catalogue", () => {
    const connus = new Set(MOTIFS.map((m) => m.id));
    const placed = films.flatMap((f) => f.motifs);
    expect(placed.length).toBeGreaterThan(5);
    for (const m of placed) expect(connus.has(m), `motif inconnu : ${m}`).toBe(true);
  });

  /* Step "L'almanach": a single year does not make a vintage, and
     "TOUJOURS" would have nothing to compare. */
  it("a des séances sur au moins trois années", () => {
    const years = new Set(films.flatMap((f) => f.watches.map((w) => w.date.slice(0, 4))));
    expect(years.size).toBeGreaterThanOrEqual(3);
  });

  it("a un film revu, pour que le journal ait quelque chose à dire", () => {
    expect(films.some((f) => f.watches.length > 1)).toBe(true);
  });

  /* `watchedAt` is the reflection of `watches`: letting them diverge
     would make the library's sort lie from the first opening. */
  it("accorde watchedAt avec la séance la plus récente", () => {
    for (const f of films) expect(f.watchedAt).toBe(f.watches[0]?.date ?? null);
  });

  /* Step "Dans le sillage" and the constellation's kinships: they hold
     on to the people in the credits, and not only to the film-makers. */
  it("a un chef opérateur et un compositeur", () => {
    expect(films.some((f) => (f.crew.image || []).length)).toBe(true);
    expect(films.some((f) => (f.crew.musique || []).length)).toBe(true);
  });

  it("fait revenir au moins un nom, sinon rien ne se rapproche", () => {
    const compte = (names: string[]) => {
      const n = new Map<string, number>();
      for (const x of names) n.set(x, (n.get(x) || 0) + 1);
      return [...n.values()];
    };
    expect(Math.max(...compte(films.map((f) => f.director)))).toBeGreaterThan(1);
    expect(Math.max(...compte(films.flatMap((f) => f.crew.image || [])))).toBeGreaterThan(1);
  });

  /* Step "La fiche catalogue": it shows what TMDB brings back. */
  it("remplit le catalogue des fiches vues", () => {
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
  it("porte des notes et des critiques", () => {
    const vus = films.filter((f) => f.status === "watched");
    expect(vus.every((f) => f.rating > 0)).toBe(true);
    expect(vus.every((f) => f.review.trim() !== "")).toBe(true);
    expect(vus.some((f) => f.notes.trim() !== "")).toBe(true);
  });

  /* RATINGS ARE OUT OF FIVE, AND NOTHING IN THE TYPE SAYS SO.
     `Film.rating` is a bare `number`; it is `InkStars`, the almanac's
     histogram (eleven bins, 0 to 5) and `écartAuPublic` — which doubles
     the rating to compare it with TMDB — that carry the scale. A rating
     of 9 therefore passed every check, and came out as "vous : 17,8 sur
     10" on the board of gaps. Half a point is the finest step the star
     knows how to lay. */
  it("note sur cinq, par demi-points", () => {
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
  it("ne dépend d'aucune image distante", () => {
    for (const f of films) expect(f.poster, f.title).toBe("");
  });
});

describe("le carnet de démonstration", () => {
  it("a une page, préfixée comme le reste", () => {
    const notes = demoNotes();
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.id.startsWith(DEMO_PREFIX))).toBe(true);
  });
});

describe("il se retire d'un geste", () => {
  it("reconnaît un classeur qui n'est que l'exemple", () => {
    expect(binderStillDemo(films)).toBe(true);
  });

  it("se tait dès qu'une fiche est à vous", () => {
    expect(binderStillDemo([...films, makeFilm({ title: "à moi" })])).toBe(false);
  });

  it("se tait aussi sur un classeur vide", () => {
    expect(binderStillDemo([])).toBe(false);
  });

  it("ne laisse rien derrière lui", () => {
    expect(withoutDemo(films)).toHaveLength(0);
  });

  it("ne touche pas à ce qui n'est pas l'exemple", () => {
    const mien = makeFilm({ title: "à moi" });
    expect(withoutDemo([...films, mien])).toEqual([mien]);
  });
});
