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
const searchPerson = vi.fn();
const personFilmography = vi.fn();
let key = "a-key";

vi.mock("../../tmdb", () => ({
  searchMovies: (...args: unknown[]) => searchMovies(...args),
  getDetails: (...args: unknown[]) => getDetails(...args),
  searchPerson: (...args: unknown[]) => searchPerson(...args),
  personFilmography: (...args: unknown[]) => personFilmography(...args),
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
  const onLook = vi.fn();
  render(
    <FilmPicker
      films={[OZU]}
      onPick={onPick}
      onAdopt={onAdopt}
      onLook={onLook}
      label="Ajouter un film"
    />
  );
  return { onPick, onAdopt, onLook };
};

/* ANCRÉ EN DÉBUT DE NOM : chaque ligne porte DEUX commandes, et le
   libellé de l'œil contient le titre lui aussi. Sans l'ancre, le
   sélecteur en désigne deux et le test dit « ambigu » là où le produit
   va très bien. */
const type = async (user: ReturnType<typeof userEvent.setup>, what: string) =>
  user.type(screen.getByPlaceholderText("un titre, un réalisateur…"), what);

beforeEach(() => {
  key = "a-key";
  searchMovies.mockReset();
  getDetails.mockReset();
  searchPerson.mockReset();
  personFilmography.mockReset();
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
    await user.click(screen.getByRole("button", { name: /^Voyage à Tokyo/ }));
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
    await user.click(await screen.findByRole("button", { name: /^Le Goût du saké/ }));

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
    await user.click(await screen.findByRole("button", { name: /^Le Goût du saké/ }));

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

/* ============================================================
   REGARDER AVANT DE POSER
   ============================================================

   C'est ICI qu'on décide si un film a sa place dans un plan, et jusqu'à
   présent on ne décidait que sur un titre et un nom. L'œil ouvre la vue
   rapide sur les DEUX moitiés — ce qu'on a, et ce qu'on n'a pas encore —
   et pour la seconde il faut que l'aperçu porte son `tmdbId`, sans quoi
   la vue rapide n'aurait que cette même ligne à redessiner.
   ============================================================ */
describe("looking before laying down", () => {
  it("opens the quick view on a card of the binder", async () => {
    const user = userEvent.setup();
    const { onLook, onPick } = build();
    await type(user, "tokyo");
    await user.click(screen.getByRole("button", { name: /Voir de quoi parle/ }));

    expect(onLook).toHaveBeenCalledWith(OZU);
    /* Regarder n'est pas poser : la file ne bouge pas. */
    expect(onPick).not.toHaveBeenCalled();
  });

  it("opens it on a TMDB result too, WITH the identifier that fills it", async () => {
    const user = userEvent.setup();
    searchMovies.mockResolvedValue([
      { tmdbId: 100, title: "Le Goût du saké", year: 1962, poster: "" },
    ]);
    const { onLook, onAdopt } = build();
    await type(user, "sake");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: /Voir de quoi parle/ }));

    const [preview] = onLook.mock.calls[0] as [{ tmdbId: number; title: string }];
    expect(preview).toMatchObject({ title: "Le Goût du saké", tmdbId: 100 });
    expect(onAdopt).not.toHaveBeenCalled();
    expect(getDetails).not.toHaveBeenCalled();
  });
});

/* ============================================================
   LES FILMS DE QUELQU'UN
   ============================================================

   Taper « antonioni » dans une recherche de TITRES rend ce que TMDB
   trouve de ce mot dans un titre : à peu près rien. Or c'est le geste
   qu'on fait — on pense à un cinéaste avant de penser à un film.

   Le métier part avec la question, sinon `searchPerson` rend l'homonyme
   acteur le plus populaire et l'on demande ensuite ce que CET acteur a
   réalisé. Et ce qu'on tient déjà est écarté, ce qui fait de la liste
   « ce qui me manque de lui » plutôt qu'un catalogue.
   ============================================================ */
describe("asking for a film-maker's work", () => {
  it("asks as a DIRECTOR, and leaves out what the binder already holds", async () => {
    const user = userEvent.setup();
    searchPerson.mockResolvedValue({ id: 5, name: "Yasujirō Ozu" });
    personFilmography.mockResolvedValue([
      { tmdbId: 18148, title: "Voyage à Tokyo", year: 1953, poster: "" },
      { tmdbId: 100, title: "Le Goût du saké", year: 1962, poster: "" },
    ]);
    build();
    await type(user, "ozu");
    await user.click(screen.getByRole("button", { name: /Ses films sur TMDB/ }));

    /* Le métier voyage AVEC la question, aux deux étages. */
    expect(searchPerson).toHaveBeenCalledWith("ozu", "a-key", { role: "réalisation" });
    expect(personFilmography).toHaveBeenCalledWith(5, "a-key", { role: "réalisation" });

    /* L'orthographe de TMDB, et non celle qu'on a tapée. */
    expect(await screen.findByText("LES FILMS DE Yasujirō Ozu")).toBeInTheDocument();
    expect(screen.getByText("Le Goût du saké")).toBeInTheDocument();
    /* Celui du classeur est écarté — et le dire, c'est ce qui distingue
       une liste filtrée d'une réponse tronquée. */
    expect(screen.getAllByText("Voyage à Tokyo")).toHaveLength(1);
    expect(screen.getByText(/déjà au classeur/)).toBeInTheDocument();
  });

  it("says so when TMDB knows nobody of that name", async () => {
    const user = userEvent.setup();
    searchPerson.mockResolvedValue(null);
    build();
    await type(user, "zzz");
    await user.click(screen.getByRole("button", { name: /Ses films sur TMDB/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("zzz");
    expect(personFilmography).not.toHaveBeenCalled();
  });

  it("says so when the binder already holds the whole filmography", async () => {
    const user = userEvent.setup();
    searchPerson.mockResolvedValue({ id: 5, name: "Yasujirō Ozu" });
    personFilmography.mockResolvedValue([
      { tmdbId: 18148, title: "Voyage à Tokyo", year: 1953, poster: "" },
    ]);
    build();
    await type(user, "ozu");
    await user.click(screen.getByRole("button", { name: /Ses films sur TMDB/ }));

    expect(await screen.findByText(/tout ce que TMDB lui attribue/)).toBeInTheDocument();
  });
});

/* Le rangement lui-même est éprouvé à côté (`domain/proposals`) ; ce qui
   se voit d'ici est qu'il est bien BRANCHÉ, sur les deux moitiés — elles
   arrivaient par deux routes et se rangeaient de deux façons. */
describe("the order the proposals come in", () => {
  it("puts the most widely seen first, in a title search", async () => {
    const user = userEvent.setup();
    searchMovies.mockResolvedValue([
      { tmdbId: 1, title: "confidentiel", year: 2020, poster: "", voteCount: 12 },
      { tmdbId: 2, title: "vu par tous", year: 1999, poster: "", voteCount: 90000 },
    ]);
    build();
    await type(user, "x");
    await user.keyboard("{Enter}");

    await screen.findByText("SUR TMDB");
    const titles = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent || "")
      .filter((x) => x.includes("confidentiel") || x.includes("vu par tous"));
    expect(titles[0]).toContain("vu par tous");
  });

  it("falls back on the date in a filmography nobody has rated", async () => {
    const user = userEvent.setup();
    searchPerson.mockResolvedValue({ id: 5, name: "Quelqu'un" });
    personFilmography.mockResolvedValue([
      { tmdbId: 1, title: "ancien", year: 1953, poster: "" },
      { tmdbId: 2, title: "récent", year: 2019, poster: "" },
    ]);
    build();
    await type(user, "q");
    await user.click(screen.getByRole("button", { name: /Ses films sur TMDB/ }));

    await screen.findByText(/LES FILMS DE/);
    const titles = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent || "")
      .filter((x) => x.includes("ancien") || x.includes("récent"));
    expect(titles[0]).toContain("récent");
  });
});
