import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilmPicker } from "./FilmPicker";
import { makeFilm } from "../../domain/film";

/* ============================================================
   WHAT THE PICKER MUST NEVER DO
   ============================================================

   Four things, and each of them is a silent failure of its own kind:

   — question TMDB with no key and no account. The doctrine is plain
     about the tier without an account: nothing is created, nothing is
     imported, TMDB is not asked. And going dark is not the answer
     either — `NoKey` says what is missing and carries the way out;
   — offer a second time what the binder already holds. Two entries on
     one film in a picker is how a collection ends up with two cards;
   — lay a step for a card that was never filed. A failed request is a
     REQUEST that failed, so it is said, and nothing is written;
   — file a film with no director. `getDetails` is what carries it, and
     without it the entry would be a title the map of film-makers has no
     way of explaining.
   ============================================================ */

const searchMovies = vi.fn();
const getDetails = vi.fn();
let key = "a-key";

vi.mock("../../tmdb", () => ({
  searchMovies: (...args: unknown[]) => searchMovies(...args),
  getDetails: (...args: unknown[]) => getDetails(...args),
  POSTER_BASE: "https://image.tmdb.org/t/p/w342",
  POSTER_THUMB: "https://image.tmdb.org/t/p/w185",
}));

/* `NoKey` va chercher `openTmdbSettings` dans le même module : c'est le
   bouton par lequel on sort du manque, et il fait partie de ce qu'on
   éprouve ici. */
vi.mock("../../services/tmdbKey", () => ({
  useTmdbKey: () => key,
  openTmdbSettings: vi.fn(),
}));

const OZU = makeFilm({ id: "a", title: "Voyage à Tokyo", year: 1953, director: "Yasujirō Ozu" });

const build = () => {
  const onPick = vi.fn();
  const onAdopt = vi.fn();
  render(<FilmPicker films={[OZU]} onPick={onPick} onAdopt={onAdopt} label="Ajouter un film" />);
  return { onPick, onAdopt };
};

const type = async (user: ReturnType<typeof userEvent.setup>, what: string) =>
  user.type(screen.getByPlaceholderText("un titre, un réalisateur…"), what);

beforeEach(() => {
  key = "a-key";
  searchMovies.mockReset();
  getDetails.mockReset();
});

describe("with no key and no account", () => {
  it("does not question TMDB, says what is missing, and still searches the binder", async () => {
    key = "";
    const user = userEvent.setup();
    const { onPick } = build();
    await type(user, "tokyo");

    expect(screen.queryByRole("button", { name: /Chercher sur TMDB/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Il manque une key TMDB/)).toBeInTheDocument();

    /* La moitié locale n'est pas morte pour autant. */
    await user.click(screen.getByRole("button", { name: /Voyage à Tokyo/ }));
    expect(onPick).toHaveBeenCalledWith(OZU);
    expect(searchMovies).not.toHaveBeenCalled();
  });
});

describe("with a key", () => {
  it("waits for Enter rather than firing on every letter", async () => {
    const user = userEvent.setup();
    searchMovies.mockResolvedValue([]);
    build();
    await type(user, "tokyo");
    expect(searchMovies).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(searchMovies).toHaveBeenCalledTimes(1);
  });

  it("does not offer a second time what the binder already holds", async () => {
    const user = userEvent.setup();
    searchMovies.mockResolvedValue([
      { tmdbId: 18148, title: "Voyage à Tokyo", year: 1953, poster: "" },
      { tmdbId: 100, title: "Le Goût du saké", year: 1962, poster: "" },
    ]);
    build();
    await type(user, "ozu");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("SUR TMDB")).toBeInTheDocument();
    /* Une seule fois, et c'est celle du classeur : le titre et l'année
       suffisent à les reconnaître, `tmdbId` ou pas. */
    expect(screen.getAllByText("Voyage à Tokyo")).toHaveLength(1);
    expect(screen.getByText("Le Goût du saké")).toBeInTheDocument();
  });

  it("files a picked film under “to watch”, WITH its director", async () => {
    const user = userEvent.setup();
    searchMovies.mockResolvedValue([
      { tmdbId: 100, title: "Le Goût du saké", year: 1962, poster: "" },
    ]);
    getDetails.mockResolvedValue({
      tmdbId: 100,
      year: 1962,
      director: "Yasujirō Ozu",
      poster: "https://image.tmdb.org/t/p/w342/x.jpg",
    });
    const { onAdopt } = build();
    await type(user, "sake");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: /Le Goût du saké/ }));

    expect(getDetails).toHaveBeenCalledWith(100, "a-key");
    const [filed] = onAdopt.mock.calls[0] as [{ status: string; source: string; director: string }];
    expect(filed).toMatchObject({
      title: "Le Goût du saké",
      director: "Yasujirō Ozu",
      status: "watchlist",
      source: "tmdb",
      tmdbId: 100,
    });
  });

  it("says a failed request failed, and files NOTHING", async () => {
    const user = userEvent.setup();
    searchMovies.mockResolvedValue([
      { tmdbId: 100, title: "Le Goût du saké", year: 1962, poster: "" },
    ]);
    getDetails.mockRejectedValue(new Error("TMDB 503"));
    const { onAdopt } = build();
    await type(user, "sake");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: /Le Goût du saké/ }));

    /* `Trouble` porte `role="alert"` : l'échec est annoncé, pas
       seulement dessiné. */
    expect(await screen.findByRole("alert")).toHaveTextContent("TMDB 503");
    expect(onAdopt).not.toHaveBeenCalled();
  });

  it("says a search that failed failed, rather than showing an empty list", async () => {
    const user = userEvent.setup();
    searchMovies.mockRejectedValue(new Error("TMDB 429"));
    build();
    await type(user, "ozu");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("TMDB 429");
    expect(screen.queryByText("SUR TMDB")).not.toBeInTheDocument();
  });
});
