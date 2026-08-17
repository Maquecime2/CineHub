import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilmQuickView } from "./FilmQuickView";
import { makeFilm } from "../../domain/film";

/* ============================================================
   EVERYTHING WE KNOW, AND NOTHING WE DO NOT
   ============================================================

   Four rules, and three of them are ways of not lying:

   — a card with no summary asks for one ONCE and writes it down. It is
     the whole reason this panel is not blank for every binder in
     existence, the field having only just been invented;
   — the completion fills HOLES. A runtime typed by hand must survive a
     panel one merely opened, or opening it would be a write nobody
     asked for;
   — what is NOT in the binder shows no rating, no screening and no
     status. Zero and none would state that one disliked a film one has
     not seen;
   — a request that failed is SAID. A summary that stays absent in
     silence reads as "TMDB has none", which calls for nothing, where
     the truth calls for trying again.
   ============================================================ */

const getDetails = vi.fn();
let key = "a-key";

vi.mock("../../tmdb", () => ({
  getDetails: (...args: unknown[]) => getDetails(...args),
  POSTER_BASE: "https://image.tmdb.org/t/p/w342",
  POSTER_THUMB: "https://image.tmdb.org/t/p/w185",
}));

vi.mock("../../services/tmdbKey", () => ({
  useTmdbKey: () => key,
  openTmdbSettings: vi.fn(),
}));

const OZU = makeFilm({
  id: "a",
  title: "Voyage à Tokyo",
  year: 1953,
  director: "Yasujirō Ozu",
  runtime: 136,
  tmdbId: 18148,
});

beforeEach(() => {
  key = "a-key";
  getDetails.mockReset();
  getDetails.mockResolvedValue({});
});

const open = (film = OZU, extra = {}) => {
  const onEnrich = vi.fn();
  const onClose = vi.fn();
  const onOpenPerson = vi.fn();
  render(
    <FilmQuickView
      film={film}
      onEnrich={onEnrich}
      onOpenPerson={onOpenPerson}
      onClose={onClose}
      {...extra}
    />
  );
  return { onEnrich, onClose, onOpenPerson };
};

describe("filling in what the card is missing", () => {
  it("asks TMDB once, shows the summary, and writes it on the card", async () => {
    getDetails.mockResolvedValue({
      synopsis: "Un couple âgé rend visite à ses enfants, à Tokyo.",
      runtime: 999,
      director: "Quelqu'un d'autre",
    });
    const { onEnrich } = open();

    expect(await screen.findByText(/Un couple âgé rend visite à ses enfants/)).toBeInTheDocument();
    expect(getDetails).toHaveBeenCalledTimes(1);
    expect(getDetails).toHaveBeenCalledWith(18148, "a-key");

    /* ON COMBLE DES TROUS, ON NE CORRIGE RIEN : la durée et le nom déjà
       posés survivent à un panneau qu'on a seulement ouvert. */
    const [written] = onEnrich.mock.calls[0] as [{ runtime: number; director: string }];
    expect(written.runtime).toBe(136);
    expect(written.director).toBe("Yasujirō Ozu");
  });

  it("asks nothing at all of a card that already says everything", () => {
    open(
      makeFilm({
        ...OZU,
        synopsis: "déjà là",
        cast: ["Chishū Ryū"],
      })
    );
    expect(getDetails).not.toHaveBeenCalled();
    expect(screen.getByText("déjà là")).toBeInTheDocument();
  });

  it("says a failed request failed, instead of an empty summary", async () => {
    getDetails.mockRejectedValue(new Error("TMDB 503"));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("TMDB 503");
  });

  it("asks nothing without a key, and says why the summary is absent", () => {
    key = "";
    open();
    expect(getDetails).not.toHaveBeenCalled();
    expect(screen.getByText(/n'est reliée à aucune entrée TMDB/)).toBeInTheDocument();
  });
});

describe("what is not in the binder", () => {
  it("shows no rating, no screening and no status", () => {
    open(makeFilm({ ...OZU, tmdbId: null }), { inBinder: false });
    expect(screen.queryByText("CE QUE VOUS EN AVEZ FAIT")).not.toBeInTheDocument();
    expect(screen.queryByText("STATUT")).not.toBeInTheDocument();
  });

  it("still says everything about the FILM", () => {
    open(
      makeFilm({
        ...OZU,
        tmdbId: null,
        synopsis: "un résumé",
        genres: ["Drame"],
      }),
      { inBinder: false }
    );
    expect(screen.getByText("un résumé")).toBeInTheDocument();
    expect(screen.getByText("Drame")).toBeInTheDocument();
    expect(screen.getByText("QUI L'A FAIT")).toBeInTheDocument();
  });
});

describe("the people lead somewhere", () => {
  it("opens the director's page from the panel", async () => {
    const user = userEvent.setup();
    const { onOpenPerson } = open(makeFilm({ ...OZU, tmdbId: null }));
    await user.click(screen.getByRole("button", { name: "Yasujirō Ozu" }));
    expect(onOpenPerson).toHaveBeenCalledWith("Yasujirō Ozu");
  });
});

describe("it is a layer, and it gives the screen back", () => {
  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = open(makeFilm({ ...OZU, tmdbId: null }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("carries the caller's own action", async () => {
    const user = userEvent.setup();
    const onAct = vi.fn();
    render(
      <FilmQuickView
        film={makeFilm({ ...OZU, tmdbId: null })}
        inBinder={false}
        action={<button onClick={onAct}>Ajouter au parcours</button>}
        onClose={vi.fn()}
      />
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Ajouter au parcours" })
    );
    expect(onAct).toHaveBeenCalled();
  });
});
