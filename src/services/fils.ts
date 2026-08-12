/* ============================================================
   LES FILS, SUR LE DISQUE
   ============================================================

   Une seule clé pour toute la liste, à la différence des vues d'étagère
   qui en prennent une par document : un fil pèse quelques dizaines
   d'octets — un nom, une couleur, des identifiants — et il n'y en aura
   jamais des centaines. Découper serait de la mécanique sans bénéfice.
   ============================================================ */
import { store } from "./storage";
import { normalizeThreads } from "../domain/threads";
import type { Thread } from "../domain/threads";

export const FILS_KEY = "fils";

export const loadFils = (): Thread[] => normalizeThreads(store.get(FILS_KEY, []));

export const saveFils = (fils: Thread[]): boolean => store.set(FILS_KEY, fils);
