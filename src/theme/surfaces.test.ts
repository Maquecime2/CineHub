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

describe("le catalogue", () => {
  it("donne un fond à chaque peinture", () => {
    for (const key of Object.keys(PAINTS)) {
      expect(paintStyle(key).backgroundImage).toBeTruthy();
    }
  });

  it("donne une trame à chaque papier peint", () => {
    for (const key of PATTERN_KEYS) {
      const layer = patternLayer(key, "#8C3A34");
      expect(layer?.backgroundImage).toContain("data:image/svg+xml");
      expect(layer?.backgroundSize).toMatch(/^\d+px \d+px$/);
    }
    expect(PATTERN_KEYS.length).toBeGreaterThan(5);
  });

  it("donne une couche à chaque texture", () => {
    for (const key of Object.keys(TEXTURES)) {
      const layer = textureLayer(key);
      expect(layer?.backgroundImage).toBeTruthy();
      // a texture darkens the background, it does not cover it
      expect(layer?.mixBlendMode).toBe("multiply");
    }
  });

  it("donne un fond et une ombre à chaque matériau", () => {
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

describe("une clé inconnue", () => {
  it("retombe sur le défaut sans jeter", () => {
    expect(paintOf("n'existe pas")).toBe(PAINTS.platre);
    expect(materialOf("n'existe pas")).toBe(MATERIALS.chene);
    expect(paintStyle(undefined).backgroundImage).toBeTruthy();
    expect(materialStyle(undefined, "vernis inconnu").background).toBeTruthy();
  });

  /* A wallpaper and a texture are OPTIONAL layers: their absence must
     read as such and not as an empty style, otherwise the caller would
     lay a transparent layer over the wall. */
  it("rend null pour une couche facultative", () => {
    expect(patternLayer(undefined)).toBeNull();
    expect(patternLayer("n'existe pas")).toBeNull();
    expect(textureLayer(undefined)).toBeNull();
    expect(textureLayer("n'existe pas")).toBeNull();
  });
});

describe("les adresses-données", () => {
  /* The hash of a colour and the per cent of a width are the two
     characters that break an SVG data URL. The per cent must be escaped
     BEFORE the hash, failing which the `%23` just written would be
     re-escaped into `%2523`. */
  it("échappent le dièse et le pourcent, dans cet ordre", () => {
    const layer = patternLayer("pois", "#8C3A34");
    const url = String(layer?.backgroundImage);
    expect(url).toContain("%238C3A34");
    expect(url).not.toContain("#8C3A34");
    expect(url).not.toContain("%2523");
  });

  it("ne laissent pas de guillemet double casser l'attribut", () => {
    for (const key of PATTERN_KEYS) {
      expect(PATTERNS[key]?.draw("#000000")).not.toContain('"');
    }
  });
});

describe("les finitions", () => {
  it("changent l'éclat sans changer la couleur", () => {
    const mat = materialStyle("acier", "mat");
    const laque = materialStyle("acier", "laque");
    expect(mat.background).not.toBe(laque.background);
    // the background colour, though, is the same in both
    for (const s of [mat, laque]) expect(String(s.background)).toContain("#B9BFC4");
  });

  it("laisse le verre translucide et son ombre légère", () => {
    const style = materialStyle("verre");
    expect(style.opacity).toBeLessThan(1);
    expect(style.boxShadow).not.toBe(PLANK_SHADOW);
  });

  it("connaît trois finitions", () => {
    expect(Object.keys(FINISHES)).toEqual(["mat", "satine", "laque"]);
  });
});

describe("le mur assemblé", () => {
  /* The non-regression contract: with no decor, the row gets back
     exactly the style it had before the paints — a background, the row's
     tint or nothing, and not one layer more. */
  it("sans décor, rend le rayon d'avant au caractère près", () => {
    const bare = wallStyle(null, undefined, null);
    expect(bare.frame).toEqual({ background: "transparent" });
    expect(bare.texture).toBeNull();

    const bedside = wallStyle(undefined, undefined, "#8C3A340D");
    expect(bedside.frame).toEqual({ background: "#8C3A340D" });
  });

  it("empile le papier peint DEVANT la peinture", () => {
    const { frame } = wallStyle({ paint: "sauge", pattern: "pois" }, "#3E5B4B");
    const images = String(frame.backgroundImage);
    // the first layer named is the one on top
    expect(images.indexOf("data:image/svg+xml")).toBeLessThan(images.indexOf("linear-gradient"));
  });

  /* A list of sizes shorter than the list of images REPEATS in CSS: the
     pattern would then take the gradient's size and stop repeating. The
     two lists must have the same length. */
  it("donne autant de tailles que d'images", () => {
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

  it("sort la texture à part, pour qu'elle se fonde", () => {
    const { frame, texture } = wallStyle({ paint: "lin", texture: "crepi" });
    expect(texture?.mixBlendMode).toBe("multiply");
    // and it has not landed in the frame's background
    expect(String(frame.backgroundImage)).not.toContain(String(texture?.backgroundImage));
  });

  it("garde la teinte du rayon sous la peinture", () => {
    const { frame } = wallStyle({ paint: "craie" }, undefined, "#8C3A340D");
    expect(frame.background).toBe("#8C3A340D");
    expect(frame.backgroundImage).toBeTruthy();
  });
});
