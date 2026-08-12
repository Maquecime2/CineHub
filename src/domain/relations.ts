/* ============================================================
   THE NATURE OF A LINK BETWEEN TWO CARDS
   ============================================================

   `LinkType` only says WHAT THE TARGET IS — a book, a painting, another
   film. It says nothing about what happens between the two, and all of
   that lived until now in the free note: readable for you, mute to the
   map.

   A relation names that link. It changes what the constellation can draw
   — an answer is not an echo, and a remake is not a diptych.

   DIRECTION IS THE REAL DIFFICULTY. A thread is written at both ends, in
   two twin halves (`pairId`). For an echo, both halves say the same
   thing. For "sequel to", they do not: on one side "sequel to", on the
   other "precedes". Writing the same relation at both ends would have
   each film claim to be the sequel of the other — an absurdity you only
   see by opening the second card, which is to say never straight away.

   THESE VALUES ARE STORED ON THE CARDS. `Relation` is written into
   `linkedWorks[].relation` and read back from disk, so renaming it is a
   change of format, not of code. `migrateRelation` below holds the old
   spelling against the new one, and `domain/film`'s `migrate` — the only
   door a card comes in through — applies it on load. Every link already
   drawn keeps its direction. */

export type Relation =
  | "echo"
  | "diptych"
  | "same-fate"
  | "answers"
  | "answered-by"
  | "adapts"
  | "adapted-into"
  | "sequel-to"
  | "precedes"
  | "remake-of"
  | "remade-by";

export interface RelationDef {
  id: Relation;
  label: string;
  /** The other end of the thread. Equal to `id` when the relation is symmetric. */
  inverse: Relation;
  /** What the form does not offer: only ever taken on by the other half. */
  derived?: boolean;
}

export const RELATIONS: RelationDef[] = [
  { id: "echo", label: "fait écho à", inverse: "echo" },
  { id: "diptych", label: "forme un diptyque avec", inverse: "diptych" },
  { id: "same-fate", label: "même destin que", inverse: "same-fate" },
  /* "Answers" inverts to "was answered by" and NOT to "echo". Folding both
     onto the echo lost the direction of reading: the card opposite could
     no longer say which of the two had answered, and the information was
     nowhere to be found. */
  { id: "answers", label: "répond à", inverse: "answered-by" },
  { id: "answered-by", label: "a reçu une réponse de", inverse: "answers", derived: true },
  { id: "adapts", label: "adapte", inverse: "adapted-into" },
  { id: "adapted-into", label: "a été adapté par", inverse: "adapts", derived: true },
  { id: "sequel-to", label: "fait suite à", inverse: "precedes" },
  { id: "precedes", label: "précède", inverse: "sequel-to", derived: true },
  { id: "remake-of", label: "refait", inverse: "remade-by" },
  { id: "remade-by", label: "a été refait par", inverse: "remake-of", derived: true },
];

const BY_ID = new Map(RELATIONS.map((r) => [r.id, r]));

export const relationDef = (r: string | null | undefined): RelationDef | undefined =>
  r ? BY_ID.get(r as Relation) : undefined;

/** What the thread's other half sees. An unknown relation stays itself. */
export const inverseOf = (r: Relation | null | undefined): Relation | undefined =>
  r ? (BY_ID.get(r)?.inverse ?? r) : undefined;

/** What we offer for entry: the derived ones write themselves. */
export const ENTERABLE_RELATIONS = RELATIONS.filter((r) => !r.derived);

export const isSymmetric = (r: Relation): boolean => BY_ID.get(r)?.inverse === r;

/* The thread's strength, in three notches and no more.

   Three because we know how to say "a little / a lot / it is the same
   film" and we do not know how to say 7 out of 10 about a kinship. A fine
   slider would give false precision, and the map would get nothing more
   out of it: it only uses strength to pull the stars closer and thicken
   the line. */
export type Strength = 1 | 2 | 3;
export const STRENGTHS: { value: Strength; label: string }[] = [
  { value: 1, label: "un fil ténu" },
  { value: 2, label: "une vraie parenté" },
  { value: 3, label: "le même film, deux fois" },
];

export const strengthOf = (f: number | null | undefined): Strength =>
  f === 1 || f === 2 || f === 3 ? f : 2;

/* ------------------------------------------------------------
   THE OLD SPELLING
   ------------------------------------------------------------

   Relations written before this module was translated are French on
   disk. This table is the only place that knows both vocabularies;
   `domain/film`'s `migrate` runs every stored relation through it, so a
   link drawn last year comes back pointing the same way.

   A value that is neither old nor known comes back untouched rather than
   as `undefined`: a relation we cannot read is still better kept than
   silently dropped. */
const OLD_SPELLING: Record<string, Relation> = {
  écho: "echo",
  diptyque: "diptych",
  "même-destin": "same-fate",
  "réponse-à": "answers",
  "répondu-par": "answered-by",
  "adapté-de": "adapts",
  "adapté-en": "adapted-into",
  "suite-de": "sequel-to",
  précède: "precedes",
  "remake-de": "remake-of",
  "remaké-par": "remade-by",
};

export const migrateRelation = <T>(r: T): T | Relation =>
  typeof r === "string" && r in OLD_SPELLING ? OLD_SPELLING[r]! : r;
