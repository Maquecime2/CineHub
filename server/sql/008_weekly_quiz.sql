-- ============================================================
-- LE QUIZZ DE LA SEMAINE
-- ============================================================
--
-- UN SEUL QUIZZ POUR TOUT LE MONDE, RENOUVELE CHAQUE SEMAINE. Jusqu'ici
-- un quizz se tirait : quelqu'un choisissait des categories, invitait
-- nommement des gens, et la partie mourait avec la soiree. Rien ne
-- donnait de rendez-vous, et le volet communautaire n'en avait aucun.
--
-- CE FICHIER RENVERSE UNE DECISION ECRITE. Le commentaire de
-- quiz_player, dans 001_baseline.sql, dit qu'un quizz n'a pas de
-- classement public "by design". Cela reste vrai de tous les quizz
-- TIRES : leurs scores ne se comparent qu'entre invites. Le quizz de la
-- semaine est l'exception, et il est marque comme telle par une colonne
-- plutot que par une convention, pour qu'aucune requete n'ait a deviner
-- de quel genre de quizz elle parle.
--
-- ----------------------------------------------------------------
-- UNE COLONNE, ET NON UNE TABLE DE JOINTURE
-- ----------------------------------------------------------------
--
-- Un quizz hebdomadaire EST un quizz : meme quiz_draw, meme
-- quiz_attempt, meme quiz_answer, meme calcul de score. Une table
-- weekly_quiz(week, quiz_id) aurait ajoute une jointure a chaque
-- lecture pour n'exprimer qu'un attribut, et il aurait fallu la tenir
-- d'accord avec la ligne de quiz a la main.
--
-- ----------------------------------------------------------------
-- L'INDEX UNIQUE PARTIEL EST LE VERROU, ET IL N'Y EN A PAS D'AUTRE
-- ----------------------------------------------------------------
--
-- Ce serveur n'a AUCUNE tache de fond : personne ne se leve le lundi
-- pour tirer le quizz. C'est donc le premier qui regarde qui le tire, et
-- deux personnes peuvent parfaitement regarder dans la meme seconde.
-- L'unicite est ici et pas dans le code appelant, exactement comme
-- celle de merit_event : une requete rejouee devient sans effet, et
-- aucun appelant n'a a verifier quoi que ce soit.
--
-- La clause WHERE laisse tous les quizz ordinaires en dehors de
-- l'index : ils ont week a NULL, et rien ne les empeche d'etre des
-- milliers.
--
-- ----------------------------------------------------------------
-- POURQUOI owner_id DEVIENT NULLABLE
-- ----------------------------------------------------------------
--
-- Un quizz de la semaine n'appartient a personne. L'autre solution
-- etait de lui designer un admin pour proprietaire, et elle est pire :
-- rightsOnQuiz lui aurait accorde le droit d'ECRIRE, c'est-a-dire de
-- renommer et de SUPPRIMER le quizz de tout le monde, et myQuizzes le
-- lui aurait affiche comme un quizz a lui.
--
-- Le NULL est aussi ce qui le tient hors de myQuizzes sans une ligne de
-- code : cette requete joint person sur owner_id, et une jointure
-- interne ecarte la ligne d'elle-meme.
-- ============================================================

alter table quiz add column if not exists week date;

create unique index if not exists quiz_one_per_week
  on quiz (week) where week is not null;

alter table quiz alter column owner_id drop not null;
