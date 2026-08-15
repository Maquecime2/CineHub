-- ============================================================
-- THE BASELINE — accounts, passkeys, sessions, and a collection
-- ============================================================
--
-- Written in SQL and not derived from an ORM: this file is the
-- description of what the server keeps of somebody, and it is a text one
-- must be able to reread without a tool. It replays without harm —
-- everything in it is conditional.

-- ------------------------------------------------------------
-- THE NAMES THAT CHANGED
-- ------------------------------------------------------------
-- THIS BLOCK IS NOT A TRANSLATION, IT IS A MOVE. The tables and columns
-- below were French, and a database somewhere already holds somebody's
-- collection under those names. Creating the English ones beside them
-- would leave that collection behind, in tables nothing reads any more —
-- so every name is RENAMED, in place, before the rest of the file runs.
--
-- It is conditional twice over: the old name must still exist, and the
-- new one must not. A second run therefore does nothing, and a fresh
-- database walks straight through it.
--
-- It can be deleted once every deployment has been through it once.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('personne', 'person'),
      ('cle_acces', 'access_key'),
      ('defi', 'webauthn_challenge'),
      ('fiche', 'card'),
      ('abonnement', 'follow'),
      ('blocage', 'block'),
      ('signalement', 'report'),
      ('liste', 'list'),
      ('liste_membre', 'list_member'),
      ('liste_item', 'list_item'),
      ('epreuve', 'challenge'),
      ('epreuve_participant', 'challenge_participant'),
      ('mesure', 'metric'),
      ('pousse', 'push_subscription'),
      ('rappel_envoye', 'reminder_sent')
    ) AS t(old, new)
  LOOP
    IF to_regclass(r.old) IS NOT NULL AND to_regclass(r.new) IS NULL THEN
      EXECUTE format('ALTER TABLE %I RENAME TO %I', r.old, r.new);
    END IF;
  END LOOP;

  IF to_regclass('fiche_seq') IS NOT NULL AND to_regclass('card_seq') IS NULL THEN
    EXECUTE 'ALTER SEQUENCE fiche_seq RENAME TO card_seq';
  END IF;

  FOR r IN SELECT * FROM (VALUES
      ('person', 'courriel', 'email'),
      ('person', 'cree_le', 'created_at'),
      ('person', 'vu_le', 'seen_at'),
      ('person', 'partage', 'sharing'),
      ('person', 'jeton', 'token'),
      ('access_key', 'personne_id', 'person_id'),
      ('access_key', 'cle_publique', 'public_key'),
      ('access_key', 'compteur', 'counter'),
      ('access_key', 'appareil', 'device'),
      ('access_key', 'cree_le', 'created_at'),
      ('access_key', 'vue_le', 'seen_at'),
      ('webauthn_challenge', 'valeur', 'value'),
      ('webauthn_challenge', 'personne_id', 'person_id'),
      ('webauthn_challenge', 'expire_le', 'expires_at'),
      ('session', 'empreinte', 'digest'),
      ('session', 'personne_id', 'person_id'),
      ('session', 'cree_le', 'created_at'),
      ('session', 'expire_le', 'expires_at'),
      ('card', 'personne_id', 'person_id'),
      ('card', 'cachee', 'hidden'),
      ('card', 'donnees', 'data'),
      ('card', 'maj_le', 'updated_at'),
      ('card', 'supprimee', 'deleted'),
      ('doc', 'personne_id', 'person_id'),
      ('doc', 'cle', 'key'),
      ('doc', 'contenu', 'content'),
      ('doc', 'maj_le', 'updated_at'),
      ('doc', 'supprime', 'deleted'),
      ('follow', 'suiveur_id', 'follower_id'),
      ('follow', 'suivi_id', 'followed_id'),
      ('follow', 'cree_le', 'created_at'),
      ('block', 'bloqueur_id', 'blocker_id'),
      ('block', 'bloque_id', 'blocked_id'),
      ('block', 'cree_le', 'created_at'),
      ('report', 'auteur_id', 'author_id'),
      ('report', 'cible_type', 'target_type'),
      ('report', 'cible_id', 'target_id'),
      ('report', 'motif', 'reason'),
      ('report', 'cree_le', 'created_at'),
      ('report', 'traite_le', 'handled_at'),
      ('report', 'vise_id', 'about_id'),
      ('list', 'proprietaire_id', 'owner_id'),
      ('list', 'titre', 'title'),
      ('list', 'intention', 'intent'),
      ('list', 'publique', 'is_public'),
      ('list', 'cree_le', 'created_at'),
      ('list', 'maj_le', 'updated_at'),
      ('list_member', 'liste_id', 'list_id'),
      ('list_member', 'personne_id', 'person_id'),
      ('list_member', 'ajoute_le', 'added_at'),
      ('list_item', 'liste_id', 'list_id'),
      ('list_item', 'titre', 'title'),
      ('list_item', 'annee', 'year'),
      ('list_item', 'ajoute_par', 'added_by'),
      ('list_item', 'ajoute_le', 'added_at'),
      ('challenge', 'liste_id', 'list_id'),
      ('challenge', 'cree_par', 'created_by'),
      ('challenge', 'titre', 'title'),
      ('challenge', 'debut', 'starts_on'),
      ('challenge', 'fin', 'ends_on'),
      ('challenge', 'cree_le', 'created_at'),
      ('challenge_participant', 'epreuve_id', 'challenge_id'),
      ('challenge_participant', 'personne_id', 'person_id'),
      ('challenge_participant', 'rejoint_le', 'joined_at'),
      ('metric', 'jour', 'day'),
      ('metric', 'geste', 'gesture'),
      ('push_subscription', 'point', 'endpoint'),
      ('push_subscription', 'personne_id', 'person_id'),
      ('push_subscription', 'cree_le', 'created_at'),
      ('push_subscription', 'vu_le', 'seen_at'),
      ('reminder_sent', 'personne_id', 'person_id'),
      ('reminder_sent', 'sujet', 'subject'),
      ('reminder_sent', 'cree_le', 'created_at')
    ) AS c(tbl, old, new)
  LOOP
    IF to_regclass(r.tbl) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = r.tbl AND column_name = r.old)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = r.tbl AND column_name = r.new)
    THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', r.tbl, r.old, r.new);
    END IF;
  END LOOP;
END $$;

-- The old indexes are DROPPED rather than renamed: every one of them is
-- recreated further down under its new name, and rebuilding an index
-- costs nothing next to the confusion of two names for one thing.
DROP INDEX IF EXISTS cle_acces_personne;
DROP INDEX IF EXISTS defi_expire;
DROP INDEX IF EXISTS session_personne;
DROP INDEX IF EXISTS fiche_suite;
DROP INDEX IF EXISTS fiche_visible;
DROP INDEX IF EXISTS fiche_oeuvre;
DROP INDEX IF EXISTS doc_suite;
DROP INDEX IF EXISTS abonnement_suivi;
DROP INDEX IF EXISTS blocage_bloque;
DROP INDEX IF EXISTS signalement_unique;
DROP INDEX IF EXISTS signalement_a_traiter;
DROP INDEX IF EXISTS liste_proprietaire;
DROP INDEX IF EXISTS liste_membre_personne;
DROP INDEX IF EXISTS epreuve_liste;
DROP INDEX IF EXISTS epreuve_periode;
DROP INDEX IF EXISTS epreuve_participant_personne;
DROP INDEX IF EXISTS pousse_personne;

ALTER TABLE IF EXISTS person DROP CONSTRAINT IF EXISTS personne_partage_check;

-- ------------------------------------------------------------
-- THE PERSON
-- ------------------------------------------------------------
-- No password, no compulsory address: one comes in through a passkey,
-- and the account needs nothing else to exist. The pseudonym is the only
-- public name; it doubles as the address of a shared collection, hence
-- the constraint on its shape.
CREATE TABLE IF NOT EXISTS person (
  id            uuid PRIMARY KEY,
  pseudo        text NOT NULL UNIQUE
                CHECK (pseudo ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'),
  -- Optional, and it will stay that way: it serves only to find again an
  -- account whose every key has been lost. Nowhere else.
  email         text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Erasing an account erases everything hanging under it (ON DELETE
  -- CASCADE everywhere): the right to erasure is not a housekeeping
  -- routine to write later, it is a property of the schema.
  seen_at       timestamptz
);

-- ------------------------------------------------------------
-- SHARING ONE'S COLLECTION
-- ------------------------------------------------------------
-- THE DECISION BELONGS TO THE COLLECTION, NOT TO EACH CARD.
-- "I am showing my film library" is a sentence one says once; laying it
-- down film by film would turn six hundred cards into six hundred
-- decisions, which is to say none.
--
-- Three states and not two, because "public" and "private" do not cover
-- what one really wants to do — show somebody without showing the world:
--   privee   : nobody, ever. That is the default, and it stays so.
--   lien     : whoever has the secret address. It cannot be guessed, it
--              is not indexed, and it is changed in one gesture.
--   publique : the pseudonym is enough.
--
-- THE THREE VALUES STAY FRENCH: they are written into the rows, and into
-- the client that reads them. Translating a stored value is a data
-- migration of its own, and this one buys nothing.
ALTER TABLE IF EXISTS person
  ADD COLUMN IF NOT EXISTS sharing text NOT NULL DEFAULT 'privee';

DO $$ BEGIN
  ALTER TABLE person ADD CONSTRAINT person_sharing_check
    CHECK (sharing IN ('privee', 'lien', 'publique'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The secret behind link sharing. Changing the token revokes every link
-- handed out: it is the only way to take back what one has given.
ALTER TABLE IF EXISTS person
  ADD COLUMN IF NOT EXISTS token text;

-- ------------------------------------------------------------
-- THE ONE ROLE
-- ------------------------------------------------------------
-- THIS FLAG IS NOT SET FROM THE WEB, EVER. It is laid down at start-up
-- from the `ADMINS` environment variable, and no route reads it except to
-- refuse. That is the whole reason it is safe to have at all: a role no
-- request can grant cannot be escalated into, and the only way to become
-- an admin is to have the deployment's environment — which is to say, to
-- be the person who runs the server.
--
-- It buys exactly one thing today: writing quizzes. Everything else in
-- this schema still answers to ownership, which is the right default; a
-- role is a blunt instrument and this one is kept to a single edge.
ALTER TABLE IF EXISTS person
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- LE PALIER
-- ------------------------------------------------------------
-- Ce qu'un compte a le droit d'occuper chez nous. Il ne décide de rien
-- d'autre : les fonctionnalités sont les mêmes des deux côtés, ce sont
-- les BORNES qui changent — voir `src/limits.ts`, qui les tient toutes.
--
-- DANS LE SCHÉMA ET NON DANS UNE ROUTE, comme le reste de ce qui protège
-- ou autorise quelqu'un. Une route qui accorderait un palier serait une
-- route à protéger, et il n'y en a pas : la colonne s'écrit à la main
-- tant que la facturation n'existe pas, et c'est elle que la facturation
-- écrira le jour venu.
--
-- LE DÉFAUT EST `free`, ce qui veut dire que le palier généreux se donne
-- explicitement. Un défaut à `plus` aurait ouvert les vannes à tout
-- compte créé pendant que le paiement est en panne.
ALTER TABLE IF EXISTS person
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

ALTER TABLE IF EXISTS person DROP CONSTRAINT IF EXISTS person_plan_check;
ALTER TABLE IF EXISTS person
  ADD CONSTRAINT person_plan_check CHECK (plan IN ('free', 'plus'));

-- ------------------------------------------------------------
-- LES IMPORTS, ET COMBIEN ON EN A FAIT
-- ------------------------------------------------------------
-- Un import Letterboxd de six cents films, c'est six cents interrogations
-- du relais TMDB : c'est le geste le plus cher du produit, et le seul
-- qu'on puisse répéter en boucle sans y penser.
--
-- ON COMPTE À LA CONFIRMATION, PAS AU DÉPÔT DU FICHIER. Déposer un
-- bordereau pour voir ce qu'il contient ne coûte rien et ne doit rien
-- coûter ; ce qui compte est l'écriture dans la collection. Quelqu'un qui
-- dépose trois fichiers avant de se décider n'a pas fait trois imports.
--
-- UNE LIGNE PAR IMPORT, et pas un compteur qu'on incrémente : on veut la
-- fenêtre glissante de trente jours, donc les DATES. Un compteur remis à
-- zéro le premier du mois donnerait deux imports à cheval sur deux jours.
CREATE TABLE IF NOT EXISTS import_run (
  id            uuid PRIMARY KEY,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  ran_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_run_window ON import_run(person_id, ran_at DESC);

-- ------------------------------------------------------------
-- THE PASSKEY
-- ------------------------------------------------------------
-- What the browser keeps is a pair of keys; what the server keeps is the
-- PUBLIC one — useless to whoever steals it. There is therefore nothing
-- here that lets anyone pass for somebody else, and that is the whole
-- point compared with a password hash.
--
-- Several keys per person, deliberately: a phone, a computer, a physical
-- key. Having only one means losing one's account with one's phone.
CREATE TABLE IF NOT EXISTS access_key (
  id            text PRIMARY KEY,               -- the identifier the authenticator supplies
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  public_key    bytea NOT NULL,
  -- THE ANTI-CLONING COUNTER. The authenticator increments it on every
  -- signature; a counter that goes backwards denounces a copy of the
  -- key. Some authenticators leave it at zero: the check is therefore
  -- not a refusal, but a signal.
  counter       bigint NOT NULL DEFAULT 0,
  transports    text[] NOT NULL DEFAULT '{}',
  device        text,                            -- what the person wrote to tell them apart
  created_at    timestamptz NOT NULL DEFAULT now(),
  seen_at       timestamptz
);

CREATE INDEX IF NOT EXISTS access_key_person ON access_key(person_id);

-- ------------------------------------------------------------
-- THE CHALLENGE IN FLIGHT
-- ------------------------------------------------------------
-- A WebAuthn ceremony happens in two moves, and the randomness drawn in
-- the first must be found again in the second — WITHOUT the client
-- getting to choose it, or the signature proves nothing any more. So it
-- lives here, for a few minutes.
--
-- IT IS CALLED `webauthn_challenge` AND NOT `challenge`, because the
-- screen has challenges of its own — a list plus a period, further down.
-- Two tables of opposite meaning under one name read badly and get
-- confused on the night something breaks.
CREATE TABLE IF NOT EXISTS webauthn_challenge (
  id            uuid PRIMARY KEY,
  value         text NOT NULL,
  -- A sign-up has no person yet: the column is null.
  person_id     uuid REFERENCES person(id) ON DELETE CASCADE,
  pseudo        text,
  expires_at    timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS webauthn_challenge_expires ON webauthn_challenge(expires_at);

-- ------------------------------------------------------------
-- THE SESSION
-- ------------------------------------------------------------
-- The cookie does NOT carry the session identifier as it stands: it
-- carries a secret of which the table keeps only the digest. A leak of
-- the database therefore hands over no usable session — the same
-- reasoning as for passwords, applied to what replaces them.
CREATE TABLE IF NOT EXISTS session (
  digest        text PRIMARY KEY,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS session_person ON session(person_id);

-- ------------------------------------------------------------
-- THE COLLECTION
-- ------------------------------------------------------------
-- ONE ROW PER CARD, and not one document per person. That is what will
-- allow pushing only what has moved: `updated_at` is the date the client
-- already holds (`updatedAt`), and the index carrying it is the one
-- synchronisation will question.
--
-- `data` as jsonb: the card is an object belonging to the client, and the
-- server has no reason to know its thirty fields. What it does need to
-- know it pulls out into columns — the work's identity and the
-- visibility, because those are the only two things it will have to
-- filter on.
-- TWO CLOCKS, AND TWO ROLES NOT TO BE CONFUSED.
--
-- `updated_at` comes from the CLIENT: it says when the card was touched,
-- and it is what arbitrates between two versions.
--
-- `seq` comes from the SERVER: an arrival number, rising, that depends on
-- no clock. It is THAT one synchronisation follows to know where it has
-- got to.
--
-- Merging the two looked economical and was not: a phone an hour behind
-- pushes cards dated an hour earlier, and the other device, asking for
-- "what has moved since now", would NEVER see them. They would be filed
-- on the server, invisible to everyone, with no error to say so.
CREATE SEQUENCE IF NOT EXISTS card_seq;

CREATE TABLE IF NOT EXISTS card (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  -- The identifier comes from the client (UUID v7): IT names its own
  -- cards, the server only files them under an account.
  id            text NOT NULL,
  seq           bigint NOT NULL DEFAULT nextval('card_seq'),
  tmdb_id       text,
  -- "This one does not go out, even when I share." An exclusion, and not
  -- a per-card visibility: the decision to show belongs to the
  -- collection (see `person.sharing`), and this is only its exception.
  -- False by default — whoever shares their film library shares it, they
  -- do not tick six hundred boxes.
  hidden        boolean NOT NULL DEFAULT false,
  data          jsonb NOT NULL,
  updated_at    timestamptz NOT NULL,
  -- A deletion SYNCHRONISES: erasing the row would bring the card back
  -- at the next send from the device that does not know yet. So we keep
  -- a tombstone, to be swept later.
  deleted       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (person_id, id)
);

-- WHAT `CREATE TABLE IF NOT EXISTS` DOES NOT DO.
--
-- On a database where the table already exists, it does NOTHING — not
-- even add a column that has appeared since. The baseline therefore
-- described the schema we wanted while leaving existing databases
-- behind, and the server refused to start on the only one that held
-- anything.
--
-- The tests could not see it: they start from an empty database, where
-- the creation covers everything. It took starting on a real, already
-- populated one. Every column added after the fact is therefore laid
-- down here, as an ALTER, as conditional as the rest.
ALTER TABLE IF EXISTS card
  ADD COLUMN IF NOT EXISTS seq bigint NOT NULL DEFAULT nextval('card_seq');

ALTER TABLE IF EXISTS card
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- `visibilite` never carried anything but its default value: the client
-- never filled it in, and the decision to share turned out to belong to
-- the whole collection. A dead column is taken out; one does not keep it
-- "just in case".
ALTER TABLE IF EXISTS card DROP COLUMN IF EXISTS visibilite;

-- Synchronisation's index: "what has moved since", in the order the
-- server received it.
CREATE INDEX IF NOT EXISTS card_stream ON card(person_id, seq);
-- What a shared collection shows: everything but the exclusions.
CREATE INDEX IF NOT EXISTS card_visible ON card(person_id) WHERE NOT hidden AND NOT deleted;

-- ------------------------------------------------------------
-- THE REST OF THE BINDER
-- ------------------------------------------------------------
-- A film library is not only a list of films: it is also the arrangement
-- of the shelves, the notebook's pages, the threads strung between
-- works, the vocabulary one has written and the decors one has laid.
-- Synchronising the cards alone gives a second device that knows the
-- films and no longer knows how they were filed — half the binder, and
-- not the less personal half.
--
-- A TABLE OF ITS OWN, AND NOT ONE MORE COLUMN ON `card`: these documents
-- are not cards, they have neither a work's identity nor a visibility,
-- and they will never be shared the same way. They do follow exactly the
-- same synchronisation rules, though — server rank, client date, last
-- writer wins.
CREATE SEQUENCE IF NOT EXISTS doc_seq;

CREATE TABLE IF NOT EXISTS doc (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  -- The client's key: "shelf-view:abc", "notebook-notes", "threads"…
  key           text NOT NULL,
  seq           bigint NOT NULL DEFAULT nextval('doc_seq'),
  content       jsonb NOT NULL,
  updated_at    timestamptz NOT NULL,
  deleted       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (person_id, key)
);

CREATE INDEX IF NOT EXISTS doc_stream ON doc(person_id, seq);

-- ------------------------------------------------------------
-- FOLLOWING SOMEBODY
-- ------------------------------------------------------------
-- A ONE-WAY link, and deliberately so: following is not a friend
-- request, it is a gesture one makes alone and undoes alone. Nobody has
-- to accept, nobody has to refuse, and so there is no notification to
-- put up with.
--
-- One can only follow a PUBLIC collection — the filter is in the read,
-- not here: somebody who closes up must not lose their followers, only
-- disappear from their feed for as long as they stay silent.
CREATE TABLE IF NOT EXISTS follow (
  follower_id   uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  followed_id   uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  -- Following oneself would fill one's own feed with what one has just
  -- written. The database refuses it rather than the route.
  CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS follow_followed ON follow(followed_id);

-- ------------------------------------------------------------
-- NOT SEEING SOMEBODY ANY MORE
-- ------------------------------------------------------------
-- Blocking is the necessary counterpart to the first thing this binder
-- publishes: as soon as a text written by a stranger can appear under a
-- film one loves, one must be able to silence it without waiting for a
-- moderator to wake up.
--
-- IT IS DECLARED ON ONE SIDE AND ACTS ON BOTH. Blocking somebody takes
-- them out of what I see, AND takes me out of what they see: a block
-- that cut only one way leaves the other free to keep reading, replying
-- and starting again. The reads therefore question this table both ways
-- (`OR`), and never one way only.
--
-- What it does NOT do: hide a public collection from whoever knows its
-- address. A block is not a wall, it is a silence — pretending otherwise
-- would give a false sense of safety.
CREATE TABLE IF NOT EXISTS block (
  blocker_id    uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  blocked_id    uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS block_blocked ON block(blocked_id);

-- ------------------------------------------------------------
-- THE REPORT
-- ------------------------------------------------------------
-- Empty as long as nothing is public, and laid down all the same: a
-- reports table added after the fact always arrives on the day one needs
-- it immediately.
CREATE TABLE IF NOT EXISTS report (
  id            uuid PRIMARY KEY,
  author_id     uuid REFERENCES person(id) ON DELETE SET NULL,
  target_type   text NOT NULL,
  target_id     text NOT NULL,
  reason        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  handled_at    timestamptz
);

-- THE ONE REPORTED ABOUT IS A COLUMN, NOT A DEDUCTION. `target_id` names
-- a card; finding its owner would mean reading it again, and a card
-- erased in the meantime would carry off with it the only thing that
-- made the report usable. So we write down who is aimed at, at the
-- moment of reporting.
ALTER TABLE IF EXISTS report
  ADD COLUMN IF NOT EXISTS about_id uuid REFERENCES person(id) ON DELETE CASCADE;

-- Reporting the same thing twice is the same gesture: the second time
-- must not swell a moderation queue a human will have to read.
CREATE UNIQUE INDEX IF NOT EXISTS report_unique
  ON report(author_id, target_type, target_id)
  WHERE author_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS report_to_handle ON report(created_at) WHERE handled_at IS NULL;

-- ------------------------------------------------------------
-- WHAT IS SAID ABOUT A WORK
-- ------------------------------------------------------------
-- THERE IS NO REVIEWS TABLE, and that is the decision of this whole
-- stage. A review already exists: it is in its author's card,
-- `data->>'review'`, and it has synchronised there since phase 4.
-- Copying it elsewhere in order to "publish" it would create two truths
-- that would diverge at the first oversight — a review corrected at home
-- and left wrong in public is exactly the fault we do not want.
--
-- Publishing is therefore not one more gesture: it is the consequence of
-- the sharing already chosen. What was missing was not somewhere to
-- write, but an index to read BACKWARDS — no longer "this person's
-- films" but "the people who have seen this film".
CREATE INDEX IF NOT EXISTS card_work
  ON card(tmdb_id) WHERE tmdb_id IS NOT NULL AND NOT hidden AND NOT deleted;

-- ------------------------------------------------------------
-- THE LISTS
-- ------------------------------------------------------------
-- A list does NOT contain cards: it contains works. The difference
-- decides everything. A list of cards would be a list of somebody's own
-- copies — it would mean nothing at somebody else's, and would empty
-- itself the day its author erased a card. `tmdb_id` is therefore the
-- only key, as for the echo of works, and the title is kept as a
-- SNAPSHOT only: enough to show the list to somebody who has neither the
-- film nor the TMDB key.
CREATE TABLE IF NOT EXISTS list (
  id            uuid PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  intent        text NOT NULL DEFAULT '',
  -- Closed by default, like everything else in this project.
  is_public     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS list_owner ON list(owner_id);

-- CO-BUILDING IS A RIGHT TO WRITE, NOT SHARED OWNERSHIP.
-- Somebody adds and removes works; they do not rename the list, do not
-- make it public and do not erase it. Without that asymmetry, a list
-- built by six hands has nobody left to answer for it.
CREATE TABLE IF NOT EXISTS list_member (
  list_id       uuid NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, person_id)
);

CREATE INDEX IF NOT EXISTS list_member_person ON list_member(person_id);

CREATE TABLE IF NOT EXISTS list_item (
  list_id       uuid NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  tmdb_id       text NOT NULL,
  title         text NOT NULL DEFAULT '',
  year          text,
  -- Who put it there. `SET NULL` and not `CASCADE`: somebody who leaves
  -- must not carry off the list six people have built.
  added_by      uuid REFERENCES person(id) ON DELETE SET NULL,
  added_at      timestamptz NOT NULL DEFAULT now(),
  -- The same work twice is the same work: the key says so, rather than a
  -- check in a route we will forget somewhere else.
  PRIMARY KEY (list_id, tmdb_id)
);

-- ------------------------------------------------------------
-- THE CHALLENGES
-- ------------------------------------------------------------
-- A CHALLENGE IS A LIST PLUS A PERIOD, and nothing else. It does not
-- duplicate its works: it points at the list, which can go on living. A
-- challenge whose list grows along the way is a challenge that grows,
-- and that is the wanted behaviour — these are people setting each other
-- something, not a contract.
CREATE TABLE IF NOT EXISTS challenge (
  id            uuid PRIMARY KEY,
  list_id       uuid NOT NULL REFERENCES list(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES person(id) ON DELETE SET NULL,
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  starts_on     date NOT NULL,
  ends_on       date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- A challenge that ends before it begins does not exist. The database
  -- refuses it, rather than the route that creates it.
  CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS challenge_list ON challenge(list_id);
CREATE INDEX IF NOT EXISTS challenge_period ON challenge(ends_on);

-- ONE DOES NOT TAKE PART WITHOUT HAVING SAID SO. Automatically counting
-- every follower of a public list would make each challenge a
-- measurement on people who asked for nothing — and a challenge's
-- progress is deduced from the screening log, which is private. Entering
-- is therefore an explicit gesture, and so is leaving.
CREATE TABLE IF NOT EXISTS challenge_participant (
  challenge_id  uuid NOT NULL REFERENCES challenge(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, person_id)
);

CREATE INDEX IF NOT EXISTS challenge_participant_person ON challenge_participant(person_id);

-- ------------------------------------------------------------
-- THE QUIZZES — A BANK, AND DRAWS MADE FROM IT
-- ------------------------------------------------------------
-- A CHALLENGE MEASURES WHAT ONE WATCHES; A QUIZ MEASURES WHAT ONE KNOWS.
--
-- THE SHAPE THAT MATTERS: NOBODY COMPOSES A QUIZ BY HAND. An admin fills
-- a BANK — categories, and questions inside them, each classed easy,
-- middling or hard. Anybody then DRAWS a quiz out of it: a few
-- categories, a level, a length, and the server deals the questions.
--
-- Writing a quiz question by question was the first shape and it was
-- worse in a way worth remembering: whoever wrote a quiz could never
-- play it, and every evening cost somebody an hour of writing. A bank is
-- filled once and dealt from for years.
--
-- THE DRAW IS FROZEN, and that is what makes a score worth comparing.
-- The questions are chosen once, at creation, and written into
-- `quiz_draw`; everybody invited answers those, in that order. Drawing
-- afresh per player would have made two scores incomparable, which is
-- the only thing this whole feature is for.

-- THE OLD SHAPE, TAKEN DOWN. `quiz_question` used to hang off a quiz and
-- carry its own `points`; it now hangs off a category and carries a
-- difficulty instead. There is no sensible column-by-column migration
-- between the two — the rows meant something else — and the shape never
-- left this branch, so it is dropped rather than mended. The condition
-- is the old column: a database that never saw it walks straight past.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'quiz_question' AND column_name = 'quiz_id') THEN
    DROP TABLE IF EXISTS quiz_answer, quiz_attempt, quiz_player,
                         quiz_choice, quiz_question, quiz CASCADE;
  END IF;
END $$;

-- WHAT A QUESTION IS WORTH, IN ONE PLACE. The points are no longer typed
-- in: they follow the difficulty, so a question cannot be easy and worth
-- ten. Two quizzes of the same level and length therefore weigh exactly
-- the same, which is the arithmetic behind "these scores are
-- comparable". Written as a function because the scoreboard is not the
-- only thing that will ever want to know.
CREATE OR REPLACE FUNCTION quiz_points(difficulty text) RETURNS int
  LANGUAGE sql IMMUTABLE AS
  $$ SELECT CASE difficulty WHEN 'easy' THEN 1 WHEN 'hard' THEN 3 ELSE 2 END $$;

CREATE TABLE IF NOT EXISTS quiz_category (
  id            uuid PRIMARY KEY,
  label         text NOT NULL UNIQUE CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  blurb         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- THE BANK. A question belongs to a category and to nobody: it is not
-- owned, it is stock. Erasing the account that typed it in leaves it
-- standing — the opposite would empty everybody's future evenings the
-- day an admin left.
CREATE TABLE IF NOT EXISTS quiz_question (
  id            uuid PRIMARY KEY,
  category_id   uuid NOT NULL REFERENCES quiz_category(id) ON DELETE CASCADE,
  ask           text NOT NULL CHECK (length(btrim(ask)) BETWEEN 1 AND 400),
  -- Shown once the answer is in, never before.
  hint          text NOT NULL DEFAULT '',
  -- Either a TMDB poster URL or a blob path under `bank/<category id>/…`.
  -- Both are strings and neither is trusted: whoever renders it treats it
  -- as an address, not as markup.
  image         text,
  difficulty    text NOT NULL DEFAULT 'normal'
                CHECK (difficulty IN ('easy', 'normal', 'hard')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_question_stock ON quiz_question(category_id, difficulty);

CREATE TABLE IF NOT EXISTS quiz_choice (
  id            uuid PRIMARY KEY,
  question_id   uuid NOT NULL REFERENCES quiz_question(id) ON DELETE CASCADE,
  rank          int NOT NULL,
  label         text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  is_right      boolean NOT NULL DEFAULT false,
  UNIQUE (question_id, rank)
);

-- A QUIZ IS NOW A DRAW: who dealt it, out of what, and how it came out.
-- It holds no question of its own — `quiz_draw` names them.
CREATE TABLE IF NOT EXISTS quiz (
  id            uuid PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  level         text NOT NULL DEFAULT 'normal'
                CHECK (level IN ('easy', 'normal', 'hard')),
  -- Three formats and not a free number: the mix falls on whole
  -- questions at 10, 20 and 30, and it is one decision fewer to make
  -- when somebody just wants to start an evening.
  size          int NOT NULL CHECK (size IN (10, 20, 30)),
  -- TRUE when the bank could not fill the mix asked for and a
  -- neighbouring level was used instead. Kept on the row rather than
  -- recomputed, because the bank moves and the reason must stay true:
  -- "a little gentler than asked, there were not enough hard ones" has
  -- to go on being sayable a month later.
  softened      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_owner ON quiz(owner_id);

-- What was asked for, kept for the telling. `SET NULL`-like behaviour is
-- not wanted here: if a category goes, the quiz keeps its questions —
-- they are named in `quiz_draw` — and merely stops being able to say
-- which basket they came from.
CREATE TABLE IF NOT EXISTS quiz_topic (
  quiz_id       uuid NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES quiz_category(id) ON DELETE CASCADE,
  PRIMARY KEY (quiz_id, category_id)
);

-- THE DEAL ITSELF, and the reason a score means something: the same
-- questions, in the same order, for everybody invited.
--
-- `ON DELETE RESTRICT` on the question, and it is deliberate: erasing a
-- question out of the bank must NOT quietly shorten a quiz somebody is
-- in the middle of playing, nor rewrite a score already made. The bank
-- withdraws a question by refusing to deal it again — see
-- `retired_at` — not by taking it out of the past.
CREATE TABLE IF NOT EXISTS quiz_draw (
  quiz_id       uuid NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES quiz_question(id) ON DELETE RESTRICT,
  rank          int NOT NULL,
  PRIMARY KEY (quiz_id, question_id),
  UNIQUE (quiz_id, rank)
);

-- Withdrawn from the bank: never dealt again, still readable in the
-- quizzes that already hold it.
ALTER TABLE IF EXISTS quiz_question
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

-- THE INVITATION, exactly as `list_member` is one: named people, and
-- nobody else. A quiz has no public leaderboard by design — the scores
-- one compares are the scores of people one invited.
CREATE TABLE IF NOT EXISTS quiz_player (
  quiz_id       uuid NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, person_id)
);

CREATE INDEX IF NOT EXISTS quiz_player_person ON quiz_player(person_id);

-- ONE ATTEMPT, AND THE PRIMARY KEY IS WHAT SAYS SO. "Once it is done you
-- cannot do it again" is the rule that makes a score mean anything, and
-- it is the kind of rule that a route enforces right up until the day a
-- second route forgets to. Here a replayed request changes nothing,
-- because there is no second row to have.
--
-- `finished_at` NULL is the other half of the request: one answers when
-- one feels like it, over as many sittings as one likes, and the count of
-- answers says where one had got to.
CREATE TABLE IF NOT EXISTS quiz_attempt (
  quiz_id       uuid NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  PRIMARY KEY (quiz_id, person_id)
);

CREATE TABLE IF NOT EXISTS quiz_answer (
  quiz_id       uuid NOT NULL,
  person_id     uuid NOT NULL,
  question_id   uuid NOT NULL,
  choice_id     uuid NOT NULL REFERENCES quiz_choice(id) ON DELETE CASCADE,
  answered_at   timestamptz NOT NULL DEFAULT now(),
  -- Answering twice is answering once: no taking it back after seeing the
  -- correction, and the key is what refuses it rather than a route.
  PRIMARY KEY (quiz_id, person_id, question_id),
  FOREIGN KEY (quiz_id, person_id)
    REFERENCES quiz_attempt(quiz_id, person_id) ON DELETE CASCADE,
  -- AND THE QUESTION MUST BE ONE THIS QUIZ WAS DEALT. Pointing at
  -- `quiz_question` would have let somebody answer a question out of the
  -- bank that their quiz never held; the key points at the DEAL instead,
  -- so the impossible request has no row to land in.
  FOREIGN KEY (quiz_id, question_id)
    REFERENCES quiz_draw(quiz_id, question_id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- THE PAIRING CODES
-- ------------------------------------------------------------
-- A PASSKEY IS SIGNED FOR A DOMAIN, and that is what makes it
-- unphishable — but it is also what shuts an account inside one machine.
-- On `localhost` each computer IS its own domain, so the QR ceremony
-- cannot help there at all: the two machines have no domain in common to
-- sign for.
--
-- So there is a second door, and it does not go through WebAuthn. The
-- machine already signed in makes a short code; the other one types it
-- and gets a session. From there the ordinary synchronisation brings
-- everything back, and the new machine registers a passkey of its own.
--
-- WHAT MAKES A SHORT CODE ACCEPTABLE, since it is worth an account:
--   - it is consumed ONCE (`DELETE … RETURNING`, atomically);
--   - only its DIGEST is kept, as for sessions: a leak of this table
--     hands over nothing usable;
--   - the claim route is rate limited, which is what makes guessing a
--     fifty-bit code hopeless rather than merely unlikely;
--   - and it expires, the row carrying its own date.
--
-- THE LIFE IS A WEEK, and it is the one figure here that was chosen for
-- the hand rather than for the arithmetic: pairing a second computer is
-- not done in the ten minutes after thinking of it, and a code already
-- dead by the time one sits down at the other machine is a code asked
-- for three times over. The week is bought from the four guards above —
-- so none of them may be relaxed later on the grounds that a code is
-- "only" a short string.
CREATE TABLE IF NOT EXISTS pairing_code (
  digest        text PRIMARY KEY,           -- sha256 of the code
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS pairing_code_stale ON pairing_code(expires_at);

-- ------------------------------------------------------------
-- THE DECORATION OBJECTS
-- ------------------------------------------------------------
-- A DECOR IS AN OBJECT, NOT A PRIVATE MEDIUM OF ONE MORE KIND, and this
-- table is what makes the difference real.
--
-- Everything else somebody uploads — an imported poster, a screenshot —
-- belongs to that person alone, and the blob's path says so: `p/<person
-- id>/…`, and a ticket is only ever issued for one's own prefix. That is
-- the simplest guarantee in the whole system, and we do not want to lose
-- it.
--
-- A decor is not like that. It outlives the card that saw it made, and
-- it may be READ BY SOMEBODY ELSE. Filed under a private prefix, the day
-- of sharing would have meant issuing tickets on other people's private
-- prefix — so decors live under `decor/<id>` instead, and THE RIGHT TO
-- READ ONE IS NOT DEDUCED FROM ITS PATH: it is read here.
--
-- The blob itself is not in this table. Only what is needed in order to
-- name the object, to show it in a list, and to decide who may fetch it.
CREATE TABLE IF NOT EXISTS decor (
  id            uuid PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  label         text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  -- Which wall it was drawn for; free text, the client's vocabulary.
  wall          text NOT NULL DEFAULT '',
  -- An SVG is injected inline by the client and can therefore be
  -- hostile; a raster cannot. The two are not handled alike over there,
  -- so the difference is stated here rather than guessed from the blob.
  kind          text NOT NULL DEFAULT 'raster' CHECK (kind IN ('raster','svg')),
  tintable      boolean NOT NULL DEFAULT false,
  bytes         integer NOT NULL DEFAULT 0,
  -- Closed by default, like the lists and like everything else here.
  -- The word is `is_public` and not a third régime of visibility beside
  -- `person.sharing`: one vocabulary, already used by `list`.
  is_public     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- A tombstone, as for `card` and `doc`: erasing a row a copy points at
  -- would take the piece back from those who adopted it.
  deleted       boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS decor_owner ON decor(owner_id);
CREATE INDEX IF NOT EXISTS decor_public ON decor(created_at) WHERE is_public AND NOT deleted;

-- "I TOOK THIS ONE FROM SOMEBODY." And having taken it, one keeps it:
-- this row is what gives a lasting right to read, even after the author
-- has put the piece back to private. One does not take back what one has
-- given — a shelf that empties itself because somebody elsewhere changed
-- their mind is a shelf one stops trusting.
CREATE TABLE IF NOT EXISTS decor_copy (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  decor_id      uuid NOT NULL REFERENCES decor(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, decor_id)
);

CREATE INDEX IF NOT EXISTS decor_copy_decor ON decor_copy(decor_id);

-- ------------------------------------------------------------
-- LE REGISTRE DES MÉDIAS — ce qu'on ne pouvait pas compter
-- ------------------------------------------------------------
-- LE SERVEUR NE VOIT JAMAIS LES OCTETS. Il délivre un ticket signé et le
-- navigateur dépose directement dans le container : c'est ce qui permet
-- de ne jamais faire transiter une affiche par nous, et c'est aussi ce
-- qui rendait le dépôt privé RIGOUREUSEMENT SANS BORNE. Sur une adresse
-- ouverte, une place illimitée qu'on héberge est une facture illimitée.
--
-- Cette table est donc le registre de ce qui a été autorisé. Elle ne
-- garde pas le blob, seulement son chemin et ce que le client déclare
-- peser.
--
-- LA CLÉ PRIMAIRE FAIT TOUT LE TRAVAIL, et c'est le même raisonnement
-- que l'unicité de `merit_event` : redemander un ticket pour le MÊME
-- chemin ne crée pas une seconde ligne. Un compteur incrémenté à chaque
-- ticket aurait compté six fois une affiche qu'on redépose six fois, et
-- le plafond serait devenu une punition pour qui synchronise souvent.
--
-- LE COMPTE EST DONC CELUI DES CHEMINS AUTORISÉS, et non celui des blobs
-- réellement présents : un ticket qu'on ne se sert pas laisse une ligne.
-- L'écart est borné et il penche du bon côté — on refuse un peu tôt
-- plutôt qu'un peu tard —, et `DELETE /media` retire la ligne avec le
-- blob, donc il se referme dès qu'on range.
CREATE TABLE IF NOT EXISTS media (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  -- Le chemin complet, préfixe compris : c'est lui la preuve côté
  -- privé, et le garder entier évite d'avoir à le reconstruire.
  path          text NOT NULL,
  -- Déclaré par le client, donc indicatif — le plafond qui protège
  -- vraiment est celui du NOMBRE, qu'on sait compter exactement.
  bytes         integer NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  noted_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, path)
);

-- ------------------------------------------------------------
-- THE USAGE MEASUREMENT
-- ------------------------------------------------------------
-- WHAT IT DOES NOT CONTAIN IS ITS DEFINITION. No person identifier, no
-- IP address, no browser, no time of day: one counter per DAY and per
-- GESTURE, and nothing that allows somebody's day to be recomposed. We
-- measure to know whether the server holds up and what gets used, not to
-- know who does what.
--
-- The consequence is accepted: these figures will never answer "how many
-- active people". Answering that would need exactly what we refuse to
-- keep.
CREATE TABLE IF NOT EXISTS metric (
  day           date NOT NULL DEFAULT current_date,
  gesture       text NOT NULL,
  n             bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, gesture)
);

-- ------------------------------------------------------------
-- THE PUSH NOTIFICATIONS
-- ------------------------------------------------------------
-- A push subscription belongs to a DEVICE, not to a person: the same
-- account on a phone and on a computer makes two rows, and closing one
-- must not silence the other.
--
-- `secret` and `p256dh` are the keys the browser gives so the message can
-- be encrypted — IT makes them, and the server can do nothing with them
-- but push towards that one point.
CREATE TABLE IF NOT EXISTS push_subscription (
  endpoint      text PRIMARY KEY,           -- the push service's endpoint
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  p256dh        text NOT NULL,
  secret        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- A send refused by the push service (410) means the subscription is
  -- dead: we erase it rather than retry every day until the end of time.
  seen_at       timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscription_person ON push_subscription(person_id);

-- WHAT HAS ALREADY BEEN SAID IS NOT SAID AGAIN. Without this table, a
-- sweep that runs twice — a restart, a server brought back up — sends the
-- same reminder twice. A duplicate notification is the fastest way to
-- get notifications switched off.
CREATE TABLE IF NOT EXISTS reminder_sent (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  subject       text NOT NULL,              -- "challenge:<id>:end", for instance
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, subject)
);

-- ------------------------------------------------------------
-- THE MERIT AND THE TOKENS
-- ------------------------------------------------------------
-- A JOURNAL, NOT A BALANCE. A balance one cannot rebuild is a balance one
-- cannot repair: the day a figure is wrong — and one will be — the only
-- way back is to add the rows again and see what comes out.
--
-- TWO COUNTERS, AND ONE OF THEM NEVER GOES DOWN. `merit` is what one has
-- earned since the beginning and it makes the ranking; `tokens` is the
-- same figure minus what one has spent at the counter. Buying a thing
-- must never cost a place in the leaderboard, or the shop becomes a
-- punishment and nobody opens it twice.
--
-- THE IDEMPOTENCE IS IN THE KEY. `kind` plus `ref` names the FACT that
-- paid: a challenge settled, an attempt finished, a screening of one film
-- on one day. Replaying the request does not pay twice, because there is
-- no second row to have — the same guarantee `quiz_attempt` gets from its
-- primary key. No route has to remember to check.
CREATE TABLE IF NOT EXISTS merit_event (
  id            uuid PRIMARY KEY,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  ref           text NOT NULL,
  merit         int NOT NULL CHECK (merit >= 0),
  tokens        int NOT NULL CHECK (tokens >= 0),
  -- The day, and not the instant, because the daily ceiling on what one
  -- merely DECLARES is counted by day. An index on a timestamp would
  -- have made that count a scan.
  earned_on     date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, kind, ref)
);

CREATE INDEX IF NOT EXISTS merit_event_person ON merit_event(person_id);
CREATE INDEX IF NOT EXISTS merit_event_day ON merit_event(person_id, earned_on);

-- THE SPENDING IS ANOTHER JOURNAL, and it cannot give merit back. The
-- CHECK says so rather than a route saying it, which is the difference
-- between a rule and a habit.
CREATE TABLE IF NOT EXISTS token_spend (
  id            uuid PRIMARY KEY,
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  item_id       text NOT NULL,
  tokens        int NOT NULL CHECK (tokens > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_spend_person ON token_spend(person_id);

-- THE PURSE IS A CACHE, AND IT SAYS SO. It exists for one reason: the
-- ranking sorts on merit, and sorting on a SUM() over the whole journal
-- brings the table to its knees at the thousandth row.
--
-- It is written ONLY by the two statements that write the journals, in
-- the same instruction, so it is never behind.
--
-- AND `CHECK (tokens >= 0)` IS THE OVERDRAFT GUARD. A purchase is one
-- transaction: the spending is inserted and the purse is decremented
-- together. If the balance would go under, the constraint fails and the
-- WHOLE transaction is undone, the spending row included. There is no
-- intermediate state in which somebody has been charged for nothing —
-- and no route had to be careful about it.
CREATE TABLE IF NOT EXISTS purse (
  person_id     uuid PRIMARY KEY REFERENCES person(id) ON DELETE CASCADE,
  merit         int NOT NULL DEFAULT 0 CHECK (merit >= 0),
  tokens        int NOT NULL DEFAULT 0 CHECK (tokens >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purse_ladder ON purse(merit DESC, person_id);

-- ------------------------------------------------------------
-- WHO APPEARS IN A RANKING
-- ------------------------------------------------------------
-- A COLUMN OF ITS OWN, AND NOT `person.sharing`. "I show my collection"
-- and "I compete in public" are not the same sentence, and `lien` — a
-- collection reachable by whoever holds the address — is not a public
-- name at all. Folding the two together would have published a pseudonym
-- on the strength of a decision taken about something else.
--
-- The default is `suivis` and not `non`: following somebody is already a
-- consented tie, and a friends' ranking that is empty on the first day is
-- one nobody ever comes back to. `tous` is the only opt-in to the world.
ALTER TABLE IF EXISTS person
  ADD COLUMN IF NOT EXISTS ladder text NOT NULL DEFAULT 'suivis';

DO $$ BEGIN
  ALTER TABLE person ADD CONSTRAINT person_ladder_check
    CHECK (ladder IN ('non', 'suivis', 'tous'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- THE COUNTER — what one owns, and what one wears
-- ------------------------------------------------------------
-- THE CATALOGUE IS NOT HERE. It lives in `src/shop.ts`, in TypeScript,
-- because it is product CONTENT: it must be read in a review, it takes no
-- concurrent write, and a table would have meant an admin screen to
-- write for nobody. What belongs in the database is what people OWN —
-- and there the schema does the guarding.

-- One owns a thing once. The key refuses the second purchase; no route
-- has to look first.
CREATE TABLE IF NOT EXISTS owned (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  item_id       text NOT NULL,
  got_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, item_id)
);

-- STICKERS ARE COLLECTED, SO THEY ARE COUNTED. A double is not an error
-- to be swallowed: it is the thing one swaps, and it has to be visible.
CREATE TABLE IF NOT EXISTS sticker (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  sticker_id    text NOT NULL,
  copies        int NOT NULL DEFAULT 1 CHECK (copies > 0),
  first_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, sticker_id)
);

-- POWERS ARE SPENT. The CHECK is what stops somebody playing one they do
-- not have: the decrement carries `left_over > 0` in its own WHERE, and
-- a statement that touches no row is the refusal. Reading then writing
-- would have left a gap between the two.
CREATE TABLE IF NOT EXISTS power (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('halve', 'redo', 'extend')),
  left_over     int NOT NULL DEFAULT 0 CHECK (left_over >= 0),
  PRIMARY KEY (person_id, kind)
);

-- WHAT ONE WEARS: two columns, not a table. One wears a single stamp and
-- a single skin, and a table with a one-row primary key is a table too
-- many. NULL means nothing worn, which is everybody's case to begin with.
--
-- `skin` is only here so a choice can be found again on another machine.
-- It never dictates what is applied: `applySkin` serves what it is asked
-- for, offline and with no account, and that is deliberate — a binder
-- that changed its own clothes on reload would be a binder that needs the
-- server to look like itself.
ALTER TABLE IF EXISTS person ADD COLUMN IF NOT EXISTS stamp text;
ALTER TABLE IF EXISTS person ADD COLUMN IF NOT EXISTS skin text;

-- ------------------------------------------------------------
-- THE HELP TAKEN ON A QUESTION
-- ------------------------------------------------------------
-- THE PRIMARY KEY IS THE WHOLE POINT. Without it, "remove two wrong
-- answers" could be asked again and again on the same question, each
-- time returning two OTHERS: one pays once and peels the question bare.
-- With it, the second call returns the row already there, and charges
-- nothing.
--
-- The foreign key points at the ATTEMPT and not at the person, so help
-- taken disappears with the attempt it belonged to.
CREATE TABLE IF NOT EXISTS quiz_help (
  quiz_id       uuid NOT NULL,
  person_id     uuid NOT NULL,
  question_id   uuid NOT NULL REFERENCES quiz_question(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('halve', 'redo')),
  removed       uuid[] NOT NULL DEFAULT '{}',
  used_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quiz_id, person_id, question_id, kind),
  FOREIGN KEY (quiz_id, person_id)
    REFERENCES quiz_attempt(quiz_id, person_id) ON DELETE CASCADE
);

-- A challenge may be pushed back, twice at most, and the count lives with
-- the challenge rather than in a journal nobody would join.
ALTER TABLE IF EXISTS challenge
  ADD COLUMN IF NOT EXISTS extensions int NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE challenge ADD CONSTRAINT challenge_extensions_check
    CHECK (extensions BETWEEN 0 AND 2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
