/* ============================================================
   LE CATALOGUE, LU UNE FOIS POUR TOUT L'ÉCRAN
   ============================================================

   Même forme que « mes listes » et la bourse à côté, et pour la même
   raison — mais elle vaut encore plus ici : depuis qu'on achète LÀ OÙ
   NAÎT L'ENVIE, le catalogue est demandé par le sélecteur de peaux, par
   la barre de pouvoirs d'un quiz, par chaque carte de défi et par le
   comptoir. Chacun le demandant pour son compte, ouvrir une page en
   coûterait quatre.

   IL NE CHANGE QUE QUAND QUELQU'UN LE DÉCIDE. C'est une liste écrite en
   TypeScript côté serveur, pas une table : la garder en mémoire n'a
   aucun des inconvénients habituels d'un cache. Ce qui bouge, c'est
   `owned` et `held`, et `refreshShop()` les reprend après chaque achat
   — d'où une fenêtre de fraîcheur très longue, là où le fil ou les défis
   en prennent une d'une minute.
   ============================================================ */
import { accountOpen, serverConfigured, shop, type ShopItem } from "../services/server";
import { cachedResource, useCached } from "./cachedResource";

const catalogue = cachedResource<ShopItem[]>({
  read: shop,
  /* Un comptoir qui se tait ne doit rien casser : les prix des peaux
     sont aussi écrits dans `theme/skins`, donc le sélecteur sait quand
     même quoi annoncer. */
  onQuiet: [],
  ready: () => serverConfigured() && accountOpen(),
  freshFor: 60 * 60 * 1000,
});

export const loadShop = catalogue.load;

/** Après un achat : ce qu'on possède a changé, les prix non. */
export const refreshShop = catalogue.refresh;

export const knownShop = (): ShopItem[] | null => catalogue.known();

export const useShop = (active = true): ShopItem[] => useCached(catalogue, active) ?? [];
