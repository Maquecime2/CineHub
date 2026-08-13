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
  setCustomDecor,
  CUSTOM_PREFIX,
} = await import("./customDecor");

const svgFile = (markup, name = "trait.svg") => new File([markup], name, { type: "image/svg+xml" });
const pngFile = (name = "chouette.png") => new File(["…"], name, { type: "image/png" });

beforeEach(() => {
  localStorage.clear();
  vault.clear();
  refreshCustomDecor();
});

describe("the register of imported objects", () => {
  it("files the image and remembers the motif", async () => {
    const entry = await addCustomDecor(pngFile(), { wall: false });
    expect(entry.key.startsWith(CUSTOM_PREFIX)).toBe(true);
    expect(entry.label).toBe("chouette");
    expect(entry.kind).toBe("raster");
    expect(vault.has(entry.imageKey)).toBe(true);
    expect(listCustomDecor()).toHaveLength(1);
    expect(customDecorByKey(entry.key)).toMatchObject({ label: "chouette" });
  });

  it("takes the image away when the motif is deleted", async () => {
    const entry = await addCustomDecor(pngFile());
    await removeCustomDecor(entry.key);
    expect(listCustomDecor()).toHaveLength(0);
    expect(vault.has(entry.imageKey)).toBe(false);
  });

  /* The prefix is what keeps an import from covering `plant` or
     `divider`: without it, two objects would carry the same key and the
     shelf would show one for the other. */
  it("cannot take the key of one of the house motifs", async () => {
    const a = await addCustomDecor(pngFile("plant.png"));
    expect(a.key).not.toBe("plant");
    const b = await addCustomDecor(pngFile("plant.png"));
    expect(b.key).not.toBe(a.key);
  });

  it("refuses what is not an image", async () => {
    await expect(
      addCustomDecor(new File(["x"], "notes.txt", { type: "text/plain" }))
    ).rejects.toThrow(/n'est pas une image/);
    expect(listCustomDecor()).toHaveLength(0);
  });

  it("names its images, so a purge does not carry them off", async () => {
    const entry = await addCustomDecor(pngFile());
    expect(customDecorImageKeys()).toContain(entry.imageKey);
  });

  it("survives a reload", async () => {
    const entry = await addCustomDecor(pngFile());
    refreshCustomDecor(); // comme si la page repartait de localStorage
    expect(customDecorByKey(entry.key)?.label).toBe(entry.label);
  });
});

describe("hiding one of the house motifs", () => {
  it("takes it out of the cabinet without deleting it", async () => {
    const { shelfDecorTypes, decorSpec } = await import("../components/shelf/constants");
    toggleDecorHidden("plant");
    expect(shelfDecorTypes().map((d) => d.key)).not.toContain("plant");
    /* It remains RESOLVABLE: a plant already laid on a shelf goes on
       being displayed, hiding is not deleting. */
    expect(decorSpec("plant")).toBeTruthy();
    expect(isDecorHidden("plant")).toBe(true);
  });

  it("is undone by the same gesture", async () => {
    const { shelfDecorTypes } = await import("../components/shelf/constants");
    toggleDecorHidden("cactus");
    toggleDecorHidden("cactus");
    expect(isDecorHidden("cactus")).toBe(false);
    expect(shelfDecorTypes().map((d) => d.key)).toContain("cactus");
  });

  it("holds for an imported object and for what hangs, too", async () => {
    const { wallDecorTypes, shelfDecorTypes } = await import("../components/shelf/constants");
    const mine = await addCustomDecor(pngFile("mien.png"));
    toggleDecorHidden(mine.key);
    toggleDecorHidden("frame");
    expect(shelfDecorTypes().map((d) => d.key)).not.toContain(mine.key);
    expect(wallDecorTypes().map((d) => d.key)).not.toContain("frame");
  });

  it("survives a reload", () => {
    toggleDecorHidden("mug");
    refreshCustomDecor();
    expect(listHiddenDecor()).toContain("mug");
  });
});

describe("cleaning an SVG", () => {
  it("strips the script and the handlers", () => {
    const { markup } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect onclick="alert(2)" stroke="#000"/></svg>`
    );
    expect(markup).not.toContain("script");
    expect(markup).not.toContain("onclick");
  });

  it("replaces the ink with currentColor where there is any", () => {
    const { markup, tintable } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" stroke="#123456"/></svg>`
    );
    expect(tintable).toBe(true);
    expect(markup).toContain("currentColor");
  });

  it("finds ink written as a style too", () => {
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
  it("does not call itself tintable when there is nothing to tint", () => {
    const { tintable } = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0" fill="none"/></svg>`
    );
    expect(tintable).toBe(false);
  });

  it("sets the drawing at the bottom if it stands, at the top if it hangs", () => {
    const placedKey = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`);
    const hung = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`, {
      wall: true,
    });
    expect(placedKey.markup).toContain("xMidYMax");
    expect(hung.markup).toContain("xMidYMin");
  });

  it("returns null on what is not an SVG", () => {
    expect(sanitizeSvg("bonjour")).toBe(null);
  });
});

describe("the imported motif, as the shelf sees it", () => {
  it("goes into the right family of the cabinet", async () => {
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
  it("always returns the same drawing for the same motif", async () => {
    const { decorSpec } = await import("../components/shelf/constants");
    const entry = await addCustomDecor(pngFile());
    expect(decorSpec(entry.key).draw).toBe(decorSpec(entry.key).draw);
  });
});

/* ============================================================
   SHARING A PIECE, AND TAKING ONE

   Three things, and the first is the one that would go wrong silently.

   AN OBJECT IS ADDED OFFLINE AND STAYS ADDED. Importing must not wait
   for a round trip, must not fail because of one, and the piece must be
   on the shelf before anything is asked of the network. It climbs at the
   next synchronisation, which is what gives it a `remoteId`.

   A PIECE TAKEN FROM SOMEBODY IS VETTED ON ARRIVAL. `sanitizeSvg` used
   to run at import only, and what sat in the vault was presumed clean —
   which it was, since we had cleaned it ourselves. A blob fetched from
   another person's container breaks that presumption, and `CustomDraw`
   injects the markup inline.

   AND GIVING BACK A COPY IS NOT WITHDRAWING A PIECE. The server tells
   the two apart; what is tested here is that the client asks it to.
   ============================================================ */
describe("the shared objects", () => {
  const hostileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10" fill="#333"/></svg>`;

  it("exists on the shelf with no server identity", async () => {
    const entry = await addCustomDecor(pngFile("pebble.png"));
    /* No remote address, and yet the object is there: which is exactly
       what one wants of an offline gesture. */
    expect(entry.remoteId).toBeUndefined();
    expect(customDecorByKey(entry.key)).toBeTruthy();
  });

  it("strips the script from a received SVG, as from an imported one", () => {
    const cleaned = sanitizeSvg(hostileSvg, { wall: false });
    expect(cleaned).toBeTruthy();
    expect(cleaned.markup).not.toContain("script");
    expect(cleaned.markup).not.toContain("alert");
  });

  it("refuses what is not a readable drawing", () => {
    /* A markup the sanitiser refuses is neither kept nor shown:
       `takeCustomDecor` answers `null` on that reply. */
    expect(sanitizeSvg("hello", { wall: false })).toBeNull();
  });

  it("a taken piece keeps its author and its identity", async () => {
    const entry = await addCustomDecor(pngFile("borrowed.png"));
    /* We stand in for what `takeCustomDecor` writes, without the
       network: what counts here is that the register carries both
       fields — without them the workshop could neither credit the
       author nor hide the sharing switch on somebody else's piece. */
    setCustomDecor(
      listCustomDecor().map((d) =>
        d.key === entry.key ? { ...d, remoteId: "d-1234", owner: "anna" } : d
      )
    );
    const taken = customDecorByKey(entry.key);
    expect(taken.owner).toBe("anna");
    /* And its image is still counted among those we do not purge. */
    expect(customDecorImageKeys()).toContain(taken.imageKey);
  });
});
