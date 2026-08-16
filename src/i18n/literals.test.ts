/* ============================================================
   NO SENTENCE WRITTEN STRAIGHT INTO A SCREEN
   ============================================================

   `catalogue.test.ts` guards the two catalogues against each other, and
   it does that well. What it cannot see is the case that actually piled
   up: a sentence that never reached a catalogue at all. A hundred and
   seventy of them had gathered across some thirty files — whole panels
   in French inside an English screen, half-translated labels
   ("Plus longue drought", "Strength du lien"), and four tabs of the
   almanac showing `almanac.plate1` in both languages because the `t()`
   was simply never called.

   None of it failed a single check. A rule nothing enforces is a rule
   that decays, so this is the enforcement.

   WHAT IS ALLOWED THROUGH, and why:

   — anything under `EXEMPT`, listed one by one and never by pattern: a
     development tool, a decoration that draws rather than speaks;
   — technical values that merely look like words — a colour key, a CSS
     length, an identifier — caught by `TECHNICAL`;
   — punctuation and figures, which read the same in both languages.

   ADDING A FILE TO `EXEMPT` IS A DECISION, not a fix. The list is short
   on purpose: when it grows, this test has stopped protecting anything.
   ============================================================ */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/views", "src/components"];

/* A LITERAL THAT IS RIGHT AS IT IS. The language button names BOTH
   languages at once, deliberately: translating it would hide the one you
   are looking for behind the one you cannot read. */
const KEPT = ["Français / English"];

const EXEMPT = [
  /* A development tool, never shipped: `import.meta.env.DEV` guards it. */
  "src/views/dev/SkinLab.tsx",
  /* THE MARKS OF USE DRAW, THEY DO NOT SPEAK — grain, coffee, tape, pins,
     the ticket's teeth. What text they carry is a stamp's ornament, laid
     by the caller. */
  "src/components/atmosphere",
];

/** The props whose value lands under somebody's eyes. */
const SPOKEN = /(?:title|label|legende|placeholder|aria-label|alt|what|empty)=\{?"([^"]+)"/g;
/** Text written straight between two tags. */
const BETWEEN = />\s*([A-Za-zÀ-ÿ][^<>{}\n]{2,})\s*</g;

/* A value that only LOOKS like a word. A colour key, a unit, a bare
   identifier: none of them is a sentence, and none of them changes with
   the reader's language. */
const TECHNICAL =
  /^(?:[a-z]+(?:-[a-z0-9]+)*|[a-zA-Z]+|\d[\d\s.,%a-z]*|[^A-Za-zÀ-ÿ]*|https?:.*|#.*|var\(.*)$/;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry).replace(/\\/g, "/");
    if (EXEMPT.some((e) => path === e || path.startsWith(`${e}/`))) return [];
    if (statSync(path).isDirectory()) return files(path);
    if (!/\.(tsx|jsx)$/.test(path) || /\.test\./.test(path)) return [];
    return [path];
  });

/** Does this read as a sentence somebody wrote for a reader? */
const isSpoken = (value: string): boolean => {
  const clean = value.trim();
  if (clean.length < 3) return false;
  if (KEPT.includes(clean)) return false;
  if (TECHNICAL.test(clean)) return false;
  /* A scrap of JSX caught between two tags — `visible.length && (` — is
     code, not speech. */
  if (/&&|\|\||=>|\(\s*$|^\{|\}$/.test(clean)) return false;
  // two words, or one accented word: below that it is almost always a key
  return /[A-Za-zÀ-ÿ]{2,}\s+\S|[à-ÿÀ-Ý]/.test(clean);
};

describe("what the screens say", () => {
  it("never writes a sentence straight into a view", () => {
    const found: string[] = [];
    for (const path of ROOTS.flatMap(files)) {
      /* COMMENTS ARE NOT SPEECH, and this codebase comments at length,
         in two languages. Left in, they were the bulk of the noise: a
         JSX comment marking off a section is a note to the next reader
         of the code, never a line on a screen. */
      const source = readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, " ");
      for (const re of [SPOKEN, BETWEEN]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(source))) {
          const value = m[1] as string;
          if (isSpoken(value)) found.push(`${path} — ${value.trim()}`);
        }
      }
    }
    /* The message is the list itself: a count would send the reader
       hunting, and the point of this test is to say exactly which
       sentence to move into `fr.ts` and `en.ts`. */
    expect(found.sort()).toEqual([]);
  });
});
