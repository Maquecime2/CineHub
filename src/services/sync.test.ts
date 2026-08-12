import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   THE SYNCHRONISATION ENGINE

   What is tested here holds in one sentence: nothing must be lost,
   neither when it works, nor above all when it fails. The server is
   stubbed — we are not testing the network, we are testing the decision.
   ============================================================ */

const faux = {
  person: { id: "p1", pseudo: "varda" } as { id: string; pseudo: string } | null,
  reçus: [] as { jusqua: number; encore?: boolean; fiches: unknown[] }[],
  poussés: [] as unknown[][],
  jetteAuTirage: null as null | { code: number; message: string },
  jetteÀLEnvoi: null as null | { code: number; message: string },
  docsReçus: [] as { jusqua: number; encore?: boolean; documents: unknown[] }[],
  docsPoussés: [] as unknown[][],
};

class ErreurServeurFausse extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message);
  }
}

vi.mock("./server", () => ({
  ServerError: ErreurServeurFausse,
  PER_SEND: 2,
  serverConfigured: () => true,
  whoAmI: async () => faux.person,
  pullFrom: async (depuis: number) => {
    if (faux.jetteAuTirage) {
      throw new ErreurServeurFausse(faux.jetteAuTirage.message, faux.jetteAuTirage.code);
    }
    return faux.reçus.shift() ?? { jusqua: depuis, encore: false, fiches: [] };
  },
  push: async (fiches: unknown[]) => {
    if (faux.jetteÀLEnvoi) {
      throw new ErreurServeurFausse(faux.jetteÀLEnvoi.message, faux.jetteÀLEnvoi.code);
    }
    faux.poussés.push(fiches);
    return { rangees: fiches.length, perimees: 0, illisibles: 0 };
  },
  DOCS_PER_SEND: 200,
  pullDocsFrom: async (depuis: number) =>
    faux.docsReçus.shift() ?? { jusqua: depuis, encore: false, documents: [] },
  pushDocs: async (documents: unknown[]) => {
    faux.docsPoussés.push(documents);
    return { ranges: documents.length, perimes: 0, illisibles: 0 };
  },
}));

const { synchronise, forgetSync, pending } = await import("./sync");
const { loadFilms, saveFilms, forgetCache } = await import("./collection");
const { makeFilm } = await import("../domain/film");

const fiche = (p: Record<string, unknown> = {}) => makeFilm({ title: "Playtime", ...p });

beforeEach(async () => {
  localStorage.clear();
  forgetCache([]);
  forgetSync();
  faux.person = { id: "p1", pseudo: "varda" };
  faux.reçus = [];
  faux.poussés = [];
  faux.jetteAuTirage = null;
  faux.jetteÀLEnvoi = null;
  faux.docsReçus = [];
  faux.docsPoussés = [];
  await loadFilms();
});

afterEach(() => localStorage.clear());

describe("un tour complet", () => {
  it("tire d'abord, pousse ensuite", async () => {
    /* Pushing first would send cards about to be replaced: work for
       nothing, and a window during which the server carries a version we
       are about to abandon. */
    await saveFilms([fiche({ id: "local", updatedAt: 5000 })]);
    faux.reçus = [
      {
        jusqua: 12,
        encore: false,
        fiches: [{ id: "venue", majLe: 3000, donnees: { title: "Yi Yi" } }],
      },
    ];

    let vus: unknown[] = [];
    const report = await synchronise((films) => (vus = films));

    expect(report.state).toBe("up-to-date");
    expect((vus as { id: string }[]).map((f) => f.id).sort()).toEqual(["local", "venue"]);
    /* The card that came from the server does NOT leave again: it carries its date. */
    expect(faux.poussés.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("redemande tant que le serveur dit qu'il en reste", async () => {
    faux.reçus = [
      { jusqua: 5, encore: true, fiches: [{ id: "a", majLe: 1, donnees: {} }] },
      { jusqua: 9, encore: false, fiches: [{ id: "b", majLe: 1, donnees: {} }] },
    ];
    let vus: unknown[] = [];
    await synchronise((films) => (vus = films));
    expect((vus as { id: string }[]).map((f) => f.id).sort()).toEqual(["a", "b"]);
  });

  it("découpe les gros envois", async () => {
    await saveFilms([
      fiche({ id: "a", updatedAt: 5000 }),
      fiche({ id: "b", updatedAt: 5000 }),
      fiche({ id: "c", updatedAt: 5000 }),
    ]);
    await synchronise(() => {});
    expect(faux.poussés.map((p) => p.length)).toEqual([2, 1]);
  });

  it("ce qui vient du serveur ne repart pas au tour suivant", async () => {
    /* The trap: re-dating a received card would make it pass for a
       local modification, and it would bounce for ever. */
    faux.reçus = [
      {
        jusqua: 7,
        encore: false,
        fiches: [{ id: "venue", majLe: 3000, donnees: { title: "Stalker" } }],
      },
    ];
    await synchronise(() => {});
    faux.poussés = [];
    await synchronise(() => {});
    expect(faux.poussés).toEqual([]);
  });
});

describe("quand le réseau manque", () => {
  it("l'appareil reste où il était, et le dit sans rougir", async () => {
    await saveFilms([fiche({ id: "local", updatedAt: 5000 })]);
    faux.jetteAuTirage = { code: 0, message: "Le serveur ne répond pas." };

    const report = await synchronise(() => {});
    expect(report.state).toBe("waiting");
    expect(report.pending).toBe(1);
  });

  it("et rattrape tout au retour du réseau", async () => {
    await saveFilms([fiche({ id: "local", updatedAt: 5000 })]);
    faux.jetteÀLEnvoi = { code: 0, message: "coupé" };
    expect((await synchronise(() => {})).state).toBe("waiting");
    expect(faux.poussés).toEqual([]);

    faux.jetteÀLEnvoi = null;
    const report = await synchronise(() => {});
    expect(report.state).toBe("up-to-date");
    expect(faux.poussés.flat().map((f) => (f as { id: string }).id)).toEqual(["local"]);
  });

  it("une vraie erreur du serveur se distingue d'une absence de réseau", async () => {
    faux.jetteAuTirage = { code: 500, message: "ça a cassé" };
    const report = await synchronise(() => {});
    expect(report.state).toBe("error");
    expect(report.message).toBe("ça a cassé");
  });
});

describe("sans compte", () => {
  it("rien ne part, et ce n'est pas une panne", async () => {
    faux.person = null;
    await saveFilms([fiche({ id: "local", updatedAt: 5000 })]);
    const report = await synchronise(() => {});
    expect(report.state).toBe("no-account");
    expect(faux.poussés).toEqual([]);
  });
});

describe("ce qui attend", () => {
  it("se compte sans rien demander au réseau", async () => {
    await saveFilms([fiche({ id: "a", updatedAt: 5000 })]);
    expect(pending()).toBe(1);
    await synchronise(() => {});
    expect(pending()).toBe(0);
  });

  it("une fiche effacée compte comme une chose à dire", async () => {
    /* `a` is the SAME object from one save to the next: only `b`
       leaves, and it is its departure we want to see counted. */
    const a = fiche({ id: "a" });
    await saveFilms([a, fiche({ id: "b" })]);
    await synchronise(() => {});
    await saveFilms([a]);
    expect(pending()).toBe(1);

    await synchronise(() => {});
    const dernier = faux.poussés.at(-1)!.at(-1) as { id: string; supprimee?: boolean };
    expect(dernier).toMatchObject({ id: "b", supprimee: true });
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

    const clés = faux.docsPoussés.flat().map((d) => (d as { cle: string }).cle);
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

    const clés = faux.docsPoussés.flat().map((d) => (d as { cle: string }).cle);
    expect(clés).not.toContain("skin");
    expect(clés).not.toContain("onboarding");
    expect(clés.some((c) => c.startsWith("synchro-"))).toBe(false);
  });

  it("range ce qui vient d'ailleurs, et le signale pour qu'on relise", async () => {
    faux.docsReçus = [
      {
        jusqua: 3,
        encore: false,
        documents: [
          { cle: "shelf-view:abc", majLe: 9000, contenu: { id: "abc", venue: "d'ailleurs" } },
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

    faux.docsReçus = [
      {
        jusqua: 9,
        encore: false,
        documents: [{ cle: "shelf-view:abc", majLe: 1, contenu: { vieux: true } }],
      },
    ];
    await synchronise(() => {});
    expect(JSON.parse(localStorage.getItem("shelf-view:abc")!)).toMatchObject({ ici: true });
  });

  it("ce qui est arrivé ne repart pas", async () => {
    faux.docsReçus = [
      { jusqua: 4, encore: false, documents: [{ cle: "fils", majLe: 8000, contenu: [] }] },
    ];
    await synchronise(() => {});
    faux.docsPoussés = [];
    await synchronise(() => {});
    expect(faux.docsPoussés.flat()).toEqual([]);
  });
});
