/* ============================================================
   SEARCHING FOR A FILM — one definition, for the whole app
   ============================================================

   The same "title OR director" predicate was copied into three views, and
   all three drifted apart without anyone noticing: the shelf dims, the
   wall filters, the card suggests. Three behaviours, fine — but three
   definitions of what "matching" MEANS, no: typing "1974" or an actor's
   name found nothing anywhere.

   Here the question "does this film answer?" has one answer, and one
   only. The views keep their own way of using it.

   No index: at a few thousand cards a sweep takes less than a frame, and
   an index would be one more structure to keep up to date on every write. */
import { motifById } from "./motifs";
import type { Film } from "../types";

/* Exported under its full name: the Credits view uses it for a person's
   IDENTITY — "decae" and "Decaë" are the same cinematographer, and the
   question "do these two names point at someone in common" has no more
   reason to have two answers than "does this film match". */
export const normalize = (s: string): string =>
  s
    .toLowerCase()
    /* Accents drop on both sides: you search for "amelie" and you find
       "Amélie", which is the behaviour expected of a search field even
       without knowing how to name it. */
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/* WHAT WE SEARCH ON, AND IN WHAT ORDER OF IMPORTANCE.

   Title and director first — that is what gets typed nine times out of
   ten. Then the year, the cast, your keywords and the motifs: those are
   side roads, but they cost nothing and they catch the times you only
   remember THAT. The rank is used for sorting.

   YOUR OWN WORDS COME LAST, AND THEY WERE MISSING.

   The guided tour had promised from the start "a title, a filmmaker, A
   WORD FROM YOUR NOTES" — and the review and the free notes were the only
   two fields we did not search. You could write three pages about a film
   and never find it again by what you had said about it.

   Dead last in the ranking, and deliberately so: someone typing
   "Kurosawa" wants the filmmaker, not the twelve cards where the name is
   mentioned in passing. But they want to find those when nothing else
   answers. */
const fields = (f: Film): { text: string; rank: number }[] => [
  { text: f.title || "", rank: 0 },
  { text: f.director || "", rank: 1 },
  { text: String(f.year || ""), rank: 2 },
  { text: (f.cast || []).join(" "), rank: 3 },
  { text: (f.themes || []).join(" "), rank: 4 },
  {
    text: (f.motifs || [])
      .map((id) => motifById(id)?.label || "")
      .filter(Boolean)
      .join(" "),
    rank: 4,
  },
  { text: withoutTokens(f.review), rank: 5 },
  { text: withoutTokens(f.notes), rank: 5 },
];

/* STILLS ARE NOT WORDS.

   A review carries its screenshots as `[img:3]`, inserted along the text.
   Letting them into the search would make every illustrated card answer
   to "img", which is not an answer.

   The token's shape is copied here rather than imported from
   `components/stills/tokens`: the domain depends on no component, and it
   is that rule which lets it be tested without React. If it changes over
   there, it must change here — these two lines are the price of
   independence. */
const STILL_TOKEN = /\[img:\d+\]/g;
const withoutTokens = (s: string | undefined): string => (s || "").replace(STILL_TOKEN, " ");

/** The rank of the best field hit, or `null` if nothing answers. */
export const scoreFilm = (f: Film, q: string): number | null => {
  const t = normalize(q.trim());
  if (!t) return 0;
  let best: number | null = null;
  for (const { text, rank } of fields(f)) {
    if (!text) continue;
    const n = normalize(text);
    if (!n.includes(t)) continue;
    /* A title that STARTS with what you type goes ahead of one that
       contains it in the middle: "Solaris" before "Le Solaris de minuit". */
    const r = n.startsWith(t) ? rank - 0.5 : rank;
    if (best == null || r < best) best = r;
  }
  return best;
};

export const matchFilm = (f: Film, q: string): boolean => scoreFilm(f, q) !== null;

/**
 * The films that answer, the most relevant first.
 *
 * `limit = 0` means "all of them": the wall filters its whole collection
 * and has no reason to be cut short like a list of suggestions.
 */
export const searchFilms = (films: Film[], q: string, limit = 12): Film[] => {
  const t = q.trim();
  if (!t) return limit > 0 ? films.slice(0, limit) : films;
  const scored: { f: Film; s: number }[] = [];
  for (const f of films) {
    const s = scoreFilm(f, t);
    if (s != null) scored.push({ f, s });
  }
  scored.sort((a, b) => a.s - b.s || a.f.title.localeCompare(b.f.title));
  const out = scored.map((n) => n.f);
  return limit > 0 ? out.slice(0, limit) : out;
};
