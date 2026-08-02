/* ============================================================
   ALÉATOIRE REPRODUCTIBLE

   Tout le désordre visuel du projet — inclinaisons, punaises, bords
   déchirés, décalages — est dérivé de l'identifiant de la fiche. Une même
   fiche retrouve donc toujours exactement la même allure, d'une session à
   l'autre : c'est ce qui distingue un mur d'archives d'une animation.

   Ces fonctions ne renvoient que des nombres et des formes. Les choix de
   couleur, eux, vivent dans `theme/ink.ts`.
   ============================================================ */

export const hash = (str = ""): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return h;
};

export const seededRand = (seed: number): number => {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
};

/**
 * Indexe un tableau à partir d'un entier quelconque, en restant toujours
 * dans les bornes. Évite d'avoir à affirmer partout que l'accès est sûr.
 */
export const pickFrom = <T>(items: readonly T[], n: number): T =>
  items[((n % items.length) + items.length) % items.length] as T;

export const tiltOf = (id: string): string => ((Math.abs(hash(id)) % 90) / 10 - 4.5).toFixed(1);

export const usesPin = (id: string): boolean => Math.abs(hash(id)) % 2 === 0;

// décalage vertical pour casser l'alignement des colonnes du mur
export const nudgeOf = (id: string): number => Math.round(seededRand(Math.abs(hash(id)) + 3) * 34);

// numéro de fiche façon tampon d'archive
export const fileNoOf = (id: string): string => String((Math.abs(hash(id)) % 9000) + 1000);

// bord déchiré déterministe (clip-path) pour le bas d'une photo
export const tornClip = (id: string, points = 9): string => {
  const base = Math.abs(hash(id));
  const pts = ["0% 0%", "100% 0%", "100% 85%"];
  for (let i = points; i >= 0; i--) {
    const x = (i / points) * 100;
    const y = 85 + seededRand(base + i * 7) * 13;
    pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }
  pts.push("0% 85%");
  return `polygon(${pts.join(",")})`;
};
