/* ============================================================
   IN WHAT ORDER A LIST OF PROPOSALS COMES
   ============================================================

   Four screens show films the binder does not hold — the picker's two
   halves, the Credits' "what is missing", and any other that follows —
   and each had invented its own order: one by year, one by whatever
   TMDB felt like, one not at all. Three orders for one question.

   THE MEASURE IS HOW MANY PEOPLE RATED IT, because TMDB knows of no
   other. There is no viewing count anywhere in its API: `vote_count` is
   the nearest honest thing, and it says roughly what one wants it to
   say — a film a hundred thousand people bothered to rate has been seen,
   one that six people rated has not. It is NOT `popularity`, which is a
   trending score recomputed daily: a list ordered by it changes between
   two searches of the same name, for reasons nobody can see.

   AND THE DATE WHEN THAT MEASURE IS NOT THERE. Some routes give no
   audience at all; falling back on the year keeps a filmography readable
   — most recent first, since that is the end one starts from — rather
   than leaving it in whatever order the JSON arrived in.

   THE FALLBACK IS DECIDED FOR THE WHOLE LIST, not entry by entry. A list
   where three films carry an audience and forty do not would otherwise
   put those three on top and shuffle the rest into a second, invisible
   ordering. Either we have the measure and we use it, or we do not and
   we use the date. */

export interface Proposal {
  year?: number | string | null;
  /** How many people rated it. Absent on routes that do not say. */
  voteCount?: number | null;
}

const yearOf = (p: Proposal): number => Number(p.year) || 0;
const reachOf = (p: Proposal): number => (typeof p.voteCount === "number" ? p.voteCount : 0);

/**
 * The proposals, most seen first — or most recent, when nobody said.
 *
 * A NEW ARRAY, ALWAYS, and the caller's is never touched: these lists
 * come straight out of a cache that other screens are reading at the
 * same time.
 */
export const byAudience = <T extends Proposal>(hits: readonly T[]): T[] => {
  const measured = hits.some((h) => reachOf(h) > 0);
  return [...hits].sort((a, b) =>
    measured
      ? /* À audience égale — deux films que personne n'a notés, ou le
           même chiffre — la date tranche, plutôt qu'un ordre qui dépend
           de la façon dont le moteur de tri a réparti les ex æquo. */
        reachOf(b) - reachOf(a) || yearOf(b) - yearOf(a)
      : yearOf(b) - yearOf(a)
  );
};
