/* ============================================================
   THE TWO CATALOGUES SAY THE SAME THINGS
   ============================================================

   This test is the whole safety net of the translation. A key added to
   one side and forgotten on the other does not crash and does not warn:
   the fallback quietly shows French inside an English screen, and nobody
   notices until somebody who does not read French does.

   So the parity is checked, not hoped for. */
import { describe, it, expect } from "vitest";
import fr from "./fr";
import en from "./en";

type Tree = { [key: string]: string | Tree };

/** Every leaf's path, in dotted form: `skins.carnet.label`. */
const paths = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const here = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [here] : paths(value as Tree, here);
  });

const frPaths = paths(fr as unknown as Tree).sort();
const enPaths = paths(en as unknown as Tree).sort();

describe("the two catalogues", () => {
  it("carry exactly the same keys", () => {
    expect(enPaths.filter((k) => !frPaths.includes(k))).toEqual([]);
    expect(frPaths.filter((k) => !enPaths.includes(k))).toEqual([]);
  });

  it("leave no sentence empty", () => {
    /* An empty string reads as an absence on screen, and i18next does not
       fall back on it: `returnEmptyString: false` is only half the guard,
       because it would still hand back the French. */
    for (const [name, tree] of [
      ["fr", fr],
      ["en", en],
    ] as const) {
      const flat = paths(tree as unknown as Tree);
      const empty = flat.filter((p) => {
        const value = p
          .split(".")
          .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], tree);
        return typeof value === "string" && value.trim() === "";
      });
      expect(empty, `${name} has empty strings`).toEqual([]);
    }
  });

  it("does not leave the English side written in French", () => {
    /* A crude sieve, and it earns its place: the commonest slip is
       copying the French block across and translating half of it. Words
       that exist in both languages are left out — a note may legitimately
       say "sepia" or "pastel" on either side. */
    const FRENCH_ONLY =
      /\b(le|la|les|des|une|dans|pour|avec|qui|que|sont|cette|aux|du|par|mais|sans|puis|alors|donc|elle|ne|pas|plus|tout|toute|déjà|leur|son|ses|au|nous|vous|quand|comme|chaque|rien|jamais|toujours|sur|sous|vers|depuis|encore|aussi|ici)\b/i;
    const suspects = paths(en as unknown as Tree).filter((p) => {
      const value = p
        .split(".")
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], en);
      return typeof value === "string" && FRENCH_ONLY.test(value);
    });
    /* FRENCH ON PURPOSE, both of them, and for two different reasons:

       — `language.frNote` names French to somebody reading English, and
         it names it in French.
       — `demoBinder.films.samourai.title` is a RELEASE TITLE. Melville's
         film came out in the English-speaking world under its French
         name, and "The Samurai" would send an English reader looking for
         a film that does not exist. A title is not translated; it is
         looked up. */
    const ON_PURPOSE = ["language.frNote", "demoBinder.films.samourai.title"];
    expect(suspects.filter((p) => !ON_PURPOSE.includes(p))).toEqual([]);
  });
});

/* ============================================================
   EVERY KEY THE SOURCE ASKS FOR EXISTS
   ============================================================

   Parity above answers "do the two sides agree?", which is not the same
   question as "is what the screens ask for actually there?". A key that
   is in NEITHER catalogue is in parity with itself, and i18next does not
   raise: it prints the key. That is how `shelf.kinds.main.tag` came to be
   displayed, in full, under a shelf.

   So the sources are read, every literal `t("…")` is collected, and each
   one is looked up. Only literals — a key built from a variable cannot be
   checked here, and the two that are built that way are checked by the
   test below instead.
   ============================================================ */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/* From the working directory rather than from `import.meta.url`: under
   the jsdom environment that URL is not a file one, and resolving it
   throws before a single assertion runs. Vitest runs from the root of
   the package. */
const SRC = join(process.cwd(), "src");

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "i18n" ? [] : sources(path);
    return /\.(ts|tsx|js|jsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

const at = (tree: Tree, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node && typeof node === "object" ? (node as Tree)[key] : undefined),
      tree
    );

/* A PLURAL IS FILED UNDER SEVERAL NAMES AND CALLED BY ONE. `t("x", {count})`
   reads `x_one` or `x_other` depending on the number, and `x` itself
   never exists — so a sweep that only looked for the name as written
   would report every plural in the application as missing, and the real
   absences would be lost in the noise. */
const SUFFIXES = ["", "_one", "_other", "_zero", "_many", "_few"];
const has = (tree: Tree, path: string): boolean =>
  SUFFIXES.some((s) => at(tree, path + s) !== undefined);

describe("the keys the screens ask for", () => {
  it("all exist, in both catalogues", () => {
    const missing = new Set<string>();
    for (const file of sources(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z][\w.]*\.[\w.]+)"/g)) {
        const key = match[1]!;
        if (!has(fr as unknown as Tree, key) || !has(en as unknown as Tree, key)) {
          missing.add(`${key}  (${file.slice(SRC.length)})`);
        }
      }
    }
    expect([...missing].sort()).toEqual([]);
  });

  /* THE TWO KEYS BUILT FROM A VARIABLE. `shelf.kinds.<kind>.title` and
     `….tag` are composed at render time from the three shelf kinds, so
     the sweep above cannot see them — and it was exactly there that a key
     was printed on screen instead of a sentence. They are named here by
     hand, which is the price of composing a key. */
  it("includes the ones composed at render time", () => {
    for (const kind of ["bedside", "main", "reserve"]) {
      for (const leaf of ["title", "tag"]) {
        const key = `shelf.kinds.${kind}.${leaf}`;
        expect(has(fr as unknown as Tree, key), `fr ${key}`).toBe(true);
        expect(has(en as unknown as Tree, key), `en ${key}`).toBe(true);
      }
    }
  });
});
