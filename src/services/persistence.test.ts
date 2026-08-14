import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { vaultState, keepTheVault, alreadyAsked, forgetAsking } from "./persistence";

/* Ce qui se teste ici, c'est QUAND on se tait. La demande elle-même tient
   en une ligne ; ce qui peut coûter un classeur, c'est de la poser au
   mauvais moment, de la reposer après un refus, ou de la laisser jeter
   sur le chemin d'un import réussi. */

/** Un `navigator.storage` de complaisance, avec les deux réponses au choix. */
const setStorage = (storage: unknown) => {
  vi.stubGlobal("navigator", storage === null ? {} : { storage });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("l'état du coffre", () => {
  it("dit `kept` quand le navigateur a déjà accordé la persistance", async () => {
    setStorage({ persisted: async () => true });
    expect(await vaultState()).toBe("kept");
  });

  it("dit `fragile` quand elle n'est pas accordée", async () => {
    setStorage({ persisted: async () => false });
    expect(await vaultState()).toBe("fragile");
  });

  /* LE POINT DE LA DISTINCTION. Un navigateur sans l'API n'est pas un
     navigateur qui va effacer : c'est un navigateur qui ne sait pas le
     dire. Rendre `fragile` ici afficherait une alarme inventée à
     quelqu'un dont le classeur ne risque peut-être rien. */
  it("dit `unknown`, et pas `fragile`, quand l'API manque", async () => {
    setStorage(null);
    expect(await vaultState()).toBe("unknown");
    setStorage({});
    expect(await vaultState()).toBe("unknown");
  });

  it("dit `unknown` plutôt que de propager une erreur du navigateur", async () => {
    setStorage({
      persisted: async () => {
        throw new Error("refus");
      },
    });
    expect(await vaultState()).toBe("unknown");
  });
});

describe("la demande", () => {
  it("accorde, et le dit", async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persisted: async () => false, persist });
    expect(await keepTheVault()).toBe("kept");
    expect(persist).toHaveBeenCalledOnce();
  });

  /* Chrome accorde souvent tout seul. Redemander n'ajouterait qu'une
     invite là où il n'y a plus de question. */
  it("ne demande rien quand c'est déjà accordé", async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persisted: async () => true, persist });
    expect(await keepTheVault()).toBe("kept");
    expect(persist).not.toHaveBeenCalled();
  });

  /* CELUI-CI EST LE PLUS IMPORTANT. Firefox présente `persist()` comme
     une permission ; une invite qui revient à chaque import est une
     invite qu'on apprend à refuser sans lire. */
  it("ne repose jamais la question d'elle-même après un refus", async () => {
    const persist = vi.fn(async () => false);
    setStorage({ persisted: async () => false, persist });

    expect(await keepTheVault()).toBe("fragile");
    expect(alreadyAsked()).toBe(true);

    expect(await keepTheVault()).toBe("fragile");
    expect(persist).toHaveBeenCalledOnce();
  });

  /* Mais quand la demande vient de la personne — un bouton « protéger
     mon classeur » — le drapeau n'a rien à dire. */
  it("redemande sur `force`, parce que la question vient d'en face", async () => {
    const persist = vi.fn(async () => true);
    setStorage({ persisted: async () => false, persist });

    localStorage.setItem("storage-persistence-asked", "1");
    expect(await keepTheVault({ force: true })).toBe("kept");
    expect(persist).toHaveBeenCalledOnce();
  });

  /* Appelé sur le chemin d'un import réussi : une promesse rompue ici
     ferait passer la réussite pour un échec. */
  it("ne jette pas quand `persist` échoue", async () => {
    setStorage({
      persisted: async () => false,
      persist: async () => {
        throw new Error("non");
      },
    });
    await expect(keepTheVault()).resolves.toBe("fragile");
  });

  it("ne pose pas le drapeau quand il n'y avait rien à demander", async () => {
    setStorage({ persisted: async () => true, persist: async () => true });
    await keepTheVault();
    expect(alreadyAsked()).toBe(false);
  });

  it("s'oublie sur demande", async () => {
    setStorage({ persisted: async () => false, persist: async () => false });
    await keepTheVault();
    expect(alreadyAsked()).toBe(true);
    forgetAsking();
    expect(alreadyAsked()).toBe(false);
  });
});
