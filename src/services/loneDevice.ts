/* ============================================================
   UN COMPTE QUI NE TIENT QU'À UN APPAREIL
   ============================================================

   Une passkey appartient à la CHOSE qui la détient. Celle que Windows
   Hello a fabriquée vit dans cet ordinateur et n'en sort pas : rien ne
   l'exporte, rien ne la transporte. Un compte ouvert sur une seule
   machine est donc enfermé dedans, et le jour où la machine disparaît,
   le compte avec.

   TOUT L'OUTILLAGE EXISTE DÉJÀ — le tiroir du compte liste les
   appareils, en ajoute par cérémonie QR, et délivre un code d'appairage
   à sept jours. Ce qui manquait est le COUP DE COUDE : la section ne se
   voit qu'en ouvrant le tiroir, c'est-à-dire précisément ce qu'on ne
   fait pas. Son propre commentaire le dit — « c'est la chose à laquelle
   personne ne pense avant le soir où il en a besoin ».

   ------------------------------------------------------------
   UN SEUL CHAMP, ET C'EST LA DIFFÉRENCE AVEC `installation`
   ------------------------------------------------------------

   La carte d'installation compte deux choses : les refus, et le fait
   d'être installé — parce qu'« installé » est un fait terminal que le
   compteur de refus ne sait pas dire.

   Ici le fait terminal est AILLEURS : c'est le nombre de clés du compte,
   que le serveur connaît. Poser un second appareil rend la question
   caduque sans que ce module ait à s'en souvenir. Il ne reste donc qu'à
   compter combien de fois on a insisté.

   C'est de l'état de NAVIGATEUR, comme l'accueil et l'installation : il
   ne part pas dans la sauvegarde, et vider les données du site repose la
   question — ce qui est exactement ce qu'on veut, puisque le compte,
   lui, sera toujours seul sur cet appareil.
   ============================================================ */
import { store } from "./storage";

const KEY = "lone-device";

/** Deux fois suffisent. Au-delà, insister n'informe plus, il agace. */
export const MAX_NUDGES = 2;

export interface LoneDeviceState {
  /** Combien de fois la carte a déjà été posée. */
  nudges: number;
}

const EMPTY: LoneDeviceState = { nudges: 0 };

export const readLoneDevice = (): LoneDeviceState => {
  const stored = store.get<Partial<LoneDeviceState>>(KEY, EMPTY);
  const nudges = stored?.nudges;
  return { nudges: typeof nudges === "number" && nudges >= 0 ? nudges : 0 };
};

/** Une insistance de plus — posée quand la carte s'affiche, pas quand on la referme. */
export const noteNudge = (): LoneDeviceState => {
  const next = { nudges: readLoneDevice().nudges + 1 };
  store.set(KEY, next);
  return next;
};

/** N'a-t-on pas déjà assez insisté ? */
export const mayNudge = (s: LoneDeviceState = readLoneDevice()): boolean => s.nudges < MAX_NUDGES;
