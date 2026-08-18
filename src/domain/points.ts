/* ============================================================
   CE QUE VALENT LES CHOSES — la copie du barème, côté classeur
   ============================================================

   ELLE NE CRÉDITE RIEN. Le serveur tient le journal, lui seul écrit, et
   aucune route ne prend un montant en entrée. Cette table existe pour
   une seule chose : pouvoir dire « ce défi vaut trente » AVANT de
   l'avoir fini, et « il vous manque douze jetons » devant un article
   trop cher. Afficher, jamais compter.

   ELLE EST DONC UN DOUBLON, ET C'EST ASSUMÉ. L'alternative — demander au
   serveur ce que vaut chaque chose — aurait mis un aller-retour réseau
   entre l'ouverture d'un écran et le premier chiffre lisible, pour une
   table de onze lignes qui change une fois par an. Le prix du doublon
   est qu'il peut diverger ; ce qui le rend supportable est que la
   divergence ne fausse qu'un affichage, jamais un solde.

   `server/src/points.ts` est l'original. Toute modification là-bas se
   recopie ici — et la table est courte exprès pour que ce soit vrai.
   ============================================================ */

/** Tout ce qui peut se gagner. Les mots sont stockés en base : ce sont des clés. */
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

/** Ce que paie chaque genre. `quiz` vaut son score, d'où le zéro. */
export const RATE: Record<Kind, number> = {
  challenge: 30,
  challenge_half: 10,
  challenge_joined: 4,
  quiz: 0,
  /* La double mise vaut le score, comme `quiz` — et elle ne paie que des
     JETONS, jamais de mérite. Voir l'original côté serveur : un
     classement dont on peut acheter les points ne mesure plus rien. */
  quiz_doubled: 0,
  quiz_flawless: 15,
  quiz_first: 5,
  watch: 1,
  review: 3,
  rating: 1,
  list_shared: 5,
  bank_question: 6,
};

/** Une part de défi en dessous de laquelle rien n'est payé. */
export const CHALLENGE_HALF = 0.5;

/** Une ligne du décompte de fin de partie : ce qui a payé, et combien. */
export interface Gain {
  kind: Kind;
  amount: number;
}

/**
 * Ce qu'un défi rapporterait, à la part où l'on en est.
 *
 * Sert à l'annoncer sur l'affiche pendant qu'il court — « il vous reste
 * deux films avant les trente points » vaut mieux qu'un chiffre qui
 * tombe à la fin sans prévenir.
 */
export function worthOfChallenge(done: number, works: number): number {
  if (works <= 0) return 0;
  const share = done / works;
  if (share >= 1) return RATE.challenge;
  if (share >= CHALLENGE_HALF) return RATE.challenge_half;
  return 0;
}

/**
 * Ce qui manque pour s'offrir quelque chose — jamais un nombre négatif.
 *
 * Zéro veut dire « c'est à votre portée », et c'est ce qui décide si le
 * bouton achète ou s'il NOMME le manque. Retirer l'article de l'étal
 * aurait été l'autre solution ; celle-ci suit ce que fait déjà le
 * cartouche de la clef TMDB, qui dit ce qui manque plutôt que de vider
 * l'écran.
 */
export function priceGap(price: number, tokens: number): number {
  return Math.max(0, price - tokens);
}

/** Les quatre paliers de fin de partie, du meilleur au pire. */
export type Tier = "perfect" | "held" | "half" | "missed";

/**
 * Ce que la fin d'une partie de quizz mérite comme MOT.
 *
 * IL VIENT DU BARÈME ET NON D'UN AVIS, et les deux seuils existaient
 * déjà : `quiz_flawless` ne se paie qu'à `score === weight`, et
 * `CHALLENGE_HALF` est la part en dessous de laquelle un défi ne paie
 * rien. Choisir 70 % et 40 % « parce que ça sonne bien » aurait inventé
 * une échelle de plus, que rien dans le produit ne confirme — et le
 * jour où l'un des deux seuils bougerait, l'écran de fin aurait
 * continué de féliciter sur l'ancien.
 *
 * `weight === 0` — un quizz sans une seule question tirée — rend
 * `half` : il n'y a rien à diviser, et féliciter comme punir seraient
 * tous deux faux.
 */
export function tierOf(score: number, weight: number): Tier {
  if (weight <= 0) return "half";
  if (score >= weight) return "perfect";
  const share = score / weight;
  if (share >= CHALLENGE_HALF) return "held";
  if (share > 0) return "half";
  return "missed";
}

/** Le total d'une liste de gains — ce que le fronton fait défiler. */
export const totalOf = (gains: readonly Gain[]): number => gains.reduce((n, g) => n + g.amount, 0);
