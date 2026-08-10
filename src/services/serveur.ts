/* ============================================================
   LE SERVEUR, VU DU CLASSEUR — facultatif, et il doit le rester
   ============================================================

   Toute cette moitié de l'application est un CONFORT. Sans adresse de
   serveur, sans compte, sans réseau, le classeur fonctionne exactement
   comme avant : la collection vit dans le coffre, et rien d'ici ne
   s'exécute. C'est la promesse depuis le premier jour, et elle ne se
   négocie pas contre une fonction communautaire.

   D'où la forme de ce module : il ne jette jamais pour dire « pas de
   réseau », il RÉPOND. L'appelant décide, et l'écran ne s'excuse que
   lorsqu'on lui a demandé quelque chose.
   ============================================================ */

/* L'adresse du serveur. Vide en production tant qu'aucun n'est déployé :
   la synchronisation est alors simplement absente, sans message ni
   bouton mort. */
export const ADRESSE: string =
  import.meta.env.VITE_SERVEUR || (import.meta.env.DEV ? "http://localhost:8787" : "");

export const serveurConfigure = (): boolean => ADRESSE !== "";

export interface Personne {
  id: string;
  pseudo: string;
}

export class ErreurServeur extends Error {
  constructor(
    message: string,
    /** Le code HTTP, ou 0 quand la requête n'est jamais partie. */
    readonly code: number
  ) {
    super(message);
  }
}

/* `credentials: "include"` SUR CHAQUE APPEL, sans exception. Le cookie
   de session vient d'une autre origine que la page : sans cette ligne,
   le navigateur ne l'envoie pas, et le serveur voit un inconnu à chaque
   requête — sans qu'aucune erreur ne le dise. */
/* Le strict nécessaire, écrit à la main : nommer `RequestInit` ferait
   dépendre ce module des types du DOM là où trois champs suffisent. */
interface Envoi {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

async function appeler<T>(chemin: string, options: Envoi = {}): Promise<T> {
  if (!serveurConfigure()) throw new ErreurServeur("Aucun serveur réglé.", 0);

  let rep: Response;
  try {
    rep = await fetch(`${ADRESSE}${chemin}`, {
      ...options,
      credentials: "include",
      headers: { "content-type": "application/json", ...(options.headers || {}) },
    });
  } catch {
    /* Hors ligne, serveur éteint, DNS qui ne répond pas : la requête
       n'est jamais partie. Le zéro dit exactement cela, et permet à
       l'appelant de distinguer « je n'ai pas pu demander » de « on m'a
       répondu non ». */
    throw new ErreurServeur("Le serveur ne répond pas.", 0);
  }

  if (!rep.ok) {
    const corps = await rep.json().catch(() => ({}));
    throw new ErreurServeur(
      (corps as { erreur?: string }).erreur || `Erreur ${rep.status}`,
      rep.status
    );
  }
  return (await rep.json()) as T;
}

/* ------------------------------------------------------------
   LE COMPTE
   ------------------------------------------------------------ */

/**
 * Qui est connecté, ou `null` si personne.
 *
 * NE PAS ÊTRE CONNECTÉ ET NE PAS POUVOIR DEMANDER SONT DEUX CHOSES.
 * Avaler les deux dans un `null` faisait dire au tiroir « tout reste
 * ici » — c'est-à-dire « vous n'avez pas de compte » — à quelqu'un qui
 * en a un et dont le train passe sous un tunnel. Un refus du serveur
 * (401) rend `null` ; une absence de réseau JETTE, et l'appelant
 * saura dire « en attente » plutôt que d'effacer quelqu'un.
 */
export async function quiSuisJe(): Promise<Personne | null> {
  try {
    const r = await appeler<{ personne: Personne }>("/moi");
    return r.personne;
  } catch (e) {
    if ((e as ErreurServeur).code === 0) throw e;
    return null;
  }
}

export async function seDeconnecter(): Promise<void> {
  await appeler("/deconnexion", { method: "POST" }).catch(() => {});
}

/* LES CLÉS D'ACCÈS. La bibliothèque du navigateur n'est chargée QUE si
   l'on s'inscrit ou se connecte : c'est une centaine de kilo-octets que
   personne n'a à télécharger pour consulter sa vidéothèque. */
export async function sInscrire(pseudo: string): Promise<Personne> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const { defi, options } = await appeler<{ defi: string; options: object }>(
    "/auth/inscription/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const reponse = await startRegistration({ optionsJSON: options as never });
  const r = await appeler<{ personne: Personne }>("/auth/inscription/verification", {
    method: "POST",
    body: JSON.stringify({ defi, reponse }),
  });
  return r.personne;
}

export async function seConnecter(pseudo: string): Promise<Personne> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const { defi, options } = await appeler<{ defi: string; options: object }>(
    "/auth/connexion/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const reponse = await startAuthentication({ optionsJSON: options as never });
  const r = await appeler<{ personne: Personne }>("/auth/connexion/verification", {
    method: "POST",
    body: JSON.stringify({ defi, reponse }),
  });
  return r.personne;
}

/* ------------------------------------------------------------
   LA COLLECTION
   ------------------------------------------------------------ */

export interface FicheÀPousser {
  id: string;
  tmdbId?: unknown;
  majLe: number;
  supprimee?: boolean;
  donnees?: unknown;
}

export interface Recu {
  /** Le rang du serveur jusqu'où l'on a lu. */
  jusqua: number;
  /** Il en reste : rappeler avec le nouveau rang. */
  encore?: boolean;
  fiches: { id: string; majLe: number; supprimee?: boolean; donnees: Record<string, unknown> }[];
}

export const tirerDepuis = (depuis: number): Promise<Recu> =>
  appeler<Recu>(`/collection?depuis=${depuis}`);

export const pousser = (fiches: FicheÀPousser[]) =>
  appeler<{ rangees: number; perimees: number; illisibles: number; jusqua: number }>(
    "/collection",
    {
      method: "PUT",
      body: JSON.stringify({ fiches }),
    }
  );

/** Le plafond du serveur, repris ici pour découper les envois. */
export const PAR_ENVOI = 500;
