import { describe, it, expect } from "vitest";
import { CHALLENGE_HALF, RATE, priceGap, tierOf, totalOf, worthOfChallenge } from "./points";

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

describe("le mot de la fin d'une partie", () => {
  it("ne félicite pour un sans-faute qu'au score plein", () => {
    /* C'EST LA CONDITION EXACTE DE `quiz_flawless`, et pas une de plus.
       Le serveur exige `score === weight` pour payer les quinze points ;
       un écran qui tamponnerait « sans faute » à dix-neuf sur vingt
       promettrait un gain qui n'est jamais tombé. */
    expect(tierOf(20, 20)).toBe("perfect");
    expect(tierOf(19, 20)).toBe("held");
  });

  it("passe à la moitié sur le seuil qui existait déjà", () => {
    /* `CHALLENGE_HALF` est la part en dessous de laquelle un défi ne
       paie rien. Reprendre ce seuil plutôt que d'en inventer un évite
       qu'un écran continue de féliciter sur l'ancien le jour où il
       bouge — c'est pour cela que le test le lit au lieu de l'écrire. */
    expect(tierOf(10, 20)).toBe("held");
    expect(tierOf(CHALLENGE_HALF * 20 - 1, 20)).toBe("half");
  });

  it("ne dit « une autre fois » qu'à zéro", () => {
    /* Un seul point trouvé sur vingt reste quelque chose qu'on a fait.
       Le palier le plus dur est réservé à la copie blanche. */
    expect(tierOf(1, 20)).toBe("half");
    expect(tierOf(0, 20)).toBe("missed");
  });

  it("ne divise pas par un quizz sans question", () => {
    /* Un tirage qui n'a rien ramené — banque vide, catégories sans
       stock — donne un poids nul. Ni félicitation ni punition : les deux
       seraient fausses, et une division par zéro rendrait `NaN`, donc
       aucun palier du tout. */
    expect(tierOf(0, 0)).toBe("half");
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
