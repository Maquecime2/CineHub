/* ============================================================
   THE RATE — what each thing is worth, in one table
   ============================================================

   TWO COUNTERS, AND A GAIN FEEDS BOTH. Merit is cumulative and never
   spent: it makes the ranking. Tokens are the same figure, minus what
   has gone at the counter. Buying something must never cost a place in
   the leaderboard, or the shop becomes a punishment.

   THE CLIENT NEVER SENDS A FIGURE. No route below takes an amount as
   input; the amount is read here, from the fact the server has just
   written down itself. The binder has a copy of this table
   (`src/domain/points.ts`) for one purpose only — telling somebody what
   a challenge is worth BEFORE they finish it — and that copy credits
   nothing.

   ------------------------------------------------------------
   WHAT KEEPS THIS HONEST
   ------------------------------------------------------------

   The awkward part is that a card is DECLARED by the client. Somebody
   can write down a hundred screenings they never had, and the server
   cannot tell. Three guards, in this order, and the order is the
   argument:

   1. THE VERIFIABLE CARRIES THE WEIGHT. Quizzes, challenges and
      contributions are facts the SERVER holds — an answer against
      `quiz_choice.is_right`, a row in `list_item`, a participation.
      None of them can be fabricated without going through the
      constraints. They are four fifths of what one can earn.

   2. THE SHAPE OF `ref` CAPS THINGS FOR LIFE. `tmdb_id:date` makes one
      screening unpayable twice; `tmdb_id` alone makes a rating payable
      once per film, ever. A library of six hundred films is worth what
      it is worth ONCE, not at every synchronisation — which is what a
      naive counter would have done, and it would have made the ranking
      a measure of how often one opens the application.

   3. A DAILY CEILING ON WHAT IS MERELY DECLARED. Forty. It is applied
      inside the insert itself (see `store.award`), not around it, so
      there is no window between reading the day's total and writing to
      it.

   None of the three pretends to make cheating impossible. Together they
   make it tedious and unrewarding, which is the realistic aim for a
   binder whose whole point is that its data belongs to its owner.
   ============================================================ */

/** Everything that can be earned. The strings are stored, so they are API. */
export type Kind =
  | "challenge"
  | "challenge_half"
  | "challenge_joined"
  | "quiz"
  | "quiz_doubled"
  | "quiz_flawless"
  | "quiz_first"
  | "watch"
  | "review"
  | "rating"
  | "list_shared"
  | "bank_question";

/** What a kind pays. `quiz` is nil here: it pays the score itself. */
export const RATE: Record<Kind, number> = {
  challenge: 30,
  challenge_half: 10,
  challenge_joined: 4,
  quiz: 0,
  /* LA SEULE LIGNE DU BARÈME QUI NE PAIE PAS DE MÉRITE.

     Elle vaut le score, comme `quiz` — d'où le zéro ici — mais elle
     s'écrit avec `merit = 0` (voir `awardTokens`). Le raisonnement est à
     l'envers de celui du haut de ce fichier, et volontairement : là-haut
     on refuse qu'acheter coûte une place au classement ; ici on refuse
     qu'acheter en gagne une. Le mérite mesure ce qu'on a fait ; les
     jetons ne sont qu'une monnaie de boutique, et les doubler ne fausse
     aucune mesure. */
  quiz_doubled: 0,
  quiz_flawless: 15,
  quiz_first: 5,
  watch: 1,
  review: 3,
  rating: 1,
  list_shared: 5,
  bank_question: 6,
};

/* WHAT ONE ONLY SAYS ONE DID. These three read a card, which the client
   writes: they are the ones the ceiling applies to, and the list is kept
   here rather than in the query so that adding a fourth declarative
   source cannot forget to be capped. */
export const DECLARED: readonly Kind[] = ["watch", "review", "rating"] as const;

/** How much of the declarative sort one may earn in a single day. */
export const DECLARED_CEILING = 40;

/** Below this, a review is a note to oneself and not a piece of writing. */
export const REVIEW_LENGTH = 140;

/** Half of a challenge's works, seen in time, is worth saying. */
export const CHALLENGE_HALF = 0.5;
