import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  forgetOwned,
  ownedItems,
  rememberOwned,
  watchWorn,
  wornPaper,
  wornSkin,
  wornTitle,
} from "./owned";

/* ============================================================
   CE QU'ON PORTE, ET QUI PRÉVIENT QUAND ÇA CHANGE

   LE DÉFAUT QUE CE FICHIER GARDE FERMÉ : il fallait recharger la page
   pour voir le papier qu'on venait de porter. La mémoire locale n'a pas
   d'événement pour l'onglet QUI ÉCRIT — `storage` ne se déclenche que
   dans les autres — donc l'écran ne relisait qu'au retour de focus de la
   fenêtre. Or on porte un papier depuis le comptoir, sans jamais quitter
   l'onglet : le cas n'arrivait littéralement jamais.

   C'est un défaut qui ne casse aucun test d'affichage et qu'aucun type ne
   voit. La seule façon de le tenir est d'éprouver l'ABONNEMENT.
   ============================================================ */

beforeEach(() => {
  localStorage.clear();
});

describe("ce qu'on porte", () => {
  it("retient les quatre, et les rend séparément", () => {
    rememberOwned(["skin-sepia", "paper-verge"], {
      skin: "sepia",
      paper: "paper-verge",
      title: "title-doyen",
    });
    expect(ownedItems()).toEqual(["skin-sepia", "paper-verge"]);
    expect(wornSkin()).toBe("sepia");
    expect(wornPaper()).toBe("paper-verge");
    expect(wornTitle()).toBe("title-doyen");
  });

  /* L'ANCIENNE SIGNATURE PASSAIT LA PEAU SEULE, et quelques appelants le
     font encore. La casser aurait obligé à corriger des endroits qui
     n'ont rien à voir avec les papiers. */
  it("accepte encore la peau seule", () => {
    rememberOwned(["skin-japon"], "japon");
    expect(wornSkin()).toBe("japon");
    expect(wornPaper()).toBeNull();
  });

  it("efface ce qui n'est plus porté au lieu de le garder", () => {
    rememberOwned([], { paper: "paper-verge" });
    expect(wornPaper()).toBe("paper-verge");
    rememberOwned([], { paper: null });
    expect(wornPaper()).toBeNull();
  });
});

describe("l'abonnement", () => {
  it("prévient à chaque changement de tenue", () => {
    const seen = vi.fn();
    watchWorn(seen);
    rememberOwned([], { paper: "paper-verge" });
    expect(seen).toHaveBeenCalledTimes(1);
    rememberOwned([], { paper: "paper-calque" });
    expect(seen).toHaveBeenCalledTimes(2);
  });

  /* CE QUE LIT L'ABONNÉ EST DÉJÀ À JOUR QUAND ON LE PRÉVIENT. Prévenir
     avant d'écrire aurait fait redessiner la page avec l'ancien papier —
     un rendu de retard, c'est-à-dire exactement le défaut qu'on répare,
     mais plus difficile à voir. */
  it("a déjà écrit quand il prévient", () => {
    let atCall: string | null = "pas appelé";
    watchWorn(() => {
      atCall = wornPaper();
    });
    rememberOwned([], { paper: "paper-ondule" });
    expect(atCall).toBe("paper-ondule");
  });

  it("prévient aussi quand un compte se ferme", () => {
    const seen = vi.fn();
    rememberOwned([], { paper: "paper-verge" });
    watchWorn(seen);
    forgetOwned();
    expect(seen).toHaveBeenCalled();
    expect(wornPaper()).toBeNull();
  });

  it("se désabonne pour de bon", () => {
    const seen = vi.fn();
    const stop = watchWorn(seen);
    stop();
    rememberOwned([], { paper: "paper-verge" });
    expect(seen).not.toHaveBeenCalled();
  });

  /* UN ABONNÉ QUI LÈVE NE DOIT PAS EMPÊCHER LES AUTRES D'ÊTRE PRÉVENUS,
     ni figer la page sur l'ancien papier. */
  it("prévient tout le monde même si l'un des abonnés tombe", () => {
    const second = vi.fn();
    watchWorn(() => {
      throw new Error("un abonné maladroit");
    });
    watchWorn(second);
    expect(() => rememberOwned([], { paper: "paper-verge" })).not.toThrow();
    expect(second).toHaveBeenCalled();
  });
});
