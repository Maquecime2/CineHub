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
   with a slash, and "…:8787//me" is not "…:8787/me". */
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
    throw new ServerError((body as { error?: string }).error || `Erreur ${res.status}`, res.status);
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
    const r = await call<{ who: Person }>("/me");
    noteAccount(r.who.id);
    return r.who;
  } catch (e) {
    if ((e as ServerError).code === 0) throw e;
    noteAccount(null);
    return null;
  }
}

export async function signOut(): Promise<void> {
  await call("/signout", { method: "POST" }).catch(() => {});
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
export const myData = () => call<Record<string, unknown>>("/my-data");

/**
/**
 * Deletes the account and everything hanging from it.
 *
 * The LOCAL collection is untouched: deleting your account means
 * removing your copy from the server, not dispossessing yourself of your
 * binder.
 */
export const deleteMyAccount = () =>
  call<{ erased: boolean }>("/my-account", {
    method: "DELETE",
  });

/* PASSKEYS. The browser library is loaded ONLY when signing up or
   signing in: that is a hundred kilobytes nobody has to download to
   consult their video library. */
export async function signUp(pseudo: string): Promise<Person> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const { challenge, options } = await call<{ challenge: string; options: object }>(
    "/auth/signup/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const response = await startRegistration({ optionsJSON: options as never });
  const r = await call<{ who: Person }>("/auth/signup/verify", {
    method: "POST",
    body: JSON.stringify({ challenge, response }),
  });
  noteAccount(r.who.id);
  return r.who;
}

export async function signIn(pseudo: string): Promise<Person> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const { challenge, options } = await call<{ challenge: string; options: object }>(
    "/auth/signin/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const response = await startAuthentication({ optionsJSON: options as never });
  const r = await call<{ who: Person }>("/auth/signin/verify", {
    method: "POST",
    body: JSON.stringify({ challenge, response }),
  });
  noteAccount(r.who.id);
  return r.who;
}

/* ------------------------------------------------------------
   LA COLLECTION
   ------------------------------------------------------------ */

export interface CardToPush {
  id: string;
  tmdbId?: unknown;
  updatedAt: number;
  deleted?: boolean;
  data?: unknown;
}

export interface Pulled {
  /** The server rank we have read up to. */
  upTo: number;
  /** There is more: call again with the new rank. */
  more?: boolean;
  cards: { id: string; updatedAt: number; deleted?: boolean; data: Record<string, unknown> }[];
}

export const pullFrom = (since: number): Promise<Pulled> =>
  call<Pulled>(`/collection?since=${since}`);

export const push = (cards: CardToPush[]) =>
  call<{ filed: number; stale: number; unreadable: number; upTo: number }>("/collection", {
    method: "PUT",
    body: JSON.stringify({ cards }),
  });

/** The server's cap, repeated here to cut the sends up. */
export const PER_SEND = 500;

/* ------------------------------------------------------------
   LE RESTE DU CLASSEUR
   ------------------------------------------------------------ */

export interface DocToPush {
  key: string;
  updatedAt: number;
  content: unknown;
  supprime?: boolean;
}

export interface PulledDocs {
  upTo: number;
  more?: boolean;
  documents: { key: string; updatedAt: number; supprime?: boolean; content: unknown }[];
}

export const pullDocsFrom = (since: number): Promise<PulledDocs> =>
  call<PulledDocs>(`/documents?since=${since}`);

export const pushDocs = (documents: DocToPush[]) =>
  call<{ filed: number; stale: number; unreadable: number }>("/documents", {
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
export const mySharing = () => call<{ sharing: Sharing; token: string | null }>("/sharing");

export const setSharing = (sharing: Sharing) =>
  call<{ sharing: Sharing; token: string | null }>("/sharing", {
    method: "PUT",
    body: JSON.stringify({ sharing }),
  });

/** The cards kept out of the sharing — identifiers, nothing more. */
export const hiddenCards = () => call<{ ids: string[] }>("/hidden-cards");

export const hideCard = (id: string, hidden: boolean) =>
  call<{ id: string; hidden: boolean }>(`/cards/${encodeURIComponent(id)}/hidden`, {
    method: "PUT",
    body: JSON.stringify({ hidden }),
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
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return call<{ pseudo: string; films: SharedFilm[] }>(
    `/collections/${encodeURIComponent(pseudo)}${q}`
  );
}

/* ------------------------------------------------------------
   SUIVRE, ET LE FIL
   ------------------------------------------------------------ */

export interface Profile {
  pseudo: string;
  films: number;
  followed?: boolean;
  /** For the subscriptions list: is their collection still open? */
  ouverte?: boolean;
}

export interface NewsItem {
  pseudo: string;
  id: string;
  tmdbId: string | null;
  at: number;
  film: SharedFilm;
}

export const profileOf = (pseudo: string) =>
  call<Profile>(`/profiles/${encodeURIComponent(pseudo)}`);

export const follow = (pseudo: string) =>
  call<{ pseudo: string; followed: boolean }>(`/follows/${encodeURIComponent(pseudo)}`, {
    method: "PUT",
  });

export const unfollow = (pseudo: string) =>
  call<{ pseudo: string; followed: boolean }>(`/follows/${encodeURIComponent(pseudo)}`, {
    method: "DELETE",
  });

export const mySubscriptions = () => call<{ subscriptions: Profile[] }>("/follows");

export const readFeed = (before?: number | null) =>
  call<{ upTo: number | null; news: NewsItem[] }>(`/feed${before ? `?before=${before}` : ""}`);

/* ------------------------------------------------------------
   CE QU'ON DIT D'UNE ŒUVRE, ET COMMENT ON S'EN PROTÈGE
   ------------------------------------------------------------ */

export interface Opinion {
  pseudo: string;
  /** The card's id at its author's — that is what gets reported. */
  card: string;
  rating: number | null;
  review: string | null;
  at: string;
}

export interface Echo {
  collections: number;
  mean: number | null;
  ratings: number;
  reviews: Opinion[];
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
  call<Echo>(`/works/${encodeURIComponent(String(tmdbId))}`);

export const myBlocks = () => call<{ blocks: string[] }>("/blocks");

export const block = (pseudo: string) =>
  call<{ pseudo: string; blocked: boolean }>(`/blocks/${encodeURIComponent(pseudo)}`, {
    method: "PUT",
  });

export const unblock = (pseudo: string) =>
  call<{ pseudo: string; blocked: boolean }>(`/blocks/${encodeURIComponent(pseudo)}`, {
    method: "DELETE",
  });

export const report = (what: { pseudo: string; card: string; reason: string }) =>
  call<{ noted: boolean; fresh: boolean }>("/reports", {
    method: "POST",
    body: JSON.stringify(what),
  });

/* ------------------------------------------------------------
   THE LISTS, AND THE CHALLENGES DRAWN FROM THEM
   ------------------------------------------------------------ */

export interface List {
  id: string;
  title: string;
  intent: string;
  is_public: boolean;
  owner: string;
  works: number;
  mienne?: boolean;
  isMember?: boolean;
}

export interface ListWork {
  tmdb_id: string;
  title: string;
  year: string | null;
  /** Who put it there — `null` if that person has left. */
  per: string | null;
}

export interface Challenge {
  id: string;
  title: string;
  liste_id: string;
  list: string;
  starts_on: string;
  ends_on: string;
  per: string | null;
  works: number;
  inside?: boolean;
}

/** One number per participant: the screening log does not go out. */
export interface Progress {
  pseudo: string;
  done: number;
}

export const myLists = () => call<{ lists: List[] }>("/lists");

export const createList = (l: { title: string; intent?: string; is_public?: boolean }) =>
  call<{ id: string }>("/lists", { method: "POST", body: JSON.stringify(l) });

export const readList = (id: string) =>
  call<{ list: List; works: ListWork[]; members: string[] }>(`/lists/${encodeURIComponent(id)}`);

export const editList = (id: string, l: { title?: string; intent?: string; is_public?: boolean }) =>
  call<{ done: boolean }>(`/lists/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(l),
  });

export const deleteList = (id: string) =>
  call<{ erased: boolean }>(`/lists/${encodeURIComponent(id)}`, { method: "DELETE" });

export const addToList = (
  id: string,
  o: { tmdbId: string | number; title?: string; year?: string | number }
) =>
  call<{ added: boolean; fresh: boolean }>(`/lists/${encodeURIComponent(id)}/works`, {
    method: "POST",
    body: JSON.stringify({ ...o, year: o.year == null ? undefined : String(o.year) }),
  });

export const removeFromList = (id: string, tmdbId: string) =>
  call<{ removed: boolean }>(
    `/lists/${encodeURIComponent(id)}/works/${encodeURIComponent(tmdbId)}`,
    { method: "DELETE" }
  );

export const inviteToList = (id: string, pseudo: string) =>
  call<{ pseudo: string; isMember: boolean }>(
    `/lists/${encodeURIComponent(id)}/members/${encodeURIComponent(pseudo)}`,
    { method: "PUT" }
  );

export const removeFromListMembers = (id: string, pseudo: string) =>
  call<{ pseudo: string; isMember: boolean }>(
    `/lists/${encodeURIComponent(id)}/members/${encodeURIComponent(pseudo)}`,
    { method: "DELETE" }
  );

export const myChallenges = () => call<{ challenges: Challenge[] }>("/challenges");

export const createChallenge = (d: {
  listeId: string;
  title: string;
  starts_on: string;
  ends_on: string;
}) => call<{ id: string }>("/challenges", { method: "POST", body: JSON.stringify(d) });

export const readChallenge = (id: string) =>
  call<{ challenge: Challenge; works: ListWork[]; progress: Progress[] }>(
    `/challenges/${encodeURIComponent(id)}`
  );

export const deleteChallenge = (id: string) =>
  call<{ erased: boolean }>(`/challenges/${encodeURIComponent(id)}`, { method: "DELETE" });

export const joinChallenge = (id: string) =>
  call<{ inside: boolean }>(`/challenges/${encodeURIComponent(id)}/participation`, {
    method: "PUT",
  });

export const leaveChallenge = (id: string) =>
  call<{ inside: boolean }>(`/challenges/${encodeURIComponent(id)}/participation`, {
    method: "DELETE",
  });
