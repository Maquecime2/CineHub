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
  shop as readShop,
  myHoldings,
  type Profile,
  type NewsItem,
  type Challenge,
  type Quiz,
  type Category,
  type ShopItem,
  type Holdings,
} from "../services/server";
import { cachedResource } from "./cachedResource";

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

/** L'étal du comptoir et ce qu'on y possède déjà. */
export const stall = cachedResource<{ items: ShopItem[]; held: Holdings | null }>({
  read: async () => {
    const [items, held] = await Promise.all([readShop(), myHoldings()]);
    return { items, held };
  },
  onQuiet: { items: [], held: null },
  ready,
});
