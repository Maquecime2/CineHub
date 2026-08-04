/* ============================================================
   MODÈLE — une fiche film, une seule définition
   ============================================================ */
import type { Film, LinkedWork, LinkPatch } from "../types";

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

/* ------------------------------------------------------------
   Le fil rouge — retoucher un lien déjà tendu
   ------------------------------------------------------------ */

/* Ce qu'un fil accepte qu'on réécrive dépend de sa nature, et la règle
   vit ICI plutôt que dans le formulaire : une mention libre s'écrit
   entièrement à la main, tandis qu'un renvoi vers une fiche du mur tient
   son titre et son auteur de CETTE fiche. Les réécrire de ce côté-ci
   ferait mentir la carte — deux noms pour une même œuvre, selon le bout
   par lequel on la regarde.

   La note, elle, appartient au lien et non à l'une des deux fiches :
   elle dit la résonance ENTRE elles. Elle vaut donc des deux côtés, et la
   moitié réciproque la reçoit avec. C'est la même raison qui fait que
   défaire un lien le défait aux deux bouts.

   Fonction pure sur la collection entière : c'est la seule façon
   d'atteindre les deux moitiés d'un même fil en une écriture. */
export const editLinkedWork = (
  films: Film[],
  ownerId: string,
  workId: string,
  patch: LinkPatch
): Film[] => {
  const owner = films.find((f) => f.id === ownerId);
  const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
  if (!work) return films;

  const note = (patch.note ?? work.note ?? "").trim();
  const title = (patch.title ?? work.title ?? "").trim();
  // un fil sans titre n'aurait plus rien à dire : on laisse tout en place
  if (!work.filmId && !title) return films;

  const next: Partial<LinkedWork> = work.filmId
    ? { note }
    : {
        type: patch.type ?? work.type,
        title,
        creator: (patch.creator ?? work.creator ?? "").trim(),
        note,
      };

  return films.map((f) => {
    if (f.id === ownerId)
      return {
        ...f,
        linkedWorks: (f.linkedWorks || []).map((w) => (w.id === workId ? { ...w, ...next } : w)),
      };
    // la moitié d'en face : elle ne reçoit que la note, jamais le reste
    if (work.pairId && f.id === work.filmId)
      return {
        ...f,
        linkedWorks: (f.linkedWorks || []).map((w) =>
          w.pairId === work.pairId ? { ...w, note } : w
        ),
      };
    return f;
  });
};
