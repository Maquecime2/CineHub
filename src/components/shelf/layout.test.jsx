import fr from "../../i18n/fr";
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

describe("PerRowField — auto, or a number one writes", () => {
  it("lets any count be written, not only those from a list", () => {
    const { onChange } = field(6);
    // 7 and 20 existed in none of the seven buttons of before
    expect(screen.getByLabelText(TITLE)).toHaveValue(6);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the count only on confirmation, never on the keystroke", async () => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), "12");
    // without this hold-back, the shelf would fold to 1 then to 12 under one's fingers
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(12);
  });

  it("confirms on leaving the field too", async () => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), "7");
    await user.tab();
    expect(onChange).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("Escape gives the field back the count that is set", async () => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), "99{Escape}");
    expect(input()).toHaveValue(6);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["0", "-3", "   "])('refuses "%s" and hands back to the setting', async (bad) => {
    const { onChange, user, input } = field(6);
    await user.clear(input());
    await user.type(input(), `${bad}{Enter}`);
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(6);
  });

  it("brings back to the possible rather than refuse, when a maximum applies", async () => {
    const { onChange, user, input } = field(1, 2);
    await user.clear(input());
    await user.type(input(), "10{Enter}");
    // the drawer only holds two cases: we correct the hand, we do not push it away
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(input()).toHaveValue(2);
  });

  it("rewrites nothing when the count asked for is the one already in force", async () => {
    const { onChange, user, input } = field(2, 2);
    await user.clear(input());
    await user.type(input(), "10{Enter}");
    // brought back to 2, which is already the setting: no write for nothing
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue(2);
  });

  describe("the auto mode", () => {
    it("announces itself, and puts the field out", () => {
      field(null);
      expect(screen.getByLabelText(TITLE)).toBeDisabled();
      expect(screen.getByText("au fil de la largeur")).toBeInTheDocument();
    });

    it("returns an ABSENT count and not a number — the width decides", async () => {
      const { onChange, user, auto } = field(6);
      await user.click(auto());
      expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    });

    it("lays a count back down when one leaves it", async () => {
      const { onChange, user, auto } = field(null);
      await user.click(auto());
      expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
    });

    it("never comes back out above the maximum", async () => {
      const { onChange, user, auto } = field(null, 2);
      await user.click(auto());
      expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
    });
  });

  it("follows the setting when it changes elsewhere", () => {
    const { rerender, input } = field(6);
    rerender(4);
    expect(input()).toHaveValue(4);
    rerender(null);
    expect(input()).toBeDisabled();
  });
});

/* The cabinet chose between a pictogram and a drawing, and assumed every
   pattern had one or the other. The divider has neither — it is made of
   paper and borders — hence an `<undefined />` and a panel that no longer
   opened at all.

   The real defect was not the missing thumbnail but the absence of this
   test: nothing rendered the cabinet, so nothing noticed that a pattern
   was not showable in it. So we walk through them all, and a pattern added
   tomorrow with nothing to draw itself with will bring this test down
   rather than the page. */
describe("DecorCabinet", () => {
  const open = () =>
    render(
      <DecorCabinet kind="main" onDragStart={vi.fn()} onDragEnd={vi.fn()} onClose={vi.fn()} />
    );

  it("shows every motif in the cabinet, whatever way it draws itself", () => {
    open();
    for (const d of DECOR_TYPES) expect(screen.getByTitle(d.label)).toBeInTheDocument();
  });

  it("makes them all grabbable", () => {
    open();
    for (const d of DECOR_TYPES)
      expect(screen.getByTitle(d.label)).toHaveAttribute("draggable", "true");
  });

  it("takes an object out of the cabinet by its motif", async () => {
    const onDragStart = vi.fn();
    render(
      <DecorCabinet kind="main" onDragStart={onDragStart} onDragEnd={vi.fn()} onClose={vi.fn()} />
    );
    // the native drag cannot be simulated; the event can
    screen.getByTitle("Intercalaire").dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { effectAllowed: "" },
      })
    );
    expect(onDragStart).toHaveBeenCalledWith("divider", expect.anything());
  });

  it("says which shelf is being aimed at", () => {
    open();
    expect(screen.getByText(/rayon targeted/)).toHaveTextContent("La collection");
  });
});

/* ------------------------------------------------------------
   ItemPalette — the swatch book, once widened
   ------------------------------------------------------------ */

describe("ItemPalette — the colours on offer", () => {
  const open = (props = {}) => {
    const onColor = vi.fn();
    render(
      <ItemPalette title="OBJET" color="burgundy" onColor={onColor} onClose={vi.fn()} {...props} />
    );
    return { onColor, user: userEvent.setup() };
  };

  it("offers the whole palette, and each tint once only", () => {
    open();
    const swatches = CAT_KEYS.map((k) => screen.getByTitle(k));
    expect(swatches).toHaveLength(CAT_KEYS.length);
    expect(new Set(swatches).size).toBe(CAT_KEYS.length);
  });

  it("files the swatches by family", () => {
    open();
    /* The names live in the catalogue: the data only carries the key. */
    for (const fam of CAT_FAMILIES)
      expect(screen.getByText(fr.palette.families[fam.key].toUpperCase())).toBeTruthy();
  });

  /* What comes back up is the KEY, never the hexadecimal: it is the
     invariant that allows a tint to be reworked without freezing what
     carries it. */
  it("returns the key of the tint chosen", async () => {
    const { onColor, user } = open();
    await user.click(screen.getByTitle("canard"));
    expect(onColor).toHaveBeenCalledWith("canard");
  });

  /* An imported object we cannot tint has no colour: the grid disappears
     instead of promising a setting with no effect. */
  it("shows no swatch without onColor", () => {
    open({ onColor: undefined });
    expect(screen.queryByTitle("burgundy")).toBeNull();
  });
});
