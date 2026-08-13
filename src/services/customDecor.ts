/* ============================================================
   IMPORTED OBJECTS — the cabinet one fills oneself.

   The house patterns are drawn by hand in `objects.jsx` and listed in
   `constants.tsx`: that is a catalogue backlist, it does not move. These
   ones come from the user's disk, and therefore live where their images
   already live — the metadata in localStorage, because it is tiny and we
   want to read it without waiting, the image itself in IndexedDB,
   because a PNG has no business inside a five-megabyte quota.

   The `custom:` prefix on the key is not decorative: it is what
   guarantees an import will never come and cover `plant` or `divider`,
   and what lets any caller recognise an imported pattern without
   consulting the registry.
   ============================================================ */
import { store } from "./storage";
import { shrinkImage } from "./images";
import { putImage, deleteImage } from "../db";

export type CustomDecor = {
  /** `custom:<id>` — the value written into `item.motif`. */
  key: string;
  label: string;
  /** Hangs on the back of the row rather than resting on a board. */
  wall: boolean;
  kind: "raster" | "svg";
  /** An SVG whose ink we managed to replace: colour still speaks to it. */
  tintable: boolean;
  /** The blob's key in IndexedDB, prefixed so as not to mix with posters. */
  imageKey: string;
  addedAt: string;
};

export const CUSTOM_DECOR_KEY = "shelf-decor-custom";
export const CUSTOM_PREFIX = "custom:";
export const DECOR_IMAGE_PREFIX = "decor:";

export const isCustomMotif = (motif: string): boolean =>
  typeof motif === "string" && motif.startsWith(CUSTOM_PREFIX);

/* The registry is read by `decorSpec`, called when rendering every laid
   object: going through localStorage each time would mean parsing JSON a
   hundred times per image. So we keep the list in memory, and
   localStorage is no more than where it survives a reload. */
let cache: CustomDecor[] | null = null;
const listeners = new Set<() => void>();

const read = (): CustomDecor[] => {
  if (!cache) cache = store.get<CustomDecor[]>(CUSTOM_DECOR_KEY, []);
  return cache;
};

const write = (list: CustomDecor[]): boolean => {
  cache = list;
  const ok = store.set(CUSTOM_DECOR_KEY, list);
  for (const fn of listeners) fn();
  return ok;
};

export const listCustomDecor = (): CustomDecor[] => read();

export const customDecorByKey = (key: string): CustomDecor | undefined =>
  read().find((d) => d.key === key);

/** Every image the registry references — so as not to purge them. */
export const customDecorImageKeys = (): string[] => read().map((d) => d.imageKey);

export const subscribeCustomDecor = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The cache is a shortcut, not a source: a restore empties it. */
export const refreshCustomDecor = (): void => {
  cache = null;
  hiddenCache = null;
  for (const fn of listeners) fn();
};

/* ---------- HIDDEN PATTERNS ----------

   The fifteen house drawings cannot be deleted: they are in the code,
   and erasing them would mean erasing code. But nobody needs all
   fifteen, and a cabinet where one can no longer find one's own among
   those one does not use is a cabinet in disarray.

   So we HIDE them: they leave the panel, and nothing else. An object
   already laid on a shelf goes on being displayed — hiding is a tidying
   gesture, not a deletion, and making a named box and six placed
   trinkets vanish at a stroke would be a punishment for having wanted to
   sort things out. The management panel says so, and the gesture is
   undone with one click in the same place. */
export const HIDDEN_DECOR_KEY = "shelf-decor-hidden";

let hiddenCache: string[] | null = null;

const readHidden = (): string[] => {
  if (!hiddenCache) hiddenCache = store.get<string[]>(HIDDEN_DECOR_KEY, []);
  return hiddenCache;
};

const writeHidden = (list: string[]): void => {
  hiddenCache = list;
  store.set(HIDDEN_DECOR_KEY, list);
  for (const fn of listeners) fn();
};

export const listHiddenDecor = (): string[] => readHidden();

export const isDecorHidden = (key: string): boolean => readHidden().includes(key);

export const toggleDecorHidden = (key: string): void =>
  writeHidden(
    readHidden().includes(key) ? readHidden().filter((k) => k !== key) : [...readHidden(), key]
  );

export const setHiddenDecor = (list: string[]): void =>
  writeHidden(Array.isArray(list) ? list : []);

/* ---------- the ink of an SVG ----------

   An imported drawing has no reason to follow our conventions, but if it
   carries named strokes we can give it what the house patterns have: the
   tint the user chooses. `currentColor` is enough — it is the inherited
   CSS colour, and the display component has only to lay it on the
   parent.

   We take the chance to strip what an SVG from outside has no business
   carrying: script, event handlers, references to remote resources. The
   file is rewritten once, at import time, and it is that version we
   shall store. */
const PAINT_ATTRS = ["fill", "stroke"] as const;

export function sanitizeSvg(
  text: string,
  { wall = false }: { wall?: boolean } = {}
): { markup: string; tintable: boolean } | null {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;

  for (const el of Array.from(doc.querySelectorAll("script, foreignObject, animate, set")))
    el.remove();

  let tintable = false;
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      /* A local `href` (`#gradient`) serves the drawing; a remote href
         is a request nobody asked for. */
      if ((name === "href" || name === "xlink:href") && !attr.value.trim().startsWith("#"))
        el.removeAttribute(attr.name);
    }
    for (const paint of PAINT_ATTRS) {
      const v = el.getAttribute(paint);
      /* `none` says "do not paint", and `url(...)` refers to a gradient
         we would not know how to tint: in both cases we touch
         nothing. */
      if (!v || v === "none" || v.trim().startsWith("url(")) continue;
      el.setAttribute(paint, "currentColor");
      tintable = true;
    }
    /* The same paints can hide inside a `style`: leaving them there
       would make a half-tinted drawing, which is worse than not tinted
       at all. */
    const style = el.getAttribute("style");
    if (style && /(^|[;\s])(fill|stroke)\s*:/i.test(style)) {
      const next = style.replace(
        /(^|[;\s])(fill|stroke)\s*:\s*([^;]+)/gi,
        (whole, lead, prop, value) => {
          const v = String(value).trim();
          if (v === "none" || v.startsWith("url(")) return whole;
          tintable = true;
          return `${lead}${prop}: currentColor`;
        }
      );
      el.setAttribute("style", next);
    }
  }

  /* The drawing must fill the cell it is given, and lean on it like the
     house patterns: what is laid down touches the bottom of its cell,
     what hangs dangles from the top. Without a `viewBox` the scale means
     nothing and we leave the file as it is. */
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  if (svg.getAttribute("viewBox"))
    svg.setAttribute("preserveAspectRatio", wall ? "xMidYMin meet" : "xMidYMax meet");

  return { markup: new XMLSerializer().serializeToString(svg), tintable };
}

/* ---------- import ---------- */

const SVG_TYPES = ["image/svg+xml"];
const isSvgFile = (file: File) => SVG_TYPES.includes(file.type) || /\.svg$/i.test(file.name || "");

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").trim();

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Imports an image as a new pattern. Rejects what is not an image. */
export async function addCustomDecor(
  file: File,
  { label, wall = false }: { label?: string; wall?: boolean } = {}
): Promise<CustomDecor> {
  const svg = isSvgFile(file);
  if (!svg && !file.type.startsWith("image/"))
    throw new Error(`« ${file.name} » n'est pas une image.`);

  const id = newId();
  const imageKey = `${DECOR_IMAGE_PREFIX}${id}`;
  let kind: CustomDecor["kind"] = "raster";
  let tintable = false;

  if (svg) {
    const cleaned = sanitizeSvg(await file.text(), { wall });
    if (!cleaned) throw new Error(`« ${file.name} » n'est pas un SVG lisible.`);
    kind = "svg";
    tintable = cleaned.tintable;
    await putImage(imageKey, new Blob([cleaned.markup], { type: "image/svg+xml" }));
  } else {
    /* A decor object never exceeds a few dozen pixels on screen: 320 px
       is plenty, and a camera photo stored as it comes would fill the
       database for nothing. */
    await putImage(imageKey, await shrinkImage(file, 320));
  }

  const entry: CustomDecor = {
    key: `${CUSTOM_PREFIX}${id}`,
    label: (label || baseName(file.name) || "Objet").slice(0, 40),
    wall,
    kind,
    tintable,
    imageKey,
    addedAt: new Date().toISOString(),
  };

  if (!write([...read(), entry])) {
    // the registry did not hold: the image has nobody left to name it
    await deleteImage(imageKey).catch(() => {});
    throw new Error("Espace de stockage plein — l'objet n'a pas été ajouté.");
  }
  return entry;
}

export async function removeCustomDecor(key: string): Promise<void> {
  const entry = customDecorByKey(key);
  if (!entry) return;
  write(read().filter((d) => d.key !== key));
  await deleteImage(entry.imageKey).catch(console.error);
}

/* ---------- backup ----------
   The registry goes into the backup file like the cards do: this is data
   the user brought in, not settings. */
export const setCustomDecor = (list: CustomDecor[]): void => {
  write(Array.isArray(list) ? list : []);
};
