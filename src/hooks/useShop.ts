/* ============================================================
   LE CATALOGUE, LU UNE FOIS POUR TOUT L'ÉCRAN
   ============================================================

   Même forme que « mes listes » et la bourse à côté, et pour la même
   raison — mais elle vaut encore plus ici : depuis qu'on achète LÀ OÙ
   NAÎT L'ENVIE, le catalogue est demandé par le sélecteur de peaux, par
   la barre de pouvoirs d'un quiz, par chaque carte de défi et par le
   comptoir. Chacun le demandant pour son compte, ouvrir une page en
   coûterait quatre.

   IL NE CHANGE QUE QUAND QUELQU'UN LE DÉCIDE — mais « quelqu'un » n'est
   plus seulement un déploiement. Le gros du catalogue est écrit en
   TypeScript côté serveur ; les POCHETTES, elles, vivent en base et se
   créent depuis le studio. La fenêtre de fraîcheur descend donc d'une
   heure à dix minutes : c'est l'écart entre « une pochette ajoutée
   apparaît au prochain rechargement » et « elle apparaît tout à
   l'heure ». Ce qui bouge vite — `owned`, `held` — continue de passer
   par `refreshShop()` après chaque achat, et le studio l'appelle en se
   fermant.

   CE CROCHET NE REND QUE LES ARTICLES. Le dictionnaire des vignettes
   voyage avec la réponse, mais il n'intéresse que le comptoir, qui lit
   `stall` : le donner ici obligerait le sélecteur de peaux et la barre
   de pouvoirs à porter une liste dont ils n'ont que faire.
   ============================================================ */
import { accountOpen, serverConfigured, shop, type ShopItem } from "../services/server";
import { cachedResource, useCached } from "./cachedResource";

const catalogue = cachedResource<ShopItem[]>({
  read: () => shop().then((r) => r.items),
  /* Un comptoir qui se tait ne doit rien casser : les prix des peaux
     sont aussi écrits dans `theme/skins`, donc le sélecteur sait quand
     même quoi annoncer. */
  onQuiet: [],
  ready: () => serverConfigured() && accountOpen(),
  freshFor: 10 * 60 * 1000,
});

export const loadShop = catalogue.load;

/** Après un achat : ce qu'on possède a changé, les prix non. */
export const refreshShop = catalogue.refresh;

export const knownShop = (): ShopItem[] | null => catalogue.known();

export const useShop = (active = true): ShopItem[] => useCached(catalogue, active) ?? [];
