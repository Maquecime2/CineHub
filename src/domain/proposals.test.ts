import { describe, it, expect } from "vitest";
import { byAudience } from "./proposals";

/* ============================================================
   ONE ORDER FOR EVERY LIST OF PROPOSALS
   ============================================================

   The rule is short and the trap is in its last line: the fallback is
   decided for the WHOLE list. A filmography where three films carry an
   audience and forty do not would otherwise put those three on top and
   leave the other forty in whatever order the JSON arrived in — a second
   ordering, invisible, under the first.
   ============================================================ */

const read = (list: { title: string }[]) => list.map((f) => f.title);

describe("ordering what the binder does not hold", () => {
  it("puts the most widely seen first", () => {
    const hits = [
      { title: "confidentiel", year: 2020, voteCount: 12 },
      { title: "vu par tous", year: 1999, voteCount: 90_000 },
      { title: "entre les deux", year: 2010, voteCount: 4_000 },
    ];
    expect(read(byAudience(hits))).toEqual(["vu par tous", "entre les deux", "confidentiel"]);
  });

  it("falls back on the date when NOBODY says how many saw it", () => {
    const hits = [
      { title: "ancien", year: 1953 },
      { title: "récent", year: 2019 },
      { title: "moyen", year: 1988 },
    ];
    expect(read(byAudience(hits))).toEqual(["récent", "moyen", "ancien"]);
  });

  /* LE REPLI EST DÉCIDÉ POUR TOUTE LA LISTE — voir l'en-tête. */
  it("does not mix the two orders when only some carry an audience", () => {
    const hits = [
      { title: "sans mesure, ancien", year: 1950 },
      { title: "mesuré", year: 1960, voteCount: 500 },
      { title: "sans mesure, récent", year: 2020 },
    ];
    /* Le mesuré passe devant, et les deux autres se rangent entre eux
       par la date : un seul ordre, lisible d'un bout à l'autre. */
    expect(read(byAudience(hits))).toEqual([
      "mesuré",
      "sans mesure, récent",
      "sans mesure, ancien",
    ]);
  });

  it("settles a tie by the date rather than by chance", () => {
    const hits = [
      { title: "vieux", year: 1970, voteCount: 100 },
      { title: "neuf", year: 2001, voteCount: 100 },
    ];
    expect(read(byAudience(hits))).toEqual(["neuf", "vieux"]);
  });

  it("takes an absent or unreadable year for the oldest there is", () => {
    const hits = [
      { title: "sans année" },
      { title: "année vide", year: "" },
      { title: "daté", year: 1980 },
    ];
    expect(read(byAudience(hits))[0]).toBe("daté");
  });

  it("never touches the list it was given", () => {
    const hits = [
      { title: "a", year: 1990, voteCount: 1 },
      { title: "b", year: 2000, voteCount: 9 },
    ];
    byAudience(hits);
    expect(read(hits)).toEqual(["a", "b"]);
  });
});
