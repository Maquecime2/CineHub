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

describe("un tour complet", () => {
  it("tire d'abord, pousse ensuite", async () => {
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

  it("redemande tant que le serveur dit qu'il en reste", async () => {
    fake.received = [
      { jusqua: 5, encore: true, fiches: [{ id: "a", majLe: 1, donnees: {} }] },
      { jusqua: 9, encore: false, fiches: [{ id: "b", majLe: 1, donnees: {} }] },
    ];
    let seenFilms: unknown[] = [];
    await synchronise((films) => (seenFilms = films));
    expect((seenFilms as { id: string }[]).map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("découpe les gros envois", async () => {
    await saveFilms([
      card({ id: "a", updatedAt: 5000 }),
      card({ id: "b", updatedAt: 5000 }),
      card({ id: "c", updatedAt: 5000 }),
    ]);
    await synchronise(() => {});
    expect(fake.pushed.map((p) => p.length)).toEqual([2, 1]);
  });

  it("ce qui vient du serveur ne repart pas au tour suivant", async () => {
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

describe("quand le réseau manque", () => {
  it("l'appareil reste où il était, et le dit sans rougir", async () => {
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    fake.jetteAuTirage = { code: 0, message: "Le serveur ne répond pas." };

    const report = await synchronise(() => {});
    expect(report.state).toBe("waiting");
    expect(report.pending).toBe(1);
  });

  it("et rattrape tout au retour du réseau", async () => {
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    fake.throwsOnSend = { code: 0, message: "coupé" };
    expect((await synchronise(() => {})).state).toBe("waiting");
    expect(fake.pushed).toEqual([]);

    fake.throwsOnSend = null;
    const report = await synchronise(() => {});
    expect(report.state).toBe("up-to-date");
    expect(fake.pushed.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("une vraie erreur du serveur se distingue d'une absence de réseau", async () => {
    fake.jetteAuTirage = { code: 500, message: "ça a cassé" };
    const report = await synchronise(() => {});
    expect(report.state).toBe("error");
    expect(report.message).toBe("ça a cassé");
  });
});

describe("sans compte", () => {
  it("rien ne part, et ce n'est pas une panne", async () => {
    fake.person = null;
    await saveFilms([card({ id: "local", updatedAt: 5000 })]);
    const report = await synchronise(() => {});
    expect(report.state).toBe("no-account");
    expect(fake.pushed).toEqual([]);
  });
});

describe("ce qui attend", () => {
  it("se compte sans rien demander au réseau", async () => {
    await saveFilms([card({ id: "a", updatedAt: 5000 })]);
    expect(pending()).toBe(1);
    await synchronise(() => {});
    expect(pending()).toBe(0);
  });

  it("une fiche effacée compte comme une chose à dire", async () => {
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

describe("le reste du classeur", () => {
  /* WHAT THE FIRST VERSION LACKED, and only a hand trial showed: the
     synchronisation carried only the cards. The second device found the
     films again without knowing how they were arranged — that is,
     without the shelf, which is this application's central gesture. */

  it("envoie l'agencement des étagères, le carnet et les fils", async () => {
    const { store } = await import("./storage");
    store.set("shelf-view:abc", { id: "abc", rows: [{ id: "r1", items: ["uuid-a"] }] });
    store.set("notebook-notes", [{ id: "n1", title: "Une page" }]);
    store.set("fils", [{ id: "f1", question: "où il pleut" }]);

    await synchronise(() => {});

    const clés = fake.docsPushed.flat().map((d) => (d as { cle: string }).cle);
    expect(clés).toEqual(expect.arrayContaining(["shelf-view:abc", "notebook-notes", "fils"]));
  });

  it("laisse ici ce qui décrit CET appareil", async () => {
    /* The chosen skin, the state of the tour, the synchronisation
       markers: sending them would impose one's mood of the moment on
       one's other screen, and each device syncs on its own cursor. */
    const { store } = await import("./storage");
    store.set("skin", "cinematheque");
    store.set("onboarding", { done: ["global"] });

    await synchronise(() => {});

    const clés = fake.docsPushed.flat().map((d) => (d as { cle: string }).cle);
    expect(clés).not.toContain("skin");
    expect(clés).not.toContain("onboarding");
    expect(clés.some((c) => c.startsWith("synchro-"))).toBe(false);
  });

  it("range ce qui vient d'ailleurs, et le signale pour qu'on relise", async () => {
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

  it("un agencement plus ancien n'écrase pas celui d'ici", async () => {
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

  it("ce qui est arrivé ne repart pas", async () => {
    fake.docsReceived = [
      { jusqua: 4, encore: false, documents: [{ cle: "fils", majLe: 8000, content: [] }] },
    ];
    await synchronise(() => {});
    fake.docsPushed = [];
    await synchronise(() => {});
    expect(fake.docsPushed.flat()).toEqual([]);
  });
});
