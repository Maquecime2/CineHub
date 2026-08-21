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

   CE QU'IL NE VOIT PAS, ET C'EST ÉCRIT PLUTÔT QUE DEVINÉ. Une phrase
   rangée dans un TABLEAU DE CONSTANTES lui échappe — elle n'est ni un
   attribut, ni du texte entre deux balises. `FilmModal` en portait deux,
   dont une qui affichait la CLÉ de traduction en toutes lettres sur un
   bouton. L'expression régulière qui attraperait ce cas ramènerait des
   dizaines de faux positifs et ferait gonfler `EXEMPT`, ce que ce
   fichier interdit juste en dessous. La limite est donc assumée ici, et
   non contournée.

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

/* LES PROPS DONT LA VALEUR TOMBE SOUS LES YEUX DE QUELQU'UN.

   LE NOM SE PREFIXE, ET C'EST PAR LA QUE PASSAIT UNE PHRASE. `removeLabel`
   contient bien `Label`, mais avec une MAJUSCULE : la liste nue ne voyait
   donc pas `removeLabel="retirer l'objet"` dans `ShelfBoard`, juste sous
   un voisin qui appelait `t()`. On tolere un prefixe et la capitale qui
   vient avec. Mesure faite au moment d'elargir : un seul fichier tombait,
   celui qu'on corrigeait dans la meme passe. */
const SAID = String.raw`[A-Za-z]*(?:[Tt]itle|[Ll]abel|[Ll]egende|[Pp]laceholder|aria-label|[Aa]lt|[Ww]hat|[Ee]mpty)`;
const SPOKEN = new RegExp(`${SAID}=\\{?"([^"]+)"`, "g");

/* TEXTE ECRIT DROIT ENTRE DEUX BALISES.

   IL POUVAIT COMMENCER PAR AUTRE CHOSE QU'UNE LETTRE. Exiger une lettre
   en premier caractere laissait passer `>+ DECOR<` et `>+ LIGNE<` — deux
   boutons de l'etagere, en francais, sous les yeux de tout le monde. On
   tolere donc une ponctuation d'ouverture, sans lacher l'exigence d'une
   lettre derriere : c'est elle qui distingue une phrase d'un fragment de
   code. */
const BETWEEN = />\s*(?:[+·—-]\s*)?([A-Za-zÀ-ÿ][^<>{}\n]{2,})\s*</g;

/* LE MEME ATTRIBUT, MAIS ECRIT EN CODE. `title={x ? "…" : "…"}` et un
   gabarit ne portent pas de guillemet juste apres le `=`, donc `SPOKEN`
   les manque entierement : c'est par la que passaient les ternaires. On
   capture le corps accolade, une accolade imbriquee comprise, et on y
   cherche les chaines ensuite. */
const BRACED = new RegExp(`${SAID}=\\{((?:[^{}]|\\{[^{}]*\\})*)\\}`, "g");
/** Les chaines d'un corps accolade : guillemets, apostrophes, gabarit. */
const STRINGS = /"([^"\n]*)"|`([^`]*)`/g;

/* UNE CLE DE TRADUCTION N'EST PAS UNE PHRASE, et `t("…")` en met une
   dans le corps accolade. On retire l'appel plutot que d'esperer que
   `isSpoken` s'y trompe : « credits.whatIHaveOf » n'a pas d'accent
   aujourd'hui, une cle voisine en aura un demain. */
const withoutKeys = (body: string): string => body.replace(/\bt\w*\(\s*"[^"]*"/g, "t(");

/* Un trou de gabarit est du code : `${n} films` ne se lit pas comme deux
   mots ecrits pour quelqu'un. */
const withoutHoles = (value: string): string => value.replace(/\$\{[^{}]*\}/g, " ");

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
    /* LES `.ts` AUSSI, ET ILS NE COÛTENT RIEN. Le filet ne lisait que le
       JSX, donc un module d'écran qui compose du HTML ou tient un
       tableau de libellés lui était invisible — c'est par là que
       `stills/tokens.ts` a gardé sa phrase française. Mesuré au moment
       de l'ouvrir : pas un fichier ne tombe. C'est une porte fermée
       d'avance, pas une dette découverte. */
    if (!/\.(tsx|jsx|ts)$/.test(path) || /\.test\./.test(path)) return [];
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
      /* Les attributs parlés écrits en code : ternaire, gabarit. */
      BRACED.lastIndex = 0;
      let braced: RegExpExecArray | null;
      while ((braced = BRACED.exec(source))) {
        const body = withoutKeys(braced[1] as string);
        STRINGS.lastIndex = 0;
        let str: RegExpExecArray | null;
        while ((str = STRINGS.exec(body))) {
          const value = withoutHoles((str[1] ?? str[2]) as string);
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
