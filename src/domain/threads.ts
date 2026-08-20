/* ============================================================
   A MOTIF'S GATHERING — the settings sheet of a motif, and nothing else
   ============================================================

   THERE USED TO BE TWO OBJECTS HERE, AND THAT WAS THE WHOLE PROBLEM.
   You laid a MOTIF on a card, then you promoted it into a THREAD — a
   second object, with its own name, its own colour, its own id. Nothing
   on screen said what the promotion was for, the button looked the same
   once the thread existed, and from a second card carrying the same
   motif the click went silently to the map: you believed you had made
   something, and you had made nothing.

   SO THE MOTIF IS NOW THE ONLY OBJECT. A motif laid on two cards or more
   is a star of the map on its own, with nobody asking for it. What is
   stored here is only what somebody DEVIATED from that default —
   renamed, recoloured, annotated, added or set aside by hand, or turned
   off. No deviation, no stored row.

   THE IDENTITY IS THEREFORE THE MOTIF, never a generated id. Two rows on
   the same motif cannot exist any more; a duplicate coming in from a
   backup is merged at the door.

   `label` IS AN OVERRIDE AND NOTHING ELSE. It used to be a COPY of the
   motif's name, which was wrong twice over: a catalogue motif has no
   `label` at all (it has a name per language, see `motifLabel`), so the
   copy wrote `undefined` and the next read crashed on it; and a motif
   relabelled in the catalogue left the old name frozen in the data.
   Empty here means "call it whatever the catalogue calls it, in the
   language of the day".

   A THREAD STILL HAS TWO SOURCES, and that has not changed:

   — the MOTIF, which feeds it on its own. Tagging a fresh card brings it
     into the gathering without a second thought, which is the only way a
     gathering stays true six months later;
   — the HAND, which adds what no motif says and removes what the motif
     catches by mistake.

   Removals are therefore kept EXPLICITLY (`excluded`) and not by silent
   subtraction: without them, a film set aside would come back on the next
   load, since its motif has not moved.

   THE FIELD NAMES ARE PART OF THE STORED FORMAT. Threads written before
   this module was translated carry `exclus` and `couleur`;
   `normalizeThreads` is the only door they come in through, and it reads
   both spellings so that an existing binder loses neither its exclusions
   nor its colours. The same door carries the motif identifiers over
   (`migrateMotifId`): a gathering fed by `melancolie` must keep being fed
   once the catalogue calls it `melancholy`. */
import { hash, pickFrom } from "./seeded";
import { migrateMotifId, motifById, motifLabel } from "./motifs";
import type { NameOf } from "./motifs";
import { CAT_KEYS } from "../theme/palette";
import type { Film } from "../types";

/** A motif on this many cards or more becomes a star by itself. */
export const STAR_FROM = 2;

export interface Thread {
  /** The same as `motif`: the motif IS the gathering. */
  id: string;
  /** The motif that feeds it. It is also its identity. */
  motif: string;
  /**
   * A name written by hand INSTEAD of the motif's own. Empty is the norm
   * — read it through `threadLabel`, never on its own.
   */
  label: string;
  note: string;
  /** Added by hand, on top of the motif. */
  filmIds: string[];
  /** Set aside by hand, despite the motif. */
  excluded: string[];
  /** A key from `theme/palette`, never a hex value. */
  color: string;
  /** The star put out by hand, even though the motif reaches the count. */
  off?: boolean;
}

/* SOWN, NOT DRAWN. The colour used to be `CAT_KEYS[threads.length % …]`,
   so the same motif came out a different colour depending on how many
   gatherings happened to exist the day it was made — and every colour
   shifted when an earlier one was deleted. Seeded on the motif, it is the
   motif's colour for good. */
export const colorForMotif = (motifId: string): string =>
  pickFrom(CAT_KEYS, hash(motifId)) as string;

export const makeThread = ({ motif, ...rest }: Partial<Thread> & { motif: string }): Thread => ({
  label: "",
  note: "",
  filmIds: [],
  excluded: [],
  color: colorForMotif(motif),
  ...rest,
  motif,
  /* The id is never the caller's business, and a stored one is ignored:
     it is the motif, always. That is what makes two rows on one motif
     impossible rather than merely unlikely. */
  id: motif,
});

/** What to write under a gathering: the hand-written name, else the motif's. */
export const threadLabel = (thread: Thread, name: NameOf): string => {
  if (thread.label.trim()) return thread.label;
  const motif = motifById(thread.motif);
  return motif ? motifLabel(motif, name) : thread.motif;
};

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

/** How many cards carry this motif. What the card shows next to the chip. */
export const countOfMotif = (motifId: string, films: Film[]): number =>
  films.reduce((n, f) => n + ((f.motifs || []).includes(motifId) ? 1 : 0), 0);

/* ============================================================
   WHAT THE MAP ACTUALLY DRAWS

   The stored rows are deviations, so they are NOT the list of stars —
   they are a handful of corrections laid over a list nobody wrote. This
   is the one door the sky reads through.
   ============================================================ */
export const effectiveThreads = (
  films: Film[],
  stored: Thread[] = [],
  /**
   * `includeOff` is what the band of chips reads: one cannot light again
   * a star one can no longer see, so the chips show the put-out ones and
   * the map does not.
   */
  { minFilms = STAR_FROM, includeOff = false }: { minFilms?: number; includeOff?: boolean } = {}
): Thread[] => {
  const settings = new Map(stored.map((t) => [t.motif, t]));
  const counted = new Map<string, number>();
  for (const f of films)
    for (const id of f.motifs || []) counted.set(id, (counted.get(id) || 0) + 1);

  const out: Thread[] = [];
  const seen = new Set<string>();
  for (const [motif, n] of counted) {
    if (n < minFilms) continue;
    seen.add(motif);
    out.push(settings.get(motif) || makeThread({ motif }));
  }
  /* A gathering held up by hand alone — one card carrying the motif, two
     more added from the panel — is below the count and must still be
     drawn. Its rows are the only trace it has. */
  for (const t of stored) if (!seen.has(t.motif) && t.filmIds.length > 0) out.push(t);

  return includeOff ? out : out.filter((t) => !t.off);
};

/** Is this motif a star on the map right now? */
export const isStarred = (motifId: string, films: Film[], stored: Thread[] = []): boolean =>
  effectiveThreads(films, stored).some((t) => t.motif === motifId);

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
    !!thread.motif && films.some((f) => f.id === filmId && (f.motifs || []).includes(thread.motif));
  return {
    ...thread,
    filmIds: thread.filmIds.filter((id) => id !== filmId),
    // only a film brought in by the motif needs to be explicitly set aside
    excluded: fromTheMotif
      ? [...new Set([...(thread.excluded || []), filmId])]
      : thread.excluded || [],
  };
};

/**
 * Is this row worth keeping on disk?
 *
 * A row that says nothing the default does not already say is not stored:
 * that is what keeps `"fils"` a list of deviations rather than a second
 * copy of the vocabulary.
 */
export const isPlainDefault = (thread: Thread): boolean =>
  !thread.label.trim() &&
  !thread.note.trim() &&
  thread.filmIds.length === 0 &&
  thread.excluded.length === 0 &&
  !thread.off &&
  thread.color === colorForMotif(thread.motif);

/** The shape stored before this module was translated. */
type StoredThread = Partial<Thread> & { exclus?: unknown; couleur?: unknown };

/** What comes off the disk: we trust nothing about its shape. */
export const normalizeThreads = (raw: unknown): Thread[] => {
  const byMotif = new Map<string, Thread>();
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== "object") continue;
    const { exclus, couleur, ...f } = entry as StoredThread;
    /* NO MOTIF, NO ROW. A gathering fed by nothing was reachable from
       nowhere in the interface and drew nothing on the map — it was a
       ghost the day its motif was deleted, and it could not even be
       thrown away. What one wants instead is a motif of one's own, which
       the picker already makes. */
    if (typeof f.motif !== "string" || !f.motif.trim()) continue;
    const motif = migrateMotifId(f.motif);

    /* The legacy spellings are read here and go no further: they are
       left out of the object we rebuild, so the next write uses the
       current names only. */
    const excluded = Array.isArray(f.excluded)
      ? f.excluded
      : Array.isArray(exclus)
        ? (exclus as string[])
        : [];
    /* `label` USED TO BE WRITTEN AS `undefined`, and the read crashed on
       it — `.trim()` of nothing, at the very mounting of the app. It is
       an override now, so nothing is the normal case. */
    const label = typeof f.label === "string" ? f.label : "";

    const thread = makeThread({
      ...f,
      motif,
      label,
      filmIds: Array.isArray(f.filmIds) ? f.filmIds : [],
      excluded,
      note: typeof f.note === "string" ? f.note : "",
      color: f.color || (typeof couleur === "string" ? couleur : undefined) || colorForMotif(motif),
      off: !!f.off,
    });

    /* THE MOTIF IS THE IDENTITY, so a second row on the same motif is not
       a second gathering: it is the same one, written twice by an import.
       The hand-set films of both are kept — dropping one silently would
       lose cards nobody could name. */
    const already = byMotif.get(motif);
    byMotif.set(
      motif,
      already
        ? {
            ...already,
            label: already.label || thread.label,
            note: already.note || thread.note,
            filmIds: [...new Set([...already.filmIds, ...thread.filmIds])],
            excluded: [...new Set([...already.excluded, ...thread.excluded])],
          }
        : thread
    );
  }
  return [...byMotif.values()];
};
