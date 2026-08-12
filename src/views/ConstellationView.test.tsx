import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConstellationView } from "./ConstellationView";
import { makeFilm } from "../domain/film";
import { makeThread } from "../domain/threads";

/* Un film relié, pour que le ciel ne soit pas vide, et un film que rien
   ne relie — c'est celui-là que la recherche devait rendre atteignable. */
const relié = makeFilm({
  id: "r",
  title: "Le Samouraï",
  linkedWorks: [{ id: "w", type: "book", title: "Solaris", creator: "Lem", note: "" }],
});
const isolé = makeFilm({ id: "i", title: "Playtime", director: "Tati" });

const monter = (props: Partial<Parameters<typeof ConstellationView>[0]> = {}) => {
  const onOpen = vi.fn();
  render(<ConstellationView films={[relié, isolé]} onOpen={onOpen} {...props} />);
  return { onOpen };
};

const chercher = async (texte: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText(/chercher dans toute la collection/), texte);
  return user;
};

describe("la recherche de la constellation", () => {
  it("trouve un film que rien ne relie, et le marque hors carte", async () => {
    monter();
    await chercher("playtime");
    expect(screen.getByRole("button", { name: /Playtime/ })).toBeInTheDocument();
    expect(screen.getByText("épingler")).toBeInTheDocument();
  });

  it("cherche aussi sur le réalisateur", async () => {
    monter();
    await chercher("tati");
    expect(screen.getByRole("button", { name: /Playtime/ })).toBeInTheDocument();
  });

  it("marque « au ciel » un film déjà placé", async () => {
    monter();
    await chercher("samou");
    expect(screen.getByText("au ciel")).toBeInTheDocument();
  });

  it("dit franchement quand la collection n'a rien de ce nom", async () => {
    monter();
    await chercher("zzz");
    expect(screen.getByText(/rien de ce nom/)).toBeInTheDocument();
  });

  it("épingler un film hors carte le fait entrer au ciel et devenir le foyer", async () => {
    monter();
    const user = await chercher("playtime");
    await user.click(screen.getByRole("button", { name: /Playtime/ }));
    // le foyer est posé sur lui : la carte se compose autour
    expect(screen.getByText("FOYER")).toBeInTheDocument();
    expect(screen.getAllByText("Playtime").length).toBeGreaterThan(0);
  });
});

describe("les fils au ciel", () => {
  it("propose de les éteindre un par un", () => {
    const fil = makeThread({ id: "f1", label: "Le héros meurt", motif: "hero-dies" });
    monter({ fils: [fil] });
    expect(screen.getByRole("button", { name: /Le héros meurt/ })).toBeInTheDocument();
  });
});
