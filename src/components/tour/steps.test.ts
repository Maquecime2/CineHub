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
import fr from "../../i18n/fr";
import en from "../../i18n/en";

const SRC = join(process.cwd(), "src");

/* THE LIST OF VIEWS IS READ, NOT COPIED.

   It used to be written out by hand here, with a comment saying it came
   from `FolderTabs`' `View` union — and that hand copy was a hole
   straight through the net this file is. Adding a view to the product
   and forgetting to add it here made NOTHING fail: the new view simply
   was not looked at, which is precisely the case these tests exist to
   catch. The safety net had the shape of the thing it was guarding
   against.

   So the union is parsed out of the source. A type does not survive
   compilation, but it does survive as text, and this file already reads
   the whole of `src/` to find the anchors — reading one file more costs
   nothing and closes the hole for good.

   `skinlab` drops out: it is a development tool, not a view. `detail` is
   in the union and has its own tour, so it stays. */
const VIEWS: string[] = (() => {
  const source = readFileSync(join(SRC, "components/layout/FolderTabs.tsx"), "utf8");
  const union = /export type View =([\s\S]*?);/.exec(source);
  if (!union) throw new Error("l'union `View` est introuvable dans FolderTabs");
  return [...union[1]!.matchAll(/"([\w-]+)"/g)].map((m) => m[1]!).filter((v) => v !== "skinlab");
})();

describe("the tour covers the product", () => {
  it.each(VIEWS)('"%s" has its tour', (vue) => {
    const t = tourForView(vue);
    expect(t, `la vue « ${vue} » n'a pas de visite — voir CLAUDE.md`).toBeDefined();
    expect(t!.steps.length).toBeGreaterThan(0);
  });

  it("has no orphan tour", () => {
    for (const key of Object.keys(TOURS)) {
      if (key === "global") continue;
      expect(VIEWS).toContain(key as (typeof VIEWS)[number]);
    }
  });
});

describe("the steps hold together", () => {
  const allOfThem = Object.entries(TOURS).flatMap(([id, t]) =>
    t.steps.map((s, i) => ({ id, i, s }))
  );

  /* SINCE THE STEPS HOLD KEYS AND NOT SENTENCES, a non-empty title proves
     nothing: `tour.almanac.plates.title` is not empty, and shows exactly
     that on screen if nobody wrote it in the catalogue. So we resolve.

     In BOTH catalogues, and not only in French: the fallback would hand
     the French sentence to an English reader without a sound, which is
     the very slip the parity test exists for. */
  const inThere = (tree: unknown, key: string): string | undefined => {
    const leaf = key
      .split(".")
      .reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], tree);
    return typeof leaf === "string" ? leaf : undefined;
  };

  it("always says something, in both languages", () => {
    for (const { id, i, s } of allOfThem) {
      for (const key of [s.title, s.body])
        for (const [name, tree] of [
          ["fr", fr],
          ["en", en],
        ] as const)
          expect(
            inThere(tree, key)?.trim(),
            `${id}[${i}] : « ${key} » manque en ${name}`
          ).toBeTruthy();
    }
  });

  it("every tour's label is in the catalogue", () => {
    for (const [id, t] of Object.entries(TOURS))
      for (const [name, tree] of [
        ["fr", fr],
        ["en", en],
      ] as const)
        expect(
          inThere(tree, t.label)?.trim(),
          `${id} : « ${t.label} » manque en ${name}`
        ).toBeTruthy();
  });

  it("aims only through a tour attribute", () => {
    for (const { id, i, s } of allOfThem) {
      if (s.target === null) continue;
      expect(s.target, `${id}[${i}]`).toMatch(/^\[data-(tour|tab-rail)/);
    }
  });

  /* The global tour travels: every step must say in which view it
     plays, failing which it points at a target left behind in the
     previous view. */
  it("the global tour names the view of every step", () => {
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
  it("every step of the film page says its divider", () => {
    for (const [i, s] of TOURS.detail!.steps.entries()) {
      expect(s.tab, `detail[${i}] : ${s.title}`).toBeDefined();
    }
  });

  it("no other tour speaks of a divider", () => {
    for (const [id, t] of Object.entries(TOURS)) {
      if (id === "detail") continue;
      for (const s of t.steps) expect(s.tab, `${id} : ${s.title}`).toBeUndefined();
    }
  });

  /* Page tours, for their part, must NEVER navigate: we launch them
     from the page they describe. */
  it("the page tours do not navigate", () => {
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
   how "credits-page" was able to stay in the global tour,
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

const files = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((e) => {
    const path = join(folder, e.name);
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

describe("the tour's targets exist in the product", () => {
  const placed = placedAnchors();

  it("finds a plausible number of them", () => {
    /* Safeguard of the safeguard: a broken regular expression would
       return an empty set, and every test below would pass. */
    expect(placed.size).toBeGreaterThan(30);
  });

  /* ---------- THE NET HAD ONLY ONE DIRECTION ----------

     "Every step aims at a laid anchor" was checked; the reverse never
     was, and the reverse is the side that leaks. An anchor laid in the
     product and aimed at by nobody is either an oversight — a feature
     the tour does not describe, which CLAUDE.md calls an incomplete
     change — or a deliberate leftover. FOURTEEN of them had piled up,
     and nothing told the two apart.

     The exception list is what forces the call. It is named, it carries
     its reason, and it must stay SHORT for the same reason `EXEMPT` in
     `literals.test.ts` must: a list that grows swallows the rule it is
     an exception to. */
  const UNAIMED: Record<string, string> = {
    /* Sous un voile. Une visite ne peut pas ouvrir une modale, et une
       ancre sous un voile est une ancre morte : le pas se poserait au
       milieu d'un écran qui ne montre pas ce qu'il décrit. Le même
       raisonnement a fondu trois pas du Programme en un seul, voir
       `steps.ts`. La visite vise LA PORTE, et ces portes sont décrites
       ailleurs. */
    "compte-tiroir": "dans le tiroir du compte",
    "notebook-new": "dans le tiroir du carnet",
    "motif-panel": "dans la feuille d'un motif",
    "program-hints": "dans la feuille de la carte des filiations",
    "soir-carte": "dans le tiroir du soir",
    "soir-humeur": "dans le tiroir du soir",
    "soir-temps": "dans le tiroir du soir",
    "wall-choose-bar": "dans le panneau d'une sélection du mur",
    /* Il n'existe que lorsqu'une version attend d'être installée. Un pas
       qui ne se montre presque jamais est un pas qu'on n'écrit pas. */
    maj: "n'existe que sous une mise à jour en attente",
  };

  it("every laid anchor is aimed at by a step, or excused by name", () => {
    const aimed = new Set(
      Object.values(TOURS).flatMap((t) =>
        t.steps.flatMap((s) => {
          const nom = s.target && /^\[data-tour="([\w-]+)"\]$/.exec(s.target)?.[1];
          return nom ? [nom] : [];
        })
      )
    );
    for (const anchor of placed) {
      expect(
        aimed.has(anchor) || anchor in UNAIMED,
        `« ${anchor} » est posé dans src/ et aucun pas ne le vise — ` +
          `écrivez le pas, ou inscrivez-le dans UNAIMED avec sa raison`
      ).toBe(true);
    }
  });

  it("has no excuse for an anchor that no longer exists", () => {
    /* Une exception qui survit à son ancre est une exception qui couvre
       autre chose. */
    for (const anchor of Object.keys(UNAIMED))
      expect(placed.has(anchor), `« ${anchor} » est excusé et n'est plus posé nulle part`).toBe(
        true
      );
  });

  it("every step aims at an anchor that is laid", () => {
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
