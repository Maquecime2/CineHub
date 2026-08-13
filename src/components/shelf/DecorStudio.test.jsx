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

describe("the decor workshop", () => {
  it("writes into the right facet, one key at a time", async () => {
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
  it("knows how to take off a layer that is laid down", async () => {
    const view = patchViewDecor({}, "wall", { pattern: "pois" });
    const { onChange, user } = studio(view);
    const none = screen.getAllByLabelText("aucun");
    // the wallpaper row's is the second one
    await user.click(none[1]);
    expect(onChange).toHaveBeenCalledWith("wall", { pattern: null });
  });

  /* A setting that would touch nothing is not offered: ink only makes
     sense with a weave to tint, the finish only with a material to
     varnish. */
  it("hides the ink as long as no wallpaper is laid", () => {
    studio();
    expect(screen.queryByText("ENCRE DU MOTIF")).toBeNull();
  });

  it("shows the ink as soon as a weave is laid", () => {
    studio(patchViewDecor({}, "wall", { pattern: "damier" }));
    expect(screen.getByText("ENCRE DU MOTIF")).toBeTruthy();
  });

  it("hides the finish as long as no material is chosen", async () => {
    const { user } = studio();
    await user.click(screen.getByRole("button", { name: "PLANCHE" }));
    expect(screen.queryByText("FINITION")).toBeNull();
  });

  /* The way out, and what makes the exploring riskless. It does not show
     when there is nothing to undo. */
  it("offers the way back to the theme only if there is a decor", async () => {
    const name = "Effacer le décor et revenir au bois du thème";
    studio();
    expect(screen.queryByTitle(name)).toBeNull();

    const { onReset, user } = studio(patchViewDecor({}, "plank", { material: "verre" }));
    await user.click(screen.getByTitle(name));
    expect(onReset).toHaveBeenCalled();
  });
});
