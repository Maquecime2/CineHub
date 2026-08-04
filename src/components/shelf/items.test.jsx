import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CategoryBox, DecorItem } from "./items";
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
    const flat = draw(makeDecor({ id: "d2", motif: "coffee" }));
    const grip = (c) => within(c).getByTitle(/Intercalaire|Tache de café/).style;
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
});
