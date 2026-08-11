import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { usePointerDrag } from "./usePointerDrag";

/* Le pont ne se teste pas a l'oeil : ce qu'il produit, ce sont des
   evenements que personne ne voit passer. On monte donc une cible
   saisissable, on la touche, et on regarde ce que l'etagere aurait
   entendu. */

const Bridge = ({ on = true }: { on?: boolean }) => {
  usePointerDrag(on);
  return null;
};

let source: HTMLElement;
let target: HTMLElement;
let heard: { type: string; on: string }[];

/* jsdom n'a pas de PointerEvent. Un MouseEvent porte deja clientX/clientY
   et le bouton ; il ne lui manque que le numero de pointeur. */
const pointer = (type: string, x: number, y: number, node: EventTarget = document) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(ev, "pointerId", { value: 1 });
  act(() => {
    node.dispatchEvent(ev);
  });
};

const listen = (node: HTMLElement, name: string) => {
  for (const type of ["dragstart", "dragover", "drop", "dragend", "dragenter", "dragleave"]) {
    node.addEventListener(type, (e) => {
      heard.push({ type, on: name });
      /* Ce que fait vraiment items.jsx au depart du geste, et qui jette
         si le presse-papiers du glissement n'a pas ete fourni. */
      if (type === "dragstart") (e as DragEvent).dataTransfer!.effectAllowed = "move";
    });
  }
};

describe("usePointerDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    heard = [];
    /* UN BOUTON, ET PAS UN `div` — c'est ce que l'etagere rend vraiment.
       Un boitier s'ecrit `<button draggable="true">` pour s'ouvrir au
       clavier autant qu'a la souris. Ce test montait un `div`, et il a
       donc laisse passer un pont qui ecartait tout appui commence dans
       un bouton : au doigt, aucun boitier de rayon ne se prenait. Un
       banc d'essai qui ne ressemble pas au produit ne prouve rien. */
    source = document.createElement("button");
    source.setAttribute("draggable", "true");
    source.innerHTML = '<button type="button">ouvrir</button>';
    target = document.createElement("div");
    document.body.append(source, target);
    listen(source, "source");
    listen(target, "target");
    /* Ce qui se trouve sous le doigt : jsdom ne fait pas de mise en page,
       donc elementFromPoint ne trouve jamais rien tout seul. */
    document.elementFromPoint = () => target;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("un appui maintenu saisit, un balayage laisse defiler", () => {
    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard.map((h) => h.type)).toContain("dragstart");

    pointer("pointerup", 10, 10);

    heard = [];
    /* Le meme depart, mais le doigt file avant que l'appui ait tenu. */
    pointer("pointerdown", 10, 10, source);
    pointer("pointermove", 60, 10);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard).toHaveLength(0);
  });

  it("le geste complet parle le vocabulaire de l'etagere", () => {
    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    pointer("pointermove", 120, 40);
    pointer("pointerup", 120, 40);

    const types = heard.map((h) => h.type);
    expect(types).toEqual(
      expect.arrayContaining(["dragstart", "dragenter", "dragover", "drop", "dragend"])
    );
    /* Le depart et la fin appartiennent a la chose tenue, le depot a ce
       qui est dessous : les confondre, et le rayon ne recoit jamais rien. */
    expect(heard.find((h) => h.type === "dragstart")?.on).toBe("source");
    expect(heard.find((h) => h.type === "drop")?.on).toBe("target");
    expect(heard.find((h) => h.type === "dragend")?.on).toBe("source");
  });

  it("le marquage qui coupe le defilement ne dure que le geste", () => {
    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    expect(source.dataset.pointerDrag).toBe("1");
    pointer("pointerup", 10, 10);
    expect(source.dataset.pointerDrag).toBeUndefined();
  });

  it("un bouton dans la chose tenue reste un bouton", () => {
    render(<Bridge />);
    const bouton = source.querySelector("button")!;
    pointer("pointerdown", 10, 10, bouton);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard).toHaveLength(0);
  });

  it("au bord de l'ecran, l'etagere defile et le repere suit", () => {
    /* Un conteneur qui a de quoi defiler : jsdom ne met rien en page, donc
       les hauteurs se posent a la main. */
    const box = document.createElement("div");
    box.style.overflowY = "auto";
    box.append(target);
    document.body.append(box);
    Object.defineProperty(box, "scrollHeight", { value: 2000 });
    Object.defineProperty(box, "clientHeight", { value: 400 });
    let top = 0;
    Object.defineProperty(box, "scrollTop", {
      get: () => top,
      set: (v: number) => {
        top = Math.max(0, Math.min(1600, v));
      },
    });

    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));

    /* Le doigt entre dans la bande basse, puis ne bouge plus. */
    pointer("pointermove", 120, window.innerHeight - 5);
    heard = [];
    act(() => void vi.advanceTimersByTime(64));

    expect(top).toBeGreaterThan(0);
    /* Le doigt est immobile : sans la trame, aucun `dragover` de plus, et
       le repere resterait sur la fente d'avant le defilement. */
    expect(heard.filter((h) => h.type === "dragover").length).toBeGreaterThan(0);

    pointer("pointerup", 120, window.innerHeight - 5);
    const settled = top;
    act(() => void vi.advanceTimersByTime(64));
    expect(top).toBe(settled);
  });

  it("a la souris, le pont ne s'installe pas", () => {
    render(<Bridge on={false} />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard).toHaveLength(0);
  });
});
