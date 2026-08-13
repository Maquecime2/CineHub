import { describe, it, expect } from "vitest";
import {
  PAINTS,
  PATTERNS,
  PATTERN_KEYS,
  TEXTURES,
  MATERIALS,
  MATERIAL_KEYS,
  FINISHES,
  paintStyle,
  patternLayer,
  textureLayer,
  materialStyle,
  materialOf,
  paintOf,
  PLANK_SHADOW,
  wallStyle,
} from "./surfaces";

/* This module's contract holds in three sentences: every key of the
   catalogue gives a style, an unknown key never throws, and nothing put
   into a data URL can break it. */

describe("the catalogue", () => {
  it("gives every paint a ground", () => {
    for (const key of Object.keys(PAINTS)) {
      expect(paintStyle(key).backgroundImage).toBeTruthy();
    }
  });

  it("gives every wallpaper a weave", () => {
    for (const key of PATTERN_KEYS) {
      const layer = patternLayer(key, "#8C3A34");
      expect(layer?.backgroundImage).toContain("data:image/svg+xml");
      expect(layer?.backgroundSize).toMatch(/^\d+px \d+px$/);
    }
    expect(PATTERN_KEYS.length).toBeGreaterThan(5);
  });

  it("gives every texture a layer", () => {
    for (const key of Object.keys(TEXTURES)) {
      const layer = textureLayer(key);
      expect(layer?.backgroundImage).toBeTruthy();
      // a texture darkens the background, it does not cover it
      expect(layer?.mixBlendMode).toBe("multiply");
    }
  });

  it("gives every material a ground and a shadow", () => {
    for (const key of MATERIAL_KEYS) {
      const style = materialStyle(key);
      expect(style.background).toBeTruthy();
      expect(style.boxShadow).toBeTruthy();
    }
    // the five families are represented
    const families = new Set(MATERIAL_KEYS.map((k) => materialOf(k).family));
    expect(families).toEqual(new Set(["bois", "metal", "verre", "pierre", "peint"]));
  });
});

describe("an unknown key", () => {
  it("falls back on the default without throwing", () => {
    expect(paintOf("n'existe pas")).toBe(PAINTS.platre);
    expect(materialOf("n'existe pas")).toBe(MATERIALS.chene);
    expect(paintStyle(undefined).backgroundImage).toBeTruthy();
    expect(materialStyle(undefined, "vernis inconnu").background).toBeTruthy();
  });

  /* A wallpaper and a texture are OPTIONAL layers: their absence must
     read as such and not as an empty style, otherwise the caller would
     lay a transparent layer over the wall. */
  it("returns null for an optional layer", () => {
    expect(patternLayer(undefined)).toBeNull();
    expect(patternLayer("n'existe pas")).toBeNull();
    expect(textureLayer(undefined)).toBeNull();
    expect(textureLayer("n'existe pas")).toBeNull();
  });
});

describe("the data URLs", () => {
  /* The hash of a colour and the per cent of a width are the two
     characters that break an SVG data URL. The per cent must be escaped
     BEFORE the hash, failing which the `%23` just written would be
     re-escaped into `%2523`. */
  it("escape the hash and the percent, in that order", () => {
    const layer = patternLayer("pois", "#8C3A34");
    const url = String(layer?.backgroundImage);
    expect(url).toContain("%238C3A34");
    expect(url).not.toContain("#8C3A34");
    expect(url).not.toContain("%2523");
  });

  it("do not let a double quote break the attribute", () => {
    for (const key of PATTERN_KEYS) {
      expect(PATTERNS[key]?.draw("#000000")).not.toContain('"');
    }
  });
});

describe("the finishes", () => {
  it("change the sheen without changing the colour", () => {
    const mat = materialStyle("acier", "mat");
    const lacquer = materialStyle("acier", "laque");
    expect(mat.background).not.toBe(lacquer.background);
    // the background colour, though, is the same in both
    for (const s of [mat, lacquer]) expect(String(s.background)).toContain("#B9BFC4");
  });

  it("leaves glass translucent and its shadow light", () => {
    const style = materialStyle("verre");
    expect(style.opacity).toBeLessThan(1);
    expect(style.boxShadow).not.toBe(PLANK_SHADOW);
  });

  it("knows three finishes", () => {
    expect(Object.keys(FINISHES)).toEqual(["mat", "satine", "laque"]);
  });
});

describe("the assembled wall", () => {
  /* The non-regression contract: with no decor, the row gets back
     exactly the style it had before the paints — a background, the row's
     tint or nothing, and not one layer more. */
  it("with no decor, returns the earlier shelf character for character", () => {
    const bare = wallStyle(null, undefined, null);
    expect(bare.frame).toEqual({ background: "transparent" });
    expect(bare.texture).toBeNull();

    const bedside = wallStyle(undefined, undefined, "#8C3A340D");
    expect(bedside.frame).toEqual({ background: "#8C3A340D" });
  });

  it("stacks the wallpaper IN FRONT OF the paint", () => {
    const { frame } = wallStyle({ paint: "sauge", pattern: "pois" }, "#3E5B4B");
    const images = String(frame.backgroundImage);
    // the first layer named is the one on top
    expect(images.indexOf("data:image/svg+xml")).toBeLessThan(images.indexOf("linear-gradient"));
  });

  /* A list of sizes shorter than the list of images REPEATS in CSS: the
     pattern would then take the gradient's size and stop repeating. The
     two lists must have the same length. */
  it("gives as many sizes as images", () => {
    const { frame } = wallStyle({ paint: "nuit", pattern: "damier" });
    /* Count the layers, and not the commas: a gradient contains some, a
       data URL too, and a composed colour again. So we only cut at the
       commas of depth zero. */
    const count = (s: string) => {
      let depth = 0,
        n = 1;
      for (const ch of s) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === "," && depth === 0) n++;
      }
      return n;
    };
    expect(count(String(frame.backgroundSize))).toBe(count(String(frame.backgroundImage)));
  });

  it("hands the texture back separately, so it can blend", () => {
    const { frame, texture } = wallStyle({ paint: "lin", texture: "crepi" });
    expect(texture?.mixBlendMode).toBe("multiply");
    // and it has not landed in the frame's background
    expect(String(frame.backgroundImage)).not.toContain(String(texture?.backgroundImage));
  });

  it("keeps the shelf's tint under the paint", () => {
    const { frame } = wallStyle({ paint: "craie" }, undefined, "#8C3A340D");
    expect(frame.background).toBe("#8C3A340D");
    expect(frame.backgroundImage).toBeTruthy();
  });
});
