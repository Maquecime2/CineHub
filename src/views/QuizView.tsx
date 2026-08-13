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
import { tap, underlineInput } from "../theme/styles";
import { Label } from "../components/ui";
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
        <Guideline>{t("quizView.noServer")}</Guideline>
      </Page>
    );
  }

  if (!connected) {
    return (
      <Page>
        <Guideline>{t("quizView.noAccount")}</Guideline>
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
            style={tendingBank ? button(C.ink) : { ...button(C.ink), ...ghost }}
          >
            <Library size={12} /> {t("quizView.tendBank")}
          </button>
          {tendingBank && <Bank categories={categories} onChange={reread} />}
        </div>
      )}

      <Composer categories={categories} onDrawn={reread} onOpen={setOpened} />

      <div data-tour="quiz-mine" style={{ marginTop: 34 }}>
        <Label>{t("quizView.yours")}</Label>
        {mine.length === 0 && <Guideline>{t("quizView.noneDealt")}</Guideline>}
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
        {given.length === 0 && <Guideline>{t("quizView.noneGiven")}</Guideline>}
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
        <Guideline>{t("quizView.bankEmpty")}</Guideline>
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
                  ...token,
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
                style={level === l ? button(C.ink) : { ...button(C.ink), ...ghost }}
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
                style={size === s ? button(C.ink) : { ...button(C.ink), ...ghost }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button onClick={deal} style={button(C.plum)}>
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
          <span key={c} style={token}>
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

  const reread = useCallback(async () => {
    const r = await readQuiz(quiz.id);
    setQuestions(r.questions);
    setPlayers(r.players);
    setWeight(r.weight);
    setFinished(r.attempt?.finished_at != null);
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
    await onChange();
  };

  return (
    <div data-tour="quiz-playing" style={{ borderTop: `1px solid ${C.line}`, padding: 13 }}>
      {quiz.softened && <Guideline>{t("quizView.softened")}</Guideline>}

      {finished ? (
        <>
          <Guideline>{t("quizView.overForYou")}</Guideline>
          <Correction questions={questions} weight={weight} />
        </>
      ) : (
        <>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
            {t("quizView.progress", { done: answered, total: questions.length })}
          </div>
          {current ? (
            <Asked question={current} busy={busy} onPick={(c) => lay(current.id, c)} />
          ) : (
            <Guideline>{t("quizView.allAnswered")}</Guideline>
          )}
          <button onClick={close} style={{ ...button(C.burgundy), marginTop: 16 }}>
            {t("quizView.finish")}
          </button>
          <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 6 }}>
            {t("quizView.finishNote")}
          </div>
        </>
      )}

      <Scoreboard quiz={quiz} weight={weight} />
      {quiz.mine && <Guests quiz={quiz} players={players} onChange={reread} onGone={onChange} />}
    </div>
  );
}

/** ONE QUESTION, ASKED. The only screen there is — nobody gets another. */
function Asked({
  question,
  busy,
  onPick,
}: {
  question: QuizQuestion;
  busy: boolean;
  onPick: (choiceId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
        {question.category} · {t("quizView.points", { count: question.points })}
      </div>
      <div style={{ fontFamily: F.body, fontSize: 18, color: C.ink, marginTop: 4 }}>
        {question.ask}
      </div>
      {question.image && (
        <img
          src={question.image}
          alt=""
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 260,
            marginTop: 10,
            border: `1px solid ${C.line}`,
          }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
        {question.choices.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              ...tap,
              all: "unset" as const,
              cursor: busy ? "wait" : "pointer",
              padding: "9px 12px",
              border: `1px solid ${C.line}`,
              background: C.paper,
              fontFamily: F.body,
              fontSize: 16,
              color: C.ink,
              transition: "background var(--motion-fast) var(--motion-ease)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 8 }}>
        {t("quizView.noTakingBack")}
      </div>
    </div>
  );
}

/** What one got right, once it is too late to change any of it. */
function Correction({ questions, weight }: { questions: QuizQuestion[]; weight: number }) {
  const { t } = useTranslation();
  const score = questions.reduce(
    (n, q) => n + (q.choices.find((c) => c.is_right)?.id === q.mine ? q.points : 0),
    0
  );
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.ink }}>
        {t("quizView.yourScore", { score, weight })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {questions.map((q) => {
          const right = q.choices.find((c) => c.is_right);
          const got = q.mine != null && right?.id === q.mine;
          return (
            <div
              key={q.id}
              style={{ borderLeft: `2px solid ${got ? C.pine : C.burgundy}`, paddingLeft: 10 }}
            >
              <div style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{q.ask}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded, marginTop: 3 }}>
                {got
                  ? t("quizView.gotIt", { points: q.points })
                  : t("quizView.missedIt", { answer: right?.label ?? "—" })}
              </div>
              {q.hint && (
                <div style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, marginTop: 3 }}>
                  {q.hint}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Only the people invited, and never anybody blocked either way — the
   server sees to both, and this file only draws what it sent. */
function Scoreboard({ quiz, weight }: { quiz: Quiz; weight: number }) {
  const { t } = useTranslation();
  const [scores, setScores] = useState<QuizScore[]>([]);

  useEffect(() => {
    quizScores(quiz.id)
      .then((r) => setScores(r.scores))
      .catch(() => setScores([]));
  }, [quiz.id]);

  return (
    <div data-tour="quiz-scores" style={{ marginTop: 18 }}>
      <Label>{t("quizView.scores")}</Label>
      {scores.length === 0 && <Guideline>{t("quizView.nobodyPlayed")}</Guideline>}
      {scores.map((s) => (
        <div key={s.pseudo} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <span
            style={{ fontFamily: F.mono, fontSize: 10.5, color: C.ink, width: 110, flexShrink: 0 }}
          >
            {s.pseudo}
          </span>
          <span
            style={{
              flex: 1,
              height: 7,
              background: alpha(C.ink, 0.08),
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Against what the QUIZ is worth, not against the best
                score: a bar that filled the width because everybody did
                badly would flatter the whole table. */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                right: "auto",
                width: `${weight ? (100 * s.score) / weight : 0}%`,
                background: s.finished ? C.burgundy : alpha(C.burgundy, 0.4),
                transition: "width var(--motion-slow) var(--motion-ease)",
              }}
            />
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
            {s.score}/{weight}
            {!s.finished && ` · ${t("quizView.stillPlaying")}`}
          </span>
        </div>
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
          <span key={p} style={token}>
            {p}
            <button
              onClick={() => removePlayer(quiz.id, p).then(onChange)}
              title={t("quizView.removePlayer")}
              style={small}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {players.length === 0 && <Guideline>{t("quizView.nobodyYet")}</Guideline>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 8 }}>
        <input
          value={invitee}
          onChange={(e) => setInvitee(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder={t("quizView.invitePlaceholder")}
          style={{ ...underlineInput, fontFamily: F.hand, fontSize: 16, maxWidth: 220 }}
        />
        <button onClick={invite} style={button(C.ink)}>
          <UserPlus size={12} /> {t("quizView.invite")}
        </button>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => deleteQuiz(quiz.id).then(onGone)}
          title={t("quizView.deleteQuiz")}
          style={{ ...small, color: C.burgundy }}
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
        <button onClick={make} style={button(C.ink)}>
          <Plus size={12} /> {t("quizView.addCategory")}
        </button>
      </div>
      {trouble && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.burgundy, marginTop: 8 }}>
          {trouble}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {categories.length === 0 && <Guideline>{t("quizView.noCategories")}</Guideline>}
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
            {questions.length === 0 && <Guideline>{t("quizView.noQuestions")}</Guideline>}
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
                  <span style={{ ...token, borderColor: C.line }}>
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
                    style={small}
                  >
                    <Pencil size={12} />
                  </button>
                  {q.retired ? (
                    <button
                      onClick={() =>
                        reviveBankQuestion(category.id, q.id).then(reread).then(onChange)
                      }
                      title={t("quizView.revive")}
                      style={small}
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
                      style={{ ...small, color: C.burgundy }}
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
              <button onClick={() => setWriting(true)} style={button(C.ink)}>
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
                style={{ ...small, color: C.burgundy }}
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
              style={difficulty === l ? button(C.ink) : { ...button(C.ink), ...ghost }}
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
                ...small,
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
              style={small}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setChoices([...choices, { label: "", is_right: false }])}
          style={{ ...small, fontFamily: F.mono, fontSize: 10, marginTop: 6 }}
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
        <button onClick={save} style={button(C.ink)}>
          {t("quizView.save")}
        </button>
        <button onClick={onCancel} style={{ ...button(C.ink), ...ghost }}>
          {t("quizView.cancel")}
        </button>
      </div>
    </div>
  );
}

/** What each level is worth. The same table as `quiz_points` in SQL. */
const POINTS: Record<string, number> = { easy: 1, normal: 2, hard: 3 };

const Page = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "34px 24px 70px", maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <Puzzle size={22} color={C.plum} />
        <h1
          style={{
            margin: 0,
            fontFamily: F.title,
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: 34,
            color: C.ink,
          }}
        >
          {t("quizView.heading")}
        </h1>
      </div>
      <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginBottom: 24 }}>
        {t("quizView.subheading")}
      </div>
      {children}
    </div>
  );
};

const Guideline = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginTop: 8 }}>
    {children}
  </div>
);

const button = (ink: string) => ({
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  gap: 6,
  padding: "7px 12px",
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 1,
  color: C.card,
  background: ink,
  border: `1px solid ${ink}`,
});

/** The same button, hollow: a second choice beside a first one. */
const ghost = {
  color: C.ink,
  background: "transparent",
  border: `1px solid ${C.line}`,
};

const small = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  color: C.inkFaded,
};

const token = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 8px",
  border: `1px solid ${C.line}`,
  fontFamily: F.mono,
  fontSize: 10,
  color: C.inkFaded,
};
