import { describe, it, expect } from "vitest";
import { readPlace, placeToHash, placeToPage, samePlace, HOME } from "./address";
import { readAddress } from "../views/SharedCollectionView";

/* ============================================================
   Ce qui se teste ici, c'est la COHABITATION autant que la lecture.

   Le classeur a maintenant deux lecteurs d'adresse sur la même page :
   celui-ci et celui des collections partagées. Chacun doit rendre `null`
   sur ce qui appartient à l'autre, sans quoi coller un lien reçu dans un
   classeur ouvert ferait quelque chose d'imprévisible — ce qui est
   précisément le bogue que `main.jsx` a déjà eu une fois.
   ============================================================ */

describe("l'adresse d'une vue", () => {
  it("fait l'aller-retour sur chaque vue", () => {
    for (const view of [
      "library",
      "watchlist",
      "credits",
      "reco",
      "constellation",
      "almanac",
      "thread",
      "lists",
      "quiz",
      "counter",
      "import",
      "skinlab",
    ] as const) {
      expect(readPlace(placeToHash({ view }))).toEqual({ view });
    }
  });

  it("porte l'identifiant d'une fiche", () => {
    expect(placeToHash({ view: "detail", film: "abc-123" })).toBe("#/fiche/abc-123");
    expect(readPlace("#/fiche/abc-123")).toEqual({ view: "detail", film: "abc-123" });
  });

  /* Une fiche sans identifiant n'est pas une adresse. Mieux vaut rendre
     le mur qu'un `#/fiche/undefined` que personne ne saurait relire. */
  it("retombe sur l'accueil pour une fiche sans identifiant", () => {
    expect(readPlace(placeToHash({ view: "detail" }))).toEqual({ view: HOME });
  });

  it("ne donne pas deux vues le même mot", () => {
    const views = [
      "library",
      "watchlist",
      "credits",
      "reco",
      "constellation",
      "almanac",
      "thread",
      "lists",
      "quiz",
      "counter",
      "import",
      "skinlab",
    ] as const;
    const hashes = views.map((view) => placeToHash({ view }));
    expect(new Set(hashes).size).toBe(views.length);
  });
});

describe("ce qui n'est pas à nous", () => {
  /* LA GARANTIE QUI COMPTE. `#/chez/varda` appartient à l'autre lecteur,
     et `main.jsx` recharge la page dessus. Si celui-ci le revendiquait,
     un lien reçu ouvrirait une vue du classeur au lieu de la collection
     de quelqu'un. */
  it("laisse les collections partagées à leur lecteur", () => {
    for (const shared of ["#/chez/varda", "#/chez/varda?jeton=abc"]) {
      expect(readPlace(shared)).toBeNull();
      expect(readAddress(shared)).not.toBeNull();
    }
  });

  /* Et l'inverse, qui est la moitié qu'on oublie : nos adresses ne
     doivent pas ressembler à une collection partagée. */
  it("et le lecteur des collections partagées laisse les nôtres", () => {
    expect(readAddress(placeToHash({ view: "library" }))).toBeNull();
    expect(readAddress(placeToHash({ view: "detail", film: "abc" }))).toBeNull();
  });

  it("rend `null` sur une adresse vide ou inconnue", () => {
    for (const nothing of ["", "#", "#/", "#/inventé", "#/mur/en-trop", "/mur"]) {
      expect(readPlace(nothing), nothing).toBeNull();
    }
  });

  /* Ce qui vient de la barre d'adresse est une entrée comme une autre. */
  it("refuse un identifiant de fiche qui n'en a pas la forme", () => {
    for (const bad of ["#/fiche/", "#/fiche/a b", "#/fiche/a.b", `#/fiche/${"x".repeat(65)}`]) {
      expect(readPlace(bad), bad).toBeNull();
    }
  });
});

/* ============================================================
   CELUI-CI EST LE TEST QUI PROTÈGE QUELQU'UN.

   L'adresse affichée porte l'identifiant du film ; celle qu'on rapporte
   ne doit jamais le porter. Une régression ici ne se verrait sur aucun
   écran — elle se verrait dans le tableau de bord de la mesure, sous la
   forme de la collection de chaque personne, une ligne par film.
   ============================================================ */
describe("l'adresse qu'on rapporte", () => {
  it("ne fait jamais sortir l'identifiant d'une fiche", () => {
    expect(placeToPage({ view: "detail", film: "demo-mood" })).toBe("#/fiche");
    expect(placeToPage({ view: "detail", film: "tt0118694" })).toBe("#/fiche");
    for (const film of ["a", "un-titre-tres-personnel", "42"]) {
      expect(placeToPage({ view: "detail", film })).not.toContain(film);
    }
  });

  it("laisse les autres vues telles quelles — elles ne disent rien de personne", () => {
    for (const view of ["library", "watchlist", "quiz", "counter"] as const) {
      expect(placeToPage({ view })).toBe(placeToHash({ view }));
    }
  });
});

describe("comparer deux endroits", () => {
  it("distingue deux fiches, et confond une vue avec elle-même", () => {
    expect(samePlace({ view: "library" }, { view: "library" })).toBe(true);
    expect(samePlace({ view: "detail", film: "a" }, { view: "detail", film: "b" })).toBe(false);
    expect(samePlace({ view: "detail", film: "a" }, { view: "detail", film: "a" })).toBe(true);
    expect(samePlace(null, { view: "library" })).toBe(false);
  });
});
