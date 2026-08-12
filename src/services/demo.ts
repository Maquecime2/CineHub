/* ============================================================
   LE CLASSEUR DE DÉMONSTRATION — douze films pour la première fois

   Un classeur vide est le premier écran de qui découvre l'application,
   et c'est le seul écran où la visite guidée ment. Sur rien, elle
   escamote trois étapes après sept cents millisecondes de voile opaque
   chacune, en joue cinq autour d'un carré vide, et la partie la plus
   riche — le dossier d'un film — reste inatteignable faute de fiche à
   ouvrir. Elle décrit alors un produit que personne ne voit.

   Ces douze films sont donc taillés pour CE QUE LA VISITE MONTRE, et
   pas pour faire nombre : des génériques qui se recoupent (Ridley Scott
   deux fois, Wim Wenders deux fois, Henri Decaë à l'image de deux
   films), des motifs, des fils rouges tendus à la main, des séances
   datées sur trois années, une fiche mise de côté, et une page de
   carnet. Chacun de ces traits sert un repère de la visite ; en retirer
   un rouvre le trou qu'il bouchait.

   TROIS RÈGLES QUI TIENNENT LE RESTE :

   1. Les identifiants sont FIXES et préfixés (`demo-`). C'est ce qui
      permet de reconnaître un classeur encore entièrement d'exemple, de
      le retirer d'un geste, et d'écrire les fils rouges à la main sans
      passer par un registre d'identifiants tirés au hasard.

   2. AUCUNE AFFICHE. `image.tmdb.org` servirait de vraies images, mais
      le classeur est une application hors ligne et une adresse morte
      donne douze rectangles cassés là où l'application sait déjà
      dessiner une émulsion teintée aux initiales du titre. Le repli
      n'est pas un pis-aller ici : c'est la direction artistique.

   3. On ne sème QU'UNE FOIS, et jamais plus — voir `semé` dans
      `onboarding`. Un classeur qu'on vide à la main doit rester vide.
   ============================================================ */
import { makeFilm } from "../domain/film";
import { inverseDe } from "../domain/relations";
import type { Film, Force, LinkedWork, Note, Relation, Watch } from "../types";

/** Le préfixe qui distingue une fiche d'exemple de la vôtre. */
export const PRÉFIXE_DÉMO = "demo-";

export const estDémo = (f: Pick<Film, "id">): boolean => f.id.startsWith(PRÉFIXE_DÉMO);

/**
 * Le classeur ne contient-il QUE de l'exemple ?
 *
 * C'est la condition du bandeau : dès qu'une fiche est ajoutée à la
 * main, le classeur est celui de quelqu'un, et l'avertissement n'a plus
 * lieu d'être — les douze films restent, mais ils ne mentent plus sur
 * ce qu'on regarde.
 */
export const classeurEncoreDémo = (films: Pick<Film, "id">[]): boolean =>
  films.length > 0 && films.every(estDémo);

/** Ce qui reste après avoir retiré l'exemple. */
export const sansDémo = <T extends Pick<Film, "id">>(films: T[]): T[] =>
  films.filter((f) => !estDémo(f));

/* ------------------------------------------------------------
   Les fiches
   ------------------------------------------------------------ */

/* Une séance se lit « le jour, la note ». `null` veut dire « vu sans
   noter », ce qui n'est pas zéro — l'almanach compte la séance et
   écarte la note. */
const vu = (date: string, rating: number | null = null, rewatch = false): Watch => ({
  date,
  rating,
  ...(rewatch ? { rewatch: true } : {}),
});

/* Les fiches sont écrites en une seule table, dans l'ordre où elles
   apparaîtront sur le mur. `makeFilm` complète tout ce qui n'est pas
   dit : c'est lui la définition d'une fiche, pas cette liste. */
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
    motifs: ["fuite", "retour-au-depart"],
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
    motifs: ["recit-non-lineaire", "revelation-finale", "perte-de-raison"],
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
    motifs: ["amour-impossible", "fin-ouverte"],
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
    motifs: ["boucle-temporelle", "retour-au-depart"],
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
    motifs: ["huis-clos", "seul-survivant"],
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
    motifs: ["fin-ouverte", "derniere-image-fixe"],
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
    motifs: ["road-movie", "retrouvailles", "fin-ouverte"],
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
    motifs: ["temps-reel"],
    themes: ["la routine", "le travail"],
    /* MIS DE CÔTÉ, et c'est ce qui donne son contenu à l'onglet « À
       voir » : sans une fiche au moins, la visite y ouvre un mur vide. */
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
    motifs: ["fuite", "derniere-image-fixe"],
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
    motifs: ["heros-meurt", "sacrifice"],
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
    motifs: ["huis-clos", "fin-ouverte", "voix-off"],
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
    motifs: ["amour-impossible", "derniere-image-fixe", "flashback"],
    themes: ["le regard", "la peinture"],
    rating: 4.5,
    review:
      "Un film sur ce que c'est que d'être regardée en retour. Le dernier plan tient sur un visage et un opéra, et il suffit.",
    watches: [vu("2026-05-18", 4.5)],
  },
];

/* ------------------------------------------------------------
   Les fils rouges
   ------------------------------------------------------------

   Écrits à la main, comme dans l'application : deux moitiés qui
   partagent un `pairId`, avec la relation RENVERSÉE de l'autre côté
   (voir `inverseDe`). Les recopier telles quelles plutôt que d'appeler
   `linkFilms` est délibéré — cette fonction vit dans `App` et travaille
   sur l'état React, qui n'existe pas encore au moment du semis. */
interface Thread {
  de: string;
  vers: string;
  note: string;
  relation: Relation;
  force: Force;
}

const FILS: Thread[] = [
  {
    de: "demo-alien",
    vers: "demo-blade-runner",
    note: "Le même homme, trois ans plus tard, et déjà toute la question : ce qui est vivant, et ce qui ne fait que le paraître.",
    relation: "écho",
    force: 2,
  },
  {
    de: "demo-paris-texas",
    vers: "demo-perfect-days",
    note: "Quarante ans entre les deux, et le même geste : filmer un homme qui se tait jusqu'à ce que le silence dise quelque chose.",
    relation: "diptyque",
    force: 3,
  },
  {
    de: "demo-mood",
    vers: "demo-portrait",
    note: "Deux amours qui tiennent entièrement dans ce qu'on n'ose pas faire, et deux dernières images qui refusent de refermer.",
    relation: "écho",
    force: 3,
  },
  {
    de: "demo-400-coups",
    vers: "demo-samourai",
    note: "Henri Decaë à l'image des deux. Le même Paris, à huit ans d'écart : gris pour un enfant qui court, gris pour un homme qui attend.",
    relation: "écho",
    force: 1,
  },
];

/* Un renvoi vers une œuvre qui n'est pas un film : c'est ce qui fait de
   la constellation autre chose qu'une carte de la collection. */
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
 * Les douze fiches, complètes, fils tendus.
 *
 * Rendues NEUVES à chaque appel : une constante partagée finirait par
 * être modifiée par quelqu'un — les fiches se recopient partout dans
 * l'application, mais un tableau, non.
 */
export function filmsDeDémonstration(maintenant = Date.now()): Film[] {
  const films = BROUILLONS.map((b, rang) =>
    makeFilm({
      ...b,
      /* Rangées dans l'ordre de la table, du plus récemment ajouté au
         plus ancien : c'est ce que le tri par défaut du mur attend. */
      addedAt: maintenant - rang * 86_400_000,
      updatedAt: maintenant - rang * 86_400_000,
      /* `watchedAt` est le reflet de `watches`, et le dépôt ne le recale
         pas tout seul à la lecture : on le pose ici, à la source. */
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
    const pairId = `${PRÉFIXE_DÉMO}pair-${rang}`;
    const moitié = (cible: Film, relation: Relation): LinkedWork => ({
      id: `${PRÉFIXE_DÉMO}lien-${rang}-${cible.id}`,
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
    ajouter(b.id, moitié(a, inverseDe(fil.relation)!));
  }

  const { propriétaire, ...livre } = LIVRE;
  ajouter(propriétaire, { id: `${PRÉFIXE_DÉMO}lien-livre`, ...livre });

  return films;
}

/** La page de carnet qui vient avec — le carnet aussi a sa visite. */
export function notesDeDémonstration(maintenant = Date.now()): Note[] {
  return [
    {
      id: `${PRÉFIXE_DÉMO}note-1`,
      title: "Ce que je cherche en ce moment",
      body: "Des films qui font confiance au silence. Melville, Wenders, Sciamma dans la seconde moitié — à chaque fois, la scène qui compte est celle où personne ne parle.\n\nÀ suivre : les chefs opérateurs plutôt que les cinéastes. Decaë revient deux fois sans que je l'aie cherché.",
      createdAt: maintenant,
    },
  ];
}
