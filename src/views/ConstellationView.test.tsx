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

describe("the threads in the sky", () => {
  it("offers to put them out one by one", () => {
    const thread = makeThread({ id: "f1", label: "Le héros meurt", motif: "hero-dies" });
    build({ fils: [thread] });
    expect(screen.getByRole("button", { name: /Le héros meurt/ })).toBeInTheDocument();
  });
});
