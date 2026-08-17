import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapView, MAX_ZOOM } from "./useMapView";

/* ============================================================
   WHAT THE WINDOW MUST NEVER DO
   ============================================================

   Two of these are the bugs a zoom always ships with, and neither shows
   at k = 1 — which is where every manual test starts:

   — panning off the edge, so the map is nowhere and the only way back
     is a button one has to think of;
   — `focusOn` recentring on something already in plain sight, which
     makes the map slide under the keyboard cursor at every arrow press.
   ============================================================ */

const box = (s: string) => s.split(" ").map(Number);

describe("the window onto a map", () => {
  it("starts as the whole map, and says so", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    expect(result.current.viewBox).toBe("0 0 1000 600");
    expect(result.current.moved).toBe(false);
    expect(result.current.canZoomOut).toBe(false);
  });

  it("zooms about the centre, so what one is looking at stays put", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    act(() => result.current.zoomBy(2));

    const [x, y, w, h] = box(result.current.viewBox);
    expect([w, h]).toEqual([500, 300]);
    /* The centre of the window is still the centre of the map. */
    expect([x! + w! / 2, y! + h! / 2]).toEqual([500, 300]);
  });

  it("clamps rather than magnifying without end", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    act(() => result.current.zoomBy(100));
    expect(result.current.k).toBe(MAX_ZOOM);
    expect(result.current.canZoomIn).toBe(false);

    act(() => result.current.zoomBy(0.001));
    expect(result.current.k).toBe(1);
    expect(result.current.viewBox).toBe("0 0 1000 600");
  });

  it("keeps the window inside the map when one pans past the edge", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    act(() => result.current.zoomBy(2));
    /* Far past the right edge: the window stops at the map's own edge
       rather than showing empty paper. */
    act(() => result.current.focusOn(9999, 9999));

    const [x, y, w, h] = box(result.current.viewBox);
    expect(x! + w!).toBe(1000);
    expect(y! + h!).toBe(600);
  });

  it("leaves the window alone when the point is already in sight", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    act(() => result.current.zoomBy(2));
    const before = result.current.viewBox;
    act(() => result.current.focusOn(500, 300));
    expect(result.current.viewBox).toBe(before);
  });

  it("brings back a point that has fallen out of the window", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    act(() => result.current.zoomBy(2));
    act(() => result.current.focusOn(120, 90));

    const [x, y, w, h] = box(result.current.viewBox);
    expect(120).toBeGreaterThanOrEqual(x!);
    expect(120).toBeLessThanOrEqual(x! + w!);
    expect(90).toBeGreaterThanOrEqual(y!);
    expect(90).toBeLessThanOrEqual(y! + h!);
  });

  it("reset undoes everything at once", () => {
    const { result } = renderHook(() => useMapView(1000, 600));
    act(() => result.current.zoomBy(3));
    act(() => result.current.focusOn(900, 550));
    expect(result.current.moved).toBe(true);

    act(() => result.current.reset());
    expect(result.current.viewBox).toBe("0 0 1000 600");
    expect(result.current.moved).toBe(false);
  });
});
