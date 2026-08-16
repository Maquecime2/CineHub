/* ============================================================
   THE STORE — the only questions the server asks the database
   ============================================================

   Every query lives here, and nowhere else. A route that wrote its SQL
   inside its handler would lose the one thing gathering them buys:
   being able to reread, on one page, everything the server knows how to
   do with somebody's data.
   ============================================================ */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import { one } from "./db.ts";
import { planDraw } from "./draw.ts";
import { CHALLENGE_HALF, DECLARED, DECLARED_CEILING, RATE, REVIEW_LENGTH } from "./points.ts";
import type { Kind } from "./points.ts";
import { draw, DRAWS, itemById, isUnique, packItem, WEARABLE } from "./shop.ts";
import { ceilingsFor, QuotaReached } from "./limits.ts";
import type { DecorDef, PackDef, PowerKind, Rng, ShopItem, Wearable } from "./shop.ts";
import type { Difficulty, Stock } from "./draw.ts";

export interface Person {
  id: string;
  pseudo: string;
  email: string | null;
  sharing?: string;
  token?: string | null;
  /** Writes quizzes. Laid down from the environment, never from a route. */
  is_admin?: boolean;
  /** Ce que le compte a le droit d'occuper : voir `limits.ts`. */
  plan?: string;
  /** Le cachet porté au comptoir, s'il y en a un. */
  stamp?: string | null;
}

export interface AccessKey {
  id: string;
  person_id: string;
  public_key: Uint8Array;
  counter: string | number;
  transports: string[];
}

/* ------------------------------------------------------------
   THE PEOPLE
   ------------------------------------------------------------ */

export async function findByPseudo(db: Db, pseudo: string): Promise<Person | null> {
  return one<Person>(
    db,
    "SELECT id, pseudo, email, sharing, token, is_admin, plan, stamp FROM person WHERE pseudo = $1",
    [pseudo]
  );
}

export async function findById(db: Db, id: string): Promise<Person | null> {
  return one<Person>(
    db,
    "SELECT id, pseudo, email, sharing, token, is_admin, plan FROM person WHERE id = $1",
    [id]
  );
}

/**
 * THE ONLY WAY TO BECOME AN ADMIN, and it does not go through the web.
 *
 * Replayed at every start-up from the `ADMINS` environment variable, so a
 * database recreated from nothing finds its author again without anybody
 * remembering to run an `UPDATE` by hand. Idempotent, and it grants only:
 * taking the role away is done by removing the pseudonym from the
 * environment and running the matching `UPDATE`, which is a deliberate
 * enough gesture that it should not be one line of start-up code.
 */
export async function markAdmins(db: Db, pseudos: string[]): Promise<void> {
  if (pseudos.length === 0) return;
  await db.query("UPDATE person SET is_admin = true WHERE pseudo = ANY($1)", [pseudos]);
}

export async function createPerson(db: Db, pseudo: string): Promise<Person> {
  const p = await one<Person>(
    db,
    "INSERT INTO person (id, pseudo) VALUES ($1, $2) RETURNING id, pseudo, email, is_admin, plan",
    [randomUUID(), pseudo]
  );
  if (!p) throw new Error("person not created");
  return p;
}

/** The right to erasure, in one line: the schema carries off the rest. */
export async function deletePerson(db: Db, id: string): Promise<void> {
  await db.query("DELETE FROM person WHERE id = $1", [id]);
}

/* ------------------------------------------------------------
   THE PASSKEYS
   ------------------------------------------------------------ */

export async function keysOf(db: Db, personId: string): Promise<AccessKey[]> {
  return db.query<AccessKey>(
    "SELECT id, person_id, public_key, counter, transports FROM access_key WHERE person_id = $1",
    [personId]
  );
}

export async function keyById(db: Db, id: string): Promise<AccessKey | null> {
  return one<AccessKey>(
    db,
    "SELECT id, person_id, public_key, counter, transports FROM access_key WHERE id = $1",
    [id]
  );
}

export async function addKey(
  db: Db,
  key: {
    id: string;
    personId: string;
    publicKey: Uint8Array;
    counter: number;
    transports: string[];
    device?: string | null;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO access_key (id, person_id, public_key, counter, transports, device)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      key.id,
      key.personId,
      Buffer.from(key.publicKey),
      key.counter,
      key.transports,
      key.device ?? null,
    ]
  );
}

/* WHAT THE LIST OF KEYS SHOWS, AND WHAT IT WITHHOLDS.
   The public key and the counter are of no use to somebody reading their
   own devices, and an identifier printed in full is a handle for
   somebody reading over their shoulder. So: the name they gave it, the
   transports — which is what tells a telephone from a Windows Hello —
   and the two dates. */
export interface KeyCard {
  id: string;
  device: string | null;
  transports: string[];
  created_at: string;
  seen_at: string | null;
}

export async function keyCards(db: Db, personId: string): Promise<KeyCard[]> {
  return db.query<KeyCard>(
    `SELECT id, device, transports, created_at, seen_at
       FROM access_key WHERE person_id = $1 ORDER BY created_at`,
    [personId]
  );
}

export async function countKeys(db: Db, personId: string): Promise<number> {
  const r = await one<{ n: string }>(
    db,
    "SELECT count(*)::text AS n FROM access_key WHERE person_id = $1",
    [personId]
  );
  return Number(r?.n ?? 0);
}

/* THE LAST KEY IS NOT REMOVED, AND IT IS THE DATABASE THAT SAYS SO.
   Checking the count in the route and deleting just after leaves a gap
   in which two simultaneous requests each see two keys and each remove
   one — the account locked out by a race. The subquery closes it: the
   deletion only happens if a SECOND key exists at that instant.
   Returns false when nothing was removed, whatever the reason. */
export async function forgetKey(db: Db, personId: string, id: string): Promise<boolean> {
  const gone = await db.query<{ id: string }>(
    `DELETE FROM access_key
      WHERE person_id = $1 AND id = $2
        AND EXISTS (SELECT 1 FROM access_key o WHERE o.person_id = $1 AND o.id <> $2)
      RETURNING id`,
    [personId, id]
  );
  return gone.length > 0;
}

export async function recordUsage(db: Db, id: string, counter: number): Promise<void> {
  await db.query("UPDATE access_key SET counter = $2, seen_at = now() WHERE id = $1", [
    id,
    counter,
  ]);
}

/* ------------------------------------------------------------
   THE CEREMONY CHALLENGES
   ------------------------------------------------------------
   The randomness of a WebAuthn ceremony. It lives a few minutes and is
   consumed ONCE: reading it again after use must fail, or an
   intercepted signature could serve twice. */

const CHALLENGE_LIFE_MS = 5 * 60 * 1000;

export async function setChallenge(
  db: Db,
  value: string,
  what: { personId?: string; pseudo?: string } = {}
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO webauthn_challenge (id, value, person_id, pseudo, expires_at) VALUES ($1, $2, $3, $4, $5)",
    [
      id,
      value,
      what.personId ?? null,
      what.pseudo ?? null,
      new Date(Date.now() + CHALLENGE_LIFE_MS),
    ]
  );
  return id;
}

export async function consumeChallenge(
  db: Db,
  id: string
): Promise<{ value: string; person_id: string | null; pseudo: string | null } | null> {
  /* Read and delete in the SAME statement: between a separate SELECT and
     DELETE, two simultaneous requests can consume the same challenge.
     `DELETE … RETURNING` leaves no such gap. */
  return one(
    db,
    "DELETE FROM webauthn_challenge WHERE id = $1 AND expires_at > now() RETURNING value, person_id, pseudo",
    [id]
  );
}

export async function sweepChallenges(db: Db): Promise<void> {
  await db.query("DELETE FROM webauthn_challenge WHERE expires_at <= now()");
}

/* ------------------------------------------------------------
   THE SESSIONS
   ------------------------------------------------------------ */

const SESSION_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

/* THE COOKIE CARRIES A SECRET, THE DATABASE KEEPS ONLY ITS DIGEST.
   A leak of the sessions table then hands over no usable session: it is
   the reasoning behind password hashes, applied to what replaces them.
   SHA-256 is enough here and a slow algorithm would miss the point — the
   secret is 256 bits of randomness, it cannot be guessed. */
export const fingerprintOf = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

export async function openSession(db: Db, personId: string): Promise<string> {
  const secret = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO session (digest, person_id, expires_at) VALUES ($1, $2, $3)", [
    fingerprintOf(secret),
    personId,
    new Date(Date.now() + SESSION_LIFE_MS),
  ]);
  return secret;
}

export async function personOfSession(db: Db, secret: string): Promise<Person | null> {
  return one<Person>(
    db,
    `SELECT p.id, p.pseudo, p.email, p.sharing, p.token, p.is_admin, p.plan
       FROM session s JOIN person p ON p.id = s.person_id
      WHERE s.digest = $1 AND s.expires_at > now()`,
    [fingerprintOf(secret)]
  );
}

export async function closeSession(db: Db, secret: string): Promise<void> {
  await db.query("DELETE FROM session WHERE digest = $1", [fingerprintOf(secret)]);
}

/* ------------------------------------------------------------
   THE CARDS
   ------------------------------------------------------------ */

export interface StoredCard {
  id: string;
  seq: string | number;
  tmdb_id: string | null;
  hidden: boolean;
  data: Record<string, unknown>;
  updated_at: Date;
  deleted: boolean;
}

/**
 * What has moved since a given rank, in the order it reached the server.
 *
 * NOT SINCE A DATE: dates come from the clients, whose clocks drift. A
 * device running late would file its cards "before" everybody else's
 * cursor, and they would never see them. The rank is given by the server
 * and never goes back.
 *
 * The ceiling is there because a first synchronisation can bring back a
 * whole collection: several pages beat a thirty-megabyte response that
 * times out on the way.
 */
export async function cardsSince(
  db: Db,
  personId: string,
  since: bigint | number,
  cap = 500
): Promise<StoredCard[]> {
  return db.query<StoredCard>(
    `SELECT id, seq, tmdb_id, hidden, data, updated_at, deleted
       FROM card WHERE person_id = $1 AND seq > $2
      ORDER BY seq ASC LIMIT $3`,
    [personId, String(since), cap]
  );
}

/**
 * Files a card come in from a device.
 *
 * LAST WRITER WINS, AND IT IS THE DATABASE THAT DECIDES. The clause
 * `WHERE card.updated_at < EXCLUDED.updated_at` refuses a version older than
 * the one already stored: two devices pushing at the same time cannot
 * overtake each other, whatever order they arrive in. Arbitrating on the
 * server by reading and then writing would leave exactly that gap.
 */
export async function storeCard(
  db: Db,
  personId: string,
  f: {
    id: string;
    tmdbId?: string | null;
    hidden?: boolean;
    data: unknown;
    updatedAt: Date;
    deleted?: boolean;
  }
): Promise<boolean> {
  /* `RETURNING` returns a row ONLY if the insert or the update actually
     happened: when the `WHERE` clause rules out a stale version, it
     returns nothing. That is how the caller learns it pushed into the
     void — with no second query, and no gap between the two. */
  const written = await db.query(
    /* WE PASS THE OBJECT, NEVER ITS SERIALISATION, and that is not a
       matter of style.

       The production driver serialises what goes into a `jsonb` column
       ITSELF. Handing it an already serialised string makes it
       serialise a second time: the card is filed as a JSON STRING and
       not as an object, `data->>'title'` finds nothing any more, and
       everything that reads it back receives text. An explicit cast
       changes nothing — measured on both engines.

       The tests' Postgres, for its part, accepts both shapes without
       flinching. The fault was therefore invisible in the tests and
       systematic in production: the one species a green suite never
       catches. It took pushing a card into a real Postgres to see it. */
    `INSERT INTO card (person_id, id, tmdb_id, hidden, data, updated_at, deleted)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (person_id, id) DO UPDATE
        SET tmdb_id = EXCLUDED.tmdb_id,
            /* THE hidden COLUMN IS NOT REWRITTEN BY A PUSH, and it was
               the one line of this clause that was missing.

               "Setting a card aside from sharing" is a SHARING
               decision, taken on this server and living on it alone:
               the client does not model it, does not store it, and so
               never sends it. EXCLUDED.hidden was therefore always
               false — and every push of the card made it public again,
               in silence.

               Writing one note on a card that had been set aside was
               enough to put it back in front of everybody. Nobody would
               have caught that: the card looks no different at home,
               only at other people's.

               It is hideCard that writes this column, and it alone. The
               protection is in the SCHEMA rather than in the route, as
               the house prefers: a rule written in one route is got
               round by the next one. */
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at,
            deleted = EXCLUDED.deleted,
            /* A FRESH RANK ON EVERY WRITE, without which the modified
               card would keep its place in the queue and the other
               devices, already past it, would never see it again. */
            seq = nextval('card_seq')
      WHERE card.updated_at < EXCLUDED.updated_at
     RETURNING seq`,
    [personId, f.id, f.tmdbId ?? null, f.hidden ?? false, f.data, f.updatedAt, f.deleted ?? false]
  );
  return written.length > 0;
}

export async function countCards(db: Db, personId: string): Promise<number> {
  const r = await one<{ n: string }>(
    db,
    "SELECT count(*)::text AS n FROM card WHERE person_id = $1 AND NOT deleted",
    [personId]
  );
  return Number(r?.n ?? 0);
}

/* ------------------------------------------------------------
   THE DOCUMENTS — the rest of the binder
   ------------------------------------------------------------
   The same rules as the cards, to the letter: the server's rank for the
   order, the client's date for the arbitration, and the refusal of a
   stale version written into the query rather than into the route. */

export interface StoredDoc {
  key: string;
  seq: string | number;
  content: unknown;
  updated_at: Date;
  deleted: boolean;
}

export async function docsSince(
  db: Db,
  personId: string,
  since: bigint | number,
  cap = 200
): Promise<StoredDoc[]> {
  return db.query<StoredDoc>(
    `SELECT key, seq, content, updated_at, deleted
       FROM doc WHERE person_id = $1 AND seq > $2
      ORDER BY seq ASC LIMIT $3`,
    [personId, String(since), cap]
  );
}

export async function storeDoc(
  db: Db,
  personId: string,
  d: { key: string; content: unknown; updatedAt: Date; deleted?: boolean }
): Promise<boolean> {
  /* UNE PIERRE TOMBALE N'A PAS DE CONTENU, ET LA COLONNE EN EXIGE UN.
     `content` est `jsonb NOT NULL` ; une suppression arrive avec `null`,
     et l'insertion partait en 23502 — cinq cents, journal côté serveur,
     rien de compréhensible côté classeur.

     Le chemin n'avait JAMAIS été emprunté : le magasin local ne savait
     pas effacer un document, il appelait `removeItem` en direct sans
     rien mettre en attente. Le jour où il a su le dire, le serveur ne
     savait pas l'entendre. Deux moitiés d'un même oubli, découvertes à
     un jour d'écart.

     `'null'::jsonb` est le JSON null — une valeur, pas une absence. La
     colonne est satisfaite, le client relit `content: null` avec
     `deleted: true`, et il sait déjà quoi en faire. */
  const ecrit = await db.query(
    `INSERT INTO doc (person_id, key, content, updated_at, deleted)
     VALUES ($1, $2, coalesce($3::jsonb, 'null'::jsonb), $4, $5)
     ON CONFLICT (person_id, key) DO UPDATE
        SET content = EXCLUDED.content,
            updated_at = EXCLUDED.updated_at,
            deleted = EXCLUDED.deleted,
            seq = nextval('doc_seq')
      WHERE doc.updated_at < EXCLUDED.updated_at
     RETURNING seq`,
    [personId, d.key, d.content, d.updatedAt, d.deleted ?? false]
  );
  return ecrit.length > 0;
}

/* ------------------------------------------------------------
   PARTAGER SA COLLECTION
   ------------------------------------------------------------ */

export async function setSharing(
  db: Db,
  personId: string,
  sharing: string,
  token: string | null
): Promise<void> {
  await db.query("UPDATE person SET sharing = $2, token = $3 WHERE id = $1", [
    personId,
    sharing,
    token,
  ]);
}

/* WHAT NEVER GOES OUT, SET ASIDE HERE AND NOWHERE ELSE.

   The free notes are a private diary, and the screening log an
   attendance sheet: neither of them is any business of a visitor's.
   They are taken out in the QUERY, by subtraction on the `jsonb`, and
   not in the route.

   The difference is not theoretical. A route that filters is a route
   somebody duplicates one day for another need, forgetting half the
   filter; a subtraction written into the only query that serves the
   public cannot be forgotten — there is nothing else to call. */
const WITHOUT_THE_PRIVATE = `f.data - 'notes' - 'watches' - 'watchedAt' AS data`;

export interface PublicCard {
  id: string;
  tmdb_id: string | null;
  data: Record<string, unknown>;
}

/**
 * Somebody's collection, seen from outside.
 *
 * `null` if they do not share, or if the token does not match. The SAME
 * `null` in both cases: saying "this account exists but does not share"
 * would tell you who is registered.
 */
export async function publicCollectionOf(
  db: Db,
  pseudo: string,
  token: string | null
): Promise<{ pseudo: string; stamp: string | null; films: PublicCard[] } | null> {
  const p = await findByPseudo(db, pseudo);
  if (!p) return null;
  if (p.sharing === "publique") {
    /* nothing to check */
  } else if (p.sharing === "lien") {
    if (!token || !p.token || token !== p.token) return null;
  } else {
    return null;
  }

  const films = await db.query<PublicCard>(
    `SELECT f.id, f.tmdb_id, ${WITHOUT_THE_PRIVATE}
       FROM card f
      WHERE f.person_id = $1 AND NOT f.hidden AND NOT f.deleted
      ORDER BY f.updated_at DESC`,
    [p.id]
  );
  return { pseudo: p.pseudo, stamp: p.stamp ?? null, films };
}

/** Take a card out of the sharing, or put it back in. */
export async function hideCard(
  db: Db,
  personId: string,
  cardId: string,
  hidden: boolean
): Promise<boolean> {
  const r = await db.query(
    `UPDATE card SET hidden = $3, seq = nextval('card_seq')
      WHERE person_id = $1 AND id = $2 RETURNING seq`,
    [personId, cardId, hidden]
  );
  return r.length > 0;
}

/** The cards kept out of sharing. Identifiers, nothing more. */
export async function hiddenCards(db: Db, personId: string): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    "SELECT id FROM card WHERE person_id = $1 AND hidden AND NOT deleted",
    [personId]
  );
  return r.map((l) => l.id);
}

/* ------------------------------------------------------------
   SUIVRE, ET LE FIL
   ------------------------------------------------------------ */

export interface Profile {
  pseudo: string;
  /** Le cachet porté — visible partout où le pseudonyme l'est. */
  stamp?: string | null;
  /** How many films their collection shows. */
  films: number;
  /** Am I already following them? */
  followed?: boolean;
}

/**
 * Somebody's profile — and it exists ONLY if they show themselves.
 *
 * So you can only find people who chose to be findable: no directory, no
 * list, and a username guessed at random tells you nothing more than an
 * invented one. Sharing by link does not open a profile: a link is given
 * to somebody, it does not make you public.
 */
export async function publicProfileOf(
  db: Db,
  pseudo: string,
  asker?: string
): Promise<Profile | null> {
  const p = await findByPseudo(db, pseudo);
  if (!p || p.sharing !== "publique") return null;

  /* A block makes you unfindable, both ways, and without saying so: it
     is the same 404 as "does not exist". Announcing "you are blocked"
     would turn the route into a way of checking that you are. */
  if (asker && (await blockedIds(db, asker, p.id))) return null;

  const n = await one<{ n: string }>(
    db,
    "SELECT count(*)::text AS n FROM card WHERE person_id = $1 AND NOT hidden AND NOT deleted",
    [p.id]
  );
  const followed = asker
    ? (
        await db.query("SELECT 1 FROM follow WHERE follower_id = $1 AND followed_id = $2", [
          asker,
          p.id,
        ])
      ).length > 0
    : undefined;

  return { pseudo: p.pseudo, stamp: p.stamp ?? null, films: Number(n?.n ?? 0), followed };
}

/* WHAT CUTS, AND STANDS IN THE WAY OF EVERY COMMUNITY READ.

   Written once, as a fragment, and pasted into the three queries that
   make two people cross — the profile, the feed, the reviews. A block
   acting one way only would leave the blocked person free to go on
   reading: the condition therefore looks both ways. */
const NOT_BLOCKED = (me: string, him: string) =>
  `NOT EXISTS (SELECT 1 FROM block b
                WHERE (b.blocker_id = ${me} AND b.blocked_id = ${him})
                   OR (b.blocker_id = ${him} AND b.blocked_id = ${me}))`;

export async function follow(db: Db, follower: string, followed: string): Promise<void> {
  /* `ON CONFLICT DO NOTHING`: following twice is the same gesture, and
     must answer the same thing. */
  await db.query(
    "INSERT INTO follow (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [follower, followed]
  );
}

export async function unfollow(db: Db, follower: string, followed: string): Promise<void> {
  await db.query("DELETE FROM follow WHERE follower_id = $1 AND followed_id = $2", [
    follower,
    followed,
  ]);
}

/** Who I follow, with what their collection still shows. */
export async function subscriptionsOf(db: Db, personId: string): Promise<Profile[]> {
  return db.query<Profile>(
    `SELECT p.pseudo, p.stamp,
            (SELECT count(*) FROM card f
              WHERE f.person_id = p.id AND NOT f.hidden AND NOT f.deleted)::int AS films,
            (p.sharing = 'publique') AS open
       FROM follow a JOIN person p ON p.id = a.followed_id
      WHERE a.follower_id = $1
      ORDER BY p.pseudo`,
    [personId]
  );
}

export interface FeedItem {
  pseudo: string;
  /** Le cachet que cette personne porte, ou rien. */
  stamp?: string | null;
  seq: string | number;
  id: string;
  tmdb_id: string | null;
  data: Record<string, unknown>;
  updated_at: Date;
}

/**
 * The feed: what the people you follow have touched recently.
 *
 * WHAT IT SAYS, AND WHAT IT DOES NOT CLAIM TO SAY. The server keeps no
 * history: it knows a card moved, not what changed inside it. So the feed
 * shows films recently touched, with the rating and review of the moment
 * — and never writes "rated it 4 stars", which it would be unable to
 * prove.
 *
 * It is computed on read, with no feed table. For a few dozen
 * subscriptions the `card_stream` index is plenty; the day it is not,
 * that will be a real problem of scale, and not before.
 */
export async function feedOf(
  db: Db,
  personId: string,
  before: bigint | number | null,
  cap = 40
): Promise<FeedItem[]> {
  return db.query<FeedItem>(
    `SELECT p.pseudo, p.stamp, f.seq, f.id, f.tmdb_id, ${WITHOUT_THE_PRIVATE}, f.updated_at
       FROM follow a
       JOIN person p ON p.id = a.followed_id
       JOIN card f ON f.person_id = p.id
      WHERE a.follower_id = $1
        AND p.sharing = 'publique'
        AND NOT f.hidden AND NOT f.deleted
        AND ($2::bigint IS NULL OR f.seq < $2::bigint)
        AND ${NOT_BLOCKED("$1", "p.id")}
      ORDER BY f.seq DESC
      LIMIT $3`,
    [personId, before === null ? null : String(before), cap]
  );
}

/* ------------------------------------------------------------
   WHAT IS SAID ABOUT A WORK
   ------------------------------------------------------------ */

export interface Review {
  pseudo: string;
  stamp?: string | null;
  /** The card's identifier at its author's: that is what gets reported. */
  card: string;
  rating: number | null;
  review: string | null;
  at: Date;
}

export interface Echo {
  /** How many public collections file this work. */
  collections: number;
  /** The mean of the ratings given, or `null` if nobody rated. */
  mean: number | null;
  ratings: number;
  reviews: Review[];
}

/* A RATING IS TEXT UNTIL SOMEBODY HAS LOOKED AT IT. The `jsonb` comes
   from six hundred different clients, older versions included: `rating`
   is a number there, or a string, or an empty string, or absent. A plain
   `::numeric` brings the WHOLE query down on one malformed card — a mean
   that disappears because a stranger has an old card. So we filter on
   the shape before converting. */
const RATING = `CASE WHEN f.data->>'rating' ~ '^[0-9]+(\\.[0-9]+)?$'
                   THEN (f.data->>'rating')::numeric END`;

/**
 * What the public collections say about a work.
 *
 * THE KEY IS `tmdb_id`, AND IT IS THE ONLY ONE POSSIBLE. Two people who
 * file the same film have two cards, two identifiers, often two titles —
 * the work's identity can only come from the shared reference. A card
 * typed by hand, with no `tmdb_id`, therefore joins no echo: it exists
 * only at home, and that is consistent.
 *
 * `asker` serves two purposes and not one: ruling out blocked
 * people, and ruling out yourself — reading your own review under "what
 * others think of it" would give a mean you had voted in twice.
 */
export async function echoOfWork(
  db: Db,
  tmdbId: string,
  asker: string | null,
  cap = 30
): Promise<Echo> {
  const filter = asker
    ? `AND p.id <> $2 AND ${NOT_BLOCKED("$2", "p.id")}`
    : `AND ($2::uuid IS NULL)`;
  const args = [tmdbId, asker];

  const count = await one<{ collections: string; ratings: string; mean: string | null }>(
    db,
    `SELECT count(*)::text AS collections,
            count(${RATING})::text AS ratings,
            avg(${RATING})::text AS mean
       FROM card f JOIN person p ON p.id = f.person_id
      WHERE f.tmdb_id = $1 AND p.sharing = 'publique'
        AND NOT f.hidden AND NOT f.deleted ${filter}`,
    args
  );

  /* Only the cards that SAY something come up: a work filed with
     neither a word nor a rating counts in the total and has nothing to
     read. Showing empty lines would pass silence off as an opinion. */
  const reviews = await db.query<Review>(
    `SELECT p.pseudo, p.stamp, f.id AS card, ${RATING} AS rating,
            NULLIF(f.data->>'review', '') AS review, f.updated_at AS at
       FROM card f JOIN person p ON p.id = f.person_id
      WHERE f.tmdb_id = $1 AND p.sharing = 'publique'
        AND NOT f.hidden AND NOT f.deleted ${filter}
        AND (NULLIF(f.data->>'review', '') IS NOT NULL OR ${RATING} IS NOT NULL)
      ORDER BY f.updated_at DESC
      LIMIT $3`,
    [...args, cap]
  );

  return {
    collections: Number(count?.collections ?? 0),
    ratings: Number(count?.ratings ?? 0),
    mean: count?.mean == null ? null : Math.round(Number(count.mean) * 100) / 100,
    reviews: reviews.map((a) => ({ ...a, rating: a.rating == null ? null : Number(a.rating) })),
  };
}

/* ------------------------------------------------------------
   PROTECTING ONESELF — blocking, reporting
   ------------------------------------------------------------ */

/** Is there a block between these two, in either direction? */
export async function blockedIds(db: Db, un: string, other: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM block
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [un, other]
  );
  return r.length > 0;
}

/**
 * Bloquer quelqu'un.
 *
 * AND UNDO THE SUBSCRIPTIONS ON BOTH SIDES, in the same breath. Blocking
 * while staying subscribed would leave a dead link in your own list, and
 * above all would leave the other subscribed to a feed they will never
 * see move again — a state nothing puts right if you unblock one day.
 */
export async function block(db: Db, blocker: string, blocked: string): Promise<void> {
  await db.query(
    "INSERT INTO block (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [blocker, blocked]
  );
  await db.query(
    `DELETE FROM follow
      WHERE (follower_id = $1 AND followed_id = $2) OR (follower_id = $2 AND followed_id = $1)`,
    [blocker, blocked]
  );
}

export async function unblock(db: Db, blocker: string, blocked: string): Promise<void> {
  await db.query("DELETE FROM block WHERE blocker_id = $1 AND blocked_id = $2", [blocker, blocked]);
}

/** Whom I HAVE blocked — never who blocked me: that is not askable. */
export async function myBlocks(db: Db, personId: string): Promise<string[]> {
  const r = await db.query<{ pseudo: string }>(
    `SELECT p.pseudo FROM block b JOIN person p ON p.id = b.blocked_id
      WHERE b.blocker_id = $1 ORDER BY p.pseudo`,
    [personId]
  );
  return r.map((l) => l.pseudo);
}

/**
 * Signaler quelque chose.
 *
 * Returns `false` if the same person had already reported it: the
 * gesture is the same, and a moderation queue a human will have to read
 * must not swell with every repeated click.
 */
/**
 * Accorder ou retirer un palier.
 *
 * À LA MAIN TANT QU'IL N'Y A PAS DE FACTURATION, et c'est le seul
 * endroit qui écrit cette colonne. Le jour où un prestataire de paiement
 * arrive, c'est lui qui appellera ceci depuis son webhook — la surface à
 * relire sera d'une fonction.
 */
export async function setPlan(db: Db, personId: string, plan: "free" | "plus"): Promise<boolean> {
  const r = await db.query<{ id: string }>(
    "UPDATE person SET plan = $2 WHERE id = $1 RETURNING id",
    [personId, plan]
  );
  return r.length > 0;
}

/* ------------------------------------------------------------
   LES IMPORTS — le geste le plus cher du produit
   ------------------------------------------------------------

   Six cents films importés, c'est six cents interrogations du relais
   TMDB. On compte donc, sur une fenêtre GLISSANTE de trente jours : un
   compteur remis à zéro le premier du mois donnerait deux imports à
   cheval sur deux jours.

   ON COMPTE À LA CONFIRMATION, pas au dépôt du fichier. Déposer un
   bordereau pour voir ce qu'il contient ne coûte rien et ne doit rien
   coûter ; ce qui compte est l'écriture dans la collection. */

const IMPORT_WINDOW = "30 days";

/** Combien d'imports sur les trente derniers jours. */
export async function importsInWindow(db: Db, personId: string): Promise<number> {
  const r = await one<{ n: string }>(
    db,
    `SELECT count(*)::text AS n FROM import_run
      WHERE person_id = $1 AND ran_at > now() - interval '${IMPORT_WINDOW}'`,
    [personId]
  );
  return Number(r?.n ?? 0);
}

/**
 * Note un import, et dit si le palier le permettait.
 *
 * LE COMPTE ET L'ÉCRITURE SONT DANS LA MÊME REQUÊTE, pour la raison qui
 * vaut partout ailleurs ici : entre lire un total et écrire une ligne,
 * deux requêtes concurrentes passent toutes les deux. Deux imports
 * lancés dans le même souffle depuis deux onglets en seraient un de
 * trop.
 */
export async function noteImport(db: Db, personId: string): Promise<boolean> {
  const bornes = ceilingsFor((await findById(db, personId)) ?? {});
  /* Rien à compter pour un palier sans borne — et surtout rien à
     écrire : une table qui grossit pour personne est une table qu'on
     nettoiera un jour sans savoir pourquoi. */
  if (bornes.imports === Infinity) return true;

  const rows = await db.query<{ id: string }>(
    `INSERT INTO import_run (id, person_id)
     SELECT $1, $2
      WHERE (SELECT count(*) FROM import_run
              WHERE person_id = $2 AND ran_at > now() - interval '${IMPORT_WINDOW}') < $3
     RETURNING id`,
    [randomUUID(), personId, bornes.imports]
  );
  return rows.length > 0;
}

/* ============================================================
   LE BUREAU DE MODÉRATION
   ============================================================

   La table `report` existait, la route pour SIGNALER aussi, et son
   `handled_at` n'a jamais été écrit une seule fois : rien ne savait
   lister ce qui attendait, donc rien ne pouvait le traiter. Sur une
   adresse ouverte au public ce n'est pas un confort, c'est une
   obligation — un signalement qu'on ne peut pas lire vaut un
   signalement qu'on refuse.

   CE QUE CES REQUÊTES NE FONT PAS, et c'est délibéré : fermer un compte.
   `deletePerson` existe et efface tout par cascade, ce qui est
   irréversible et sans recours. Une décision pareille ne se prend pas
   d'un clic dans une file d'attente ; elle se prend en dehors de
   l'outil, et l'outil ne doit pas la rendre facile.

   Ce qu'on offre à la place est RÉVERSIBLE : retirer la fiche du
   partage, ce que son auteur pouvait déjà faire lui-même — même colonne,
   même effet, et rien de détruit.
   ============================================================ */

export interface Report {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: Date;
  /** Le pseudonyme visé, `null` si son compte a disparu depuis. */
  about: string | null;
  /** Combien de personnes DIFFÉRENTES ont signalé la même chose. */
  echoes: number;
}

/**
 * La file d'attente : ce qui n'a pas encore été traité.
 *
 * ON REGROUPE PAR CIBLE, et c'est ce qui rend la file lisible. Dix
 * personnes signalant la même fiche font dix lignes dans la table — c'est
 * juste, chacune a fait son geste — mais une seule chose à regarder. Le
 * nombre d'échos est d'ailleurs l'information la plus utile de la
 * ligne : il dit par où commencer.
 *
 * `author_id` n'en sort PAS. Traiter un signalement ne demande pas de
 * savoir qui l'a fait, et l'afficher inviterait à en tenir compte —
 * c'est le contenu qu'on juge, pas le plaignant.
 */
export async function reportsToHandle(db: Db, limit = 100): Promise<Report[]> {
  return db.query<Report>(
    `SELECT min(r.id::text)::uuid AS id,
            r.target_type, r.target_id,
            min(r.reason) AS reason,
            min(r.created_at) AS created_at,
            max(p.pseudo) AS about,
            count(*)::int AS echoes
       FROM report r
       LEFT JOIN person p ON p.id = r.about_id
      WHERE r.handled_at IS NULL
      GROUP BY r.target_type, r.target_id
      ORDER BY count(*) DESC, min(r.created_at) ASC
      LIMIT $1`,
    [limit]
  );
}

/**
 * Ce signalement est traité — et tous ceux qui visent la même chose.
 *
 * TOUTE LA CIBLE D'UN COUP, puisque c'est par cible qu'on a regardé.
 * Clore une ligne sur dix laisserait neuf fois la même chose revenir
 * dans la file, et on la rouvrirait neuf fois pour rien.
 */
export async function handleReports(db: Db, targetType: string, targetId: string): Promise<number> {
  const r = await db.query(
    `UPDATE report SET handled_at = now()
      WHERE target_type = $1 AND target_id = $2 AND handled_at IS NULL
      RETURNING id`,
    [targetType, targetId]
  );
  return r.length;
}

/**
 * Retirer du partage la fiche visée, sans savoir à qui elle est.
 *
 * `hideCard` demande le propriétaire ; ici on ne l'a pas, et le chercher
 * d'abord ferait deux requêtes dont la première peut mentir — la fiche a
 * pu changer de main ou disparaître entre les deux. L'identifiant d'une
 * fiche est unique par personne, pas globalement, d'où le passage par
 * `about_id` du signalement : c'est LUI qui dit chez qui regarder, et il
 * a été écrit au moment du signalement précisément pour ça.
 */
export async function hideReported(db: Db, targetId: string): Promise<boolean> {
  const r = await db.query(
    `UPDATE card SET hidden = true, seq = nextval('card_seq')
      WHERE id = $1
        AND person_id IN (SELECT about_id FROM report
                           WHERE target_type = 'card' AND target_id = $1
                             AND about_id IS NOT NULL)
      RETURNING id`,
    [targetId]
  );
  return r.length > 0;
}

export async function report(
  db: Db,
  authorId: string,
  what: { targetType: string; targetId: string; aboutId: string | null; reason: string }
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO report (id, author_id, target_type, target_id, about_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     /* THE WHERE CLAUSE IS PART OF NAMING THE INDEX.
        The uniqueness index is partial — it covers only the reports
        whose author still exists. Without repeating its predicate here,
        Postgres does not recognise it and refuses the whole query
        (42P10): this is not an optimisation, it is the only way to name
        a partial index. */
     ON CONFLICT (author_id, target_type, target_id) WHERE author_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [randomUUID(), authorId, what.targetType, what.targetId, what.aboutId, what.reason]
  );
  return r.length > 0;
}

/* ------------------------------------------------------------
   THE LISTS, AND THE CHALLENGES DRAWN FROM THEM
   ------------------------------------------------------------ */

export interface ListRow {
  id: string;
  title: string;
  intent: string;
  is_public: boolean;
  owner: string;
  /** How many works. */
  works: number;
  /** Am I the owner, and may I write in it? */
  mienne?: boolean;
  isMember?: boolean;
}

export interface WorkRow {
  tmdb_id: string;
  title: string;
  year: string | null;
  by: string | null;
}

/** What somebody is allowed to do with a list. */
export interface Rights {
  read: boolean;
  write: boolean;
  administer: boolean;
  owner_id: string;
  list_id: string;
}

/**
 * Somebody's rights over a list, in one query.
 *
 * THREE LEVELS AND NOT TWO, because co-building is not owning.
 * A member adds and removes works; they do not rename the list, do not
 * make it public and do not delete it. Without that
 * asymmetry, a list built by six hands has nobody left answering for it.
 */
export async function rightsOnList(
  db: Db,
  listId: string,
  personId: string | null
): Promise<Rights | null> {
  const l = await one<{ id: string; owner_id: string; is_public: boolean; is_member: boolean }>(
    db,
    `SELECT l.id, l.owner_id, l.is_public,
            EXISTS (SELECT 1 FROM list_member m
                     WHERE m.list_id = l.id AND m.person_id = $2) AS is_member
       FROM list l WHERE l.id = $1`,
    [listId, personId]
  );
  if (!l) return null;
  const isOwner = personId !== null && l.owner_id === personId;
  return {
    list_id: l.id,
    owner_id: l.owner_id,
    read: l.is_public || isOwner || l.is_member,
    write: isOwner || l.is_member,
    administer: isOwner,
  };
}

/** My lists, and those I have been allowed to write in. */
export async function myLists(db: Db, personId: string): Promise<ListRow[]> {
  return db.query<ListRow>(
    `SELECT l.id, l.title, l.intent, l.is_public,
            p.pseudo AS owner,
            (SELECT count(*) FROM list_item i WHERE i.list_id = l.id)::int AS works,
            (l.owner_id = $1) AS mienne,
            EXISTS (SELECT 1 FROM list_member m
                     WHERE m.list_id = l.id AND m.person_id = $1) AS is_member
       FROM list l JOIN person p ON p.id = l.owner_id
      WHERE l.owner_id = $1
         OR EXISTS (SELECT 1 FROM list_member m
                     WHERE m.list_id = l.id AND m.person_id = $1)
      ORDER BY l.updated_at DESC`,
    [personId]
  );
}

/** Somebody's public lists — what a visitor gets to see of them. */
export async function publicListsOf(db: Db, ownerId: string): Promise<ListRow[]> {
  return db.query<ListRow>(
    `SELECT l.id, l.title, l.intent, l.is_public,
            p.pseudo AS owner,
            (SELECT count(*) FROM list_item i WHERE i.list_id = l.id)::int AS works
       FROM list l JOIN person p ON p.id = l.owner_id
      WHERE l.owner_id = $1 AND l.is_public
      ORDER BY l.updated_at DESC`,
    [ownerId]
  );
}

export async function createList(
  db: Db,
  ownerId: string,
  l: { title: string; intent?: string; is_public?: boolean }
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO list (id, owner_id, title, intent, is_public) VALUES ($1, $2, $3, $4, $5)",
    [id, ownerId, l.title, l.intent ?? "", l.is_public ?? false]
  );
  return id;
}

export async function editList(
  db: Db,
  listId: string,
  l: { title?: string; intent?: string; is_public?: boolean }
): Promise<void> {
  await db.query(
    `UPDATE list
        SET title = coalesce($2, title),
            intent = coalesce($3, intent),
            is_public = coalesce($4, is_public),
            updated_at = now()
      WHERE id = $1`,
    [listId, l.title ?? null, l.intent ?? null, l.is_public ?? null]
  );
}

export async function deleteList(db: Db, listId: string): Promise<void> {
  await db.query("DELETE FROM list WHERE id = $1", [listId]);
}

export async function worksOf(db: Db, listId: string): Promise<WorkRow[]> {
  return db.query<WorkRow>(
    `SELECT i.tmdb_id, i.title, i.year, p.pseudo AS by
       FROM list_item i LEFT JOIN person p ON p.id = i.added_by
      WHERE i.list_id = $1
      ORDER BY i.added_at`,
    [listId]
  );
}

/** Returns `false` if the work was already there: same gesture, same answer. */
export async function addToList(
  db: Db,
  listId: string,
  byWhom: string,
  o: { tmdbId: string; title?: string; year?: string | null }
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO list_item (list_id, tmdb_id, title, year, added_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (list_id, tmdb_id) DO NOTHING
     RETURNING tmdb_id`,
    [listId, o.tmdbId, o.title ?? "", o.year ?? null, byWhom]
  );
  await db.query("UPDATE list SET updated_at = now() WHERE id = $1", [listId]);
  return r.length > 0;
}

export async function removeFromList(db: Db, listId: string, tmdbId: string): Promise<void> {
  await db.query("DELETE FROM list_item WHERE list_id = $1 AND tmdb_id = $2", [listId, tmdbId]);
  await db.query("UPDATE list SET updated_at = now() WHERE id = $1", [listId]);
}

export async function membersOf(db: Db, listId: string): Promise<string[]> {
  const r = await db.query<{ pseudo: string }>(
    `SELECT p.pseudo FROM list_member m JOIN person p ON p.id = m.person_id
      WHERE m.list_id = $1 ORDER BY p.pseudo`,
    [listId]
  );
  return r.map((l) => l.pseudo);
}

export async function inviteToList(db: Db, listId: string, personId: string): Promise<void> {
  await db.query(
    "INSERT INTO list_member (list_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [listId, personId]
  );
}

export async function removeMemberFromList(
  db: Db,
  listId: string,
  personId: string
): Promise<void> {
  await db.query("DELETE FROM list_member WHERE list_id = $1 AND person_id = $2", [
    listId,
    personId,
  ]);
}

/* PROGRESS IS COMPUTED, IT IS NOT DECLARED.

   Nobody ticks "seen" in a challenge: the binder knows already. A work
   counts when a dated screening falls inside the period — that is the
   log, the very one that never leaves a shared collection. It does not
   leave here either: only a NUMBER comes out, and only for people who
   have asked to take part.

   `jsonb_typeof` before anything else: `watches` comes through clients
   of every era, and `jsonb_array_elements` on something that is not an
   array brings the whole query down. One old card would then be enough
   to wipe out everybody's progress.

   `watchedAt` is the fallback for cards from before the log — they still
   exist, and ignoring them would say "not seen" to somebody who
   has. */
const SEEN_DURING = `EXISTS (
  SELECT 1 FROM card f
   WHERE f.person_id = ep.person_id
     AND f.tmdb_id = li.tmdb_id
     AND NOT f.deleted
     AND (
       EXISTS (
         SELECT 1 FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(f.data->'watches') = 'array'
                     THEN f.data->'watches' ELSE '[]'::jsonb END) w
          WHERE left(w->>'date', 10) BETWEEN to_char(e.starts_on, 'YYYY-MM-DD')
                                         AND to_char(e.ends_on, 'YYYY-MM-DD'))
       OR left(f.data->>'watchedAt', 10) BETWEEN to_char(e.starts_on, 'YYYY-MM-DD')
                                                AND to_char(e.ends_on, 'YYYY-MM-DD')
     ))`;

export interface Challenge {
  id: string;
  title: string;
  list_id: string;
  list: string;
  starts_on: string;
  ends_on: string;
  by: string | null;
  works: number;
  /** Am I taking part? */
  inside?: boolean;
}

export interface Progress {
  pseudo: string;
  done: number;
}

/**
 * The challenges I can see: mine, those I have joined, and those built
 * on a public list belonging to somebody I follow.
 *
 * NO DIRECTORY OF CHALLENGES, for the same reason there is no directory
 * of people: a list of everything being played would make this binder a
 * public square, which it is not.
 */
export async function myChallenges(db: Db, personId: string): Promise<Challenge[]> {
  return db.query<Challenge>(
    `SELECT e.id, e.title, e.list_id, l.title AS list,
            to_char(e.starts_on, 'YYYY-MM-DD') AS starts_on,
            to_char(e.ends_on, 'YYYY-MM-DD') AS ends_on,
            p.pseudo AS by,
            (SELECT count(*) FROM list_item i WHERE i.list_id = l.id)::int AS works,
            EXISTS (SELECT 1 FROM challenge_participant x
                     WHERE x.challenge_id = e.id AND x.person_id = $1) AS inside
       FROM challenge e
       JOIN list l ON l.id = e.list_id
       LEFT JOIN person p ON p.id = e.created_by
      WHERE e.created_by = $1
         OR EXISTS (SELECT 1 FROM challenge_participant x
                     WHERE x.challenge_id = e.id AND x.person_id = $1)
         OR (l.is_public AND EXISTS (SELECT 1 FROM follow a
                                     WHERE a.follower_id = $1 AND a.followed_id = l.owner_id)
             AND ${NOT_BLOCKED("$1", "l.owner_id")})
      ORDER BY e.ends_on DESC`,
    [personId]
  );
}

export async function challengeById(db: Db, id: string): Promise<Challenge | null> {
  return one<Challenge>(
    db,
    `SELECT e.id, e.title, e.list_id, l.title AS list,
            to_char(e.starts_on, 'YYYY-MM-DD') AS starts_on,
            to_char(e.ends_on, 'YYYY-MM-DD') AS ends_on,
            p.pseudo AS by,
            (SELECT count(*) FROM list_item i WHERE i.list_id = l.id)::int AS works
       FROM challenge e
       JOIN list l ON l.id = e.list_id
       LEFT JOIN person p ON p.id = e.created_by
      WHERE e.id = $1`,
    [id]
  );
}

export async function createChallenge(
  db: Db,
  byWhom: string,
  e: { listId: string; title: string; starts_on: string; ends_on: string }
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO challenge (id, list_id, created_by, title, starts_on, ends_on) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, e.listId, byWhom, e.title, e.starts_on, e.ends_on]
  );
  /* Whoever starts a challenge takes part in it: the opposite — an
     organiser watching the others run — is not what these people do. */
  await joinChallenge(db, id, byWhom);
  return id;
}

export async function deleteChallenge(db: Db, id: string): Promise<void> {
  await db.query("DELETE FROM challenge WHERE id = $1", [id]);
}

export async function joinChallenge(db: Db, challengeId: string, personId: string): Promise<void> {
  await db.query(
    "INSERT INTO challenge_participant (challenge_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [challengeId, personId]
  );
}

export async function leaveChallenge(db: Db, challengeId: string, personId: string): Promise<void> {
  await db.query("DELETE FROM challenge_participant WHERE challenge_id = $1 AND person_id = $2", [
    challengeId,
    personId,
  ]);
}

/** Where each of them stands — one number per participant, nothing more. */
export async function progressOf(db: Db, challengeId: string): Promise<Progress[]> {
  return db.query<Progress>(
    `SELECT pe.pseudo,
            (SELECT count(*) FROM list_item li
              WHERE li.list_id = e.list_id AND ${SEEN_DURING})::int AS done
       FROM challenge_participant ep
       JOIN challenge e ON e.id = ep.challenge_id
       JOIN person pe ON pe.id = ep.person_id
      WHERE ep.challenge_id = $1
      ORDER BY 2 DESC, pe.pseudo`,
    [challengeId]
  );
}

/** One list by its identifier, without asking who is reading it. */
export async function listById(db: Db, id: string): Promise<ListRow | null> {
  return one<ListRow>(
    db,
    `SELECT l.id, l.title, l.intent, l.is_public, p.pseudo AS owner,
            (SELECT count(*) FROM list_item i WHERE i.list_id = l.id)::int AS works
       FROM list l JOIN person p ON p.id = l.owner_id
      WHERE l.id = $1`,
    [id]
  );
}

/* ------------------------------------------------------------
   THE BANK, AND THE QUIZZES DRAWN FROM IT
   ------------------------------------------------------------
   Two halves that barely speak. The BANK is stock — categories and
   questions, written by an admin, owned by nobody. A QUIZ is a DEAL made
   out of it: chosen once, frozen in `quiz_draw`, and played by everybody
   invited in the same order.

   The frozen deal is the whole reason a score can be compared, and it is
   why nothing below ever re-draws an existing quiz. */

export interface CategoryRow {
  id: string;
  label: string;
  blurb: string;
  /** Live questions, per level — what a draw has to work with. */
  easy: number;
  normal: number;
  hard: number;
}

export interface BankQuestion {
  id: string;
  category_id: string;
  ask: string;
  hint: string;
  image: string | null;
  difficulty: string;
  retired: boolean;
  choices: { id: string; label: string; is_right: boolean }[];
}

/* ---- the categories ---- */

/**
 * Every category, with what it holds.
 *
 * THE COUNTS COME DOWN WITH THE LIST, because the screen that offers the
 * baskets is the screen that must not offer an empty one. Asking for
 * them separately would have meant a second round trip to answer a
 * question the first one was already looking at the rows for.
 */
export async function categories(db: Db): Promise<CategoryRow[]> {
  return db.query<CategoryRow>(
    `SELECT c.id, c.label, c.blurb,
            count(q.id) FILTER (WHERE q.difficulty = 'easy')::int AS easy,
            count(q.id) FILTER (WHERE q.difficulty = 'normal')::int AS normal,
            count(q.id) FILTER (WHERE q.difficulty = 'hard')::int AS hard
       FROM quiz_category c
       LEFT JOIN quiz_question q
              ON q.category_id = c.id AND q.retired_at IS NULL
      GROUP BY c.id, c.label, c.blurb
      ORDER BY c.label`
  );
}

export async function createCategory(
  db: Db,
  c: { label: string; blurb?: string }
): Promise<string> {
  const id = randomUUID();
  await db.query("INSERT INTO quiz_category (id, label, blurb) VALUES ($1, $2, $3)", [
    id,
    c.label,
    c.blurb ?? "",
  ]);
  return id;
}

export async function editCategory(
  db: Db,
  id: string,
  c: { label?: string; blurb?: string }
): Promise<void> {
  await db.query(
    "UPDATE quiz_category SET label = coalesce($2, label), blurb = coalesce($3, blurb) WHERE id = $1",
    [id, c.label ?? null, c.blurb ?? null]
  );
}

export async function deleteCategory(db: Db, id: string): Promise<void> {
  await db.query("DELETE FROM quiz_category WHERE id = $1", [id]);
}

export async function categoryExists(db: Db, id: string): Promise<boolean> {
  return (
    (await one<{ id: string }>(db, "SELECT id FROM quiz_category WHERE id = $1", [id])) !== null
  );
}

/* ---- the questions in it ---- */

/**
 * A category's questions, corrections included.
 *
 * NO `withAnswers` FLAG HERE, and that is not an oversight: this is the
 * bank, and the only route that reads it is guarded by `requireAdmin`.
 * The withholding happens in `drawnQuestions` below, which is what a
 * player reads.
 */
export async function bankQuestions(db: Db, categoryId: string): Promise<BankQuestion[]> {
  const rows = await db.query<Omit<BankQuestion, "choices"> & { retired: boolean }>(
    `SELECT id, category_id, ask, hint, image, difficulty,
            (retired_at IS NOT NULL) AS retired
       FROM quiz_question WHERE category_id = $1
      ORDER BY difficulty, created_at`,
    [categoryId]
  );
  const choices = await db.query<{
    id: string;
    question_id: string;
    label: string;
    is_right: boolean;
  }>(
    `SELECT c.id, c.question_id, c.label, c.is_right
       FROM quiz_choice c JOIN quiz_question q ON q.id = c.question_id
      WHERE q.category_id = $1
      ORDER BY c.rank`,
    [categoryId]
  );
  return rows.map((q) => ({
    ...q,
    choices: choices
      .filter((c) => c.question_id === q.id)
      .map((c) => ({ id: c.id, label: c.label, is_right: c.is_right })),
  }));
}

export async function addBankQuestion(
  db: Db,
  categoryId: string,
  q: { ask: string; hint?: string; image?: string | null; difficulty?: string }
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO quiz_question (id, category_id, ask, hint, image, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, categoryId, q.ask, q.hint ?? "", q.image ?? null, q.difficulty ?? "normal"]
  );
  return id;
}

export async function editBankQuestion(
  db: Db,
  questionId: string,
  q: { ask?: string; hint?: string; image?: string | null; difficulty?: string }
): Promise<void> {
  await db.query(
    `UPDATE quiz_question
        SET ask = coalesce($2, ask),
            hint = coalesce($3, hint),
            image = CASE WHEN $4::boolean THEN $5 ELSE image END,
            difficulty = coalesce($6, difficulty)
      WHERE id = $1`,
    [
      questionId,
      q.ask ?? null,
      q.hint ?? null,
      /* An image is the one field one may want to CLEAR, and `coalesce`
         cannot tell "leave it" from "take it away". Hence the flag. */
      q.image !== undefined,
      q.image ?? null,
      q.difficulty ?? null,
    ]
  );
}

/**
 * WITHDRAWING A QUESTION IS NOT ERASING IT.
 *
 * A question already dealt into somebody's quiz must go on reading — a
 * score already made is not rewritten because an admin thought better of
 * a wording. So the bank stops dealing it, and the past keeps it. That
 * is also what `ON DELETE RESTRICT` on `quiz_draw` enforces from
 * underneath, for the day somebody reaches for a real `DELETE`.
 *
 * A question never dealt has nothing to protect: it goes for good.
 */
export async function retireBankQuestion(db: Db, questionId: string): Promise<"gone" | "retired"> {
  const dealt = await one<{ quiz_id: string }>(
    db,
    "SELECT quiz_id FROM quiz_draw WHERE question_id = $1 LIMIT 1",
    [questionId]
  );
  if (!dealt) {
    await db.query("DELETE FROM quiz_question WHERE id = $1", [questionId]);
    return "gone";
  }
  await db.query(
    "UPDATE quiz_question SET retired_at = now() WHERE id = $1 AND retired_at IS NULL",
    [questionId]
  );
  return "retired";
}

export async function reviveBankQuestion(db: Db, questionId: string): Promise<void> {
  await db.query("UPDATE quiz_question SET retired_at = NULL WHERE id = $1", [questionId]);
}

export async function questionInCategory(
  db: Db,
  questionId: string,
  categoryId: string
): Promise<boolean> {
  return (
    (await one<{ id: string }>(
      db,
      "SELECT id FROM quiz_question WHERE id = $1 AND category_id = $2",
      [questionId, categoryId]
    )) !== null
  );
}

/**
 * The whole set of propositions, replaced.
 *
 * Not a diff: a proposition has no identity worth keeping across an edit
 * — it is a line of text and a tick — and reconciling four of them would
 * be more code than rewriting them, with a way to get it wrong.
 *
 * THE ONE THING IT MUST NOT DO is rewrite propositions somebody has
 * already answered. `quiz_answer.choice_id` points at them, so replacing
 * a dealt question's set would cascade the answers away and quietly
 * change a score. Hence the refusal, in the same breath as the write.
 */
export async function setChoices(
  db: Db,
  questionId: string,
  choices: { label: string; is_right: boolean }[]
): Promise<boolean> {
  const dealt = await one<{ quiz_id: string }>(
    db,
    "SELECT quiz_id FROM quiz_draw WHERE question_id = $1 LIMIT 1",
    [questionId]
  );
  if (dealt) return false;
  await db.query("DELETE FROM quiz_choice WHERE question_id = $1", [questionId]);
  for (const [i, c] of choices.entries()) {
    await db.query(
      "INSERT INTO quiz_choice (id, question_id, rank, label, is_right) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), questionId, i + 1, c.label, c.is_right]
    );
  }
  return true;
}

/** Can this question be dealt at all — exactly one right answer? */
export async function dealable(db: Db, questionId: string): Promise<boolean> {
  const r = await one<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM quiz_choice
      WHERE question_id = $1 AND is_right`,
    [questionId]
  );
  return r?.n === 1;
}

/* ---- the draw ---- */

export interface QuizRow {
  id: string;
  title: string;
  level: string;
  size: number;
  softened: boolean;
  owner: string;
  /** The baskets it was drawn from. */
  topics: string[];
  /** Mine to invite into. */
  mine?: boolean;
  answered?: number;
  finished?: boolean;
}

export interface DrawnQuestion {
  id: string;
  rank: number;
  ask: string;
  image: string | null;
  points: number;
  category: string;
  /** Withheld until the attempt is over. */
  hint?: string;
  choices: { id: string; label: string; is_right?: boolean }[];
  mine?: string | null;
}

export interface QuizScore {
  pseudo: string;
  score: number;
  answered: number;
  finished: boolean;
}

/**
 * WHAT THE BANK HOLDS, for the levels a draw needs to plan against.
 *
 * Only DEALABLE questions are counted — live, and with exactly one right
 * answer. A half-written question in the bank is stock that does not
 * exist: planning against it would deal a question nobody can get right,
 * and the plan would be a lie one question at a time.
 */
export async function stockOf(
  db: Db,
  categoryIds: string[]
): Promise<{ categoryId: string; have: Record<string, number> }[]> {
  const rows = await db.query<{ category_id: string; difficulty: string; n: number }>(
    `SELECT q.category_id, q.difficulty, count(*)::int AS n
       FROM quiz_question q
      WHERE q.category_id = ANY($1)
        AND q.retired_at IS NULL
        AND (SELECT count(*) FROM quiz_choice c
              WHERE c.question_id = q.id AND c.is_right) = 1
      GROUP BY q.category_id, q.difficulty`,
    [categoryIds]
  );
  return categoryIds.map((id) => ({
    categoryId: id,
    have: {
      easy: rows.find((r) => r.category_id === id && r.difficulty === "easy")?.n ?? 0,
      normal: rows.find((r) => r.category_id === id && r.difficulty === "normal")?.n ?? 0,
      hard: rows.find((r) => r.category_id === id && r.difficulty === "hard")?.n ?? 0,
    },
  }));
}

/** `count` question identifiers, taken at random from one cell. */
async function pick(
  db: Db,
  categoryId: string,
  difficulty: string,
  count: number,
  already: string[]
): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    `SELECT q.id FROM quiz_question q
      WHERE q.category_id = $1 AND q.difficulty = $2
        AND q.retired_at IS NULL
        AND NOT (q.id = ANY($4))
        AND (SELECT count(*) FROM quiz_choice c
              WHERE c.question_id = q.id AND c.is_right) = 1
      ORDER BY random()
      LIMIT $3`,
    [categoryId, difficulty, count, already]
  );
  return r.map((x) => x.id);
}

/**
 * THE DEAL, AND IT HAPPENS ONCE.
 *
 * The arithmetic of it — shares, mix, what to do when the bank is short
 * — is in `draw.ts` and knows nothing of a database. This function does
 * the two things that need one: ask what the stock is, and pick that
 * many identifiers out of it at random.
 *
 * `ORDER BY random()` and not a shuffle in TypeScript: the rows never
 * have to come out of the database to be shuffled, and a category with
 * three hundred questions costs the same as one with three.
 */
export async function drawQuiz(
  db: Db,
  ownerId: string,
  q: { title: string; categoryIds: string[]; level: string; size: number }
): Promise<{ id: string; softened: boolean; drawn: number }> {
  const stock = await stockOf(db, q.categoryIds);
  const plan = planDraw(stock as Stock[], q.level as Difficulty, q.size, shuffled);

  const chosen: string[] = [];
  for (const cell of plan.cells) {
    chosen.push(...(await pick(db, cell.categoryId, cell.difficulty, cell.count, chosen)));
  }
  /* The order the questions are asked in is chance too. Dealing them
     category by category would have made every quiz read as a series of
     little blocks, which is not what "a quiz on three subjects" means. */
  const order = shuffled(chosen);

  const id = randomUUID();
  await db.query(
    "INSERT INTO quiz (id, owner_id, title, level, size, softened) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, ownerId, q.title, q.level, q.size, plan.softened || order.length < q.size]
  );
  for (const categoryId of q.categoryIds) {
    await db.query(
      "INSERT INTO quiz_topic (quiz_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [id, categoryId]
    );
  }
  for (const [i, questionId] of order.entries()) {
    await db.query("INSERT INTO quiz_draw (quiz_id, question_id, rank) VALUES ($1, $2, $3)", [
      id,
      questionId,
      i + 1,
    ]);
  }
  return { id, softened: plan.softened || order.length < q.size, drawn: order.length };
}

/** Fisher-Yates. Not `sort(() => Math.random() - 0.5)`, which is not a shuffle. */
function shuffled<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** What somebody is allowed to do with a quiz. */
export interface QuizRights {
  read: boolean;
  /** Invite, rename, erase. The dealer alone — nobody edits a deal. */
  write: boolean;
  owner_id: string;
  quiz_id: string;
}

/**
 * Somebody's rights over a quiz, in one query, blocks included.
 *
 * TWO LEVELS AND NO ROLE. Drawing a quiz is open to everybody, so
 * `is_admin` has nothing to say here — it guards the bank, and only the
 * bank. `read` is where the block lives, and it lives INSIDE this query
 * rather than in a fourth check laid on top: the fourth check is the one
 * that gets forgotten.
 */
export async function rightsOnQuiz(
  db: Db,
  quizId: string,
  personId: string | null
): Promise<QuizRights | null> {
  const q = await one<{ id: string; owner_id: string; invited: boolean; blocked: boolean }>(
    db,
    `SELECT q.id, q.owner_id,
            EXISTS (SELECT 1 FROM quiz_player x
                     WHERE x.quiz_id = q.id AND x.person_id = $2) AS invited,
            NOT ${NOT_BLOCKED("$2", "q.owner_id")} AS blocked
       FROM quiz q WHERE q.id = $1`,
    [quizId, personId]
  );
  if (!q) return null;
  const isOwner = personId !== null && q.owner_id === personId;
  return {
    quiz_id: q.id,
    owner_id: q.owner_id,
    write: isOwner,
    read: isOwner || (q.invited && !q.blocked),
  };
}

/** The quizzes I dealt, and those I was invited to. */
export async function myQuizzes(db: Db, personId: string): Promise<QuizRow[]> {
  return db.query<QuizRow>(
    `SELECT q.id, q.title, q.level, q.size, q.softened,
            o.pseudo AS owner,
            (q.owner_id = $1) AS mine,
            coalesce((SELECT array_agg(c.label ORDER BY c.label)
                        FROM quiz_topic t JOIN quiz_category c ON c.id = t.category_id
                       WHERE t.quiz_id = q.id), '{}') AS topics,
            (SELECT count(*) FROM quiz_answer a
              WHERE a.quiz_id = q.id AND a.person_id = $1)::int AS answered,
            EXISTS (SELECT 1 FROM quiz_attempt t
                     WHERE t.quiz_id = q.id AND t.person_id = $1
                       AND t.finished_at IS NOT NULL) AS finished
       FROM quiz q JOIN person o ON o.id = q.owner_id
      WHERE q.owner_id = $1
         OR (EXISTS (SELECT 1 FROM quiz_player x
                      WHERE x.quiz_id = q.id AND x.person_id = $1)
             AND ${NOT_BLOCKED("$1", "q.owner_id")})
      ORDER BY q.created_at DESC`,
    [personId]
  );
}

export async function quizById(db: Db, id: string): Promise<QuizRow | null> {
  return one<QuizRow>(
    db,
    `SELECT q.id, q.title, q.level, q.size, q.softened, o.pseudo AS owner,
            coalesce((SELECT array_agg(c.label ORDER BY c.label)
                        FROM quiz_topic t JOIN quiz_category c ON c.id = t.category_id
                       WHERE t.quiz_id = q.id), '{}') AS topics
       FROM quiz q JOIN person o ON o.id = q.owner_id
      WHERE q.id = $1`,
    [id]
  );
}

export async function renameQuiz(db: Db, quizId: string, title: string): Promise<void> {
  await db.query("UPDATE quiz SET title = $2 WHERE id = $1", [quizId, title]);
}

export async function deleteQuiz(db: Db, quizId: string): Promise<void> {
  await db.query("DELETE FROM quiz WHERE id = $1", [quizId]);
}

/**
 * The questions a quiz was dealt, and THE FLAG THAT DECIDES WHETHER THE
 * ANSWER IS IN THEM.
 *
 * `withAnswers` is false for somebody still playing, and that is the
 * whole security of the exercise: `is_right` and `hint` never leave this
 * process before the attempt is over, so opening the inspector shows the
 * propositions and nothing else. Withholding them in the component that
 * renders them would have shipped them anyway.
 *
 * NOTE THAT THE DEALER GETS NO PRIVILEGE HERE. Whoever drew the quiz did
 * not write it — the bank did — so they play it on the same terms as the
 * people they invited, and their score counts like anybody's.
 */
export async function drawnQuestions(
  db: Db,
  quizId: string,
  o: { withAnswers: boolean; forPerson?: string | null }
): Promise<DrawnQuestion[]> {
  const rows = await db.query<{
    id: string;
    rank: number;
    ask: string;
    hint: string;
    image: string | null;
    points: number;
    category: string;
    mine: string | null;
  }>(
    `SELECT q.id, d.rank, q.ask, q.hint, q.image,
            quiz_points(q.difficulty) AS points,
            c.label AS category,
            (SELECT a.choice_id FROM quiz_answer a
              WHERE a.quiz_id = d.quiz_id AND a.question_id = q.id
                AND a.person_id = $2) AS mine
       FROM quiz_draw d
       JOIN quiz_question q ON q.id = d.question_id
       JOIN quiz_category c ON c.id = q.category_id
      WHERE d.quiz_id = $1
      ORDER BY d.rank`,
    [quizId, o.forPerson ?? null]
  );
  const choices = await db.query<{
    id: string;
    question_id: string;
    label: string;
    is_right: boolean;
  }>(
    `SELECT c.id, c.question_id, c.label, c.is_right
       FROM quiz_choice c
       JOIN quiz_draw d ON d.question_id = c.question_id
      WHERE d.quiz_id = $1
      ORDER BY c.rank`,
    [quizId]
  );
  return rows.map((q) => ({
    id: q.id,
    rank: q.rank,
    ask: q.ask,
    image: q.image,
    points: q.points,
    category: q.category,
    ...(o.withAnswers ? { hint: q.hint } : {}),
    mine: q.mine,
    choices: choices
      .filter((c) => c.question_id === q.id)
      .map((c) => ({
        id: c.id,
        label: c.label,
        ...(o.withAnswers ? { is_right: c.is_right } : {}),
      })),
  }));
}

/** What a quiz is worth in all — the same for two quizzes of a level. */
export async function quizWeight(db: Db, quizId: string): Promise<number> {
  const r = await one<{ n: number }>(
    db,
    `SELECT coalesce(sum(quiz_points(q.difficulty)), 0)::int AS n
       FROM quiz_draw d JOIN quiz_question q ON q.id = d.question_id
      WHERE d.quiz_id = $1`,
    [quizId]
  );
  return r?.n ?? 0;
}

/* ---- who plays, and what they scored ---- */

export async function playersOf(db: Db, quizId: string): Promise<string[]> {
  const r = await db.query<{ pseudo: string }>(
    `SELECT p.pseudo FROM quiz_player x JOIN person p ON p.id = x.person_id
      WHERE x.quiz_id = $1 ORDER BY p.pseudo`,
    [quizId]
  );
  return r.map((l) => l.pseudo);
}

export async function invitePlayer(db: Db, quizId: string, personId: string): Promise<void> {
  await db.query(
    "INSERT INTO quiz_player (quiz_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [quizId, personId]
  );
}

export async function removePlayer(db: Db, quizId: string, personId: string): Promise<void> {
  await db.query("DELETE FROM quiz_player WHERE quiz_id = $1 AND person_id = $2", [
    quizId,
    personId,
  ]);
}

export interface Attempt {
  started_at: string;
  finished_at: string | null;
}

export async function myAttempt(db: Db, quizId: string, personId: string): Promise<Attempt | null> {
  return one<Attempt>(
    db,
    "SELECT started_at, finished_at FROM quiz_attempt WHERE quiz_id = $1 AND person_id = $2",
    [quizId, personId]
  );
}

/** Opening one is idempotent — the primary key sees to it. */
export async function startAttempt(db: Db, quizId: string, personId: string): Promise<void> {
  await db.query(
    "INSERT INTO quiz_attempt (quiz_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [quizId, personId]
  );
}

/**
 * Lay down one answer. Returns false when it changed nothing — already
 * answered, or the attempt is closed.
 *
 * The `WHERE` on `finished_at IS NULL` is not a courtesy: without it, a
 * request kept aside and replayed after the correction has been shown
 * would score. The `ON CONFLICT DO NOTHING` says the other half — there
 * is no changing one's mind once the answer is in. And the proposition
 * must belong to a question THIS QUIZ WAS DEALT, which is the third
 * condition below and the one a route would have forgotten.
 */
export async function answer(
  db: Db,
  quizId: string,
  personId: string,
  questionId: string,
  choiceId: string
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO quiz_answer (quiz_id, person_id, question_id, choice_id)
     SELECT $1, $2, $3, $4
      WHERE EXISTS (SELECT 1 FROM quiz_attempt t
                     WHERE t.quiz_id = $1 AND t.person_id = $2 AND t.finished_at IS NULL)
        AND EXISTS (SELECT 1 FROM quiz_choice c
                     JOIN quiz_draw d ON d.question_id = c.question_id
                    WHERE c.id = $4 AND d.question_id = $3 AND d.quiz_id = $1)
     ON CONFLICT DO NOTHING
     RETURNING question_id`,
    [quizId, personId, questionId, choiceId]
  );
  return r.length > 0;
}

export async function finishAttempt(db: Db, quizId: string, personId: string): Promise<void> {
  await db.query(
    `UPDATE quiz_attempt SET finished_at = now()
      WHERE quiz_id = $1 AND person_id = $2 AND finished_at IS NULL`,
    [quizId, personId]
  );
}

/**
 * The scoreboard — and it is COMPUTED, never stored.
 *
 * A score column would be a second version of the truth, and the day the
 * two disagreed there would be no telling which one was right. Here the
 * answers are the truth, the points follow the difficulty through
 * `quiz_points`, and the sum is a reading of both.
 *
 * Only people the reader may see appear: the dealer, and the invited
 * players who are not blocked either way. A quiz has no public
 * leaderboard, on purpose.
 */
export async function scoresOf(db: Db, quizId: string, personId: string): Promise<QuizScore[]> {
  return db.query<QuizScore>(
    `SELECT p.pseudo,
            coalesce(sum(quiz_points(q.difficulty)) FILTER (WHERE c.is_right), 0)::int AS score,
            count(a.question_id)::int AS answered,
            (t.finished_at IS NOT NULL) AS finished
       FROM quiz_attempt t
       JOIN person p ON p.id = t.person_id
       LEFT JOIN quiz_answer a ON a.quiz_id = t.quiz_id AND a.person_id = t.person_id
       LEFT JOIN quiz_choice c ON c.id = a.choice_id
       LEFT JOIN quiz_question q ON q.id = a.question_id
      WHERE t.quiz_id = $1
        AND ${NOT_BLOCKED("$2", "t.person_id")}
      GROUP BY p.pseudo, t.finished_at
      ORDER BY 2 DESC, p.pseudo`,
    [quizId, personId]
  );
}

/* ---- the media guard ----
   A picture belongs to a QUESTION, which belongs to the bank — so the
   right to look at one is not a right over a quiz. Anybody with an
   account may read it: the bank is the common stock everybody draws
   from, and a picture whose address is a pair of random identifiers is
   not a secret worth building a second permission system for. Writing
   is the admin's, like everything else in the bank. */

export async function mayWriteBankMedia(db: Db, personId: string): Promise<boolean> {
  const p = await findById(db, personId);
  return p?.is_admin === true;
}

/* ------------------------------------------------------------
   LA MESURE, ET CE QU'ELLE REFUSE DE SAVOIR
   ------------------------------------------------------------ */

/**
 * Counts one gesture, for the current day.
 *
 * NO IDENTIFIER PASSES THROUGH THIS FUNCTION, and it is its signature
 * that guarantees it: it takes one word only. So one cannot, even
 * absent-mindedly, hand it an account or an address — there is no
 * parameter to receive them.
 */
/* ------------------------------------------------------------
   THE PAIRING CODES
   ------------------------------------------------------------
   The second door into an account, for the case a passkey cannot cover:
   two machines with no domain in common — `localhost` on each of them —
   have nothing to sign for, so the QR ceremony has nothing to work
   with.

   A CODE IS WORTH AN ACCOUNT FOR AS LONG AS IT LIVES, and it lives a
   week: pairing a second computer is not something one does in the ten
   minutes after thinking of it, and a code that has expired by the time
   one sits down at the other machine is a code one asks for three times.

   The week is bought from the OTHER guards, which is why none of them
   may be relaxed: fifty bits of randomness, one single use, ten tries an
   hour on the route that spends it, and only the digest in this table —
   the same reasoning as a session secret, applied to what opens one. */

const PAIRING_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

/* NO `I`, NO `O`, NO `0`, NO `1`. This is read off one screen and typed
   on another, by somebody who did not choose it: the pairs that look
   alike in most fonts are simply not in the alphabet. Ten characters of
   this make about fifty bits — with a rate limit in front, that is out
   of reach of guessing. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function makePairingCode(db: Db, personId: string): Promise<string> {
  const bytes = randomBytes(10);
  const code = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  await db.query("INSERT INTO pairing_code (digest, person_id, expires_at) VALUES ($1, $2, $3)", [
    fingerprintOf(code),
    personId,
    new Date(Date.now() + PAIRING_LIFE_MS),
  ]);
  return code;
}

/**
 * Spends a code, and says whose account it opens.
 *
 * Read and delete in ONE statement: between a separate SELECT and
 * DELETE, the same code could be spent twice.
 */
export async function spendPairingCode(db: Db, code: string): Promise<string | null> {
  const row = await one<{ person_id: string }>(
    db,
    `DELETE FROM pairing_code
      WHERE digest = $1 AND expires_at > now()
      RETURNING person_id`,
    [fingerprintOf((code || "").trim().toUpperCase())]
  );
  return row?.person_id ?? null;
}

export async function sweepPairingCodes(db: Db): Promise<void> {
  await db.query("DELETE FROM pairing_code WHERE expires_at <= now()");
}

/* ------------------------------------------------------------
   THE DECORATION OBJECTS
   ------------------------------------------------------------
   A decor is the only thing somebody uploads that ANOTHER PERSON may
   read. Everything else — posters, screenshots — is guarded by its
   blob's path alone (`p/<person id>/…`, and a ticket is only ever issued
   for one's own prefix). That guarantee is worth keeping simple, so
   decors were taken out from under it: they live at `decor/<id>`, and
   the right to read one is decided HERE.

   Which is the point of putting it here rather than in a route: a rule
   written in a route is worked around by the next route. */

export interface Decor {
  id: string;
  owner_id: string;
  owner?: string;
  label: string;
  wall: string;
  kind: "raster" | "svg";
  tintable: boolean;
  bytes: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  mine?: boolean;
}

const DECOR_COLUMNS = `d.id, d.owner_id, d.label, d.wall, d.kind, d.tintable,
                       d.bytes, d.is_public, d.created_at, d.updated_at`;

export async function decorById(db: Db, id: string): Promise<Decor | null> {
  return one<Decor>(db, `SELECT ${DECOR_COLUMNS} FROM decor d WHERE d.id = $1 AND NOT d.deleted`, [
    id,
  ]);
}

/** Mine, and the ones I took from somebody — with who made them. */
export async function myDecor(db: Db, personId: string): Promise<Decor[]> {
  return db.query<Decor>(
    `SELECT ${DECOR_COLUMNS}, p.pseudo AS owner, (d.owner_id = $1) AS mine
       FROM decor d
       JOIN person p ON p.id = d.owner_id
      WHERE NOT d.deleted
        AND (d.owner_id = $1
             OR EXISTS (SELECT 1 FROM decor_copy c
                         WHERE c.decor_id = d.id AND c.person_id = $1))
      ORDER BY d.created_at`,
    [personId]
  );
}

/**
 * The shelf of what the people I follow have put on show.
 *
 * A BLOCK BEATS `is_public`. Somebody I have silenced does not come back
 * in through the furniture — and the check is in the query, not laid
 * over the result afterwards, so that no caller can forget it.
 */
export async function sharedDecor(db: Db, personId: string): Promise<Decor[]> {
  return db.query<Decor>(
    `SELECT ${DECOR_COLUMNS}, p.pseudo AS owner, false AS mine
       FROM decor d
       JOIN person p ON p.id = d.owner_id
       JOIN follow a ON a.followed_id = d.owner_id AND a.follower_id = $1
      WHERE d.is_public AND NOT d.deleted
        AND NOT EXISTS (SELECT 1 FROM block b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = d.owner_id)
                            OR (b.blocker_id = d.owner_id AND b.blocked_id = $1))
      ORDER BY d.created_at DESC`,
    [personId]
  );
}

export async function publicDecorOf(db: Db, pseudo: string, asker?: string): Promise<Decor[]> {
  return db.query<Decor>(
    `SELECT ${DECOR_COLUMNS}, p.pseudo AS owner, false AS mine
       FROM decor d
       JOIN person p ON p.id = d.owner_id
      WHERE p.pseudo = $1 AND d.is_public AND NOT d.deleted
        AND ($2::uuid IS NULL OR NOT EXISTS (
              SELECT 1 FROM block b
               WHERE (b.blocker_id = $2 AND b.blocked_id = d.owner_id)
                  OR (b.blocker_id = d.owner_id AND b.blocked_id = $2)))
      ORDER BY d.created_at DESC`,
    [pseudo, asker ?? null]
  );
}

export async function createDecor(
  db: Db,
  d: {
    ownerId: string;
    label: string;
    wall?: string;
    kind?: "raster" | "svg";
    tintable?: boolean;
    bytes?: number;
  }
): Promise<Decor> {
  /* LES BORNES VIENNENT DU PALIER, ET L'ADMIN N'EN A PAS. On lit la
     personne ici plutôt que de la faire descendre : une signature qui
     réclamerait les bornes serait une signature qu'on peut appeler avec
     les mauvaises. */
  const bornes = ceilingsFor((await findById(db, d.ownerId)) ?? {});

  /* LE PLAFOND EST DANS L'INSERT, ET NON AUTOUR — même raison que le
     plafond quotidien de `award` juste plus bas : entre lire le total et
     écrire la ligne, deux requêtes concurrentes passent toutes les deux.
     La CTE ne rend une ligne que si le compte ET le poids restent sous
     leurs bornes ; sans elle, l'INSERT ne trouve rien à insérer et rend
     `null`, que l'appelant lit comme un refus. */
  const row = await one<Decor>(
    db,
    `WITH tenu AS (
       SELECT count(*)::int AS n, coalesce(sum(bytes), 0)::bigint AS poids
         FROM decor WHERE owner_id = $2 AND NOT deleted
     ),
     permis AS (
       SELECT 1 FROM tenu
        WHERE ($8::bigint IS NULL OR n < $8::bigint)
          AND ($9::bigint IS NULL OR poids + $7 <= $9::bigint)
     )
     INSERT INTO decor (id, owner_id, label, wall, kind, tintable, bytes)
     SELECT $1, $2, $3, $4, $5, $6, $7 FROM permis
     RETURNING id, owner_id, label, wall, kind, tintable, bytes, is_public,
               created_at, updated_at`,
    [
      randomUUID(),
      d.ownerId,
      d.label,
      d.wall ?? "",
      d.kind ?? "raster",
      d.tintable ?? false,
      d.bytes ?? 0,
      borne(bornes.decors),
      borne(bornes.decorBytes),
    ]
  );
  if (!row) {
    /* PAS DE LIGNE VEUT DIRE « PLAFOND ATTEINT » : la CTE `permis` n'a
       rien rendu, donc l'INSERT n'avait rien à insérer. On distingue
       lequel des deux plafonds a mordu — le nombre d'abord, parce que
       c'est celui qui protège vraiment. */
    const tenu = await one<{ n: string; poids: string }>(
      db,
      `SELECT count(*)::text AS n, coalesce(sum(bytes), 0)::text AS poids
         FROM decor WHERE owner_id = $1 AND NOT deleted`,
      [d.ownerId]
    );
    throw new QuotaReached(Number(tenu?.n ?? 0) >= bornes.decors ? "decors" : "decors-octets");
  }
  return row;
}

/* ------------------------------------------------------------
   LE REGISTRE DES MÉDIAS
   ------------------------------------------------------------

   Le serveur ne voit jamais les octets : il signe un ticket, le
   navigateur dépose. Ce registre est donc la seule chose qui sache
   combien de place un compte occupe, et la seule qui puisse la borner.

   Voir `sql/001_baseline.sql` pour pourquoi la clé primaire fait le
   plus gros du travail. */

/**
 * Note un chemin autorisé, et dit si le plafond le permettait.
 *
 * REDEMANDER UN TICKET POUR LE MÊME CHEMIN EST SANS EFFET et toujours
 * accordé : le `ON CONFLICT` le dit, et c'est ce qui évite qu'une
 * synchronisation répétée épuise un plafond. Le compte est donc celui
 * des chemins distincts, pas celui des demandes.
 */
/**
 * UN PLAFOND INFINI NE SE MET PAS DANS UNE REQUÊTE.
 *
 * `ceilingsFor` rend `Infinity` pour l'admin — « rien ne refuse » —, et
 * c'est la bonne façon de l'écrire en TypeScript. Mais lié en paramètre,
 * `Infinity` part sur le fil sous la forme du texte « Infinity », que
 * Postgres refuse pour un entier : `22P02, invalid input syntax for type
 * bigint`. La requête entière tombe, en 500, et l'admin — le seul compte
 * qui ne devait JAMAIS être refusé — est le seul à ne plus pouvoir
 * écrire un média ni déposer un décor.
 *
 * Le défaut avait déjà été rencontré une fois, et contourné sur place
 * par un `if (bornes.imports === Infinity) return true` dans
 * `noteImport`. Un contournement à un endroit sur trois est ce qui a
 * laissé les deux autres. On convertit donc À LA SOURCE : `null`
 * traverse la frontière sans mentir, et le SQL le lit comme « pas de
 * plafond ».
 */
const borne = (n: number): number | null => (Number.isFinite(n) ? n : null);

export async function noteMedia(
  db: Db,
  personId: string,
  path: string,
  bytes = 0
): Promise<boolean> {
  const bornes = ceilingsFor((await findById(db, personId)) ?? {});
  const rows = await db.query<{ ok: number }>(
    `WITH deja AS (
       SELECT 1 FROM media WHERE person_id = $1 AND path = $2
     ),
     permis AS (
       SELECT 1 WHERE EXISTS (SELECT 1 FROM deja)
          OR $4::bigint IS NULL
          OR (SELECT count(*) FROM media WHERE person_id = $1) < $4::bigint
     ),
     mis AS (
       INSERT INTO media (person_id, path, bytes)
       SELECT $1, $2, $3 FROM permis
       ON CONFLICT (person_id, path) DO NOTHING
       RETURNING 1
     )
     SELECT 1::int AS ok FROM permis`,
    [personId, path, bytes, borne(bornes.media)]
  );
  return rows.length > 0;
}

/** Le média est parti du container : la ligne part avec. */
export async function forgetMedia(db: Db, personId: string, path: string): Promise<void> {
  await db.query("DELETE FROM media WHERE person_id = $1 AND path = $2", [personId, path]);
}

/** Ce qu'un compte occupe, et ce qu'il a le droit d'occuper. */
export async function usageOf(
  db: Db,
  personId: string
): Promise<{
  media: number;
  mediaCeiling: number;
  decors: number;
  decorCeiling: number;
  decorBytes: number;
  decorBytesCeiling: number;
  imports: number;
  importCeiling: number;
  plan: string;
}> {
  /* LES BORNES SORTENT AVEC LES CHIFFRES, sans quoi l'écran devrait
     connaître les paliers pour savoir quoi comparer — et il les
     connaîtrait mal le jour où ils changent. */
  const person = await findById(db, personId);
  const bornes = ceilingsFor(person ?? {});

  const m = await one<{ n: string }>(
    db,
    "SELECT count(*)::text AS n FROM media WHERE person_id = $1",
    [personId]
  );
  const d = await one<{ n: string; poids: string }>(
    db,
    `SELECT count(*)::text AS n, coalesce(sum(bytes), 0)::text AS poids
       FROM decor WHERE owner_id = $1 AND NOT deleted`,
    [personId]
  );
  return {
    media: Number(m?.n ?? 0),
    mediaCeiling: bornes.media,
    decors: Number(d?.n ?? 0),
    decorCeiling: bornes.decors,
    decorBytes: Number(d?.poids ?? 0),
    decorBytesCeiling: bornes.decorBytes,
    imports: await importsInWindow(db, personId),
    importCeiling: bornes.imports,
    plan: person?.plan === "plus" ? "plus" : "free",
  };
}

/** Only its author edits it — the `owner_id` in the clause says so. */
export async function editDecor(
  db: Db,
  personId: string,
  id: string,
  patch: { label?: string; wall?: string; is_public?: boolean }
): Promise<boolean> {
  const done = await db.query<{ id: string }>(
    `UPDATE decor SET label = coalesce($3, label),
                      wall = coalesce($4, wall),
                      is_public = coalesce($5, is_public),
                      updated_at = now()
      WHERE id = $2 AND owner_id = $1 AND NOT deleted
      RETURNING id`,
    [personId, id, patch.label ?? null, patch.wall ?? null, patch.is_public ?? null]
  );
  return done.length > 0;
}

/**
 * The author withdraws their piece.
 *
 * A TOMBSTONE AND NOT A DELETION: `DELETE` would cascade onto
 * `decor_copy` and take the object back from everybody who adopted it.
 * Taking a piece off one's own wall is not reaching onto other people's.
 */
export async function deleteDecor(db: Db, personId: string, id: string): Promise<boolean> {
  const done = await db.query<{ id: string }>(
    `UPDATE decor SET deleted = true, is_public = false, updated_at = now()
      WHERE id = $2 AND owner_id = $1 AND NOT deleted RETURNING id`,
    [personId, id]
  );
  return done.length > 0;
}

/** Taking a copy — which is what makes the right to read it last. */
export async function copyDecor(db: Db, personId: string, id: string): Promise<boolean> {
  if (!(await canReadDecor(db, personId, id))) return false;
  await db.query(
    `INSERT INTO decor_copy (person_id, decor_id) VALUES ($1, $2)
     ON CONFLICT (person_id, decor_id) DO NOTHING`,
    [personId, id]
  );
  return true;
}

/** Giving it back — one's own copy only; the original is not touched. */
export async function dropDecorCopy(db: Db, personId: string, id: string): Promise<void> {
  await db.query("DELETE FROM decor_copy WHERE person_id = $1 AND decor_id = $2", [personId, id]);
}

/**
 * MAY THIS PERSON FETCH THIS DECOR'S BLOB?
 *
 * Three ways to be allowed — being its author, it being on show, or
 * holding a copy of it — and ONE that overrules all three: a block
 * between the two, in either direction. That last clause is why the
 * whole thing is a single query: written as three checks and a fourth
 * laid on top, the fourth is the one somebody eventually forgets.
 */
export async function canReadDecor(db: Db, personId: string, id: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM decor d
      WHERE d.id = $2 AND NOT d.deleted
        AND (d.owner_id = $1
             OR d.is_public
             OR EXISTS (SELECT 1 FROM decor_copy c
                         WHERE c.decor_id = d.id AND c.person_id = $1))
        AND NOT EXISTS (SELECT 1 FROM block b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = d.owner_id)
                            OR (b.blocker_id = d.owner_id AND b.blocked_id = $1))`,
    [personId, id]
  );
  return r.length > 0;
}

/** May this person WRITE this decor's blob? Its author, and nobody else. */
export async function ownsDecor(db: Db, personId: string, id: string): Promise<boolean> {
  const r = await db.query("SELECT 1 FROM decor WHERE id = $2 AND owner_id = $1 AND NOT deleted", [
    personId,
    id,
  ]);
  return r.length > 0;
}

export async function countGesture(db: Db, gesture: string): Promise<void> {
  await db.query(
    `INSERT INTO metric (day, gesture, n) VALUES (current_date, $1, 1)
     ON CONFLICT (day, gesture) DO UPDATE SET n = metric.n + 1`,
    [gesture]
  );
}

export async function metrics(
  db: Db,
  jours = 30
): Promise<{ day: string; gesture: string; n: string }[]> {
  return db.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, gesture, n::text
       FROM metric WHERE day > current_date - $1::int
      ORDER BY day DESC, n DESC`,
    [jours]
  );
}

/* ------------------------------------------------------------
   THE PUSH NOTIFICATIONS
   ------------------------------------------------------------ */

export interface PushRow {
  endpoint: string;
  p256dh: string;
  secret: string;
  person_id: string;
}

export async function storePush(
  db: Db,
  personId: string,
  p: { endpoint: string; p256dh: string; secret: string }
): Promise<void> {
  /* The same device subscribing again replaces its row — and changes
     owner if somebody else has signed in on this browser. Without that,
     a shared computer would push one person's reminders to another. */
  await db.query(
    `INSERT INTO push_subscription (endpoint, person_id, p256dh, secret) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE
        SET person_id = EXCLUDED.person_id,
            p256dh = EXCLUDED.p256dh,
            secret = EXCLUDED.secret`,
    [p.endpoint, personId, p.p256dh, p.secret]
  );
}

export async function forgetPush(db: Db, endpoint: string): Promise<void> {
  await db.query("DELETE FROM push_subscription WHERE endpoint = $1", [endpoint]);
}

export async function pushesOf(db: Db, personId: string): Promise<PushRow[]> {
  return db.query<PushRow>(
    "SELECT endpoint, p256dh, secret, person_id FROM push_subscription WHERE person_id = $1",
    [personId]
  );
}

/**
 * Records that a reminder was given, and returns `false` if it already had been.
 *
 * THE INSERT IS THE LOCK. Checking and then writing would let two
 * simultaneous sweeps — a restart in the middle of a send — both through.
 * A duplicate notification is the quickest way to get notifications
 * switched off.
 */
export async function reminderIsNew(db: Db, personId: string, subject: string): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO reminder_sent (person_id, subject) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING subject`,
    [personId, subject]
  );
  return r.length > 0;
}

/**
 * The challenges starting or ending today, and who takes part in them.
 *
 * This is the ONLY pretext for a notification in this whole server.
 * There will be no other without a good reason: an application that
 * finds itself reasons to ring ends up uninstalled.
 */
export async function remindersDueToday(
  db: Db
): Promise<{ challenge_id: string; title: string; person_id: string; when: string }[]> {
  return db.query(
    `SELECT e.id AS challenge_id, e.title, ep.person_id,
            CASE WHEN e.starts_on = current_date THEN 'starts_on' ELSE 'ends_on' END AS when
       FROM challenge e JOIN challenge_participant ep ON ep.challenge_id = e.id
      WHERE e.starts_on = current_date OR e.ends_on = current_date`
  );
}

/* ============================================================
   THE MERIT, THE TOKENS, AND THE COUNTER
   ============================================================

   Everything below writes to a JOURNAL and lets the schema do the
   guarding. The three rules it leans on are worth naming once, because
   almost every query here is short only because of them:

   - `merit_event` is unique on (person, kind, ref). Paying twice for the
     same fact is impossible, so no caller has to check first.
   - `purse` refuses to go under zero. An overdraft therefore undoes the
     whole purchase, spending row included, and no route has to be
     careful.
   - `owned` and `power` have keys that say what they mean. Owning twice
     and playing what one has not are refused by the table.

   AND EVERY WRITE HERE IS ONE STATEMENT. There is no transaction helper
   in `Db` — deliberately, since there was nothing to wrap until now —
   so atomicity comes from putting the whole thing in a single command
   through data-modifying CTEs. Two statements in a row would have left a
   gap in which somebody is charged for nothing.
   ============================================================ */

export interface Purse {
  merit: number;
  tokens: number;
}

/** One line of the end-of-quiz reckoning: what paid, and how much. */
export interface Gain {
  kind: Kind;
  amount: number;
}

/**
 * Write down a gain, and credit both counters — once and once only.
 *
 * Returns what was actually credited, which is zero when the fact had
 * already paid, or when the day's declarative ceiling is reached. A
 * caller that wants to say "+3" on the screen must therefore use THIS
 * figure and not the rate it asked for.
 */
export async function award(
  db: Db,
  personId: string,
  kind: Kind,
  ref: string,
  amount: number
): Promise<number> {
  if (amount <= 0) return 0;
  const rows = await db.query<{ credited: number }>(
    `WITH allowed AS (
       SELECT $5::int AS amount
        WHERE NOT ($3 = ANY($6::text[]))
           OR (SELECT coalesce(sum(merit), 0) FROM merit_event
                WHERE person_id = $2
                  AND earned_on = current_date
                  AND kind = ANY($6::text[])) + $5 <= $7
     ),
     put AS (
       INSERT INTO merit_event (id, person_id, kind, ref, merit, tokens)
       SELECT $1, $2, $3, $4, amount, amount FROM allowed
       ON CONFLICT (person_id, kind, ref) DO NOTHING
       RETURNING merit
     ),
     bag AS (
       INSERT INTO purse (person_id, merit, tokens)
       SELECT $2, merit, merit FROM put
       ON CONFLICT (person_id) DO UPDATE
         SET merit = purse.merit + EXCLUDED.merit,
             tokens = purse.tokens + EXCLUDED.tokens,
             updated_at = now()
       RETURNING 1
     )
     SELECT coalesce((SELECT merit FROM put), 0)::int AS credited`,
    [randomUUID(), personId, kind, ref, amount, DECLARED as unknown as string[], DECLARED_CEILING]
  );
  return rows[0]?.credited ?? 0;
}

/**
 * Créditer des JETONS SEULS, sans toucher au mérite.
 *
 * C'est `award` avec une asymétrie de plus, et une seule chose la
 * justifie : le mérite est le classement. Tout ce qu'on peut obtenir en
 * DÉPENSANT des jetons doit donc s'arrêter à la bourse — sans quoi le
 * palmarès mesure la capacité à réinvestir plutôt que ce qu'on a fait, et
 * il cesse de mesurer quoi que ce soit.
 *
 * LE PLAFOND QUOTIDIEN NE S'APPLIQUE PAS ICI, et n'a pas à s'appliquer :
 * il garde ce qu'on DÉCLARE soi-même, et rien de ce qui passe par cette
 * fonction n'est déclaré — il faut avoir acheté un pouvoir avec des
 * jetons déjà gagnés. L'idempotence, elle, reste celle du journal : la
 * clé `(person, kind, ref)` est la même garantie qu'ailleurs, et c'est
 * ce qui fait qu'une requête rejouée ne double rien deux fois.
 */
export async function awardTokens(
  db: Db,
  personId: string,
  kind: Kind,
  ref: string,
  amount: number
): Promise<number> {
  if (amount <= 0) return 0;
  const rows = await db.query<{ credited: number }>(
    `WITH put AS (
       INSERT INTO merit_event (id, person_id, kind, ref, merit, tokens)
       VALUES ($1, $2, $3, $4, 0, $5)
       ON CONFLICT (person_id, kind, ref) DO NOTHING
       RETURNING tokens
     ),
     bag AS (
       INSERT INTO purse (person_id, merit, tokens)
       SELECT $2, 0, tokens FROM put
       ON CONFLICT (person_id) DO UPDATE
         SET tokens = purse.tokens + EXCLUDED.tokens, updated_at = now()
       RETURNING 1
     )
     SELECT coalesce((SELECT tokens FROM put), 0)::int AS credited`,
    [randomUUID(), personId, kind, ref, amount]
  );
  return rows[0]?.credited ?? 0;
}

export async function purseOf(db: Db, personId: string): Promise<Purse> {
  const row = await one<Purse>(db, "SELECT merit, tokens FROM purse WHERE person_id = $1", [
    personId,
  ]);
  /* No row is not an error: it is somebody who has not earned anything
     yet, and an empty purse reads better than a screen that fails. */
  return row ?? { merit: 0, tokens: 0 };
}

/* ------------------------------------------------------------
   WHAT PAYS, AND WHEN
   ------------------------------------------------------------ */

/**
 * The end of an attempt, priced.
 *
 * Called AFTER `finishAttempt`, and idempotent through the journal's
 * key: finishing twice — a double click, a retried request — credits
 * once. It returns the lines it actually wrote, which is what the end
 * screen prints.
 */
export async function awardQuiz(db: Db, quizId: string, personId: string): Promise<Gain[]> {
  const row = await one<{ score: number; weight: number; first: boolean; players: number }>(
    db,
    `SELECT coalesce(sum(quiz_points(q.difficulty)) FILTER (WHERE c.is_right), 0)::int AS score,
            (SELECT coalesce(sum(quiz_points(qq.difficulty)), 0)::int
               FROM quiz_draw d JOIN quiz_question qq ON qq.id = d.question_id
              WHERE d.quiz_id = $1) AS weight,
            NOT EXISTS (SELECT 1 FROM quiz_attempt o
                         WHERE o.quiz_id = $1 AND o.person_id <> $2
                           AND o.finished_at IS NOT NULL) AS first,
            (SELECT count(*)::int FROM quiz_attempt a WHERE a.quiz_id = $1) AS players
       FROM quiz_attempt t
       LEFT JOIN quiz_answer a ON a.quiz_id = t.quiz_id AND a.person_id = t.person_id
       LEFT JOIN quiz_choice c ON c.id = a.choice_id
       LEFT JOIN quiz_question q ON q.id = a.question_id
      WHERE t.quiz_id = $1 AND t.person_id = $2 AND t.finished_at IS NOT NULL
      GROUP BY t.quiz_id`,
    [quizId, personId]
  );
  if (!row) return [];

  const gains: Gain[] = [];
  const put = async (kind: Kind, amount: number) => {
    const got = await award(db, personId, kind, quizId, amount);
    if (got > 0) gains.push({ kind, amount: got });
  };

  await put("quiz", row.score);

  /* LA DOUBLE MISE SE DÉPENSE ICI, ET SEULEMENT SI LA LIGNE A ÉTÉ ÉCRITE.
     `gains` ne contient « quiz » que lorsque `award` a vraiment crédité —
     une partie terminée deux fois n'écrit qu'une fois, par la clé du
     journal. Regarder ce que `put` a poussé plutôt que le score évite de
     brûler un pouvoir sur un double clic.

     ELLE S'APPLIQUE À LA PROCHAINE PARTIE TERMINÉE, sans qu'on l'arme.
     Le choix se fait donc à l'achat et non pendant la partie, ce qui est
     la version la plus honnête de ce pouvoir : armer aurait voulu dire
     voir son score avant de décider, et doubler à coup sûr n'est plus un
     pari. */
  const scored = gains.find((g) => g.kind === "quiz")?.amount ?? 0;
  if (scored > 0 && (await spendPower(db, personId, "double"))) {
    const extra = await awardTokens(db, personId, "quiz_doubled", quizId, scored);
    /* Rendu si rien n'a été crédité — la même précaution que la
       prolongation d'un défi : essayer ne doit pas coûter le pouvoir. */
    if (extra > 0) gains.push({ kind: "quiz_doubled", amount: extra });
    else await givePower(db, personId, "double");
  }

  /* A flawless run on a quiz worth nothing is not flawless, it is empty. */
  if (row.weight > 0 && row.score === row.weight) await put("quiz_flawless", RATE.quiz_flawless);
  /* Being first only means something when somebody else was playing. */
  if (row.first && row.players >= 2) await put("quiz_first", RATE.quiz_first);
  return gains;
}

/**
 * Close the accounts of a challenge whose period is over.
 *
 * NO SCHEDULED TASK: this server has none, and inventing one to pay out
 * a challenge would be a daemon to keep alive for a handful of rows. The
 * FIRST person to open a finished challenge settles it for everybody,
 * and the journal's key means the second, the third and the tenth to
 * look pay nobody twice.
 *
 * Returns how many people were paid, which is zero on the second call.
 */
export async function settleChallenge(db: Db, challengeId: string): Promise<number> {
  const done = await db.query<{ person_id: string; done: number; works: number }>(
    `SELECT ep.person_id,
            (SELECT count(*) FROM list_item li
              WHERE li.list_id = e.list_id AND ${SEEN_DURING})::int AS done,
            (SELECT count(*) FROM list_item li WHERE li.list_id = e.list_id)::int AS works
       FROM challenge_participant ep
       JOIN challenge e ON e.id = ep.challenge_id
      WHERE ep.challenge_id = $1
        AND e.ends_on < current_date`,
    [challengeId]
  );

  let paid = 0;
  for (const p of done) {
    /* An empty challenge pays nothing: everybody has "finished" a list
       of no films, and that would have been the cheapest merit going. */
    if (p.works === 0) continue;
    const share = p.done / p.works;
    const kind: Kind | null =
      share >= 1 ? "challenge" : share >= CHALLENGE_HALF ? "challenge_half" : null;
    if (!kind) continue;
    if ((await award(db, p.person_id, kind, challengeId, RATE[kind])) > 0) paid++;
  }
  return paid;
}

/**
 * What a card says one did, priced — and nothing else in the server
 * takes a client's word for anything.
 *
 * It is called after the card is written and its failure is swallowed by
 * the caller: filing a film must never wait on, nor fail because of, a
 * counter. `ref` carries the day for a screening and the work alone for
 * a rating or a review, which is what makes a library worth what it is
 * worth ONCE instead of at every synchronisation.
 */
export async function awardFromCard(
  db: Db,
  personId: string,
  card: { tmdb_id?: string | null; data?: Record<string, unknown> | null }
): Promise<number> {
  const tmdb = card.tmdb_id;
  const data = card.data;
  if (!tmdb || !data) return 0;
  let total = 0;

  const watches = Array.isArray(data.watches) ? (data.watches as { date?: string }[]) : [];
  const days = new Set<string>();
  for (const w of watches) if (typeof w?.date === "string") days.add(w.date.slice(0, 10));
  const fallback = typeof data.watchedAt === "string" ? data.watchedAt.slice(0, 10) : null;
  if (fallback) days.add(fallback);
  for (const day of days) total += await award(db, personId, "watch", `${tmdb}:${day}`, RATE.watch);

  const review = typeof data.review === "string" ? data.review.trim() : "";
  if (review.length >= REVIEW_LENGTH)
    total += await award(db, personId, "review", tmdb, RATE.review);

  if (typeof data.rating === "number" && data.rating > 0)
    total += await award(db, personId, "rating", tmdb, RATE.rating);

  return total;
}

/* ------------------------------------------------------------
   THE RANKINGS
   ------------------------------------------------------------

   TWO OF THEM, AND THE SAME TWO GUARDS IN BOTH.

   `rank()` is computed inside the window, BEFORE the `LIMIT`: the number
   shown is the real place, not the row's index in a page of fifty.

   `p.id = $1` is in both `WHERE`s, unconditionally. One always sees
   oneself — even having asked to appear nowhere, even far below the
   fiftieth. A ranking one cannot find oneself in is not a ranking.

   And `NOT_BLOCKED`, which looks both ways like everywhere else: a block
   declared on one side removes the two people from each other's boards.
*/

export interface Rank {
  pseudo: string;
  merit: number;
  rank: number;
  me: boolean;
  stamp: string | null;
}

/** The world's board — only those who asked to be on it. */
export async function globalLadder(db: Db, personId: string, cap = 50): Promise<Rank[]> {
  return db.query<Rank>(
    `SELECT pseudo, merit, rank, me, stamp FROM (
       SELECT p.pseudo, w.merit, p.stamp,
              rank() OVER (ORDER BY w.merit DESC)::int AS rank,
              (p.id = $1) AS me
         FROM purse w JOIN person p ON p.id = w.person_id
        WHERE w.merit > 0
          AND (p.id = $1 OR p.ladder = 'tous')
          AND ${NOT_BLOCKED("$1", "p.id")}
     ) board
     ORDER BY merit DESC, pseudo
     LIMIT $2`,
    [personId, cap]
  );
}

/**
 * The friends' board — the people I follow, and me.
 *
 * "Friend" is `follow` and nothing else: no request, no acceptance, no
 * second table. The tie is one-way, which is honest — I may watch
 * somebody who does not watch me — and it is already the tie the feed is
 * built on, so there is only one thing to understand.
 */
export async function friendsLadder(db: Db, personId: string): Promise<Rank[]> {
  return db.query<Rank>(
    `SELECT p.pseudo, w.merit, p.stamp,
            rank() OVER (ORDER BY w.merit DESC)::int AS rank,
            (p.id = $1) AS me
       FROM purse w JOIN person p ON p.id = w.person_id
      WHERE (p.id = $1
             OR (EXISTS (SELECT 1 FROM follow f
                          WHERE f.follower_id = $1 AND f.followed_id = p.id)
                 AND p.ladder IN ('suivis', 'tous')))
        AND ${NOT_BLOCKED("$1", "p.id")}
      ORDER BY w.merit DESC, p.pseudo`,
    [personId]
  );
}

/** My real place in the world's board, even when I am far off the page. */
export async function myStanding(db: Db, personId: string): Promise<number | null> {
  const row = await one<{ place: number }>(
    db,
    `SELECT (1 + count(*))::int AS place
       FROM purse w JOIN person p ON p.id = w.person_id
      WHERE p.ladder = 'tous'
        AND w.merit > coalesce((SELECT merit FROM purse WHERE person_id = $1), 0)`,
    [personId]
  );
  return row?.place ?? null;
}

export async function setLadder(db: Db, personId: string, ladder: string): Promise<void> {
  /* The CHECK on the column is what refuses a value that is not one of
     the three; this passes it through rather than repeating the list. */
  await db.query("UPDATE person SET ladder = $2 WHERE id = $1", [personId, ladder]);
}

export async function ladderOf(db: Db, personId: string): Promise<string> {
  const row = await one<{ ladder: string }>(db, "SELECT ladder FROM person WHERE id = $1", [
    personId,
  ]);
  return row?.ladder ?? "suivis";
}

/* ------------------------------------------------------------
   THE SHOP
   ------------------------------------------------------------ */

/* ------------------------------------------------------------
   LES POCHETTES, ET LEURS VIGNETTES
   ------------------------------------------------------------
   La seule partie du catalogue qui vive en base. Le pourquoi est dans
   `sql/002_collection.sql` ; ce qui suit n'est que la lecture et
   l'écriture, et toute l'écriture est derrière `requireAdmin`.

   ON RETIRE, ON NE SUPPRIME PAS, et c'est la seule chose à retenir
   d'ici. Un identifiant de vignette est écrit dans l'album de tout le
   monde et un identifiant de pochette dans `token_spend` : effacer une
   définition ferait un trou dans une collection déjà remplie et une
   ligne de dépense qui n'explique plus rien. `retired_at` sort du
   tirage et de l'étal, et laisse le reste debout. */

const packRow = (r: {
  id: string;
  price: number;
  label_fr: string;
  label_en: string;
  cover_key: string | null;
  retired_at: Date | null;
}): PackDef => ({
  id: r.id,
  price: r.price,
  label: { fr: r.label_fr, en: r.label_en },
  cover: r.cover_key,
  retired: r.retired_at !== null,
});

const decorRow = (r: {
  id: string;
  pack_id: string;
  rarity: string;
  media_key: string;
  label_fr: string;
  label_en: string;
  wall: boolean;
  tintable: boolean;
  retired_at: Date | null;
}): DecorDef => ({
  id: r.id,
  packId: r.pack_id,
  rarity: r.rarity as DecorDef["rarity"],
  media: r.media_key,
  label: { fr: r.label_fr, en: r.label_en },
  wall: r.wall,
  tintable: r.tintable,
  retired: r.retired_at !== null,
});

/** Les pochettes. `all` inclut les retirées — c'est la vue de l'admin. */
export async function listPacks(db: Db, all = false): Promise<PackDef[]> {
  const rows = await db.query<Parameters<typeof packRow>[0]>(
    `SELECT id, price, label_fr, label_en, cover_key, retired_at
       FROM pack_def ${all ? "" : "WHERE retired_at IS NULL"}
      ORDER BY price, id`
  );
  return rows.map(packRow);
}

/** Les objets, tous ou ceux d'une pochette. */
export async function listDecors(db: Db, packId?: string): Promise<DecorDef[]> {
  const rows = await db.query<Parameters<typeof decorRow>[0]>(
    `SELECT id, pack_id, rarity, media_key, label_fr, label_en, wall, tintable, retired_at
       FROM decor_def ${packId ? "WHERE pack_id = $1" : ""}
      ORDER BY pack_id, rarity, id`,
    packId ? [packId] : []
  );
  return rows.map(decorRow);
}

export class CatalogueRefusal extends Error {}

/* L'IDENTIFIANT EST SAISI PAR QUELQU'UN, DONC IL EST TAILLÉ ICI. Il
   finit dans une clé de blob (`bank/decor/<clé>`) dont la forme est
   vérifiée par `media.ts`, et dans une URL. Un identifiant refusé au
   dépôt aurait donné une pochette qu'on ne peut pas illustrer, une
   heure après l'avoir créée. */
const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;

const slugOr = (id: string, quoi: string): string => {
  if (!SLUG.test(id)) {
    throw new CatalogueRefusal(`${quoi} : lettres minuscules, chiffres et tirets seulement.`);
  }
  return id;
};

export async function upsertPack(
  db: Db,
  p: {
    id: string;
    price: number;
    labelFr: string;
    labelEn: string;
    cover?: string | null;
  }
): Promise<PackDef> {
  slugOr(p.id, "l'identifiant de la pochette");
  const row = await one<Parameters<typeof packRow>[0]>(
    db,
    `INSERT INTO pack_def (id, price, label_fr, label_en, cover_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET price = EXCLUDED.price,
           label_fr = EXCLUDED.label_fr, label_en = EXCLUDED.label_en,
           cover_key = EXCLUDED.cover_key
     RETURNING id, price, label_fr, label_en, cover_key, retired_at`,
    [p.id, p.price, p.labelFr, p.labelEn, p.cover ?? null]
  );
  /* Aucune ligne veut dire que le CHECK a parlé — un prix nul. On le
     redit en français plutôt qu'en violation de contrainte. */
  if (!row) throw new CatalogueRefusal("Prix hors bornes.");
  return packRow(row);
}

export async function upsertDecor(
  db: Db,
  s: {
    id: string;
    packId: string;
    rarity: string;
    media: string;
    labelFr: string;
    labelEn: string;
    wall?: boolean;
    tintable?: boolean;
  }
): Promise<DecorDef> {
  slugOr(s.id, "l'identifiant de l'objet");
  if (!["common", "rare", "gold"].includes(s.rarity)) {
    throw new CatalogueRefusal("La rareté est « common », « rare » ou « gold ».");
  }
  /* La clé étrangère refuserait aussi, mais avec un message que
     personne ne lit. */
  const pack = await one(db, "SELECT 1 FROM pack_def WHERE id = $1", [s.packId]);
  if (!pack) throw new CatalogueRefusal("Cette pochette n'existe pas.");

  const row = await one<Parameters<typeof decorRow>[0]>(
    db,
    `INSERT INTO decor_def
       (id, pack_id, rarity, media_key, label_fr, label_en, wall, tintable)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE
       SET pack_id = EXCLUDED.pack_id, rarity = EXCLUDED.rarity,
           media_key = EXCLUDED.media_key,
           label_fr = EXCLUDED.label_fr, label_en = EXCLUDED.label_en,
           wall = EXCLUDED.wall, tintable = EXCLUDED.tintable
     RETURNING id, pack_id, rarity, media_key, label_fr, label_en, wall, tintable, retired_at`,
    [s.id, s.packId, s.rarity, s.media, s.labelFr, s.labelEn, s.wall ?? false, s.tintable ?? true]
  );
  if (!row) throw new CatalogueRefusal("Objet refusé.");
  return decorRow(row);
}

/** Retirer, ou remettre. Jamais effacer : voir le commentaire du bloc. */
export async function retirePack(db: Db, id: string, retired: boolean): Promise<boolean> {
  const rows = await db.query("UPDATE pack_def SET retired_at = $2 WHERE id = $1 RETURNING id", [
    id,
    retired ? new Date() : null,
  ]);
  return rows.length > 0;
}

export async function retireDecor(db: Db, id: string, retired: boolean): Promise<boolean> {
  const rows = await db.query("UPDATE decor_def SET retired_at = $2 WHERE id = $1 RETURNING id", [
    id,
    retired ? new Date() : null,
  ]);
  return rows.length > 0;
}

/**
 * L'article nommé, d'où qu'il vienne.
 *
 * LE CODE D'ABORD, LA BASE ENSUITE. `SHOP` est une constante lue sans
 * aller-retour ; la base n'est interrogée que pour ce qui n'y est pas,
 * c'est-à-dire les pochettes. L'ordre n'est pas qu'une optimisation : il
 * garantit qu'une ligne de `pack_def` ne peut pas usurper l'identifiant
 * d'une peau et en changer le prix.
 */
export async function resolveItem(db: Db, id: string): Promise<ShopItem | undefined> {
  const fixed = itemById(id);
  if (fixed) return fixed;
  const row = await one<Parameters<typeof packRow>[0]>(
    db,
    `SELECT id, price, label_fr, label_en, cover_key, retired_at
       FROM pack_def WHERE id = $1 AND retired_at IS NULL`,
    [id]
  );
  return row ? packItem(packRow(row)) : undefined;
}

export interface Holdings {
  items: string[];
  /** Les objets tirés, et en combien d'exemplaires. */
  decors: { decor_id: string; copies: number }[];
  powers: Record<string, number>;
  worn: Record<Wearable, string | null>;
}

export async function holdingsOf(db: Db, personId: string): Promise<Holdings> {
  const [items, decors, powers, worn] = await Promise.all([
    db.query<{ item_id: string }>("SELECT item_id FROM owned WHERE person_id = $1", [personId]),
    db.query<{ decor_id: string; copies: number }>(
      "SELECT decor_id, copies FROM decor_won WHERE person_id = $1 ORDER BY first_at",
      [personId]
    ),
    db.query<{ kind: string; left_over: number }>(
      "SELECT kind, left_over FROM power WHERE person_id = $1 AND left_over > 0",
      [personId]
    ),
    one<Record<Wearable, string | null>>(
      db,
      "SELECT stamp, skin, paper, title FROM person WHERE id = $1",
      [personId]
    ),
  ]);
  return {
    items: items.map((i) => i.item_id),
    decors,
    powers: Object.fromEntries(powers.map((p) => [p.kind, p.left_over])),
    worn: worn ?? { stamp: null, skin: null, paper: null, title: null },
  };
}

export class ShopRefusal extends Error {}

/**
 * Buy one thing.
 *
 * THE PAYMENT IS ONE STATEMENT, and the `CHECK (tokens >= 0)` on the
 * purse is what refuses an overdraft: if the balance would go under, the
 * constraint fails and the spending row is undone with it. There is no
 * moment in which somebody has paid and received nothing.
 *
 * The chance of a packet is drawn HERE, inside that same statement's
 * transaction, and written down before the answer leaves — so reloading
 * the page cannot reroll a disappointing packet.
 */
/**
 * Tout effacer, et garder le compte.
 *
 * ENTRE « J'EFFACE MON COMPTOIR » ET « JE M'EN VAIS », il manquait le
 * geste du milieu : repartir de zéro en gardant son pseudonyme et ses
 * clés d'accès. Sans lui, essayer le classeur pour de bon obligeait à
 * supprimer le compte et à refaire une cérémonie WebAuthn — ce qui, sur
 * `localhost`, ne se refait pas toujours du premier coup.
 *
 * CE QUI PART : les fiches, les documents, les listes et ce qu'elles
 * contiennent, les défis, les quiz tirés, les tentatives, les décors,
 * les abonnements, et tout le comptoir.
 *
 * CE QUI RESTE, ET CHAQUE FOIS POUR UNE RAISON :
 *
 *   - `person`, `access_key`, `session` — c'est la définition du geste :
 *     on reste soi, on ne se reconnecte pas.
 *   - `block` — un blocage PROTÈGE. L'effacer rendrait à quelqu'un qu'on
 *     a écarté l'accès qu'on lui avait retiré, et ce n'est pas ce qu'on
 *     demande en voulant faire le ménage. Une remise à zéro qui
 *     réexpose est une remise à zéro qu'on regrette.
 *   - `report` — ce qu'on a signalé regarde la modération, pas la
 *     personne signalée : le retirer effacerait le travail d'autrui.
 *
 * ET LES MÉDIAS DÉPOSÉS RESTENT DANS LE CONTAINER. Ils vivent sous
 * `p/<id>/…`, hors base ; les effacer demande de parler à Azure, ce que
 * `DELETE /media` sait faire fiche par fiche. Le dire est plus honnête
 * que de laisser croire que tout est parti.
 */
export async function wipeEverything(db: Db, personId: string): Promise<void> {
  /* Les listes et les quiz dont on est PROPRIÉTAIRE emportent leurs
     contenus par cascade : membres, œuvres, défis, participations,
     tirages, réponses. Le reste est ce qu'on a laissé chez les autres. */
  await db.query("DELETE FROM list WHERE owner_id = $1", [personId]);
  await db.query("DELETE FROM quiz WHERE owner_id = $1", [personId]);
  await db.query("DELETE FROM decor WHERE owner_id = $1", [personId]);

  for (const table of [
    "card",
    "doc",
    "list_member",
    "challenge_participant",
    "quiz_player",
    "quiz_attempt",
    "decor_copy",
    "merit_event",
    "token_spend",
    "owned",
    "sticker",
    "decor_won",
    "power",
    "purse",
    "reminder_sent",
  ]) {
    await db.query(`DELETE FROM ${table} WHERE person_id = $1`, [personId]);
  }

  /* Les abonnements partent dans les deux sens : ceux qu'on suivait, et
     ceux qui nous suivaient. Garder les seconds laisserait des gens
     abonnés au vide. */
  await db.query("DELETE FROM follow WHERE follower_id = $1 OR followed_id = $1", [personId]);

  await db.query(
    "UPDATE person SET sharing = 'privee', token = NULL, stamp = NULL, skin = NULL WHERE id = $1",
    [personId]
  );
}

/**
 * Rendre un article, et récupérer ce qu'il a coûté.
 *
 * LA LIGNE DE DÉPENSE EST EFFACÉE, ET PAS SEULEMENT COMPENSÉE. La bourse
 * est un cache : elle doit rester égale à la somme des gains moins la
 * somme des dépenses, et un test le vérifie. Recréditer sans retirer la
 * dépense ferait diverger les deux, et la divergence ne casserait rien —
 * elle mentirait, jusqu'au jour où quelqu'un compterait à la main.
 *
 * Le remboursement suit donc le PRIX PAYÉ, lu dans le journal, et non
 * le prix affiché aujourd'hui : rendre un article dont le tarif a monté
 * entre-temps ne doit pas être une façon de gagner des jetons.
 *
 * Tout tient dans une instruction. Deux se seraient laissé interrompre
 * entre le remboursement et la reprise de l'objet.
 */
export async function sell(db: Db, personId: string, itemId: string): Promise<Purse | "not-owned"> {
  const item = await resolveItem(db, itemId);
  if (!item) return "not-owned";

  const back = await one<Purse>(
    db,
    `WITH gone AS (
       DELETE FROM token_spend
        WHERE id = (SELECT id FROM token_spend
                     WHERE person_id = $1 AND item_id = $2
                     ORDER BY created_at DESC LIMIT 1)
       RETURNING tokens
     ),
     dropped AS (
       DELETE FROM owned
        WHERE person_id = $1 AND item_id = $2 AND EXISTS (SELECT 1 FROM gone)
       RETURNING 1
     ),
     spent AS (
       UPDATE power SET left_over = left_over - 1
        WHERE person_id = $1 AND kind = $3 AND left_over > 0
          AND EXISTS (SELECT 1 FROM gone)
       RETURNING 1
     ),
     /* Ce qu'on ne possède plus, on ne le porte plus : un tampon resté
        au revers d'un article rendu s'afficherait à côté de votre nom
        sans que rien ne l'explique.

        Les quatre colonnes portables, et deux façons de comparer : une
        peau range sa CLÉ (son "grants"), les trois autres rangent
        l'identifiant de l'article. C'est la même asymétrie que dans
        "wear", et elle vient de SkinPicker, qui compare des clés. */
     bared AS (
       UPDATE person
          SET stamp = CASE WHEN stamp = $2 THEN NULL ELSE stamp END,
              skin = CASE WHEN skin = $4 THEN NULL ELSE skin END,
              paper = CASE WHEN paper = $2 THEN NULL ELSE paper END,
              title = CASE WHEN title = $2 THEN NULL ELSE title END
        WHERE id = $1 AND EXISTS (SELECT 1 FROM gone)
       RETURNING 1
     )
     UPDATE purse
        SET tokens = tokens + (SELECT tokens FROM gone), updated_at = now()
      WHERE person_id = $1 AND EXISTS (SELECT 1 FROM gone)
     RETURNING merit, tokens`,
    [personId, itemId, item.power ?? null, item.grants ?? null]
  );

  /* Aucune ligne : rien n'avait été payé pour cet article. */
  return back ?? "not-owned";
}

export async function buy(
  db: Db,
  personId: string,
  itemId: string,
  rng: Rng
): Promise<{ purse: Purse; drawn: string[] }> {
  const item = await resolveItem(db, itemId);
  if (!item) throw new ShopRefusal("cet article n'existe pas");

  /* Owning a unique thing twice is refused BEFORE paying, and by a
     read rather than by the key: `owned`'s primary key would have made
     the insert do nothing while the tokens had already gone.

     LA LISTE DES FAMILLES CONCERNÉES A QUITTÉ CETTE LIGNE. Elle disait
     « tampon ou peau », et deux familles portables plus tard elle aurait
     débité deux fois pour un papier. `isUnique` la tient dans le
     catalogue, là où la famille est déclarée. */
  if (isUnique(item)) {
    const had = await one(db, "SELECT 1 FROM owned WHERE person_id = $1 AND item_id = $2", [
      personId,
      itemId,
    ]);
    if (had) throw new ShopRefusal("vous l'avez déjà");
  }

  let paid: { merit: number; tokens: number } | null = null;
  try {
    paid = await one<Purse>(
      db,
      `WITH spend AS (
         INSERT INTO token_spend (id, person_id, item_id, tokens)
         VALUES ($1, $2, $3, $4) RETURNING tokens
       )
       UPDATE purse SET tokens = tokens - (SELECT tokens FROM spend), updated_at = now()
        WHERE person_id = $2
       RETURNING merit, tokens`,
      [randomUUID(), personId, itemId, item.price]
    );
  } catch {
    /* The CHECK fired: the purse would have gone under. */
    throw new ShopRefusal("pas assez de jetons");
  }
  /* No purse at all means nothing has ever been earned — the update
     touched no row, and the spending row went with it. */
  if (!paid) throw new ShopRefusal("pas assez de jetons");

  const drawn: string[] = [];
  if (item.kind === "pack") {
    /* LE BASSIN EST LU APRÈS LE DÉBIT, dans la même transaction. Le lire
       avant aurait voulu dire tirer dans un stock d'il y a un instant —
       et surtout, une pochette vidée entre-temps aurait rendu des
       objets qui n'existent plus. */
    const stock = await listDecors(db, item.id);
    for (const s of draw(rng, DRAWS, stock)) {
      await db.query(
        `INSERT INTO decor_won (person_id, decor_id) VALUES ($1, $2)
         ON CONFLICT (person_id, decor_id) DO UPDATE SET copies = decor_won.copies + 1`,
        [personId, s]
      );
      drawn.push(s);
    }
  } else if (item.kind === "power") {
    await db.query(
      `INSERT INTO power (person_id, kind, left_over) VALUES ($1, $2, 1)
       ON CONFLICT (person_id, kind) DO UPDATE SET left_over = power.left_over + 1`,
      [personId, item.power]
    );
  } else {
    await db.query(
      "INSERT INTO owned (person_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [personId, itemId]
    );
  }

  return { purse: paid, drawn };
}

/**
 * Wear a stamp, or a skin — or take one off with `null`.
 *
 * THE CHECK IS IN THE STATEMENT. Reading "do they own it" and then
 * writing would have been two commands with a gap between them; here
 * a row that comes back is the permission, and no row is the refusal.
 */
export async function wear(
  db: Db,
  personId: string,
  what: Wearable,
  itemId: string | null
): Promise<boolean> {
  /* LE NOM DE COLONNE EST INTERPOLÉ, donc il ne vient pas du dehors.
     `Wearable` le dit au compilateur ; cette ligne le dit à
     l'exécution, parce qu'un `as` quelque part dans une route suffirait
     à faire mentir le type. C'est la seule interpolation de tout ce
     fichier, et c'est pour cela qu'elle est gardée deux fois. */
  if (!(WEARABLE as readonly string[]).includes(what)) return false;

  /* ON REÇOIT L'IDENTIFIANT DE L'ARTICLE, ON RANGE PARFOIS AUTRE CHOSE.
     Une peau range sa CLÉ et non son article — `SkinPicker` compare des
     clés, et c'est lui qui a raison, puisqu'il s'ouvre sans réseau.

     C'EST AUSSI LA CORRECTION D'UN VRAI DÉFAUT. Le présentoir envoyait
     déjà la clé (`item.grants ?? item.id`), et cette requête cherchait
     cette clé dans `owned`, qui ne contient que des identifiants
     d'articles : porter une peau achetée était refusé en 403, toujours.
     Aucun test ne couvrait le cas — ils n'essayaient que des tampons,
     pour qui les deux se confondent. La possession se vérifie donc
     maintenant sur l'ARTICLE, et le rangement se fait sur ce que la
     famille range. */
  const item = itemId ? itemById(itemId) : null;
  if (itemId && !item) return false;
  const stored = item?.grants ?? itemId;

  const rows = await db.query(
    `UPDATE person SET ${what} = $3
      WHERE id = $1
        AND ($2::text IS NULL
             OR EXISTS (SELECT 1 FROM owned WHERE person_id = $1 AND item_id = $2))
     RETURNING id`,
    [personId, itemId, stored]
  );
  return rows.length > 0;
}

/* ------------------------------------------------------------
   THE POWERS, AND WHAT THEY MAY NOT DO
   ------------------------------------------------------------ */

/** Take one power off the shelf. False when there was none to take. */
export async function spendPower(db: Db, personId: string, kind: PowerKind): Promise<boolean> {
  const rows = await db.query(
    `UPDATE power SET left_over = left_over - 1
      WHERE person_id = $1 AND kind = $2 AND left_over > 0
     RETURNING left_over`,
    [personId, kind]
  );
  return rows.length > 0;
}

/**
 * Put one back.
 *
 * `extendChallenge` carries all five of its limits inside a single
 * statement, which is what makes them impossible to get round — and also
 * means the only way to know whether a push is allowed is to try it. So
 * the power is taken first and given back when the statement refuses:
 * finding out must not cost thirty tokens.
 */
export async function givePower(db: Db, personId: string, kind: PowerKind): Promise<void> {
  await db.query(
    `INSERT INTO power (person_id, kind, left_over) VALUES ($1, $2, 1)
     ON CONFLICT (person_id, kind) DO UPDATE SET left_over = power.left_over + 1`,
    [personId, kind]
  );
}

/**
 * Take two wrong answers away from a question.
 *
 * THE RESULT IS REMEMBERED, and that is the whole design. Without
 * `quiz_help`'s primary key, asking again would return two OTHER wrong
 * answers each time: one pays once and strips the question bare. Here
 * the second call returns the same pair and charges nothing.
 *
 * The right answer is never among what is returned, and this is also the
 * only place in the server that touches `is_right` before an attempt is
 * closed — which is why it returns identifiers to hide and not the
 * question.
 */
export async function halveFor(
  db: Db,
  quizId: string,
  personId: string,
  questionId: string
): Promise<{ removed: string[] } | "no-power" | "closed"> {
  const already = await one<{ removed: string[] }>(
    db,
    `SELECT removed FROM quiz_help
      WHERE quiz_id = $1 AND person_id = $2 AND question_id = $3 AND kind = 'halve'`,
    [quizId, personId, questionId]
  );
  if (already) return { removed: already.removed };

  const open = await one(
    db,
    `SELECT 1 FROM quiz_attempt
      WHERE quiz_id = $1 AND person_id = $2 AND finished_at IS NULL`,
    [quizId, personId]
  );
  if (!open) return "closed";
  if (!(await spendPower(db, personId, "halve"))) return "no-power";

  const rows = await db.query<{ id: string }>(
    `SELECT c.id FROM quiz_choice c
       JOIN quiz_draw d ON d.question_id = c.question_id AND d.quiz_id = $1
      WHERE c.question_id = $2 AND NOT c.is_right
      ORDER BY c.rank
      LIMIT 2`,
    [quizId, questionId]
  );
  const removed = rows.map((r) => r.id);
  await db.query(
    `INSERT INTO quiz_help (quiz_id, person_id, question_id, kind, removed)
     VALUES ($1, $2, $3, 'halve', $4::uuid[])`,
    [quizId, personId, questionId, removed]
  );
  return { removed };
}

/**
 * Take an answer back, once per question.
 *
 * The mark stays in `quiz_help` after the answer is gone: a question one
 * has had a second go at must not look, to the other players, like a
 * question one got right first time.
 */
export async function redoAnswer(
  db: Db,
  quizId: string,
  personId: string,
  questionId: string
): Promise<"done" | "no-power" | "closed" | "already"> {
  const already = await one(
    db,
    `SELECT 1 FROM quiz_help
      WHERE quiz_id = $1 AND person_id = $2 AND question_id = $3 AND kind = 'redo'`,
    [quizId, personId, questionId]
  );
  if (already) return "already";

  const open = await one(
    db,
    "SELECT 1 FROM quiz_attempt WHERE quiz_id = $1 AND person_id = $2 AND finished_at IS NULL",
    [quizId, personId]
  );
  if (!open) return "closed";
  if (!(await spendPower(db, personId, "redo"))) return "no-power";

  await db.query(
    `INSERT INTO quiz_help (quiz_id, person_id, question_id, kind) VALUES ($1, $2, $3, 'redo')`,
    [quizId, personId, questionId]
  );
  await db.query(
    "DELETE FROM quiz_answer WHERE quiz_id = $1 AND person_id = $2 AND question_id = $3",
    [quizId, personId, questionId]
  );
  return "done";
}

/** Which questions of mine carry a mark, and what it hides. */
export async function helpOf(
  db: Db,
  quizId: string,
  personId: string
): Promise<{ question_id: string; kind: string; removed: string[] }[]> {
  return db.query(
    "SELECT question_id, kind, removed FROM quiz_help WHERE quiz_id = $1 AND person_id = $2",
    [quizId, personId]
  );
}

/**
 * Push a challenge's end back by a week.
 *
 * ALL FIVE LIMITS ARE IN THE ONE STATEMENT, and the fifth is the one
 * that would have been forgotten in a route: a challenge already SETTLED
 * may not be extended. The journal's key would refuse to pay a second
 * time anyway, but the board would still have been left describing a
 * period that no longer matches what was paid for.
 */
export async function extendChallenge(
  db: Db,
  challengeId: string,
  personId: string
): Promise<{ ends_on: string; extensions: number } | null> {
  return one<{ ends_on: string; extensions: number }>(
    db,
    `UPDATE challenge
        SET ends_on = ends_on + 7, extensions = extensions + 1
      WHERE id = $1
        AND created_by = $2
        AND extensions < 2
        AND ends_on >= current_date - 7
        AND NOT EXISTS (SELECT 1 FROM merit_event
                         WHERE kind IN ('challenge', 'challenge_half') AND ref = $1::text)
     RETURNING to_char(ends_on, 'YYYY-MM-DD') AS ends_on, extensions`,
    [challengeId, personId]
  );
}

/**
 * Le second souffle : rouvrir un défi qu'on a laissé filer.
 *
 * TROIS DIFFÉRENCES AVEC LA PROLONGATION, et chacune est ce qu'on achète
 * pour quarante-cinq jetons plutôt que trente :
 *
 * Elle est ouverte à QUI PARTICIPE et pas seulement à qui a créé — un
 * défi raté l'est par le participant, et c'était à l'auteur seul de le
 * rattraper.
 *
 * Elle marche APRÈS la date de fin, dans un mois de battement, là où la
 * prolongation s'arrête à une semaine. C'est tout l'objet : on s'aperçoit
 * qu'on a échoué APRÈS.
 *
 * Elle ne consomme PAS l'un des deux reports de l'auteur. Le pouvoir est
 * son propre plafond, et il se paie.
 *
 * CE QUI NE CHANGE PAS EST LA SEULE GARANTIE QUI COMPTE : un défi déjà
 * soldé ne se rouvre pas. La clé du journal empêcherait de payer deux
 * fois, mais elle empêcherait AUSSI de payer le rattrapage — et
 * quelqu'un aurait dépensé son pouvoir pour rien.
 */
export async function secondWind(
  db: Db,
  challengeId: string,
  personId: string
): Promise<{ ends_on: string } | null> {
  return one<{ ends_on: string }>(
    db,
    `UPDATE challenge
        SET ends_on = greatest(ends_on, current_date) + 7
      WHERE id = $1
        AND EXISTS (SELECT 1 FROM challenge_participant
                     WHERE challenge_id = $1 AND person_id = $2)
        AND ends_on >= current_date - 30
        AND NOT EXISTS (SELECT 1 FROM merit_event
                         WHERE kind IN ('challenge', 'challenge_half') AND ref = $1::text)
     RETURNING to_char(ends_on, 'YYYY-MM-DD') AS ends_on`,
    [challengeId, personId]
  );
}
