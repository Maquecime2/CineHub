import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressBand } from "./ProgressBand";
import { NextUp } from "./NextUp";
import { ThreadEvidence } from "./ThreadEvidence";
import { makeFilm } from "../../domain/film";
import { makeCourse, makeStep } from "../../domain/course";
import { makeBond } from "../../domain/bonds";

/* ============================================================
   AN AFFICHE IN `plain` NEEDS A BOX, AND IT IS NOT A DETAIL
   ============================================================

   `PosterArt` in `plain` mode draws itself `position: absolute; inset: 0`
   — "the case already sets the dimensions". A container that gives only
   a WIDTH lets the poster escape to the nearest positioned ancestor,
   which on every screen of this app is the view column (`[data-enters]`
   is `position: relative`): one poster then fills the entire page and
   everything else is drawn underneath it. That is what happened the
   first time this band was written, and nothing failed — no test, no
   type, no build. So the box is asserted here.

   The rest of this file covers what the band is FOR: it says where one
   stands, it is silent when it has nothing to say, and it never writes. */

const laid = Date.parse("2026-03-10T12:00:00Z");
const OZU = makeFilm({ id: "a", title: "Voyage à Tokyo", director: "Yasujirō Ozu" });
const HOU = makeFilm({ id: "b", title: "Les Fleurs de Shanghai" });
const walked = makeFilm({ ...OZU, watches: [{ date: "2026-03-11", rating: null }] });

const progressOf = (films: (typeof OZU)[]) => {
  const course = makeCourse({
    steps: [makeStep("a", { id: "s1", at: laid }), makeStep("b", { id: "s2", at: laid })],
  });
  const byId = new Map(films.map((f) => [f.id, f]));
  const entries = course.steps.map((step) => ({ step, film: byId.get(step.filmId)! }));
  return { course, entries };
};

describe("the band that says where one stands", () => {
  it("gives the poster of the next step a box with a HEIGHT", () => {
    const { entries } = progressOf([OZU, HOU]);
    render(
      <ProgressBand
        progress={{ done: 0, total: 2, next: entries[0]! }}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: /Voyage à Tokyo/ });
    /* Les deux ensemble, jamais l'une sans l'autre : sans `relative`
       l'affiche s'ancre ailleurs, sans hauteur elle n'en a aucune. */
    expect(button.style.position).toBe("relative");
    /* La hauteur du RAIL (`POSTER_H`) : la vedette et les stations
       parlent de la même chose, elles la montrent à la même taille. */
    expect(button.style.height).toBe("168px");
  });

  it("counts what is walked and names what comes next", () => {
    const { entries } = progressOf([walked, HOU]);
    render(
      <ProgressBand
        progress={{ done: 1, total: 2, next: entries[1]! }}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
      />
    );
    expect(screen.getByText("1 vus sur 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("Les Fleurs de Shanghai")).toBeInTheDocument();
  });

  it("says the run is walked rather than showing a bare 2 of 2", () => {
    render(
      <ProgressBand
        progress={{ done: 2, total: 2, next: null }}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
      />
    );
    expect(screen.getByText(/parcouru ce programme jusqu'au bout/)).toBeInTheDocument();
  });

  /* UN PARCOURS VIDE N'EST PAS UN TROU. Rendre `null` allait quand la
     bande etait un accessoire ; en vedette, un parcours neuf ouvrirait
     sur rien entre les puces et le rail vide. */
  it("says a fresh run is empty rather than drawing nothing", () => {
    render(
      <ProgressBand
        progress={{ done: 0, total: 0, next: null }}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
      />
    );
    expect(screen.getByText(/n'a pas encore de film/)).toBeInTheDocument();
  });

  /* ============================================================
     « POURQUOI CELUI-LA » A DEUX MOITIES
     ============================================================
     La note de marge est de vous ; la FILIATION est le savoir, et elle
     etait enfermee dans le panneau d'une etape. La donnee reste une cle
     — `Bond.note` est une reference ecrite pour la machine — et c'est
     l'ecran qui la met en mots. */
  it("reads the bond out FROM the film-maker, and never its note", () => {
    const { entries } = progressOf([OZU, HOU]);
    /* Les deux bouts sont des NOMS : `makeBond` en tire les clés, et
       c'est la clé du cinéaste de la fiche qui décide du sens lu. */
    const bond = makeBond({
      fromName: "Yasujirō Ozu",
      toName: "Hou Hsiao-hsien",
      kind: "master",
      note: "Wikidata P1066",
    })!;
    const { container } = render(
      <ProgressBand
        progress={{ done: 0, total: 2, next: entries[0]! }}
        because={bond}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
      />
    );
    /* Le nom du cinéaste est dans un `strong`, la tournure à côté : on
       lit le bloc entier plutôt qu'un fragment. */
    expect(container.textContent).toMatch(/a pour élève Hou Hsiao-hsien/);
    expect(container.textContent).not.toMatch(/Wikidata/);
  });

  it("draws no filiation when the step calls upon none", () => {
    const { entries } = progressOf([OZU, HOU]);
    const { container } = render(
      <ProgressBand
        progress={{ done: 0, total: 2, next: entries[0]! }}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
      />
    );
    expect(container.textContent).not.toMatch(/a pour /);
  });

  /* IL NE COCHE RIEN : `stepDone` reste DERIVE d'une seance. Ce bouton
     mene la ou l'on note une seance, et c'est tout ce qu'il fait. */
  it("offers the card itself, which is where a screening gets logged", async () => {
    const user = userEvent.setup();
    const onOpenFilm = vi.fn();
    const { entries } = progressOf([OZU, HOU]);
    render(
      <ProgressBand
        progress={{ done: 0, total: 2, next: entries[0]! }}
        onOpenStep={vi.fn()}
        onQuick={vi.fn()}
        onOpenFilm={onOpenFilm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Ouvrir la fiche" }));
    expect(onOpenFilm).toHaveBeenCalled();
  });
});

describe("the pinned run, seen from the binder door", () => {
  const run = makeCourse({
    id: "c",
    label: "Antonioni",
    pinned: true,
    steps: [makeStep("a", { id: "s1", at: laid }), makeStep("b", { id: "s2", at: laid })],
  });

  it("boxes its posters too", () => {
    render(<NextUp courses={[run]} films={[OZU, HOU]} onOpenFilm={vi.fn()} onOpenRun={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Voyage à Tokyo" });
    expect(button.style.position).toBe("relative");
    expect(button.style.height).toBe("69px");
  });

  it("is silent when the run is already walked to the end", () => {
    const seen = [
      makeFilm({ ...OZU, watches: [{ date: "2026-03-11", rating: null }] }),
      makeFilm({ ...HOU, watches: [{ date: "2026-03-11", rating: null }] }),
    ];
    const { container } = render(
      <NextUp courses={[run]} films={seen} onOpenFilm={vi.fn()} onOpenRun={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is silent when there is no run at all", () => {
    const { container } = render(
      <NextUp courses={[]} films={[OZU]} onOpenFilm={vi.fn()} onOpenRun={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("what the thread offers", () => {
  const held = makeFilm({ id: "m", title: "L'Éclipse", motifs: ["errance"] });

  it("boxes its posters too — the third place this could have escaped", async () => {
    const user = userEvent.setup();
    render(
      <ThreadEvidence
        thread={{ kind: "motif", value: "errance" }}
        films={[held]}
        inCourse={new Set()}
        onAdd={vi.fn()}
        onLook={vi.fn()}
      />
    );
    /* Repliée : c'est une PREUVE, elle vient sous ce qu'elle appuie. */
    await user.click(screen.getByRole("button", { name: /n'est pas au programme/ }));
    const poster = screen.getByRole("button", { name: /Regarder L'Éclipse|L'Éclipse/ });
    expect(poster.style.position).toBe("relative");
    expect(poster.style.height).toBe("117px");
  });

  it("draws nothing when the thread names something no card carries", () => {
    const { container } = render(
      <ThreadEvidence
        thread={{ kind: "motif", value: "rien" }}
        films={[held]}
        inCourse={new Set()}
        onAdd={vi.fn()}
        onLook={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
