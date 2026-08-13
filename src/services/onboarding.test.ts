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

describe("what the binder remembers of the welcome", () => {
  it("starts from nothing: this is a first opening", () => {
    expect(loadOnboarding()).toEqual({ done: [], skipped: false, hints: 0, seeded: false });
    expect(isFirstRun()).toBe(true);
  });

  it("does not record the same tour twice", () => {
    markDone("global");
    markDone("global");
    expect(loadOnboarding().done).toEqual(["global"]);
  });

  it("reminds of nothing as long as nothing has been dismissed", () => {
    expect(shouldHint()).toBe(false);
  });

  it("reminds after a walk-out, and falls silent after three", () => {
    markSkipped();
    expect(shouldHint()).toBe(true);
    for (let i = 0; i < HINT_MAX; i++) bumpHint();
    expect(shouldHint()).toBe(false);
  });

  /* The reminder only serves to find a tour never taken: having carried
     it to its end after the fact must silence it, even if the counter
     has not run out. */
  it("falls silent as soon as the full tour has been taken", () => {
    markSkipped();
    markDone("global");
    expect(shouldHint()).toBe(false);
  });

  it("forgets everything on request", () => {
    markSkipped();
    markDone("library");
    resetOnboarding();
    expect(isFirstRun()).toBe(true);
  });

  /* A value written by an earlier version, or by an unlucky hand, must
     not crash the opening. */
  it("survives a damaged value", () => {
    localStorage.setItem(KEYS.onboarding, JSON.stringify({ done: "oui", hints: -4 }));
    expect(loadOnboarding()).toEqual({ done: [], skipped: false, hints: 0, seeded: false });
  });

  it("survives what is not even JSON", () => {
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
describe("the demonstration binder is sown only once", () => {
  it("is still to be sown on a first opening", () => {
    expect(shouldSeed()).toBe(true);
  });

  it("is not sown again once sown", () => {
    markSeeded();
    expect(shouldSeed()).toBe(false);
  });

  it("survives a reload", () => {
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
  it("does not re-sow a binder emptied by somebody who took no tour", () => {
    markSeeded();
    expect(isFirstRun()).toBe(true);
    expect(shouldSeed()).toBe(false);
  });

  it("does not survive a general forgetting, which replays the whole welcome", () => {
    markSeeded();
    resetOnboarding();
    expect(shouldSeed()).toBe(true);
  });

  /* A value written before this field does not carry it: the absence
     must read "not sown yet", and not "already done". */
  it("reads an earlier value as a binder never sown", () => {
    localStorage.setItem(KEYS.onboarding, JSON.stringify({ done: ["global"], hints: 1 }));
    expect(shouldSeed()).toBe(true);
  });
});
