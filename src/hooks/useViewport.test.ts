import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewport, resetViewport } from "./useViewport";
import { BP } from "../theme/tokens";

/* jsdom does not implement matchMedia. We lay down one that really
   knows how to answer — width and pointer fineness — so that the hook is
   tested on what it does and not on a stub that always says no. */
type Listener = () => void;

let width = 1280;
let coarse = false;
const listeners = new Set<Listener>();

const matches = (query: string): boolean => {
  if (query.includes("pointer: coarse")) return coarse;
  const min = /min-width:\s*(\d+)px/.exec(query);
  const max = /max-width:\s*(\d+)px/.exec(query);
  if (min && width < Number(min[1])) return false;
  if (max && width > Number(max[1])) return false;
  return !!(min || max);
};

const install = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return matches(query);
    },
    media: query,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }));
};

/** Resize: the window changes, then the queries say so. */
const resize = (w: number, opts: { coarse?: boolean } = {}) => {
  act(() => {
    width = w;
    coarse = opts.coarse ?? false;
    listeners.forEach((l) => l());
  });
};

describe("useViewport", () => {
  beforeEach(() => {
    width = 1280;
    coarse = false;
    listeners.clear();
    install();
    resetViewport();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetViewport();
  });

  it("reads the size from the very first render, without waiting for an effect", () => {
    width = 390;
    resetViewport();
    const { result } = renderHook(() => useViewport());
    expect(result.current.phone).toBe(true);
    expect(result.current.desk).toBe(false);
  });

  it("the three sizes rule each other out", () => {
    const { result } = renderHook(() => useViewport());
    for (const w of [390, 800, 1400]) {
      resize(w);
      const { phone, tablet, desk } = result.current;
      expect([phone, tablet, desk].filter(Boolean)).toHaveLength(1);
    }
  });

  it("follows the thresholds declared in the tokens", () => {
    const { result } = renderHook(() => useViewport());
    resize(BP.phone - 1);
    expect(result.current.phone).toBe(true);
    resize(BP.phone);
    expect(result.current.tablet).toBe(true);
    resize(BP.tablet);
    expect(result.current.desk).toBe(true);
  });

  it("how fine the pointer is, is another question than the width", () => {
    const { result } = renderHook(() => useViewport());
    resize(1400, { coarse: true });
    expect(result.current.desk).toBe(true);
    expect(result.current.coarse).toBe(true);
  });

  it("with no matchMedia, we return the desktop rather than nothing", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("matchMedia", undefined);
    resetViewport();
    const { result } = renderHook(() => useViewport());
    expect(result.current.desk).toBe(true);
  });

  it("unsubscribes on the way out", () => {
    const { unmount } = renderHook(() => useViewport());
    expect(listeners.size).toBeGreaterThan(0);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
