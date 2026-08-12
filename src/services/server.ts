/* ============================================================
/* ============================================================
   THE SERVER, SEEN FROM THE BINDER — optional, and it must stay so
   ============================================================

   This whole half of the application is a CONVENIENCE. With no server
   address, no account, no network, the binder works exactly as before:
   the collection lives in the vault, and nothing here runs. That is the
   promise from day one, and it is not up for negotiation against a
   community feature.

   Hence the shape of this module: it never throws to say "no network",
   it ANSWERS. The caller decides, and the screen only apologises when
   something was asked of it.
   ============================================================ */

/* The server's address. Empty in production while none is deployed:
   synchronisation is then simply absent, with no message and no dead
   button.

   IT IS CLEANED, AND THAT IS NOT FUSSINESS. Under `cmd`,
   `set VITE_SERVEUR=http://… && npm run build` files into the variable
   EVERYTHING before the `&&`, trailing space included. The compiled
   address becomes "http://localhost:8787 ", every request goes out to an
   invalid URL, and the application announces an unreachable server that
   is running perfectly — it took me half an hour to see it, and only
   because the message showed a space before its full stop.

   The trailing slash goes for the same reason: the paths already start
   with a slash, and "…:8787//moi" is not "…:8787/moi". */
import { store } from "./storage";

export const ADDRESS: string = (
  import.meta.env.VITE_SERVEUR || (import.meta.env.DEV ? "http://localhost:8787" : "")
)
  .trim()
  .replace(/\/+$/, "");

export const serverConfigured = (): boolean => ADDRESS !== "";

/** Where this page speaks from — it is what the server must allow. */
export const originHere = (): string => (typeof location === "undefined" ? "?" : location.origin);

export interface Person {
  id: string;
  pseudo: string;
}

export class ServerError extends Error {
  constructor(
    message: string,
    /** The HTTP code, or 0 when the request never went out. */
    readonly code: number
  ) {
    super(message);
  }
}

/* `credentials: "include"` ON EVERY CALL, without exception. The session
   cookie comes from a different origin than the page: without this line
   the browser does not send it, and the server sees a stranger on every
   request — with no error to say so. */
/* The bare minimum, written by hand: naming `RequestInit` would make
   this module depend on the DOM types where three fields are enough. */
interface CallOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
  if (!serverConfigured()) throw new ServerError("Aucun serveur réglé.", 0);

  let res: Response;
  try {
    res = await fetch(`${ADDRESS}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        /* THE `content-type` IS ONLY SET IF THERE IS SOMETHING TO
           TYPE. Announcing JSON while sending nothing gets the request
           refused by many servers — ours tolerates it now, but
           announcing a type for a body that does not exist was still a
           small lie, and it was the one that broke signing out. */
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    /* THE BROWSER DOES NOT SAY WHY, AND THAT IS DELIBERATE ON ITS PART.

       Offline, server down, DNS silent — but ALSO: a server very much
       alive that does not allow this origin. In all four cases `fetch`
       throws the same thing, without another word: revealing the
       difference would tell a malicious site what exists elsewhere. So
       the zero says "the request never went out", and nothing more.

       The message, on the other hand, names the lead nobody guesses
       alone: a PWA served from a different port than the development
       server is ANOTHER origin, and gets refused in silence. Writing it
       costs one line and saves an evening. */
    throw new ServerError(
      `Pas de réponse de ${ADDRESS}. Serveur éteint, hors ligne — ou cette origine (${originHere()}) n'est pas autorisée par le serveur.`,
      0
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ServerError(
      (body as { erreur?: string }).erreur || `Erreur ${res.status}`,
      res.status
    );
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------
   LE COMPTE
   ------------------------------------------------------------ */

/**
/**
 * Who is signed in, or `null` if nobody.
 *
 * NOT BEING SIGNED IN AND NOT BEING ABLE TO ASK ARE TWO DIFFERENT
 * THINGS. Swallowing both into a `null` made the drawer say "everything
 * stays here" — that is, "you have no account" — to somebody who has one
 * and whose train is going through a tunnel. A refusal from the server
 * (401) returns `null`; an absence of network THROWS, and the caller
 * will know to say "waiting" rather than erase somebody.
 */
export async function whoAmI(): Promise<Person | null> {
  try {
    const r = await call<{ personne: Person }>("/moi");
    noteAccount(r.personne.id);
    return r.personne;
  } catch (e) {
    if ((e as ServerError).code === 0) throw e;
    noteAccount(null);
    return null;
  }
}

export async function signOut(): Promise<void> {
  await call("/deconnexion", { method: "POST" }).catch(() => {});
  noteAccount(null);
}

/* ------------------------------------------------------------
/* ------------------------------------------------------------
   "IS AN ACCOUNT OPEN?", FOR WHAT IS NOT A RENDER
   ------------------------------------------------------------

   The server's TMDB relay only accepts people who are signed in, and it
   is `src/tmdb.js` — a module with neither React nor context — that has
   to decide whether to go through it. So it needs a SYNCHRONOUS answer.

   The value is seeded from disk on load, with the last person
   synchronisation knew about: without that, the first seconds after
   opening would answer "no account" to somebody who has one, and the
   screen would show "a key is missing" before thinking better of it. It
   is only a HUNCH — if we are wrong, the relay answers 401 and the call
   goes back down the old path.

   `whoAmI` corrects that hunch on the first round trip, and it is the
   one that is authoritative. */
let account: string | null = store.get<string>("synchro-account", "") || null;

type Watcher = () => void;
const watchers = new Set<Watcher>();

function noteAccount(id: string | null): void {
  if (account === id) return;
  account = id;
  for (const fn of watchers) fn();
}

/** Is an account open, as far as we know? */
export const accountOpen = (): boolean => serverConfigured() && account !== null;

/** Be told when the answer changes. Returns an unsubscribe. */
export function watchAccount(fn: Watcher): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** What the server holds, in a single object — to take it away with you. */
export const myData = () => call<Record<string, unknown>>("/mes-donnees");

/**
/**
 * Deletes the account and everything hanging from it.
 *
 * The LOCAL collection is untouched: deleting your account means
 * removing your copy from the server, not dispossessing yourself of your
 * binder.
 */
export const deleteMyAccount = () =>
  call<{ efface: boolean }>("/mon-account", {
    method: "DELETE",
  });

/* PASSKEYS. The browser library is loaded ONLY when signing up or
   signing in: that is a hundred kilobytes nobody has to download to
   consult their video library. */
export async function signUp(pseudo: string): Promise<Person> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const { challenge, options } = await call<{ challenge: string; options: object }>(
    "/auth/inscription/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const response = await startRegistration({ optionsJSON: options as never });
  const r = await call<{ personne: Person }>("/auth/inscription/verification", {
    method: "POST",
    body: JSON.stringify({ challenge, response }),
  });
  noteAccount(r.personne.id);
  return r.personne;
}

export async function signIn(pseudo: string): Promise<Person> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const { challenge, options } = await call<{ challenge: string; options: object }>(
    "/auth/connexion/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const response = await startAuthentication({ optionsJSON: options as never });
  const r = await call<{ personne: Person }>("/auth/connexion/verification", {
    method: "POST",
    body: JSON.stringify({ challenge, response }),
  });
  noteAccount(r.personne.id);
  return r.personne;
}

/* ------------------------------------------------------------
   LA COLLECTION
   ------------------------------------------------------------ */

export interface CardToPush {
  id: string;
  tmdbId?: unknown;
  majLe: number;
  supprimee?: boolean;
  donnees?: unknown;
}

export interface Pulled {
  /** The server rank we have read up to. */
  jusqua: number;
  /** There is more: call again with the new rank. */
  encore?: boolean;
  fiches: { id: string; majLe: number; supprimee?: boolean; donnees: Record<string, unknown> }[];
}

export const pullFrom = (depuis: number): Promise<Pulled> =>
  call<Pulled>(`/collection?depuis=${depuis}`);

export const push = (fiches: CardToPush[]) =>
  call<{ rangees: number; perimees: number; illisibles: number; jusqua: number }>("/collection", {
    method: "PUT",
    body: JSON.stringify({ fiches }),
  });

/** The server's cap, repeated here to cut the sends up. */
export const PER_SEND = 500;

/* ------------------------------------------------------------
   LE RESTE DU CLASSEUR
   ------------------------------------------------------------ */

export interface DocToPush {
  cle: string;
  majLe: number;
  content: unknown;
  supprime?: boolean;
}

export interface PulledDocs {
  jusqua: number;
  encore?: boolean;
  documents: { cle: string; majLe: number; supprime?: boolean; content: unknown }[];
}

export const pullDocsFrom = (depuis: number): Promise<PulledDocs> =>
  call<PulledDocs>(`/documents?depuis=${depuis}`);

export const pushDocs = (documents: DocToPush[]) =>
  call<{ ranges: number; perimes: number; illisibles: number }>("/documents", {
    method: "PUT",
    body: JSON.stringify({ documents }),
  });

/** The server's cap for documents. */
export const DOCS_PER_SEND = 200;

/* ------------------------------------------------------------
   PARTAGER SA COLLECTION
   ------------------------------------------------------------ */

export type Sharing = "privee" | "lien" | "publique";

export interface SharedFilm {
  id: string;
  title?: string;
  year?: string | number;
  director?: string;
  poster?: string;
  rating?: number;
  review?: string;
  [k: string]: unknown;
}

/** What the collection shows right now, and to whom. */
export const mySharing = () => call<{ partage: Sharing; token: string | null }>("/partage");

export const setSharing = (partage: Sharing) =>
  call<{ partage: Sharing; token: string | null }>("/partage", {
    method: "PUT",
    body: JSON.stringify({ partage }),
  });

/** The cards kept out of the sharing — identifiers, nothing more. */
export const hiddenCards = () => call<{ ids: string[] }>("/fiches-cachees");

export const hideCard = (id: string, cachee: boolean) =>
  call<{ id: string; cachee: boolean }>(`/fiche/${encodeURIComponent(id)}/cachee`, {
    method: "PUT",
    body: JSON.stringify({ cachee }),
  });

/**
/**
 * Somebody's collection, seen from outside.
 *
 * WITH NO COOKIE AND NO ACCOUNT: it is a page opened from a link
 * received, often in a browser one has never set foot in. It must
 * require nothing.
 */
export async function collectionOf(
  pseudo: string,
  token?: string | null
): Promise<{ pseudo: string; films: SharedFilm[] }> {
  const q = token ? `?jeton=${encodeURIComponent(token)}` : "";
  return call<{ pseudo: string; films: SharedFilm[] }>(`/chez/${encodeURIComponent(pseudo)}${q}`);
}

/* ------------------------------------------------------------
   SUIVRE, ET LE FIL
   ------------------------------------------------------------ */

export interface Profile {
  pseudo: string;
  films: number;
  suivi?: boolean;
  /** For the subscriptions list: is their collection still open? */
  ouverte?: boolean;
}

export interface NewsItem {
  pseudo: string;
  id: string;
  tmdbId: string | null;
  le: number;
  film: SharedFilm;
}

export const profileOf = (pseudo: string) =>
  call<Profile>(`/profils/${encodeURIComponent(pseudo)}`);

export const follow = (pseudo: string) =>
  call<{ pseudo: string; suivi: boolean }>(`/abonnements/${encodeURIComponent(pseudo)}`, {
    method: "PUT",
  });

export const unfollow = (pseudo: string) =>
  call<{ pseudo: string; suivi: boolean }>(`/abonnements/${encodeURIComponent(pseudo)}`, {
    method: "DELETE",
  });

export const mySubscriptions = () => call<{ abonnements: Profile[] }>("/abonnements");

export const readFeed = (avant?: number | null) =>
  call<{ jusqua: number | null; nouvelles: NewsItem[] }>(`/fil${avant ? `?avant=${avant}` : ""}`);

/* ------------------------------------------------------------
   CE QU'ON DIT D'UNE ŒUVRE, ET COMMENT ON S'EN PROTÈGE
   ------------------------------------------------------------ */

export interface Opinion {
  pseudo: string;
  /** The card's id at its author's — that is what gets reported. */
  fiche: string;
  note: number | null;
  critique: string | null;
  le: string;
}

export interface Echo {
  collections: number;
  moyenne: number | null;
  notes: number;
  avis: Opinion[];
}

/**
/**
 * What the public collections say about a work.
 *
 * `tmdbId` IS THE ONLY POSSIBLE KEY: two people filing the same film
 * have two cards, two identifiers, often two titles. A card typed by
 * hand therefore has no echo, and that is consistent — it only exists at
 * home.
 */
export const echoOfWork = (tmdbId: string | number) =>
  call<Echo>(`/oeuvres/${encodeURIComponent(String(tmdbId))}`);

export const myBlocks = () => call<{ blocages: string[] }>("/blocages");

export const block = (pseudo: string) =>
  call<{ pseudo: string; bloque: boolean }>(`/blocages/${encodeURIComponent(pseudo)}`, {
    method: "PUT",
  });

export const unblock = (pseudo: string) =>
  call<{ pseudo: string; bloque: boolean }>(`/blocages/${encodeURIComponent(pseudo)}`, {
    method: "DELETE",
  });

export const report = (quoi: { pseudo: string; fiche: string; motif: string }) =>
  call<{ note: boolean; neuf: boolean }>("/signalements", {
    method: "POST",
    body: JSON.stringify(quoi),
  });

/* ------------------------------------------------------------
   THE LISTS, AND THE CHALLENGES DRAWN FROM THEM
   ------------------------------------------------------------ */

export interface List {
  id: string;
  titre: string;
  intention: string;
  publique: boolean;
  proprietaire: string;
  oeuvres: number;
  mienne?: boolean;
  membre?: boolean;
}

export interface ListWork {
  tmdb_id: string;
  titre: string;
  annee: string | null;
  /** Who put it there — `null` if that person has left. */
  par: string | null;
}

export interface Challenge {
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

/** One number per participant: the screening log does not go out. */
export interface Progress {
  pseudo: string;
  faites: number;
}

export const myLists = () => call<{ listes: List[] }>("/listes");

export const createList = (l: { titre: string; intention?: string; publique?: boolean }) =>
  call<{ id: string }>("/listes", { method: "POST", body: JSON.stringify(l) });

export const readList = (id: string) =>
  call<{ liste: List; oeuvres: ListWork[]; membres: string[] }>(
    `/listes/${encodeURIComponent(id)}`
  );

export const editList = (
  id: string,
  l: { titre?: string; intention?: string; publique?: boolean }
) =>
  call<{ fait: boolean }>(`/listes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(l),
  });

export const deleteList = (id: string) =>
  call<{ efface: boolean }>(`/listes/${encodeURIComponent(id)}`, { method: "DELETE" });

export const addToList = (
  id: string,
  o: { tmdbId: string | number; titre?: string; annee?: string | number }
) =>
  call<{ ajoute: boolean; neuf: boolean }>(`/listes/${encodeURIComponent(id)}/oeuvres`, {
    method: "POST",
    body: JSON.stringify({ ...o, annee: o.annee == null ? undefined : String(o.annee) }),
  });

export const removeFromList = (id: string, tmdbId: string) =>
  call<{ retire: boolean }>(
    `/listes/${encodeURIComponent(id)}/oeuvres/${encodeURIComponent(tmdbId)}`,
    { method: "DELETE" }
  );

export const inviteToList = (id: string, pseudo: string) =>
  call<{ pseudo: string; membre: boolean }>(
    `/listes/${encodeURIComponent(id)}/membres/${encodeURIComponent(pseudo)}`,
    { method: "PUT" }
  );

export const removeFromListMembers = (id: string, pseudo: string) =>
  call<{ pseudo: string; membre: boolean }>(
    `/listes/${encodeURIComponent(id)}/membres/${encodeURIComponent(pseudo)}`,
    { method: "DELETE" }
  );

export const myChallenges = () => call<{ defis: Challenge[] }>("/defis");

export const createChallenge = (d: {
  listeId: string;
  titre: string;
  debut: string;
  fin: string;
}) => call<{ id: string }>("/defis", { method: "POST", body: JSON.stringify(d) });

export const readChallenge = (id: string) =>
  call<{ challenge: Challenge; oeuvres: ListWork[]; avancement: Progress[] }>(
    `/defis/${encodeURIComponent(id)}`
  );

export const deleteChallenge = (id: string) =>
  call<{ efface: boolean }>(`/defis/${encodeURIComponent(id)}`, { method: "DELETE" });

export const joinChallenge = (id: string) =>
  call<{ dedans: boolean }>(`/defis/${encodeURIComponent(id)}/participation`, { method: "PUT" });

export const leaveChallenge = (id: string) =>
  call<{ dedans: boolean }>(`/defis/${encodeURIComponent(id)}/participation`, {
    method: "DELETE",
  });
