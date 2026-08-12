/* ============================================================
   LE DÉPÔT — les seules questions que le serveur pose à la base
   ============================================================

   Toutes les requêtes vivent ici, et nulle part ailleurs. Une route qui
   écrirait son SQL dans son gestionnaire ferait perdre la seule chose
   qu'on gagne à les rassembler : pouvoir relire, en une page, tout ce
   que le serveur sait faire des données de quelqu'un.
   ============================================================ */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Db } from "./db.ts";
import { one } from "./db.ts";

export interface Person {
  id: string;
  pseudo: string;
  courriel: string | null;
  partage?: string;
  jeton?: string | null;
}

export interface AccessKey {
  id: string;
  personne_id: string;
  cle_publique: Uint8Array;
  compteur: string | number;
  transports: string[];
}

/* ------------------------------------------------------------
   LES PERSONNES
   ------------------------------------------------------------ */

export async function findByPseudo(db: Db, pseudo: string): Promise<Person | null> {
  return one<Person>(
    db,
    "SELECT id, pseudo, courriel, partage, jeton FROM personne WHERE pseudo = $1",
    [pseudo]
  );
}

export async function findById(db: Db, id: string): Promise<Person | null> {
  return one<Person>(
    db,
    "SELECT id, pseudo, courriel, partage, jeton FROM personne WHERE id = $1",
    [id]
  );
}

export async function createPerson(db: Db, pseudo: string): Promise<Person> {
  const p = await one<Person>(
    db,
    "INSERT INTO personne (id, pseudo) VALUES ($1, $2) RETURNING id, pseudo, courriel",
    [randomUUID(), pseudo]
  );
  if (!p) throw new Error("personne non créée");
  return p;
}

/** The right to erasure, in one line: the schema carries off the rest. */
export async function deletePerson(db: Db, id: string): Promise<void> {
  await db.query("DELETE FROM personne WHERE id = $1", [id]);
}

/* ------------------------------------------------------------
   LES CLÉS D'ACCÈS
   ------------------------------------------------------------ */

export async function keysOf(db: Db, personneId: string): Promise<AccessKey[]> {
  return db.query<AccessKey>(
    "SELECT id, personne_id, cle_publique, compteur, transports FROM cle_acces WHERE personne_id = $1",
    [personneId]
  );
}

export async function keyById(db: Db, id: string): Promise<AccessKey | null> {
  return one<AccessKey>(
    db,
    "SELECT id, personne_id, cle_publique, compteur, transports FROM cle_acces WHERE id = $1",
    [id]
  );
}

export async function addKey(
  db: Db,
  cle: {
    id: string;
    personneId: string;
    publicKey: Uint8Array;
    compteur: number;
    transports: string[];
  }
): Promise<void> {
  await db.query(
    `INSERT INTO cle_acces (id, personne_id, cle_publique, compteur, transports)
     VALUES ($1, $2, $3, $4, $5)`,
    [cle.id, cle.personneId, Buffer.from(cle.publicKey), cle.compteur, cle.transports]
  );
}

export async function recordUsage(db: Db, id: string, compteur: number): Promise<void> {
  await db.query("UPDATE cle_acces SET compteur = $2, vue_le = now() WHERE id = $1", [
    id,
    compteur,
  ]);
}

/* ------------------------------------------------------------
   LES DÉFIS
   ------------------------------------------------------------
   Le hasard d'une cérémonie WebAuthn. Il vit quelques minutes et se
   consomme en UNE fois : le relire après usage doit échouer, sinon une
   signature interceptée pourrait resservir. */

const VIE_DEFI_MS = 5 * 60 * 1000;

export async function setChallenge(
  db: Db,
  valeur: string,
  quoi: { personneId?: string; pseudo?: string } = {}
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO defi (id, valeur, personne_id, pseudo, expire_le) VALUES ($1, $2, $3, $4, $5)",
    [id, valeur, quoi.personneId ?? null, quoi.pseudo ?? null, new Date(Date.now() + VIE_DEFI_MS)]
  );
  return id;
}

export async function consumeChallenge(
  db: Db,
  id: string
): Promise<{ valeur: string; personne_id: string | null; pseudo: string | null } | null> {
  /* Read and delete in the SAME statement: between a separate SELECT and
     DELETE, two simultaneous requests can consume the same challenge.
     `DELETE … RETURNING` leaves no such gap. */
  return one(
    db,
    "DELETE FROM defi WHERE id = $1 AND expire_le > now() RETURNING valeur, personne_id, pseudo",
    [id]
  );
}

export async function sweepChallenges(db: Db): Promise<void> {
  await db.query("DELETE FROM defi WHERE expire_le <= now()");
}

/* ------------------------------------------------------------
   LES SESSIONS
   ------------------------------------------------------------ */

const VIE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/* LE COOKIE PORTE UN SECRET, LA BASE N'EN GARDE QUE L'EMPREINTE.
   Une fuite de la table des sessions ne donne alors aucune session
   utilisable : c'est le raisonnement des mots de passe, appliqué à ce
   qui les remplace. SHA-256 suffit ici et un algorithme lent serait un
   contresens — le secret fait 256 bits de hasard, il ne se devine pas. */
export const fingerprintOf = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

export async function openSession(db: Db, personneId: string): Promise<string> {
  const secret = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO session (empreinte, personne_id, expire_le) VALUES ($1, $2, $3)", [
    fingerprintOf(secret),
    personneId,
    new Date(Date.now() + VIE_SESSION_MS),
  ]);
  return secret;
}

export async function personOfSession(db: Db, secret: string): Promise<Person | null> {
  return one<Person>(
    db,
    `SELECT p.id, p.pseudo, p.courriel, p.partage, p.jeton
       FROM session s JOIN personne p ON p.id = s.personne_id
      WHERE s.empreinte = $1 AND s.expire_le > now()`,
    [fingerprintOf(secret)]
  );
}

export async function closeSession(db: Db, secret: string): Promise<void> {
  await db.query("DELETE FROM session WHERE empreinte = $1", [fingerprintOf(secret)]);
}

/* ------------------------------------------------------------
   LES FICHES
   ------------------------------------------------------------ */

export interface StoredCard {
  id: string;
  seq: string | number;
  tmdb_id: string | null;
  cachee: boolean;
  donnees: Record<string, unknown>;
  maj_le: Date;
  supprimee: boolean;
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
  personneId: string,
  depuis: bigint | number,
  plafond = 500
): Promise<StoredCard[]> {
  return db.query<StoredCard>(
    `SELECT id, seq, tmdb_id, cachee, donnees, maj_le, supprimee
       FROM fiche WHERE personne_id = $1 AND seq > $2
      ORDER BY seq ASC LIMIT $3`,
    [personneId, String(depuis), plafond]
  );
}

/**
 * Range une fiche venue d'un appareil.
 *
 * LAST WRITER WINS, AND IT IS THE DATABASE THAT DECIDES. The clause
 * `WHERE fiche.maj_le < EXCLUDED.maj_le` refuses a version older than
 * the one already stored: two devices pushing at the same time cannot
 * overtake each other, whatever order they arrive in. Arbitrating on the
 * server by reading and then writing would leave exactly that gap.
 */
export async function storeCard(
  db: Db,
  personneId: string,
  f: {
    id: string;
    tmdbId?: string | null;
    cachee?: boolean;
    donnees: unknown;
    majLe: Date;
    supprimee?: boolean;
  }
): Promise<boolean> {
  /* `RETURNING` returns a row ONLY if the insert or the update actually
     happened: when the `WHERE` clause rules out a stale version, it
     returns nothing. That is how the caller learns it pushed into the
     void — with no second query, and no gap between the two. */
  const ecrite = await db.query(
    /* ON PASSE L'OBJET, JAMAIS SA SÉRIALISATION, et ce n'est pas un
       détail de style.

       Le pilote de production sérialise LUI-MÊME ce qui va dans une
       colonne `jsonb`. Lui donner une chaîne déjà sérialisée la fait
       sérialiser une seconde fois : la fiche est rangée comme une
       CHAÎNE JSON et non comme un objet, `donnees->>'title'` ne trouve
       plus rien, et tout ce qui la relit reçoit du texte. La conversion
       explicite n'y change rien — mesuré sur les deux moteurs.

       Le Postgres des tests, lui, accepte les deux formes sans broncher.
       Le défaut était donc invisible en test et systématique en vrai :
       la seule espèce qu'une suite verte ne rattrape jamais. Il a fallu
       pousser une fiche dans un vrai Postgres pour le voir. */
    `INSERT INTO fiche (personne_id, id, tmdb_id, cachee, donnees, maj_le, supprimee)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (personne_id, id) DO UPDATE
        SET tmdb_id = EXCLUDED.tmdb_id,
            /* LA COLONNE cachee N'EST PAS RÉÉCRITE PAR UNE POUSSÉE, et
               c'est la seule ligne de cette clause qui manquait.

               « Écarter une fiche du partage » est une décision de
               PARTAGE, prise sur ce serveur et vivant sur lui seul : le
               client ne la modélise pas, ne la stocke pas, et ne
               l'envoie donc jamais. EXCLUDED.cachee valait par
               conséquent toujours faux — et chaque poussée de la fiche
               la rendait publique de nouveau, en silence.

               Il suffisait d'écrire une note sur une fiche écartée pour
               la remettre sous les yeux de tout le monde. Personne
               n'aurait vu passer ça : la fiche ne change pas
               d'apparence chez soi, seulement chez les autres.

               C'est cacherFiche qui écrit cette colonne, et elle seule.
               La protection est dans le SCHÉMA plutôt que dans la
               route, comme le veut la maison : une règle écrite dans
               une route se contourne par la route suivante. */
            donnees = EXCLUDED.donnees,
            maj_le = EXCLUDED.maj_le,
            supprimee = EXCLUDED.supprimee,
            /* UN RANG NEUF À CHAQUE ÉCRITURE, sans quoi la fiche
               modifiée garderait sa place dans la file et les autres
               appareils, déjà passés par là, ne la reverraient jamais. */
            seq = nextval('fiche_seq')
      WHERE fiche.maj_le < EXCLUDED.maj_le
     RETURNING seq`,
    [
      personneId,
      f.id,
      f.tmdbId ?? null,
      f.cachee ?? false,
      f.donnees,
      f.majLe,
      f.supprimee ?? false,
    ]
  );
  return ecrite.length > 0;
}

export async function countCards(db: Db, personneId: string): Promise<number> {
  const r = await one<{ n: string }>(
    db,
    "SELECT count(*)::text AS n FROM fiche WHERE personne_id = $1 AND NOT supprimee",
    [personneId]
  );
  return Number(r?.n ?? 0);
}

/* ------------------------------------------------------------
   LES DOCUMENTS — le reste du classeur
   ------------------------------------------------------------
   Mêmes règles que les fiches, à la lettre : rang du serveur pour
   l'ordre, date du client pour l'arbitrage, et le refus d'une version
   périmée écrit dans la requête plutôt que dans la route. */

export interface StoredDoc {
  cle: string;
  seq: string | number;
  contenu: unknown;
  maj_le: Date;
  supprime: boolean;
}

export async function docsSince(
  db: Db,
  personneId: string,
  depuis: bigint | number,
  plafond = 200
): Promise<StoredDoc[]> {
  return db.query<StoredDoc>(
    `SELECT cle, seq, contenu, maj_le, supprime
       FROM doc WHERE personne_id = $1 AND seq > $2
      ORDER BY seq ASC LIMIT $3`,
    [personneId, String(depuis), plafond]
  );
}

export async function storeDoc(
  db: Db,
  personneId: string,
  d: { cle: string; contenu: unknown; majLe: Date; supprime?: boolean }
): Promise<boolean> {
  const ecrit = await db.query(
    `INSERT INTO doc (personne_id, cle, contenu, maj_le, supprime)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (personne_id, cle) DO UPDATE
        SET contenu = EXCLUDED.contenu,
            maj_le = EXCLUDED.maj_le,
            supprime = EXCLUDED.supprime,
            seq = nextval('doc_seq')
      WHERE doc.maj_le < EXCLUDED.maj_le
     RETURNING seq`,
    [personneId, d.cle, d.contenu, d.majLe, d.supprime ?? false]
  );
  return ecrit.length > 0;
}

/* ------------------------------------------------------------
   PARTAGER SA COLLECTION
   ------------------------------------------------------------ */

export async function setSharing(
  db: Db,
  personneId: string,
  partage: string,
  jeton: string | null
): Promise<void> {
  await db.query("UPDATE personne SET partage = $2, jeton = $3 WHERE id = $1", [
    personneId,
    partage,
    jeton,
  ]);
}

/* CE QUI NE SORT JAMAIS, ÉCARTÉ ICI ET PAS AILLEURS.

   Les notes sont un carnet intime, et le journal des séances un relevé
   de présence : ni l'un ni l'autre n'a affaire au visiteur. Ils sont
   retirés dans la REQUÊTE, par soustraction sur le `jsonb`, et non dans
   la route.

   La différence n'est pas théorique. Une route qui filtre est une route
   qu'on duplique un jour pour un autre besoin, en oubliant la moitié du
   filtre ; une soustraction écrite dans la seule requête qui sert le
   public ne s'oublie pas — il n'y a rien d'autre à appeler. */
const SANS_LE_PRIVE = `f.donnees - 'notes' - 'watches' - 'watchedAt' AS donnees`;

export interface PublicCard {
  id: string;
  tmdb_id: string | null;
  donnees: Record<string, unknown>;
}

/**
 * La collection d'une personne, vue du dehors.
 *
 * `null` if they do not share, or if the token does not match. The SAME
 * `null` in both cases: saying "this account exists but does not share"
 * would tell you who is registered.
 */
export async function publicCollectionOf(
  db: Db,
  pseudo: string,
  jeton: string | null
): Promise<{ pseudo: string; films: PublicCard[] } | null> {
  const p = await findByPseudo(db, pseudo);
  if (!p) return null;
  if (p.partage === "publique") {
    /* nothing to check */
  } else if (p.partage === "lien") {
    if (!jeton || !p.jeton || jeton !== p.jeton) return null;
  } else {
    return null;
  }

  const films = await db.query<PublicCard>(
    `SELECT f.id, f.tmdb_id, ${SANS_LE_PRIVE}
       FROM fiche f
      WHERE f.personne_id = $1 AND NOT f.cachee AND NOT f.supprimee
      ORDER BY f.maj_le DESC`,
    [p.id]
  );
  return { pseudo: p.pseudo, films };
}

/** Retirer une fiche du partage, ou l'y remettre. */
export async function hideCard(
  db: Db,
  personneId: string,
  ficheId: string,
  cachee: boolean
): Promise<boolean> {
  const r = await db.query(
    `UPDATE fiche SET cachee = $3, seq = nextval('fiche_seq')
      WHERE personne_id = $1 AND id = $2 RETURNING seq`,
    [personneId, ficheId, cachee]
  );
  return r.length > 0;
}

/** The cards kept out of sharing. Identifiers, nothing more. */
export async function hiddenCards(db: Db, personneId: string): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    "SELECT id FROM fiche WHERE personne_id = $1 AND cachee AND NOT supprimee",
    [personneId]
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
  suivi?: boolean;
}

/**
 * Le profil de quelqu'un — et il n'existe QUE s'il se montre.
 *
 * So you can only find people who chose to be findable: no directory, no
 * list, and a username guessed at random tells you nothing more than an
 * invented one. Sharing by link does not open a profile: a link is given
 * to somebody, it does not make you public.
 */
export async function publicProfileOf(
  db: Db,
  pseudo: string,
  quiDemande?: string
): Promise<Profile | null> {
  const p = await findByPseudo(db, pseudo);
  if (!p || p.partage !== "publique") return null;

  /* Un blocage rend introuvable, dans les deux sens, et sans le dire :
     c'est le même 404 que « n'existe pas ». Annoncer « vous êtes bloqué »
     ferait de la route un moyen de vérifier qu'on l'est. */
  if (quiDemande && (await blockedIds(db, quiDemande, p.id))) return null;

  const n = await one<{ n: string }>(
    db,
    "SELECT count(*)::text AS n FROM fiche WHERE personne_id = $1 AND NOT cachee AND NOT supprimee",
    [p.id]
  );
  const suivi = quiDemande
    ? (
        await db.query("SELECT 1 FROM abonnement WHERE suiveur_id = $1 AND suivi_id = $2", [
          quiDemande,
          p.id,
        ])
      ).length > 0
    : undefined;

  return { pseudo: p.pseudo, films: Number(n?.n ?? 0), suivi };
}

/* CE QUI COUPE, ET QUI S'INTERPOSE DANS CHAQUE LECTURE COMMUNAUTAIRE.

   Écrit une fois, en fragment, et collé dans les trois requêtes qui
   font se croiser deux personnes — le profil, le fil, les avis. Un
   blocage qui n'agirait que dans un sens laisserait le bloqué continuer
   de lire : la condition regarde donc les deux sens. */
const PAS_BLOQUE = (moi: string, lui: string) =>
  `NOT EXISTS (SELECT 1 FROM blocage b
                WHERE (b.bloqueur_id = ${moi} AND b.bloque_id = ${lui})
                   OR (b.bloqueur_id = ${lui} AND b.bloque_id = ${moi}))`;

export async function follow(db: Db, suiveur: string, suivi: string): Promise<void> {
  /* `ON CONFLICT DO NOTHING`: following twice is the same gesture, and
     must answer the same thing. */
  await db.query(
    "INSERT INTO abonnement (suiveur_id, suivi_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [suiveur, suivi]
  );
}

export async function unfollow(db: Db, suiveur: string, suivi: string): Promise<void> {
  await db.query("DELETE FROM abonnement WHERE suiveur_id = $1 AND suivi_id = $2", [
    suiveur,
    suivi,
  ]);
}

/** Qui je suis, avec ce que leur collection montre encore. */
export async function subscriptionsOf(db: Db, personneId: string): Promise<Profile[]> {
  return db.query<Profile>(
    `SELECT p.pseudo,
            (SELECT count(*) FROM fiche f
              WHERE f.personne_id = p.id AND NOT f.cachee AND NOT f.supprimee)::int AS films,
            (p.partage = 'publique') AS ouverte
       FROM abonnement a JOIN personne p ON p.id = a.suivi_id
      WHERE a.suiveur_id = $1
      ORDER BY p.pseudo`,
    [personneId]
  );
}

export interface FeedItem {
  pseudo: string;
  seq: string | number;
  id: string;
  tmdb_id: string | null;
  donnees: Record<string, unknown>;
  maj_le: Date;
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
 * subscriptions the `fiche_suite` index is plenty; the day it is not,
 * that will be a real problem of scale, and not before.
 */
export async function feedOf(
  db: Db,
  personneId: string,
  avant: bigint | number | null,
  plafond = 40
): Promise<FeedItem[]> {
  return db.query<FeedItem>(
    `SELECT p.pseudo, f.seq, f.id, f.tmdb_id, ${SANS_LE_PRIVE}, f.maj_le
       FROM abonnement a
       JOIN personne p ON p.id = a.suivi_id
       JOIN fiche f ON f.personne_id = p.id
      WHERE a.suiveur_id = $1
        AND p.partage = 'publique'
        AND NOT f.cachee AND NOT f.supprimee
        AND ($2::bigint IS NULL OR f.seq < $2::bigint)
        AND ${PAS_BLOQUE("$1", "p.id")}
      ORDER BY f.seq DESC
      LIMIT $3`,
    [personneId, avant === null ? null : String(avant), plafond]
  );
}

/* ------------------------------------------------------------
   CE QU'ON DIT D'UNE ŒUVRE
   ------------------------------------------------------------ */

export interface Review {
  pseudo: string;
  /** L'identifiant de la fiche chez son auteur : c'est ce qu'on signale. */
  fiche: string;
  note: number | null;
  critique: string | null;
  le: Date;
}

export interface Echo {
  /** Combien de collections publiques rangent cette œuvre. */
  collections: number;
  /** The mean of the ratings given, or `null` if nobody rated. */
  moyenne: number | null;
  notes: number;
  avis: Review[];
}

/* UNE NOTE EST DU TEXTE TANT QU'ON NE L'A PAS REGARDÉE. Le `jsonb` vient
   de six cents clients différents, dont d'anciennes versions : `rating` y
   est un nombre, une chaîne, une chaîne vide, ou absent. Un `::numeric`
   direct fait tomber la requête ENTIÈRE sur une seule fiche mal formée —
   une moyenne qui disparaît parce qu'un inconnu a une vieille fiche.
   On filtre donc la forme avant de convertir. */
const NOTE = `CASE WHEN f.donnees->>'rating' ~ '^[0-9]+(\\.[0-9]+)?$'
                   THEN (f.donnees->>'rating')::numeric END`;

/**
 * Ce que les collections publiques disent d'une œuvre.
 *
 * LA CLÉ EST `tmdb_id`, ET C'EST LA SEULE POSSIBLE. Deux personnes qui
 * file the same film have two cards, two identifiers, often two titles —
 * the work's identity can only come from the shared reference. A card
 * typed by hand, with no `tmdb_id`, therefore joins no echo: it exists
 * only at home, and that is consistent.
 *
 * `quiDemande` serves two purposes and not one: ruling out blocked
 * people, and ruling out yourself — reading your own review under "what
 * others think of it" would give a mean you had voted in twice.
 */
export async function echoOfWork(
  db: Db,
  tmdbId: string,
  quiDemande: string | null,
  plafond = 30
): Promise<Echo> {
  const filtre = quiDemande
    ? `AND p.id <> $2 AND ${PAS_BLOQUE("$2", "p.id")}`
    : `AND ($2::uuid IS NULL)`;
  const args = [tmdbId, quiDemande];

  const compte = await one<{ collections: string; notes: string; moyenne: string | null }>(
    db,
    `SELECT count(*)::text AS collections,
            count(${NOTE})::text AS notes,
            avg(${NOTE})::text AS moyenne
       FROM fiche f JOIN personne p ON p.id = f.personne_id
      WHERE f.tmdb_id = $1 AND p.partage = 'publique'
        AND NOT f.cachee AND NOT f.supprimee ${filtre}`,
    args
  );

  /* Seules les fiches qui DISENT quelque chose remontent : une œuvre
     rangée sans un mot ni une note compte dans le total et n'a rien à
     lire. Afficher des lignes vides ferait passer le silence pour un
     avis. */
  const avis = await db.query<Review>(
    `SELECT p.pseudo, f.id AS fiche, ${NOTE} AS note,
            NULLIF(f.donnees->>'review', '') AS critique, f.maj_le AS le
       FROM fiche f JOIN personne p ON p.id = f.personne_id
      WHERE f.tmdb_id = $1 AND p.partage = 'publique'
        AND NOT f.cachee AND NOT f.supprimee ${filtre}
        AND (NULLIF(f.donnees->>'review', '') IS NOT NULL OR ${NOTE} IS NOT NULL)
      ORDER BY f.maj_le DESC
      LIMIT $3`,
    [...args, plafond]
  );

  return {
    collections: Number(compte?.collections ?? 0),
    notes: Number(compte?.notes ?? 0),
    moyenne: compte?.moyenne == null ? null : Math.round(Number(compte.moyenne) * 100) / 100,
    avis: avis.map((a) => ({ ...a, note: a.note == null ? null : Number(a.note) })),
  };
}

/* ------------------------------------------------------------
   SE PROTÉGER : bloquer, signaler
   ------------------------------------------------------------ */

/** Is there a block between these two, in either direction? */
export async function blockedIds(db: Db, un: string, autre: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM blocage
      WHERE (bloqueur_id = $1 AND bloque_id = $2) OR (bloqueur_id = $2 AND bloque_id = $1)`,
    [un, autre]
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
export async function block(db: Db, bloqueur: string, bloque: string): Promise<void> {
  await db.query(
    "INSERT INTO blocage (bloqueur_id, bloque_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [bloqueur, bloque]
  );
  await db.query(
    `DELETE FROM abonnement
      WHERE (suiveur_id = $1 AND suivi_id = $2) OR (suiveur_id = $2 AND suivi_id = $1)`,
    [bloqueur, bloque]
  );
}

export async function unblock(db: Db, bloqueur: string, bloque: string): Promise<void> {
  await db.query("DELETE FROM blocage WHERE bloqueur_id = $1 AND bloque_id = $2", [
    bloqueur,
    bloque,
  ]);
}

/** Whom I HAVE blocked — never who blocked me: that is not askable. */
export async function myBlocks(db: Db, personneId: string): Promise<string[]> {
  const r = await db.query<{ pseudo: string }>(
    `SELECT p.pseudo FROM blocage b JOIN personne p ON p.id = b.bloque_id
      WHERE b.bloqueur_id = $1 ORDER BY p.pseudo`,
    [personneId]
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
  auteurId: string,
  quoi: { cibleType: string; cibleId: string; viseId: string | null; motif: string }
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO signalement (id, auteur_id, cible_type, cible_id, vise_id, motif)
     VALUES ($1, $2, $3, $4, $5, $6)
     /* LA CLAUSE WHERE FAIT PARTIE DE LA DÉSIGNATION DE L'INDEX.
        L'index d'unicité est partiel — il ne couvre que les
        signalements dont l'auteur existe encore. Sans reprendre ici son
        prédicat, Postgres ne le reconnaît pas et refuse la requête
        entière (42P10) : ce n'est pas une optimisation, c'est la seule
        façon de nommer un index partiel. */
     ON CONFLICT (auteur_id, cible_type, cible_id) WHERE auteur_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [randomUUID(), auteurId, quoi.cibleType, quoi.cibleId, quoi.viseId, quoi.motif]
  );
  return r.length > 0;
}

/* ------------------------------------------------------------
   LES LISTES, ET LES ÉPREUVES QU'ON EN TIRE
   ------------------------------------------------------------ */

export interface ListRow {
  id: string;
  titre: string;
  intention: string;
  publique: boolean;
  proprietaire: string;
  /** Combien d'œuvres. */
  oeuvres: number;
  /** Am I the owner, and may I write in it? */
  mienne?: boolean;
  membre?: boolean;
}

export interface WorkRow {
  tmdb_id: string;
  titre: string;
  annee: string | null;
  par: string | null;
}

/** Ce que quelqu'un a le droit de faire d'une liste. */
export interface Rights {
  lire: boolean;
  ecrire: boolean;
  administrer: boolean;
  proprietaire_id: string;
  liste_id: string;
}

/**
 * Somebody's rights over a list, in one query.
 *
 * THREE LEVELS AND NOT TWO, because co-building is not owning.
 * Un membre ajoute et retire des œuvres ; il ne renomme pas la liste, ne
 * does not make it public and does not delete it. Without that
 * asymmetry, a list built by six hands has nobody left answering for it.
 */
export async function rightsOnList(
  db: Db,
  listeId: string,
  personneId: string | null
): Promise<Rights | null> {
  const l = await one<{ id: string; proprietaire_id: string; publique: boolean; membre: boolean }>(
    db,
    `SELECT l.id, l.proprietaire_id, l.publique,
            EXISTS (SELECT 1 FROM liste_membre m
                     WHERE m.liste_id = l.id AND m.personne_id = $2) AS membre
       FROM liste l WHERE l.id = $1`,
    [listeId, personneId]
  );
  if (!l) return null;
  const proprio = personneId !== null && l.proprietaire_id === personneId;
  return {
    liste_id: l.id,
    proprietaire_id: l.proprietaire_id,
    lire: l.publique || proprio || l.membre,
    ecrire: proprio || l.membre,
    administrer: proprio,
  };
}

/** My lists, and those I have been allowed to write in. */
export async function myLists(db: Db, personneId: string): Promise<ListRow[]> {
  return db.query<ListRow>(
    `SELECT l.id, l.titre, l.intention, l.publique,
            p.pseudo AS proprietaire,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres,
            (l.proprietaire_id = $1) AS mienne,
            EXISTS (SELECT 1 FROM liste_membre m
                     WHERE m.liste_id = l.id AND m.personne_id = $1) AS membre
       FROM liste l JOIN personne p ON p.id = l.proprietaire_id
      WHERE l.proprietaire_id = $1
         OR EXISTS (SELECT 1 FROM liste_membre m
                     WHERE m.liste_id = l.id AND m.personne_id = $1)
      ORDER BY l.maj_le DESC`,
    [personneId]
  );
}

/** Les listes publiques de quelqu'un — ce qu'un visiteur peut en voir. */
export async function publicListsOf(db: Db, proprietaireId: string): Promise<ListRow[]> {
  return db.query<ListRow>(
    `SELECT l.id, l.titre, l.intention, l.publique,
            p.pseudo AS proprietaire,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres
       FROM liste l JOIN personne p ON p.id = l.proprietaire_id
      WHERE l.proprietaire_id = $1 AND l.publique
      ORDER BY l.maj_le DESC`,
    [proprietaireId]
  );
}

export async function createList(
  db: Db,
  proprietaireId: string,
  l: { titre: string; intention?: string; publique?: boolean }
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO liste (id, proprietaire_id, titre, intention, publique) VALUES ($1, $2, $3, $4, $5)",
    [id, proprietaireId, l.titre, l.intention ?? "", l.publique ?? false]
  );
  return id;
}

export async function editList(
  db: Db,
  listeId: string,
  l: { titre?: string; intention?: string; publique?: boolean }
): Promise<void> {
  await db.query(
    `UPDATE liste
        SET titre = coalesce($2, titre),
            intention = coalesce($3, intention),
            publique = coalesce($4, publique),
            maj_le = now()
      WHERE id = $1`,
    [listeId, l.titre ?? null, l.intention ?? null, l.publique ?? null]
  );
}

export async function deleteList(db: Db, listeId: string): Promise<void> {
  await db.query("DELETE FROM liste WHERE id = $1", [listeId]);
}

export async function worksOf(db: Db, listeId: string): Promise<WorkRow[]> {
  return db.query<WorkRow>(
    `SELECT i.tmdb_id, i.titre, i.annee, p.pseudo AS par
       FROM liste_item i LEFT JOIN personne p ON p.id = i.ajoute_par
      WHERE i.liste_id = $1
      ORDER BY i.ajoute_le`,
    [listeId]
  );
}

/** Returns `false` if the work was already there: same gesture, same answer. */
export async function addToList(
  db: Db,
  listeId: string,
  parQui: string,
  o: { tmdbId: string; titre?: string; annee?: string | null }
): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO liste_item (liste_id, tmdb_id, titre, annee, ajoute_par)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (liste_id, tmdb_id) DO NOTHING
     RETURNING tmdb_id`,
    [listeId, o.tmdbId, o.titre ?? "", o.annee ?? null, parQui]
  );
  await db.query("UPDATE liste SET maj_le = now() WHERE id = $1", [listeId]);
  return r.length > 0;
}

export async function removeFromList(db: Db, listeId: string, tmdbId: string): Promise<void> {
  await db.query("DELETE FROM liste_item WHERE liste_id = $1 AND tmdb_id = $2", [listeId, tmdbId]);
  await db.query("UPDATE liste SET maj_le = now() WHERE id = $1", [listeId]);
}

export async function membersOf(db: Db, listeId: string): Promise<string[]> {
  const r = await db.query<{ pseudo: string }>(
    `SELECT p.pseudo FROM liste_membre m JOIN personne p ON p.id = m.personne_id
      WHERE m.liste_id = $1 ORDER BY p.pseudo`,
    [listeId]
  );
  return r.map((l) => l.pseudo);
}

export async function inviteToList(db: Db, listeId: string, personneId: string): Promise<void> {
  await db.query(
    "INSERT INTO liste_membre (liste_id, personne_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [listeId, personneId]
  );
}

export async function removeMemberFromList(
  db: Db,
  listeId: string,
  personneId: string
): Promise<void> {
  await db.query("DELETE FROM liste_membre WHERE liste_id = $1 AND personne_id = $2", [
    listeId,
    personneId,
  ]);
}

/* L'AVANCEMENT SE CALCULE, IL NE SE DÉCLARE PAS.

   Personne ne coche « vu » dans un défi : le classeur le sait déjà. Une
   œuvre compte quand une séance datée tombe dans la période — c'est le
   journal, celui-là même qui ne sort jamais d'une collection partagée.
   Il ne sort pas davantage ici : seul un NOMBRE en ressort, et
   seulement pour des gens qui ont demandé à participer.

   `jsonb_typeof` avant tout : `watches` traverse des clients de toutes
   les époques, et `jsonb_array_elements` sur ce qui n'est pas un
   tableau fait tomber la requête entière. Une seule vieille fiche
   suffirait alors à effacer l'avancement de tout le monde.

   `watchedAt` est le repli des fiches d'avant le journal — elles
   existent encore, et les ignorer dirait « pas vu » à quelqu'un qui a
   vu. */
const VU_PENDANT = `EXISTS (
  SELECT 1 FROM fiche f
   WHERE f.personne_id = ep.personne_id
     AND f.tmdb_id = li.tmdb_id
     AND NOT f.supprimee
     AND (
       EXISTS (
         SELECT 1 FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(f.donnees->'watches') = 'array'
                     THEN f.donnees->'watches' ELSE '[]'::jsonb END) w
          WHERE left(w->>'date', 10) BETWEEN to_char(e.debut, 'YYYY-MM-DD')
                                         AND to_char(e.fin, 'YYYY-MM-DD'))
       OR left(f.donnees->>'watchedAt', 10) BETWEEN to_char(e.debut, 'YYYY-MM-DD')
                                                AND to_char(e.fin, 'YYYY-MM-DD')
     ))`;

export interface Challenge {
  id: string;
  titre: string;
  liste_id: string;
  liste: string;
  debut: string;
  fin: string;
  par: string | null;
  oeuvres: number;
  /** Est-ce que j'y participe ? */
  dedans?: boolean;
}

export interface Progress {
  pseudo: string;
  faites: number;
}

/**
 * The challenges I can see: mine, those I have joined, and those built
 * on a public list belonging to somebody I follow.
 *
 * NO DIRECTORY OF CHALLENGES, for the same reason there is no
 * d'annuaire de gens : une liste de tout ce qui se joue ferait de ce
 * classeur une place publique, ce qu'il n'est pas.
 */
export async function myChallenges(db: Db, personneId: string): Promise<Challenge[]> {
  return db.query<Challenge>(
    `SELECT e.id, e.titre, e.liste_id, l.titre AS liste,
            to_char(e.debut, 'YYYY-MM-DD') AS debut,
            to_char(e.fin, 'YYYY-MM-DD') AS fin,
            p.pseudo AS par,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres,
            EXISTS (SELECT 1 FROM epreuve_participant x
                     WHERE x.epreuve_id = e.id AND x.personne_id = $1) AS dedans
       FROM epreuve e
       JOIN liste l ON l.id = e.liste_id
       LEFT JOIN personne p ON p.id = e.cree_par
      WHERE e.cree_par = $1
         OR EXISTS (SELECT 1 FROM epreuve_participant x
                     WHERE x.epreuve_id = e.id AND x.personne_id = $1)
         OR (l.publique AND EXISTS (SELECT 1 FROM abonnement a
                                     WHERE a.suiveur_id = $1 AND a.suivi_id = l.proprietaire_id)
             AND ${PAS_BLOQUE("$1", "l.proprietaire_id")})
      ORDER BY e.fin DESC`,
    [personneId]
  );
}

export async function challengeById(db: Db, id: string): Promise<Challenge | null> {
  return one<Challenge>(
    db,
    `SELECT e.id, e.titre, e.liste_id, l.titre AS liste,
            to_char(e.debut, 'YYYY-MM-DD') AS debut,
            to_char(e.fin, 'YYYY-MM-DD') AS fin,
            p.pseudo AS par,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres
       FROM epreuve e
       JOIN liste l ON l.id = e.liste_id
       LEFT JOIN personne p ON p.id = e.cree_par
      WHERE e.id = $1`,
    [id]
  );
}

export async function createChallenge(
  db: Db,
  parQui: string,
  e: { listeId: string; titre: string; debut: string; fin: string }
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO epreuve (id, liste_id, cree_par, titre, debut, fin) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, e.listeId, parQui, e.titre, e.debut, e.fin]
  );
  /* Whoever starts a challenge takes part in it: the opposite — an
     organiser who
     regarde les autres courir — n'est pas ce que ces gens-là font. */
  await joinChallenge(db, id, parQui);
  return id;
}

export async function deleteChallenge(db: Db, id: string): Promise<void> {
  await db.query("DELETE FROM epreuve WHERE id = $1", [id]);
}

export async function joinChallenge(db: Db, epreuveId: string, personneId: string): Promise<void> {
  await db.query(
    "INSERT INTO epreuve_participant (epreuve_id, personne_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [epreuveId, personneId]
  );
}

export async function leaveChallenge(db: Db, epreuveId: string, personneId: string): Promise<void> {
  await db.query("DELETE FROM epreuve_participant WHERE epreuve_id = $1 AND personne_id = $2", [
    epreuveId,
    personneId,
  ]);
}

/** Where each of them stands — one number per participant, nothing more. */
export async function progressOf(db: Db, epreuveId: string): Promise<Progress[]> {
  return db.query<Progress>(
    `SELECT pe.pseudo,
            (SELECT count(*) FROM liste_item li
              WHERE li.liste_id = e.liste_id AND ${VU_PENDANT})::int AS faites
       FROM epreuve_participant ep
       JOIN epreuve e ON e.id = ep.epreuve_id
       JOIN personne pe ON pe.id = ep.personne_id
      WHERE ep.epreuve_id = $1
      ORDER BY 2 DESC, pe.pseudo`,
    [epreuveId]
  );
}

/** Une liste par son identifiant, sans se demander qui la lit. */
export async function listById(db: Db, id: string): Promise<ListRow | null> {
  return one<ListRow>(
    db,
    `SELECT l.id, l.titre, l.intention, l.publique, p.pseudo AS proprietaire,
            (SELECT count(*) FROM liste_item i WHERE i.liste_id = l.id)::int AS oeuvres
       FROM liste l JOIN personne p ON p.id = l.proprietaire_id
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
export async function countGesture(db: Db, geste: string): Promise<void> {
  await db.query(
    `INSERT INTO mesure (jour, geste, n) VALUES (current_date, $1, 1)
     ON CONFLICT (jour, geste) DO UPDATE SET n = mesure.n + 1`,
    [geste]
  );
}

export async function metrics(
  db: Db,
  jours = 30
): Promise<{ jour: string; geste: string; n: string }[]> {
  return db.query(
    `SELECT to_char(jour, 'YYYY-MM-DD') AS jour, geste, n::text
       FROM mesure WHERE jour > current_date - $1::int
      ORDER BY jour DESC, n DESC`,
    [jours]
  );
}

/* ------------------------------------------------------------
   LES NOTIFICATIONS POUSSÉES
   ------------------------------------------------------------ */

export interface PushRow {
  point: string;
  p256dh: string;
  secret: string;
  personne_id: string;
}

export async function storePush(
  db: Db,
  personneId: string,
  p: { point: string; p256dh: string; secret: string }
): Promise<void> {
  /* The same device subscribing again replaces its row — and changes
     propriétaire si quelqu'un d'autre s'est connecté sur ce navigateur.
     Sans cela, un ordinateur partagé pousserait les rappels d'une
     personne à une autre. */
  await db.query(
    `INSERT INTO pousse (point, personne_id, p256dh, secret) VALUES ($1, $2, $3, $4)
     ON CONFLICT (point) DO UPDATE
        SET personne_id = EXCLUDED.personne_id,
            p256dh = EXCLUDED.p256dh,
            secret = EXCLUDED.secret`,
    [p.point, personneId, p.p256dh, p.secret]
  );
}

export async function forgetPush(db: Db, point: string): Promise<void> {
  await db.query("DELETE FROM pousse WHERE point = $1", [point]);
}

export async function pushesOf(db: Db, personneId: string): Promise<PushRow[]> {
  return db.query<PushRow>(
    "SELECT point, p256dh, secret, personne_id FROM pousse WHERE personne_id = $1",
    [personneId]
  );
}

/**
 * Records that a reminder was given, and returns `false` if it already had been.
 *
 * THE INSERT IS THE LOCK. Checking and then writing would let two
 * simultaneous sweeps — a restart in the middle of a send — both through.
 * A duplicate notification is the quickest way to
 * faire couper les notifications.
 */
export async function reminderIsNew(db: Db, personneId: string, subject: string): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO rappel_envoye (personne_id, sujet) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING sujet`,
    [personneId, subject]
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
): Promise<{ epreuve_id: string; titre: string; personne_id: string; quand: string }[]> {
  return db.query(
    `SELECT e.id AS epreuve_id, e.titre, ep.personne_id,
            CASE WHEN e.debut = current_date THEN 'debut' ELSE 'fin' END AS quand
       FROM epreuve e JOIN epreuve_participant ep ON ep.epreuve_id = e.id
      WHERE e.debut = current_date OR e.fin = current_date`
  );
}
