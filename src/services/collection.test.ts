import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   THE STORE, TESTED ON ITS THREE PROMISES

   Going down into the vault without losing anything, dating what has
   changed and nothing else, and never abandoning the collection when the
   vault refuses. None of the three shows on screen, and all three would
   cost dearly.

   jsdom has no IndexedDB: we stub `src/db`, which has the advantage of
   letting us then make it fail at will — a browser's private mode cannot
   be simulated otherwise.
   ============================================================ */

const coffre = new Map<string, unknown>();
let refuse = false;

vi.mock("../db", () => ({
  getDoc: async (k: string) => {
    if (refuse) throw new Error("coffre ferme");
    return coffre.get(k);
  },
  putDoc: async (k: string, v: unknown) => {
    if (refuse) throw new Error("coffre ferme");
    coffre.set(k, v);
  },
}));

const { loadFilms, saveFilms, forgetCache, knownGraves, FILMS_KEY } = await import("./collection");
const { makeFilm } = await import("../domain/film");

const card = (p: Record<string, unknown> = {}) => makeFilm({ title: "Playtime", ...p });

beforeEach(() => {
  coffre.clear();
  refuse = false;
  localStorage.clear();
  forgetCache([]);
});

afterEach(() => {
  localStorage.clear();
});

describe("the move into the vault", () => {
  it("moves down into the vault what it finds above, and frees the room", async () => {
    const before = [card({ id: "a", title: "Stalker" })];
    localStorage.setItem(FILMS_KEY, JSON.stringify(before));

    const loaded = await loadFilms();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.title).toBe("Stalker");
    expect(coffre.get(FILMS_KEY)).toHaveLength(1);
    /* The copy up top was taking the missing room: it leaves once — and
       only once — the vault has taken. */
    expect(localStorage.getItem(FILMS_KEY)).toBeNull();
  });

  it("reads the vault first: the copy above is a ghost", async () => {
    coffre.set(FILMS_KEY, [card({ id: "a", title: "Le Trou" })]);
    localStorage.setItem(FILMS_KEY, JSON.stringify([card({ id: "z", title: "effacé hier" })]));

    const loaded = await loadFilms();
    expect(loaded.map((f) => f.title)).toEqual(["Le Trou"]);
  });

  it("an empty binder sets off no write", async () => {
    expect(await loadFilms()).toEqual([]);
    expect(coffre.has(FILMS_KEY)).toBe(false);
  });
});

describe("the modification date", () => {
  it("moves only on the card that has changed", async () => {
    const a = card({ id: "a", updatedAt: 1000 });
    const b = card({ id: "b", updatedAt: 1000 });
    forgetCache([a, b]);

    const dated = await saveFilms([{ ...a, rating: 5 }, b]);
    expect(dated[0]!.updatedAt).toBeGreaterThan(1000);
    expect(dated[1]!.updatedAt).toBe(1000);
    /* Better: the untouched card is the SAME object, failing which
       every memoised view would rebuild itself on each keystroke. */
    expect(dated[1]).toBe(b);
  });

  it("a rewrite with no change of value dates nothing", async () => {
    const a = card({ id: "a", updatedAt: 1000 });
    forgetCache([a]);
    /* What the whole application does: `films.map(f => ({...f}))`. */
    const dated = await saveFilms([{ ...a }]);
    expect(dated[0]!.updatedAt).toBe(1000);
  });

  it("a fresh card carries its date from the first write", async () => {
    forgetCache([]);
    const dated = await saveFilms([card({ id: "neuf", updatedAt: 0 })]);
    expect(dated[0]!.updatedAt).toBeGreaterThan(0);
  });

  it("cards from before keep their added date, and do not call themselves fresh", async () => {
    /* Otherwise, at the first synchronisation, the WHOLE collection
       would claim to have been modified just now and would crush
       whatever comes from the other side. */
    localStorage.setItem(
      FILMS_KEY,
      JSON.stringify([{ id: "vieux", title: "Persona", addedAt: 42 }])
    );
    const loaded = await loadFilms();
    expect(loaded[0]!.updatedAt).toBe(42);
  });
});

describe("when the vault refuses", () => {
  it("the collection stays written, above, rather than lost", async () => {
    refuse = true;
    forgetCache([]);
    await saveFilms([card({ id: "a", title: "Yi Yi" })]);
    const written = JSON.parse(localStorage.getItem(FILMS_KEY) || "[]");
    expect(written).toHaveLength(1);
    expect(written[0].title).toBe("Yi Yi");
  });

  it("and loads again from where it was written", async () => {
    refuse = true;
    forgetCache([]);
    await saveFilms([card({ id: "a", title: "Cléo" })]);
    forgetCache([]);
    const loaded = await loadFilms();
    expect(loaded.map((f) => f.title)).toEqual(["Cléo"]);
  });
});

/* ============================================================
   TOMBSTONES WRITTEN BEFORE THE TRANSLATION

   `Grave.le` became `Grave.at`, and a tombstone is written to disk.
   Reading only the new spelling would drop every one of them — and each
   of those deleted cards would come back on the first pull from a device
   that still has it. That is precisely the hole tombstones exist to
   plug.
   ============================================================ */
describe("tombstones written before the translation", () => {
  it("reads back a stone written with `le`", async () => {
    localStorage.setItem("films-effaces", JSON.stringify([{ id: "parti", le: 1234 }]));
    await loadFilms();
    expect(knownGraves()).toEqual([{ id: "parti", at: 1234 }]);
  });

  it("reads back a stone already written with `at`", async () => {
    localStorage.setItem("films-effaces", JSON.stringify([{ id: "parti", at: 99 }]));
    await loadFilms();
    expect(knownGraves()).toEqual([{ id: "parti", at: 99 }]);
  });

  it("drops a stone with no readable date rather than keeping it mute", async () => {
    localStorage.setItem(
      "films-effaces",
      JSON.stringify([{ id: "bancal" }, { le: 5 }, { id: "bon", le: 7 }])
    );
    await loadFilms();
    expect(knownGraves()).toEqual([{ id: "bon", at: 7 }]);
  });

  it("survives a store that does not hold a list", async () => {
    localStorage.setItem("films-effaces", JSON.stringify({ step: "une liste" }));
    await loadFilms();
    expect(knownGraves()).toEqual([]);
  });
});
