/* ============================================================
   REPRODUCIBLE RANDOMNESS

   Every bit of visual disorder in the project — tilts, pins, torn edges,
   offsets — is derived from the card's id. The same card therefore always
   comes back with exactly the same look, from one session to the next:
   that is what tells an archive wall apart from an animation.

   These functions return nothing but numbers and shapes. The colour
   choices live in `theme/ink.ts`.
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
 * Indexes an array from any integer whatsoever, always staying within
 * bounds. Saves having to assert everywhere that the access is safe.
 */
export const pickFrom = <T>(items: readonly T[], n: number): T =>
  items[((n % items.length) + items.length) % items.length] as T;

export const tiltOf = (id: string): string => ((Math.abs(hash(id)) % 90) / 10 - 4.5).toFixed(1);

export const usesPin = (id: string): boolean => Math.abs(hash(id)) % 2 === 0;

// vertical offset, to break the alignment of the wall's columns
export const nudgeOf = (id: string): number => Math.round(seededRand(Math.abs(hash(id)) + 3) * 34);

// card number, archive-stamp style
export const fileNoOf = (id: string): string => String((Math.abs(hash(id)) % 9000) + 1000);

// deterministic torn edge (clip-path) for the bottom of a photo
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
