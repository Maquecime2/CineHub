import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { usePointerDrag } from "./usePointerDrag";

/* The bridge is not tested by eye: what it produces are events nobody
   sees go by. So we mount a grabbable target, we touch it, and we look
   at what the shelf would have heard. */

const Bridge = ({ on = true }: { on?: boolean }) => {
  usePointerDrag(on);
  return null;
};

let source: HTMLElement;
let target: HTMLElement;
let heard: { type: string; on: string }[];

/* jsdom has no PointerEvent. A MouseEvent already carries
   clientX/clientY and the button; all it lacks is the pointer id. */
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
      /* What items.jsx really does at the start of the gesture, and
         which throws if the drag clipboard was not provided. */
      if (type === "dragstart") (e as DragEvent).dataTransfer!.effectAllowed = "move";
    });
  }
};

describe("usePointerDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    heard = [];
    /* A BUTTON, AND NOT A `div` — that is what the shelf really
       renders. A case is written `<button draggable="true">` so as to
       open with the keyboard as much as with the mouse. This test used
       to mount a `div`, and it therefore let through a bridge that set
       aside every press started inside a button: with the finger, no row
       case could be picked up. A test bench that does not look like the
       product proves nothing. */
    source = document.createElement("button");
    source.setAttribute("draggable", "true");
    source.innerHTML = '<button type="button">ouvrir</button>';
    target = document.createElement("div");
    document.body.append(source, target);
    listen(source, "source");
    listen(target, "target");
    /* What lies under the finger: jsdom does no layout, so
       elementFromPoint never finds anything on its own. */
    document.elementFromPoint = () => target;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("a held press grabs, a swipe lets the page scroll", () => {
    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard.map((h) => h.type)).toContain("dragstart");

    pointer("pointerup", 10, 10);

    heard = [];
    /* The same start, but the finger races off before the press has held. */
    pointer("pointerdown", 10, 10, source);
    pointer("pointermove", 60, 10);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard).toHaveLength(0);
  });

  it("the whole gesture speaks the shelf's vocabulary", () => {
    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    pointer("pointermove", 120, 40);
    pointer("pointerup", 120, 40);

    const types = heard.map((h) => h.type);
    expect(types).toEqual(
      expect.arrayContaining(["dragstart", "dragenter", "dragover", "drop", "dragend"])
    );
    /* The start and the end belong to the held thing, the drop to what
       lies beneath: confuse them, and the row never receives anything. */
    expect(heard.find((h) => h.type === "dragstart")?.on).toBe("source");
    expect(heard.find((h) => h.type === "drop")?.on).toBe("target");
    expect(heard.find((h) => h.type === "dragend")?.on).toBe("source");
  });

  it("the marking that cuts scrolling lasts only as long as the gesture", () => {
    render(<Bridge />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    expect(source.dataset.pointerDrag).toBe("1");
    pointer("pointerup", 10, 10);
    expect(source.dataset.pointerDrag).toBeUndefined();
  });

  it("a button inside the held thing stays a button", () => {
    render(<Bridge />);
    const button = source.querySelector("button")!;
    pointer("pointerdown", 10, 10, button);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard).toHaveLength(0);
  });

  it("at the screen's edge, the shelf scrolls and the marker follows", () => {
    /* A container with something to scroll: jsdom lays nothing out, so
       the heights are set by hand. */
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

    /* The finger enters the bottom band, then stops moving. */
    pointer("pointermove", 120, window.innerHeight - 5);
    heard = [];
    act(() => void vi.advanceTimersByTime(64));

    expect(top).toBeGreaterThan(0);
    /* The finger is still: without the frame, no further `dragover`, and
       the marker would stay on the slot from before the scroll. */
    expect(heard.filter((h) => h.type === "dragover").length).toBeGreaterThan(0);

    pointer("pointerup", 120, window.innerHeight - 5);
    const settled = top;
    act(() => void vi.advanceTimersByTime(64));
    expect(top).toBe(settled);
  });

  it("with a mouse, the bridge is not set up", () => {
    render(<Bridge on={false} />);
    pointer("pointerdown", 10, 10, source);
    act(() => void vi.advanceTimersByTime(300));
    expect(heard).toHaveLength(0);
  });
});
