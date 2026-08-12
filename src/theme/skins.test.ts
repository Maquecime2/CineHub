import { describe, it, expect, beforeEach } from "vitest";
import { SKINS, DEFAULT_SKIN, skinOf } from "./skins";
import { applySkin, loadSkinKey, saveSkinKey, SKIN_KEY } from "./applySkin";
import { C, F } from "./tokens";

const TOKENS = Object.keys(C);

describe("the catalogue of skins", () => {
  it("offers a good dozen of them, all distinct", () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SKINS.map((s) => s.key)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((s) => s.label)).size).toBe(SKINS.length);
  });

  /* THIS TEST HAS ALREADY EARNED ITS KEEP. Three colours in that file
     were mush — a `#9E9versa` and two of the same water. Written into a
     CSS variable, they would have thrown nothing: the browser ignores a
     declaration it does not understand, and the skin would simply have
     had one token that never changes. */
  it("has nothing but well-formed hex codes", () => {
    for (const skin of SKINS)
      for (const [token, color] of Object.entries(skin.c))
        expect(`${skin.key}.${token} = ${color}`).toMatch(/= #[0-9A-Fa-f]{6}$/);
  });

  /* A forgotten token is not caught by the default skin: the variables
     are written on the root and STAY there from one skin to the next. It
     would therefore keep the previous skin's value. */
  it("gives the fourteen tokens, without inventing one more", () => {
    for (const skin of SKINS) expect(Object.keys(skin.c).sort()).toEqual([...TOKENS].sort());
  });

  it("gives the four font roles, and the means to load them", () => {
    for (const skin of SKINS) {
      expect(Object.keys(skin.fonts).sort()).toEqual(["body", "hand", "mono", "title"]);
      expect(skin.google.length).toBeGreaterThan(0);
      /* Every family named in a role must be asked of Google, otherwise
         the skin falls back on the fallback typeface without a word. */
      const asked = skin.google.join("&").replace(/\+/g, " ").toLowerCase();
      for (const stack of Object.values(skin.fonts)) {
        const first = stack.split(",")[0]!.replace(/'/g, "").trim().toLowerCase();
        expect(`${skin.key} : ${first}`).toBe(
          `${skin.key} : ${asked.includes(first) ? first : "ABSENTE"}`
        );
      }
    }
  });

  it("has a page ground and a tab shape", () => {
    for (const skin of SKINS) {
      expect(skin.page.trim().length).toBeGreaterThan(0);
      expect(skin.tag.radius).toMatch(/px$/);
      for (const v of Object.values(skin.atm)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  /* ---------- what the browser draws itself ---------- */

  /* WCAG contrast, in plain terms: two relative luminances, the lighter
     one on top. 1 for two identical colours, 21 for black on white. */
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string): number => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => channel(c / 255));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const contrast = (a: string, b: string): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light! + 0.05) / (dark! + 0.05);
  };

  /* An open drop-down list is painted by the browser, outside the
     document: no rule will come and fix two colours too close together
     after the fact. So we check them here, at the source, on the two
     tokens the `select option` rule uses. */
  it("keeps the drop-downs readable, across the fourteen skins", () => {
    for (const skin of SKINS)
      expect(
        contrast(skin.c.ink!, skin.c.card!),
        `${skin.key} : encre sur carton, c'est le fond d'une liste ouverte`
      ).toBeGreaterThanOrEqual(4.5);
  });

  /* THE FLAG MUST TELL THE TRUTH, and that is all `color-scheme` rests
     on. A dark skin announcing itself light keeps the checkboxes and the
     lists light on its black background — the flaw is invisible to a
     render test, since those pieces are not in the document. */
  it("does not get its own ground colour wrong", () => {
    for (const skin of SKINS) {
      const isDark = contrast(skin.c.card!, "#FFFFFF") > contrast(skin.c.card!, "#000000");
      expect(!!skin.dark, `${skin.key} : carton ${skin.c.card}`).toBe(isDark);
    }
  });

  it("falls back on the notebook for an unknown key", () => {
    expect(skinOf("n'existe step").key).toBe(DEFAULT_SKIN);
    expect(skinOf(undefined).key).toBe(DEFAULT_SKIN);
    expect(SKINS[0]!.key).toBe(DEFAULT_SKIN);
  });
});

describe("laying a skin down", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.getElementById("skin-fonts")?.remove();
    localStorage.clear();
  });

  it("writes each token where the reference will come looking for it", () => {
    const skin = applySkin("kodachrome");
    const root = document.documentElement.style;
    for (const [token, color] of Object.entries(skin.c)) {
      // the reference as `tokens` writes it, and the variable as we lay it
      const name = C[token as keyof typeof C].slice(4, -1);
      expect(root.getPropertyValue(name)).toBe(color);
    }
    for (const role of Object.keys(F))
      expect(root.getPropertyValue(F[role as keyof typeof F].slice(4, -1))).toBeTruthy();
  });

  it("lays the ground, the shape and the atmosphere", () => {
    applySkin("bauhaus");
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--page-bg")).toContain("#F2F0EB");
    expect(root.getPropertyValue("--tag-radius")).toBe("0px");
    // the Bauhaus has neither grain nor stain: three colours and nothing on top
    expect(root.getPropertyValue("--atm-grain")).toBe("0");
    expect(root.getPropertyValue("--atm-stain")).toBe("0");
    expect(document.documentElement.dataset.skin).toBe("bauhaus");
  });

  /* A single link element, reused: creating one per attempt would leave
     behind as many stylesheets as skins tried, and the last one DECLARED
     would win — not the last one chosen. */
  it("leaves a single font link, whatever one tries", () => {
    applySkin("japon");
    const premier = document.getElementById("skin-fonts") as HTMLLinkElement;
    applySkin("pastel");
    expect(document.querySelectorAll("link[id='skin-fonts']")).toHaveLength(1);
    expect(document.getElementById("skin-fonts")).toBe(premier);
    expect(premier.href).toContain("Quicksand");
  });

  it("keeps the choice from one time to the next", () => {
    expect(loadSkinKey()).toBe(DEFAULT_SKIN);
    saveSkinKey("herbier");
    expect(localStorage.getItem(SKIN_KEY)).toBe("herbier");
    expect(loadSkinKey()).toBe("herbier");
  });
});
