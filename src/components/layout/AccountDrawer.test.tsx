/* ============================================================
   THE ACCOUNT DRAWER — and above all: the right to change one's mind

   This file did not exist, and that is part of the problem it fixes.
   `Elsewhere` knew how to silence the author of a review — a gesture
   tested end to end on the server side — and nothing knew how to undo
   it: no screen called `unblock`, none listed `myBlocks`. The gap showed
   in no suite, because the drawer was not mounted a single time by a
   test.

   We do not talk to the server here: what we put to the test is the
   drawer, not the routes. Those have their own tests, in `server/test`.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountDrawer } from "./AccountDrawer";
import type { SyncReport } from "../../services/sync";

const myBlocks = vi.fn();
const unblock = vi.fn();

vi.mock("../../services/server", () => ({
  ADDRESS: "http://serveur.test",
  myBlocks: (...a: unknown[]) => myBlocks(...a),
  unblock: (...a: unknown[]) => unblock(...a),
  /* The rest of the module: the drawer imports these, it does not call
     them in these scenarios. Doubling them empty is better than loading
     the real module, which would talk to the network on mount. */
  deleteMyAccount: vi.fn(),
  myData: vi.fn(),
  signIn: vi.fn(),
  setSharing: vi.fn(async () => ({ partage: "privee", token: null })),
  mySharing: vi.fn(async () => ({ partage: "privee", token: null })),
  /* "Where one agrees to be ranked" reads the purse on mount, like the
     sharing section just above. It answers nothing here: the section
     then stays quiet, exactly as it does offline. */
  myPurse: vi.fn(async () => {
    throw new Error("hors ligne");
  }),
  setLadder: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  /* "My devices" reads its keys on mount. It answers nothing here — the
     section then stays quiet, exactly as it does offline, and these
     scenarios keep the drawer they were written against. */
  myKeys: vi.fn(async () => {
    throw new Error("hors ligne");
  }),
  addKey: vi.fn(),
  forgetKey: vi.fn(),
  makePairingCode: vi.fn(),
  claimPairingCode: vi.fn(),
}));

vi.mock("../../services/push", () => ({
  /* No notifications possible: the section stays quiet, and does not
     enter this test's path. */
  pushState: vi.fn(async () => ({ possible: false, subscribed: false, denied: false })),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

vi.mock("../../services/sync", async (real) => ({
  ...(await real<Record<string, unknown>>()),
  forgetSync: vi.fn(),
}));

const report = (signedIn: boolean): SyncReport =>
  ({
    state: signedIn ? "up-to-date" : "no-account",
    person: signedIn ? { id: "1", pseudo: "varda" } : null,
    at: null,
    pending: 0,
  }) as SyncReport;

const build = (signedIn = true) =>
  render(
    <AccountDrawer
      report={report(signedIn)}
      onClose={vi.fn()}
      onSync={vi.fn()}
      onAccountChange={vi.fn()}
    />
  );

beforeEach(() => {
  myBlocks.mockReset();
  unblock.mockReset();
  myBlocks.mockResolvedValue({ blocks: [] });
  unblock.mockResolvedValue({ pseudo: "", blocked: false });
});

afterEach(() => vi.clearAllMocks());

describe("those one has silenced", () => {
  it("names them, one by one", async () => {
    myBlocks.mockResolvedValue({ blocks: ["genant", "penible"] });
    build();
    expect(await screen.findByText("genant")).toBeInTheDocument();
    expect(screen.getByText("penible")).toBeInTheDocument();
    expect(screen.getByText("Ceux que vous avez fait taire")).toBeInTheDocument();
  });

  /* A "nobody" heading on such a subject teaches nothing: there is
     nothing to undo, therefore nothing to show. */
  it("stays quiet when there is nobody", async () => {
    build();
    await waitFor(() => expect(myBlocks).toHaveBeenCalled());
    expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument();
  });

  /* Offline, or with no server: we stay quiet too. An error shown for a
     heading that may have nothing to say is noise. */
  it("stays quiet when the server does not answer", async () => {
    myBlocks.mockRejectedValue(new Error("hors ligne"));
    build();
    await waitFor(() => expect(myBlocks).toHaveBeenCalled());
    expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument();
  });

  /* THE MISSING GESTURE. Without it, silencing somebody was without
     return — and `unblock` was called by no screen. */
  it("gives speech back, and rereads the list afterwards", async () => {
    const user = userEvent.setup();
    myBlocks.mockResolvedValueOnce({ blocks: ["genant"] });
    myBlocks.mockResolvedValue({ blocks: [] });
    build();

    await user.click(await screen.findByRole("button", { name: /Rendre la parole à genant/ }));
    expect(unblock).toHaveBeenCalledWith("genant");
    /* The list is re-read: the heading vanishes since it is empty. */
    await waitFor(() =>
      expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument()
    );
  });

  /* What unblocking does NOT do must be written: the server resubscribes
     nobody, and letting anyone believe otherwise would be worse than
     saying nothing. */
  it("says that giving speech back does not tie the link again", async () => {
    myBlocks.mockResolvedValue({ blocks: ["genant"] });
    build();
    expect(await screen.findByText(/ne le renoue pas/)).toBeInTheDocument();
  });

  /* With no account there are no blocks to show — and above all no
     request to make. */
  it("asks for nothing as long as no account is open", async () => {
    build(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(myBlocks).not.toHaveBeenCalled();
  });
});
