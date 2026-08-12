import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Calque } from "./Calque";
import { DropMark } from "../shelf/items";

/* What is tested here cannot be seen: a panel rendered in the wrong place
   still shows up, only it anchors on the column instead of the window and
   its `z-index` stops counting. The flaw only appeared on the phone, and
   only during the three hundred and forty milliseconds of the entry
   animation — which is to say never, on review. */

afterEach(cleanup);

describe("the layer", () => {
  it("renders into the document body, and not where it is called from", () => {
    const { container } = render(
      <div data-enters>
        <Calque>
          <div data-probe />
        </Calque>
      </div>
    );
    expect(container.querySelector("[data-probe]")).toBeNull();
    const probe = document.body.querySelector("[data-probe]");
    expect(probe).toBeTruthy();
    expect(probe?.parentElement).toBe(document.body);
  });

  it("the React tree holds: the event bubbles to the parent that wrote it", () => {
    let heard = 0;
    render(
      <div onClick={() => heard++}>
        <Calque>
          <button data-probe>poser</button>
        </Calque>
      </div>
    );
    (document.body.querySelector("[data-probe]") as HTMLElement).click();
    expect(heard).toBe(1);
  });

  it("the drop marker leaves the view column", () => {
    /* It places itself in SCREEN coordinates on every hover: rendered
       under a transformed column, the same coordinates designate another
       point, and the marker settles beside the slot it was aiming at. */
    const { container } = render(
      <div data-enters>
        <DropMark />
      </div>
    );
    expect(container.querySelector("[data-drop-mark]")).toBeNull();
    expect(document.body.querySelector("[data-drop-mark]")?.parentElement).toBe(document.body);
  });
});
