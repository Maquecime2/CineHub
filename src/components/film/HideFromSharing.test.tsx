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

describe("il ne paraît que quand il veut dire quelque chose", () => {
  it("se tait sans compte", async () => {
    build(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(mySharing).not.toHaveBeenCalled();
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("se tait sans serveur réglé", async () => {
    serverConfigured.mockReturnValue(false);
    build();
    await new Promise((r) => setTimeout(r, 20));
    expect(mySharing).not.toHaveBeenCalled();
  });

  /* THE CASE THAT MATTERS. When the collection is shown to nobody,
     everything is already set aside: a "set aside from sharing" box would
     have no effect there, and a switch with no effect teaches you to stop
     reading it. */
  it("se tait quand la collection n'est montrée à personne", async () => {
    mySharing.mockResolvedValue({ partage: "privee", token: null });
    build();
    await waitFor(() => expect(mySharing).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("se tait quand le serveur ne répond pas", async () => {
    mySharing.mockRejectedValue(new Error("hors ligne"));
    build();
    await waitFor(() => expect(mySharing).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("paraît dès que la collection est montrée par lien", async () => {
    mySharing.mockResolvedValue({ partage: "lien", token: "abc" });
    build();
    expect(await screen.findByText("Ce que les autres en voient")).toBeInTheDocument();
  });
});

describe("il dit l'état, et le change", () => {
  it("montre une fiche visible comme visible", async () => {
    build();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
    expect(screen.getByText(/paraît dans votre collection partagée/)).toBeInTheDocument();
  });

  it("montre une fiche déjà écartée comme écartée", async () => {
    hiddenCards.mockResolvedValue({ ids: ["f1"] });
    build();
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
  });

  /* Another card set aside must not tint this one: the list returns
     identifiers, and one still has to look at the right one. */
  it("ne se croit pas écarté parce qu'une autre fiche l'est", async () => {
    hiddenCards.mockResolvedValue({ ids: ["f2", "f3"] });
    build();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });

  it("écarte, et le dit", async () => {
    const user = userEvent.setup();
    build();
    await user.click(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ }));
    expect(hideCard).toHaveBeenCalledWith("f1", true);
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
    /* What the user must understand: the card stays at home. */
    expect(screen.getByText(/reste au mur/)).toBeInTheDocument();
  });

  it("remet une fiche écartée dans le partage", async () => {
    const user = userEvent.setup();
    hiddenCards.mockResolvedValue({ ids: ["f1"] });
    build();
    await user.click(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ }));
    expect(hideCard).toHaveBeenCalledWith("f1", false);
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });
});
