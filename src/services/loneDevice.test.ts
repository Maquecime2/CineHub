import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MAX_NUDGES, readLoneDevice, noteNudge, mayNudge } from "./loneDevice";

/* Ce qui se teste ici : QUAND ON SE TAIT. Une carte qui revient à chaque
   ouverture est une carte qu'on apprend à fermer sans lire — et celle-ci
   dit la seule chose qui puisse coûter un compte. */

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("le compte seul sur son appareil", () => {
  it("propose, puis se tait après deux fois", () => {
    expect(mayNudge()).toBe(true);
    for (let i = 0; i < MAX_NUDGES; i++) noteNudge();
    expect(readLoneDevice().nudges).toBe(MAX_NUDGES);
    expect(mayNudge()).toBe(false);
  });

  it("part de zéro, et se souvient d'une fois à l'autre", () => {
    expect(readLoneDevice().nudges).toBe(0);
    noteNudge();
    expect(readLoneDevice().nudges).toBe(1);
    expect(mayNudge()).toBe(true);
  });

  /* Le stockage est du texte venu du dehors : une valeur abîmée ne doit
     pas faire taire la carte pour toujours. */
  it("repart de zéro sur un état illisible", () => {
    localStorage.setItem("lone-device", '{"nudges":"beaucoup"}');
    expect(readLoneDevice().nudges).toBe(0);
    localStorage.setItem("lone-device", '{"nudges":-3}');
    expect(readLoneDevice().nudges).toBe(0);
    localStorage.setItem("lone-device", "pas du json");
    expect(readLoneDevice().nudges).toBe(0);
    expect(mayNudge()).toBe(true);
  });
});
