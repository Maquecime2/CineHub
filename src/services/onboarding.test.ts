import { describe, it, expect, beforeEach } from "vitest";
import {
  HINT_MAX,
  bumpHint,
  isFirstRun,
  loadOnboarding,
  markDone,
  markSkipped,
  markSeeded,
  shouldSeed,
  resetOnboarding,
  shouldHint,
} from "./onboarding";
import { KEYS } from "./storage";

beforeEach(() => localStorage.clear());

describe("ce que le classeur retient de l'accueil", () => {
  it("part de rien : c'est une première ouverture", () => {
    expect(loadOnboarding()).toEqual({ done: [], skipped: false, hints: 0, seeded: false });
    expect(isFirstRun()).toBe(true);
  });

  it("n'inscrit pas deux fois la même visite", () => {
    markDone("global");
    markDone("global");
    expect(loadOnboarding().done).toEqual(["global"]);
  });

  it("ne rappelle rien tant que rien n'a été écarté", () => {
    expect(shouldHint()).toBe(false);
  });

  it("rappelle après un abandon, et se tait au bout de trois", () => {
    markSkipped();
    expect(shouldHint()).toBe(true);
    for (let i = 0; i < HINT_MAX; i++) bumpHint();
    expect(shouldHint()).toBe(false);
  });

  /* Le rappel ne sert qu'à retrouver une visite jamais faite : l'avoir
     menée à son terme après coup doit le faire taire, même si le
     compteur n'est pas au bout. */
  it("se tait dès que la visite complète a été faite", () => {
    markSkipped();
    markDone("global");
    expect(shouldHint()).toBe(false);
  });

  it("oublie tout sur demande", () => {
    markSkipped();
    markDone("library");
    resetOnboarding();
    expect(isFirstRun()).toBe(true);
  });

  /* Une valeur écrite par une version antérieure, ou par une main
     malheureuse, ne doit pas faire planter l'ouverture. */
  it("survit à une valeur abîmée", () => {
    localStorage.setItem(KEYS.onboarding, JSON.stringify({ done: "oui", hints: -4 }));
    expect(loadOnboarding()).toEqual({ done: [], skipped: false, hints: 0, seeded: false });
  });

  it("survit à ce qui n'est même pas du JSON", () => {
    localStorage.setItem(KEYS.onboarding, "{{{");
    expect(isFirstRun()).toBe(true);
  });
});

/* ============================================================
   LE SEMIS N'A LIEU QU'UNE FOIS

   `isFirstRun` ne pouvait pas porter cette question : il retombe à faux
   dès qu'une visite est jouée ou écartée, mais il redevient VRAI pour
   qui n'a jamais fait ni l'un ni l'autre. S'y fier aurait fait revenir
   les douze films d'exemple le lendemain du jour où quelqu'un a vidé sa
   collection à la main — au pire moment possible.
   ============================================================ */
describe("le classeur de démonstration ne se sème qu'une fois", () => {
  it("reste à semer sur une première ouverture", () => {
    expect(shouldSeed()).toBe(true);
  });

  it("ne se ressème plus une fois semé", () => {
    markSeeded();
    expect(shouldSeed()).toBe(false);
  });

  it("survit au rechargement", () => {
    markSeeded();
    /* Rien en mémoire : `loadOnboarding` relit le magasin à chaque
       appel, ce qui est exactement ce qu'on veut vérifier ici. */
    expect(loadOnboarding().seeded).toBe(true);
    expect(shouldSeed()).toBe(false);
  });

  /* LE CAS QUI A MOTIVÉ LE CHAMP : un classeur vidé à la main, par
     quelqu'un qui n'a jamais joué ni écarté la visite. `isFirstRun` dit
     « oui » — et il a raison de son point de vue. Le semis doit dire
     « non » quand même. */
  it("ne ressème pas un classeur vidé par quelqu'un qui n'a rien visité", () => {
    markSeeded();
    expect(isFirstRun()).toBe(true);
    expect(shouldSeed()).toBe(false);
  });

  it("ne survit pas à un oubli général, qui rejoue tout l'accueil", () => {
    markSeeded();
    resetOnboarding();
    expect(shouldSeed()).toBe(true);
  });

  /* Une valeur écrite avant ce champ ne le porte pas : l'absence doit se
     lire « pas encore semé », et non « déjà fait ». */
  it("lit une valeur d'avant comme un classeur jamais semé", () => {
    localStorage.setItem(KEYS.onboarding, JSON.stringify({ done: ["global"], hints: 1 }));
    expect(shouldSeed()).toBe(true);
  });
});
