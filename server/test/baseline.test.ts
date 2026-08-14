import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   WHAT THE DATABASE PROMISES

   These rules are not in the server's code: they are in the schema, and
   that is deliberate. A constraint written into one route is got round
   by the next one; a constraint written into the table holds whatever
   path is taken. It still has to hold — hence these tests, which speak
   to a real Postgres.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

describe("laying the baseline on a database that has already lived", () => {
  it("adds what is missing instead of leaving the table behind", async () => {
    /* THIS TEST EXISTS BECAUSE THE SERVER REFUSED TO START.
       `CREATE TABLE IF NOT EXISTS` does nothing at all when the table is
       there — not even add a column that has appeared since. A suite
       that always starts from an empty database cannot notice: one has
       to rebuild the old shape, then lay the baseline again. */
    const blank = await testDb();
    await blank.exec("DROP TABLE IF EXISTS card;");
    await blank.exec(`
      CREATE TABLE card (
        person_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        id text NOT NULL,
        tmdb_id text,
        visibilite text NOT NULL DEFAULT 'privee',
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL,
        deleted boolean NOT NULL DEFAULT false,
        PRIMARY KEY (person_id, id)
      );`);

    const baseline = await readFile(
      fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
      "utf8"
    );
    await blank.exec(baseline);

    const columns = await blank.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'card'"
    );
    expect(columns.map((c) => c.column_name)).toContain("seq");

    /* And the table really works, not only under inspection. */
    const p = await store.createPerson(blank, "rivette");
    await store.storeCard(blank, p.id, { id: "f1", data: {}, updatedAt: new Date(1) });
    expect((await store.cardsSince(blank, p.id, 0))[0]!.seq).toBeTruthy();
    await blank.close();
  });

  it("survives being laid down a second time, whole", async () => {
    /* THE FILE IS REPLAYED AT EVERY START-UP. Everything in it is
       therefore written to be harmless the second time — but nothing
       checked that, and the suite above only ever proves it for the one
       table it rebuilds by hand.

       A single `ADD CONSTRAINT` written without its `EXCEPTION WHEN
       duplicate_object` is enough to stop the server from ever booting
       again, and it would boot perfectly on a fresh database. */
    const twice = await testDb();
    const baseline = await readFile(
      fileURLToPath(new URL("../sql/001_baseline.sql", import.meta.url)),
      "utf8"
    );
    await expect(twice.exec(baseline)).resolves.not.toThrow();

    const p = await store.createPerson(twice, "rohmer");
    expect(p.id).toBeTruthy();
    await twice.close();
  });
});

describe("the pseudonym", () => {
  it("is unique, and it is the database that settles the race", async () => {
    await store.createPerson(db, "varda");
    await expect(store.createPerson(db, "varda")).rejects.toThrow();
  });

  it("refuses what cannot live in an address", async () => {
    /* The pseudonym will be a shared collection's address: it can carry
       no space, no capital and no accent. */
    for (const bad of ["ab", "Varda", "agnès", "two mots", "-varda", "varda-"]) {
      await expect(store.createPerson(db, bad)).rejects.toThrow();
    }
    await expect(store.createPerson(db, "agnes-varda")).resolves.toBeTruthy();
  });
});

describe("erasing an account", () => {
  it("carries off everything hanging under it, with no housekeeping routine", async () => {
    const p = await store.createPerson(db, "chris");
    await store.addKey(db, {
      id: "key-1",
      personId: p.id,
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
      transports: ["internal"],
    });
    await store.openSession(db, p.id);
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "La Jetée" },
      updatedAt: new Date(1000),
    });

    await store.deletePerson(db, p.id);

    expect(await store.keyById(db, "key-1")).toBeNull();
    const restes = await db.query("SELECT count(*)::int AS n FROM card");
    expect((restes[0] as { n: number }).n).toBe(0);
    const sessions = await db.query("SELECT count(*)::int AS n FROM session");
    expect((sessions[0] as { n: number }).n).toBe(0);
  });
});

describe("a quiz, as the schema holds it", () => {
  /** A bank of two questions, and one quiz dealt out of it. */
  async function written() {
    const who = await store.createPerson(db, "maquecime");
    await store.markAdmins(db, ["maquecime"]);
    const category = await store.createCategory(db, { label: "nouvelle vague" });
    for (const ask of ["Qui a fait Cléo ?", "Et Le Bonheur ?"]) {
      const q = await store.addBankQuestion(db, category, { ask });
      await store.setChoices(db, q, [
        { label: "Varda", is_right: true },
        { label: "Demy", is_right: false },
      ]);
    }
    const { id: quiz } = await store.drawQuiz(db, who.id, {
      title: "Un soir",
      categoryIds: [category],
      level: "normal",
      size: 10,
    });
    const dealt = await db.query<{ question_id: string }>(
      "SELECT question_id FROM quiz_draw WHERE quiz_id = $1 ORDER BY rank",
      [quiz]
    );
    return { who, category, quiz, question: dealt[0]!.question_id };
  }

  it("refuses a difficulty it does not know", async () => {
    const category = await store.createCategory(db, { label: "nouvelle vague" });
    await expect(
      db.query(
        "INSERT INTO quiz_question (id, category_id, ask, difficulty) VALUES (gen_random_uuid(), $1, 'Quoi ?', 'impossible')",
        [category]
      )
    ).rejects.toThrow();
  });

  it("refuses a length that is not one of the three", async () => {
    const who = await store.createPerson(db, "maquecime");
    await expect(
      db.query(
        "INSERT INTO quiz (id, owner_id, title, size) VALUES (gen_random_uuid(), $1, 'Titre', 17)",
        [who.id]
      )
    ).rejects.toThrow();
  });

  it("prices a question by its difficulty, in the database itself", async () => {
    /* The points are not a column and not a constant in TypeScript: one
       function, read by the scoreboard and by anything that comes
       later. A second table of values would drift from this one. */
    const r = await db.query<{ e: number; n: number; h: number }>(
      "SELECT quiz_points('easy') AS e, quiz_points('normal') AS n, quiz_points('hard') AS h"
    );
    expect(r[0]).toEqual({ e: 1, n: 2, h: 3 });
  });

  it("refuses an answer to a question this quiz was never dealt", async () => {
    const { who, quiz, category } = await written();
    const stray = await store.addBankQuestion(db, category, { ask: "Jamais tirée" });
    await store.setChoices(db, stray, [{ label: "non", is_right: true }]);
    const choice = (
      await db.query<{ id: string }>("SELECT id FROM quiz_choice WHERE question_id = $1", [stray])
    )[0]!;
    await store.startAttempt(db, quiz, who.id);
    /* The foreign key points at the DEAL, not at the bank: a question
       out of the stock that this quiz never held has no row to land in,
       whatever a route might one day forget to check. */
    await expect(
      db.query(
        "INSERT INTO quiz_answer (quiz_id, person_id, question_id, choice_id) VALUES ($1, $2, $3, $4)",
        [quiz, who.id, stray, choice.id]
      )
    ).rejects.toThrow();
  });

  it("will not let a dealt question be erased from under a quiz", async () => {
    const { quiz, question } = await written();
    /* `ON DELETE RESTRICT`. Erasing it would shorten a quiz somebody may
       be halfway through, and silently rewrite a score already made. */
    await expect(db.query("DELETE FROM quiz_question WHERE id = $1", [question])).rejects.toThrow();
    expect((await db.query("SELECT 1 FROM quiz_draw WHERE quiz_id = $1", [quiz])).length).toBe(2);
  });

  it("keeps the bank when the admin who typed it in leaves", async () => {
    const { who, category } = await written();
    await store.deletePerson(db, who.id);
    /* Questions are stock, not property. The opposite would empty
       everybody's future evenings the day an admin closed their
       account. */
    const left = await store.bankQuestions(db, category);
    expect(left.length).toBe(2);
  });

  it("holds one attempt per person, whatever the route asks", async () => {
    const { who, quiz } = await written();
    await store.startAttempt(db, quiz, who.id);
    /* Not "the route refuses a second one": there is no second row to
       have. That is what makes "once it is done you cannot do it again"
       true down every path, including the ones written later. */
    await expect(
      db.query("INSERT INTO quiz_attempt (quiz_id, person_id) VALUES ($1, $2)", [quiz, who.id])
    ).rejects.toThrow();
    expect((await db.query("SELECT 1 FROM quiz_attempt")).length).toBe(1);
  });

  it("holds one answer per question, and refuses the correction after the fact", async () => {
    const { who, quiz, question } = await written();
    await store.startAttempt(db, quiz, who.id);
    const choices = await db.query<{ id: string }>(
      "SELECT id FROM quiz_choice WHERE question_id = $1 ORDER BY rank",
      [question]
    );
    expect(await store.answer(db, quiz, who.id, question, choices[0]!.id)).toBe(true);
    expect(await store.answer(db, quiz, who.id, question, choices[1]!.id)).toBe(false);
  });

  it("refuses an answer with no attempt behind it", async () => {
    const { who, quiz, question } = await written();
    const choice = (
      await db.query<{ id: string }>("SELECT id FROM quiz_choice WHERE question_id = $1", [
        question,
      ])
    )[0]!;
    /* The foreign key on `(quiz_id, person_id)` says it: an answer hangs
       off an attempt, and an attempt is the thing one may only open
       once. Without it, answering without starting would have been a way
       round the rule. */
    await expect(
      db.query(
        "INSERT INTO quiz_answer (quiz_id, person_id, question_id, choice_id) VALUES ($1, $2, $3, $4)",
        [quiz, who.id, question, choice.id]
      )
    ).rejects.toThrow();
  });

  it("takes the quizzes and the answers with it when the account goes", async () => {
    const { who, quiz } = await written();
    await store.startAttempt(db, quiz, who.id);
    await store.deletePerson(db, who.id);
    /* What was DEALT goes — the quiz, its deal, who played and what they
       answered. What was STOCK stays: see the test above. */
    for (const table of [
      "quiz",
      "quiz_topic",
      "quiz_draw",
      "quiz_player",
      "quiz_attempt",
      "quiz_answer",
    ]) {
      expect((await db.query(`SELECT 1 FROM ${table}`)).length, table).toBe(0);
    }
  });
});

describe("a ceremony's challenge", () => {
  it("is consumed once only", async () => {
    const id = await store.setChallenge(db, "hasard", { pseudo: "melville" });
    expect(await store.consumeChallenge(db, id)).toMatchObject({ value: "hasard" });
    /* An intercepted signature must not be able to serve twice. */
    expect(await store.consumeChallenge(db, id)).toBeNull();
  });

  it("goes out on its own as it ages", async () => {
    await db.query(
      "INSERT INTO webauthn_challenge (id, value, expires_at) VALUES ('11111111-1111-1111-1111-111111111111', 'vieux', now() - interval '1 minute')"
    );
    expect(await store.consumeChallenge(db, "11111111-1111-1111-1111-111111111111")).toBeNull();
  });
});

describe("the session", () => {
  it("leaves only a digest in the database, never the secret", async () => {
    const p = await store.createPerson(db, "tarkovski");
    const secret = await store.openSession(db, p.id);

    const rows = await db.query<{ digest: string }>("SELECT digest FROM session");
    expect(rows[0]!.digest).not.toBe(secret);
    /* Une fuite de la table ne donne aucune session utilisable. */
    expect(await store.personOfSession(db, rows[0]!.digest)).toBeNull();
    expect(await store.personOfSession(db, secret)).toMatchObject({ pseudo: "tarkovski" });
  });

  it("expired, it is worth nothing any more", async () => {
    const p = await store.createPerson(db, "kubrick");
    const secret = "secret-a-la-main";
    await db.query(
      "INSERT INTO session (digest, person_id, expires_at) VALUES ($1, $2, now() - interval '1 day')",
      [store.fingerprintOf(secret), p.id]
    );
    expect(await store.personOfSession(db, secret)).toBeNull();
  });
});

describe("filing a card", () => {
  it("the last writer wins, and it is the database that arbitrates", async () => {
    const p = await store.createPerson(db, "akerman");
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "récent" },
      updatedAt: new Date(2000),
    });
    /* A device running late pushes its version: it must be refused with
       no error, and without overwriting the fresher one. */
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "ancien" },
      updatedAt: new Date(1000),
    });

    const cards = await store.cardsSince(db, p.id, 0);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.data).toMatchObject({ title: "récent" });
  });

  it("returns only what has moved since the rank asked for", async () => {
    const p = await store.createPerson(db, "ozu");
    await store.storeCard(db, p.id, { id: "premiere", data: {}, updatedAt: new Date(1000) });
    const all = await store.cardsSince(db, p.id, 0);
    const cursor = Number(all[0]!.seq);

    await store.storeCard(db, p.id, { id: "seconde", data: {}, updatedAt: new Date(5000) });
    const moved = await store.cardsSince(db, p.id, cursor);
    expect(moved.map((f) => f.id)).toEqual(["seconde"]);
  });

  it("a modified card takes a fresh rank, and goes to the front again", async () => {
    /* Without this it would keep its place in the queue and the devices
       already past that point would never see it again. */
    const p = await store.createPerson(db, "bresson");
    await store.storeCard(db, p.id, { id: "f1", data: {}, updatedAt: new Date(1000) });
    await store.storeCard(db, p.id, { id: "f2", data: {}, updatedAt: new Date(2000) });
    const apres = Number((await store.cardsSince(db, p.id, 0)).at(-1)!.seq);

    await store.storeCard(db, p.id, {
      id: "f1",
      data: { note: "retouchée" },
      updatedAt: new Date(9000),
    });
    const suite = await store.cardsSince(db, p.id, apres);
    expect(suite.map((f) => f.id)).toEqual(["f1"]);
  });

  it("the rank ignores the devices' clocks, and that is its reason for being", async () => {
    /* A PHONE AN HOUR BEHIND. Its card carries a date older than
       everything before it; following the dates would make it invisible
       to the other devices — filed on the server and seen by nobody. The
       rank, for its part, is given on arrival. */
    const p = await store.createPerson(db, "wenders");
    await store.storeCard(db, p.id, {
      id: "a-l-heure",
      data: {},
      updatedAt: new Date(9_000_000),
    });
    const cursor = Number((await store.cardsSince(db, p.id, 0)).at(-1)!.seq);

    await store.storeCard(db, p.id, { id: "en-retard", data: {}, updatedAt: new Date(1000) });

    const seen = await store.cardsSince(db, p.id, cursor);
    expect(seen.map((f) => f.id)).toEqual(["en-retard"]);
  });

  it("a deletion synchronises instead of disappearing", async () => {
    /* Effacer la ligne ferait revenir la card au prochain envoi de
       l'device qui ne sait pas more. */
    const p = await store.createPerson(db, "resnais");
    await store.storeCard(db, p.id, { id: "f1", data: {}, updatedAt: new Date(1000) });
    await store.storeCard(db, p.id, {
      id: "f1",
      data: {},
      updatedAt: new Date(2000),
      deleted: true,
    });

    const cards = await store.cardsSince(db, p.id, 0);
    expect(cards[0]!.deleted).toBe(true);
    expect(await store.countCards(db, p.id)).toBe(0);
  });

  it("files a json OBJECT, and not a string that looks like one", async () => {
    /* THIS TEST EXISTS BECAUSE THE OPPOSITE HAPPENED. A string handed to
       a `jsonb` column with no explicit cast is filed as it stands by
       some drivers: the card ends up doubly encoded, and everything that
       reads it back receives text instead of an object. The fault only
       showed on a real Postgres — hence this check on the TYPE filed,
       and not on the value read back, which looks right either way. */
    const p = await store.createPerson(db, "marker");
    await store.storeCard(db, p.id, {
      id: "f1",
      data: { title: "La Jetée", rating: 5 },
      updatedAt: new Date(1000),
    });

    const t = await db.query<{ type: string }>(
      "SELECT jsonb_typeof(data) AS type FROM card WHERE person_id = $1",
      [p.id]
    );
    expect(t[0]!.type).toBe("object");

    const relue = await store.cardsSince(db, p.id, 0);
    expect(relue[0]!.data).toEqual({ title: "La Jetée", rating: 5 });
  });

  it("two people may name their cards the same", async () => {
    /* The identifier comes from the client: nothing guarantees it is
       unique across two collections, and nothing needs it to be. */
    const a = await store.createPerson(db, "duras");
    const b = await store.createPerson(db, "godard");
    await store.storeCard(db, a.id, { id: "même", data: { chez: "a" }, updatedAt: new Date(1) });
    await store.storeCard(db, b.id, { id: "même", data: { chez: "b" }, updatedAt: new Date(1) });

    expect((await store.cardsSince(db, a.id, 0))[0]!.data).toMatchObject({
      chez: "a",
    });
  });
});
