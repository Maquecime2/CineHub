import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/* ============================================================
   WHO ONE IS, BETWEEN TWO ROUND TRIPS

   Signing in left the drawer showing the sign-up form — handle field,
   "create an account", "sign in" — to somebody who had just signed in,
   and the lists view went on saying "it takes an account". It lasted
   until a whole synchronisation had pulled, pushed and come back: on a
   full collection, seconds; offline, for ever.

   The cause was that `report.person` was the only place the answer lived
   and only `synchronise` wrote there. Three moments were wrong, and each
   has a test below:

     - the instant a sign-in succeeds, before any round trip;
     - a reload, before the first round trip;
     - a round trip that could NOT BE MADE, which used to be read as
       "nobody" and logged people out of their own screen.

   And one that must stay right: a server that ANSWERS 401 does mean
   nobody, and the name must go.
   ============================================================ */

const fake = {
  report: null as unknown,
  person: { id: "p1", pseudo: "varda" } as { id: string; pseudo: string } | null,
};

vi.mock("../services/sync", () => ({
  synchronise: async () => fake.report,
  lastReport: () => ({ at: null }),
  pending: () => 0,
}));

vi.mock("../services/server", () => ({
  serverConfigured: () => true,
  lastKnownPerson: () => fake.person,
}));

const { useSync } = await import("./useSync");

const mount = () => renderHook(() => useSync(false, vi.fn(), vi.fn()));

beforeEach(() => {
  fake.person = { id: "p1", pseudo: "varda" };
  fake.report = { state: "up-to-date", person: fake.person, at: 1, pending: 0 };
});

describe("who one is", () => {
  it("is known the instant one signs in, with no round trip", () => {
    fake.person = null; // nothing on disk: this is a first sign-in
    const { result } = mount();
    expect(result.current.report.person).toBeNull();

    act(() => result.current.noteAccount({ id: "p2", pseudo: "chantal" } as never));

    /* The drawer reads `report.person`: before this, it went on offering
       to create an account to somebody who had just made one. */
    expect(result.current.report.person).toMatchObject({ pseudo: "chantal" });
    expect(result.current.report.state).toBe("running");
  });

  it("is known on a reload, before the first round trip", () => {
    const { result } = mount();
    expect(result.current.report.person).toMatchObject({ pseudo: "varda" });
    /* And NOT "no-account", which the drawer words as "everything stays
       here" — that is, "you have no account". */
    expect(result.current.report.state).toBe("running");
  });

  it("survives a round trip that could not be made", async () => {
    /* `sync.ts` answers "waiting" with no person when the server said
       nothing at all. Reading that as "signed out" is what logged people
       out every time a train went into a tunnel. */
    fake.report = { state: "waiting", person: null, at: null, pending: 0 };
    const { result } = mount();

    await act(async () => {
      await result.current.synchronise();
    });

    await waitFor(() => expect(result.current.report.state).toBe("waiting"));
    expect(result.current.report.person).toMatchObject({ pseudo: "varda" });
  });

  it("goes when the server answers that we are nobody", async () => {
    /* A REFUSAL IS NOT A SILENCE. The server spoke, and said 401: the
       hunch is wrong, and keeping it would show a name to somebody whose
       session has expired. */
    fake.report = { state: "no-account", person: null, at: null, pending: 0 };
    const { result } = mount();

    await act(async () => {
      await result.current.synchronise();
    });

    await waitFor(() => expect(result.current.report.person).toBeNull());
    expect(result.current.report.state).toBe("no-account");
  });

  it("forgets the person on signing out", () => {
    const { result } = mount();
    act(() => result.current.noteAccount(null));
    expect(result.current.report.person).toBeNull();
    expect(result.current.report.state).toBe("no-account");
  });
});
