import { describe, it, expect } from "vitest";
import {
  affinity,
  discoverPlans,
  nicheFactors,
  nicheScore,
  rank,
  reasonsFor,
  DEFAULT_QUERY,
  FEATURE_MIN,
} from "./reco";
import { buildTaste } from "./taste";

/* These tests never touch the network: `gatherCandidates` is the only
   function of the module that speaks to TMDB, and it is precisely so
   that the ranking can be tested without it that the two floors are
   kept apart. */

const film = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  title: "Film",
  year: 2000,
  rating: 0,
  director: "",
  genres: [],
  themes: [],
  status: "watched",
  ...over,
});

/* A candidate as it comes out of the harvest: genres already resolved
   into names, `sources` saying by which paths it arrived. */
const candidate = (over = {}) => ({
  tmdbId: Math.floor(Math.random() * 1e6),
  title: "Candidat",
  year: 2000,
  genres: [],
  lang: "en",
  voteCount: 5000,
  voteAverage: 7,
  sources: [{ kind: "discover" }],
  ...over,
});

/* A collection full enough for the profile not to be "empty". */
const collection = (over = {}) => [
  film({ rating: 5, genres: ["Drame"], year: 2000, ...over }),
  film({ rating: 5, genres: ["Drame"], year: 2005, ...over }),
  film({ rating: 4, genres: ["Drame"], year: 2010, ...over }),
];

describe("affinity", () => {
  it("returns 0.5 with no profile: knowing nothing, everything is worth the same", () => {
    const taste = buildTaste([]);
    expect(taste.isEmpty).toBe(true);
    expect(affinity(candidate(), taste)).toBe(0.5);
  });

  it("stays within [0, 1] even when the weights are negative", () => {
    const taste = buildTaste([
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 5, genres: ["Drame"] }),
    ]);
    const score = affinity(candidate({ genres: ["Horreur"], voteAverage: 3 }), taste);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("prefers a loved genre to a hated one", () => {
    const taste = buildTaste([
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 5, genres: ["Drame"] }),
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 1, genres: ["Horreur"] }),
    ]);
    expect(affinity(candidate({ genres: ["Drame"] }), taste)).toBeGreaterThan(
      affinity(candidate({ genres: ["Horreur"] }), taste)
    );
  });

  it("does not penalise an unknown genre: discovering it is not a fault", () => {
    const taste = buildTaste(collection());
    const unknown = affinity(candidate({ genres: ["Documentaire"] }), taste);
    const neutral = affinity(candidate({ genres: [] }), taste);
    expect(unknown).toBeCloseTo(neutral);
  });

  it("rewards a film brought up by a loved card", () => {
    const taste = buildTaste(collection());
    const nu = candidate();
    const perReco = candidate({
      sources: [{ kind: "reco", from: { title: "Un film aimé", rating: 5 } }],
    });
    expect(affinity(perReco, taste)).toBeGreaterThan(affinity(nu, taste));
  });

  it("rewards several loved cards more, without going past the cap", () => {
    const taste = buildTaste(collection());
    const reco = (n) =>
      candidate({
        sources: Array.from({ length: n }, (_, i) => ({
          kind: "reco",
          from: { title: `Aimé ${i}`, rating: 5 },
        })),
      });
    expect(affinity(reco(2), taste)).toBeGreaterThan(affinity(reco(1), taste));
    // 0.55 + 0.15 × n tops out at 1: beyond 3 sources the bonus no longer moves
    expect(affinity(reco(9), taste)).toBeCloseTo(affinity(reco(3), taste));
  });

  it("rewards a film by a director one follows", () => {
    const taste = buildTaste(collection());
    expect(
      affinity(candidate({ sources: [{ kind: "director", director: "X" }] }), taste)
    ).toBeGreaterThan(affinity(candidate(), taste));
  });
});

describe("nicheFactors", () => {
  const taste = buildTaste(collection());

  it("lets obscurity fall as the votes climb", () => {
    const few = nicheFactors(candidate({ voteCount: 50 }), taste).obscurity;
    const many = nicheFactors(candidate({ voteCount: 40000 }), taste).obscurity;
    expect(few).toBeGreaterThan(many);
    expect(many).toBeGreaterThanOrEqual(0);
  });

  it("does not count English as faraway", () => {
    expect(nicheFactors(candidate({ lang: "en" }), taste).foreign).toBe(0);
    expect(nicheFactors(candidate({ lang: "" }), taste).foreign).toBe(0);
  });

  it("stays careful about a foreign language when the collection declares none", () => {
    // the common case of Letterboxd imports: with no known languages, we
    // stick to the raw fact "this is not English"
    expect(taste.seenLanguages.size).toBe(0);
    expect(nicheFactors(candidate({ lang: "ja" }), taste).foreign).toBe(0.7);
  });

  it("tells a known language from an unheard one when the collection allows it", () => {
    const withLanguages = buildTaste(collection({ lang: "fr" }));
    expect(nicheFactors(candidate({ lang: "fr" }), withLanguages).foreign).toBe(0.6);
    expect(nicheFactors(candidate({ lang: "ja" }), withLanguages).foreign).toBe(1);
  });

  it("counts age only below 1985, and not for a recent film", () => {
    expect(nicheFactors(candidate({ year: 2015 }), taste).age).toBe(0);
    expect(nicheFactors(candidate({ year: 1960, voteCount: 100 }), taste).age).toBeGreaterThan(0);
  });

  it("measures the distance from the collection without mistaking it for disagreement", () => {
    const familiar = nicheFactors(candidate({ genres: ["Drame"], year: 2005 }), taste).drift;
    const inedit = nicheFactors(candidate({ genres: ["Western"], year: 1930 }), taste).drift;
    expect(inedit).toBeGreaterThan(familiar);
  });

  it("keeps every factor within [0, 1]", () => {
    const f = nicheFactors(candidate({ year: 1920, voteCount: 1, lang: "ja" }), taste);
    for (const v of Object.values(f)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("nicheScore", () => {
  const f = { obscurity: 1, foreign: 0, age: 0, drift: 1 };

  it("weighs the three active factors and renormalises", () => {
    // 0,55 / (0,55 + 0,25 + 0,2)
    expect(nicheScore(f, DEFAULT_QUERY.niche)).toBeCloseTo(0.55);
  });

  it("renormalises when a factor is switched off", () => {
    // only obscurity remains: it carries the whole score
    expect(nicheScore(f, { obscurity: true, foreign: false, age: false })).toBe(1);
  });

  it("returns 0 when no factor is active, rather than dividing by zero", () => {
    expect(nicheScore(f, { obscurity: false, foreign: false, age: false })).toBe(0);
  });

  it("ignores the distance from the collection, which has its own dial", () => {
    const noDrift = nicheScore({ ...f, drift: 0 }, DEFAULT_QUERY.niche);
    expect(nicheScore(f, DEFAULT_QUERY.niche)).toBe(noDrift);
  });
});

describe("rank", () => {
  const taste = buildTaste(collection());
  const query = (over = {}) => ({ ...DEFAULT_QUERY, ...over });

  it("attaches the score and its reasons to every candidate", () => {
    const [out] = rank([candidate()], taste, query());
    expect(out).toHaveProperty("score");
    expect(out).toHaveProperty("affinity");
    expect(out).toHaveProperty("niche");
    expect(out).toHaveProperty("factors");
    expect(Array.isArray(out.reasons)).toBe(true);
  });

  it("ranks by falling score", () => {
    const out = rank([candidate(), candidate({ voteCount: 20 }), candidate()], taste, query());
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });

  it("the niche dial reverses the order between a known film and a confidential one", () => {
    const knownOne = candidate({ tmdbId: 1, title: "Connu", voteCount: 45000, genres: ["Drame"] });
    const rare = candidate({ tmdbId: 2, title: "Rare", voteCount: 60, genres: ["Drame"] });

    const mainstream = rank([knownOne, rare], taste, query({ nichePref: 0 }));
    expect(mainstream[0].title).toBe("Connu");

    const gem = rank([knownOne, rare], taste, query({ nichePref: 1 }));
    expect(gem[0].title).toBe("Rare");
  });

  it("the drift dial turns the distance into an asset or a penalty", () => {
    const familiar = candidate({ tmdbId: 1, title: "Familier", genres: ["Drame"], year: 2005 });
    const faraway = candidate({ tmdbId: 2, title: "Dépaysant", genres: ["Western"], year: 1935 });
    const args = [[familiar, faraway], taste];

    expect(rank(...args, query({ driftPref: 1, nichePref: 0.5 }))[0].title).toBe("Dépaysant");
    expect(rank(...args, query({ driftPref: 0, nichePref: 0.5 }))[0].title).toBe("Familier");
  });

  it("does not let one source card take over the head of the list", () => {
    /* Six films brought back by the same beloved card — hence favoured by
       the reco bonus — among other candidates. Without diversification the
       six would hog the head and the page would speak of one film only. */
    const from = { title: "Le film aimé", rating: 5 };
    const cluster = Array.from({ length: 6 }, (_, i) =>
      candidate({ tmdbId: 100 + i, title: `Grappe ${i}`, sources: [{ kind: "reco", from }] })
    );
    const others = Array.from({ length: 5 }, (_, i) =>
      candidate({ tmdbId: 300 + i, title: `Autre ${i}` })
    );

    const out = rank([...cluster, ...others], taste, query(), 8);
    // the first 7 places are composed before any carrying over to the tail
    const atTheTop = out.slice(0, 7).filter((c) => c.title.startsWith("Grappe"));
    expect(atTheTop).toHaveLength(2);
  });

  it("pushes the ousted to the end of the list instead of losing them", () => {
    const from = { title: "Le film aimé", rating: 5 };
    const cluster = Array.from({ length: 5 }, (_, i) =>
      candidate({ tmdbId: 200 + i, sources: [{ kind: "reco", from }] })
    );
    expect(rank(cluster, taste, query())).toHaveLength(5);
  });

  it("respects the limit asked for", () => {
    const many = Array.from({ length: 60 }, (_, i) => candidate({ tmdbId: i }));
    expect(rank(many, taste, query(), 10)).toHaveLength(10);
  });

  it("accepts an empty list", () => {
    expect(rank([], taste, query())).toEqual([]);
  });

  it("works with no profile: the filter decides on its own", () => {
    const empty = buildTaste([]);
    const out = rank([candidate(), candidate()], empty, query());
    expect(out).toHaveLength(2);
    expect(out.every((c) => Number.isFinite(c.score))).toBe(true);
  });
});

describe("reasonsFor", () => {
  const taste = buildTaste(collection());
  const reasons = (c) => reasonsFor(c, nicheFactors(c, taste), taste);

  it("names the card the recommendation comes from", () => {
    const c = candidate({ sources: [{ kind: "reco", from: { title: "Solaris", rating: 5 } }] });
    expect(reasons(c)[0]).toBe("parce que vous avez aimé Solaris");
  });

  it("sums up when several cards converge", () => {
    const c = candidate({
      sources: [
        { kind: "reco", from: { title: "Solaris" } },
        { kind: "reco", from: { title: "Stalker" } },
        { kind: "reco", from: { title: "Le Miroir" } },
      ],
    });
    expect(reasons(c)[0]).toBe("dans le sillage de Solaris et 2 autres");
  });

  it("cites the director one follows", () => {
    const c = candidate({ sources: [{ kind: "director", director: "Tarkovski" }] });
    expect(reasons(c)).toContain("de Tarkovski, que vous suivez");
  });

  it("puts a figure on rarity when it is marked", () => {
    const c = candidate({ voteCount: 40 });
    expect(reasons(c)).toContain("40 votes seulement");
  });

  it("points out a new genre rather than repeating the known ones", () => {
    expect(reasons(candidate({ genres: ["Western"] }))).toContain(
      "un genre nouveau pour vous : Western"
    );
  });

  it("never shows more than three of them", () => {
    const c = candidate({
      year: 1930,
      voteCount: 20,
      lang: "ja",
      genres: ["Western"],
      sources: [
        { kind: "reco", from: { title: "Solaris" } },
        { kind: "director", director: "Tarkovski" },
      ],
    });
    expect(reasons(c).length).toBeLessThanOrEqual(3);
  });

  it("stays silent rather than invent, when nothing stands out", () => {
    const c = candidate({ voteCount: 45000, lang: "en", year: 2015, genres: [] });
    expect(reasons(c)).toEqual([]);
  });
});

/* ============================================================
   LES COURTS MÉTRAGES

   Ils sont légion sous le plancher de votes — c'est là qu'ils vivent —
   et on ne cherche pas un film pour ce soir en ouvrant une planche de
   bobines de huit minutes. On les écarte À LA REQUÊTE et non au tri :
   les jeter après coup gâcherait des pages entières de résultats, donc
   du quota, pour rien.
   ============================================================ */
describe("le plancher de durée", () => {
  const taste = buildTaste([]);
  const genreMap = { byName: new Map(), byId: new Map() };
  const plans = (over) => discoverPlans({ ...DEFAULT_QUERY, ...over }, taste, genreMap);

  it("demande à TMDB de ne pas les envoyer", () => {
    for (const p of plans({ noShorts: true })) {
      expect(p["with_runtime.gte"]).toBe(String(FEATURE_MIN));
    }
  });

  it("ne dit rien du tout quand on les accepte", () => {
    for (const p of plans({ noShorts: false })) {
      expect(p["with_runtime.gte"]).toBeUndefined();
    }
  });

  /* Le plancher vaut sur TOUTES les requêtes, y compris celles que le
     curseur de niche ajoute — ce sont justement celles qui descendent
     chercher le confidentiel, donc celles qui en ramènent le plus. */
  it("vaut aussi sur les requêtes du curseur de niche", () => {
    const wide = plans({ noShorts: true, nichePref: 1 });
    expect(wide.length).toBeGreaterThan(3);
    expect(wide.every((p) => p["with_runtime.gte"] === String(FEATURE_MIN))).toBe(true);
  });
});
