/* ============================================================
   IN A FILM'S WAKE — what, at your place, takes after that one

   The collection already knew how to answer two questions. `athome`
   looks at the whole binder and asks "what have I forgotten?". The
   discovery desk looks outside and asks "what else is out there?".
   Neither answers the one you ask with the card open and the film still
   in mind: "and next to THAT one?".

   THIS IS NOT ABOUT GENRE. "Two dramas" brings nothing together — half a
   collection is a drama. What really brings two films together is what
   is RARE: the same person behind the camera, the same one on the music,
   a motif we have only set three times. So the weights below do not rank
   by strength of impression but by RARITY: the cinematographer goes
   ahead of the director, not because they count for more, but because
   sharing one is less likely — and because learning "these two are from
   the same eye" beats learning something you already knew.

   Pure, offline, deterministic: this half of the panel asks nothing of
   anyone, and that is what makes it useful with no TMDB key. The other
   half lives in `wakeAfar`.
   ============================================================ */
import { normalize } from "./search";
import { directorsOf, weightOf } from "../taste";
import { motifById, motifWording } from "./motifs";
import { saying, words } from "./wording";
import type { Wording } from "./wording";
import type { Film } from "../types";

/** The nature of a connection — what makes two cards hold together. */
export type Link =
  | "directing"
  | "cinematography"
  | "music"
  | "writing"
  | "motif"
  | "theme"
  | "keyword"
  | "actor"
  /**
   * "People who watched this one watched that one". The only link the
   * collection CANNOT establish on its own: it comes from TMDB's
   * recommendations, and therefore only exists in the wake from outside.
   * It appears here all the same, because a link must have a weight, a
   * label and a family — and giving it a second set elsewhere would
   * guarantee the two drift apart.
   */
  | "crowd";

export interface Match {
  type: Link;
  /**
   * What is shared, as it is WRITTEN in the collection: a name, a theme,
   * a tag. It stays a plain string because it is also what the weighting
   * matches on (`billingWeight` looks a name up by it) — translating it
   * would break the lookup as well as the meaning.
   */
  value: string;
  /**
   * Set on a motif, and only there. A catalogue motif has no label of its
   * own — it has one per language — so the display resolves it from the
   * id rather than from `value`, which holds the French of the day it was
   * matched.
   */
  motifId?: string;
}

export interface Neighbour {
  film: Film;
  score: number;
  /** The connections found, from the strongest to the weakest. */
  links: Match[];
  /** Why this one, in plain words — a `Wording`, see `domain/wording`. */
  reason: Wording;
  key: string;
}

/* THE WEIGHTS, AND WHAT THEY SAY.

   A shared cinematographer is the least likely fact on this list: you
   almost never notice one on your own, and it is often what explains why
   a film "resembles" another without your being able to say why. The
   music comes right along with it.

   Directing weighs a little LESS, against intuition: it is already
   visible everywhere else — in the Credits, on the card, in `athome`'s
   suggestions. Saying it again here teaches nothing. */
export const WEIGHTS: Record<Link, number> = {
  cinematography: 3,
  music: 3,
  directing: 2.5,
  /* TMDB draws its recommendations from real behaviour, not from an
     intersection of tags: it is a good signal, but a crowd signal. So it
     weighs less than a shared cinematographer, which is a fact you can
     check on the film in front of you. Its weight no longer puts it in
     competition with the subjects: it has a family of its own. */
  crowd: 2.2,
  writing: 2,
  motif: 2,
  actor: 1.5,
  /* A TMDB KEYWORD WEIGHS LESS THAN A MOTIF, AND MORE THAN NOTHING.

     A motif is a word you chose to follow: setting it is an act, and two
     cards that share one share it because you wanted them to. A keyword
     is written by TMDB, without you — noisier, sometimes administrative
     ("based on novel"), but it has one decisive merit: it EXISTS without
     anything having been typed. On an imported collection, motifs and
     themes are empty, and without keywords the wake can only bring
     people's names together. */
  keyword: 1.4,
  theme: 1.2,
};

/* WHAT AN ACCUMULATION MUST NOT BE ABLE TO DO.

   With no cap, six shared motifs (12 points) crush a shared
   cinematographer (3 points) — and we bring up two films that share six
   commonplaces ahead of two films that share a gaze. Each family of
   signal is therefore bounded: it can persuade, it cannot carry the day
   on its own. */
export const CAPS: Partial<Record<Link, number>> = {
  motif: 5,
  theme: 3,
  /* Capped lower than the motifs although there are more of them: two
     popular films easily share six boilerplate keywords ("sequel",
     "based on novel", "woman director"). Without this cap, they would
     crush a shared cinematographer all by themselves. */
  keyword: 3.5,
  actor: 3.5,
};

/* THE CAST IS ORDERED, AND THAT IS INFORMATION.

   `cast` carries the first eight names in the credits, in billing order.
   Treating the eighth like the first would bring up films that share
   nothing but a supporting part with three lines — and there are many of
   those, which would drown out all the rest.

   So the rank decides the weight: full for the top billing, a quarter for
   the bottom of the list.

   IT IS THE RANK IN THE PIVOT THAT COUNTS, and not the better of the two.
   The first draft took the better one, reasoning that sharing a lead is
   worth saying; but then the eighth part in the film you are looking at
   counted in full as soon as they were top-billed elsewhere — which is
   precisely the case we wanted to rule out, and there are many. The panel
   is talking about THAT film: the question is what this person is in it,
   not what they are somewhere else. */
const billingWeight = (rank: number): number => Math.max(0.25, 1 - rank * 0.11);

/** The name, made comparable: no accents, no case, no edge whitespace. */
const key = (name: string): string => normalize((name || "").trim());

/* The three trades the harvest files under `crew`, and the name of the
   matching link. We do NOT walk `crew` blindly: a key the model does not
   know would have no weight, and would then be worth zero in silence.

   THE FIRST ELEMENT IS THE STORED KEY, and it stays French. `crew` is
   written to disk as `{ image, musique, scénario }` on every card; only
   the link's name is ours to translate. */
const CREW_ROLES: [stored: string, link: Link][] = [
  ["image", "cinematography"],
  ["musique", "music"],
  ["scénario", "writing"],
];

/** The set of a trade's names, normalized. */
const peopleIn = (f: Film, role: string): string[] =>
  (f.crew?.[role] || []).map(key).filter(Boolean);

/* What we display in front of a name. "Roger Deakins" alone does not say
   what it is about; "même chef op — Roger Deakins" does. */
/* The name of each kind of link — a catalogue KEY, since it is our word
   and not the collection's. */
const LABELS: Record<Link, string> = {
  cinematography: "wake.link.cinematography",
  music: "wake.link.music",
  directing: "wake.link.directing",
  writing: "wake.link.writing",
  motif: "wake.link.motif",
  theme: "wake.link.theme",
  keyword: "wake.link.keyword",
  actor: "wake.link.actor",
  crowd: "wake.link.crowd",
};

/* The best rating a card has ever been given — the same measure as
   `athome`: the screening log can carry better than the current rating,
   and a film loved once stays a film that was loved. */
const bestRating = (f: Film): number => {
  const ratings = (f.watches || []).map((w) => w.rating).filter((r): r is number => r != null);
  return Math.max(f.rating || 0, ...(ratings.length ? ratings : [0]));
};

/* TASTE RE-RANKS, IT DOES NOT SELECT.

   A film that is very close but that we hated must go down — not vanish:
   it stays true that it takes after the pivot, and that is sometimes
   exactly what we want to know. So the multiplier is narrow, between 0.7
   and 1.3, which `weightOf` (−1 to 1) gives on its own.

   An unrated card is worth 0.35 to `weightOf`, hence a multiplier above
   1: not having rated is not having rated badly, and a collection
   imported from Letterboxd is barely a third rated. */
const byTaste = (f: Film): number => 1 + 0.3 * weightOf(bestRating(f) || f.rating);

/* ============================================================
   THREE WAYS OF RESEMBLING EACH OTHER, AND A QUOTA FOR EACH
   ============================================================

   Two films can hold together by THE PEOPLE who made them, or by WHAT
   THEY ARE ABOUT. Those are two different questions, and a plain ranking
   by score always answered the same one: proper names weigh more (a
   cinematographer is worth three points, a motif two), so much so that
   the whole list ended up as filmographies — you learned "same crew" ten
   times over and "same subject" never.

   A quota per family settles that without touching the weights, which
   stay right inside each family. We guarantee each one a place, and the
   score goes on ranking WITHIN each share.

   THE THIRD FAMILY IS A REPAIR, AND IT DESERVES SAYING. "People who
   watched this one watched that one" is neither a crew nor a subject: it
   is the crowd talking. We had filed it with the subjects, for want of a
   third box — and since a recommendation weighs 2.2 where a shared
   keyword caps at 1.8, it swept all five places of the stack every time.
   The twenty recommendations TMDB returns on each call were enough to
   saturate the whole family: the keyword query was fired, paid for, and
   its result thrown away ONE HUNDRED PER CENT of the time. No wake ever
   showed a single subject connection from outside, and that was
   arithmetic, not accident.

   THE CARRY-OVER IS INDISPENSABLE. A collection with no motifs and no
   keywords has nothing to put in "subjects"; giving it back half the
   suggestions would punish it for a lack it cannot make good on the
   spot. What one family does not take, the others take. */
export type Family = "people" | "subjects" | "crowd";

export type Quotas = Record<Family, number>;

export const DEFAULT_QUOTAS: Quotas = { people: 4, subjects: 4, crowd: 2 };

/** The order the families are served in, and nothing more. */
const FAMILIES: Family[] = ["people", "subjects", "crowd"];

const FAMILY_OF: Record<Link, Family> = {
  directing: "people",
  cinematography: "people",
  music: "people",
  writing: "people",
  actor: "people",
  motif: "subjects",
  theme: "subjects",
  keyword: "subjects",
  crowd: "crowd",
};

/* A neighbour's family is that of its STRONGEST link — the links being
   already sorted by weight. A film that shares a cinematographer and a
   motif counts under "people": that is what the displayed reason
   announces, and filing a suggestion under a family its own sentence does
   not name would be a promise broken. */
export const familyOf = (links: Match[]): Family =>
  links[0] ? FAMILY_OF[links[0].type] : "subjects";

/**
 * Serves each family up to its quota, then hands the others what one of
 * them could not take. The incoming order is preserved — the ranking by
 * score decides, the quota only reserves places.
 */
export function byQuotas<T>(
  sorted: T[],
  familyOfItem: (item: T) => Family,
  quotas: Partial<Quotas> = {}
): T[] {
  const caps = { ...DEFAULT_QUOTAS, ...quotas };
  const total = FAMILIES.reduce((s, f) => s + caps[f], 0);

  const stacks: Record<Family, T[]> = { people: [], subjects: [], crowd: [] };
  for (const item of sorted) stacks[familyOfItem(item)].push(item);

  const taken = FAMILIES.flatMap((f) => stacks[f].slice(0, caps[f]));
  /* The carry-over, in overall score order: we do not want the make-up
     to arrive in family-sized clumps after the fact. */
  if (taken.length < total) {
    const already = new Set(taken);
    for (const item of sorted) {
      if (taken.length >= total) break;
      if (!already.has(item)) taken.push(item);
    }
  }
  /* We re-sort on the original order: served family by family, the result
     would show four "same crew" and then four "same subject", which reads
     as lists glued together rather than as an answer. */
  const rank = new Map(sorted.map((item, i) => [item, i]));
  return taken.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

/* How each kind of link is counted when it turns up in numbers. The
   trades are not in here: you do not share "three cinematographers", and
   if that happened, "+ 3 autres" stays true. */
const PLURALS: Partial<Record<Link, string>> = {
  motif: "wake.more.motif",
  keyword: "wake.more.keyword",
  theme: "wake.more.theme",
  actor: "wake.more.actor",
};

/* What we write under the title. We NAME the strongest link — that is the
   one that teaches something — and sum the rest up in a count. Listing
   everything would make four lines under every poster, and nobody would
   read any of it. */
export function reasonFor(links: Match[]): Wording {
  const [head, ...rest] = links;
  if (!head) return words("");
  /* "Watched by the same people" is enough on its own: the name that
     would follow is the film you already have in front of you. */
  const named = head.motifId
    ? motifWording(motifById(head.motifId) ?? { id: head.motifId, family: "narrative" })
    : words(head.value);
  const start: Wording =
    head.type === "crowd" || !head.value
      ? saying(LABELS[head.type])
      : saying("wake.namedLink", { link: saying(LABELS[head.type]), value: named });
  if (!rest.length) return start;
  /* WHEN THE REST IS ALL OF ONE KIND, WE NAME IT. "+ 3 motifs" and
     "+ 4 actors" read; "+ 3 others" says nothing about what brings them
     together, which is precisely what we came for. */
  const kinds = new Set(rest.map((l) => l.type));
  const plural = kinds.size === 1 ? PLURALS[rest[0]!.type] : undefined;
  return saying("wake.andMore", {
    start,
    more: saying(plural ?? "wake.more.other", { count: rest.length }),
  });
}

/** Every connection between two cards, from the strongest to the weakest. */
export function linksBetween(pivot: Film, other: Film): Match[] {
  const links: Match[] = [];

  /* Directing. The field can carry several names ("Coen, Coen"), hence
     the splitting — the same as everywhere else. */
  const directors = new Map(directorsOf(other).map((n: string) => [key(n), n]));
  for (const name of directorsOf(pivot) as string[]) {
    const theirs = directors.get(key(name));
    if (theirs) links.push({ type: "directing", value: name });
  }

  for (const [stored, link] of CREW_ROLES) {
    const theirs = new Set(peopleIn(other, stored));
    for (const name of pivot.crew?.[stored] || [])
      if (theirs.has(key(name))) links.push({ type: link, value: name });
  }

  /* The shared motifs — and, along the way, the TMDB keywords those
     motifs already cover. Every catalogue motif carries the list of
     keywords that designate it (`motif.tmdb`): it is through that list
     that `suggestMotifs` offers them, and through it that we avoid saying
     the same thing twice under one poster. */
  const coveredWords = new Set<string>();
  const theirMotifs = new Set(other.motifs || []);
  for (const id of pivot.motifs || []) {
    if (!theirMotifs.has(id)) continue;
    const motif = motifById(id);
    /* A motif unknown to the catalogue is ignored on display, never
       erased from the card: the rule holds throughout the project. */
    if (!motif) continue;
    links.push({ type: "motif", value: motif.id, motifId: motif.id });
    /* `motif.tmdb` mixes labels and numeric identifiers. We keep only the
       labels: `film.keywords` carries names, and an identifier does not
       compare against them. */
    for (const word of motif.tmdb || []) if (typeof word === "string") coveredWords.add(key(word));
  }

  const theirThemes = new Set((other.themes || []).map(key));
  for (const t of pivot.themes || [])
    if (theirThemes.has(key(t))) links.push({ type: "theme", value: t });

  /* TMDB's keywords, except those a shared motif has just said: "Le héros
     meurt" followed by "death of hero" would make the same remark twice
     under the same poster, and would count twice. */
  const theirWords = new Set((other.keywords || []).map(key));
  for (const m of pivot.keywords || [])
    if (theirWords.has(key(m)) && !coveredWords.has(key(m)))
      links.push({ type: "keyword", value: m });

  const theirCast = new Set((other.cast || []).map(key));
  for (const name of pivot.cast || [])
    if (theirCast.has(key(name))) links.push({ type: "actor", value: name });

  return links.sort((a, b) => WEIGHTS[b.type] - WEIGHTS[a.type]);
}

/* ============================================================
   A NEIGHBOUR'S SCORE — ONE DEFINITION, AND THAT IS THE WHOLE POINT
   ============================================================

   Kept apart from `linksBetween` because the links are DISPLAYED and the
   score RANKS: blending the two made the weighting untestable.

   BUT ABOVE ALL: this function is the ONLY one that knows what a
   connection is worth. The reinforcement from TMDB (`wakeAfar`) had its
   own version — a plain sum of weights, with no cap and no taste — and
   the two numbers, incommensurable, were compared all the same when
   deduplicating. A genuine "shared subject" from the collection was worth
   1.47 where the version from the recommendations was worth 2.2: the
   second replaced the first, and the keyword connection, correctly
   computed though it was, never appeared on screen.

   Two scales for one thing always end up drifting apart. There is only
   one left.

   `pivot` is used for the billing rank, `rated` for the taste multiplier.
   Both are optional: the reinforcement knows the rated card but does not
   always have a pivot to compare against. */
export function scoreOfLinks(
  links: Match[],
  { pivot, rated }: { pivot?: Film; rated?: Film } = {}
): number {
  const byType = new Map<Link, number>();
  const pivotCast = new Map((pivot?.cast || []).map((n, i) => [key(n), i]));

  for (const l of links) {
    let p = WEIGHTS[l.type];
    if (l.type === "actor") p *= billingWeight(pivotCast.get(key(l.value)) ?? 7);
    byType.set(l.type, (byType.get(l.type) || 0) + p);
  }

  let total = 0;
  for (const [type, sum] of byType) {
    const cap = CAPS[type];
    total += cap != null ? Math.min(sum, cap) : sum;
  }
  return rated ? total * byTaste(rated) : total;
}

/** The score of a neighbour from the collection. See `scoreOfLinks`. */
export const scoreOf = (pivot: Film, other: Film, links: Match[]): number =>
  scoreOfLinks(links, { pivot, rated: other });

/**
 * What your collection holds that is close to that film.
 *
 * Returns the neighbours ranked, each with its reasons. No network, no
 * state, no randomness: the same cards always give the same list.
 *
 * ARCHIVED cards are ruled out — having filed them away is a way of
 * saying you do not want to see them come back up. The watchlist, on the
 * other hand, stays: "you set it aside, and it takes after this one" is
 * exactly the sort of thing you want to learn. The screen separates them.
 */
export function wakeAtHome(pivot: Film, films: Film[], quotas: Partial<Quotas> = {}): Neighbour[] {
  const out: Neighbour[] = [];
  for (const film of films) {
    if (film.id === pivot.id || film.archived) continue;
    const links = linksBetween(pivot, film);
    if (!links.length) continue;
    out.push({
      film,
      score: scoreOf(pivot, film, links),
      links,
      reason: reasonFor(links),
      key: `wake:${pivot.id}:${film.id}`,
    });
  }
  /* On an equal score, the best rated then the title: without that last
     notch, two twin cards would swap places from one render to the next
     depending on the array's order, and a wall that fidgets is not a
     wall. */
  out.sort(
    (a, b) =>
      b.score - a.score ||
      bestRating(b.film) - bestRating(a.film) ||
      a.film.title.localeCompare(b.film.title, "fr")
  );
  return byQuotas(out, (v) => familyOf(v.links), quotas);
}
