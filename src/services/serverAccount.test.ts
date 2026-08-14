import { describe, it, expect, beforeEach, vi } from "vitest";

/* ============================================================
   THE IDENTIFIER IS WRITTEN DOWN

   `synchro-account` had two readers and no writer. It was read at the
   top of `server.ts`, as the hunch that spares somebody the flash of "it
   takes an account" on every reload; and it was read by
   `media.remotePath`, which builds the private prefix
   `p/<person id>/<key>` out of it.

   With nobody writing it, the second reader answered `null` for every
   poster and every screenshot: no address, so no ticket asked for, so
   nothing uploaded — and not one error anywhere, since a blob with no
   address is a perfectly ordinary thing (a decor added offline is one).
   The decors went up regardless, their branch reading a decor's server
   id and never this one. Décors yes, captures never: that was the whole
   symptom, and it survived every other explanation.

   So these two tests are not about a cache. They are about the one line
   that makes a private blob addressable at all.
   ============================================================ */

const ME = "3f1a2b4c-5d6e-4f70-8192-a3b4c5d6e7f8";

vi.mock("./customDecor", () => ({
  DECOR_IMAGE_PREFIX: "decor:",
  remoteIdOfDecor: () => undefined,
}));

vi.mock("../db", () => ({
  putImage: async () => {},
  getImage: async () => null,
  deleteImage: async () => {},
  allImageKeys: async () => [],
}));

globalThis.fetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  /* The envelope `contract.readPerson` expects — flattening it here is
     exactly the drift that file exists to prevent. */
  json: async () => ({ person: { id: ME, pseudo: "maquecime" } }),
})) as unknown as typeof fetch;

const { whoAmI, signOut } = await import("./server");
const { remotePath } = await import("./media");

beforeEach(() => {
  localStorage.clear();
});

describe("the account identifier on disk", () => {
  it("gives a screenshot an address once somebody is known", async () => {
    /* Before the round trip there is nobody, and no address — which is
       correct, not a failure. */
    expect(remotePath("still-abc-1")).toBeNull();

    await whoAmI();

    expect(remotePath("still-abc-1")).toBe(`p/${ME}/still-abc-1`);
  });

  it("takes the address back when the session closes", async () => {
    await whoAmI();
    await signOut();

    /* Signing out must not leave the previous person's prefix behind:
       the next blob would be filed under somebody who is gone, and the
       server would refuse the ticket — rightly. */
    expect(remotePath("still-abc-1")).toBeNull();
  });
});

/* ============================================================
   A SERVER THAT CANNOT ANSWER HAS NOT SAID WE ARE NOBODY

   `whoAmI` erased the account on every reply that was not a network
   silence — a 429, a 500, a gateway in trouble all meant "you have no
   account". The 429 is the one that happened: the general ceiling is a
   hundred requests a minute, a binder arriving on a second computer
   goes through it in seconds, and `/me` was among the refused.

   What followed was silent and total. `accountOpen()` went false, so
   `pullMedia` returned before making a single request: not one ticket
   left the page, and every screenshot on screen said it had stayed on
   the other device — with the blobs sitting in the container all along.
   ============================================================ */
describe("what counts as being nobody", () => {
  const answer = (status: number) => {
    globalThis.fetch = vi.fn(async () => ({
      ok: status < 400,
      status,
      json: async () => ({ person: { id: ME, pseudo: "maquecime" } }),
    })) as unknown as typeof fetch;
  };

  /* THROUGH A REAL TRANSITION, not straight to 200. `noteAccount` writes
     nothing when the value has not changed, so a test that merely calls
     `whoAmI` after `localStorage.clear()` leaves the disk empty while
     the module still believes it wrote — and then measures nothing. */
  const signIn = async () => {
    answer(401);
    await whoAmI();
    answer(200);
    await whoAmI();
  };

  it("keeps the account when the server is merely refusing the traffic", async () => {
    await signIn();

    answer(429);
    await expect(whoAmI()).rejects.toThrow();
    /* THE ADDRESS SURVIVES, which is the whole point: without it there
       is no `p/<id>/<key>`, and the screenshots stop being asked for. */
    expect(remotePath("still-abc-1")).toBe(`p/${ME}/still-abc-1`);
  });

  it("keeps it through a server that has broken down", async () => {
    await signIn();

    answer(500);
    await expect(whoAmI()).rejects.toThrow();
    expect(remotePath("still-abc-1")).toBe(`p/${ME}/still-abc-1`);
  });

  it("lets it go when the session itself is refused", async () => {
    await signIn();

    /* 401 is the server answering the question: nobody. Keeping the
       hunch here would show a name to somebody whose session expired. */
    answer(401);
    expect(await whoAmI()).toBeNull();
    expect(remotePath("still-abc-1")).toBeNull();
  });
});
