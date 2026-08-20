import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { InkUnderline } from "../../components/atmosphere";
import { Stamp } from "../../components/atmosphere/hall";
import type { QuizQuestion } from "../../services/server";

/* WHAT ONE GOT RIGHT, once it is too late to change any of it.

   C'EST LE SECOND TEMPS, ET IL NE L'A PAS TOUJOURS ÉTÉ. Ce composant
   ouvrait la fin de partie sur un chiffre de quarante-deux pixels, puis
   enchaînait sans respirer sur la liste des questions manquées : on
   lisait sa note et ses erreurs dans le même mouvement, et le résultat
   se lisait comme un bulletin. Le chiffre, les gains et le mot sont
   partis dans `Curtain`, qui vient AU-DESSUS ; il ne reste ici que le
   détail, qui est ce qu'on vient relire une fois la fête passée.

   THE VERDICT IS A STAMP, NOT A COLOUR. Green for right and red for
   wrong reads well on kraft paper and disappears entirely under five of
   the fourteen skins: `nuit-americaine` and `kodachrome` both put a
   warm red next to a warm green, and `bauhaus` flattens the two into
   the same weight. A stamp carries its meaning in a WORD, and the tint
   is only there to agree with it. */
export function Correction({ questions }: { questions: QuizQuestion[] }) {
  const { t } = useTranslation();

  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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
  );
}
