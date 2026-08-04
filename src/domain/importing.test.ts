import { describe, it, expect } from "vitest";
import { slugOf, filmKey, parseRating, diffImport } from "./importing";
import { makeFilm } from "./film";
import type { Film, ImportRow } from "../types";

const row = (partial: Partial<ImportRow> = {}): ImportRow => ({
  title: "Un film",
  year: 1975,
  rating: null,
  watchedAt: null,
  uri: null,
  ...partial,
});

describe("slugOf", () => {
  it("neutralise casse, accents et ponctuation", () => {
    expect(slugOf("Le Samouraï")).toBe(slugOf("le samourai"));
    expect(slugOf("WALL·E")).toBe("walle");
  });

  it("neutralise l'article initial", () => {
    expect(slugOf("The Godfather")).toBe(slugOf("Godfather"));
    expect(slugOf("La Jetée")).toBe(slugOf("Jetée"));
    expect(slugOf("Le Samouraï")).toBe(slugOf("Samourai"));
  });

  /* BUG CONNU, comportement figé volontairement.

     Dans `^(le|la|les|the|a|an|l')`, l'alternance est ordonnée et n'exige pas
     de limite de mot. Deux conséquences :

     - « Les » matche `le` en premier et laisse un « s » orphelin ;
     - `a` précède `l'` et n'est suivi d'aucun `\b`, donc TOUT titre commençant
       par un « a » perd sa première lettre (« Alien » → « lien »).

     L'appariement reste cohérent tant que les deux côtés passent par `slugOf` :
     c'est seulement face à une variante sans article (« L'Avventura » contre
     « Avventura ») que la clé diverge.

     Corriger la regex changerait la clé de toutes les fiches déjà enregistrées
     concernées : au réimport suivant, elles ne s'apparieraient plus et seraient
     recréées en double. La correction demande donc une migration des données,
     pas seulement un « les|le » et un `\b`. Le test fixe l'existant pour qu'une
     correction future soit un choix visible. */
  it("mange une lettre de trop sur « Les » et sur les titres en « a » — écart assumé", () => {
    expect(slugOf("Les Diaboliques")).toBe("sdiaboliques");
    expect(slugOf("Alien")).toBe("lien");
    expect(slugOf("L'Avventura")).not.toBe(slugOf("Avventura"));

    // l'appariement reste bon tant que les deux côtés s'écrivent pareil
    expect(slugOf("Les Diaboliques")).toBe(slugOf("les diaboliques"));
    expect(slugOf("Alien")).toBe(slugOf("ALIEN"));
  });

  it("ne retire l'article qu'en tête", () => {
    // « la » au milieu ne doit pas disparaître, sinon des titres distincts fusionnent
    expect(slugOf("Fanny et Alexandre")).toBe("fannyetalexandre");
  });

  it("accepte l'absence de titre sans lever", () => {
    expect(slugOf()).toBe("");
    expect(slugOf("")).toBe("");
  });
});

describe("filmKey", () => {
  it("apparie deux orthographes du même film sorti la même année", () => {
    expect(filmKey({ title: "Le Samouraï", year: 1967 })).toBe(
      filmKey({ title: "Le Samourai", year: 1967 })
    );
  });

  it("sépare deux films de même titre mais d'années différentes", () => {
    // les remakes ne doivent pas écraser l'original
    expect(filmKey({ title: "Psycho", year: 1960 })).not.toBe(
      filmKey({ title: "Psycho", year: 1998 })
    );
  });

  it("traite l'année absente comme une valeur à part entière", () => {
    expect(filmKey({ title: "Psycho" })).toBe("psycho|");
  });
});

describe("parseRating", () => {
  it("distingue « non noté » de la note zéro", () => {
    // c'est la nuance qui décide si un réimport écrase une note existante
    expect(parseRating(null)).toBeNull();
    expect(parseRating("")).toBeNull();
    expect(parseRating("   ")).toBeNull();
    expect(parseRating(0)).toBe(0);
  });

  it("accepte la virgule décimale", () => {
    expect(parseRating("3,5")).toBe(3.5);
  });

  it("arrondit au demi-point", () => {
    expect(parseRating(3.7)).toBe(3.5);
    expect(parseRating(3.8)).toBe(4);
  });

  it("borne entre 0 et 5", () => {
    expect(parseRating(9)).toBe(5);
    expect(parseRating(-2)).toBe(0);
  });

  it("rejette ce qui n'est pas un nombre", () => {
    expect(parseRating("abc")).toBeNull();
    expect(parseRating(NaN)).toBeNull();
  });
});

describe("diffImport", () => {
  it("crée les films absents de la vidéothèque", () => {
    const { toCreate, toUpdate, unchanged } = diffImport(
      [],
      [row({ title: "Stalker", year: 1979, rating: 4.5 })],
      "watched"
    );
    expect(toUpdate).toHaveLength(0);
    expect(unchanged).toHaveLength(0);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toMatchObject({
      title: "Stalker",
      rating: 4.5,
      status: "watched",
      source: "letterboxd",
    });
  });

  /* Le test qui compte : la promesse faite à l'utilisateur est qu'un réimport
     ne détruit jamais ce qu'il a écrit à la main. */
  it("ne touche jamais au travail écrit à la main", () => {
    const existing: Film = makeFilm({
      title: "Stalker",
      year: 1979,
      rating: 4,
      review: "Une critique longuement écrite",
      notes: "des fragments",
      themes: ["Mémoire", "Zone"],
      linkedWorks: [
        { id: "w1", type: "book", title: "Pique-nique", creator: "Strougatski", note: "" },
      ],
    });

    const { toUpdate } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, rating: 5 })],
      "watched"
    );

    expect(toUpdate).toHaveLength(1);
    // seule la note change ; rien d'autre n'est proposé à l'écriture
    expect(toUpdate[0]!.changes).toEqual({ rating: 5 });
  });

  it("complète un champ vide sans écraser un champ rempli", () => {
    const existing = makeFilm({
      title: "Stalker",
      year: 1979,
      director: "A. Tarkovski",
      poster: "mon-affiche.jpg",
    });

    const { toUpdate } = diffImport(
      [existing],
      [
        row({
          title: "Stalker",
          year: 1979,
          director: "Andrei Tarkovsky",
          poster: "tmdb.jpg",
          genres: ["Science-fiction"],
        }),
      ],
      "watched"
    );

    const changes = toUpdate[0]!.changes;
    // le réalisateur et l'affiche étaient déjà renseignés : on n'y touche pas
    expect(changes.director).toBeUndefined();
    expect(changes.poster).toBeUndefined();
    // les genres manquaient : on les accepte
    expect(changes.genres).toEqual(["Science-fiction"]);
  });

  it("apparie par tmdbId en priorité, même si le titre a changé", () => {
    const existing = makeFilm({ title: "Ancien titre", year: 1979, tmdbId: 1234 });
    const { toCreate, toUpdate } = diffImport(
      [existing],
      [row({ title: "Titre localisé tout autre", year: 1979, tmdbId: 1234, rating: 5 })],
      "watched"
    );
    expect(toCreate).toHaveLength(0);
    expect(toUpdate[0]!.film.id).toBe(existing.id);
  });

  it("fait avancer la date de séance, jamais reculer", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, watchedAt: "2024-01-01" });

    const plusRecent = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, watchedAt: "2025-06-01" })],
      "watched"
    );
    expect(plusRecent.toUpdate[0]!.changes.watchedAt).toBe("2025-06-01");

    // un ratings.csv importé après un diary ne doit pas ramener une date ancienne
    const plusAncien = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, watchedAt: "2023-01-01" })],
      "watched"
    );
    expect(plusAncien.unchanged).toHaveLength(1);
  });

  it("fait passer « à voir » en « vu » quand le film apparaît dans un export de films vus", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, status: "watchlist" });
    const { toUpdate } = diffImport([existing], [row({ title: "Stalker", year: 1979 })], "watched");
    expect(toUpdate[0]!.changes.status).toBe("watched");
  });

  it("ne repasse pas un film vu en « à voir » lors d'un import de watchlist", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, status: "watched" });
    const { unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979 })],
      "watchlist"
    );
    expect(unchanged).toHaveLength(1);
  });

  it("range en « inchangé » ce qui n'apporte rien", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, rating: 4 });
    const { toCreate, toUpdate, unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, rating: 4 })],
      "watched"
    );
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
    expect(unchanged).toHaveLength(1);
  });

  it("n'écrase pas une note existante quand le CSV n'en porte pas", () => {
    const existing = makeFilm({ title: "Stalker", year: 1979, rating: 4.5 });
    const { unchanged } = diffImport(
      [existing],
      [row({ title: "Stalker", year: 1979, rating: null })],
      "watched"
    );
    expect(unchanged).toHaveLength(1);
  });
});
