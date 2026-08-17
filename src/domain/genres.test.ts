import { describe, it, expect } from "vitest";
import { canonicalGenre, canonicalGenres, genreKey } from "./genres";

/* ============================================================
   UNE SEULE ORTHOGRAPHE PAR GENRE

   Le défaut : « Science Fiction » et « Science-Fiction » se tenaient
   côte à côte dans le tamis comme deux genres. Aucune fiche ne portait
   les deux, donc cocher l'une cachait la moitié des films cherchés,
   sans rien dire.

   CE FICHIER GARDE SURTOUT CE QU'ON NE TOUCHE PAS. Rapprocher deux
   graphies est une chose ; renommer des genres que personne n'a demandé
   de renommer en est une autre, et c'est le risque de toute
   normalisation qui devine.
   ============================================================ */

describe("the spelling of a genre", () => {
  it("brings the two spellings of science fiction together", () => {
    expect(canonicalGenre("Science Fiction")).toBe("Science-Fiction");
    expect(canonicalGenre("Science-Fiction")).toBe("Science-Fiction");
    /* La casse et les accents ne font pas un genre de plus. */
    expect(canonicalGenre("science fiction")).toBe("Science-Fiction");
    expect(canonicalGenre("SCIENCE-FICTION")).toBe("Science-Fiction");
  });

  it("leaves alone every spelling it was not told about", () => {
    /* LA CLÉ RAPPROCHE, ELLE NE TRANCHE PAS. Sans cette retenue, la
       première graphie rencontrée renommerait toutes les autres — et
       l'ordre d'un import déciderait du nom des genres de quelqu'un. */
    for (const g of ["Thriller", "Drama", "Drame", "TV Movie", "Film-Noir", "Documentaire"]) {
      expect(canonicalGenre(g)).toBe(g);
    }
  });

  it("does not confuse two words with two spellings", () => {
    /* « Thriller » et « Suspense » désignent à peu près la même chose et
       ne sont PAS la même graphie : les fondre serait un avis, pas une
       normalisation. */
    expect(genreKey("Thriller")).not.toBe(genreKey("Suspense"));
  });

  it("trims, and drops what is left of an empty one", () => {
    expect(canonicalGenre("  Drame  ")).toBe("Drame");
    expect(canonicalGenres(["Drame", "", "   "])).toEqual(["Drame"]);
  });

  it("de-duplicates, which is half the work", () => {
    /* Une fiche réimportée pouvait tenir les deux graphies : les
       rapprocher sans dédoublonner lui aurait fait porter deux fois le
       même genre, et le tamis l'aurait comptée deux fois. */
    expect(canonicalGenres(["Science Fiction", "Drame", "Science-Fiction"])).toEqual([
      "Science-Fiction",
      "Drame",
    ]);
  });

  it("keeps the order it was given", () => {
    /* TMDB range les genres du plus au moins pertinent, et la fiche le
       montre dans cet ordre : le trier ici perdrait cette information
       sans que rien ne le dise. */
    expect(canonicalGenres(["Western", "Drame", "Science Fiction"])).toEqual([
      "Western",
      "Drame",
      "Science-Fiction",
    ]);
  });

  it("answers an empty list rather than nothing at all", () => {
    expect(canonicalGenres()).toEqual([]);
    expect(canonicalGenres([])).toEqual([]);
  });
});
