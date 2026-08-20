/* ============================================================
   WHAT TIES ONE FILM-MAKER TO ANOTHER
   ============================================================

   The binder knows what we have seen and what we mean to see, and it
   knows how to tie FILMS together (the constellation). It knew nothing
   of what stands behind a viewing plan: "so-and-so was so-and-so's
   master" had nowhere to be written. `domain/people` says it plainly —
   a person "is not an entity one files, it is a question put to the
   collection" — and the only person-to-person relation that existed,
   `companions`, is DERIVED and cannot be edited. This module is the
   other half: what somebody states by hand, and that no sweep of the
   collection could ever find out.

   MODELLED ON `domain/relations`, WITH ONE DELIBERATE DIVERGENCE. Over
   there a relation comes in pairs of ids (`answers` / `answered-by`)
   because a red thread is written AT BOTH ENDS, on two separate cards,
   and each end must be able to say its own half. Here a bond is ONE
   row carrying `from` and `to`: the direction is in the data. So the
   inverse is no longer a second id — it is merely another way of
   READING the same row, and `inverse` therefore holds a catalogue key
   rather than a `BondKind`. Writing it as a pair here would have
   invented a second row nobody would ever have deleted.

   THE IDENTITY IS THE BOND ITSELF, computed and never generated. Two
   rows saying the same thing cannot exist rather than merely being
   unlikely — the lesson `domain/threads` had to learn the hard way.

   WHAT IS NOT A DUPLICATE IS A CONTRADICTION. A → B and B → A on a
   DIRECTED kind are not the same row written twice: they are two
   statements that cannot both hold. Silently merging them would pick a
   winner nobody chose, so the first written stands, the second is
   turned away at the door, and the form refuses it in the open
   (`contradicts`) instead of accepting a click that does nothing.

   THE NAMES ARE STORED ALONGSIDE THE KEYS, and that is the whole
   reason a bond survives the collection. The key is `normalize(name)`,
   the same one `domain/people` files everybody under, so a node can be
   opened in the Credits with no translation. But erasing the last card
   carrying a name does not erase what one knows about that film-maker:
   without `fromName` / `toName` the row would come back as a bare
   normalised string, and a lineage would read "hou hsiao hsien". */
import { normalize } from "./search";
import type { NameOf } from "./motifs";

export type BondKind = "master" | "affinity" | "influence" | "counterpoint";

export interface BondDef {
  id: BondKind;
  /** Catalogue key, read from `from` towards `to` — never a sentence. */
  label: string;
  /** The same bond read the other way. Equal to `label` when symmetric. */
  inverse: string;
  directed: boolean;
  /** This kind CALLS FOR a free label; the form puts it forward. */
  freeLabel?: boolean;
}

/* FOUR KINDS, AND WHY EACH IS ORIENTED OR NOT.

   Teaching and influence have a direction one can name: somebody comes
   before somebody else, and reversing it says something false rather
   than something vague.

   An affinity does not. Neither does an opposition — orienting a
   counterpoint would force a choice of who opposes whom, and that
   question has no answer. Making all four directed for the sake of
   symmetry would have put that unanswerable question in the form. */
export const BONDS: BondDef[] = [
  { id: "master", label: "bonds.master", inverse: "bonds.masterInverse", directed: true },
  {
    id: "influence",
    label: "bonds.influence",
    inverse: "bonds.influenceInverse",
    directed: true,
  },
  {
    id: "affinity",
    label: "bonds.affinity",
    inverse: "bonds.affinity",
    directed: false,
    freeLabel: true,
  },
  {
    id: "counterpoint",
    label: "bonds.counterpoint",
    inverse: "bonds.counterpoint",
    directed: false,
  },
];

const BY_ID = new Map(BONDS.map((b) => [b.id, b]));

export const bondDef = (kind: string | null | undefined): BondDef | undefined =>
  kind ? BY_ID.get(kind as BondKind) : undefined;

export const isBondKind = (kind: unknown): kind is BondKind =>
  typeof kind === "string" && BY_ID.has(kind as BondKind);

export interface Bond {
  /** Computed from the kind and the two keys — see `bondId`. */
  id: string;
  kind: BondKind;
  /** Normalised keys, as `domain/people` files them. */
  from: string;
  to: string;
  /**
   * The names AS TYPED. The only trace left of a film-maker once no
   * card in the collection carries their name.
   */
  fromName: string;
  toName: string;
  /** A free label. Empty is the norm; `affinity` is what asks for one. */
  note: string;
  at: number;
}

/**
 * The identity of a bond.
 *
 * Undirected kinds sort their two keys before joining them, so A—B and
 * B—A come out as ONE id. Directed kinds keep the order, because that
 * order is the statement.
 */
export const bondId = (kind: BondKind, from: string, to: string): string =>
  bondDef(kind)?.directed ? `${kind}:${from}>${to}` : `${kind}:${[from, to].sort().join("|")}`;

export interface BondDraft {
  kind: BondKind;
  fromName: string;
  toName: string;
  note?: string;
  at?: number;
}

/**
 * A bond from two names as typed.
 *
 * Returns `null` rather than a broken row when there is nothing to
 * state: an empty name, or the same person at both ends — a loop says
 * nothing, and drawing one would only invite the question of what it
 * meant.
 */
export const makeBond = ({ kind, fromName, toName, note = "", at }: BondDraft): Bond | null => {
  if (!isBondKind(kind)) return null;
  const a = fromName.trim();
  const b = toName.trim();
  if (!a || !b) return null;

  let from = normalize(a);
  let to = normalize(b);
  if (!from || !to || from === to) return null;

  let names = [a, b];
  /* An undirected bond is stored in ONE canonical order so that its id
     is stable — and the names follow the keys they belong to, or a row
     written B—A would come back with the two names swapped. */
  if (!bondDef(kind)!.directed && from > to) {
    [from, to] = [to, from];
    names = [b, a];
  }

  return {
    id: bondId(kind, from, to),
    kind,
    from,
    to,
    fromName: names[0]!,
    toName: names[1]!,
    note: note.trim(),
    at: at ?? Date.now(),
  };
};

/** Every bond touching this person, whichever end they are at. */
export const bondsTouching = (bonds: Bond[], key: string): Bond[] =>
  bonds.filter((b) => b.from === key || b.to === key);

/**
 * What to write under a bond, READ FROM `key`.
 *
 * Standing at the pupil, the same row reads "pupil of X" and not
 * "master of X". This is what lets an entry in the running order state
 * its film-maker's bonds without anybody having to reverse them in
 * their head — and the domain still knows nothing of i18next: it is
 * handed a `NameOf`, exactly as `threadLabel` is.
 */
export const bondLabel = (bond: Bond, key: string, name: NameOf): string => {
  const def = bondDef(bond.kind);
  if (!def) return bond.note;
  const atEnd = bond.to === key;
  const other = atEnd ? bond.fromName : bond.toName;
  return name(atEnd ? def.inverse : def.label, { name: other });
};

/**
 * The bond already stored that this one would contradict.
 *
 * ONLY DIRECTED KINDS CAN CONTRADICT. Two undirected rows on the same
 * pair share an id, so they are a duplicate and merge on their own —
 * there is nothing to refuse. A directed pair does not: A → B and
 * B → A are two different ids and two incompatible statements, and
 * nothing but this function stands between them.
 */
export const contradicts = (bonds: Bond[], candidate: Bond): Bond | undefined =>
  bondDef(candidate.kind)?.directed
    ? bonds.find(
        (b) => b.kind === candidate.kind && b.from === candidate.to && b.to === candidate.from
      )
    : undefined;

/** Is this bond already stated, in this exact direction? */
export const hasBond = (bonds: Bond[], candidate: Bond): boolean =>
  bonds.some((b) => b.id === candidate.id);

/**
 * What comes off the disk: we trust nothing about its shape.
 *
 * THE ONE DOOR, as `normalizeThreads` is for gatherings. Everything
 * that cannot be stated is dropped here rather than drawn in grey
 * somewhere further on:
 *
 *   — a kind this version does not know. Keeping it would mean a shape
 *     with no spring length, no ink and no wording, i.e. a line the map
 *     could not draw and the column could not read;
 *   — a loop, an empty end, a duplicate (merged by id, first one wins
 *     its `at`);
 *   — a contradiction, where the FIRST WRITTEN stands. Reading is not
 *     the place to arbitrate a disagreement, so it takes the one answer
 *     that surprises nobody: the newcomer is the one turned away.
 */
export const normalizeBonds = (raw: unknown): Bond[] => {
  const byId = new Map<string, Bond>();

  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<Bond>;
    if (!isBondKind(e.kind)) continue;

    /* The names are the source, the keys are derived from them. Trusting
       a stored key would let a hand-edited file put a bond under a
       person nobody is named after. */
    const bond = makeBond({
      kind: e.kind,
      fromName: typeof e.fromName === "string" ? e.fromName : "",
      toName: typeof e.toName === "string" ? e.toName : "",
      note: typeof e.note === "string" ? e.note : "",
      at: typeof e.at === "number" ? e.at : undefined,
    });
    if (!bond) continue;

    const already = byId.get(bond.id);
    if (already) {
      /* Written twice by an import: one row, and we keep whichever half
         actually says something rather than dropping a note in silence. */
      byId.set(bond.id, {
        ...already,
        note: already.note || bond.note,
        at: Math.min(already.at, bond.at),
      });
      continue;
    }
    if (contradicts([...byId.values()], bond)) continue;
    byId.set(bond.id, bond);
  }

  return [...byId.values()].sort((a, b) => a.at - b.at);
};
