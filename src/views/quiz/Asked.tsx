import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { FileNumber } from "../../components/atmosphere";
import { Fold, Staple, perforated } from "../../components/atmosphere/hall";
import { tiltOf } from "../../domain/seeded";
import type { QuizQuestion } from "../../services/server";

/* ONE QUESTION, ASKED — the programme of the evening's screening.

   A FOLDED SHEET, AND NOT A PANEL. It leans by its own sown angle, it is
   stapled at the corner, it carries a crease down the third and a strip
   of perforations along its edge: an object one has been handed, not a
   form one fills in. That is the whole of the difference between this
   screen and the one before it, and it costs four elements.

   THE ANSWERS ARE FILING CARDS. They lift when the pointer passes — the
   binder's one gesture for "this can be picked up", borrowed from the
   polaroids on the wall — and their corner is turned. A card set aside
   by a power stays in place, struck through: making it vanish would
   shift the three others under the finger about to press one. */
export function Asked({
  question,
  busy,
  removed,
  onPick,
}: {
  question: QuizQuestion;
  busy: boolean;
  /** Ce qu'un pouvoir a écarté. Le serveur en est seul juge. */
  removed: readonly string[];
  onPick: (choiceId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: "relative",
        marginTop: 14,
        padding: "14px 16px 16px 26px",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 4px 10px rgba(30,20,10,0.18)",
        transform: `rotate(${Number(tiltOf(question.id)) / 6}deg)`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 13,
          ...perforated("y", { hole: C.paperDark, pitch: 15 }),
        }}
      />
      <Staple style={{ top: 9, left: 24 }} />
      <Fold at="38%" />
      <FileNumber id={question.id} style={{ right: 10, bottom: 7 }} />

      <div style={{ position: "relative", fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
        {question.category} · {t("quizView.points", { count: question.points })}
      </div>
      <div
        style={{
          position: "relative",
          fontFamily: F.title,
          fontStyle: "italic",
          fontSize: 20,
          lineHeight: 1.3,
          color: C.ink,
          marginTop: 5,
        }}
      >
        {question.ask}
      </div>

      {question.image && (
        <img
          src={question.image}
          alt=""
          style={{
            display: "block",
            position: "relative",
            maxWidth: "100%",
            maxHeight: 260,
            marginTop: 10,
            border: `1px solid ${C.line}`,
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          marginTop: 14,
        }}
      >
        {question.choices.map((c) => {
          const out = removed.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => !out && onPick(c.id)}
              disabled={out || busy}
              style={{
                ...tap,
                all: "unset" as const,
                position: "relative",
                cursor: out ? "default" : busy ? "wait" : "pointer",
                padding: "10px 13px",
                border: `1px solid ${C.line}`,
                background: out
                  ? alpha(C.paperDark, 0.5)
                  : `linear-gradient(160deg, ${C.paper}, ${C.paperDark})`,
                fontFamily: F.body,
                fontSize: 16,
                color: out ? C.inkFaded : C.ink,
                textDecoration: out ? "line-through" : "none",
                opacity: out ? 0.55 : 1,
                boxShadow: out ? "none" : "1px 2px 3px rgba(30,20,10,0.12)",
                transition:
                  "transform var(--motion-fast) var(--motion-ease), box-shadow var(--motion-fast) var(--motion-ease)",
              }}
              onMouseEnter={(e) => {
                if (out || busy) return;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "2px 4px 8px rgba(30,20,10,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = out ? "none" : "1px 2px 3px rgba(30,20,10,0.12)";
              }}
            >
              {/* Le coin corné, emprunté au polaroid : c'est ce qui fait
                  qu'une fiche se lit comme une fiche. */}
              {!out && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 11,
                    height: 11,
                    background: `linear-gradient(135deg, transparent 50%, ${C.paperDark} 50%, ${alpha(C.ink, 0.2)} 100%)`,
                  }}
                />
              )}
              {c.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          position: "relative",
          fontFamily: F.hand,
          fontSize: 15,
          color: C.inkFaded,
          marginTop: 9,
        }}
      >
        {t("quizView.noTakingBack")}
      </div>
    </div>
  );
}
