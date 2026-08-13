/* ============================================================
   SEARCHING EVERYWHERE — one question, the whole binder

   `domain/search` already knew how to answer "does this FILM match", and
   three views used it. But a binder does not only contain films: it also
   contains notebook pages, a vocabulary of motifs, threads strung across
   it, and the people from the credits. None of that was searchable — you
   had to know in advance which tab held what you were looking for, which
   assumes you have already found it.

   This module redefines NOTHING. It puts the same question to each kind
   of thing, and gathers the answers into a common shape. The definition
   of "does this film match" stays in `search`, that of a person in
   `people`, that of a thread in `threads`.

   Pure, offline, with no index: at a few thousand cards a sweep takes
   less than a frame, and an index would be one more structure to keep up
   to date on every keystroke.
   ============================================================ */
import { normalize, scoreFilm } from "./search";
import { allMotifs, motifById } from "./motifs";
import { threadMembers } from "./threads";
import { census } from "./people";
import type { Thread } from "./threads";
import type { Film, Note } from "../types";

/** The kinds of thing a binder holds. */
export type Kind = "film" | "page" | "motif" | "thread" | "person";

export interface Hit {
  kind: Kind;
  /** Stable identity, prefixed by the kind: two kinds can share an id. */
  key: string;
  title: string;
  /** The context, in one line: the year and the director, the number of films… */
  subtitle: string;
  /**
   * The passage where the word was found, when it comes from a long text.
   * That is what tells a useful search from a list of titles: you want to
   * see WHAT YOU HAD WRITTEN, not merely to know it was somewhere.
   */
  excerpt?: string;
  /** What the view needs in order to open the thing found. */
  filmId?: string;
  noteId?: string;
  motifId?: string;
  threadId?: string;
  /** A person's normalized key, as the credits file them. */
  person?: string;
  /** Smaller is more relevant. */
  rank: number;
}

export interface Corpus {
  films: Film[];
  notes: Note[];
  threads: Thread[];
}

/* How many characters either side of the word found. Enough for a
   sentence, not enough for a paragraph: the excerpt is there to help you
   recognise, not to re-read. */
const AROUND = 46;

/* Still tokens are not words — same reason as in `search`, and the same
   deliberate copy: the domain depends on no component. */
const STILL_TOKEN = /\[img:\d+\]/g;

/**
 * The passage around the first occurrence, with ellipses where we cut.
 *
 * We search on the NORMALIZED text but we cut into the ORIGINAL: the two
 * have the same length — `normalize` only strips diacritics, character by
 * character — and that is what lets us return the excerpt with its
 * accents and its capitals.
 */
export function excerptAround(text: string, q: string): string | undefined {
  const clean = (text || "").replace(STILL_TOKEN, " ");
  const t = normalize(q.trim());
  if (!t) return undefined;
  const i = normalize(clean).indexOf(t);
  if (i < 0) return undefined;

  const start = Math.max(0, i - AROUND);
  const end = Math.min(clean.length, i + t.length + AROUND);
  const piece = clean.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${piece}${end < clean.length ? "…" : ""}`;
}

/* The rank of a plain text: what STARTS with what you type goes ahead of
   what contains it in the middle. Same rule as for a film title, and for
   the same reason. */
const rankOf = (text: string, t: string, base: number): number | null => {
  const n = normalize(text);
  if (!n.includes(t)) return null;
  return n.startsWith(t) ? base - 0.5 : base;
};

/**
 * Everything that answers, the most relevant first.
 *
 * `perKind` bounds EACH kind separately and not the total: without that,
 * a collection of a thousand films would drown the one notebook page that
 * answers, and you would never know it existed. A cross-cutting search
 * that shows only one kind is not cross-cutting.
 */
export function searchEverywhere(q: string, { films, notes, threads }: Corpus, perKind = 5): Hit[] {
  const t = normalize(q.trim());
  if (t.length < 2) return [];

  const out: Hit[] = [];

  /* ---- the films ----
     `scoreFilm` remains the only judge: the wall's search and this one
     must find the same films, otherwise one of the two would be lying. */
  const byFilm: Hit[] = [];
  for (const f of films) {
    const rank = scoreFilm(f, q);
    if (rank == null) continue;
    byFilm.push({
      kind: "film",
      key: `film:${f.id}`,
      title: f.title,
      subtitle: [f.year || null, f.director || null].filter(Boolean).join(" · "),
      /* The excerpt only ever comes from YOUR words: a title that was
         found does not need copying out underneath itself. */
      excerpt: excerptAround(f.review || "", q) || excerptAround(f.notes || "", q),
      filmId: f.id,
      rank,
    });
  }
  out.push(
    ...byFilm
      .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, "fr"))
      .slice(0, perKind)
  );

  /* ---- the notebook pages ---- */
  const byPage: Hit[] = [];
  for (const n of notes) {
    const onTitle = rankOf(n.title || "", t, 0);
    const onBody = rankOf(n.body || "", t, 2);
    const rank = onTitle ?? onBody;
    if (rank == null) continue;
    byPage.push({
      kind: "page",
      key: `page:${n.id}`,
      title: n.title || "Sans titre",
      subtitle: new Date(n.createdAt).toLocaleDateString("fr-FR"),
      excerpt: excerptAround(n.body || "", q),
      noteId: n.id,
      rank,
    });
  }
  out.push(...byPage.sort((a, b) => a.rank - b.rank).slice(0, perKind));

  /* ---- the vocabulary's motifs ----
     We count the cards carrying it: a motif nobody carries is still
     found, but it presents itself for what it is. */
  const byMotif: Hit[] = [];
  for (const m of allMotifs()) {
    const rank = rankOf(m.label, t, 1);
    if (rank == null) continue;
    const n = films.filter((f) => (f.motifs || []).includes(m.id)).length;
    byMotif.push({
      kind: "motif",
      key: `motif:${m.id}`,
      title: m.label,
      /* "carry it" and not just "cards": the count describes the MOTIF,
         whereas opening the result launches a search on its label — which
         additionally brings back the cards that talk about it without
         carrying it. Two different numbers, and one of the two must say
         what it is talking about. */
      subtitle: n
        ? `${n} fiche${n > 1 ? "s" : ""} le porte${n > 1 ? "nt" : ""}`
        : "sur aucune fiche",
      motifId: m.id,
      rank,
    });
  }
  out.push(...byMotif.sort((a, b) => a.rank - b.rank).slice(0, perKind));

  /* ---- the threads ---- */
  const byThread: Hit[] = [];
  for (const thread of threads) {
    const onLabel = rankOf(thread.label || "", t, 1);
    const onNote = rankOf(thread.note || "", t, 3);
    const rank = onLabel ?? onNote;
    if (rank == null) continue;
    const n = threadMembers(thread, films).length;
    byThread.push({
      kind: "thread",
      key: `thread:${thread.id}`,
      title: thread.label,
      subtitle: [
        `${n} film${n > 1 ? "s" : ""}`,
        thread.motif ? motifById(thread.motif)?.label : null,
      ]
        .filter(Boolean)
        .join(" · "),
      excerpt: excerptAround(thread.note || "", q),
      threadId: thread.id,
      rank,
    });
  }
  out.push(...byThread.sort((a, b) => a.rank - b.rank).slice(0, perKind));

  /* ---- the people ----
     The credits already know how to take the census; we do not redefine
     what a person is, we put the question to them again. */
  const byPeople: Hit[] = [];
  for (const p of census(films)) {
    const rank = rankOf(p.name, t, 1);
    if (rank == null) continue;
    byPeople.push({
      kind: "person",
      key: `person:${p.key}`,
      title: p.name,
      subtitle: `${p.films.length} film${p.films.length > 1 ? "s" : ""} · ${p.roles.join(", ")}`,
      person: p.key,
      rank,
    });
  }
  out.push(
    ...byPeople
      .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, "fr"))
      .slice(0, perKind)
  );

  return out;
}

/** What was found, filed by kind — the shape the view displays. */
export const groupByKind = (hits: Hit[]): { kind: Kind; items: Hit[] }[] => {
  const order: Kind[] = ["film", "person", "motif", "thread", "page"];
  return order
    .map((kind) => ({ kind, items: hits.filter((t) => t.kind === kind) }))
    .filter((g) => g.items.length > 0);
};
