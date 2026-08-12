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

describe("ThreadBoard — retoucher un fil", () => {
  it("ne montre pas les champs tant qu'on n'a pas demandé à écrire", () => {
    board();
    expect(screen.queryByLabelText("Titre de l'œuvre")).not.toBeInTheDocument();
    expect(screen.getByText("Le Ravissement de Lol V. Stein")).toBeInTheDocument();
  });

  it("ouvre la fiche garnie de ce qui y est déjà écrit", async () => {
    board();
    await openEditor();
    expect(screen.getByLabelText("Titre de l'œuvre")).toHaveValue("Le Ravissement de Lol V. Stein");
    expect(screen.getByLabelText("Auteur·rice / artiste")).toHaveValue("Duras");
    expect(screen.getByLabelText("Pourquoi ce lien ?")).toHaveValue("le même vide au centre");
    expect(screen.getByLabelText("Nature de l'œuvre")).toHaveValue("book");
  });

  it("rend la retouche complète d'une mention libre", async () => {
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

  it("referme la fiche une fois notée", async () => {
    board();
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: /NOTER/ }));
    expect(screen.queryByLabelText("Titre de l'œuvre")).not.toBeInTheDocument();
  });

  it("renonce sans rien écrire, et rend son texte d'origine à la fiche", async () => {
    const { onEdit } = board();
    const user = await openEditor();

    await user.clear(screen.getByLabelText("Titre de l'œuvre"));
    await user.type(screen.getByLabelText("Titre de l'œuvre"), "une bêtise");
    await user.click(screen.getByRole("button", { name: "ANNULER" }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("Le Ravissement de Lol V. Stein")).toBeInTheDocument();
  });

  it("Échap renonce, Entrée note", async () => {
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
  describe("un renvoi vers une fiche du mur", () => {
    const linked = () =>
      board({
        film: film("f1", {
          linkedWorks: [
            work({ type: "film", title: "Les Statues meurent aussi", filmId: "f2", pairId: "p1" }),
          ],
        }),
        films: [film("f2", { title: "Les Statues meurent aussi" })],
      });

    it("n'offre à réécrire que ce qui appartient au lien", async () => {
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

    it("montre quand même de quoi on parle", async () => {
      linked();
      await openEditor("Les Statues meurent aussi");
      expect(screen.getByText("Les Statues meurent aussi")).toBeInTheDocument();
    });

    it("n'envoie que ce qui appartient au lien", async () => {
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

    it("envoie la nature du lien qu'on vient de choisir", async () => {
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

  it("détacher reste possible, et distinct de retoucher", async () => {
    const { onRemove, onEdit } = board();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Détacher « Le Ravissement de Lol V. Stein »" })
    );
    expect(onRemove).toHaveBeenCalledWith("w1");
    expect(onEdit).not.toHaveBeenCalled();
  });
});
