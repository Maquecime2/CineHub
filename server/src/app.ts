/* ============================================================
   THE SERVER — what it agrees to do, and nothing more
   ============================================================

   The skeleton: passkey accounts, a session, and the two collection
   routes that prove the chain end to end. The rest of the community
   half (profiles, follows, reviews, lists) is built on top, on that
   baseline.

   WHAT IS ALREADY HERE THOUGH NOTHING DEMANDS IT: rate limiting, export
   and account erasure. They are not features to add later — they are
   properties one never adds at all if they are not there on day one.
   ============================================================ */
import { randomBytes } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Db } from "./db.ts";
import * as store from "./store.ts";
import { registerRelays } from "./relay.ts";
import { publicKeyForPush, pushAvailable, remindChallenges } from "./push.ts";
import { allowed, mediaAvailable, ticketFor } from "./media.ts";
import { LEVELS, SIZES } from "./draw.ts";

export interface Settings {
  db: Db;
  /** The domain the passkeys will sign for. `localhost` in development. */
  domain: string;
  /**
   * The client's origins, comma-separated.
   *
   * SEVERAL, BECAUSE THERE REALLY ARE SEVERAL: the development server
   * (5173) and the preview of the built version (4173) are not the same
   * origin, and we want to try the PWA against the same server. The
   * FIRST one is the reference for the passkeys — a key signed for one
   * origin is worth nothing on another.
   */
  origin: string;
  /** `Secure` cookies: false in development, where there is no HTTPS. */
  secure?: boolean;
  /**
   * The TMDB key, if there is one on this side.
   *
   * Missing, the relay answers "no service" and the binder goes on using
   * the one the person typed in at home. This is deliberately
   * degradable: the server is a comfort, not a condition of use.
   */
  tmdbKey?: string;
  /**
   * TMDB requests per minute per address, for the relay alone.
   *
   * The server's general ceiling — a hundred a minute — targets the
   * routes that write. The relay serves a long and legitimate job:
   * filling three hundred cards asks for three hundred. See
   * `DEFAULT_TMDB_CEILING` in `relay.ts`.
   */
  tmdbCeiling?: number;
  /**
   * Opens `POST /dev/session`, which creates an account and a session
   * with no passkey. Never true in production — see `index.ts`.
   */
  devDoor?: boolean;
}

const COOKIE = "session";

/* The pseudonym is a public address as much as a name: it will live in
   the URL of a shared collection. So we refuse here what the schema
   refuses too, in order to answer with a sentence rather than with a
   database error. */
const PSEUDO_OK = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/* Lists and challenges are named by the SERVER, as UUIDs: a route that
   handed any text at all to a `uuid` column answers 500 on a mistyped
   address, where 404 is the truth. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/* The three the schema accepts, and the three lengths on offer — read
   from `draw.ts`, which is where the arithmetic that depends on them
   lives. Two lists that agreed by hand would stop agreeing. */
const DIFFICULTIES: string[] = LEVELS;

/** What a question looks like once it has been read and found sound. */
interface ReadQuestion {
  ask: string;
  hint: string;
  image: string | null | undefined;
  difficulty: string | undefined;
  choices: { label: string; is_right: boolean }[];
}

export async function buildApp(settings: Settings): Promise<FastifyInstance> {
  const { db, domain, origin } = settings;
  const app = Fastify({ logger: false });

  /* AN EMPTY BODY IS NOT AN UNREADABLE BODY.

     By default, Fastify refuses with a 400 any request that announces
     JSON and sends nothing. But a client that sets a `content-type` on
     all of its calls — which is the normal thing to do — sends exactly
     that whenever the route asks for no data. Signing out therefore
     failed in silence: the browser believed it had closed the session,
     the server kept it open.

     The fault survived forty tests because `inject`, with no payload,
     announces no `content-type`: the question that failed was never
     asked. */
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      done(null, body ? JSON.parse(body as string) : {});
    } catch {
      done(new Error("JSON illisible"), undefined);
    }
  });

  await app.register(cookie);
  const origins = origin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: origins,
    /* Without this the browser would not send the session cookie: a
       cross-origin request is anonymous by default. */
    credentials: true,
    /* THE METHODS ARE LISTED, AND FORGETTING ONE DOES NOT SHOW IN THE
       TESTS. By default the preflight allows only GET, HEAD and POST:
       the browser was therefore refusing the collection's PUT BEFORE
       sending it, and the server saw no trace of it. Nor did the tests —
       `inject` calls the route directly, with no preflight, so it never
       asks the question that was failing. */
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    /* A HEADER ONE DOES NOT EXPOSE IS A HEADER ONE DOES NOT SEND.

       On a cross-origin request the browser lets JavaScript read only a
       handful of headers; all the others are there, in the response, and
       `headers.get()` returns `null`. So the server was answering "try
       again in 47 seconds" to a client that could not hear it, and which
       tried again after one — three times, inside the same window, to be
       refused three times. The waiting rhythm was written on both sides
       and did not cross. */
    exposedHeaders: ["retry-after"],
  });
  /* A HUNDRED REQUESTS PER MINUTE PER ADDRESS. Not against a serious
     attack — that would need a firewall in front — but against the loop
     of a badly set client, which costs the same money. */
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  /* ------------------------------------------------------------
     THE USAGE MEASUREMENT — what it refuses to know defines it
     ------------------------------------------------------------
     One counter per DAY and per GESTURE. No person identifier, no
     address, no browser, no time of day: nothing that would let
     somebody's day be recomposed.

     The gesture is the METHOD and the ROUTE PATH — `GET /lists/:id` and
     not `GET /lists/97703c16-…`. The real URL carries identifiers; the
     route path does not. Counting one for the other would have built
     exactly the register we refuse to keep.

     This counter is deliberately blind to "how many people": answering
     that would need what we do not keep. That is the price, and it is
     paid knowingly. */
  app.addHook("onResponse", async (req, reply) => {
    const chemin = req.routeOptions?.url;
    if (!chemin) return;
    /* One write per request would make the measurement cost more than
       the service. Failures do not count either: those are incidents, and
       the server log is there for them. */
    if (reply.statusCode >= 400) return;
    store.countGesture(db, `${req.method} ${chemin}`).catch(() => {});
  });

  /** Who is speaking? `null` if nobody. */
  const whoIs = async (req: FastifyRequest) => {
    const secret = req.cookies[COOKIE];
    if (!secret) return null;
    return store.personOfSession(db, secret);
  };

  /** The routes that require an account go through here. */
  const requireAccount = async (req: FastifyRequest) => {
    const person = await whoIs(req);
    if (!person) {
      const e = new Error("il faut être connecté") as Error & { statusCode?: number };
      e.statusCode = 401;
      throw e;
    }
    return person;
  };

  /**
   * The routes that write a quiz go through here.
   *
   * THE ROLE IS READ, NEVER WRITTEN. There is no route that grants it —
   * `ADMINS` in the environment is the only door, laid down at start-up —
   * so this guard has no counterpart to keep in agreement, and there is
   * no sequence of requests that ends with somebody having it.
   */
  const requireAdmin = async (req: FastifyRequest) => {
    const person = await requireAccount(req);
    if (!person.is_admin) {
      const e = new Error("réservé") as Error & { statusCode?: number };
      e.statusCode = 403;
      throw e;
    }
    return person;
  };

  /* ------------------------------------------------------------
     SIGNING UP — a first passkey
     ------------------------------------------------------------ */

  app.post("/auth/signup/options", async (req, reply) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const name = (pseudo || "").trim().toLowerCase();
    if (!PSEUDO_OK.test(name)) {
      return reply.code(400).send({
        error: "Un pseudonyme de 3 à 30 caractères : lettres sans accent, chiffres, tirets.",
      });
    }
    if (await store.findByPseudo(db, name)) {
      return reply.code(409).send({ error: "Ce pseudonyme est déjà pris." });
    }

    const options = await generateRegistrationOptions({
      rpName: "Ciné Hub",
      rpID: domain,
      userName: name,
      /* NO RESIDENT KEY REQUIRED, but preferred: it is what lets you
         sign in without typing your username. "Preferred" rather than
         "required" so as not to shut the door on authenticators that do
         not make them. */
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      attestationType: "none",
    });

    const challenge = await store.setChallenge(db, options.challenge, { pseudo: name });
    return { challenge, options };
  });

  app.post("/auth/signup/verify", async (req, reply) => {
    const { challenge, response } = (req.body ?? {}) as { challenge?: string; response?: unknown };
    const expected = challenge ? await store.consumeChallenge(db, challenge) : null;
    if (!expected?.pseudo) return reply.code(400).send({ error: "Défi inconnu ou expiré." });

    const v = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge: expected.value,
      expectedOrigin: origins,
      expectedRPID: domain,
    });
    if (!v.verified || !v.registrationInfo) {
      return reply.code(400).send({ error: "Cette clé n'a pas pu être vérifiée." });
    }

    /* The race between two registrations of the same username is settled
       here: it is the database's uniqueness constraint that decides, not
       our check three lines ago. */
    let person;
    try {
      person = await store.createPerson(db, expected.pseudo);
    } catch {
      return reply.code(409).send({ error: "Ce pseudonyme est déjà pris." });
    }

    const { credential } = v.registrationInfo;
    await store.addKey(db, {
      id: credential.id,
      personId: person.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? [],
    });

    await setCookie(reply, await store.openSession(db, person.id));
    return { person };
  });

  /* ------------------------------------------------------------
     SE CONNECTER
     ------------------------------------------------------------ */

  app.post("/auth/signin/options", async (req) => {
    const { pseudo } = (req.body ?? {}) as { pseudo?: string };
    const name = (pseudo || "").trim().toLowerCase();
    const person = name ? await store.findByPseudo(db, name) : null;

    /* AN UNKNOWN USERNAME GETS THE SAME ANSWER AS A KNOWN ONE. Answering
       "this account does not exist" would make this route a directory:
       anybody could learn who is registered. So we offer the ceremony in
       every case, and it is the signature that will fail. */
    const cles = person ? await store.keysOf(db, person.id) : [];
    const options = await generateAuthenticationOptions({
      rpID: domain,
      allowCredentials: cles.map((c) => ({ id: c.id, transports: c.transports as never })),
      userVerification: "preferred",
    });

    const challenge = await store.setChallenge(db, options.challenge, {
      personId: person?.id,
    });
    return { challenge, options };
  });

  app.post("/auth/signin/verify", async (req, reply) => {
    const { challenge, response } = (req.body ?? {}) as {
      challenge?: string;
      response?: { id?: string };
    };
    const expected = challenge ? await store.consumeChallenge(db, challenge) : null;
    if (!expected) return reply.code(400).send({ error: "Défi inconnu ou expiré." });

    const key = response?.id ? await store.keyById(db, response.id) : null;
    if (!key) return reply.code(401).send({ error: "Clé inconnue." });

    const v = await verifyAuthenticationResponse({
      response: response as never,
      expectedChallenge: expected.value,
      expectedOrigin: origins,
      expectedRPID: domain,
      credential: {
        id: key.id,
        publicKey: new Uint8Array(key.public_key),
        counter: Number(key.counter),
        transports: key.transports as never,
      },
    });
    if (!v.verified) return reply.code(401).send({ error: "Signature refusée." });

    await store.recordUsage(db, key.id, v.authenticationInfo.newCounter);
    const person = await store.findById(db, key.person_id);
    if (!person) return reply.code(401).send({ error: "Compte introuvable." });

    await setCookie(reply, await store.openSession(db, person.id));
    return { person };
  });

  /* ------------------------------------------------------------
     THE OTHER DEVICES — a second passkey on the same account
     ------------------------------------------------------------

     A PASSKEY BELONGS TO THE THING THAT HOLDS IT. The one Windows Hello
     made lives in that computer and goes nowhere: no cloud carries it,
     no export takes it out. An account opened on one machine was
     therefore shut inside it, and nothing here opened the door — signing
     up makes a first key and there was no second.

     Hence these routes, and hence `cross-platform` below: it is that
     word which makes the browser offer "a telephone" and its QR code
     rather than the local sensor. Once the telephone holds a key of this
     account, ANY other computer can sign in with it, by scanning —
     `signin/options` already returns the transports we stored, and it is
     `hybrid` among them that lights up the offer.

     The whole thing rests on one thing being true: the challenge must
     belong to the account that is speaking. Without that check, whoever
     is signed in could finish a ceremony opened for somebody else and
     hang their own key on that account. */

  app.get("/auth/keys", async (req) => {
    const person = await requireAccount(req);
    return { keys: await store.keyCards(db, person.id) };
  });

  /* ------------------------------------------------------------
     PAIRING BY CODE — the door the passkeys cannot open
     ------------------------------------------------------------

     A PASSKEY IS SIGNED FOR A DOMAIN, and on `localhost` each computer
     is its own: the two machines have no domain in common, so there is
     nothing for a telephone to sign for and the QR ceremony cannot
     help. Which is precisely the case of somebody running this at home
     on two computers — that is to say the case that matters most.

     So: the machine already signed in makes a code, the other one types
     it, and gets a session. From there the ordinary synchronisation
     brings the collection, the arrangement and the cabinet back, and
     the new machine registers a passkey of its own so it never needs a
     code again.

     THE CODE IS WORTH AN ACCOUNT FOR AS LONG AS IT LIVES, and it lives
     a week — one does not pair a second computer in the ten minutes
     after thinking of it. The week is bought from the other guards,
     which is why none of them may be relaxed: one single use, the
     digest alone in the table, and the ceiling below. */

  app.post("/auth/pair", async (req) => {
    const person = await requireAccount(req);
    return { code: await store.makePairingCode(db, person.id), days: 7 };
  });

  app.post(
    "/auth/pair/claim",
    {
      /* TEN TRIES AN HOUR PER ADDRESS. This is what turns fifty bits of
         code into something unguessable in practice rather than merely
         in theory — the general ceiling, a hundred a minute, would let
         somebody try six thousand. */
      config: { rateLimit: { max: 10, timeWindow: "1 hour" } },
    },
    async (req, reply) => {
      const { code } = (req.body ?? {}) as { code?: string };
      const personId = code ? await store.spendPairingCode(db, code) : null;
      /* ONE ANSWER FOR EVERY FAILURE — unknown, expired, already spent.
         Telling them apart would say whether a code once existed. */
      if (!personId) {
        return reply.code(401).send({ error: "Ce code n'est plus valable. Demandez-en un autre." });
      }
      const person = await store.findById(db, personId);
      if (!person) return reply.code(401).send({ error: "Compte introuvable." });

      await setCookie(reply, await store.openSession(db, person.id));
      return { person };
    }
  );

  app.post("/auth/keys/options", async (req) => {
    const person = await requireAccount(req);
    const known = await store.keysOf(db, person.id);
    /* TWO REASONS TO ADD A KEY, AND THEY WANT OPPOSITE ANSWERS.
       "A telephone" is the one that unlocks other computers later, and
       it needs `cross-platform`. "This machine" is what somebody does
       just after arriving here with a pairing code — and forcing
       `cross-platform` there would offer them a QR code for the
       computer they are sitting at. */
    const { where } = (req.body ?? {}) as { where?: "phone" | "here" };
    const here = where === "here";

    const options = await generateRegistrationOptions({
      rpName: "Ciné Hub",
      rpID: domain,
      userName: person.pseudo,
      /* THE KEYS ALREADY HERE ARE EXCLUDED. Without this the telephone
         that already holds one offers to make a second, indistinguishable
         from the first in the list — and the person believes they have
         paired a device they have not. */
      excludeCredentials: known.map((c) => ({ id: c.id, transports: c.transports as never })),
      authenticatorSelection: {
        /* `cross-platform` is what makes the browser offer "a
           telephone" and its QR code rather than the local sensor —
           and `platform` is what makes it offer the local sensor when
           that is exactly what was asked for. */
        authenticatorAttachment: here ? "platform" : "cross-platform",
        /* Required for a telephone: a key that is not discoverable
           cannot be offered by a device which has never seen this site.
           Merely preferred for the machine one is sitting at, which will
           be named at sign-in anyway — and some platform authenticators
           refuse outright when it is demanded. */
        residentKey: here ? "preferred" : "required",
        userVerification: "preferred",
      },
      attestationType: "none",
    });

    const challenge = await store.setChallenge(db, options.challenge, { personId: person.id });
    return { challenge, options };
  });

  app.post("/auth/keys/verify", async (req, reply) => {
    const person = await requireAccount(req);
    const { challenge, response, device } = (req.body ?? {}) as {
      challenge?: string;
      response?: unknown;
      device?: string;
    };
    const expected = challenge ? await store.consumeChallenge(db, challenge) : null;
    if (!expected) return reply.code(400).send({ error: "Défi inconnu ou expiré." });

    /* THE CHALLENGE MUST BE THIS ACCOUNT'S. It has just been consumed, so
       it cannot serve again — but consumed by the wrong person it would
       hang a key on somebody else's account. */
    if (expected.person_id !== person.id) {
      return reply.code(403).send({ error: "Ce défi n'est pas le vôtre." });
    }

    const v = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge: expected.value,
      expectedOrigin: origins,
      expectedRPID: domain,
    });
    if (!v.verified || !v.registrationInfo) {
      return reply.code(400).send({ error: "Cette clé n'a pas pu être vérifiée." });
    }

    const { credential } = v.registrationInfo;
    try {
      await store.addKey(db, {
        id: credential.id,
        personId: person.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports ?? [],
        device: (device || "").trim().slice(0, 60) || null,
      });
    } catch {
      /* `access_key.id` is the primary key: the same authenticator
         offered twice lands here rather than on a 500. */
      return reply.code(409).send({ error: "Cet appareil est déjà enregistré." });
    }

    return { keys: await store.keyCards(db, person.id) };
  });

  app.delete("/auth/keys/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!(await store.forgetKey(db, person.id, id))) {
      /* TWO REASONS TO ANSWER NO, AND THEY ARE NOT THE SAME NO.

         The key is the only one left — a door we refuse to shut on
         somebody — or it is not theirs at all. Counting the keys is not
         enough to tell the two apart: whoever has none would be told
         they are removing their last one, about a key they never had. So
         we ask whether this key is theirs, and let the count speak only
         then. */
      const mine = await store.keyCards(db, person.id);
      const isMine = mine.some((k) => k.id === id);
      return reply.code(isMine ? 409 : 404).send({
        error: isMine
          ? "C'est votre dernière clé : la retirer vous mettrait dehors de votre propre compte."
          : "Clé inconnue.",
      });
    }
    return { keys: await store.keyCards(db, person.id) };
  });

  /* ------------------------------------------------------------
     LA SESSION
     ------------------------------------------------------------ */

  app.get("/me", async (req, reply) => {
    const person = await whoIs(req);
    if (!person) return reply.code(401).send({ error: "Personne." });
    return { person, cards: await store.countCards(db, person.id) };
  });

  app.post("/signout", async (req, reply) => {
    const secret = req.cookies[COOKIE];
    if (secret) await store.closeSession(db, secret);
    reply.clearCookie(COOKIE, { path: "/" });
    return { done: true };
  });

  /* ------------------------------------------------------------
     THE COLLECTION — the chain, proved end to end
     ------------------------------------------------------------
     This is not synchronisation yet: it is the pair of routes on which
     synchronisation will be written. Push what has changed, pull what
     has changed since a given point — the rest (the waiting queue, the
     merging of logs) is the client's work. */

  app.get("/collection", async (req, reply) => {
    const person = await requireAccount(req);
    const { since } = req.query as { since?: string };
    const rang = since ? Number(since) : 0;
    if (!Number.isFinite(rang) || rang < 0) {
      return reply.code(400).send({ error: "Rang de départ illisible." });
    }

    const cards = await store.cardsSince(db, person.id, rang);
    /* `upTo` IS A RANK, NOT A TIME. It is the sequence number of the
       last card returned: the client sends it back as it is on the next
       pull, and has no clock to compare with the server's.

       With no card, we return the rank asked for — certainly not zero,
       which would re-download everything on the next pass. */
    const upTo = cards.length ? Number(cards[cards.length - 1]!.seq) : rang;
    return {
      upTo,
      /* There is more: the client will call again with the new rank
         rather than believe it has everything. */
      more: cards.length === 500,
      cards: cards.map((f) => ({
        id: f.id,
        tmdbId: f.tmdb_id,
        hidden: f.hidden,
        deleted: f.deleted,
        updatedAt: new Date(f.updated_at).getTime(),
        data: f.data,
      })),
    };
  });

  app.put("/collection", async (req, reply) => {
    const person = await requireAccount(req);
    const { cards } = (req.body ?? {}) as { cards?: unknown };
    if (!Array.isArray(cards)) {
      return reply.code(400).send({ error: "Il faut un tableau de cards." });
    }
    /* A CEILING, BECAUSE A BODY WITH NO CEILING IS A BREAKDOWN IN
       WAITING. A whole collection is pushed in several batches. */
    if (cards.length > 500) {
      return reply.code(413).send({ error: "Cinq cents cards by envoi au plus." });
    }

    /* THREE COUNTS AND NOT ONE, BECAUSE "FILED" WAS LYING.
       The response announced the number of cards RECEIVED, while the
       database silently refuses some of them — the ones a device running
       late pushes over a fresher version. A client emptying its queue on
       the strength of that count would believe it had sent what was in
       fact turned away. The distinction costs nothing today and will be
       everything tomorrow, when synchronisation reads this response to
       decide what to forget. */
    let filed = 0;
    let stale = 0;
    let unreadable = 0;
    for (const f of cards as Record<string, unknown>[]) {
      const id = typeof f.id === "string" ? f.id : null;
      const updatedAt = Number(f.updatedAt);
      if (!id || !Number.isFinite(updatedAt)) {
        unreadable += 1;
        continue;
      }
      const written = await store.storeCard(db, person.id, {
        id,
        tmdbId: f.tmdbId == null ? null : String(f.tmdbId),
        hidden: f.hidden === true,
        data: f.data ?? {},
        updatedAt: new Date(updatedAt),
        deleted: f.deleted === true,
      });
      if (written) filed += 1;
      else stale += 1;
    }
    /* NO `upTo` HERE: a push says nothing about where reading has got
       to. The client's rank only advances on a pull, which alone knows
       what it really received — and going back through it brings in the
       other devices' cards on the way. */
    return { filed, stale, unreadable };
  });

  /* ------------------------------------------------------------
     THE REST OF THE BINDER
     ------------------------------------------------------------
     Shelf arrangements, notebook pages, threads, vocabulary, decors.
     The same rules as the cards, and deliberately the same shapes: a
     `since` that is a rank, an `upTo` handed back as it stands. */

  app.get("/documents", async (req, reply) => {
    const person = await requireAccount(req);
    const rang = Number((req.query as { since?: string }).since ?? 0);
    if (!Number.isFinite(rang) || rang < 0) {
      return reply.code(400).send({ error: "Rang de départ illisible." });
    }
    const docs = await store.docsSince(db, person.id, rang);
    return {
      upTo: docs.length ? Number(docs[docs.length - 1]!.seq) : rang,
      more: docs.length === 200,
      documents: docs.map((d) => ({
        key: d.key,
        deleted: d.deleted,
        updatedAt: new Date(d.updated_at).getTime(),
        content: d.content,
      })),
    };
  });

  app.put("/documents", async (req, reply) => {
    const person = await requireAccount(req);
    const { documents } = (req.body ?? {}) as { documents?: unknown };
    if (!Array.isArray(documents)) {
      return reply.code(400).send({ error: "Il faut un tableau de documents." });
    }
    if (documents.length > 200) {
      return reply.code(413).send({ error: "Deux cents documents by envoi au plus." });
    }

    let filed = 0;
    let stale = 0;
    let unreadable = 0;
    for (const d of documents as Record<string, unknown>[]) {
      const key = typeof d.key === "string" ? d.key : null;
      const updatedAt = Number(d.updatedAt);
      if (!key || !Number.isFinite(updatedAt)) {
        unreadable += 1;
        continue;
      }
      const ecrit = await store.storeDoc(db, person.id, {
        key,
        content: d.content ?? null,
        updatedAt: new Date(updatedAt),
        deleted: d.deleted === true,
      });
      if (ecrit) filed += 1;
      else stale += 1;
    }
    return { filed, stale, unreadable };
  });

  /* ------------------------------------------------------------
     SHARING ONE'S COLLECTION
     ------------------------------------------------------------
     The only route in this whole server that answers somebody with no
     account. It is therefore written asking, at every line, what a
     stranger could get out of it. */

  /* READING ONE'S OWN SHARING SETTING — what was missing to draw it.
     The write route existed on its own, so the account drawer opened on
     three buttons of which NONE was marked: it only taught you your mode
     at the moment you changed it, which is too late to help you decide.
     And the card could not say "other people can see it" without knowing
     whether anybody sees anything at all.

     The session's person already carries both values: there is nothing
     to go and fetch, only something to answer. */
  app.get("/sharing", async (req) => {
    const person = await requireAccount(req);
    return { sharing: person.sharing ?? "privee", token: person.token ?? null };
  });

  app.put("/sharing", async (req, reply) => {
    const person = await requireAccount(req);
    const { sharing } = (req.body ?? {}) as { sharing?: string };
    if (!["privee", "lien", "publique"].includes(sharing || "")) {
      return reply.code(400).send({ error: "Partage inconnu." });
    }

    /* A FRESH TOKEN ON EVERY PASS THROUGH "LINK". Taking the old one
       back would revive every link handed out the time before — the one
       we had gone private precisely in order to cut, included. Changing
       one's mind has to mean something. */
    const token = sharing === "lien" ? randomBytes(16).toString("base64url") : null;
    await store.setSharing(db, person.id, sharing!, token);
    return { sharing, token };
  });

  /* WHAT IS SET ASIDE FROM SHARING, AND NOTHING ELSE.

     The route next door has known how to set a card aside since day one;
     none of them could say which ones were. So the binder could not draw
     the state of a button it had no way of reading — which is why the
     button did not exist, while the tour promised it.

     We return IDENTIFIERS and nothing more: that is all it takes to
     tick a box, and a list of titles would send the collection
     travelling for nothing. */
  app.get("/hidden-cards", async (req) => {
    const person = await requireAccount(req);
    return { ids: await store.hiddenCards(db, person.id) };
  });

  app.put("/cards/:id/hidden", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const { hidden } = (req.body ?? {}) as { hidden?: boolean };
    const done = await store.hideCard(db, person.id, id, hidden === true);
    if (!done) return reply.code(404).send({ error: "Fiche inconnue." });
    return { id, hidden: hidden === true };
  });

  app.get("/collections/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    const { token } = req.query as { token?: string };
    if (!PSEUDO_OK.test(pseudo || "")) {
      return reply.code(404).send({ error: "Pas de collection à cette adresse." });
    }

    const vue = await store.publicCollectionOf(db, pseudo.toLowerCase(), token ?? null);
    /* THE SAME 404 IN ALL THREE CASES: no such account, an account that
       does not share, a wrong token. Telling them apart would inform a
       stranger about who is registered and who keeps a collection
       secret — two things that are none of their business. */
    if (!vue) return reply.code(404).send({ error: "Pas de collection à cette adresse." });

    return {
      pseudo: vue.pseudo,
      films: vue.films.map((f) => ({ id: f.id, tmdbId: f.tmdb_id, ...f.data })),
    };
  });

  /* ------------------------------------------------------------
     SUIVRE QUELQU'UN, ET LIRE SON FIL
     ------------------------------------------------------------ */

  app.get("/profiles/:pseudo", async (req, reply) => {
    const { pseudo } = req.params as { pseudo: string };
    if (!PSEUDO_OK.test(pseudo || "")) return reply.code(404).send({ error: "Personne." });

    /* We read the session without requiring it: signed in, we will know
       whether we already follow; otherwise the profile is still
       readable. */
    const me = await whoIs(req);
    const profil = await store.publicProfileOf(db, pseudo.toLowerCase(), me?.id);
    /* THE SAME ANSWER FOR "DOES NOT EXIST" AND "DOES NOT SHOW". You can
       only find people who chose to be findable. */
    if (!profil) return reply.code(404).send({ error: "Personne." });
    return profil;
  });

  app.get("/follows", async (req) => {
    const person = await requireAccount(req);
    return { subscriptions: await store.subscriptionsOf(db, person.id) };
  });

  app.put("/follows/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const target = await store.publicProfileOf(db, (pseudo || "").toLowerCase(), person.id);
    /* One can only follow what shows itself: following a closed
       collection would be subscribing to a silence, and would say in
       passing that it exists. A block closes things the same way — it is
       the profile that no longer exists, and not an announced ban. */
    if (!target) return reply.code(404).send({ error: "Personne." });

    const about = await store.findByPseudo(db, target.pseudo);
    if (!about || about.id === person.id) {
      return reply.code(400).send({ error: "On ne se suit pas soi-même." });
    }
    await store.follow(db, person.id, about.id);
    return { pseudo: target.pseudo, followed: true };
  });

  app.delete("/follows/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    /* Unfollowing somebody who has closed up must STAY possible: so we
       do not go through the public profile, which would no longer
       exist. */
    if (about) await store.unfollow(db, person.id, about.id);
    return reply.send({ pseudo, followed: false });
  });

  app.get("/feed", async (req, reply) => {
    const person = await requireAccount(req);
    const { before } = req.query as { before?: string };
    const borne = before ? Number(before) : null;
    if (borne !== null && !Number.isFinite(borne)) {
      return reply.code(400).send({ error: "Borne illisible." });
    }

    const news = await store.feedOf(db, person.id, borne);
    return {
      /* The rank of the last item returned: the client sends it back to
         read on, without wondering what time it is. */
      upTo: news.length ? Number(news[news.length - 1]!.seq) : null,
      news: news.map((n) => ({
        pseudo: n.pseudo,
        id: n.id,
        tmdbId: n.tmdb_id,
        at: new Date(n.updated_at).getTime(),
        film: n.data,
      })),
    };
  });

  /* ------------------------------------------------------------
     WHAT IS SAID ABOUT A WORK
     ------------------------------------------------------------
     Reading backwards: no longer "this person's films" but "the people
     who have seen this film". Nothing is published for it — the reviews
     read here are the cards' own, at their authors', in the collections
     they chose to make public. */

  app.get("/works/:tmdbId", async (req, reply) => {
    /* AN ACCOUNT IS REQUIRED, whereas the shared collection asks for
       none. The difference: over there you open the door of somebody who
       gave you their address; here you question everybody at once.
       Opening that to strangers would make this server a harvester of
       reviews, and every review a publicly siphonable piece of data. */
    const person = await requireAccount(req);
    const { tmdbId } = req.params as { tmdbId: string };
    if (!/^[0-9]{1,12}$/.test(tmdbId || "")) {
      return reply.code(400).send({ error: "Identifiant d'œuvre illisible." });
    }
    return store.echoOfWork(db, tmdbId, person.id);
  });

  /* ------------------------------------------------------------
     PROTECTING ONESELF
     ------------------------------------------------------------
     These arrive with the first thing this binder publishes, and not
     "when there is a problem": the day there is one is no longer the
     moment to start developing. */

  app.get("/blocks", async (req) => {
    const person = await requireAccount(req);
    return { blocks: await store.myBlocks(db, person.id) };
  });

  app.put("/blocks/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    /* We block by ACCOUNT, not by public profile: somebody who closes
       up afterwards must stay blockable, or going private would be
       enough to become unblockable again and then come back out. */
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!about) return reply.code(404).send({ error: "Personne." });
    if (about.id === person.id) {
      return reply.code(400).send({ error: "On ne se blocked pas soi-même." });
    }
    await store.block(db, person.id, about.id);
    return { pseudo: about.pseudo, blocked: true };
  });

  app.delete("/blocks/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo } = req.params as { pseudo: string };
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (about) await store.unblock(db, person.id, about.id);
    /* Unblocking re-subscribes nobody: the link was undone, it is redone
       by hand. Rebuilding a subscription somebody cut would be deciding
       on their behalf. */
    return reply.send({ pseudo, blocked: false });
  });

  app.post("/reports", async (req, reply) => {
    const person = await requireAccount(req);
    const { pseudo, card, reason } = (req.body ?? {}) as {
      pseudo?: string;
      card?: string;
      reason?: string;
    };
    const text = (reason || "").trim();
    if (!text || text.length > 500) {
      return reply.code(400).send({ error: "Dites en one phrase ce qui ne va pas." });
    }
    const about = pseudo ? await store.findByPseudo(db, pseudo.toLowerCase()) : null;
    if (!about) return reply.code(404).send({ error: "Personne." });

    const fresh = await store.report(db, person.id, {
      targetType: "card",
      targetId: String(card || ""),
      aboutId: about.id,
      reason: text,
    });
    /* THE SAME ANSWER WHETHER IT IS THE FIRST REPORT OR THE TENTH:
       "noted" is true in both cases, and knowing one had already
       reported adds nothing for somebody who has just done it. */
    return { noted: true, fresh };
  });

  /* ------------------------------------------------------------
     THE LISTS
     ------------------------------------------------------------
     A list holds WORKS and not cards: a list of cards would be a list of
     somebody's own copies, it would mean nothing at somebody else's and
     would empty itself the day its author erased a card. */

  /** The rights over a list, or the refusal already made ready. */
  const rightsOr404 = async (req: FastifyRequest, reply: FastifyReply, personId: string) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) {
      reply.code(404).send({ error: "Liste inconnue." });
      return null;
    }
    const rights = await store.rightsOnList(db, id, personId);
    /* NO 403: a list you have no right to read answers like a list that
       does not exist. Telling them apart would tell a stranger that a
       given identifier designates something. */
    if (!rights?.read) {
      reply.code(404).send({ error: "Liste inconnue." });
      return null;
    }
    return rights;
  };

  app.get("/lists", async (req) => {
    const person = await requireAccount(req);
    return { lists: await store.myLists(db, person.id) };
  });

  app.post("/lists", async (req, reply) => {
    const person = await requireAccount(req);
    const { title, intent, is_public } = (req.body ?? {}) as {
      title?: string;
      intent?: string;
      is_public?: boolean;
    };
    const name = (title || "").trim();
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "Il faut un title, de 1 à 120 caractères." });
    }
    const id = await store.createList(db, person.id, {
      title: name,
      intent: (intent || "").trim(),
      is_public: is_public === true,
    });
    return { id };
  });

  app.get("/lists/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;

    const list = await store.listById(db, rights.list_id);
    return {
      list: { ...list, mienne: rights.administer, isMember: rights.write },
      works: await store.worksOf(db, rights.list_id),
      /* The co-builders only show themselves to those who write in it: a
         visitor to a public list reads films, not the list of the people
         who keep it. */
      members: rights.write ? await store.membersOf(db, rights.list_id) : [],
    };
  });

  app.put("/lists/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;
    /* RENAME, PUBLISH, DELETE: the owner alone. Co-building is a right
       to write, not shared ownership — without that asymmetry, a list
       built by six hands has nobody left answering for it. */
    if (!rights.administer) return reply.code(403).send({ error: "Cette list n'est pas vôtre." });

    const { title, intent, is_public } = (req.body ?? {}) as {
      title?: string;
      intent?: string;
      is_public?: boolean;
    };
    if (title !== undefined && !(title.trim() && title.trim().length <= 120)) {
      return reply.code(400).send({ error: "Il faut un title, de 1 à 120 caractères." });
    }
    await store.editList(db, rights.list_id, {
      title: title?.trim(),
      intent: intent?.trim(),
      is_public,
    });
    return { done: true };
  });

  app.delete("/lists/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.administer) return reply.code(403).send({ error: "Cette list n'est pas vôtre." });
    await store.deleteList(db, rights.list_id);
    return { erased: true };
  });

  app.post("/lists/:id/works", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "On ne vous a rien demandé ici." });

    const { tmdbId, title, year } = (req.body ?? {}) as {
      tmdbId?: string | number;
      title?: string;
      year?: string;
    };
    if (!/^[0-9]{1,12}$/.test(String(tmdbId ?? ""))) {
      return reply.code(400).send({ error: "Une œuvre se désigne by son identifiant TMDB." });
    }
    const fresh = await store.addToList(db, rights.list_id, person.id, {
      tmdbId: String(tmdbId),
      title: (title || "").slice(0, 200),
      year: year ? String(year).slice(0, 8) : null,
    });
    return { added: true, fresh };
  });

  app.delete("/lists/:id/works/:tmdbId", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "On ne vous a rien demandé ici." });
    const { tmdbId } = req.params as { tmdbId: string };
    await store.removeFromList(db, rights.list_id, tmdbId);
    return { removed: true };
  });

  app.put("/lists/:id/members/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.administer) return reply.code(403).send({ error: "Cette list n'est pas vôtre." });

    const { pseudo } = req.params as { pseudo: string };
    const invite = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!invite) return reply.code(404).send({ error: "Personne." });
    if (invite.id === person.id) {
      return reply.code(400).send({ error: "Vous y écrivez déjà." });
    }
    /* We do not invite somebody we have silenced, nor somebody who has
       silenced us: that would reopen through a side door what a block
       has just closed. */
    if (await store.blockedIds(db, person.id, invite.id)) {
      return reply.code(404).send({ error: "Personne." });
    }
    await store.inviteToList(db, rights.list_id, invite.id);
    return { pseudo: invite.pseudo, isMember: true };
  });

  app.delete("/lists/:id/members/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await rightsOr404(req, reply, person.id);
    if (!rights) return reply;
    const { pseudo } = req.params as { pseudo: string };
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!about) return reply.code(404).send({ error: "Personne." });
    /* The owner can remove whoever they like; a member can only remove
       themselves. Leaving a list asks nobody's permission. */
    if (!rights.administer && about.id !== person.id) {
      return reply.code(403).send({ error: "Cette list n'est pas vôtre." });
    }
    await store.removeMemberFromList(db, rights.list_id, about.id);
    return { pseudo: about.pseudo, isMember: false };
  });

  /* ------------------------------------------------------------
     THE CHALLENGES
     ------------------------------------------------------------
     A list plus a period. The progress is COMPUTED — nobody ticks
     "seen", the binder knows already. */

  app.get("/challenges", async (req) => {
    const person = await requireAccount(req);
    return { challenges: await store.myChallenges(db, person.id) };
  });

  app.post("/challenges", async (req, reply) => {
    const person = await requireAccount(req);
    const { listId, title, starts_on, ends_on } = (req.body ?? {}) as {
      listId?: string;
      title?: string;
      starts_on?: string;
      ends_on?: string;
    };
    const name = (title || "").trim();
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "Il faut un title, de 1 à 120 caractères." });
    }
    if (!JOUR.test(starts_on || "") || !JOUR.test(ends_on || "") || ends_on! < starts_on!) {
      return reply.code(400).send({ error: "Deux dates, et la ends_on après at début." });
    }
    /* A challenge is only built on a list you write in: otherwise
       anybody starts a challenge on a stranger's public list, and they
       would see it appear without having wanted it. */
    const rights = UUID.test(listId || "")
      ? await store.rightsOnList(db, listId!, person.id)
      : null;
    if (!rights?.write) return reply.code(404).send({ error: "Liste inconnue." });

    const id = await store.createChallenge(db, person.id, {
      listId: rights.list_id,
      title: name,
      starts_on: starts_on!,
      ends_on: ends_on!,
    });
    return { id };
  });

  app.get("/challenges/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const challenge = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!challenge) return reply.code(404).send({ error: "Défi inconnu." });
    /* The right to see a challenge is the right to see its list: there
       are not two confidentialities to keep in agreement. */
    const rights = await store.rightsOnList(db, challenge.list_id, person.id);
    if (!rights?.read) return reply.code(404).send({ error: "Défi inconnu." });

    return {
      challenge,
      works: await store.worksOf(db, challenge.list_id),
      /* PROGRESS LEAVES THE LOG AS A NUMBER AND NOTHING ELSE. The
         screening log never leaves a collection; here it leaves nothing
         either — we count, we do not copy. And we count only people who
         have asked to take part. */
      progress: await store.progressOf(db, challenge.id),
    };
  });

  app.delete("/challenges/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const challenge = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!challenge) return reply.code(404).send({ error: "Défi inconnu." });
    const rights = await store.rightsOnList(db, challenge.list_id, person.id);
    if (!rights?.administer) return reply.code(403).send({ error: "Ce défi n'est pas vôtre." });
    await store.deleteChallenge(db, challenge.id);
    return { erased: true };
  });

  app.put("/challenges/:id/participation", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    const challenge = UUID.test(id || "") ? await store.challengeById(db, id) : null;
    if (!challenge) return reply.code(404).send({ error: "Défi inconnu." });
    const rights = await store.rightsOnList(db, challenge.list_id, person.id);
    if (!rights?.read) return reply.code(404).send({ error: "Défi inconnu." });
    await store.joinChallenge(db, challenge.id, person.id);
    return { inside: true };
  });

  app.delete("/challenges/:id/participation", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ error: "Défi inconnu." });
    /* Leaving ALWAYS works, with no check that you had the right to come
       in: somebody whose list has closed up must be able to get out of a
       count that still measures them. */
    await store.leaveChallenge(db, id, person.id);
    return { inside: false };
  });

  /* ------------------------------------------------------------
     THE BANK — categories and questions, and this half is reserved
     ------------------------------------------------------------
     `requireAdmin` guards everything here and nothing anywhere else:
     the role exists to say who fills the stock, not who plays. Reading
     the LIST of categories is open, because that is the menu one
     composes a quiz from; reading the QUESTIONS in one is not, for the
     obvious reason. */

  app.get("/categories", async (req) => {
    await requireAccount(req);
    return { categories: await store.categories(db) };
  });

  app.post("/categories", async (req, reply) => {
    await requireAdmin(req);
    const { label, blurb } = (req.body ?? {}) as { label?: string; blurb?: string };
    const name = (label || "").trim();
    if (!name || name.length > 60) {
      return reply.code(400).send({ error: "Il faut un nom, de 1 à 60 caractères." });
    }
    try {
      return { id: await store.createCategory(db, { label: name, blurb: (blurb || "").trim() }) };
    } catch {
      /* The UNIQUE on the label. Two categories of the same name would
         make the composing screen unreadable. */
      return reply.code(409).send({ error: "Cette catégorie existe déjà." });
    }
  });

  app.put("/categories/:id", async (req, reply) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "") || !(await store.categoryExists(db, id))) {
      return reply.code(404).send({ error: "Catégorie inconnue." });
    }
    const { label, blurb } = (req.body ?? {}) as { label?: string; blurb?: string };
    if (label !== undefined && !(label.trim() && label.trim().length <= 60)) {
      return reply.code(400).send({ error: "Il faut un nom, de 1 à 60 caractères." });
    }
    await store.editCategory(db, id, { label: label?.trim(), blurb: blurb?.trim() });
    return { done: true };
  });

  app.delete("/categories/:id", async (req, reply) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "") || !(await store.categoryExists(db, id))) {
      return reply.code(404).send({ error: "Catégorie inconnue." });
    }
    /* A category that has been dealt cannot go: `quiz_draw` holds its
       questions with `ON DELETE RESTRICT`, and a quiz already played
       must not lose them. The database says so; we translate. */
    try {
      await store.deleteCategory(db, id);
      return { erased: true };
    } catch {
      return reply
        .code(409)
        .send({ error: "Des quizz ont déjà tiré dedans. Retirez ses questions une à une." });
    }
  });

  app.get("/categories/:id/questions", async (req, reply) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "") || !(await store.categoryExists(db, id))) {
      return reply.code(404).send({ error: "Catégorie inconnue." });
    }
    return { questions: await store.bankQuestions(db, id) };
  });

  /** What a question's body must look like, checked before it goes down. */
  const readQuestion = (body: unknown): { ok?: ReadQuestion; error?: string } => {
    const { ask, hint, image, difficulty, choices } = (body ?? {}) as {
      ask?: string;
      hint?: string;
      image?: string | null;
      difficulty?: string;
      choices?: { label?: string; is_right?: boolean }[];
    };
    const asked = (ask || "").trim();
    if (!asked || asked.length > 400) return { error: "Il faut un énoncé, de 1 à 400 caractères." };
    if (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) {
      return { error: "Difficulté inconnue." };
    }
    /* `image` is a stored ADDRESS and never markup: a blob path under
       the bank's prefix, or an https URL. Anything else — a
       `javascript:` scheme above all — is refused here rather than
       guarded against in every place that renders it. */
    if (image != null && image !== "" && !/^(https:\/\/|bank\/)/.test(image)) {
      return { error: "Une image se désigne par son adresse." };
    }
    const props = (Array.isArray(choices) ? choices : [])
      .map((c) => ({ label: (c?.label || "").trim(), is_right: c?.is_right === true }))
      .filter((c) => c.label !== "");
    if (props.some((c) => c.label.length > 200)) {
      return { error: "Une proposition tient en 200 caractères." };
    }
    if (props.length > 8) return { error: "Huit propositions au plus." };
    return {
      ok: {
        ask: asked,
        hint: (hint || "").trim(),
        /* `undefined` means "leave it", `null` means "take it away" —
           the two are told apart all the way down to `store`. */
        image: image === undefined ? undefined : image || null,
        difficulty,
        choices: props,
      },
    };
  };

  app.post("/categories/:id/questions", async (req, reply) => {
    await requireAdmin(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "") || !(await store.categoryExists(db, id))) {
      return reply.code(404).send({ error: "Catégorie inconnue." });
    }
    const read = readQuestion(req.body);
    if (!read.ok) return reply.code(400).send({ error: read.error });

    const questionId = await store.addBankQuestion(db, id, read.ok);
    await store.setChoices(db, questionId, read.ok.choices);
    return { id: questionId };
  });

  app.put("/categories/:id/questions/:qid", async (req, reply) => {
    await requireAdmin(req);
    const { id, qid } = req.params as { id: string; qid: string };
    if (
      !UUID.test(id || "") ||
      !UUID.test(qid || "") ||
      !(await store.questionInCategory(db, qid, id))
    ) {
      return reply.code(404).send({ error: "Question inconnue." });
    }
    const read = readQuestion(req.body);
    if (!read.ok) return reply.code(400).send({ error: read.error });

    await store.editBankQuestion(db, qid, read.ok);
    /* THE PROPOSITIONS OF A DEALT QUESTION DO NOT MOVE. Somebody has
       answered them; replacing them would cascade the answers away and
       quietly rewrite a score. The wording and the picture may still be
       corrected — a typo is worth fixing — which is why the refusal is
       partial rather than a 409 on the whole edit. */
    const moved = await store.setChoices(db, qid, read.ok.choices);
    return { done: true, choicesFrozen: !moved };
  });

  app.delete("/categories/:id/questions/:qid", async (req, reply) => {
    await requireAdmin(req);
    const { id, qid } = req.params as { id: string; qid: string };
    if (
      !UUID.test(id || "") ||
      !UUID.test(qid || "") ||
      !(await store.questionInCategory(db, qid, id))
    ) {
      return reply.code(404).send({ error: "Question inconnue." });
    }
    /* Withdrawn, not erased, once it has been dealt: see the store. */
    return { fate: await store.retireBankQuestion(db, qid) };
  });

  app.post("/categories/:id/questions/:qid/revival", async (req, reply) => {
    await requireAdmin(req);
    const { id, qid } = req.params as { id: string; qid: string };
    if (
      !UUID.test(id || "") ||
      !UUID.test(qid || "") ||
      !(await store.questionInCategory(db, qid, id))
    ) {
      return reply.code(404).send({ error: "Question inconnue." });
    }
    await store.reviveBankQuestion(db, qid);
    return { revived: true };
  });

  /* ------------------------------------------------------------
     THE QUIZZES — dealt out of the bank, and open to everybody
     ------------------------------------------------------------
     No role guards anything below. Whoever drew a quiz did not write
     it, so they play it on the same terms as the people they invite —
     including the withholding of the right answers, which is the line
     that used to make an exception for an author and no longer needs
     to. */

  /** The rights over a quiz, or the refusal already made ready. */
  const quizOr404 = async (req: FastifyRequest, reply: FastifyReply, personId: string) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) {
      reply.code(404).send({ error: "Quiz inconnu." });
      return null;
    }
    const rights = await store.rightsOnQuiz(db, id, personId);
    /* NO 403 IN READING, as for the lists: a quiz one may not see
       answers like a quiz that does not exist. */
    if (!rights?.read) {
      reply.code(404).send({ error: "Quiz inconnu." });
      return null;
    }
    return rights;
  };

  app.get("/quizzes", async (req) => {
    const person = await requireAccount(req);
    return { quizzes: await store.myQuizzes(db, person.id) };
  });

  app.post("/quizzes", async (req, reply) => {
    const person = await requireAccount(req);
    const { title, categoryIds, level, size } = (req.body ?? {}) as {
      title?: string;
      categoryIds?: string[];
      level?: string;
      size?: number;
    };
    const name = (title || "").trim();
    if (!name || name.length > 120) {
      return reply.code(400).send({ error: "Il faut un titre, de 1 à 120 caractères." });
    }
    if (level !== undefined && !DIFFICULTIES.includes(level)) {
      return reply.code(400).send({ error: "Niveau inconnu." });
    }
    if (!SIZES.includes(Number(size))) {
      return reply.code(400).send({ error: "Dix, vingt ou trente questions." });
    }
    const wanted = Array.isArray(categoryIds) ? [...new Set(categoryIds)] : [];
    if (wanted.length === 0 || wanted.some((c) => !UUID.test(String(c)))) {
      return reply.code(400).send({ error: "Il faut au moins une catégorie." });
    }
    for (const c of wanted) {
      if (!(await store.categoryExists(db, c))) {
        return reply.code(404).send({ error: "Catégorie inconnue." });
      }
    }

    const drawn = await store.drawQuiz(db, person.id, {
      title: name,
      categoryIds: wanted,
      level: level ?? "normal",
      size: Number(size),
    });
    /* A DRAW THAT CAME OUT EMPTY IS NOT A QUIZ. The bank held nothing
       dealable in those baskets — no live question with exactly one
       right answer — and handing back a quiz of zero questions would
       have been a screen full of nothing with no reason given. */
    if (drawn.drawn === 0) {
      await store.deleteQuiz(db, drawn.id);
      return reply
        .code(409)
        .send({ error: "Ces catégories n'ont pas encore de question jouable." });
    }
    return { id: drawn.id, softened: drawn.softened, drawn: drawn.drawn };
  });

  app.get("/quizzes/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;

    const attempt = await store.myAttempt(db, rights.quiz_id, person.id);
    /* THE LINE THAT DECIDES EVERYTHING, and it now has no exception:
       nobody sees the corrections until their own attempt is closed.
       The dealer included — they did not write these questions. */
    const withAnswers = attempt?.finished_at != null;
    return {
      quiz: { ...(await store.quizById(db, rights.quiz_id)), mine: rights.write },
      questions: await store.drawnQuestions(db, rights.quiz_id, {
        withAnswers,
        forPerson: person.id,
      }),
      weight: await store.quizWeight(db, rights.quiz_id),
      attempt,
      /* The players only show themselves to whoever dealt the quiz. */
      players: rights.write ? await store.playersOf(db, rights.quiz_id) : [],
    };
  });

  app.put("/quizzes/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "Ce quiz n'est pas vôtre." });
    const { title } = (req.body ?? {}) as { title?: string };
    /* THE TITLE, AND NOTHING ELSE. A deal is not editable: changing its
       level or its baskets would mean re-drawing, and re-drawing under
       people who have started answering is how a leaderboard becomes a
       lie. Another quiz costs one gesture. */
    if (!title?.trim() || title.trim().length > 120) {
      return reply.code(400).send({ error: "Il faut un titre, de 1 à 120 caractères." });
    }
    await store.renameQuiz(db, rights.quiz_id, title.trim());
    return { done: true };
  });

  app.delete("/quizzes/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "Ce quiz n'est pas vôtre." });
    await store.deleteQuiz(db, rights.quiz_id);
    return { erased: true };
  });

  app.put("/quizzes/:id/players/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    if (!rights.write) return reply.code(403).send({ error: "Ce quiz n'est pas vôtre." });
    const { pseudo } = req.params as { pseudo: string };
    const invite = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!invite) return reply.code(404).send({ error: "Personne." });
    if (invite.id === person.id) return reply.code(400).send({ error: "C'est votre quiz." });
    /* As for a list: we do not invite somebody we have silenced, nor
       somebody who has silenced us. */
    if (await store.blockedIds(db, person.id, invite.id)) {
      return reply.code(404).send({ error: "Personne." });
    }
    await store.invitePlayer(db, rights.quiz_id, invite.id);
    return { pseudo: invite.pseudo, playing: true };
  });

  app.delete("/quizzes/:id/players/:pseudo", async (req, reply) => {
    const person = await requireAccount(req);
    const { id, pseudo } = req.params as { id: string; pseudo: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ error: "Quiz inconnu." });
    const about = await store.findByPseudo(db, (pseudo || "").toLowerCase());
    if (!about) return reply.code(404).send({ error: "Personne." });
    /* The dealer removes whoever they like; anybody else can only remove
       themselves. Walking away asks nobody's permission — and it is on
       purpose that this does NOT erase the attempt: a score already made
       stays made. */
    if (about.id !== person.id) {
      const rights = await store.rightsOnQuiz(db, id, person.id);
      if (!rights?.write) return reply.code(403).send({ error: "Ce quiz n'est pas vôtre." });
    }
    await store.removePlayer(db, id, about.id);
    return { pseudo: about.pseudo, playing: false };
  });

  /* ---- playing ---- */

  app.post("/quizzes/:id/attempt", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    /* Idempotent by the primary key: starting twice starts once, and a
       second call does NOT reopen a finished attempt. */
    await store.startAttempt(db, rights.quiz_id, person.id);
    return { attempt: await store.myAttempt(db, rights.quiz_id, person.id) };
  });

  app.post("/quizzes/:id/attempt/answers", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    const { questionId, choiceId } = (req.body ?? {}) as {
      questionId?: string;
      choiceId?: string;
    };
    if (!UUID.test(questionId || "") || !UUID.test(choiceId || "")) {
      return reply.code(400).send({ error: "Une question, et une proposition." });
    }
    /* `store.answer` does the rest in ONE statement: the attempt must be
       open, the proposition must belong to the question, and the
       question must be one this quiz WAS DEALT. Written as three checks
       here, the third is the one that gets forgotten. */
    const laid = await store.answer(db, rights.quiz_id, person.id, questionId!, choiceId!);
    if (!laid) return reply.code(409).send({ error: "Cette réponse est déjà posée." });
    return { answered: true };
  });

  app.post("/quizzes/:id/attempt/finish", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    await store.finishAttempt(db, rights.quiz_id, person.id);
    return {
      attempt: await store.myAttempt(db, rights.quiz_id, person.id),
      /* Now, and only now, the corrections come down. */
      questions: await store.drawnQuestions(db, rights.quiz_id, {
        withAnswers: true,
        forPerson: person.id,
      }),
    };
  });

  app.get("/quizzes/:id/scores", async (req, reply) => {
    const person = await requireAccount(req);
    const rights = await quizOr404(req, reply, person.id);
    if (!rights) return reply;
    return { scores: await store.scoresOf(db, rights.quiz_id, person.id) };
  });

  /* ------------------------------------------------------------
     THE MEDIA — a mirror of the blobs, on an Azure container
     ------------------------------------------------------------

     Until now nothing binary left the machine that made it: the
     synchronisation carries JSON, and a card seen on a second computer
     showed "stayed on the other device" where its poster should have
     been. These routes hand out the tickets that let the browser put a
     blob down, and take one back, WITHOUT the container's key ever
     reaching it.

     The rule, in one line: `media.ts` reads the path, and the path says
     which proof is required — one's own prefix for what is private,
     `canReadDecor` for what can be shared. Nothing here decides that;
     everything here asks. */

  /** The verbatim sentence for a server with no container behind it. */
  const noContainer = { error: "Ce serveur ne garde pas les médias." };

  /* WHY THESE THREE ROUTES HAVE THEIR OWN CEILING.
   *
   * The general one — a hundred a minute — is aimed at the routes that
   * WRITE, and it was right for them. A ticket writes nothing: it names
   * one blob, for one verb, for a quarter of an hour, and only ever on a
   * prefix the asker already owns.
   *
   * Under the general ceiling, a binder arriving on a second computer
   * ran into it in seconds. Every screenshot on screen asks for its own
   * ticket, so one film of twenty stills is twenty requests; the
   * hundredth was refused with a 429, and `mediaTicket` — which turns
   * every failure into `null` — reported that as "the image stayed on
   * the other device". Somebody's whole collection of screenshots looked
   * lost, and the server refusing them was our own.
   *
   * The batching just below is the real cure; this is what makes the
   * cure hold on the day somebody opens six films at once. */
  const ticketCeiling = { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } };

  app.post("/media/tickets", ticketCeiling, async (req, reply) => {
    const person = await requireAccount(req);
    if (!mediaAvailable()) return reply.code(503).send(noContainer);
    const body = (req.body ?? {}) as { paths?: unknown; mode?: unknown };
    const { paths } = body;
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 50) {
      return reply.code(400).send({ error: "De un à cinquante chemins." });
    }
    /* READING IN BATCHES TOO, AND IT IS THE SAME ROUTE.
       Only the sending side batched, because only the sending side was
       written knowing it would move a thousand blobs. The tirage asked
       one by one — see the ceiling above for what that cost. The verb
       still DEFAULTS to "write": it is what every existing caller means,
       and a default that grants more than the caller asked for is how a
       permission is widened by accident. */
    const mode = body.mode === "read" ? "read" : "write";

    /* A REFUSED PATH DOES NOT SINK THE WHOLE BATCH. Fifty screenshots go
       up in one request; one of them being wrong is worth one missing
       ticket, not fifty. The client sends again what it did not get. */
    const tickets: { path: string; url: string }[] = [];
    for (const p of paths) {
      if (typeof p !== "string") continue;
      if (!(await allowed(db, person.id, p, mode))) continue;
      const url = ticketFor(p, mode);
      if (url) tickets.push({ path: p, url });
    }
    return { tickets };
  });

  app.get("/media/ticket", ticketCeiling, async (req, reply) => {
    const person = await requireAccount(req);
    if (!mediaAvailable()) return reply.code(503).send(noContainer);
    const { path } = req.query as { path?: string };
    /* ONE ANSWER FOR "NOT ALLOWED" AND FOR "DOES NOT EXIST", in the
       spirit of `POST /auth/signin/options` above: telling the two apart
       would make this route a directory of other people's furniture. */
    if (!path || !(await allowed(db, person.id, path, "read"))) {
      return reply.code(404).send({ error: "Rien à cette adresse." });
    }
    const url = ticketFor(path, "read");
    if (!url) return reply.code(503).send(noContainer);
    return { path, url };
  });

  app.delete("/media", async (req, reply) => {
    const person = await requireAccount(req);
    if (!mediaAvailable()) return reply.code(503).send(noContainer);
    const { path } = req.query as { path?: string };
    /* Erasing is writing: a decor one has merely COPIED is not one's own
       to remove, and `allowed(…, "write")` is what says so. */
    if (!path || !(await allowed(db, person.id, path, "write"))) {
      return reply.code(404).send({ error: "Rien à cette adresse." });
    }
    const url = ticketFor(path, "write");
    if (!url) return reply.code(503).send(noContainer);
    return { path, url };
  });

  /* ------------------------------------------------------------
     THE DECORATION OBJECTS — and other people's shelf
     ------------------------------------------------------------
     A decor is the only thing somebody uploads that another person may
     read, which is why it has a table of its own rather than living
     under a private prefix. Everything about who may see what is in
     `store.canReadDecor`; these routes only carry the answers. */

  app.get("/decor", async (req) => {
    const person = await requireAccount(req);
    return { decor: await store.myDecor(db, person.id) };
  });

  app.get("/decor/shared", async (req) => {
    const person = await requireAccount(req);
    return { decor: await store.sharedDecor(db, person.id) };
  });

  app.get("/decor/of/:pseudo", async (req, reply) => {
    const me = await whoIs(req);
    const { pseudo } = req.params as { pseudo: string };
    if (!PSEUDO_OK.test(pseudo || "")) return reply.code(404).send({ error: "Personne." });
    return { decor: await store.publicDecorOf(db, pseudo.toLowerCase(), me?.id) };
  });

  app.post("/decor", async (req, reply) => {
    const person = await requireAccount(req);
    const { label, wall, kind, tintable, bytes } = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof label === "string" ? label.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return reply.code(400).send({ error: "Un nom de 1 à 60 caractères." });
    }
    if (kind !== undefined && kind !== "raster" && kind !== "svg") {
      return reply.code(400).send({ error: "Une image ou un dessin, rien d'autre." });
    }
    const decor = await store.createDecor(db, {
      ownerId: person.id,
      label: name,
      wall: typeof wall === "string" ? wall.slice(0, 40) : "",
      kind: (kind as "raster" | "svg") ?? "raster",
      tintable: tintable === true,
      bytes: Number(bytes) || 0,
    });
    /* The blob has NOT been put down yet: the client now asks for a
       write ticket on `decor/<id>` and uploads. Making the row first is
       what gives the object the identity two people can name. */
    return reply.code(201).send({ decor, path: `decor/${decor.id}` });
  });

  app.put("/decor/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ error: "Objet inconnu." });
    const { label, wall, is_public } = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof label === "string" ? label.trim() : undefined;
    if (name !== undefined && (name.length < 1 || name.length > 60)) {
      return reply.code(400).send({ error: "Un nom de 1 à 60 caractères." });
    }
    const done = await store.editDecor(db, person.id, id, {
      label: name,
      wall: typeof wall === "string" ? wall.slice(0, 40) : undefined,
      is_public: typeof is_public === "boolean" ? is_public : undefined,
    });
    /* Only its author edits it: co-building a list is one thing, taking
       somebody's furniture and renaming it at their place is another. */
    if (!done) return reply.code(404).send({ error: "Objet inconnu." });
    return { decor: await store.decorById(db, id) };
  });

  app.delete("/decor/:id", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ error: "Objet inconnu." });

    /* TWO GESTURES UNDER ONE BUTTON, and they are not the same gesture.
       The author WITHDRAWS the piece — a tombstone, so that the copies
       already given are not reached. Somebody who merely took a copy
       gives back THEIR copy, and the original does not move. */
    if (await store.ownsDecor(db, person.id, id)) {
      await store.deleteDecor(db, person.id, id);
      return { withdrawn: true };
    }
    await store.dropDecorCopy(db, person.id, id);
    return { withdrawn: false };
  });

  app.post("/decor/:id/copy", async (req, reply) => {
    const person = await requireAccount(req);
    const { id } = req.params as { id: string };
    if (!UUID.test(id || "")) return reply.code(404).send({ error: "Objet inconnu." });
    /* `copyDecor` asks `canReadDecor` itself — the right to take a copy
       is exactly the right to look at it, and saying so twice would make
       one of the two copies wrong one day. */
    if (!(await store.copyDecor(db, person.id, id))) {
      return reply.code(404).send({ error: "Objet inconnu." });
    }
    return { decor: await store.decorById(db, id), path: `decor/${id}` };
  });

  /* ------------------------------------------------------------
     WHAT IS YOURS, AND THE RIGHT TO LEAVE
     ------------------------------------------------------------ */

  app.get("/my-data", async (req) => {
    const person = await requireAccount(req);
    /* Everything the server holds about somebody, in a single object:
       it is what the regulation calls portability, and above all it is
       the least we can do. */
    return {
      person,
      cards: await store.cardsSince(db, person.id, 0, 100000),
      documents: await store.docsSince(db, person.id, 0, 100000),
    };
  });

  app.delete("/my-account", async (req, reply) => {
    const person = await requireAccount(req);
    await store.deletePerson(db, person.id);
    reply.clearCookie(COOKIE, { path: "/" });
    return { erased: true };
  });

  /* ------------------------------------------------------------
     THE PUSH NOTIFICATIONS
     ------------------------------------------------------------
     One single reason to ring in this whole server: a challenge that
     begins, a challenge that ends. With no VAPID keys these routes
     answer "no service" and the binder does not even show the
     setting. */

  app.get("/push-subscriptions", async () => ({
    possible: pushAvailable(),
    key: publicKeyForPush(),
  }));

  app.put("/push-subscriptions", async (req, reply) => {
    const person = await requireAccount(req);
    if (!pushAvailable()) {
      return reply.code(503).send({ error: "Ce serveur n'envoie pas de notifications." });
    }
    const { endpoint, p256dh, secret } = (req.body ?? {}) as {
      endpoint?: string;
      p256dh?: string;
      secret?: string;
    };
    /* THE SUBSCRIPTION COMES FROM THE BROWSER and the server cannot
       check it: all it can do is refuse what is not shaped like an
       address, so as not to file just anything. */
    if (!endpoint || !/^https:\/\//.test(endpoint) || !p256dh || !secret) {
      return reply.code(400).send({ error: "Abonnement illisible." });
    }
    await store.storePush(db, person.id, { endpoint, p256dh, secret });
    return { subscribed: true };
  });

  app.delete("/push-subscriptions", async (req, reply) => {
    await requireAccount(req);
    const { endpoint } = (req.body ?? {}) as { endpoint?: string };
    /* We erase by ENDPOINT and not by account: a shared computer must
       not silence the same person's phone. */
    if (endpoint) await store.forgetPush(db, endpoint);
    return reply.send({ subscribed: false });
  });

  /* `tmdb` SAYS WHETHER THE RELAY HAS A KEY OF ITS OWN, and it is not
     idle curiosity: without it the binder cannot tell a person whether
     the key it is asking them for is needed. Signed in against a server
     that relays TMDB, one needs no key at all; against a server started
     without `TMDB_KEY`, one needs one exactly as before. The screen was
     asking in both cases, with the same words. */
  app.get("/health", async () => ({ debout: true, tmdb: !!settings.tmdbKey }));

  /* ------------------------------------------------------------
     THE SERVICE DOOR — double-locked, and for good reasons
     ------------------------------------------------------------

     A passkey is signed with a fingerprint, a face or a physical key.
     None of that exists in a driven browser, which made synchronisation
     unverifiable end to end: one could try the server alone, the client
     alone, and never the two together.

     This route opens a session with no ceremony — exactly what the
     ceremony would have produced. It is a back door, and it is treated
     as one: it takes BOTH not being in production AND `DEV_DOOR=1` laid
     down by hand. Both conditions are read at start-up, not per request:
     an environment variable changed on the quiet does not reopen it.

     If you are reading this and wondering whether it can be live online:
     no, `index.ts` never offers it when `NODE_ENV=production`. */
  if (settings.devDoor) {
    app.post("/dev/session", async (req, reply) => {
      const { pseudo } = (req.body ?? {}) as { pseudo?: string };
      const name = (pseudo || `dev-${Date.now().toString(36)}`).toLowerCase();
      const person = (await store.findByPseudo(db, name)) ?? (await store.createPerson(db, name));
      setCookie(reply, await store.openSession(db, person.id));
      return { person, warning: "porte de développement" };
    });
  }

  /* ------------------------------------------------------------
     THE RELAYS — the TMDB key leaves the bundle
     ------------------------------------------------------------ */
  registerRelays(app, {
    tmdbKey: settings.tmdbKey,
    requireAccount,
    tmdbCeiling: settings.tmdbCeiling,
  });

  /* ------------------------------------------------------------
     THE SWEEP
     ------------------------------------------------------------
     An expired ceremony challenge is good for nothing and is never
     consumed: with no sweep, the table grows by one dead row per
     abandoned ceremony, for ever. Every hour is plenty — a challenge's
     validity does not depend on this housekeeping, it is checked on use
     (`expires_at > now()`). This is only a question of room.

     `unref()`: this timer must not hold the process alive when it is
     time to stop, or `npm run dev` refuses to give the hand back. */
  const sweeper = setInterval(
    () => {
      store.sweepChallenges(db).catch(() => {});
      /* THE REMINDERS GO THROUGH THE SAME SWEEP, on the hour: a
         challenge starting today is announced today, and the table of
         reminders already given stops the other twenty-three passes from
         saying it again. A real scheduler would be one more dependency
         for a server running on a desktop machine. */
      remindChallenges(db)
        .then(({ told }) => told && console.log(`  ${told} challenge reminder(s) sent`))
        .catch((e) => console.error("reminders:", e));
    },
    60 * 60 * 1000
  );
  sweeper.unref();
  app.addHook("onClose", async () => clearInterval(sweeper));

  function setCookie(reply: FastifyReply, secret: string) {
    reply.setCookie(COOKIE, secret, {
      path: "/",
      httpOnly: true,
      /* IN DEVELOPMENT `lax` IS ENOUGH; ONLINE IT BREAKS EVERYTHING.

         Locally the client and the server share `localhost`: two ports
         of one host are the same "site", and the cookie travels. Online
         the binder lives on a static-pages domain and the API on
         another: the request becomes cross-site, `lax` holds the cookie
         back — the session exists and is never sent.

         `none` allows it, and only makes sense with `Secure`: the two
         therefore go together, and are set by one single switch. */
      sameSite: settings.secure ? "none" : "lax",
      secure: settings.secure ?? false,
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return app;
}
