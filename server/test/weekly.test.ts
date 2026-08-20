import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testApp, testDb } from "./helpers.ts";
import * as store from "../src/store.ts";
import type { Db } from "../src/db.ts";
import type { FastifyInstance } from "fastify";

/* ============================================================
   LE QUIZZ DE LA SEMAINE

   IL SE TIRE TOUT SEUL, PARCE QUE PERSONNE NE PEUT LE TIRER. Ce serveur
   n'a aucune tache de fond : la premiere lecture de la semaine EST le
   declencheur. Tout ce fichier tourne autour de ce que cela implique —
   deux lectures simultanees ne doivent pas donner deux quizz, et une
   banque vide ne doit pas fermer la semaine sur un quizz creux.

   ET IL RENVERSE UNE REGLE ECRITE. `quiz_player` porte le commentaire
   « A quiz has no public leaderboard by design », et cela reste vrai de
   tous les quizz TIRES. Celui-ci est l'exception, et les cas ci-dessous
   verifient qu'elle est BORNEE : on elargit qui peut LIRE et jouer, on
   n'ouvre rien du cote de l'ecriture, et on ne desserre pas d'un cran
   la regle qui retient les corrections.
   ============================================================ */

let db: Db;
let app: FastifyInstance;

async function count(pseudo: string, admin = false) {
  const person = await store.createPerson(db, pseudo);
  if (admin) await store.markAdmins(db, [pseudo]);
  const secret = await store.openSession(db, person.id);
  return { person, cookie: `session=${secret}` };
}

/** Une banque assez profonde pour qu'un tirage de vingt aboutisse. */
async function bank(n = 12) {
  const category = await store.createCategory(db, { label: "nouvelle vague" });
  for (const difficulty of ["easy", "normal", "hard"]) {
    for (let i = 0; i < n; i++) {
      const id = await store.addBankQuestion(db, category, {
        ask: `${difficulty} ${i}`,
        difficulty,
      });
      await store.setChoices(db, id, [
        { label: "Agnès Varda", is_right: true },
        { label: "Jacques Demy", is_right: false },
      ]);
    }
  }
  return category;
}

const weekly = (cookie: string) =>
  app.inject({ method: "GET", url: "/quizzes/weekly", headers: { cookie } });

const board = (cookie: string) =>
  app.inject({ method: "GET", url: "/quizzes/weekly/board", headers: { cookie } });

/** Jouer le quizz de la semaine en entier, en cochant toujours `pick`. */
async function play(cookie: string, pick: (n: number) => number = () => 0) {
  const got = (await weekly(cookie)).json();
  const id = got.quiz.id as string;
  await app.inject({ method: "POST", url: `/quizzes/${id}/attempt`, headers: { cookie } });
  const qs = (await weekly(cookie)).json().questions;
  for (const [i, q] of qs.entries()) {
    await app.inject({
      method: "POST",
      url: `/quizzes/${id}/attempt/answers`,
      headers: { cookie },
      payload: { questionId: q.id, choiceId: q.choices[pick(i)].id },
    });
  }
  return app.inject({
    method: "POST",
    url: `/quizzes/${id}/attempt/finish`,
    headers: { cookie },
  });
}

beforeEach(async () => {
  db = await testDb();
  app = await testApp(db);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("le tirage paresseux", () => {
  it("tire au premier regard, et le meme au second", async () => {
    await bank();
    const anna = await count("anna");

    const first = (await weekly(anna.cookie)).json();
    const second = (await weekly(anna.cookie)).json();

    expect(first.quiz.id).toBeTruthy();
    expect(second.quiz.id).toBe(first.quiz.id);
    expect(first.questions).toHaveLength(20);
  });

  it("n'en tire qu'UN quand deux personnes regardent en meme temps", async () => {
    /* LE CAS QUE L'INDEX UNIQUE EXISTE POUR TENIR. Sans lui, chacune
       des deux lectures ne trouve rien, chacune tire, et la semaine se
       retrouve avec deux quizz differents — donc deux classements, et
       deux personnes persuadees d'avoir joue le meme. Le perdant de la
       course lit le quizz du gagnant plutot que de lever. */
    await bank();
    const anna = await count("anna");
    const bruno = await count("bruno");

    const [a, b] = await Promise.all([weekly(anna.cookie), weekly(bruno.cookie)]);

    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().quiz.id).toBe(b.json().quiz.id);
    const rows = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM quiz WHERE week IS NOT NULL"
    );
    expect(rows[0]!.n).toBe(1);
  });

  it("refuse une seconde ligne pour la meme semaine, DANS LE SCHEMA", async () => {
    /* LE CAS AU-DESSUS NE PROUVE PAS LA GARANTIE, ET IL FAUT LE DIRE.
       PGlite serialise les requetes sur une seule connexion : deux
       `inject` lances ensemble s'y executent l'un apres l'autre, donc
       ce `Promise.all` verifie que la relecture marche, pas que la
       course est perdue proprement. Ce qui tient reellement la
       garantie est l'index unique partiel, et c'est lui qu'on
       interroge ici — a la main, sans passer par le code appelant,
       parce qu'une regle ecrite dans une route se contourne par la
       route suivante. */
    await bank();
    const anna = await count("anna");
    await weekly(anna.cookie);

    await expect(
      db.query(
        `INSERT INTO quiz (id, owner_id, title, level, size, softened, week)
         VALUES (gen_random_uuid(), $1, 'doublon', 'normal', 20, false,
                 (date_trunc('week', now() at time zone 'utc'))::date)`,
        [anna.person.id]
      )
    ).rejects.toThrow();

    /* Et l'index ne dit rien des quizz ORDINAIRES : ils ont `week` a
       NULL et peuvent etre des milliers. */
    const other = await store.drawQuiz(db, anna.person.id, {
      title: "Un soir",
      categoryIds: [(await db.query<{ id: string }>("SELECT id FROM quiz_category"))[0]!.id],
      level: "normal",
      size: 10,
    });
    expect(other.id).toBeTruthy();
  });

  it("laisse la semaine OUVERTE quand la banque n'a rien de jouable", async () => {
    /* Une categorie sans question, ou dont les questions n'ont pas
       exactement une bonne reponse. Ecrire un quizz vide aurait ferme
       le rendez-vous jusqu'a lundi prochain sur une banque qui n'etait
       pas prete : personne n'aurait su pourquoi, et personne n'aurait
       pu le defaire. */
    await store.createCategory(db, { label: "vide" });
    const anna = await count("anna");

    expect((await weekly(anna.cookie)).json().quiz).toBeNull();
    const rows = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM quiz");
    expect(rows[0]!.n).toBe(0);

    /* Et il se tire des que la banque est remplie, sans que personne
       n'ait a le demander. */
    await bank();
    expect((await weekly(anna.cookie)).json().quiz.id).toBeTruthy();
  });

  it("n'appartient a personne, et ne s'affiche dans les quizz de personne", async () => {
    /* `owner_id` EST NUL, ET C'EST CE QUI LE TIENT HORS DE `myQuizzes`
       SANS UNE LIGNE DE CODE : cette requete joint `person` sur le
       proprietaire, et une jointure interne ecarte la ligne
       d'elle-meme. Lui designer un admin pour proprietaire lui aurait
       donne le droit de le SUPPRIMER pour tout le monde. */
    await bank();
    const admin = await count("maquecime", true);
    await weekly(admin.cookie);

    expect(await store.myQuizzes(db, admin.person.id)).toEqual([]);
    const rows = await db.query<{ owner_id: string | null }>(
      "SELECT owner_id FROM quiz WHERE week IS NOT NULL"
    );
    expect(rows[0]!.owner_id).toBeNull();
  });

  it("se lit ENTIEREMENT malgre l'absence de proprietaire", async () => {
    /* `quizById` joignait `person` SEC. Un quizz sans proprietaire
       disparaissait donc de sa propre requete, et l'ecran s'ouvrait
       sans titre, sans niveau et sans sujets — sans qu'une seule erreur
       soit levee. C'est mot pour mot le piege deja paye sur les defis
       par critere. */
    await bank();
    const anna = await count("anna");

    const quiz = (await weekly(anna.cookie)).json().quiz;
    expect(quiz.title).toBeTruthy();
    expect(quiz.level).toBe("normal");
    expect(quiz.owner).toBeNull();
    expect(quiz.topics.length).toBeGreaterThan(0);
  });
});

describe("qui peut y toucher", () => {
  it("se joue sans invitation, la ou un quizz tire repond 404", async () => {
    await bank();
    const anna = await count("anna");
    const bruno = await count("bruno");
    const id = (await weekly(anna.cookie)).json().quiz.id as string;

    /* Bruno n'a ete invite nulle part et ouvre son essai. C'est tout le
       propos : un rendez-vous auquel il faut etre convie n'est pas un
       rendez-vous. */
    const opened = await app.inject({
      method: "POST",
      url: `/quizzes/${id}/attempt`,
      headers: { cookie: bruno.cookie },
    });
    expect(opened.statusCode).toBe(200);

    /* Et l'elargissement s'arrete la : un quizz ordinaire d'anna reste
       invisible a bruno. */
    const mine = await store.drawQuiz(db, anna.person.id, {
      title: "Un soir",
      categoryIds: [(await db.query<{ id: string }>("SELECT id FROM quiz_category"))[0]!.id],
      level: "normal",
      size: 10,
    });
    const peek = await app.inject({
      method: "GET",
      url: `/quizzes/${mine.id}`,
      headers: { cookie: bruno.cookie },
    });
    expect(peek.statusCode).toBe(404);
  });

  it("ne se renomme ni ne s'efface, pas meme par un admin", async () => {
    /* `write` RESTE FERME A TOUT LE MONDE. Le role passe au-dessus des
       routes, pas au-dessus d'un objet qui n'appartient a personne — et
       un quizz que quelqu'un peut supprimer au milieu de la semaine
       emporterait les essais de tous les autres. */
    await bank();
    const admin = await count("maquecime", true);
    const id = (await weekly(admin.cookie)).json().quiz.id as string;

    const renamed = await app.inject({
      method: "PUT",
      url: `/quizzes/${id}`,
      headers: { cookie: admin.cookie },
      payload: { title: "à moi" },
    });
    expect(renamed.statusCode).toBe(403);

    const erased = await app.inject({
      method: "DELETE",
      url: `/quizzes/${id}`,
      headers: { cookie: admin.cookie },
    });
    expect(erased.statusCode).toBe(403);
  });

  it("ne desserre pas d'un cran la retenue des corrections", async () => {
    /* UN QUIZZ PUBLIC ELARGIT QUI PEUT JOUER, ET RIEN D'AUTRE. Les
       bonnes reponses ne descendent qu'une fois l'essai clos, ici comme
       ailleurs — sans quoi il suffirait d'ouvrir l'inspecteur une fois
       par semaine pour tenir le classement. */
    await bank();
    const anna = await count("anna");
    const id = (await weekly(anna.cookie)).json().quiz.id as string;
    await app.inject({
      method: "POST",
      url: `/quizzes/${id}/attempt`,
      headers: { cookie: anna.cookie },
    });

    const midway = (await weekly(anna.cookie)).json();
    expect(
      midway.questions.every((q: { choices: { is_right?: boolean }[] }) =>
        q.choices.every((c) => c.is_right === undefined)
      )
    ).toBe(true);

    await play(anna.cookie);
    const after = (await weekly(anna.cookie)).json();
    expect(after.questions[0].choices.some((c: { is_right?: boolean }) => c.is_right)).toBe(true);
  });
});

describe("le classement public", () => {
  it("montre tout le monde, et non les seuls invites", async () => {
    await bank();
    const anna = await count("anna");
    const bruno = await count("bruno");
    await play(anna.cookie);
    await play(bruno.cookie);

    const seen = (await board(anna.cookie)).json().scores as { pseudo: string }[];
    expect(seen.map((s) => s.pseudo).sort()).toEqual(["anna", "bruno"]);
  });

  it("laisse un blocage l'emporter sur la vitrine, dans les deux sens", async () => {
    /* LA SEULE CHOSE QUI RESTE FERMEE DANS UN CLASSEMENT PUBLIC. Un
       blocage n'a pas de sens : qu'il vienne de l'un ou de l'autre, les
       deux disparaissent l'un pour l'autre. */
    await bank();
    const anna = await count("anna");
    const bruno = await count("bruno");
    await play(anna.cookie);
    await play(bruno.cookie);
    await store.block(db, anna.person.id, bruno.person.id);

    const forAnna = (await board(anna.cookie)).json().scores as { pseudo: string }[];
    const forBruno = (await board(bruno.cookie)).json().scores as { pseudo: string }[];
    expect(forAnna.map((s) => s.pseudo)).toEqual(["anna"]);
    expect(forBruno.map((s) => s.pseudo)).toEqual(["bruno"]);
  });

  it("departage a score egal SANS jamais changer d'avis", async () => {
    /* CE TABLEAU SE REGARDE, DONC IL DOIT ETRE DETERMINISTE : un
       departage au hasard le ferait changer entre deux
       rafraichissements, et on croirait avoir perdu une place.

       ET IL NE SE DEPARTAGE PAS A LA VITESSE. `QuizScore.seconds`
       porte deja son interdiction — « le merite se gagne sur ce qu'on
       repond, jamais sur la vitesse » — et trier un classement PUBLIC
       dessus aurait recompense exactement le geste que le bareme refuse
       de payer. On departage sur QUI A FINI EN PREMIER, la notion que
       `quiz_first` paie deja. */
    await bank();
    const anna = await count("anna");
    const bruno = await count("bruno");
    await play(anna.cookie);
    await play(bruno.cookie);

    const once = (await board(anna.cookie)).json().scores as { pseudo: string; score: number }[];
    expect(once[0]!.score).toBe(once[1]!.score);
    for (let i = 0; i < 3; i++) {
      const again = (await board(anna.cookie)).json().scores as { pseudo: string }[];
      expect(again.map((s) => s.pseudo)).toEqual(once.map((s) => s.pseudo));
    }
    /* Anna a fini la premiere, donc anna passe devant — et non « anna
       parce qu'elle est plus haut dans l'alphabet ». */
    expect(once[0]!.pseudo).toBe("anna");
  });

  it("range devant qui a le meilleur score, avant tout le reste", async () => {
    await bank();
    const anna = await count("anna");
    const bruno = await count("bruno");
    /* Anna se trompe partout et finit la PREMIERE ; bruno a tout juste
       et finit apres. Le score l'emporte sur l'ordre d'arrivee. */
    await play(anna.cookie, () => 1);
    await play(bruno.cookie);

    const seen = (await board(anna.cookie)).json().scores as { pseudo: string; score: number }[];
    expect(seen[0]!.pseudo).toBe("bruno");
    expect(seen[0]!.score).toBeGreaterThan(seen[1]!.score);
  });

  it("ne dit rien quand il n'y a pas de quizz cette semaine", async () => {
    const anna = await count("anna");
    expect((await board(anna.cookie)).json().scores).toEqual([]);
  });
});

describe("ce que ca paie", () => {
  it("credite le score une seule fois, comme n'importe quel quizz", async () => {
    /* AUCUNE `Kind` NEUVE : `merit_event` est unique sur
       (personne, genre, reference), et le quizz de la semaine a un
       identifiant comme les autres. Il n'y avait donc rien a ecrire —
       et un `quiz_weekly` mieux paye aurait fait du rendez-vous un
       arbitrage. */
    await bank();
    const anna = await count("anna");
    const first = (await play(anna.cookie)).json();
    expect(first.gains.length).toBeGreaterThan(0);

    const before = (await store.purseOf(db, anna.person.id)).merit;
    const id = (await weekly(anna.cookie)).json().quiz.id as string;
    await app.inject({
      method: "POST",
      url: `/quizzes/${id}/attempt/finish`,
      headers: { cookie: anna.cookie },
    });
    expect((await store.purseOf(db, anna.person.id)).merit).toBe(before);
  });
});
