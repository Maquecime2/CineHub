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
const vu = (date: string, rating: number | null = null, rewatch = false): Watch => ({
  date,
  rating,
  ...(rewatch ? { rewatch: true } : {}),
});

/* The cards are written in a single table, in the order they will
   appear on the wall. `makeFilm` fills in everything left unsaid: it is
   the definition of a card, not this list. */
interface Brouillon extends Partial<Film> {
  id: string;
  title: string;
}

const BROUILLONS: Brouillon[] = [
  {
    id: "demo-chihiro",
    title: "Le Voyage de Chihiro",
    year: 2001,
    director: "Hayao Miyazaki",
    genres: ["Animation", "Fantastique", "Aventure"],
    cast: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki", "Takashi Naitō"],
    crew: { musique: ["Joe Hisaishi"], scénario: ["Hayao Miyazaki"] },
    runtime: 125,
    language: "ja",
    countries: ["JP"],
    tmdbRating: 8.5,
    keywords: ["spirit world", "coming of age", "bathhouse", "shapeshifting"],
    motifs: ["flight", "back-to-the-start"],
    themes: ["l'enfance", "le travail"],
    rating: 4.5,
    review:
      "Revu dix ans après, et c'est le train sur l'eau qui reste — pas les monstres. Le film le plus calme jamais fait sur le fait de grandir.",
    watches: [vu("2026-02-14", 4.5, true), vu("2024-11-03", 4.5)],
  },
  {
    id: "demo-mulholland",
    title: "Mulholland Drive",
    year: 2001,
    director: "David Lynch",
    genres: ["Thriller", "Mystère", "Drame"],
    cast: ["Naomi Watts", "Laura Harring", "Justin Theroux", "Ann Miller"],
    crew: { image: ["Peter Deming"], musique: ["Angelo Badalamenti"], scénario: ["David Lynch"] },
    runtime: 147,
    language: "en",
    countries: ["US", "FR"],
    tmdbRating: 7.9,
    keywords: ["dream", "hollywood", "amnesia", "identity", "neo-noir"],
    motifs: ["non-linear-narrative", "final-revelation", "loss-of-reason"],
    themes: ["le cinéma", "les rêves"],
    rating: 4.5,
    review:
      "La boîte bleue ne s'explique pas, elle se subit. J'ai mis trois visionnages à cesser de chercher la clé, et c'est là que le film a commencé.",
    notes: "Revoir en pensant à Persona. La scène du Silencio, seule, vaut le détour.",
    watches: [vu("2025-09-21", 4.5)],
  },
  {
    id: "demo-mood",
    title: "In the Mood for Love",
    year: 2000,
    director: "Wong Kar-wai",
    genres: ["Romance", "Drame"],
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
    themes: ["le renoncement"],
    rating: 5,
    review:
      "Deux personnes qui ne se touchent jamais, et le film entier est une caresse. Le ralenti dans l'escalier, à chaque fois.",
    watches: [vu("2025-02-09", 5), vu("2024-03-17", 4.5)],
  },
  {
    id: "demo-jour-sans-fin",
    title: "Un jour sans fin",
    year: 1993,
    director: "Harold Ramis",
    genres: ["Comédie", "Fantastique", "Romance"],
    cast: ["Bill Murray", "Andie MacDowell", "Chris Elliott", "Stephen Tobolowsky"],
    crew: { image: ["John Bailey"], musique: ["George Fenton"] },
    runtime: 101,
    language: "en",
    countries: ["US"],
    tmdbRating: 7.6,
    keywords: ["time loop", "small town", "redemption", "weatherman"],
    motifs: ["time-loop", "back-to-the-start"],
    themes: ["la répétition"],
    rating: 4,
    review: "La meilleure comédie jamais faite sur l'idée qu'on ne devient quelqu'un qu'à l'usure.",
    watches: [vu("2026-01-02", 4)],
  },
  {
    id: "demo-alien",
    title: "Alien, le huitième passager",
    year: 1979,
    director: "Ridley Scott",
    genres: ["Horreur", "Science-fiction"],
    cast: ["Sigourney Weaver", "Tom Skerritt", "John Hurt", "Ian Holm", "Yaphet Kotto"],
    crew: { image: ["Derek Vanlint"], musique: ["Jerry Goldsmith"], scénario: ["Dan O'Bannon"] },
    runtime: 117,
    language: "en",
    countries: ["GB", "US"],
    tmdbRating: 8.2,
    keywords: ["space", "creature", "isolation", "corporate greed", "survival horror"],
    motifs: ["single-setting", "sole-survivor"],
    themes: ["l'espace", "le corps"],
    rating: 4.5,
    review:
      "Un film de couloirs. Tout ce qui fait peur est hors champ, et la seule chose qu'on voie vraiment est la fatigue des gens.",
    watches: [vu("2025-10-31", 4.5)],
  },
  {
    id: "demo-blade-runner",
    title: "Blade Runner",
    year: 1982,
    director: "Ridley Scott",
    genres: ["Science-fiction", "Thriller"],
    cast: ["Harrison Ford", "Rutger Hauer", "Sean Young", "Edward James Olmos"],
    crew: { image: ["Jordan Cronenweth"], musique: ["Vangelis"], scénario: ["Hampton Fancher"] },
    runtime: 117,
    language: "en",
    countries: ["US", "GB"],
    tmdbRating: 7.9,
    keywords: ["dystopia", "android", "memory", "neo-noir", "rain"],
    motifs: ["open-ending", "final-freeze-frame"],
    themes: ["la mémoire", "l'artificiel"],
    rating: 4,
    review:
      "Le monologue final est écrit sur le plateau, et c'est la plus belle chose du film. La pluie y fait le travail de la musique.",
    watches: [vu("2025-10-25", 4)],
  },
  {
    id: "demo-paris-texas",
    title: "Paris, Texas",
    year: 1984,
    director: "Wim Wenders",
    genres: ["Drame"],
    cast: ["Harry Dean Stanton", "Nastassja Kinski", "Dean Stockwell", "Hunter Carson"],
    crew: { image: ["Robby Müller"], musique: ["Ry Cooder"], scénario: ["Sam Shepard"] },
    runtime: 145,
    language: "en",
    countries: ["DE", "FR", "US"],
    tmdbRating: 8.1,
    keywords: ["road movie", "desert", "abandonment", "father son", "one way mirror"],
    motifs: ["road-movie", "reunion", "open-ending"],
    themes: ["l'abandon", "le désert"],
    rating: 5,
    review:
      "La scène du peep-show tient quinze minutes sur deux voix et une vitre. Rien de ce que j'ai vu depuis ne s'en approche.",
    watches: [vu("2024-06-08", 5)],
  },
  {
    id: "demo-perfect-days",
    title: "Perfect Days",
    year: 2023,
    director: "Wim Wenders",
    genres: ["Drame"],
    cast: ["Kōji Yakusho", "Tokio Emoto", "Arisa Nakano", "Aoi Yamada"],
    crew: { image: ["Franz Lustig"], scénario: ["Wim Wenders", "Takuma Takasaki"] },
    runtime: 124,
    language: "ja",
    countries: ["JP", "DE"],
    tmdbRating: 7.8,
    keywords: ["routine", "tokyo", "solitude", "cassette tape", "toilets"],
    motifs: ["real-time"],
    themes: ["la routine", "le travail"],
    /* SET ASIDE, and that is what gives the "À voir" tab its content:
       without at least one card, the tour opens an empty wall there. */
    status: "watchlist",
    watches: [],
  },
  {
    id: "demo-400-coups",
    title: "Les Quatre Cents Coups",
    year: 1959,
    director: "François Truffaut",
    genres: ["Drame"],
    cast: ["Jean-Pierre Léaud", "Claire Maurier", "Albert Rémy", "Patrick Auffay"],
    crew: { image: ["Henri Decaë"], musique: ["Jean Constantin"], scénario: ["François Truffaut"] },
    runtime: 99,
    language: "fr",
    countries: ["FR"],
    tmdbRating: 8.0,
    keywords: ["childhood", "reform school", "paris", "new wave", "running away"],
    motifs: ["flight", "final-freeze-frame"],
    themes: ["l'enfance", "l'école"],
    rating: 4.5,
    review:
      "L'arrêt sur image sur la plage est la première fin de film qui refuse de conclure. Tout le reste de la Nouvelle Vague en sort.",
    watches: [vu("2024-09-12", 4.5)],
  },
  {
    id: "demo-samourai",
    title: "Le Samouraï",
    year: 1967,
    director: "Jean-Pierre Melville",
    genres: ["Policier", "Drame"],
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
    themes: ["la solitude", "le code"],
    rating: 4.5,
    review:
      "Dix minutes sans un mot pour ouvrir. Melville filme un rituel, pas un métier — et Delon ne joue rien, ce qui est exactement ce qu'il fallait.",
    watches: [vu("2026-03-30", 4.5)],
  },
  {
    id: "demo-stalker",
    title: "Stalker",
    year: 1979,
    director: "Andreï Tarkovski",
    genres: ["Science-fiction", "Drame"],
    cast: ["Alexandre Kaïdanovski", "Anatoli Solonitsyne", "Nikolaï Grinko", "Alissa Freindlich"],
    crew: { image: ["Alexandre Kniajinski"], musique: ["Edouard Artemiev"] },
    runtime: 162,
    language: "ru",
    countries: ["SU"],
    tmdbRating: 8.1,
    keywords: ["the zone", "faith", "wasteland", "pilgrimage", "desire"],
    motifs: ["single-setting", "open-ending", "voice-over"],
    themes: ["la foi", "le désir"],
    rating: 4,
    review:
      "Trois hommes marchent vers une pièce qui exauce, et aucun n'ose entrer. Le film dure ce qu'il faut pour qu'on comprenne pourquoi.",
    notes: "Vu fatigué, à revoir un dimanche matin. Le passage sépia du retour m'a échappé.",
    watches: [vu("2025-05-04", 4)],
  },
  {
    id: "demo-portrait",
    title: "Portrait de la jeune fille en feu",
    year: 2019,
    director: "Céline Sciamma",
    genres: ["Romance", "Drame", "Histoire"],
    cast: ["Noémie Merlant", "Adèle Haenel", "Luàna Bajrami", "Valeria Golino"],
    crew: { image: ["Claire Mathon"], musique: ["Para One"], scénario: ["Céline Sciamma"] },
    runtime: 122,
    language: "fr",
    countries: ["FR"],
    tmdbRating: 8.1,
    keywords: ["painter", "18th century", "brittany", "forbidden love", "gaze"],
    motifs: ["impossible-love", "final-freeze-frame", "flashback"],
    themes: ["le regard", "la peinture"],
    rating: 4.5,
    review:
      "Un film sur ce que c'est que d'être regardée en retour. Le dernier plan tient sur un visage et un opéra, et il suffit.",
    watches: [vu("2026-05-18", 4.5)],
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
  note: string;
  relation: Relation;
  force: Strength;
}

const FILS: Thread[] = [
  {
    de: "demo-alien",
    vers: "demo-blade-runner",
    note: "Le même homme, trois ans plus tard, et déjà toute la question : ce qui est vivant, et ce qui ne fait que le paraître.",
    relation: "echo",
    force: 2,
  },
  {
    de: "demo-paris-texas",
    vers: "demo-perfect-days",
    note: "Quarante ans entre les deux, et le même geste : filmer un homme qui se tait jusqu'à ce que le silence dise quelque chose.",
    relation: "diptych",
    force: 3,
  },
  {
    de: "demo-mood",
    vers: "demo-portrait",
    note: "Deux amours qui tiennent entièrement dans ce qu'on n'ose pas faire, et deux dernières images qui refusent de refermer.",
    relation: "echo",
    force: 3,
  },
  {
    de: "demo-400-coups",
    vers: "demo-samourai",
    note: "Henri Decaë à l'image des deux. Le même Paris, à huit ans d'écart : gris pour un enfant qui court, gris pour un homme qui attend.",
    relation: "echo",
    force: 1,
  },
];

/* A reference to a work that is not a film: that is what makes the
   constellation something other than a map of the collection. */
const LIVRE: Omit<LinkedWork, "id"> & { propriétaire: string } = {
  propriétaire: "demo-blade-runner",
  type: "book",
  title: "Les androïdes rêvent-ils de moutons électriques ?",
  creator: "Philip K. Dick",
  note: "Le film garde la question et jette l'intrigue. Le roman, lui, est un livre sur les animaux.",
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
export function demoFilms(maintenant = Date.now()): Film[] {
  const films = BROUILLONS.map((b, rang) =>
    makeFilm({
      ...b,
      /* Arranged in the order of the table, from the most recently
         added to the oldest: that is what the wall's default sort
         expects. */
      addedAt: maintenant - rang * 86_400_000,
      updatedAt: maintenant - rang * 86_400_000,
      /* `watchedAt` is the reflection of `watches`, and the store does
         not realign it by itself on reading: we lay it here, at the
         source. */
      watchedAt: b.watches?.[0]?.date ?? null,
      source: "manual",
    })
  );

  const parId = new Map(films.map((f) => [f.id, f]));
  const ajouter = (id: string, lien: LinkedWork) => {
    const f = parId.get(id);
    if (f) f.linkedWorks = [...f.linkedWorks, lien];
  };

  for (const [rang, fil] of FILS.entries()) {
    const a = parId.get(fil.de);
    const b = parId.get(fil.vers);
    if (!a || !b) continue;
    const pairId = `${DEMO_PREFIX}pair-${rang}`;
    const moitié = (cible: Film, relation: Relation): LinkedWork => ({
      id: `${DEMO_PREFIX}lien-${rang}-${cible.id}`,
      pairId,
      type: "film",
      filmId: cible.id,
      title: cible.title,
      creator: cible.director,
      note: fil.note,
      relation,
      force: fil.force,
    });
    ajouter(a.id, moitié(b, fil.relation));
    ajouter(b.id, moitié(a, inverseOf(fil.relation)!));
  }

  const { propriétaire, ...livre } = LIVRE;
  ajouter(propriétaire, { id: `${DEMO_PREFIX}lien-livre`, ...livre });

  return films;
}

/** The notebook page that comes with it — the notebook has its tour too. */
export function demoNotes(maintenant = Date.now()): Note[] {
  return [
    {
      id: `${DEMO_PREFIX}note-1`,
      title: "Ce que je cherche en ce moment",
      body: "Des films qui font confiance au silence. Melville, Wenders, Sciamma dans la seconde moitié — à chaque fois, la scène qui compte est celle où personne ne parle.\n\nÀ suivre : les chefs opérateurs plutôt que les cinéastes. Decaë revient deux fois sans que je l'aie cherché.",
      createdAt: maintenant,
    },
  ];
}
