import { describe, it, expect } from "vitest";
import { chercherPartout, extraitAutour, parGenres } from "./partout";
import { makeFilm } from "./film";
import { makeFil } from "./fils";
import type { Film, Note } from "../types";

const film = (title: string, extra: Partial<Film> = {}) => makeFilm({ title, ...extra });

const page = (title: string, body: string, createdAt = 1_700_000_000_000): Note => ({
  id: `n-${title}`,
  title,
  body,
  createdAt,
});

const fonds = (o: { films?: Film[]; notes?: Note[]; fils?: ReturnType<typeof makeFil>[] } = {}) => ({
  films: o.films || [],
  notes: o.notes || [],
  fils: o.fils || [],
});

const genres = (t: ReturnType<typeof chercherPartout>) => [...new Set(t.map((x) => x.genre))];

describe("ce qui déclenche une recherche", () => {
  it("ne cherche pas sur une lettre seule", () => {
    // une lettre répondrait à tout : ce n'est pas une question
    expect(chercherPartout("a", fonds({ films: [film("Amarcord")] }))).toEqual([]);
  });

  it("ne cherche pas sur du vide", () => {
    expect(chercherPartout("   ", fonds({ films: [film("Amarcord")] }))).toEqual([]);
  });
});

describe("les films", () => {
  it("trouve par le titre", () => {
    const t = chercherPartout("amar", fonds({ films: [film("Amarcord")] }));
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ genre: "film", titre: "Amarcord" });
  });

  it("trouve enfin par un mot de la CRITIQUE", () => {
    /* La visite promettait « un mot de vos notes » depuis le début, et
       c'était le seul champ sur lequel on ne cherchait pas. */
    const f = film("Un film", { review: "la scène du train m'a bouleversé" });
    const t = chercherPartout("bouleversé", fonds({ films: [f] }));
    expect(t.map((x) => x.titre)).toEqual(["Un film"]);
  });

  it("trouve par un mot des notes libres", () => {
    const f = film("Un film", { notes: "vu en salle, copie neuve" });
    expect(chercherPartout("copie", fonds({ films: [f] }))).toHaveLength(1);
  });

  it("place le titre avant la critique", () => {
    const films = [
      film("Quelqu'un cite Solaris", { review: "" }),
      film("Solaris", { review: "" }),
    ];
    expect(chercherPartout("solaris", fonds({ films }))[0]!.titre).toBe("Solaris");
  });

  it("ne répond pas « img » à toute fiche illustrée", () => {
    // les captures s'écrivent [img:3] dans le texte : ce ne sont pas des mots
    const f = film("Illustré", { review: "une image forte [img:3] puis la nuit" });
    expect(chercherPartout("img", fonds({ films: [f] }))).toEqual([]);
  });

  it("rapporte le passage où le mot se trouve", () => {
    const f = film("Un film", { review: "le plan final est une gifle, et je n'y étais pas prêt" });
    const t = chercherPartout("gifle", fonds({ films: [f] }));
    expect(t[0]!.extrait).toContain("gifle");
  });
});

describe("les pages du carnet", () => {
  it("trouve par le titre d'une page", () => {
    const t = chercherPartout("liste", fonds({ notes: [page("Ma liste", "rien")] }));
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ genre: "page", titre: "Ma liste" });
  });

  it("trouve par le corps, et en rapporte le passage", () => {
    const t = chercherPartout("Rohmer", fonds({ notes: [page("Notes", "revoir du Rohmer cet été")] }));
    expect(t[0]!.extrait).toContain("Rohmer");
  });

  it("nomme une page sans titre plutôt que de rendre une ligne vide", () => {
    const t = chercherPartout("chose", fonds({ notes: [page("", "une chose")] }));
    expect(t[0]!.titre).toBe("Sans titre");
  });
});

describe("les motifs", () => {
  it("trouve un motif du catalogue et dit combien de fiches le portent", () => {
    const films = [film("A", { motifs: ["melancolie"] }), film("B", { motifs: ["melancolie"] })];
    const t = chercherPartout("mélanco", fonds({ films }));
    const m = t.find((x) => x.genre === "motif");
    expect(m).toMatchObject({ titre: "Mélancolie", sous: "2 fiches le portent", motifId: "melancolie" });
  });

  it("dit franchement qu'un motif n'est posé nulle part", () => {
    const m = chercherPartout("mélanco", fonds()).find((x) => x.genre === "motif");
    expect(m!.sous).toBe("sur aucune fiche");
  });
});

describe("les fils", () => {
  it("trouve un fil par son nom", () => {
    const fil = makeFil({ label: "Les fins tristes", motif: null });
    const t = chercherPartout("tristes", fonds({ fils: [fil] }));
    expect(t.find((x) => x.genre === "fil")).toMatchObject({ titre: "Les fins tristes" });
  });

  it("trouve un fil par ce qu'on a écrit dessous", () => {
    const fil = makeFil({ label: "Un fil", note: "tout ce qui parle de deuil" });
    const t = chercherPartout("deuil", fonds({ fils: [fil] }));
    const f = t.find((x) => x.genre === "fil");
    expect(f).toBeDefined();
    expect(f!.extrait).toContain("deuil");
  });
});

describe("les gens", () => {
  it("trouve quelqu'un du générique, malgré les accents", () => {
    const films = [film("A", { crew: { image: ["Henri Decaë"] } })];
    const t = chercherPartout("decae", fonds({ films }));
    expect(t.find((x) => x.genre === "personne")).toMatchObject({
      titre: "Henri Decaë",
      personne: "henri decae",
    });
  });

  it("dit à quel titre et sur combien de films", () => {
    const films = [film("A", { director: "Ozu" }), film("B", { director: "Ozu" })];
    const p = chercherPartout("ozu", fonds({ films })).find((x) => x.genre === "personne");
    expect(p!.sous).toBe("2 films · réalisation");
  });
});

describe("la traversée", () => {
  it("montre plusieurs natures d'un coup", () => {
    const films = [film("Mélancolie du départ", { motifs: ["melancolie"], director: "Mélanie Ozu" })];
    const notes = [page("Mélancolie", "une page")];
    const t = chercherPartout("mélanc", fonds({ films, notes }));
    expect(genres(t)).toEqual(expect.arrayContaining(["film", "page", "motif"]));
  });

  /* LE POINT DE TOUTE L'AFFAIRE : une nature n'en noie pas une autre.
     Sans bornage PAR GENRE, mille films enterreraient l'unique page de
     carnet qui répond, et l'on ne saurait jamais qu'elle existe. */
  it("ne laisse pas mille films enterrer une page de carnet", () => {
    const films = Array.from({ length: 500 }, (_, i) => film(`Nuit ${i}`));
    const notes = [page("Une nuit", "la nuit américaine")];
    const t = chercherPartout("nuit", fonds({ films, notes }), 5);
    expect(t.filter((x) => x.genre === "film")).toHaveLength(5);
    expect(t.filter((x) => x.genre === "page")).toHaveLength(1);
  });

  it("rend des clés distinctes, utilisables comme identité", () => {
    const films = [film("Mélancolie", { motifs: ["melancolie"] })];
    const clés = chercherPartout("mélanc", fonds({ films })).map((x) => x.clé);
    expect(new Set(clés).size).toBe(clés.length);
  });
});

describe("extraitAutour", () => {
  it("coupe autour du mot et marque les coupes", () => {
    const long = `${"a".repeat(200)} trouvaille ${"b".repeat(200)}`;
    const e = extraitAutour(long, "trouvaille")!;
    expect(e.startsWith("…")).toBe(true);
    expect(e.endsWith("…")).toBe(true);
    expect(e).toContain("trouvaille");
  });

  it("ne marque pas de coupe quand il n'y en a pas", () => {
    expect(extraitAutour("un texte court", "texte")).toBe("un texte court");
  });

  it("rend le passage AVEC ses accents, bien qu'on cherche sans", () => {
    expect(extraitAutour("une scène déchirante", "scene")).toContain("scène");
  });

  it("ne rend rien quand le mot n'y est pas", () => {
    expect(extraitAutour("un texte", "absent")).toBeUndefined();
  });
});

describe("parGenres", () => {
  it("range les natures dans un ordre stable et laisse tomber les vides", () => {
    const films = [film("Ozu vu", { director: "Ozu" })];
    const g = parGenres(chercherPartout("ozu", fonds({ films })));
    expect(g.map((x) => x.genre)).toEqual(["film", "personne"]);
  });
});
