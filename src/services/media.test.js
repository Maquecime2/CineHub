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
  allImageKeys: async () => [...vault.keys()],
}));

/* The container, standing in for Azure: a ticket is a URL, and fetching
   it hands back whatever was put at that address. */
const container = new Map();
let signedOut = false;

/* L'ENVELOPPE ET NON LE TABLEAU NU. La route rend `{ tickets, full? }`
   depuis toujours ; le client ne gardait que `tickets` et jetait le
   refus du plafond avec. Ce faux-semblant a la forme de la vraie
   réponse, `full` compris — voir `mediaFull.test.ts`. */
const grantTickets = async (paths) => ({
  tickets: paths.map((path) => ({ path, url: `ticket:${path}` })),
});
const tickets = vi.fn(grantTickets);

/* `mediaTicket`, at the singular, is not mocked here any more: this
   module stopped calling it when the tirage started batching, and a
   stand-in for a function nobody calls is a stand-in that will one day
   be believed. `customDecor` still uses it, and mocks it on its side. */
vi.mock("./server", () => ({
  serverConfigured: () => true,
  accountOpen: () => !signedOut,
  mediaTickets: (...a) => tickets(...a),
  mediaDeleteTicket: async (path) => `ticket:${path}`,
}));

vi.mock("./customDecor", () => ({
  DECOR_IMAGE_PREFIX: "decor:",
  remoteIdOfDecor: (key) => (key === "decor:known" ? "d-1234" : undefined),
}));

/* HOW MANY UPLOADS ARE IN THE AIR AT ONCE. Counted here because it is
   the only place that can see it: a lane is not an object one can ask. */
let inFlight = 0;
let peakInFlight = 0;
/* Set by a test to make the container refuse. */
let putAnswer = null;

/* `fetch` is the only door to the container: PUT files, GET serves,
   DELETE removes. */
globalThis.fetch = vi.fn(async (url, options = {}) => {
  const path = String(url).replace(/^ticket:/, "");
  if (options.method === "PUT") {
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    /* A real upload takes time, and without some here every PUT would
       finish before the next lane ever started — the test would pass on
       a sequential implementation. */
    await new Promise((r) => setTimeout(r, 1));
    inFlight -= 1;
    if (putAnswer) return putAnswer;
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

const {
  noteMedia,
  mediaPending,
  remotePath,
  pushMedia,
  readMedia,
  dropMedia,
  forgetMedia,
  mediaTrouble,
} = await import("./media");

const ME = "3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("synchro-account", JSON.stringify(ME));
  vault.clear();
  container.clear();
  signedOut = false;
  /* Reset, not merely cleared: a test that makes the container refuse
     must not leave the refusal behind for the next one. */
  tickets.mockReset();
  tickets.mockImplementation(grantTickets);
  inFlight = 0;
  peakInFlight = 0;
  putAnswer = null;
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

  /* ============================================================
     THE BLOBS THAT WERE ALREADY THERE

     `noteMedia` is called where a blob is BORN, which says nothing about
     the ones born before the mirror existed. They sat in the vault, in
     no register, and no number of synchronisations moved them: the
     screenshots of a binder kept for a year simply never left. The
     decors were spared only because `pushNewDecor` re-notes them at
     every synchronisation.
     ============================================================ */
  it("sends the captures that were in the vault before any register", async () => {
    vault.set("still-abc-1", new Blob(["png"]));
    vault.set("still-abc-1-thumb", new Blob(["png"]));
    /* Nobody ever called `noteMedia` for these. */
    expect(mediaPending()).toBe(0);

    expect(await pushMedia()).toBe(2);
    expect(container.get(`p/${ME}/still-abc-1`)).toBeInstanceOf(Blob);
    expect(container.get(`p/${ME}/still-abc-1-thumb`)).toBeInstanceOf(Blob);
  });

  it("does not enrol a decor, whose address may not exist yet", async () => {
    /* An object added offline has no server identity, so `remotePath`
       answers `null`: enrolling it here would park it in the register
       for good. `pushNewDecor` notes it once it has an address. */
    vault.set("decor:brand-new", new Blob(["svg"]));

    expect(await pushMedia()).toBe(0);
    expect(mediaPending()).toBe(0);
  });

  it("recites the roll call only once", async () => {
    vault.set("still-abc-1", new Blob(["png"]));
    expect(await pushMedia()).toBe(1);

    tickets.mockClear();
    expect(await pushMedia()).toBe(0);
    expect(tickets).not.toHaveBeenCalled();
  });

  /* ============================================================
     THE BACKLOG DRAINS IN ONE GO

     One batch per synchronisation meant a binder catching up on a
     thousand screenshots needed twenty of them — which looks, from the
     shelf, exactly like a mirror that never finishes.
     ============================================================ */
  it("empties a queue longer than one batch in a single synchronisation", async () => {
    for (let i = 0; i < 120; i++) vault.set(`still-${i}`, new Blob(["png"]));

    expect(await pushMedia()).toBe(120);
    expect(mediaPending()).toBe(0);
    /* Three rounds of fifty, fifty, twenty — not one hundred and twenty
       requests for tickets. */
    expect(tickets).toHaveBeenCalledTimes(3);
  });

  it("stops going round when nothing is getting through", async () => {
    for (let i = 0; i < 120; i++) vault.set(`still-${i}`, new Blob(["png"]));
    tickets.mockRejectedValue(new Error("503"));

    expect(await pushMedia()).toBe(0);
    /* One refusal is enough to know: asking twice more would be three
       failures where the first said everything. */
    expect(tickets).toHaveBeenCalledTimes(1);
    expect(mediaPending()).toBe(120);
  });

  /* ============================================================
     THE BLOBS TRAVEL SEVERAL AT A TIME

     One PUT at a time made the catching-up as long as the sum of a
     thousand round trips, nearly all of it spent waiting. Several lanes
     is the fix; the ceiling is what keeps it from becoming the problem.
     ============================================================ */
  it("keeps several uploads in the air at once", async () => {
    for (let i = 0; i < 12; i++) vault.set(`still-${i}`, new Blob(["png"]));

    expect(await pushMedia()).toBe(12);
    /* Sequential would peak at one — this is the whole point. */
    expect(peakInFlight).toBeGreaterThan(1);
  });

  it("never exceeds its own ceiling", async () => {
    for (let i = 0; i < 60; i++) vault.set(`still-${i}`, new Blob(["png"]));

    await pushMedia();
    /* Four lanes, and a queue longer than the batch must not turn into
       sixty simultaneous uploads on somebody's telephone. */
    expect(peakInFlight).toBeLessThanOrEqual(4);
  });

  it("loses none of them, however they interleave", async () => {
    for (let i = 0; i < 60; i++) vault.set(`still-${i}`, new Blob([`png-${i}`]));

    expect(await pushMedia()).toBe(60);
    expect(mediaPending()).toBe(0);
    for (let i = 0; i < 60; i++) {
      expect(container.get(`p/${ME}/still-${i}`)).toBeInstanceOf(Blob);
    }
  });

  /* THE REASON NO LONGER DEPENDS ON WHO FINISHED LAST. Sequentially,
     "the last failure wins" was knowable; in lanes it is weather. */
  it("says nothing is wrong when the whole batch arrived", async () => {
    for (let i = 0; i < 12; i++) vault.set(`still-${i}`, new Blob(["png"]));

    await pushMedia();
    expect(mediaTrouble().kind).toBe("none");
  });

  it("quotes the container's refusal rather than guessing", async () => {
    for (let i = 0; i < 12; i++) vault.set(`still-${i}`, new Blob(["png"]));
    putAnswer = { ok: false, status: 403, statusText: "Server failed to authenticate" };

    expect(await pushMedia()).toBe(0);
    expect(mediaTrouble()).toEqual({
      kind: "refused",
      detail: "403 Server failed to authenticate",
    });
    /* Refused is not lost: they are still waiting for the next go. */
    expect(mediaPending()).toBe(12);
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
    expect(tickets).not.toHaveBeenCalled();
  });

  /* ============================================================
     A SCREENFUL OF IMAGES IS ONE REQUEST, NOT A SCREENFUL OF THEM

     The sending side batched from the first day; the tirage asked one
     ticket per image. A film's strip mounts every thumbnail at once, so
     twenty stills meant twenty requests — and the server's own ceiling
     is a hundred a minute. A binder arriving on a second computer, with
     everything still to fetch, went through it in seconds; from then on
     every ticket came back 429, and the screen said "stayed on the
     other device" over blobs that were sitting in the container.

     Measured on a real collection before the fix: 210 blobs missing
     locally, and of the hundred tickets that got through, a hundred
     answered with the file's size. Not one was actually absent.
     ============================================================ */
  it("asks for a screenful of tickets in one request", async () => {
    for (let i = 0; i < 20; i += 1) container.set(`p/${ME}/vue-${i}`, new Blob(["png"]));

    /* NOT ALL IN THE SAME TICK, because that is not how they arrive.
       Every caller reaches the ticket only after its own vault read has
       come back, so a strip's thumbnails land in twenty different ticks
       spread over a few milliseconds. A window closed on the next
       microtask batches exactly one of them — and the first version of
       this test, calling them all at once, could not see that. */
    const blobs = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        await new Promise((r) => setTimeout(r, i % 5));
        return readMedia(`vue-${i}`);
      })
    );

    expect(blobs.every((b) => b instanceof Blob)).toBe(true);
    expect(tickets).toHaveBeenCalledTimes(1);
    expect(tickets.mock.calls[0][0]).toHaveLength(20);
    /* And in READ, never in write: a tirage that asked for write tickets
       would hand out the right to overwrite what it came to read. */
    expect(tickets.mock.calls[0][1]).toBe("read");
  });

  it("cuts a batch the route would refuse", async () => {
    /* The route takes fifty at a time and answers 400 beyond. A shelf
       can hold more than fifty. */
    for (let i = 0; i < 120; i += 1) container.set(`p/${ME}/mur-${i}`, new Blob(["png"]));

    await Promise.all(Array.from({ length: 120 }, (_, i) => readMedia(`mur-${i}`)));

    expect(tickets).toHaveBeenCalledTimes(3);
    for (const [paths] of tickets.mock.calls) expect(paths.length).toBeLessThanOrEqual(50);
  });

  it("fetches from the container what the vault has not, and files it", async () => {
    container.set(`p/${ME}/elsewhere`, new Blob(["png"]));

    const blob = await readMedia("elsewhere");
    expect(blob).toBeInstanceOf(Blob);
    /* Filed on the way: the second read does not go back on the
       network. */
    expect(vault.get("elsewhere")).toBeInstanceOf(Blob);
    tickets.mockClear();
    await readMedia("elsewhere");
    expect(tickets).not.toHaveBeenCalled();
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
