/* ============================================================
   CE QU'UN RAYON CONTIENT — lire une ligne sans la parcourir

   Quatre cents boîtiers sont un mur opaque. Le rangement dit OÙ est
   chaque film ; rien ne disait ce qu'une ligne rassemble. On ouvrait donc
   les fiches une à une pour retrouver ce qu'on savait déjà avoir rangé
   là.

   Ce module lit une ligne et rend de quoi l'annoncer en un coup d'œil :
   combien de boîtiers, quelles années, quel genre domine, quelle note
   moyenne, et combien répondent à la recherche en cours.

   IL REND DES CLÉS ET DES NOMBRES, JAMAIS DES PHRASES. Une clé de genre
   est déjà une donnée du classeur ; l'écran la met en mots. Y écrire du
   français figerait la langue du jour, exactement ce que `threadLabel`
   évite en lisant le catalogue.

   HORS DU CHEMIN CHAUD. Il est appelé par un `useMemo` sur l'identité du
   tableau `items` — or une ligne n'est PAS reconstruite pendant un
   glissement, c'est tout le principe de `ShelfBoard`. Il ne se recalcule
   donc jamais sous le doigt.
   ============================================================ */
import { canonicalGenres } from "./genres";
import type { Film } from "../types";

/**
 * Ce qu'on lit d'un item de rangement.
 *
 * Le modèle vit dans `src/shelf-views.js`, qui est du JavaScript pur : on
 * en décrit ici la seule forme qu'on lit — le discriminant et, pour une
 * boîte, ce qu'elle contient. Recopier l'union entière en ferait une
 * seconde définition à tenir à jour.
 */
export interface ReadableItem {
  t: "f" | "c" | "d";
  id: string;
  items?: ReadableItem[];
}

export interface RowReading {
  /** Les BOÎTIERS, boîtes comprises. Les objets posés ne comptent pas. */
  cases: number;
  /** La fourchette réelle des années ; `null` si aucune fiche n'en porte. */
  years: [number, number] | null;
  /** La clé canonique du genre dominant ; `null` s'il n'y en a pas. */
  genre: string | null;
  /** La moyenne des fiches NOTÉES seulement ; `null` si aucune ne l'est. */
  rating: number | null;
  /** Combien répondent à la recherche en cours ; 0 s'il n'y en a pas. */
  found: number;
}

export const EMPTY_READING: RowReading = {
  cases: 0,
  years: null,
  genre: null,
  rating: null,
  found: 0,
};

/** Les identifiants de film d'une ligne, boîtes traversées, dans l'ordre. */
export function filmsInRow(items: readonly ReadableItem[] = []): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (!it) continue;
    if (it.t === "f") out.push(it.id);
    /* UNE BOÎTE SE TRAVERSE, UN OBJET POSÉ NON. Le modèle refuse
       l'imbrication d'une boîte dans une boîte — un seul niveau suffit
       donc, et en écrire un récursif inventerait un cas que rien ne peut
       produire. */ else if (it.t === "c")
      for (const inner of it.items || []) if (inner?.t === "f") out.push(inner.id);
  }
  return out;
}

/**
 * Ce que cette ligne rassemble.
 *
 * `matching` est l'ensemble des fiches qui RÉPONDENT à la recherche —
 * c'est ce que `ShelfBoard` reçoit sous le nom `dimSet`, dont le nom dit
 * l'usage et non le contenu. `null` : on ne cherche rien.
 */
export function readRow(
  items: readonly ReadableItem[] = [],
  byId: Map<string, Film>,
  matching: Set<string> | null = null
): RowReading {
  const ids = filmsInRow(items);
  if (ids.length === 0) return EMPTY_READING;

  let min = Infinity,
    max = -Infinity,
    sum = 0,
    rated = 0,
    found = 0;
  const genres = new Map<string, number>();

  for (const id of ids) {
    if (matching?.has(id)) found++;
    const film = byId.get(id);
    /* UNE FICHE DISPARUE NE COMPTE PAS ET N'EFFACE RIEN. Lire n'écrit
       pas : on saute l'entrée à l'affichage et on laisse le rangement
       tranquille — la copie de `threadMembers` et de `courseSteps`. */
    if (!film) continue;

    const year = typeof film.year === "number" ? film.year : Number(film.year);
    if (Number.isFinite(year) && year > 0) {
      if (year < min) min = year;
      if (year > max) max = year;
    }

    /* LA MOYENNE NE PORTE QUE SUR LES NOTÉES. Compter un zéro pour « pas
       encore noté » ferait descendre le rayon à mesure qu'on y range, et
       on lirait comme un jugement ce qui n'est qu'un travail en cours. */
    if (film.rating > 0) {
      sum += film.rating;
      rated++;
    }

    /* LE GENRE PASSE PAR LA FORME CANONIQUE, sans quoi « Science
       Fiction » et « Science-Fiction » comptent pour deux et aucun des
       deux ne domine. C'est le piège déjà écrit pour les défis par
       critère. */
    for (const g of canonicalGenres(film.genres || [])) genres.set(g, (genres.get(g) || 0) + 1);
  }

  /* Le genre dominant, et l'égalité tranchée sur l'ALPHABET : ce n'est
     pas juste, c'est DÉTERMINISTE, et il le faut puisque cette ligne se
     regarde — un départage au hasard la ferait changer entre deux
     rendus.

     UN GENRE PORTÉ PAR UNE SEULE FICHE N'EST PAS DOMINANT : c'est un
     accident, pas une veine — le mot exact qu'`athome` emploie pour
     refuser un motif posé sur une seule carte. Sans ce plancher, une
     ligne de douze films aux douze genres différents en aurait annoncé
     un, au hasard de l'alphabet, et l'aurait annoncé faux. */
  let genre: string | null = null;
  let best = 1;
  for (const [key, n] of [...genres].sort((a, b) => a[0].localeCompare(b[0])))
    if (n > best) {
      best = n;
      genre = key;
    }

  return {
    cases: ids.length,
    years: min <= max ? [min, max] : null,
    genre,
    rating: rated > 0 ? Math.round((sum / rated) * 10) / 10 : null,
    found,
  };
}

/* ------------------------------------------------------------
   LES BOÎTES D'UN RANGEMENT — la légende des couleurs

   Une boîte de catégorie porte un nom et une couleur, et rien à l'écran
   ne disait ce que la couleur voulait dire : on rangeait « polar » en
   cobalt un mardi, et six mois plus tard on avait devant soi un rayon de
   pastilles bleues sans savoir laquelle était laquelle.
   ------------------------------------------------------------ */
export interface BoxReading {
  id: string;
  label: string;
  color: string;
  cases: number;
  found: number;
}

/**
 * Les boîtes posées dans ces lignes, dans l'ordre où elles s'y trouvent.
 *
 * L'ORDRE EST CELUI DU TABLEAU, comme partout ici : rien ne porte de
 * rang, et trier la légende par nom la ferait mentir sur ce qu'on voit —
 * on lit une légende pour retrouver quelque chose SUR le rayon.
 */
export function readBoxes(
  items: readonly ReadableItem[] = [],
  matching: Set<string> | null = null
): BoxReading[] {
  const out: BoxReading[] = [];
  for (const it of items) {
    if (it?.t !== "c") continue;
    const box = it as ReadableItem & { label?: string; color?: string };
    const ids = filmsInRow(box.items || []);
    out.push({
      id: box.id,
      label: box.label || "",
      color: box.color || "",
      cases: ids.length,
      found: matching ? ids.filter((id) => matching.has(id)).length : 0,
    });
  }
  return out;
}
