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

  /* The reminder only serves to find a tour never taken: having carried
     it to its end after the fact must silence it, even if the counter
     has not run out. */
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

  /* A value written by an earlier version, or by an unlucky hand, must
     not crash the opening. */
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
   THE SOWING HAPPENS ONLY ONCE

   `isFirstRun` could not carry this question: it falls back to false as
   soon as a tour is played or dismissed, but it becomes TRUE again for
   whoever has done neither. Trusting it would have brought the twelve
   example films back the day after somebody emptied their collection by
   hand — at the worst possible moment.
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
    /* Nothing in memory: `loadOnboarding` re-reads the store at every
       call, which is exactly what we want to check here. */
    expect(loadOnboarding().seeded).toBe(true);
    expect(shouldSeed()).toBe(false);
  });

  /* THE CASE THAT MOTIVATED THE FIELD: a binder emptied by hand, by
     somebody who has never played nor dismissed the tour. `isFirstRun`
     says "yes" — and it is right from its point of view. The sowing must
     say "no" all the same. */
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

  /* A value written before this field does not carry it: the absence
     must read "not sown yet", and not "already done". */
  it("lit une valeur d'avant comme un classeur jamais semé", () => {
    localStorage.setItem(KEYS.onboarding, JSON.stringify({ done: ["global"], hints: 1 }));
    expect(shouldSeed()).toBe(true);
  });
});
