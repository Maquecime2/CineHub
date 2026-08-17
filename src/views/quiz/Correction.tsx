import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { InkUnderline } from "../../components/atmosphere";
import { Halftone, Stamp } from "../../components/atmosphere/hall";
import type { Gain } from "../../domain/points";
import type { QuizQuestion } from "../../services/server";

/* WHAT ONE GOT RIGHT, once it is too late to change any of it — and the
   bill for it.

   THE VERDICT IS A STAMP, NOT A COLOUR. Green for right and red for
   wrong reads well on kraft paper and disappears entirely under five of
   the fourteen skins: `nuit-americaine` and `kodachrome` both put a
   warm red next to a warm green, and `bauhaus` flattens the two into
   the same weight. A stamp carries its meaning in a WORD, and the tint
   is only there to agree with it.

   THE GAINS ARE ITEMISED. "Quiz: +18, sans faute: +15" says what one did
   well; "+33" says one played. They come from the server, which is the
   only thing that knows what was actually credited — a run replayed
   after a lost connection pays nothing the second time, and the screen
   must show that rather than a rate read from a table. */
export function Correction({
  questions,
  weight,
  gains,
}: {
  questions: QuizQuestion[];
  weight: number;
  gains: readonly Gain[];
}) {
  const { t } = useTranslation();
  const score = questions.reduce(
    (n, q) => n + (q.choices.find((c) => c.is_right)?.id === q.mine ? q.points : 0),
    0
  );

  return (
    <div style={{ marginTop: 12 }}>
      {/* L'affiche de palmarès : le chiffre en grand, et ce qu'il a valu. */}
      <div
        style={{
          position: "relative",
          padding: "16px 18px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: "2px 4px 12px rgba(30,20,10,0.18)",
        }}
      >
        <Halftone size={5} />
        <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: F.title, fontSize: 42, lineHeight: 1, color: C.ink }}>
            {score}
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded }}>
            {t("quizView.outOf", { weight })}
          </span>
        </div>
        <InkUnderline width={170} />

        {gains.length > 0 && (
          <div
            style={{
              position: "relative",
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {gains.map((g) => (
              <div
                key={g.kind}
                style={{
                  display: "flex",
                  gap: 8,
                  fontFamily: F.mono,
                  fontSize: 10.5,
                  color: C.inkFaded,
                }}
              >
                <span>{t(`points.${g.kind}`)}</span>
                <span style={{ flex: 1, borderBottom: `1px dotted ${C.line}` }} />
                <span style={{ color: C.ochre }}>+{g.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {questions.map((q) => {
          const right = q.choices.find((c) => c.is_right);
          const got = q.mine != null && right?.id === q.mine;
          return (
            <div
              key={q.id}
              style={{
                position: "relative",
                borderLeft: `2px solid ${got ? C.pine : C.burgundy}`,
                paddingLeft: 11,
                paddingRight: 76,
              }}
            >
              <div style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{q.ask}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 3 }}>
                {got
                  ? t("quizView.gotIt", { points: q.points })
                  : t("quizView.missedIt", { answer: right?.label ?? "—" })}
              </div>
              {/* Un liseré d'encre sous la bonne réponse manquée : on
                  regarde ce qu'on aurait dû cocher, pas le verdict. */}
              {!got && <InkUnderline width={140} color={C.burgundy} style={{ opacity: 0.4 }} />}
              {q.hint && (
                <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 3 }}>
                  {q.hint}
                </div>
              )}
              <span style={{ position: "absolute", right: 0, top: 2 }}>
                <Stamp
                  text={got ? t("quizView.right") : t("quizView.wrong")}
                  ink={got ? C.pine : C.burgundy}
                  tilt={got ? -7 : 5}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
