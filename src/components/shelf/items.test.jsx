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

describe("CategoryBox — ce qu'une boîte tient", () => {
  const films = [film("f1"), film("f2"), film("f3")];

  /* The box itself carries `data-shelf-item` — it is its drop wrapper.
     What it HOLDS is therefore what is found under its card. */
  const held = () =>
    [...document.querySelectorAll("[data-cat-card] [data-shelf-item]")].map((n) =>
      n.getAttribute("data-shelf-item")
    );

  it("range les décors au milieu des boîtiers, dans l'ordre du modèle", () => {
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

  it("montre le nom d'un intercalaire posé dans la boîte", () => {
    box(
      makeCat({ id: "c1", items: [makeDecor({ id: "d1", motif: "divider", label: "Années 70" })] }),
      films
    );
    expect(screen.getByText("Années 70")).toBeInTheDocument();
  });

  it("compte le mobilier dans le total de la boîte", () => {
    box(
      makeCat({ id: "c1", items: [filmItem("f1"), makeDecor({ id: "d1", motif: "divider" })] }),
      films
    );
    // the tab carries the number of objects filed, films and furniture alike
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("ignore un film que la collection ne connaît plus", () => {
    box(makeCat({ id: "c1", items: [filmItem("f1"), filmItem("disparu")] }), films);
    expect(held()).toEqual(["f1"]);
  });
});

/* A box no longer wraps its content: it is the row that cuts it and hands
   it the only slice that fits on the line (see `lines.js`). What remains
   to check is the two things the segment decides on its own: what it
   shows, and where it closes its card. */
describe("CategoryBox — un segment de boîte", () => {
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

  it("ne montre que la tranche qu'on lui donne", () => {
    const c = seg({ items: items.slice(0, 2), first: true, last: false });
    expect(held(c)).toEqual(["f0", "f1"]);
  });

  it("montre toute la boîte quand personne ne l'a coupée", () => {
    expect(held(seg({}))).toHaveLength(6);
  });

  it("porte l'en-tête sur son premier segment, et pas sur les suivants", () => {
    expect(
      within(seg({ items: items.slice(0, 2), last: false })).getByText("Polars")
    ).toBeInTheDocument();
    const suite = seg({ items: items.slice(2), first: false });
    expect(within(suite).queryByText("Polars")).toBeNull();
  });

  it("compte toujours la boîte entière, pas la tranche", () => {
    const c = seg({ items: items.slice(0, 2), last: false });
    expect(within(c).getByText("6")).toBeInTheDocument();
  });

  /* We read the DECLARED value and not `borderLeftStyle`. Since the
     colours became references to CSS variables, jsdom refuses the
     shorthand `1px solid var(--c-line)` and no longer exposes its parts —
     a browser, for its part, understands it. The declaration stays the
     only thing this test had to check. */
  it("ouvre le bord par lequel elle continue", () => {
    const card = (props) => seg(props).querySelector("[data-cat-card]").getAttribute("style");
    /* jsdom returns "none" as "medium": the absence of a border can
       therefore only be read by the absence of the stroke. That is what
       the test means anyway — the open edge has no stroke, the closed edge
       has one. */
    expect(card({ first: true, last: false })).not.toMatch(/border-right:[^;]*solid/);
    expect(card({ first: false, last: true })).not.toMatch(/border-left:[^;]*solid/);
    const seul = card({ first: true, last: true });
    expect(seul).toMatch(/border-left:[^;]*solid/);
    expect(seul).toMatch(/border-right:[^;]*solid/);
  });
});

describe("DecorItem — l'intercalaire", () => {
  const draw = (item) =>
    render(<DecorItem item={item} ctx={{}} onEdit={noop} {...dnd} />).container;

  it("écrit son nom", () => {
    draw(makeDecor({ id: "d1", motif: "divider", label: "Polars" }));
    expect(screen.getByText("Polars")).toBeInTheDocument();
  });

  it("se dresse à la hauteur d'un boîtier, là où un bibelot reste carré", () => {
    const tall = draw(makeDecor({ id: "d1", motif: "divider" }));
    const flat = draw(makeDecor({ id: "d2", motif: "plant" }));
    const grip = (c) => within(c).getByTitle(/Intercalaire|Plante verte/).style;
    expect(parseInt(grip(tall).height)).toBeGreaterThan(parseInt(grip(flat).height));
  });

  it("porte son nom en infobulle, plutôt que le nom du motif", () => {
    draw(makeDecor({ id: "d1", motif: "divider", label: "Polars" }));
    expect(screen.getByTitle("Polars")).toBeInTheDocument();
  });

  it("retombe sur le nom du motif tant qu'on ne l'a pas nommé", () => {
    draw(makeDecor({ id: "d1", motif: "divider", label: "" }));
    expect(screen.getByTitle("Intercalaire")).toBeInTheDocument();
  });

  it("ne rend rien d'un motif inconnu", () => {
    const c = draw(makeDecor({ id: "d1", motif: "n'existe pas" }));
    expect(c.querySelector("[data-shelf-item]")).toBeNull();
  });

  /* The card LEANS: that is what makes it read as cardstock rather than
     as a line drawn with a ruler. The lopsidedness is sown, therefore
     variable — but never nil, otherwise that particular card would stand
     straight and that is precisely what we no longer want to see. */
  describe("son inclinaison", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `d${i}`);

    it("penche toujours, quel que soit l'identifiant", () => {
      for (const id of ids) expect(Math.abs(Number(leanOf(id)))).toBeGreaterThanOrEqual(1.2);
    });

    it("penche légèrement, jamais au point de tomber", () => {
      for (const id of ids) expect(Math.abs(Number(leanOf(id)))).toBeLessThanOrEqual(2.2);
    });

    it("penche des deux côtés — sinon toute la rangée gîterait du même bord", () => {
      const sides = new Set(ids.map((id) => Math.sign(Number(leanOf(id)))));
      expect(sides).toEqual(new Set([-1, 1]));
    });

    it("reste moins penché qu'un bibelot posé, qui lui gît de travers", () => {
      const bibelots = ids.map((id) => Math.abs(Number(tiltOf(id))));
      expect(Math.max(...bibelots)).toBeGreaterThan(2.2);
    });

    it("garde la même inclinaison d'un rendu à l'autre", () => {
      expect(leanOf("d1")).toBe(leanOf("d1"));
    });
  });
});

/* Naming a card is done ON the card — but only if it already carries a
   name. A blank card has nothing to claim: it separates, and separating
   does without a word. */
describe("DecorItem — écrire sur l'intercalaire", () => {
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

  const champ = () => screen.getByLabelText("Nom de l'intercalaire");
  const carton = () => screen.getByTitle(/Polars|Intercalaire/);

  it("ouvre un champ garni du nom, au clic sur le carton", async () => {
    const { user } = board();
    expect(screen.queryByLabelText("Nom de l'intercalaire")).not.toBeInTheDocument();
    await user.click(carton());
    expect(champ()).toHaveValue("Polars");
  });

  it("écrit le nom à la validation", async () => {
    const { user, onLabel } = board();
    await user.click(carton());
    await user.clear(champ());
    await user.type(champ(), "Années 70{Enter}");
    expect(onLabel).toHaveBeenCalledExactlyOnceWith("d1", "Années 70");
  });

  it("écrit aussi en quittant le champ", async () => {
    const { user, onLabel } = board();
    await user.click(carton());
    await user.type(champ(), " noirs");
    await user.tab();
    expect(onLabel).toHaveBeenCalledExactlyOnceWith("d1", "Polars noirs");
  });

  it("Échap renonce et rend son nom au carton", async () => {
    const { user, onLabel } = board();
    await user.click(carton());
    await user.clear(champ());
    await user.type(champ(), "bêtise{Escape}");
    expect(onLabel).not.toHaveBeenCalled();
    expect(screen.getByText("Polars")).toBeInTheDocument();
  });

  it("n'écrit rien quand le nom n'a pas bougé", async () => {
    const { user, onLabel } = board();
    await user.click(carton());
    await user.keyboard("{Enter}");
    expect(onLabel).not.toHaveBeenCalled();
  });

  it("ne se glisse pas pendant qu'on l'écrit", async () => {
    const { user } = board();
    const before = carton();
    expect(before).toHaveAttribute("draggable", "true");
    await user.click(before);
    expect(carton()).toHaveAttribute("draggable", "false");
  });

  /* Naming is an offer and not a compulsory step: many cards serve only
     to mark a cut. So a blank card stays blank, and its click opens the
     panel — where a NAME field waits for whoever wants one — instead of
     falling into a field one has to get out of. */
  it("laisse un carton vierge sans rien réclamer", () => {
    board({ label: "" });
    expect(screen.queryByText("nommer")).not.toBeInTheDocument();
  });

  it("un carton vierge ouvre son panneau plutôt qu'un champ", async () => {
    const { user, onEdit } = board({ label: "" });
    await user.click(carton());
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("d1");
    expect(screen.queryByLabelText("Nom de l'intercalaire")).not.toBeInTheDocument();
  });

  it("laisse la palette joignable pour ce qui n'est pas du texte", async () => {
    const { user, onEdit, onLabel } = board();
    await user.click(screen.getByRole("button", { name: /Réglages de « Polars »/ }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("d1");
    // and the click on the palette does not open the field over it
    expect(onLabel).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nom de l'intercalaire")).not.toBeInTheDocument();
  });

  it("sans de quoi écrire, le carton retombe sur le panneau", async () => {
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

describe("FilmBox — la note sur la tranche", () => {
  const shown = (rating) => {
    document.body.innerHTML = "";
    render(<FilmBox film={film("f1", { rating })} ctx={{}} onOpen={noop} dim={false} {...dnd} />);
    const row = screen.getByLabelText(`${rating} sur 5`);
    return row.querySelector("span[aria-hidden]").style.width;
  };

  /* What we read is the WIDTH of the lit layer: five whole stars make a
     hundred per cent, and a half falls exactly in the middle of the third.
     The old count by `repeat` had no way of saying that half. */
  it("peint la fraction exacte de la note, demies comprises", () => {
    expect(shown(5)).toBe("100%");
    expect(shown(4.5)).toBe("90%");
    expect(shown(3.5)).toBe("70%");
    expect(shown(0.5)).toBe("10%");
    expect(shown(0)).toBe("0%");
  });
});

describe("FilmBox — le compte des séances", () => {
  const séances = (n) =>
    Array.from({ length: n }, (_, i) => ({ date: `202${i}-01-01`, rating: null }));

  const compteur = (n) => {
    document.body.innerHTML = "";
    render(
      <FilmBox
        film={film("f1", { rating: 3, watches: séances(n) })}
        ctx={{}}
        onOpen={noop}
        dim={false}
        {...dnd}
      />
    );
    return screen.queryByLabelText(`vu ${n} fois`);
  };

  it("annonce un film qu'on a revu", () => {
    expect(compteur(3)).toHaveTextContent("×3");
  });

  /* A "×1" on every edge would be noise across the whole library: what one
     looks for is the films one rewatches, and they only stand out if the
     others keep quiet. */
  it("se tait pour un film vu une seule fois", () => {
    expect(compteur(1)).toBeNull();
  });

  it("se tait pour un film dont on ne sait rien", () => {
    expect(compteur(0)).toBeNull();
  });
});

describe("carryGhost — ce qu'on emporte sous le curseur", () => {
  it("photographie une COPIE du seul objet saisi, puis la retire", () => {
    const node = document.createElement("div");
    node.getBoundingClientRect = () => ({ left: 100, top: 50, width: 96, height: 144 });
    document.body.appendChild(node);
    const setDragImage = vi.fn();
    vi.useFakeTimers();

    carryGhost({ dataTransfer: { setDragImage }, clientX: 120, clientY: 80 }, node);

    const [ghost, dx, dy] = setDragImage.mock.calls[0];
    expect(ghost).not.toBe(node); // la copie, jamais l'original pris dans la rangée
    expect([ghost.style.width, ghost.style.height]).toEqual(["96px", "144px"]);
    // grabbed where the hand took it, so that nothing jumps at the start
    expect([dx, dy]).toEqual([20, 30]);
    expect(document.body.contains(ghost)).toBe(true);

    vi.runAllTimers();
    expect(document.body.contains(ghost)).toBe(false);
    vi.useRealTimers();
  });
});
