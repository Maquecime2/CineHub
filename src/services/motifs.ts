/* ============================================================
   THE VOCABULARY, ON DISK
   ============================================================

   Only what belongs to you: your motifs, and the list of the catalogue's
   that you have set aside. The catalogue itself is not copied here —
   copying it would freeze forever the version of the day you first opened
   the application.

   THIS IS THE ONLY DOOR the stored vocabulary comes in through, and that
   is what makes renaming its fields safe. Three of them changed name when
   the code moved to English — `perso` became `custom`, `masqués` became
   `hidden`, and each motif's `famille` became `family` — and the old
   spellings are read right here, once. The next write uses the current
   names only.
   ============================================================ */
import { store } from "./storage";
import { FAMILIES, migrateMotifFamily, setVocabulary } from "../domain/motifs";
import type { Motif, MotifFamily, StoredVocabulary } from "../domain/motifs";

export const MOTIFS_KEY = "motifs";

const KNOWN_FAMILIES = new Set(FAMILIES.map((f) => f.id));

/** The shape stored before this module was translated. */
type StoredShape = Partial<StoredVocabulary> & { perso?: unknown; hiddenOnes?: unknown };
type StoredMotif = Partial<Motif> & { famille?: unknown };

/* A motif's family, whichever spelling it was written in. An unknown
   family must not make the motif invisible: better to file it somewhere
   than to lose it. */
const familyOf = (m: StoredMotif): MotifFamily => {
  if (m.family && KNOWN_FAMILIES.has(m.family)) return m.family;
  return migrateMotifFamily(m.family ?? m.famille) ?? "narrative";
};

/** What comes off the disk: we trust nothing about its shape. */
export const normalizeVocabulary = (raw: unknown): StoredVocabulary => {
  const stored = (raw || {}) as StoredShape;
  const rawCustom = Array.isArray(stored.custom)
    ? stored.custom
    : Array.isArray(stored.perso)
      ? (stored.perso as StoredMotif[])
      : [];
  const custom = rawCustom
    .filter((m): m is StoredMotif => !!m && typeof m === "object" && !!m.id && !!m.label)
    .map((m) => ({
      id: String(m.id),
      label: String(m.label).trim(),
      family: familyOf(m),
      ...(m.spoiler ? { spoiler: true as const } : {}),
    }))
    .filter((m) => !!m.label);
  const rawHidden = Array.isArray(stored.hidden)
    ? stored.hidden
    : Array.isArray(stored.hiddenOnes)
      ? (stored.hiddenOnes as unknown[])
      : [];
  return { custom, hidden: rawHidden.map(String) };
};

export const loadVocabulary = (): StoredVocabulary => {
  const v = normalizeVocabulary(store.get(MOTIFS_KEY, {}));
  // the domain's register is set here: it is the only reading path
  setVocabulary(v);
  return v;
};

export const saveVocabulary = (v: StoredVocabulary): boolean => {
  setVocabulary(v);
  return store.set(MOTIFS_KEY, v);
};
