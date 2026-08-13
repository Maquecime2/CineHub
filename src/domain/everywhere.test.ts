import { describe, it, expect } from "vitest";
import i18n from "../i18n";
import { searchEverywhere as sweep, excerptAround, groupByKind } from "./everywhere";
import { say } from "./wording";
import { makeFilm } from "./film";
import { makeThread } from "./threads";
import type { Film, Note } from "../types";

const film = (title: string, extra: Partial<Film> = {}) => makeFilm({ title, ...extra });

const page = (title: string, body: string, createdAt = 1_700_000_000_000): Note => ({
  id: `n-${title}`,
  title,
  body,
  createdAt,
});

const corpus = (
  o: { films?: Film[]; notes?: Note[]; threads?: ReturnType<typeof makeThread>[] } = {}
) => ({
  films: o.films || [],
  notes: o.notes || [],
  threads: o.threads || [],
});

/* THE SEARCH NOW SPEAKS THROUGH THE CALLER. `setupTests` pins the suite
   to French, so this wrapper is what a French reader really gets — and
   the assertions below go on being written in the language they read. */
const voice = { name: i18n.t.bind(i18n), lang: "fr" };
const searchEverywhere = (q: string, corpus: Parameters<typeof sweep>[1], perKind?: number) =>
  sweep(q, corpus, voice, perKind);

/** A hit's title or subtitle, as the screen shows it. */
const said = (w: Parameters<typeof say>[0]) => say(w, i18n.t.bind(i18n));

const kinds = (t: ReturnType<typeof searchEverywhere>) => [...new Set(t.map((x) => x.kind))];

describe("what triggers a search", () => {
  it("does not search on a single letter", () => {
    // one letter would match everything: that is not a question
    expect(searchEverywhere("a", corpus({ films: [film("Amarcord")] }))).toEqual([]);
  });

  it("does not search on emptiness", () => {
    expect(searchEverywhere("   ", corpus({ films: [film("Amarcord")] }))).toEqual([]);
  });
});

describe("the films", () => {
  it("finds by the title", () => {
    const t = searchEverywhere("amar", corpus({ films: [film("Amarcord")] }));
    expect(t).toHaveLength(1);
    expect(t[0]!.kind).toBe("film");
    expect(said(t[0]!.title)).toBe("Amarcord");
  });

  it("finds at last by a word from the REVIEW", () => {
    /* The tour has promised "a word from your notes" from the start, and
       it was the only field we did not search. */
    const f = film("Un film", { review: "la scène du train m'a bouleversé" });
    const t = searchEverywhere("bouleversé", corpus({ films: [f] }));
    expect(t.map((x) => said(x.title))).toEqual(["Un film"]);
  });

  it("finds by a word from the free notes", () => {
    const f = film("Un film", { notes: "vu en salle, copie neuve" });
    expect(searchEverywhere("copie", corpus({ films: [f] }))).toHaveLength(1);
  });

  it("puts the title before the review", () => {
    const films = [film("Quelqu'un cite Solaris", { review: "" }), film("Solaris", { review: "" })];
    expect(said(searchEverywhere("solaris", corpus({ films }))[0]!.title)).toBe("Solaris");
  });

  it("does not answer 'img' for every illustrated card", () => {
    // stills are written [img:3] in the text: those are not words
    const f = film("Illustré", { review: "une image forte [img:3] puis la nuit" });
    expect(searchEverywhere("img", corpus({ films: [f] }))).toEqual([]);
  });

  it("brings back the passage where the word sits", () => {
    const f = film("Un film", { review: "le plan final est une gifle, et je n'y étais pas prêt" });
    const t = searchEverywhere("gifle", corpus({ films: [f] }));
    expect(t[0]!.excerpt).toContain("gifle");
  });
});

describe("the notebook pages", () => {
  it("finds by a page's title", () => {
    const t = searchEverywhere("liste", corpus({ notes: [page("Ma liste", "rien")] }));
    expect(t).toHaveLength(1);
    expect(t[0]!.kind).toBe("page");
    expect(said(t[0]!.title)).toBe("Ma liste");
  });

  it("finds by the body, and brings back the passage", () => {
    const t = searchEverywhere(
      "Rohmer",
      corpus({ notes: [page("Notes", "revoir du Rohmer cet été")] })
    );
    expect(t[0]!.excerpt).toContain("Rohmer");
  });

  it("names an untitled page rather than returning an empty line", () => {
    const t = searchEverywhere("chose", corpus({ notes: [page("", "une chose")] }));
    expect(said(t[0]!.title)).toBe("Sans titre");
  });
});

describe("the motifs", () => {
  it("finds a motif from the catalogue and says how many cards carry it", () => {
    const films = [film("A", { motifs: ["melancholy"] }), film("B", { motifs: ["melancholy"] })];
    const t = searchEverywhere("mélanco", corpus({ films }));
    const m = t.find((x) => x.kind === "motif");
    expect(m!.motifId).toBe("melancholy");
    expect(said(m!.title)).toBe("Mélancolie");
    expect(said(m!.subtitle)).toBe("2 fiches le portent");
  });

  it("says plainly that a motif is set nowhere", () => {
    const m = searchEverywhere("mélanco", corpus()).find((x) => x.kind === "motif");
    expect(said(m!.subtitle)).toBe("sur aucune fiche");
  });
});

describe("the threads", () => {
  it("finds a thread by its name", () => {
    const thread = makeThread({ label: "Les fins tristes", motif: null });
    const t = searchEverywhere("tristes", corpus({ threads: [thread] }));
    expect(said(t.find((x) => x.kind === "thread")!.title)).toBe("Les fins tristes");
  });

  it("finds a thread by what was written under it", () => {
    const thread = makeThread({ label: "Un fil", note: "tout ce qui parle de deuil" });
    const t = searchEverywhere("deuil", corpus({ threads: [thread] }));
    const f = t.find((x) => x.kind === "thread");
    expect(f).toBeDefined();
    expect(f!.excerpt).toContain("deuil");
  });
});

describe("the people", () => {
  it("finds somebody from the credits, despite the accents", () => {
    const films = [film("A", { crew: { image: ["Henri Decaë"] } })];
    const t = searchEverywhere("decae", corpus({ films }));
    const p = t.find((x) => x.kind === "person")!;
    expect(p.person).toBe("henri decae");
    expect(said(p.title)).toBe("Henri Decaë");
  });

  it("says in what capacity and over how many films", () => {
    const films = [film("A", { director: "Ozu" }), film("B", { director: "Ozu" })];
    const p = searchEverywhere("ozu", corpus({ films })).find((x) => x.kind === "person");
    expect(said(p!.subtitle)).toBe("2 films · réalisation");
  });
});

describe("the crossing", () => {
  it("shows several kinds at once", () => {
    const films = [
      film("Mélancolie du départ", { motifs: ["melancholy"], director: "Mélanie Ozu" }),
    ];
    const notes = [page("Mélancolie", "une page")];
    const t = searchEverywhere("mélanc", corpus({ films, notes }));
    expect(kinds(t)).toEqual(expect.arrayContaining(["film", "page", "motif"]));
  });

  /* THE WHOLE POINT OF THE THING: one kind does not drown another.
     Without bounding PER KIND, a thousand films would bury the one
     notebook page that answers, and you would never know it existed. */
  it("does not let a thousand films bury a notebook page", () => {
    const films = Array.from({ length: 500 }, (_, i) => film(`Nuit ${i}`));
    const notes = [page("Une nuit", "la nuit américaine")];
    const t = searchEverywhere("nuit", corpus({ films, notes }), 5);
    expect(t.filter((x) => x.kind === "film")).toHaveLength(5);
    expect(t.filter((x) => x.kind === "page")).toHaveLength(1);
  });

  it("returns distinct keys, usable as identity", () => {
    const films = [film("Mélancolie", { motifs: ["melancholy"] })];
    const keys = searchEverywhere("mélanc", corpus({ films })).map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("excerptAround", () => {
  it("cuts around the word and marks the cuts", () => {
    const long = `${"a".repeat(200)} trouvaille ${"b".repeat(200)}`;
    const e = excerptAround(long, "trouvaille")!;
    expect(e.startsWith("…")).toBe(true);
    expect(e.endsWith("…")).toBe(true);
    expect(e).toContain("trouvaille");
  });

  it("marks no cut when there is none", () => {
    expect(excerptAround("un texte court", "texte")).toBe("un texte court");
  });

  it("returns the passage WITH its accents, though we search without", () => {
    expect(excerptAround("une scène déchirante", "scene")).toContain("scène");
  });

  it("returns nothing when the word is not there", () => {
    expect(excerptAround("un texte", "absent")).toBeUndefined();
  });
});

describe("groupByKind", () => {
  it("files the kinds in a stable order and drops the empty ones", () => {
    const films = [film("Ozu vu", { director: "Ozu" })];
    const g = groupByKind(searchEverywhere("ozu", corpus({ films })));
    expect(g.map((x) => x.kind)).toEqual(["film", "person"]);
  });
});
