import { describe, it, expect, beforeEach, vi } from "vitest";

/* Le registre range ses images dans IndexedDB, dont jsdom ne dispose
   pas : on remplace le coffre par une Map, ce qui suffit à vérifier
   qu'une image est bien écrite quand on importe et bien effacée quand on
   supprime. */
const vault = new Map();
vi.mock("../db", () => ({
  putImage: async (k, blob) => vault.set(k, blob),
  getImage: async (k) => vault.get(k),
  deleteImage: async (k) => void vault.delete(k),
}));
/* Un JPEG ne se fabrique pas sous jsdom (ni canvas, ni décodeur d'image) :
   ce que `shrinkImage` rend n'a pas d'importance ici, seulement qu'il
   rende quelque chose. */
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

  /* Le préfixe est ce qui empêche un import de recouvrir `plant` ou
     `divider` : sans lui, deux objets porteraient la même clé et
     l'étagère afficherait l'un pour l'autre. */
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
    /* Il reste RÉSOLVABLE : une plante déjà posée sur une étagère
       continue de s'afficher, masquer n'est pas supprimer. */
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
    const mien = await addCustomDecor(pngFile("mien.png"));
    toggleDecorHidden(mien.key);
    toggleDecorHidden("frame");
    expect(shelfDecorTypes().map((d) => d.key)).not.toContain(mien.key);
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

  /* Un dessin sans trait nommé — tout en dégradés, ou sans peinture
     déclarée — n'est pas teintable, et le panneau lui retire alors ses
     pastilles de couleur. */
  it("ne se dit pas teintable quand il n'y a rien à teindre", () => {
    const { tintable } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" fill="none"/></svg>`
    );
    expect(tintable).toBe(false);
  });

  it("appuie le dessin en bas s'il se pose, en haut s'il s'accroche", () => {
    const posé = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`);
    const accroché = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`, {
      wall: true,
    });
    expect(posé.markup).toContain("xMidYMax");
    expect(accroché.markup).toContain("xMidYMin");
  });

  it("rend null sur ce qui n'est pas un SVG", () => {
    expect(sanitizeSvg("bonjour")).toBe(null);
  });
});

describe("le motif importé, tel que l'étagère le voit", () => {
  it("entre dans la bonne famille du cabinet", async () => {
    const { shelfDecorTypes, wallDecorTypes, decorSpec, isWallMotif } =
      await import("../components/shelf/constants");
    const posé = await addCustomDecor(pngFile("galet.png"), { wall: false });
    const accroché = await addCustomDecor(svgFile(`<svg viewBox="0 0 1 1"/>`, "guirlande.svg"), {
      wall: true,
    });

    expect(shelfDecorTypes().map((d) => d.key)).toContain(posé.key);
    expect(wallDecorTypes().map((d) => d.key)).toContain(accroché.key);
    // et les motifs de la maison sont toujours là, en tête
    expect(shelfDecorTypes().map((d) => d.key)).toContain("plant");

    expect(isWallMotif(accroché.key)).toBe(true);
    expect(isWallMotif(posé.key)).toBe(false);
    expect(decorSpec(posé.key)).toMatchObject({ label: "galet", custom: true });
    expect(decorSpec("plant")?.custom).toBeUndefined();
    expect(decorSpec("fantôme")).toBeUndefined();
  });

  /* `decorSpec` est appelé au rendu de chaque objet posé : s'il rendait un
     composant neuf à chaque fois, React démonterait et remonterait
     l'image — donc la relirait dans IndexedDB — à chaque survol. */
  it("rend toujours le même dessin pour le même motif", async () => {
    const { decorSpec } = await import("../components/shelf/constants");
    const entry = await addCustomDecor(pngFile());
    expect(decorSpec(entry.key).draw).toBe(decorSpec(entry.key).draw);
  });
});
