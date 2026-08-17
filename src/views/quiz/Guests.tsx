import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, UserPlus, X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, chip, inked, underlineInput } from "../../theme/styles";
import { Confirmation, Guideline, Label, Trouble, type ConfirmRequest } from "../../components/ui";
import { deleteQuiz, invitePlayer, removePlayer, type Quiz } from "../../services/server";

/** Who was invited — the dealer's business, and nobody else's.

   LES DEUX RETRAITS DEMANDENT, ET CHACUN DIT CE QUI SURVIT. Ni l'un ni
   l'autre ne demandait quoi que ce soit : la corbeille effaçait la
   soirée d'un clic, pour ses invités comme pour soi, et la croix
   décommandait quelqu'un. Ils ne sont pas de la même gravité et ne
   doivent pas le paraître — effacer est SEVERE, et le mot du bouton
   n'est pas « supprimer » sur un geste qui ne supprime rien. */
export function Guests({
  quiz,
  players,
  onChange,
  onGone,
}: {
  quiz: Quiz;
  players: string[];
  onChange: () => Promise<void>;
  onGone: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [invitee, setInvitee] = useState("");
  const [trouble, setTrouble] = useState<string | null>(null);
  /* Un seul état pour les deux gestes : la carte est modale, il ne peut
     pas y en avoir deux à l'écran. */
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const invite = async () => {
    const pseudo = invitee.trim().toLowerCase();
    if (!pseudo) return;
    setTrouble(null);
    try {
      await invitePlayer(quiz.id, pseudo);
      setInvitee("");
      await onChange();
    } catch {
      setTrouble(t("quizView.nobodyToInvite", { pseudo }));
    }
  };

  return (
    <div data-tour="quiz-players" style={{ marginTop: 18 }}>
      <Label>{t("quizView.players")}</Label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {players.map((p) => (
          <span key={p} style={chip}>
            {p}
            <button
              onClick={() =>
                setRequest({
                  title: t("quizView.confirmRemoveTitle", { pseudo: p }),
                  body: t("quizView.confirmRemoveBody"),
                  action: t("quizView.confirmRemoveAction"),
                  onConfirm: () => void removePlayer(quiz.id, p).then(onChange),
                })
              }
              title={t("quizView.removePlayer")}
              style={bare}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {players.length === 0 && <Guideline tight>{t("quizView.nobodyYet")}</Guideline>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
        <input
          value={invitee}
          onChange={(e) => setInvitee(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder={t("quizView.invitePlaceholder")}
          style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, maxWidth: 220 }}
        />
        <button onClick={invite} style={inked(C.ink)}>
          <UserPlus size={12} /> {t("quizView.invite")}
        </button>
        <span style={{ flex: 1 }} />
        <button
          onClick={() =>
            setRequest({
              title: t("quizView.confirmDeleteTitle", { title: quiz.title }),
              body: t("quizView.confirmDeleteBody"),
              action: t("common.delete"),
              severe: true,
              onConfirm: () => void deleteQuiz(quiz.id).then(onGone),
            })
          }
          title={t("quizView.deleteQuiz")}
          style={{ ...bare, color: C.burgundy }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {/* IL N'ÉTAIT ANNONCÉ À PERSONNE. Un échec écrit à la main dans un
          `div` n'a pas de rôle : le lecteur d'écran ne dit rien, et le
          pseudonyme qu'on vient de taper reste dans le champ sans qu'on
          sache pourquoi. */}
      <Trouble>{trouble}</Trouble>
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </div>
  );
}
