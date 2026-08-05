/* ============================================================
   POSER UNE PEAU — l'écrire sur la racine, charger ses polices
   ============================================================

   Tout le travail tient en une phrase : on écrit des variables CSS sur
   `documentElement`. Rien ne remonte à React, aucun composant n'est
   averti, et c'est précisément ce qu'on voulait — six cent treize
   lectures de jetons dans vingt-neuf fichiers changent d'un coup sans
   qu'aucune d'elles ait à savoir qu'une peau existe.

   Les styles en ligne gagnent contre une feuille de styles, mais les
   variables écrites ici ne SONT pas des styles en ligne des composants :
   elles sont écrites sur un autre élément, l'ancêtre de tous. Un jeton
   lu comme `var(--c-paper)` remonte donc jusqu'à elles, et le `:root` de
   `FONT_IMPORT` ne sert que de dernier recours — au premier rendu, avant
   qu'une ligne de JavaScript ait tourné. */

import { skinOf, DEFAULT_SKIN, type Skin } from "./skins";

export const SKIN_KEY = "site-skin";

/* Le lien vers Google. UN SEUL élément, réutilisé : en créer un par
   changement de peau laisserait derrière soi autant de feuilles de
   styles que d'essais, dont les `@font-face` continueraient de
   s'appliquer — la dernière déclarée gagnerait, ce qui n'est pas
   forcément la dernière choisie. */
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
  // réécrire la même adresse relancerait un chargement pour rien
  if (link.href !== href) link.href = href;
}

/* Un jeton en camel devient une variable en tirets : `paperDark` s'écrit
   `--c-paper-dark`. La correspondance est ici et nulle part ailleurs —
   `tokens` la suppose, ce fichier la produit. */
const varName = (key: string): string =>
  `--c-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;

/* TOUT CE QU'UNE PEAU ÉCRIT, sous forme de paires — et non posé.

   Séparé de la pose parce que la racine du document n'est pas le seul
   endroit où une peau peut vivre : l'écran de contrôle en montre
   quatorze À LA FOIS, chacune sur un fragment de page, et il lui faut
   les mêmes variables sous forme de style. Les variables CSS cascadent —
   un jeton lu comme `var(--c-paper)` remonte au plus proche ancêtre qui
   la porte, que ce soit `documentElement` ou un simple `div`.

   Une seule définition, donc, pour les deux usages : la correspondance
   `paperDark` → `--c-paper-dark` ne se réécrit nulle part ailleurs. */
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

  /* L'atmosphère en opacités : le grain du papier, les taches de café et
     le vignettage se fondent au lieu de disparaître d'un coup, et une
     peau peut n'en garder qu'un tiers. Les composants les lisent avec
     une valeur de repli à 1 — ils marchent donc sans peau posée. */
  vars["--atm-grain"] = String(skin.atm.grain);
  vars["--atm-stain"] = String(skin.atm.stain);
  vars["--atm-vignette"] = String(skin.atm.vignette);

  return vars;
}

export function applySkin(key?: string): Skin {
  const skin = skinOf(key);
  const root = document.documentElement.style;

  for (const [name, value] of Object.entries(skinVars(skin))) root.setProperty(name, value);

  /* De quoi écrire une règle qui dépende du fond sans le mesurer. */
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
    /* un rangement plein ne doit pas empêcher de changer de peau */
  }
};
