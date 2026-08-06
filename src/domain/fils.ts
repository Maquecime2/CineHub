/* ============================================================
   LES FILS — une question posée à la collection, et qui reste posée
   ============================================================

   « Les films où le héros meurt » n'est pas un lien entre deux fiches :
   c'est un rassemblement, qui peut en compter deux ou trente, et qui
   porte un nom. Rien dans le modèle ne savait dire ça — un lien binaire
   aurait demandé N×(N−1)/2 fils tendus à la main pour exprimer une seule
   idée.

   UN FIL A DEUX SOURCES, ET C'EST TOUT SON INTÉRÊT :

   — le MOTIF, qui l'alimente tout seul. Taguer une fiche neuve la fait
     entrer dans le fil sans y penser, ce qui est la seule façon qu'un
     rassemblement reste vrai six mois plus tard ;
   — la MAIN, qui ajoute ce qu'aucun motif ne dit et retire ce que le
     motif attrape à tort.

   Les retraits sont donc gardés EXPLICITEMENT (`exclus`) et non par
   soustraction silencieuse : sans eux, un film écarté reviendrait au
   chargement suivant puisque son motif, lui, n'a pas bougé. */
import { uid } from "./film";
import type { Film } from "../types";

export interface Fil {
  id: string;
  label: string;
  note: string;
  /** Le motif qui l'alimente (`domain/motifs`), ou `null` pour un fil à la main. */
  motif?: string | null;
  /** Ajoutés à la main, en plus du motif. */
  filmIds: string[];
  /** Écartés à la main, malgré le motif. */
  exclus: string[];
  /** Une clé de `theme/palette`, jamais un hexadécimal. */
  couleur: string;
}

export const makeFil = (partial: Partial<Fil> = {}): Fil => ({
  id: uid(),
  label: "",
  note: "",
  motif: null,
  filmIds: [],
  exclus: [],
  couleur: "burgundy",
  ...partial,
});

/** Les identifiants des membres : motif ∪ ajouts ∖ retraits. */
export const membresDuFil = (fil: Fil, films: Film[]): string[] => {
  const exclus = new Set(fil.exclus || []);
  const ids = new Set<string>();
  if (fil.motif) for (const f of films) if ((f.motifs || []).includes(fil.motif)) ids.add(f.id);
  for (const id of fil.filmIds || []) ids.add(id);
  /* Un id qui ne désigne plus rien — la fiche a été supprimée — ne fait
     pas partie des membres, mais on ne le retire PAS du fil : l'effacer
     ici demanderait d'écrire sur le disque à chaque lecture. */
  const vivants = new Set(films.map((f) => f.id));
  return [...ids].filter((id) => !exclus.has(id) && vivants.has(id));
};

export const filmsDuFil = (fil: Fil, films: Film[]): Film[] => {
  const ids = new Set(membresDuFil(fil, films));
  return films.filter((f) => ids.has(f.id));
};

/* Poser ou ôter une fiche revient toujours à la même question : quel est
   l'état VOULU, et qu'est-ce que le motif en dit déjà ? Un film que le
   motif amène ne s'ajoute pas — il se retire de la liste des exclus. */
export const avecFilm = (fil: Fil, filmId: string): Fil => ({
  ...fil,
  filmIds: fil.filmIds.includes(filmId) ? fil.filmIds : [...fil.filmIds, filmId],
  exclus: (fil.exclus || []).filter((id) => id !== filmId),
});

export const sansFilm = (fil: Fil, filmId: string, films: Film[]): Fil => {
  const parLeMotif =
    !!fil.motif &&
    films.some((f) => f.id === filmId && (f.motifs || []).includes(fil.motif as string));
  return {
    ...fil,
    filmIds: fil.filmIds.filter((id) => id !== filmId),
    // seul un film amené par le motif a besoin d'être explicitement écarté
    exclus: parLeMotif ? [...new Set([...(fil.exclus || []), filmId])] : fil.exclus || [],
  };
};

/** Ce qui sort du disque : on ne fait confiance à rien de sa forme. */
export const normalizeFils = (raw: unknown): Fil[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((f): f is Partial<Fil> => !!f && typeof f === "object")
    .map((f) =>
      makeFil({
        ...f,
        id: f.id || uid(),
        filmIds: Array.isArray(f.filmIds) ? f.filmIds : [],
        exclus: Array.isArray(f.exclus) ? f.exclus : [],
      })
    )
    .filter((f) => !!f.label.trim());
