import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* No network and no TMDB quota in a test: what is at stake here is the
   CACHE and the failure, not Wikidata's knowledge. `searchPerson` is
   doubled because it is the hinge — a name in, an id out — and its own
   correctness is tried where it lives. */
const searchPerson = vi.fn();
vi.mock("../tmdb", () => ({
  searchPerson: (...args: unknown[]) => searchPerson(...args),
  pooled: async (tasks: (() => Promise<unknown>)[]) => {
    const out = [];
    for (const task of tasks) {
      try {
        out.push(await task());
      } catch {
        out.push(null);
      }
    }
    return out;
  },
}));

const { hintsFor, forgetHints } = await import("./lineageHints");

const link = (seed: string, from: string, prop: string, to: string) => ({ seed, from, to, prop });

let fetched: string[];

beforeEach(() => {
  localStorage.clear();
  fetched = [];
  searchPerson.mockReset();
  searchPerson.mockImplementation(async (name: string) =>
    name === "Inconnu" ? null : { id: name.length, name }
  );
});

afterEach(() => vi.unstubAllGlobals());

const relay = (links: unknown[]) =>
  vi.stubGlobal("fetch", async (url: string) => {
    fetched.push(String(url));
    return new Response(JSON.stringify({ links }), { status: 200 });
  });

describe("asking who taught whom", () => {
  it("turns the triples into hints, in the right direction", async () => {
    relay([link("8", "Kurosawa", "P1066", "Hasumi")]);
    const hints = await hintsFor(["Kurosawa"], "KEY");
    expect(hints).toEqual([
      {
        kind: "master",
        fromName: "Hasumi",
        toName: "Kurosawa",
        note: "Wikidata P1066",
        source: "wikidata",
      },
    ]);
  });

  it("asks with the trade, so an actor namesake does not answer", async () => {
    /* `searchPerson` does not take `results[0]` — that is TMDB's
       POPULARITY ranking — and the trade has to reach it. */
    relay([]);
    await hintsFor(["Kurosawa"], "KEY");
    expect(searchPerson).toHaveBeenCalledWith("Kurosawa", "KEY", { role: "réalisation" });
  });

  it("does not ask at all when no name resolves", async () => {
    relay([]);
    expect(await hintsFor(["Inconnu"], "KEY")).toEqual([]);
    expect(fetched).toEqual([]);
  });

  /* ============================================================
     AN EMPTY ANSWER IS AN ANSWER

     Wikidata knows nothing about most film-makers. Filing "nothing" as
     "never asked" would send the harvest back for the same names every
     single time it runs, for ever.
     ============================================================ */
  it("remembers that there was nothing, and does not ask twice", async () => {
    relay([]);
    await hintsFor(["Kurosawa"], "KEY");
    await hintsFor(["Kurosawa"], "KEY");
    expect(fetched).toHaveLength(1);
  });

  it("serves a remembered answer without asking again", async () => {
    relay([link("8", "Kurosawa", "P1066", "Hasumi")]);
    await hintsFor(["Kurosawa"], "KEY");
    const again = await hintsFor(["Kurosawa"], "KEY");
    expect(fetched).toHaveLength(1);
    expect(again).toHaveLength(1);
  });

  it("asks only about what it has not got", async () => {
    relay([link("8", "Kurosawa", "P1066", "Hasumi")]);
    await hintsFor(["Kurosawa"], "KEY");
    await hintsFor(["Kurosawa", "Ozu"], "KEY");
    expect(fetched).toHaveLength(2);
    /* The second question carries the new id ALONE — 3 for "Ozu". The
       comparison is on the query and not the URL: the port carries an
       "8" of its own. */
    expect(new URL(fetched[1]!).searchParams.get("tmdb")).toBe("3");
  });

  it("forgets on request", async () => {
    relay([]);
    await hintsFor(["Kurosawa"], "KEY");
    forgetHints();
    await hintsFor(["Kurosawa"], "KEY");
    expect(fetched).toHaveLength(2);
  });

  /* "We could not ask" and "there is nothing" are not the same screen,
     and the view can only tell them apart if the throw crosses. */
  it("lets the failure rise instead of answering that there is nothing", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 502 }));
    await expect(hintsFor(["Kurosawa"], "KEY")).rejects.toThrow();
  });

  it("remembers nothing of a question that failed", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 502 }));
    await hintsFor(["Kurosawa"], "KEY").catch(() => {});
    relay([link("8", "Kurosawa", "P1066", "Hasumi")]);
    expect(await hintsFor(["Kurosawa"], "KEY")).toHaveLength(1);
  });

  it("counts its way to the end, so a bar can reach it", async () => {
    relay([]);
    const seen: number[][] = [];
    await hintsFor(["Kurosawa", "Ozu"], "KEY", (done, total) => seen.push([done, total]));
    expect(seen.at(-1)).toEqual([3, 3]);
  });
});
