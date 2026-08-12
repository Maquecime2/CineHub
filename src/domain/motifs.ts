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

export type MotifFamily = "fate" | "ending" | "narrative" | "figures" | "tone" | "world";

export interface Motif {
  /** Stable key, never the label: it is what gets written on the card. */
  id: string;
  label: string;
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

export const FAMILIES: { id: MotifFamily; label: string }[] = [
  { id: "fate", label: "Ce qui arrive aux personnages" },
  { id: "ending", label: "La dernière image" },
  { id: "narrative", label: "La façon de raconter" },
  { id: "figures", label: "Les figures" },
  { id: "tone", label: "Le ton" },
  { id: "world", label: "Le monde" },
];

/* THE ORDER MATTERS: it is the display order, family by family, and it
   runs from the most common to the rarest inside each one. */
export const MOTIFS: Motif[] = [
  /* --- what happens to the characters ------------------------------ */
  {
    id: "hero-dies",
    label: "Le héros meurt",
    family: "fate",
    spoiler: true,
    tmdb: ["death of hero", "dying and death", "protagonist dies"],
  },
  {
    id: "sacrifice",
    label: "Il se sacrifie",
    family: "fate",
    spoiler: true,
    tmdb: ["self sacrifice", "sacrifice", "heroic sacrifice"],
  },
  {
    id: "everyone-dies",
    label: "Personne n'en réchappe",
    family: "fate",
    spoiler: true,
    tmdb: ["mass death", "massacre"],
  },
  {
    id: "sole-survivor",
    label: "Un seul en réchappe",
    family: "fate",
    spoiler: true,
    tmdb: ["sole survivor", "survivor"],
  },
  { id: "grief", label: "Le deuil d'un proche", family: "fate", tmdb: ["grief", "mourning"] },
  {
    id: "revenge-fulfilled",
    label: "La vengeance aboutit",
    family: "fate",
    spoiler: true,
    tmdb: ["revenge", "vengeance"],
  },
  {
    id: "revenge-in-vain",
    label: "La vengeance ne répare rien",
    family: "fate",
    spoiler: true,
  },
  {
    id: "betrayal",
    label: "Trahi par un proche",
    family: "fate",
    tmdb: ["betrayal", "traitor"],
  },
  { id: "flight", label: "La fuite", family: "fate", tmdb: ["escape", "on the run", "manhunt"] },
  {
    id: "downfall",
    label: "L'ascension puis la chute",
    family: "fate",
    tmdb: ["rise and fall", "downfall"],
  },
  {
    id: "impossible-love",
    label: "L'amour impossible",
    family: "fate",
    tmdb: ["forbidden love", "unrequited love", "impossible love"],
  },
  {
    id: "reunion",
    label: "Se retrouver après des années",
    family: "fate",
    tmdb: ["reunion", "family reunion"],
  },
  {
    id: "confinement",
    label: "Enfermé, littéralement",
    family: "fate",
    tmdb: ["prison", "captivity", "kidnapping"],
  },
  {
    id: "loss-of-reason",
    label: "La raison qui s'en va",
    family: "fate",
    tmdb: ["insanity", "madness", "mental illness"],
  },

  /* --- the last image ---------------------------------------------- */
  {
    id: "open-ending",
    label: "Fin ouverte",
    family: "ending",
    spoiler: true,
    tmdb: ["open ending", "ambiguous ending"],
  },
  {
    id: "final-revelation",
    label: "Tout bascule à la fin",
    family: "ending",
    spoiler: true,
    tmdb: ["twist ending", "plot twist", "surprise ending"],
  },
  {
    id: "back-to-the-start",
    label: "On revient au point de départ",
    family: "ending",
    spoiler: true,
  },
  {
    id: "false-happy-ending",
    label: "Une fin heureuse à laquelle on ne croit pas",
    family: "ending",
    spoiler: true,
  },
  {
    id: "final-freeze-frame",
    label: "Un dernier plan qui se fige",
    family: "ending",
    spoiler: true,
    tmdb: ["freeze frame"],
  },
  {
    id: "distant-epilogue",
    label: "Un épilogue des années après",
    family: "ending",
    spoiler: true,
  },

  /* --- the way of telling ------------------------------------------ */
  {
    id: "non-linear-narrative",
    label: "Récit désordonné",
    family: "narrative",
    tmdb: ["nonlinear timeline", "anachronic order"],
  },
  {
    id: "unreliable-narrator",
    label: "Le narrateur ment",
    family: "narrative",
    tmdb: ["unreliable narrator"],
  },
  {
    id: "single-setting",
    label: "Huis clos",
    family: "narrative",
    tmdb: ["one location", "single set"],
  },
  { id: "ensemble-film", label: "Film choral", family: "narrative", tmdb: ["ensemble cast"] },
  {
    id: "road-movie",
    label: "Road movie",
    family: "narrative",
    tmdb: ["road movie", "road trip"],
  },
  {
    id: "story-within-a-story",
    label: "Un film dans le film",
    family: "narrative",
    tmdb: ["film within a film", "filmmaking", "metafiction"],
  },
  {
    id: "voice-over",
    label: "Porté par une voix off",
    family: "narrative",
    tmdb: ["voice over narration", "narration"],
  },
  {
    id: "real-time",
    label: "En temps réel",
    family: "narrative",
    tmdb: ["real time", "one day"],
  },
  {
    id: "time-loop",
    label: "La même journée qui recommence",
    family: "narrative",
    tmdb: ["time loop"],
  },
  { id: "chapters", label: "Découpé en chapitres", family: "narrative", tmdb: ["anthology"] },
  {
    id: "flashback",
    label: "Raconté depuis après",
    family: "narrative",
    tmdb: ["flashback", "told in flashback"],
  },
  { id: "mockumentary", label: "Faux documentaire", family: "narrative", tmdb: ["mockumentary"] },
  {
    id: "long-take",
    label: "De longs plans-séquences",
    family: "narrative",
    tmdb: ["long take", "one shot"],
  },
  {
    id: "literary-adaptation",
    label: "Vient d'un livre",
    family: "narrative",
    tmdb: ["based on novel or book", "based on play"],
  },

  /* --- the figures -------------------------------------------------- */
  { id: "the-double", label: "Le double", family: "figures", tmdb: ["doppelganger", "twins"] },
  {
    id: "lost-mentor",
    label: "Le mentor qu'on perd",
    family: "figures",
    spoiler: true,
    tmdb: ["mentor"],
  },
  {
    id: "wrong-man",
    label: "Le faux coupable",
    family: "figures",
    tmdb: ["wrongful conviction", "wrongly accused"],
  },
  {
    id: "child-witness",
    label: "Un enfant qui regarde",
    family: "figures",
    tmdb: ["child protagonist", "coming of age"],
  },
  {
    id: "siblings",
    label: "Une histoire de fratrie",
    family: "figures",
    tmdb: ["brother brother relationship", "sister sister relationship", "siblings"],
  },
  {
    id: "absent-father",
    label: "Le père absent",
    family: "figures",
    tmdb: ["father son relationship", "absent father"],
  },
  {
    id: "mismatched-duo",
    label: "Un duo dépareillé",
    family: "figures",
    tmdb: ["buddy", "odd couple"],
  },
  {
    id: "group-falling-apart",
    label: "Une bande qui se défait",
    family: "figures",
    tmdb: ["friendship", "gang"],
  },
  {
    id: "artist-at-work",
    label: "Quelqu'un qui fabrique quelque chose",
    family: "figures",
    tmdb: ["artist", "writer", "musician"],
  },
  {
    id: "authority-figure",
    label: "L'institution comme adversaire",
    family: "figures",
    tmdb: ["bureaucracy", "corruption"],
  },
  {
    id: "ghost",
    label: "Un mort qui reste là",
    family: "figures",
    tmdb: ["ghost", "haunting"],
  },

  /* --- the tone ------------------------------------------------------ */
  { id: "melancholy", label: "Mélancolie", family: "tone", tmdb: ["melancholy", "loneliness"] },
  { id: "slapstick", label: "Burlesque", family: "tone", tmdb: ["slapstick comedy", "farce"] },
  {
    id: "unease",
    label: "Malaise",
    family: "tone",
    tmdb: ["awkwardness", "psychological horror"],
  },
  {
    id: "contemplative",
    label: "Contemplatif",
    family: "tone",
    tmdb: ["slow cinema", "meditative"],
  },
  { id: "irony", label: "Ironie froide", family: "tone", tmdb: ["black comedy", "satire"] },
  { id: "tenderness", label: "Tendresse", family: "tone", tmdb: ["heartwarming"] },
  { id: "fever", label: "Fièvre, tout va trop vite", family: "tone", tmdb: ["frenetic"] },
  { id: "sensuality", label: "Sensualité", family: "tone", tmdb: ["eroticism", "sensuality"] },
  { id: "paranoia", label: "Paranoïa", family: "tone", tmdb: ["paranoia", "conspiracy"] },
  { id: "dreamlike", label: "Onirique", family: "tone", tmdb: ["dream", "surrealism"] },

  /* --- the world ----------------------------------------------------- */
  {
    id: "sprawling-city",
    label: "La grande ville qui avale",
    family: "world",
    tmdb: ["urban setting", "megacity", "new york city"],
  },
  {
    id: "stifling-countryside",
    label: "La campagne étouffante",
    family: "world",
    tmdb: ["rural setting", "small town", "village"],
  },
  { id: "winter", label: "L'hiver, la neige", family: "world", tmdb: ["winter", "snow"] },
  {
    id: "crushing-summer",
    label: "Un été écrasant",
    family: "world",
    tmdb: ["summer", "heat wave"],
  },
  { id: "sea", label: "La mer", family: "world", tmdb: ["ocean", "sea", "island"] },
  {
    id: "near-future",
    label: "Un futur tout proche",
    family: "world",
    tmdb: ["near future", "dystopia"],
  },
  {
    id: "after-the-end",
    label: "Après la fin du monde",
    family: "world",
    tmdb: ["post-apocalyptic future", "apocalypse"],
  },
  {
    id: "war-in-the-background",
    label: "La guerre, en arrière-plan",
    family: "world",
    tmdb: ["world war ii", "war", "occupation"],
  },
  {
    id: "world-of-work",
    label: "Le travail, vraiment montré",
    family: "world",
    tmdb: ["workplace", "factory", "office"],
  },
  {
    id: "family-single-setting",
    label: "La maison de famille",
    family: "world",
    tmdb: ["family drama", "dysfunctional family"],
  },
  { id: "the-night", label: "Ça se passe la nuit", family: "world", tmdb: ["night", "one night"] },
  {
    id: "exile",
    label: "Loin de chez soi",
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

export const byFamily = (): { family: MotifFamily; label: string; motifs: Motif[] }[] => {
  const inUse = allMotifs();
  return FAMILIES.map((f) => ({
    family: f.id,
    label: f.label,
    motifs: inUse.filter((m) => m.family === f.id),
  })).filter((f) => f.motifs.length > 0);
};

/** Search in the catalogue, on the label AND the family. */
export const searchMotifs = (q: string): Motif[] => {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return allMotifs().filter(
    (m) =>
      m.label.toLowerCase().includes(t) ||
      (FAMILIES.find((f) => f.id === m.family)
        ?.label.toLowerCase()
        .includes(t) ??
        false)
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
