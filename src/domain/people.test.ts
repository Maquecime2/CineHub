import { describe, it, expect } from "vitest";
import { recenser, dossierDe, rôlesSurLeFilm, chercherPersonnes } from "./people";
import { makeFilm } from "./film";
import type { Film } from "../types";

const film = (title: string, partial: Partial<Film> = {}) => makeFilm({ title, ...partial });

const par = (gens: ReturnType<typeof recenser>, nom: string) => gens.find((p) => p.nom === nom);

describe("recenser", () => {
  it("ne rend rien d'une collection vide", () => {
    expect(recenser([])).toEqual([]);
  });

  it("réunit un même nom écrit à deux orthographes", () => {
    /* « Decae » tapé à la main et « Decaë » venu de TMDB sont le même
       chef opérateur : deux entrées en feraient deux inconnus. */
    const gens = recenser([
      film("Ascenseur", { crew: { image: ["Henri Decaë"] } }),
      film("Le Samouraï", { crew: { image: ["Henri Decae"] } }),
    ]);
    expect(gens).toHaveLength(1);
    expect(gens[0]!.films).toHaveLength(2);
  });

  it("garde l'orthographe la plus fréquente", () => {
    const gens = recenser([
      film("A", { crew: { image: ["Henri Decaë"] } }),
      film("B", { crew: { image: ["Henri Decaë"] } }),
      film("C", { crew: { image: ["henri decae"] } }),
    ]);
    expect(gens[0]!.nom).toBe("Henri Decaë");
  });

  it("porte plusieurs rôles sans se dédoubler", () => {
    const gens = recenser([
      film("Le Cercle rouge", {
        director: "Jean-Pierre Melville",
        crew: { scénario: ["Jean-Pierre Melville"] },
      }),
    ]);
    expect(gens).toHaveLength(1);
    expect(gens[0]!.rôles).toEqual(["réalisation", "scénario"]);
    // et le film ne compte qu'une fois, malgré les deux casquettes
    expect(gens[0]!.films).toHaveLength(1);
  });

  it("écarte les mots-clés, qui ne sont pas des gens", () => {
    const gens = recenser([film("Stalker", { themes: ["la pluie"], director: "Tarkovski" })]);
    expect(gens.map((p) => p.nom)).toEqual(["Tarkovski"]);
  });

  it("compte les vus, les à-voir et les séances", () => {
    const gens = recenser([
      film("A", {
        director: "Varda",
        status: "watched",
        watches: [
          { date: "2024-01-02", rating: 4 },
          { date: "2020-05-05", rating: 4 },
        ],
      }),
      film("B", { director: "Varda", status: "watchlist" }),
    ]);
    const varda = par(gens, "Varda")!;
    expect(varda.vus).toBe(1);
    expect(varda.àVoir).toBe(1);
    expect(varda.séances).toBe(2);
  });

  it("ne laisse pas un film non noté tirer la moyenne vers le bas", () => {
    /* Un zéro veut dire « pas noté » : le compter ferait passer pour
       tiède quelqu'un qu'on n'a simplement pas jugé. */
    const gens = recenser([
      film("A", { director: "Ozu", rating: 5 }),
      film("B", { director: "Ozu", rating: 0 }),
    ]);
    expect(par(gens, "Ozu")!.note).toBe(5);
  });

  it("laisse la note vide quand rien n'est noté", () => {
    expect(recenser([film("A", { director: "Ozu" })])[0]!.note).toBeNull();
  });
});

describe("l'écart à la note publique", () => {
  it("se mesure sur la même échelle", () => {
    // 4/5 vaut 8/10 : deux points au-dessus d'un public à 6
    const gens = recenser([film("A", { director: "Ozu", rating: 4, tmdbRating: 6 })]);
    expect(par(gens, "Ozu")!.écart).toBe(2);
  });

  it("reste vide sans note publique", () => {
    const gens = recenser([film("A", { director: "Ozu", rating: 4, tmdbRating: null })]);
    expect(par(gens, "Ozu")!.écart).toBeNull();
  });

  it("ignore les fiches où l'une des deux notes manque", () => {
    const gens = recenser([
      film("A", { director: "Ozu", rating: 4, tmdbRating: 6 }),
      film("B", { director: "Ozu", rating: 0, tmdbRating: 9 }),
    ]);
    expect(par(gens, "Ozu")!.écart).toBe(2);
  });
});

describe("la période et les motifs", () => {
  it("va du plus ancien au plus récent", () => {
    const gens = recenser([
      film("A", { director: "Ozu", year: 1953 }),
      film("B", { director: "Ozu", year: 1949 }),
      film("C", { director: "Ozu", year: "" }),
    ]);
    expect(par(gens, "Ozu")!.période).toEqual([1949, 1953]);
  });

  it("ne retient qu'un motif qui revient", () => {
    const gens = recenser([
      film("A", { director: "Ozu", motifs: ["train", "mer"] }),
      film("B", { director: "Ozu", motifs: ["train"] }),
    ]);
    expect(par(gens, "Ozu")!.motifs).toEqual(["train"]);
  });
});

describe("rôlesSurLeFilm", () => {
  it("dit à quels titres quelqu'un est là", () => {
    const f = film("Le Cercle rouge", {
      director: "Jean-Pierre Melville",
      crew: { scénario: ["Jean-Pierre Melville"], image: ["Henri Decaë"] },
    });
    expect(rôlesSurLeFilm(f, "jean-pierre melville")).toEqual(["réalisation", "scénario"]);
    expect(rôlesSurLeFilm(f, "henri decae")).toEqual(["image"]);
    expect(rôlesSurLeFilm(f, "personne")).toEqual([]);
  });
});

describe("chercherPersonnes", () => {
  const gens = recenser([
    film("A", { director: "Agnès Varda" }),
    film("B", { cast: ["Kenji Kurozu"] }),
    film("C", { director: "Yasujirō Ozu" }),
  ]);

  it("trouve malgré les accents", () => {
    expect(chercherPersonnes(gens, "agnes").map((p) => p.nom)).toEqual(["Agnès Varda"]);
  });

  it("trouve par le patronyme, qui n'ouvre pas le nom", () => {
    expect(chercherPersonnes(gens, "varda").map((p) => p.nom)).toEqual(["Agnès Varda"]);
  });

  it("place devant celui dont un MOT commence par ce qu'on tape", () => {
    // « ozu » doit rendre Ozu avant Kurozu, qui ne le contient qu'au milieu
    expect(chercherPersonnes(gens, "ozu").map((p) => p.nom)).toEqual([
      "Yasujirō Ozu",
      "Kenji Kurozu",
    ]);
  });

  it("rend tout le monde sur une recherche vide", () => {
    expect(chercherPersonnes(gens, "  ")).toHaveLength(3);
  });
});

describe("dossierDe", () => {
  it("rend null pour un inconnu", () => {
    expect(dossierDe([film("A", { director: "Ozu" })], "kurosawa")).toBeNull();
  });

  it("retrouve quelqu'un par sa clé normalisée", () => {
    expect(dossierDe([film("A", { director: "Agnès Varda" })], "agnes varda")?.nom).toBe(
      "Agnès Varda"
    );
  });
});
