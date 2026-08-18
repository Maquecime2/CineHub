/* ============================================================
   THE REST OF THE BINDER — everything that is not a card
   ============================================================

   A video library is not a list of films. It is also the ARRANGEMENT of
   the shelves — which film on which board, in what order, under which
   divider —, the notebook's pages, the threads strung between works, the
   vocabulary we wrote ourselves, the decors we set out.

   The first synchronisation carried nothing but the cards. So the second
   device found the films again and not the way they were arranged: half
   the binder, and not the less personal half — arranging is this
   application's central gesture.

   WHY THIS MODULE EXISTS SEPARATELY. These documents carry NO date: they
   are objects written straight into `localStorage` by six different
   services, unstamped, and always have been. Giving them one in each of
   those would mean six places not to forget. So we keep a register: one
   key, one date, written here and nowhere else.

   THE WIRE FIELD NAMES (`key`, `updatedAt`, `content`, `deleted`) ARE THE
   SERVER'S, not ours. They stay as they are until both sides are renamed
   in the same change.

   THEY WERE RENAMED ON ONE SIDE ONLY, ONCE, and it cost every tombstone.
   The server reads `deleted` and writes `deleted`; this file read and
   wrote `supprime`, which the translation of the codebase left behind. A
   document erased here therefore went out with `deleted` undefined — so
   the other device was never told to erase it, and merely received a
   `null` where its own copy had been. The two names must be the SAME
   word, and this is the one the server uses.
   ============================================================ */
import { store } from "./storage";

/** The date register, alongside the documents themselves. */
const REGISTER_KEY = "documents-maj";
/** What is waiting to be sent — the keys, as for the cards. */
const PENDING_KEY = "documents-a-envoyer";
/* Quelle version de la liste ci-dessous ce navigateur a déjà rattrapée. */
const SYNCABLE_VERSION_KEY = "documents-liste-version";
/* Le premier tirage de ce compte a-t-il eu lieu sur CE navigateur ? */
const SETTLED_KEY = "documents-premier-tirage";

/* WHAT SYNCHRONISES, AND WHAT MUST ABSOLUTELY NOT.

   Everything that describes the COLLECTION travels. Everything that
   describes THIS device stays: the chosen skin (we do not impose the
   mood of the moment on our other screen), the guided tour's state, the
   invitation to install, and the synchronisation markers themselves —
   sending those would amount to synchronising on our own cursor. */
/* THREE OF THESE NAMED NOTHING, AND NOTHING SAID SO.

   A key that is not on this list simply does not travel — silently, and
   the arrangement one had carefully built stayed on the machine that
   built it. The three wrong spellings below were all invented here
   rather than read from the service that writes them:

     "shelf-views-index" -> the index is "shelf-views" (`shelfViews.ts`)
     "decor-custom"      -> "shelf-decor-custom" (`customDecor.ts`)
     "decor-hidden"      -> "shelf-decor-hidden" (`customDecor.ts`)

   The shelf VIEWS themselves did travel (the `shelf-view:` prefix is
   right), which is what made this so hard to see: cards arrived, views
   arrived, and the second device did not know a single one of them
   EXISTED because the index that lists them stayed behind. Hence the
   test just below the list — it compares these names to the constants
   the services actually use, so a fourth one cannot be invented. */
const SYNCABLE_PREFIXES = ["shelf-view:"];
const SYNCABLE_KEYS = [
  "shelf-views",
  "shelf-dividers",
  "notebook-notes",
  "fils",
  "motifs",
  "wall-prefs",
  "shelf-decor-custom",
  "shelf-decor-hidden",
  "filiations",
  "parcours",
];

/**
 * LA LISTE CHANGE, ET CE QUI EXISTAIT DÉJÀ DOIT REPARTIR.
 *
 * `sendAllDocuments` rattrape tout ce qui traîne — mais il ne tourne
 * qu'au premier branchement d'un compte. Or les trois fautes
 * d'orthographe ci-dessus ont été corrigées APRÈS que des gens se
 * soient connectés : à leur premier branchement, `shelf-views`,
 * `shelf-decor-custom` et `shelf-decor-hidden` n'étaient pas
 * reconnaissables, donc pas ramassés. Et comme le compte n'a pas changé
 * depuis, le rattrapage n'a jamais été rejoué.
 *
 * Résultat : une disposition d'étagères faite avant le correctif n'est
 * jamais partie, et ne partira jamais — sauf à y retoucher, ce que rien
 * ne dit. C'est le pire genre de perte, celle qu'on ne découvre qu'en
 * changeant d'ordinateur.
 *
 * Ce numéro monte À CHAQUE FOIS QU'ON TOUCHE AUX DEUX LISTES au-dessus.
 * La synchro le compare à celui qu'elle a retenu et rejoue le rattrapage
 * quand ils diffèrent. Les documents non datés repartent en `DAWN`,
 * c'est-à-dire en perdant contre tout ce que le serveur tient déjà :
 * rattraper ne doit écraser personne.
 */
export const SYNCABLE_VERSION = 3;

export const isSyncable = (key: string): boolean =>
  SYNCABLE_KEYS.includes(key) || SYNCABLE_PREFIXES.some((p) => key.startsWith(p));

type Register = Record<string, number>;

const register = (): Register => store.get<Register>(REGISTER_KEY, {});

/* Ce qu'on vient de classer, et la date sous laquelle on l'a classé. En
   mémoire et non sur le disque : cela ne sert qu'à reconnaître la note
   différée d'une écriture faite il y a trois lignes. Voir
   `noteDocument`. */
const filed = new Map<string, number>();
const pending = (): string[] => store.get<string[]>(PENDING_KEY, []);

/**
 * L'AUBE DES TEMPS — la date de ce qu'on n'a pas vraiment daté.
 *
 * Le serveur refuse `updatedAt: 0`, donc il fallait bien écrire QUELQUE
 * CHOSE ; `Date.now()` semblait sans conséquence et ne l'est pas, c'est
 * la date la plus récente qui soit. Voir `sendAllDocuments` et
 * `noteDocument`.
 */
const DAWN = 1;

/* FAUX PAR DÉFAUT, ET C'EST TOUT LE CORRECTIF.

   La première version de cette garde était vraie par défaut et comptait
   sur `expectFirstPull` pour l'ouvrir. Elle ne s'ouvrait JAMAIS à temps :
   la synchro ne démarre qu'une fois le classeur chargé (`useSync(loaded,
   …)`), et c'est l'effet de chargement lui-même qui fabrique et écrit
   l'agencement par défaut. La garde arrivait après le geste qu'elle
   devait garder — donc après la perte.

   Elle ne dépend plus de rien d'autre qu'elle-même. Ce qui la rend sans
   danger pour les navigateurs déjà branchés est la seconde condition,
   dans `noteDocument` : on ne rabat à l'aube que ce qui n'a AUCUNE date
   ici, c'est-à-dire ce que ce navigateur vient d'inventer. Un document
   qu'il connaît déjà garde sa date pleine. */
const settled = (): boolean => store.get<boolean>(SETTLED_KEY, false);

/**
 * Ce navigateur a-t-il déjà vu descendre les documents de ce compte ?
 *
 * Lu par `ensureViews` : tant que la réponse est non, un agencement
 * fabriqué faute d'en trouver un est un PIS-ALLER d'affichage, et
 * l'écrire reviendrait à inventer des vues que le serveur n'a pas et
 * qu'il faudrait ensuite retrouver dans les orphelines.
 */
export const documentsSettled = (): boolean => settled();

/** Un compte neuf sur ce navigateur : rien n'est encore descendu. */
export const expectFirstPull = (): void => {
  store.set(SETTLED_KEY, false);
};

/** Le tirage a atterri : ce qu'on écrit désormais est un vrai geste. */
export const noteFirstPull = (): void => {
  if (!settled()) store.set(SETTLED_KEY, true);
};

/**
 * This document has just changed HERE.
 *
 * Called by the store itself (`services/storage`), not by the services
 * that write: it is the one compulsory point of passage, and therefore
 * the one place where it cannot be forgotten.
 */
export function noteDocument(key: string, now = Date.now()): void {
  if (!isSyncable(key)) return;
  /* L'ÉCHO DE NOTRE PROPRE CLASSEMENT N'EST PAS UN GESTE.

     `fileIncomingDocument` écrit par le magasin, et le magasin date ce
     qu'on écrit — c'est tout son intérêt, six services écrivent des
     documents et aucun ne pense à les dater. Mais la datation passe par
     un import dynamique, donc elle ATTERRIT APRÈS : le classement avait
     beau poser la date reçue puis retirer la clé de la file, la note
     arrivait ensuite et défaisait les deux. Chaque document reçu
     repartait donc au serveur, redaté de maintenant — c'est-à-dire plus
     récent que ce qu'on venait d'en recevoir.

     ENTRE DEUX SESSIONS OUVERTES, CELA NE S'ARRÊTE JAMAIS. L'une reçoit,
     redate, renvoie ; l'autre reçoit à son tour, redate, renvoie. Deux
     navigateurs sur la même adresse épuisaient les cent requêtes par
     minute du serveur en se renvoyant les mêmes documents, et la
     synchronisation répondait « too many requests » sans que personne
     ait touché à quoi que ce soit.

     On reconnaît l'écho à ceci : la clé vient d'être classée, et sa date
     au registre est encore EXACTEMENT celle qu'on a classée. Un vrai
     geste, lui, arrive après que la marque a été consommée. */
  const echo = filed.get(key);
  if (echo != null && echo === register()[key]) {
    filed.delete(key);
    return;
  }
  /* TANT QUE LE PREMIER TIRAGE N'A PAS EU LIEU, ON DATE À L'AUBE.

     Un navigateur neuf n'attend pas la synchro pour vivre : il charge,
     ne trouve aucun agencement, en FABRIQUE un par défaut
     (`ensureViews`) et l'écrit — daté de MAINTENANT, c'est-à-dire de la
     date la plus récente qui soit. Le tirage arrive une seconde plus
     tard avec le vrai agencement, daté d'hier : `fileIncomingDocument`
     le refuse, puisqu'il est plus vieux. La poussée qui suit écrase
     alors le serveur avec l'étagère vide, et l'agencement est perdu POUR
     TOUS LES APPAREILS.

     C'est exactement le défaut que `DAWN` répare pour les documents
     DÉJÀ là au premier branchement. Rien ne protégeait ceux que
     l'application se fabrique elle-même avant que le tirage ait
     atterri, et ce sont les plus nombreux : l'agencement des étagères,
     les préférences de mur, le vocabulaire.

     On ne perd rien à dater à l'aube : le document part quand même — un
     compte vide n'a rien à lui opposer — et il perd contre tout ce que
     le serveur tient déjà. C'est la seule lecture de « je viens
     d'inventer ça faute de mieux » qui ne détruise le travail de
     personne.

     ET SEULEMENT CE QUI N'A PAS DE DATE ICI. Un document que ce
     navigateur connaît déjà a une vraie date, et la lui rabattre à
     l'aube laisserait une copie plus VIEILLE du serveur le remplacer au
     tour suivant. La garde ne vise que ce qui vient d'être inventé de
     rien. */
  if (!settled() && !register()[key]) now = DAWN;
  store.set(REGISTER_KEY, { ...register(), [key]: now });
  const list = pending();
  if (!list.includes(key)) store.set(PENDING_KEY, [...list, key]);
}

/** A document's date, or zero if it has never been noted. */
export const dateOf = (key: string): number => register()[key] ?? 0;

/**
 * What is left to send, ready for the road.
 *
 * IL LISAIT `localStorage.getItem` EN DIRECT, et c'est ce qui rendait ce
 * module inconciliable avec le coffre. Une clé descendue dans IndexedDB
 * y aurait rendu `null` — que la ligne ci-dessous interprète comme une
 * SUPPRESSION. Le carnet ne serait pas resté sur place : il aurait été
 * effacé sur l'autre appareil, par une pierre tombale que personne
 * n'avait demandée.
 *
 * `store.has` et `store.get` regardent aux deux endroits. Ce module n'a
 * plus à savoir où dort un document — c'est le magasin qui le sait, et
 * lui seul.
 */
export function documentsToSend(): {
  key: string;
  updatedAt: number;
  content: unknown;
  deleted?: boolean;
}[] {
  return pending().map((key) => {
    const there = store.has(key);
    return {
      key: key,
      updatedAt: dateOf(key) || Date.now(),
      /* A document deleted here goes out like the cards: as a tombstone.
         Otherwise the other device would push it back. */
      deleted: !there,
      content: there ? store.get<unknown>(key, null) : null,
    };
  });
}

export function forgetSentDocuments(keys: string[]): void {
  const rest = pending().filter((c) => !keys.includes(c));
  store.set(PENDING_KEY, rest);
}

/**
 * Files a document that came from the server.
 *
 * Returns `true` if it was written. Last writer wins, as for the cards —
 * and on a strict tie we keep the local one, because doing nothing is
 * the only arbitration that surprises nobody.
 */
export function fileIncomingDocument(d: {
  key: string;
  updatedAt: number;
  content: unknown;
  deleted?: boolean;
}): boolean {
  if (!isSyncable(d.key)) return false;
  if (d.updatedAt <= dateOf(d.key)) return false;

  /* `store.remove` et non `localStorage.removeItem` : une clé coffrée
     doit disparaître des DEUX endroits, sinon elle revient au prochain
     chargement. */
  if (d.deleted) store.remove(d.key);
  else store.set(d.key, d.content);

  /* We noted the date RECEIVED, and we do not put the key back on the
     waiting list: this document comes from elsewhere, it has no reason
     to go back there. */
  store.set(REGISTER_KEY, { ...register(), [d.key]: d.updatedAt });
  forgetSentDocuments([d.key]);
  /* APRÈS le registre, jamais avant : c'est sa valeur qu'on marque. */
  filed.set(d.key, d.updatedAt);
  return true;
}

/**
 * On an account's first connection: everything we have must go out.
 *
 * A DOCUMENT THAT NEVER HAD A DATE IS DATED AT THE DAWN OF TIME, and this
 * is the whole of it. Dating them `Date.now()` looked harmless — the
 * server refuses `updatedAt: 0`, so SOMETHING had to be written — but
 * `now` is not a neutral value: it is the newest date there is. A machine
 * signing in for the first time therefore declared its own untouched
 * defaults — an empty shelf, no dividers, no threads — to be more recent
 * than everything on the server, and the arbitration did exactly what it
 * is meant to do:
 *
 *   - `fileIncomingDocument` refused the arrangement pulled a moment
 *     later, since yesterday is older than now;
 *   - the push that follows then overwrote the server with the empty
 *     shelf, and the arrangement was gone for the OTHER device too.
 *
 * Somebody signing in on a second computer lost the arrangement of their
 * shelves, and lost it everywhere. So the undated go out as ancient: they
 * are still sent — an account with nothing in it takes them, having
 * nothing to lose against — and they lose to anything the server already
 * holds, which is the only reading of "I have never dated this" that does
 * not destroy somebody's work.
 */
export function sendAllDocuments(): void {
  const reg = register();
  /* `store.keys()` et non un parcours de `localStorage` par index : un
     document au coffre y serait resté invisible, donc jamais rattrapé
     et jamais envoyé. */
  const keys = store.keys().filter(isSyncable);
  const next = { ...reg };
  for (const c of keys) if (!next[c]) next[c] = DAWN;
  store.set(REGISTER_KEY, next);
  store.set(PENDING_KEY, keys);
}

/**
 * Rattraper une seule fois par version de la liste.
 *
 * Renvoie `true` si le rattrapage a eu lieu, pour que l'appelant puisse
 * le dire dans ses journaux plutôt que de le faire en silence.
 */
export function catchUpDocuments(): boolean {
  if (store.get<number>(SYNCABLE_VERSION_KEY, 0) >= SYNCABLE_VERSION) return false;
  store.set(SYNCABLE_VERSION_KEY, SYNCABLE_VERSION);

  /* LES ORPHELINS SEULEMENT, ET PAS TOUT LE MONDE.

     `sendAllDocuments` remet en attente TOUTES les clés synchronisables,
     ce qui est juste au premier branchement d'un compte — il n'y a rien
     en face. Ici il y a déjà un serveur qui tient des documents, et
     réexpédier ceux qui sont à jour renverrait vers lui, à chaque tour,
     ce qu'il vient d'en descendre.

     Un ORPHELIN est une clé présente ici sans date au registre : elle
     n'a jamais été notée, donc jamais envoyée. C'est exactement la trace
     que laisse une liste qui s'est élargie après coup. */
  const reg = register();
  const orphans = store.keys().filter((key) => isSyncable(key) && !reg[key]);
  if (orphans.length === 0) return false;

  const dated = { ...reg };
  for (const key of orphans) dated[key] = DAWN;
  store.set(REGISTER_KEY, dated);
  /* On AJOUTE à ce qui attend, on ne le remplace pas : un document
     modifié à l'instant et pas encore parti ne doit pas disparaître de
     la file parce qu'un rattrapage est passé. */
  const waiting = pending();
  store.set(PENDING_KEY, [...waiting, ...orphans.filter((k) => !waiting.includes(k))]);
  return true;
}

/**
 * Oublier ce qu'on savait de la date de certains documents.
 *
 * `fileIncomingDocument` refuse ce qui n'est pas plus récent que ce
 * qu'on a — c'est ce qui empêche un serveur en retard d'écraser du
 * travail. Mais cela empêche aussi de RÉCUPÉRER : un document effacé
 * ici, dont la suppression n'est jamais partie, ne peut pas revenir
 * puisque sa date locale est la plus fraîche des deux.
 *
 * Effacer ces dates rend donc le serveur souverain sur ces clés-là, le
 * temps d'un tour. C'est un geste délibéré, réservé au panneau de
 * réparation : appliqué largement, il rendrait n'importe quelle
 * suppression réversible par accident.
 */
export function forgetDatesUnder(prefix: string): number {
  const reg = register();
  const kept: Record<string, number> = {};
  let dropped = 0;
  for (const [key, date] of Object.entries(reg)) {
    if (key.startsWith(prefix)) dropped += 1;
    else kept[key] = date;
  }
  if (dropped > 0) store.set(REGISTER_KEY, kept);
  return dropped;
}

export function forgetDocuments(): void {
  store.set(PENDING_KEY, []);
}
