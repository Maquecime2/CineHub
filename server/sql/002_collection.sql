-- ============================================================
-- LES DÉCORS SE GAGNENT
-- ============================================================
--
-- `001_baseline.sql` dit, et il avait raison de le dire, que le catalogue
-- n'est pas une table : c'est du contenu produit, il ne prend aucune
-- écriture concurrente, et une table aurait voulu un écran
-- d'administration à écrire pour une seule personne.
--
-- CE QUI A CHANGÉ, C'EST QU'ON VEUT L'ÉCRAN, et pour une seule famille :
-- les objets qu'on pose sur l'étagère. Ils sont une IMAGE et une
-- RARETÉ — rien à rendre de neuf, rien à coder — et on veut pouvoir en
-- ajouter un dimanche. Le reste du catalogue (tampons, peaux, pouvoirs,
-- papiers, titres) reste en TypeScript, parce que rien de tout cela ne
-- s'ajoute sans écrire aussi du code pour le dessiner.
--
-- LA FRONTIÈRE EST DONC : ce qui est une IMAGE et un PRIX vit ici ; ce
-- qui est un COMPORTEMENT vit dans `src/shop.ts`.
--
-- ------------------------------------------------------------
-- ET LES BIBELOTS NE S'ENVOIENT PLUS, ILS SE TIRENT
-- ------------------------------------------------------------
--
-- Jusqu'ici, décorer son étagère voulait dire DÉPOSER une image : chacun
-- montait ses propres objets, les partageait, et les autres en prenaient
-- copie (`decor`, `decor_copy`, toujours là et toujours lues). Le dépôt
-- s'arrête. Les objets neufs viennent d'une pochette, et d'elle seule.
--
-- CE QUI SORT D'UNE POCHETTE NE SE PARTAGE PAS, et c'est la seule règle
-- de ce fichier qui protège le produit plutôt que les données : une
-- personne généreuse qui ouvrirait sa collection à tout le monde
-- viderait la boutique de sa raison d'être en un après-midi. D'où une
-- table à part de `decor` — `decor_won` n'a ni `is_public`, ni copie,
-- ni la moindre route pour donner.
--
-- LES IDENTIFIANTS RESTENT POUR TOUJOURS, comme ceux du code : ils sont
-- écrits dans `token_spend` et dans `decor_won`. D'où le retrait plutôt
-- que la suppression, partout dans ce fichier.

-- ------------------------------------------------------------
-- LES POCHETTES
-- ------------------------------------------------------------
-- UNE POCHETTE REND UN OBJET, ET IL N'Y A PAS DE COLONNE POUR LE DIRE.
-- Elle en rendait trois, réglable par pochette ; le produit a tranché
-- pour un, toujours. Un nombre paramétrable qu'on met partout à la même
-- valeur est un réglage que personne n'utilise et que tout le monde doit
-- comprendre — et surtout, chaque tirage est une écriture DANS la
-- transaction de l'achat.
CREATE TABLE IF NOT EXISTS pack_def (
  id            text PRIMARY KEY,
  price         int NOT NULL CHECK (price > 0),
  label_fr      text NOT NULL,
  label_en      text NOT NULL,
  -- Une image de couverture, sous `bank/decor/<clé>`. NULL veut dire
  -- « dessine-la », et le présentoir sait le faire.
  cover_key     text,
  retired_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- LA COLONNE `draws` A EXISTÉ UNE JOURNÉE. Elle est retirée
-- conditionnellement pour qu'une base déjà montée sur la première
-- version de ce fichier se rattrape toute seule au prochain démarrage —
-- c'est la seule chose que ce fichier détruit, et elle n'a jamais servi.
ALTER TABLE IF EXISTS pack_def DROP COLUMN IF EXISTS draws;

-- ------------------------------------------------------------
-- LES OBJETS
-- ------------------------------------------------------------
-- LA RARETÉ EST DANS L'OBJET ET PAS DANS LE TIRAGE. Les seuils — sept
-- sur dix, un quart, un sur vingt — restent du code : ils sont la FORME
-- de la chance, la même pour toute pochette. Ce qui change d'une
-- pochette à l'autre, c'est le contenu de chaque bassin, et c'est ici.
--
-- `wall` et `tintable` sont les deux seules propriétés de DESSIN qui
-- descendent en base, et elles y descendent parce qu'elles ne se
-- devinent pas d'une image : un objet qui se pend au fond de la rangée
-- ne se pose pas sur la planche, et une encre qu'on peut remplacer ne se
-- lit pas dans un PNG. Le reste — la taille, l'inclinaison — est semé
-- par l'identifiant, côté classeur.
CREATE TABLE IF NOT EXISTS decor_def (
  id            text PRIMARY KEY,
  pack_id       text NOT NULL REFERENCES pack_def(id) ON DELETE CASCADE,
  rarity        text NOT NULL CHECK (rarity IN ('common', 'rare', 'gold')),
  -- Soit une clé de blob sous `bank/decor/<clé>`, soit le nom d'un
  -- dessin embarqué (les onze d'origine). Le classeur distingue les deux
  -- sur la présence d'une barre oblique.
  media_key     text NOT NULL,
  label_fr      text NOT NULL,
  label_en      text NOT NULL,
  -- Se pend au fond de la rangée au lieu de se poser sur la planche.
  wall          boolean NOT NULL DEFAULT false,
  -- Son encre se remplace : la couleur lui parle encore.
  tintable      boolean NOT NULL DEFAULT true,
  retired_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decor_def_pack ON decor_def(pack_id);

-- ------------------------------------------------------------
-- CE QU'ON A TIRÉ
-- ------------------------------------------------------------
-- LES DOUBLES SE COMPTENT, ils ne se cachent pas. Un double est ce qu'on
-- montre, et c'est aussi la seule preuve visible que le hasard est du
-- hasard.
--
-- PAS DE `is_public`, PAS DE TABLE DE COPIE, ET C'EST LA DÉCISION. Voir
-- l'en-tête : un objet gagné qui se partage est une boutique qu'on vide.
CREATE TABLE IF NOT EXISTS decor_won (
  person_id     uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  decor_id      text NOT NULL,
  copies        int NOT NULL DEFAULT 1 CHECK (copies > 0),
  first_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, decor_id)
);

-- ------------------------------------------------------------
-- LE STOCK DE DÉPART
-- ------------------------------------------------------------
-- Les onze dessins et la pochette étaient en dur dans `src/shop.ts`.
-- Ils descendent ici avec LES MÊMES IDENTIFIANTS, sans quoi les
-- collections déjà remplies montreraient des cases vides.
--
-- `ON CONFLICT DO NOTHING` partout : ce fichier est rejoué à chaque
-- démarrage, et un administrateur qui aurait changé le prix de la
-- pochette ne doit pas le voir revenir à vingt-cinq au redémarrage.
INSERT INTO pack_def (id, price, label_fr, label_en) VALUES
  ('pack-trois', 25, 'Pochette surprise', 'Surprise packet')
ON CONFLICT (id) DO NOTHING;

-- ET SON NOM DISAIT ENCORE « TROIS ». L'identifiant, lui, reste
-- `pack-trois` pour toujours — il est écrit dans le journal des dépenses
-- de gens qui ont acheté — mais le LIBELLÉ mentait : une pochette rend
-- un objet.
--
-- La reprise est CONDITIONNELLE à l'ancien texte, et c'est ce qui la
-- rend supportable dans un fichier rejoué à chaque démarrage : un
-- administrateur qui aura renommé cette pochette lui-même ne verra pas
-- son choix revenir au prochain redémarrage. On corrige un mensonge
-- qu'on a écrit, on ne réécrit pas par-dessus quelqu'un.
UPDATE pack_def SET label_fr = 'Pochette surprise'
 WHERE id = 'pack-trois' AND label_fr IN ('Pochette de trois', 'Une pochette de trois');
UPDATE pack_def SET label_en = 'Surprise packet'
 WHERE id = 'pack-trois' AND label_en IN ('Packet of three', 'A packet of three');

INSERT INTO decor_def (id, pack_id, rarity, media_key, label_fr, label_en, wall) VALUES
  ('vig-projecteur', 'pack-trois', 'common', 'vig-projecteur', 'Projecteur', 'Projector', false),
  ('vig-fauteuil',   'pack-trois', 'common', 'vig-fauteuil',   'Fauteuil',   'Seat',      false),
  ('vig-bobine',     'pack-trois', 'common', 'vig-bobine',     'Bobine',     'Reel',      false),
  ('vig-ticket',     'pack-trois', 'common', 'vig-ticket',     'Ticket',     'Ticket',    false),
  ('vig-esquimau',   'pack-trois', 'common', 'vig-esquimau',   'Esquimau',   'Ice cream', false),
  ('vig-rideau',     'pack-trois', 'common', 'vig-rideau',     'Rideau',     'Curtain',   true),
  ('vig-clap',       'pack-trois', 'rare',   'vig-clap',       'Clap',       'Clapper',   false),
  ('vig-cadran',     'pack-trois', 'rare',   'vig-cadran',     'Cadran',     'Dial',      true),
  ('vig-lanterne',   'pack-trois', 'rare',   'vig-lanterne',   'Lanterne',   'Lantern',   true),
  ('vig-palme',      'pack-trois', 'gold',   'vig-palme',      'Palme',      'Palm',      false),
  ('vig-nitrate',    'pack-trois', 'gold',   'vig-nitrate',    'Nitrate',    'Nitrate',   false)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- CE QUE LES GENS AVAIENT DÉJÀ
-- ------------------------------------------------------------
-- `sticker` est du schéma de base, donc DÉPLOYÉ, donc il tient les
-- vignettes que des gens possèdent vraiment. Les vignettes deviennent
-- des objets d'étagère sous les mêmes identifiants : on verse, on
-- n'efface pas.
--
-- LA TABLE SOURCE RESTE EN PLACE, et ce n'est pas de l'indécision. Une
-- migration qui verse ET supprime dans le même souffle ne se vérifie
-- jamais : on la lance, et le jour où l'on s'aperçoit qu'elle a mal
-- versé, il n'y a plus rien à relire. Elle se supprimera quand on aura
-- regardé.
INSERT INTO decor_won (person_id, decor_id, copies, first_at)
SELECT person_id, sticker_id, copies, first_at FROM sticker
ON CONFLICT (person_id, decor_id) DO NOTHING;

-- `sticker_def` n'a jamais quitté la branche où elle est née : elle, on
-- peut la retirer sans rien perdre.
DROP TABLE IF EXISTS sticker_def;

-- ------------------------------------------------------------
-- DEUX POUVOIRS DE PLUS
-- ------------------------------------------------------------
-- La contrainte de `power.kind` était écrite dans le CREATE TABLE, donc
-- nommée `power_kind_check`. On la retire et on la repose : c'est la
-- seule façon d'étendre une liste de valeurs sans que le fichier cesse
-- d'être rejouable.
ALTER TABLE IF EXISTS power DROP CONSTRAINT IF EXISTS power_kind_check;

DO $$ BEGIN
  ALTER TABLE power ADD CONSTRAINT power_kind_check
    CHECK (kind IN ('halve', 'redo', 'extend', 'double', 'second-wind'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- DEUX CHOSES DE PLUS QU'ON PORTE
-- ------------------------------------------------------------
-- MÊME RAISONNEMENT QUE `stamp` ET `skin` : deux colonnes, pas une
-- table. On porte un papier et un titre à la fois, et une table dont la
-- clé primaire tient sur une ligne est une table de trop.
--
-- `paper` est le fond de page, et il est INDÉPENDANT DE LA PEAU : il
-- prend son encre des jetons du thème, donc les six papiers se
-- combinent avec les dix-sept peaux au lieu de les remplacer.
ALTER TABLE IF EXISTS person ADD COLUMN IF NOT EXISTS paper text;
ALTER TABLE IF EXISTS person ADD COLUMN IF NOT EXISTS title text;
