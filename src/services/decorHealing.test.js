import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   AN ADDRESS THE SERVER NO LONGER KNOWS

   `PUT /decor/<id>` answered 404 on a piece sitting on the shelf, for
   ever, silently. The registry of imported objects is itself a
   SYNCHRONISED DOCUMENT, so an identifier written against one server
   travels to a machine talking to another — and a database rebuilt, or
   an account changed, leaves every object pointing at a row that no
   longer exists. Trying again could never help.

   So a ghost identifier is forgotten, and the next synchronisation
   re-creates the object. Which makes the SAFETY the thing to test: a
   round trip that failed must forget nothing at all. Reading "the server
   did not answer" as "the server does not have it" would re-upload the
   whole cabinet on every outage, and duplicate it there.
   ============================================================ */

const vault = new Map();
vi.mock("../db", () => ({
  putImage: async (k, b) => vault.set(k, b),
  getImage: async (k) => vault.get(k),
  deleteImage: async (k) => void vault.delete(k),
}));
vi.mock("./images", () => ({
  shrinkImage: async (file) => new Blob([`shrunk:${file.name}`]),
  imageSize: async () => ({ w: 10, h: 10 }),
}));
vi.mock("./media", () => ({ noteMedia: vi.fn(), forgetMedia: vi.fn() }));

const server = {
  mine: [],
  fails: false,
  created: [],
};

class FakeServerError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

vi.mock("./server", () => ({
  ServerError: FakeServerError,
  serverConfigured: () => true,
  accountOpen: () => true,
  myRemoteDecor: async () => {
    if (server.fails) throw new FakeServerError("hors ligne", 0);
    return server.mine;
  },
  createRemoteDecor: async (d) => {
    const decor = { id: `srv-${server.created.length + 1}`, ...d };
    server.created.push(decor);
    return { decor, path: `decor/${decor.id}` };
  },
  dropRemoteDecor: vi.fn(),
  showDecor: async () => {
    throw new FakeServerError("Objet inconnu.", 404);
  },
  takeRemoteDecor: vi.fn(),
  mediaTicket: vi.fn(),
}));

const {
  addCustomDecor,
  listCustomDecor,
  setCustomDecor,
  refreshCustomDecor,
  healRemoteDecor,
  pushNewDecor,
  showCustomDecor,
} = await import("./customDecor");

const png = (name = "lampe.png") => new File(["…"], name, { type: "image/png" });

const withAddress = async (id) => {
  const entry = await addCustomDecor(png());
  setCustomDecor(listCustomDecor().map((d) => ({ ...d, remoteId: id, shown: true })));
  return entry;
};

beforeEach(() => {
  localStorage.clear();
  vault.clear();
  refreshCustomDecor();
  server.mine = [];
  server.fails = false;
  server.created = [];
});

describe("an address the server no longer knows", () => {
  it("is forgotten, so the next round re-creates the object", async () => {
    const entry = await withAddress("ghost");
    server.mine = [];

    expect(await healRemoteDecor()).toBe(1);
    const after = listCustomDecor().find((d) => d.key === entry.key);
    expect(after.remoteId).toBeUndefined();
    /* And not on show either: it is not on show anywhere, since it does
       not exist anywhere. */
    expect(after.shown).toBe(false);

    await pushNewDecor();
    expect(listCustomDecor()[0].remoteId).toBe("srv-1");
  });

  it("keeps an address the server still knows", async () => {
    await withAddress("srv-9");
    server.mine = [{ id: "srv-9" }];
    expect(await healRemoteDecor()).toBe(0);
    expect(listCustomDecor()[0].remoteId).toBe("srv-9");
  });

  /* THE ONE THAT MATTERS. Forgetting on a failed request would re-upload
     the whole cabinet at every outage — and file a second copy of every
     object on the server. */
  it("forgets nothing when the server did not answer", async () => {
    await withAddress("srv-9");
    server.fails = true;

    expect(await healRemoteDecor()).toBe(0);
    expect(listCustomDecor()[0].remoteId).toBe("srv-9");

    server.fails = false;
    await pushNewDecor();
    expect(server.created).toEqual([]);
  });

  it("the sharing switch heals it too, rather than failing for ever", async () => {
    const entry = await withAddress("ghost");
    /* `showDecor` answers 404 in this file's double: the switch used to
       let that through and the piece stayed unshareable until somebody
       deleted it by hand. */
    await expect(showCustomDecor(entry.key, true)).resolves.toBeUndefined();
    expect(listCustomDecor()[0].remoteId).toBeUndefined();
  });
});
