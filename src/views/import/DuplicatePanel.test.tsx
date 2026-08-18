import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DuplicatePanel } from "./DuplicatePanel";
import { makeFilm } from "../../domain/film";

/* ============================================================
   LE PANNEAU PROPOSE, IL NE RANGE PAS

   `mergeDuplicate` EFFACE une fiche. C'est le seul geste de ce dépôt
   dont une erreur ne se rattrape pas en relançant, et ce fichier garde
   donc surtout les refus : rien ne part sans qu'on ait coché, et rien
   ne part sans qu'on ait confirmé.

   Le reste tient en une phrase : on ne rapproche que sur l'identité que
   TMDB donne, jamais sur une ressemblance de titre.
   ============================================================ */

const enrichRows = vi.fn();
vi.mock("../../tmdb", () => ({
  enrichRows: (...args: unknown[]) => enrichRows(...args),
}));

const GOOD = makeFilm({
  id: "good",
  title: "Scènes de la vie conjugale",
  year: 1973,
  tmdbId: 55,
});
const ROTTEN = makeFilm({ id: "rotten", title: "Scenes from a Marriage", year: 1973 });

beforeEach(() => {
  enrichRows.mockReset();
  /* Une seule fiche sans identité part à TMDB, et elle en revient
     raccrochée au film que l'autre fiche tient déjà. */
  enrichRows.mockResolvedValue({ rows: [{ tmdbId: 55 }], failed: 0 });
});

const show = (onMerge = vi.fn(), films = [GOOD, ROTTEN]) => {
  render(<DuplicatePanel films={films} apiKey="k" onMerge={onMerge} />);
  return onMerge;
};

describe("the duplicates panel", () => {
  it("draws nothing at all when every card has an identity", () => {
    /* Une section qui annonce « zéro doublon » est une section qu'on lit
       une fois et qu'on ne relit jamais. */
    const { container } = render(<DuplicatePanel films={[GOOD]} apiKey="k" onMerge={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("only asks TMDB about the cards WITHOUT an identity", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ }));
    await waitFor(() => expect(enrichRows).toHaveBeenCalled());
    /* Redemander une fiche déjà raccrochée coûterait une requête pour
       rien — et TMDB est compté. */
    expect(enrichRows.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ title: "Scenes from a Marriage" }),
    ]);
  });

  it("shows the pair, what stays above what goes", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ }));
    expect(await screen.findByText(/Scènes de la vie conjugale/)).toBeInTheDocument();
    expect(screen.getByText(/Scenes from a Marriage/)).toBeInTheDocument();
  });

  it("MERGES NOTHING before the card has been confirmed", async () => {
    const user = userEvent.setup();
    const onMerge = show();
    await user.click(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ }));
    await screen.findByText(/Scènes de la vie conjugale/);

    await user.click(screen.getByRole("button", { name: /FONDRE 1 DOUBLON/ }));
    /* La carte est posée, et rien n'est encore parti : c'est tout
       l'intérêt d'une confirmation sur un geste qui efface. */
    expect(await screen.findByText(/La fiche barrée disparaît/)).toBeInTheDocument();
    expect(onMerge).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "FONDRE" }));
    expect(onMerge).toHaveBeenCalledTimes(1);
    const pairs = onMerge.mock.calls[0]![0];
    expect(pairs).toHaveLength(1);
    expect(pairs[0].keep.id).toBe("good");
    expect(pairs[0].drop.id).toBe("rotten");
  });

  it("merges nothing at all when the pair has been unticked", async () => {
    const user = userEvent.setup();
    const onMerge = show();
    await user.click(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ }));
    await screen.findByText(/Scènes de la vie conjugale/);

    await user.click(screen.getByRole("checkbox"));
    /* Plus rien de coché : le bouton ne doit pas pouvoir partir. */
    expect(screen.getByRole("button", { name: /FONDRE 0 DOUBLON/ })).toBeDisabled();
    expect(onMerge).not.toHaveBeenCalled();
  });

  it("says so when TMDB recognises nothing one already holds", async () => {
    const user = userEvent.setup();
    /* Ce n'est pas un doublon : c'est une fiche à raccrocher, et c'est
       un autre panneau. Le dire évite de croire à une panne. */
    enrichRows.mockResolvedValue({ rows: [{ tmdbId: 999 }], failed: 0 });
    const onMerge = show();
    await user.click(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ }));
    expect(await screen.findByText(/Aucun doublon/)).toBeInTheDocument();
    expect(onMerge).not.toHaveBeenCalled();
  });

  it("says a refusal rather than staying quiet", async () => {
    const user = userEvent.setup();
    enrichRows.mockRejectedValue(new Error("TMDB a refusé."));
    show();
    await user.click(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("TMDB a refusé.");
  });

  it("does not offer to look without a key", () => {
    render(<DuplicatePanel films={[GOOD, ROTTEN]} apiKey="  " onMerge={vi.fn()} />);
    expect(screen.getByRole("button", { name: /CHERCHER LES DOUBLONS/ })).toBeDisabled();
    expect(screen.getByText(/Il faut une clé TMDB/)).toBeInTheDocument();
  });
});
