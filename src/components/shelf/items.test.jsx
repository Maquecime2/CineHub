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

/* Une boîte ne replie plus son contenu : c'est la rangée qui la coupe et
   lui passe la seule tranche qui tient sur la ligne (voir `lines.js`).
   Restent à vérifier les deux choses que le segment décide seul : ce
   qu'il montre, et où il ferme son carton. */
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

  it("ouvre le bord par lequel elle continue", () => {
    const card = (props) => seg(props).querySelector("[data-cat-card]").style;
    expect(card({ first: true, last: false }).borderRightStyle).toBe("none");
    expect(card({ first: false, last: true }).borderLeftStyle).toBe("none");
    const seul = card({ first: true, last: true });
    expect(seul.borderLeftStyle).toBe("solid");
    expect(seul.borderRightStyle).toBe("solid");
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

/* Nommer un carton se fait SUR le carton — mais seulement s'il porte
   déjà un nom. Un carton vierge n'a rien à réclamer : il sépare, et
   séparer se passe de mot. */
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

  /* Nommer est une offre et non un passage obligé : beaucoup de cartons
     ne servent qu'à marquer une coupure. Un carton vierge reste donc
     vierge, et son clic ouvre le panneau — où un champ NOM attend celui
     qui en veut un — au lieu de tomber dans un champ dont il faut
     ressortir. */
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

describe("FilmBox — la note sur la tranche", () => {
  const shown = (rating) => {
    document.body.innerHTML = "";
    render(<FilmBox film={film("f1", { rating })} ctx={{}} onOpen={noop} dim={false} {...dnd} />);
    const row = screen.getByLabelText(`${rating} sur 5`);
    return row.querySelector("span[aria-hidden]").style.width;
  };

  /* Ce qu'on lit, c'est la LARGEUR de la couche allumée : cinq étoiles
     entières font cent pour cent, et une demie tombe pile au milieu de
     la troisième. L'ancien compte par `repeat` n'avait aucun moyen de
     dire cette moitié-là. */
  it("peint la fraction exacte de la note, demies comprises", () => {
    expect(shown(5)).toBe("100%");
    expect(shown(4.5)).toBe("90%");
    expect(shown(3.5)).toBe("70%");
    expect(shown(0.5)).toBe("10%");
    expect(shown(0)).toBe("0%");
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
    // saisi là où la main l'a pris, pour que rien ne saute au départ
    expect([dx, dy]).toEqual([20, 30]);
    expect(document.body.contains(ghost)).toBe(true);

    vi.runAllTimers();
    expect(document.body.contains(ghost)).toBe(false);
    vi.useRealTimers();
  });
});
