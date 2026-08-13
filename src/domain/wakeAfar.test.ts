import { describe, it, expect } from "vitest";
import {
  mergeAfar,
  reinforcementFromOutside,
  alreadyInTheBinder,
  byTmdbId,
  VOTES_MINIMUM,
} from "./wakeAfar";
import type { FarCandidate, Harvest } from "./wakeAfar";
import { familyOf } from "./wake";
import { makeFilm } from "./film";
import type { Film } from "../types";

import i18n from "../i18n";
import { say } from "./wording";

/** What a `Wording` really reads as on screen. The suite runs in French. */
const said = (w: Parameters<typeof say>[0]) => say(w, i18n.t.bind(i18n));

const cand = (tmdbId: number, title: string, extra: Partial<FarCandidate> = {}): FarCandidate => ({
  tmdbId,
  title,
  year: 2000,
  poster: null,
  voteAverage: 7,
  voteCount: 500,
  ...extra,
});

const harvest = (via: Harvest["via"], value: string, candidates: FarCandidate[]): Harvest => ({
  via,
  value,
  candidates,
});

describe("what the 'outside' column keeps quiet about", () => {
  it("rules out what is already in the binder", () => {
    const r = [harvest("crowd", "", [cand(1, "Déjà vu"), cand(2, "Neuf")])];
    const out = mergeAfar(r, { alreadyHere: new Set([1]) });
    expect(out.map((v) => v.title)).toEqual(["Neuf"]);
  });

  it("rules out what almost nobody has seen", () => {
    const r = [
      harvest("cinematography", "Deakins", [
        cand(1, "Court d'école", { voteCount: VOTES_MINIMUM - 1 }),
        cand(2, "Un vrai film", { voteCount: VOTES_MINIMUM }),
      ]),
    ];
    expect(mergeAfar(r).map((v) => v.title)).toEqual(["Un vrai film"]);
  });

  it("ignores a candidate with no identifier or no title", () => {
    const broken = [{ ...cand(0, ""), tmdbId: 0 }] as FarCandidate[];
    expect(mergeAfar([harvest("crowd", "", broken)])).toEqual([]);
  });

  it("returns nothing with no harvest", () => {
    expect(mergeAfar([])).toEqual([]);
  });
});

describe("merging the provenances", () => {
  it("adds up the paths of a film that arrives several times", () => {
    const r = [
      harvest("crowd", "", [cand(1, "Croisé")]),
      harvest("cinematography", "Deakins", [cand(1, "Croisé")]),
      harvest("music", "Zimmer", [cand(2, "Simple")]),
    ];
    const first = mergeAfar(r)[0]!;
    expect(first.title).toBe("Croisé");
    expect(first.via).toHaveLength(2);
  });

  /* "+ 1 lien" taught nothing: you knew a second reason existed, never
     which one — that is to say precisely what you came for. The first two
     paths are named. */
  it("names both paths rather than counting the second", () => {
    const r = [
      harvest("crowd", "", [cand(1, "Croisé")]),
      harvest("cinematography", "Roger Deakins", [cand(1, "Croisé")]),
    ];
    expect(said(mergeAfar(r)[0]!.reason)).toBe(
      "du même chef op Roger Deakins · vu par les mêmes gens"
    );
  });

  it("only counts beyond two paths", () => {
    const r = [
      harvest("cinematography", "Deakins", [cand(1, "Croisé")]),
      harvest("music", "Zimmer", [cand(1, "Croisé")]),
      harvest("crowd", "", [cand(1, "Croisé")]),
      harvest("actor", "Vedette", [cand(1, "Croisé")]),
    ];
    expect(said(mergeAfar(r)[0]!.reason)).toBe(
      "du même chef op Deakins · du même compositeur Zimmer, + 2"
    );
  });

  it("simply says where it comes from when there is only one path", () => {
    const r = [harvest("music", "Zbigniew Preisner", [cand(1, "Seul")])];
    expect(said(mergeAfar(r)[0]!.reason)).toBe("du même compositeur Zbigniew Preisner");
  });

  it("puts a shared cinematographer ahead of a plain recommendation", () => {
    const r = [
      harvest("crowd", "", [cand(1, "Foule")]),
      harvest("cinematography", "Deakins", [cand(2, "Même œil")]),
    ];
    expect(mergeAfar(r).map((v) => v.title)).toEqual(["Même œil", "Foule"]);
  });
});

describe("the ranking is stable", () => {
  it("does not depend on the order the queries came back in", () => {
    const a = harvest("crowd", "", [cand(1, "Alpha"), cand(2, "Bravo")]);
    const b = harvest("music", "M", [cand(3, "Charlie")]);
    const left = mergeAfar([a, b]).map((v) => v.title);
    const right = mergeAfar([b, a]).map((v) => v.title);
    expect(left).toEqual(right);
  });

  it("stops at the number asked for", () => {
    const many = Array.from({ length: 30 }, (_, i) => cand(i + 1, `F${i}`));
    expect(
      mergeAfar([harvest("crowd", "", many)], {
        quotas: { people: 2, subjects: 2, crowd: 2 },
      })
    ).toHaveLength(6);
  });
});

describe("the quotas on the TMDB side", () => {
  /* The four "person" paths swept the whole column: their weights are
     heavier, and there was not even a thematic path. The quota guarantees
     the subject a place. */
  it("reserves places for the subjects against the filmographies", () => {
    const viaPeople = Array.from({ length: 10 }, (_, i) => cand(i + 1, `Gens${i}`));
    const viaSubject = Array.from({ length: 10 }, (_, i) => cand(100 + i, `Sujet${i}`));
    const out = mergeAfar(
      [harvest("cinematography", "Deakins", viaPeople), harvest("keyword", "neo-noir", viaSubject)],
      { quotas: { people: 3, subjects: 3, crowd: 0 } }
    );
    expect(out.filter((v) => v.title.startsWith("Gens"))).toHaveLength(3);
    expect(out.filter((v) => v.title.startsWith("Sujet"))).toHaveLength(3);
  });

  it("hands the other families their share when one path brings nothing back", () => {
    const viaPeople = Array.from({ length: 10 }, (_, i) => cand(i + 1, `Gens${i}`));
    const out = mergeAfar([harvest("cinematography", "Deakins", viaPeople)], {
      quotas: { people: 3, subjects: 3, crowd: 0 },
    });
    expect(out).toHaveLength(6);
  });

  /* ▲ THE TEST THAT WOULD HAVE CAUGHT THE FLAW.

     "Recommended" weighed 2.2 and lived in the "subjects" family, where a
     keyword caps at 1.4 + 0.4 = 1.8. The twenty recommendations TMDB
     returns on every call therefore saturated the whole stack, and the
     result of the keyword query — fired, paid for — was thrown away one
     hundred per cent of the time. No wake ever showed a single "same
     subject" from outside. */
  it("lets the subjects through despite twenty recommendations", () => {
    const recos = Array.from({ length: 20 }, (_, i) => cand(i + 1, `Reco${i}`));
    const subjects = Array.from({ length: 8 }, (_, i) => cand(100 + i, `Sujet${i}`));
    const out = mergeAfar(
      [harvest("crowd", "", recos), harvest("keyword", "time loop", subjects)],
      { quotas: { people: 4, subjects: 4, crowd: 2 } }
    );
    /* The point that counts: there are some, where there were NEVER any.
       The exact count depends on the carry-over — the "people" family is
       empty here, and its four places go to the others. */
    expect(out.filter((v) => v.title.startsWith("Sujet")).length).toBeGreaterThanOrEqual(4);
  });

  /* The same flaw seen the other way round: with no quota of its own, the
     crowd left not ONE place. So we check both bounds. */
  it("does not let the crowd sweep the subjects' share", () => {
    const recos = Array.from({ length: 20 }, (_, i) => cand(i + 1, `Reco${i}`));
    const subjects = Array.from({ length: 8 }, (_, i) => cand(100 + i, `Sujet${i}`));
    const people = Array.from({ length: 8 }, (_, i) => cand(200 + i, `Gens${i}`));
    const out = mergeAfar(
      [
        harvest("crowd", "", recos),
        harvest("keyword", "time loop", subjects),
        harvest("cinematography", "Deakins", people),
      ],
      { quotas: { people: 4, subjects: 4, crowd: 2 } }
    );
    expect(out.filter((v) => v.title.startsWith("Gens"))).toHaveLength(4);
    expect(out.filter((v) => v.title.startsWith("Sujet"))).toHaveLength(4);
    expect(out.filter((v) => v.title.startsWith("Reco"))).toHaveLength(2);
  });

  it("gives the crowd its own share, neither the people's nor the subjects'", () => {
    const out = mergeAfar(
      [
        harvest("crowd", "", [cand(1, "Foule")]),
        harvest("cinematography", "D", [cand(2, "A"), cand(3, "B")]),
      ],
      { quotas: { people: 1, subjects: 0, crowd: 1 } }
    );
    expect(out.map((v) => v.title).sort()).toEqual(["A", "Foule"]);
  });
});

describe("alreadyInTheBinder", () => {
  it("only keeps the cards that carry a TMDB identifier", () => {
    const set = alreadyInTheBinder([{ tmdbId: 12 }, { tmdbId: null }, {}, { tmdbId: 34 }]);
    expect([...set].sort((a, b) => a - b)).toEqual([12, 34]);
  });

  /* Cards written by hand and some older imports set `tmdbId` as TEXT.
     Without conversion, "27205" is never 27205 and the film you own comes
     back offering itself as a discovery. */
  it("recognises an identifier written out as text", () => {
    expect(alreadyInTheBinder([{ tmdbId: "27205" }]).has(27205)).toBe(true);
  });

  it("does not take an empty string for an identifier", () => {
    expect(alreadyInTheBinder([{ tmdbId: "" }]).size).toBe(0);
  });

  it("does rule out a film already owned under a text identifier", () => {
    const alreadyHere = alreadyInTheBinder([{ tmdbId: "1" }]);
    const out = mergeAfar([harvest("crowd", "", [cand(1, "Déjà là"), cand(2, "Neuf")])], {
      alreadyHere,
    });
    expect(out.map((v) => v.title)).toEqual(["Neuf"]);
  });
});

/* ============================================================
   THE REINFORCEMENT — TMDB in the service of the "at home" column
   ============================================================

   The wake at home only brings things together by subject if BOTH cards
   carry motifs or keywords. On an imported collection they have none, and
   the column talked about nothing but crews. Going to fetch the keywords
   of five hundred cards would cost five hundred calls; the answer was
   already in the harvest, which we were throwing away. */
describe("reinforcementFromOutside", () => {
  const card = (id: string, tmdbId: number | string, extra: Partial<Film> = {}): Film =>
    makeFilm({ id, title: `Film ${id}`, tmdbId, ...extra });

  it("recognises one of your cards in what TMDB brings back", () => {
    const mine = card("a", 42);
    const out = reinforcementFromOutside(
      [harvest("keyword", "time loop", [cand(42, "Chez moi")])],
      byTmdbId([mine]),
      "pivot"
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.film.id).toBe("a");
    expect(out[0]!.links[0]!.type).toBe("keyword");
  });

  it("ignores what you do not own — that is the other column's business", () => {
    const out = reinforcementFromOutside(
      [harvest("keyword", "time loop", [cand(99, "Dehors")])],
      byTmdbId([card("a", 42)]),
      "pivot"
    );
    expect(out).toEqual([]);
  });

  /* The pivot obviously finds itself in its own filmography and under its
     own keywords. */
  it("does not suggest itself", () => {
    const pivot = card("pivot", 42);
    const out = reinforcementFromOutside(
      [harvest("cinematography", "Deakins", [cand(42, "Le pivot")])],
      byTmdbId([pivot]),
      "pivot"
    );
    expect(out).toEqual([]);
  });

  it("rules out filed cards", () => {
    const out = reinforcementFromOutside(
      [harvest("keyword", "x", [cand(42, "Rangé")])],
      byTmdbId([card("a", 42, { archived: true })]),
      "pivot"
    );
    expect(out).toEqual([]);
  });

  /* Identifiers written as text: otherwise "42" is never 42 and the
     reinforcement recognises none of your cards. */
  it("recognises an identifier written out as text", () => {
    const out = reinforcementFromOutside(
      [harvest("keyword", "x", [cand(42, "Chez moi")])],
      byTmdbId([card("a", "42")]),
      "pivot"
    );
    expect(out).toHaveLength(1);
  });

  it("adds up the paths of a card brought up several times", () => {
    const out = reinforcementFromOutside(
      [
        harvest("keyword", "time loop", [cand(42, "Chez moi")]),
        harvest("cinematography", "Deakins", [cand(42, "Chez moi")]),
      ],
      byTmdbId([card("a", 42)]),
      "pivot"
    );
    expect(out[0]!.links).toHaveLength(2);
    // the rarest first, as everywhere
    expect(out[0]!.links[0]!.type).toBe("cinematography");
  });

  /* ▲ THE FLAW'S OTHER HALF. The reinforcement converted a recommendation
     into `mot-clé`: a suggestion from the crowd was therefore passing
     itself off as a subject connection, and the displayed reason lied. */
  it("does not disguise a recommendation as a subject connection", () => {
    const out = reinforcementFromOutside(
      [harvest("crowd", "", [cand(42, "Chez moi")])],
      byTmdbId([card("a", 42)]),
      "pivot"
    );
    expect(out[0]!.links[0]!.type).toBe("crowd");
    expect(familyOf(out[0]!.links)).toBe("crowd");
  });

  it("returns nothing with no harvest", () => {
    expect(reinforcementFromOutside([], byTmdbId([card("a", 42)]), "pivot")).toEqual([]);
  });
});
