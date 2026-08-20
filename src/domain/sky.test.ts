import { describe, it, expect } from "vitest";
import { buildSky, buildSkyWithCrew, neighbourhood, relax, suggestLinks, workKey } from "./sky";
import { makeFilm } from "./film";
import { effectiveThreads, makeThread } from "./threads";
import type { Film, LinkedWork } from "../types";

let n = 0;
const work = (partial: Partial<LinkedWork> = {}): LinkedWork => ({
  id: `w${n++}`,
  type: "book",
  title: "Une œuvre",
  creator: "",
  note: "",
  ...partial,
});

const film = (title: string, partial: Partial<Film> = {}) => makeFilm({ title, ...partial });

const nighthawks = () => work({ type: "painting", title: "Nighthawks", creator: "Edward Hopper" });

describe("workKey", () => {
  it("merges the same work twice over despite case and spaces", () => {
    expect(
      workKey(work({ type: "painting", title: " Nighthawks ", creator: "Edward HOPPER" }))
    ).toBe(workKey(work({ type: "painting", title: "nighthawks", creator: "edward hopper" })));
  });

  it("tells apart two works with the same title but a different nature", () => {
    expect(workKey(work({ type: "book", title: "Solaris" }))).not.toBe(
      workKey(work({ type: "film", title: "Solaris" }))
    );
  });
});

describe("buildSky", () => {
  it("leaves out of the sky the films with no red thread at all", () => {
    // a graph that shows every card no longer shows anything
    const { nodes } = buildSky([film("Playtime"), film("Le Miroir")]);
    expect(nodes).toEqual([]);
  });

  it("merges a work cited by two films into a single star — the bridge", () => {
    const a = film("Blade Runner", { linkedWorks: [nighthawks()] });
    const b = film("Taxi Driver", { linkedWorks: [nighthawks()] });

    const { nodes, links } = buildSky([a, b]);

    const works = nodes.filter((x) => x.kind === "work");
    expect(works).toHaveLength(1);
    expect(works[0]!.refs).toBe(2);
    // two films, one work, two threads
    expect(nodes.filter((x) => x.kind === "film")).toHaveLength(2);
    expect(links).toHaveLength(2);
  });

  it("links two cards on the wall with one edge, not two", () => {
    const mirror = film("Le Miroir");
    const stalker = film("Stalker", {
      linkedWorks: [work({ type: "film", title: "Le Miroir", filmId: mirror.id })],
    });
    // the link is reciprocal: the two halves must not produce two lines
    const inverse = {
      ...mirror,
      linkedWorks: [work({ type: "film", title: "Stalker", filmId: stalker.id })],
    };

    const { links } = buildSky([stalker, inverse]);
    expect(links.filter((l) => l.kind === "peer")).toHaveLength(1);
  });

  it("ignores a link to a film missing from the selection", () => {
    const stalker = film("Stalker", {
      linkedWorks: [work({ type: "film", title: "Disparu", filmId: "id-inexistant" })],
    });
    const { nodes, links } = buildSky([stalker]);
    expect(links).toHaveLength(0);
    expect(nodes).toEqual([]);
  });

  it("counts every star's degree", () => {
    const a = film("Blade Runner", { linkedWorks: [nighthawks()] });
    const b = film("Taxi Driver", { linkedWorks: [nighthawks()] });
    const { nodes } = buildSky([a, b]);

    expect(nodes.find((x) => x.kind === "work")!.degree).toBe(2);
    expect(nodes.filter((x) => x.kind === "film").every((x) => x.degree === 1)).toBe(true);
  });

  it("restricts the map to the filters asked for", () => {
    const a = film("Blade Runner", { genres: ["Science-fiction"], linkedWorks: [nighthawks()] });
    const b = film("Taxi Driver", { genres: ["Drame"], linkedWorks: [nighthawks()] });

    const { nodes } = buildSky([a, b], { genres: ["Drame"] });
    expect(nodes.filter((x) => x.kind === "film").map((x) => x.label)).toEqual(["Taxi Driver"]);
  });

  it("requires ALL the keywords asked for, but only one of the genres", () => {
    const f = film("X", { themes: ["Mémoire"], genres: ["Drame"], linkedWorks: [nighthawks()] });

    expect(buildSky([f], { tags: ["Mémoire", "Zone"] }).nodes).toEqual([]);
    expect(buildSky([f], { tags: ["Mémoire"] }).nodes.length).toBeGreaterThan(0);
    expect(buildSky([f], { genres: ["Drame", "Comédie"] }).nodes.length).toBeGreaterThan(0);
  });
});

describe("relax", () => {
  const sky = () => {
    const a = film("Blade Runner", { linkedWorks: [nighthawks(), work({ title: "Do Androids" })] });
    const b = film("Taxi Driver", { linkedWorks: [nighthawks()] });
    const c = film("Persona", { linkedWorks: [work({ title: "Le Cri", type: "painting" })] });
    return buildSky([a, b, c]);
  };

  it("places the sky deterministically", () => {
    // same collection, same sky: that is what tells a map from an animation
    const { nodes, links } = sky();
    const first = relax(nodes, links, 1100, 760);
    const second = relax(nodes, links, 1100, 760);
    expect(first.map((p) => [p.id, p.x, p.y])).toEqual(second.map((p) => [p.id, p.x, p.y]));
  });

  it("never stacks two stars on top of each other", () => {
    const { nodes, links } = sky();
    const placed = relax(nodes, links, 1100, 760);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = Math.hypot(placed[i]!.x - placed[j]!.x, placed[i]!.y - placed[j]!.y);
        expect(d).toBeGreaterThan(30);
      }
    }
  });

  it("frames the sky within the sheet's bounds", () => {
    const { nodes, links } = sky();
    const W = 1100,
      H = 760;
    const placed = relax(nodes, links, W, H);
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(H);
    }
  });

  it("returns an empty sky without throwing", () => {
    expect(relax([], [], 1100, 760)).toEqual([]);
  });

  it("keeps a lone star in the centre rather than stretching it", () => {
    const solo = film("Seul", { linkedWorks: [work({ title: "Un livre" })] });
    const { nodes, links } = buildSky([solo]);
    const placed = relax(nodes, links, 1100, 760);
    // two stars only: magnification is capped, the sky stays airy
    expect(placed).toHaveLength(2);
    for (const p of placed) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe("suggestLinks", () => {
  it("links two films that share a cinematographer", () => {
    const a = film("A", { crew: { image: ["Decaë"] } });
    const b = film("B", { crew: { image: ["Decaë"] } });
    const links = suggestLinks([a, b]);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      kind: "crew",
      why: [{ role: "image", name: "Decaë" }],
    });
  });

  /* THE GUARD. An actor present everywhere would link everything to
     everything and bring back the unreadable mass `buildSky` had driven
     out. */
  it("ignores a person present in too many films", () => {
    const films = Array.from({ length: 6 }, (_, i) => film(`F${i}`, { cast: ["Omniprésent"] }));
    expect(suggestLinks(films)).toEqual([]);
  });

  it("still links at the upper bound, no further", () => {
    const three = Array.from({ length: 3 }, (_, i) => film(`F${i}`, { cast: ["X"] }));
    expect(suggestLinks(three)).toHaveLength(3); // trois paires
    expect(suggestLinks([...three, film("F3", { cast: ["X"] })])).toEqual([]);
  });

  it("does not link a film to itself, nor a lone person", () => {
    expect(suggestLinks([film("A", { cast: ["Delon", "Delon"] })])).toEqual([]);
  });

  it("strings only one edge for two reasons, but gives them all", () => {
    const a = film("A", { crew: { image: ["Decaë"], musique: ["Rubinstein"] } });
    const b = film("B", { crew: { image: ["Decaë"], musique: ["Rubinstein"] } });
    const links = suggestLinks([a, b]);
    expect(links).toHaveLength(1);
    expect(links[0]!.why!.map((w) => `${w.role}·${w.name}`).sort()).toEqual([
      "image·Decaë",
      "musique·Rubinstein",
    ]);
  });

  it("counts the director like everyone else, and splits co-directions", () => {
    const a = film("A", { director: "Coen, Coen" });
    const b = film("B", { director: "Coen" });
    expect(suggestLinks([a, b])).toHaveLength(1);
  });

  it("is not caught out by case or spaces", () => {
    const a = film("A", { cast: [" delon "] });
    const b = film("B", { cast: ["Delon"] });
    expect(suggestLinks([a, b])).toHaveLength(1);
  });

  it("returns nothing from a collection with no credits", () => {
    expect(suggestLinks([film("A"), film("B")])).toEqual([]);
  });
});

describe("buildSkyWithCrew", () => {
  it("leaves the hand-made map intact when nothing is shared", () => {
    const a = film("A", { linkedWorks: [nighthawks()] });
    const base = buildSky([a]);
    const withCrew = buildSkyWithCrew([a]);
    expect(withCrew.nodes).toHaveLength(base.nodes.length);
    expect(withCrew.links).toHaveLength(base.links.length);
  });

  /* A film that ONLY a kinship links is not in the base map: without
     that added node, the edge would point into the void. */
  it("brings into the sky a film no red thread was holding", () => {
    const a = film("A", { crew: { image: ["Decaë"] } });
    const b = film("B", { crew: { image: ["Decaë"] } });
    expect(buildSky([a, b]).nodes).toEqual([]);
    const withCrew = buildSkyWithCrew([a, b]);
    expect(withCrew.nodes.map((n) => n.label).sort()).toEqual(["A", "B"]);
    expect(withCrew.links).toHaveLength(1);
  });

  it("does not double a red thread already strung between the same two films", () => {
    const a = film("A", { cast: ["Delon"] });
    const b = film("B", { cast: ["Delon"] });
    a.linkedWorks = [work({ type: "film", title: "B", filmId: b.id, id: "l1", pairId: "p" })];
    b.linkedWorks = [work({ type: "film", title: "A", filmId: a.id, id: "l2", pairId: "p" })];
    const withCrew = buildSkyWithCrew([a, b]);
    expect(withCrew.links).toHaveLength(1);
    expect(withCrew.links[0]!.kind).toBe("peer");
  });

  it("recounts the degree over the whole graph", () => {
    const a = film("A", { crew: { image: ["Decaë"] } });
    const b = film("B", { crew: { image: ["Decaë"] } });
    const withCrew = buildSkyWithCrew([a, b]);
    expect(withCrew.nodes.every((n) => n.degree === 1)).toBe(true);
  });

  it("respects the filters of the base map", () => {
    const a = film("A", { crew: { image: ["Decaë"] }, genres: ["Policier"] });
    const b = film("B", { crew: { image: ["Decaë"] }, genres: ["Comédie"] });
    expect(buildSkyWithCrew([a, b], { genres: ["Policier"] }).links).toEqual([]);
  });
});

describe("suggestLinks — the nature of the kinships", () => {
  it("names the trade, and not only the person", () => {
    const a = film("A", { director: "Melville", cast: ["Delon"], crew: { musique: ["R"] } });
    const b = film("B", { director: "Melville", cast: ["Delon"], crew: { musique: ["R"] } });
    const roles = suggestLinks([a, b])[0]!
      .why!.map((w) => w.role)
      .sort();
    expect(roles).toEqual(["interprétation", "musique", "réalisation"]);
  });

  /* Keywords are the only kinship that comes from the user and not from
     a credit list. */
  it("links two films by a shared keyword", () => {
    const a = film("A", { themes: ["solitude urbaine"] });
    const b = film("B", { themes: ["solitude urbaine"] });
    expect(suggestLinks([a, b])[0]!.why).toEqual([{ role: "thème", name: "solitude urbaine" }]);
  });

  it("applies the same threshold to keywords as to people", () => {
    const films = Array.from({ length: 6 }, (_, i) => film(`F${i}`, { themes: ["partout"] }));
    expect(suggestLinks(films)).toEqual([]);
  });

  /* A composer who also acts in both films is TWO kinships: conflating
     them would make one of them disappear. */
  it("does not conflate two roles carried by the same name", () => {
    const a = film("A", { cast: ["Ozu"], crew: { scénario: ["Ozu"] } });
    const b = film("B", { cast: ["Ozu"], crew: { scénario: ["Ozu"] } });
    expect(suggestLinks([a, b])[0]!.why).toHaveLength(2);
  });

  it("ignores a crew trade we do not follow", () => {
    const a = film("A", { crew: { montage: ["X"] } });
    const b = film("B", { crew: { montage: ["X"] } });
    expect(suggestLinks([a, b])).toEqual([]);
  });
});

describe("neighbourhood", () => {
  /* A — B — C — D, in a chain. */
  const chain = () => {
    const nodes = ["A", "B", "C", "D"].map((id) => ({
      id: `f:${id}`,
      kind: "film" as const,
      label: id,
      sub: "",
      degree: 0,
    }));
    const links = [
      { a: "f:A", b: "f:B", kind: "crew" as const },
      { a: "f:B", b: "f:C", kind: "crew" as const },
      { a: "f:C", b: "f:D", kind: "crew" as const },
    ];
    return { nodes, links };
  };

  it("returns only the focus and its direct neighbours", () => {
    const { nodes, links } = chain();
    const v = neighbourhood(nodes, links, "f:B", 1);
    expect(v.nodes.map((n) => n.label).sort()).toEqual(["A", "B", "C"]);
  });

  it("widens by one more step when asked", () => {
    const { nodes, links } = chain();
    expect(
      neighbourhood(nodes, links, "f:A", 2)
        .nodes.map((n) => n.label)
        .sort()
    ).toEqual(["A", "B", "C"]);
  });

  /* A thread running out to a star that is not displayed leads nowhere
     and suggests an invisible neighbour. */
  it("only keeps an edge if BOTH its ends are shown", () => {
    const { nodes, links } = chain();
    const v = neighbourhood(nodes, links, "f:B", 1);
    expect(v.links).toHaveLength(2);
    expect(v.links.every((l) => ["f:A", "f:B", "f:C"].includes(l.a))).toBe(true);
  });

  it("returns the focus alone when nothing links it", () => {
    const { nodes } = chain();
    expect(neighbourhood(nodes, [], "f:A", 1).nodes.map((n) => n.label)).toEqual(["A"]);
  });

  it("returns nothing for a focus that does not exist", () => {
    const { nodes, links } = chain();
    expect(neighbourhood(nodes, links, "f:ZZZ", 1)).toEqual({ nodes: [], links: [] });
  });
});

describe("threads in the sky", () => {
  it("brings a thread's members in, even with no red thread strung", () => {
    const a = film("A", { motifs: ["hero-dies"] });
    const b = film("B", { motifs: ["hero-dies"] });
    const thread = makeThread({ label: "Le héros meurt", motif: "hero-dies" });
    const { nodes, links } = buildSky([a, b], {}, { threads: [thread] });

    expect(nodes.filter((n) => n.kind === "film")).toHaveLength(2);
    const star = nodes.find((n) => n.kind === "thread");
    expect(star?.label).toBe("Le héros meurt");
    expect(links.filter((l) => l.kind === "thread")).toHaveLength(2);
  });

  it("does not hang in the sky a thread nobody carries", () => {
    const thread = makeThread({ label: "Vide", motif: "hero-dies" });
    const { nodes } = buildSky([film("A")], {}, { threads: [thread] });
    expect(nodes).toEqual([]);
  });

  it("does not duplicate a film that is both linked and a thread member", () => {
    const a = film("A", { linkedWorks: [nighthawks()], motifs: ["hero-dies"] });
    const thread = makeThread({ label: "x", motif: "hero-dies" });
    const { nodes } = buildSky([a], {}, { threads: [thread] });
    expect(nodes.filter((n) => n.filmId === a.id)).toHaveLength(1);
  });

  /* THE STAR NOBODY ASKED FOR. Laying the same motif on two cards is the
     whole gesture now — there is no promotion left to forget, and nothing
     is stored until somebody changes the star's name or its colour. */
  it("hangs a star with nothing stored at all", () => {
    const cards = [film("A", { motifs: ["hero-dies"] }), film("B", { motifs: ["hero-dies"] })];
    const { nodes } = buildSky(cards, {}, { threads: effectiveThreads(cards, []) });
    expect(nodes.find((n) => n.kind === "thread")?.motif).toBe("hero-dies");
  });

  it("names and counts the star in the reader's language", () => {
    const cards = [film("A", { motifs: ["hero-dies"] }), film("B", { motifs: ["hero-dies"] })];
    const { nodes } = buildSky(cards, {}, { threads: effectiveThreads(cards, []), name: (k) => k });
    const star = nodes.find((n) => n.kind === "thread");
    expect(star?.label).toBe("motifs.labels.hero-dies");
    // and not "2 films", which read the same in French
    expect(star?.sub).toBe("constellation.filmCount");
  });
});

describe("the pins", () => {
  it("brings into the sky a film linked to nothing", () => {
    const a = film("A");
    const { nodes } = buildSky([a, film("B")], {}, { pinned: [a.id] });
    expect(nodes.map((n) => n.filmId)).toEqual([a.id]);
    expect(nodes[0]?.pinned).toBe(true);
  });

  it("does not mark as pinned a film its own threads already hold", () => {
    const a = film("A", { linkedWorks: [nighthawks()] });
    const { nodes } = buildSky([a], {}, { pinned: [a.id] });
    expect(nodes.find((n) => n.filmId === a.id)?.pinned).toBe(false);
  });

  it("ignores a pin that points at no card", () => {
    expect(buildSky([film("A")], {}, { pinned: ["fantôme"] }).nodes).toEqual([]);
  });
});

describe("the relation an edge carries", () => {
  it("reads in the direction of the line", () => {
    const a = makeFilm({ id: "a1", title: "A" });
    const b = makeFilm({ id: "b2", title: "B" });
    const linkedOne = [
      {
        ...a,
        linkedWorks: [
          work({ type: "film", filmId: b.id, pairId: "p", relation: "sequel-to", force: 3 }),
        ],
      },
      {
        ...b,
        linkedWorks: [
          work({ type: "film", filmId: a.id, pairId: "p", relation: "precedes", force: 3 }),
        ],
      },
    ];
    const edge = buildSky(linkedOne).links.find((l) => l.kind === "peer");
    // "a1" sorts before "b2": the edge starts at A, and so carries what A says
    expect(edge?.a).toBe(`f:${a.id}`);
    expect(edge?.relation).toBe("sequel-to");
    expect(edge?.force).toBe(3);
  });
});
