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
  setSharing: vi.fn(async () => ({ partage: "privee", jeton: null })),
  mySharing: vi.fn(async () => ({ partage: "privee", jeton: null })),
  signOut: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("../../services/push", () => ({
  /* No notifications possible: the section stays quiet, and does not
     enter this test's path. */
  pushState: vi.fn(async () => ({ possible: false, subscribed: false, denied: false })),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

vi.mock("../../services/sync", async (vrai) => ({
  ...(await vrai<Record<string, unknown>>()),
  forgetSync: vi.fn(),
}));

const report = (connecté: boolean): SyncReport =>
  ({
    state: connecté ? "up-to-date" : "no-account",
    person: connecté ? { id: "1", pseudo: "varda" } : null,
    at: null,
    pending: 0,
  }) as SyncReport;

const monter = (connecté = true) =>
  render(
    <AccountDrawer
      report={report(connecté)}
      onFermer={vi.fn()}
      onSync={vi.fn()}
      onChangement={vi.fn()}
    />
  );

beforeEach(() => {
  myBlocks.mockReset();
  unblock.mockReset();
  myBlocks.mockResolvedValue({ blocages: [] });
  unblock.mockResolvedValue({ pseudo: "", bloque: false });
});

afterEach(() => vi.clearAllMocks());

describe("ceux qu'on a fait taire", () => {
  it("les nomme, un par un", async () => {
    myBlocks.mockResolvedValue({ blocages: ["genant", "penible"] });
    monter();
    expect(await screen.findByText("genant")).toBeInTheDocument();
    expect(screen.getByText("penible")).toBeInTheDocument();
    expect(screen.getByText("Ceux que vous avez fait taire")).toBeInTheDocument();
  });

  /* A "nobody" heading on such a subject teaches nothing: there is
     nothing to undo, therefore nothing to show. */
  it("se tait quand il n'y a personne", async () => {
    monter();
    await waitFor(() => expect(myBlocks).toHaveBeenCalled());
    expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument();
  });

  /* Offline, or with no server: we stay quiet too. An error shown for a
     heading that may have nothing to say is noise. */
  it("se tait quand le serveur ne répond pas", async () => {
    myBlocks.mockRejectedValue(new Error("hors ligne"));
    monter();
    await waitFor(() => expect(myBlocks).toHaveBeenCalled());
    expect(screen.queryByText("Ceux que vous avez fait taire")).not.toBeInTheDocument();
  });

  /* THE MISSING GESTURE. Without it, silencing somebody was without
     return — and `unblock` was called by no screen. */
  it("rend la parole, et relit la liste ensuite", async () => {
    const user = userEvent.setup();
    myBlocks.mockResolvedValueOnce({ blocages: ["genant"] });
    myBlocks.mockResolvedValue({ blocages: [] });
    monter();

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
  it("dit que rendre la parole ne renoue pas le lien", async () => {
    myBlocks.mockResolvedValue({ blocages: ["genant"] });
    monter();
    expect(await screen.findByText(/ne le renoue pas/)).toBeInTheDocument();
  });

  /* With no account there are no blocks to show — and above all no
     request to make. */
  it("ne demande rien tant qu'aucun compte n'est ouvert", async () => {
    monter(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(myBlocks).not.toHaveBeenCalled();
  });
});
