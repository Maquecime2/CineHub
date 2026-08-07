import { describe, it, expect } from "vitest";
import { makeFilm } from "./film";
import { basculéesParErreur, porteUneTraceDeVisionnage } from "./repairs";
import type { Film } from "../types";

const film = (p: Partial<Film>): Film => makeFilm(p as never);

describe("porteUneTraceDeVisionnage", () => {
  it("ne voit aucune trace sur une fiche que personne n'a ouverte", () => {
    expect(porteUneTraceDeVisionnage(film({ title: "Stalker", status: "watched" }))).toBe(false);
  });

  /* Les cinq traces, une par une : c'est la liste entière qui fait la
     sûreté du tri, une seule oubliée bascule un vrai souvenir. */
  it.each([
    ["une séance", { watches: [{ date: "2024-01-01", rating: 0 }] }],
    ["une date", { watchedAt: "2024-01-01" }],
    ["une note", { rating: 4 }],
    ["une critique", { review: "immense" }],
    ["une note libre", { notes: "vu au cinéma" }],
  ])("reconnaît %s", (_, champ) => {
    expect(porteUneTraceDeVisionnage(film({ title: "Stalker", status: "watched", ...champ }))).toBe(
      true
    );
  });

  it("ne prend pas un texte vide pour une trace", () => {
    expect(
      porteUneTraceDeVisionnage(film({ title: "Stalker", status: "watched", review: "   " }))
    ).toBe(false);
  });
});

describe("basculéesParErreur", () => {
  const nue = (title: string, p: Partial<Film> = {}) => film({ title, status: "watched", ...p });

  it("ne désigne que des fiches « vues » sans trace", () => {
    const suspecte = nue("Solaris");
    const vue = nue("Le Miroir", { rating: 5 });
    const envie = film({ title: "Andreï Roublev", status: "watchlist" });
    expect(basculéesParErreur([suspecte, vue, envie]).map((f) => f.title)).toEqual(["Solaris"]);
  });

  it("laisse les fiches mises de côté là où elles sont", () => {
    expect(basculéesParErreur([nue("Solaris", { archived: true })])).toEqual([]);
  });

  it("montre d'abord celles venues de Letterboxd, puis par titre", () => {
    const films = [nue("Zerkalo"), nue("Andreï Roublev"), nue("Solaris", { source: "letterboxd" })];
    expect(basculéesParErreur(films).map((f) => f.title)).toEqual([
      "Solaris",
      "Andreï Roublev",
      "Zerkalo",
    ]);
  });
});
