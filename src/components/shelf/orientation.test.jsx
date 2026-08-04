import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DecorItem, WallItem, angleOf, leanOf } from "./items";
import { tiltOf } from "../../domain/seeded";
import { makeDecor, makeWallDecor } from "../../shelf-views";

const noop = () => {};
const dnd = { onDragStart: noop, onDragEnd: noop, onDragOverBox: noop, onEdit: noop };

const angleRendu = (el) => {
  const m = el.style.transform.match(/rotate\((-?[\d.]+)deg\)/);
  return m && Number(m[1]);
};

describe("l'orientation d'un objet", () => {
  /* Le guingois semé est ce qui fait qu'une étagère ressemble à une
     étagère : tant que personne n'a rien réglé, il doit rester intact. */
  it("garde le guingois de son identifiant tant qu'on n'y touche pas", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf(d)).toBe(tiltOf(d.id));
    expect(angleOf(d, true)).toBe(leanOf(d.id));
  });

  it("obéit à l'angle réglé", () => {
    const d = makeDecor({ motif: "plant" });
    expect(angleOf({ ...d, rot: 37 })).toBe(37);
  });

  /* Zéro est la réponse la plus demandée — « remets-le droit » — et
     serait avalée par un `||`. */
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
    expect(angleRendu(container.querySelector("[data-wall-item]"))).toBe(90);
  });

  it("laisse le carton s'appuyer quand rien n'est réglé", () => {
    const item = makeDecor({ motif: "divider" });
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    expect(angleRendu(container.querySelector("[draggable]"))).toBe(Number(leanOf(item.id)));
  });
});

describe("l'intercalaire, repris pour qu'on le voie", () => {
  const carton = (over = {}) => {
    const item = { ...makeDecor({ motif: "divider", color: "burgundy" }), ...over };
    const { container } = render(<DecorItem item={item} ctx={{}} onLabel={noop} {...dnd} />);
    return container.querySelector("[draggable]");
  };

  /* Le corps portait le kraft commun aux boîtiers : entre douze tranches
     du même papier, ce qui sépare avait la couleur de ce qu'il sépare. */
  it("porte sa propre encre et non le papier des boîtiers", () => {
    const el = carton();
    // le bordeaux de la vue, en lavis — et plus le kraft des tranches
    expect(el.style.background).toContain("140, 58, 52");
    expect(el.style.background).not.toContain("216, 198, 156");
  });

  it("dresse un onglet plein en tête", () => {
    const head = carton().firstChild;
    expect(head.style.background).toBe("rgb(140, 58, 52)");
    expect(Number.parseInt(head.style.height, 10)).toBeGreaterThan(10);
  });

  it("écrit son nom sous l'onglet, à l'encre sombre", () => {
    const el = carton({ label: "Polars" });
    const nom = [...el.querySelectorAll("span")].find((s) => s.textContent === "Polars");
    expect(nom.style.color).toBe("rgb(43, 38, 32)");
    expect(Number.parseInt(nom.style.marginTop, 10)).toBeGreaterThan(0);
  });

  it("est plus large qu'une tranche", () => {
    expect(Number.parseInt(carton().style.width, 10)).toBeGreaterThan(26);
  });
});
