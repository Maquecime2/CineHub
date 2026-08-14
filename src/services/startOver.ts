/* ============================================================
   TOUT EFFACER, VRAIMENT
   ============================================================

   LE CLASSEUR EST LOCAL D'ABORD, ET C'EST TOUT LE PIÈGE DE CE GESTE.

   La première version n'effaçait que le serveur, puis rechargeait — et
   les films étaient toujours là, forcément : ils n'ont jamais vécu
   là-bas. Le serveur est une COPIE, pas la source ; c'est écrit en tête
   du projet, et ce bouton l'avait oublié. Pire : la synchro suivante
   aurait repoussé la collection locale vers un serveur qu'on venait de
   vider, et le ménage se serait défait tout seul.

   Il faut donc effacer LES DEUX, et dans cet ordre :

     1. le serveur, tant qu'on a encore une session pour le lui demander ;
     2. le navigateur — `localStorage` ET IndexedDB, où vivent les
        affiches, les captures et les décors ;
     3. recharger, parce qu'un classeur dont on vient de retirer la
        mémoire sous les pieds n'a aucune raison de bien se tenir.

   ON EFFACE LE STOCKAGE ENTIER, ET PAS UNE LISTE DE CLÉS. Elles sont une
   vingtaine, écrites dans huit modules, et deux d'entre elles ont déjà
   changé de nom. Une liste tenue à la main aurait laissé derrière elle
   exactement ce qu'on croyait avoir effacé — et « il me reste des
   films » est le genre de bug qu'on ne découvre qu'en le vivant. Tout ce
   qui est sous cette origine appartient au classeur : il n'y a rien à
   trier.
   ============================================================ */

import { markStartedOver } from "./onboarding";

/** Ce qui n'a pas pu être effacé, pour le dire plutôt que de le taire. */
export interface WhatSurvived {
  local: boolean;
  images: boolean;
  server?: boolean;
}

/** Le coffre à images. Le nom est celui de `db.js`, et il n'y en a qu'un. */
const IMAGE_DB = "cine-hub";

/**
 * Efface la mémoire du navigateur.
 *
 * Séparé de l'appel au serveur pour une raison pratique : c'est la
 * moitié qu'on veut aussi pouvoir jouer sans compte, le jour où le
 * classeur offrira de repartir de zéro à quelqu'un qui n'en a pas.
 */
export async function forgetLocally(): Promise<WhatSurvived> {
  const survived: WhatSurvived = { local: false, images: false };

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* Navigation privée, réglage restrictif, page dans un cadre : on ne
       peut rien y faire, et le dire vaut mieux que de l'ignorer. */
    survived.local = true;
  }

  /* LA BASE SE SUPPRIME, ELLE NE SE VIDE PAS. Parcourir les deux
     magasins pour en retirer les clés une à une laisserait la base et
     sa version ; la détruire remet aussi le schéma à neuf, ce qui est le
     sens du mot « zéro ».

     `deleteDatabase` ATTEND que toutes les connexions se ferment, et
     `db.js` en garde une ouverte pour la durée de la page. D'où le
     délai : sans lui, la promesse ne se résout jamais si un autre onglet
     tient la base, et le bouton reste à tourner sans rien dire. Le
     rechargement qui suit ferme la connexion de toute façon. */
  try {
    await new Promise<void>((resolve, reject) => {
      const ask = indexedDB.deleteDatabase(IMAGE_DB);
      const done = setTimeout(resolve, 1500);
      ask.onsuccess = () => {
        clearTimeout(done);
        resolve();
      };
      ask.onerror = () => {
        clearTimeout(done);
        reject(ask.error);
      };
      /* Bloquée par un autre onglet : on ne fait pas attendre pour rien. */
      ask.onblocked = () => {
        clearTimeout(done);
        survived.images = true;
        resolve();
      };
    });
  } catch {
    survived.images = true;
  }

  /* ET ON REPOSE LA MARQUE « DÉJÀ OUVERT », tout de suite après.

     Le stockage entier vient de partir, cette marque comprise — donc
     sans cette ligne le classeur se croit neuf : il sème douze fiches de
     démonstration dans ce qu'on vient de vider, et la synchro les pousse
     sur le serveur qu'on vient de vider aussi. On efface tout, et on se
     retrouve avec des films.

     Elle est ici et pas dans l'écran qui appelle, parce que c'est une
     conséquence de l'effacement et non une décision de l'écran : la
     prochaine chose qui appellera `forgetLocally` aura le même besoin
     sans avoir à y penser. */
  markStartedOver();

  return survived;
}

/**
 * Tout effacer : le serveur d'abord, le navigateur ensuite.
 *
 * Le serveur en premier PARCE QU'IL FAUT UNE SESSION POUR LUI PARLER, et
 * que la session vit dans un cookie que `localStorage.clear()` ne touche
 * pas — mais le pseudonyme retenu, lui, disparaît, et avec lui la
 * certitude de savoir à qui l'on s'adressait. On demande donc pendant
 * qu'on sait encore.
 *
 * Un serveur qui refuse n'empêche PAS d'effacer le navigateur : c'est ce
 * qu'on a sous la main, c'est ce qui est visible, et le laisser en place
 * parce que le réseau est tombé serait le pire des deux résultats.
 */
export async function startOver(onServer?: () => Promise<unknown>): Promise<WhatSurvived> {
  let serverKept = false;
  if (onServer) {
    try {
      await onServer();
    } catch {
      serverKept = true;
    }
  }
  const survived = await forgetLocally();
  return { ...survived, server: serverKept };
}
