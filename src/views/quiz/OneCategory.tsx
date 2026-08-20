import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, chip, inked, tap } from "../../theme/styles";
import { Guideline, Trouble } from "../../components/ui";
import {
  addBankQuestion,
  bankQuestions,
  deleteCategory,
  editBankQuestion,
  removeBankQuestion,
  reviveBankQuestion,
  type BankQuestion,
  type Category,
} from "../../services/server";
import { QuestionEditor } from "./QuestionEditor";

export function OneCategory({
  category,
  opened,
  onToggle,
  onChange,
}: {
  category: Category;
  opened: boolean;
  onToggle: () => void;
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [writing, setWriting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /* « IL N'Y A RIEN » ET « ON N'A PAS PU DEMANDER » NE SONT PAS LE MÊME
     ÉCRAN. L'échec était avalé : l'accordéon s'ouvrait vide et se lisait
     « cette catégorie n'a aucune question », alors qu'on n'avait pas pu
     poser la question. C'est le défaut déjà retiré de quatre vues. */
  const [trouble, setTrouble] = useState(false);

  const reread = useCallback(async () => {
    if (!opened) return;
    const r = await bankQuestions(category.id);
    setQuestions(r.questions);
  }, [category.id, opened]);

  /* LE `try` ENGLOBE L'APPEL ET PAS SEULEMENT SA PROMESSE : un service
     qui lève AVANT de rendre une promesse traverse un `.catch` et
     emporte tout le panneau. */
  const ask = useCallback(async () => {
    setTrouble(false);
    try {
      await reread();
    } catch {
      setTrouble(true);
    }
  }, [reread]);

  useEffect(() => {
    void ask();
  }, [ask]);

  return (
    <div style={{ border: `1px solid ${C.line}` }}>
      <div
        onClick={onToggle}
        style={{
          ...tap,
          cursor: "pointer",
          padding: "8px 10px",
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span style={{ fontFamily: F.body, fontSize: 16, color: C.ink }}>{category.label}</span>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {t("quizView.difficulty.easy")} {category.easy} · {t("quizView.difficulty.normal")}{" "}
          {category.normal} · {t("quizView.difficulty.hard")} {category.hard}
        </span>
      </div>

      {opened && (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: 10 }}>
          {note && (
            <div style={{ fontFamily: F.hand, fontSize: 15, color: C.burgundy, marginBottom: 8 }}>
              {note}
            </div>
          )}
          {trouble && (
            <Trouble onRetry={() => void ask()} retryLabel={t("quizView.askAgain")}>
              {t("quizView.questionsFailed")}
            </Trouble>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {/* LE VIDE NE SE DIT PAS QUAND ON N'A PAS PU DEMANDER : les
                deux écrans à la fois est pire qu'un seul faux. */}
            {questions.length === 0 && !trouble && (
              <Guideline tight>{t("quizView.noQuestions")}</Guideline>
            )}
            {questions.map((q) =>
              editing === q.id ? (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onCancel={() => setEditing(null)}
                  onSave={async (draft) => {
                    const r = await editBankQuestion(category.id, q.id, draft);
                    setNote(r.choicesFrozen ? t("quizView.choicesFrozen") : null);
                    setEditing(null);
                    await reread();
                    await onChange();
                  }}
                />
              ) : (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "5px 6px",
                    opacity: q.retired ? 0.45 : 1,
                    border: `1px solid ${dealable(q) ? "transparent" : C.burgundy}`,
                  }}
                >
                  <span style={{ ...chip, borderColor: C.line }}>
                    {t(`quizView.difficulty.${q.difficulty}`)}
                  </span>
                  <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink, flex: 1 }}>
                    {q.ask}
                  </span>
                  {!dealable(q) && (
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.burgundy }}>
                      {t("quizView.needsOneRight")}
                    </span>
                  )}
                  {q.retired && (
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
                      {t("quizView.retired")}
                    </span>
                  )}
                  <button
                    onClick={() => setEditing(q.id)}
                    title={t("quizView.editQuestion")}
                    style={bare}
                  >
                    <Pencil size={12} />
                  </button>
                  {q.retired ? (
                    <button
                      onClick={() =>
                        reviveBankQuestion(category.id, q.id).then(reread).then(onChange)
                      }
                      title={t("quizView.revive")}
                      style={bare}
                    >
                      <Undo2 size={12} />
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        const r = await removeBankQuestion(category.id, q.id);
                        setNote(r.fate === "retired" ? t("quizView.retiredNote") : null);
                        await reread();
                        await onChange();
                      }}
                      title={t("quizView.removeQuestion")}
                      style={{ ...bare, color: C.burgundy }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          {writing ? (
            <QuestionEditor
              onCancel={() => setWriting(false)}
              onSave={async (draft) => {
                await addBankQuestion(category.id, draft);
                setWriting(false);
                await reread();
                await onChange();
              }}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => setWriting(true)} style={inked(C.ink)}>
                <Plus size={12} /> {t("quizView.addQuestion")}
              </button>
              <span style={{ flex: 1 }} />
              <button
                onClick={async () => {
                  try {
                    await deleteCategory(category.id);
                    await onChange();
                  } catch (e) {
                    setNote((e as Error).message);
                  }
                }}
                title={t("quizView.deleteCategory")}
                style={{ ...bare, color: C.burgundy }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Can this question be dealt at all — exactly one right answer? */
const dealable = (q: BankQuestion): boolean =>
  q.choices.length >= 2 && q.choices.filter((c) => c.is_right).length === 1;
