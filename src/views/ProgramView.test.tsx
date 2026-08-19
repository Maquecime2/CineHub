import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgramView } from "./ProgramView";
import { FeedbackProvider } from "../components/ui/Feedback";
import { makeFilm } from "../domain/film";
import { makeBond } from "../domain/bonds";
import { makeCourse, makeStep } from "../domain/course";
import type { Course } from "../domain/course";

/* ============================================================
   THE TWO HALVES ANSWER ONE ANOTHER
   ============================================================

   The pure half is tested next door (`domain/course`, `domain/bonds`,
   `domain/lineageMap`). What can only be seen here is the WIRING, and
   four things in it would each be a silent failure:

   — the two doors into a run, and that neither of them leaves an empty
     run behind;
   — the keyboard alternative to the drag. A drag cannot be reproduced in
     a test runner, which is exactly why the chevrons and `Alt` + arrows
     must be, and why the move must be SPOKEN — a reorder nobody is told
     about is a reorder somebody has to verify with their eyes;
   — laying a bond that JUSTIFIES the step it was opened from, in one
     gesture. That is the headline of the workbench rework and nothing
     else covers it;
   — a contradiction refused IN THE OPEN. `normalizeBonds` turns one away
     on read, so a form that just wrote it would look as though it had
     worked until the next reload ate it.
   ============================================================ */

const OZU = makeFilm({ id: "a", title: "Voyage à Tokyo", director: "Yasujirō Ozu" });
const HOU = makeFilm({ id: "b", title: "Les Fleurs de Shanghai", director: "Hou Hsiao-hsien" });
const films = [OZU, HOU];

const build = (courses: Course[] = [], bonds = [] as ReturnType<typeof makeBond>[]) => {
  const onCourses = vi.fn();
  const onCoursesSoon = vi.fn();
  const onBonds = vi.fn();
  const onAddFilm = vi.fn();
  const onUpdateFilm = vi.fn();
  const onOpen = vi.fn();
  render(
    /* Le canal de parole est monté par `App` dans le produit : sans lui
       `useSay` est muet, et l'annonce d'un déplacement — qui est la
       moitié de l'alternative clavier — ne serait pas testable. */
    <FeedbackProvider>
      <ProgramView
        films={films}
        courses={courses}
        bonds={bonds.filter((b) => !!b)}
        onCourses={onCourses}
        onCoursesSoon={onCoursesSoon}
        onBonds={onBonds}
        onAddFilm={onAddFilm}
        onUpdateFilm={onUpdateFilm}
        onOpen={onOpen}
        onOpenPerson={vi.fn()}
      />
    </FeedbackProvider>
  );
  return { onCourses, onCoursesSoon, onBonds, onAddFilm, onUpdateFilm, onOpen };
};

/** La bande d'ordre, et pas le miroir en liste de la carte. */
const order = () => within(screen.getByRole("list", { name: "L'ordre de visionnage" }));

/* LA CARTE EST DERRIÈRE UNE PORTE. Elle explique l'ordre, elle ne le
   remplace pas — et par-dessus, la place est celle de la fenêtre. Tout
   ce qui la concerne s'ouvre avec elle : poser un lien, moissonner,
   reprendre ce qui a été proposé. */
const openMap = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /La carte des cinéastes/ }));
  return within(screen.getByRole("dialog", { name: "La carte des cinéastes" }));
};

const run = (...ids: string[]) =>
  makeCourse({ label: "D'Ozu à Hou", steps: ids.map((id) => makeStep(id)) });

/** Ouvrir le panneau d'une entrée : c'est là que tout se justifie.
    C'est l'AFFICHE qu'on vise, et elle est la seule porte : le titre a
    cessé d'être un second bouton pour le même geste. */
const openStep = async (user: ReturnType<typeof userEvent.setup>, title: string) =>
  user.click(
    order().getByRole("button", {
      /* Le titre est dans le libellé de l'affiche, et il l'est sous deux
         formes — « Ouvrir « X » » et « X — vu, ouvrir cette étape ». On
         vise le titre, jamais la tournure. */
      name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    })
  );

describe("the two ways into an empty screen", () => {
  it("offers a run to open AND a film to lay down", () => {
    build();
    expect(screen.getByRole("button", { name: /Un nouveau parcours/ })).toBeInTheDocument();
    expect(screen.getByText("Poser un premier film")).toBeInTheDocument();
  });

  it("makes the run out of the first film laid down", async () => {
    const user = userEvent.setup();
    const { onCourses } = build();
    await user.type(screen.getByPlaceholderText("un titre, un réalisateur…"), "tokyo");
    /* Chaque ligne du sélecteur porte deux commandes, et l'œil
       nomme le titre lui aussi : on ancre. */
    await user.click(await screen.findByRole("button", { name: /^Voyage à Tokyo/ }));

    expect(onCourses).toHaveBeenCalledTimes(1);
    const [written] = onCourses.mock.calls[0] as [Course[]];
    expect(written).toHaveLength(1);
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["a"]);
  });

  it("opens an empty run WITHOUT settling it — nothing empty reaches the disk", async () => {
    const user = userEvent.setup();
    const { onCourses, onCoursesSoon } = build();
    await user.click(screen.getByRole("button", { name: /Un nouveau parcours/ }));

    /* Différé et non écrit : `isEmptyCourse` l'effacerait de toute
       façon, et une écriture réglée par-dessus serait un aller-retour
       pour rien. */
    expect(onCourses).not.toHaveBeenCalled();
    expect(onCoursesSoon).toHaveBeenCalledTimes(1);
  });
});

describe("reordering without a mouse", () => {
  it("moves an entry later and says where it landed", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a", "b")]);

    const entries = order().getAllByRole("listitem");
    await user.click(within(entries[0]!).getByRole("button", { name: "Avancer d'un rang" }));

    const [written] = onCourses.mock.calls[0] as [Course[]];
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["b", "a"]);
    /* Spoken through `useSay`, the binder's single live region. */
    expect(await screen.findByText(/Voyage à Tokyo passe en 2 sur 2/)).toBeInTheDocument();
  });

  it("moves with Alt and an arrow, since a drag has no keyboard at all", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a", "b")]);

    /* Le focus tombe sur une commande DANS l'entrée — c'est ce qui se
       passe à la tabulation — et la touche remonte jusqu'à elle. */
    const first = order().getAllByRole("listitem")[0]!;
    within(first).getByRole("button", { name: "Avancer d'un rang" }).focus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");

    const [written] = onCourses.mock.calls[0] as [Course[]];
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["b", "a"]);
  });

  it("refuses to move the first entry earlier, rather than pretending it moved", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a", "b")]);

    const first = order().getAllByRole("listitem")[0]!;
    await user.click(within(first).getByRole("button", { name: "Reculer d'un rang" }));

    expect(onCourses).not.toHaveBeenCalled();
    expect(screen.queryByText(/passe en/)).not.toBeInTheDocument();
  });
});

/* ============================================================
   UNE STATION N'OFFRE QUE CE QU'ELLE FAIT
   ============================================================
   Le titre appelait le MÊME geste que l'affiche, sans nom à lui : huit
   stations posaient trente-deux choses à cliquer pour seize gestes, et
   c'était plus de la moitié de l'encombrement de l'écran. Ce qui reste
   effacé n'est pas retiré — le clavier doit continuer d'y arriver. */
describe("what one station offers", () => {
  it("gives the poster its gesture, and the title none", () => {
    build([run("a", "b")]);
    const first = order().getAllByRole("listitem")[0]!;

    /* Une seule porte vers la fiche, et c'est celle qui porte un nom. */
    expect(within(first).getAllByRole("button", { name: /Voyage à Tokyo/ })).toHaveLength(1);
    /* Le titre est toujours LU, il n'est simplement plus une commande. */
    expect(within(first).getByText("Voyage à Tokyo")).toBeInTheDocument();
  });

  it("keeps the faded chevrons reachable by keyboard", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a", "b")]);

    const first = order().getAllByRole("listitem")[0]!;
    const later = within(first).getByRole("button", { name: "Avancer d'un rang" });
    later.focus();
    await user.click(later);

    /* Effacé n'est pas absent : il reste dans l'ordre de tabulation et
       il agit. C'est pourquoi c'est `opacity` et non un rendu
       conditionnel. */
    const [written] = onCourses.mock.calls[0] as [Course[]];
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["b", "a"]);
  });
});

describe("taking several stations at once", () => {
  const three = () =>
    makeCourse({ label: "trois", steps: ["a", "b", "a"].map((f) => makeStep(f)) });

  it("takes a range with Shift, and says how many are held", async () => {
    const user = userEvent.setup();
    build([three()]);

    /* Le parcours porte deux fois « a » : on cadre donc sur les
       stations, et pas sur un titre qui en désigne deux. */
    const stations = order().getAllByRole("listitem");
    await user.click(within(stations[0]!).getByRole("button", { name: /^Ouvrir/ }));
    await user.keyboard("{Shift>}");
    await user.click(within(stations[1]!).getByRole("button", { name: /^Ouvrir/ }));
    await user.keyboard("{/Shift}");

    expect(screen.getByText("2 étapes prises")).toBeInTheDocument();
  });

  it("takes one more with Ctrl, and lets the whole lot go", async () => {
    const user = userEvent.setup();
    build([three()]);

    const boxes = order().getAllByRole("checkbox");
    await user.click(boxes[0]!);
    await user.click(boxes[2]!);
    expect(screen.getByText("2 étapes prises")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "tout lâcher" }));
    expect(screen.queryByText(/étapes prises/)).not.toBeInTheDocument();
  });

  /* LA CASE À COCHER EST LA PORTE DE CEUX QUI N'ONT NI CTRL NI SOURIS —
     elle doit donc exister avant tout survol, sans quoi le doigt et le
     clavier n'ont aucun chemin vers une sélection. */
  it("offers a tick-box on every station, hovered or not", () => {
    build([three()]);
    expect(order().getAllByRole("checkbox")).toHaveLength(3);
  });

  it("takes a selection out only once confirmed, and says what survives", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([three()]);

    const boxes = order().getAllByRole("checkbox");
    await user.click(boxes[0]!);
    await user.click(boxes[1]!);
    await user.click(screen.getByRole("button", { name: /Les retirer du parcours/ }));

    expect(onCourses).not.toHaveBeenCalled();
    expect(screen.getByText(/Retirer 2 étapes \?/)).toBeInTheDocument();
    expect(screen.getByText(/Les fiches restent au classeur/)).toBeInTheDocument();

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /^les retirer du parcours$/i })
    );
    const [written] = onCourses.mock.calls[0] as [Course[]];
    /* La troisième étape survit, et c'est bien la TROISIÈME : on retire
       des étapes, jamais des films — « a » est là deux fois. */
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["a"]);
  });
});

describe("the panel of the entry one has picked", () => {
  it("opens on that film, and closes again on a second press", async () => {
    const user = userEvent.setup();
    build([run("a", "b")]);
    expect(screen.queryByLabelText("Pourquoi celui-là, ici")).not.toBeInTheDocument();

    await openStep(user, "Voyage à Tokyo");
    expect(screen.getByLabelText("Pourquoi celui-là, ici")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /relier Yasujirō Ozu à…/ })).toBeInTheDocument();

    await openStep(user, "Voyage à Tokyo");
    expect(screen.queryByLabelText("Pourquoi celui-là, ici")).not.toBeInTheDocument();
  });

  it("reads the bonds out FROM that person, with nothing to fill in", async () => {
    const user = userEvent.setup();
    build(
      [run("b")],
      [makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou Hsiao-hsien" })]
    );
    await openStep(user, "Les Fleurs de Shanghai");

    /* Standing at Hou, it reads "a pour maître Ozu" and NOT the wording
       it was typed with: nobody has to reverse a bond in their head.

       DEUX FOIS DANS LE FLUX — le panneau l'énonce, le sélecteur l'offre
       à invoquer — et une TROISIÈME dans le miroir en liste de la carte,
       qui est désormais sous sa feuille : un graphe SVG ne se parcourt
       pas au lecteur d'écran, et ce chemin linéaire suit la carte plutôt
       que de rester monté sous un écran qui ne la montre plus. */
    expect(screen.getAllByText(/a pour maître Yasujirō Ozu/)).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /a pour maître Yasujirō Ozu/ })).toBeInTheDocument();

    const map = await openMap(user);
    expect(
      within(map.getByRole("list", { name: /en liste/ })).getByText(/a pour maître Yasujirō Ozu/)
    ).toBeInTheDocument();
  });

  it("calls a bond upon a step in ONE press, and lets go of it in another", async () => {
    const user = userEvent.setup();
    const bond = makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou Hsiao-hsien" })!;
    const { onCourses } = build([run("b")], [bond]);
    await openStep(user, "Les Fleurs de Shanghai");

    const ribbon = screen.getByRole("radio", { name: /a pour maître Yasujirō Ozu/ });
    expect(ribbon).toHaveAttribute("aria-checked", "false");
    await user.click(ribbon);

    const [written] = onCourses.mock.calls.at(-1) as [Course[]];
    expect(written[0]!.steps[0]!.because).toBe(bond.id);
  });

  it("offers to tie a film-maker whether or not one is already tied", async () => {
    const user = userEvent.setup();
    build([run("a")]);
    await openStep(user, "Voyage à Tokyo");
    expect(screen.getByRole("button", { name: /relier Yasujirō Ozu à…/ })).toBeInTheDocument();
  });
});

describe("laying a bond down", () => {
  it("writes it", async () => {
    const user = userEvent.setup();
    const { onBonds } = build([run("a")]);

    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: "Relier deux cinéastes" }));
    /* Deux feuilles empilées : on cadre par NOM, sinon on ne sait pas
       laquelle des deux on interroge. */
    const dialog = screen.getByRole("dialog", { name: "Relier deux cinéastes" });
    await user.type(within(dialog).getByLabelText("Qui"), "Yasujirō Ozu");
    await user.type(within(dialog).getByLabelText("À qui"), "Hou Hsiao-hsien");
    await user.click(within(dialog).getByRole("button", { name: "Poser le lien" }));

    const [written] = onBonds.mock.calls[0] as [{ kind: string; from: string; to: string }[]];
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      kind: "master",
      from: "yasujiro ozu",
      to: "hou hsiao-hsien",
    });
  });

  /* LE GESTE CONTINU, et c'est le titre du chantier : on part d'une
     étape, le nom est déjà là, et poser le lien fait pointer l'étape
     dessus sans qu'on ait à revenir la chercher. */
  it("ties from a step: the name is prefilled, and the step ends up calling upon it", async () => {
    const user = userEvent.setup();
    const { onBonds, onCourses } = build([run("a")]);
    await openStep(user, "Voyage à Tokyo");

    await user.click(screen.getByRole("button", { name: /relier Yasujirō Ozu à…/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Qui")).toHaveValue("Yasujirō Ozu");

    await user.type(within(dialog).getByLabelText("À qui"), "Hou Hsiao-hsien");
    await user.click(within(dialog).getByRole("button", { name: "Poser le lien" }));

    const [bondsWritten] = onBonds.mock.calls[0] as [{ id: string }[]];
    const [coursesWritten] = onCourses.mock.calls.at(-1) as [Course[]];
    expect(coursesWritten[0]!.steps[0]!.because).toBe(bondsWritten[0]!.id);
  });

  it("refuses the opposite of one already laid, and SAYS SO", async () => {
    const user = userEvent.setup();
    const { onBonds } = build(
      [run("a")],
      [makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou Hsiao-hsien" })]
    );

    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: "Relier deux cinéastes" }));
    /* Deux feuilles empilées : on cadre par NOM, sinon on ne sait pas
       laquelle des deux on interroge. */
    const dialog = screen.getByRole("dialog", { name: "Relier deux cinéastes" });
    await user.type(within(dialog).getByLabelText("Qui"), "Hou Hsiao-hsien");
    await user.type(within(dialog).getByLabelText("À qui"), "Yasujirō Ozu");
    await user.click(within(dialog).getByRole("button", { name: "Poser le lien" }));

    expect(onBonds).not.toHaveBeenCalled();
    /* `Trouble` carries `role="alert"`: the refusal is announced, not
       merely drawn. */
    expect(within(screen.getByRole("alert")).getByText(/déjà posé l'inverse/)).toBeInTheDocument();
  });
});

/* ============================================================
   RÉGLER UN PARCOURS N'EST PAS LE LIRE
   ============================================================
   Le titre, la thèse et le fil rouge s'ouvraient en permanence sur un
   écran où l'on vient d'abord REGARDER. Ils sont sous une feuille — et
   la feuille pose un piège qui PERD DES DONNÉES : ces champs écrivent
   en différé à la frappe et réglé au `blur`, or fermer démonte avant
   que le `blur` ne parte. */
describe("setting a run up", () => {
  it("keeps the flow free of the form, and puts it behind a door", async () => {
    const user = userEvent.setup();
    build([run("a")]);

    expect(screen.queryByLabelText("Nom du parcours")).not.toBeInTheDocument();
    /* Le titre se LIT quand même : on doit savoir ce qu'on regarde. */
    expect(screen.getByRole("heading", { name: "D'Ozu à Hou" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Régler ce parcours/ }));
    expect(screen.getByLabelText("Nom du parcours")).toBeInTheDocument();
  });

  it("SETTLES what was typed when the sheet closes, blur or no blur", async () => {
    const user = userEvent.setup();
    const { onCourses, onCoursesSoon } = build([run("a")]);

    await user.click(screen.getByRole("button", { name: /Régler ce parcours/ }));
    await user.type(screen.getByLabelText("Nom du parcours"), "!");
    expect(onCoursesSoon).toHaveBeenCalled();

    /* Échap, donc sans jamais quitter le champ : c'est le geste qui
       perdait la dernière frappe. */
    await user.keyboard("{Escape}");
    expect(onCourses).toHaveBeenCalled();
  });

  it("writes nothing at all when the sheet is merely opened and closed", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a")]);

    await user.click(screen.getByRole("button", { name: /Régler ce parcours/ }));
    await user.keyboard("{Escape}");
    /* Sans témoin de frappe, `updatedAt` bougeait : le parcours passait
       en tête du « dernier touché » et voyageait en synchro pour rien. */
    expect(onCourses).not.toHaveBeenCalled();
  });
});

describe("taking things away", () => {
  it("deletes a run, but only once it has been confirmed", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a")]);

    /* Le retrait vit désormais au pied des réglages : ce qu'on fait une
       fois n'est pas dans le flux. */
    await user.click(screen.getByRole("button", { name: /Régler ce parcours/ }));
    await user.click(screen.getByRole("button", { name: /Supprimer ce parcours/ }));
    /* Rien n'est écrit sur le premier clic : c'est le seul geste de cet
       écran que rien ne rattrape. */
    expect(onCourses).not.toHaveBeenCalled();
    expect(screen.getByText(/Supprimer « D'Ozu à Hou » \?/)).toBeInTheDocument();

    /* La carte capitalise le mot de l'action : on la cherche sans y
       regarder de trop près. */
    await user.click(screen.getByRole("button", { name: /^supprimer$/i }));
    expect(onCourses).toHaveBeenCalledWith([]);
  });

  it("takes a bond out once confirmed, and says what survives it", async () => {
    const user = userEvent.setup();
    const { onBonds } = build(
      [run("a", "b")],
      [makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou Hsiao-hsien" })]
    );

    await openMap(user);

    /* On passe par la CARTE, puis par le panneau du nœud : le trait d'une
       arête est une cible qu'on rate, et c'est bien pourquoi le retrait
       n'est pas accroché dessus. */
    await user.click(screen.getByRole("button", { name: /Yasujirō Ozu, 1 au programme/ }));
    await user.click(screen.getByRole("button", { name: /a pour élève Hou Hsiao-hsien/ }));
    await user.click(screen.getByRole("button", { name: /Retirer le lien/ }));

    expect(onBonds).not.toHaveBeenCalled();
    expect(screen.getByText(/Les films, eux, restent au parcours/)).toBeInTheDocument();

    /* Le mot est le même sur le déclencheur et sur la carte : on cadre
       sur la carte, sinon on ne sait pas lequel des deux on a cliqué. */
    await user.click(
      within(screen.getByRole("dialog", { name: /Retirer ce lien/i })).getByRole("button", {
        name: /^retirer le lien$/i,
      })
    );
    expect(onBonds).toHaveBeenCalledWith([]);
  });
});

/* ============================================================
   LA CARTE EST DERRIÈRE UNE PORTE, ET LE RAISONNEMENT SURVIT
   ============================================================
   La phrase la plus appuyée de cet écran est que la justification se
   parcourt DANS LES DEUX SENS. Sortir la carte du flux la met en
   danger : une arête choisie allumerait le rail derrière un voile,
   c'est-à-dire nulle part. Les deux gestes explicites sont ce qui la
   sauve, et c'est ce que ces trois cas gardent. */
describe("the map behind a door", () => {
  const tied = () => makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou" })!;

  it("keeps the graph and its four commands out of the flow", () => {
    build([run("a")], [tied()]);

    expect(screen.queryByRole("button", { name: "Relier deux cinéastes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chercher des filiations" })).toBeNull();
    expect(screen.queryByRole("application")).toBeNull();
    /* Une porte, et son compte écrit dessus : c'est la seule chose qui
       dise ce qu'il y a derrière. */
    expect(screen.getByRole("button", { name: /La carte des cinéastes — un lien/ })).toBeVisible();
  });

  it("lights the rail from a bond, and the light OUTLIVES the veil", async () => {
    const user = userEvent.setup();
    const bond = tied();
    /* L'étape invoque le lien : c'est elle qui doit s'allumer. */
    const course = makeCourse({
      label: "D'Ozu à Hou",
      steps: [makeStep("a", { because: bond.id }), makeStep("b")],
    });
    build([course], [bond]);

    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: /Yasujirō Ozu/ }));
    await user.click(screen.getByRole("button", { name: /a pour élève Hou/ }));
    await user.click(screen.getByRole("button", { name: /Voir les étapes qui l'invoquent/ }));

    /* Le voile est tombé... */
    expect(screen.queryByRole("dialog", { name: "La carte des cinéastes" })).toBeNull();
    /* ...et le rail est allumé sur la seule étape qui l'invoque. */
    const stations = order().getAllByRole("listitem");
    expect(stations[0]).toHaveAttribute("aria-current", "true");
    expect(stations[1]).not.toHaveAttribute("aria-current");
  });

  it("goes the other way round, from a step to its bond", async () => {
    const user = userEvent.setup();
    const bond = tied();
    const course = makeCourse({
      label: "D'Ozu à Hou",
      steps: [makeStep("a", { because: bond.id })],
    });
    build([course], [bond]);

    await openStep(user, "Voyage à Tokyo");
    await user.click(screen.getByRole("button", { name: /Voir ce lien sur la carte/ }));

    /* La carte s'ouvre DÉJÀ pointée sur ce qu'on venait vérifier. */
    expect(screen.getByRole("dialog", { name: "La carte des cinéastes" })).toBeVisible();
    expect(screen.getByRole("group", { name: /Le lien choisi/ })).toBeVisible();
  });

  it("closes only the form when a bond is being tied FROM the map", async () => {
    const user = userEvent.setup();
    build([run("a")], [tied()]);

    const map = await openMap(user);
    await user.click(map.getByRole("button", { name: "Relier deux cinéastes" }));
    await user.keyboard("{Escape}");

    /* Le formulaire s'en va, la carte reste : deux couches empilées, et
       une seule a la main — voir `useDialog`. */
    expect(screen.queryByRole("dialog", { name: "Relier deux cinéastes" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "La carte des cinéastes" })).toBeVisible();
  });
});

describe("a step whose card has left the collection", () => {
  /* ELLE N'EST PAS DESSINÉE, ET LE RAIL NE LE DIT PLUS. La phrase
     existait — « une étape ne montre rien, sa fiche a quitté le
     classeur » — et elle a été retirée : un paragraphe sous le rail pour
     un cas rare. Le silence est ASSUMÉ ici, et il ne perd rien : l'étape
     reste écrite et reparaît si la fiche revient. C'est ce que la
     seconde assertion garde. */
  it("is not drawn, and is not erased either", () => {
    const course = run("a", "disparu");
    build([course]);
    expect(order().getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText(/Une étape ne montre rien/)).not.toBeInTheDocument();
    expect(course.steps).toHaveLength(2);
  });
});
