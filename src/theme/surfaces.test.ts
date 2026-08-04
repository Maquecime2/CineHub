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
} from "./surfaces";

/* Le contrat de ce module tient en trois phrases : toute clé du
   catalogue donne un style, une clé inconnue ne jette jamais, et rien
   de ce qu'on met dans une adresse-données ne peut la casser. */

describe("le catalogue", () => {
  it("donne un fond à chaque peinture", () => {
    for (const key of Object.keys(PAINTS)) {
      expect(paintStyle(key).background).toBeTruthy();
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
      // une texture assombrit le fond, elle ne le recouvre pas
      expect(layer?.mixBlendMode).toBe("multiply");
    }
  });

  it("donne un fond et une ombre à chaque matériau", () => {
    for (const key of MATERIAL_KEYS) {
      const style = materialStyle(key);
      expect(style.background).toBeTruthy();
      expect(style.boxShadow).toBeTruthy();
    }
    // les cinq familles sont représentées
    const families = new Set(MATERIAL_KEYS.map((k) => materialOf(k).family));
    expect(families).toEqual(new Set(["bois", "metal", "verre", "pierre", "peint"]));
  });
});

describe("une clé inconnue", () => {
  it("retombe sur le défaut sans jeter", () => {
    expect(paintOf("n'existe pas")).toBe(PAINTS.platre);
    expect(materialOf("n'existe pas")).toBe(MATERIALS.chene);
    expect(paintStyle(undefined).background).toBeTruthy();
    expect(materialStyle(undefined, "vernis inconnu").background).toBeTruthy();
  });

  /* Un papier peint et une texture sont des couches FACULTATIVES : leur
     absence doit se lire comme telle et non comme un style vide, sinon
     l'appelant poserait un calque transparent par-dessus le mur. */
  it("rend null pour une couche facultative", () => {
    expect(patternLayer(undefined)).toBeNull();
    expect(patternLayer("n'existe pas")).toBeNull();
    expect(textureLayer(undefined)).toBeNull();
    expect(textureLayer("n'existe pas")).toBeNull();
  });
});

describe("les adresses-données", () => {
  /* Le dièse d'une couleur et le pourcent d'une largeur sont les deux
     caractères qui rompent une adresse-données SVG. Le pourcent doit
     être échappé AVANT le dièse, faute de quoi le `%23` qu'on vient
     d'écrire se ferait ré-échapper en `%2523`. */
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
    // la couleur de fond, elle, est la même dans les deux
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
