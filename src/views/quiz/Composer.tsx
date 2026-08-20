/* ------------------------------------------------------------
   COMPOSING ONE — three clicks, and the deal is made
   ------------------------------------------------------------
   C'ÉTAIT UN FORMULAIRE OUVERT EN HAUT DE LA VUE. Un titre, une rangée
   de paniers, trois rangées d'options et deux paragraphes d'explication
   — la moitié de l'écran, en permanence, devant quelqu'un qui venait
   voir si on l'avait invité à un quizz. Le premier regard tombait sur
   des réglages qu'on n'avait pas demandés.

   C'EST UNE FEUILLE MAINTENANT, et la porte est un bouton. Les deux
   paragraphes restent : ils disent ce que le chronomètre coûte et ce que
   « figé » veut dire, et ce sont exactement les choses qu'on veut lire
   au moment de tirer — pas avant, pas ailleurs.

   AN EMPTY BASKET IS NOT OFFERED. Ticking something that can give
   nothing is a dead end one only discovers at the end, so it is not
   drawn at all — the same reasoning that keeps this whole tab away from
   somebody with no server. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { chip, hollow, inked, tap, underlineInput } from "../../theme/styles";
import { Guideline, Label, Trouble } from "../../components/ui";
import { Sheet } from "../../components/ui/Sheet";
import { drawQuiz, type Category } from "../../services/server";
import { LEVELS } from "./shared";

/** The three lengths. The server agrees, and says so. */
const SIZES = [10, 20, 30] as const;

/** Can this basket give anything at all? An empty one is not offered. */
const holds = (c: Category) => c.easy + c.normal + c.hard;

/* LES DÉLAIS OFFERTS, ET « SANS » EN PREMIER. `null` est le défaut et le
   restera : un chronomètre qu'on subit sans l'avoir demandé n'est pas la
   même soirée. Les bornes du schéma sont 5 et 600 — ces quatre valeurs
   sont dedans, et le serveur refuse le reste de toute façon. */
const PACES = [null, 20, 45, 90] as const;

export function Composer({
  categories,
  onDrawn,
  onOpen,
  onClose,
}: {
  categories: Category[];
  onDrawn: () => Promise<void>;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [level, setLevel] = useState<string>("normal");
  const [size, setSize] = useState<number>(10);
  const [pace, setPace] = useState<number | null>(null);
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
      const { id } = await drawQuiz({
        title: name,
        categoryIds: picked,
        level,
        size,
        secondsPerQuestion: pace,
      });
      setTitle("");
      setPicked([]);
      await onDrawn();
      /* LA FEUILLE SE REFERME SUR CE QU'ELLE A FAIT. Rester devant le
         formulaire après un tirage laisse croire qu'il n'a pas eu lieu,
         alors que la partie vient de s'ouvrir derrière. */
      onClose();
      onOpen(id);
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  if (usable.length === 0) {
    return (
      <Sheet title={t("quizView.newQuiz")} width={620} onClose={onClose}>
        <Guideline tight>{t("quizView.bankEmpty")}</Guideline>
      </Sheet>
    );
  }

  return (
    <Sheet title={t("quizView.newQuiz")} width={620} onClose={onClose}>
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
        <div>
          <Label>{t("quizView.paceLabel")}</Label>
          <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
            {PACES.map((p) => (
              <button
                key={p ?? "none"}
                onClick={() => setPace(p)}
                style={pace === p ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
              >
                {p === null ? t("quizView.paceNone") : t("quizView.paceSeconds", { n: p })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DEUX AVEUX PLUTÔT QUE DEUX SURPRISES. Un chronomètre se dit ici
          ET avant de commencer, parce que la conséquence n'est pas
          devinable : acheter un pouvoir consomme du temps, et un réseau
          lent coûte. Les cacher aurait fait payer les deux à quelqu'un
          qui n'avait pas choisi. */}
      {pace !== null && (
        <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 10 }}>
          {t("quizView.paceWarning")}
        </div>
      )}

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
      {/* Le tirage a été refusé, et le dire est le minimum : sans rôle,
          l'écran ne bougeait pas et le bouton semblait mort. */}
      <Trouble>{trouble}</Trouble>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
        {t("quizView.dealNote")}
      </div>
    </Sheet>
  );
}
