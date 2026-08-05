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

/* Le contrat de ce module tient en trois phrases : toute clé du
   catalogue donne un style, une clé inconnue ne jette jamais, et rien
   de ce qu'on met dans une adresse-données ne peut la casser. */

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
    expect(paintStyle(undefined).backgroundImage).toBeTruthy();
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

describe("le mur assemblé", () => {
  /* Le contrat de non-régression : sans décor, le rayon retrouve
     exactement le style qu'il avait avant les peintures — un fond, la
     teinte du rayon ou rien, et pas une couche de plus. */
  it("sans décor, rend le rayon d'avant au caractère près", () => {
    const nu = wallStyle(null, undefined, null);
    expect(nu.frame).toEqual({ background: "transparent" });
    expect(nu.texture).toBeNull();

    const chevet = wallStyle(undefined, undefined, "#8C3A340D");
    expect(chevet.frame).toEqual({ background: "#8C3A340D" });
  });

  it("empile le papier peint DEVANT la peinture", () => {
    const { frame } = wallStyle({ paint: "sauge", pattern: "pois" }, "#3E5B4B");
    const images = String(frame.backgroundImage);
    // la première couche citée est celle du dessus
    expect(images.indexOf("data:image/svg+xml")).toBeLessThan(images.indexOf("linear-gradient"));
  });

  /* Une liste de tailles plus courte que la liste d'images se RÉPÈTE en
     CSS : le motif reprendrait alors la taille du dégradé et cesserait
     de se répéter. Les deux listes doivent avoir la même longueur. */
  it("donne autant de tailles que d'images", () => {
    const { frame } = wallStyle({ paint: "nuit", pattern: "damier" });
    /* Compter les couches, et non les virgules : un dégradé en contient,
       une adresse-données aussi, et une couleur composée encore. On ne
       coupe donc qu'aux virgules de profondeur zéro. */
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
    // et elle n'a pas atterri dans le fond du cadre
    expect(String(frame.backgroundImage)).not.toContain(String(texture?.backgroundImage));
  });

  it("garde la teinte du rayon sous la peinture", () => {
    const { frame } = wallStyle({ paint: "craie" }, undefined, "#8C3A340D");
    expect(frame.background).toBe("#8C3A340D");
    expect(frame.backgroundImage).toBeTruthy();
  });
});
