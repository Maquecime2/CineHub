/* ============================================================
   CE QUE LE HALL DEMANDE EN ENTRANT
   ============================================================

   Le fil, les défis, les quizz et le comptoir posaient tous leurs
   questions au serveur À CHAQUE MONTAGE — et `App` démonte une vue dès
   qu'on change d'onglet. Aller au comptoir puis revenir au fil, c'était
   relire le fil ; y retourner, le relire encore. Quatre vues, deux
   requêtes chacune, et un limiteur qui compte cent requêtes par minute :
   quelques allers-retours suffisaient à se faire répondre « plus tard »
   sans avoir rien demandé d'excessif.

   Chacune tient donc sa réponse une minute, comme « mes listes » et la
   bourse tiennent la leur (`cachedResource`). Ce qui suit une ÉCRITURE
   ne passe pas par là : un défi qu'on vient de rejoindre se relit avec
   `refresh`, qui ne regarde pas la fenêtre. La règle est simple — on
   sert de mémoire à l'ENTRÉE, on redemande après un geste.
   ============================================================ */
import {
  accountOpen,
  serverConfigured,
  mySubscriptions,
  readFeed,
  myChallenges,
  myQuizzes,
  quizCategories,
  weeklyQuiz,
  shop as readShop,
  myHoldings,
  type Profile,
  type NewsItem,
  type Challenge,
  type Quiz,
  type QuizScore,
  type QuizAttempt,
  type Category,
  type ShopItem,
  type DecorDef,
  type Holdings,
} from "../services/server";
import { cachedResource } from "./cachedResource";
import { rememberWonDecor } from "../services/wonDecor";

const ready = () => serverConfigured() && accountOpen();

/** Le fil : qui l'on suit, et ce qu'ils ont vu. */
export const feed = cachedResource<{ subscriptions: Profile[]; news: NewsItem[] }>({
  read: async () => {
    const [a, f] = await Promise.all([mySubscriptions(), readFeed()]);
    return { subscriptions: a.subscriptions, news: f.news };
  },
  onQuiet: { subscriptions: [], news: [] },
  ready,
});

/** Les défis à période, avec leur progression. */
export const challenges = cachedResource<Challenge[]>({
  read: () => myChallenges().then((d) => d.challenges),
  onQuiet: [],
  ready,
});

/** Les soirées de quizz et les paniers de questions dont elles sortent. */
export const quizBank = cachedResource<{ quizzes: Quiz[]; categories: Category[] }>({
  read: async () => {
    const [q, c] = await Promise.all([myQuizzes(), quizCategories()]);
    return { quizzes: q.quizzes, categories: c.categories };
  },
  onQuiet: { quizzes: [], categories: [] },
  ready,
});

/**
 * Le quizz de la semaine, et son classement public.
 *
 * IL EST À PART DE `quizBank`, ET C'EST LE POINT. Les deux parlent de
 * quizz, mais pas du même objet : `quizBank` tient CE QU'ON A TIRÉ et
 * ce qu'on nous a donné — une liste qui bouge à chaque invitation —,
 * celui-ci tient un rendez-vous qui ne change qu'une fois par semaine.
 * Les fondre aurait fait relire le rendez-vous à chaque fois qu'une
 * soirée est créée, et l'inverse : un classement qui bouge à chaque
 * partie aurait périmé la liste des siennes.
 *
 * ET LA LECTURE EST CE QUI LE TIRE, ce qui rend le cache d'autant plus
 * utile : sans lui, chaque montage de la vue redemanderait au serveur
 * de vérifier la semaine.
 */
export const weekly = cachedResource<{
  quiz: Quiz | null;
  questions: number;
  /** Ce que le quizz entier vaut — le dénominateur des barres. */
  weight: number;
  /**
   * MON essai, ou `null` si je n'ai pas encore ouvert.
   *
   * IL VIENT DU SERVEUR ET NE SE DEVINE PAS DU TABLEAU. Chercher son
   * propre pseudonyme dans le classement aurait marché tant qu'on n'est
   * pas bloqué par quelqu'un, puis se serait trompé — et surtout, un
   * essai OUVERT sans une seule réponse ne pose encore aucune ligne
   * dedans, donc « reprendre » ne se serait jamais affiché.
   */
  attempt: QuizAttempt | null;
  board: QuizScore[];
}>({
  read: async () => {
    const r = await weeklyQuiz();
    return {
      quiz: r.quiz,
      questions: r.questions?.length ?? 0,
      weight: r.weight ?? 0,
      attempt: r.attempt ?? null,
      board: r.board ?? [],
    };
  },
  /* SILENCE VEUT DIRE « PAS DE RENDEZ-VOUS », et non « erreur ». La
     carte ne se dessine simplement pas — c'est le même choix que les
     quatre autres ressources de ce fichier. */
  onQuiet: { quiz: null, questions: 0, weight: 0, attempt: null, board: [] },
  ready,
});

/**
 * L'étal du comptoir, ce qu'on y possède, et le catalogue des objets.
 *
 * LE CATALOGUE VOYAGE AVEC L'ÉTAL et non sur une requête à part : le
 * présentoir dessine une pochette sur ce qu'elle contient, la collection
 * a besoin du même dictionnaire pour nommer ce qu'on possède, et
 * L'ÉTAGÈRE en a besoin pour dessiner ce qu'on y pose. Les séparer
 * aurait fait deux requêtes pour un seul écran.
 *
 * ET C'EST ICI QUE L'ÉTAGÈRE APPREND. `rememberWonDecor` verse le
 * catalogue et ce qu'on possède dans le registre que `decorSpec`
 * consulte à chaque objet rendu — synchrone, hors ligne, sans attendre.
 * Le faire dans la lecture plutôt que dans la vue est ce qui fait qu'un
 * objet gagné se pose sur le mur sans qu'on ait ouvert le comptoir.
 */
export const stall = cachedResource<{
  items: ShopItem[];
  decors: DecorDef[];
  held: Holdings | null;
}>({
  read: async () => {
    const [shop, held] = await Promise.all([readShop(), myHoldings()]);
    rememberWonDecor(shop.decors, held.decors);
    return { items: shop.items, decors: shop.decors, held };
  },
  onQuiet: { items: [], decors: [], held: null },
  ready,
});
