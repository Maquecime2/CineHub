/* ============================================================
   THE WAKE'S OTHER HALF — what, outside, takes after this film

   `wake` searches your binder; this one sorts what TMDB brings back. The
   harvest itself is elsewhere (`services/wake`): here, nothing but a
   merge, a ranking and an exclusion — so nothing that asks for the
   network, and everything that can be tested.

   THE RULE THAT GOVERNS EVERYTHING: this column shows ONLY what you do
   not have. A film already on the wall coming back here would make the
   same suggestion twice a step apart, and the panel's right half would
   stop being "outside" and become a duplicate of the left.
   ============================================================ */
import { WEIGHTS, familyOf, byQuotas, scoreOfLinks } from "./wake";
import type { Family, Link, Quotas, Match, Neighbour } from "./wake";
import type { Film } from "../types";

/** What a harvest brings back: films, and by which path. */
export interface Harvest {
  /** The path followed. `crowd`: "people who watched this one watched". */
  via: Link;
  /** The person's name. Empty for a recommendation, which stands alone. */
  value: string;
  candidates: FarCandidate[];
}

/** A film from TMDB, as `toCandidate` returns it. */
export interface FarCandidate {
  tmdbId: number;
  title: string;
  year: number | null;
  poster: string | null;
  voteAverage: number;
  voteCount: number;
  overview?: string;
}

export interface FarNeighbour extends FarCandidate {
  score: number;
  /** Every provenance: a film can arrive by three paths. */
  via: { via: Link; value: string }[];
  reason: string;
  key: string;
}

/* ONE VOCABULARY, AND THAT IS WHAT REPAIRS THE FLAW.

   This module had its own: a `reco` path foreign to the `Link` type, a
   separate `POIDS_RECO` weight, a `familleLoin` function that filed it
   under "subjects", and a conversion into `mot-clé` when returning the
   links. Four places where two vocabularies could drift apart — and they
   did: the recommendation, heavier than any subject, swept the whole
   stack, then passed itself off as a keyword.

   "Vu par les mêmes gens" is now a `Link` like the others (`crowd`), with
   its weight and its family defined in the same place as its neighbours.
   There is nothing left to convert. */
const farFamily = (via: Link | undefined): Family =>
  via ? familyOf([{ type: via, value: "" }]) : "subjects";

/* WHAT WE REQUIRE BEFORE SUGGESTING ANYTHING.

   With no vote floor, a cinematographer's filmography brings up their
   film-school shorts and their commissioned documentaries, rated by
   eleven people — offered at the same rank as a film you could actually
   watch. Thirty votes is the same threshold as the discovery desk;
   keeping it identical avoids two definitions of "this really exists" in
   the same application. */
export const VOTES_MINIMUM = 30;

/* The same natures as the wake at home, but turned round: here the
   suggestion COMES FROM somewhere, over there it SHARES something. "du
   même chef op" and "même chef op" do not sit in the same sentence. */
const FAR_LABELS: Record<Link, string> = {
  cinematography: "du même chef op",
  music: "du même compositeur",
  directing: "de la même réalisation",
  writing: "du même scénario",
  actor: "avec",
  motif: "même motif",
  theme: "même thème",
  keyword: "même sujet",
  crowd: "vu par les mêmes gens",
};

/* Perceived quality counts for very little, and only to break ties: it
   says what the public thinks of it, not what this film has to do with
   that one — which is the only question asked here. */
const quality = (c: FarCandidate): number =>
  Math.max(0, Math.min(1, (c.voteAverage - 5.5) / 3)) * 0.4;

/** A path, spelled out: "du même chef op Franz Lustig". */
const spellPath = (p: FarNeighbour["via"][number]): string =>
  p.via === "crowd" || !p.value ? FAR_LABELS[p.via] : `${FAR_LABELS[p.via]} ${p.value}`;

/* A LINK IS NAMED, IT IS NOT COUNTED.

   The first draft wrote "du même chef op Franz Lustig, + 1 lien". That
   "+ 1 lien" says nothing at all: you learn that a second reason exists,
   and not which — that is to say, exactly the information you came for.
   The home half names the family ("+ 2 motifs"); this one must at least
   do as much.

   So we name the FIRST TWO paths. Beyond that, we count: three
   provenances written end to end make a line nobody reads any more, and
   the two strongest already carry the essentials. */
function reasonFor(via: FarNeighbour["via"]): string {
  const [head, second, ...rest] = via;
  if (!head) return "";
  if (!second) return spellPath(head);
  const two = `${spellPath(head)} · ${spellPath(second)}`;
  return rest.length ? `${two}, + ${rest.length}` : two;
}

/* ============================================================
   THE REINFORCEMENT — what TMDB teaches about YOUR collection
   ============================================================

   The wake at home brings things together by subject on condition that
   BOTH cards carry it. But motifs and themes are set by hand, and TMDB's
   keywords have only been harvested recently: on a collection imported
   before that, the "subjects" half stays empty and the column talks about
   nothing but crews.

   Going and fetching the keywords of five hundred cards would settle the
   question — at the cost of five hundred calls when a card is opened,
   which is not an option.

   BUT THE ANSWER IS ALREADY THERE. The `discover` query by keyword,
   fired for the right-hand column, brings back films that share the
   pivot's subject — and some of them are IN your binder. We were throwing
   them away as duplicates; they are in fact the thematic connections that
   were missing, obtained without one more call.

   The reasoning holds for every path: a film from your collection brought
   up by a cinematographer's filmography is a neighbour, whether or not
   its card carries that cinematographer's name. */

/**
 * The films from YOUR collection that the harvests picked out.
 *
 * `byTmdbId` maps a TMDB identifier to the matching card; the caller
 * builds it, once, from the collection — the conversion of identifiers
 * written as text included.
 */
export function reinforcementFromOutside(
  harvests: Harvest[],
  byTmdbId: Map<number, Film>,
  pivotId: string
): Neighbour[] {
  const merged = new Map<string, { film: Film; via: FarNeighbour["via"] }>();

  for (const r of harvests) {
    for (const c of r.candidates || []) {
      if (!c?.tmdbId) continue;
      const film = byTmdbId.get(c.tmdbId);
      /* The pivot obviously finds itself in its own filmography and in
         its own keywords. */
      if (!film || film.id === pivotId || film.archived) continue;
      const already = merged.get(film.id);
      if (already) already.via.push({ via: r.via, value: r.value });
      else merged.set(film.id, { film, via: [{ via: r.via, value: r.value }] });
    }
  }

  const out: Neighbour[] = [];
  for (const { film, via } of merged.values()) {
    via.sort((a, b) => WEIGHTS[b.via] - WEIGHTS[a.via]);
    /* The paths ARE already links from the shared vocabulary: there is
       nothing left to translate. The previous version converted a
       recommendation into `mot-clé` — a suggestion from the crowd was
       therefore passing itself off as a subject connection, and the
       displayed reason lied. */
    const links: Match[] = via.map((p) => ({ type: p.via, value: p.value }));
    out.push({
      film,
      /* THE SAME SCALE AS THE WAKE AT HOME, and that is the whole point of
         `scoreOfLinks`. This score used to be a raw sum, with no cap and
         no taste: compared with the home score when deduplicating, it
         always won, and the keyword connection from YOUR collection
         vanished in favour of a recommendation. */
      score: scoreOfLinks(links, { rated: film }),
      links,
      reason: reasonFor(via),
      key: `reinforcement:${pivotId}:${film.id}`,
    });
  }
  return out;
}

/**
 * Merges the harvests into one ranked list, purged of what we already
 * have.
 *
 * `alreadyHere` carries the TMDB identifiers of the WHOLE collection,
 * watchlist included: a film you set aside is not a discovery, and
 * offering it as one would forget what you decided last week.
 */
export function mergeAfar(
  harvests: Harvest[],
  {
    alreadyHere = new Set<number>(),
    quotas = {} as Partial<Quotas>,
    minimumVotes = VOTES_MINIMUM,
  } = {}
): FarNeighbour[] {
  const merged = new Map<number, FarNeighbour>();

  for (const r of harvests) {
    for (const c of r.candidates || []) {
      if (!c?.tmdbId || !c.title) continue;
      if (alreadyHere.has(c.tmdbId)) continue;
      if ((c.voteCount || 0) < minimumVotes) continue;

      const already = merged.get(c.tmdbId);
      if (already) {
        /* Arrived by several paths: that is a good sign, and the
           provenances add up instead of replacing each other. */
        already.via.push({ via: r.via, value: r.value });
        already.score += WEIGHTS[r.via];
        continue;
      }
      merged.set(c.tmdbId, {
        ...c,
        via: [{ via: r.via, value: r.value }],
        score: WEIGHTS[r.via] + quality(c),
        reason: "",
        key: `afar:${c.tmdbId}`,
      });
    }
  }

  for (const v of merged.values()) {
    v.via.sort((a, b) => WEIGHTS[b.via] - WEIGHTS[a.via]);
    v.reason = reasonFor(v.via);
  }

  /* The title breaks the tie: without it, two films with the same score
     would swap places according to the order the queries came back in —
     that is to say, according to the network, which would make a
     different panel on every opening. */
  const sorted = [...merged.values()].sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title, "fr")
  );
  /* The same quotas as at home, and for the same reason: without them,
     the filmographies of the four leading craftspeople sweep the whole
     column and you never learn "from the same subject". */
  return byQuotas(sorted, (v) => farFamily(v.via[0]?.via), quotas);
}

/**
 * The collection's TMDB identifiers — what the "outside" column must keep
 * quiet about.
 *
 * `tmdbId` is sometimes a number and sometimes a STRING: cards written by
 * hand and some older imports set it as text. Compared without
 * conversion, `"27205"` is never `27205` — and the film you own comes
 * back offering itself as a discovery. So we bring everything down to a
 * number, once and for all, on the way in.
 */
/** The same conversion to a number, isolated so it is applied the same everywhere. */
const numericId = (v: string | number | null | undefined): number =>
  v == null || v === "" ? NaN : Number(v);

/**
 * The collection indexed by TMDB identifier — enough to recognise one of
 * your cards in what TMDB brings back.
 */
export const byTmdbId = (films: Film[]): Map<number, Film> => {
  const m = new Map<number, Film>();
  for (const f of films) {
    const id = numericId(f.tmdbId);
    if (Number.isFinite(id)) m.set(id, f);
  }
  return m;
};

export const alreadyInTheBinder = (films: { tmdbId?: string | number | null }[]): Set<number> =>
  new Set(films.map((f) => numericId(f.tmdbId)).filter((id) => Number.isFinite(id)));
