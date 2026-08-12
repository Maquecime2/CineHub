/* ============================================================
   THE TOUR'S SAFETY NET

   These tests do not check a computation: they check a PROMISE of
   upkeep. A view added to the product without a tour makes the suite
   fail, and that is their whole purpose — the rule written in CLAUDE.md
   would not hold six months if nothing held it.
   ============================================================ */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { TOURS, tourForView } from "./steps";

/* The list of the product's views, copied by hand from `FolderTabs`'
   `View` union: a type does not survive compilation, and it is precisely
   here that we want it readable at run time. `skinlab` is not one of
   them — it is a development tool, not a view. */
const VIEWS = [
  "library",
  "watchlist",
  "credits",
  "reco",
  "constellation",
  "notebook",
  "import",
  "thread",
  "lists",
  "detail",
  "almanac",
] as const;

describe("la visite couvre le produit", () => {
  it.each(VIEWS)("« %s » a sa visite", (vue) => {
    const t = tourForView(vue);
    expect(t, `la vue « ${vue} » n'a pas de visite — voir CLAUDE.md`).toBeDefined();
    expect(t!.steps.length).toBeGreaterThan(0);
  });

  it("n'a pas de visite orpheline", () => {
    for (const clé of Object.keys(TOURS)) {
      if (clé === "global") continue;
      expect(VIEWS).toContain(clé as (typeof VIEWS)[number]);
    }
  });
});

describe("les étapes se tiennent", () => {
  const allOfThem = Object.entries(TOURS).flatMap(([id, t]) =>
    t.steps.map((s, i) => ({ id, i, s }))
  );

  it("dit toujours quelque chose", () => {
    for (const { id, i, s } of allOfThem) {
      expect(s.title.trim(), `${id}[${i}]`).not.toBe("");
      expect(s.body.trim(), `${id}[${i}]`).not.toBe("");
    }
  });

  it("ne vise que par un attribut de visite", () => {
    for (const { id, i, s } of allOfThem) {
      if (s.target === null) continue;
      expect(s.target, `${id}[${i}]`).toMatch(/^\[data-(tour|tab-rail)/);
    }
  });

  /* The global tour travels: every step must say in which view it
     plays, failing which it points at a target left behind in the
     previous view. */
  it("la visite globale nomme la vue de chaque étape", () => {
    for (const [i, s] of TOURS.global!.steps.entries()) {
      expect(s.view, `global[${i}] : ${s.title}`).toBeDefined();
    }
  });

  /* THE FILM FOLDER IS READ IN THREE TABS, and a step can no longer make
     do with naming its target: that target is only mounted if its tab is
     open. A step with no `tab` would therefore aim at an absent card
     three times out of four — it would be skipped like a missing target,
     after seven hundred milliseconds of veil.

     The rule holds ONLY for this tour: it is the product's only view
     that has tabs. */
  it("chaque étape du dossier film dit son intercalaire", () => {
    for (const [i, s] of TOURS.detail!.steps.entries()) {
      expect(s.tab, `detail[${i}] : ${s.title}`).toBeDefined();
    }
  });

  it("aucune autre visite ne parle d'intercalaire", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      if (id === "detail") continue;
      for (const s of t.steps) expect(s.tab, `${id} : ${s.title}`).toBeUndefined();
    }
  });

  /* Page tours, for their part, must NEVER navigate: we launch them
     from the page they describe. */
  it("les visites de page ne naviguent pas", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      if (id === "global") continue;
      for (const s of t.steps) expect(s.view, `${id} : ${s.title}`).toBeUndefined();
    }
  });
});

/* ============================================================
   EVERY TARGET EXISTS SOMEWHERE

   A step whose anchor is laid nowhere shows nothing: at best it is
   `optional` and gets skipped after seven hundred milliseconds of opaque
   veil, at worst it leaves the tour stuck. None of the tests above
   catches it, because they only read `steps.ts` — and that is exactly
   how "credits-dossier" was able to stay in the global tour,
   permanently dead, without anything saying so.

   SO WE READ THE FILES. Two forms of anchor coexist in the project and
   the test must know both: `data-tour="…"` in bare JSX, and the `tour="…"`
   property that `Cardstock` translates into an attribute. Looking for
   only one would give a harvest of false positives.

   This test does NOT say the anchor is mounted on screen at the moment
   of the step — that can only be verified by playing the tour. It says
   the anchor exists in the product, which is the cheap half of the
   problem.
   ============================================================ */
/* The project root, and not `import.meta.url`: Vite rewrites the latter
   into a served module URL, which is not a file path. */
const SRC = join(process.cwd(), "src");

const files = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const path = join(dossier, e.name);
    if (e.isDirectory()) return files(path);
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [path] : [];
  });

const placedAnchors = (): Set<string> => {
  const foundOnes = new Set<string>();
  for (const f of files(SRC)) {
    /* `steps.ts` NAMES the anchors, it lays none: using it as proof
       would make every step justify itself. */
    if (/[\\/]tour[\\/]steps\.ts$/.test(f)) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/\b(?:data-tour|tour)=["']([\w-]+)["']/g))
      foundOnes.add(m[1]!);
  }
  return foundOnes;
};

describe("les cibles de la visite existent dans le produit", () => {
  const placed = placedAnchors();

  it("en trouve un nombre plausible", () => {
    /* Safeguard of the safeguard: a broken regular expression would
       return an empty set, and every test below would pass. */
    expect(placed.size).toBeGreaterThan(30);
  });

  it("chaque étape vise une ancre posée", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      for (const [i, s] of t.steps.entries()) {
        if (!s.target) continue;
        const nom = /^\[data-tour="([\w-]+)"\]$/.exec(s.target)?.[1];
        if (!nom) continue; // `[data-tab-rail]`, seule exception
        expect(
          placed.has(nom),
          `${id}[${i}] « ${s.title} » vise « ${nom} », qui n'est posé nulle part dans src/`
        ).toBe(true);
      }
    }
  });
});
