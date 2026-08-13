/* ============================================================
/* ============================================================
   THE TMDB KEY — one place where it is read, one where it is written

   It was only ever set in the Import tab, and EIGHT screens read it: the
   Discoveries, the evening drawer, the Credits, the card, the poster
   picker, a film's identity, the TMDB facts, the completion. Each did
   its own `store.get("tmdb-key", "")` in its corner, on mount, once — so
   that setting the key in Import woke nothing up: you had to reload the
   page for the other views to notice, and nobody guessed that.

   Worse, the one with no key kept quiet. An empty view does not say "a
   setting is missing", it says "there is nothing" — and the only thing
   left to do is close the tab.

   So this module holds the key in ONE place, tells everybody when it
   changes, and gives each view what it needs to say its lack out loud
   (see `NoKey`).
   ============================================================ */
import { useSyncExternalStore } from "react";
import { KEYS, store } from "./storage";
import { accountOpen, watchAccount } from "./server";

/* The value lives in memory as much as on disk: `useSyncExternalStore`
   wants a STABLE snapshot, and re-reading localStorage on every call
   would return a fresh string on every render — hence a loop. */
let current: string = store.get<string>(KEYS.tmdbKey, "");

type Listener = () => void;
const listeners = new Set<Listener>();

const subscribe = (fn: Listener): (() => void) => {
  listeners.add(fn);
  /* We ALSO listen for an account opening and closing: since the server
     relays TMDB, signing in is enough to give something to query it
     with, and the eight screens must notice without reloading — exactly
     as they notice a key being set. */
  const forget = watchAccount(fn);
  return () => {
    listeners.delete(fn);
    forget();
  };
};

/* ============================================================
/* ============================================================
   AN ACCOUNT IS WORTH A KEY
   ============================================================

   The server relays eleven TMDB paths, keeps ITS key, and only accepts
   people who are signed in. Somebody signed in therefore needs no key at
   all: the Discoveries, the wake, the posters and the completion work
   without having to ask anyone for anything.

   Rather than teaching eight screens that there are now two ways of
   being allowed to query TMDB, we answer the only question they ask —
   "what do I call with?" — and return a token that says "via the
   server". `src/tmdb.js` recognises it and sends nothing more; nobody
   else needs to know about it.

   It is NOT a secret and must never be displayed: the two screens that
   show or change the written key (the settings drawer, the Import tab)
   go through `writtenKey`. */
export const VIA_SERVER = "via-server";

/** The key actually typed in — to display it and to correct it. */
export const writtenKey = (): string => current;

/**
/**
 * What it takes to query TMDB, outside a component: the key that was
 * set, or the relay's token when an account is open. Empty if we have
 * neither.
 */
export const getTmdbKey = (): string =>
  current.trim() ? current : accountOpen() ? VIA_SERVER : "";

/**
/**
 * Sets (or clears) the key. Writes to disk AND wakes the open screens:
 * that is the whole point of the module.
 */
export function setTmdbKey(key: string): void {
  const next = (key || "").trim();
  if (next === current) return;
  current = next;
  store.set(KEYS.tmdbKey, next);
  for (const fn of listeners) fn();
}

/**
/**
 * What it takes to query TMDB, inside a component. Re-renders when the
 * key changes — the settings drawer, the Import tab, another view — and
 * when an account opens or closes.
 */
export function useTmdbKey(): string {
  return useSyncExternalStore(subscribe, getTmdbKey, getTmdbKey);
}

/* ------------------------------------------------------------
/* ------------------------------------------------------------
   OPENING THE SETTING, FROM ANYWHERE

   Eight screens must be able to say "set it here" and have it work.
   Passing an `onOpenSettings` down from `App` would cross components
   that have nothing to do with TMDB — the card, the cardstock, the film
   strip — just to carry a callback.

   So the drawer registers itself, and the cartouche calls it. One
   registration at a time: it is a drawer, not a subscription.
   ------------------------------------------------------------ */
let opener: (() => void) | null = null;

/** Mounted by `App` along with the settings drawer; returns an unregister. */
export function registerTmdbOpener(fn: () => void): () => void {
  opener = fn;
  return () => {
    if (opener === fn) opener = null;
  };
}

/** Opens the key's settings drawer, if anybody knows how. */
export const openTmdbSettings = (): void => opener?.();
