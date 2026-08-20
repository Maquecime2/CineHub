import { describe, it, expect } from "vitest";
import { buildLineage, directorKeys, nodeId, primaryDirector } from "./lineageMap";
import { makeBond } from "./bonds";
import { makeCourse, makeStep } from "./course";
import { relax } from "./sky";
import { makeFilm } from "./film";

/* ============================================================
   THE ONE RULE OF THE MAP
   ============================================================

   The nodes are the film-makers NAMED IN THE RUN, plus those NAMED IN A
   BOND — and every case below is a reading of that sentence.

   Two of them matter more than the rest. A director put into the run is
   a node STRAIGHT AWAY, tied to nobody: without that, clicking an entry
   in the column would land on nothing and the two halves of the screen
   would only answer one another once somebody had already drawn a
   graph. And an ORPHAN — somebody whose last card has left the
   collection — is still a node, under the name the bond kept: erasing a
   card is not the same act as unlearning who taught whom, and only one
   of the two was ever asked for.
   ============================================================ */

const OZU = makeFilm({ id: "a", title: "Late Spring", director: "Yasujirō Ozu" });
const HOU = makeFilm({ id: "b", title: "Flowers of Shanghai", director: "Hou Hsiao-hsien" });
const DUO = makeFilm({ id: "c", title: "The Red Shoes", director: "Powell, Pressburger" });
const NOBODY = makeFilm({ id: "d", title: "Anonymous", director: "" });
const films = [OZU, HOU, DUO, NOBODY];

const run = (...ids: string[]) => makeCourse({ steps: ids.map((id) => makeStep(id)) });
const bond = (kind: "master" | "affinity", a: string, b: string) =>
  makeBond({ kind, fromName: a, toName: b })!;

describe("who directed a film", () => {
  it("splits a field written with commas", () => {
    expect(directorKeys(DUO)).toEqual(["powell", "pressburger"]);
  });

  it("files a run under the FIRST credited, as the card reads", () => {
    expect(primaryDirector(DUO)?.name).toBe("Powell");
  });

  it("gives nobody at all rather than a name out of the catalogue", () => {
    /* `UNKNOWN_DIRECTOR` is DATA. Naming this node from a catalogue key
       would freeze the language of the day into somebody's course. */
    expect(primaryDirector(NOBODY)).toBeNull();
    expect(directorKeys(NOBODY)).toEqual([]);
  });
});

describe("what gets onto the map", () => {
  it("puts a director into it as soon as one of their films is in the run", () => {
    /* Alone, tied to nothing — which is exactly the point: clicking an
       entry must never be a dead end. */
    const { nodes, links } = buildLineage(films, [], run("a"));
    expect(nodes.map((n) => n.key)).toEqual(["yasujiro ozu"]);
    expect(links).toEqual([]);
  });

  it("puts BOTH of a co-directed film in", () => {
    const { nodes } = buildLineage(films, [], run("c"));
    expect(nodes.map((n) => n.key).sort()).toEqual(["powell", "pressburger"]);
  });

  it("puts a director into it because a bond names them, run or no run", () => {
    const { nodes } = buildLineage(films, [bond("master", "Ozu", "Hou Hsiao-hsien")], null);
    expect(nodes).toHaveLength(2);
  });

  it("marks as hollow the one nobody has put in the run", () => {
    const { nodes } = buildLineage(
      films,
      [bond("master", "Yasujirō Ozu", "Hou Hsiao-hsien")],
      run("a")
    );
    const hou = nodes.find((n) => n.key === "hou hsiao-hsien")!;
    expect(hou.inCourse).toBe(0);
    /* The hollow is the screen's invitation, so the panel must still be
       able to say what it holds. */
    expect(hou.owned).toBe(1);
    expect(hou.orphan).toBe(false);
  });

  it("keeps an orphan, under the name the bond kept", () => {
    const { nodes } = buildLineage(films, [bond("master", "Jean Epstein", "Yasujirō Ozu")], null);
    const gone = nodes.find((n) => n.key === "jean epstein")!;
    expect(gone.orphan).toBe(true);
    expect(gone.name).toBe("Jean Epstein");
    expect(gone.owned).toBe(0);
  });

  it("prefers the collection's spelling to the one typed into a bond", () => {
    /* "Ozu" was typed; the binder writes "Yasujirō Ozu" everywhere else,
       and the map must not be the one screen calling him something
       different. */
    const { nodes } = buildLineage(films, [bond("master", "yasujiro ozu", "Hou")], run("a"));
    expect(nodes.find((n) => n.key === "yasujiro ozu")!.name).toBe("Yasujirō Ozu");
  });

  it("counts the bonds around each node", () => {
    const bonds = [
      bond("master", "Yasujirō Ozu", "Hou Hsiao-hsien"),
      bond("affinity", "Hou Hsiao-hsien", "Powell"),
    ];
    const { nodes } = buildLineage(films, bonds, null);
    expect(nodes.find((n) => n.key === "hou hsiao-hsien")!.degree).toBe(2);
    expect(nodes.find((n) => n.key === "powell")!.degree).toBe(1);
  });

  it("counts a director once per step, twice for two of their films", () => {
    const { nodes } = buildLineage(films, [], run("a", "a", "b"));
    expect(nodes.find((n) => n.key === "yasujiro ozu")!.inCourse).toBe(2);
  });

  it("ignores a step whose card has left the collection", () => {
    const { nodes } = buildLineage(films, [], run("a", "gone"));
    expect(nodes).toHaveLength(1);
  });
});

describe("the springs handed to the relaxation", () => {
  it("pulls a filiation closer than an opposition", () => {
    /* `relax` reads `kind` and `force` and nothing else; all four bonds
       ride on "peer" so that not a line of it has to change. */
    const master = buildLineage(films, [bond("master", "Ozu", "Hou")], null).links[0]!;
    expect(master.kind).toBe("peer");
    expect(master.force).toBe(3);
    const counter = buildLineage(
      films,
      [makeBond({ kind: "counterpoint", fromName: "Ozu", toName: "Hou" })!],
      null
    ).links[0]!;
    expect(counter.force).toBe(1);
  });
});

describe("laying the map out", () => {
  const bonds = [bond("master", "Yasujirō Ozu", "Hou Hsiao-hsien")];

  it("places people with the very relaxation the sky uses", () => {
    const { nodes, links } = buildLineage(films, bonds, run("a", "b"));
    const placed = relax(nodes, links, 640, 420);
    expect(placed).toHaveLength(2);
    for (const p of placed) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      // the node's own fields survive the placing
      expect(p.key).toBeTruthy();
    }
  });

  it("gives the same positions for the same input, twice over", () => {
    /* Sown and not drawn: a map that shuffled itself between two
       glances would not be a map. */
    const { nodes, links } = buildLineage(films, bonds, run("a", "b"));
    const once = relax(nodes, links, 640, 420);
    const twice = relax(nodes, links, 640, 420);
    expect(twice.map((p) => [p.id, p.x, p.y])).toEqual(once.map((p) => [p.id, p.x, p.y]));
  });

  it("places a node that is nobody's neighbour", () => {
    const { nodes, links } = buildLineage(films, [], run("a"));
    expect(relax(nodes, links, 640, 420)).toHaveLength(1);
  });

  it("prefixes an id, so two maps never collide on one", () => {
    expect(nodeId("ozu")).toBe("p:ozu");
  });
});
