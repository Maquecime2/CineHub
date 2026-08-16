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
