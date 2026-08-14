/* ============================================================
   LA BOURSE, LUE UNE FOIS POUR TOUT L'ÉCRAN
   ============================================================

   Le même problème que « mes listes » à côté, et la même réponse. Le
   compteur du guichet, l'étal de la boutique et le bouton qui nomme ce
   qui manque posent tous la même question — combien ai-je — et chacun
   la posant pour son compte, ouvrir le comptoir coûterait trois requêtes
   identiques, avec trois occasions pour le limiteur de répondre « plus
   tard » à quelqu'un qui n'a rien fait de mal.

   IL Y A DONC UN SEUL CHIFFRE, HORS DE REACT, et tout le monde le lit.
   C'est aussi ce qui fait qu'un achat met à jour le compteur du haut
   sans que personne n'ait à se le passer de composant en composant : la
   boutique appelle `refreshPurse`, et le guichet l'apprend.

   ET LES PEAUX ACHETÉES VIVENT AVEC. `theme/owned` les garde en mémoire
   locale pour que le sélecteur de peaux sache quoi montrer sans
   attendre le réseau ; c'est ici qu'on les lui repasse, parce que c'est
   ici qu'on parle au serveur. Sans compte, personne n'appelle rien et
   le classeur garde ses quatorze peaux.
   ============================================================ */
import { accountOpen, myHoldings, myPurse, serverConfigured, type Purse } from "../services/server";
import { rememberOwned } from "../theme/owned";
import { cachedResource, useCached } from "./cachedResource";

const purse = cachedResource<Purse | null>({
  read: async () => {
    const p = await myPurse();
    /* Ce qu'on possède part en mémoire locale au passage : c'est ce qui
       permet au sélecteur de peaux de se dessiner juste, dès le premier
       rendu et même hors ligne ensuite. */
    try {
      const held = await myHoldings();
      rememberOwned(held.items, held.worn.skin);
    } catch {
      /* Le compteur vaut d'être affiché même si la boutique se tait. */
    }
    return p;
  },
  onQuiet: null,
  ready: () => serverConfigured() && accountOpen(),
});

/** Demande au serveur, sauf si quelqu'un le fait déjà — ou si c'est frais. */
export const loadPurse = purse.load;

/** Après un achat, une fin de quiz, un défi soldé. */
export const refreshPurse = purse.refresh;

/** Ce qu'on sait déjà, sans aller-retour — pour un premier rendu. */
export const knownPurse = (): Purse | null => purse.known();

export const usePurse = (active = true): Purse | null => useCached(purse, active);
