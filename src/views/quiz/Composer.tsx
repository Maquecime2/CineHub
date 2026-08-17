/* ------------------------------------------------------------
   COMPOSING ONE — three clicks, and the deal is made
   ------------------------------------------------------------
   AN EMPTY BASKET IS NOT OFFERED. Ticking something that can give
   nothing is a dead end one only discovers at the end, so it is not
   drawn at all — the same reasoning that keeps this whole tab away from
   somebody with no server. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { chip, hollow, inked, tap, underlineInput } from "../../theme/styles";
import { Guideline, Label } from "../../components/ui";
import { drawQuiz, type Category } from "../../services/server";
import { LEVELS } from "./shared";

/** The three lengths. The server agrees, and says so. */
const SIZES = [10, 20, 30] as const;

/** Can this basket give anything at all? An empty one is not offered. */
const holds = (c: Category) => c.easy + c.normal + c.hard;

export function Composer({
  categories,
  onDrawn,
  onOpen,
}: {
  categories: Category[];
  onDrawn: () => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [level, setLevel] = useState<string>("normal");
  const [size, setSize] = useState<number>(10);
  const [trouble, setTrouble] = useState<string | null>(null);

  const usable = categories.filter((c) => holds(c) > 0);
  /* What the chosen baskets hold, all told. Shown because a bank too
     thin for the length asked for gives a softened quiz, and knowing
     that BEFORE dealing is better than reading it after. */
  const available = usable.filter((c) => picked.includes(c.id)).reduce((n, c) => n + holds(c), 0);

  const deal = async () => {
    const name = title.trim();
    if (!name || picked.length === 0) return;
    setTrouble(null);
    try {
      const { id } = await drawQuiz({ title: name, categoryIds: picked, level, size });
      setTitle("");
      setPicked([]);
      await onDrawn();
      onOpen(id);
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  if (usable.length === 0) {
    return (
      <div data-tour="quiz-new">
        <Label>{t("quizView.newQuiz")}</Label>
        <Guideline tight>{t("quizView.bankEmpty")}</Guideline>
      </div>
    );
  }

  return (
    <div data-tour="quiz-new">
      <Label>{t("quizView.newQuiz")}</Label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("quizView.newQuizPlaceholder")}
        style={{ ...underlineInput, fontFamily: F.hand, fontSize: 17, maxWidth: 460 }}
      />

      <div style={{ marginTop: 14 }}>
        <Label>{t("quizView.baskets")}</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {usable.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
                title={c.blurb || undefined}
                style={{
                  ...chip,
                  ...tap,
                  cursor: "pointer",
                  color: on ? C.card : C.inkFaded,
                  background: on ? C.ink : "transparent",
                  borderColor: on ? C.ink : C.line,
                  transition: "background var(--motion-fast) var(--motion-ease)",
                }}
              >
                {c.label} · {holds(c)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 14 }}>
        <div>
          <Label>{t("quizView.levelLabel")}</Label>
          <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                style={level === l ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
              >
                {t(`quizView.difficulty.${l}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{t("quizView.sizeLabel")}</Label>
          <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                style={size === s ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button onClick={deal} style={inked(C.plum)}>
          <Plus size={12} /> {t("quizView.deal")}
        </button>
        {picked.length > 0 && available < size && (
          <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
            {t("quizView.thinBank", { available, size })}
          </span>
        )}
      </div>
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          {trouble}
        </div>
      )}
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
        {t("quizView.dealNote")}
      </div>
    </div>
  );
}
