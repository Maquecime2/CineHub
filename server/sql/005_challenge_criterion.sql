-- ============================================================
-- 005 — UN DÉFI SANS LISTE
-- ============================================================
--
-- Conditionnel de bout en bout, comme ses quatre aînés.
--
-- `list_id` DEVIENT NULL-ABLE, et c'est tout ce que ce fichier fait au
-- schéma. Un défi par critère ne porte pas de liste : il porte un
-- `subject` — une décennie, un pays, un cinéaste — et compte dans TOUTE
-- la collection de chaque participant.
--
-- LEVER UN `NOT NULL` NE PERD RIEN et ne transforme aucune donnée : les
-- lignes existantes gardent leur liste, et la contrainte qui part
-- n'était vraie que parce que la seule nature de défi en demandait une.
-- C'est pourquoi ce fichier reste rejouable et qu'il n'y a toujours pas
-- de table de migrations.
--
-- LA CASCADE, ELLE, NE BOUGE PAS : `ON DELETE CASCADE` sur `list_id`
-- reste ce qu'elle était. Effacer une liste efface les défis bâtis
-- dessus ; un défi par critère n'a rien à quoi être accroché, donc rien
-- ne l'emporte.

ALTER TABLE IF EXISTS challenge
  ALTER COLUMN list_id DROP NOT NULL;

-- UNE NATURE ET SA SOURCE NE PEUVENT PAS SE CONTREDIRE. Un défi par
-- critère sans `subject`, ou un défi par liste sans liste, sont deux
-- lignes que rien ne saurait compter — et le comptage, lui, PAIE. La
-- règle vit donc dans le SCHÉMA et non dans la route qui écrit : une
-- règle écrite dans une route se contourne par la route suivante.
--
-- LA CIBLE EST OBLIGATOIRE POUR UN CRITÈRE, et c'est la moitié la plus
-- importante de cette contrainte. « Tous les films des années 60 » n'a
-- pas de fin : sans cible, le dénominateur serait inconnu, la barre de
-- progression n'aurait pas de bout, et le défi ne se gagnerait jamais.
-- Une liste, elle, se compte toute seule.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_source_matches_kind') THEN
    ALTER TABLE challenge ADD CONSTRAINT challenge_source_matches_kind
      CHECK (
        (kind = 'critere' AND list_id IS NULL AND subject IS NOT NULL AND target IS NOT NULL)
        OR (kind <> 'critere' AND list_id IS NOT NULL)
      );
  END IF;
END $$;
