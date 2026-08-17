import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LineageView } from "./LineageView";
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
   three things in it would each be a silent failure:

   — the first film laid down MAKES the run. Nothing offers to create
     one, so if this does not work there is no way into the screen at
     all;
   — the keyboard alternative to the drag. A drag cannot be reproduced
     in a test runner, which is exactly why the chevrons must be, and
     why the move must be SPOKEN — a reorder nobody is told about is a
     reorder somebody has to verify with their eyes;
   — a contradiction refused IN THE OPEN. `normalizeBonds` turns one
     away on read, so a form that just wrote it would look as though it
     had worked until the next reload ate it.
   ============================================================ */

const OZU = makeFilm({ id: "a", title: "Voyage à Tokyo", director: "Yasujirō Ozu" });
const HOU = makeFilm({ id: "b", title: "Les Fleurs de Shanghai", director: "Hou Hsiao-hsien" });
const films = [OZU, HOU];

const build = (courses: Course[] = [], bonds = [] as ReturnType<typeof makeBond>[]) => {
  const onCourses = vi.fn();
  const onCoursesSoon = vi.fn();
  const onBonds = vi.fn();
  const onOpen = vi.fn();
  render(
    /* Le canal de parole est monté par `App` dans le produit : sans lui
       `useSay` est muet, et l'annonce d'un déplacement — qui est la
       moitié de l'alternative clavier — ne serait pas testable. */
    <FeedbackProvider>
      <LineageView
        films={films}
        courses={courses}
        bonds={bonds.filter((b) => !!b)}
        onCourses={onCourses}
        onCoursesSoon={onCoursesSoon}
        onBonds={onBonds}
        onOpen={onOpen}
        onOpenPerson={vi.fn()}
      />
    </FeedbackProvider>
  );
  return { onCourses, onCoursesSoon, onBonds, onOpen };
};

/** La colonne d'ordre, et pas le miroir en liste de la carte. */
const order = () => within(screen.getByRole("list", { name: "L'ordre de visionnage" }));

const run = (...ids: string[]) =>
  makeCourse({ label: "D'Ozu à Hou", steps: ids.map((id) => makeStep(id)) });

describe("the way into an empty screen", () => {
  it("offers no run to create — it offers a film to lay down", () => {
    build();
    expect(screen.queryByText("Ouvrir un autre parcours")).not.toBeInTheDocument();
    expect(screen.getByText("Poser un premier film")).toBeInTheDocument();
  });

  it("makes the run out of the first film laid down", async () => {
    const user = userEvent.setup();
    const { onCourses } = build();
    await user.type(screen.getByPlaceholderText("un titre, un réalisateur…"), "tokyo");
    await user.click(await screen.findByRole("button", { name: /Voyage à Tokyo/ }));

    expect(onCourses).toHaveBeenCalledTimes(1);
    const [written] = onCourses.mock.calls[0] as [Course[]];
    expect(written).toHaveLength(1);
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["a"]);
  });
});

describe("reordering without a mouse", () => {
  it("moves an entry down and says where it landed", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a", "b")]);

    const entries = order().getAllByRole("listitem");
    await user.click(within(entries[0]!).getByRole("button", { name: "Descendre d'un rang" }));

    const [written] = onCourses.mock.calls[0] as [Course[]];
    expect(written[0]!.steps.map((s) => s.filmId)).toEqual(["b", "a"]);
    /* Spoken through `useSay`, the binder's single live region. */
    expect(await screen.findByText(/Voyage à Tokyo passe en 2 sur 2/)).toBeInTheDocument();
  });

  it("refuses to move the first entry up, rather than pretending it moved", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a", "b")]);

    const first = order().getAllByRole("listitem")[0]!;
    await user.click(within(first).getByRole("button", { name: "Monter d'un rang" }));

    expect(onCourses).not.toHaveBeenCalled();
    expect(screen.queryByText(/passe en/)).not.toBeInTheDocument();
  });
});

describe("what an entry says about its film-maker", () => {
  it("reads the bonds out FROM that person, with nothing to fill in", () => {
    build(
      [run("b")],
      [makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou Hsiao-hsien" })]
    );
    /* Standing at Hou, it reads "a pour maître Ozu" and NOT the wording
       it was typed with: nobody has to reverse a bond in their head.

       Twice over, and both are wanted — the row states it outright, and
       the `because` picker offers it as something to call upon. */
    expect(order().getAllByText(/a pour maître Yasujirō Ozu/)).toHaveLength(2);
    expect(
      within(order().getByRole("combobox", { name: /D'après/ })).getByRole("option", {
        name: /a pour maître Yasujirō Ozu/,
      })
    ).toBeInTheDocument();
  });

  it("offers to tie a film-maker nobody has tied yet, instead of an empty picker", () => {
    build([run("a")]);
    expect(screen.getAllByText("relier ce cinéaste").length).toBeGreaterThan(0);
    expect(screen.queryByText("aucun lien invoqué")).not.toBeInTheDocument();
  });
});

describe("laying a bond down", () => {
  it("writes it", async () => {
    const user = userEvent.setup();
    const { onBonds } = build([run("a")]);

    await user.click(screen.getByRole("button", { name: "Relier deux cinéastes" }));
    const dialog = screen.getByRole("dialog");
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

  it("refuses the opposite of one already laid, and SAYS SO", async () => {
    const user = userEvent.setup();
    const { onBonds } = build(
      [run("a")],
      [makeBond({ kind: "master", fromName: "Yasujirō Ozu", toName: "Hou Hsiao-hsien" })]
    );

    await user.click(screen.getByRole("button", { name: "Relier deux cinéastes" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Qui"), "Hou Hsiao-hsien");
    await user.type(within(dialog).getByLabelText("À qui"), "Yasujirō Ozu");
    await user.click(within(dialog).getByRole("button", { name: "Poser le lien" }));

    expect(onBonds).not.toHaveBeenCalled();
    /* `Trouble` carries `role="alert"`: the refusal is announced, not
       merely drawn. */
    expect(within(screen.getByRole("alert")).getByText(/déjà posé l'inverse/)).toBeInTheDocument();
  });
});

describe("taking things away", () => {
  it("deletes a run, but only once it has been confirmed", async () => {
    const user = userEvent.setup();
    const { onCourses } = build([run("a")]);

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
      within(screen.getByRole("dialog")).getByRole("button", { name: /^retirer le lien$/i })
    );
    expect(onBonds).toHaveBeenCalledWith([]);
  });
});

describe("a step whose card has left the collection", () => {
  it("is not drawn, and the column says how many it is hiding", () => {
    build([run("a", "disparu")]);
    expect(order().getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText(/Une étape ne montre rien/)).toBeInTheDocument();
  });
});
