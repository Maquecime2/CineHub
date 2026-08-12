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

   THE IDENTIFIERS BELOW ARE STORED ON THE CARDS. `Relation`'s values are
   written into `linkedWorks[].relation` and read back from disk; they are
   data, not code, so they keep their original spelling. Translating them
   would silently orphan every link already drawn. */

export type Relation =
  | "écho"
  | "diptyque"
  | "même-destin"
  | "réponse-à"
  | "répondu-par"
  | "adapté-de"
  | "adapté-en"
  | "suite-de"
  | "précède"
  | "remake-de"
  | "remaké-par";

export interface RelationDef {
  id: Relation;
  label: string;
  /** The other end of the thread. Equal to `id` when the relation is symmetric. */
  inverse: Relation;
  /** What the form does not offer: only ever taken on by the other half. */
  derived?: boolean;
}

export const RELATIONS: RelationDef[] = [
  { id: "écho", label: "fait écho à", inverse: "écho" },
  { id: "diptyque", label: "forme un diptyque avec", inverse: "diptyque" },
  { id: "même-destin", label: "même destin que", inverse: "même-destin" },
  /* "Answers" inverts to "was answered by" and NOT to "echo". Folding both
     onto the echo lost the direction of reading: the card opposite could
     no longer say which of the two had answered, and the information was
     nowhere to be found. */
  { id: "réponse-à", label: "répond à", inverse: "répondu-par" },
  { id: "répondu-par", label: "a reçu une réponse de", inverse: "réponse-à", derived: true },
  { id: "adapté-de", label: "adapte", inverse: "adapté-en" },
  { id: "adapté-en", label: "a été adapté par", inverse: "adapté-de", derived: true },
  { id: "suite-de", label: "fait suite à", inverse: "précède" },
  { id: "précède", label: "précède", inverse: "suite-de", derived: true },
  { id: "remake-de", label: "refait", inverse: "remaké-par" },
  { id: "remaké-par", label: "a été refait par", inverse: "remake-de", derived: true },
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
