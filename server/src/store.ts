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

export interface Person {
  id: string;
  pseudo: string;
  email: string | null;
  sharing?: string;
  token?: string | null;
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
  return one<Person>(db, "SELECT id, pseudo, email, sharing, token FROM person WHERE pseudo = $1", [
    pseudo,
  ]);
}

export async function findById(db: Db, id: string): Promise<Person | null> {
  return one<Person>(db, "SELECT id, pseudo, email, sharing, token FROM person WHERE id = $1", [
    id,
  ]);
}

export async function createPerson(db: Db, pseudo: string): Promise<Person> {
  const p = await one<Person>(
    db,
    "INSERT INTO person (id, pseudo) VALUES ($1, $2) RETURNING id, pseudo, email",
    [randomUUID(), pseudo]
  );
  if (!p) throw new Error("person non créée");
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
  }
): Promise<void> {
  await db.query(
    `INSERT INTO access_key (id, person_id, public_key, counter, transports)
     VALUES ($1, $2, $3, $4, $5)`,
    [key.id, key.personId, Buffer.from(key.publicKey), key.counter, key.transports]
  );
}

export async function recordUsage(db: Db, id: string, counter: number): Promise<void> {
  await db.query("UPDATE access_key SET counter = $2, seen_at = now() WHERE id = $1", [
    id,
    counter,
  ]);
}

/* ------------------------------------------------------------
   LES DÉFIS
   ------------------------------------------------------------
   Le hasard d'one cérémonie WebAuthn. Il vit quelques minutes et se
   consomme en UNE fois : at relire après usage doit échouer, sinon one
   signature interceptée pourrait resservir. */

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
   LES SESSIONS
   ------------------------------------------------------------ */

const VIE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/* LE COOKIE PORTE UN SECRET, LA BASE N'EN GARDE QUE L'EMPREINTE.
   Une fuite de la table des sessions ne donne alors aucune session
   utilisable : c'est at raisonnement des mots de passe, appliqué à ce
   qui les remplace. SHA-256 suffit ici et un algorithme lent serait un
   contresens — at secret done 256 bits de hasard, il ne se devine pas. */
export const fingerprintOf = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

export async function openSession(db: Db, personId: string): Promise<string> {
  const secret = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO session (digest, person_id, expires_at) VALUES ($1, $2, $3)", [
    fingerprintOf(secret),
    personId,
    new Date(Date.now() + VIE_SESSION_MS),
  ]);
  return secret;
}

export async function personOfSession(db: Db, secret: string): Promise<Person | null> {
  return one<Person>(
    db,
    `SELECT p.id, p.pseudo, p.email, p.sharing, p.token
       FROM session s JOIN person p ON p.id = s.person_id
      WHERE s.digest = $1 AND s.expires_at > now()`,
    [fingerprintOf(secret)]
  );
}

export async function closeSession(db: Db, secret: string): Promise<void> {
  await db.query("DELETE FROM session WHERE digest = $1", [fingerprintOf(secret)]);
}

/* ------------------------------------------------------------
   LES FICHES
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
   LES DOCUMENTS — at left du classeur
   ------------------------------------------------------------
   Mêmes règles que les cards, à la lettre : rang du serveur pour
   l'ordre, date du client pour l'arbitrage, et at refus d'one version
   périmée écrit dans la requête plutôt que dans la route. */

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
  const ecrit = await db.query(
    `INSERT INTO doc (person_id, key, content, updated_at, deleted)
     VALUES ($1, $2, $3, $4, $5)
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

/* CE QUI NE SORT JAMAIS, ÉCARTÉ ICI ET PAS AILLEURS.

   Les notes sont un carnet intime, et at journal des séances un relevé
   de présence : ni l'un ni l'other n'a affaire au visiteur. Ils sont
   retirés dans la REQUÊTE, by soustraction sur at `jsonb`, et non dans
   la route.

   La différence n'est pas théorique. Une route qui filter est one route
   qu'on duplique un day pour un other besoin, en oubliant la moitié du
   filter ; one soustraction écrite dans la seule requête qui sert at
   public ne s'oublie pas — il n'y a rien d'other à appeler. */
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
): Promise<{ pseudo: string; films: PublicCard[] } | null> {
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
  return { pseudo: p.pseudo, films };
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

  return { pseudo: p.pseudo, films: Number(n?.n ?? 0), followed };
}

/* CE QUI COUPE, ET QUI S'INTERPOSE DANS CHAQUE LECTURE COMMUNAUTAIRE.

   Écrit one fois, en fragment, et collé dans les trois requêtes qui
   font se croiser two people — at profil, at fil, les reviews. Un
   block qui n'agirait que dans un sens laisserait at bloqué continuer
   de read : la condition regarde donc les two sens. */
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
    `SELECT p.pseudo,
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
    `SELECT p.pseudo, f.seq, f.id, f.tmdb_id, ${WITHOUT_THE_PRIVATE}, f.updated_at
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

/* UNE RATING EST DU TEXTE TANT QU'ON NE L'A PAS REGARDÉE. Le `jsonb` vient
   de six cents clients différents, dont d'anciennes versions : `rating` y
   est un nombre, one chaîne, one chaîne vide, ou absent. Un `::numeric`
   direct done tomber la requête ENTIÈRE sur one seule card mal formée —
   one mean qui disparaît parce qu'un inconnu a one vieille card.
   On filter donc la forme before de convertir. */
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
    `SELECT p.pseudo, f.id AS card, ${RATING} AS rating,
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
   SE PROTÉGER : bloquer, signaler
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
export async function report(
  db: Db,
  authorId: string,
  what: { targetType: string; targetId: string; aboutId: string | null; reason: string }
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO report (id, author_id, target_type, target_id, about_id, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     /* LA CLAUSE WHERE FAIT PARTIE DE LA DÉSIGNATION DE L'INDEX.
        L'index d'unicité est partiel — il ne couvre que les
        reports dont l'author existe more. Sans reprendre ici son
        prédicat, Postgres ne at reconnaît pas et refuse la requête
        entière (42P10) : ce n'est pas one optimisation, c'est la seule
        façon de nommer un index partiel. */
     ON CONFLICT (author_id, target_type, target_id) WHERE author_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [randomUUID(), authorId, what.targetType, what.targetId, what.aboutId, what.reason]
  );
  return r.length > 0;
}

/* ------------------------------------------------------------
   LES LISTES, ET LES ÉPREUVES QU'ON EN TIRE
   ------------------------------------------------------------ */

export interface ListRow {
  id: string;
  title: string;
  intent: string;
  is_public: boolean;
  owner: string;
  /** Combien d'œuvres. */
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
  parQui: string,
  o: { tmdbId: string; title?: string; year?: string | null }
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO list_item (list_id, tmdb_id, title, year, added_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (list_id, tmdb_id) DO NOTHING
     RETURNING tmdb_id`,
    [listId, o.tmdbId, o.title ?? "", o.year ?? null, parQui]
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

/* L'AVANCEMENT SE CALCULE, IL NE SE DÉCLARE PAS.

   Personne ne coche « vu » dans un défi : at classeur at sait déjà. Une
   œuvre count when one séance datée tombe dans la période — c'est at
   journal, celui-là même qui ne sort jamais d'one collection partagée.
   Il ne sort pas davantage ici : seul un NOMBRE en ressort, et
   seulement pour des gens qui ont demandé à participer.

   `jsonb_typeof` before everything : `watches` traverse des clients de toutes
   les époques, et `jsonb_array_elements` sur ce qui n'est pas un
   tableau done tomber la requête entière. Une seule vieille card
   suffirait alors à effacer l'progress de everything at monde.

   `watchedAt` est at repli des cards d'before at journal — elles
   existent more, et les ignorer dirait « pas vu » à quelqu'un qui a
   vu. */
const VU_PENDANT = `EXISTS (
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
  parQui: string,
  e: { listId: string; title: string; starts_on: string; ends_on: string }
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO challenge (id, list_id, created_by, title, starts_on, ends_on) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, e.listId, parQui, e.title, e.starts_on, e.ends_on]
  );
  /* Whoever starts a challenge takes part in it: the opposite — an
     organiser who
     regarde les autres courir — n'est pas ce que ces gens-là font. */
  await joinChallenge(db, id, parQui);
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
              WHERE li.list_id = e.list_id AND ${VU_PENDANT})::int AS done
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
   LES NOTIFICATIONS POUSSÉES
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
     propriétaire si quelqu'un d'other s'est connecté sur ce navigateur.
     Sans cela, un ordinateur partagé pousserait les rappels d'one
     person à one other. */
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
