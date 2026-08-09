/* ============================================================
   LE DÉPÔT — la seule porte par où la collection entre et sort
   ============================================================

   Jusqu'ici, deux lignes d'`App.jsx` lisaient et écrivaient les films
   directement dans le `localStorage`. Ça marchait, et ça ne pouvait pas
   continuer, pour trois raisons qui n'ont rien à voir entre elles.

   LE PLAFOND. Le `localStorage` s'arrête vers cinq mégaoctets pour
   TOUTE l'application, et il ne stocke que du texte. Une collection un
   peu fournie, avec ses critiques et ses journaux de séance, en occupe
   déjà une bonne part — au point que le magasin prévient l'utilisateur
   quand l'écriture échoue. IndexedDB range des objets tels quels et
   dispose de plusieurs gigaoctets ; les images y sont déjà.

   LA DATE. Une collection qui se synchronise a besoin de savoir QUELLES
   fiches ont bougé. Cette date ne peut pas être posée par les vingt
   endroits qui modifient un film : un seul oubli, et la fiche ne part
   jamais. Elle se pose ICI, au passage, sur les seules fiches dont la
   valeur a réellement changé (`horodater`).

   LA COUTURE. Le jour où un serveur existe, c'est ce module qui
   apprendra à pousser et à tirer — pas les vues. Elles demandent la
   collection et la rendent ; d'où elle vient ne les regarde pas.

   CE QUI RESTE VRAI : rien ne part nulle part. Le dépôt écrit sur cette
   machine et sur elle seule.
   ============================================================ */
import { getDoc, putDoc } from "../db";
import { migrate, horodater } from "../domain/film";
import { store } from "./storage";
import type { Film } from "../types";

/** La clé de la collection, dans l'un comme dans l'autre magasin. */
export const CLÉ = "films";

/* ON GARDE UNE COPIE DE TRAVAIL, et ce n'est pas une optimisation.
   `horodater` a besoin de l'état PRÉCÉDENT pour dire ce qui a changé ;
   relire IndexedDB à chaque écriture le donnerait aussi, mais au prix
   d'un aller-retour asynchrone avant chaque enregistrement, et sur un
   chemin où l'on écrit à chaque frappe. */
let dernière: Film[] = [];

/* Le mode privé de certains navigateurs refuse IndexedDB. On ne peut
   pas refuser l'application pour autant : on retombe alors sur le
   `localStorage`, avec son plafond — c'est moins bien, et c'est mieux
   que rien. La réponse est retenue, la question ne se pose qu'une fois. */
let coffre: boolean | null = null;

/* CE QUI NE RÉPOND PAS EN DEUX SECONDES NE RÉPONDRA PAS.

   Une base verrouillée par un autre onglet est déjà traitée à la source
   (`db.js` rejette au lieu d'attendre), mais l'écran d'ouverture est le
   seul endroit de l'application où une promesse en suspens ne se
   rattrape par rien : elle laisse le classeur fermé, sans message et
   sans recours. Ce délai est la ceinture qui va avec les bretelles. */
const DÉLAI_MS = 2000;

const avecDélai = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("coffre muet")), DÉLAI_MS)),
  ]);

const coffreDisponible = async (): Promise<boolean> => {
  if (coffre !== null) return coffre;
  try {
    await avecDélai(getDoc(CLÉ));
    coffre = true;
  } catch {
    coffre = false;
  }
  return coffre;
};

/**
 * Charge la collection, d'où qu'elle vienne.
 *
 * L'ORDRE COMPTE : IndexedDB d'abord, `localStorage` ensuite. Une
 * collection déjà descendue dans le coffre y est plus récente que la
 * copie laissée en haut, et lire la seconde ferait revivre des fiches
 * effacées la veille.
 */
export async function chargerFilms(): Promise<Film[]> {
  let brut: Partial<Film>[] | null = null;

  if (await coffreDisponible()) {
    try {
      const doc = await getDoc(CLÉ);
      if (Array.isArray(doc)) brut = doc as Partial<Film>[];
    } catch {
      /* Le coffre a répondu à l'ouverture puis refusé la lecture : on
         redescend d'un cran plutôt que de perdre la collection. */
      coffre = false;
    }
  }

  /* Rien dans le coffre : c'est soit une première ouverture, soit une
     collection qui n'a pas encore déménagé. Dans les deux cas, ce qui
     compte est en haut. */
  const déménage = brut === null;
  if (brut === null) brut = store.get<Partial<Film>[]>(CLÉ, []);

  const films = migrate(brut);
  dernière = films;

  /* Le déménagement a lieu au premier chargement qui le peut, et
     l'ancienne copie N'EST PAS effacée dans la foulée : tant qu'on n'a
     pas écrit une fois dans le coffre avec succès, elle est le seul
     exemplaire. C'est `enregistrerFilms` qui la retire, après. */
  if (déménage && films.length && (await coffreDisponible())) {
    await écrire(films);
  }

  return films;
}

/** L'écriture nue, sans horodatage : le déménagement s'en sert tel quel. */
async function écrire(films: Film[]): Promise<void> {
  if (await coffreDisponible()) {
    try {
      /* Une copie simple : IndexedDB clone la valeur, et un objet gelé
         ou porteur de fonctions le ferait échouer. `JSON` garantit une
         structure clonable, et la fiche n'est que des données. */
      await putDoc(CLÉ, JSON.parse(JSON.stringify(films)));
      /* Le coffre a pris : la copie du haut n'a plus de raison d'être,
         et elle occupe la place qui manquait. */
      localStorage.removeItem(CLÉ);
      return;
    } catch {
      coffre = false;
    }
  }
  store.set(CLÉ, films);
}

/**
 * Enregistre la collection et rend ce qui a été écrit.
 *
 * Le retour n'est pas une politesse : les fiches modifiées y portent
 * leur nouvelle date, et c'est CE tableau que l'application doit garder
 * en mémoire. Rendre celui qu'on a reçu ferait diverger l'écran du
 * disque dès la première écriture.
 */
export async function enregistrerFilms(films: Film[]): Promise<Film[]> {
  const datés = horodater(dernière, films);
  dernière = datés;
  await écrire(datés);
  return datés;
}

/** Pour les tests, et pour une restauration qui repart de zéro. */
export function oublierLeCache(films: Film[] = []): void {
  dernière = films;
  coffre = null;
}
