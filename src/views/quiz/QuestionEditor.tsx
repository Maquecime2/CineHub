/* ------------------------------------------------------------
   ONE QUESTION, BEING WRITTEN
   ------------------------------------------------------------ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, hollow, inked, underlineInput } from "../../theme/styles";
import { Label } from "../../components/ui";
import type { BankQuestion, QuestionDraft } from "../../services/server";
import { LEVELS, POINTS } from "./shared";

export function QuestionEditor({
  question,
  onCancel,
  onSave,
}: {
  question?: BankQuestion;
  onCancel: () => void;
  onSave: (draft: QuestionDraft) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [ask, setAsk] = useState(question?.ask ?? "");
  const [hint, setHint] = useState(question?.hint ?? "");
  const [image, setImage] = useState(question?.image ?? "");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "normal");
  const [choices, setChoices] = useState<{ label: string; is_right: boolean }[]>(
    question?.choices.map((c) => ({ label: c.label, is_right: c.is_right === true })) ?? [
      { label: "", is_right: true },
      { label: "", is_right: false },
      { label: "", is_right: false },
      { label: "", is_right: false },
    ]
  );

  /* ONE TICK MOVES, IT DOES NOT ADD UP. Two right answers makes a
     question the bank refuses to deal, and letting the boxes be ticked
     independently would have made that easy to do by accident. */
  const tick = (i: number) => setChoices(choices.map((c, j) => ({ ...c, is_right: i === j })));

  const save = () =>
    onSave({
      ask: ask.trim(),
      hint: hint.trim(),
      image: image.trim() || null,
      difficulty,
      choices: choices.filter((c) => c.label.trim() !== ""),
    }).catch(() => {});

  return (
    <div style={{ border: `1px solid ${C.ink}`, padding: 10, marginTop: 8 }}>
      <Label>{t("quizView.ask")}</Label>
      <input
        value={ask}
        onChange={(e) => setAsk(e.target.value)}
        placeholder={t("quizView.askPlaceholder")}
        style={{ ...underlineInput, fontFamily: F.hand, fontSize: 17 }}
      />

      <div style={{ marginTop: 10 }}>
        <Label>{t("quizView.difficultyLabel")}</Label>
        <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setDifficulty(l)}
              style={difficulty === l ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
            >
              {t(`quizView.difficulty.${l}`)} · {t("quizView.worth", { n: POINTS[l] })}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <Label>{t("quizView.choices")}</Label>
        {choices.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <button
              onClick={() => tick(i)}
              title={t("quizView.markRight")}
              style={{
                ...bare,
                color: c.is_right ? C.pine : C.inkFaded,
                opacity: c.is_right ? 1 : 0.45,
              }}
            >
              <Check size={14} />
            </button>
            <input
              value={c.label}
              onChange={(e) =>
                setChoices(choices.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))
              }
              placeholder={t("quizView.choicePlaceholder", { n: i + 1 })}
              style={{ ...underlineInput, fontFamily: F.body, fontSize: 15 }}
            />
            <button
              onClick={() => setChoices(choices.filter((_, j) => j !== i))}
              title={t("quizView.removeChoice")}
              style={bare}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setChoices([...choices, { label: "", is_right: false }])}
          style={{ ...bare, fontFamily: F.mono, fontSize: 10, marginTop: 6 }}
        >
          + {t("quizView.addChoice")}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Label>{t("quizView.hint")}</Label>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder={t("quizView.hintPlaceholder")}
            style={{ ...underlineInput, fontFamily: F.hand, fontSize: 15 }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Label>{t("quizView.image")}</Label>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder={t("quizView.imagePlaceholder")}
            style={{ ...underlineInput, fontFamily: F.mono, fontSize: 12 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={save} style={inked(C.ink)}>
          {t("quizView.save")}
        </button>
        <button onClick={onCancel} style={{ ...inked(C.ink), ...hollow }}>
          {t("quizView.cancel")}
        </button>
      </div>
    </div>
  );
}
