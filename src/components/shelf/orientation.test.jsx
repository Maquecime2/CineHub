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

describe("an object's orientation", () => {
  /* The sown lopsidedness is what makes a shelf look like a shelf: as long
     as nobody has set anything, it must stay intact. */
  it("keeps the crookedness of its identifier as long as nobody touches it", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf(d)).toBe(tiltOf(d.id));
    expect(angleOf(d, true)).toBe(leanOf(d.id));
  });

  it("obeys the angle that is set", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: 37 })).toBe(37);
  });

  /* Zero is the most requested answer — "put it back straight" — and would
     be swallowed by a `||`. */
  it("knows an object can be wanted upright", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: 0 })).toBe(0);
  });

  it("hands back to chance when the setting is erased", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: null })).toBe(tiltOf(d.id));
  });

  it("turns an object laid down", () => {
    const item = { ...makeDecor({ motif: "plant" }), rot: -25 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    expect(angleRendu(container.querySelector("[draggable]"))).toBe(-25);
  });

  it("turns an object hung up", () => {
    const item = { ...makeWallDecor({ motif: "frame" }), rot: 90 };
    const { container } = render(<WallItem item={item} {...dnd} />);
    expect(angleRendu(container.querySelector("[data-wall-item] > div"))).toBe(90);
  });

  /* Hanging objects stop receiving the cursor for the length of a gesture,
     so as not to steal the drops of the shelf they overflow. But a drag
     whose SOURCE stops being hit-testable is cancelled outright: the object
     one is holding must exclude itself from the rule, without which a
     flying object cannot be picked up again once laid. */
  it("marks itself as the one being held, for the length of the gesture", () => {
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
  it("gives a hung object's grip the size it really takes", () => {
    const grip = (rot) => {
      const { container } = render(
        <WallItem item={{ ...makeWallDecor({ motif: "frame" }), rot }} {...dnd} />
      );
      return Number.parseInt(container.querySelector("[data-wall-item]").style.width, 10);
    };
    expect(grip(45)).toBeGreaterThan(grip(0));
    expect(grip(90)).toBe(grip(0));
  });

  it("lets the cardstock lean when nothing is set", () => {
    const item = makeDecor({ motif: "divider" });
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    expect(angleRendu(container.querySelector("[draggable]"))).toBe(Number(leanOf(item.id)));
  });
});

/* A CSS rotation moves nothing: the object lying down crossed the
   neighbouring cases without ever asking them for room. So the wrapper —
   which is also the drop target — claims the bounding box's width, and what
   one sees becomes again what takes up the room. */
describe("the room a turned object takes", () => {
  const width = (over) => {
    const item = { ...makeDecor({ motif: "plant" }), ...over };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    return Number.parseInt(container.querySelector("[data-shelf-item]").style.width, 10);
  };

  it("widens as the object leans", () => {
    expect(width({ rot: 45 })).toBeGreaterThan(width({ rot: 0 }));
  });

  /* A square laid down by a quarter turn falls back on itself: it is the
     same bounding box, and therefore the same room. */
  it("gives its room back to a square put straight again", () => {
    expect(width({ rot: 90 })).toBe(width({ rot: 0 }));
  });

  it("counts the same on the left and on the right", () => {
    expect(width({ rot: -40 })).toBe(width({ rot: 40 }));
  });

  it("goes through a maximum half way", () => {
    expect(width({ rot: 45 })).toBeGreaterThan(width({ rot: 90 }));
  });

  /* The gap to the neighbour belongs entirely to the RIGHT: it is a
     `marginRight` that was moved into the wrapper. Centring the card inside
     it cut it in two and opened a hole on the left that nothing held. */
  it("leaves nothing hanging to the left of the cardstock", () => {
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
  it("keeps the room where the head leans, and nowhere else", () => {
    const item = { ...makeDecor({ motif: "divider" }), rot: 30 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    const cardstock = container.querySelector("[draggable]");
    const [, dx] = cardstock.style.transform.match(/translate\((-?\d+)px, (-?\d+)px\)/) || [];
    // leaning right, the head shifts the box: the card backs off to the left
    expect(Number(dx)).toBeLessThan(0);
  });

  it("sets the foot back on the plank when the object lies down", () => {
    const item = { ...makeDecor({ motif: "plant" }), rot: 90 };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    const el = container.querySelector("[draggable]");
    const dy = Number(el.style.transform.match(/translate\(-?\d+px, (-?\d+)px\)/)?.[1]);
    // without this lift, the bottom corner passed under the wood
    expect(dy).toBeLessThan(0);
  });

  it("measures the cardstock by its height, not by its edge", () => {
    const cardstock = (rot) => {
      const item = { ...makeDecor({ motif: "divider" }), rot };
      const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
      return Number.parseInt(container.querySelector("[data-shelf-item]").style.width, 10);
    };
    // lying down, it claims its case height instead of its thirty pixels
    expect(cardstock(90)).toBeGreaterThan(cardstock(0) * 3);
  });
});

describe("the divider, redrawn so it can be seen", () => {
  const cardstock = (over = {}) => {
    const item = { ...makeDecor({ motif: "divider", color: "burgundy" }), ...over };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    return container.querySelector("[draggable]");
  };

  /* The body carried the kraft common to the cases: among twelve edges of
     the same paper, what separates had the colour of what it separates. */
  it("carries its own ink and not the cases' paper", () => {
    const el = cardstock();
    /* The wash is a `backgroundImage` and no longer a composite
       `background`: the card took an opaque backdrop underneath so that the
       wall no longer shows through it, and the two do not fit in the same
       property. It is the wash we are asking about — the backdrop, for its
       part, must precisely be neutral. */
    expect(el.style.backgroundImage).toContain("140, 58, 52");
    expect(el.style.backgroundImage).not.toContain("216, 198, 156");
  });

  it("stands a solid tab at its head", () => {
    const head = cardstock().firstChild;
    expect(head.style.background).toBe("rgb(140, 58, 52)");
    expect(Number.parseInt(head.style.height, 10)).toBeGreaterThan(10);
  });

  it("writes its name under the tab, in dark ink", () => {
    const el = cardstock({ label: "Polars" });
    const name = [...el.querySelectorAll("span")].find((s) => s.textContent === "Polars");
    expect(name.style.color).toBe("var(--c-ink)");
    expect(Number.parseInt(name.style.marginTop, 10)).toBeGreaterThan(0);
  });

  it("is wider than a spine", () => {
    expect(Number.parseInt(cardstock().style.width, 10)).toBeGreaterThan(26);
  });
});
