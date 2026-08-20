import { describe, it, expect } from "vitest";
import { elapsed } from "./elapsed";

/* ============================================================
   LES CAS QU'ON N'ESSAIE JAMAIS À LA MAIN
   ============================================================

   C'est toute la raison pour laquelle ce formateur n'est pas écrit dans
   la vue : on y vérifie « 4 min 12 » d'un coup d'œil, et jamais la
   minute pile, l'heure pile, ni l'horloge qui recule.
   ============================================================ */

describe("saying a duration", () => {
  it("counts in seconds below the minute", () => {
    expect(elapsed(0)).toBe("0 s");
    expect(elapsed(1)).toBe("1 s");
    expect(elapsed(59)).toBe("59 s");
  });

  it("turns over at the minute, and says no seconds when there are none", () => {
    expect(elapsed(60)).toBe("1 min");
    expect(elapsed(61)).toBe("1 min 1 s");
    expect(elapsed(599)).toBe("9 min 59 s");
    expect(elapsed(600)).toBe("10 min");
  });

  it("turns over at the hour, and drops the seconds there", () => {
    /* Passé l'heure, une seconde ne distingue plus rien et allonge la
       ligne d'un tableau qui en tient six. */
    expect(elapsed(3600)).toBe("1 h");
    expect(elapsed(3601)).toBe("1 h");
    expect(elapsed(3660)).toBe("1 h 01");
    expect(elapsed(7199)).toBe("1 h 59");
  });

  it("pads the minutes, because “1 h 5” reads a second too slow", () => {
    expect(elapsed(3900)).toBe("1 h 05");
  });

  it("says NOTHING rather than an absurdity", () => {
    /* Une horloge qui recule — un serveur qui redémarre, un fuseau qui
       change — ne doit pas écrire « -3 s » sur un tableau des scores. */
    expect(elapsed(-3)).toBe("");
    expect(elapsed(NaN)).toBe("");
    expect(elapsed(Infinity)).toBe("");
    expect(elapsed(null)).toBe("");
    expect(elapsed(undefined)).toBe("");
  });

  it("ignores the fraction rather than rounding it up", () => {
    /* 59,9 s n'est pas une minute : arrondir ferait apparaître « 1 min »
       sur une partie qui n'a pas duré une minute. */
    expect(elapsed(59.9)).toBe("59 s");
  });
});
