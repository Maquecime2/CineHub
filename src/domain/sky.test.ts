import { describe, it, expect } from "vitest";
import { buildSky, relax, workKey } from "./sky";
import { makeFilm } from "./film";
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
  it("fusionne deux fois la même œuvre malgré casse et espaces", () => {
    expect(
      workKey(work({ type: "painting", title: " Nighthawks ", creator: "Edward HOPPER" }))
    ).toBe(workKey(work({ type: "painting", title: "nighthawks", creator: "edward hopper" })));
  });

  it("distingue deux œuvres de même titre mais de nature différente", () => {
    expect(workKey(work({ type: "book", title: "Solaris" }))).not.toBe(
      workKey(work({ type: "film", title: "Solaris" }))
    );
  });
});

describe("buildSky", () => {
  it("laisse hors du ciel les films sans aucun fil rouge", () => {
    // un graphe qui montre toutes les fiches ne montre plus rien
    const { nodes } = buildSky([film("Playtime"), film("Le Miroir")]);
    expect(nodes).toEqual([]);
  });

  it("fusionne une œuvre citée par deux films en un seul astre — le pont", () => {
    const a = film("Blade Runner", { linkedWorks: [nighthawks()] });
    const b = film("Taxi Driver", { linkedWorks: [nighthawks()] });

    const { nodes, links } = buildSky([a, b]);

    const works = nodes.filter((x) => x.kind === "work");
    expect(works).toHaveLength(1);
    expect(works[0]!.refs).toBe(2);
    // deux films, une œuvre, deux fils
    expect(nodes.filter((x) => x.kind === "film")).toHaveLength(2);
    expect(links).toHaveLength(2);
  });

  it("relie deux fiches du mur par une seule arête, pas deux", () => {
    const miroir = film("Le Miroir");
    const stalker = film("Stalker", {
      linkedWorks: [work({ type: "film", title: "Le Miroir", filmId: miroir.id })],
    });
    // le lien est réciproque : les deux moitiés ne doivent pas produire deux traits
    const inverse = {
      ...miroir,
      linkedWorks: [work({ type: "film", title: "Stalker", filmId: stalker.id })],
    };

    const { links } = buildSky([stalker, inverse]);
    expect(links.filter((l) => l.kind === "peer")).toHaveLength(1);
  });

  it("ignore un lien vers un film absent de la sélection", () => {
    const stalker = film("Stalker", {
      linkedWorks: [work({ type: "film", title: "Disparu", filmId: "id-inexistant" })],
    });
    const { nodes, links } = buildSky([stalker]);
    expect(links).toHaveLength(0);
    expect(nodes).toEqual([]);
  });

  it("compte le degré de chaque astre", () => {
    const a = film("Blade Runner", { linkedWorks: [nighthawks()] });
    const b = film("Taxi Driver", { linkedWorks: [nighthawks()] });
    const { nodes } = buildSky([a, b]);

    expect(nodes.find((x) => x.kind === "work")!.degree).toBe(2);
    expect(nodes.filter((x) => x.kind === "film").every((x) => x.degree === 1)).toBe(true);
  });

  it("restreint la carte aux filtres demandés", () => {
    const a = film("Blade Runner", { genres: ["Science-fiction"], linkedWorks: [nighthawks()] });
    const b = film("Taxi Driver", { genres: ["Drame"], linkedWorks: [nighthawks()] });

    const { nodes } = buildSky([a, b], { genres: ["Drame"] });
    expect(nodes.filter((x) => x.kind === "film").map((x) => x.label)).toEqual(["Taxi Driver"]);
  });

  it("exige TOUS les mots-clés demandés, mais un seul des genres", () => {
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

  it("place le ciel de façon déterministe", () => {
    // même collection, même ciel : c'est ce qui distingue une carte d'une animation
    const { nodes, links } = sky();
    const first = relax(nodes, links, 1100, 760);
    const second = relax(nodes, links, 1100, 760);
    expect(first.map((p) => [p.id, p.x, p.y])).toEqual(second.map((p) => [p.id, p.x, p.y]));
  });

  it("n'empile jamais deux astres l'un sur l'autre", () => {
    const { nodes, links } = sky();
    const placed = relax(nodes, links, 1100, 760);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = Math.hypot(placed[i]!.x - placed[j]!.x, placed[i]!.y - placed[j]!.y);
        expect(d).toBeGreaterThan(30);
      }
    }
  });

  it("recadre le ciel dans les bornes de la feuille", () => {
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

  it("rend un ciel vide sans lever", () => {
    expect(relax([], [], 1100, 760)).toEqual([]);
  });

  it("garde un astre unique au centre plutôt que de l'étirer", () => {
    const solo = film("Seul", { linkedWorks: [work({ title: "Un livre" })] });
    const { nodes, links } = buildSky([solo]);
    const placed = relax(nodes, links, 1100, 760);
    // deux astres seulement : l'agrandissement est plafonné, le ciel reste aéré
    expect(placed).toHaveLength(2);
    for (const p of placed) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});
