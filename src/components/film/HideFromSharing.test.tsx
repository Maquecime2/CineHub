/* ============================================================
   SETTING A CARD ASIDE FROM SHARING

   The tour had promised this gesture for a long time and no button
   offered it. What matters most here is not that it works, it is that it
   STAYS QUIET when it would have nothing to say: a privacy switch that
   appears where it has no effect teaches you to stop reading it.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HideFromSharing } from "./HideFromSharing";
import { makeFilm } from "../../domain/film";

const hiddenCards = vi.fn();
const mySharing = vi.fn();
const hideCard = vi.fn();
const serverConfigured = vi.fn(() => true);

vi.mock("../../services/server", () => ({
  hiddenCards: (...a: unknown[]) => hiddenCards(...a),
  mySharing: (...a: unknown[]) => mySharing(...a),
  hideCard: (...a: unknown[]) => hideCard(...a),
  serverConfigured: () => serverConfigured(),
}));

const film = makeFilm({ id: "f1", title: "Le Samouraï" });

const build = (signedIn = true) => render(<HideFromSharing film={film} signedIn={signedIn} />);

beforeEach(() => {
  for (const m of [hiddenCards, mySharing, hideCard, serverConfigured]) m.mockReset();
  serverConfigured.mockReturnValue(true);
  hiddenCards.mockResolvedValue({ ids: [] });
  mySharing.mockResolvedValue({ partage: "publique", token: null });
  hideCard.mockImplementation(async (_id: string, cachee: boolean) => ({ id: "f1", cachee }));
});

afterEach(() => vi.clearAllMocks());

describe("it only appears when it means something", () => {
  it("stays quiet with no account", async () => {
    build(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(mySharing).not.toHaveBeenCalled();
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("stays quiet with no server set", async () => {
    serverConfigured.mockReturnValue(false);
    build();
    await new Promise((r) => setTimeout(r, 20));
    expect(mySharing).not.toHaveBeenCalled();
  });

  /* THE CASE THAT MATTERS. When the collection is shown to nobody,
     everything is already set aside: a "set aside from sharing" box would
     have no effect there, and a switch with no effect teaches you to stop
     reading it. */
  it("stays quiet when the collection is shown to nobody", async () => {
    mySharing.mockResolvedValue({ partage: "privee", token: null });
    build();
    await waitFor(() => expect(mySharing).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("stays quiet when the server does not answer", async () => {
    mySharing.mockRejectedValue(new Error("hors ligne"));
    build();
    await waitFor(() => expect(mySharing).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("appears as soon as the collection is shown by link", async () => {
    mySharing.mockResolvedValue({ partage: "lien", token: "abc" });
    build();
    expect(await screen.findByText("Ce que les autres en voient")).toBeInTheDocument();
  });
});

describe("it says the state, and changes it", () => {
  it("shows a visible card as visible", async () => {
    build();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
    expect(screen.getByText(/paraît dans votre collection partagée/)).toBeInTheDocument();
  });

  it("shows a card already set aside as set aside", async () => {
    hiddenCards.mockResolvedValue({ ids: ["f1"] });
    build();
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
  });

  /* Another card set aside must not tint this one: the list returns
     identifiers, and one still has to look at the right one. */
  it("does not believe itself set aside because another card is", async () => {
    hiddenCards.mockResolvedValue({ ids: ["f2", "f3"] });
    build();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });

  it("sets aside, and says so", async () => {
    const user = userEvent.setup();
    build();
    await user.click(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ }));
    expect(hideCard).toHaveBeenCalledWith("f1", true);
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
    /* What the user must understand: the card stays at home. */
    expect(screen.getByText(/reste au mur/)).toBeInTheDocument();
  });

  it("puts a card that was set aside back into the sharing", async () => {
    const user = userEvent.setup();
    hiddenCards.mockResolvedValue({ ids: ["f1"] });
    build();
    await user.click(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ }));
    expect(hideCard).toHaveBeenCalledWith("f1", false);
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });
});
