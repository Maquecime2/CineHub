import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   THE SYNCHRONISATION ENGINE

   What is tested here holds in one sentence: nothing must be lost,
   neither when it works, nor above all when it fails. The server is
   stubbed — we are not testing the network, we are testing the decision.
   ============================================================ */

const fake = {
  person: { id: "p1", pseudo: "varda" } as { id: string; pseudo: string } | null,
  received: [] as { upTo: number; more?: boolean; cards: unknown[] }[],
  pushed: [] as unknown[][],
  throwsOnPull: null as null | { code: number; message: string },
  throwsOnSend: null as null | { code: number; message: string },
  docsReceived: [] as { upTo: number; more?: boolean; documents: unknown[] }[],
  docsPushed: [] as unknown[][],
};

class FakeServerError extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message);
  }
}

vi.mock("./server", () => ({
  ServerError: FakeServerError,
  PER_SEND: 2,
  serverConfigured: () => true,
  whoAmI: async () => fake.person,
  pullFrom: async (since: number) => {
    if (fake.throwsOnPull) {
      throw new FakeServerError(fake.throwsOnPull.message, fake.throwsOnPull.code);
    }
    return fake.received.shift() ?? { upTo: since, more: false, cards: [] };
  },
  push: async (cards: unknown[]) => {
    if (fake.throwsOnSend) {
      throw new FakeServerError(fake.throwsOnSend.message, fake.throwsOnSend.code);
    }
    fake.pushed.push(cards);
    return { filed: cards.length, stale: 0, unreadable: 0 };
  },
  DOCS_PER_SEND: 200,
  pullDocsFrom: async (since: number) =>
    fake.docsReceived.shift() ?? { upTo: since, more: false, documents: [] },
  pushDocs: async (documents: unknown[]) => {
    fake.docsPushed.push(documents);
    return { filed: documents.length, stale: 0, unreadable: 0 };
  },
}));

const { synchronise, forgetSync, pending } = await import("./sync");
const { loadFilms, saveFilms, forgetCache } = await import("./collection");
const { makeFilm } = await import("../domain/film");

const card = (p: Record<string, unknown> = {}) => makeFilm({ title: "Playtime", ...p });

beforeEach(async () => {
  localStorage.clear();
  forgetCache([]);
  forgetSync();
  fake.person = { id: "p1", pseudo: "varda" };
  fake.received = [];
  fake.pushed = [];
  fake.throwsOnPull = null;
  fake.throwsOnSend = null;
  fake.docsReceived = [];
  fake.docsPushed = [];
  await loadFilms();
});

afterEach(() => localStorage.clear());

describe("one full round", () => {
  it("pulls first, pushes second", async () => {
    /* Pushing first would send cards about to be replaced: work for
       nothing, and a window during which the server carries a version we
       are about to abandon. */
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    fake.received = [
      {
        upTo: 12,
        more: false,
        cards: [{ id: "venue", updatedAt: 3000, data: { title: "Yi Yi" } }],
      },
    ];

    let seenFilms: unknown[] = [];
    const report = await synchronise((films) => (seenFilms = films));

    expect(report.state).toBe("up-to-date");
    expect((seenFilms as { id: string }[]).map((f) => f.id).sort()).toEqual(["local", "venue"]);
    /* The card that came from the server does NOT leave again: it carries its date. */
    expect(fake.pushed.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("asks again as long as the server says there is more", async () => {
    fake.received = [
      { upTo: 5, more: true, cards: [{ id: "a", updatedAt: 1, data: {} }] },
      { upTo: 9, more: false, cards: [{ id: "b", updatedAt: 1, data: {} }] },
    ];
    let seenFilms: unknown[] = [];
    await synchronise((films) => (seenFilms = films));
    expect((seenFilms as { id: string }[]).map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("cuts the big sends up", async () => {
    await saveFilms([
      card({ id: "a", updatedAt: 5000 }),
      card({ id: "b", updatedAt: 5000 }),
      card({ id: "c", updatedAt: 5000 }),
    ]);
    await synchronise(() => {});
    expect(fake.pushed.map((p) => p.length)).toEqual([2, 1]);
  });

  it("what comes from the server does not go back on the next round", async () => {
    /* The trap: re-dating a received card would make it pass for a
       local modification, and it would bounce for ever. */
    fake.received = [
      {
        upTo: 7,
        more: false,
        cards: [{ id: "venue", updatedAt: 3000, data: { title: "Stalker" } }],
      },
    ];
    await synchronise(() => {});
    fake.pushed = [];
    await synchronise(() => {});
    expect(fake.pushed).toEqual([]);
  });
});

describe("when the network is missing", () => {
  it("the device stays where it was, and says so without blushing", async () => {
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    fake.throwsOnPull = { code: 0, message: "Le serveur ne répond pas." };

    const report = await synchronise(() => {});
    expect(report.state).toBe("waiting");
    expect(report.pending).toBe(1);
  });

  it("and catches everything up when the network comes back", async () => {
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    fake.throwsOnSend = { code: 0, message: "coupé" };
    expect((await synchronise(() => {})).state).toBe("waiting");
    expect(fake.pushed).toEqual([]);

    fake.throwsOnSend = null;
    const report = await synchronise(() => {});
    expect(report.state).toBe("up-to-date");
    expect(fake.pushed.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("a real server error is told apart from an absent network", async () => {
    fake.throwsOnPull = { code: 500, message: "ça a cassé" };
    const report = await synchronise(() => {});
    expect(report.state).toBe("error");
    expect(report.message).toBe("ça a cassé");
  });
});

describe("with no account", () => {
  it("nothing goes out, and that is not a breakdown", async () => {
    fake.person = null;
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    const report = await synchronise(() => {});
    expect(report.state).toBe("no-account");
    expect(fake.pushed).toEqual([]);
  });
});

describe("what is waiting", () => {
  it("counts itself without asking the network anything", async () => {
    await saveFilms([card({ id: "a", updatedAt: 5000 })]);
    expect(pending()).toBe(1);
    await synchronise(() => {});
    expect(pending()).toBe(0);
  });

  it("an erased card counts as something to say", async () => {
    /* `a` is the SAME object from one save to the next: only `b`
       leaves, and it is its departure we want to see counted. */
    const a = card({ id: "a" });
    await saveFilms([a, card({ id: "b" })]);
    await synchronise(() => {});
    await saveFilms([a]);
    expect(pending()).toBe(1);

    await synchronise(() => {});
    const last = fake.pushed.at(-1)!.at(-1) as { id: string; deleted?: boolean };
    expect(last).toMatchObject({ id: "b", deleted: true });
  });
});

describe("the rest of the binder", () => {
  /* WHAT THE FIRST VERSION LACKED, and only a hand trial showed: the
     synchronisation carried only the cards. The second device found the
     films again without knowing how they were arranged — that is,
     without the shelf, which is this application's central gesture. */

  it("sends the shelf arrangements, the notebook and the threads", async () => {
    const { store } = await import("./storage");
    store.set("shelf-view:abc", { id: "abc", rows: [{ id: "r1", items: ["uuid-a"] }] });
    store.set("notebook-notes", [{ id: "n1", title: "Une page" }]);
    store.set("fils", [{ id: "f1", question: "où il pleut" }]);

    await synchronise(() => {});

    const keys = fake.docsPushed.flat().map((d) => (d as { key: string }).key);
    expect(keys).toEqual(expect.arrayContaining(["shelf-view:abc", "notebook-notes", "fils"]));
  });

  /* THE NAMES ARE COMPARED TO THE SERVICES THAT WRITE THEM, and not
     re-typed. Three of them had been invented in `documents.ts` —
     "shelf-views-index" for an index called "shelf-views",
     "decor-custom" and "decor-hidden" for keys prefixed "shelf-" — so
     those three documents never travelled at all. Nothing reported it:
     a key that is not syncable is not an error, it is a silence, and
     the second device simply found a binder with no arrangement and an
     empty cabinet.

     The shelf VIEWS did travel, which is what made it so hard to see —
     they go by prefix. It was the index naming them that stayed
     behind. */
  it("names the documents by the constants that write them", async () => {
    const { isSyncable } = await import("./documents");
    const { VIEW_INDEX, viewKey } = await import("./shelfViews");
    const { CUSTOM_DECOR_KEY, HIDDEN_DECOR_KEY } = await import("./customDecor");
    const { THREADS_KEY } = await import("./threads");
    const { BONDS_KEY, COURSES_KEY } = await import("./lineage");
    const { KEYS } = await import("./storage");

    for (const key of [
      VIEW_INDEX,
      viewKey("abc"),
      CUSTOM_DECOR_KEY,
      HIDDEN_DECOR_KEY,
      THREADS_KEY,
      BONDS_KEY,
      COURSES_KEY,
      KEYS.notes,
      KEYS.dividers,
    ]) {
      expect(isSyncable(key), key).toBe(true);
    }
  });

  it("carries the shelf index, the cabinet and the objects taken from friends", async () => {
    const { store } = await import("./storage");
    const { VIEW_INDEX } = await import("./shelfViews");
    const { CUSTOM_DECOR_KEY, HIDDEN_DECOR_KEY } = await import("./customDecor");

    store.set(VIEW_INDEX, ["abc"]);
    store.set(CUSTOM_DECOR_KEY, [{ key: "custom:1", label: "une lampe" }]);
    store.set(HIDDEN_DECOR_KEY, ["plant"]);

    await synchronise(() => {});

    const keys = fake.docsPushed.flat().map((d) => (d as { key: string }).key);
    expect(keys).toEqual(expect.arrayContaining([VIEW_INDEX, CUSTOM_DECOR_KEY, HIDDEN_DECOR_KEY]));
  });

  it("leaves here what describes THIS device", async () => {
    /* The chosen skin, the state of the tour, the synchronisation
       markers: sending them would impose one's mood of the moment on
       one's other screen, and each device syncs on its own cursor. */
    const { store } = await import("./storage");
    store.set("skin", "cinematheque");
    store.set("onboarding", { done: ["global"] });

    await synchronise(() => {});

    const keys = fake.docsPushed.flat().map((d) => (d as { key: string }).key);
    expect(keys).not.toContain("skin");
    expect(keys).not.toContain("onboarding");
    expect(keys.some((c) => c.startsWith("synchro-"))).toBe(false);
  });

  it("files what comes from elsewhere, and says so, so it gets reread", async () => {
    fake.docsReceived = [
      {
        upTo: 3,
        more: false,
        documents: [
          { key: "shelf-view:abc", updatedAt: 9000, content: { id: "abc", venue: "d'ailleurs" } },
        ],
      },
    ];
    const report = await synchronise(() => {});
    expect(report.documentsIn).toBe(1);
    expect(JSON.parse(localStorage.getItem("shelf-view:abc")!)).toMatchObject({
      venue: "d'ailleurs",
    });
  });

  it("an older arrangement does not overwrite the one here", async () => {
    const { store } = await import("./storage");
    store.set("shelf-view:abc", { id: "abc", ici: true });
    await synchronise(() => {});

    fake.docsReceived = [
      {
        upTo: 9,
        more: false,
        documents: [{ key: "shelf-view:abc", updatedAt: 1, content: { vieux: true } }],
      },
    ];
    await synchronise(() => {});
    expect(JSON.parse(localStorage.getItem("shelf-view:abc")!)).toMatchObject({ ici: true });
  });

  /* ============================================================
     THE FIRST CONNECTION ON A SECOND MACHINE

     Signing in somewhere new used to date the untouched local defaults
     at `Date.now()` — the newest date there is. The arrangement pulled a
     second later was therefore refused as stale, and the push that
     follows overwrote the server with the empty shelf: the arrangement
     was lost on BOTH devices, and nothing anywhere said so.
     ============================================================ */
  it("the arrangement of the other machine wins over untouched defaults here", async () => {
    const { store } = await import("./storage");
    /* This machine has never arranged anything: what is in `localStorage`
       is what the application wrote by itself, undated. */
    localStorage.setItem("shelf-dividers", JSON.stringify([]));
    fake.docsReceived = [
      {
        upTo: 7,
        more: false,
        documents: [{ key: "shelf-dividers", updatedAt: 8000, content: [{ label: "les polars" }] }],
      },
    ];

    const report = await synchronise(() => {});

    expect(report.documentsIn).toBe(1);
    expect(store.get("shelf-dividers", null)).toEqual([{ label: "les polars" }]);
    /* And it does not go straight back out as an empty shelf. */
    const sent = fake.docsPushed.flat() as { key: string }[];
    expect(sent.some((d) => d.key === "shelf-dividers")).toBe(false);
  });

  /* THE TOMBSTONE MUST CARRY THE SERVER'S WORD FOR IT.
     `documents.ts` wrote `supprime` where the server reads `deleted` —
     a leftover of the codebase's translation, on one side only. The
     field was therefore never read, in either direction: erasing a
     document here left the other device holding it, and merely handed
     it a `null` in place of its copy. */
  it("says a deleted document is deleted, in the server's own word", async () => {
    const { store } = await import("./storage");
    store.set("fils", [{ id: "un fil" }]);
    await synchronise(() => {});

    localStorage.removeItem("fils");
    const { noteDocument } = await import("./documents");
    noteDocument("fils");

    fake.docsPushed = [];
    await synchronise(() => {});

    const sent = fake.docsPushed.flat() as { key: string; deleted?: boolean }[];
    expect(sent.find((d) => d.key === "fils")).toMatchObject({ deleted: true });
  });

  it("what has come in does not go back out", async () => {
    fake.docsReceived = [
      { upTo: 4, more: false, documents: [{ key: "fils", updatedAt: 8000, content: [] }] },
    ];
    await synchronise(() => {});
    fake.docsPushed = [];
    await synchronise(() => {});
    expect(fake.docsPushed.flat()).toEqual([]);
  });
});
