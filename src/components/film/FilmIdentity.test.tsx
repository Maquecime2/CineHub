import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilmIdentity } from "./FilmIdentity";
import { makeFilm } from "../../domain/film";

/* ============================================================
   CORRIGER L'IDENTIFIANT, C'EST CHANGER DE FILM

   Tout ce que TMDB avait rempli vient de l'ANCIEN identifiant. Or le
   remplissage COMBLE DES TROUS et ne corrige rien : rien n'étant vide,
   rien n'était jamais réécrit, et la fiche corrigée gardait pour
   toujours les photogrammes et le résumé du mauvais film — sans qu'aucun
   geste puisse plus les rattraper.
   ============================================================ */

const searchMovie = vi.fn();
const getDetails = vi.fn();

vi.mock("../../tmdb", () => ({
  searchMovie: (...a: unknown[]) => searchMovie(...a),
  getDetails: (...a: unknown[]) => getDetails(...a),
}));

vi.mock("../../services/tmdbKey", () => ({ getTmdbKey: () => "a-key" }));

const wrong = makeFilm({
  id: "f1",
  title: "Voyage à Tokyo",
  year: 1953,
  tmdbId: 111,
  director: "Le mauvais",
  synopsis: "Le résumé du mauvais film.",
  cast: ["Quelqu'un d'autre"],
  runtime: 91,
  frames: ["/mauvais-a.jpg", "/mauvais-b.jpg"],
  keywords: ["mauvais"],
});

const right = {
  tmdbId: 222,
  director: "Yasujirō Ozu",
  genres: ["Drame"],
  year: 1953,
  poster: "",
  synopsis: "Un couple âgé rend visite à ses enfants.",
  cast: ["Chishū Ryū"],
  crew: { image: ["Yūharu Atsuta"] },
  runtime: 136,
  language: "ja",
  countries: ["JP"],
  tmdbRating: 8.2,
  keywords: ["famille"],
  frames: ["/bon-a.jpg", "/bon-b.jpg"],
};

const correct = async (onUpdate: (f: unknown) => void) => {
  const user = userEvent.setup();
  render(<FilmIdentity film={wrong} onUpdate={onUpdate} />);
  await user.click(screen.getByRole("button", { name: /corriger/i }));
  await user.click(screen.getByRole("button", { name: /tmdb/i }));
  await user.click(await screen.findByRole("button", { name: /enregistrer/i }));
};

describe("corriger l'identifiant TMDB", () => {
  beforeEach(() => {
    searchMovie.mockReset().mockResolvedValue({ id: 222, title: "Voyage à Tokyo" });
    getDetails.mockReset().mockResolvedValue(right);
  });

  it("remplace les photogrammes de l'ancien film par ceux du nouveau", async () => {
    const onUpdate = vi.fn();
    await correct(onUpdate);
    const saved = onUpdate.mock.calls[0]![0];
    expect(saved.tmdbId).toBe(222);
    expect(saved.frames).toEqual(["/bon-a.jpg", "/bon-b.jpg"]);
    expect(saved.synopsis).toBe("Un couple âgé rend visite à ses enfants.");
    expect(saved.cast).toEqual(["Chishū Ryū"]);
    expect(saved.runtime).toBe(136);
  });

  it("ne laisse rien de l'ancien film que la nouvelle requête n'a pas ramené", async () => {
    getDetails.mockResolvedValue({ ...right, frames: [], synopsis: "" });
    const onUpdate = vi.fn();
    await correct(onUpdate);
    const saved = onUpdate.mock.calls[0]![0];
    expect(saved.frames).toEqual([]);
    expect(saved.synopsis).toBe("");
  });

  it("ne touche pas à ce qu'on a écrit soi-même", async () => {
    const mine = { ...wrong, rating: 9, review: "Bouleversant.", notes: "vu au cinéma" };
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<FilmIdentity film={mine} onUpdate={onUpdate} />);
    await user.click(screen.getByRole("button", { name: /corriger/i }));
    await user.click(screen.getByRole("button", { name: /tmdb/i }));
    await user.click(await screen.findByRole("button", { name: /enregistrer/i }));
    const saved = onUpdate.mock.calls[0]![0];
    expect(saved.rating).toBe(9);
    expect(saved.review).toBe("Bouleversant.");
    expect(saved.notes).toBe("vu au cinéma");
  });

  it("laisse la fiche tranquille quand l'identifiant n'a pas bougé", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<FilmIdentity film={wrong} onUpdate={onUpdate} />);
    await user.click(screen.getByRole("button", { name: /corriger/i }));
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    const saved = onUpdate.mock.calls[0]![0];
    expect(saved.frames).toEqual(["/mauvais-a.jpg", "/mauvais-b.jpg"]);
  });
});
