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
import { store } from "./storage";

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
    noterLeCompte(r.personne.id);
    return r.personne;
  } catch (e) {
    if ((e as ErreurServeur).code === 0) throw e;
    noterLeCompte(null);
    return null;
  }
}

export async function seDeconnecter(): Promise<void> {
  await appeler("/deconnexion", { method: "POST" }).catch(() => {});
  noterLeCompte(null);
}

/* ------------------------------------------------------------
   « UN COMPTE EST-IL OUVERT ? », POUR CE QUI N'EST PAS UN RENDU
   ------------------------------------------------------------

   Le relais TMDB du serveur n'accepte que les gens connectés, et c'est
   `src/tmdb.js` — un module qui n'a ni React ni contexte — qui doit
   décider s'il passe par là. Il lui faut donc une réponse SYNCHRONE.

   La valeur est semée depuis le disque au chargement, avec la dernière
   personne connue de la synchronisation : sans cela, les premières
   secondes après l'ouverture répondraient « pas de compte » à quelqu'un
   qui en a un, et l'écran afficherait « il manque une clé » avant de se
   raviser. Ce n'est qu'un PRESSENTIMENT — si l'on se trompe, le relais
   répond 401 et l'appel repart par le chemin d'avant.

   `quiSuisJe` corrige ce pressentiment au premier aller-retour, et
   c'est elle qui fait autorité. */
let compte: string | null = store.get<string>("synchro-compte", "") || null;

type Veille = () => void;
const veilleurs = new Set<Veille>();

function noterLeCompte(id: string | null): void {
  if (compte === id) return;
  compte = id;
  for (const fn of veilleurs) fn();
}

/** Y a-t-il un compte ouvert, autant qu'on sache ? */
export const compteOuvert = (): boolean => serveurConfigure() && compte !== null;

/** Être prévenu quand la réponse change. Rend de quoi se désabonner. */
export function suivreLeCompte(fn: Veille): () => void {
  veilleurs.add(fn);
  return () => {
    veilleurs.delete(fn);
  };
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
  noterLeCompte(r.personne.id);
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
  noterLeCompte(r.personne.id);
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

/** Ce que la collection montre en ce moment, et à qui. */
export const monPartage = () => appeler<{ partage: Partage; jeton: string | null }>("/partage");

export const reglerLePartage = (partage: Partage) =>
  appeler<{ partage: Partage; jeton: string | null }>("/partage", {
    method: "PUT",
    body: JSON.stringify({ partage }),
  });

/** Les fiches écartées du partage — des identifiants, rien de plus. */
export const fichesCachees = () => appeler<{ ids: string[] }>("/fiches-cachees");

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

/* ------------------------------------------------------------
   SUIVRE, ET LE FIL
   ------------------------------------------------------------ */

export interface Profil {
  pseudo: string;
  films: number;
  suivi?: boolean;
  /** Pour la liste des abonnements : sa collection est-elle encore ouverte ? */
  ouverte?: boolean;
}

export interface Nouvelle {
  pseudo: string;
  id: string;
  tmdbId: string | null;
  le: number;
  film: FilmPartage;
}

export const profilDe = (pseudo: string) =>
  appeler<Profil>(`/profils/${encodeURIComponent(pseudo)}`);

export const suivre = (pseudo: string) =>
  appeler<{ pseudo: string; suivi: boolean }>(`/abonnements/${encodeURIComponent(pseudo)}`, {
    method: "PUT",
  });

export const nePlusSuivre = (pseudo: string) =>
  appeler<{ pseudo: string; suivi: boolean }>(`/abonnements/${encodeURIComponent(pseudo)}`, {
    method: "DELETE",
  });

export const mesAbonnements = () => appeler<{ abonnements: Profil[] }>("/abonnements");

export const lireLeFil = (avant?: number | null) =>
  appeler<{ jusqua: number | null; nouvelles: Nouvelle[] }>(
    `/fil${avant ? `?avant=${avant}` : ""}`
  );

/* ------------------------------------------------------------
   CE QU'ON DIT D'UNE ŒUVRE, ET COMMENT ON S'EN PROTÈGE
   ------------------------------------------------------------ */

export interface Avis {
  pseudo: string;
  /** L'identifiant de la fiche chez son auteur — c'est ce qu'on signale. */
  fiche: string;
  note: number | null;
  critique: string | null;
  le: string;
}

export interface Echo {
  collections: number;
  moyenne: number | null;
  notes: number;
  avis: Avis[];
}

/**
 * Ce que les collections publiques disent d'une œuvre.
 *
 * `tmdbId` EST LA SEULE CLÉ POSSIBLE : deux personnes qui rangent le
 * même film ont deux fiches, deux identifiants, souvent deux titres.
 * Une fiche saisie à la main n'a donc pas d'écho, et c'est cohérent —
 * elle n'existe que chez soi.
 */
export const echoDeLOeuvre = (tmdbId: string | number) =>
  appeler<Echo>(`/oeuvres/${encodeURIComponent(String(tmdbId))}`);

export const mesBlocages = () => appeler<{ blocages: string[] }>("/blocages");

export const bloquer = (pseudo: string) =>
  appeler<{ pseudo: string; bloque: boolean }>(`/blocages/${encodeURIComponent(pseudo)}`, {
    method: "PUT",
  });

export const debloquer = (pseudo: string) =>
  appeler<{ pseudo: string; bloque: boolean }>(`/blocages/${encodeURIComponent(pseudo)}`, {
    method: "DELETE",
  });

export const signaler = (quoi: { pseudo: string; fiche: string; motif: string }) =>
  appeler<{ note: boolean; neuf: boolean }>("/signalements", {
    method: "POST",
    body: JSON.stringify(quoi),
  });

/* ------------------------------------------------------------
   LES LISTES, ET LES DÉFIS QU'ON EN TIRE
   ------------------------------------------------------------ */

export interface Liste {
  id: string;
  titre: string;
  intention: string;
  publique: boolean;
  proprietaire: string;
  oeuvres: number;
  mienne?: boolean;
  membre?: boolean;
}

export interface OeuvreDeListe {
  tmdb_id: string;
  titre: string;
  annee: string | null;
  /** Qui l'a mise là — `null` si cette personne est partie. */
  par: string | null;
}

export interface Defi {
  id: string;
  titre: string;
  liste_id: string;
  liste: string;
  debut: string;
  fin: string;
  par: string | null;
  oeuvres: number;
  dedans?: boolean;
}

/** Un nombre par participant : le journal des séances ne sort pas. */
export interface Avancement {
  pseudo: string;
  faites: number;
}

export const mesListes = () => appeler<{ listes: Liste[] }>("/listes");

export const creerListe = (l: { titre: string; intention?: string; publique?: boolean }) =>
  appeler<{ id: string }>("/listes", { method: "POST", body: JSON.stringify(l) });

export const lireLaListe = (id: string) =>
  appeler<{ liste: Liste; oeuvres: OeuvreDeListe[]; membres: string[] }>(
    `/listes/${encodeURIComponent(id)}`
  );

export const retoucherLaListe = (
  id: string,
  l: { titre?: string; intention?: string; publique?: boolean }
) =>
  appeler<{ fait: boolean }>(`/listes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(l),
  });

export const effacerLaListe = (id: string) =>
  appeler<{ efface: boolean }>(`/listes/${encodeURIComponent(id)}`, { method: "DELETE" });

export const rangerDansLaListe = (
  id: string,
  o: { tmdbId: string | number; titre?: string; annee?: string | number }
) =>
  appeler<{ ajoute: boolean; neuf: boolean }>(`/listes/${encodeURIComponent(id)}/oeuvres`, {
    method: "POST",
    body: JSON.stringify({ ...o, annee: o.annee == null ? undefined : String(o.annee) }),
  });

export const retirerDeLaListe = (id: string, tmdbId: string) =>
  appeler<{ retire: boolean }>(
    `/listes/${encodeURIComponent(id)}/oeuvres/${encodeURIComponent(tmdbId)}`,
    { method: "DELETE" }
  );

export const inviterALaListe = (id: string, pseudo: string) =>
  appeler<{ pseudo: string; membre: boolean }>(
    `/listes/${encodeURIComponent(id)}/membres/${encodeURIComponent(pseudo)}`,
    { method: "PUT" }
  );

export const renvoyerDeLaListe = (id: string, pseudo: string) =>
  appeler<{ pseudo: string; membre: boolean }>(
    `/listes/${encodeURIComponent(id)}/membres/${encodeURIComponent(pseudo)}`,
    { method: "DELETE" }
  );

export const mesDefis = () => appeler<{ defis: Defi[] }>("/defis");

export const creerUnDefi = (d: { listeId: string; titre: string; debut: string; fin: string }) =>
  appeler<{ id: string }>("/defis", { method: "POST", body: JSON.stringify(d) });

export const lireLeDefi = (id: string) =>
  appeler<{ defi: Defi; oeuvres: OeuvreDeListe[]; avancement: Avancement[] }>(
    `/defis/${encodeURIComponent(id)}`
  );

export const effacerLeDefi = (id: string) =>
  appeler<{ efface: boolean }>(`/defis/${encodeURIComponent(id)}`, { method: "DELETE" });

export const rejoindreLeDefi = (id: string) =>
  appeler<{ dedans: boolean }>(`/defis/${encodeURIComponent(id)}/participation`, { method: "PUT" });

export const quitterLeDefi = (id: string) =>
  appeler<{ dedans: boolean }>(`/defis/${encodeURIComponent(id)}/participation`, {
    method: "DELETE",
  });
