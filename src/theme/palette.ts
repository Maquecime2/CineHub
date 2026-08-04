/* ============================================================
   LA PALETTE — les teintes qu'un objet rangé peut porter
   ============================================================

   ON STOCKE LA CLÉ ET JAMAIS L'HEXADÉCIMAL. C'est la règle de tout ce
   fichier : retoucher une teinte ici repeint d'un coup toutes les
   catégories et tous les bibelots déjà créés, au lieu de les figer à la
   couleur du jour où on les a faits.

   UNE SEULE LISTE. Il y en avait deux, tenues à la main : les clés dans
   `shelf-views`, les couleurs dans `constants` — et une clé présente
   dans l'une mais pas dans l'autre retombait silencieusement sur le
   bordeaux. Les clés se DÉDUISENT maintenant des couleurs, et il n'y a
   plus rien à synchroniser.

   Pourquoi ici et pas dans `constants` : `shelf-views` s'interdit React,
   et `constants` est un fichier à JSX. Le seul endroit d'où les deux
   peuvent lire est un module qui ne dépend d'aucun des deux.

   L'ORDRE DES HUIT PREMIÈRES NE BOUGE PAS. `CAT_KEYS[0]` est la couleur
   d'une catégorie neuve, et l'étagère par cinéaste distribue ses cartons
   en parcourant cette liste : la réordonner rebattrait les couleurs de
   toutes les vues qu'on referait. Les teintes ajoutées viennent donc
   après, quoi qu'il arrive. Le regroupement par famille, lui, ne sert
   qu'à l'affichage — voir `CAT_FAMILIES`. */

import { C } from "./tokens";

export const CAT_COLORS = {
  /* Les huit d'origine, à l'hexadécimal et au nom près. */
  burgundy: C.burgundy,
  ochre: C.ochre,
  pine: C.pine,
  slate: C.slate,
  cobalt: C.cobalt,
  vermillion: C.vermillion,
  moss: C.moss,
  ink: C.ink,

  // chaudes
  brique: "#A24B3C",
  rouille: "#9C5A2A",
  corail: "#D07A5E",
  safran: "#D3A44B",
  prune: "#6E3A4E",

  // froides
  ardoise: "#44586B",
  indigo: "#3C4372",
  canard: "#2F6068",
  turquoise: "#4E8C8A",
  lavande: "#7A7396",

  // naturelles
  olive: "#7C7A34",
  sapin: "#2F4A3C",
  terre: "#7A5B3A",
  sable: "#C0A468",
  fougere: "#5A8250",

  // neutres
  encre: "#4A443C",
  taupe: "#8A7F6E",
  gris: "#6E7276",
  craie: "#A9A093",
} as const;

export type CatKey = keyof typeof CAT_COLORS;

export const CAT_KEYS = Object.keys(CAT_COLORS) as CatKey[];

export const catInk = (key: string): string => CAT_COLORS[key as CatKey] || CAT_COLORS.burgundy;

/* Ce que le sélecteur montre. Une grille de vingt-quatre pastilles sans
   ordre est un nuancier qu'on parcourt du regard sans rien y trouver ;
   par familles, on cherche « quelque chose de chaud » et on l'a.

   C'est une VUE sur `CAT_COLORS`, pas une seconde liste : une clé
   oubliée ici resterait parfaitement valide, elle ne serait simplement
   pas offerte. Le test s'assure qu'aucune ne le soit. */
export const CAT_FAMILIES: { label: string; keys: CatKey[] }[] = [
  { label: "Chaudes", keys: ["burgundy", "vermillion", "brique", "rouille", "corail", "prune"] },
  { label: "Dorées", keys: ["ochre", "safran", "sable", "terre"] },
  {
    label: "Froides",
    keys: ["cobalt", "slate", "ardoise", "indigo", "canard", "turquoise", "lavande"],
  },
  { label: "Végétales", keys: ["pine", "sapin", "moss", "fougere", "olive"] },
  { label: "Neutres", keys: ["ink", "encre", "gris", "taupe", "craie"] },
];
