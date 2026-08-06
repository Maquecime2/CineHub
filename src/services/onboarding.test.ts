import { describe, it, expect, beforeEach } from "vitest";
import {
  HINT_MAX,
  bumpHint,
  isFirstRun,
  loadOnboarding,
  markDone,
  markSkipped,
  resetOnboarding,
  shouldHint,
} from "./onboarding";
import { KEYS } from "./storage";

beforeEach(() => localStorage.clear());

describe("ce que le classeur retient de l'accueil", () => {
  it("part de rien : c'est une première ouverture", () => {
    expect(loadOnboarding()).toEqual({ done: [], skipped: false, hints: 0 });
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
    expect(loadOnboarding()).toEqual({ done: [], skipped: false, hints: 0 });
  });

  it("survit à ce qui n'est même pas du JSON", () => {
    localStorage.setItem(KEYS.onboarding, "{{{");
    expect(isFirstRun()).toBe(true);
  });
});
