/* ============================================================
   WHO DIRECTED THIS, AND UNDER WHAT KEY
   ============================================================

   `Film.director` IS A FREE STRING WITH COMMAS IN IT, and everything
   here follows from that. `kinshipsOf` is the ONE definition of "in
   what capacity somebody appears on a film" (`domain/sky`), and it
   already splits that field; re-splitting it here would make the two
   drift apart the first time a co-director was written differently.

   THE KEY IS `normalize(name)`, the same one `domain/people` files
   everybody under. So a node of the map opens straight onto their page
   in the Credits, with nothing to translate on the way.

   `UNKNOWN_DIRECTOR` IS DATA AND STAYS DATA. A film with nobody
   credited yields NO key at all rather than a key named by a catalogue
   entry: translating it would freeze the language of the day into
   somebody's course, and the literals test — which looks for sentences
   in views — would never have caught it. */
import { normalize } from "./search";
import { kinshipsOf } from "./sky";
import { bondsTouching } from "./bonds";
import type { Bond, BondKind } from "./bonds";
import { courseSteps } from "./course";
import type { Course } from "./course";
import type { Strength } from "./relations";
import type { Film } from "../types";

export interface Director {
  key: string;
  name: string;
}

/** Everybody credited with directing this film, in the order written. */
export const directorsOf = (film: Film): Director[] => {
  const out: Director[] = [];
  const seen = new Set<string>();
  for (const k of kinshipsOf(film)) {
    if (k.role !== "réalisation") continue;
    const name = k.name.trim();
    const key = normalize(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, name });
  }
  return out;
};

export const directorKeys = (film: Film): string[] => directorsOf(film).map((d) => d.key);

/**
 * The one name a film is filed under in a running order.
 *
 * The FIRST credited, and not a choice made cleverly: a card written
 * "Powell, Pressburger" reads that way everywhere else in the binder,
 * and a column that silently preferred the second would be describing a
 * different film from the one on the card. `null` when nobody is
 * credited — see the header.
 */
export const primaryDirector = (film: Film): Director | null => directorsOf(film)[0] ?? null;

/* ============================================================
   WHAT THE MAP DRAWS
   ============================================================

   ONE RULE, AND EVERYTHING FOLLOWS FROM IT:

     the nodes are the film-makers NAMED IN THE RUN, plus those NAMED
     IN A BOND.

   So a director put into the run is a node at once, alone in the middle
   of nothing — which means clicking an entry is never a dead end. And a
   director tied to somebody but with no film in the run is a HOLLOW
   node: that hollow is the screen's chief invitation, not an oversight.

   AN ORPHAN IS STILL A NODE. When no card in the collection carries the
   name any more, the bond keeps it (`fromName` / `toName`) and the map
   goes on drawing it. Erasing a card is not the same act as unlearning
   who taught whom, and only one of the two was asked for. */
export interface LineageNode {
  /** `p:<key>` — prefixed like the sky's, since `relax` seeds on the id. */
  id: string;
  key: string;
  name: string;
  /** Ses films DANS le programme. */
  inCourse: number;
  /** Ses films au classeur. */
  owned: number;
  /** Plus une seule fiche à son nom : le nom vient du lien. */
  orphan: boolean;
  degree: number;
}

export interface LineageLink {
  a: string;
  b: string;
  bond: Bond;
  /** Ce que lit `relax` : voir `SPRING`. */
  kind: "peer";
  force: Strength;
}

/* WHY ALL FOUR ARE `peer`, AND THE MEANING RIDES ON `force`.

   `relax` knows three rest lengths: `peer` (260 − force × 40), `thread`
   (170) and a default of 128. `thread` already means one precise thing
   on the other map — members clustered round a name — so borrowing it
   here would add a fifth length with no name. Riding on `force` instead
   changes not one line of the relaxation, and it says the right thing:
   a filiation reads as closeness, an opposition holds apart. */
const SPRING: Record<BondKind, Strength> = {
  master: 3, // 140
  influence: 2, // 180
  affinity: 2, // 180
  counterpoint: 1, // 220
};

export const nodeId = (key: string): string => `p:${key}`;

export function buildLineage(
  films: Film[],
  bonds: Bond[],
  course: Course | null
): { nodes: LineageNode[]; links: LineageLink[] } {
  const nodes = new Map<string, LineageNode>();

  const owner = new Map<string, { name: string; owned: number }>();
  for (const film of films)
    for (const d of directorsOf(film)) {
      const seen = owner.get(d.key);
      if (seen) seen.owned += 1;
      else owner.set(d.key, { name: d.name, owned: 1 });
    }

  const put = (key: string, name: string) => {
    let node = nodes.get(key);
    if (!node) {
      const held = owner.get(key);
      node = {
        id: nodeId(key),
        key,
        /* The collection's spelling wins over the one typed into a bond:
           it is the one read everywhere else in the binder. The bond's
           name is what is left when the collection holds nothing. */
        name: held?.name || name,
        inCourse: 0,
        owned: held?.owned || 0,
        orphan: !held,
        degree: 0,
      };
      nodes.set(key, node);
    }
    return node;
  };

  if (course)
    for (const { film } of courseSteps(course, films))
      for (const d of directorsOf(film)) put(d.key, d.name).inCourse += 1;

  const links: LineageLink[] = [];
  for (const bond of bonds) {
    put(bond.from, bond.fromName);
    put(bond.to, bond.toName);
    links.push({
      a: nodeId(bond.from),
      b: nodeId(bond.to),
      bond,
      kind: "peer",
      force: SPRING[bond.kind],
    });
  }

  for (const node of nodes.values()) node.degree = bondsTouching(bonds, node.key).length;

  return { nodes: [...nodes.values()], links };
}
