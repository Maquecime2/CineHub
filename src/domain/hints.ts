/* ============================================================
   A BOND ONE DID NOT HAVE TO KNOW BY HEART
   ============================================================

   `bonds.ts` is the half of the Programme somebody states BY HAND, and
   it says so in its own opening: what no sweep of the collection could
   ever find out. That stays true of the collection — and it was never
   true of the world. "Kiyoshi Kurosawa studied under Shigehiko Hasumi"
   is a published fact; leaving it to be typed from memory meant a fresh
   binder drew a map with not one edge on it, and therefore a run no step
   could justify.

   A HINT IS NOT A BOND, AND THE DISTANCE IS THE POINT. It carries no
   `id`, no `at`, and it never reaches the disk on its own: it fills the
   form in, and `makeBond` -> `hasBond` -> `contradicts` stay the one
   door, exactly as they are for a name typed by hand. A machine's
   guess that wrote itself into `filiations` would become
   indistinguishable from what somebody knows, and it would synchronise.

   THE MEANING IS THE TRAP, AND IT IS REVERSED ONE TIME IN TWO. Wikidata
   states its triples from the SUBJECT, and two of the three properties
   we read point the opposite way to a bond:

     P1066  "student of"      a is the pupil OF b  -> master, b -> a
     P802   "student"         a has b FOR a pupil  -> master, a -> b
     P737   "influenced by"   a is influenced BY b -> influence, b -> a

   Getting one of those backwards fails nothing. It draws a map in which
   the pupils taught their masters, and nobody would find out from the
   screen. Hence one test per line of that table.

   AN UNKNOWN FILM-MAKER IS KEPT, and that is not laxity. `buildLineage`
   already handles the `orphan` node, and somebody's master is very often
   somebody one owns no film by — which is precisely the thing worth
   learning. Nothing here filters on the collection.

   NO `force` EITHER: it is DERIVED from the kind by `SPRING`
   (`domain/lineageMap`). Carrying it would be a second source for one
   value, and the two would drift.
   ============================================================ */
import { bondId, contradicts, hasBond, makeBond } from "./bonds";
import type { Bond, BondKind } from "./bonds";
import { census } from "./people";
import { directorsOf } from "./lineageMap";
import { kinshipsOf } from "./sky";
import { normalize } from "./search";
import type { Film, KinshipRole } from "../types";

/**
 * Where a hint comes from — a catalogue key is chosen at render time.
 *
 * `"wikidata"` is a STATEMENT somebody published; `"binder"` and
 * `"tmdb"` are co-credits, i.e. a lead and not a piece of knowledge. The
 * screen does not word them the same way, so the difference has to
 * survive as data.
 */
export type HintSource = "wikidata" | "tmdb" | "binder";

export interface Hint {
  kind: BondKind;
  fromName: string;
  toName: string;
  /**
   * What goes into `Bond.note` if the hint is laid down.
   *
   * A SHORT REFERENCE, NEVER A SENTENCE. `Bond.note` goes to disk and
   * synchronises: a French phrase written here would freeze the day's
   * language into somebody's data, which is the reason `threadLabel`
   * reads the catalogue instead of copying a motif's wording.
   */
  note: string;
  source: HintSource;
}

/** One triple as the relay flattens it, read as `from <prop> to`. */
export interface RawLink {
  /** The TMDB id asked about. Kept for the cache, unread here. */
  seed?: string;
  from: string;
  to: string;
  prop: string;
}

/* THE TABLE ABOVE, AS DATA. `swap` is the whole difficulty of this
   file: true means Wikidata's subject is the bond's TARGET. */
const FROM_PROP: Record<string, { kind: BondKind; swap: boolean }> = {
  P1066: { kind: "master", swap: true },
  P802: { kind: "master", swap: false },
  P737: { kind: "influence", swap: true },
};

/* LA NOTE EST LA PROVENANCE, et c'est ce qui rend le retrait en bloc
   possible sans ajouter un champ à `Bond`. Un champ `source` sur le lien
   aurait voyagé sur le disque et se serait synchronisé, pour une
   information que la note portait déjà — et qu'on affiche de toute
   façon. Le préfixe est donc un CONTRAT : `hintFromLink` l'écrit,
   `isHinted` le lit, et rien d'autre ne doit l'écrire. */
export const HINT_MARK = "Wikidata ";
/* La seconde marque : un lien tiré de VOS fiches. Le détail qui suit est
   un rôle de `PERSON_ROLES` et un compte — deux données, jamais une
   phrase, et l'écran les met en mots par `roles.<rôle>`. */
export const CREDIT_MARK = "credits ";

const MARKS = [HINT_MARK, CREDIT_MARK];

/**
 * Ce lien vient-il d'une piste, et non d'une main ?
 *
 * On ne se fie qu'au préfixe : quelqu'un qui a récrit la note a repris
 * le lien à son compte, et le retrait en bloc doit le laisser
 * tranquille.
 */
export const isHinted = (bond: Bond): boolean => MARKS.some((m) => bond.note.startsWith(m));

/** Ce que la note d'une piste de générique dit, ou `null`. */
export const readCreditNote = (note: string): { role: string; n: number } | null => {
  if (!note.startsWith(CREDIT_MARK)) return null;
  const [role, n] = note.slice(CREDIT_MARK.length).split(" ");
  return role && n ? { role, n: Number(n) || 0 } : null;
};

/** Les liens qu'un retrait en bloc emporterait. */
export const hintedBonds = (bonds: Bond[]): Bond[] => bonds.filter(isHinted);

export const hintFromLink = (row: RawLink): Hint | null => {
  const rule = FROM_PROP[row.prop];
  if (!rule) return null;
  const a = (row.from || "").trim();
  const b = (row.to || "").trim();
  if (!a || !b) return null;
  return {
    kind: rule.kind,
    fromName: rule.swap ? b : a,
    toName: rule.swap ? a : b,
    note: `${HINT_MARK}${row.prop}`,
    source: "wikidata",
  };
};

/**
 * What is worth offering, given what is already stated.
 *
 * THE FILTER IS THE FORM'S OWN, RUN EARLY. A hint that `BondForm` would
 * refuse has no business being shown: the screen would offer a click
 * that answers with a complaint, which is the bug the gatherings took a
 * whole rewrite to lose. So each candidate goes through `makeBond` —
 * loops and empty ends fall there — then `hasBond` and `contradicts`.
 *
 * AND THROUGH `bondId`, WHICH IS WHY P1066 AND P802 DO NOT DOUBLE UP.
 * The pair is stated from both ends in Wikidata as often as not, and the
 * relay reads the seed on both sides: without this the same filiation
 * would be offered twice, once in each spelling.
 */
export const usefulHints = (hints: Hint[], bonds: Bond[]): Hint[] => {
  const seen = new Set<string>();
  const out: Hint[] = [];
  for (const hint of hints) {
    const bond = makeBond({ kind: hint.kind, fromName: hint.fromName, toName: hint.toName });
    if (!bond) continue;
    if (seen.has(bond.id)) continue;
    if (hasBond(bonds, bond)) continue;
    if (contradicts(bonds, bond)) continue;
    seen.add(bond.id);
    out.push(hint);
  }
  return out;
};

/**
 * The hints touching this person, whichever end they stand at.
 *
 * Keyed like everything else — `makeBond` normalises the two names, so
 * the comparison is `domain/people`'s key and not a spelling.
 */
export const hintsTouching = (hints: Hint[], key: string): Hint[] =>
  hints.filter((h) => {
    const bond = makeBond({ kind: h.kind, fromName: h.fromName, toName: h.toName });
    return !!bond && (bond.from === key || bond.to === key);
  });

/** The identity a hint would take once laid down. `""` if it cannot be. */
export const hintId = (hint: Hint): string => {
  const bond = makeBond({ kind: hint.kind, fromName: hint.fromName, toName: hint.toName });
  return bond ? bondId(bond.kind, bond.from, bond.to) : "";
};

/* ============================================================
   CE QUE VOS PROPRES FICHES SAVENT DÉJÀ
   ============================================================

   WIKIDATA COUVRE UN CENTIÈME DES RÉALISATEURS. Sur les soixante et un
   mille que Wikidata relie à un identifiant TMDB, quatre cents portent
   « élève de », cent soixante « a pour élève », deux cent cinquante
   « influencé par ». Mario Bava n'en porte aucune — et il en va de même
   de l'immense majorité. Une fonction qui répond une fois sur cent
   n'aide pas à bâtir un programme.

   OR LE CLASSEUR TIENT LA RÉPONSE, ET GRATUITEMENT. Une fiche garde
   `image`, `scénario` et `musique` en plus de la réalisation : un
   cinéaste qui figure au générique d'un film réalisé par un AUTRE
   cinéaste du classeur est un fait déjà rangé chez vous. Bava a été le
   chef opérateur de Riccardo Freda ; il suffit d'avoir un Freda pour
   que ça se voie. Aucun appel, aucun quota, aucune attente.

   ET C'EST UNE AFFINITÉ, JAMAIS UN MAGISTÈRE. « A éclairé trois films
   de » n'est pas « a été formé par » : le premier est un fait, le second
   une lecture, et c'est la vôtre. La piste propose donc `affinity` et
   dit sur quoi elle se fonde ; promouvoir en `master` reste un geste,
   dans le formulaire, comme tout le reste de ce module.

   L'INTERPRÉTATION EST ÉCARTÉE. Un cinéaste qui fait un caméo chez un
   confrère est une anecdote, et les rôles d'acteur sont si nombreux dans
   une fiche que la carte se remplirait de liens que personne n'a voulus
   — le défaut que la moisson en masse a déjà coûté une fois. */
const CREDIT_ROLES: KinshipRole[] = ["image", "scénario", "musique"];

export function binderHints(films: Film[]): Hint[] {
  /* Qui RÉALISE, quelque part dans ce classeur. Sans ce filtre, chaque
     chef opérateur de la collection deviendrait un nœud de la carte des
     cinéastes, qui n'est pas ce qu'elle dessine. */
  const directors = new Map<string, string>();
  for (const person of census(films))
    if (person.roles.includes("réalisation")) directors.set(person.key, person.name);

  /* Un compte par (personne, réalisateur, rôle) : « chef opérateur sur
     trois films de » vaut mieux que trois pistes identiques. */
  const tally = new Map<string, { from: string; to: string; role: KinshipRole; n: number }>();

  for (const film of films) {
    const helm = directorsOf(film);
    if (!helm.length) continue;
    const helmKeys = new Set(helm.map((d) => d.key));

    for (const kin of kinshipsOf(film)) {
      if (!CREDIT_ROLES.includes(kin.role)) continue;
      const key = normalize(kin.name.trim());
      const name = directors.get(key);
      /* Se croiser soi-même n'est pas un lien : un cinéaste qui éclaire
         son propre film reste un seul homme. */
      if (!name || helmKeys.has(key)) continue;

      for (const boss of helm) {
        const id = `${key}|${boss.key}|${kin.role}`;
        const seen = tally.get(id);
        if (seen) seen.n += 1;
        else tally.set(id, { from: name, to: boss.name, role: kin.role, n: 1 });
      }
    }
  }

  return [...tally.values()]
    .sort((a, b) => b.n - a.n || a.from.localeCompare(b.from, "fr"))
    .map(({ from, to, role, n }) => ({
      kind: "affinity" as const,
      fromName: from,
      toName: to,
      note: `${CREDIT_MARK}${role} ${n}`,
      source: "binder" as const,
    }));
}
