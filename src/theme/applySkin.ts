/* ============================================================
   PUTTING A SKIN ON — writing it on the root, loading its fonts
   ============================================================

   The whole job fits in one sentence: we write CSS variables on
   `documentElement`. Nothing goes back up to React, no component is
   told, and that is precisely what we wanted — six hundred and thirteen
   token reads across twenty-nine files change at once without any of
   them having to know a skin exists.

   Inline styles beat a style sheet, but the variables written here are
   NOT the components' inline styles: they are written on another
   element, the ancestor of all. A token read as `var(--c-paper)`
   therefore climbs up to them, and `FONT_IMPORT`'s `:root` only serves
   as a last resort — on the first render, before a line of JavaScript
   has run. */

import { skinOf, DEFAULT_SKIN, type Skin } from "./skins";

export const SKIN_KEY = "site-skin";

/* The link to Google. ONE element only, reused: creating one per skin
   change would leave behind as many style sheets as attempts, whose
   `@font-face` rules would go on applying — the last declared would win,
   which is not necessarily the last chosen. */
const LINK_ID = "skin-fonts";

const fontHref = (skin: Skin): string =>
  `https://fonts.googleapis.com/css2?${skin.google
    .map((f) => `family=${f}`)
    .join("&")}&display=swap`;

function loadFonts(skin: Skin): void {
  const href = fontHref(skin);
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = LINK_ID;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  // rewriting the same address would start a load for nothing
  if (link.href !== href) link.href = href;
}

/* A camel-cased token becomes a hyphenated variable: `paperDark` is
   written `--c-paper-dark`. The mapping is here and nowhere else —
   `tokens` assumes it, this file produces it. */
const varName = (key: string): string =>
  `--c-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;

/* EVERYTHING A SKIN WRITES, as pairs — and not applied.

   Kept apart from applying because the document's root is not the only
   place a skin can live: the control screen shows fourteen AT ONCE, each
   on a fragment of the page, and it needs the same variables in the form
   of a style. CSS variables cascade — a token read as `var(--c-paper)`
   climbs to the nearest ancestor carrying it, be that `documentElement`
   or a plain `div`.

   One definition, then, for both uses: the mapping `paperDark` →
   `--c-paper-dark` is not rewritten anywhere else. */
export function skinVars(skin: Skin): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, color] of Object.entries(skin.c)) vars[varName(token)] = color;

  vars["--f-title"] = skin.fonts.title;
  vars["--f-body"] = skin.fonts.body;
  vars["--f-hand"] = skin.fonts.hand;
  vars["--f-mono"] = skin.fonts.mono;

  vars["--page-bg"] = skin.page;

  vars["--tag-radius"] = skin.tag.radius;
  vars["--tag-tracking"] = skin.tag.tracking;
  vars["--tag-transform"] = skin.tag.transform;

  /* Atmosphere as opacities: the paper's grain, the coffee stains and
     the vignetting fade instead of vanishing at once, and a skin can
     keep only a third of them. The components read them with a fallback
     of 1 — so they work with no skin applied. */
  vars["--atm-grain"] = String(skin.atm.grain);
  vars["--atm-stain"] = String(skin.atm.stain);
  vars["--atm-vignette"] = String(skin.atm.thumb);

  return vars;
}

export function applySkin(key?: string): Skin {
  const skin = skinOf(key);
  const root = document.documentElement.style;

  for (const [name, value] of Object.entries(skinVars(skin))) root.setProperty(name, value);

  /* Enough to write a rule that depends on the background without
     measuring it. */
  document.documentElement.dataset.skin = skin.key;
  document.documentElement.dataset.dark = skin.dark ? "1" : "0";

  loadFonts(skin);
  return skin;
}

export const loadSkinKey = (): string => {
  try {
    return localStorage.getItem(SKIN_KEY) || DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
};

export const saveSkinKey = (key: string): void => {
  try {
    localStorage.setItem(SKIN_KEY, key);
  } catch {
    /* a full store must not stop somebody changing skin */
  }
};
