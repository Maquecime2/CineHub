/* ============================================================
   MES LISTES, LUES UNE FOIS POUR TOUT L'ÉCRAN
   ============================================================

   The badge for filing a film now sits on every poster. Asking the
   server for the lists once per poster would mean forty identical
   requests to draw one wall — and forty chances for the rate limiter to
   answer "later" to somebody who has done nothing wrong.

   So the answer is held OUTSIDE React, and every badge reads the same
   one. The first to ask fetches; the others wait on that same promise. A
   list created from any badge refreshes them all, because they all read
   the same store.

   Le mécanisme lui-même est dans `cachedResource` : il était écrit ici,
   puis recopié pour la bourse, puis pour le catalogue.

   `null` VEUT DIRE « PAS DE LISTES DU TOUT », et c'est ce qu'on retient
   quand le serveur se tait : le badge ne paraît alors pas, au lieu de
   proposer un classeur vide qui refusera tout.
   ============================================================ */
import { myLists, serverConfigured, type List } from "../services/server";
import { cachedResource, useCached } from "./cachedResource";

const lists = cachedResource<List[] | null>({
  read: () => myLists().then((r) => r.lists),
  onQuiet: null,
  ready: serverConfigured,
});

/** Asks the server, unless somebody already is — or unless it is fresh. */
export const loadLists = lists.load;

/** After creating a list, so every badge sees it. */
export const refreshLists = lists.refresh;

/** What we already know, with no round trip — for a first render. */
export const knownLists = (): List[] | null => lists.known();

export const useMyLists = (active = true): List[] | null => useCached(lists, active);
