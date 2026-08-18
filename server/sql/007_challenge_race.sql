-- ============================================================
-- 007 — LA COURSE
-- ============================================================
--
-- Conditionnel de bout en bout, comme ses six aînés.
--
-- UNE NATURE CHANGE CE QUI COMPTE, JAMAIS CE QUE ÇA PAIE. C'est la
-- doctrine de `kind`, et `mode` en est la seconde application : en
-- course, un film ne compte QUE POUR LE PREMIER qui le valide. Même
-- barème, même règlement, même `merit_event` — `points.ts` n'a pas une
-- ligne de plus, ni côté serveur ni dans la copie qui affiche.
--
-- POURQUOI UNE COLONNE ET NON UNE QUATRIÈME VALEUR DE `kind` : les deux
-- se croisent. Une course peut demander de VOIR ou de VOIR ET ÉCRIRE, et
-- se jouer sur une liste comme sur un critère. Les fondre en une seule
-- colonne aurait fait six valeurs dont personne ne retient l'ordre.
--
-- `'ensemble'` PAR DÉFAUT, donc tout défi déjà lancé reste ce qu'il
-- était. Rien à rétro-remplir, et la colonne est rejouable.

ALTER TABLE IF EXISTS challenge
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'ensemble';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_mode_known') THEN
    ALTER TABLE challenge ADD CONSTRAINT challenge_mode_known
      CHECK (mode IN ('ensemble', 'course'));
  END IF;
END $$;
