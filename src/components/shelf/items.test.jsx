import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryBox, DecorItem, leanOf } from "./items";
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
  chevet: false,
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

/* Le compte d'une boîte se lit dans le DOM : `withBreaks` intercale des
   cales de rupture entre les boîtiers. jsdom ne met rien en page, mais il
   sait compter les nœuds — et c'est exactement ce que décide le réglage. */
const breaksIn = (container) =>
  container.querySelectorAll('[data-shelf-item] ~ div[style*="flex-basis: 100%"]').length;

describe("CategoryBox — ce qu'une boîte tient", () => {
  const films = [film("f1"), film("f2"), film("f3")];

  /* La boîte elle-même porte `data-shelf-item` — c'est son enveloppe de
     dépôt. Ce qu'elle TIENT est donc ce qui se trouve sous son carton. */
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
    // l'onglet porte le nombre d'objets rangés, films et mobilier confondus
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("ignore un film que la collection ne connaît plus", () => {
    box(makeCat({ id: "c1", items: [filmItem("f1"), filmItem("disparu")] }), films);
    expect(held()).toEqual(["f1"]);
  });
});

describe("CategoryBox — le compte par ligne", () => {
  const many = Array.from({ length: 6 }, (_, i) => film(`f${i}`));
  const items = many.map((f) => filmItem(f.id));

  it("sans compte, ne pose aucune rupture : la largeur décide", () => {
    const { container } = render(
      <CategoryBox
        cat={makeCat({ id: "c1", perRow: null, items })}
        kind="main"
        rowId="r1"
        films={new Map(many.map((f) => [f.id, f]))}
        dim={() => false}
        acts={{ setCat: noop }}
        onOpen={noop}
        onEdit={noop}
        onEditDecor={noop}
        {...dnd}
      />
    );
    expect(breaksIn(container)).toBe(0);
  });

  it("avec un compte, replie à ce compte-là", () => {
    const { container } = render(
      <CategoryBox
        cat={makeCat({ id: "c1", perRow: 2, items })}
        kind="main"
        rowId="r1"
        films={new Map(many.map((f) => [f.id, f]))}
        dim={() => false}
        acts={{ setCat: noop }}
        onOpen={noop}
        onEdit={noop}
        onEditDecor={noop}
        {...dnd}
      />
    );
    // six boîtiers repliés par deux : deux ruptures, après le 2e et le 4e
    expect(breaksIn(container)).toBe(2);
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

  /* Le carton s'APPUIE : c'est ce qui le fait lire comme du carton
     plutôt que comme un trait tiré à la règle. Le guingois est semé, donc
     variable — mais jamais nul, sinon ce carton-là se dresserait tout
     droit et c'est précisément ce qu'on ne veut plus voir. */
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

/* Nommer un carton se fait SUR le carton. Le panneau savait déjà le
   faire, mais il fallait l'ouvrir pour le découvrir — et un carton
   vierge ne disait pas qu'il attendait un nom. */
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
  const carton = () => screen.getByTitle(/Polars|nommer/);

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
    expect(screen.getByTitle(/Polars|nommer/)).toHaveAttribute("draggable", "false");
  });

  it("un carton vierge annonce qu'il attend un nom", () => {
    board({ label: "" });
    expect(screen.getByText("nommer")).toBeInTheDocument();
  });

  it("laisse la palette joignable pour ce qui n'est pas du texte", async () => {
    const { user, onEdit, onLabel } = board();
    await user.click(screen.getByRole("button", { name: /Réglages de « Polars »/ }));
    expect(onEdit).toHaveBeenCalledExactlyOnceWith("d1");
    // et le clic sur la palette n'ouvre pas le champ par-dessus
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
