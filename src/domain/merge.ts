/* ============================================================
   THE MERGE — when the same card moved on both sides
   ============================================================

   Two devices hold the same collection. The phone rates a film on the
   underground, the laptop rates another one in the evening: nothing to
   arbitrate, each brings what the other does not have. The interesting
   case is rarer and nastier — the SAME card touched on both sides, each
   unaware of the other.

   WHAT WE DO: LAST WRITER WINS, CARD BY CARD.

   And not "field by field", as I had first written in the plan.
   Arbitrating field by field would need a date per field; we only have
   one per card. Pretending otherwise would give an arbitrary blend of two
   versions — a rating from here, a review from there — that is to say, a
   card nobody ever wrote. Better to lose the older version, which is
   understandable, than to invent a third version nobody recognises.

   EXCEPT THE SCREENING LOG, WHICH ADDS UP.

   A screening is a FACT: "I saw this film on 3 March". Two devices that
   each know one of them do not have a disagreement, they have two halves
   of the truth. Overwriting one with the other would erase an evening
   that took place. It is the only exception, and it comes from the nature
   of the data: everywhere else, two different values are two OPINIONS
   about the same thing, and the more recent one wins.

   THE FIELD NAMES BELOW ARE THE WIRE FORMAT shared with `server/`. They
   are translated on both sides at once — the client does not call the
   server yet, so there is no deployed pairing to keep compatible.
   ============================================================ */
import { mergeWatches, sortWatches } from "./film";
import type { Film } from "../types";

/** What the server returns for one card. */
export interface RemoteCard {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  data: Partial<Film>;
}

export interface MergeResult {
  /** The collection after merging. */
  films: Film[];
  /** What came in, so it can be said on screen. */
  tally: { added: number; replaced: number; kept: number; removed: number };
}

/* We only decide on milliseconds: two clocks never agree to the tenth,
   and a card whose two versions are born in the same millisecond is, in
   practice, the same card. On a strict tie we keep the LOCAL one — doing
   nothing is the only arbitration that surprises nobody. */
const isNewer = (remote: number, local: number) => remote > local;

/**
 * Files what comes from the server into the local collection.
 *
 * Modifies nothing in place: returns a fresh collection, in which the
 * unchanged cards are the SAME objects — the views are memoised on
 * identity, and copying everything would redo the whole shelf on every
 * synchronisation.
 */
export function mergeRemote(local: Film[], remote: RemoteCard[]): MergeResult {
  const byId = new Map(local.map((f) => [f.id, f]));
  const tally = { added: 0, replaced: 0, kept: 0, removed: 0 };

  for (const incoming of remote) {
    const here = byId.get(incoming.id);

    /* A CARD DELETED ELSEWHERE. We only remove it if the deletion is
       LATER than what we know: otherwise a device that deleted yesterday
       would carry off the note written this morning. */
    if (incoming.deleted) {
      if (here && !isNewer(incoming.updatedAt, here.updatedAt)) {
        tally.kept += 1;
        continue;
      }
      if (here) {
        byId.delete(incoming.id);
        tally.removed += 1;
      }
      continue;
    }

    if (!here) {
      /* Unknown here: it arrives as it is, with its date. Without that
         date, the next comparison would think it fresher than everything
         and send it back to the server for nothing. */
      byId.set(incoming.id, {
        ...(incoming.data as Film),
        id: incoming.id,
        updatedAt: incoming.updatedAt,
        watches: sortWatches(incoming.data.watches || []),
      });
      tally.added += 1;
      continue;
    }

    /* THE SCREENINGS ADD UP IN EVERY CASE, including when it is the local
       version that wins: a screening known over there and not here must
       come in, even if the rest of the card does not change. */
    const watches = mergeWatches(here.watches, incoming.data.watches);
    const extraWatches = watches.length !== (here.watches || []).length;

    if (!isNewer(incoming.updatedAt, here.updatedAt)) {
      if (extraWatches) {
        byId.set(incoming.id, {
          ...here,
          watches,
          watchedAt: watches[0]?.date ?? here.watchedAt,
        });
      }
      tally.kept += 1;
      continue;
    }

    byId.set(incoming.id, {
      ...here,
      ...(incoming.data as Film),
      id: incoming.id,
      updatedAt: incoming.updatedAt,
      watches,
      watchedAt: watches[0]?.date ?? null,
    });
    tally.replaced += 1;
  }

  return { films: [...byId.values()], tally };
}

/**
 * What is left to send.
 *
 * NO DATE COMPARISON HERE, and that is the fruit of a mistake: the first
 * version filtered on "modified since the last send", which sent back to
 * the server the very cards we had just received from it. Their date
 * comes from another device, whose clock is not ours; comparing it to our
 * own marker means nothing.
 *
 * So we work from a LIST kept by the store — the cards modified here —
 * and from the tombstones. What arrived from the server is not on it, and
 * therefore does not go back.
 */
export function toSend(
  films: Film[],
  graves: { id: string; at: number }[],
  pending: string[]
): { id: string; tmdbId: unknown; updatedAt: number; deleted?: boolean; data?: unknown }[] {
  const waiting = new Set(pending);
  const alive = new Set(films.map((f) => f.id));

  const sends = films
    .filter((f) => waiting.has(f.id))
    .map((f) => ({ id: f.id, tmdbId: f.tmdbId, updatedAt: f.updatedAt, data: f }));

  /* The tombstones follow the same waiting list as the cards: without
     that, they would go back out on every round for a year. And a card
     deleted then recreated with the same identifier exists again — its
     tombstone must not kill it a second time. */
  const removed = graves
    .filter((t) => waiting.has(t.id) && !alive.has(t.id))
    .map((t) => ({ id: t.id, tmdbId: null, updatedAt: t.at, deleted: true, data: {} }));

  return [...sends, ...removed];
}
