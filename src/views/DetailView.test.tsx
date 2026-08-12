import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailView } from "./DetailView";
import { makeFilm } from "../domain/film";
import { makeCustomMotif, setVocabulary } from "../domain/motifs";

/* Cutting the card up is a matter of layout — but nothing it carried
   must have vanished along the way, and that is the kind of loss one
   only notices while hunting for a button six weeks later.

   Since the three dividers, these tests must SAY which one they are
   searching in: a block absent from the open tab is not mounted at all.
   `monter({}, { onglet: "mots" })` opens the wanted page — it is the
   same controlled property the guided tour uses. */
const build = (extra = {}, props = {}) => {
  const onDelete = vi.fn();
  const onUpdate = vi.fn();
  const film = makeFilm({
    id: "f",
    title: "Le Samouraï",
    status: "watched",
    themes: ["solitude"],
    motifs: ["hero-dies"],
    ...extra,
  });
  render(
    <DetailView
      film={film}
      onBack={vi.fn()}
      onUpdate={onUpdate}
      onDelete={onDelete}
      films={[film]}
      onLinkFilm={vi.fn()}
      onRemoveLink={vi.fn()}
      onEditLink={vi.fn()}
      onOpen={vi.fn()}
      {...props}
    />
  );
  return { film, onDelete, onUpdate };
};

const WORDS = { tab: "mots" as const };
const LINKS = { tab: "liens" as const };

describe("the film card, after the move to three dividers", () => {
  it('keeps under "Mes mots" what the annotation rail carried', () => {
    build({}, WORDS);
    expect(screen.getByText("Mots-clés")).toBeInTheDocument();
    expect(screen.getByText("Motifs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /film de chevet/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mettre de côté/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /supprimer définitivement/ })).toBeInTheDocument();
  });

  it("keeps the film strip, mounted next to the text it illustrates", () => {
    build({}, WORDS);
    expect(screen.getByText("La pellicule")).toBeInTheDocument();
  });

  /* THE LOG HAS CHANGED TAB, and it is the only thing the cutting up
     moved: a dated screening is what one has DONE with the film, not
     what it is. */
  it("files the screening log with your words, and not with the catalogue", () => {
    build({}, WORDS);
    expect(document.querySelector('[data-tour="detail-watchlog"]')).not.toBeNull();
    expect(screen.queryByText("Fiche catalogue")).not.toBeInTheDocument();
  });

  it('keeps under "Le film" what describes the work', () => {
    build();
    // the title is capitalised by the stylesheet, not in the text
    expect(screen.getByText("Fiche catalogue")).toBeInTheDocument();
    expect(document.querySelector('[data-tour="detail-identite"]')).not.toBeNull();
  });

  it('keeps the red thread under "Les liens"', () => {
    build({}, LINKS);
    expect(screen.getByText("Le fil rouge")).toBeInTheDocument();
  });

  /* The poster and the title do not change tab: that is what keeps the
     film one is speaking of in sight. */
  it.each([{}, WORDS, LINKS])("keeps the poster and the title (%o)", (props) => {
    build({}, props);
    expect(screen.getAllByText("Le Samouraï").length).toBeGreaterThan(0);
  });

  it("shows the keywords and the motifs already laid", () => {
    build({}, WORDS);
    expect(screen.getByText("solitude")).toBeInTheDocument();
    // "Le héros meurt" gives the ending away: it stays scratched out until clicked
    expect(screen.getByText("motif de fin")).toBeInTheDocument();
    expect(screen.queryByText("Le héros meurt")).not.toBeInTheDocument();
  });

  /* No bedside for a film one has not seen: that shelf is the one of
     what gets rewatched, and the watchlist does not open it. */
  it("does not offer the bedside to a film never seen", () => {
    build({ status: "watchlist" }, WORDS);
    expect(screen.queryByRole("button", { name: /film de chevet/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /supprimer définitivement/ })).toBeInTheDocument();
  });
});

/* The divider is also changed by hand, and not only by the guided tour:
   with no controlled property, the card keeps one of its own. It is that
   fallback which is tested here. */
describe("the dividers are turned by hand", () => {
  it('opens "Les liens" on a click, with nobody telling it from above', async () => {
    const user = userEvent.setup();
    build();
    expect(screen.queryByText("Le fil rouge")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "LES LIENS" }));
    expect(screen.getByText("Le fil rouge")).toBeInTheDocument();
  });
});

/* The two gestures that only look alike from afar: one files, the other
   erases. The confirmation request is what separates them. */
describe("the gestures one can regret", () => {
  it("does not delete on the first click, but asks", async () => {
    const user = userEvent.setup();
    const { onDelete } = build({}, WORDS);
    await user.click(screen.getByRole("button", { name: /supprimer définitivement/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "SUPPRIMER" }));
    expect(onDelete).toHaveBeenCalledWith("f");
  });

  it("gives up without doing anything", async () => {
    const user = userEvent.setup();
    const { onDelete } = build({}, WORDS);
    await user.click(screen.getByRole("button", { name: /supprimer définitivement/ }));
    await user.click(screen.getByRole("button", { name: "RENONCER" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before setting aside too", async () => {
    const user = userEvent.setup();
    const { onUpdate } = build({}, WORDS);
    await user.click(screen.getByRole("button", { name: /mettre de côté/ }));
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "METTRE DE CÔTÉ" }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  /* Putting back on the shelf undoes the previous gesture: asking to
     confirm it would only teach clicking without reading. */
  it("puts back on the shelf without asking anything", async () => {
    const user = userEvent.setup();
    const { onUpdate } = build({ archived: true }, WORDS);
    await user.click(screen.getByRole("button", { name: /remettre en rayon/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});

describe("handling the vocabulary from the card", () => {
  const openList = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /CHOISIR DES MOTIFS/ }));
    return user;
  };

  it("writes a motif and lays it on the card at once", async () => {
    const onCreateMotif = vi.fn(() => "il-pleut-sans-arret");
    const { onUpdate } = build({}, { onCreateMotif, ...WORDS });
    const user = await openList();
    await user.type(screen.getByLabelText("Nouveau motif"), "Il pleut sans arrêt{Enter}");
    expect(onCreateMotif).toHaveBeenCalledWith("Il pleut sans arrêt", "narrative", false);
    // creating and laying are one single gesture
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ motifs: ["hero-dies", "il-pleut-sans-arret"] })
    );
  });

  it("sets a catalogue motif aside without asking anything", async () => {
    const onHideMotif = vi.fn();
    build({}, { onHideMotif, ...WORDS });
    const user = await openList();
    await user.click(screen.getByLabelText("Écarter le motif Huis clos"));
    expect(onHideMotif).toHaveBeenCalledWith("single-setting", true);
  });

  /* Deleting a pattern of one's own also removes its identifier from
     the cards: so the confirmation announces how many carry it. */
  it("announces the cards affected before deleting a motif", async () => {
    setVocabulary({ custom: [makeCustomMotif("Il pleut", "world")], hidden: [] });
    const onDeleteMotif = vi.fn();
    build({ motifs: ["il-pleut"] }, { onDeleteMotif, ...WORDS });
    const user = await openList();
    await user.click(screen.getByLabelText("Supprimer le motif Il pleut"));
    expect(screen.getByText(/1 fiche/)).toBeInTheDocument();
    expect(onDeleteMotif).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "SUPPRIMER LE MOTIF" }));
    expect(onDeleteMotif).toHaveBeenCalledWith("il-pleut");
    setVocabulary({ custom: [], hidden: [] });
  });
});
