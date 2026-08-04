import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerRowField } from "./layout";

const TITLE = "OBJETS SUR CETTE LIGNE";

const field = (value, max) => {
  const onChange = vi.fn();
  const view = render(<PerRowField title={TITLE} value={value} max={max} onChange={onChange} />);
  return {
    onChange,
    user: userEvent.setup(),
    input: () => screen.getByLabelText(TITLE),
    auto: () => screen.getByRole("button", { name: "auto" }),
    rerender: (next) =>
      view.rerender(<PerRowField title={TITLE} value={next} max={max} onChange={onChange} />),
  };
};

describe("PerRowField — auto, ou un nombre qu'on écrit", () => {
  it("laisse écrire n'importe quel compte, pas seulement ceux d'une liste", () => {
    const { onChange } = field(6);
    // 7 et 20 n'existaient dans aucun des sept boutons d'avant
    expect(screen.getByLabelText(TITLE)).toHaveValue(6);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ne remonte le compte qu'à la validation, jamais à la frappe", async () => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), "12");
    // sans cette retenue, le rayon se replierait a 1 puis a 12 sous les doigts
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(12);
  });

  it("valide aussi en quittant le champ", async () => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), "7");
    await user.tab();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("Échap rend au champ le compte réglé", async () => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), "99{Escape}");
    expect(input()).toHaveValue(6);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["0", "-3", "   "])("refuse « %s » et rend la main au réglage", async (bad) => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), `${bad}{Enter}`);
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(6);
  });

  it("ramène au possible plutôt que de refuser, quand un maximum s'impose", async () => {
    const { onChange, user, input } = field(1, 2);
    await user.clear(input());
    await user.type(input(), "10{Enter}");
    // le tiroir ne tient que deux boîtiers : on corrige la main, on ne la repousse pas
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(input()).toHaveValue(2);
  });

  it("ne réécrit rien quand le compte demandé est déjà celui qui s'applique", async () => {
    const { onChange, user, input } = field(2, 2);
    await user.clear(input());
    await user.type(input(), "10{Enter}");
    // ramené à 2, qui est déjà le réglage : pas d'écriture pour rien
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(2);
  });

  describe("le mode auto", () => {
    it("s'annonce, et éteint le champ", () => {
      field(null);
      expect(screen.getByLabelText(TITLE)).toBeDisabled();
      expect(screen.getByText("au fil de la largeur")).toBeInTheDocument();
    });

    it("rend un compte ABSENT et non un nombre — c'est la largeur qui décide", async () => {
      const { onChange, user, auto } = field(6);
      await user.click(auto());
      expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    });

    it("repose un compte quand on en ressort", async () => {
      const { onChange, user, auto } = field(null);
      await user.click(auto());
      expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
    });

    it("ne ressort jamais au-delà du maximum", async () => {
      const { onChange, user, auto } = field(null, 2);
      await user.click(auto());
      expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
    });
  });

  it("suit le réglage quand il change ailleurs", () => {
    const { rerender, input } = field(6);
    rerender(4);
    expect(input()).toHaveValue(4);
    rerender(null);
    expect(input()).toBeDisabled();
  });
});
