import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryBox, DecorItem, FilmBox, carryGhost, leanOf } from "./items";
import { tiltOf } from "../../domain/seeded";
import { makeCat, makeDecor, filmItem } from "../../shelf-views";

const film = (id, over = {}) => ({
  id,
  title: id,
  year: 2000,
  director: "",
  poster: "",
  stills: [],
  genres: [],
  themes: [],
  rating: 0,
  status: "watched",
  bedside: false,
  archived: false,
  ...over,
});

const noop = () => {};
const dnd = { onDragStart: noop, onDragEnd: noop, onDragOverBox: noop, onCatOver: noop };

const box = (cat, films = []) => {
  const onEditDecor = vi.fn();
  render(
    <CategoryBox
      cat={cat}
      kind="main"
      rowId="r1"
      films={new Map(films.map((f) => [f.id, f]))}
      dim={() => false}
      acts={{ setCat: noop }}
      onOpen={noop}
      onEdit={noop}
      onEditDecor={onEditDecor}
      {...dnd}
    />
  );
  return { onEditDecor };
};

describe("CategoryBox — what a box holds", () => {
  const films = [film("f1"), film("f2"), film("f3")];

  /* The box itself carries `data-shelf-item` — it is its drop wrapper.
     What it HOLDS is therefore what is found under its card. */
  const held = () =>
    [...document.querySelectorAll("[data-cat-card] [data-shelf-item]")].map((n) =>
      n.getAttribute("data-shelf-item")
    );

  it("files the decors among the cases, in the model's order", () => {
    box(
      makeCat({
        id: "c1",
        items: [
          filmItem("f1"),
          makeDecor({ id: "d1", motif: "divider", label: "1970" }),
          filmItem("f2"),
        ],
      }),
      films
    );
    expect(held()).toEqual(["f1", "d1", "f2"]);
  });

  it("shows the name of a divider laid in the box", () => {
    box(
      makeCat({ id: "c1", items: [makeDecor({ id: "d1", motif: "divider", label: "Années 70" })] }),
      films
    );
    expect(screen.getByText("Années 70")).toBeInTheDocument();
  });

  it("counts the furniture in the box's total", () => {
    box(
      makeCat({ id: "c1", items: [filmItem("f1"), makeDecor({ id: "d1", motif: "divider" })] }),
      films
    );
    // the tab carries the number of objects filed, films and furniture alike
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("ignores a film the collection no longer knows", () => {
    box(makeCat({ id: "c1", items: [filmItem("f1"), filmItem("disparu")] }), films);
    expect(held()).toEqual(["f1"]);
  });
});

/* A box no longer wraps its content: it is the row that cuts it and hands
   it the only slice that fits on the line (see `lines.js`). What remains
   to check is the two things the segment decides on its own: what it
   shows, and where it closes its card. */
describe("CategoryBox — one segment of a box", () => {
  const many = Array.from({ length: 6 }, (_, i) => film(`f${i}`));
  const items = many.map((f) => filmItem(f.id));
  const cat = makeCat({ id: "c1", label: "Polars", items });

  const seg = (props) =>
    render(
      <CategoryBox
        cat={cat}
        kind="main"
        rowId="r1"
        films={new Map(many.map((f) => [f.id, f]))}
        dim={() => false}
        acts={{ setCat: noop }}
        onOpen={noop}
        onEdit={noop}
        onEditDecor={noop}
        {...dnd}
        {...props}
      />
    ).container;

  const held = (c) =>
    [...c.querySelectorAll("[data-cat-card] [data-shelf-item]")].map((n) =>
      n.getAttribute("data-shelf-item")
    );

  it("shows only the slice it is given", () => {
    const c = seg({ items: items.slice(0, 2), first: true, last: false });
    expect(held(c)).toEqual(["f0", "f1"]);
  });

  it("shows the whole box when nobody has cut it", () => {
    expect(held(seg({}))).toHaveLength(6);
  });

  it("carries the header on its first segment, and not on the ones after", () => {
    expect(
      within(seg({ items: items.slice(0, 2), last: false })).getByText("Polars")
    ).toBeInTheDocument();
    const next = seg({ items: items.slice(2), first: false });
    expect(within(next).queryByText("Polars")).toBeNull();
  });

  it("always counts the whole box, not the slice", () => {
    const c = seg({ items: items.slice(0, 2), last: false });
    expect(within(c).getByText("6")).toBeInTheDocument();
  });

  /* We read the DECLARED value and not `borderLeftStyle`. Since the
     colours became references to CSS variables, jsdom refuses the
     shorthand `1px solid var(--c-line)` and no longer exposes its parts —
     a browser, for its part, understands it. The declaration stays the
     only thing this test had to check. */
  it("opens the edge it carries on through", () => {
    const card = (props) => seg(props).querySelector("[data-cat-card]").getAttribute("style");
    /* jsdom returns "none" as "medium": the absence of a border can
       therefore only be read by the absence of the stroke. That is what
       the test means anyway — the open edge has no stroke, the closed edge
       has one. */
    expect(card({ first: true, last: false })).not.toMatch(/border-right:[^;]*solid/);
    expect(card({ first: false, last: true })).not.toMatch(/border-left:[^;]*solid/);
    const alone = card({ first: true, last: true });
    expect(alone).toMatch(/border-left:[^;]*solid/);
    expect(alone).toMatch(/border-right:[^;]*solid/);
  });
});

describe("DecorItem — the divider", () => {
  const draw = (item) =>
    render(<DecorItem item={item} ctx={{}} onEdit={noop} {...dnd} />).container;

  it("writes its name", () => {
    draw(makeDecor({ id: "d1", motif: "divider", label: "Polars" }));
    expect(screen.getByText("Polars")).toBeInTheDocument();
  });

  it("stands as tall as a case, where a trinket stays square", () => {
    const tall = draw(makeDecor({ id: "d1", motif: "divider" }));
    const flat = draw(makeDecor({ id: "d2", motif: "plant" }));
    const grip = (c) => within(c).getByTitle(/Intercalaire|Plante verte/).style;
    expect(parseInt(grip(tall).height)).toBeGreaterThan(parseInt(grip(flat).height));
  });

  it("carries its own name as a tooltip, rather than the motif's", () => {
    draw(makeDecor({ id: "d1", motif: "divider", label: "Polars" }));
    expect(screen.getByTitle("Polars")).toBeInTheDocument();
  });

  it("falls back on the motif's name as long as it has none", () => {
    draw(makeDecor({ id: "d1", motif: "divider", label: "" }));
    expect(screen.getByTitle("Intercalaire")).toBeInTheDocument();
  });

  it("renders nothing from an unknown motif", () => {
    const c = draw(makeDecor({ id: "d1", motif: "n'existe pas" }));
    expect(c.querySelector("[data-shelf-item]")).toBeNull();
  });

  /* The card LEANS: that is what makes it read as cardstock rather than
     as a line drawn with a ruler. The lopsidedness is sown, therefore
     variable — but never nil, otherwise that particular card would stand
     straight and that is precisely what we no longer want to see. */
  describe("its lean", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `d${i}`);

    it("always leans, whatever the identifier", () => {
      for (const id of ids) expect(Math.abs(Number(leanOf(id)))).toBeGreaterThanOrEqual(1.2);
    });

    it("leans slightly, never far enough to fall", () => {
      for (const id of ids) expect(Math.abs(Number(leanOf(id)))).toBeLessThanOrEqual(2.2);
    });

    it("leans both ways — otherwise the whole row would list to one side", () => {
      const sides = new Set(ids.map((id) => Math.sign(Number(leanOf(id)))));
      expect(sides).toEqual(new Set([-1, 1]));
    });

    it("stays less tilted than a trinket laid down, which lies askew", () => {
      const trinkets = ids.map((id) => Math.abs(Number(tiltOf(id))));
      expect(Math.max(...trinkets)).toBeGreaterThan(2.2);
    });

    it("keeps the same lean from one render to the next", () => {
      expect(leanOf("d1")).toBe(leanOf("d1"));
    });
  });
});

/* Naming a card is done ON the card — but only if it already carries a
   name. A blank card has nothing to claim: it separates, and separating
   does without a word. */
describe("DecorItem — writing on the divider", () => {
  const board = (over = {}) => {
    const onLabel = vi.fn();
    const onEdit = vi.fn();
    render(
      <DecorItem
        item={makeDecor({ id: "d1", motif: "divider", label: "Polars", ...over })}
        ctx={{}}
        onEdit={onEdit}
        onLabel={onLabel}
        {...dnd}
      />
    );
    return { onLabel, onEdit, user: userEvent.setup() };
  };

  const field = () => screen.getByLabelText("Nom de l'intercalaire");
  const cardstock = () => screen.getByTitle(/Polars|Intercalaire/);

  it("opens a field filled with the name, on a click on the cardstock", async () => {
    const { user } = board();
    expect(screen.queryByLabelText("Nom de l'intercalaire")).not.toBeInTheDocument();
    await user.click(cardstock());
    expect(field()).toHaveValue("Polars");
  });

  it("writes the name on confirmation", async () => {
    const { user, onLabel } = board();
    await user.click(cardstock());
    await user.clear(field());
    await user.type(field(), "Années 70{Enter}");
    expect(onLabel).toHaveBeenCalledExactlyOnceWith("d1", "Années 70");
  });

  it("writes on leaving the field too", async () => {
    const { user, onLabel } = board();
    await user.click(cardstock());
    await user.type(field(), " noirs");
    await user.tab();
    expect(onLabel).toHaveBeenCalledExactlyOnceWith("d1", "Polars noirs");
  });

  it("Escape gives up and hands the cardstock its name back", async () => {
    const { user, onLabel } = board();
    await user.click(cardstock());
    await user.clear(field());
    await user.type(field(), "bêtise{Escape}");
    expect(onLabel).not.toHaveBeenCalled();
    expect(screen.getByText("Polars")).toBeInTheDocument();
  });

  it("writes nothing when the name has not moved", async () => {
    const { user, onLabel } = board();
    await user.click(cardstock());
    await user.keyboard("{Enter}");
    expect(onLabel).not.toHaveBeenCalled();
  });

  it("does not drag while it is being written", async () => {
    const { user } = board();
    const before = cardstock();
    expect(before).toHaveAttribute("draggable", "true");
    await user.click(before);
    expect(cardstock()).toHaveAttribute("draggable", "false");
  });

  /* Naming is an offer and not a compulsory step: many cards serve only
     to mark a cut. So a blank card stays blank, and its click opens the
     panel — where a NAME field waits for whoever wants one — instead of
     falling into a field one has to get out of. */
  it("leaves a blank cardstock asking for nothing", () => {
    board({ label: "" });
    expect(screen.queryByText("nommer")).not.toBeInTheDocument();
  });

  it("a blank cardstock opens its panel rather than a field", async () => {
    const { user, onEdit } = board({ label: "" });
    await user.click(cardstock());
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("d1");
    expect(screen.queryByLabelText("Nom de l'intercalaire")).not.toBeInTheDocument();
  });

  it("keeps the palette reachable for what is not text", async () => {
    const { user, onEdit, onLabel } = board();
    await user.click(screen.getByRole("button", { name: /Réglages de « Polars »/ }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("d1");
    // and the click on the palette does not open the field over it
    expect(onLabel).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nom de l'intercalaire")).not.toBeInTheDocument();
  });

  it("with no way to write, the cardstock falls back on the panel", async () => {
    const onEdit = vi.fn();
    render(
      <DecorItem
        item={makeDecor({ id: "d1", motif: "divider", label: "Polars" })}
        ctx={{}}
        onEdit={onEdit}
        {...dnd}
      />
    );
    await userEvent.setup().click(screen.getByTitle("Polars"));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("d1");
  });
});

describe("FilmBox — the rating on the spine", () => {
  const shown = (rating) => {
    document.body.innerHTML = "";
    render(<FilmBox film={film("f1", { rating })} ctx={{}} onOpen={noop} dim={false} {...dnd} />);
    const row = screen.getByLabelText(`${rating} sur 5`);
    return row.querySelector("span[aria-hidden]").style.width;
  };

  /* What we read is the WIDTH of the lit layer: five whole stars make a
     hundred per cent, and a half falls exactly in the middle of the third.
     The old count by `repeat` had no way of saying that half. */
  it("paints the exact fraction of the rating, halves included", () => {
    expect(shown(5)).toBe("100%");
    expect(shown(4.5)).toBe("90%");
    expect(shown(3.5)).toBe("70%");
    expect(shown(0.5)).toBe("10%");
    expect(shown(0)).toBe("0%");
  });
});

describe("FilmBox — the count of screenings", () => {
  const screenings = (n) =>
    Array.from({ length: n }, (_, i) => ({ date: `202${i}-01-01`, rating: null }));

  const counter = (n) => {
    document.body.innerHTML = "";
    render(
      <FilmBox
        film={film("f1", { rating: 3, watches: screenings(n) })}
        ctx={{}}
        onOpen={noop}
        dim={false}
        {...dnd}
      />
    );
    return screen.queryByLabelText(`vu ${n} fois`);
  };

  it("announces a film one has rewatched", () => {
    expect(counter(3)).toHaveTextContent("×3");
  });

  /* A "×1" on every edge would be noise across the whole library: what one
     looks for is the films one rewatches, and they only stand out if the
     others keep quiet. */
  it("stays quiet for a film seen once", () => {
    expect(counter(1)).toBeNull();
  });

  it("stays quiet for a film nothing is known about", () => {
    expect(counter(0)).toBeNull();
  });
});

describe("carryGhost — what one carries under the cursor", () => {
  it("photographs a COPY of the one grabbed object, then takes it away", () => {
    const node = document.createElement("div");
    node.getBoundingClientRect = () => ({ left: 100, top: 50, width: 96, height: 144 });
    document.body.appendChild(node);
    const setDragImage = vi.fn();
    vi.useFakeTimers();

    carryGhost({ dataTransfer: { setDragImage }, clientX: 120, clientY: 80 }, node);

    const [ghost, dx, dy] = setDragImage.mock.calls[0];
    expect(ghost).not.toBe(node); // the copy, never the original taken from the row
    expect([ghost.style.width, ghost.style.height]).toEqual(["96px", "144px"]);
    // grabbed where the hand took it, so that nothing jumps at the start
    expect([dx, dy]).toEqual([20, 30]);
    expect(document.body.contains(ghost)).toBe(true);

    vi.runAllTimers();
    expect(document.body.contains(ghost)).toBe(false);
    vi.useRealTimers();
  });
});
