import { describe, it, expect } from "vitest";
import { mergeRemote, toSend, type RemoteCard } from "./merge";
import { makeFilm } from "./film";
import type { Film } from "../types";

/* Merging is the only place in the project where a mistake ERASES
   something somebody wrote. So it is tested on the cases that lose
   things: the stale version coming back, the late deletion, and the
   screening known on one side only. */

const card = (p: Partial<Film> = {}): Film =>
  makeFilm({ id: "f1", title: "Playtime", updatedAt: 1000, ...p });

const incoming = (p: Partial<RemoteCard> = {}): RemoteCard => ({
  id: "f1",
  updatedAt: 2000,
  data: { title: "Playtime" },
  ...p,
});

describe("who wins", () => {
  it("the most recent version, and that is the whole arbitration", () => {
    const { films, tally } = mergeRemote(
      [card({ title: "ici", updatedAt: 1000 })],
      [incoming({ updatedAt: 2000, data: { title: "là-bas" } })]
    );
    expect(films[0]!.title).toBe("là-bas");
    expect(films[0]!.updatedAt).toBe(2000);
    expect(tally.replaced).toBe(1);
  });

  it("an older version does not travel back in time", () => {
    const { films, tally } = mergeRemote(
      [card({ title: "ici", updatedAt: 5000 })],
      [incoming({ updatedAt: 1000, data: { title: "vieux" } })]
    );
    expect(films[0]!.title).toBe("ici");
    expect(tally.kept).toBe(1);
  });

  it("on a strict tie, we touch nothing", () => {
    /* Two clocks never agree: doing nothing is the only arbitration that
       surprises nobody. */
    const local = card({ title: "ici", updatedAt: 3000 });
    const { films } = mergeRemote(
      [local],
      [incoming({ updatedAt: 3000, data: { title: "là-bas" } })]
    );
    expect(films[0]!.title).toBe("ici");
  });

  it("an unknown card comes in with the server's date", () => {
    /* Without that date, the next comparison would think it fresher than
       everything and send it back to the server for nothing. */
    const { films, tally } = mergeRemote([], [incoming({ id: "neuve", updatedAt: 7000 })]);
    expect(films[0]!.updatedAt).toBe(7000);
    expect(tally.added).toBe(1);
  });

  it("what has not moved stays the same object", () => {
    /* The views are memoised on identity: copying everything would redo
       the whole shelf on every synchronisation. */
    const untouched = card({ id: "autre", updatedAt: 9000 });
    const { films } = mergeRemote([untouched, card()], [incoming({ updatedAt: 2000 })]);
    expect(films.find((f) => f.id === "autre")).toBe(untouched);
  });
});

describe("the screenings add up", () => {
  it("an evening known on one side only is not erased by the other", () => {
    const local = card({
      updatedAt: 5000,
      watches: [{ date: "2024-01-01", rating: 4 }],
    });
    const { films } = mergeRemote(
      [local],
      [
        incoming({
          updatedAt: 9000,
          data: { title: "Playtime", watches: [{ date: "2024-06-15", rating: 5 }] },
        }),
      ]
    );
    expect(films[0]!.watches.map((w) => w.date)).toEqual(["2024-06-15", "2024-01-01"]);
    expect(films[0]!.watchedAt).toBe("2024-06-15");
  });

  it("even when it is the local version that wins", () => {
    /* A screening is a FACT, not an opinion: it comes in even if the rest
       of the card does not change. */
    const local = card({ updatedAt: 9000, watches: [{ date: "2024-01-01", rating: 4 }] });
    const { films, tally } = mergeRemote(
      [local],
      [incoming({ updatedAt: 1000, data: { watches: [{ date: "2023-05-05", rating: 3 }] } })]
    );
    expect(films[0]!.watches.map((w) => w.date)).toEqual(["2024-01-01", "2023-05-05"]);
    expect(tally.kept).toBe(1);
  });
});

describe("the deletions", () => {
  it("a card deleted elsewhere goes away", () => {
    const { films, tally } = mergeRemote(
      [card({ updatedAt: 1000 })],
      [incoming({ updatedAt: 2000, deleted: true })]
    );
    expect(films).toHaveLength(0);
    expect(tally.removed).toBe(1);
  });

  it("a late deletion does not carry off what we have just written", () => {
    const { films, tally } = mergeRemote(
      [card({ title: "note de ce matin", updatedAt: 8000 })],
      [incoming({ updatedAt: 2000, deleted: true })]
    );
    expect(films).toHaveLength(1);
    expect(films[0]!.title).toBe("note de ce matin");
    expect(tally.kept).toBe(1);
  });

  it("deleting a card we never had does nothing", () => {
    const { films, tally } = mergeRemote([], [incoming({ id: "jamais-vue", deleted: true })]);
    expect(films).toEqual([]);
    expect(tally.removed).toBe(0);
  });
});

describe("what is left to send", () => {
  it("the cards modified here, and those only", () => {
    const sends = toSend([card({ id: "intacte" }), card({ id: "touchee" })], [], ["touchee"]);
    expect(sends.map((e) => e.id)).toEqual(["touchee"]);
  });

  it("the tombstones go out with them", () => {
    /* Without them, a card deleted here comes back on the next pull. */
    const sends = toSend([], [{ id: "partie", at: 4000 }], ["partie"]);
    expect(sends).toEqual([
      { id: "partie", tmdbId: null, updatedAt: 4000, deleted: true, data: {} },
    ]);
  });

  it("nothing to say when nothing has moved", () => {
    expect(toSend([card()], [{ id: "x", at: 500 }], [])).toEqual([]);
  });
});
