import { describe, it, expect } from "vitest";
import { neighbourInDirection } from "./sky";
import type { PlacedNode } from "../types";

const star = (id: string, x: number, y: number): PlacedNode => ({
  id,
  kind: "film",
  label: id,
  sub: "",
  degree: 1,
  x,
  y,
});

/* A small cross: the centre, and a star at each cardinal point. The y
   axis points down, as it does in SVG. */
const centre = star("centre", 100, 100);
const right = star("right", 200, 100);
const left = star("left", 0, 100);
const up = star("up", 100, 0);
const down = star("down", 100, 200);
const cross = [centre, right, left, up, down];

describe("moving through the sky by keyboard", () => {
  it("does go in all four directions", () => {
    expect(neighbourInDirection(cross, "centre", "right")?.id).toBe("right");
    expect(neighbourInDirection(cross, "centre", "left")?.id).toBe("left");
    expect(neighbourInDirection(cross, "centre", "up")?.id).toBe("up");
    expect(neighbourInDirection(cross, "centre", "down")?.id).toBe("down");
  });

  it("takes the nearest among those on the right side", () => {
    const far = star("far", 400, 100);
    const near = star("near", 150, 100);
    expect(neighbourInDirection([centre, far, near], "centre", "right")?.id).toBe("near");
  });

  /* With no cone, all four arrows would point at the same diagonal
     neighbour, and we would go round in circles between two stars. */
  it("ignores what is not squarely in the direction", () => {
    const diagonal = star("diagonal", 110, 200); // almost straight below
    expect(neighbourInDirection([centre, diagonal], "centre", "right")).toBeNull();
    expect(neighbourInDirection([centre, diagonal], "centre", "down")?.id).toBe("diagonal");
  });

  it("does not move when there is nothing on that side", () => {
    expect(neighbourInDirection([centre, right], "centre", "left")).toBeNull();
  });

  it("never returns itself", () => {
    expect(neighbourInDirection([centre], "centre", "right")).toBeNull();
  });

  /* Entering the map: the first arrow must put the cursor somewhere
     rather than doing nothing. */
  it("takes the first star when we come from nowhere", () => {
    expect(neighbourInDirection(cross, null, "right")?.id).toBe("centre");
  });

  it("takes the first star when the starting point has vanished", () => {
    expect(neighbourInDirection(cross, "effacé", "up")?.id).toBe("centre");
  });

  it("returns nothing from an empty sky", () => {
    expect(neighbourInDirection([], null, "down")).toBeNull();
  });

  it("ignores a star exactly on top of it", () => {
    const twin = star("twin", 100, 100);
    expect(neighbourInDirection([centre, twin], "centre", "right")).toBeNull();
  });
});
