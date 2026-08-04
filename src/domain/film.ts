/* ============================================================
   MODÈLE — une fiche film, une seule définition
   ============================================================ */
import type { Film } from "../types";

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const makeFilm = (partial: Partial<Film> = {}): Film => ({
  id: uid(),
  title: "",
  year: "",
  director: "",
  poster: "", // URL TMDB, adresse collée, ou image réduite en data URI
  stills: [], // captures d'écran : { id, key (IndexedDB), caption }
  genres: [],
  themes: [],
  rating: 0,
  review: "",
  notes: "",
  linkedWorks: [],
  addedAt: Date.now(),
  status: "watched",
  chevet: false, // le rayon du haut : ceux qu'on revoit
  /* Mis de côté : la fiche quitte le mur et la constellation sans être
     détruite. C'est le contraire d'une suppression — elle reste entière,
     rangée dans la réserve de l'étagère, et revient d'un glissement. */
  archived: false,
  order: null, // rang manuel sur l'étagère ; null = jamais rangé à la main
  watchedAt: null,
  tmdbId: null,
  source: "manual",
  ...partial,
});

/* Les fiches enregistrées avant ces champs sont complétées au chargement.
   On en profite pour ramener `year` à un nombre : le tri par année faisait
   jusqu'ici de l'arithmétique sur des chaînes venues du CSV. */
export const migrate = (films: Partial<Film>[] | null | undefined): Film[] =>
  (films || []).map((f) => ({
    ...makeFilm(),
    ...f,
    year: f.year === "" || f.year == null ? "" : Number(f.year) || "",
    status: f.status === "watchlist" ? ("watchlist" as const) : ("watched" as const),
    chevet: !!f.chevet,
    archived: !!f.archived,
    order: typeof f.order === "number" ? f.order : null,
    genres: f.genres || [],
    themes: f.themes || [],
    linkedWorks: f.linkedWorks || [],
    stills: f.stills || [],
  }));
