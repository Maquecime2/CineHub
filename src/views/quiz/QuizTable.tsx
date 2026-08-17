import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { inked } from "../../theme/styles";
import { Guideline } from "../../components/ui";
import { PowerBar } from "../../components/play/PowerBar";
import type { Gain } from "../../domain/points";
import { refreshPurse } from "../../hooks/usePurse";
import {
  answerQuiz,
  finishQuiz,
  halveQuestion,
  myHoldings,
  readQuiz,
  redoQuestion,
  startQuiz,
  type Quiz,
  type QuizQuestion,
} from "../../services/server";
import { Asked } from "./Asked";
import { Correction } from "./Correction";
import { Guests } from "./Guests";
import { Scoreboard } from "./Scoreboard";

/* ------------------------------------------------------------
   PLAYING ONE
   ------------------------------------------------------------
   One question at a time, and an answer that goes down and stays down.
   The screen does not ask for confirmation, because the sentence under
   the propositions has already said what clicking means — and asking
   twice for every question of twenty would be worse than the mistake it
   guards against. */

export function QuizTable({ quiz, onChange }: { quiz: Quiz; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [weight, setWeight] = useState(0);
  const [finished, setFinished] = useState(quiz.finished === true);
  const [busy, setBusy] = useState(false);
  /* THE LEADERBOARD IS READ ONCE PER QUIZ, AND A QUIZ HAS ONE ID.
     Which meant it was read once, full stop: closing one's attempt
     changed nothing on screen — the score one had just earned appeared
     only after a reload, and the natural reading of that is that the
     answers were not counted. This counts the moments the board has
     something new to say, and is what the board watches. */
  const [round, setRound] = useState(0);
  const again = useCallback(() => setRound((n) => n + 1), []);

  /* CE QUE LA PARTIE A COÛTÉ ET RAPPORTÉ. Les pouvoirs sont lus au
     serveur — ce qu'on croit posséder ne décide de rien, il refusera
     tout seul — et l'aide prise est gardée PAR QUESTION : le serveur
     rend toujours les deux mêmes propositions écartées, donc revenir
     sur une question ne rebat pas les cartes. */
  const [powers, setPowers] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<Record<string, string[]>>({});
  const [gains, setGains] = useState<Gain[]>([]);

  const reread = useCallback(async () => {
    const r = await readQuiz(quiz.id);
    setQuestions(r.questions);
    setPlayers(r.players);
    setWeight(r.weight);
    setFinished(r.attempt?.finished_at != null);
    /* Un comptoir qui se tait ne doit pas empêcher de jouer : sans
       pouvoirs, la barre ne se dessine simplement pas. */
    myHoldings()
      .then((h) => setPowers(h.powers))
      .catch(() => setPowers({}));
  }, [quiz.id]);

  useEffect(() => {
    /* Opening the attempt is what the first look does: there is no
       "start" button to press, and pressing it twice would have been
       one more thing to explain. It is idempotent server-side. */
    startQuiz(quiz.id)
      .then(reread)
      .catch(() => {});
  }, [quiz.id, reread]);

  const answered = questions.filter((q) => q.mine != null).length;
  const current = questions.find((q) => q.mine == null);

  const lay = async (questionId: string, choiceId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerQuiz(quiz.id, questionId, choiceId);
      await reread();
      /* One's own bar moves as one plays: the board shows the running
         score of whoever has not finished, and it would otherwise stay
         at whatever it was when the screen opened — zero. */
      again();
    } catch {
      /* Already answered, or the attempt closed underneath us — either
         way the truth is on the server, so we go and read it. */
      await reread().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    const r = await finishQuiz(quiz.id);
    setQuestions(r.questions);
    setFinished(true);
    /* Ce que le serveur a RÉELLEMENT crédité, et pas ce que le barème
       laissait espérer : une partie close deux fois ne paie qu'une. */
    setGains(r.gains ?? []);
    again();
    await refreshPurse();
    await onChange();
  };

  /* Un pouvoir se dépense sur le serveur, jamais ici. On ne fait que
     ranger ce qu'il répond — et s'il refuse, on relit plutôt que de
     deviner : c'est lui qui compte les pouvoirs, pas cet écran. */
  const spend = async (power: "halve" | "redo") => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (power === "halve") {
        const r = await halveQuestion(quiz.id, current.id);
        setHidden((was) => ({ ...was, [current.id]: r.removed }));
        setPowers((was) => ({ ...was, halve: r.left }));
      } else {
        const r = await redoQuestion(quiz.id, current.id);
        setPowers((was) => ({ ...was, redo: r.left }));
        await reread();
      }
    } catch {
      await reread().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-tour="quiz-playing" style={{ borderTop: `1px solid ${C.line}`, padding: 13 }}>
      {quiz.softened && <Guideline tight>{t("quizView.softened")}</Guideline>}

      {finished ? (
        <>
          <Guideline tight>{t("quizView.overForYou")}</Guideline>
          <Correction questions={questions} weight={weight} gains={gains} />
        </>
      ) : (
        <>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
            {t("quizView.progress", { done: answered, total: questions.length })}
          </div>
          {current ? (
            <>
              <Asked
                question={current}
                busy={busy}
                removed={hidden[current.id] ?? []}
                onPick={(c) => lay(current.id, c)}
              />
              <PowerBar
                powers={powers}
                used={hidden[current.id] ? ["halve"] : []}
                onUse={spend}
                onBought={reread}
                busy={busy}
                tour="quiz-powers"
              />
            </>
          ) : (
            <Guideline tight>{t("quizView.allAnswered")}</Guideline>
          )}
          <button onClick={close} style={{ ...inked(C.burgundy), marginTop: 16 }}>
            {t("quizView.finish")}
          </button>
          <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
            {t("quizView.finishNote")}
          </div>
        </>
      )}

      <Scoreboard quiz={quiz} weight={weight} round={round} />
      {quiz.mine && <Guests quiz={quiz} players={players} onChange={reread} onGone={onChange} />}
    </div>
  );
}
