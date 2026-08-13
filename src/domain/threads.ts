/* ============================================================
   THREADS — a question put to the collection, and left standing
   ============================================================

   "The films where the hero dies" is not a link between two cards: it is
   a gathering, which may hold two of them or thirty, and which carries a
   name. Nothing in the model could say that — a binary link would have
   needed N×(N−1)/2 threads strung by hand to express a single idea.

   A THREAD HAS TWO SOURCES, AND THAT IS THE WHOLE POINT OF IT:

   — the MOTIF, which feeds it on its own. Tagging a fresh card brings it
     into the thread without a second thought, which is the only way a
     gathering stays true six months later;
   — the HAND, which adds what no motif says and removes what the motif
     catches by mistake.

   Removals are therefore kept EXPLICITLY (`excluded`) and not by silent
   subtraction: without them, a film set aside would come back on the next
   load, since its motif has not moved.

   THE FIELD NAMES ARE PART OF THE STORED FORMAT. Threads written before
   this module was translated carry `exclus` and `couleur`; `normalizeThreads`
   is the only door they come in through, and it reads both spellings so
   that an existing binder loses neither its exclusions nor its colours.
   The same door carries the motif identifiers over (`migrateMotifId`):
   a thread fed by `melancolie` must keep being fed once the catalogue
   calls it `melancholy`. */
import { uid } from "./film";
import { migrateMotifId } from "./motifs";
import type { Film } from "../types";

export interface Thread {
  id: string;
  label: string;
  note: string;
  /** The motif that feeds it (`domain/motifs`), or `null` for a hand-made thread. */
  motif?: string | null;
  /** Added by hand, on top of the motif. */
  filmIds: string[];
  /** Set aside by hand, despite the motif. */
  excluded: string[];
  /** A key from `theme/palette`, never a hex value. */
  color: string;
}

export const makeThread = (partial: Partial<Thread> = {}): Thread => ({
  id: uid(),
  label: "",
  note: "",
  motif: null,
  filmIds: [],
  excluded: [],
  color: "burgundy",
  ...partial,
});

/** The members' ids: motif ∪ additions ∖ removals. */
export const threadMembers = (thread: Thread, films: Film[]): string[] => {
  const excluded = new Set(thread.excluded || []);
  const ids = new Set<string>();
  if (thread.motif)
    for (const f of films) if ((f.motifs || []).includes(thread.motif)) ids.add(f.id);
  for (const id of thread.filmIds || []) ids.add(id);
  /* An id that no longer points at anything — the card was deleted — is
     not one of the members, but we do NOT take it out of the thread:
     erasing it here would mean writing to disk on every read. */
  const alive = new Set(films.map((f) => f.id));
  return [...ids].filter((id) => !excluded.has(id) && alive.has(id));
};

/* Putting a card in or taking it out always comes down to the same
   question: what is the state we WANT, and what does the motif already
   say about it? A film the motif brings in is not added — it is removed
   from the excluded list. */
export const withFilm = (thread: Thread, filmId: string): Thread => ({
  ...thread,
  filmIds: thread.filmIds.includes(filmId) ? thread.filmIds : [...thread.filmIds, filmId],
  excluded: (thread.excluded || []).filter((id) => id !== filmId),
});

export const withoutFilm = (thread: Thread, filmId: string, films: Film[]): Thread => {
  const fromTheMotif =
    !!thread.motif &&
    films.some((f) => f.id === filmId && (f.motifs || []).includes(thread.motif as string));
  return {
    ...thread,
    filmIds: thread.filmIds.filter((id) => id !== filmId),
    // only a film brought in by the motif needs to be explicitly set aside
    excluded: fromTheMotif
      ? [...new Set([...(thread.excluded || []), filmId])]
      : thread.excluded || [],
  };
};

/** The shape stored before this module was translated. */
type StoredThread = Partial<Thread> & { exclus?: unknown; couleur?: unknown };

/** What comes off the disk: we trust nothing about its shape. */
export const normalizeThreads = (raw: unknown): Thread[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((f): f is StoredThread => !!f && typeof f === "object")
    .map(({ exclus, couleur, ...f }) => {
      /* The legacy spellings are read here and go no further: they are
         left out of the object we rebuild, so the next write uses the
         current names only. */
      const excluded = Array.isArray(f.excluded)
        ? f.excluded
        : Array.isArray(exclus)
          ? (exclus as string[])
          : [];
      return makeThread({
        ...f,
        id: f.id || uid(),
        filmIds: Array.isArray(f.filmIds) ? f.filmIds : [],
        excluded,
        motif: typeof f.motif === "string" ? migrateMotifId(f.motif) : (f.motif ?? null),
        color: f.color || (typeof couleur === "string" ? couleur : undefined) || "burgundy",
      });
    })
    .filter((f) => !!f.label.trim());
