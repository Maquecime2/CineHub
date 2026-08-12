/* ============================================================
   CONSTELLATION — a sky map drawn in ink.
   Every film is a star, every linked work a more discreet body. A
   work cited by two films becomes a bridge: that is where the
   constellations form.
   ============================================================ */
import { hash, seededRand } from "./seeded";
import { strengthOf } from "./relations";
import { threadMembers } from "./threads";
import type { Thread } from "./threads";
import type { Strength } from "./relations";
import type {
  Film,
  Kinship,
  KinshipRole,
  LinkedWork,
  PlacedNode,
  SkyFilters,
  SkyLink,
  SkyNode,
} from "../types";

// merge key: twice "Nighthawks / Hopper" = a single star
export const workKey = (w: LinkedWork): string =>
  `${w.type}::${w.title.trim().toLowerCase()}::${(w.creator || "").trim().toLowerCase()}`;

/* The sky shows ONLY what you linked by hand.

   The previous version placed every film in the collection and chained
   together all those by one director: at a few hundred cards, everything
   ended up linked to everything and the graph collapsed into an
   unreadable mass. A graph that shows every relation shows none of them.
   Here: only films carrying at least one red thread get onto the map. */
/* The relation as it is written on `a`'s side, going towards `b`. A
   thread's two halves carry inverse relations: without this choice, the
   line's direction would depend on the order the collection is walked
   in, and "fait suite à" would flip at random. */
const sideWrittenFrom = (films: Film[], aId: string, bId: string) =>
  (films.find((f) => f.id === aId)?.linkedWorks || []).find((w) => w.filmId === bId);

/* WHAT GETS INTO THE SKY BESIDES THE RED THREADS.

   `buildSky`'s rule — only films linked by hand — remains the guard that
   keeps the graph from collapsing. But it left two things outside, and
   they are precisely the two we came looking for:

   — THREADS, which are a named gathering ("the films where the hero
     dies"). A thread links its members by construction: so they get into
     the sky even with no red thread strung, otherwise asking the question
     would show nothing;
   — PINS, a film we went and fetched by hand from the search. An isolated
     star, yes — but set there on purpose, by a gesture, and gone at the
     first sweep. */
export interface SkyExtras {
  threads?: Thread[];
  /** Film ids to bring into the sky whatever happens. */
  pinned?: string[];
}

export function buildSky(
  films: Film[],
  { tags = [], genres = [] }: SkyFilters = {},
  { threads = [], pinned = [] }: SkyExtras = {}
): { nodes: SkyNode[]; links: SkyLink[] } {
  const keeps = (f: Film) =>
    (tags.length === 0 || tags.every((t) => (f.themes || []).includes(t))) &&
    (genres.length === 0 || genres.some((g) => (f.genres || []).includes(g)));

  const pool = films.filter(keeps);
  const poolIds = new Set(pool.map((f) => f.id));

  // a link to a card on the wall becomes an edge between two films;
  // a plain mention stays a separate star
  const worksOf = (f: Film) => (f.linkedWorks || []).filter((w) => !w.filmId);
  const peersOf = (f: Film) =>
    (f.linkedWorks || []).filter((w) => w.filmId && poolIds.has(w.filmId));
  /* Thread members and pinned films come in along with the linked ones.
     We gather them BEFORE building the nodes: a film can be both at once,
     and would otherwise be duplicated. */
  const viaThreads = new Set<string>();
  for (const thread of threads) for (const id of threadMembers(thread, pool)) viaThreads.add(id);
  const pinnedIds = new Set(pinned.filter((id) => poolIds.has(id)));

  const connected = pool.filter(
    (f) => worksOf(f).length + peersOf(f).length > 0 || viaThreads.has(f.id) || pinnedIds.has(f.id)
  );

  const nodes: SkyNode[] = connected.map((f) => ({
    id: `f:${f.id}`,
    kind: "film",
    label: f.title,
    sub: [f.year, f.director].filter(Boolean).join(" · "),
    rating: f.rating || 0,
    filmId: f.id,
    degree: 0,
    pinned: pinnedIds.has(f.id) && worksOf(f).length + peersOf(f).length === 0,
  }));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: SkyLink[] = [];
  const byKey = new Map<string, SkyNode>();

  connected.forEach((f) => {
    worksOf(f).forEach((w) => {
      const k = workKey(w);
      let node = byKey.get(k);
      if (!node) {
        node = {
          id: `w:${k}`,
          kind: "work",
          type: w.type,
          label: w.title,
          sub: w.creator || "",
          refs: 0,
          degree: 0,
        };
        byKey.set(k, node);
        nodes.push(node);
      }
      node.refs = (node.refs || 0) + 1;
      /* The note travels on a reference to a work too: that is where we
         wrote WHY the film and the book hold together, and a merged star
         (the same work cited twice) cannot carry it — it belongs to the
         line, not to the target. */
      links.push({ a: `f:${f.id}`, b: `w:${k}`, kind: "cite", note: (w.note || "").trim() });
    });
    // the link is reciprocal: one edge only for both halves
    peersOf(f).forEach((w) => {
      if (!nodeIds.has(`f:${w.filmId}`)) return;
      const [a, b] = [f.id, w.filmId as string].sort();
      if (!links.some((l) => l.a === `f:${a}` && l.b === `f:${b}`)) {
        /* The edge is unique where the thread is written on both sides in
           inverse relations. So we keep the one from end `a`, so that
           "fait suite à" always reads in the line's direction. */
        const sideA = a === f.id ? w : sideWrittenFrom(films, a as string, b as string);
        links.push({
          a: `f:${a}`,
          b: `f:${b}`,
          kind: "peer",
          relation: sideA?.relation,
          /* The note is what we wrote ourselves under the link: it is
             what we want to read on hover, before the relation's name,
             which is already guessable from the line's direction. */
          note: (sideA?.note || w.note || "").trim(),
          force: strengthOf(w.force),
        });
      }
    });
  });

  /* A thread is a star in its own right rather than a colour laid over
     its members: it carries a name, it can be taken as a focus, and its
     members visibly gather around it. An empty thread does not get in — a
     name alone in the middle of the sky says nothing. */
  for (const thread of threads) {
    const members = threadMembers(thread, connected);
    if (members.length === 0) continue;
    const id = `t:${thread.id}`;
    nodes.push({
      id,
      kind: "thread",
      label: thread.label,
      sub: `${members.length} film${members.length > 1 ? "s" : ""}`,
      color: thread.color,
      motif: thread.motif ?? null,
      degree: 0,
    });
    for (const filmId of members) links.push({ a: id, b: `f:${filmId}`, kind: "thread" });
  }

  // degree sets the size and labels only the stars that matter
  const deg = new Map<string, number>();
  links.forEach((l) => {
    deg.set(l.a, (deg.get(l.a) || 0) + 1);
    deg.set(l.b, (deg.get(l.b) || 0) + 1);
  });
  nodes.forEach((n) => {
    n.degree = deg.get(n.id) || 0;
  });

  return { nodes, links };
}

/* ============================================================
   LES PARENTÉS TROUVÉES DANS LES GÉNÉRIQUES
   ============================================================

   `buildSky` shows only what was linked by hand, and that rule stays
   intact: it is what keeps the sky from collapsing. But it has a cost — a
   fresh collection gives an empty tab, and it takes hours of typing
   before the map has anything at all to say.

   Hence this, ALONGSIDE and never instead: threads drawn from the
   credits, rendered differently, switched off by default.

   THE THRESHOLD IS THE WHOLE SUBJECT. A person present in two or three
   films says something: a cinematographer you follow, an actor you meet
   again. Present in fifteen, they no longer say anything — they would
   link everything to everything and bring back exactly the unreadable
   mass `buildSky`'s rule had driven out. Past the threshold the person is
   therefore IGNORED, and not drawn paler: a thread that means nothing
   cannot be rescued by opacity. */
export interface SuggestOptions {
  /** Below this, it is not a kinship. */
  min?: number;
  /** Above this, the person is too common to link anything at all. */
  max?: number;
}

/* EVERYTHING THAT CAN MAKE TWO CARDS KIN, with its KIND.

   The previous version flattened everything into a list of names, and
   lost the trade on the way: the map could say "Decaë" but not "image ·
   Decaë". Yet it is the trade that gives the thread its meaning —
   following a cinematographer and meeting an actor again are not the same
   curiosity.

   `thème` is a NEW source, and the only one that does not come from a
   credit list: those are your own keywords. It obeys the same threshold
   as people — a word set on fifteen cards links no more than an
   omnipresent actor does. */
/* `Film.crew`'s trades translated into kinship roles. The table is
   exported with the function: they go together, and the Credits view
   needs to know which trades exist in order to make sieves of them.

   BOTH SIDES STAY FRENCH, for two different reasons. The keys are what is
   written on disk (`crew: { image, musique, scénario }`); the values are
   `KinshipRole`, which the Credits view DISPLAYS as it is — "2 films ·
   réalisation". Translating either would break something visible. */
export const CREW_ROLES: Record<string, KinshipRole> = {
  image: "image",
  musique: "musique",
  scénario: "scénario",
};

/* PUBLIC, and for a reason: this is the only definition of "in what
   capacity this person appears on this film". The Credits view reads it
   to draw up its directory; copying it would make the two views drift
   apart at the first trade added to `Film.crew`. The `thème` role comes
   out of it too — it is not a person, and it is up to the caller to rule
   it out if it is only taking a census of people. */
export const kinshipsOf = (f: Film): Kinship[] => {
  const out: Kinship[] = [];
  for (const name of (f.director || "").split(","))
    if (name.trim()) out.push({ role: "réalisation", name: name.trim() });
  for (const name of f.cast || []) if (name.trim()) out.push({ role: "interprétation", name });
  for (const [trade, names] of Object.entries(f.crew || {})) {
    const role = CREW_ROLES[trade];
    if (!role) continue;
    for (const name of names) if (name.trim()) out.push({ role, name });
  }
  for (const t of f.themes || []) if (t.trim()) out.push({ role: "thème", name: t });
  return out;
};

/* The uniqueness key includes the ROLE: a composer who also acts in two
   films is two different kinships, and conflating them would make one of
   the two disappear. */
const keyOf = (k: Kinship): string => `${k.role}::${k.name.trim().toLowerCase()}`;

export function suggestLinks(films: Film[], { min = 2, max = 3 }: SuggestOptions = {}): SkyLink[] {
  const byKinship = new Map<string, Set<string>>();
  const readable = new Map<string, Kinship>();

  for (const f of films) {
    for (const k of kinshipsOf(f)) {
      const key = keyOf(k);
      if (key.endsWith("::")) continue;
      let batch = byKinship.get(key);
      if (!batch) byKinship.set(key, (batch = new Set()));
      batch.add(f.id);
      if (!readable.has(key)) readable.set(key, { role: k.role, name: k.name.trim() });
    }
  }

  /* One edge per PAIR, whatever the number of reasons: two films that
     share a cinematographer AND a composer are linked once, by a thread
     that gives two of them. */
  const edges = new Map<string, SkyLink>();

  for (const [key, batch] of byKinship) {
    if (batch.size < min || batch.size > max) continue;
    const reason = readable.get(key) as Kinship;
    const ids = [...batch].sort();
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const pair = `${ids[i]}|${ids[j]}`;
        const already = edges.get(pair);
        if (already) already.why?.push(reason);
        else
          edges.set(pair, {
            a: `f:${ids[i]}`,
            b: `f:${ids[j]}`,
            kind: "crew",
            why: [reason],
          });
      }
  }

  return [...edges.values()];
}

/* ============================================================
   LE VOISINAGE — ce qu'on montre quand on n'affiche pas tout
   ============================================================

   The cure for the clutter is not a better layout: it is NOT SHOWING
   EVERYTHING. A graph of two hundred stars cannot be read in any
   arrangement, and the reader only has one question at a time anyway —
   "what holds close to THIS one".

   So we start from a focus and return what is `depth` steps from it, by a
   breadth-first walk over the edges already built. Nothing to change in
   `buildSky` or `buildSkyWithCrew`: the subgraph is cut AFTERWARDS, which
   leaves the whole map available for anyone who wants it. */
export function neighbourhood(
  nodes: SkyNode[],
  links: SkyLink[],
  focusId: string,
  depth = 1
): { nodes: SkyNode[]; links: SkyLink[] } {
  const exists = new Set(nodes.map((n) => n.id));
  if (!exists.has(focusId)) return { nodes: [], links: [] };

  const neighbours = new Map<string, string[]>();
  for (const l of links) {
    if (!neighbours.has(l.a)) neighbours.set(l.a, []);
    if (!neighbours.has(l.b)) neighbours.set(l.b, []);
    neighbours.get(l.a)?.push(l.b);
    neighbours.get(l.b)?.push(l.a);
  }

  const kept = new Set([focusId]);
  let front = [focusId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const id of front)
      for (const v of neighbours.get(id) || [])
        if (!kept.has(v)) {
          kept.add(v);
          next.push(v);
        }
    front = next;
  }

  return {
    nodes: nodes.filter((n) => kept.has(n.id)),
    /* An edge is only kept if BOTH ITS ENDS are: a thread running out to
       a star we do not display leads nowhere and suggests an invisible
       neighbour. */
    links: links.filter((l) => kept.has(l.a) && kept.has(l.b)),
  };
}

/* THE SKY, KINSHIPS INCLUDED.

   Composed rather than inserted into `buildSky`: the hand-made map stays
   exactly what it was, and the addition reads as what it is — a layer on
   top, removed by flicking a switch off.

   A film that ONLY a kinship links is not among the base map's nodes: we
   add it here, otherwise the edge would point into the void. */
export function buildSkyWithCrew(
  films: Film[],
  filters: SkyFilters = {},
  options: SuggestOptions = {},
  extras: SkyExtras = {}
): { nodes: SkyNode[]; links: SkyLink[] } {
  const base = buildSky(films, filters, extras);

  /* The same filters as the base map: suggesting on top of a sky
     restricted to documentaries must not bring the rest back. */
  const { tags = [], genres = [] } = filters;
  const pool = films.filter(
    (f) =>
      (tags.length === 0 || tags.every((t) => (f.themes || []).includes(t))) &&
      (genres.length === 0 || genres.some((g) => (f.genres || []).includes(g)))
  );
  const byId = new Map(pool.map((f) => [f.id, f]));

  const nodes = [...base.nodes];
  const present = new Set(nodes.map((n) => n.id));
  const links = [...base.links];

  for (const link of suggestLinks(pool, options)) {
    /* A pair already strung by hand does not need doubling: the red
       thread already says it all, and better. */
    if (links.some((l) => l.kind === "peer" && l.a === link.a && l.b === link.b)) continue;
    links.push(link);

    for (const id of [link.a, link.b]) {
      if (present.has(id)) continue;
      const f = byId.get(id.slice(2));
      if (!f) continue;
      present.add(id);
      nodes.push({
        id,
        kind: "film",
        label: f.title,
        sub: [f.year, f.director].filter(Boolean).join(" · "),
        rating: f.rating || 0,
        filmId: f.id,
        degree: 0,
      });
    }
  }

  // degree is recounted over the whole graph: it sets the stars' size
  const deg = new Map<string, number>();
  links.forEach((l) => {
    deg.set(l.a, (deg.get(l.a) || 0) + 1);
    deg.set(l.b, (deg.get(l.b) || 0) + 1);
  });
  nodes.forEach((n) => {
    n.degree = deg.get(n.id) || 0;
  });

  return { nodes, links };
}

/* force-directed relaxation, deterministic: same collection = same sky */
export function relax(nodes: SkyNode[], links: SkyLink[], W: number, H: number): PlacedNode[] {
  if (nodes.length === 0) return [];
  const P: PlacedNode[] = nodes.map((n) => {
    const s = Math.abs(hash(n.id));
    return {
      ...n,
      x: W / 2 + (seededRand(s) - 0.5) * W * 0.75,
      y: H / 2 + (seededRand(s + 11) - 0.5) * H * 0.75,
    };
  });
  const index = new Map(P.map((p, i) => [p.id, i]));
  const edges = links
    .map((l) => ({ i: index.get(l.a), j: index.get(l.b), kind: l.kind, force: l.force }))
    .filter(
      (e): e is { i: number; j: number; kind: SkyLink["kind"]; force: Strength | undefined } =>
        e.i != null && e.j != null
    );

  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    // repulsion: two stars never overlap
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i] as PlacedNode;
        const b = P[j] as PlacedNode;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const f = Math.min(9000 / d2, 12) * cool;
        const ux = dx / d,
          uy = dy / d;
        a.x -= ux * f;
        a.y -= uy * f;
        b.x += ux * f;
        b.y += uy * f;
      }
    }
    // springs: the thread pulls the works towards their film
    edges.forEach((e) => {
      const a = P[e.i] as PlacedNode;
      const b = P[e.j] as PlacedNode;
      /* A strong link pulls closer: it is the only thing the map knows
         how to do with a strength, and it is already the right one — two
         films we hold to be the same film twice over must touch. A thread
         holds its members clustered around its name, a little looser than
         a cited work so as to leave room for the labels. */
      const rest =
        e.kind === "peer" ? 260 - strengthOf(e.force) * 40 : e.kind === "thread" ? 170 : 128;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - rest) * 0.045 * cool;
      const ux = dx / d,
        uy = dy / d;
      a.x += ux * f;
      a.y += uy * f;
      b.x -= ux * f;
      b.y -= uy * f;
    });
    // gentle gravity towards the centre of the sheet
    P.forEach((p) => {
      p.x += (W / 2 - p.x) * 0.006 * cool;
      p.y += (H / 2 - p.y) * 0.006 * cool;
    });
  }

  // reframing: the sky fills the whole sheet, whatever the collection's size
  const pad = 90;
  const xs = P.map((p) => p.x),
    ys = P.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const k = Math.min(
    (W - pad * 2) / Math.max(maxX - minX, 1),
    (H - pad * 2) / Math.max(maxY - minY, 1)
  );
  // we never magnify past reason: at two stars, the sky stays airy
  const s = Math.min(k, 1.6);
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  P.forEach((p) => {
    p.x = W / 2 + (p.x - cx) * s;
    p.y = H / 2 + (p.y - cy) * s;
  });

  return P;
}

/* ============================================================
   WALKING THE SKY BY KEYBOARD
   ============================================================

   The map could only be read with a pointer: hover, drag, click. With no
   mouse there was NO path at all to a star — the binder's richest view
   was the only one entirely shut.

   The arrow keys answer that, but we had to decide what they mean.
   Following the graph's edges (`neighbourhood`) was tempting: that is the
   structure. It is nonetheless the wrong choice — the user SEES a map,
   and on a map "right" means right. An arrow that jumps to the far side
   of the sky because the two stars are linked would give vertigo rather
   than a walk.

   So we search geometrically, within a cone: what is squarely in the
   direction asked for, and the nearest among those. */

export type Direction = "up" | "down" | "left" | "right";

/* A 45° half-cone: a star must be squarely in the direction, otherwise
   all four arrows would point at the same diagonal neighbour and we would
   go round in circles. */
const MINIMUM_COSINE = Math.SQRT1_2;

const VECTORS: Record<Direction, { x: number; y: number }> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  // the y axis points down in SVG: "up" is a decreasing y
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/**
 * The nearest star in that direction, or `null` if there is nothing on
 * that side — in which case the cursor does not move, which beats jumping
 * anywhere at all.
 *
 * `from` unknown: we return the first star, so that the first arrow
 * pressed brings you into the map rather than doing nothing.
 */
export function neighbourInDirection(
  placed: PlacedNode[],
  from: string | null,
  direction: Direction
): PlacedNode | null {
  const origin = placed.find((p) => p.id === from);
  if (!origin) return placed[0] ?? null;

  const v = VECTORS[direction];
  let best: PlacedNode | null = null;
  let bestDistance = Infinity;

  for (const p of placed) {
    if (p.id === origin.id) continue;
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    // the cosine of the angle between the move and the wanted direction
    if ((dx * v.x + dy * v.y) / distance < MINIMUM_COSINE) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = p;
    }
  }
  return best;
}
