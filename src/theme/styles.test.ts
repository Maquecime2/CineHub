import { describe, it, expect, afterEach, vi } from "vitest";

/* Ce qui se teste ici n'est pas une apparence, c'est une REGLE : sous un
   doigt, aucun controle ne descend au-dessous de quarante-quatre pixels,
   et a la souris rien ne bouge. La regle est invisible a la relecture —
   `tap` est un objet vide la moitie du temps — et c'est exactement le
   genre de chose qui repart en silence.

   Le module lit le pointeur UNE FOIS, a l'import : chaque cas doit donc
   poser sa doublure avant d'importer, d'ou `resetModules` et l'import
   dynamique. */

const charger = async (coarse: boolean) => {
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

describe("les cibles du doigt", () => {
  it("au doigt, rien ne descend sous quarante-quatre pixels", async () => {
    const { tap, tapSquare, underlineInput, TAP } = await charger(true);
    expect(TAP).toBe(44);
    expect(tap.minHeight).toBe(44);
    /* `all: unset` rend le bouton inline : sans cet affichage, la hauteur
       minimale ne s'appliquerait pas du tout. */
    expect(tap.display).toBe("inline-flex");
    expect(tapSquare.minWidth).toBe(44);
    expect(underlineInput.minHeight).toBe(44);
  });

  it("a la souris, pas un pixel ne change", async () => {
    const { tap, tapSquare, underlineInput } = await charger(false);
    expect(tap).toEqual({});
    expect(tapSquare).toEqual({});
    expect(underlineInput.minHeight).toBeUndefined();
    expect(underlineInput.padding).toBe("4px 2px");
  });

  it("sans matchMedia, on tient le pointeur pour fin", async () => {
    vi.resetModules();
    vi.stubGlobal("matchMedia", undefined);
    const { tap } = await import("./styles");
    expect(tap).toEqual({});
  });
});
