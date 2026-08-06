/* ============================================================
   LES FILS, SUR LE DISQUE
   ============================================================

   Une seule clé pour toute la liste, à la différence des vues d'étagère
   qui en prennent une par document : un fil pèse quelques dizaines
   d'octets — un nom, une couleur, des identifiants — et il n'y en aura
   jamais des centaines. Découper serait de la mécanique sans bénéfice.
   ============================================================ */
import { store } from "./storage";
import { normalizeFils } from "../domain/fils";
import type { Fil } from "../domain/fils";

export const FILS_KEY = "fils";

export const loadFils = (): Fil[] => normalizeFils(store.get(FILS_KEY, []));

export const saveFils = (fils: Fil[]): boolean => store.set(FILS_KEY, fils);
