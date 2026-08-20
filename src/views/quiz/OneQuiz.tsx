/* ------------------------------------------------------------
   ONE QUIZ — a line in a list, and the door to a game
   ------------------------------------------------------------
   C'ÉTAIT UN `<div onClick>`, DONC CE N'ÉTAIT PAS UNE COMMANDE. Ni
   focusable, ni annoncé, ni actionnable à l'espace : la seule façon
   d'ouvrir une partie était la souris. C'est un `<button>` maintenant, et
   comme il ouvre une couche il le DIT — `aria-haspopup="dialog"` et
   `aria-expanded`.

   `all: unset` REND UN BOUTON « inline », et il faut le redire ici : la
   mise en boîte appartient au bouton. Sans le `display: flex` écrit à la
   main, le titre, les pastilles et la ligne mono se posent sur la ligne
   de base les uns des autres. */
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
      <button
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={opened}
        data-tour="quiz-open"
        style={{
          all: "unset" as const,
          ...tap,
          boxSizing: "border-box",
          width: "100%",
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
      </button>
      {opened && <QuizTable quiz={quiz} onChange={onChange} onClose={onToggle} />}
    </div>
  );
}
