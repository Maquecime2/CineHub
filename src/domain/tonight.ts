/* ============================================================
   WHICH ONE TONIGHT? — the one question the watchlist could not hear

   The "to watch" list only knows how to stack up. You file films into it
   for months, and when the evening comes you run your eye over it without
   being able to ask it the question you actually have: I have an hour
   forty, I am in a melancholy mood, which one?

   THIS IS NOT THE DISCOVERY DESK'S QUESTION. `reco` asks "what else is
   out there" and talks to TMDB to answer it. Here we are not looking for
   anything new: it is all here already, set aside by you, and it is only
   a matter of deciding. Hence a separate module, which borrows `taste`'s
   PROFILE but not `reco`'s score — that one is cut for a TMDB candidate,
   with its vote counts and its sources, of which a card from your list
   has none.

   Pure, networkless, stateless: a collection goes in, a ranking comes
   out. The guessed motifs arrive ready-chewed (see `TonightDrawer`), because
   going to fetch them is I/O and this module does none.
   ============================================================ */
import { buildTaste, decadeOf } from "../taste";
import { motifById } from "./motifs";
import type { Film } from "../types";

export interface Craving {
  /** Minutes available. `null`: "never mind". */
  minutes: number | null;
  /** Wanted motif ids — the tone family first. */
  mood: string[];
  /** Wanted ISO 639-1 codes. Empty: all of them. */
  languages: string[];
}

export interface Suggestion {
  film: Film;
  /** What pushed it up, in plain words. */
  reasons: string[];
  /** The card must say so: we do not pass an unknown off as a fact. */
  unknownRuntime: boolean;
  /** Minutes beyond the slot, if any. */
  overrun: number;
}

/* The slots as we say them. "Never mind" is not one of them: it is the
   absence of a constraint, and the interface expresses it by choosing
   none. */
export const SLOTS: { label: string; minutes: number }[] = [
  { label: "une heure", minutes: 60 },
  { label: "une heure et demie", minutes: 90 },
  { label: "deux heures", minutes: 120 },
  { label: "deux heures et demie", minutes: 150 },
];

/* BEYOND WHAT POINT AN OVERRUN IS NO LONGER ONE, BUT A REFUSAL.

   The slot is an envelope, not an equality: "I have two hours" happily
   accepts a hundred and eighteen minutes, and a hundred and twenty-five
   is not a mistake — it is a quarter of an hour late to bed. Three
   quarters of an hour too many, on the other hand, is no longer the same
   evening. */
const MARGIN = 45;

/* What an unknown runtime is worth. Below "it fits" (1), above a clear
   overrun: a card imported from Letterboxd without going through TMDB has
   no runtime, and ruling it out would amount to punishing incompleteness
   — that is, hiding half of a freshly imported collection. It comes after
   the sure answers, and says so. */
const NO_RUNTIME = 0.55;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/* A criterion that counts, and by how much. We assemble them and then
   take a WEIGHTED AVERAGE OF THE ACTIVE CRITERIA ONLY: without that,
   asking for nothing would crush every score towards zero and the ranking
   would no longer say anything. */
interface Criterion {
  weight: number;
  value: number;
}

const weightedAverage = (cs: Criterion[]): number => {
  const total = cs.reduce((s, c) => s + c.weight, 0);
  if (!total) return 0;
  return cs.reduce((s, c) => s + c.weight * c.value, 0) / total;
};

/** The motifs this film carries: its own, plus those guessed for it. */
const motifsOf = (f: Film, guessed?: Map<string, string[]>): Set<string> =>
  new Set([...(f.motifs || []), ...(guessed?.get(f.id) || [])]);

/* How long it has been on the list, brought between 0 and 1 over the
   watchlist's own span: the film filed three years ago is precisely the
   one we forgot, and a brand new list must not send this criterion into a
   spin for all that. */
const age = (f: Film, oldest: number, youngest: number): number => {
  if (youngest <= oldest) return 0.5;
  return clamp01(1 - (f.addedAt - oldest) / (youngest - oldest));
};

const years = (ms: number): number => Math.floor(ms / (365.25 * 24 * 3600 * 1000));

/**
 * The evening's ranking, from the most fitting to the least.
 *
 * `films` is the WHOLE collection and not the watchlist alone: the taste
 * profile is built on the films watched, and a list of intentions says
 * nothing about what you like.
 *
 * Deterministic, and deliberately so. "Another one" moves one notch down
 * this list rather than drawing lots: a ranking can be explained — "here
 * is the next one" — where randomness never can, and it can be tested.
 */
export function rankTheEvening(
  films: Film[],
  craving: Craving,
  guessedMotifs?: Map<string, string[]>
): Suggestion[] {
  const pool = films.filter((f) => f.status === "watchlist" && !f.archived);
  if (pool.length === 0) return [];

  const taste = buildTaste(films);
  const wantsMood = craving.mood.length > 0;
  const wantsLanguage = craving.languages.length > 0;

  /* Language is a chosen filter: asking for Japanese and getting Swedish
     would make no sense. But a card whose LANGUAGE is unknown stays
     eligible, for the reason that also holds for the runtime — we do not
     punish incompleteness. */
  const kept = wantsLanguage
    ? pool.filter((f) => !f.language || craving.languages.includes(f.language))
    : pool;
  if (kept.length === 0) return [];

  const dates = kept.map((f) => f.addedAt);
  const oldest = Math.min(...dates);
  const youngest = Math.max(...dates);
  const now = Date.now();

  const suggestions = kept.map((f) => {
    const criteria: Criterion[] = [];
    const reasons: string[] = [];

    /* ---- the time ---- */
    const runtime = f.runtime;
    const unknownRuntime = runtime == null || runtime <= 0;
    let overrun = 0;

    if (craving.minutes != null) {
      if (unknownRuntime) {
        criteria.push({ weight: 0.34, value: NO_RUNTIME });
      } else {
        overrun = Math.max(0, runtime! - craving.minutes);
        criteria.push({
          weight: 0.34,
          value: overrun === 0 ? 1 : clamp01(1 - overrun / MARGIN),
        });
        if (overrun === 0) reasons.push(`${runtime} min — ça tient`);
        else reasons.push(`${runtime} min, soit ${overrun} de trop`);
      }
    } else if (!unknownRuntime) {
      reasons.push(`${runtime} min`);
    }
    if (unknownRuntime) reasons.push("durée inconnue");

    /* ---- the mood ----
       The strongest criterion when it is set: it is the question we came
       to ask, the rest is only refinement. */
    if (wantsMood) {
      const its = motifsOf(f, guessedMotifs);
      const hit = craving.mood.filter((id) => its.has(id));
      criteria.push({ weight: 0.44, value: hit.length / craving.mood.length });
      for (const id of hit) {
        const m = motifById(id);
        if (m) reasons.push(m.label.toLowerCase());
      }
    }

    /* ---- what you like ----
       Only used to break ties: two films that fit the evening and carry
       the same mood cannot be told apart otherwise. With no profile
       (fewer than three films watched), we draw nothing from it rather
       than invent. */
    if (!taste.isEmpty) {
      const gs = (f.genres || []).map((g: string) => taste.genres.get(g) || 0);
      const genre = gs.length ? gs.reduce((a: number, b: number) => a + b, 0) / gs.length : 0;
      const dec = decadeOf(f.year);
      const decade = dec ? taste.decades.get(dec) || 0 : 0;
      const language = f.language ? taste.languages.get(f.language) || 0 : 0;
      criteria.push({
        weight: 0.14,
        value: clamp01((0.55 * genre + 0.25 * decade + 0.2 * language + 1) / 2),
      });

      /* The most telling reason is the genre you like best among THIS
         film's — "genre que vous aimez : drame" reads, "affinity 0.72"
         does not.

         A NOUN phrase and not "vous aimez le drame": the article depends
         on the genre — le drame, l'action, la science-fiction — and a
         sentence that has to guess an article always ends up getting one
         of them wrong. */
      const best = (f.genres || [])
        .map((g: string) => ({ g, w: taste.genres.get(g) || 0 }))
        .sort((a: { w: number }, b: { w: number }) => b.w - a.w)[0];
      if (best && best.w > 0.35) reasons.push(`genre que vous aimez : ${best.g.toLowerCase()}`);
    }

    /* ---- how long it has been waiting ---- */
    criteria.push({ weight: 0.08, value: age(f, oldest, youngest) });
    const waited = years(now - f.addedAt);
    if (waited >= 1) reasons.push(`en attente depuis ${waited} an${waited > 1 ? "s" : ""}`);

    return {
      film: f,
      reasons,
      unknownRuntime,
      overrun,
      score: weightedAverage(criteria),
    };
  });

  /* On an equal score, the one filed longest ago goes first: that is the
     one we had forgotten. The title only decides as a last resort, so
     that the order never depends on the collection's own. */
  suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      a.film.addedAt - b.film.addedAt ||
      a.film.title.localeCompare(b.film.title, "fr")
  );

  return suggestions.map(({ film, reasons, unknownRuntime, overrun }) => ({
    film,
    reasons,
    unknownRuntime,
    overrun,
  }));
}

/**
 * The languages actually present in the watchlist, the best furnished
 * first. Offering the standard's hundred and eighty languages when the
 * list holds three would be a form, not a choice.
 */
export const listLanguages = (films: Film[]): { code: string; n: number }[] => {
  const count = new Map<string, number>();
  for (const f of films)
    if (f.status === "watchlist" && !f.archived && f.language)
      count.set(f.language, (count.get(f.language) || 0) + 1);
  return [...count.entries()]
    .map(([code, n]) => ({ code, n }))
    .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
};
