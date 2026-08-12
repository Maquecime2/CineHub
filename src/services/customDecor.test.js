import { describe, it, expect, beforeEach, vi } from "vitest";

/* The registry stores its images in IndexedDB, which jsdom does not
   have: we replace the vault with a Map, which is enough to check that
   an image is indeed written on import and indeed erased on delete. */
const vault = new Map();
vi.mock("../db", () => ({
  putImage: async (k, blob) => vault.set(k, blob),
  getImage: async (k) => vault.get(k),
  deleteImage: async (k) => void vault.delete(k),
}));
/* A JPEG cannot be built under jsdom (no canvas, no image decoder):
   what `shrinkImage` returns does not matter here, only that it returns
   something. */
vi.mock("./images", () => ({
  shrinkImage: async (file) => new Blob([`shrunk:${file.name}`]),
  imageSize: async () => ({ w: 10, h: 10 }),
}));

const {
  addCustomDecor,
  removeCustomDecor,
  listCustomDecor,
  customDecorByKey,
  customDecorImageKeys,
  refreshCustomDecor,
  sanitizeSvg,
  toggleDecorHidden,
  isDecorHidden,
  listHiddenDecor,
  CUSTOM_PREFIX,
} = await import("./customDecor");

const svgFile = (markup, name = "trait.svg") => new File([markup], name, { type: "image/svg+xml" });
const pngFile = (name = "chouette.png") => new File(["…"], name, { type: "image/png" });

beforeEach(() => {
  localStorage.clear();
  vault.clear();
  refreshCustomDecor();
});

describe("le registre des objets importés", () => {
  it("range l'image et retient le motif", async () => {
    const entry = await addCustomDecor(pngFile(), { wall: false });
    expect(entry.key.startsWith(CUSTOM_PREFIX)).toBe(true);
    expect(entry.label).toBe("chouette");
    expect(entry.kind).toBe("raster");
    expect(vault.has(entry.imageKey)).toBe(true);
    expect(listCustomDecor()).toHaveLength(1);
    expect(customDecorByKey(entry.key)).toMatchObject({ label: "chouette" });
  });

  it("emporte l'image en supprimant le motif", async () => {
    const entry = await addCustomDecor(pngFile());
    await removeCustomDecor(entry.key);
    expect(listCustomDecor()).toHaveLength(0);
    expect(vault.has(entry.imageKey)).toBe(false);
  });

  /* The prefix is what keeps an import from covering `plant` or
     `divider`: without it, two objects would carry the same key and the
     shelf would show one for the other. */
  it("ne peut pas prendre la clé d'un motif de la maison", async () => {
    const a = await addCustomDecor(pngFile("plant.png"));
    expect(a.key).not.toBe("plant");
    const b = await addCustomDecor(pngFile("plant.png"));
    expect(b.key).not.toBe(a.key);
  });

  it("refuse ce qui n'est pas une image", async () => {
    await expect(
      addCustomDecor(new File(["x"], "notes.txt", { type: "text/plain" }))
    ).rejects.toThrow(/n'est pas une image/);
    expect(listCustomDecor()).toHaveLength(0);
  });

  it("cite ses images, pour qu'une purge ne les emporte pas", async () => {
    const entry = await addCustomDecor(pngFile());
    expect(customDecorImageKeys()).toContain(entry.imageKey);
  });

  it("survit au rechargement", async () => {
    const entry = await addCustomDecor(pngFile());
    refreshCustomDecor(); // comme si la page repartait de localStorage
    expect(customDecorByKey(entry.key)?.label).toBe(entry.label);
  });
});

describe("masquer un motif de la maison", () => {
  it("le sort du cabinet sans le supprimer", async () => {
    const { shelfDecorTypes, decorSpec } = await import("../components/shelf/constants");
    toggleDecorHidden("plant");
    expect(shelfDecorTypes().map((d) => d.key)).not.toContain("plant");
    /* It remains RESOLVABLE: a plant already laid on a shelf goes on
       being displayed, hiding is not deleting. */
    expect(decorSpec("plant")).toBeTruthy();
    expect(isDecorHidden("plant")).toBe(true);
  });

  it("se défait du même geste", async () => {
    const { shelfDecorTypes } = await import("../components/shelf/constants");
    toggleDecorHidden("cactus");
    toggleDecorHidden("cactus");
    expect(isDecorHidden("cactus")).toBe(false);
    expect(shelfDecorTypes().map((d) => d.key)).toContain("cactus");
  });

  it("vaut aussi pour un objet importé et pour ce qui s'accroche", async () => {
    const { wallDecorTypes, shelfDecorTypes } = await import("../components/shelf/constants");
    const mine = await addCustomDecor(pngFile("mien.png"));
    toggleDecorHidden(mine.key);
    toggleDecorHidden("frame");
    expect(shelfDecorTypes().map((d) => d.key)).not.toContain(mine.key);
    expect(wallDecorTypes().map((d) => d.key)).not.toContain("frame");
  });

  it("survit au rechargement", () => {
    toggleDecorHidden("mug");
    refreshCustomDecor();
    expect(listHiddenDecor()).toContain("mug");
  });
});

describe("le nettoyage d'un SVG", () => {
  it("retire le script et les gestionnaires", () => {
    const { markup } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect onclick="alert(2)" stroke="#000"/></svg>`
    );
    expect(markup).not.toContain("script");
    expect(markup).not.toContain("onclick");
  });

  it("remplace l'encre par currentColor quand il y en a", () => {
    const { markup, tintable } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" stroke="#123456"/></svg>`
    );
    expect(tintable).toBe(true);
    expect(markup).toContain("currentColor");
  });

  it("trouve aussi l'encre écrite en style", () => {
    const { tintable, markup } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" style="fill: #abc; opacity: .5"/></svg>`
    );
    expect(tintable).toBe(true);
    expect(markup).toContain("currentColor");
    expect(markup).toContain("opacity");
  });

  /* A drawing with no named stroke — all in gradients, or with no
     declared paint — is not tintable, and the panel then takes its
     colour pills away from it. */
  it("ne se dit pas teintable quand il n'y a rien à teindre", () => {
    const { tintable } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" fill="none"/></svg>`
    );
    expect(tintable).toBe(false);
  });

  it("appuie le dessin en bas s'il se pose, en haut s'il s'accroche", () => {
    const placedKey = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`);
    const hung = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`, {
      wall: true,
    });
    expect(placedKey.markup).toContain("xMidYMax");
    expect(hung.markup).toContain("xMidYMin");
  });

  it("rend null sur ce qui n'est pas un SVG", () => {
    expect(sanitizeSvg("bonjour")).toBe(null);
  });
});

describe("le motif importé, tel que l'étagère le voit", () => {
  it("entre dans la bonne famille du cabinet", async () => {
    const { shelfDecorTypes, wallDecorTypes, decorSpec, isWallMotif } =
      await import("../components/shelf/constants");
    const placedKey = await addCustomDecor(pngFile("galet.png"), { wall: false });
    const hung = await addCustomDecor(svgFile(`<svg viewBox="0 0 1 1"/>`, "guirlande.svg"), {
      wall: true,
    });

    expect(shelfDecorTypes().map((d) => d.key)).toContain(placedKey.key);
    expect(wallDecorTypes().map((d) => d.key)).toContain(hung.key);
    // and the house patterns are still there, at the head
    expect(shelfDecorTypes().map((d) => d.key)).toContain("plant");

    expect(isWallMotif(hung.key)).toBe(true);
    expect(isWallMotif(placedKey.key)).toBe(false);
    expect(decorSpec(placedKey.key)).toMatchObject({ label: "galet", custom: true });
    expect(decorSpec("plant")?.custom).toBeUndefined();
    expect(decorSpec("fantôme")).toBeUndefined();
  });

  /* `decorSpec` is called when rendering every laid object: if it
     returned a brand-new component each time, React would unmount and
     remount the image — hence re-read it from IndexedDB — on every
     hover. */
  it("rend toujours le même dessin pour le même motif", async () => {
    const { decorSpec } = await import("../components/shelf/constants");
    const entry = await addCustomDecor(pngFile());
    expect(decorSpec(entry.key).draw).toBe(decorSpec(entry.key).draw);
  });
});
