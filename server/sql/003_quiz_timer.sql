-- ============================================================
-- 003 — LE CHRONOMÈTRE PAR QUESTION
-- ============================================================
--
-- Conditionnel de bout en bout, comme les deux fichiers d'avant : il n'y
-- a pas de table de migrations dans ce dépôt, et il n'en faut pas tant
-- que chaque fichier est rejouable. Le jour où l'un d'eux devra
-- TRANSFORMER une donnée plutôt qu'ajouter une colonne, c'est ce jour-là
-- qu'il faudra la table.
--
-- NULL PAR DÉFAUT, ET C'EST LE POINT. Tout quizz déjà tiré est sans
-- chronomètre, donc il n'y a rien à rétro-remplir et personne ne se
-- réveille chronométré sur une soirée commencée hier. « Absent » et
-- « zéro » ne disent pas la même chose ; une colonne à 0 aurait voulu
-- dire « aucun délai », c'est-à-dire tout en retard.

ALTER TABLE IF EXISTS quiz
  ADD COLUMN IF NOT EXISTS seconds_per_question int;

-- Cinq secondes est le plancher en dessous duquel lire l'énoncé ne tient
-- pas ; dix minutes le plafond au-delà duquel le mot « chronomètre » ne
-- veut plus rien dire. La borne vit dans le SCHÉMA et non dans la route,
-- comme tout ce qui protège quelqu'un : une règle écrite dans une route
-- se contourne par la route suivante.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_seconds_sane') THEN
    ALTER TABLE quiz ADD CONSTRAINT quiz_seconds_sane
      CHECK (seconds_per_question IS NULL
             OR seconds_per_question BETWEEN 5 AND 600);
  END IF;
END $$;

-- LE RETARD EST ESTAMPILLÉ À L'INSERT, dans la requête qui écrit la
-- ligne — voir `store.answer`. La règle vit donc là où la ligne
-- s'écrit, et non dans une lecture qui la recalculerait : `scoresOf` et
-- `awardQuiz` ne changent alors que d'un mot chacun.
--
-- UNE RÉPONSE HORS DÉLAI EST ACCEPTÉE ET VAUT ZÉRO, jamais refusée. La
-- refuser perdrait la réponse et contredirait « on ne revient pas
-- dessus », qui est déjà écrit à l'écran sous les propositions.
ALTER TABLE IF EXISTS quiz_answer
  ADD COLUMN IF NOT EXISTS late boolean NOT NULL DEFAULT false;
