import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Guideline, Label, Meter } from "../../components/ui";
import { elapsed } from "../../domain/elapsed";
import { quizScores, type Quiz, type QuizScore } from "../../services/server";

/* Only the people invited, and never anybody blocked either way — the
   server sees to both, and this file only draws what it sent. */
export function Scoreboard({
  quiz,
  weight,
  /* Not a value, a signal: it says "there is something new to read", and
     the quiz's id alone never said it. */
  round,
}: {
  quiz: Quiz;
  weight: number;
  round: number;
}) {
  const { t } = useTranslation();
  const [scores, setScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    let alive = true;
    quizScores(quiz.id)
      .then((r) => {
        if (alive) setScores(r.scores);
      })
      .catch(() => {
        /* A refusal empties the board; a refusal that comes back AFTER a
           later reading must not. */
        if (alive) setScores([]);
      });
    return () => {
      alive = false;
    };
  }, [quiz.id, round]);

  return (
    <div data-tour="quiz-scores" style={{ marginTop: 18 }}>
      <Label>{t("quizView.scores")}</Label>
      {scores.length === 0 && <Guideline tight>{t("quizView.nobodyPlayed")}</Guideline>}
      {/* The whole here is WHAT THE QUIZ IS WORTH, and not the best of
          the scores — see `Meter`, which carries that decision now. */}
      {scores.map((s) => (
        <Meter
          key={s.pseudo}
          name={s.pseudo}
          done={s.score}
          total={weight}
          faded={!s.finished}
          /* LE TEMPS SE DIT, ET IL NE PAIE RIEN. C'est la seule chose
             qu'un tableau des scores disait sans la dire : deux parties
             au même score ne sont pas la même partie. Pour qui joue
             encore, la durée COURT — le mot le dit avec elle. */
          note={
            s.finished
              ? elapsed(s.seconds)
              : `${t("quizView.stillPlaying")} · ${elapsed(s.seconds)}`
          }
        />
      ))}
    </div>
  );
}
