import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   THE BANK, AND THE QUIZZES DEALT OUT OF IT

   FILLING THE BANK IS RESERVED; DRAWING FROM IT IS NOT. That split is
   the shape of the whole feature, and the first thing tried below.

   THE DEAL IS FROZEN. Everybody invited answers the same questions in
   the same order — without that, two scores are two different
   measurements and the leaderboard is decoration.

   THE RIGHT ANSWER DOES NOT COME DOWN EARLY, and here that has no
   exception at all: whoever drew the quiz did not write it, so they wait
   like everybody else. The version of this file before the bank existed
   had to carve out an author, and carving out is what one forgets.

   ONE ATTEMPT, and replaying every request must change nothing.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string, admin = false) {
  const person = await store.createPerson(db, pseudo);
  if (admin) await store.markAdmins(db, [pseudo]);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

const makeCategory = async (cookie: string, label: string) =>
  (
    await app.inject({
      method: "POST",
      url: "/categories",
      headers: { cookie },
      payload: { label },
    })
  ).json().id as string;

const addQuestion = (cookie: string, category: string, body: Record<string, unknown> = {}) =>
  app.inject({
    method: "POST",
    url: `/categories/${category}/questions`,
    headers: { cookie },
    payload: {
      ask: "Qui a réalisé Cléo de 5 à 7 ?",
      difficulty: "normal",
      choices: [
        { label: "Agnès Varda", is_right: true },
        { label: "Jacques Demy", is_right: false },
      ],
      ...body,
    },
  });

/**
 * `n` questions of one level, laid straight into the bank.
 *
 * NOT THROUGH THE ROUTE, and that is not laziness: the server allows a
 * hundred requests a minute per address, and filling a bank deep enough
 * to draw a twenty out of takes more than that. The first version of
 * this file did go through HTTP, and what it proved in the end was that
 * the rate limiter works. The routes are exercised where they are the
 * subject — above, one call at a time.
 *
 * The right answer is always the FIRST proposition, which is what lets
 * `playAll` sweep the board and the score be a known number.
 */
async function stock(category: string, difficulty: string, n: number) {
  for (let i = 0; i < n; i++) {
    const id = await store.addBankQuestion(db, category, { ask: `${difficulty} ${i}`, difficulty });
    await store.setChoices(db, id, [
      { label: "Agnès Varda", is_right: true },
      { label: "Jacques Demy", is_right: false },
    ]);
  }
}

const draw = (cookie: string, body: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/quizzes",
    headers: { cookie },
    payload: { title: "Un soir", level: "normal", size: 10, ...body },
  });

const readQuiz = (cookie: string, quiz: string) =>
  app.inject({ method: "GET", url: `/quizzes/${quiz}`, headers: { cookie } });

const invite = (cookie: string, quiz: string, pseudo: string) =>
  app.inject({ method: "PUT", url: `/quizzes/${quiz}/players/${pseudo}`, headers: { cookie } });

const start = (cookie: string, quiz: string) =>
  app.inject({ method: "POST", url: `/quizzes/${quiz}/attempt`, headers: { cookie } });

const reply_ = (cookie: string, quiz: string, questionId: string, choiceId: string) =>
  app.inject({
    method: "POST",
    url: `/quizzes/${quiz}/attempt/answers`,
    headers: { cookie },
    payload: { questionId, choiceId },
  });

const finish = (cookie: string, quiz: string) =>
  app.inject({ method: "POST", url: `/quizzes/${quiz}/attempt/finish`, headers: { cookie } });

const scores = (cookie: string, quiz: string) =>
  app.inject({ method: "GET", url: `/quizzes/${quiz}/scores`, headers: { cookie } });

/** Play a whole quiz through, always picking the first proposition. */
async function playAll(cookie: string, quiz: string) {
  await start(cookie, quiz);
  const qs = (await readQuiz(cookie, quiz)).json().questions;
  for (const q of qs) await reply_(cookie, quiz, q.id, q.choices[0].id);
  return finish(cookie, quiz);
}

/** A bank deep enough to deal a middling ten out of, and two accounts. */
async function ready() {
  const admin = await count("maquecime", true);
  const friend = await count("copine");
  const category = await makeCategory(admin.cookie, "nouvelle vague");
  await stock(category, "easy", 8);
  await stock(category, "normal", 8);
  await stock(category, "hard", 8);
  const quiz = (await draw(friend.cookie, { categoryIds: [category] })).json().id as string;
  return { admin, friend, category, quiz };
}

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("who fills the bank", () => {
  it("refuses an ordinary account everywhere in it", async () => {
    const admin = await count("maquecime", true);
    const plain = await count("ordinaire");
    const category = await makeCategory(admin.cookie, "nouvelle vague");

    for (const [method, url] of [
      ["POST", "/categories"],
      ["PUT", `/categories/${category}`],
      ["DELETE", `/categories/${category}`],
      ["GET", `/categories/${category}/questions`],
      ["POST", `/categories/${category}/questions`],
    ] as const) {
      const r = await app.inject({
        method,
        url,
        headers: { cookie: plain.cookie },
        payload: { label: "à moi", ask: "hop", choices: [] },
      });
      expect(r.statusCode, `${method} ${url}`).toBe(403);
    }
  });

  it("lets anybody read the list of categories — it is the menu", async () => {
    const admin = await count("maquecime", true);
    const plain = await count("ordinaire");
    await makeCategory(admin.cookie, "nouvelle vague");

    const r = await app.inject({
      method: "GET",
      url: "/categories",
      headers: { cookie: plain.cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().categories[0].label).toBe("nouvelle vague");
  });

  it("counts the live stock per level, so an empty basket can be hidden", async () => {
    const admin = await count("maquecime", true);
    const category = await makeCategory(admin.cookie, "nouvelle vague");
    await stock(category, "hard", 3);

    const [one] = (
      await app.inject({ method: "GET", url: "/categories", headers: { cookie: admin.cookie } })
    ).json().categories;
    expect(one).toMatchObject({ easy: 0, normal: 0, hard: 3 });
  });

  it("refuses two categories of the same name", async () => {
    const admin = await count("maquecime", true);
    await makeCategory(admin.cookie, "nouvelle vague");
    const again = await app.inject({
      method: "POST",
      url: "/categories",
      headers: { cookie: admin.cookie },
      payload: { label: "nouvelle vague" },
    });
    expect(again.statusCode).toBe(409);
  });
});

describe("drawing a quiz", () => {
  it("is open to an account with no role at all", async () => {
    const { friend, quiz } = await ready();
    expect(quiz).toMatch(/^[0-9a-f-]{36}$/);
    expect((await readQuiz(friend.cookie, quiz)).statusCode).toBe(200);
  });

  it("deals the length asked for, and the mix that goes with the level", async () => {
    const admin = await count("maquecime", true);
    const me = await count("copine");
    const category = await makeCategory(admin.cookie, "nouvelle vague");
    await stock(category, "easy", 20);
    await stock(category, "normal", 20);
    await stock(category, "hard", 20);

    const id = (await draw(me.cookie, { categoryIds: [category], level: "hard", size: 20 })).json()
      .id;
    const body = (await readQuiz(me.cookie, id)).json();
    expect(body.questions).toHaveLength(20);
    /* Two hard quizzes of twenty weigh the same, and that is the whole
       arithmetic behind "these scores are comparable": 2×1 + 6×2 +
       12×3 = 50. */
    expect(body.weight).toBe(50);
    expect(body.quiz.softened).toBe(false);
  });

  it("gives everybody invited the same questions, in the same order", async () => {
    const { admin, friend, quiz } = await ready();
    await invite(friend.cookie, quiz, "maquecime");

    const mine = (await readQuiz(friend.cookie, quiz)).json().questions;
    const theirs = (await readQuiz(admin.cookie, quiz)).json().questions;
    expect(theirs.map((q: { id: string }) => q.id)).toEqual(mine.map((q: { id: string }) => q.id));
  });

  it("says so when the bank was too thin to hold the mix", async () => {
    const admin = await count("maquecime", true);
    const me = await count("copine");
    const category = await makeCategory(admin.cookie, "nouvelle vague");
    await stock(category, "easy", 20);
    await stock(category, "hard", 1);

    const r = await draw(me.cookie, { categoryIds: [category], level: "hard", size: 10 });
    expect(r.json().softened).toBe(true);
    /* Still a quiz of the length asked for — a softened quiz beats a
       refused one while the bank is young — and it wears the reason on
       its face rather than being quietly gentler. */
    expect(r.json().drawn).toBe(10);
    expect((await readQuiz(me.cookie, r.json().id)).json().quiz.softened).toBe(true);
  });

  it("shares between the categories asked for", async () => {
    const admin = await count("maquecime", true);
    const me = await count("copine");
    const a = await makeCategory(admin.cookie, "varda");
    const b = await makeCategory(admin.cookie, "melville");
    for (const c of [a, b]) {
      await stock(c, "easy", 20);
      await stock(c, "normal", 20);
      await stock(c, "hard", 20);
    }

    const id = (await draw(me.cookie, { categoryIds: [a, b], size: 20 })).json().id;
    const qs = (await readQuiz(me.cookie, id)).json().questions;
    const perCategory = new Map<string, number>();
    for (const q of qs) perCategory.set(q.category, (perCategory.get(q.category) ?? 0) + 1);
    expect([...perCategory.values()]).toEqual([10, 10]);
  });

  it("never deals a question one cannot get right", async () => {
    const admin = await count("maquecime", true);
    const me = await count("copine");
    const category = await makeCategory(admin.cookie, "nouvelle vague");
    /* Half-written stock: no right answer, or two. Neither is dealable,
       and planning against them would have promised questions nobody
       could score. */
    await addQuestion(admin.cookie, category, { ask: "sans réponse", choices: [{ label: "a" }] });
    await addQuestion(admin.cookie, category, {
      ask: "deux réponses",
      choices: [
        { label: "a", is_right: true },
        { label: "b", is_right: true },
      ],
    });
    await stock(category, "normal", 3);

    const id = (await draw(me.cookie, { categoryIds: [category] })).json().id;
    const qs = (await readQuiz(me.cookie, id)).json().questions;
    expect(qs).toHaveLength(3);
    expect(qs.map((q: { ask: string }) => q.ask)).not.toContain("sans réponse");
  });

  it("refuses to deal out of baskets with nothing playable in them", async () => {
    const admin = await count("maquecime", true);
    const me = await count("copine");
    const category = await makeCategory(admin.cookie, "vide");
    const r = await draw(me.cookie, { categoryIds: [category] });
    expect(r.statusCode).toBe(409);
    /* And nothing is left lying about: a quiz of zero questions would
       have been a screen full of nothing with no reason given. */
    expect((await db.query("SELECT 1 FROM quiz")).length).toBe(0);
  });

  it("refuses a length or a level it does not know", async () => {
    const { friend, category } = await ready();
    expect((await draw(friend.cookie, { categoryIds: [category], size: 17 })).statusCode).toBe(400);
    expect(
      (await draw(friend.cookie, { categoryIds: [category], level: "impossible" })).statusCode
    ).toBe(400);
    expect((await draw(friend.cookie, { categoryIds: [] })).statusCode).toBe(400);
  });

  it("cannot be re-drawn, only renamed", async () => {
    const { friend, quiz } = await ready();
    const before = (await readQuiz(friend.cookie, quiz)).json().questions;

    const r = await app.inject({
      method: "PUT",
      url: `/quizzes/${quiz}`,
      headers: { cookie: friend.cookie },
      payload: { title: "Autre soir", level: "hard", size: 30 },
    });
    expect(r.statusCode).toBe(200);
    const after = (await readQuiz(friend.cookie, quiz)).json();
    expect(after.quiz.title).toBe("Autre soir");
    /* Re-dealing under people who have started answering is how a
       leaderboard becomes a lie. Another quiz costs one gesture. */
    expect(after.questions.map((q: { id: string }) => q.id)).toEqual(
      before.map((q: { id: string }) => q.id)
    );
    expect(after.quiz.level).toBe("normal");
  });
});

describe("the right answer", () => {
  it("does not come down while somebody is still playing", async () => {
    const { friend, quiz } = await ready();
    await start(friend.cookie, quiz);
    const body = (await readQuiz(friend.cookie, quiz)).json();
    expect(JSON.stringify(body)).not.toContain("is_right");
    expect(JSON.stringify(body)).not.toContain("hint");
  });

  it("is withheld from whoever drew the quiz too — they did not write it", async () => {
    /* THE EXCEPTION THAT NO LONGER EXISTS. When a quiz was written by
       hand its author saw the answers, and that carve-out is exactly the
       sort of thing one forgets to remove. Drawing is not writing. */
    const { friend, quiz } = await ready();
    await start(friend.cookie, quiz);
    const body = (await readQuiz(friend.cookie, quiz)).json();
    expect(body.quiz.mine).toBe(true);
    expect(JSON.stringify(body)).not.toContain("is_right");
  });

  it("comes down with the correction once the attempt is closed", async () => {
    const { friend, quiz } = await ready();
    const done = (await playAll(friend.cookie, quiz)).json();
    expect(done.questions[0].choices.some((c: { is_right: boolean }) => c.is_right)).toBe(true);
  });
});

describe("an attempt", () => {
  it("is played once, and replaying every request changes nothing", async () => {
    const { friend, quiz } = await ready();
    await playAll(friend.cookie, quiz);
    const scored = (await scores(friend.cookie, quiz)).json().scores;

    const qs = (await readQuiz(friend.cookie, quiz)).json().questions;
    expect((await start(friend.cookie, quiz)).json().attempt.finished_at).not.toBeNull();
    expect((await reply_(friend.cookie, quiz, qs[0].id, qs[0].choices[1].id)).statusCode).toBe(409);
    await finish(friend.cookie, quiz);
    expect((await scores(friend.cookie, quiz)).json().scores).toEqual(scored);
  });

  it("refuses a second answer to the same question, before the end", async () => {
    const { friend, quiz } = await ready();
    await start(friend.cookie, quiz);
    const qs = (await readQuiz(friend.cookie, quiz)).json().questions;
    expect((await reply_(friend.cookie, quiz, qs[0].id, qs[0].choices[0].id)).statusCode).toBe(200);
    expect((await reply_(friend.cookie, quiz, qs[0].id, qs[0].choices[1].id)).statusCode).toBe(409);
  });

  it("refuses a question out of the bank that this quiz was not dealt", async () => {
    const { admin, friend, category, quiz } = await ready();
    const stray = (await addQuestion(admin.cookie, category, { ask: "hors tirage" })).json()
      .id as string;
    const choice = (
      await db.query<{ id: string }>("SELECT id FROM quiz_choice WHERE question_id = $1", [stray])
    )[0]!;

    await start(friend.cookie, quiz);
    expect((await reply_(friend.cookie, quiz, stray, choice.id)).statusCode).toBe(409);
  });

  it("cannot be opened on a quiz one was not invited to", async () => {
    const { quiz } = await ready();
    const stranger = await count("inconnu");
    expect((await start(stranger.cookie, quiz)).statusCode).toBe(404);
  });
});

describe("who may read a quiz", () => {
  it("answers 404 to somebody not invited — the same 404 as for nothing", async () => {
    const { quiz } = await ready();
    const stranger = await count("inconnu");
    const refused = await readQuiz(stranger.cookie, quiz);
    const ghost = await readQuiz(stranger.cookie, "00000000-0000-4000-8000-000000000000");
    expect(refused.statusCode).toBe(404);
    expect(refused.json()).toEqual(ghost.json());
  });

  it("shuts again the moment one of the two blocks the other", async () => {
    const { admin, friend, quiz } = await ready();
    await invite(friend.cookie, quiz, "maquecime");
    expect((await readQuiz(admin.cookie, quiz)).statusCode).toBe(200);
    await store.block(db, admin.person.id, friend.person.id);
    expect((await readQuiz(admin.cookie, quiz)).statusCode).toBe(404);
  });

  it("shows the invited players to whoever dealt it, and to nobody else", async () => {
    const { admin, friend, quiz } = await ready();
    await invite(friend.cookie, quiz, "maquecime");
    expect((await readQuiz(friend.cookie, quiz)).json().players).toEqual(["maquecime"]);
    expect((await readQuiz(admin.cookie, quiz)).json().players).toEqual([]);
  });
});

describe("the scoreboard", () => {
  it("counts the points of the difficulty, not the questions", async () => {
    const admin = await count("maquecime", true);
    const me = await count("copine");
    const category = await makeCategory(admin.cookie, "nouvelle vague");
    /* Only hard questions in the bank, so every one dealt is worth
       three whatever the mix asked for. */
    await stock(category, "hard", 20);
    const id = (await draw(me.cookie, { categoryIds: [category], level: "hard", size: 10 })).json()
      .id;

    await start(me.cookie, id);
    const qs = (await readQuiz(me.cookie, id)).json().questions;
    for (const q of qs) {
      /* `stock` writes the right answer first, so this is a clean sweep. */
      await reply_(me.cookie, id, q.id, q.choices[0].id);
    }
    await finish(me.cookie, id);

    const mine = (await scores(me.cookie, id))
      .json()
      .scores.find((s: { pseudo: string }) => s.pseudo === "copine");
    expect(mine).toMatchObject({ score: 30, answered: 10, finished: true });
  });

  /* ============================================================
     LE TEMPS SE DIT, ET IL NE PAIE RIEN
     ============================================================

     Deux parties au même score ne sont pas la même partie, et le tableau
     ne le disait pas. Mais la vitesse ne doit RIEN rapporter : si elle
     payait, la première chose à faire pour monter au classement serait
     de cliquer au hasard très vite.
     ============================================================ */
  it("says how long a finished run took, and counts a running one from now", async () => {
    const { friend, quiz } = await ready();
    await start(friend.cookie, quiz);

    const running = (await scores(friend.cookie, quiz)).json().scores[0];
    expect(running.finished).toBe(false);
    expect(running.seconds).toBeGreaterThanOrEqual(0);

    /* Une partie ouverte il y a une heure et toujours en cours DOIT le
       montrer : la durée court, elle ne se fige pas au démarrage. */
    await db.query(
      `UPDATE quiz_attempt SET started_at = now() - interval '1 hour'
        WHERE quiz_id = $1 AND person_id = $2`,
      [quiz, friend.person.id]
    );
    expect((await scores(friend.cookie, quiz)).json().scores[0].seconds).toBeGreaterThanOrEqual(
      3600
    );
  });

  it("pays exactly the same to the quick and to the slow", async () => {
    const { admin, friend, quiz } = await ready();
    await invite(friend.cookie, quiz, "maquecime");

    await playAll(friend.cookie, quiz);
    /* La même partie, les mêmes réponses — mais commencée il y a deux
       heures. `awardQuiz` ne lit aucun horodatage, et c'est cette ligne
       qui le tient : le jour où quelqu'un ajoutera un bonus de vitesse,
       ce test tombera avant que le classement ne se déforme. */
    await start(admin.cookie, quiz);
    await db.query(
      `UPDATE quiz_attempt SET started_at = now() - interval '2 hours'
        WHERE quiz_id = $1 AND person_id = $2`,
      [quiz, admin.person.id]
    );
    const qs = (await readQuiz(admin.cookie, quiz)).json().questions;
    for (const q of qs) await reply_(admin.cookie, quiz, q.id, q.choices[0].id);
    await finish(admin.cookie, quiz);

    const paid = async (id: string) =>
      (
        await db.query<{ kind: string; merit: number }>(
          `SELECT kind, merit FROM merit_event WHERE person_id = $1 AND kind LIKE 'quiz%'
            ORDER BY kind`,
          [id]
        )
      ).map((r) => `${r.kind}:${r.merit}`);

    const quick = await paid(friend.person.id);
    const slow = await paid(admin.person.id);
    /* `quiz_first` sépare légitimement les deux : c'est l'ORDRE, pas la
       vitesse. On compare donc tout le reste. */
    expect(slow.filter((k) => !k.startsWith("quiz_first"))).toEqual(
      quick.filter((k) => !k.startsWith("quiz_first"))
    );

    const board = (await scores(friend.cookie, quiz)).json().scores;
    expect(board.map((s: { score: number }) => s.score)).toEqual([board[0].score, board[0].score]);
    /* Et pourtant le tableau les distingue — c'est bien le but. */
    const slowRow = board.find((s: { pseudo: string }) => s.pseudo === "maquecime");
    expect(slowRow.seconds).toBeGreaterThanOrEqual(7200);
  });

  it("shows nobody one has blocked", async () => {
    const { admin, friend, quiz } = await ready();
    await invite(friend.cookie, quiz, "maquecime");
    await start(friend.cookie, quiz);
    await start(admin.cookie, quiz);
    expect((await scores(friend.cookie, quiz)).json().scores).toHaveLength(2);

    await store.block(db, friend.person.id, admin.person.id);
    expect(
      (await scores(friend.cookie, quiz)).json().scores.map((s: { pseudo: string }) => s.pseudo)
    ).toEqual(["copine"]);
  });

  it("keeps a score made by somebody since sent away", async () => {
    const { admin, friend, quiz } = await ready();
    await invite(friend.cookie, quiz, "maquecime");
    await playAll(admin.cookie, quiz);
    await app.inject({
      method: "DELETE",
      url: `/quizzes/${quiz}/players/maquecime`,
      headers: { cookie: friend.cookie },
    });
    /* Uninviting is not erasing: a leaderboard that quietly loses a row
       is a leaderboard nobody can argue with. */
    expect(
      (await scores(friend.cookie, quiz)).json().scores.map((s: { pseudo: string }) => s.pseudo)
    ).toContain("maquecime");
  });
});

describe("mending the bank under a quiz already dealt", () => {
  it("withdraws a dealt question instead of erasing it", async () => {
    const { admin, friend, category, quiz } = await ready();
    const dealt = (await readQuiz(friend.cookie, quiz)).json().questions[0].id;

    const r = await app.inject({
      method: "DELETE",
      url: `/categories/${category}/questions/${dealt}`,
      headers: { cookie: admin.cookie },
    });
    expect(r.json().fate).toBe("retired");
    /* The quiz keeps its ten: a score already made is not rewritten
       because an admin thought better of a wording. */
    expect((await readQuiz(friend.cookie, quiz)).json().questions).toHaveLength(10);
    /* And the bank stops dealing it. */
    const [basket] = (
      await app.inject({ method: "GET", url: "/categories", headers: { cookie: admin.cookie } })
    ).json().categories;
    expect(basket.easy + basket.normal + basket.hard).toBe(23);
  });

  it("erases outright a question nothing has been dealt", async () => {
    const admin = await count("maquecime", true);
    const category = await makeCategory(admin.cookie, "nouvelle vague");
    const fresh = (await addQuestion(admin.cookie, category)).json().id;
    const r = await app.inject({
      method: "DELETE",
      url: `/categories/${category}/questions/${fresh}`,
      headers: { cookie: admin.cookie },
    });
    expect(r.json().fate).toBe("gone");
  });

  it("will not move the propositions of a question somebody may have answered", async () => {
    const { admin, friend, category, quiz } = await ready();
    const dealt = (await readQuiz(friend.cookie, quiz)).json().questions[0];

    const r = await app.inject({
      method: "PUT",
      url: `/categories/${category}/questions/${dealt.id}`,
      headers: { cookie: admin.cookie },
      payload: {
        ask: "Énoncé corrigé",
        choices: [{ label: "tout autre chose", is_right: true }],
      },
    });
    /* The wording is worth correcting — a typo is a typo — but the
       propositions are pointed at by `quiz_answer`, and replacing them
       would cascade somebody's answer away and quietly change a score. */
    expect(r.json()).toEqual({ done: true, choicesFrozen: true });
    const after = (await readQuiz(friend.cookie, quiz)).json().questions[0];
    expect(after.ask).toBe("Énoncé corrigé");
    expect(after.choices.map((c: { id: string }) => c.id)).toEqual(
      dealt.choices.map((c: { id: string }) => c.id)
    );
  });

  it("refuses to erase a category whose questions have been dealt", async () => {
    const { admin, category } = await ready();
    const r = await app.inject({
      method: "DELETE",
      url: `/categories/${category}`,
      headers: { cookie: admin.cookie },
    });
    expect(r.statusCode).toBe(409);
  });
});
