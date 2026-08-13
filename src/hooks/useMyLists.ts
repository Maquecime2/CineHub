/* ============================================================
   MES LISTES, LUES UNE FOIS POUR TOUT L'ÉCRAN
   ============================================================

   The badge for filing a film now sits on every poster. Asking the
   server for the lists once per poster would mean forty identical
   requests to draw one wall — and forty chances for the rate limiter to
   answer "later" to somebody who has done nothing wrong.

   So the answer is held HERE, outside React, and every badge reads the
   same one. The first to ask fetches; the others wait on that same
   promise. A list created from any badge refreshes them all, because
   they all read the same store.

   IT IS A CACHE, THEREFORE IT IS WRONG SOMETIMES: a list made on another
   device appears at the next `refreshLists()`, not the instant it is
   born. That is the price, and it is small — the alternative was a wall
   that hammers.
   ============================================================ */
import { useEffect, useState } from "react";
import { myLists, serverConfigured, type List } from "../services/server";

let cache: List[] | null = null;
let inFlight: Promise<List[]> | null = null;

type Watcher = (l: List[] | null) => void;
const watchers = new Set<Watcher>();

const tell = (l: List[] | null) => {
  cache = l;
  for (const fn of watchers) fn(l);
};

/** Asks the server, unless somebody already is. */
export function loadLists(): Promise<List[]> {
  if (inFlight) return inFlight;
  inFlight = myLists()
    .then((r) => {
      tell(r.lists);
      return r.lists;
    })
    /* A SERVER FAILURE MUST NOT MAKE THE WALL SPEAK. The badge simply
       does not appear; the binder carries on. */
    .catch(() => {
      tell(null);
      return [];
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** After creating a list, so every badge sees it. */
export const refreshLists = (): Promise<List[]> => {
  inFlight = null;
  return loadLists();
};

/** What we already know, with no round trip — for a first render. */
export const knownLists = (): List[] | null => cache;

export function useMyLists(active = true): List[] | null {
  const [lists, setLists] = useState<List[] | null>(cache);

  useEffect(() => {
    if (!active || !serverConfigured()) return;
    watchers.add(setLists);
    /* Already read: we do not ask again on every mount — that is the
       whole point of holding it outside the component. */
    if (cache === null) void loadLists();
    else setLists(cache);
    return () => {
      watchers.delete(setLists);
    };
  }, [active]);

  return lists;
}
