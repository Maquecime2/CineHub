import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerRowField, DecorCabinet, ItemPalette } from "./layout";
import { DECOR_TYPES, CAT_FAMILIES } from "./constants";
import { CAT_KEYS } from "../../shelf-views";

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

/* Le cabinet choisissait entre un pictogramme et un dessin, et supposait
   que tout motif avait l'un ou l'autre. L'intercalaire n'a ni l'un ni
   l'autre — il est fait de papier et de bordures — d'où un `<undefined />`
   et un panneau qui ne s'ouvrait plus du tout.

   Le vrai défaut n'était pas la vignette manquante mais l'absence de ce
   test : rien ne rendait le cabinet, donc rien ne remarquait qu'un motif
   n'y était pas montrable. On les parcourt donc tous, et un motif ajouté
   demain sans de quoi se dessiner fera tomber ce test plutôt que la
   page. */
describe("DecorCabinet", () => {
  const open = () =>
    render(
      <DecorCabinet kind="main" onDragStart={vi.fn()} onDragEnd={vi.fn()} onClose={vi.fn()} />
    );

  it("montre chaque motif du cabinet, quelle que soit sa façon de se dessiner", () => {
    open();
    for (const d of DECOR_TYPES) expect(screen.getByTitle(d.label)).toBeInTheDocument();
  });

  it("les rend tous saisissables", () => {
    open();
    for (const d of DECOR_TYPES)
      expect(screen.getByTitle(d.label)).toHaveAttribute("draggable", "true");
  });

  it("sort un objet du cabinet par son motif", async () => {
    const onDragStart = vi.fn();
    render(
      <DecorCabinet kind="main" onDragStart={onDragStart} onDragEnd={vi.fn()} onClose={vi.fn()} />
    );
    // le glissement natif ne se simule pas ; l'événement, si
    screen.getByTitle("Intercalaire").dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { effectAllowed: "" },
      })
    );
    expect(onDragStart).toHaveBeenCalledWith("divider", expect.anything());
  });

  it("dit sur quel rayon on vise", () => {
    open();
    expect(screen.getByText(/rayon visé/)).toHaveTextContent("La collection");
  });
});

/* ------------------------------------------------------------
   ItemPalette — le nuancier, une fois élargi
   ------------------------------------------------------------ */

describe("ItemPalette — les couleurs offertes", () => {
  const open = (props = {}) => {
    const onColor = vi.fn();
    render(
      <ItemPalette title="OBJET" color="burgundy" onColor={onColor} onClose={vi.fn()} {...props} />
    );
    return { onColor, user: userEvent.setup() };
  };

  it("offre toute la palette, et chaque teinte une seule fois", () => {
    open();
    const swatches = CAT_KEYS.map((k) => screen.getByTitle(k));
    expect(swatches).toHaveLength(CAT_KEYS.length);
    expect(new Set(swatches).size).toBe(CAT_KEYS.length);
  });

  it("range les pastilles par famille", () => {
    open();
    for (const fam of CAT_FAMILIES) expect(screen.getByText(fam.label.toUpperCase())).toBeTruthy();
  });

  /* Ce qui remonte est la CLÉ, jamais l'hexadécimal : c'est l'invariant
     qui permet de retoucher une teinte sans figer ce qui la porte. */
  it("rend la clé de la teinte choisie", async () => {
    const { onColor, user } = open();
    await user.click(screen.getByTitle("canard"));
    expect(onColor).toHaveBeenCalledWith("canard");
  });

  /* Un objet importé qu'on ne sait pas teinter n'a pas de couleur : la
     grille disparaît au lieu de promettre un réglage sans effet. */
  it("ne montre aucune pastille sans onColor", () => {
    open({ onColor: undefined });
    expect(screen.queryByTitle("burgundy")).toBeNull();
  });
});
