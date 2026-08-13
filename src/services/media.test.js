import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   THE MEDIA MIRROR

   IndexedDB stays the original and the container is a copy: everything
   worth testing here follows from that one sentence.

   WHAT IS ON THE PATH OF A GESTURE. Nothing. Importing a poster writes
   to the vault and returns; the upload waits for the next
   synchronisation. So `readMedia` must answer from the vault WITHOUT
   asking anybody anything when the image is there — a wall of five
   hundred cards that each ask the server would be a wall nobody
   scrolls.

   WHAT AN ADDRESS IS. `remotePath` is where the two kinds of media part
   company: a decor goes to a shared prefix under its SERVER identity, a
   screenshot goes under its owner's. Getting that wrong would file
   somebody's private capture where a friend can fetch it.

   AND WHAT NOTHING MUST EVER SKIP: an SVG arriving from outside is
   vetted before it is kept. `CustomDraw` injects the markup inline.
   ============================================================ */

const vault = new Map();
vi.mock("../db", () => ({
  putImage: async (k, blob) => vault.set(k, blob),
  getImage: async (k) => vault.get(k),
  deleteImage: async (k) => void vault.delete(k),
}));

/* The container, standing in for Azure: a ticket is a URL, and fetching
   it hands back whatever was put at that address. */
const container = new Map();
let signedOut = false;

const tickets = vi.fn(async (paths) => paths.map((path) => ({ path, url: `ticket:${path}` })));
const ticket = vi.fn(async (path) => (container.has(path) ? `ticket:${path}` : null));

vi.mock("./server", () => ({
  serverConfigured: () => true,
  accountOpen: () => !signedOut,
  mediaTickets: (...a) => tickets(...a),
  mediaTicket: (...a) => ticket(...a),
  mediaDeleteTicket: async (path) => `ticket:${path}`,
}));

vi.mock("./customDecor", () => ({
  DECOR_IMAGE_PREFIX: "decor:",
  remoteIdOfDecor: (key) => (key === "decor:known" ? "d-1234" : undefined),
}));

/* `fetch` is the only door to the container: PUT files, GET serves,
   DELETE removes. */
globalThis.fetch = vi.fn(async (url, options = {}) => {
  const path = String(url).replace(/^ticket:/, "");
  if (options.method === "PUT") {
    container.set(path, options.body);
    return { ok: true };
  }
  if (options.method === "DELETE") {
    container.delete(path);
    return { ok: true };
  }
  const blob = container.get(path);
  return blob ? { ok: true, blob: async () => blob } : { ok: false };
});

const { noteMedia, mediaPending, remotePath, pushMedia, readMedia, dropMedia, forgetMedia } =
  await import("./media");

const ME = "3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("synchro-account", JSON.stringify(ME));
  vault.clear();
  container.clear();
  signedOut = false;
  tickets.mockClear();
  ticket.mockClear();
  globalThis.fetch.mockClear();
});

describe("a blob's address", () => {
  it("keeps the private apart from the shareable", () => {
    expect(remotePath("still-abc-1")).toBe(`p/${ME}/still-abc-1`);
    expect(remotePath("decor:known")).toBe("decor/d-1234");
  });

  it("gives none to a decor that has not gone up yet", () => {
    /* An object added offline exists on the shelf with no server
       identity: it has no address, and that is not an error. */
    expect(remotePath("decor:brand-new")).toBeNull();
  });

  it("gives none with no account open", () => {
    localStorage.removeItem("synchro-account");
    expect(remotePath("still-abc-1")).toBeNull();
  });
});

describe("the register", () => {
  it("notes what is waiting only once", () => {
    noteMedia("a-poster");
    noteMedia("a-poster");
    expect(mediaPending()).toBe(1);
  });

  it("forgets what has gone", () => {
    noteMedia("a-poster");
    forgetMedia("a-poster");
    expect(mediaPending()).toBe(0);
  });
});

describe("putting down", () => {
  it("sends what is waiting, and does not send it again", async () => {
    vault.set("a-poster", new Blob(["png"]));
    noteMedia("a-poster");

    expect(await pushMedia()).toBe(1);
    expect(container.get(`p/${ME}/a-poster`)).toBeInstanceOf(Blob);
    expect(mediaPending()).toBe(0);

    /* A second pass asks for no ticket at all: that is the whole point
       of the register. */
    tickets.mockClear();
    expect(await pushMedia()).toBe(0);
    expect(tickets).not.toHaveBeenCalled();
  });

  it("stops waiting for a blob erased from the vault in the meantime", async () => {
    noteMedia("gone");
    expect(await pushMedia()).toBe(0);
    expect(mediaPending()).toBe(0);
  });

  it("does nothing with no account, and keeps what is waiting", async () => {
    signedOut = true;
    vault.set("a-poster", new Blob(["png"]));
    noteMedia("a-poster");

    expect(await pushMedia()).toBe(0);
    /* Offline, the blob stays here — which is where it was safe
       anyway. */
    expect(mediaPending()).toBe(1);
  });

  it("does not sink the batch when the container refuses", async () => {
    vault.set("a-poster", new Blob(["png"]));
    noteMedia("a-poster");
    tickets.mockRejectedValueOnce(new Error("503"));

    expect(await pushMedia()).toBe(0);
    expect(mediaPending()).toBe(1);
  });
});

describe("reading", () => {
  it("answers from the vault without asking anybody anything", async () => {
    vault.set("here", new Blob(["png"]));
    expect(await readMedia("here")).toBeInstanceOf(Blob);
    /* Five hundred cards each questioning the server would make a wall
       nobody scrolls. */
    expect(ticket).not.toHaveBeenCalled();
  });

  it("fetches from the container what the vault has not, and files it", async () => {
    container.set(`p/${ME}/elsewhere`, new Blob(["png"]));

    const blob = await readMedia("elsewhere");
    expect(blob).toBeInstanceOf(Blob);
    /* Filed on the way: the second read does not go back on the
       network. */
    expect(vault.get("elsewhere")).toBeInstanceOf(Blob);
    ticket.mockClear();
    await readMedia("elsewhere");
    expect(ticket).not.toHaveBeenCalled();
  });

  it("answers null when there is nothing anywhere", async () => {
    /* That is the moment "stayed on the other device" tells the
       truth. */
    expect(await readMedia("nowhere")).toBeNull();
  });

  it("puts the bytes through the vetting before keeping them", async () => {
    container.set(`p/${ME}/suspect`, new Blob(["<svg onload=alert(1)/>"]));

    const refused = await readMedia("suspect", async () => null);
    expect(refused).toBeNull();
    /* WHAT IS REFUSED IS NOT CACHED. Without this line, the discarded
       markup would be served as it stands on the next read. */
    expect(vault.has("suspect")).toBe(false);

    const clean = await readMedia("suspect", async () => new Blob(["<svg/>"]));
    expect(await clean.text()).toBe("<svg/>");
    expect(await vault.get("suspect").text()).toBe("<svg/>");
  });
});

describe("erasing", () => {
  it("removes the copy from the container", async () => {
    container.set(`p/${ME}/old-one`, new Blob(["png"]));
    await dropMedia("old-one");
    expect(container.has(`p/${ME}/old-one`)).toBe(false);
  });

  it("stays quiet when there is no address", async () => {
    /* A decor that never went up has nothing to erase over there, and a
       local tidy-up must not stop for it. */
    await expect(dropMedia("decor:brand-new")).resolves.toBeUndefined();
  });
});
