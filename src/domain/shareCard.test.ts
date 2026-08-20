import { describe, it, expect } from "vitest";
import { cardFacts, shorten, EXCERPT_MAX } from "./shareCard";
import type { Film } from "../types";

const film = (patch: Partial<Film>): Film =>
  ({
    id: "f",
    title: "Stalker",
    year: 1979,
    director: "Andreï Tarkovski",
    rating: 0,
    review: "",
    ...patch,
  }) as Film;

describe("la coupe d'un extrait", () => {
  it("laisse tranquille ce qui tient", () => {
    expect(shorten("Deux phrases courtes.")).toBe("Deux phrases courtes.");
  });

  /* Un mot amputé donne l'air d'un bogue, pas d'un extrait. */
  it("recule jusqu'à la dernière espace", () => {
    const text = "abcdefgh ijklmnop qrstuvwx yzabcdef";
    const cut = shorten(text, 20);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(21);
    /* Aucun mot n'est coupé en deux : ce qui reste avant l'ellipse est
       une suite de mots entiers du texte d'origine. */
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1).endsWith("p")).toBe(true);
  });

  /* Un seul mot très long n'a pas d'espace où reculer : il faut bien
     s'arrêter quelque part. */
  it("tranche quand même un mot interminable", () => {
    const cut = shorten("a".repeat(300), 20);
    expect(cut).toHaveLength(21);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("écrase les blancs et les retours à la ligne", () => {
    expect(shorten("  deux\n\nlignes   collées  ")).toBe("deux lignes collées");
  });
});

describe("ce qu'une fiche donne à voir", () => {
  it("assemble l'année et le cinéaste", () => {
    expect(cardFacts(film({})).line).toBe("1979 · Andreï Tarkovski");
  });

  /* « 1979 · » tout seul est une coquille à l'écran de quelqu'un. */
  it("ne laisse pas un séparateur orphelin", () => {
    expect(cardFacts(film({ director: "" })).line).toBe("1979");
    expect(cardFacts(film({ year: null as never })).line).toBe("Andreï Tarkovski");
    expect(cardFacts(film({ year: null as never, director: "  " })).line).toBe("");
  });

  it("ne rend une note que s'il y en a une", () => {
    expect(cardFacts(film({ rating: 0 })).rating).toBeNull();
    expect(cardFacts(film({ rating: 4.5 })).rating).toBe(4.5);
  });

  it("coupe la critique", () => {
    const long = "mot ".repeat(200);
    expect(cardFacts(film({ review: long })).excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX + 1);
    expect(cardFacts(film({ review: "" })).excerpt).toBe("");
  });

  /* CE QUI N'Y FIGURE PAS EST LA MOITIÉ DU SUJET. Une carte partagée dit
     un avis ; les séances, les dates et les notes privées sont des
     habitudes, et une habitude publiée ne se reprend pas. */
  it("n'emporte ni séances, ni notes privées", () => {
    const facts = cardFacts(
      film({
        review: "une critique",
        notes: "SECRET à ne pas publier",
        watches: [{ date: "2024-01-02" }],
      } as never)
    );
    const printed = JSON.stringify(facts);
    expect(printed).not.toContain("SECRET");
    expect(printed).not.toContain("2024-01-02");
  });
});
