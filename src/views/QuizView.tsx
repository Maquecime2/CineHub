/* ============================================================
   THE QUIZZES — a bank, and evenings dealt out of it
   ============================================================

   A CHALLENGE ASKS THE BINDER HOW FAR ONE GOT; A QUIZ ASKS THE PERSON.

   THE SHAPE THAT DECIDES THIS SCREEN: NOBODY WRITES A QUIZ. An admin
   fills a bank — baskets of questions, each easy, middling or hard — and
   anybody deals an evening out of it in three clicks: some baskets, a
   level, a length. So there are two screens here and they barely touch.
   The composing form is for everybody; the bank is for whoever may fill
   it, and it is ABSENT rather than greyed out for everybody else.

   AND WHOEVER DEALT A QUIZ PLAYS IT LIKE ANYBODY ELSE. They did not
   write the questions, so there is no carve-out anywhere below: no
   preview of the answers, no rehearsal, a real score in the leaderboard.
   The version of this file that had an author had all three, and each
   one was a thing to remember not to leak.

   THE RIGHT ANSWERS ARE NOT HIDDEN BY THIS FILE. They are not in the
   reply until an attempt is closed. Nothing here could put that back.

   THIS VIEW SHOWS NOTHING WITHOUT AN ACCOUNT, and says so in one
   sentence rather than offer dead buttons.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Check, Library, Pencil, Plus, Puzzle, Trash2, Undo2, UserPlus, X } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { bare, chip, hollow, inked, tap, underlineInput } from "../theme/styles";
import { Guideline, Label, Meter, ViewHeading } from "../components/ui";
import { FileNumber, InkUnderline } from "../components/atmosphere";
import { Fold, Halftone, Stamp, Staple, perforated } from "../components/atmosphere/hall";
import { PowerBar } from "../components/play/PowerBar";
import { tiltOf } from "../domain/seeded";
import type { Gain } from "../domain/points";
import { refreshPurse } from "../hooks/usePurse";
import {
  addBankQuestion,
  answerQuiz,
  bankQuestions,
  createCategory,
  deleteCategory,
  deleteQuiz,
  drawQuiz,
  editBankQuestion,
  finishQuiz,
  halveQuestion,
  myHoldings,
  redoQuestion,
  iAmAdmin,
  invitePlayer,
  myQuizzes,
  quizCategories,
  quizScores,
  readQuiz,
  removeBankQuestion,
  removePlayer,
  reviveBankQuestion,
  serverConfigured,
  startQuiz,
  type BankQuestion,
  type Category,
  type QuestionDraft,
  type Quiz,
  type QuizQuestion,
  type QuizScore,
} from "../services/server";

/** The three levels and the three lengths. The server agrees, and says so. */
const LEVELS = ["easy", "normal", "hard"] as const;
const SIZES = [10, 20, 30] as const;

/** Can this basket give anything at all? An empty one is not offered. */
const holds = (c: Category) => c.easy + c.normal + c.hard;

export function QuizView({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const [tendingBank, setTendingBank] = useState(false);

  const reread = useCallback(async () => {
    if (!connected) return;
    const [q, c] = await Promise.all([myQuizzes(), quizCategories()]);
    setQuizzes(q.quizzes);
    setCategories(c.categories);
  }, [connected]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

  if (!serverConfigured()) {
    return (
      <Page>
        <Guideline tight>{t("quizView.noServer")}</Guideline>
      </Page>
    );
  }

  if (!connected) {
    return (
      <Page>
        <Guideline tight>{t("quizView.noAccount")}</Guideline>
      </Page>
    );
  }

  const mine = quizzes.filter((q) => q.mine);
  const given = quizzes.filter((q) => !q.mine);

  return (
    <Page>
      {/* THE ONE PLACE THE ROLE SHOWS, and it shows by being there or
          not. `iAmAdmin` is a hunch read from the remembered account; it
          decides what is drawn, never what is written — every route
          below asks the server again. */}
      {iAmAdmin() && (
        <div data-tour="quiz-bank" style={{ marginBottom: 26 }}>
          <button
            onClick={() => setTendingBank(!tendingBank)}
            style={tendingBank ? inked(C.ink) : { ...inked(C.ink), ...hollow }}
          >
            <Library size={12} /> {t("quizView.tendBank")}
          </button>
          {tendingBank && <Bank categories={categories} onChange={reread} />}
        </div>
      )}

      <Composer categories={categories} onDrawn={reread} onOpen={setOpened} />

      <div data-tour="quiz-mine" style={{ marginTop: 34 }}>
        <Label>{t("quizView.yours")}</Label>
        {mine.length === 0 && <Guideline tight>{t("quizView.noneDealt")}</Guideline>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {mine.map((q) => (
            <OneQuiz
              key={q.id}
              quiz={q}
              opened={opened === q.id}
              onToggle={() => setOpened(opened === q.id ? null : q.id)}
              onChange={reread}
            />
          ))}
        </div>
      </div>

      <div data-tour="quiz-given" style={{ marginTop: 30 }}>
        <Label>{t("quizView.given")}</Label>
        {given.length === 0 && <Guideline tight>{t("quizView.noneGiven")}</Guideline>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {given.map((q) => (
            <OneQuiz
              key={q.id}
              quiz={q}
              opened={opened === q.id}
              onToggle={() => setOpened(opened === q.id ? null : q.id)}
              onChange={reread}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------
   COMPOSING ONE — three clicks, and the deal is made
   ------------------------------------------------------------
   AN EMPTY BASKET IS NOT OFFERED. Ticking something that can give
   nothing is a dead end one only discovers at the end, so it is not
   drawn at all — the same reasoning that keeps this whole tab away from
   somebody with no server. */

function Composer({
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

/* ------------------------------------------------------------
   ONE QUIZ
   ------------------------------------------------------------ */

function OneQuiz({
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
      <div
        onClick={onToggle}
        style={{
          ...tap,
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
      </div>
      {opened && <Playing quiz={quiz} onChange={onChange} />}
    </div>
  );
}

/* ------------------------------------------------------------
   PLAYING ONE
   ------------------------------------------------------------
   One question at a time, and an answer that goes down and stays down.
   The screen does not ask for confirmation, because the sentence under
   the propositions has already said what clicking means — and asking
   twice for every question of twenty would be worse than the mistake it
   guards against. */

function Playing({ quiz, onChange }: { quiz: Quiz; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
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

  const lay = async (questionId: string, choiceId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await answerQuiz(quiz.id, questionId, choiceId);
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

  return (
    <div data-tour="quiz-playing" style={{ borderTop: `1px solid ${C.line}`, padding: 13 }}>
      {quiz.softened && <Guideline tight>{t("quizView.softened")}</Guideline>}

      {finished ? (
        <>
          <Guideline tight>{t("quizView.overForYou")}</Guideline>
          <Correction questions={questions} weight={weight} gains={gains} />
        </>
      ) : (
        <>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
            {t("quizView.progress", { done: answered, total: questions.length })}
          </div>
          {current ? (
            <>
              <Asked
                question={current}
                busy={busy}
                removed={hidden[current.id] ?? []}
                onPick={(c) => lay(current.id, c)}
              />
              <PowerBar
                powers={powers}
                used={hidden[current.id] ? ["halve"] : []}
                onUse={spend}
                busy={busy}
                tour="quiz-powers"
              />
            </>
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
      {quiz.mine && <Guests quiz={quiz} players={players} onChange={reread} onGone={onChange} />}
    </div>
  );
}

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
function Asked({
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
function Correction({
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

/* Only the people invited, and never anybody blocked either way — the
   server sees to both, and this file only draws what it sent. */
function Scoreboard({
  quiz,
  weight,
  /* Not a value, a signal: it says "there is something new to read", and
     the quiz's id alone never said it. */
  round,
}: {
  quiz: Quiz;
  weight: number;
  round: number;
}) {
  const { t } = useTranslation();
  const [scores, setScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    let alive = true;
    quizScores(quiz.id)
      .then((r) => {
        if (alive) setScores(r.scores);
      })
      .catch(() => {
        /* A refusal empties the board; a refusal that comes back AFTER a
           later reading must not. */
        if (alive) setScores([]);
      });
    return () => {
      alive = false;
    };
  }, [quiz.id, round]);

  return (
    <div data-tour="quiz-scores" style={{ marginTop: 18 }}>
      <Label>{t("quizView.scores")}</Label>
      {scores.length === 0 && <Guideline tight>{t("quizView.nobodyPlayed")}</Guideline>}
      {/* The whole here is WHAT THE QUIZ IS WORTH, and not the best of
          the scores — see `Meter`, which carries that decision now. */}
      {scores.map((s) => (
        <Meter
          key={s.pseudo}
          name={s.pseudo}
          done={s.score}
          total={weight}
          faded={!s.finished}
          note={s.finished ? undefined : t("quizView.stillPlaying")}
        />
      ))}
    </div>
  );
}

/** Who was invited — the dealer's business, and nobody else's. */
function Guests({
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
              onClick={() => removePlayer(quiz.id, p).then(onChange)}
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
          onClick={() => deleteQuiz(quiz.id).then(onGone)}
          title={t("quizView.deleteQuiz")}
          style={{ ...bare, color: C.burgundy }}
        >
          <Trash2 size={13} />
        </button>
      </div>
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          {trouble}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   THE BANK — the reserved half
   ------------------------------------------------------------ */

function Bank({ categories, onChange }: { categories: Category[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);

  const make = async () => {
    const name = label.trim();
    if (!name) return;
    setTrouble(null);
    try {
      const { id } = await createCategory({ label: name });
      setLabel("");
      await onChange();
      setOpened(id);
    } catch (e) {
      setTrouble((e as Error).message);
    }
  };

  return (
    <div style={{ border: `1px solid ${C.ink}`, padding: 13, marginTop: 12 }}>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded }}>
        {t("quizView.bankNote")}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10 }}>
        <div style={{ maxWidth: 300, flex: 1 }}>
          <Label>{t("quizView.newCategory")}</Label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && make()}
            placeholder={t("quizView.newCategoryPlaceholder")}
            style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16 }}
          />
        </div>
        <button onClick={make} style={inked(C.ink)}>
          <Plus size={12} /> {t("quizView.addCategory")}
        </button>
      </div>
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          {trouble}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {categories.length === 0 && <Guideline tight>{t("quizView.noCategories")}</Guideline>}
        {categories.map((c) => (
          <OneCategory
            key={c.id}
            category={c}
            opened={opened === c.id}
            onToggle={() => setOpened(opened === c.id ? null : c.id)}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function OneCategory({
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

  const reread = useCallback(async () => {
    if (!opened) return;
    const r = await bankQuestions(category.id);
    setQuestions(r.questions);
  }, [category.id, opened]);

  useEffect(() => {
    reread().catch(() => {});
  }, [reread]);

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
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {questions.length === 0 && <Guideline tight>{t("quizView.noQuestions")}</Guideline>}
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

/* ------------------------------------------------------------
   ONE QUESTION, BEING WRITTEN
   ------------------------------------------------------------ */

function QuestionEditor({
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

/** What each level is worth. The same table as `quiz_points` in SQL. */
const POINTS: Record<string, number> = { easy: 1, normal: 2, hard: 3 };

/* The head of the view. Only the icon, the tint and the two sentences
   belong to the quiz; the rest is `ViewHeading`, shared with the lists
   and the counter. It stays a local name because three places call it. */
const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <ViewHeading
      icon={<Puzzle size={22} color={C.plum} />}
      title={t("quizView.heading")}
      blurb={t("quizView.subheading")}
    >
      {children}
    </ViewHeading>
  );
};
