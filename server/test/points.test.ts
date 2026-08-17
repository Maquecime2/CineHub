import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import { DECLARED_CEILING, RATE, REVIEW_LENGTH } from "../src/points.ts";
import type { Db } from "../src/db.ts";

/* ============================================================
   THE MERIT, AND WHAT KEEPS IT FROM BEING FICTION

   Three promises are tried here, and all three are kept by the SCHEMA
   rather than by the code that calls it — which is the only reason they
   can be trusted from every route at once.

   ONE FACT PAYS ONCE. The journal is unique on (person, kind, ref), so a
   double click, a retried request or a page opened twice credit nothing
   the second time. That is tested by doing exactly that.

   THE PURSE IS ALWAYS THE JOURNAL'S SUM. It is a cache, and a cache that
   drifts is worse than no cache: the figure on the screen would be
   nobody's.

   AND WHAT ONE MERELY DECLARES IS CAPPED BY THE DAY. A card is written
   by the client and the server cannot tell a real evening from a made-up
   one; the ceiling is what makes lying tedious rather than profitable.
   ============================================================ */

let db: Db;
beforeEach(async () => {
  db = await testDb();
});
afterEach(async () => {
  await db.close();
});

const someone = async (pseudo: string) => (await store.createPerson(db, pseudo)).id;

/** What the journal says, added up — the figure the purse must match. */
async function journal(personId: string) {
  const rows = await db.query<{ merit: number; tokens: number }>(
    `SELECT coalesce(sum(merit), 0)::int AS merit,
            (coalesce(sum(tokens), 0)
             - coalesce((SELECT sum(tokens) FROM token_spend WHERE person_id = $1), 0))::int
              AS tokens
       FROM merit_event WHERE person_id = $1`,
    [personId]
  );
  return rows[0]!;
}

describe("a gain", () => {
  it("credits both counters at once", async () => {
    const me = await someone("varda");
    expect(await store.award(db, me, "list_shared", "l1", RATE.list_shared)).toBe(5);
    expect(await store.purseOf(db, me)).toEqual({ merit: 5, tokens: 5 });
  });

  it("pays once for the same fact, however often it is asked", async () => {
    const me = await someone("demy");
    expect(await store.award(db, me, "challenge", "e1", 30)).toBe(30);
    expect(await store.award(db, me, "challenge", "e1", 30)).toBe(0);
    expect(await store.award(db, me, "challenge", "e1", 30)).toBe(0);
    expect((await store.purseOf(db, me)).merit).toBe(30);
  });

  it("tells the same fact from another one by its reference", async () => {
    const me = await someone("rohmer");
    await store.award(db, me, "watch", "42:2026-03-01", 1);
    await store.award(db, me, "watch", "42:2026-03-02", 1);
    /* The same film, another evening: a second gain. The same evening
       again: nothing. */
    await store.award(db, me, "watch", "42:2026-03-02", 1);
    expect((await store.purseOf(db, me)).merit).toBe(2);
  });

  it("leaves the purse equal to the journal, whatever the run", async () => {
    const me = await someone("rivette");
    await store.award(db, me, "quiz", "q1", 18);
    await store.award(db, me, "quiz_flawless", "q1", 15);
    await store.award(db, me, "quiz", "q1", 18); // refused
    await store.award(db, me, "review", "77", 3);
    expect(await store.purseOf(db, me)).toEqual(await journal(me));
  });
});

describe("what one merely declares", () => {
  it("stops paying past the day's ceiling", async () => {
    const me = await someone("akerman");
    /* Fifty screenings claimed on the same day. */
    let credited = 0;
    for (let i = 0; i < 50; i++) {
      credited += await store.award(db, me, "watch", `${i}:2026-03-01`, 1);
    }
    expect(credited).toBe(DECLARED_CEILING);
    expect((await store.purseOf(db, me)).merit).toBe(DECLARED_CEILING);
  });

  it("does not cap what the server itself witnessed", async () => {
    const me = await someone("guiraudie");
    for (let i = 0; i < 50; i++) await store.award(db, me, "watch", `${i}:2026-03-01`, 1);
    /* The ceiling is full — and a quiz, which the server scored itself,
       still pays. Otherwise a busy afternoon of filing would silently
       cost somebody their evening's game. */
    expect(await store.award(db, me, "quiz", "q9", 22)).toBe(22);
  });
});

describe("a card, priced", () => {
  it("pays a screening a day, a review and a rating once each", async () => {
    const me = await someone("denis");
    const card = {
      tmdb_id: "1234",
      data: {
        watches: [{ date: "2026-03-01T21:00:00Z" }, { date: "2026-03-04" }],
        rating: 4,
        review: "x".repeat(200),
      },
    };
    expect(await store.awardFromCard(db, me, card)).toBe(
      RATE.watch * 2 + RATE.review + RATE.rating
    );
    /* Synchronising the same card again — which happens at every start —
       must add nothing at all. */
    expect(await store.awardFromCard(db, me, card)).toBe(0);
  });

  it("ignores a review too short to be one", async () => {
    const me = await someone("breillat");
    await store.awardFromCard(db, me, { tmdb_id: "9", data: { review: "bien" } });
    expect((await store.purseOf(db, me)).merit).toBe(0);
  });

  it("survives a card from before the screening log", async () => {
    const me = await someone("pialat");
    /* `watches` did not always exist, and an old card carries a single
       date. Ignoring it would tell somebody they never saw the film. */
    await store.awardFromCard(db, me, { tmdb_id: "5", data: { watchedAt: "2019-06-02" } });
    expect((await store.purseOf(db, me)).merit).toBe(1);
  });

  it("says nothing of a card that claims nothing", async () => {
    const me = await someone("garrel");
    expect(await store.awardFromCard(db, me, { tmdb_id: "3", data: {} })).toBe(0);
    expect(await store.awardFromCard(db, me, { tmdb_id: null, data: { rating: 5 } })).toBe(0);
  });
});

/* ------------------------------------------------------------
   THE TWO THINGS THE SERVER SCORED ITSELF
   ------------------------------------------------------------ */

/** A bank of ten, a quiz drawn from it, and the answers all right. */
async function quizPlayedBy(pseudo: string, rightAnswers: number) {
  const cat = await store.createCategory(db, { label: `cat-${pseudo}` });
  for (let i = 0; i < 10; i++) {
    const q = await store.addBankQuestion(db, cat, { ask: `q${i}`, difficulty: "easy" });
    await store.setChoices(db, q, [
      { label: "oui", is_right: true },
      { label: "non", is_right: false },
    ]);
  }
  const me = await store.createPerson(db, pseudo);
  const quiz = await store.drawQuiz(db, me.id, {
    title: "partie",
    categoryIds: [cat],
    level: "easy",
    size: 10,
  });
  await store.startAttempt(db, quiz.id, me.id);

  const drawn = await db.query<{ question_id: string }>(
    "SELECT question_id FROM quiz_draw WHERE quiz_id = $1 ORDER BY rank",
    [quiz.id]
  );
  for (const [i, d] of drawn.entries()) {
    const c = await db.query<{ id: string }>(
      "SELECT id FROM quiz_choice WHERE question_id = $1 AND is_right = $2 LIMIT 1",
      [d.question_id, i < rightAnswers]
    );
    await store.answer(db, quiz.id, me.id, d.question_id, c[0]!.id);
  }
  await store.finishAttempt(db, quiz.id, me.id);
  return { me: me.id, quiz: quiz.id };
}

describe("a quiz, once finished", () => {
  it("pays the score, and the flawless run on top", async () => {
    const g = await quizPlayedBy("chantal", 10);
    const gains = await store.awardQuiz(db, g.quiz, g.me);
    expect(gains.map((x) => x.kind)).toEqual(["quiz", "quiz_flawless"]);
    /* Ten easy questions, one point each. */
    expect(gains[0]!.amount).toBe(10);
    expect((await store.purseOf(db, g.me)).merit).toBe(10 + RATE.quiz_flawless);
  });

  it("pays nothing extra for a run that was not flawless", async () => {
    const g = await quizPlayedBy("jean", 7);
    const gains = await store.awardQuiz(db, g.quiz, g.me);
    expect(gains.map((x) => x.kind)).toEqual(["quiz"]);
    expect((await store.purseOf(db, g.me)).merit).toBe(7);
  });

  it("does not pay for being first when nobody else was playing", async () => {
    const g = await quizPlayedBy("seule", 10);
    const gains = await store.awardQuiz(db, g.quiz, g.me);
    expect(gains.map((x) => x.kind)).not.toContain("quiz_first");
  });

  it("credits once, however many times finishing is asked for", async () => {
    const g = await quizPlayedBy("double", 10);
    await store.awardQuiz(db, g.quiz, g.me);
    const again = await store.awardQuiz(db, g.quiz, g.me);
    expect(again).toEqual([]);
    expect((await store.purseOf(db, g.me)).merit).toBe(10 + RATE.quiz_flawless);
  });
});

describe("a challenge, once its period is over", () => {
  /** A list of `works` films, a finished challenge, and one participant. */
  async function finished(pseudo: string, works: number, seen: number) {
    const me = await store.createPerson(db, pseudo);
    const list = await store.createList(db, me.id, { title: "mars" });
    for (let i = 0; i < works; i++) {
      await store.addToList(db, list, me.id, { tmdbId: String(1000 + i), title: `film ${i}` });
      if (i < seen) {
        await store.storeCard(db, me.id, {
          id: `c${i}`,
          tmdbId: String(1000 + i),
          data: { watches: [{ date: "2026-03-04" }] },
          updatedAt: new Date(1),
        });
      }
    }
    const e = await store.createChallenge(db, me.id, {
      listId: list,
      title: "le défi",
      starts_on: "2026-03-01",
      ends_on: "2026-03-31",
    });
    return { me: me.id, challenge: e };
  }

  it("pays whoever went the whole way", async () => {
    const g = await finished("complete", 4, 4);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });

  it("pays half a way, less", async () => {
    const g = await finished("moitie", 4, 2);
    await store.settleChallenge(db, g.challenge);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge_half);
  });

  it("pays nothing for barely starting", async () => {
    const g = await finished("apeine", 4, 1);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
    expect((await store.purseOf(db, g.me)).merit).toBe(0);
  });

  it("pays nothing for a challenge on an empty list", async () => {
    /* Everybody has "finished" a list of no films, and it would have
       been the cheapest merit going. */
    const g = await finished("vide", 0, 0);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
  });

  /* ============================================================
     LE FILET DE `SEEN_DURING`, TISSÉ AVANT D'Y TOUCHER

     Cette sous-requête est celle par laquelle passe le paiement de TOUS
     les défis, et elle a DEUX appelants : `progressOf`, qui affiche, et
     `settleChallenge`, qui PAIE. Les cas des trois âges de données —
     journal `watches`, `watchedAt` d'avant le journal, et un `watches`
     qui n'est pas un tableau — n'étaient éprouvés que sur le premier.
     Or `merit_event` est unique : UN PAIEMENT FAUX NE PEUT PAS ÊTRE
     REJOUÉ JUSTE. Le côté qui comptait sans filet est celui qui coûte.

     Le mélange est choisi pour que le verdict soit SENSIBLE : deux
     films sur quatre, donc exactement `challenge_half`. Qu'un seul des
     quatre cas bascule et la ligne payée change de nom — trois comptés
     donneraient encore la moitié, mais un de moins ne paierait plus
     rien et quatre paieraient le tout.
     ============================================================ */
  it("pays the same over all three ages of card, and survives a malformed log", async () => {
    const me = await store.createPerson(db, "trois-ages");
    const list = await store.createList(db, me.id, { title: "mars" });
    const works = [
      /* Le journal, dans la période : compte. */
      { tmdb: "2000", data: { watches: [{ date: "2026-03-04" }] } },
      /* D'AVANT LE JOURNAL : une fiche importée ne porte que
         `watchedAt`, et l'oublier volerait des points à qui a le plus
         ancien classeur. */
      { tmdb: "2001", data: { watchedAt: "2026-03-09" } },
      /* Vu, mais l'an dernier : un défi mensuel qui compterait cela se
         gagnerait en s'inscrivant. */
      { tmdb: "2002", data: { watches: [{ date: "2025-01-04" }] } },
      /* PAS UN TABLEAU. `jsonb_array_elements` sur autre chose fait
         tomber la requête ENTIÈRE — et avec elle le paiement de tous
         les participants, pas seulement de celui-ci. */
      { tmdb: "2003", data: { watches: "autrefois" } },
    ];
    for (const [i, w] of works.entries()) {
      await store.addToList(db, list, me.id, { tmdbId: w.tmdb, title: `film ${i}` });
      await store.storeCard(db, me.id, {
        id: `c${i}`,
        tmdbId: w.tmdb,
        data: w.data,
        updatedAt: new Date(1),
      });
    }
    const challenge = await store.createChallenge(db, me.id, {
      listId: list,
      title: "le défi",
      starts_on: "2026-03-01",
      ends_on: "2026-03-31",
    });

    /* LES DEUX APPELANTS COMPTENT PAREIL, et c'est la moitié du contrat :
       un écran qui annonce deux et une bourse qui en paie trois est le
       genre d'écart qu'on ne découvre qu'en relisant un classement. */
    expect(
      (await store.progressOf(db, challenge)).find((p) => p.pseudo === "trois-ages")?.done
    ).toBe(2);
    expect(await store.settleChallenge(db, challenge)).toBe(1);
    expect((await store.purseOf(db, me.id)).merit).toBe(RATE.challenge_half);
  });

  /* ============================================================
     UNE CIBLE CHIFFRÉE

     Une liste de quarante films ne se finit pas en un mois : un défi
     bâti dessus ne payait personne et se lisait comme cassé. La cible
     en fait une intention tenable sans toucher à la liste, qui
     appartient à quelqu'un et sert peut-être à autre chose.

     ET LE BARÈME NE BOUGE PAS D'UNE LIGNE. Une nature change CE QUI
     COMPTE, jamais CE QUE ÇA PAIE — un gain proportionnel à la cible
     aurait laissé le créateur fixer son propre prix.
     ============================================================ */
  it("pays the whole way at the TARGET, not at the end of the list", async () => {
    const g = await finished("cible", 10, 3);
    await db.query("UPDATE challenge SET target = 3 WHERE id = $1", [g.challenge]);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    /* Trois sur dix, mais trois sur trois : le tout, et au tarif
       ordinaire du défi. */
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });

  it("never asks for more films than the list holds", async () => {
    /* La liste peut MAIGRIR après coup — quelqu'un retire une œuvre — et
       une cible devenue inatteignable rendrait le défi impossible à
       finir sans que personne l'ait décidé. */
    const g = await finished("retrecie", 4, 4);
    await db.query("UPDATE challenge SET target = 99 WHERE id = $1", [g.challenge]);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });

  it("leaves every challenge written before the target untouched", async () => {
    /* NULL veut dire « toute la liste » : rien à rétro-remplir. */
    const g = await finished("avant", 4, 2);
    expect((await store.challengeById(db, g.challenge))?.target).toBeNull();
    await store.settleChallenge(db, g.challenge);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge_half);
  });

  /* ============================================================
     UN DÉFI PAR CRITIQUE

     « Pendant la période » NE PEUT PAS ÊTRE `updated_at` : une critique
     ne porte aucune date, et `card.updated_at` bouge à la moindre
     retouche — une fiche effleurée en mars aurait payé une critique
     écrite deux ans plus tôt. On demande donc les deux choses qui, elles,
     sont datables ou mesurables : UNE SÉANCE DANS LA PÉRIODE, et une
     critique d'au moins `REVIEW_LENGTH` signes — la même longueur
     qu'`awardFromCard` exige déjà pour la payer.

     ET LE BARÈME NE BOUGE PAS. Pas de `challenge_review` mieux payé :
     il est plus facile à vérifier, donc mieux le payer aurait été
     l'arbitrage.
     ============================================================ */
  async function reviewChallenge(pseudo: string, cards: Record<string, unknown>[]) {
    const me = await store.createPerson(db, pseudo);
    const list = await store.createList(db, me.id, { title: "mars" });
    for (const [i, data] of cards.entries()) {
      await store.addToList(db, list, me.id, { tmdbId: String(3000 + i), title: `film ${i}` });
      await store.storeCard(db, me.id, {
        id: `r${i}`,
        tmdbId: String(3000 + i),
        data,
        updatedAt: new Date(1),
      });
    }
    const challenge = await store.createChallenge(db, me.id, {
      listId: list,
      title: "en écrire",
      starts_on: "2026-03-01",
      ends_on: "2026-03-31",
      kind: "critique",
    });
    return { me: me.id, challenge };
  }

  const seen = { watches: [{ date: "2026-03-04" }] };

  it("wants a screening in the period AND a review long enough", async () => {
    const g = await reviewChallenge("critique", [
      /* Les deux : compte. */
      { ...seen, review: "x".repeat(REVIEW_LENGTH) },
      /* Vu dans la période, mais rien d'écrit : c'est un défi par
         critique, pas un défi par liste. */
      { ...seen },
      /* Écrit, mais trop court pour être une critique — la même mesure
         que celle qui décide de la payer. */
      { ...seen, review: "bien" },
      /* Une vraie critique, mais la séance est hors période : sans cela
         on paierait ce qu'on a écrit il y a deux ans en effleurant la
         fiche, puisqu'une critique ne porte pas de date. */
      { watches: [{ date: "2025-01-04" }], review: "x".repeat(REVIEW_LENGTH) },
    ]);

    expect((await store.progressOf(db, g.challenge))[0]!.done).toBe(1);
  });

  it("counts like an ordinary challenge when the nature is a list", async () => {
    /* LE DÉFAUT NE CHANGE PAS D'UN IOTA : tout défi écrit avant 004 est
       en 'liste', et une critique n'y est demandée nulle part. */
    const g = await finished("liste-ordinaire", 4, 4);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });

  it("pays a review challenge at the ORDINARY rate", async () => {
    const g = await reviewChallenge("paye-pareil", [
      { ...seen, review: "x".repeat(REVIEW_LENGTH) },
      { ...seen, review: "x".repeat(REVIEW_LENGTH) },
    ]);
    await db.query("UPDATE challenge SET ends_on = current_date - 1 WHERE id = $1", [g.challenge]);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    /* Le même `RATE.challenge` qu'un défi par liste : une nature change
       CE QUI COMPTE, jamais CE QUE ÇA PAIE. */
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });

  it("is settled by the first to look, and by nobody after", async () => {
    const g = await finished("premiere", 4, 4);
    expect(await store.settleChallenge(db, g.challenge)).toBe(1);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
    expect(await store.settleChallenge(db, g.challenge)).toBe(0);
    expect((await store.purseOf(db, g.me)).merit).toBe(RATE.challenge);
  });
});
