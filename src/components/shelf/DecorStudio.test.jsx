import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecorStudio } from "./DecorStudio";
import { patchViewDecor } from "../../shelf-views";

const studio = (view = {}) => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(<DecorStudio view={view} onChange={onChange} onReset={onReset} onClose={vi.fn()} />);
  return { onChange, onReset, user: userEvent.setup() };
};

describe("l'atelier déco", () => {
  it("écrit dans la bonne facette, une clé à la fois", async () => {
    const { onChange, user } = studio();
    await user.click(screen.getByLabelText("Terracotta"));
    expect(onChange).toHaveBeenCalledWith("wall", { paint: "terracotta" });

    await user.click(screen.getByRole("button", { name: "PLANCHE" }));
    await user.click(screen.getByLabelText("Laiton"));
    expect(onChange).toHaveBeenCalledWith("plank", { material: "laiton" });
  });

  /* « Rien » est un choix, pas une absence de bouton : sans lui, on pose
     un papier peint et on ne peut plus l'enlever. Le nul est ce que
     `patchViewDecor` comprend comme un effacement. */
  it("sait retirer une couche posée", async () => {
    const view = patchViewDecor({}, "wall", { pattern: "pois" });
    const { onChange, user } = studio(view);
    const aucuns = screen.getAllByLabelText("aucun");
    // celui de la rangée des papiers peints est le deuxième
    await user.click(aucuns[1]);
    expect(onChange).toHaveBeenCalledWith("wall", { pattern: null });
  });

  /* Un réglage qui ne toucherait à rien ne s'offre pas : l'encre n'a de
     sens qu'avec une trame à teinter, la finition qu'avec une matière à
     vernir. */
  it("cache l'encre tant qu'aucun papier peint n'est posé", () => {
    studio();
    expect(screen.queryByText("ENCRE DU MOTIF")).toBeNull();
  });

  it("montre l'encre dès qu'une trame est posée", () => {
    studio(patchViewDecor({}, "wall", { pattern: "damier" }));
    expect(screen.getByText("ENCRE DU MOTIF")).toBeTruthy();
  });

  it("cache la finition tant qu'aucune matière n'est choisie", async () => {
    const { user } = studio();
    await user.click(screen.getByRole("button", { name: "PLANCHE" }));
    expect(screen.queryByText("FINITION")).toBeNull();
  });

  /* La porte de sortie, et ce qui rend l'exploration sans risque. Elle
     ne s'affiche pas quand il n'y a rien à défaire. */
  it("n'offre le retour au thème que s'il y a un décor", async () => {
    const nom = "Effacer le décor et revenir au bois du thème";
    studio();
    expect(screen.queryByTitle(nom)).toBeNull();

    const { onReset, user } = studio(patchViewDecor({}, "plank", { material: "verre" }));
    await user.click(screen.getByTitle(nom));
    expect(onReset).toHaveBeenCalled();
  });
});
