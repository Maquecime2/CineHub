import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { inked } from "../../theme/styles";
import { Guideline, Label, Meter } from "../../components/ui";
import { Ticket } from "../../components/atmosphere/hall";
import { elapsed } from "../../domain/elapsed";
import { tiltOf } from "../../domain/seeded";
import { weekly as weeklyResource } from "../../hooks/useHall";
import type { Quiz, QuizAttempt, QuizScore } from "../../services/server";
import { QuizTable } from "./QuizTable";

/* ============================================================
   LE QUIZZ DE LA SEMAINE
   ============================================================

   RIEN NE DONNAIT DE RENDEZ-VOUS. Un quizz se tirait, s'envoyait à
   quelques personnes nommées, et mourait avec la soirée : le volet
   communautaire n'avait aucune raison qu'on y revienne, et deux
   inconnus n'avaient rien à comparer. Celui-ci est le même pour tout le
   monde, il change le lundi, et son tableau est PUBLIC.

   C'EST UNE CARTE EN TÊTE DE L'ONGLET, ET NON UNE VUE NEUVE. Une vue
   aurait demandé une entrée dans l'union `View`, une place dans un
   `TabGroup`, un tour dans `TOURS` — tout cela pour montrer un quizz,
   dans l'onglet dont c'est déjà le sujet. Elle passe donc devant les
   deux listes, parce que c'est ce qu'on vient voir.

   UN TICKET, ET C'EST LA PRIMITIVE DU HALL. `Ticket` (souche +
   ligne de déchirure) sert exactement à cela dans ce projet : ce qui
   ressemble à une entrée de séance. Elle n'est pas redessinée ici — une
   vue qui redessine une marque d'usage est une vue qui vient de forker
   la direction artistique.

   ELLE NE SE DESSINE PAS QUAND IL N'Y A RIEN. La banque peut n'avoir
   aucune question jouable : le serveur rend alors `quiz: null` et la
   semaine reste ouverte. Ce n'est pas une panne et cela ne se dit pas
   comme telle — il n'y a simplement pas de rendez-vous cette semaine.
   ============================================================ */
export function Weekly() {
  const { t } = useTranslation();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [board, setBoard] = useState<QuizScore[]>([]);
  const [count, setCount] = useState(0);
  const [weight, setWeight] = useState(0);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [open, setOpen] = useState(false);

  const reread = useCallback(async () => {
    /* `refresh` ET NON `load` : on vient de finir une partie, donc la
       fenêtre d'une minute du cache dirait le score d'avant. La règle
       est celle de tout le hall — mémoire à l'entrée, relecture après
       un geste. */
    const d = await weeklyResource.refresh();
    setQuiz(d.quiz);
    setBoard(d.board);
    setCount(d.questions);
    setWeight(d.weight);
    setAttempt(d.attempt);
  }, []);

  useEffect(() => {
    let alive = true;
    weeklyResource
      .load()
      .then((d) => {
        if (!alive) return;
        setQuiz(d.quiz);
        setBoard(d.board);
        setCount(d.questions);
        setWeight(d.weight);
        setAttempt(d.attempt);
      })
      /* Une carte de rendez-vous absente n'empêche pas de jouer ses
         propres soirées : la vue continue sans elle. */
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!quiz) return null;

  /* TROIS ÉTATS, ET LE BOUTON LES DIT. Jamais ouvert, ouvert et non
     fini, fini. Ils viennent de MON essai, que le serveur envoie —
     chercher son pseudonyme dans le classement se serait trompé dès
     qu'un blocage cache une ligne, et un essai ouvert sans réponse n'y
     figure de toute façon pas encore. */
  const done = attempt?.finished_at != null;
  const begun = attempt != null;

  return (
    <div data-tour="quiz-weekly" style={{ marginBottom: 30 }}>
      <Ticket
        tilt={Number(tiltOf(quiz.id)) / 3}
        stub={
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded }}>
              {t("quizView.weekly.stub")}
            </div>
            <div style={{ fontFamily: F.title, fontSize: 26, color: C.plum, lineHeight: 1.1 }}>
              {count}
            </div>
          </div>
        }
        counterfoil={
          <div>
            <div style={{ fontFamily: F.title, fontSize: 21, color: C.ink }}>{quiz.title}</div>
            <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 2 }}>
              {t("quizView.weekly.blurb")}
            </div>
            <button
              onClick={() => setOpen(true)}
              style={{ ...inked(done ? C.slate : C.plum), marginTop: 10 }}
            >
              {t(
                done
                  ? "quizView.weekly.seeAgain"
                  : begun
                    ? "quizView.weekly.resume"
                    : "quizView.weekly.play"
              )}
            </button>
          </div>
        }
      />

      {/* LE TABLEAU EST PUBLIC, ET C'EST LA SEULE CHOSE QUI CHANGE PAR
          RAPPORT À UNE SOIRÉE. Un quizz tiré ne compare que des gens
          qu'on a invités ; celui-ci compare tout le monde, blocages
          exceptés — un blocage l'emporte toujours sur la vitrine. */}
      <div style={{ marginTop: 14 }}>
        <Label>{t("quizView.weekly.board")}</Label>
        {board.length === 0 && <Guideline tight>{t("quizView.weekly.nobody")}</Guideline>}
        {board.map((s, i) => (
          <Meter
            key={s.pseudo}
            /* LE RANG EST LA POSITION DANS CE QUE LE SERVEUR A ENVOYÉ,
               et jamais un tri refait ici. C'est lui qui tient le
               départage — score, puis qui a fini le premier, puis
               l'identifiant — et le recalculer de ce côté ferait deux
               classements qui finiraient par diverger. */
            name={`${i + 1}. ${s.pseudo}`}
            done={s.score}
            total={weight}
            faded={!s.finished}
            note={
              s.finished
                ? elapsed(s.seconds)
                : `${t("quizView.stillPlaying")} · ${elapsed(s.seconds)}`
            }
          />
        ))}
      </div>

      {open && (
        <QuizTable
          quiz={quiz}
          onChange={reread}
          onClose={() => {
            setOpen(false);
            void reread();
          }}
        />
      )}
    </div>
  );
}
