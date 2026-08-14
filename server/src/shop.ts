/* ============================================================
   THE COUNTER'S CATALOGUE
   ============================================================

   IT IS CODE, NOT A TABLE, and that is a decision rather than a
   shortcut. What is sold here is product CONTENT: it wants to be read in
   a review, it takes no concurrent write, and it changes when somebody
   decides it changes — never at three in the morning. A table would have
   meant an administration screen to write, for one person, to edit a
   list of eleven rows.

   WHAT DOES GO IN THE DATABASE IS WHAT PEOPLE OWN. There the schema
   guards: `owned` refuses a second purchase by its primary key,
   `purse` refuses an overdraft by its CHECK, `power` refuses playing
   what one does not hold. None of those is a rule a route could forget.

   THE IDENTIFIERS ARE FOREVER. They are written into `owned`, into
   `token_spend`, and into `person.stamp`. Renaming one would silently
   take a bought thing away from whoever had it, so they are chosen to be
   dull and kept.

   ------------------------------------------------------------
   WHAT IS AND IS NOT FOR SALE
   ------------------------------------------------------------

   Nothing that already works offline may be put behind a price. The
   binder's fourteen skins stay free and stay available with no server,
   no account and no network — that is a promise the whole project is
   built on. The three skins sold here are NEW ones; not one of the
   fourteen is touched.

   The stamps and the stickers are safe for a different reason: they only
   exist where pseudonyms meet. With no account there is nobody to show
   them to, so their absence is not a thing withheld — it is a room one
   has not entered.
   ============================================================ */

export type ShopKind = "stamp" | "pack" | "skin" | "power";
export type PowerKind = "halve" | "redo" | "extend";

export interface ShopItem {
  id: string;
  kind: ShopKind;
  price: number;
  /** For a skin: the key it unlocks in the binder's own catalogue. */
  grants?: string;
  /** For a power: which one, and how many a purchase gives. */
  power?: PowerKind;
  /** For a pack: how many stickers come out of it. */
  draws?: number;
}

export const SHOP: readonly ShopItem[] = [
  /* THE STAMPS — what one wears beside one's name, in the feed, in the
     rankings, on a shared collection. Worn one at a time. */
  { id: "stamp-habitue", kind: "stamp", price: 40 },
  { id: "stamp-noctambule", kind: "stamp", price: 40 },
  { id: "stamp-premiere-seance", kind: "stamp", price: 60 },
  { id: "stamp-projectionniste", kind: "stamp", price: 90 },

  /* THE PACKET — three stickers, drawn by the server (see `draw`). */
  { id: "pack-trois", kind: "pack", price: 25, draws: 3 },

  /* THE SKINS — new ones. The fourteen that exist stay free. */
  { id: "skin-nitrate", kind: "skin", price: 250, grants: "nitrate" },
  { id: "skin-drive-in", kind: "skin", price: 250, grants: "drive-in" },
  { id: "skin-cinemascope", kind: "skin", price: 320, grants: "cinemascope" },

  /* THE POWERS — spent, not worn. Each purchase adds one to the count. */
  { id: "power-halve", kind: "power", price: 15, power: "halve" },
  { id: "power-redo", kind: "power", price: 20, power: "redo" },
  { id: "power-extend", kind: "power", price: 30, power: "extend" },
];

export const itemById = (id: string): ShopItem | undefined => SHOP.find((i) => i.id === id);

/* ------------------------------------------------------------
   THE STICKERS, AND THE DRAW
   ------------------------------------------------------------

   THE CHANCE IS THE SERVER'S, AND IT IS RECORDED BEFORE THE ANSWER
   LEAVES. Drawn in the browser, a disappointing packet would be reopened
   by reloading the page until it pleased. Drawn here, inside the
   purchase's transaction, the stickers are in the database before
   anybody sees them: replaying the request replays nothing.

   `draw` takes its generator as an argument rather than reaching for
   `randomInt` itself. That is the only way a thing built on chance can
   be tested at all — the production call passes real randomness, the
   test passes a sequence it chose. */

export type Rarity = "common" | "rare" | "gold";

export const STICKERS: readonly { id: string; rarity: Rarity }[] = [
  { id: "vig-projecteur", rarity: "common" },
  { id: "vig-fauteuil", rarity: "common" },
  { id: "vig-bobine", rarity: "common" },
  { id: "vig-ticket", rarity: "common" },
  { id: "vig-esquimau", rarity: "common" },
  { id: "vig-rideau", rarity: "common" },
  { id: "vig-clap", rarity: "rare" },
  { id: "vig-cadran", rarity: "rare" },
  { id: "vig-lanterne", rarity: "rare" },
  { id: "vig-palme", rarity: "gold" },
  { id: "vig-nitrate", rarity: "gold" },
];

/* Seven in ten common, a quarter rare, one in twenty gold. Written as
   thresholds over a thousand so the figures stay whole and the sum is
   checkable by eye. */
const THRESHOLD: readonly { rarity: Rarity; upTo: number }[] = [
  { rarity: "common", upTo: 700 },
  { rarity: "rare", upTo: 950 },
  { rarity: "gold", upTo: 1000 },
];

/** A source of whole numbers in [0, max). Real randomness, or a test's. */
export type Rng = (max: number) => number;

/**
 * One packet's worth of stickers. Doubles are possible and wanted: a
 * double is the thing one has to swap, and a draw that guaranteed
 * novelty would empty the album on the fourth packet.
 */
export function draw(rng: Rng, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng(1000);
    const rarity = (THRESHOLD.find((t) => roll < t.upTo) ?? THRESHOLD[THRESHOLD.length - 1]!)
      .rarity;
    const pool = STICKERS.filter((s) => s.rarity === rarity);
    /* THE INDEX IS BROUGHT BACK INSIDE THE POOL, always — the same
       precaution `pickFrom` takes in the binder. `rng` is asked for a
       number below the bound, but it is a function somebody else
       supplies, and this one is called with the tokens ALREADY debited.
       Reaching past the end here would throw inside a purchase, and the
       buyer would have paid for the exception. */
    out.push(pool[Math.abs(rng(pool.length)) % pool.length]!.id);
  }
  return out;
}
