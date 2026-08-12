import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DetailView } from "./DetailView";
import { makeFilm } from "../domain/film";
import { makeCustomMotif, setVocabulary } from "../domain/motifs";

/* Le découpage de la fiche est une affaire de mise en page — mais rien
   de ce qu'elle portait ne doit avoir disparu en chemin, et c'est le
   genre de perte qu'on ne voit qu'en cherchant un bouton six semaines
   plus tard.

   Depuis les trois intercalaires, ces tests doivent DIRE dans lequel ils
   cherchent : un bloc absent de l'onglet ouvert n'est pas monté du tout.
   `monter({}, { onglet: "mots" })` ouvre la page voulue — c'est la même
   propriété contrôlée dont se sert la visite guidée. */
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
    expect(screen.getByRole("button", { name: /film de bedside/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mettre de côté/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /supprimer définitivement/ })).toBeInTheDocument();
  });

  it("garde la pellicule, montée près du texte qu'elle illustre", () => {
    monter({}, MOTS);
    expect(screen.getByText("La pellicule")).toBeInTheDocument();
  });

  /* LE JOURNAL A CHANGÉ D'ONGLET, et c'est la seule chose que le
     découpage ait déplacée : une séance datée est ce qu'on a FAIT du
     film, pas ce qu'il est. */
  it("range le journal des séances avec vos mots, et non avec le catalogue", () => {
    monter({}, MOTS);
    expect(document.querySelector('[data-tour="detail-watchlog"]')).not.toBeNull();
    expect(screen.queryByText("Fiche catalogue")).not.toBeInTheDocument();
  });

  it("garde sous « Le film » ce qui décrit l'œuvre", () => {
    monter();
    // le titre est mis en capitales par la feuille, pas dans le texte
    expect(screen.getByText("Fiche catalogue")).toBeInTheDocument();
    expect(document.querySelector('[data-tour="detail-identite"]')).not.toBeNull();
  });

  it("garde sous « Les liens » le fil rouge", () => {
    monter({}, LIENS);
    expect(screen.getByText("Le fil rouge")).toBeInTheDocument();
  });

  /* L'affiche et le titre ne changent pas d'onglet : c'est ce qui fait
     qu'on ne perd pas de vue le film dont on parle. */
  it.each([{}, MOTS, LIENS])("garde l'affiche et le titre (%o)", (props) => {
    monter({}, props);
    expect(screen.getAllByText("Le Samouraï").length).toBeGreaterThan(0);
  });

  it("montre les mots-clés et les motifs déjà posés", () => {
    monter({}, MOTS);
    expect(screen.getByText("solitude")).toBeInTheDocument();
    // « Le héros meurt » raconte la fin : il reste gratté jusqu'au clic
    expect(screen.getByText("motif de fin")).toBeInTheDocument();
    expect(screen.queryByText("Le héros meurt")).not.toBeInTheDocument();
  });

  /* Pas de bedside pour un film qu'on n'a pas vu : le rayon est celui qu'on
     revoit, et la watchlist ne l'ouvre pas. */
  it("n'offre pas le bedside à un film jamais vu", () => {
    monter({ status: "watchlist" }, MOTS);
    expect(screen.queryByRole("button", { name: /film de bedside/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /supprimer définitivement/ })).toBeInTheDocument();
  });
});

/* L'intercalaire se change à la main aussi, et pas seulement par la
   visite guidée : sans propriété contrôlée, la fiche s'en tient un à
   elle. C'est ce repli-là qu'on éprouve ici. */
describe("les intercalaires se tournent à la main", () => {
  it("ouvre « Les liens » d'un clic, sans qu'on lui dise d'en haut", async () => {
    const user = userEvent.setup();
    monter();
    expect(screen.queryByText("Le fil rouge")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "LES LIENS" }));
    expect(screen.getByText("Le fil rouge")).toBeInTheDocument();
  });
});

/* Les deux gestes qui ne se ressemblent que de loin : l'un range, l'autre
   efface. La demande de confirmation est ce qui les sépare. */
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

  /* Remettre en rayon défait le geste précédent : le faire confirmer
     n'apprendrait qu'à cliquer sans lire. */
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
    // créer et poser sont un seul geste
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

  /* Supprimer un motif à soi retire aussi son identifiant des fiches : la
     confirmation annonce donc combien en sont porteuses. */
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
