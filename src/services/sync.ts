/* ============================================================
/* ============================================================
   SYNCHRONISATION — local first, always
   ============================================================

   THE ORDER OF THE TWO HALVES IS NOT INDIFFERENT: we PULL first, we PUSH
   second. Pulling first brings in what the other devices know, and the
   merge then decides in full knowledge. Pushing first would send cards
   that are about to be replaced three seconds later — work for nothing,
   and a window during which the server holds a version we are about to
   abandon.

   THE CURSOR IS A RANK, NOT A TIME. The server numbers what it receives;
   we remember the last number seen. No clock is compared with any other,
   which is the only way to survive two devices that are not on the same
   minute.

   NOTHING IS LOST WHEN IT FAILS. The cursor only advances after a
   successful read; the send marker, only after an accepted send. A
   network cut in the middle therefore leaves the device exactly where it
   was, and the next pass does the same work again — that is what stands
   in for a queue, without a queue to keep.
   ============================================================ */
import { mergeRemote, toSend } from "../domain/merge";
import type { RemoteCard } from "../domain/merge";

import {
  knownCollection,
  pendingToSend,
  forgetWhatWentOut,
  sendEverything,
  replaceFilms,
  knownGraves,
} from "./collection";
import { store } from "./storage";
import {
  documentsToSend,
  forgetSentDocuments,
  forgetDocuments,
  fileIncomingDocument,
  sendAllDocuments,
  catchUpDocuments,
  expectFirstPull,
  noteFirstPull,
  forgetDatesUnder,
} from "./documents";
import {
  DOCS_PER_SEND,
  DOCS_PER_SEND_BYTES,
  ServerError,
  PER_SEND,
  PER_SEND_BYTES,
  push,
  whoAmI,
  serverConfigured,
  pushDocs,
  pullFrom,
  pullDocsFrom,
  type Person,
} from "./server";
import { pushMedia } from "./media";
import { pushNewDecor, healRemoteDecor } from "./customDecor";
import type { Film } from "../types";

const CURSOR_KEY = "synchro-rank";
/* Two ranks, because the two tables each count for themselves. */
const DOCS_CURSOR_KEY = "synchro-rank-documents";
/* WHO OWNS WHAT WE HAVE ALREADY SYNCHRONISED. Without this memory,
   signing in to a second account would pick up the first's read rank —
   the binder would believe it had seen all of a collection it never
   read, and would push none of its own. */
const ACCOUNT_KEY = "synchro-compte";

/** The last server rank taken in here. */
const cursor = (): number => Number(store.get(CURSOR_KEY, 0)) || 0;

export type SyncState =
  /** No server set: the feature does not exist for this person. */
  | "absent"
  /** A server, but no account: nothing goes out, and that is a choice. */
  | "no-account"
  | "running"
  | "up-to-date"
  /** Things are waiting — offline, or the server is silent. */
  | "waiting"
  | "error";

export interface SyncReport {
  state: SyncState;
  person: Person | null;
  /** When the last complete synchronisation succeeded. */
  at: number | null;
  /** What is left to send, if anything. */
  pending: number;
  /**
  /**
   * Documents came in — arrangements, notebook, threads, decors.
   *
   * The views read them ON MOUNT and do not observe them: without this
   * signal the shelf would stay the old one until the next page reload,
   * and you would think the synchronisation incomplete when it brought
   * everything back.
   */
  documentsIn?: number;
  /**
   * Blobs that reached the container this time — posters, screenshots,
   * decoration objects.
   *
   * They travel LAST and outside the guard that watches the rest: a
   * container that refuses does not turn a synchronisation of cards that
   * worked into a failure. Hence a separate count rather than a state:
   * "up to date" here means the cards are, and this says how the mirror
   * is getting on.
   */
  mediaOut?: number;
  message?: string;
}

/* The KEY keeps its old spelling on purpose: it names a value already on
   disk. Renaming it would not translate anything — it would lose it. */
const REPORT_KEY = "synchro-bilan";

/* `le` became `at` when this module was translated, and the report is
   written to disk. Reading only the new spelling would forget the date
   of the last successful synchronisation — the drawer would say "never"
   to somebody who synchronised this morning. */
export const lastReport = (): { at: number | null } => {
  const stored = store.get<{ at?: number | null; le?: number | null }>(REPORT_KEY, { at: null });
  return { at: stored?.at ?? stored?.le ?? null };
};

/* ============================================================
   ON DÉCOUPE SUR DEUX PLAFONDS, ET LE SECOND EST MUET
   ============================================================

   Le serveur borne un envoi de DEUX façons : le nombre d'entrées, et le
   poids du corps. Découpé sur le seul nombre, cinq cents fiches bien
   remplies — synopsis, générique, mots-clés — dépassent le poids, et ce
   refus-là ne se lit pas : le serveur coupe la connexion en cours
   d'envoi, le navigateur annonce une panne de réseau, et la file entière
   reste à quai pour toujours. Le premier plafond répond ; le second
   raccroche.

   UNE ENTRÉE À ELLE SEULE PLUS LOURDE QUE LA BORNE PART QUAND MÊME,
   SEULE. La retenir la retiendrait à chaque passage, sans un mot : c'est
   exactement la panne qu'on vient de retirer. Partie seule, elle est
   sous la borne du serveur, donc refusée PROPREMENT s'il le faut.

   Le poids se compte en OCTETS et non en signes : un titre japonais pèse
   trois fois sa longueur, et c'est précisément le classeur qu'on ferait
   échouer en comptant faux. */
export function cutUp<T>(items: T[], perSend: number, ceiling: number): T[][] {
  const slices: T[][] = [];
  let slice: T[] = [];
  let weight = 0;
  for (const item of items) {
    const size = weigh(item);
    if (slice.length && (slice.length >= perSend || weight + size > ceiling)) {
      slices.push(slice);
      slice = [];
      weight = 0;
    }
    slice.push(item);
    weight += size;
  }
  if (slice.length) slices.push(slice);
  return slices;
}

/* `TextEncoder` est partout depuis longtemps, mais la mesure n'est pas
   ce qui doit tomber : sans lui on compte les signes, ce qui SOUS-estime
   les accents — d'où la marge de moitié laissée sous la borne du
   serveur. */
const weigh = (item: unknown): number => {
  const text = JSON.stringify(item) ?? "";
  return typeof TextEncoder === "function" ? new TextEncoder().encode(text).length : text.length;
};

/**
/**
 * One full round. Never throws: returns what happened.
 *
 * `onFilms` receives the merged collection — it is up to the caller to
 * put it on screen, because only they know whether they are still there
 * to receive it.
 */
export async function synchronise(onFilms: (films: Film[]) => void): Promise<SyncReport> {
  if (!serverConfigured()) {
    return { state: "absent", person: null, at: null, pending: 0 };
  }

  /* WITH NO NETWORK WE DO NOT KNOW WHO WE ARE — and "I do not know" is
     not "nobody". The account stays, what is waiting stays, and the
     screen says "waiting" instead of offering to sign up somebody who is
     already signed up. */
  let person: Person | null;
  try {
    person = await whoAmI();
  } catch {
    return {
      state: "waiting",
      person: null,
      at: lastReport().at,
      pending: pendingToSend().length,
    };
  }
  if (!person) {
    return { state: "no-account", person: null, at: lastReport().at, pending: 0 };
  }

  /* FIRST MEETING WITH THIS ACCOUNT: everything here must go out. The
     waiting list only knows what has been modified SINCE it existed; a
     collection already filed is not on it, and the first send would be
     empty. */
  if (store.get(ACCOUNT_KEY, "") !== person.id) {
    store.set(CURSOR_KEY, 0);
    store.set(DOCS_CURSOR_KEY, 0);
    sendEverything();
    sendAllDocuments();
    /* ET RIEN DE CE QUE CE NAVIGATEUR VA INVENTER D'ICI LÀ NE DOIT
       GAGNER. L'application ne s'arrête pas pendant la synchro : elle
       fabrique un agencement par défaut faute d'en trouver un, et daté
       de maintenant il battrait celui du serveur puis l'écraserait.
       Voir `noteDocument`. */
    expectFirstPull();
    store.set(ACCOUNT_KEY, person.id);
  } else {
    /* MÊME COMPTE, ET POURTANT UN RATTRAPAGE À FAIRE.

       Le ramassage ci-dessus ne tourne qu'au PREMIER branchement. Or la
       liste des documents qui voyagent s'est élargie après coup — trois
       de ses clés étaient mal orthographiées — et ce qui avait été
       arrangé avant n'est jamais reparti, ni ne repartira, sauf à y
       retoucher. Voir `SYNCABLE_VERSION`.

       Il ne ramasse QUE les orphelins, et il ne le fait qu'une fois par
       version de la liste : réexpédier ce qui est déjà à jour
       renverrait au serveur, à chaque tour, ce qu'il vient d'en
       descendre. */
    if (catchUpDocuments()) console.info("documents : rattrapage de la liste élargie");
  }

  try {
    /* ---------- 1. TIRER ---------- */
    let rank = cursor();
    let films = knownCollection();
    let more = true;
    let rounds = 0;

    while (more && rounds < 50) {
      const received = await pullFrom(rank);
      if (received.cards.length) {
        /* THE WIRE FORMAT STAYS THE SERVER'S, and the translation
           happens HERE. `domain/merge` speaks English like all the
           domain; the server still sends `updatedAt`/`deleted`/`data`.
           Adapting at the boundary leaves the domain independent of the
           protocol — and the day the server changes vocabulary, it is
           this function that disappears, not `mergeRemote`. */
        const incoming: RemoteCard[] = (
          received.cards as { id: string; updatedAt: number; deleted?: boolean; data?: unknown }[]
        ).map((f) => ({
          id: f.id,
          updatedAt: f.updatedAt,
          deleted: f.deleted,
          data: (f.data ?? {}) as never,
        }));
        const { films: merged } = mergeRemote(films, incoming);
        films = merged;
        /* WRITTEN WITHOUT RE-DATING: these cards come from elsewhere
           and already carry their date. Going through the ordinary save
           would date them from now, they would believe themselves
           modified here, and would go back to the server in a loop. */
        await replaceFilms(films);
        onFilms(films);
      }
      rank = received.upTo;
      more = received.more === true;
      rounds += 1;
    }
    store.set(CURSOR_KEY, rank);

    /* ---------- 2. POUSSER ---------- */
    /* `toSend` returns the domain's vocabulary; the server expects its
       own. Same boundary, same translation, the other way round. */
    const batch = toSend(knownCollection(), knownGraves(), pendingToSend()).map((e) => ({
      id: e.id,
      tmdbId: e.tmdbId,
      updatedAt: e.updatedAt,
      ...(e.deleted ? { deleted: true } : {}),
      data: e.data,
    }));

    for (const slice of cutUp(batch, PER_SEND, PER_SEND_BYTES)) {
      await push(slice);
      /* WE FORGET SLICE BY SLICE, and only what REALLY went out in that
         slice. Emptying the whole list at the end would lose everything
         if the third slice fails; emptying it before the send would lose
         the card if the send fails.

         And we only remove what has not moved again in the meantime: a
         noted written while the batch was travelling must go out on the
         next round. */
      const byId = new Map(knownCollection().map((f) => [f.id, f]));
      forgetWhatWentOut(
        slice
          .filter((e) => {
            const here = byId.get(e.id);
            return !here || here.updatedAt === e.updatedAt;
          })
          .map((e) => e.id)
      );
    }

    /* ---------- 3. THE REST OF THE BINDER ----------
       After the cards, and not before: a shelf arrangement quotes film
       identifiers, and a shelf arriving first would point at cards we do
       not have yet. */
    let docsRank = Number(store.get(DOCS_CURSOR_KEY, 0)) || 0;
    let moreDocs = true;
    let docRounds = 0;
    let came = 0;
    while (moreDocs && docRounds < 50) {
      const received = await pullDocsFrom(docsRank);
      for (const d of received.documents) if (fileIncomingDocument(d)) came += 1;
      docsRank = received.upTo;
      moreDocs = received.more === true;
      docRounds += 1;
    }
    store.set(DOCS_CURSOR_KEY, docsRank);
    /* LE TIRAGE A ATTERRI, ET SEULEMENT MAINTENANT. Ce qu'on écrira
       ensuite est un geste de quelqu'un, daté de maintenant, et il a le
       droit de gagner. */
    noteFirstPull();

    const docBatch = documentsToSend();
    for (const slice of cutUp(docBatch, DOCS_PER_SEND, DOCS_PER_SEND_BYTES)) {
      await pushDocs(slice);
      forgetSentDocuments(slice.map((d) => d.key));
    }

    /* ---------- 4. LES MÉDIAS ----------
       Last, and OUTSIDE the try that guards the rest: a container that
       refuses must not turn a synchronisation of cards that worked into
       a failure. The blobs are a mirror — IndexedDB holds the originals,
       and what did not go up stays in the register for next time.

       The decors climb first: an object with no server identity has no
       address for its blob to be put at. */
    let mediaOut = 0;
    try {
      /* Ghost identifiers first: the registry of objects is itself a
         synchronised document, so an address written against one server
         can arrive on a machine talking to another. Forgetting those is
         only useful because the next line re-creates them. */
      await healRemoteDecor();
      await pushNewDecor();
      mediaOut = await pushMedia();
    } catch {
      /* Deliberately mute. See above. */
    }

    /* An arrangement that changes asks for a view reload: the shelves
       are read on mount, not observed. We tell the caller rather than
       reloading the page under their fingers. */
    const at = Date.now();
    store.set(REPORT_KEY, { at, documentsIn: came });
    return { state: "up-to-date", person, at, pending: 0, documentsIn: came, mediaOut };
  } catch (e) {
    const error = e as ServerError;
    const waiting = toSend(knownCollection(), knownGraves(), pendingToSend()).length;
    /* THE ZERO MEANS "THE REQUEST NEVER WENT OUT": offline, server down.
       That is not an error to show in red, it is a normal state for a
       local application — hence "waiting". */
    if (error.code === 0) {
      return { state: "waiting", person, at: lastReport().at, pending: waiting };
    }
    return {
      state: "error",
      person,
      at: lastReport().at,
      pending: waiting,
      message: error.message,
    };
  }
}

/** What is waiting, without asking the network anything. */
export const pending = (): number =>
  serverConfigured() ? toSend(knownCollection(), knownGraves(), pendingToSend()).length : 0;

/** Start again from scratch: after signing out, or changing account. */
export function forgetSync(): void {
  store.set(CURSOR_KEY, 0);
  store.set(DOCS_CURSOR_KEY, 0);
  forgetDocuments();
  store.set(ACCOUNT_KEY, "");
  store.set(REPORT_KEY, { at: null });
}

/**
 * REDEMANDER TOUS LES DOCUMENTS AU SERVEUR.
 *
 * Le rang de lecture recule à zéro, donc le prochain tour redescend
 * tout. Et les dates des clés visées sont oubliées, sans quoi rien
 * n'entrerait : ce qui est déjà ici est toujours plus frais que ce qui
 * arrive, et c'est exactement ce qui protège du serveur en retard.
 *
 * C'est donc un geste de RÉPARATION et non un bouton de confort : il
 * rend le serveur souverain sur un préfixe, le temps d'un tour. Le
 * panneau qui l'appelle le dit avant.
 */
export function refetchDocuments(prefix: string): number {
  store.set(DOCS_CURSOR_KEY, 0);
  return forgetDatesUnder(prefix);
}
