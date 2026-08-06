import { describe, it, expect, afterEach } from "vitest";
import {
  MOTIFS,
  chercheMotifs,
  estMasqué,
  estPerso,
  idDepuisLabel,
  makeMotifPerso,
  motifById,
  motifsDe,
  parFamille,
  poserVocabulaire,
  suggestMotifs,
  tousLesMotifs,
} from "./motifs";
import { makeFilm } from "./film";

describe("le catalogue de motifs", () => {
  it("n'a pas deux fois la même clé", () => {
    const ids = MOTIFS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("porte bien la question qui a tout déclenché", () => {
    const m = motifById("heros-meurt");
    expect(m?.label).toBe("Le héros meurt");
    // et il raconte la fin : il doit se gratter à l'affichage
    expect(m?.spoiler).toBe(true);
  });

  it("range chaque motif dans une famille affichée", () => {
    const rangés = parFamille().flatMap((f) => f.motifs);
    expect(rangés).toHaveLength(MOTIFS.length);
  });

  it("ignore un motif inconnu plutôt que de le montrer", () => {
    const film = makeFilm({ motifs: ["heros-meurt", "motif-supprimé-depuis"] });
    expect(motifsDe(film).map((m) => m.id)).toEqual(["heros-meurt"]);
  });

  it("cherche sans casse", () => {
    expect(chercheMotifs("HÉROS").map((m) => m.id)).toContain("heros-meurt");
    expect(chercheMotifs("")).toEqual([]);
  });
});

describe("ce que TMDB propose", () => {
  it("reconnaît un mot-clé du catalogue, quelle que soit la casse", () => {
    const out = suggestMotifs([{ id: 1, name: "Time Loop" }]);
    expect(out.map((m) => m.id)).toEqual(["boucle-temporelle"]);
  });

  it("accepte aussi une simple liste de mots", () => {
    expect(suggestMotifs(["road movie"]).map((m) => m.id)).toContain("road-movie");
  });

  it("ne propose rien sur des mots-clés qu'il ne connaît pas", () => {
    expect(suggestMotifs([{ name: "woman director" }])).toEqual([]);
    expect(suggestMotifs([])).toEqual([]);
  });
});

describe("vos motifs à vous", () => {
  afterEach(() => poserVocabulaire({ perso: [], masqués: [] }));

  it("s'ajoutent au catalogue sans le remplacer", () => {
    const mien = makeMotifPerso("Il pleut sans arrêt", "monde");
    poserVocabulaire({ perso: [mien], masqués: [] });
    expect(motifById(mien.id)?.label).toBe("Il pleut sans arrêt");
    expect(motifById("heros-meurt")).toBeTruthy();
    expect(tousLesMotifs()).toHaveLength(MOTIFS.length + 1);
    expect(estPerso(mien.id)).toBe(true);
    expect(estPerso("heros-meurt")).toBe(false);
  });

  it("tirent leur identifiant du libellé, une fois pour toutes", () => {
    expect(idDepuisLabel("Il pleut, sans arrêt !")).toBe("il-pleut-sans-arret");
    // et n'écrasent jamais un identifiant déjà pris
    expect(idDepuisLabel("Le héros meurt", ["le-heros-meurt"])).toBe("le-heros-meurt-2");
  });

  it("se cherchent comme les autres", () => {
    const mien = makeMotifPerso("Il pleut sans arrêt", "monde");
    poserVocabulaire({ perso: [mien], masqués: [] });
    expect(chercheMotifs("pleut").map((m) => m.id)).toContain(mien.id);
  });
});

describe("les motifs écartés", () => {
  afterEach(() => poserVocabulaire({ perso: [], masqués: [] }));

  it("quittent la liste où l'on choisit", () => {
    poserVocabulaire({ perso: [], masqués: ["heros-meurt"] });
    expect(tousLesMotifs().some((m) => m.id === "heros-meurt")).toBe(false);
    expect(chercheMotifs("héros").some((m) => m.id === "heros-meurt")).toBe(false);
  });

  /* Masquer n'est pas effacer : une fiche qui le porte doit continuer de
     l'afficher, sans quoi écarter réécrirait les données en douce. */
  it("restent lisibles sur les fiches qui les portent", () => {
    poserVocabulaire({ perso: [], masqués: ["heros-meurt"] });
    expect(motifById("heros-meurt")?.label).toBe("Le héros meurt");
    expect(motifsDe(makeFilm({ motifs: ["heros-meurt"] }))).toHaveLength(1);
    expect(estMasqué("heros-meurt")).toBe(true);
  });
});
