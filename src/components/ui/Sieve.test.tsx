import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sieve } from "./Sieve";

/* ============================================================
   UN TAMIS QUI EN ACCEPTE PLUSIEURS

   Ce qui est éprouvé ici est ce qui se casse en silence :

   — LE CUMUL. C'était un choix unique déguisé en rangée de pastilles ;
     cocher une seconde case doit ajouter, jamais remplacer ;
   — VIDER. Sans un geste à part, revenir à « tout » demande autant de
     clics qu'on en a faits ;
   — LE REPLI. Le bouton doit dire ce qu'on a retenu SANS être ouvert,
     sinon on l'ouvre juste pour savoir où l'on en est ;
   — RIEN À TAMISER, RIEN À MONTRER. Un tamis vide est un bouton mort.
   ============================================================ */

afterEach(cleanup);

const GENRES = [
  { value: "policier", label: "Policier" },
  { value: "noir", label: "Noir" },
  { value: "western", label: "Western" },
];

const show = (chosen: string[] = [], onChange = vi.fn()) => {
  render(<Sieve label="GENRE" options={GENRES} chosen={chosen} onChange={onChange} />);
  return onChange;
};

describe("the sieve", () => {
  it("adds a box rather than replacing the one before", async () => {
    const user = userEvent.setup();
    const onChange = show(["policier"]);
    await user.click(screen.getByRole("button", { name: /GENRE/ }));
    await user.click(screen.getByRole("option", { name: "Noir" }));
    expect(onChange).toHaveBeenCalledWith(["policier", "noir"]);
  });

  it("takes a box off when it is already lit", async () => {
    const user = userEvent.setup();
    const onChange = show(["policier", "noir"]);
    await user.click(screen.getByRole("button", { name: /GENRE/ }));
    await user.click(screen.getByRole("option", { name: "Policier" }));
    expect(onChange).toHaveBeenCalledWith(["noir"]);
  });

  it("empties in ONE gesture, and offers it only when there is something to empty", async () => {
    const user = userEvent.setup();
    const onChange = show(["policier", "noir"]);
    await user.click(screen.getByRole("button", { name: /GENRE/ }));
    await user.click(screen.getByRole("button", { name: "TOUT MONTRER" }));
    expect(onChange).toHaveBeenCalledWith([]);

    cleanup();
    show([]);
    await user.click(screen.getByRole("button", { name: /GENRE/ }));
    expect(screen.queryByRole("button", { name: "TOUT MONTRER" })).not.toBeInTheDocument();
  });

  it("says what it holds while FOLDED", async () => {
    /* Un tamis qu'il faut ouvrir pour savoir où l'on en est ne fait pas
       gagner la place qu'il prétend rendre. */
    show([]);
    expect(screen.getByRole("button", { name: /tous/ })).toBeInTheDocument();
    cleanup();
    show(["policier"]);
    expect(screen.getByRole("button", { name: /Policier/ })).toBeInTheDocument();
    cleanup();
    show(["policier", "noir"]);
    expect(screen.getByRole("button", { name: /2 choisis/ })).toBeInTheDocument();
  });

  it("draws nothing at all when there is nothing to sieve", () => {
    const { container } = render(
      <Sieve label="GENRE" options={[]} chosen={[]} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("announces that several boxes may be lit", async () => {
    const user = userEvent.setup();
    show(["policier"]);
    const door = screen.getByRole("button", { name: /GENRE/ });
    expect(door).toHaveAttribute("aria-haspopup", "listbox");
    await user.click(door);
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByRole("option", { name: "Policier" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
