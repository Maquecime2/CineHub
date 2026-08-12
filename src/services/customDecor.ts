/* ============================================================
   LES OBJETS IMPORTÉS — le cabinet qu'on remplit soi-même.

   Les motifs de la maison sont dessinés à la main dans `objects.jsx` et
   listés dans `constants.tsx` : c'est un fond de catalogue, il ne bouge
   pas. Ceux-ci viennent du disque de l'utilisateur, et vivent donc là où
   vivent déjà ses images — les métadonnées en localStorage, parce
   qu'elles sont minuscules et qu'on veut les lire sans attendre, l'image
   elle-même dans IndexedDB, parce qu'un PNG n'a rien à faire dans un
   quota de cinq méga-octets.

   Le préfixe `custom:` sur la clé n'est pas décoratif : c'est lui qui
   garantit qu'un import ne viendra jamais recouvrir `plant` ou
   `divider`, et qui permet à n'importe quel appelant de reconnaître un
   motif importé sans consulter le registre.
   ============================================================ */
import { store } from "./storage";
import { shrinkImage } from "./images";
import { putImage, deleteImage } from "../db";

export type CustomDecor = {
  /** `custom:<id>` — la valeur écrite dans `item.motif`. */
  key: string;
  label: string;
  /** S'accroche au fond du rayon plutôt que de se poser sur une planche. */
  wall: boolean;
  kind: "raster" | "svg";
  /** Un SVG dont on a su remplacer l'encre : la couleur lui parle encore. */
  tintable: boolean;
  /** La clé du blob dans IndexedDB, préfixée pour ne pas se mêler aux affiches. */
  imageKey: string;
  addedAt: string;
};

export const CUSTOM_DECOR_KEY = "shelf-decor-custom";
export const CUSTOM_PREFIX = "custom:";
export const DECOR_IMAGE_PREFIX = "decor:";

export const isCustomMotif = (motif: string): boolean =>
  typeof motif === "string" && motif.startsWith(CUSTOM_PREFIX);

/* Le registre est lu par `decorSpec`, appelé au rendu de chaque objet
   posé : passer par localStorage à chaque fois reviendrait à parser du
   JSON cent fois par image. On garde donc la liste en mémoire, et
   localStorage n'est plus que le lieu où elle survit au rechargement. */
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

/** Toutes les images que le registre référence — pour ne pas les purger. */
export const customDecorImageKeys = (): string[] => read().map((d) => d.imageKey);

export const subscribeCustomDecor = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Le cache est un raccourci, pas une source : une restauration le vide. */
export const refreshCustomDecor = (): void => {
  cache = null;
  hiddenCache = null;
  for (const fn of listeners) fn();
};

/* ---------- LES MOTIFS MASQUÉS ----------

   Les quinze dessins de la maison ne se suppriment pas : ils sont dans
   le code, et les effacer voudrait dire effacer du code. Mais personne
   n'a besoin des quinze, et un cabinet où l'on ne trouve plus les siens
   au milieu de ceux qu'on n'utilise pas est un cabinet en désordre.

   On les MASQUE donc : ils quittent le panneau, et rien d'autre. Un
   objet déjà posé sur une étagère continue de s'afficher — masquer est
   un geste de rangement, pas une suppression, et faire disparaître d'un
   coup un carton nommé et six bibelots placés serait une punition pour
   avoir voulu faire du tri. Le panneau de gestion le dit, et le geste
   se défait d'un clic au même endroit. */
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

/* ---------- l'encre d'un SVG ----------

   Un dessin importé n'a aucune raison de follow nos conventions, mais
   s'il porte des traits nommés on peut lui rendre ce que les motifs de
   la maison ont : la teinte que l'utilisateur choisit. `currentColor`
   suffit — c'est la couleur CSS héritée, et le composant d'affichage n'a
   plus qu'à la poser sur le parent.

   On en profite pour retirer ce qu'un SVG venu du dehors n'a pas à
   emporter : du script, des gestionnaires d'événements, des références à
   des ressources distantes. Le fichier est réécrit une fois, à l'import,
   et c'est cette version-là qu'on rangera. */
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
      /* Un `href` local (`#gradient`) sert au dessin ; un href distant
         est une requête qu'on n'a pas demandée. */
      if ((name === "href" || name === "xlink:href") && !attr.value.trim().startsWith("#"))
        el.removeAttribute(attr.name);
    }
    for (const paint of PAINT_ATTRS) {
      const v = el.getAttribute(paint);
      /* `none` dit « ne peins pas », et `url(...)` renvoie à un dégradé
         qu'on ne saurait pas teinter : dans les deux cas on ne touche à
         rien. */
      if (!v || v === "none" || v.trim().startsWith("url(")) continue;
      el.setAttribute(paint, "currentColor");
      tintable = true;
    }
    /* Les mêmes peintures peuvent se cacher dans un `style` : les y
       laisser ferait un dessin à moitié teinté, ce qui est pire que pas
       teinté du tout. */
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

  /* Le dessin doit remplir la case qu'on lui donne, et s'y appuyer comme
     les motifs de la maison : ce qui se pose touche le bas de sa case,
     ce qui s'accroche pend depuis le haut. Sans `viewBox`, l'échelle n'a
     pas de sens et on laisse le fichier tel quel. */
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

/** Importe une image comme nouveau motif. Rejette ce qui n'est pas une image. */
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
    /* Un objet de déco ne dépasse jamais quelques dizaines de pixels à
       l'écran : 320 px suffisent, et une photo d'appareil rangée telle
       quelle remplirait la base pour rien. */
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
    // le registre n'a pas tenu : l'image n'a plus personne pour la nommer
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

/* ---------- sauvegarde ----------
   Le registre entre dans le fichier de sauvegarde comme les fiches : ce
   sont des données que l'utilisateur a apportées, pas des réglages. */
export const setCustomDecor = (list: CustomDecor[]): void => {
  write(Array.isArray(list) ? list : []);
};
