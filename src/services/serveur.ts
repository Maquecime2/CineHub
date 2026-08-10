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
   bouton mort.

   ELLE EST NETTOYÉE, ET CE N'EST PAS DE LA COQUETTERIE. Sous `cmd`,
   `set VITE_SERVEUR=http://… && npm run build` range dans la variable
   TOUT ce qui précède le `&&`, espace comprise. L'adresse compilée
   devient « http://localhost:8787 », chaque requête part vers une URL
   invalide, et l'application annonce un serveur injoignable qui tourne
   parfaitement — j'ai mis une demi-heure à le voir, et seulement parce
   que le message affichait une espace avant son point.

   La barre finale part pour la même raison : les chemins commencent
   déjà par une barre, et « …:8787//moi » n'est pas « …:8787/moi ». */
export const ADRESSE: string = (
  import.meta.env.VITE_SERVEUR || (import.meta.env.DEV ? "http://localhost:8787" : "")
)
  .trim()
  .replace(/\/+$/, "");

export const serveurConfigure = (): boolean => ADRESSE !== "";

/** D'où cette page parle — c'est ce que le serveur doit autoriser. */
export const origineDIci = (): string => (typeof location === "undefined" ? "?" : location.origin);

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
      headers: {
        /* LE `content-type` NE SE POSE QUE S'IL Y A QUELQUE CHOSE À
           TYPER. Annoncer du JSON sans rien envoyer fait refuser la
           requête par bien des serveurs — le nôtre le tolère désormais,
           mais annoncer un type pour un corps qui n'existe pas restait
           un petit mensonge, et c'est celui qui cassait la
           déconnexion. */
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    /* LE NAVIGATEUR NE DIT PAS POURQUOI, ET C'EST DÉLIBÉRÉ DE SA PART.

       Hors ligne, serveur éteint, DNS muet — mais AUSSI : serveur bien
       vivant qui n'autorise pas cette origine-ci. Dans les quatre cas,
       `fetch` jette la même chose, sans un mot de plus : révéler la
       différence renseignerait un site malveillant sur ce qui existe
       ailleurs. Le zéro dit donc « la requête n'est jamais partie », et
       rien de plus.

       Le message, lui, nomme la piste que personne ne devine seul : une
       PWA servie depuis un autre port que le serveur de développement
       est une AUTRE origine, et se fait refuser en silence. L'écrire
       coûte une ligne et fait gagner une soirée. */
    throw new ErreurServeur(
      `Pas de réponse de ${ADRESSE}. Serveur éteint, hors ligne — ou cette origine (${origineDIci()}) n'est pas autorisée par le serveur.`,
      0
    );
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

/** Ce que le serveur détient, dans un seul objet — pour l'emporter. */
export const mesDonnees = () => appeler<Record<string, unknown>>("/mes-donnees");

/**
 * Efface le compte et tout ce qui pend dessous.
 *
 * La collection LOCALE n'est pas touchée : effacer son compte, c'est
 * retirer sa copie du serveur, pas se déposséder de son classeur.
 */
export const effacerMonCompte = () =>
  appeler<{ efface: boolean }>("/mon-compte", {
    method: "DELETE",
  });

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

/* ------------------------------------------------------------
   LE RESTE DU CLASSEUR
   ------------------------------------------------------------ */

export interface DocÀPousser {
  cle: string;
  majLe: number;
  contenu: unknown;
  supprime?: boolean;
}

export interface RecuDocs {
  jusqua: number;
  encore?: boolean;
  documents: { cle: string; majLe: number; supprime?: boolean; contenu: unknown }[];
}

export const tirerDocsDepuis = (depuis: number): Promise<RecuDocs> =>
  appeler<RecuDocs>(`/documents?depuis=${depuis}`);

export const pousserDocs = (documents: DocÀPousser[]) =>
  appeler<{ ranges: number; perimes: number; illisibles: number }>("/documents", {
    method: "PUT",
    body: JSON.stringify({ documents }),
  });

/** Le plafond du serveur pour les documents. */
export const DOCS_PAR_ENVOI = 200;

/* ------------------------------------------------------------
   PARTAGER SA COLLECTION
   ------------------------------------------------------------ */

export type Partage = "privee" | "lien" | "publique";

export interface FilmPartage {
  id: string;
  title?: string;
  year?: string | number;
  director?: string;
  poster?: string;
  rating?: number;
  review?: string;
  [k: string]: unknown;
}

export const reglerLePartage = (partage: Partage) =>
  appeler<{ partage: Partage; jeton: string | null }>("/partage", {
    method: "PUT",
    body: JSON.stringify({ partage }),
  });

export const cacherLaFiche = (id: string, cachee: boolean) =>
  appeler<{ id: string; cachee: boolean }>(`/fiche/${encodeURIComponent(id)}/cachee`, {
    method: "PUT",
    body: JSON.stringify({ cachee }),
  });

/**
 * La collection de quelqu'un, vue du dehors.
 *
 * SANS COOKIE ET SANS COMPTE : c'est une page qu'on ouvre depuis un
 * lien reçu, souvent dans un navigateur où l'on n'a jamais mis les
 * pieds. Elle ne doit rien exiger.
 */
export async function collectionDe(
  pseudo: string,
  jeton?: string | null
): Promise<{ pseudo: string; films: FilmPartage[] }> {
  const q = jeton ? `?jeton=${encodeURIComponent(jeton)}` : "";
  return appeler<{ pseudo: string; films: FilmPartage[] }>(
    `/chez/${encodeURIComponent(pseudo)}${q}`
  );
}
