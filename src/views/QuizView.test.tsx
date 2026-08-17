import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuizView } from "./QuizView";
import { FeedbackProvider } from "../components/ui/Feedback";
import { quizBank } from "../hooks/useHall";

/* ============================================================
   LE FILET, TISSÉ AVANT DE DÉCOUPER
   ============================================================

   Ce fichier est écrit contre `QuizView.tsx` TEL QU'IL EST, mille trois
   cent quatre-vingt-sept lignes en un seul morceau, et sa raison d'être
   est d'y survivre sans une retouche pendant qu'on le découpe. S'il faut
   l'éditer pour faire passer la découpe, c'est que la découpe a changé
   le comportement — c'est tout ce qu'on lui demande de dire.

   ONZE CAS, ET CHACUN EST UN DÉFAUT QUI PASSERAIT EN SILENCE. Aucun ne
   vérifie une couleur ni une marge : ce qui casse en découpant, ce sont
   les enchaînements — qui appelle quoi, dans quel ordre, et ce qui NE
   descend pas jusqu'à l'écran.

   LA FRONTIÈRE MOCKÉE EST `services/server`, et elle seule : c'est la
   seule que cette vue traverse. Mocker `hooks/useHall` par-dessus
   masquerait le cache, qui fait partie du comportement.
   ============================================================ */

/* `vi.hoisted` PARCE QUE `vi.mock` EST REMONTÉ EN TÊTE DE FICHIER. Une
   fabrique de mock qui lit une constante déclarée plus bas s'exécute
   avant elle et échoue à l'initialisation — le message ne dit pas
   « remontée », il dit « impossible d'accéder avant initialisation ». */
const api = vi.hoisted(() => ({
  serverConfigured: vi.fn(() => true),
  iAmAdmin: vi.fn(() => false),
  accountOpen: vi.fn(() => true),
  myQuizzes: vi.fn(),
  /* LE SÉLECTEUR DE PERSONNES LES DEMANDE, et le Proxy plus bas rend
     `undefined` pour tout nom absent de cette liste : les omettre ne
     donnait pas une suggestion vide, cela LEVAIT et emportait la partie
     entière. C'est ce que le `try` de `PeoplePicker` rattrape désormais —
     ces deux lignes sont là pour éprouver le cas nominal, pas pour
     cacher le cas dégradé. */
  mySubscriptions: vi.fn(),
  myFollowers: vi.fn(),
  quizCategories: vi.fn(),
  readQuiz: vi.fn(),
  startQuiz: vi.fn(),
  answerQuiz: vi.fn(),
  finishQuiz: vi.fn(),
  quizScores: vi.fn(),
  myHoldings: vi.fn(),
  invitePlayer: vi.fn(),
  removePlayer: vi.fn(),
  deleteQuiz: vi.fn(),
  drawQuiz: vi.fn(),
  halveQuestion: vi.fn(),
  redoQuestion: vi.fn(),
  bankQuestions: vi.fn(),
  addBankQuestion: vi.fn(),
  editBankQuestion: vi.fn(),
  removeBankQuestion: vi.fn(),
  reviveBankQuestion: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("../services/server", () => new Proxy(api, { get: (t, k) => t[k as keyof typeof api] }));
vi.mock("../hooks/usePurse", () => ({ refreshPurse: vi.fn(), usePurse: () => 0 }));
vi.mock("../hooks/useShop", () => ({ useShop: () => [] }));

const QUIZ = {
  id: "q1",
  title: "Le quizz du samedi",
  level: "normal",
  size: 2,
  softened: false,
  /* LE NOM EST CELUI QUE LE SERVEUR ENVOIE, en serpent, et le fixture
     doit l'épeler pareil : c'est là que ce dépôt s'est fait prendre deux
     fois, et un fixture qui l'épelle autrement ferait passer un écran
     que la production ne rend pas. `null` : pas de chronomètre. */
  seconds_per_question: null as number | null,
  owner: "copine",
  topics: ["nouvelle vague"],
  mine: true,
  answered: 0,
  finished: false,
};

/** Deux questions, la seconde jamais répondue tant qu'on ne dit rien. */
const question = (id: string, mine: string | null = null) => ({
  id,
  rank: id === "qa" ? 1 : 2,
  ask: `La question ${id}`,
  image: null,
  points: 2,
  category: "nouvelle vague",
  choices: [
    { id: `${id}-bonne`, label: `Varda ${id}` },
    { id: `${id}-autre`, label: `Demy ${id}` },
  ],
  mine,
});

const board = (over = false) => ({
  scores: [
    { pseudo: "copine", score: over ? 4 : 0, answered: over ? 2 : 0, finished: over, seconds: 12 },
  ],
});

beforeEach(() => {
  for (const fn of Object.values(api)) if (vi.isMockFunction(fn)) fn.mockReset();
  api.serverConfigured.mockReturnValue(true);
  api.iAmAdmin.mockReturnValue(false);
  api.accountOpen.mockReturnValue(true);
  api.myQuizzes.mockResolvedValue({ quizzes: [QUIZ] });
  api.quizCategories.mockResolvedValue({ categories: [] });
  api.mySubscriptions.mockResolvedValue({ subscriptions: [] });
  api.myFollowers.mockResolvedValue({ followers: [] });
  api.startQuiz.mockResolvedValue({ started: true });
  api.myHoldings.mockResolvedValue({ powers: {} });
  api.quizScores.mockResolvedValue(board());
  api.answerQuiz.mockResolvedValue({ answered: true });
  api.readQuiz.mockResolvedValue({
    questions: [question("qa"), question("qb")],
    players: [],
    weight: 4,
    attempt: { started_at: "now", finished_at: null },
  });
});

const mount = () =>
  render(
    <FeedbackProvider>
      <QuizView connected />
    </FeedbackProvider>
  );

/** Ouvrir la soirée, ce qui EST la mettre en jeu — il n'y a pas de
    bouton « commencer ». Depuis A1 la partie est une COUCHE : le clic
    porte sur un vrai `<button>`, et ce qui suit se lit dans le corps du
    document, pas dans la colonne de vue. */
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  mount();
  await user.click(await screen.findByText("Le quizz du samedi"));
  await screen.findByText("La question qa");
};

describe("opening a quiz", () => {
  it("starts the attempt ONCE, then reads — there is no start button", async () => {
    const user = userEvent.setup();
    await open(user);

    /* Ouvrir EST commencer, et c'est idempotent côté serveur : un bouton
       « commencer » serait une chose de plus à expliquer. */
    expect(api.startQuiz).toHaveBeenCalledTimes(1);
    expect(api.startQuiz).toHaveBeenCalledWith("q1");
    expect(api.readQuiz).toHaveBeenCalledWith("q1");
  });

  it("is a dialogue that names itself, opened from a real button", async () => {
    const user = userEvent.setup();
    await open(user);

    /* `useDialog` ne pose AUCUN attribut — son en-tête le dit — donc
       l'ARIA est écrit à la main, et c'est exactement ce qui se serait
       perdu en silence. La couche se NOMME : sans `aria-labelledby`, un
       lecteur d'écran annonce « dialogue » et rien d'autre. */
    const game = await screen.findByRole("dialog");
    expect(game).toHaveAttribute("aria-modal", "true");
    expect(game).toHaveAccessibleName("Le quizz du samedi");

    /* L'en-tête était un `<div onClick>` : inatteignable au clavier, et
       muet sur ce qu'il ouvre. */
    const door = screen.getByRole("button", { name: /Le quizz du samedi/ });
    expect(door).toHaveAttribute("aria-haspopup", "dialog");
    expect(door).toHaveAttribute("aria-expanded", "true");
  });

  it("does not close a game underway — it ASKS, and the answers survive", async () => {
    const user = userEvent.setup();
    await open(user);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quitter la partie" }));
    /* La carte de confirmation est à 60, la partie à 50 : on demande
       PAR-DESSUS. Et le corps dit ce qui survit, parce que « quitter »
       tout seul se lit comme « perdre ». */
    expect(await screen.findByText(/Les réponses déjà posées restent posées/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Le quizz du samedi" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "QUITTER" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Le quizz du samedi" })).not.toBeInTheDocument()
    );
  });

  it("owns up to the timer twice, and stays silent when there is none", async () => {
    const user = userEvent.setup();
    await open(user);
    /* SANS CHRONOMÈTRE, PAS UN MOT. C'est le cas de tout quizz tiré
       avant 003 — la colonne est NULL par défaut, et rien n'est à
       rétro-remplir. */
    expect(screen.queryByText(/Chronométré/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitter la partie" }));
    expect(await screen.findByText(/Les réponses déjà posées restent posées/)).toBeInTheDocument();
  });

  it("says what a timer costs, in the game AND before leaving it", async () => {
    const user = userEvent.setup();
    api.myQuizzes.mockResolvedValue({ quizzes: [{ ...QUIZ, seconds_per_question: 45 }] });
    /* LE CACHE DE `quizBank` EST UN MODULE, DONC IL TRAVERSE LES CAS.
       `hooks/useHall` n'est pas moqué exprès — c'est la vraie porte par
       laquelle la vue lit — mais `load()` sert la mémoire, donc un
       `myQuizzes` réécrit ici ne serait jamais redemandé et ce cas se
       jouerait en silence sur les soirées d'un cas précédent.
       `refresh()` est ce qui remet le compteur à zéro ; `stale()` est un
       prédicat et ne remet rien. */
    await quizBank.refresh();
    await open(user);

    /* Deux aveux plutôt que deux surprises : la conséquence — fermer
       l'onglet coûte la question en cours — n'est pas devinable. */
    expect(await screen.findByText(/Chronométré : 45 secondes/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitter la partie" }));
    expect(await screen.findByText(/la question suivante sera en retard/)).toBeInTheDocument();
  });

  it("shows only the FIRST unanswered question, and never the others", async () => {
    const user = userEvent.setup();
    api.readQuiz.mockResolvedValue({
      questions: [question("qa", "qa-bonne"), question("qb")],
      players: [],
      weight: 4,
      attempt: { started_at: "now", finished_at: null },
    });
    mount();
    await user.click(await screen.findByText("Le quizz du samedi"));

    /* La première non répondue, et strictement elle : pas de
       navigation, pas de retour en arrière, pas de survol du reste. */
    expect(await screen.findByText("La question qb")).toBeInTheDocument();
    expect(screen.queryByText("La question qa")).not.toBeInTheDocument();
  });
});

describe("laying an answer", () => {
  it("posts it, re-reads, and LEAKS NO CORRECTION", async () => {
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Varda qa" }));

    await waitFor(() => expect(api.answerQuiz).toHaveBeenCalledWith("q1", "qa", "qa-bonne"));
    /* Le serveur ne descend `is_right` qu'une fois la partie close ; rien
       ici ne doit donner le verdict, ni en mot ni autrement. */
    expect(screen.queryByText(/vu juste|à revoir/i)).not.toBeInTheDocument();
  });

  it("swallows the double click — one answer, not two", async () => {
    const user = userEvent.setup();
    /* On tient la requête ouverte : c'est pendant ce temps-là que le
       second clic arrive dans la vraie vie. */
    let release: (v: unknown) => void = () => {};
    api.answerQuiz.mockReturnValue(new Promise((r) => (release = r)));
    await open(user);

    const card = screen.getByRole("button", { name: "Varda qa" });
    await user.click(card);
    await user.click(card);
    release({ answered: true });

    await waitFor(() => expect(api.answerQuiz).toHaveBeenCalledTimes(1));
  });
});

describe("closing the attempt", () => {
  it("prints what the SERVER credited, and not the rate table", async () => {
    const user = userEvent.setup();
    api.finishQuiz.mockResolvedValue({
      questions: [question("qa", "qa-bonne"), question("qb", "qb-autre")],
      /* Une partie close deux fois ne paie qu'une : ce que la table
         laissait espérer n'est donc pas ce qu'on affiche. */
      gains: [{ kind: "quiz", amount: 2 }],
    });
    await open(user);
    await user.click(screen.getByRole("button", { name: /terminer/i }));

    expect(await screen.findByText(/\+2/)).toBeInTheDocument();
  });

  it("re-reads the board when there is something new to say", async () => {
    const user = userEvent.setup();
    await open(user);
    const before = api.quizScores.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Varda qa" }));

    /* Le tableau ne se relit pas sur l'identifiant du quiz — il ne
       change jamais. Sans ce signal, le score qu'on vient de faire
       n'apparaissait qu'au rechargement, ce qui se lit comme « ma
       réponse n'a pas compté ». */
    await waitFor(() => expect(api.quizScores.mock.calls.length).toBeGreaterThan(before));
  });

  it("measures the bar against WHAT THE QUIZ IS WORTH", async () => {
    const user = userEvent.setup();
    api.quizScores.mockResolvedValue({
      scores: [{ pseudo: "copine", score: 1, answered: 1, finished: true, seconds: 30 }],
    });
    await open(user);

    /* 1 sur 4 — le poids du quiz —, et non 1 sur 1, qui flatterait tout
       un tableau où tout le monde a mal joué. */
    expect(await screen.findByText(/1\/4/)).toBeInTheDocument();
  });

  it("empties the board on a refusal, but a STALE refusal never wins", async () => {
    const user = userEvent.setup();
    let refuse: (e: unknown) => void = () => {};
    api.quizScores
      .mockReturnValueOnce(new Promise((_, rej) => (refuse = rej)))
      .mockResolvedValue(board(true));
    await open(user);

    await user.click(screen.getByRole("button", { name: "Varda qa" }));
    await screen.findByText("copine");
    /* Le refus de la PREMIÈRE lecture arrive après le succès de la
       seconde : il ne doit pas effacer ce qui est à l'écran. */
    refuse(new Error("trop tard"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("copine")).toBeInTheDocument();
  });
});

describe("the powers", () => {
  it("strikes two propositions IN PLACE rather than removing them", async () => {
    const user = userEvent.setup();
    api.myHoldings.mockResolvedValue({ powers: { halve: 1 } });
    api.halveQuestion.mockResolvedValue({ removed: ["qa-autre"], left: 0 });
    await open(user);

    await user.click(await screen.findByRole("button", { name: /écarter/i }));

    /* Elle reste, barrée et éteinte : la retirer ferait glisser les
       autres sous le doigt au moment précis où l'on vise. */
    const struck = await screen.findByRole("button", { name: "Demy qa" });
    expect(struck).toBeDisabled();
    expect(struck.style.textDecoration).toContain("line-through");
  });
});

describe("the guests", () => {
  it("says when nobody answers to that pseudonym, and removes one on the cross", async () => {
    const user = userEvent.setup();
    api.readQuiz.mockResolvedValue({
      questions: [question("qa")],
      players: ["ami"],
      weight: 2,
      attempt: { started_at: "now", finished_at: null },
    });
    api.invitePlayer.mockRejectedValue(new Error("Personne."));
    api.removePlayer.mockResolvedValue({ playing: false });
    mount();
    await user.click(await screen.findByText("Le quizz du samedi"));

    const field = await screen.findByPlaceholderText("un pseudonyme");
    await user.type(field, "inconnu{Enter}");
    /* ON CARACTÉRISE LE TEXTE, PAS LE RÔLE, et c'est délibéré : cet
       échec s'écrivait dans un `div` en écriture manuscrite, sans
       `role="alert"` — il n'était donc annoncé à personne. C'est un
       `Trouble` depuis A5, et s'être accroché au TEXTE est ce qui a
       fait survivre ce filet à la correction. */
    expect(await screen.findByText(/Personne à inviter/)).toBeInTheDocument();

    /* LE RETRAIT DEMANDE, DÉSORMAIS. Ce clic est ce qui a changé en A5,
       et il devait changer : la croix décommandait quelqu'un sans un
       mot. La carte porte le nom du bouton en CAPITALES, et sa réponse
       est ce qui reste au tableau. */
    await user.click(screen.getByRole("button", { name: "Retirer cette personne" }));
    expect(await screen.findByText(/Son score, lui, reste au tableau/)).toBeInTheDocument();
    expect(api.removePlayer).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "RETIRER" }));
    await waitFor(() => expect(api.removePlayer).toHaveBeenCalledWith("q1", "ami"));
  });

  it("suggests the people of both directions, and invites the one picked", async () => {
    const user = userEvent.setup();
    api.readQuiz.mockResolvedValue({
      questions: [question("qa")],
      players: ["ami"],
      weight: 2,
      attempt: { started_at: "now", finished_at: null },
    });
    /* LES DEUX SENS, FONDUS EN UNE LISTE. « varda » est des deux côtés :
       elle ne doit paraître qu'une fois. Et « ami » est déjà invité,
       donc on ne propose pas de l'inviter deux fois. */
    api.mySubscriptions.mockResolvedValue({
      subscriptions: [
        { pseudo: "varda", films: 12 },
        { pseudo: "ami", films: 3 },
      ],
    });
    api.myFollowers.mockResolvedValue({
      followers: [
        { pseudo: "varda", films: 12 },
        { pseudo: "demy", films: 7 },
      ],
    });
    api.invitePlayer.mockResolvedValue({ invited: true });
    await quizBank.refresh();
    await open(user);

    await user.click(await screen.findByPlaceholderText("un pseudonyme"));
    expect(await screen.findByRole("button", { name: /varda/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /varda/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /demy/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^ami/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /varda/ }));
    await waitFor(() => expect(api.invitePlayer).toHaveBeenCalledWith("q1", "varda"));
  });

  it("keeps the free field working when the suggestion cannot be read", async () => {
    const user = userEvent.setup();
    /* LA RÈGLE DE CE COMPOSANT, ÉPROUVÉE : c'est un confort par-dessus un
       champ qui marche. Un refus dégrade en SILENCE — pas de `Trouble` —
       et surtout n'emporte pas l'écran qui l'héberge, ce qu'un `.catch()`
       posé sur la promesse ne suffisait pas à garantir. */
    api.mySubscriptions.mockRejectedValue(new Error("non"));
    api.myFollowers.mockRejectedValue(new Error("non"));
    api.invitePlayer.mockResolvedValue({ invited: true });
    api.readQuiz.mockResolvedValue({
      questions: [question("qa")],
      players: [],
      weight: 2,
      attempt: { started_at: "now", finished_at: null },
    });
    await quizBank.refresh();
    await open(user);

    const field = await screen.findByPlaceholderText("un pseudonyme");
    await user.type(field, "inconnue{Enter}");
    await waitFor(() => expect(api.invitePlayer).toHaveBeenCalledWith("q1", "inconnue"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the bank", () => {
  it("is not drawn at all for somebody who may not fill it", async () => {
    mount();
    await screen.findByText("Le quizz du samedi");
    /* Absente, et non grisée : c'est la règle de tout ce qui dépend d'un
       rôle dans ce produit. */
    expect(screen.queryByText(/tenir la banque/i)).not.toBeInTheDocument();
  });
});
