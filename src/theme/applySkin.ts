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
import { readHand, watchHand } from "./handwriting";
import { store } from "../services/storage";

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
  /* LE RÉGLAGE DE LA MAIN SE LIT ICI, et nulle part ailleurs. Une peau
     choisit SA cursive ; le réglage dit si l'on en veut une du tout, et
     répond par la police de labeur de la même peau — pas par une police
     venue d'ailleurs, qui jurerait avec les seize autres. */
  vars["--f-hand"] = readHand() === "plain" ? skin.fonts.body : skin.fonts.hand;
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

/* LA DERNIÈRE PEAU POSÉE, pour pouvoir la reposer. Changer d'avis sur
   la cursive ne change pas de peau : il faut réécrire les mêmes
   variables avec la nouvelle réponse, et il n'y a qu'ici qu'on sait
   lesquelles. */
let lastKey: string | undefined;

export function applySkin(key?: string): Skin {
  lastKey = key;
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

/* ============================================================
   LA PEAU VOYAGE, ET C'ÉTAIT ÉCRIT L'INVERSE
   ============================================================

   `documents.ts` a longtemps rangé la peau parmi ce qui décrit CET
   APPAREIL, avec cet argument : « on n'impose pas l'humeur du moment à
   notre autre écran ». La règle est renversée, volontairement. Ce qu'on
   choisit ici n'est pas une humeur d'un soir, c'est l'aspect de son
   classeur ; le retrouver autre en changeant d'ordinateur se lit comme
   un réglage perdu, pas comme une attention.

   ELLE PASSE DONC PAR `store`, ET NON PLUS PAR `localStorage` EN DIRECT.
   C'est le seul point de passage qui date un document et le met en file
   (`noteIfSyncable`) ; y écrire à côté, c'était écrire sans que personne
   le sache. Rien ne descend au coffre pour autant — la peau est lue
   AVANT que la base soit ouverte, et `store` sert la vitrine de façon
   synchrone pour les clés qui n'y sont pas.

   CE QUI ÉTAIT DÉJÀ ÉCRIT L'ÉTAIT EN CLAIR, et c'est le piège. On
   rangeait `herbier`, quand `store` range `"herbier"` — du JSON. Une
   lecture par `store.get` sur l'ancienne forme lève et rend le défaut :
   tout le monde serait revenu au kraft le jour de la mise à jour. Et
   `documentsToSend` aurait envoyé `null`, donc effacé la peau de l'autre
   appareil par-dessus le marché.

   LA CONVERSION NE DATE RIEN, exprès. Elle réécrit la valeur sous sa
   forme neuve sans la marquer à envoyer : `catchUpDocuments` la
   ramassera à l'AUBE, c'est-à-dire en perdant contre tout ce que le
   serveur tient déjà. Rattraper ne doit écraser personne — la règle est
   celle de `sendAllDocuments`, et elle vaut ici mot pour mot. */
export const loadSkinKey = (): string => {
  try {
    const raw = localStorage.getItem(SKIN_KEY);
    if (!raw) return DEFAULT_SKIN;
    try {
      const kept = JSON.parse(raw) as unknown;
      return typeof kept === "string" && kept ? kept : DEFAULT_SKIN;
    } catch {
      /* L'ANCIENNE FORME, en clair. On la convertit sur place. */
      localStorage.setItem(SKIN_KEY, JSON.stringify(raw));
      return raw;
    }
  } catch {
    return DEFAULT_SKIN;
  }
};

/**
 * A-t-on DÉJÀ choisi une peau sur cet appareil ?
 *
 * `loadSkinKey` ne peut pas répondre : elle rend le kraft quand la clé
 * est absente, ce qui est indistinguable d'un kraft choisi exprès. Or la
 * différence décide de tout pour le repli sur le serveur — retomber sur
 * la peau portée par-dessus un choix local serait un classeur qui se
 * déguise tout seul, ce que ce fichier interdit depuis toujours.
 */
export const skinChosen = (): boolean => {
  try {
    return localStorage.getItem(SKIN_KEY) !== null;
  } catch {
    return false;
  }
};

/**
 * Écrire la peau choisie, et la faire voyager.
 *
 * ELLE NE RÉÉCRIT PAS CE QUI EST DÉJÀ ÉCRIT, et ce n'est pas une
 * économie : `App` applique la peau à CHAQUE montage, donc une écriture
 * inconditionnelle redaterait le document à chaque ouverture de
 * l'application. Le dernier appareil ALLUMÉ imposerait alors sa peau au
 * dernier appareil TOUCHÉ, ce qui est exactement l'inverse de ce qu'on
 * veut : on suit le dernier CHOIX.
 *
 * « DÉJÀ ÉCRIT » SE LIT SUR LE DISQUE, ET NON SUR `loadSkinKey`. Celle-ci
 * rend le kraft quand rien n'est rangé : comparer à elle faisait qu'un
 * choix EXPLICITE du kraft, sur une machine neuve, n'écrivait rien du
 * tout — donc `skinChosen` répondait non, et la peau portée au comptoir
 * serait venue par-dessus une décision qu'on avait bel et bien prise.
 */
export const saveSkinKey = (key: string): void => {
  if (skinChosen() && key === loadSkinKey()) return;
  store.set(SKIN_KEY, key);
};

/* L'ABONNEMENT EST DANS CE SENS-LÀ, et pas dans l'autre : `handwriting`
   ne connaît pas les peaux — il ne tient qu'un choix — et lui faire
   appeler `applySkin` aurait fermé un cercle entre les deux modules. */
watchHand(() => {
  if (typeof document !== "undefined") applySkin(lastKey);
});
