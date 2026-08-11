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

const fichesCachees = vi.fn();
const monPartage = vi.fn();
const cacherLaFiche = vi.fn();
const serveurConfigure = vi.fn(() => true);

vi.mock("../../services/serveur", () => ({
  fichesCachees: (...a: unknown[]) => fichesCachees(...a),
  monPartage: (...a: unknown[]) => monPartage(...a),
  cacherLaFiche: (...a: unknown[]) => cacherLaFiche(...a),
  serveurConfigure: () => serveurConfigure(),
}));

const film = makeFilm({ id: "f1", title: "Le Samouraï" });

const monter = (connecte = true) => render(<EcarterDuPartage film={film} connecte={connecte} />);

beforeEach(() => {
  for (const m of [fichesCachees, monPartage, cacherLaFiche, serveurConfigure]) m.mockReset();
  serveurConfigure.mockReturnValue(true);
  fichesCachees.mockResolvedValue({ ids: [] });
  monPartage.mockResolvedValue({ partage: "publique", jeton: null });
  cacherLaFiche.mockImplementation(async (_id: string, cachee: boolean) => ({ id: "f1", cachee }));
});

afterEach(() => vi.clearAllMocks());

describe("il ne paraît que quand il veut dire quelque chose", () => {
  it("se tait sans compte", async () => {
    monter(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(monPartage).not.toHaveBeenCalled();
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("se tait sans serveur réglé", async () => {
    serveurConfigure.mockReturnValue(false);
    monter();
    await new Promise((r) => setTimeout(r, 20));
    expect(monPartage).not.toHaveBeenCalled();
  });

  /* LE CAS QUI COMPTE. Quand la collection n'est montrée à personne,
     tout est déjà écarté : une case « écarter du partage » y serait sans
     effet, et un interrupteur sans effet apprend à ne plus le lire. */
  it("se tait quand la collection n'est montrée à personne", async () => {
    monPartage.mockResolvedValue({ partage: "privee", jeton: null });
    monter();
    await waitFor(() => expect(monPartage).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("se tait quand le serveur ne répond pas", async () => {
    monPartage.mockRejectedValue(new Error("hors ligne"));
    monter();
    await waitFor(() => expect(monPartage).toHaveBeenCalled());
    expect(screen.queryByText("Ce que les autres en voient")).not.toBeInTheDocument();
  });

  it("paraît dès que la collection est montrée par lien", async () => {
    monPartage.mockResolvedValue({ partage: "lien", jeton: "abc" });
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
    fichesCachees.mockResolvedValue({ ids: ["f1"] });
    monter();
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
  });

  /* Une autre fiche écartée ne doit pas teindre celle-ci : la liste rend
     des identifiants, encore faut-il regarder le bon. */
  it("ne se croit pas écarté parce qu'une autre fiche l'est", async () => {
    fichesCachees.mockResolvedValue({ ids: ["f2", "f3"] });
    monter();
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });

  it("écarte, et le dit", async () => {
    const user = userEvent.setup();
    monter();
    await user.click(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ }));
    expect(cacherLaFiche).toHaveBeenCalledWith("f1", true);
    expect(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ })).toBeInTheDocument();
    /* Ce que l'utilisateur doit comprendre : la fiche reste chez lui. */
    expect(screen.getByText(/reste au mur/)).toBeInTheDocument();
  });

  it("remet une fiche écartée dans le partage", async () => {
    const user = userEvent.setup();
    fichesCachees.mockResolvedValue({ ids: ["f1"] });
    monter();
    await user.click(await screen.findByRole("button", { name: /ÉCARTÉE DU PARTAGE/ }));
    expect(cacherLaFiche).toHaveBeenCalledWith("f1", false);
    expect(await screen.findByRole("button", { name: /ÉCARTER DU PARTAGE/ })).toBeInTheDocument();
  });
});
