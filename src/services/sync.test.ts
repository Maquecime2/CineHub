import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   THE SYNCHRONISATION ENGINE

   What is tested here holds in one sentence: nothing must be lost,
   neither when it works, nor above all when it fails. The server is
   stubbed — we are not testing the network, we are testing the decision.
   ============================================================ */

const fake = {
  person: { id: "p1", pseudo: "varda" } as { id: string; pseudo: string } | null,
  received: [] as { jusqua: number; encore?: boolean; fiches: unknown[] }[],
  pushed: [] as unknown[][],
  jetteAuTirage: null as null | { code: number; message: string },
  throwsOnSend: null as null | { code: number; message: string },
  docsReceived: [] as { jusqua: number; encore?: boolean; documents: unknown[] }[],
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
  pullFrom: async (depuis: number) => {
    if (fake.jetteAuTirage) {
      throw new FakeServerError(fake.jetteAuTirage.message, fake.jetteAuTirage.code);
    }
    return fake.received.shift() ?? { jusqua: depuis, encore: false, fiches: [] };
  },
  push: async (cards: unknown[]) => {
    if (fake.throwsOnSend) {
      throw new FakeServerError(fake.throwsOnSend.message, fake.throwsOnSend.code);
    }
    fake.pushed.push(cards);
    return { rangees: cards.length, perimees: 0, illisibles: 0 };
  },
  DOCS_PER_SEND: 200,
  pullDocsFrom: async (depuis: number) =>
    fake.docsReceived.shift() ?? { jusqua: depuis, encore: false, documents: [] },
  pushDocs: async (documents: unknown[]) => {
    fake.docsPushed.push(documents);
    return { ranges: documents.length, perimes: 0, illisibles: 0 };
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
  fake.jetteAuTirage = null;
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
        jusqua: 12,
        encore: false,
        fiches: [{ id: "venue", majLe: 3000, donnees: { title: "Yi Yi" } }],
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
      { jusqua: 5, encore: true, fiches: [{ id: "a", majLe: 1, donnees: {} }] },
      { jusqua: 9, encore: false, fiches: [{ id: "b", majLe: 1, donnees: {} }] },
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
        jusqua: 7,
        encore: false,
        fiches: [{ id: "venue", majLe: 3000, donnees: { title: "Stalker" } }],
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
    fake.jetteAuTirage = { code: 0, message: "Le serveur ne répond pas." };

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
    fake.jetteAuTirage = { code: 500, message: "ça a cassé" };
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
    const last = fake.pushed.at(-1)!.at(-1) as { id: string; supprimee?: boolean };
    expect(last).toMatchObject({ id: "b", supprimee: true });
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

    const keys = fake.docsPushed.flat().map((d) => (d as { cle: string }).cle);
    expect(keys).toEqual(expect.arrayContaining(["shelf-view:abc", "notebook-notes", "fils"]));
  });

  it("leaves here what describes THIS device", async () => {
    /* The chosen skin, the state of the tour, the synchronisation
       markers: sending them would impose one's mood of the moment on
       one's other screen, and each device syncs on its own cursor. */
    const { store } = await import("./storage");
    store.set("skin", "cinematheque");
    store.set("onboarding", { done: ["global"] });

    await synchronise(() => {});

    const keys = fake.docsPushed.flat().map((d) => (d as { cle: string }).cle);
    expect(keys).not.toContain("skin");
    expect(keys).not.toContain("onboarding");
    expect(keys.some((c) => c.startsWith("synchro-"))).toBe(false);
  });

  it("files what comes from elsewhere, and says so, so it gets reread", async () => {
    fake.docsReceived = [
      {
        jusqua: 3,
        encore: false,
        documents: [
          { cle: "shelf-view:abc", majLe: 9000, content: { id: "abc", venue: "d'ailleurs" } },
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
        jusqua: 9,
        encore: false,
        documents: [{ cle: "shelf-view:abc", majLe: 1, content: { vieux: true } }],
      },
    ];
    await synchronise(() => {});
    expect(JSON.parse(localStorage.getItem("shelf-view:abc")!)).toMatchObject({ ici: true });
  });

  it("what has come in does not go back out", async () => {
    fake.docsReceived = [
      { jusqua: 4, encore: false, documents: [{ cle: "fils", majLe: 8000, content: [] }] },
    ];
    await synchronise(() => {});
    fake.docsPushed = [];
    await synchronise(() => {});
    expect(fake.docsPushed.flat()).toEqual([]);
  });
});
