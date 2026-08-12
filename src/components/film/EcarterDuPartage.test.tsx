/* ============================================================
   ÉCARTER UNE FICHE DU PARTAGE

   La visite promettait ce geste depuis longtemps et aucun bouton ne
   l'offrait. Ce qui compte le plus ici n'est pas qu'il marche, c'est
   qu'il SE TAISE quand il n'aurait rien à dire : un interrupteur de
   confidentialité qui paraît là où il n'a aucun effet apprend à ne plus
   le lire.
   ============================================================ */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EcarterDuPartage } from "./EcarterDuPartage";
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

const monter = (connecte = true) => render(<EcarterDuPartage film={film} connecte={connecte} />);

beforeEach(() => {
  for (const m of [hiddenCards, mySharing, hideCard, serverConfigured]) m.mockReset();
  serverConfigured.mockReturnValue(true);
  hiddenCards.mockResolvedValue({ ids: [] });
  mySharing.mockResolvedValue({ partage: "publique", jeton: null });
  hideCard.mockImplementation(async (_id: string, cachee: boolean) => ({ id: "f1", cachee }));
});

afterEach(() => vi.clearAllMocks());

describe("il ne paraît que quand il veut dire quelque chose", () => {
  it("se tait sans compte", async () => {
    monter(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(mySharing).not.toHaveBeenCalled();
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("se tait sans serveur réglé", async () => {
    serverConfigured.mockReturnValue(false);
    monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(mySharing).not.toHaveBeenCalled();
  });

  /* LE CAS QUI COMPTE. Quand la collection n'est montrée à personne,
     tout est déjà écarté : une case « dismiss du partage » y serait sans
     effet, et un interrupteur sans effet apprend à ne plus le lire. */
  it("se tait quand la collection n'est montrée à personne", async () => {
    mySharing.mockResolvedValue({ partage: "privee", jeton: null });
    monter();
    await waitFor(() => expect(mySharing).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("se tait quand le serveur ne répond pas", async () => {
    mySharing.mockRejectedValue(new Error("hors ligne"));
    monter();
    await waitFor(() => expect(mySharing).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("paraît dès que la collection est montrée par lien", async () => {
    mySharing.mockResolvedValue({ partage: "lien", jeton: "abc" });
    monter();
    expect(await screen.findByText("Ce que les autres en voient")).toBeInTheDocument();
  });
});

describe("il dit l'état, et le change", () => {
  it("montre une fiche visible comme visible", async () => {
    monter();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
    expect(screen.getByText(/paraît dans votre collection partagée/)).toBeInTheDocument();
  });

  it("montre une fiche déjà écartée comme écartée", async () => {
    hiddenCards.mockResolvedValue({ ids: ["f1"] });
    monter();
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
  });

  /* Une autre fiche écartée ne doit pas teindre celle-ci : la liste rend
     des identifiants, encore faut-il regarder le bon. */
  it("ne se croit pas écarté parce qu'une autre fiche l'est", async () => {
    hiddenCards.mockResolvedValue({ ids: ["f2", "f3"] });
    monter();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });

  it("écarte, et le dit", async () => {
    const user = userEvent.setup();
    monter();
    await user.click(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ }));
    expect(hideCard).toHaveBeenCalledWith("f1", true);
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
    /* Ce que l'utilisateur doit comprendre : la fiche reste chez lui. */
    expect(screen.getByText(/reste au mur/)).toBeInTheDocument();
  });

  it("remet une fiche écartée dans le partage", async () => {
    const user = userEvent.setup();
    hiddenCards.mockResolvedValue({ ids: ["f1"] });
    monter();
    await user.click(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ }));
    expect(hideCard).toHaveBeenCalledWith("f1", false);
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });
});
