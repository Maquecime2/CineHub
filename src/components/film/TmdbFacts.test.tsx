import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TmdbFacts } from "./TmdbFacts";
import { makeFilm } from "../../domain/film";

/* ============================================================
   RAFRAÎCHIR COMBLE DES TROUS — SAUF LÀ OÙ IL N'Y A RIEN À PROTÉGER

   Une durée saisie à la main survit à un rafraîchissement : c'est ce qui
   rend le geste sûr. Un photogramme, lui, n'est de personne — il n'y a
   aucun écran pour en poser un — donc une fiche dont on a corrigé
   l'identifiant gardait POUR TOUJOURS les plans du mauvais film, sans
   qu'aucun trou permette de les remplacer.
   ============================================================ */

const searchMovie = vi.fn();
const getDetails = vi.fn();

vi.mock("../../tmdb", () => ({
  searchMovie: (...a: unknown[]) => searchMovie(...a),
  getDetails: (...a: unknown[]) => getDetails(...a),
}));
vi.mock("../../services/tmdbKey", () => ({ getTmdbKey: () => "a-key" }));

const filled = makeFilm({
  id: "f1",
  title: "Resurrection",
  tmdbId: 878608,
  runtime: 91, // saisie à la main
  synopsis: "Le résumé de l'ancienne fiche.",
  cast: ["Quelqu'un d'autre"],
  frames: ["/vieux-a.jpg", "/vieux-b.jpg"],
});

const answer = {
  tmdbId: 878608,
  frames: ["/neuf-a.jpg", "/neuf-b.jpg", "/neuf-c.jpg"],
  synopsis: "Le vrai résumé.",
  cast: ["La bonne distribution"],
  crew: {},
  runtime: 121,
  language: "en",
  countries: ["US"],
  tmdbRating: 6.4,
  keywords: [],
  genres: [],
  director: "",
};

const click = async (name: RegExp, film = filled) => {
  const onUpdate = vi.fn();
  const user = userEvent.setup();
  render(<TmdbFacts film={film} onUpdate={onUpdate} />);
  await user.click(screen.getByRole("button", { name }));
  await vi.waitFor(() => expect(onUpdate).toHaveBeenCalled());
  return onUpdate.mock.calls[0]![0];
};

describe("le relevé TMDB", () => {
  beforeEach(() => {
    searchMovie.mockReset();
    getDetails.mockReset().mockResolvedValue(answer);
  });

  it("reprend les photogrammes au simple rafraîchissement", async () => {
    const saved = await click(/rafraîchir/i);
    expect(saved.frames).toEqual(["/neuf-a.jpg", "/neuf-b.jpg", "/neuf-c.jpg"]);
  });

  it("laisse malgré tout la durée saisie à la main", async () => {
    const saved = await click(/rafraîchir/i);
    expect(saved.runtime).toBe(91);
    expect(saved.synopsis).toBe("Le résumé de l'ancienne fiche.");
  });

  it("remplace tout le relevé quand on réinterroge", async () => {
    const saved = await click(/réinterroger/i);
    expect(saved.runtime).toBe(121);
    expect(saved.synopsis).toBe("Le vrai résumé.");
    expect(saved.cast).toEqual(["La bonne distribution"]);
    expect(saved.frames).toEqual(["/neuf-a.jpg", "/neuf-b.jpg", "/neuf-c.jpg"]);
  });

  it("ne propose pas de réinterroger une fiche sans identifiant", () => {
    render(<TmdbFacts film={makeFilm({ id: "f2", title: "Sans id" })} onUpdate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /réinterroger/i })).toBeNull();
  });
});
