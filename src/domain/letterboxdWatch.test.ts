import { describe, it, expect } from "vitest";
import { filmKey } from "./importing";
import { makeFilm } from "./film";
import {
  NOTHING,
  countOf,
  hasSomething,
  mergeProposals,
  proposalFrom,
  splitByChoice,
} from "./letterboxdWatch";
import type { ImportRow, ParsedCsv } from "../types";

const row = (partial: Partial<ImportRow> = {}): ImportRow => ({
  title: "Un film",
  year: 1975,
  rating: null,
  watchedAt: null,
  uri: null,
  ...partial,
});

const parsed = (rows: ImportRow[], kind: ParsedCsv["kind"] = "watched"): ParsedCsv => ({
  rows,
  kind,
  stats: {
    lines: rows.length,
    total: rows.length,
    duplicatesInFile: 0,
    withRating: 0,
    withoutRating: rows.length,
    skippedNoTitle: 0,
  },
});

describe("proposalFrom", () => {
  it("propose ce que le classeur n'a pas", () => {
    const found = proposalFrom([], parsed([row({ title: "Ran", year: 1985 })]), new Set());
    expect(found.toCreate).toHaveLength(1);
    expect(found.toCreate[0]!.title).toBe("Ran");
    expect(hasSomething(found)).toBe(true);
  });

  it("ne repropose pas ce qu'on a écarté", () => {
    const rows = [row({ title: "Ran", year: 1985 }), row({ title: "Kagemusha", year: 1980 })];
    const refused = new Set([filmKey({ title: "Ran", year: 1985 })]);
    const found = proposalFrom([], parsed(rows), refused);
    expect(found.toCreate.map((f) => f.title)).toEqual(["Kagemusha"]);
  });

  /* LE STATUT VIENT DU FLUX. Une watchlist naît « à voir », des séances
     naissent « vu » — et c'est `parsed.kind` qui le dit, pas l'appelant. */
  it("range une watchlist en « à voir » et des séances en « vu »", () => {
    const wish = proposalFrom([], parsed([row({ title: "Ran" })], "watchlist"), new Set());
    const seen = proposalFrom([], parsed([row({ title: "Ran" })], "watched"), new Set());
    expect(wish.toCreate[0]!.status).toBe("watchlist");
    expect(seen.toCreate[0]!.status).toBe("watched");
  });

  it("ne propose rien quand le classeur sait déjà tout", () => {
    const held = makeFilm({ title: "Ran", year: 1985, status: "watched" });
    const found = proposalFrom([held], parsed([row({ title: "Ran", year: 1985 })]), new Set());
    expect(hasSomething(found)).toBe(false);
  });
});

describe("mergeProposals", () => {
  /* UNE SÉANCE L'EMPORTE SUR UN SOUHAIT. Un film regardé hier et retiré
     de la watchlist ce matin peut être dans les deux lectures ; s'il
     entrait par la seconde, il naîtrait « à voir » alors qu'on vient de
     le voir. */
  it("garde la première version d'un film présent des deux côtés", () => {
    const seen = proposalFrom([], parsed([row({ title: "Ran" })], "watched"), new Set());
    const wish = proposalFrom([], parsed([row({ title: "Ran" })], "watchlist"), new Set());
    const both = mergeProposals(seen, wish);
    expect(both.toCreate).toHaveLength(1);
    expect(both.toCreate[0]!.status).toBe("watched");
  });

  it("cumule ce qui n'est que d'un côté", () => {
    const seen = proposalFrom([], parsed([row({ title: "Ran" })]), new Set());
    const wish = proposalFrom([], parsed([row({ title: "Kagemusha" })], "watchlist"), new Set());
    expect(countOf(mergeProposals(seen, wish))).toBe(2);
  });

  it("laisse une proposition vide sans effet", () => {
    const seen = proposalFrom([], parsed([row({ title: "Ran" })]), new Set());
    expect(countOf(mergeProposals(seen, NOTHING))).toBe(1);
    expect(countOf(mergeProposals(NOTHING, seen))).toBe(1);
  });
});

describe("splitByChoice", () => {
  it("sépare ce qu'on écrit de ce qu'on écarte", () => {
    const found = proposalFrom(
      [],
      parsed([row({ title: "Ran", year: 1985 }), row({ title: "Kagemusha", year: 1980 })]),
      new Set()
    );
    const chosen = new Set([filmKey({ title: "Ran", year: 1985 })]);
    const { taken, refused } = splitByChoice(found, chosen);

    expect(taken.toCreate.map((f) => f.title)).toEqual(["Ran"]);
    expect(refused).toEqual([filmKey({ title: "Kagemusha", year: 1980 })]);
  });

  /* CE QU'ON ÉCARTE REVIENT DANS `dismissed`, ET `proposalFrom` LE
     RETIRE : les deux moitiés de la règle se rejoignent ici, et c'est le
     seul endroit où l'on peut le vérifier sans réseau. */
  it("ce qui est écarté ne revient pas à la passe suivante", () => {
    const rows = [row({ title: "Ran", year: 1985 })];
    const first = proposalFrom([], parsed(rows), new Set());
    const { refused } = splitByChoice(first, new Set());
    const next = proposalFrom([], parsed(rows), new Set(refused));
    expect(hasSomething(next)).toBe(false);
  });

  it("ne rend rien d'« inchangé » : on n'écrit que ce qui est coché", () => {
    const held = makeFilm({ title: "Ran", year: 1985, status: "watched" });
    const found = proposalFrom([held], parsed([row({ title: "Ran", year: 1985 })]), new Set());
    expect(splitByChoice(found, new Set()).taken.unchanged).toEqual([]);
  });
});
