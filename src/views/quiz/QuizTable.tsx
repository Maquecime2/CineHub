import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, inked } from "../../theme/styles";
import { Confirmation, Guideline, Meter, type ConfirmRequest } from "../../components/ui";
import { Layer } from "../../components/ui/Layer";
import { useSay } from "../../components/ui/Feedback";
import { Stamp } from "../../components/atmosphere/hall";
import { PowerBar } from "../../components/play/PowerBar";
import { useDialog } from "../../hooks/useDialog";
import type { Gain } from "../../domain/points";
import { refreshPurse } from "../../hooks/usePurse";
import {
  answerQuiz,
  finishQuiz,
  halveQuestion,
  myHoldings,
  readQuiz,
  redoQuestion,
  startQuiz,
  type Quiz,
  type QuizQuestion,
} from "../../services/server";
import { Asked } from "./Asked";
import { Correction } from "./Correction";
import { Guests } from "./Guests";
import { Scoreboard } from "./Scoreboard";

/* ------------------------------------------------------------
   PLAYING ONE — and it takes the screen
   ------------------------------------------------------------
   UN JEU DEMANDE L'ÉCRAN ; CELUI-CI DEMANDAIT UN PARAGRAPHE. La partie
   se jouait dans un accordéon — cette moitié de fichier était rendue
   DANS une ligne de liste, sous le formulaire de tirage et au-dessus de
   la banque d'admin. On répondait à une question de cinéma en regardant
   par-dessus son épaule le bouton « tenir la banque ». C'est une couche
   maintenant, et c'est la seule chose qui change le sentiment de jouer.

   `Layer` N'EST PAS UN CHOIX : la colonne de vue est un contexte
   d'empilement et porte une transformation pendant son animation
   d'entrée, donc un `position: fixed` rendu dedans s'ancre sur la
   colonne et non sur la fenêtre. Le budget de `z-index` du projet met la
   modale à 50 — la carte de confirmation est à 60, ce qui est exactement
   ce qu'il faut : l'abandon se demande PAR-DESSUS la partie.

   L'ARIA EST ÉCRIT ICI, À LA MAIN. `useDialog` piège le focus, le rend
   au bouton qui l'a ouvert, et ne pose AUCUN attribut — son en-tête le
   dit. `role`, `aria-modal` et `aria-labelledby` sont du JSX.

   ON NE FERME PAS, ON DEMANDE. Une partie en cours qu'un `Escape`
   refermerait sans un mot est une partie qu'on croit avoir mise de côté
   et qu'on a laissée ouverte au serveur. Une partie CLOSE, elle, se
   referme d'un geste : il n'y a plus rien à abandonner.

   One question at a time, and an answer that goes down and stays down.
   The screen does not ask for confirmation, because the sentence under
   the propositions has already said what clicking means — and asking
   twice for every question of twenty would be worse than the mistake it
   guards against. */

export function QuizTable({
  quiz,
  onChange,
  onClose,
}: {
  quiz: Quiz;
  onChange: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const say = useSay();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [weight, setWeight] = useState(0);
  const [finished, setFinished] = useState(quiz.finished === true);
  const [busy, setBusy] = useState(false);
  /* THE LEADERBOARD IS READ ONCE PER QUIZ, AND A QUIZ HAS ONE ID.
     Which meant it was read once, full stop: closing one's attempt
     changed nothing on screen — the score one had just earned appeared
     only after a reload, and the natural reading of that is that the
     answers were not counted. This counts the moments the board has
     something new to say, and is what the board watches. */
  const [round, setRound] = useState(0);
  const again = useCallback(() => setRound((n) => n + 1), []);

  /* CE QUE LA PARTIE A COÛTÉ ET RAPPORTÉ. Les pouvoirs sont lus au
     serveur — ce qu'on croit posséder ne décide de rien, il refusera
     tout seul — et l'aide prise est gardée PAR QUESTION : le serveur
     rend toujours les deux mêmes propositions écartées, donc revenir
     sur une question ne rebat pas les cartes. */
  const [powers, setPowers] = useState<Record<string, number>>({});
  const [hidden, setHidden] = useState<Record<string, string[]>>({});
  const [gains, setGains] = useState<Gain[]>([]);
  /* LA QUESTION SUR LAQUELLE ON VIENT DE POSER. Elle ne sert qu'au
     tampon, et elle s'efface toute seule : la question suivante n'a pas
     cet identifiant. Aucun minuteur, donc rien à annuler au démontage. */
  const [laid, setLaid] = useState<string | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const reread = useCallback(async () => {
    const r = await readQuiz(quiz.id);
    setQuestions(r.questions);
    setPlayers(r.players);
    setWeight(r.weight);
    setFinished(r.attempt?.finished_at != null);
    /* Un comptoir qui se tait ne doit pas empêcher de jouer : sans
       pouvoirs, la barre ne se dessine simplement pas. */
    myHoldings()
      .then((h) => setPowers(h.powers))
      .catch(() => setPowers({}));
  }, [quiz.id]);

  useEffect(() => {
    /* Opening the attempt is what the first look does: there is no
       "start" button to press, and pressing it twice would have been
       one more thing to explain. It is idempotent server-side. */
    startQuiz(quiz.id)
      .then(reread)
      .catch(() => {});
  }, [quiz.id, reread]);

  const answered = questions.filter((q) => q.mine != null).length;
  const current = questions.find((q) => q.mine == null);

  /* CE QU'ON PERD EN PARTANT, ET RIEN DE PLUS. Une partie close n'a
     plus rien à abandonner : la refermer est un geste ordinaire. */
  const leave = useCallback(() => {
    if (finished || answered === questions.length) {
      onClose();
      return;
    }
    setRequest({
      title: t("quizView.abandonTitle"),
      body: t("quizView.abandonBody"),
      action: t("quizView.abandonAction"),
      onConfirm: onClose,
    });
  }, [finished, answered, questions.length, onClose, t]);

  const box = useDialog(leave, { autoFocus: false });

  const lay = async (questionId: string, choiceId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerQuiz(quiz.id, questionId, choiceId);
      /* LE TAMPON DIT UN MOT, ET JAMAIS UN VERDICT. Les bonnes réponses
         ne sont RÉELLEMENT pas connues d'ici avant la fin —
         `drawnQuestions` n'étale `is_right` que si `withAnswers` — donc
         « juste » ou « faux » serait inventé. « Posée » est vrai, et
         c'est le retour qui manquait entièrement. */
      setLaid(questionId);
      say(t("quizView.laidSaid"));
      await reread();
      /* One's own bar moves as one plays: the board shows the running
         score of whoever has not finished, and it would otherwise stay
         at whatever it was when the screen opened — zero. */
      again();
    } catch {
      /* Already answered, or the attempt closed underneath us — either
         way the truth is on the server, so we go and read it. */
      await reread().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    const r = await finishQuiz(quiz.id);
    setQuestions(r.questions);
    setFinished(true);
    /* Ce que le serveur a RÉELLEMENT crédité, et pas ce que le barème
       laissait espérer : une partie close deux fois ne paie qu'une. */
    setGains(r.gains ?? []);
    again();
    await refreshPurse();
    await onChange();
  };

  /* Un pouvoir se dépense sur le serveur, jamais ici. On ne fait que
     ranger ce qu'il répond — et s'il refuse, on relit plutôt que de
     deviner : c'est lui qui compte les pouvoirs, pas cet écran. */
  const spend = async (power: "halve" | "redo") => {
    if (!current || busy) return;
    setBusy(true);
    try {
      if (power === "halve") {
        const r = await halveQuestion(quiz.id, current.id);
        setHidden((was) => ({ ...was, [current.id]: r.removed }));
        setPowers((was) => ({ ...was, halve: r.left }));
      } else {
        const r = await redoQuestion(quiz.id, current.id);
        setPowers((was) => ({ ...was, redo: r.left }));
        await reread();
      }
    } catch {
      await reread().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const titleId = `quiz-table-${quiz.id}`;

  return (
    <Layer>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(20,14,8,0.62)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflowY: "auto",
          padding: "clamp(10px, 4vh, 46px) 14px",
        }}
      >
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-tour="quiz-playing"
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 640,
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: "4px 12px 34px rgba(20,14,8,0.5)",
            padding: "18px 20px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              id={titleId}
              style={{
                flex: 1,
                fontFamily: F.title,
                fontStyle: "italic",
                fontSize: 24,
                color: C.ink,
              }}
            >
              {quiz.title}
            </span>
            <button onClick={leave} title={t("quizView.leaveGame")} style={bare}>
              <X size={15} />
            </button>
          </div>

          {quiz.softened && <Guideline tight>{t("quizView.softened")}</Guideline>}

          {finished ? (
            <>
              <Guideline tight>{t("quizView.overForYou")}</Guideline>
              <Correction questions={questions} weight={weight} gains={gains} />
            </>
          ) : (
            <>
              {/* LA BARRE SEULE, SANS NOM : `Meter` sait déjà le faire, et
                  une progression n'appartient à personne. Elle remplace la
                  ligne mono « 3 sur 20 », qui disait le même chiffre sans
                  le montrer. */}
              <div style={{ marginTop: 10, marginBottom: 4 }}>
                <Meter done={answered} total={questions.length} ink={C.plum} />
              </div>
              {current ? (
                /* LA CLÉ EST LA QUESTION. Sans elle, React réutilise le
                   même nœud et la nouvelle question apparaît dans
                   l'ancienne fiche, sans que rien ne bouge ; avec elle,
                   la fiche est un objet qu'on remplace. `sheetIn` existe
                   déjà et dit exactement cela ; les durées viennent des
                   jetons, donc `prefers-reduced-motion` les met à zéro
                   sans qu'on s'en occupe. */
                <div
                  key={current.id}
                  style={{
                    position: "relative",
                    animation: "sheetIn var(--motion-slow) var(--motion-ease) both",
                  }}
                >
                  <Asked
                    question={current}
                    busy={busy}
                    removed={hidden[current.id] ?? []}
                    onPick={(c) => lay(current.id, c)}
                  />
                  {laid === current.id && (
                    <span style={{ position: "absolute", right: 14, top: 22 }}>
                      <Stamp text={t("quizView.laid")} ink={C.plum} tilt={-8} />
                    </span>
                  )}
                  <PowerBar
                    powers={powers}
                    used={hidden[current.id] ? ["halve"] : []}
                    onUse={spend}
                    onBought={reread}
                    busy={busy}
                    tour="quiz-powers"
                  />
                </div>
              ) : (
                <Guideline tight>{t("quizView.allAnswered")}</Guideline>
              )}
              <button onClick={close} style={{ ...inked(C.burgundy), marginTop: 16 }}>
                {t("quizView.finish")}
              </button>
              <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
                {t("quizView.finishNote")}
              </div>
            </>
          )}

          <Scoreboard quiz={quiz} weight={weight} round={round} />
          {/* EFFACER LA SOIRÉE FERME LA COUCHE. Sans cette ligne, on
              reste devant une partie que le serveur ne connaît plus, et
              le premier geste répond 404. */}
          {quiz.mine && (
            <Guests
              quiz={quiz}
              players={players}
              onChange={reread}
              onGone={async () => {
                await onChange();
                onClose();
              }}
            />
          )}
        </div>
      </div>
      <Confirmation request={request} onClose={() => setRequest(null)} />
    </Layer>
  );
}
