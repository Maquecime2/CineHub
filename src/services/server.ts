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
import type { Gain } from "../domain/points";
import { readPerson, type Person, type PersonReply } from "./contract";

export const ADDRESS: string = (
  import.meta.env.VITE_SERVEUR || (import.meta.env.DEV ? "http://localhost:8787" : "")
)
  .trim()
  .replace(/\/+$/, "");

export const serverConfigured = (): boolean => ADDRESS !== "";

/** Where this page speaks from — it is what the server must allow. */
export const originHere = (): string => (typeof location === "undefined" ? "?" : location.origin);

/* The shape of a reply is not ours to invent: it is the server's, and it
   is written in `contract.ts`, which both packages read. See that file —
   it carries the failure that put it there. */
export type { Person } from "./contract";

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
 * and whose train is going through a tunnel. A refusal of the SESSION
 * returns `null`; anything else THROWS, and the caller will know to say
 * "waiting" rather than erase somebody.
 *
 * AND THE LINE RAN IN THE WRONG PLACE, which cost a whole collection of
 * screenshots. It used to be drawn between "the network is silent"
 * (code 0) and "the server answered" — so a 429, a 500, a gateway in
 * trouble all meant "you are nobody". The 429 is the one that happened:
 * the general ceiling is a hundred requests a minute, a binder arriving
 * on a second computer goes through it in seconds, and `/me` was among
 * the refused. The account was then erased on this side, `accountOpen()`
 * went false, and `pullMedia` returned BEFORE making any request at all
 * — not one ticket left the page, and every screenshot on screen said
 * it had stayed on the other device.
 *
 * Only 401 and 403 answer the question "who are you"; every other code
 * says the question was not answered. */
const SESSION_REFUSED = [401, 403];

export async function whoAmI(): Promise<Person | null> {
  try {
    const who = readPerson(await call<PersonReply>("/me"));
    noteAccount(who.id);
    rememberPerson(who);
    return who;
  } catch (e) {
    if (!SESSION_REFUSED.includes((e as ServerError).code)) throw e;
    /* A REFUSAL, not a silence: the server answered, and it answered
       that we are nobody. The hunch is wrong and must go — keeping it
       would show a name to somebody whose session has expired. */
    noteAccount(null);
    rememberPerson(null);
    return null;
  }
}

export async function signOut(): Promise<void> {
  await call("/signout", { method: "POST" }).catch(() => {});
  noteAccount(null);
  rememberPerson(null);
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
/* Read here and by `media.remotePath`, which spells it out on its side —
   the two must not drift apart again. */
const ACCOUNT_KEY = "synchro-account";

let account: string | null = store.get<string>(ACCOUNT_KEY, "") || null;

/* ============================================================
   THE LAST PERSON WE KNEW ABOUT — a hunch, kept on disk
   ============================================================

   The identifier above answers "is an account open?", which is enough
   for the TMDB relay and for nothing else: the screens need a NAME, and
   they had no way to know one until a round trip came back. So on every
   reload, for as long as the first synchronisation took, the lists view
   said "it takes an account" and the drawer offered to create one — to
   somebody who has had one for months.

   This is the same hunch as `account`, carrying one field more. It is
   corrected by `whoAmI` on the first round trip, and it grants nothing:
   the cookie is what opens doors, and the server is the only thing that
   reads it. Being wrong here shows a name for a second, and the routes
   go on answering 401 exactly as before. */
const LAST_PERSON = "synchro-person";

export const lastKnownPerson = (): Person | null => store.get<Person | null>(LAST_PERSON, null);

const rememberPerson = (who: Person | null): void => {
  store.set(LAST_PERSON, who);
};

type Watcher = () => void;
const watchers = new Set<Watcher>();

/* THE IDENTIFIER IS WRITTEN DOWN, and this is the only place it is.
 *
 * Two readers depend on it and neither could see it before: the seed at
 * the top of this file, which is why the hunch it describes was empty on
 * every reload; and `media.remotePath`, which builds the private prefix
 * `p/<person id>/<key>` out of it. Without the second, every poster and
 * every screenshot had NO ADDRESS — no address, no ticket, nothing
 * uploaded, and no error anywhere to say so. The decors were spared
 * because their branch reads a decor's server id, never this one.
 *
 * `noteAccount` is the single door the value changes through, so the
 * write belongs here rather than at each of `whoAmI`'s call sites. */
function noteAccount(id: string | null): void {
  if (account === id) return;
  account = id;
  store.set(ACCOUNT_KEY, id ?? "");
  for (const fn of watchers) fn();
}

/** Is an account open, as far as we know? */
export const accountOpen = (): boolean => serverConfigured() && account !== null;

/**
 * May I write quizzes?
 *
 * A HUNCH, LIKE EVERYTHING ELSE ON THIS SIDE, and it grants nothing: it
 * decides whether an editor is drawn, never whether a question is
 * written. Every route that writes one asks the server, which asks the
 * `person` row — so being wrong here shows an editor that answers 403,
 * and nothing worse.
 *
 * It reads the same remembered person the screens read for a name, which
 * is why it needs no round trip of its own and no cache to keep in
 * agreement with anything.
 */
export const iAmAdmin = (): boolean => accountOpen() && lastKnownPerson()?.is_admin === true;

/** Be told when the answer changes. Returns an unsubscribe. */
export function watchAccount(fn: Watcher): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/* ============================================================
   DOES THIS SERVER RELAY TMDB?
   ============================================================

   The binder asks everybody for a TMDB key, and for somebody signed in
   against a server that HAS one that request is pure noise: the relay
   answers, the key is never used, and the panel goes on saying a key is
   missing. But it is not always noise — a server started without
   `TMDB_KEY` answers 503, and then the key one types is the only way
   Discoveries and the posters work at all.

   So we ask, once, and cache the answer: it changes when the server is
   restarted, not while somebody is reading a screen. */
let relayKnown: boolean | null = null;

export async function relayServesTmdb(): Promise<boolean> {
  if (relayKnown !== null) return relayKnown;
  if (!serverConfigured()) return false;
  try {
    const r = await call<{ tmdb?: boolean }>("/health");
    relayKnown = r.tmdb === true;
  } catch {
    /* Unreachable: we say nothing rather than promise a relay that may
       not be there. The key panel then behaves exactly as it always
       has. */
    return false;
  }
  return relayKnown;
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
  const who = readPerson(
    await call<PersonReply>("/auth/signup/verify", {
      method: "POST",
      body: JSON.stringify({ challenge, response }),
    })
  );
  noteAccount(who.id);
  rememberPerson(who);
  return who;
}

export async function signIn(pseudo: string): Promise<Person> {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const { challenge, options } = await call<{ challenge: string; options: object }>(
    "/auth/signin/options",
    { method: "POST", body: JSON.stringify({ pseudo }) }
  );
  const response = await startAuthentication({ optionsJSON: options as never });
  const who = readPerson(
    await call<PersonReply>("/auth/signin/verify", {
      method: "POST",
      body: JSON.stringify({ challenge, response }),
    })
  );
  noteAccount(who.id);
  rememberPerson(who);
  return who;
}

/* ------------------------------------------------------------
   LES AUTRES APPAREILS
   ------------------------------------------------------------

   A PASSKEY DOES NOT TRAVEL. The one Windows Hello made stays in that
   computer: no export takes it out, no cloud carries it. So an account
   opened on one machine was shut inside it, and the way out is not to
   move that key — it is to add a SECOND one, held by something that goes
   about with you.

   A telephone is that something. Register its passkey here, and any
   other computer can then sign in by showing a QR code for it to scan:
   nothing to type, nothing to copy, and the key itself never crosses. */

export interface DeviceKey {
  id: string;
  device: string | null;
  transports: string[];
  created_at: string;
  seen_at: string | null;
}

export const myKeys = () => call<{ keys: DeviceKey[] }>("/auth/keys").then((r) => r.keys);

/**
 * Registers a new passkey on the account that is already open.
 *
 * The `device` is only a name to recognise it by in the list; it is not
 * checked and carries no authority.
 */
export async function addKey(
  device?: string,
  /** `"phone"` asks for the QR ceremony; `"here"` for this machine's own sensor. */
  where: "phone" | "here" = "phone"
): Promise<DeviceKey[]> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const { challenge, options } = await call<{ challenge: string; options: object }>(
    "/auth/keys/options",
    { method: "POST", body: JSON.stringify({ where }) }
  );
  const response = await startRegistration({ optionsJSON: options as never });
  const r = await call<{ keys: DeviceKey[] }>("/auth/keys/verify", {
    method: "POST",
    body: JSON.stringify({ challenge, response, device }),
  });
  return r.keys;
}

/* The server refuses to remove the last one — with a sentence, which the
   drawer displays as it stands. We do not repeat the rule here: two
   copies of a rule become one true and one false. */
export const forgetKey = (id: string) =>
  call<{ keys: DeviceKey[] }>(`/auth/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then((r) => r.keys);

/* ---------- PAIRING BY CODE ----------

   THE DOOR THE PASSKEYS CANNOT OPEN. A passkey is signed for a domain,
   and on `localhost` each computer is its own: two machines at home have
   no domain in common, so there is nothing for a telephone to sign for
   and the QR ceremony cannot help at all.

   A code can. A week, one use, and what it buys is a session — from
   which the ordinary synchronisation brings back the collection, the
   arrangement, the cabinet, and the machine registers a passkey of its
   own so it never needs a code again. */

export const makePairingCode = () =>
  call<{ code: string; days: number }>("/auth/pair", { method: "POST" });

export const claimPairingCode = (code: string) =>
  call<PersonReply>("/auth/pair/claim", {
    method: "POST",
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  }).then((r) => {
    const who = readPerson(r);
    noteAccount(who.id);
    rememberPerson(who);
    return who;
  });

/* ------------------------------------------------------------
   LES MÉDIAS, ET LES OBJETS DE DÉCORATION
   ------------------------------------------------------------

   The container's key stays on the server; what comes back here is a
   signature for ONE blob, valid a quarter of an hour. So these calls
   look odd on purpose — they fetch permission, and the bytes then travel
   between the browser and Azure without passing through the server at
   all. */

export const mediaTickets = (paths: string[], mode: "read" | "write" = "write") =>
  call<{ tickets: { path: string; url: string }[] }>("/media/tickets", {
    method: "POST",
    body: JSON.stringify({ paths, mode }),
  }).then((r) => r.tickets);

/** A read ticket, or `null` when there is nothing there for us. */
export const mediaTicket = (path: string) =>
  call<{ url: string }>(`/media/ticket?path=${encodeURIComponent(path)}`)
    .then((r) => r.url)
    /* A 404 here means "not there, or not yours", deliberately without
       distinction: this is not an error to show, it is an answer. */
    .catch(() => null);

/* Erasing is writing, so the server checks the same thing: a decor one
   has merely COPIED answers 404 here, and that is the wanted answer. */
export const mediaDeleteTicket = (path: string) =>
  call<{ url: string }>(`/media?path=${encodeURIComponent(path)}`, { method: "DELETE" })
    .then((r) => r.url)
    .catch(() => null);

export interface RemoteDecor {
  id: string;
  owner: string;
  label: string;
  wall: string;
  kind: "raster" | "svg";
  tintable: boolean;
  bytes: number;
  is_public: boolean;
  mine?: boolean;
}

export const myRemoteDecor = () => call<{ decor: RemoteDecor[] }>("/decor").then((r) => r.decor);

/** What the people one follows have put on show. */
export const sharedDecor = () =>
  call<{ decor: RemoteDecor[] }>("/decor/shared").then((r) => r.decor);

export const createRemoteDecor = (d: {
  label: string;
  wall?: string;
  kind?: "raster" | "svg";
  tintable?: boolean;
  bytes?: number;
}) =>
  call<{ decor: RemoteDecor; path: string }>("/decor", {
    method: "POST",
    body: JSON.stringify(d),
  });

export const showDecor = (id: string, is_public: boolean) =>
  call<{ decor: RemoteDecor }>(`/decor/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ is_public }),
  });

/* ONE ROUTE, TWO GESTURES, AND THE SERVER TELLS THEM APART. Its author
   WITHDRAWS the piece; anybody else gives back their own copy, and the
   original does not move. `withdrawn` says which of the two happened. */
export const dropRemoteDecor = (id: string) =>
  call<{ withdrawn: boolean }>(`/decor/${encodeURIComponent(id)}`, { method: "DELETE" });

export const takeRemoteDecor = (id: string) =>
  call<{ decor: RemoteDecor; path: string }>(`/decor/${encodeURIComponent(id)}/copy`, {
    method: "POST",
  });

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
  /* The server's word, and the only one: it reads `deleted` on the way in
     and writes `deleted` on the way out. Spelling it `supprime` here left
     every tombstone unread in both directions. */
  deleted?: boolean;
}

export interface PulledDocs {
  upTo: number;
  more?: boolean;
  documents: { key: string; updatedAt: number; deleted?: boolean; content: unknown }[];
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
): Promise<{ pseudo: string; stamp: string | null; films: SharedFilm[] }> {
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return call<{ pseudo: string; stamp: string | null; films: SharedFilm[] }>(
    `/collections/${encodeURIComponent(pseudo)}${q}`
  );
}

/* ------------------------------------------------------------
   SUIVRE, ET LE FIL
   ------------------------------------------------------------ */

export interface Profile {
  pseudo: string;
  /** Le cachet porté au comptoir, visible partout où le pseudonyme l'est. */
  stamp?: string | null;
  films: number;
  followed?: boolean;
  /** For the subscriptions list: is their collection still open? */
  ouverte?: boolean;
}

export interface NewsItem {
  pseudo: string;
  stamp?: string | null;
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
   WHAT IS SAID ABOUT A WORK, AND HOW ONE IS PROTECTED FROM IT
   ------------------------------------------------------------ */

export interface Opinion {
  pseudo: string;
  stamp?: string | null;
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

/* `listId`, AND THE SERVER READS NOTHING ELSE. It used to be sent as
   `listeId` — a leftover of the French vocabulary — so the route found
   no list identifier at all, failed its UUID test, and answered "Liste
   inconnue" with a 404 on a list that was right there. Nothing on either
   side reported a mismatch: an undefined field is not an error, it is an
   absent one. */
export const createChallenge = (d: {
  listId: string;
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

/* ------------------------------------------------------------
   THE BANK, AND THE QUIZZES DRAWN FROM IT
   ------------------------------------------------------------
   EVERY FIELD BELOW IS SPELLED AS THE SERVER SPELLS IT. The lists and
   challenges just above do not — `liste_id` and `per` where the server
   sends `list_id` and `by` — and each of those was a bug caught late,
   because an absent field is not an error, it is `undefined`. */

/** A basket, and what it holds — the counts decide whether to offer it. */
export interface Category {
  id: string;
  label: string;
  blurb: string;
  easy: number;
  normal: number;
  hard: number;
}

/** A question as the BANK holds it: corrections included, admins only. */
export interface BankQuestion {
  id: string;
  category_id: string;
  ask: string;
  hint: string;
  image: string | null;
  difficulty: string;
  /** Withdrawn: never dealt again, still readable where it was dealt. */
  retired: boolean;
  choices: { id: string; label: string; is_right: boolean }[];
}

/** What the bank editor sends. */
export interface QuestionDraft {
  ask: string;
  hint?: string;
  image?: string | null;
  difficulty?: string;
  choices: { label: string; is_right: boolean }[];
}

export interface Quiz {
  id: string;
  title: string;
  level: string;
  size: number;
  /** The bank was too thin for the mix, and the quiz says so. */
  softened: boolean;
  owner: string;
  topics: string[];
  /** Mine to invite into and to erase. Never a right to see the answers. */
  mine?: boolean;
  answered?: number;
  finished?: boolean;
}

export interface QuizQuestion {
  id: string;
  rank: number;
  ask: string;
  image: string | null;
  points: number;
  category: string;
  /** ABSENT while one is still playing — the server withholds them. */
  hint?: string;
  choices: { id: string; label: string; is_right?: boolean }[];
  mine?: string | null;
}

export interface QuizAttempt {
  started_at: string;
  finished_at: string | null;
}

export interface QuizScore {
  pseudo: string;
  score: number;
  answered: number;
  finished: boolean;
}

/* ---- the bank ---- */

export const quizCategories = () => call<{ categories: Category[] }>("/categories");

export const createCategory = (c: { label: string; blurb?: string }) =>
  call<{ id: string }>("/categories", { method: "POST", body: JSON.stringify(c) });

export const editCategory = (id: string, c: { label?: string; blurb?: string }) =>
  call<{ done: boolean }>(`/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(c),
  });

export const deleteCategory = (id: string) =>
  call<{ erased: boolean }>(`/categories/${encodeURIComponent(id)}`, { method: "DELETE" });

export const bankQuestions = (id: string) =>
  call<{ questions: BankQuestion[] }>(`/categories/${encodeURIComponent(id)}/questions`);

export const addBankQuestion = (id: string, q: QuestionDraft) =>
  call<{ id: string }>(`/categories/${encodeURIComponent(id)}/questions`, {
    method: "POST",
    body: JSON.stringify(q),
  });

/**
 * `choicesFrozen` comes back true when the question has already been
 * dealt: the wording was corrected, the propositions were not. The
 * screen has to say so — silently keeping the old four would look like
 * the save had failed.
 */
export const editBankQuestion = (id: string, questionId: string, q: QuestionDraft) =>
  call<{ done: boolean; choicesFrozen: boolean }>(
    `/categories/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`,
    { method: "PUT", body: JSON.stringify(q) }
  );

/** `fate` is `"gone"` or `"retired"` — erased, or merely withdrawn. */
export const removeBankQuestion = (id: string, questionId: string) =>
  call<{ fate: "gone" | "retired" }>(
    `/categories/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`,
    { method: "DELETE" }
  );

export const reviveBankQuestion = (id: string, questionId: string) =>
  call<{ revived: boolean }>(
    `/categories/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}/revival`,
    { method: "POST" }
  );

/* ---- the quizzes ---- */

export const myQuizzes = () => call<{ quizzes: Quiz[] }>("/quizzes");

/**
 * DEAL ONE. There is no editing afterwards but the title: re-drawing
 * under people who have started answering is how a leaderboard becomes a
 * lie, and another quiz costs one gesture.
 */
export const drawQuiz = (q: {
  title: string;
  categoryIds: string[];
  level: string;
  size: number;
}) =>
  call<{ id: string; softened: boolean; drawn: number }>("/quizzes", {
    method: "POST",
    body: JSON.stringify(q),
  });

export const readQuiz = (id: string) =>
  call<{
    quiz: Quiz;
    questions: QuizQuestion[];
    /** What the whole thing is worth — the same for two of a level. */
    weight: number;
    attempt: QuizAttempt | null;
    players: string[];
  }>(`/quizzes/${encodeURIComponent(id)}`);

export const renameQuiz = (id: string, title: string) =>
  call<{ done: boolean }>(`/quizzes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });

export const deleteQuiz = (id: string) =>
  call<{ erased: boolean }>(`/quizzes/${encodeURIComponent(id)}`, { method: "DELETE" });

export const invitePlayer = (id: string, pseudo: string) =>
  call<{ pseudo: string; playing: boolean }>(
    `/quizzes/${encodeURIComponent(id)}/players/${encodeURIComponent(pseudo)}`,
    { method: "PUT" }
  );

export const removePlayer = (id: string, pseudo: string) =>
  call<{ pseudo: string; playing: boolean }>(
    `/quizzes/${encodeURIComponent(id)}/players/${encodeURIComponent(pseudo)}`,
    { method: "DELETE" }
  );

export const startQuiz = (id: string) =>
  call<{ attempt: QuizAttempt }>(`/quizzes/${encodeURIComponent(id)}/attempt`, { method: "POST" });

export const answerQuiz = (id: string, questionId: string, choiceId: string) =>
  call<{ answered: boolean }>(`/quizzes/${encodeURIComponent(id)}/attempt/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, choiceId }),
  });

/** Closing it is what brings the corrections down — not a moment before. */
export const finishQuiz = (id: string) =>
  call<{
    attempt: QuizAttempt;
    questions: QuizQuestion[];
    /* CE QUI A ÉTÉ RÉELLEMENT CRÉDITÉ, ligne par ligne — et non ce que
       le barème laissait espérer. Une partie close deux fois, sur une
       connexion qui a lâché, ne paie qu'une seule fois, et l'écran doit
       le dire plutôt que d'afficher un tarif. */
    gains: Gain[];
    purse: { merit: number; tokens: number };
  }>(`/quizzes/${encodeURIComponent(id)}/attempt/finish`, { method: "POST" });

export const quizScores = (id: string) =>
  call<{ scores: QuizScore[] }>(`/quizzes/${encodeURIComponent(id)}/scores`);

/* ------------------------------------------------------------
   LE COMPTOIR — la bourse, les palmarès, la boutique
   ------------------------------------------------------------

   AUCUNE DE CES FONCTIONS N'ENVOIE UN MONTANT. Ce qu'une chose vaut se
   lit sur le serveur, contre un fait qu'il vient d'écrire lui-même ; le
   classeur en garde une copie (`domain/points.ts`) pour ANNONCER un
   chiffre sans aller-retour, jamais pour en réclamer un.

   Comme partout ici, l'absence de serveur ou de compte ne se gère pas
   par un message d'erreur : la vue entière ne se dessine pas. */

/** Les deux compteurs, et où l'on se situe. */
export interface Purse {
  /** Cumulé, jamais dépensé : c'est lui qui classe. */
  merit: number;
  /** Le même chiffre, moins ce qui est passé au comptoir. */
  tokens: number;
  /** Sa vraie place au classement mondial, même hors de la page. */
  standing: number | null;
  /** « non », « suivis » ou « tous » — où l'on accepte d'apparaître. */
  ladder: string;
}

export interface Rank {
  pseudo: string;
  merit: number;
  rank: number;
  me: boolean;
  stamp: string | null;
}

export interface ShopItem {
  id: string;
  kind: "stamp" | "pack" | "skin" | "power";
  price: number;
  /** Pour une peau : la clé qu'elle ouvre dans le catalogue du classeur. */
  grants?: string;
  power?: string;
  draws?: number;
  owned?: boolean;
  /** Pour un pouvoir : combien il en reste. */
  held?: number;
}

export interface Holdings {
  items: string[];
  stickers: { sticker_id: string; copies: number }[];
  powers: Record<string, number>;
  worn: { stamp: string | null; skin: string | null };
}

export const myPurse = () => call<Purse>("/purse");

export const ladder = (scope: "world" | "friends") =>
  call<{ ranks: Rank[] }>(`/ladder/${scope}`).then((r) => r.ranks);

export const setLadder = (ladder: "non" | "suivis" | "tous") =>
  call<{ ladder: string }>("/ladder/mine", {
    method: "PATCH",
    body: JSON.stringify({ ladder }),
  });

export const shop = () => call<{ items: ShopItem[] }>("/shop").then((r) => r.items);

export const myHoldings = () => call<Holdings>("/shop/mine");

/** Le hasard d'une pochette est tiré et écrit SUR LE SERVEUR : recharger
    la page ne le rejoue pas. `drawn` est ce qui vient d'en sortir. */
export const buy = (item: string) =>
  call<{ purse: { merit: number; tokens: number }; drawn: string[] }>("/shop/buy", {
    method: "POST",
    body: JSON.stringify({ item }),
  });

export const wear = (what: { stamp?: string | null; skin?: string | null }) =>
  call<{ stamp: string | null; skin: string | null }>("/shop/worn", {
    method: "PATCH",
    body: JSON.stringify(what),
  });

/* ---- les pouvoirs ---- */

/** Rend les propositions à masquer — jamais la bonne réponse, et
    toujours les MÊMES si on redemande. */
export const halveQuestion = (quizId: string, questionId: string) =>
  call<{ removed: string[]; left: number }>(
    `/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/halve`,
    { method: "POST" }
  );

export const redoQuestion = (quizId: string, questionId: string) =>
  call<{ left: number }>(
    `/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/redo`,
    { method: "POST" }
  );

export const extendChallenge = (id: string) =>
  call<{ ends_on: string; extensions: number }>(`/challenges/${encodeURIComponent(id)}/extend`, {
    method: "POST",
  });

/** Clôt les comptes d'un défi fini. Le premier qui regarde solde pour
    tout le monde ; les suivants ne paient personne deux fois. */
export const settleChallenge = (id: string) =>
  call<{ awarded: number }>(`/challenges/${encodeURIComponent(id)}/settle`, { method: "POST" });
