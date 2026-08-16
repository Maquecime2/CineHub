import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConstellationView } from "./ConstellationView";
import { makeFilm } from "../domain/film";
import { makeThread } from "../domain/threads";

/* One linked film, so that the sky is not empty, and one film nothing
   links — that is the one the search had to make reachable. */
const linkedFilm = makeFilm({
  id: "r",
  title: "Le Samouraï",
  linkedWorks: [{ id: "w", type: "book", title: "Solaris", creator: "Lem", note: "" }],
});
const isolated = makeFilm({ id: "i", title: "Playtime", director: "Tati" });

const build = (props: Partial<Parameters<typeof ConstellationView>[0]> = {}) => {
  const onOpen = vi.fn();
  render(<ConstellationView films={[linkedFilm, isolated]} onOpen={onOpen} {...props} />);
  return { onOpen };
};

const search = async (texte: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText(/chercher dans toute la collection/), texte);
  return user;
};

describe("the constellation's search", () => {
  it("finds a film nothing links, and marks it off the map", async () => {
    build();
    await search("playtime");
    expect(screen.getByRole("button", { name: /Playtime/ })).toBeInTheDocument();
    expect(screen.getByText("épingler")).toBeInTheDocument();
  });

  it("searches on the director too", async () => {
    build();
    await search("tati");
    expect(screen.getByRole("button", { name: /Playtime/ })).toBeInTheDocument();
  });

  it('marks a film already placed as "in the sky"', async () => {
    build();
    await search("samou");
    expect(screen.getByText("au ciel")).toBeInTheDocument();
  });

  it("says plainly when the collection has nothing by that name", async () => {
    build();
    await search("zzz");
    expect(screen.getByText(/rien de ce nom/)).toBeInTheDocument();
  });

  it("pinning a film that is off the map brings it into the sky and makes it the focus", async () => {
    build();
    const user = await search("playtime");
    await user.click(screen.getByRole("button", { name: /Playtime/ }));
    // the focus is laid on it: the chart composes itself around
    expect(screen.getByText("FOYER")).toBeInTheDocument();
    expect(screen.getAllByText("Playtime").length).toBeGreaterThan(0);
  });
});

/* ============================================================
   THE MOTIFS IN THE SKY

   Nothing is promoted any more: laying one motif on two cards is the
   whole gesture, and `fils` holds only what somebody CHANGED about the
   star it makes.
   ============================================================ */
describe("the motifs in the sky", () => {
  const twice = [
    makeFilm({ id: "a", title: "A", motifs: ["hero-dies"] }),
    makeFilm({ id: "b", title: "B", motifs: ["hero-dies"] }),
  ];

  it("shows a chip for a motif nobody stored anything about", () => {
    render(<ConstellationView films={twice} onOpen={vi.fn()} />);
    // named after the catalogue, since nothing renamed it
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent(/héros meurt/i);
  });

  it("shows the name written by hand rather than the motif's own", () => {
    const thread = makeThread({ motif: "hero-dies", label: "Les fins amères" });
    render(<ConstellationView films={twice} fils={[thread]} onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("Les fins amères");
  });

  it("puts a star out by writing it down, not by remembering it locally", async () => {
    /* It used to be a `useState` in this view, so every star came back
       lit on the next reload and nobody could tell why. */
    const onPatchThread = vi.fn();
    render(<ConstellationView films={twice} onOpen={vi.fn()} onPatchThread={onPatchThread} />);
    await userEvent.setup().click(screen.getByRole("button", { pressed: true }));
    expect(onPatchThread).toHaveBeenCalledWith("hero-dies", { off: true });
  });

  it("still shows a put-out motif, so it can be lit again", () => {
    const thread = makeThread({ motif: "hero-dies", off: true });
    render(<ConstellationView films={twice} fils={[thread]} onOpen={vi.fn()} />);
    expect(screen.getAllByRole("button", { pressed: false })).not.toHaveLength(0);
  });

  /* THE HALF OF THE MODEL THAT LED NOWHERE. A gathering could not be
     renamed, recoloured, written under, or undone. */
  it("opens the settings of a motif", async () => {
    render(<ConstellationView films={twice} onOpen={vi.fn()} onPatchThread={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Réglages/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/NOMMER AUTREMENT/i)).toBeInTheDocument();
  });
});
