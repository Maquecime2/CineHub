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

/* ============================================================
   LES PIERRES TOMBALES
   ============================================================

   Effacer une fiche la retire du tableau, et c'est tout : il ne reste
   RIEN qui dise qu'elle a existé. Tant qu'un classeur est seul, cela
   suffit. Dès qu'il y en a deux, c'est un trou : l'autre appareil, qui
   ignore l'effacement, repousse sa copie au prochain envoi, et le film
   ressuscite. On l'efface, il revient ; on l'efface encore, il revient
   encore.

   On garde donc, pour chaque fiche partie, son identifiant et l'heure
   de son départ. C'est le strict minimum — pas de titre, pas de note :
   une pierre tombale n'est pas une copie de la fiche.

   Elles ne s'accumulent pas indéfiniment : au-delà d'un an, un appareil
   qui n'a pas parlé depuis si longtemps a d'autres problèmes que celui-
   là, et ressusciter une fiche vieille d'un an est le moindre d'entre
   eux. */
export const CLÉ_TOMBES = "films-effaces";

const VIE_TOMBE_MS = 365 * 24 * 60 * 60 * 1000;

export interface Tombe {
  id: string;
  /** Quand la fiche a été retirée, en millisecondes. */
  le: number;
}

let tombes: Tombe[] = [];

export const tombesConnues = (): Tombe[] => tombes;

/* ============================================================
   CE QUI ATTEND D'ÊTRE ENVOYÉ
   ============================================================

   Première idée, et mauvaise : comparer `updatedAt` à la date du
   dernier envoi. Elle a tenu trois minutes — le temps qu'un test montre
   qu'une fiche DESCENDUE du serveur repartait aussitôt vers lui. Sa
   date vient de l'autre appareil, dont l'horloge n'est pas la nôtre :
   la comparer à notre repère à nous ne veut rien dire, et selon le sens
   du décalage on renvoie tout ou on n'envoie rien.

   On tient donc une LISTE : les identifiants des fiches modifiées ICI
   depuis le dernier envoi accepté. Aucune horloge, aucune soustraction,
   rien à interpréter. Elle est écrite par le dépôt, au seul endroit qui
   sache distinguer une modification locale d'une fiche reçue.

   Elle survit au rechargement, sinon une note écrite hors ligne le
   vendredi ne partirait jamais. */
export const CLÉ_ATTENTE = "films-a-envoyer";

let attente = new Set<string>();

export const enAttenteDEnvoi = (): string[] => [...attente];

const noterÀEnvoyer = (ids: string[]): void => {
  if (!ids.length) return;
  for (const id of ids) attente.add(id);
  store.set(CLÉ_ATTENTE, [...attente]);
};

/**
 * Tout est à envoyer.
 *
 * À LA PREMIÈRE CONNEXION D'UN COMPTE, et là seulement. La liste
 * d'attente ne retient que ce qu'on modifie APRÈS l'avoir mise en
 * place : une collection de six cents films déjà rangés n'y figure pas,
 * et le premier envoi ne contenait donc rien du tout. Le classeur se
 * disait à jour, le serveur restait vide, et personne ne mentait.
 */
export function toutÀEnvoyer(): void {
  attente = new Set(dernière.map((f) => f.id));
  for (const t of tombes) attente.add(t.id);
  store.set(CLÉ_ATTENTE, [...attente]);
}

/** Après un envoi accepté. Ce qui a rebougé entre-temps reste dedans. */
export function oublierCeQuiEstParti(ids: string[]): void {
  for (const id of ids) attente.delete(id);
  store.set(CLÉ_ATTENTE, [...attente]);
}

const noterLesParties = (avant: Film[], après: Film[], maintenant: number): void => {
  if (!avant.length) return;
  const restants = new Set(après.map((f) => f.id));
  const parties = avant.filter((f) => !restants.has(f.id));
  if (!parties.length) return;
  const limite = maintenant - VIE_TOMBE_MS;
  tombes = [
    ...tombes.filter((t) => t.le > limite && restants.has(t.id) === false),
    ...parties.map((f) => ({ id: f.id, le: maintenant })),
  ];
  store.set(CLÉ_TOMBES, tombes);
  /* Un départ est une chose à dire, au même titre qu'une note écrite. */
  noterÀEnvoyer(parties.map((f) => f.id));
};

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
  /* Les tombes restent dans le `localStorage` : quelques dizaines
     d'octets par fiche partie, et elles doivent survivre à un coffre
     indisponible aussi bien qu'à un rechargement. */
  tombes = store.get<Tombe[]>(CLÉ_TOMBES, []).filter((t) => t?.id && typeof t.le === "number");
  attente = new Set(store.get<string[]>(CLÉ_ATTENTE, []).filter((x) => typeof x === "string"));

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
  const maintenant = Date.now();
  const datés = horodater(dernière, films, maintenant);
  /* Les départs se lisent ICI et nulle part ailleurs : c'est le seul
     endroit qui voie l'avant et l'après. Une suppression signalée par
     chaque appelant serait une suppression qu'un appelant oublierait de
     signaler — et une fiche qui ressuscite au prochain envoi. */
  noterLesParties(dernière, datés, maintenant);
  /* CE QUI A BOUGÉ SE LIT À L'IDENTITÉ DES OBJETS, pas à leur date.
     `horodater` rend le MÊME objet pour une fiche inchangée : un objet
     différent de celui d'avant est donc une fiche modifiée, et une
     fiche absente d'avant est une fiche neuve. C'est exact.

     Comparer `updatedAt` à « maintenant » semblait équivalent et ne
     l'était pas : deux enregistrements dans la même milliseconde — ce
     qui arrive à la moindre suite de gestes — faisaient passer pour
     modifiées des fiches qui n'avaient pas bougé. */
  const avant = new Map(dernière.map((f) => [f.id, f]));
  noterÀEnvoyer(datés.filter((f) => avant.get(f.id) !== f).map((f) => f.id));
  dernière = datés;
  await écrire(datés);
  return datés;
}

/**
 * Écrit une collection venue d'AILLEURS, sans la re-dater.
 *
 * `enregistrerFilms` date ce qui a changé — c'est son travail, et c'est
 * exactement ce qu'il ne faut pas faire ici. Les fiches qui descendent
 * du serveur portent déjà leur date ; les redater de maintenant les
 * ferait passer pour des modifications locales, elles repartiraient au
 * serveur, qui les renverrait, indéfiniment.
 *
 * Les départs ne sont pas notés non plus : une fiche absente d'un
 * tirage n'a pas été effacée ici, elle n'était simplement pas dans le
 * paquet.
 */
export async function remplacerFilms(films: Film[]): Promise<void> {
  dernière = films;
  await écrire(films);
}

/**
 * La collection telle que le disque la connaît, sans la relire.
 *
 * La synchronisation en a besoin à des moments où l'écran n'est pas la
 * source : juste après un tirage, par exemple.
 */
export const collectionConnue = (): Film[] => dernière;

/** Pour les tests, et pour une restauration qui repart de zéro. */
export function oublierLeCache(films: Film[] = []): void {
  dernière = films;
  coffre = null;
}
