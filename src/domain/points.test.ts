import { describe, it, expect } from "vitest";
import { RATE, priceGap, totalOf, worthOfChallenge } from "./points";

/* ============================================================
   LE BARÈME, CÔTÉ CLASSEUR

   Il n'écrit rien : le serveur tient le journal, et aucune route ne
   prend un montant en entrée. Ces fonctions servent à ANNONCER — ce que
   vaut un défi qu'on n'a pas fini, ce qui manque devant un article trop
   cher.

   Le dernier test compare la table à celle du serveur, fichier à
   fichier. C'est le seul garde-fou du doublon, et il est là parce qu'un
   barème qui diverge ne casse rien : il ment, ce qui est pire.
   ============================================================ */

describe("ce que vaut un défi en cours", () => {
  it("paie la totalité, la moitié, ou rien", () => {
    expect(worthOfChallenge(4, 4)).toBe(RATE.challenge);
    expect(worthOfChallenge(2, 4)).toBe(RATE.challenge_half);
    expect(worthOfChallenge(1, 4)).toBe(0);
  });

  it("ne paie rien pour une liste vide", () => {
    /* Tout le monde a « fini » une liste de zéro film, et c'eût été le
       mérite le moins cher du marché. */
    expect(worthOfChallenge(0, 0)).toBe(0);
  });

  it("paie la totalité à qui a vu plus que la liste ne contient", () => {
    expect(worthOfChallenge(6, 4)).toBe(RATE.challenge);
  });
});

describe("ce qui manque", () => {
  it("dit le manque, et zéro quand il n'y en a pas", () => {
    expect(priceGap(40, 28)).toBe(12);
    expect(priceGap(40, 40)).toBe(0);
    /* Jamais négatif : c'est ce zéro qui décide si le bouton achète ou
       s'il nomme le manque, et un nombre négatif l'aurait rendu muet. */
    expect(priceGap(40, 90)).toBe(0);
  });
});

describe("le total des gains", () => {
  it("additionne ce que le fronton fait défiler", () => {
    expect(
      totalOf([
        { kind: "quiz", amount: 18 },
        { kind: "quiz_flawless", amount: 15 },
      ])
    ).toBe(33);
    expect(totalOf([])).toBe(0);
  });
});

describe("la copie du barème", () => {
  it("dit la même chose que celle du serveur", async () => {
    /* LE SEUL GARDE-FOU DU DOUBLON. Le serveur est l'original ; celui-ci
       n'existe que pour afficher un chiffre sans aller-retour réseau.
       Une divergence ne casserait rien — elle mentirait, et personne ne
       s'en apercevrait avant de compter à la main. */
    const server = await import("../../server/src/points");
    expect(RATE).toEqual(server.RATE);
  });
});
