import { describe, it, expect } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { DecorItem, WallItem, angleOf, leanOf, rotatedBox } from "./items";
import { GAP_X } from "./constants";
import { tiltOf } from "../../domain/seeded";
import { makeDecor, makeWallDecor } from "../../shelf-views";

const noop = () => {};
const dnd = { onDragStart: noop, onDragEnd: noop, onDragOverBox: noop, onEdit: noop };

const angleRendu = (el) => {
  const m = el.style.transform.match(/rotate\((-?[\d.]+)deg\)/);
  return m && Number(m[1]);
};

describe("l'orientation d'un objet", () => {
  /* The sown lopsidedness is what makes a shelf look like a shelf: as long
     as nobody has set anything, it must stay intact. */
  it("garde le guingois de son identifiant tant qu'on n'y touche pas", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf(d)).toBe(tiltOf(d.id));
    expect(angleOf(d, true)).toBe(leanOf(d.id));
  });

  it("obéit à l'angle réglé", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: 37 })).toBe(37);
  });

  /* Zero is the most requested answer — "put it back straight" — and would
     be swallowed by a `||`. */
  it("sait qu'un objet peut être voulu d'aplomb", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: 0 })).toBe(0);
  });

  it("rend la main au hasard quand on efface le réglage", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: null })).toBe(tiltOf(d.id));
  });

  it("tourne un objet posé", () => {
    const item = { ...makeDecor({ motif: "plant" }), rot: -25 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    expect(angleRendu(container.querySelector("[draggable]"))).toBe(-25);
  });

  it("tourne un objet accroché", () => {
    const item = { ...makeWallDecor({ motif: "frame" }), rot: 90 };
    const { container } = render(<WallItem item={item} {...dnd} />);
    expect(angleRendu(container.querySelector("[data-wall-item] > div"))).toBe(90);
  });

  /* Hanging objects stop receiving the cursor for the length of a gesture,
     so as not to steal the drops of the shelf they overflow. But a drag
     whose SOURCE stops being hit-testable is cancelled outright: the object
     one is holding must exclude itself from the rule, without which a
     flying object cannot be picked up again once laid. */
  it("se marque comme celui qu'on tient, le temps du geste", () => {
    const { container } = render(<WallItem item={makeWallDecor({ motif: "frame" })} {...dnd} />);
    const el = container.querySelector("[data-wall-item]");
    expect(el.dataset.dragSelf).toBeUndefined();

    // jsdom attaches no drag clipboard: we supply one
    fireEvent.dragStart(el, { dataTransfer: { effectAllowed: "" } });
    expect(el.dataset.dragSelf).toBe("1");

    fireEvent.dragEnd(el);
    expect(el.dataset.dragSelf).toBeUndefined();
  });

  /* The grip was the size of the drawing upright: an object lying down was
     seen along its whole length but could only be caught in the middle. */
  it("donne à la prise d'un objet accroché la taille qu'il occupe vraiment", () => {
    const prise = (rot) => {
      const { container } = render(
        <WallItem item={{ ...makeWallDecor({ motif: "frame" }), rot }} {...dnd} />
      );
      return Number.parseInt(container.querySelector("[data-wall-item]").style.width, 10);
    };
    expect(prise(45)).toBeGreaterThan(prise(0));
    expect(prise(90)).toBe(prise(0));
  });

  it("laisse le carton s'appuyer quand rien n'est réglé", () => {
    const item = makeDecor({ motif: "divider" });
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    expect(angleRendu(container.querySelector("[draggable]"))).toBe(Number(leanOf(item.id)));
  });
});

/* A CSS rotation moves nothing: the object lying down crossed the
   neighbouring cases without ever asking them for room. So the wrapper —
   which is also the drop target — claims the bounding box's width, and what
   one sees becomes again what takes up the room. */
describe("la place que prend un objet tourné", () => {
  const width = (over) => {
    const item = { ...makeDecor({ motif: "plant" }), ...over };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    return Number.parseInt(container.querySelector("[data-shelf-item]").style.width, 10);
  };

  it("s'élargit quand l'objet penche", () => {
    expect(width({ rot: 45 })).toBeGreaterThan(width({ rot: 0 }));
  });

  /* A square laid down by a quarter turn falls back on itself: it is the
     same bounding box, and therefore the same room. */
  it("rend sa place au carré remis d'équerre", () => {
    expect(width({ rot: 90 })).toBe(width({ rot: 0 }));
  });

  it("compte pareil à gauche et à droite", () => {
    expect(width({ rot: -40 })).toBe(width({ rot: 40 }));
  });

  it("passe par un maximum à mi-chemin", () => {
    expect(width({ rot: 45 })).toBeGreaterThan(width({ rot: 90 }));
  });

  /* The gap to the neighbour belongs entirely to the RIGHT: it is a
     `marginRight` that was moved into the wrapper. Centring the card inside
     it cut it in two and opened a hole on the left that nothing held. */
  it("ne laisse rien traîner à gauche du carton", () => {
    const item = { ...makeDecor({ motif: "divider" }), rot: 2 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    const env = container.querySelector("[data-shelf-item]");
    const cardstock = container.querySelector("[draggable]");
    const dx = Number(cardstock.style.transform.match(/translate\((-?\d+)px/)[1]);
    const w = Number.parseInt(cardstock.style.width, 10);
    const h = Number.parseInt(cardstock.style.height, 10);
    const frame = rotatedBox(w, h, 2);
    // the card is aligned left, not centred
    expect(dx).toBe(frame.dx);
    // and the whole gap to the neighbour stays on the right
    expect(Number.parseInt(env.style.width, 10) - frame.width).toBe(GAP_X);
  });

  /* The card pivots on its FOOT: the bounding box starts from the side the
     head leans towards, and the wrapper that dutifully centred it let it
     come out at the top, over the case next door. */
  it("réserve la place là où la tête penche, et pas ailleurs", () => {
    const item = { ...makeDecor({ motif: "divider" }), rot: 30 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    const cardstock = container.querySelector("[draggable]");
    const [, dx] = cardstock.style.transform.match(/translate\((-?\d+)px, (-?\d+)px\)/) || [];
    // leaning right, the head shifts the box: the card backs off to the left
    expect(Number(dx)).toBeLessThan(0);
  });

  it("repose le pied sur la planche quand l'objet se couche", () => {
    const item = { ...makeDecor({ motif: "plant" }), rot: 90 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    const el = container.querySelector("[draggable]");
    const dy = Number(el.style.transform.match(/translate\(-?\d+px, (-?\d+)px\)/)?.[1]);
    // without this lift, the bottom corner passed under the wood
    expect(dy).toBeLessThan(0);
  });

  it("mesure le carton sur sa hauteur, pas sur sa tranche", () => {
    const cardstock = (rot) => {
      const item = { ...makeDecor({ motif: "divider" }), rot };
      const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
      return Number.parseInt(container.querySelector("[data-shelf-item]").style.width, 10);
    };
    // lying down, it claims its case height instead of its thirty pixels
    expect(cardstock(90)).toBeGreaterThan(cardstock(0) * 3);
  });
});

describe("l'intercalaire, repris pour qu'on le voie", () => {
  const cardstock = (over = {}) => {
    const item = { ...makeDecor({ motif: "divider", color: "burgundy" }), ...over };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    return container.querySelector("[draggable]");
  };

  /* The body carried the kraft common to the cases: among twelve edges of
     the same paper, what separates had the colour of what it separates. */
  it("porte sa propre encre et non le papier des boîtiers", () => {
    const el = cardstock();
    /* The wash is a `backgroundImage` and no longer a composite
       `background`: the card took an opaque backdrop underneath so that the
       wall no longer shows through it, and the two do not fit in the same
       property. It is the wash we are asking about — the backdrop, for its
       part, must precisely be neutral. */
    expect(el.style.backgroundImage).toContain("140, 58, 52");
    expect(el.style.backgroundImage).not.toContain("216, 198, 156");
  });

  it("dresse un onglet plein en tête", () => {
    const head = cardstock().firstChild;
    expect(head.style.background).toBe("rgb(140, 58, 52)");
    expect(Number.parseInt(head.style.height, 10)).toBeGreaterThan(10);
  });

  it("écrit son nom sous l'onglet, à l'encre sombre", () => {
    const el = cardstock({ label: "Polars" });
    const nom = [...el.querySelectorAll("span")].find((s) => s.textContent === "Polars");
    expect(nom.style.color).toBe("var(--c-ink)");
    expect(Number.parseInt(nom.style.marginTop, 10)).toBeGreaterThan(0);
  });

  it("est plus large qu'une tranche", () => {
    expect(Number.parseInt(cardstock().style.width, 10)).toBeGreaterThan(26);
  });
});
