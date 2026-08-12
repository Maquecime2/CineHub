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
const monter = (extra = {}, props = {}) => {
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

const MOTS = { onglet: "mots" as const };
const LIENS = { onglet: "liens" as const };

describe("la fiche film, après le passage en trois intercalaires", () => {
  it("garde sous « Mes mots » ce que le rail d'annotation portait", () => {
    monter({}, MOTS);
    expect(screen.getByText("Mots-clés")).toBeInTheDocument();
    expect(screen.getByText("Motifs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /film de chevet/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mettre de côté/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /supprimer définitivement/ })).toBeInTheDocument();
  });

  it("garde la pellicule, montée près du texte qu'elle illustre", () => {
    monter({}, MOTS);
    expect(screen.getByText("La pellicule")).toBeInTheDocument();
  });

  /* THE LOG HAS CHANGED TAB, and it is the only thing the cutting up
     moved: a dated screening is what one has DONE with the film, not
     what it is. */
  it("range le journal des séances avec vos mots, et non avec le catalogue", () => {
    monter({}, MOTS);
    expect(document.querySelector('[data-tour="detail-watchlog"]')).not.toBeNull();
    expect(screen.queryByText("Fiche catalogue")).not.toBeInTheDocument();
  });

  it("garde sous « Le film » ce qui décrit l'œuvre", () => {
    monter();
    // the title is capitalised by the stylesheet, not in the text
    expect(screen.getByText("Fiche catalogue")).toBeInTheDocument();
    expect(document.querySelector('[data-tour="detail-identite"]')).not.toBeNull();
  });

  it("garde sous « Les liens » le fil rouge", () => {
    monter({}, LIENS);
    expect(screen.getByText("Le fil rouge")).toBeInTheDocument();
  });

  /* The poster and the title do not change tab: that is what keeps the
     film one is speaking of in sight. */
  it.each([{}, MOTS, LIENS])("garde l'affiche et le titre (%o)", (props) => {
    monter({}, props);
    expect(screen.getAllByText("Le Samouraï").length).toBeGreaterThan(0);
  });

  it("montre les mots-clés et les motifs déjà posés", () => {
    monter({}, MOTS);
    expect(screen.getByText("solitude")).toBeInTheDocument();
    // "Le héros meurt" gives the ending away: it stays scratched out until clicked
    expect(screen.getByText("motif de fin")).toBeInTheDocument();
    expect(screen.queryByText("Le héros meurt")).not.toBeInTheDocument();
  });

  /* No bedside for a film one has not seen: that shelf is the one of
     what gets rewatched, and the watchlist does not open it. */
  it("n'offre pas le chevet à un film jamais vu", () => {
    monter({ status: "watchlist" }, MOTS);
    expect(screen.queryByRole("button", { name: /film de chevet/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /supprimer définitivement/ })).toBeInTheDocument();
  });
});

/* The divider is also changed by hand, and not only by the guided tour:
   with no controlled property, the card keeps one of its own. It is that
   fallback which is tested here. */
describe("les intercalaires se tournent à la main", () => {
  it("ouvre « Les liens » d'un clic, sans qu'on lui dise d'en haut", async () => {
    const user = userEvent.setup();
    monter();
    expect(screen.queryByText("Le fil rouge")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "LES LIENS" }));
    expect(screen.getByText("Le fil rouge")).toBeInTheDocument();
  });
});

/* The two gestures that only look alike from afar: one files, the other
   erases. The confirmation request is what separates them. */
describe("les gestes qu'on peut regretter", () => {
  it("ne supprime pas au premier clic, mais le demande", async () => {
    const user = userEvent.setup();
    const { onDelete } = monter({}, MOTS);
    await user.click(screen.getByRole("button", { name: /supprimer définitivement/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "SUPPRIMER" }));
    expect(onDelete).toHaveBeenCalledWith("f");
  });

  it("renonce sans rien faire", async () => {
    const user = userEvent.setup();
    const { onDelete } = monter({}, MOTS);
    await user.click(screen.getByRole("button", { name: /supprimer définitivement/ }));
    await user.click(screen.getByRole("button", { name: "RENONCER" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("demande aussi avant de mettre de côté", async () => {
    const user = userEvent.setup();
    const { onUpdate } = monter({}, MOTS);
    await user.click(screen.getByRole("button", { name: /mettre de côté/ }));
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "METTRE DE CÔTÉ" }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ archived: true }));
  });

  /* Putting back on the shelf undoes the previous gesture: asking to
     confirm it would only teach clicking without reading. */
  it("remet en rayon sans rien demander", async () => {
    const user = userEvent.setup();
    const { onUpdate } = monter({ archived: true }, MOTS);
    await user.click(screen.getByRole("button", { name: /remettre en rayon/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });
});

describe("gérer le vocabulaire depuis la fiche", () => {
  const ouvrirLaListe = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /CHOISIR DES MOTIFS/ }));
    return user;
  };

  it("écrit un motif et le pose aussitôt sur la fiche", async () => {
    const onCréerMotif = vi.fn(() => "il-pleut-sans-arret");
    const { onUpdate } = monter({}, { onCréerMotif, ...MOTS });
    const user = await ouvrirLaListe();
    await user.type(screen.getByLabelText("Nouveau motif"), "Il pleut sans arrêt{Enter}");
    expect(onCréerMotif).toHaveBeenCalledWith("Il pleut sans arrêt", "narrative", false);
    // creating and laying are one single gesture
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ motifs: ["hero-dies", "il-pleut-sans-arret"] })
    );
  });

  it("écarte un motif du catalogue sans rien demander", async () => {
    const onMasquerMotif = vi.fn();
    monter({}, { onMasquerMotif, ...MOTS });
    const user = await ouvrirLaListe();
    await user.click(screen.getByLabelText("Écarter le motif Huis clos"));
    expect(onMasquerMotif).toHaveBeenCalledWith("single-setting", true);
  });

  /* Deleting a pattern of one's own also removes its identifier from
     the cards: so the confirmation announces how many carry it. */
  it("annonce les fiches touchées avant de supprimer un motif", async () => {
    setVocabulary({ custom: [makeCustomMotif("Il pleut", "world")], hidden: [] });
    const onSupprimerMotif = vi.fn();
    monter({ motifs: ["il-pleut"] }, { onSupprimerMotif, ...MOTS });
    const user = await ouvrirLaListe();
    await user.click(screen.getByLabelText("Supprimer le motif Il pleut"));
    expect(screen.getByText(/1 fiche/)).toBeInTheDocument();
    expect(onSupprimerMotif).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "SUPPRIMER LE MOTIF" }));
    expect(onSupprimerMotif).toHaveBeenCalledWith("il-pleut");
    setVocabulary({ custom: [], hidden: [] });
  });
});
