/* ============================================================
   MOTIFS — the cards' shared vocabulary
   ============================================================

   `themes` already existed, and stays what it is: YOUR words, written by
   hand, free. Its freedom is also its limit — "fin triste", "fin amère"
   and "ça finit mal" are three labels that nothing brings together, and a
   map built on them only joins the cards tagged on the same day, in the
   same mood.

   A motif is the opposite: a FIXED word, chosen from a list written here,
   in the code. You do not invent them — that is precisely what lets you
   ask "show me every film where the hero dies" and get an answer, rather
   than one answer per spelling.

   So the list lives in the code and never in `localStorage`: it is
   vocabulary, not data. A card only keeps `id`s of it, and a motif
   RELABELLED here shows up everywhere with no migration.

   THE `id`, ON THE OTHER HAND, IS DATA. It is the one thing a card keeps,
   and translating the identifiers is therefore a change of format — see
   `migrateMotifId` at the bottom of this file, and the three reading
   doors that apply it.
   ============================================================ */
import type { Film } from "../types";
import { saying, words, type Wording } from "./wording";

/**
 * How the caller turns a key into words.
 *
 * The domain does not know i18next and must not: it is `t`, passed in.
 * A signature of one line rather than an import keeps this module
 * testable without a catalogue.
 */
export type NameOf = (key: string) => string;

/**
 * What to write under a motif.
 *
 * WHAT SOMEBODY TYPED IS NEVER TRANSLATED — their own motif keeps their
 * own words, in both languages, exactly like a note or a review.
 */
export const motifLabel = (m: Motif, name: NameOf): string =>
  m.label ?? name(`motifs.labels.${m.id}`);

/** The same, for a domain that hands words on rather than showing them. */
export const motifWording = (m: Motif): Wording =>
  m.label !== undefined ? words(m.label) : saying(`motifs.labels.${m.id}`);

export type MotifFamily = "fate" | "ending" | "narrative" | "figures" | "tone" | "world";

export interface Motif {
  /** Stable key, never the label: it is what gets written on the card. */
  id: string;
  /**
   * Present ONLY on a motif somebody wrote themselves, where it is their
   * own words. A catalogue motif has none: it has a name in each
   * language, kept under `motifs.labels.<id>`. Read the two through
   * `motifLabel` rather than choosing here.
   */
  label?: string;
  family: MotifFamily;
  /**
   * A motif that gives the ending away. It is written like the others,
   * but any view showing it must scratch it out until it has been
   * revealed — otherwise the mere act of filing your collection would
   * spoil the films you have not seen yet.
   */
  spoiler?: boolean;
  /** TMDB keywords that suggest it. English labels, or ids. */
  tmdb?: (number | string)[];
}

export const FAMILIES: { id: MotifFamily }[] = [
  { id: "fate" },
  { id: "ending" },
  { id: "narrative" },
  { id: "figures" },
  { id: "tone" },
  { id: "world" },
];

/* THE ORDER MATTERS: it is the display order, family by family, and it
   runs from the most common to the rarest inside each one. */
export const MOTIFS: Motif[] = [
  /* --- what happens to the characters ------------------------------ */
  {
    id: "hero-dies",
    family: "fate",
    spoiler: true,
    tmdb: ["death of hero", "dying and death", "protagonist dies"],
  },
  {
    id: "sacrifice",
    family: "fate",
    spoiler: true,
    tmdb: ["self sacrifice", "sacrifice", "heroic sacrifice"],
  },
  {
    id: "everyone-dies",
    family: "fate",
    spoiler: true,
    tmdb: ["mass death", "massacre"],
  },
  {
    id: "sole-survivor",
    family: "fate",
    spoiler: true,
    tmdb: ["sole survivor", "survivor"],
  },
  { id: "grief", family: "fate", tmdb: ["grief", "mourning"] },
  {
    id: "revenge-fulfilled",
    family: "fate",
    spoiler: true,
    tmdb: ["revenge", "vengeance"],
  },
  {
    id: "revenge-in-vain",
    family: "fate",
    spoiler: true,
  },
  {
    id: "betrayal",
    family: "fate",
    tmdb: ["betrayal", "traitor"],
  },
  { id: "flight", family: "fate", tmdb: ["escape", "on the run", "manhunt"] },
  {
    id: "downfall",
    family: "fate",
    tmdb: ["rise and fall", "downfall"],
  },
  {
    id: "impossible-love",
    family: "fate",
    tmdb: ["forbidden love", "unrequited love", "impossible love"],
  },
  {
    id: "reunion",
    family: "fate",
    tmdb: ["reunion", "family reunion"],
  },
  {
    id: "confinement",
    family: "fate",
    tmdb: ["prison", "captivity", "kidnapping"],
  },
  {
    id: "loss-of-reason",
    family: "fate",
    tmdb: ["insanity", "madness", "mental illness"],
  },

  /* --- the last image ---------------------------------------------- */
  {
    id: "open-ending",
    family: "ending",
    spoiler: true,
    tmdb: ["open ending", "ambiguous ending"],
  },
  {
    id: "final-revelation",
    family: "ending",
    spoiler: true,
    tmdb: ["twist ending", "plot twist", "surprise ending"],
  },
  {
    id: "back-to-the-start",
    family: "ending",
    spoiler: true,
  },
  {
    id: "false-happy-ending",
    family: "ending",
    spoiler: true,
  },
  {
    id: "final-freeze-frame",
    family: "ending",
    spoiler: true,
    tmdb: ["freeze frame"],
  },
  {
    id: "distant-epilogue",
    family: "ending",
    spoiler: true,
  },

  /* --- the way of telling ------------------------------------------ */
  {
    id: "non-linear-narrative",
    family: "narrative",
    tmdb: ["nonlinear timeline", "anachronic order"],
  },
  {
    id: "unreliable-narrator",
    family: "narrative",
    tmdb: ["unreliable narrator"],
  },
  {
    id: "single-setting",
    family: "narrative",
    tmdb: ["one location", "single set"],
  },
  { id: "ensemble-film", family: "narrative", tmdb: ["ensemble cast"] },
  {
    id: "road-movie",
    family: "narrative",
    tmdb: ["road movie", "road trip"],
  },
  {
    id: "story-within-a-story",
    family: "narrative",
    tmdb: ["film within a film", "filmmaking", "metafiction"],
  },
  {
    id: "voice-over",
    family: "narrative",
    tmdb: ["voice over narration", "narration"],
  },
  {
    id: "real-time",
    family: "narrative",
    tmdb: ["real time", "one day"],
  },
  {
    id: "time-loop",
    family: "narrative",
    tmdb: ["time loop"],
  },
  { id: "chapters", family: "narrative", tmdb: ["anthology"] },
  {
    id: "flashback",
    family: "narrative",
    tmdb: ["flashback", "told in flashback"],
  },
  { id: "mockumentary", family: "narrative", tmdb: ["mockumentary"] },
  {
    id: "long-take",
    family: "narrative",
    tmdb: ["long take", "one shot"],
  },
  {
    id: "literary-adaptation",
    family: "narrative",
    tmdb: ["based on novel or book", "based on play"],
  },

  /* --- the figures -------------------------------------------------- */
  { id: "the-double", family: "figures", tmdb: ["doppelganger", "twins"] },
  {
    id: "lost-mentor",
    family: "figures",
    spoiler: true,
    tmdb: ["mentor"],
  },
  {
    id: "wrong-man",
    family: "figures",
    tmdb: ["wrongful conviction", "wrongly accused"],
  },
  {
    id: "child-witness",
    family: "figures",
    tmdb: ["child protagonist", "coming of age"],
  },
  {
    id: "siblings",
    family: "figures",
    tmdb: ["brother brother relationship", "sister sister relationship", "siblings"],
  },
  {
    id: "absent-father",
    family: "figures",
    tmdb: ["father son relationship", "absent father"],
  },
  {
    id: "mismatched-duo",
    family: "figures",
    tmdb: ["buddy", "odd couple"],
  },
  {
    id: "group-falling-apart",
    family: "figures",
    tmdb: ["friendship", "gang"],
  },
  {
    id: "artist-at-work",
    family: "figures",
    tmdb: ["artist", "writer", "musician"],
  },
  {
    id: "authority-figure",
    family: "figures",
    tmdb: ["bureaucracy", "corruption"],
  },
  {
    id: "ghost",
    family: "figures",
    tmdb: ["ghost", "haunting"],
  },

  /* --- the tone ------------------------------------------------------ */
  { id: "melancholy", family: "tone", tmdb: ["melancholy", "loneliness"] },
  { id: "slapstick", family: "tone", tmdb: ["slapstick comedy", "farce"] },
  {
    id: "unease",
    family: "tone",
    tmdb: ["awkwardness", "psychological horror"],
  },
  {
    id: "contemplative",
    family: "tone",
    tmdb: ["slow cinema", "meditative"],
  },
  { id: "irony", family: "tone", tmdb: ["black comedy", "satire"] },
  { id: "tenderness", family: "tone", tmdb: ["heartwarming"] },
  { id: "fever", family: "tone", tmdb: ["frenetic"] },
  { id: "sensuality", family: "tone", tmdb: ["eroticism", "sensuality"] },
  { id: "paranoia", family: "tone", tmdb: ["paranoia", "conspiracy"] },
  { id: "dreamlike", family: "tone", tmdb: ["dream", "surrealism"] },

  /* --- the world ----------------------------------------------------- */
  {
    id: "sprawling-city",
    family: "world",
    tmdb: ["urban setting", "megacity", "new york city"],
  },
  {
    id: "stifling-countryside",
    family: "world",
    tmdb: ["rural setting", "small town", "village"],
  },
  { id: "winter", family: "world", tmdb: ["winter", "snow"] },
  {
    id: "crushing-summer",
    family: "world",
    tmdb: ["summer", "heat wave"],
  },
  { id: "sea", family: "world", tmdb: ["ocean", "sea", "island"] },
  {
    id: "near-future",
    family: "world",
    tmdb: ["near future", "dystopia"],
  },
  {
    id: "after-the-end",
    family: "world",
    tmdb: ["post-apocalyptic future", "apocalypse"],
  },
  {
    id: "war-in-the-background",
    family: "world",
    tmdb: ["world war ii", "war", "occupation"],
  },
  {
    id: "world-of-work",
    family: "world",
    tmdb: ["workplace", "factory", "office"],
  },
  {
    id: "family-single-setting",
    family: "world",
    tmdb: ["family drama", "dysfunctional family"],
  },
  { id: "the-night", family: "world", tmdb: ["night", "one night"] },
  {
    id: "exile",
    family: "world",
    tmdb: ["immigration", "exile", "refugee"],
  },
];

/* ============================================================
   YOUR OWN MOTIFS
   ============================================================

   The catalogue above stays in the code, and that is what lets an update
   of the application enrich everybody's vocabulary without overwriting
   anything. But it cannot foresee everything: nobody but you knows that
   you follow "the films where it rains without stopping".

   Two gestures, then, and two only:
   — ADD your own, which live alongside, in your data;
   — HIDE the catalogue's that are no use to you. Hide and not delete: a
     motif we supply is not yours, and making it vanish from your data
     would bring it back on the next update, which would be worse than
     not having removed it.

   THE REGISTER IS GLOBAL, AND THAT IS A DELIBERATE CHOICE. `motifById` is
   called from the search, the sky map and the card — passing the
   catalogue down as a prop to each of them would cross half the
   application for a list that only changes by hand. `App` loads the disk
   at start-up and sets the register here; it is the only place that
   writes.

   ITS FIELDS ARE STORED. `perso`, `masqués` and each motif's `famille`
   are written into `localStorage`; they are read back through
   `services/motifs`, which is their only door and carries the old
   spellings over. */
let CUSTOM: Motif[] = [];
let HIDDEN = new Set<string>();

export interface StoredVocabulary {
  custom: Motif[];
  hidden: string[];
}

export const setVocabulary = ({ custom = [], hidden = [] }: Partial<StoredVocabulary>): void => {
  CUSTOM = custom;
  HIDDEN = new Set(hidden);
};

export const customMotifs = (): Motif[] => CUSTOM;
export const isHidden = (id: string): boolean => HIDDEN.has(id);
export const isCustom = (id: string): boolean => CUSTOM.some((m) => m.id === id);

/** The vocabulary in use: the catalogue minus the hidden, plus yours. */
export const allMotifs = (): Motif[] => [...MOTIFS.filter((m) => !HIDDEN.has(m.id)), ...CUSTOM];

/* An identifier is DEDUCED from the label, and never moves again
   afterwards: it is what gets written on the cards. Renaming "Il pleut"
   to "Il pleut sans arrêt" must not unhook the motif from the twelve
   films that carry it. */
export const idFromLabel = (label: string, taken: string[] = []): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "motif";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

export const makeCustomMotif = (
  label: string,
  family: MotifFamily = "narrative",
  spoiler = false
): Motif => ({
  id: idFromLabel(label, [...MOTIFS.map((m) => m.id), ...CUSTOM.map((m) => m.id)]),
  label: label.trim(),
  family,
  ...(spoiler ? { spoiler: true } : {}),
});

const BY_ID = new Map(MOTIFS.map((m) => [m.id, m]));

/* We look at yours FIRST: if an identifier existed on both sides — a
   catalogue motif added later under the same name as one of yours — it is
   yours that must win, since it is the one you wrote.

   A hidden motif stays findable here: the cards that carry it must go on
   showing it, otherwise hiding would erase in silence. */
export const motifById = (id: string): Motif | undefined =>
  CUSTOM.find((m) => m.id === id) || BY_ID.get(id);

/** A card's motifs, in the catalogue's order and not the order they were set.
 *
 *  An unknown `id` — a motif since removed from the catalogue — is simply
 *  ignored on display rather than erased from the card: taking it out of
 *  the data would ask for a migration, for a list that is still moving. */
export const motifsOf = (film: Pick<Film, "motifs">): Motif[] =>
  (film.motifs || []).map((id) => motifById(id)).filter((m): m is Motif => !!m);

export const byFamily = (): { family: MotifFamily; motifs: Motif[] }[] => {
  const inUse = allMotifs();
  return FAMILIES.map((f) => ({
    family: f.id,
    motifs: inUse.filter((m) => m.family === f.id),
  })).filter((f) => f.motifs.length > 0);
};

/**
 * Search in the catalogue, on the name AND the family.
 *
 * THE NAMES COME FROM OUTSIDE, and that is the whole point: a search must
 * find what is ON SCREEN. Somebody reading in English types "the hero
 * dies", somebody reading in French types "le héros meurt", and neither
 * should have to know the other language to find the same motif.
 */
export const searchMotifs = (q: string, name: NameOf): Motif[] => {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return allMotifs().filter(
    (m) =>
      motifLabel(m, name).toLowerCase().includes(needle) ||
      name(`motifs.families.${m.family}`).toLowerCase().includes(needle)
  );
};

/* WHAT TMDB CAN SUGGEST, AND NOTHING MORE.

   TMDB keywords are set by anybody at all and run from the very apt to
   the plainly wrong. So we use them as a SUGGESTION — the card only
   receives what a click has approved. An automatic suggestion written
   without review, on a field that then goes on to build the map, would
   fill the sky with threads nobody ever strung.

   The match is made on the LABEL and not on the numeric id: the ids are
   stable at TMDB but unreadable here, and a list of bare numbers would be
   unverifiable on review. */
export const suggestMotifs = (keywords: { id?: number; name?: string }[] | string[]): Motif[] => {
  const words = new Set<string>();
  for (const k of keywords || []) {
    if (typeof k === "string") words.add(k.trim().toLowerCase());
    else {
      if (k?.name) words.add(k.name.trim().toLowerCase());
      if (typeof k?.id === "number") words.add(String(k.id));
    }
  }
  if (words.size === 0) return [];
  return MOTIFS.filter((m) => (m.tmdb || []).some((t) => words.has(String(t).toLowerCase())));
};

/* ============================================================
   THE OLD SPELLING OF THE IDENTIFIERS
   ============================================================

   The identifiers above moved to English, and they are what a card
   carries on disk: `motifs: ["melancolie"]` was written into the
   `localStorage` of every collection kept before the switch.

   The header comment promises that "a motif relabelled here shows up
   everywhere with no migration" — that is true of the LABEL, which does
   not travel; it is false of the `id`, which is the only thing a card
   keeps. This table is therefore the counterpart of the rename, and the
   binder's reading doors all go through it: `migrate` in `domain/film`
   for the cards, `normalizeThreads` in `domain/threads` for the threads,
   `normalizeVocabulaire` in `services/motifs` for the families.

   An unknown identifier comes back untouched. That is already the
   catalogue's rule — a motif nobody knows is ignored on display, never
   erased from the card — and the migration has no reason to be harsher
   than it is. A motif YOU created takes its id from its label and has no
   business in this table. */
const OLD_IDS: Record<string, string> = {
  "heros-meurt": "hero-dies",
  "tout-le-monde-meurt": "everyone-dies",
  "seul-survivant": "sole-survivor",
  deuil: "grief",
  "vengeance-aboutie": "revenge-fulfilled",
  "vengeance-vaine": "revenge-in-vain",
  trahison: "betrayal",
  fuite: "flight",
  chute: "downfall",
  "amour-impossible": "impossible-love",
  retrouvailles: "reunion",
  enfermement: "confinement",
  "perte-de-raison": "loss-of-reason",
  "fin-ouverte": "open-ending",
  "revelation-finale": "final-revelation",
  "retour-au-depart": "back-to-the-start",
  "fin-heureuse-mensongere": "false-happy-ending",
  "derniere-image-fixe": "final-freeze-frame",
  "epilogue-lointain": "distant-epilogue",
  "recit-non-lineaire": "non-linear-narrative",
  "narrateur-non-fiable": "unreliable-narrator",
  "huis-clos": "single-setting",
  "film-choral": "ensemble-film",
  "mise-en-abyme": "story-within-a-story",
  "voix-off": "voice-over",
  "temps-reel": "real-time",
  "boucle-temporelle": "time-loop",
  chapitres: "chapters",
  "faux-documentaire": "mockumentary",
  "plan-sequence": "long-take",
  "adaptation-litteraire": "literary-adaptation",
  "le-double": "the-double",
  "mentor-perdu": "lost-mentor",
  "faux-coupable": "wrong-man",
  "enfant-temoin": "child-witness",
  fratrie: "siblings",
  "pere-absent": "absent-father",
  "duo-depareille": "mismatched-duo",
  "groupe-qui-se-defait": "group-falling-apart",
  "artiste-au-travail": "artist-at-work",
  "figure-de-l-autorite": "authority-figure",
  fantome: "ghost",
  melancolie: "melancholy",
  burlesque: "slapstick",
  malaise: "unease",
  contemplatif: "contemplative",
  ironie: "irony",
  tendresse: "tenderness",
  fievre: "fever",
  sensualite: "sensuality",
  onirique: "dreamlike",
  "ville-tentaculaire": "sprawling-city",
  "campagne-etouffante": "stifling-countryside",
  hiver: "winter",
  "ete-ecrasant": "crushing-summer",
  mer: "sea",
  "futur-proche": "near-future",
  "apres-la-fin": "after-the-end",
  "guerre-en-arriere-plan": "war-in-the-background",
  "monde-du-travail": "world-of-work",
  "huis-clos-familial": "family-single-setting",
  "la-nuit": "the-night",
  exil: "exile",
};

/* The FAMILIES changed name at the same time as the motifs, and they are
   written on disk too: a motif you created keeps its own in
   `localStorage`. */
const OLD_FAMILIES: Record<string, MotifFamily> = {
  destin: "fate",
  fin: "ending",
  récit: "narrative",
  figure: "figures",
  ton: "tone",
  monde: "world",
};

export const migrateMotifFamily = (f: unknown): MotifFamily | null =>
  typeof f === "string" ? (OLD_FAMILIES[f] ?? null) : null;

/** Today's identifier for a motif written before the switch. */
export const migrateMotifId = (id: string): string => OLD_IDS[id] ?? id;

/** The same over a list, dropping the duplicates it would produce. */
export const migrateMotifIds = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? [...new Set(ids.filter((i) => typeof i === "string").map(migrateMotifId))]
    : [];
