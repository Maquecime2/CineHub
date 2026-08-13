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
    /* `language.frNote` is French ON PURPOSE: it names French to somebody
       reading English, and it names it in French. */
    expect(suspects.filter((p) => p !== "language.frNote")).toEqual([]);
  });
});
