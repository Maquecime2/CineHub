import fr from "../../i18n/fr";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerRowField, DecorCabinet, ItemPalette, CellPreview } from "./layout";
import { DECOR_TYPES, CAT_FAMILIES, decorLabel } from "./constants";
import i18n from "../../i18n";

/* A house object has no `label` of its own any more — it has one per
   language, under `shelf.decor.<key>`. */
const named = (d) => decorLabel(d, i18n.t.bind(i18n));
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
    render(<DecorCabinet onDragStart={vi.fn()} onDragEnd={vi.fn()} onClose={vi.fn()} />);

  it("shows every motif in the cabinet, whatever way it draws itself", () => {
    open();
    for (const d of DECOR_TYPES) expect(screen.getByTitle(named(d))).toBeInTheDocument();
  });

  it("makes them all grabbable", () => {
    open();
    for (const d of DECOR_TYPES)
      expect(screen.getByTitle(named(d))).toHaveAttribute("draggable", "true");
  });

  it("takes an object out of the cabinet by its motif", async () => {
    const onDragStart = vi.fn();
    render(<DecorCabinet onDragStart={onDragStart} onDragEnd={vi.fn()} onClose={vi.fn()} />);
    // the native drag cannot be simulated; the event can
    screen.getByTitle("Intercalaire").dispatchEvent(
      Object.assign(new Event("dragstart", { bubbles: true }), {
        dataTransfer: { effectAllowed: "" },
      })
    );
    expect(onDragStart).toHaveBeenCalledWith("divider", expect.anything());
  });

  /* IL AFFIRMAIT QUE LE CABINET VISAIT UN RAYON, ce qui était faux : le
     LÂCHER décide où l'objet se pose, et un objet pris depuis le chevet
     se dépose très bien sur le rayon principal. Le cabinet s'ouvrait
     depuis le haut de chaque planche et annonçait la sienne ; il y a
     maintenant un seul bouton, hors des planches, et la phrase dit ce
     qui est vrai. */
  it("dit que le lâcher décide, et ne vise plus un rayon", () => {
    open();
    expect(screen.queryByText(/rayon visé/)).toBeNull();
    expect(screen.getByText(/là où vous le lâchez/)).toBeInTheDocument();
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

/* ============================================================
   THE CELL PREVIEW — what one sees before opening the folder
   ============================================================ */
describe("CellPreview", () => {
  const LONG =
    "Le samouraï est mon premier Melville. Ayant entendu parler de ses autres films, " +
    "je m'attendais probablement à un peu plus de profondeur dans le scénario. Ce n'est " +
    "pas le cas, celui-ci est assez anecdotique, mais ça ne m'a pas empêché de me régaler. " +
    "Déjà le personnage de Delon, mutique et méthodique, tient le film à lui seul.";

  const film = {
    id: "s",
    title: "Le Samouraï",
    director: "Jean-Pierre Melville",
    year: 1967,
    rating: 4,
    genres: ["Crime"],
    review: LONG,
    status: "watched",
  };

  const show = (props = {}) =>
    render(<CellPreview film={film} onClose={vi.fn()} onOpenFile={vi.fn()} {...props} />);

  it("shows the review WHOLE", () => {
    /* It was cut at 260 characters, mid-word, with nothing saying more
       was there: one read "Déjà le p" and had to open the folder. */
    show();
    expect(screen.getByText(new RegExp(LONG.slice(-30)))).toBeInTheDocument();
  });

  it("keeps the image markers out of it", () => {
    show({ film: { ...film, review: "avant [img:2] après" } });
    expect(screen.queryByText(/\[img:/)).not.toBeInTheDocument();
  });

  it("opens the folder of whoever made it", () => {
    const onOpenPerson = vi.fn();
    show({ onOpenPerson });
    return userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Jean-Pierre Melville" }))
      .then(() => expect(onOpenPerson).toHaveBeenCalledWith("Jean-Pierre Melville"));
  });

  it("draws no dead link when the caller knows no credits", () => {
    show();
    expect(screen.queryByRole("button", { name: "Jean-Pierre Melville" })).not.toBeInTheDocument();
    expect(screen.getByText(/Jean-Pierre Melville/)).toBeInTheDocument();
  });
});
