/* ============================================================
   THREADS, ON DISK
   ============================================================

   One single key for the whole list, unlike the shelf views which take
   one per document: a thread weighs a few dozen bytes — a name, a
   colour, some identifiers — and there will never be hundreds of them.
   Splitting them up would be mechanics with no benefit.

   THE KEY'S VALUE STAYS `"fils"`. It is what every binder already
   written uses; renaming it would look, from the outside, exactly like
   an empty list.
   ============================================================ */
import { store } from "./storage";
import { normalizeThreads } from "../domain/threads";
import type { Thread } from "../domain/threads";

export const THREADS_KEY = "fils";

export const loadThreads = (): Thread[] => normalizeThreads(store.get(THREADS_KEY, []));

export const saveThreads = (threads: Thread[]): boolean => store.set(THREADS_KEY, threads);
