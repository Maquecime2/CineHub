/* ============================================================
   THE DEMONSTRATION BINDER — twelve films for the first time

   An empty binder is the first screen of whoever discovers the
   application, and it is the only screen where the guided tour lies. On
   nothing, it skips three steps after seven hundred milliseconds of
   opaque veil each, plays five more around an empty square, and the
   richest part — a film's folder — stays out of reach for want of a card
   to open. It then describes a product nobody sees.

   These twelve films are therefore cut for WHAT THE TOUR SHOWS, and not
   to make up the numbers: credits that overlap (Ridley Scott twice, Wim
   Wenders twice, Henri Decaë behind the camera on two films), patterns,
   red threads strung by hand, screenings dated over three years, a card
   set aside, and a notebook page. Each of these traits serves one
   landmark of the tour; removing one reopens the hole it filled.

   THREE RULES THAT HOLD THE REST TOGETHER:

   1. The identifiers are FIXED and prefixed (`demo-`). That is what
      allows recognising a binder still entirely made of examples,
      removing it in one gesture, and writing the red threads by hand
      without going through a registry of randomly drawn identifiers.

   2. NO POSTERS. `image.tmdb.org` would serve real images, but the
      binder is an offline application and a dead address gives twelve
      broken rectangles where the application already knows how to draw
      an emulsion tinted with the title's initials. The fallback is not a
      makeshift here: it is the art direction.

   3. We sow ONLY ONCE, and never more — see `seeded` in `onboarding`. A
      binder emptied by hand must stay empty.
   ============================================================ */
import { makeFilm } from "../domain/film";
import { inverseOf } from "../domain/relations";
import type { Film, Strength, LinkedWork, Note, Relation, Watch } from "../types";

/* The example's words come from the caller, exactly as in `yearInBox`: a
   service does not know which language is being read. */
export type Say = (key: string, values?: Record<string, unknown>) => string;

/** The prefix that tells an example card from your own. */
export const DEMO_PREFIX = "demo-";

export const isDemo = (f: Pick<Film, "id">): boolean => f.id.startsWith(DEMO_PREFIX);

/**
 * Does the binder contain ONLY examples?
 *
 * That is the condition for the banner: as soon as one card is added by
 * hand, the binder is somebody's, and the warning has no reason left to
 * be — the twelve films remain, but they no longer lie about what one is
 * looking at.
 */
export const binderStillDemo = (films: Pick<Film, "id">[]): boolean =>
  films.length > 0 && films.every(isDemo);

/** What remains once the examples have been removed. */
export const withoutDemo = <T extends Pick<Film, "id">>(films: T[]): T[] =>
  films.filter((f) => !isDemo(f));

/* ------------------------------------------------------------
   Les fiches
   ------------------------------------------------------------ */

/* A screening reads "the day, the rating". `null` means "seen without
   rating", which is not zero — the almanac counts the screening and sets
   the rating aside. */
const seen = (date: string, rating: number | null = null, rewatch = false): Watch => ({
  date,
  rating,
  ...(rewatch ? { rewatch: true } : {}),
});

/* The cards are written in a single table, in the order they will
   appear on the wall. `makeFilm` fills in everything left unsaid: it is
   the definition of a card, not this list. */
interface DraftNote extends Partial<Film> {
  id: string;
}

/* The slug under which a card's WORDS live in the catalogue: its title,
   its genres, its themes, the review and the loose notes. Everything
   else — the crew, the keywords, the dates, the ratings — is the same in
   both languages and stays in the table below.

   `demo-chihiro` reads `demoBinder.films.chihiro`. */
const slugOf = (id: string): string => id.slice(DEMO_PREFIX.length);

/** A comma-separated list in the catalogue, an array on the card. */
const listed = (value: string): string[] =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const DRAFTS: DraftNote[] = [
  {
    id: "demo-chihiro",
    year: 2001,
    director: "Hayao Miyazaki",
    cast: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki", "Takashi Naitō"],
    crew: { musique: ["Joe Hisaishi"], scénario: ["Hayao Miyazaki"] },
    runtime: 125,
    language: "ja",
    countries: ["JP"],
    tmdbRating: 8.5,
    keywords: ["spirit world", "coming of age", "bathhouse", "shapeshifting"],
    motifs: ["flight", "back-to-the-start"],
    rating: 4.5,
    watches: [seen("2026-02-14", 4.5, true), seen("2024-11-03", 4.5)],
  },
  {
    id: "demo-mulholland",
    year: 2001,
    director: "David Lynch",
    cast: ["Naomi Watts", "Laura Harring", "Justin Theroux", "Ann Miller"],
    crew: { image: ["Peter Deming"], musique: ["Angelo Badalamenti"], scénario: ["David Lynch"] },
    runtime: 147,
    language: "en",
    countries: ["US", "FR"],
    tmdbRating: 7.9,
    keywords: ["dream", "hollywood", "amnesia", "identity", "neo-noir"],
    motifs: ["non-linear-narrative", "final-revelation", "loss-of-reason"],
    rating: 4.5,
    watches: [seen("2025-09-21", 4.5)],
  },
  {
    id: "demo-mood",
    year: 2000,
    director: "Wong Kar-wai",
    cast: ["Tony Leung Chiu-wai", "Maggie Cheung", "Rebecca Pan", "Lai Chen"],
    crew: {
      image: ["Christopher Doyle", "Mark Lee Ping-bing"],
      musique: ["Michael Galasso", "Shigeru Umebayashi"],
    },
    runtime: 98,
    language: "cn",
    countries: ["HK", "FR"],
    tmdbRating: 8.1,
    keywords: ["unrequited love", "1960s", "hong kong", "adultery", "longing"],
    motifs: ["impossible-love", "open-ending"],
    rating: 5,
    watches: [seen("2025-02-09", 5), seen("2024-03-17", 4.5)],
  },
  {
    id: "demo-jour-sans-fin",
    year: 1993,
    director: "Harold Ramis",
    cast: ["Bill Murray", "Andie MacDowell", "Chris Elliott", "Stephen Tobolowsky"],
    crew: { image: ["John Bailey"], musique: ["George Fenton"] },
    runtime: 101,
    language: "en",
    countries: ["US"],
    tmdbRating: 7.6,
    keywords: ["time loop", "small town", "redemption", "weatherman"],
    motifs: ["time-loop", "back-to-the-start"],
    rating: 4,
    watches: [seen("2026-01-02", 4)],
  },
  {
    id: "demo-alien",
    year: 1979,
    director: "Ridley Scott",
    cast: ["Sigourney Weaver", "Tom Skerritt", "John Hurt", "Ian Holm", "Yaphet Kotto"],
    crew: { image: ["Derek Vanlint"], musique: ["Jerry Goldsmith"], scénario: ["Dan O'Bannon"] },
    runtime: 117,
    language: "en",
    countries: ["GB", "US"],
    tmdbRating: 8.2,
    keywords: ["space", "creature", "isolation", "corporate greed", "survival horror"],
    motifs: ["single-setting", "sole-survivor"],
    rating: 4.5,
    watches: [seen("2025-10-31", 4.5)],
  },
  {
    id: "demo-blade-runner",
    year: 1982,
    director: "Ridley Scott",
    cast: ["Harrison Ford", "Rutger Hauer", "Sean Young", "Edward James Olmos"],
    crew: { image: ["Jordan Cronenweth"], musique: ["Vangelis"], scénario: ["Hampton Fancher"] },
    runtime: 117,
    language: "en",
    countries: ["US", "GB"],
    tmdbRating: 7.9,
    keywords: ["dystopia", "android", "memory", "neo-noir", "rain"],
    motifs: ["open-ending", "final-freeze-frame"],
    rating: 4,
    watches: [seen("2025-10-25", 4)],
  },
  {
    id: "demo-paris-texas",
    year: 1984,
    director: "Wim Wenders",
    cast: ["Harry Dean Stanton", "Nastassja Kinski", "Dean Stockwell", "Hunter Carson"],
    crew: { image: ["Robby Müller"], musique: ["Ry Cooder"], scénario: ["Sam Shepard"] },
    runtime: 145,
    language: "en",
    countries: ["DE", "FR", "US"],
    tmdbRating: 8.1,
    keywords: ["road movie", "desert", "abandonment", "father son", "one way mirror"],
    motifs: ["road-movie", "reunion", "open-ending"],
    rating: 5,
    watches: [seen("2024-06-08", 5)],
  },
  {
    id: "demo-perfect-days",
    year: 2023,
    director: "Wim Wenders",
    cast: ["Kōji Yakusho", "Tokio Emoto", "Arisa Nakano", "Aoi Yamada"],
    crew: { image: ["Franz Lustig"], scénario: ["Wim Wenders", "Takuma Takasaki"] },
    runtime: 124,
    language: "ja",
    countries: ["JP", "DE"],
    tmdbRating: 7.8,
    keywords: ["routine", "tokyo", "solitude", "cassette tape", "toilets"],
    motifs: ["real-time"],
    /* SET ASIDE, and that is what gives the "À voir" tab its content:
       without at least one card, the tour opens an empty wall there. */
    status: "watchlist",
    watches: [],
  },
  {
    id: "demo-400-coups",
    year: 1959,
    director: "François Truffaut",
    cast: ["Jean-Pierre Léaud", "Claire Maurier", "Albert Rémy", "Patrick Auffay"],
    crew: { image: ["Henri Decaë"], musique: ["Jean Constantin"], scénario: ["François Truffaut"] },
    runtime: 99,
    language: "fr",
    countries: ["FR"],
    tmdbRating: 8.0,
    keywords: ["childhood", "reform school", "paris", "new wave", "running away"],
    motifs: ["flight", "final-freeze-frame"],
    rating: 4.5,
    watches: [seen("2024-09-12", 4.5)],
  },
  {
    id: "demo-samourai",
    year: 1967,
    director: "Jean-Pierre Melville",
    cast: ["Alain Delon", "Nathalie Delon", "François Périer", "Cathy Rosier"],
    crew: {
      image: ["Henri Decaë"],
      musique: ["François de Roubaix"],
      scénario: ["Jean-Pierre Melville"],
    },
    runtime: 105,
    language: "fr",
    countries: ["FR", "IT"],
    tmdbRating: 8.0,
    keywords: ["hitman", "loneliness", "paris", "trench coat", "code of honor"],
    motifs: ["hero-dies", "sacrifice"],
    rating: 4.5,
    watches: [seen("2026-03-30", 4.5)],
  },
  {
    id: "demo-stalker",
    year: 1979,
    director: "Andreï Tarkovski",
    cast: ["Alexandre Kaïdanovski", "Anatoli Solonitsyne", "Nikolaï Grinko", "Alissa Freindlich"],
    crew: { image: ["Alexandre Kniajinski"], musique: ["Edouard Artemiev"] },
    runtime: 162,
    language: "ru",
    countries: ["SU"],
    tmdbRating: 8.1,
    keywords: ["the zone", "faith", "wasteland", "pilgrimage", "desire"],
    motifs: ["single-setting", "open-ending", "voice-over"],
    rating: 4,
    watches: [seen("2025-05-04", 4)],
  },
  {
    id: "demo-portrait",
    year: 2019,
    director: "Céline Sciamma",
    cast: ["Noémie Merlant", "Adèle Haenel", "Luàna Bajrami", "Valeria Golino"],
    crew: { image: ["Claire Mathon"], musique: ["Para One"], scénario: ["Céline Sciamma"] },
    runtime: 122,
    language: "fr",
    countries: ["FR"],
    tmdbRating: 8.1,
    keywords: ["painter", "18th century", "brittany", "forbidden love", "gaze"],
    motifs: ["impossible-love", "final-freeze-frame", "flashback"],
    rating: 4.5,
    watches: [seen("2026-05-18", 4.5)],
  },
];

/* ------------------------------------------------------------
   The red threads
   ------------------------------------------------------------

   Written by hand, as in the application: two halves sharing a `pairId`,
   with the relation REVERSED on the other side (see `inverseOf`).
   Copying them out as they are rather than calling `linkFilms` is
   deliberate — that function lives in `App` and works on React state,
   which does not exist yet at sowing time. */
interface Thread {
  de: string;
  vers: string;
  relation: Relation;
  force: Strength;
}

const THREADS: Thread[] = [
  {
    de: "demo-alien",
    vers: "demo-blade-runner",
    relation: "echo",
    force: 2,
  },
  {
    de: "demo-paris-texas",
    vers: "demo-perfect-days",
    relation: "diptych",
    force: 3,
  },
  {
    de: "demo-mood",
    vers: "demo-portrait",
    relation: "echo",
    force: 3,
  },
  {
    de: "demo-400-coups",
    vers: "demo-samourai",
    relation: "echo",
    force: 1,
  },
];

/* A reference to a work that is not a film: that is what makes the
   constellation something other than a map of the collection. */
const BOOK = {
  owner: "demo-blade-runner",
  type: "book" as const,
  creator: "Philip K. Dick",
};

/* ------------------------------------------------------------
   Le semis
   ------------------------------------------------------------ */

/**
 * The twelve cards, complete, threads strung.
 *
 * Returned BRAND NEW at every call: a shared constant would end up being
 * modified by somebody — cards are copied everywhere in the application,
 * but an array is not.
 */
export function demoFilms(t: Say, maintenant = Date.now()): Film[] {
  const films = DRAFTS.map((b, rank) =>
    makeFilm({
      ...b,
      /* THE EXAMPLE READS IN THE READER'S LANGUAGE. It is the first
         screen of whoever discovers the binder, and twelve French
         reviews under an English interface would be the worst possible
         first impression of a product that claims to read in two. */
      title: t(`demoBinder.films.${slugOf(b.id)}.title`),
      genres: listed(t(`demoBinder.films.${slugOf(b.id)}.genres`)),
      themes: listed(t(`demoBinder.films.${slugOf(b.id)}.themes`)),
      review: t(`demoBinder.films.${slugOf(b.id)}.review`, { defaultValue: "" }),
      notes: t(`demoBinder.films.${slugOf(b.id)}.notes`, { defaultValue: "" }),
      /* Arranged in the order of the table, from the most recently
         added to the oldest: that is what the wall's default sort
         expects. */
      addedAt: maintenant - rank * 86_400_000,
      updatedAt: maintenant - rank * 86_400_000,
      /* `watchedAt` is the reflection of `watches`, and the store does
         not realign it by itself on reading: we lay it here, at the
         source. */
      watchedAt: b.watches?.[0]?.date ?? null,
      source: "manual",
    })
  );

  const perId = new Map(films.map((f) => [f.id, f]));
  const add = (id: string, link: LinkedWork) => {
    const f = perId.get(id);
    if (f) f.linkedWorks = [...f.linkedWorks, link];
  };

  for (const [rank, thread] of THREADS.entries()) {
    const a = perId.get(thread.de);
    const b = perId.get(thread.vers);
    if (!a || !b) continue;
    const pairId = `${DEMO_PREFIX}pair-${rank}`;
    const half = (target: Film, relation: Relation): LinkedWork => ({
      id: `${DEMO_PREFIX}lien-${rank}-${target.id}`,
      pairId,
      type: "film",
      filmId: target.id,
      title: target.title,
      creator: target.director,
      note: t(`demoBinder.threads.${rank}`),
      relation,
      force: thread.force,
    });
    add(a.id, half(b, thread.relation));
    add(b.id, half(a, inverseOf(thread.relation)!));
  }

  const { owner, ...livre } = BOOK;
  add(owner, {
    id: `${DEMO_PREFIX}lien-livre`,
    ...livre,
    title: t("demoBinder.book.title"),
    note: t("demoBinder.book.note"),
  });

  return films;
}

/** The notebook page that comes with it — the notebook has its tour too. */
export function demoNotes(t: Say, maintenant = Date.now()): Note[] {
  return [
    {
      id: `${DEMO_PREFIX}note-1`,
      title: t("demoBinder.note.title"),
      body: t("demoBinder.note.body"),
      createdAt: maintenant,
    },
  ];
}
