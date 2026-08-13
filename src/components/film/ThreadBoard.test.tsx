import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThreadBoard } from "./ThreadBoard";
import type { Film, LinkedWork } from "../../types";

/* A film reduced to what the investigation board needs. */
const film = (id: string, extra: Partial<Film> = {}): Film =>
  ({
    id,
    title: id,
    year: 2000,
    director: "",
    poster: "",
    stills: [],
    genres: [],
    themes: [],
    rating: 0,
    review: "",
    notes: "",
    status: "watched",
    bedside: false,
    archived: false,
    linkedWorks: [],
    ...extra,
  }) as Film;

const work = (extra: Partial<LinkedWork> = {}): LinkedWork => ({
  id: "w1",
  type: "book",
  title: "Le Ravissement de Lol V. Stein",
  creator: "Duras",
  note: "le même vide au centre",
  ...extra,
});

const board = (over: Partial<Parameters<typeof ThreadBoard>[0]> = {}) => {
  const onEdit = vi.fn();
  const onRemove = vi.fn();
  const onOpen = vi.fn();
  render(
    <ThreadBoard
      film={film("f1", { linkedWorks: [work()] })}
      onEdit={onEdit}
      onRemove={onRemove}
      onOpen={onOpen}
      films={[]}
      {...over}
    />
  );
  return { onEdit, onRemove, onOpen };
};

const openEditor = async (title = "Le Ravissement de Lol V. Stein") => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `Retoucher « ${title} »` }));
  return user;
};

describe("ThreadBoard — editing a thread", () => {
  it("does not show the fields until writing has been asked for", () => {
    board();
    expect(screen.queryByLabelText("Titre de l'œuvre")).not.toBeInTheDocument();
    expect(screen.getByText("Le Ravissement de Lol V. Stein")).toBeInTheDocument();
  });

  it("opens the card filled with what is already written on it", async () => {
    board();
    await openEditor();
    expect(screen.getByLabelText("Titre de l'œuvre")).toHaveValue("Le Ravissement de Lol V. Stein");
    expect(screen.getByLabelText("Auteur·rice / artiste")).toHaveValue("Duras");
    expect(screen.getByLabelText("Pourquoi ce lien ?")).toHaveValue("le même vide au centre");
    expect(screen.getByLabelText("Nature de l'œuvre")).toHaveValue("book");
  });

  it("returns the full edit of a free mention", async () => {
    const { onEdit } = board();
    const user = await openEditor();

    const title = screen.getByLabelText("Titre de l'œuvre");
    await user.clear(title);
    await user.type(title, "Hiroshima mon amour");
    await user.selectOptions(screen.getByLabelText("Nature de l'œuvre"), "film");
    await user.click(screen.getByRole("button", { name: /NOTER/ }));

    expect(onEdit).toHaveBeenCalledWith("w1", {
      type: "film",
      title: "Hiroshima mon amour",
      creator: "Duras",
      note: "le même vide au centre",
    });
  });

  it("closes the card once it is written down", async () => {
    board();
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: /NOTER/ }));
    expect(screen.queryByLabelText("Titre de l'œuvre")).not.toBeInTheDocument();
  });

  it("gives up without writing anything, and hands the card its original text back", async () => {
    const { onEdit } = board();
    const user = await openEditor();

    await user.clear(screen.getByLabelText("Titre de l'œuvre"));
    await user.type(screen.getByLabelText("Titre de l'œuvre"), "une bêtise");
    await user.click(screen.getByRole("button", { name: "ANNULER" }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("Le Ravissement de Lol V. Stein")).toBeInTheDocument();
  });

  it("Escape gives up, Enter writes down", async () => {
    const { onEdit } = board();
    let user = await openEditor();
    await user.keyboard("{Escape}");
    expect(onEdit).not.toHaveBeenCalled();

    user = await openEditor();
    await user.type(screen.getByLabelText("Pourquoi ce lien ?"), " — vraiment{Enter}");
    expect(onEdit).toHaveBeenCalledWith(
      "w1",
      expect.objectContaining({ note: "le même vide au centre — vraiment" })
    );
  });

  /* The model's rule, seen from the form: a reference to a card on the
     wall takes its title from THAT card. So we do not offer it — that
     would be offering an edit `App` would refuse to write. */
  describe("a pointer to a card on the wall", () => {
    const linked = () =>
      board({
        film: film("f1", {
          linkedWorks: [
            work({ type: "film", title: "Les Statues meurent aussi", filmId: "f2", pairId: "p1" }),
          ],
        }),
        films: [film("f2", { title: "Les Statues meurent aussi" })],
      });

    it("offers for rewriting only what belongs to the link", async () => {
      linked();
      await openEditor("Les Statues meurent aussi");
      // the title and the author belong to the card opposite
      expect(screen.queryByLabelText("Titre de l'œuvre")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Auteur·rice / artiste")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Nature de l'œuvre")).not.toBeInTheDocument();
      // the note, the link's kind and its strength say what happens BETWEEN the two
      expect(screen.getByLabelText("Pourquoi ce lien ?")).toBeInTheDocument();
      expect(screen.getByLabelText("Nature du lien")).toBeInTheDocument();
      expect(screen.getByLabelText("Strength du lien")).toBeInTheDocument();
    });

    it("still shows what is being talked about", async () => {
      linked();
      await openEditor("Les Statues meurent aussi");
      expect(screen.getByText("Les Statues meurent aussi")).toBeInTheDocument();
    });

    it("sends only what belongs to the link", async () => {
      const { onEdit } = linked();
      const user = await openEditor("Les Statues meurent aussi");
      await user.clear(screen.getByLabelText("Pourquoi ce lien ?"));
      await user.type(screen.getByLabelText("Pourquoi ce lien ?"), "deux regards sur un musée");
      await user.click(screen.getByRole("button", { name: /NOTER/ }));
      expect(onEdit).toHaveBeenCalledWith("w1", {
        note: "deux regards sur un musée",
        relation: undefined,
        force: 2,
      });
    });

    it("sends the kind of link just chosen", async () => {
      const { onEdit } = linked();
      const user = await openEditor("Les Statues meurent aussi");
      await user.selectOptions(screen.getByLabelText("Nature du lien"), "sequel-to");
      await user.click(screen.getByRole("button", { name: /NOTER/ }));
      expect(onEdit).toHaveBeenCalledWith(
        "w1",
        expect.objectContaining({ relation: "sequel-to", force: 2 })
      );
    });
  });

  it("detaching stays possible, and distinct from editing", async () => {
    const { onRemove, onEdit } = board();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Détacher « Le Ravissement de Lol V. Stein »" })
    );
    expect(onRemove).toHaveBeenCalledWith("w1");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
