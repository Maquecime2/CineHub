-- ============================================================
-- LE SOCLE — comptes, clés d'accès, sessions, et une collection
-- ============================================================
--
-- Écrit en SQL et non dérivé d'un ORM : ce fichier est la description
-- de ce que le serveur garde de quelqu'un, et c'est un texte qu'on doit
-- pouvoir relire sans outil. Il se rejoue sans dommage — tout y est
-- conditionnel.

-- ------------------------------------------------------------
-- LA PERSONNE
-- ------------------------------------------------------------
-- Pas de mot de passe, pas d'adresse obligatoire : on entre par une clé
-- d'accès (passkey), et le compte n'a besoin de rien d'autre pour
-- exister. Le pseudonyme est le seul nom public ; il sert d'adresse de
-- collection partagée, d'où sa contrainte de forme.
CREATE TABLE IF NOT EXISTS personne (
  id            uuid PRIMARY KEY,
  pseudo        text NOT NULL UNIQUE
                CHECK (pseudo ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$'),
  -- Facultative, et le restera : elle ne sert qu'à retrouver un compte
  -- dont toutes les clés ont été perdues. Nulle part ailleurs.
  courriel      text UNIQUE,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  -- Effacer un compte efface tout ce qui pend dessous (ON DELETE CASCADE
  -- partout) : le droit à l'effacement n'est pas une routine de ménage
  -- à écrire plus tard, c'est une propriété du schéma.
  vu_le         timestamptz
);

-- ------------------------------------------------------------
-- LA CLÉ D'ACCÈS
-- ------------------------------------------------------------
-- Ce que le navigateur retient, c'est une paire de clés ; ce que le
-- serveur garde, c'est la PUBLIQUE — inutile à qui la vole. Il n'y a
-- donc rien ici qui permette de se faire passer pour quelqu'un, et
-- c'est tout l'intérêt par rapport à une empreinte de mot de passe.
--
-- Plusieurs clés par personne, délibérément : un téléphone, un
-- ordinateur, une clé physique. N'en avoir qu'une, c'est perdre son
-- compte avec son téléphone.
CREATE TABLE IF NOT EXISTS cle_acces (
  id            text PRIMARY KEY,               -- l'identifiant fourni par l'authentificateur
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  cle_publique  bytea NOT NULL,
  -- LE COMPTEUR ANTI-CLONAGE. L'authentificateur l'incrémente à chaque
  -- signature ; un compteur qui recule dénonce une copie de la clé.
  -- Certains authentificateurs le laissent à zéro : la vérification
  -- n'est donc pas un refus, mais un signal.
  compteur      bigint NOT NULL DEFAULT 0,
  transports    text[] NOT NULL DEFAULT '{}',
  appareil      text,                            -- ce que la personne a écrit pour s'y retrouver
  cree_le       timestamptz NOT NULL DEFAULT now(),
  vue_le        timestamptz
);

CREATE INDEX IF NOT EXISTS cle_acces_personne ON cle_acces(personne_id);

-- ------------------------------------------------------------
-- LE DÉFI EN COURS
-- ------------------------------------------------------------
-- Une cérémonie WebAuthn se fait en deux temps, et le hasard tiré au
-- premier doit être retrouvé au second — SANS que le client puisse le
-- choisir lui-même, sinon la signature ne prouve plus rien. Il vit donc
-- ici, pour quelques minutes.
CREATE TABLE IF NOT EXISTS defi (
  id            uuid PRIMARY KEY,
  valeur        text NOT NULL,
  -- Une inscription n'a pas encore de personne : la colonne est nulle.
  personne_id   uuid REFERENCES personne(id) ON DELETE CASCADE,
  pseudo        text,
  expire_le     timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS defi_expire ON defi(expire_le);

-- ------------------------------------------------------------
-- LA SESSION
-- ------------------------------------------------------------
-- Le cookie ne porte PAS l'identifiant de session tel quel : il porte un
-- secret dont la table ne garde que l'empreinte. Une fuite de la base ne
-- donne donc aucune session utilisable — le même raisonnement que pour
-- les mots de passe, appliqué à ce qui les remplace.
CREATE TABLE IF NOT EXISTS session (
  empreinte     text PRIMARY KEY,
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  expire_le     timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS session_personne ON session(personne_id);

-- ------------------------------------------------------------
-- LA COLLECTION
-- ------------------------------------------------------------
-- UNE LIGNE PAR FICHE, et non un document par personne. C'est ce qui
-- permettra de ne pousser que ce qui a bougé : `maj_le` est la date que
-- le client tient déjà (`updatedAt`), et l'index qui la porte est celui
-- que la synchronisation interrogera.
--
-- `donnees` en jsonb : la fiche est un objet du client, et le serveur
-- n'a aucune raison d'en connaître les trente champs. Ce qu'il doit
-- savoir, il le sort en colonnes — l'identité de l'œuvre et la
-- visibilité, parce que ce sont les deux seules choses sur lesquelles il
-- devra filtrer.
CREATE TABLE IF NOT EXISTS fiche (
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  -- L'identifiant vient du client (UUID v7) : c'est LUI qui nomme ses
  -- fiches, le serveur ne fait que les ranger sous un compte.
  id            text NOT NULL,
  tmdb_id       text,
  visibilite    text NOT NULL DEFAULT 'privee'
                CHECK (visibilite IN ('privee', 'lien', 'publique')),
  donnees       jsonb NOT NULL,
  maj_le        timestamptz NOT NULL,
  -- Une suppression se SYNCHRONISE : effacer la ligne ferait revenir la
  -- fiche au prochain envoi de l'appareil qui ne sait pas encore. On
  -- garde donc une pierre tombale, que l'on balaiera plus tard.
  supprimee     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (personne_id, id)
);

CREATE INDEX IF NOT EXISTS fiche_maj ON fiche(personne_id, maj_le);
CREATE INDEX IF NOT EXISTS fiche_publique ON fiche(tmdb_id) WHERE visibilite = 'publique';

-- ------------------------------------------------------------
-- LE SIGNALEMENT
-- ------------------------------------------------------------
-- Vide tant que rien n'est public, et posé quand même : une table de
-- signalements qu'on ajoute après coup arrive toujours le jour où l'on
-- en a besoin tout de suite.
CREATE TABLE IF NOT EXISTS signalement (
  id            uuid PRIMARY KEY,
  auteur_id     uuid REFERENCES personne(id) ON DELETE SET NULL,
  cible_type    text NOT NULL,
  cible_id      text NOT NULL,
  motif         text NOT NULL,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  traite_le     timestamptz
);
