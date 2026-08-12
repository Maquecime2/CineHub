import { describe, it, expect } from "vitest";
import { affinity, nicheFactors, nicheScore, rank, reasonsFor, DEFAULT_QUERY } from "./reco";
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
  it("renvoie 0,5 sans profil : sans rien savoir, tout se vaut", () => {
    const taste = buildTaste([]);
    expect(taste.isEmpty).toBe(true);
    expect(affinity(candidate(), taste)).toBe(0.5);
  });

  it("reste dans [0, 1] même quand les poids sont négatifs", () => {
    const taste = buildTaste([
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 1, genres: ["Horreur"] }),
      film({ rating: 5, genres: ["Drame"] }),
    ]);
    const score = affinity(candidate({ genres: ["Horreur"], voteAverage: 3 }), taste);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("préfère un genre aimé à un genre détesté", () => {
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

  it("ne pénalise pas un genre inconnu : le découvrir n'est pas un défaut", () => {
    const taste = buildTaste(collection());
    const inconnu = affinity(candidate({ genres: ["Documentaire"] }), taste);
    const neutre = affinity(candidate({ genres: [] }), taste);
    expect(inconnu).toBeCloseTo(neutre);
  });

  it("récompense un film remonté par une fiche aimée", () => {
    const taste = buildTaste(collection());
    const nu = candidate();
    const parReco = candidate({
      sources: [{ kind: "reco", from: { title: "Un film aimé", rating: 5 } }],
    });
    expect(affinity(parReco, taste)).toBeGreaterThan(affinity(nu, taste));
  });

  it("récompense davantage plusieurs fiches aimées, sans dépasser le plafond", () => {
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

  it("récompense un film d'un réalisateur suivi", () => {
    const taste = buildTaste(collection());
    expect(
      affinity(candidate({ sources: [{ kind: "director", director: "X" }] }), taste)
    ).toBeGreaterThan(affinity(candidate(), taste));
  });
});

describe("nicheFactors", () => {
  const taste = buildTaste(collection());

  it("fait décroître l'obscurité quand les votes montent", () => {
    const peu = nicheFactors(candidate({ voteCount: 50 }), taste).obscurity;
    const beaucoup = nicheFactors(candidate({ voteCount: 40000 }), taste).obscurity;
    expect(peu).toBeGreaterThan(beaucoup);
    expect(beaucoup).toBeGreaterThanOrEqual(0);
  });

  it("ne considère pas l'anglais comme dépaysant", () => {
    expect(nicheFactors(candidate({ lang: "en" }), taste).foreign).toBe(0);
    expect(nicheFactors(candidate({ lang: "" }), taste).foreign).toBe(0);
  });

  it("reste prudent sur une langue étrangère quand la collection n'en déclare aucune", () => {
    // the common case of Letterboxd imports: with no known languages, we
    // stick to the raw fact "this is not English"
    expect(taste.seenLanguages.size).toBe(0);
    expect(nicheFactors(candidate({ lang: "ja" }), taste).foreign).toBe(0.7);
  });

  it("distingue langue connue et langue inédite quand la collection le permet", () => {
    const avecLangues = buildTaste(collection({ lang: "fr" }));
    expect(nicheFactors(candidate({ lang: "fr" }), avecLangues).foreign).toBe(0.6);
    expect(nicheFactors(candidate({ lang: "ja" }), avecLangues).foreign).toBe(1);
  });

  it("ne compte l'ancienneté qu'en dessous de 1985, et pas pour un film récent", () => {
    expect(nicheFactors(candidate({ year: 2015 }), taste).age).toBe(0);
    expect(nicheFactors(candidate({ year: 1960, voteCount: 100 }), taste).age).toBeGreaterThan(0);
  });

  it("mesure l'écart à la collection sans le confondre avec le désaccord", () => {
    const familier = nicheFactors(candidate({ genres: ["Drame"], year: 2005 }), taste).drift;
    const inedit = nicheFactors(candidate({ genres: ["Western"], year: 1930 }), taste).drift;
    expect(inedit).toBeGreaterThan(familier);
  });

  it("garde tous les facteurs dans [0, 1]", () => {
    const f = nicheFactors(candidate({ year: 1920, voteCount: 1, lang: "ja" }), taste);
    for (const v of Object.values(f)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("nicheScore", () => {
  const f = { obscurity: 1, foreign: 0, age: 0, drift: 1 };

  it("pondère les trois facteurs actifs et renormalise", () => {
    // 0,55 / (0,55 + 0,25 + 0,2)
    expect(nicheScore(f, DEFAULT_QUERY.niche)).toBeCloseTo(0.55);
  });

  it("renormalise quand on désactive un facteur", () => {
    // only obscurity remains: it carries the whole score
    expect(nicheScore(f, { obscurity: true, foreign: false, age: false })).toBe(1);
  });

  it("renvoie 0 quand aucun facteur n'est actif, plutôt que de diviser par zéro", () => {
    expect(nicheScore(f, { obscurity: false, foreign: false, age: false })).toBe(0);
  });

  it("ignore l'écart à la collection, piloté par son propre curseur", () => {
    const sansDrift = nicheScore({ ...f, drift: 0 }, DEFAULT_QUERY.niche);
    expect(nicheScore(f, DEFAULT_QUERY.niche)).toBe(sansDrift);
  });
});

describe("rank", () => {
  const taste = buildTaste(collection());
  const query = (over = {}) => ({ ...DEFAULT_QUERY, ...over });

  it("attache le score et sa justification à chaque candidat", () => {
    const [out] = rank([candidate()], taste, query());
    expect(out).toHaveProperty("score");
    expect(out).toHaveProperty("affinity");
    expect(out).toHaveProperty("niche");
    expect(out).toHaveProperty("factors");
    expect(Array.isArray(out.reasons)).toBe(true);
  });

  it("classe par score décroissant", () => {
    const out = rank([candidate(), candidate({ voteCount: 20 }), candidate()], taste, query());
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
  });

  it("le curseur niche renverse l'ordre entre un connu et un confidentiel", () => {
    const connu = candidate({ tmdbId: 1, title: "Connu", voteCount: 45000, genres: ["Drame"] });
    const rare = candidate({ tmdbId: 2, title: "Rare", voteCount: 60, genres: ["Drame"] });

    const grandPublic = rank([connu, rare], taste, query({ nichePref: 0 }));
    expect(grandPublic[0].title).toBe("Connu");

    const pepite = rank([connu, rare], taste, query({ nichePref: 1 }));
    expect(pepite[0].title).toBe("Rare");
  });

  it("le curseur drift transforme l'écart en atout ou en pénalité", () => {
    const familier = candidate({ tmdbId: 1, title: "Familier", genres: ["Drame"], year: 2005 });
    const depaysant = candidate({ tmdbId: 2, title: "Dépaysant", genres: ["Western"], year: 1935 });
    const args = [[familier, depaysant], taste];

    expect(rank(...args, query({ driftPref: 1, nichePref: 0.5 }))[0].title).toBe("Dépaysant");
    expect(rank(...args, query({ driftPref: 0, nichePref: 0.5 }))[0].title).toBe("Familier");
  });

  it("ne laisse pas une même fiche source occuper la tête de liste", () => {
    /* Six films brought back by the same beloved card — hence favoured by
       the reco bonus — among other candidates. Without diversification the
       six would hog the head and the page would speak of one film only. */
    const from = { title: "Le film aimé", rating: 5 };
    const grappe = Array.from({ length: 6 }, (_, i) =>
      candidate({ tmdbId: 100 + i, title: `Grappe ${i}`, sources: [{ kind: "reco", from }] })
    );
    const autres = Array.from({ length: 5 }, (_, i) =>
      candidate({ tmdbId: 300 + i, title: `Autre ${i}` })
    );

    const out = rank([...grappe, ...autres], taste, query(), 8);
    // the first 7 places are composed before any carrying over to the tail
    const enTete = out.slice(0, 7).filter((c) => c.title.startsWith("Grappe"));
    expect(enTete).toHaveLength(2);
  });

  it("repousse les évincés en fin de liste au lieu de les perdre", () => {
    const from = { title: "Le film aimé", rating: 5 };
    const grappe = Array.from({ length: 5 }, (_, i) =>
      candidate({ tmdbId: 200 + i, sources: [{ kind: "reco", from }] })
    );
    expect(rank(grappe, taste, query())).toHaveLength(5);
  });

  it("respecte la limite demandée", () => {
    const beaucoup = Array.from({ length: 60 }, (_, i) => candidate({ tmdbId: i }));
    expect(rank(beaucoup, taste, query(), 10)).toHaveLength(10);
  });

  it("accepte une liste vide", () => {
    expect(rank([], taste, query())).toEqual([]);
  });

  it("fonctionne sans profil : le filtre décide seul", () => {
    const vide = buildTaste([]);
    const out = rank([candidate(), candidate()], vide, query());
    expect(out).toHaveLength(2);
    expect(out.every((c) => Number.isFinite(c.score))).toBe(true);
  });
});

describe("reasonsFor", () => {
  const taste = buildTaste(collection());
  const reasons = (c) => reasonsFor(c, nicheFactors(c, taste), taste);

  it("nomme la fiche à l'origine de la recommandation", () => {
    const c = candidate({ sources: [{ kind: "reco", from: { title: "Solaris", rating: 5 } }] });
    expect(reasons(c)[0]).toBe("parce que vous avez aimé Solaris");
  });

  it("résume quand plusieurs fiches convergent", () => {
    const c = candidate({
      sources: [
        { kind: "reco", from: { title: "Solaris" } },
        { kind: "reco", from: { title: "Stalker" } },
        { kind: "reco", from: { title: "Le Miroir" } },
      ],
    });
    expect(reasons(c)[0]).toBe("dans le sillage de Solaris et 2 autres");
  });

  it("cite le réalisateur suivi", () => {
    const c = candidate({ sources: [{ kind: "director", director: "Tarkovski" }] });
    expect(reasons(c)).toContain("de Tarkovski, que vous suivez");
  });

  it("chiffre la rareté quand elle est marquée", () => {
    const c = candidate({ voteCount: 40 });
    expect(reasons(c)).toContain("40 votes seulement");
  });

  it("signale un genre nouveau plutôt que de répéter les genres connus", () => {
    expect(reasons(candidate({ genres: ["Western"] }))).toContain(
      "un genre nouveau pour vous : Western"
    );
  });

  it("n'en affiche jamais plus de trois", () => {
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

  it("reste muet plutôt que d'inventer, quand rien ne se distingue", () => {
    const c = candidate({ voteCount: 45000, lang: "en", year: 2015, genres: [] });
    expect(reasons(c)).toEqual([]);
  });
});
