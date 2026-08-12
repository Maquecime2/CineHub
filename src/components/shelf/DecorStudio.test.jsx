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

  /* "Nothing" is a choice, not an absence of button: without it, one lays
     a wallpaper and can no longer remove it. Null is what `patchViewDecor`
     understands as an erasure. */
  it("sait retirer une couche posée", async () => {
    const view = patchViewDecor({}, "wall", { pattern: "pois" });
    const { onChange, user } = studio(view);
    const aucuns = screen.getAllByLabelText("aucun");
    // the wallpaper row's is the second one
    await user.click(aucuns[1]);
    expect(onChange).toHaveBeenCalledWith("wall", { pattern: null });
  });

  /* A setting that would touch nothing is not offered: ink only makes
     sense with a weave to tint, the finish only with a material to
     varnish. */
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

  /* The way out, and what makes the exploring riskless. It does not show
     when there is nothing to undo. */
  it("n'offre le retour au thème que s'il y a un décor", async () => {
    const nom = "Effacer le décor et revenir au bois du thème";
    studio();
    expect(screen.queryByTitle(nom)).toBeNull();

    const { onReset, user } = studio(patchViewDecor({}, "plank", { material: "verre" }));
    await user.click(screen.getByTitle(nom));
    expect(onReset).toHaveBeenCalled();
  });
});
