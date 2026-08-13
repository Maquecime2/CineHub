import { describe, it, expect, afterEach, vi } from "vitest";

/* What is tested here is not an appearance, it is a RULE: under a
   finger, no control goes below forty-four pixels, and with the mouse
   nothing moves. The rule is invisible on a re-reading — `tap` is an
   empty object half the time — and that is exactly the kind of thing
   that quietly walks away.

   The module reads the pointer ONCE, at import time: every case must
   therefore lay its stub before importing, hence `resetModules` and the
   dynamic import. */

const load = async (coarse: boolean) => {
  vi.resetModules();
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("coarse") ? coarse : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  return await import("./styles");
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the finger's targets", () => {
  it("under a finger, nothing goes below forty-four pixels", async () => {
    const { tap, tapSquare, underlineInput, TAP } = await load(true);
    expect(TAP).toBe(44);
    expect(tap.minHeight).toBe(44);
    /* `all: unset` makes the button inline: without this display, the
       minimum height would not apply at all. */
    expect(tap.display).toBe("inline-flex");
    expect(tapSquare.minWidth).toBe(44);
    expect(underlineInput.minHeight).toBe(44);
  });

  it("with a mouse, not one pixel changes", async () => {
    const { tap, tapSquare, underlineInput } = await load(false);
    expect(tap).toEqual({});
    expect(tapSquare).toEqual({});
    expect(underlineInput.minHeight).toBeUndefined();
    expect(underlineInput.padding).toBe("4px 2px");
  });

  it("with no matchMedia, we take the pointer to be fine", async () => {
    vi.resetModules();
    vi.stubGlobal("matchMedia", undefined);
    const { tap } = await import("./styles");
    expect(tap).toEqual({});
  });
});
