-- ============================================================
-- 004 — LES NATURES DE DÉFI, ET LA CIBLE CHIFFRÉE
-- ============================================================
--
-- Conditionnel de bout en bout, comme ses trois aînés.
--
-- LES VALEURS RESTENT EN FRANÇAIS, comme `person.sharing`. Elles
-- s'écrivent dans les LIGNES, elles ne s'affichent pas : les traduire
-- figerait la langue du jour dans les données de quelqu'un, et le
-- catalogue est là pour dire « liste » en anglais.

ALTER TABLE IF EXISTS challenge
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'liste';

-- La contrainte est POSÉE À PART de la colonne pour rester rejouable :
-- `ADD COLUMN IF NOT EXISTS ... CHECK (...)` ne repose pas la
-- contrainte si la colonne existe déjà, et la version d'à côté ne
-- s'ajoute qu'une fois.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_kind_known') THEN
    ALTER TABLE challenge ADD CONSTRAINT challenge_kind_known
      CHECK (kind IN ('liste', 'critique', 'critere'));
  END IF;
END $$;

-- COMBIEN IL EN FAUT, ET NULL VEUT DIRE « TOUTE LA LISTE ».
--
-- C'est ce que le défi ne savait pas dire : une liste de quarante films
-- ne se finit pas en un mois, donc un défi bâti dessus ne payait
-- personne et se lisait comme cassé. Une cible en fait une intention
-- tenable — « huit de ces quarante » — sans toucher à la liste, qui
-- appartient à quelqu'un et sert peut-être à autre chose.
--
-- ZÉRO EST REFUSÉ : un défi qu'on a fini avant de commencer aurait été
-- le mérite le moins cher du barème, comme la liste vide juste à côté.
ALTER TABLE IF EXISTS challenge
  ADD COLUMN IF NOT EXISTS target int;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_target_sane') THEN
    ALTER TABLE challenge ADD CONSTRAINT challenge_target_sane
      CHECK (target IS NULL OR target >= 1);
  END IF;
END $$;

-- CE SUR QUOI PORTE UN DÉFI PAR CRITÈRE. Vide tant que B4 n'est pas
-- livré, et `jsonb` parce que la forme d'un critère n'est pas connue :
-- une décennie, un pays, une personne. Une colonne par critère aurait
-- demandé une migration à chaque idée.
ALTER TABLE IF EXISTS challenge
  ADD COLUMN IF NOT EXISTS subject jsonb;
