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
-- PARTAGER SA COLLECTION
-- ------------------------------------------------------------
-- LA DÉCISION APPARTIENT À LA COLLECTION, PAS À CHAQUE FICHE.
-- « Je montre ma vidéothèque » est une phrase qu'on dit une fois ; la
-- poser film par film ferait de six cents fiches six cents décisions,
-- c'est-à-dire aucune.
--
-- Trois états et pas deux, parce que « public » et « privé » ne suffisent
-- pas à ce qu'on veut vraiment faire — montrer à quelqu'un sans
-- s'afficher au monde :
--   privee   : personne, jamais. C'est le défaut, et il le reste.
--   lien     : qui a l'adresse secrète. Elle ne se devine pas, elle ne
--              s'indexe pas, et elle se change d'un geste.
--   publique : le pseudonyme suffit.
ALTER TABLE IF EXISTS personne
  ADD COLUMN IF NOT EXISTS partage text NOT NULL DEFAULT 'privee';

DO $$ BEGIN
  ALTER TABLE personne ADD CONSTRAINT personne_partage_check
    CHECK (partage IN ('privee', 'lien', 'publique'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le secret du partage par lien. Changer de jeton révoque tous les liens
-- distribués : c'est la seule façon de reprendre ce qu'on a donné.
ALTER TABLE IF EXISTS personne
  ADD COLUMN IF NOT EXISTS jeton text;

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
-- DEUX HORLOGES, ET DEUX RÔLES QU'IL NE FAUT PAS CONFONDRE.
--
-- `maj_le` vient du CLIENT : c'est lui qui dit quand la fiche a été
-- touchée, et c'est ce qui arbitre entre deux versions.
--
-- `seq` vient du SERVEUR : un numéro d'ordre d'arrivée, croissant, qui
-- ne dépend d'aucune horloge. C'est LUI que la synchronisation suit
-- pour savoir où elle en est.
--
-- Confondre les deux paraissait économique et ne l'était pas : un
-- téléphone en retard d'une heure pousse des fiches datées d'une heure
-- plus tôt, et l'autre appareil, qui demande « ce qui a bougé depuis
-- maintenant », ne les verrait JAMAIS. Elles seraient rangées sur le
-- serveur, invisibles à tous, sans qu'aucune erreur ne le dise.
CREATE SEQUENCE IF NOT EXISTS fiche_seq;

CREATE TABLE IF NOT EXISTS fiche (
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  -- L'identifiant vient du client (UUID v7) : c'est LUI qui nomme ses
  -- fiches, le serveur ne fait que les ranger sous un compte.
  id            text NOT NULL,
  seq           bigint NOT NULL DEFAULT nextval('fiche_seq'),
  tmdb_id       text,
  -- « Celle-ci ne part pas, même quand je partage. » Une exclusion, et
  -- non une visibilité par fiche : la décision de montrer appartient à
  -- la collection (voir `personne.partage`), et ceci n'en est que
  -- l'exception. Fausse par défaut — qui partage sa vidéothèque la
  -- partage, il ne coche pas six cents cases.
  cachee        boolean NOT NULL DEFAULT false,
  donnees       jsonb NOT NULL,
  maj_le        timestamptz NOT NULL,
  -- Une suppression se SYNCHRONISE : effacer la ligne ferait revenir la
  -- fiche au prochain envoi de l'appareil qui ne sait pas encore. On
  -- garde donc une pierre tombale, que l'on balaiera plus tard.
  supprimee     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (personne_id, id)
);

-- CE QUE `CREATE TABLE IF NOT EXISTS` NE FAIT PAS.
--
-- Sur une base où la table existe déjà, il ne fait RIEN — pas même
-- ajouter une colonne apparue depuis. Le socle décrivait donc le schéma
-- voulu tout en laissant les bases existantes en arrière, et le serveur
-- refusait de démarrer sur la seule qui contenait quelque chose.
--
-- Les tests ne pouvaient pas le voir : ils partent d'une base vide, où
-- la création couvre tout. Il a fallu démarrer sur une vraie base déjà
-- peuplée. Chaque colonne ajoutée après coup se pose donc ici, en
-- ALTER, aussi conditionnel que le reste.
ALTER TABLE IF EXISTS fiche
  ADD COLUMN IF NOT EXISTS seq bigint NOT NULL DEFAULT nextval('fiche_seq');

ALTER TABLE IF EXISTS fiche
  ADD COLUMN IF NOT EXISTS cachee boolean NOT NULL DEFAULT false;

-- `visibilite` n'a jamais porté autre chose que sa valeur par défaut : le
-- client ne l'a jamais renseignée, et la décision de partager s'est
-- révélée appartenir à la collection entière. Une colonne morte se
-- retire ; on ne la garde pas « au cas où ».
ALTER TABLE IF EXISTS fiche DROP COLUMN IF EXISTS visibilite;

-- L'index de la synchronisation : « ce qui a bougé depuis », dans
-- l'ordre où le serveur l'a reçu.
CREATE INDEX IF NOT EXISTS fiche_suite ON fiche(personne_id, seq);
-- Ce qu'une collection partagée montre : tout sauf les exclusions.
CREATE INDEX IF NOT EXISTS fiche_visible ON fiche(personne_id) WHERE NOT cachee AND NOT supprimee;

-- ------------------------------------------------------------
-- LE RESTE DU CLASSEUR
-- ------------------------------------------------------------
-- Une vidéothèque n'est pas qu'une liste de films : c'est aussi
-- l'agencement des étagères, les pages du carnet, les fils tendus entre
-- les œuvres, le vocabulaire qu'on s'est écrit et les décors qu'on a
-- posés. Synchroniser les fiches seules donne un second appareil qui
-- connaît les films et ne sait plus comment ils étaient rangés — c'est
-- la moitié du classeur, et pas la plus personnelle.
--
-- UNE TABLE À PART, ET PAS UNE COLONNE DE PLUS SUR `fiche` : ces
-- documents ne sont pas des fiches, ils n'ont ni identité d'œuvre ni
-- visibilité, et ils ne se partageront jamais de la même façon. Ils
-- suivent en revanche exactement les mêmes règles de synchronisation —
-- rang du serveur, date du client, dernier écrivain gagne.
CREATE SEQUENCE IF NOT EXISTS doc_seq;

CREATE TABLE IF NOT EXISTS doc (
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  -- La clé du client : « shelf-view:abc », « notebook-notes », « fils »…
  cle           text NOT NULL,
  seq           bigint NOT NULL DEFAULT nextval('doc_seq'),
  contenu       jsonb NOT NULL,
  maj_le        timestamptz NOT NULL,
  supprime      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (personne_id, cle)
);

CREATE INDEX IF NOT EXISTS doc_suite ON doc(personne_id, seq);

-- ------------------------------------------------------------
-- SUIVRE QUELQU'UN
-- ------------------------------------------------------------
-- Un lien à SENS UNIQUE, et volontairement : suivre n'est pas une
-- demande d'amitié, c'est un geste qu'on fait seul et qu'on défait
-- seul. Personne n'a à accepter, personne n'a à refuser, et il n'y a
-- donc aucune notification à supporter.
--
-- On ne peut suivre qu'une collection PUBLIQUE — le filtre est dans la
-- lecture, pas ici : quelqu'un qui se referme ne doit pas perdre ses
-- suiveurs, seulement disparaître de leur fil le temps qu'il se tait.
CREATE TABLE IF NOT EXISTS abonnement (
  suiveur_id    uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  suivi_id      uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suiveur_id, suivi_id),
  -- Se suivre soi-même remplirait son propre fil de ce qu'on vient
  -- d'écrire. La base le refuse plutôt que la route.
  CHECK (suiveur_id <> suivi_id)
);

CREATE INDEX IF NOT EXISTS abonnement_suivi ON abonnement(suivi_id);

-- ------------------------------------------------------------
-- NE PLUS VOIR QUELQU'UN
-- ------------------------------------------------------------
-- Le blocage est le pendant nécessaire de la première chose que ce
-- classeur publie : dès qu'un texte écrit par un inconnu peut apparaître
-- sous un film qu'on aime, il faut pouvoir le faire taire sans attendre
-- qu'un modérateur se réveille.
--
-- IL SE DÉCLARE D'UN CÔTÉ ET AGIT DES DEUX. Bloquer quelqu'un le retire
-- de ce que je vois, ET me retire de ce qu'il voit : un blocage qui ne
-- couperait que dans un sens laisse l'autre continuer de lire, de
-- répondre et de recommencer. Les lectures interrogent donc cette table
-- dans les deux sens (`OR`), et jamais dans un seul.
--
-- Ce qu'il ne fait PAS : cacher une collection publique à qui en connaît
-- l'adresse. Un blocage n'est pas un mur, c'est un silence — prétendre
-- le contraire donnerait une fausse sécurité.
CREATE TABLE IF NOT EXISTS blocage (
  bloqueur_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  bloque_id     uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bloqueur_id, bloque_id),
  CHECK (bloqueur_id <> bloque_id)
);

CREATE INDEX IF NOT EXISTS blocage_bloque ON blocage(bloque_id);

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

-- LE SIGNALÉ EST UNE COLONNE, PAS UNE DÉDUCTION. `cible_id` désigne une
-- fiche ; retrouver son propriétaire demanderait de la relire, et une
-- fiche effacée entre-temps emporterait avec elle la seule chose qui
-- rendait le signalement exploitable. On note donc qui est visé au
-- moment où l'on signale.
ALTER TABLE IF EXISTS signalement
  ADD COLUMN IF NOT EXISTS vise_id uuid REFERENCES personne(id) ON DELETE CASCADE;

-- Signaler deux fois la même chose est le même geste : la seconde fois
-- ne doit pas gonfler une file de modération qu'un humain devra lire.
CREATE UNIQUE INDEX IF NOT EXISTS signalement_unique
  ON signalement(auteur_id, cible_type, cible_id)
  WHERE auteur_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS signalement_a_traiter ON signalement(cree_le) WHERE traite_le IS NULL;

-- ------------------------------------------------------------
-- CE QU'ON DIT D'UNE ŒUVRE
-- ------------------------------------------------------------
-- IL N'Y A PAS DE TABLE D'AVIS, et c'est la décision de toute cette
-- étape. Une critique existe déjà : elle est dans la fiche de son
-- auteur, `donnees->>'review'`, et elle s'y synchronise depuis la phase
-- 4. La recopier ailleurs pour la « publier » créerait deux vérités qui
-- divergeraient au premier oubli — une critique corrigée chez soi et
-- restée fausse en public est exactement le défaut qu'on ne veut pas.
--
-- Publier n'est donc pas un geste de plus : c'est la conséquence du
-- partage déjà choisi. Ce qui manquait n'était pas un endroit où
-- écrire, mais un index pour lire à l'ENVERS — non plus « les films de
-- cette personne » mais « les gens qui ont vu ce film ».
CREATE INDEX IF NOT EXISTS fiche_oeuvre
  ON fiche(tmdb_id) WHERE tmdb_id IS NOT NULL AND NOT cachee AND NOT supprimee;

-- ------------------------------------------------------------
-- LES LISTES
-- ------------------------------------------------------------
-- Une liste ne contient PAS des fiches : elle contient des œuvres.
-- La différence décide de tout. Une liste de fiches serait une liste
-- des exemplaires de quelqu'un — elle ne voudrait plus rien dire chez
-- un autre, et se viderait le jour où son auteur efface une fiche.
-- `tmdb_id` est donc la seule clé, comme pour l'écho des œuvres, et le
-- titre n'est gardé qu'en INSTANTANÉ : de quoi afficher la liste à
-- quelqu'un qui n'a ni le film ni la clé TMDB.
CREATE TABLE IF NOT EXISTS liste (
  id            uuid PRIMARY KEY,
  proprietaire_id uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  titre         text NOT NULL CHECK (length(btrim(titre)) BETWEEN 1 AND 120),
  intention     text NOT NULL DEFAULT '',
  -- Fermée par défaut, comme tout le reste de ce projet.
  publique      boolean NOT NULL DEFAULT false,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  maj_le        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS liste_proprietaire ON liste(proprietaire_id);

-- CO-CONSTRUIRE EST UN DROIT D'ÉCRITURE, PAS UNE PROPRIÉTÉ PARTAGÉE.
-- Quelqu'un ajoute et retire des œuvres ; il ne renomme pas la liste,
-- ne la rend pas publique et ne l'efface pas. Sans cette asymétrie, une
-- liste à six mains n'a plus personne pour en répondre.
CREATE TABLE IF NOT EXISTS liste_membre (
  liste_id      uuid NOT NULL REFERENCES liste(id) ON DELETE CASCADE,
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  ajoute_le     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (liste_id, personne_id)
);

CREATE INDEX IF NOT EXISTS liste_membre_personne ON liste_membre(personne_id);

CREATE TABLE IF NOT EXISTS liste_item (
  liste_id      uuid NOT NULL REFERENCES liste(id) ON DELETE CASCADE,
  tmdb_id       text NOT NULL,
  titre         text NOT NULL DEFAULT '',
  annee         text,
  -- Qui l'a mise là. `SET NULL` et non `CASCADE` : quelqu'un qui s'en va
  -- ne doit pas emporter la liste que six personnes ont construite.
  ajoute_par    uuid REFERENCES personne(id) ON DELETE SET NULL,
  ajoute_le     timestamptz NOT NULL DEFAULT now(),
  -- La même œuvre deux fois est la même œuvre : la clé le dit, plutôt
  -- qu'une vérification dans une route qu'on oubliera ailleurs.
  PRIMARY KEY (liste_id, tmdb_id)
);

-- ------------------------------------------------------------
-- LES ÉPREUVES — ce que l'interface appelle des défis
-- ------------------------------------------------------------
-- LE MOT `defi` ÉTAIT DÉJÀ PRIS par le hasard des cérémonies WebAuthn,
-- quelques tables plus haut. Deux tables de sens opposés sous un même
-- nom se relisent mal et se confondent une nuit de panne : celle-ci
-- s'appelle donc `epreuve` dans la base, et « défi » à l'écran.
--
-- UNE ÉPREUVE EST UNE LISTE PLUS UNE PÉRIODE, et rien d'autre. Elle ne
-- duplique pas ses œuvres : elle pointe la liste, qui peut continuer de
-- vivre. Un défi dont la liste s'allonge en cours de route est un défi
-- qui s'allonge, et c'est le comportement voulu — ce sont des gens qui
-- se lancent quelque chose, pas un contrat.
CREATE TABLE IF NOT EXISTS epreuve (
  id            uuid PRIMARY KEY,
  liste_id      uuid NOT NULL REFERENCES liste(id) ON DELETE CASCADE,
  cree_par      uuid REFERENCES personne(id) ON DELETE SET NULL,
  titre         text NOT NULL CHECK (length(btrim(titre)) BETWEEN 1 AND 120),
  debut         date NOT NULL,
  fin           date NOT NULL,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  -- Une épreuve qui finit avant de commencer n'existe pas. La base le
  -- refuse, plutôt que la route qui la crée.
  CHECK (fin >= debut)
);

CREATE INDEX IF NOT EXISTS epreuve_liste ON epreuve(liste_id);
CREATE INDEX IF NOT EXISTS epreuve_periode ON epreuve(fin);

-- ON NE PARTICIPE PAS SANS L'AVOIR DIT. Compter automatiquement tous
-- les abonnés d'une liste publique ferait de chaque défi une mesure sur
-- des gens qui n'ont rien demandé — et l'avancement d'un défi se déduit
-- du journal des séances, qui est privé. Y entrer est donc un geste
-- explicite, et en sortir aussi.
CREATE TABLE IF NOT EXISTS epreuve_participant (
  epreuve_id    uuid NOT NULL REFERENCES epreuve(id) ON DELETE CASCADE,
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  rejoint_le    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epreuve_id, personne_id)
);

CREATE INDEX IF NOT EXISTS epreuve_participant_personne ON epreuve_participant(personne_id);

-- ------------------------------------------------------------
-- LA MESURE D'USAGE
-- ------------------------------------------------------------
-- CE QU'ELLE NE CONTIENT PAS EST SA DÉFINITION. Pas d'identifiant de
-- personne, pas d'adresse IP, pas de navigateur, pas d'heure : un
-- compteur par JOUR et par GESTE, et rien qui permette de recomposer
-- une journée de quelqu'un. On mesure pour savoir si le serveur tient
-- et ce qui sert, pas pour savoir qui fait quoi.
--
-- La conséquence est assumée : ces chiffres ne répondront jamais à
-- « combien de personnes actives ». Y répondre demanderait justement ce
-- qu'on refuse de garder.
CREATE TABLE IF NOT EXISTS mesure (
  jour          date NOT NULL DEFAULT current_date,
  geste         text NOT NULL,
  n             bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (jour, geste)
);

-- ------------------------------------------------------------
-- LES NOTIFICATIONS POUSSÉES
-- ------------------------------------------------------------
-- Un abonnement push appartient à un APPAREIL, pas à une personne :
-- même compte sur un téléphone et un ordinateur fait deux lignes, et
-- fermer l'un ne doit pas faire taire l'autre.
--
-- `secret` et `p256dh` sont les clés que le navigateur donne pour
-- chiffrer le message — c'est LUI qui les fabrique, et le serveur ne
-- peut rien en faire d'autre que pousser vers ce point-là.
CREATE TABLE IF NOT EXISTS pousse (
  point         text PRIMARY KEY,           -- l'endpoint du service de push
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  p256dh        text NOT NULL,
  secret        text NOT NULL,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  -- Un envoi refusé par le service de push (410) signifie que
  -- l'abonnement est mort : on l'efface plutôt que de réessayer tous les
  -- jours jusqu'à la fin des temps.
  vu_le         timestamptz
);

CREATE INDEX IF NOT EXISTS pousse_personne ON pousse(personne_id);

-- CE QUI A DÉJÀ ÉTÉ DIT NE SE REDIT PAS. Sans cette table, un balayage
-- qui tourne deux fois — un redémarrage, un serveur relancé — envoie
-- deux fois le même rappel. Une notification en double est la façon la
-- plus rapide de faire couper les notifications.
CREATE TABLE IF NOT EXISTS rappel_envoye (
  personne_id   uuid NOT NULL REFERENCES personne(id) ON DELETE CASCADE,
  sujet         text NOT NULL,              -- « epreuve:<id>:fin », par exemple
  cree_le       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (personne_id, sujet)
);
