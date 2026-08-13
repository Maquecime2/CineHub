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
