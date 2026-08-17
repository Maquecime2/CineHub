/* ------------------------------------------------------------
   ONE QUIZ
   ------------------------------------------------------------ */
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { chip, tap } from "../../theme/styles";
import type { Quiz } from "../../services/server";
import { QuizTable } from "./QuizTable";

export function OneQuiz({
  quiz,
  opened,
  onToggle,
  onChange,
}: {
  quiz: Quiz;
  opened: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();

  const state = quiz.finished
    ? t("quizView.done")
    : (quiz.answered ?? 0) > 0
      ? t("quizView.underway")
      : t("quizView.untouched");

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div
        onClick={onToggle}
        style={{
          ...tap,
          cursor: "pointer",
          padding: "11px 13px",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 20, color: C.ink }}>
          {quiz.title}
        </span>
        {quiz.topics.map((c) => (
          <span key={c} style={chip}>
            {c}
          </span>
        ))}
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {t(`quizView.difficulty.${quiz.level}`)} ·{" "}
          {t("quizView.questionCount", { count: quiz.size })} · {state}
          {!quiz.mine && ` · ${t("quizView.by", { pseudo: quiz.owner })}`}
        </span>
      </div>
      {opened && <QuizTable quiz={quiz} onChange={onChange} />}
    </div>
  );
}
