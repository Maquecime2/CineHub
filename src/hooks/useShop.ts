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
   `owned` et `held`, et `refreshShop()` les reprend après chaque achat.
   ============================================================ */
import { useEffect, useState } from "react";
import { accountOpen, serverConfigured, shop, type ShopItem } from "../services/server";

let cache: ShopItem[] | null = null;
let inFlight: Promise<ShopItem[]> | null = null;

type Watcher = (items: ShopItem[]) => void;
const watchers = new Set<Watcher>();

const tell = (items: ShopItem[]) => {
  cache = items;
  for (const fn of watchers) fn(items);
};

export function loadShop(): Promise<ShopItem[]> {
  if (inFlight) return inFlight;
  if (!serverConfigured() || !accountOpen()) return Promise.resolve([]);

  inFlight = shop()
    .then((items) => {
      tell(items);
      return items;
    })
    /* Un comptoir qui se tait ne doit rien casser : les prix des peaux
       sont aussi écrits dans `theme/skins`, donc le sélecteur sait quand
       même quoi annoncer. */
    .catch(() => {
      tell([]);
      return [];
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Après un achat : ce qu'on possède a changé, les prix non. */
export const refreshShop = (): Promise<ShopItem[]> => {
  inFlight = null;
  return loadShop();
};

export const knownShop = (): ShopItem[] | null => cache;

export function useShop(active = true): ShopItem[] {
  const [items, setItems] = useState<ShopItem[]>(cache ?? []);

  useEffect(() => {
    if (!active || !serverConfigured() || !accountOpen()) return;
    watchers.add(setItems);
    if (cache === null) void loadShop();
    else setItems(cache);
    return () => {
      watchers.delete(setItems);
    };
  }, [active]);

  return items;
}
