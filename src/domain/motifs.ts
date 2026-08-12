/* ============================================================
   LES MOTIFS — le vocabulaire commun des fiches
   ============================================================

   `themes` existait déjà, et reste ce qu'il est : VOS mots, écrits à la
   main, libres. Sa liberté est aussi sa limite — « fin triste », « fin
   amère » et « ça finit mal » sont trois étiquettes que rien ne
   rapproche, et une carte bâtie dessus ne relie que les fiches taguées le
   même jour, dans la même humeur.

   Un motif est l'inverse : un mot FIGÉ, choisi dans une liste écrite ici,
   dans le code. On n'en invente pas — c'est précisément ce qui permet de
   demander « montre-moi tous les films où le héros meurt » et d'obtenir
   une réponse, plutôt qu'une réponse par orthographe.

   La liste vit donc dans le code et jamais dans le `localStorage` : c'est
   du vocabulaire, pas de la donnée. Une fiche n'en garde que des `id`,
   et un motif qu'on renommerait ici se réaffiche partout sans migration.
   ============================================================ */
import type { Film } from "../types";

export type MotifFamille = "fate" | "ending" | "narrative" | "figures" | "tone" | "world";

export interface Motif {
  /** Clé stable, jamais le label : c'est elle qui est écrite sur la fiche. */
  id: string;
  label: string;
  famille: MotifFamille;
  /**
   * Un motif qui raconte la fin. Il s'écrit comme les autres, mais toute
   * vue qui l'affiche doit le gratter tant qu'on ne l'a pas dévoilé —
   * sans quoi le simple fait de ranger sa collection gâcherait les films
   * qu'on n'a pas encore vus.
   */
  spoiler?: boolean;
  /** Mots-clés TMDB qui le suggèrent. Libellés en anglais, ou ids. */
  tmdb?: (number | string)[];
}

export const FAMILLES: { id: MotifFamille; label: string }[] = [
  { id: "fate", label: "Ce qui arrive aux personnages" },
  { id: "ending", label: "La dernière image" },
  { id: "narrative", label: "La façon de raconter" },
  { id: "figures", label: "Les figures" },
  { id: "tone", label: "Le ton" },
  { id: "world", label: "Le monde" },
];

/* L'ORDRE COMPTE : c'est celui de l'affichage, famille par famille, et il
   va du plus courant au plus rare à l'intérieur de chacune. */
export const MOTIFS: Motif[] = [
  /* --- ce qui arrive aux personnages ------------------------------- */
  {
    id: "hero-dies",
    label: "Le héros meurt",
    famille: "fate",
    spoiler: true,
    tmdb: ["death of hero", "dying and death", "protagonist dies"],
  },
  {
    id: "sacrifice",
    label: "Il se sacrifie",
    famille: "fate",
    spoiler: true,
    tmdb: ["self sacrifice", "sacrifice", "heroic sacrifice"],
  },
  {
    id: "everyone-dies",
    label: "Person n'en réchappe",
    famille: "fate",
    spoiler: true,
    tmdb: ["mass death", "massacre"],
  },
  {
    id: "sole-survivor",
    label: "Un seul en réchappe",
    famille: "fate",
    spoiler: true,
    tmdb: ["sole survivor", "survivor"],
  },
  { id: "grief", label: "Le deuil d'un proche", famille: "fate", tmdb: ["grief", "mourning"] },
  {
    id: "revenge-fulfilled",
    label: "La vengeance aboutit",
    famille: "fate",
    spoiler: true,
    tmdb: ["revenge", "vengeance"],
  },
  {
    id: "revenge-in-vain",
    label: "La vengeance ne répare rien",
    famille: "fate",
    spoiler: true,
  },
  {
    id: "betrayal",
    label: "Trahi par un proche",
    famille: "fate",
    tmdb: ["betrayal", "traitor"],
  },
  { id: "flight", label: "La fuite", famille: "fate", tmdb: ["escape", "on the run", "manhunt"] },
  {
    id: "downfall",
    label: "L'ascension puis la chute",
    famille: "fate",
    tmdb: ["rise and fall", "downfall"],
  },
  {
    id: "impossible-love",
    label: "L'amour impossible",
    famille: "fate",
    tmdb: ["forbidden love", "unrequited love", "impossible love"],
  },
  {
    id: "reunion",
    label: "Se retrouver après des années",
    famille: "fate",
    tmdb: ["reunion", "family reunion"],
  },
  {
    id: "confinement",
    label: "Enfermé, littéralement",
    famille: "fate",
    tmdb: ["prison", "captivity", "kidnapping"],
  },
  {
    id: "loss-of-reason",
    label: "La raison qui s'en va",
    famille: "fate",
    tmdb: ["insanity", "madness", "mental illness"],
  },

  /* --- la dernière image ------------------------------------------- */
  {
    id: "open-ending",
    label: "Fin ouverte",
    famille: "ending",
    spoiler: true,
    tmdb: ["open ending", "ambiguous ending"],
  },
  {
    id: "final-revelation",
    label: "Tout bascule à la fin",
    famille: "ending",
    spoiler: true,
    tmdb: ["twist ending", "plot twist", "surprise ending"],
  },
  {
    id: "back-to-the-start",
    label: "On revient au point de départ",
    famille: "ending",
    spoiler: true,
  },
  {
    id: "false-happy-ending",
    label: "Une fin heureuse à laquelle on ne croit pas",
    famille: "ending",
    spoiler: true,
  },
  {
    id: "final-freeze-frame",
    label: "Un dernier plan qui se fige",
    famille: "ending",
    spoiler: true,
    tmdb: ["freeze frame"],
  },
  {
    id: "distant-epilogue",
    label: "Un épilogue des années après",
    famille: "ending",
    spoiler: true,
  },

  /* --- la façon de raconter ---------------------------------------- */
  {
    id: "non-linear-narrative",
    label: "Récit désordonné",
    famille: "narrative",
    tmdb: ["nonlinear timeline", "anachronic order"],
  },
  {
    id: "unreliable-narrator",
    label: "Le narrateur ment",
    famille: "narrative",
    tmdb: ["unreliable narrator"],
  },
  {
    id: "single-setting",
    label: "Huis clos",
    famille: "narrative",
    tmdb: ["one location", "single set"],
  },
  { id: "ensemble-film", label: "Film choral", famille: "narrative", tmdb: ["ensemble cast"] },
  {
    id: "road-movie",
    label: "Road movie",
    famille: "narrative",
    tmdb: ["road movie", "road trip"],
  },
  {
    id: "story-within-a-story",
    label: "Un film dans le film",
    famille: "narrative",
    tmdb: ["film within a film", "filmmaking", "metafiction"],
  },
  {
    id: "voice-over",
    label: "Porté par une voix off",
    famille: "narrative",
    tmdb: ["voice over narration", "narration"],
  },
  {
    id: "real-time",
    label: "En temps réel",
    famille: "narrative",
    tmdb: ["real time", "one day"],
  },
  {
    id: "time-loop",
    label: "La même journée qui recommence",
    famille: "narrative",
    tmdb: ["time loop"],
  },
  { id: "chapters", label: "Découpé en chapitres", famille: "narrative", tmdb: ["anthology"] },
  {
    id: "flashback",
    label: "Raconté depuis après",
    famille: "narrative",
    tmdb: ["flashback", "told in flashback"],
  },
  { id: "mockumentary", label: "Faux documentaire", famille: "narrative", tmdb: ["mockumentary"] },
  {
    id: "long-take",
    label: "De longs plans-séquences",
    famille: "narrative",
    tmdb: ["long take", "one shot"],
  },
  {
    id: "literary-adaptation",
    label: "Vient d'un livre",
    famille: "narrative",
    tmdb: ["based on novel or book", "based on play"],
  },

  /* --- les figures -------------------------------------------------- */
  { id: "the-double", label: "Le double", famille: "figures", tmdb: ["doppelganger", "twins"] },
  {
    id: "lost-mentor",
    label: "Le mentor qu'on perd",
    famille: "figures",
    spoiler: true,
    tmdb: ["mentor"],
  },
  {
    id: "wrong-man",
    label: "Le faux coupable",
    famille: "figures",
    tmdb: ["wrongful conviction", "wrongly accused"],
  },
  {
    id: "child-witness",
    label: "Un enfant qui regarde",
    famille: "figures",
    tmdb: ["child protagonist", "coming of age"],
  },
  {
    id: "siblings",
    label: "Une histoire de fratrie",
    famille: "figures",
    tmdb: ["brother brother relationship", "sister sister relationship", "siblings"],
  },
  {
    id: "absent-father",
    label: "Le père absent",
    famille: "figures",
    tmdb: ["father son relationship", "absent father"],
  },
  {
    id: "mismatched-duo",
    label: "Un duo dépareillé",
    famille: "figures",
    tmdb: ["buddy", "odd couple"],
  },
  {
    id: "group-falling-apart",
    label: "Une bande qui se défait",
    famille: "figures",
    tmdb: ["friendship", "gang"],
  },
  {
    id: "artist-at-work",
    label: "Quelqu'un qui fabrique quelque chose",
    famille: "figures",
    tmdb: ["artist", "writer", "musician"],
  },
  {
    id: "authority-figure",
    label: "L'institution comme adversaire",
    famille: "figures",
    tmdb: ["bureaucracy", "corruption"],
  },
  {
    id: "ghost",
    label: "Un mort qui reste là",
    famille: "figures",
    tmdb: ["ghost", "haunting"],
  },

  /* --- le ton -------------------------------------------------------- */
  { id: "melancholy", label: "Mélancolie", famille: "tone", tmdb: ["melancholy", "loneliness"] },
  { id: "slapstick", label: "Burlesque", famille: "tone", tmdb: ["slapstick comedy", "farce"] },
  {
    id: "unease",
    label: "Malaise",
    famille: "tone",
    tmdb: ["awkwardness", "psychological horror"],
  },
  {
    id: "contemplative",
    label: "Contemplatif",
    famille: "tone",
    tmdb: ["slow cinema", "meditative"],
  },
  { id: "irony", label: "Ironie froide", famille: "tone", tmdb: ["black comedy", "satire"] },
  { id: "tenderness", label: "Tendresse", famille: "tone", tmdb: ["heartwarming"] },
  { id: "fever", label: "Fièvre, tout va trop vite", famille: "tone", tmdb: ["frenetic"] },
  { id: "sensuality", label: "Sensualité", famille: "tone", tmdb: ["eroticism", "sensuality"] },
  { id: "paranoia", label: "Paranoïa", famille: "tone", tmdb: ["paranoia", "conspiracy"] },
  { id: "dreamlike", label: "Onirique", famille: "tone", tmdb: ["dream", "surrealism"] },

  /* --- le monde ------------------------------------------------------ */
  {
    id: "sprawling-city",
    label: "La grande ville qui avale",
    famille: "world",
    tmdb: ["urban setting", "megacity", "new york city"],
  },
  {
    id: "stifling-countryside",
    label: "La campagne étouffante",
    famille: "world",
    tmdb: ["rural setting", "small town", "village"],
  },
  { id: "winter", label: "L'hiver, la neige", famille: "world", tmdb: ["winter", "snow"] },
  {
    id: "crushing-summer",
    label: "Un été écrasant",
    famille: "world",
    tmdb: ["summer", "heat wave"],
  },
  { id: "sea", label: "La mer", famille: "world", tmdb: ["ocean", "sea", "island"] },
  {
    id: "near-future",
    label: "Un futur tout proche",
    famille: "world",
    tmdb: ["near future", "dystopia"],
  },
  {
    id: "after-the-end",
    label: "Après la fin du monde",
    famille: "world",
    tmdb: ["post-apocalyptic future", "apocalypse"],
  },
  {
    id: "war-in-the-background",
    label: "La guerre, en arrière-plan",
    famille: "world",
    tmdb: ["world war ii", "war", "occupation"],
  },
  {
    id: "world-of-work",
    label: "Le travail, vraiment montré",
    famille: "world",
    tmdb: ["workplace", "factory", "office"],
  },
  {
    id: "family-single-setting",
    label: "La maison de famille",
    famille: "world",
    tmdb: ["family drama", "dysfunctional family"],
  },
  { id: "the-night", label: "Ça se passe la nuit", famille: "world", tmdb: ["night", "one night"] },
  {
    id: "exile",
    label: "Loin de chez soi",
    famille: "world",
    tmdb: ["immigration", "exile", "refugee"],
  },
];

/* ============================================================
   VOS MOTIFS À VOUS
   ============================================================

   Le catalogue ci-dessus reste dans le code, et c'est ce qui permet à une
   mise à jour de l'application d'enrichir le vocabulaire de tout le monde
   sans rien écraser. Mais il ne peut pas tout prévoir : personne d'autre
   que vous ne sait que vous suivez « les films où il pleut sans arrêt ».

   Deux gestes, donc, et deux seulement :
   — AJOUTER les vôtres, qui vivent à côté, dans vos données ;
   — MASQUER ceux du catalogue qui ne vous servent pas. Masquer et non
     supprimer : un motif fourni n'est pas à vous, et le faire disparaître
     de vos données le ferait revenir à la prochaine mise à jour, ce qui
     serait pire que de ne pas l'avoir enlevé.

   LE REGISTRE EST GLOBAL, ET C'EST UN CHOIX ASSUMÉ. `motifById` est
   appelé depuis la recherche, la carte du ciel et la fiche — faire
   descendre le catalogue en propriété jusqu'à chacun traverserait la
   moitié de l'application pour une liste qui ne change qu'à la main.
   `App` charge le disque au démarrage et pose le registre ici ; c'est le
   seul endroit qui écrit. */
let PERSO: Motif[] = [];
let MASQUÉS = new Set<string>();

export interface VocabulaireStocké {
  perso: Motif[];
  masqués: string[];
}

export const poserVocabulaire = ({
  perso = [],
  masqués = [],
}: Partial<VocabulaireStocké>): void => {
  PERSO = perso;
  MASQUÉS = new Set(masqués);
};

export const motifsPerso = (): Motif[] => PERSO;
export const estMasqué = (id: string): boolean => MASQUÉS.has(id);
export const estPerso = (id: string): boolean => PERSO.some((m) => m.id === id);

/** Le vocabulaire en usage : le catalogue moins les masqués, plus les vôtres. */
export const tousLesMotifs = (): Motif[] => [...MOTIFS.filter((m) => !MASQUÉS.has(m.id)), ...PERSO];

/* Un identifiant se DÉDUIT du libellé, et ne bouge plus jamais ensuite :
   c'est lui qui est écrit sur les fiches. Renommer « Il pleut » en « Il
   pleut sans arrêt » ne doit pas décrocher le motif des douze films qui
   le portent. */
export const idDepuisLabel = (label: string, pris: string[] = []): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "motif";
  if (!pris.includes(base)) return base;
  let n = 2;
  while (pris.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

export const makeMotifPerso = (
  label: string,
  famille: MotifFamille = "narrative",
  spoiler = false
): Motif => ({
  id: idDepuisLabel(label, [...MOTIFS.map((m) => m.id), ...PERSO.map((m) => m.id)]),
  label: label.trim(),
  famille,
  ...(spoiler ? { spoiler: true } : {}),
});

const PAR_ID = new Map(MOTIFS.map((m) => [m.id, m]));

/* On regarde les vôtres D'ABORD : si un identifiant existait des deux
   côtés — un motif du catalogue ajouté après coup sous le même nom que
   l'un des vôtres — c'est le vôtre qui doit gagner, puisque c'est celui
   que vous avez écrit.

   Un motif masqué reste trouvable ici : les fiches qui le portent doivent
   continuer de l'afficher, sans quoi masquer effacerait en silence. */
export const motifById = (id: string): Motif | undefined =>
  PERSO.find((m) => m.id === id) || PAR_ID.get(id);

/** Les motifs d'une fiche, dans l'ordre du catalogue et non celui de la pose.
 *
 *  Un `id` inconnu — un motif retiré du catalogue depuis — est simplement
 *  ignoré à l'affichage plutôt qu'effacé de la fiche : le retirer des
 *  données demanderait une migration pour une liste qui bouge encore. */
export const motifsDe = (film: Pick<Film, "motifs">): Motif[] =>
  (film.motifs || []).map((id) => motifById(id)).filter((m): m is Motif => !!m);

export const parFamille = (): { famille: MotifFamille; label: string; motifs: Motif[] }[] => {
  const usage = tousLesMotifs();
  return FAMILLES.map((f) => ({
    famille: f.id,
    label: f.label,
    motifs: usage.filter((m) => m.famille === f.id),
  })).filter((f) => f.motifs.length > 0);
};

/** Recherche dans le catalogue, sur le label ET la famille. */
export const chercheMotifs = (q: string): Motif[] => {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return tousLesMotifs().filter(
    (m) =>
      m.label.toLowerCase().includes(t) ||
      (FAMILLES.find((f) => f.id === m.famille)
        ?.label.toLowerCase()
        .includes(t) ??
        false)
  );
};

/* CE QUE TMDB PEUT PROPOSER, ET RIEN DE PLUS.

   Les mots-clés TMDB sont posés par n'importe qui et vont du très juste
   au franchement faux. On s'en sert donc comme d'une PROPOSITION — la
   fiche ne reçoit que ce qu'un clic a validé. Une suggestion automatique
   écrite sans relecture, sur un champ qui sert ensuite à bâtir la carte,
   remplirait le ciel de fils qu'on n'a jamais tirés.

   La correspondance se fait sur le LIBELLÉ et non sur l'id numérique :
   les ids sont stables chez TMDB mais illisibles ici, et une liste de
   nombres nus serait invérifiable à la relecture. */
export const suggestMotifs = (keywords: { id?: number; name?: string }[] | string[]): Motif[] => {
  const mots = new Set<string>();
  for (const k of keywords || []) {
    if (typeof k === "string") mots.add(k.trim().toLowerCase());
    else {
      if (k?.name) mots.add(k.name.trim().toLowerCase());
      if (typeof k?.id === "number") mots.add(String(k.id));
    }
  }
  if (mots.size === 0) return [];
  return MOTIFS.filter((m) => (m.tmdb || []).some((t) => mots.has(String(t).toLowerCase())));
};

/* ============================================================
   L'ANCIENNE GRAPHIE DES IDENTIFIANTS
   ============================================================

   Les identifiants ci-dessus sont passés à l'anglais, et ce sont eux
   qu'une fiche porte sur le disque : `motifs: ["melancolie"]` était écrit
   dans le `localStorage` de toute collection tenue avant la bascule.

   Le commentaire d'en-tête promet qu'« un motif qu'on renommerait ici se
   réaffiche partout sans migration » — c'est vrai du LABEL, qui ne
   voyage pas ; c'est faux de l'`id`, qui est la seule chose qu'une fiche
   garde. Cette table est donc la contrepartie du renommage, et les deux
   portes de lecture du classeur la traversent : `migrate` dans
   `domain/film` pour les fiches, `normalizeThreads` dans `domain/threads`
   pour les fils.

   Un identifiant inconnu ressort tel quel. C'est déjà la règle du
   catalogue — un motif que personne ne connaît est ignoré à l'affichage,
   jamais effacé de la fiche — et la migration n'a aucune raison d'être
   plus brutale que lui. */
const ANCIENS_IDS: Record<string, string> = {
  destin: "fate",
  fin: "ending",
  récit: "narrative",
  figure: "figures",
  ton: "tone",
  monde: "world",
  "heros-meurt": "hero-dies",
  "tout-le-monde-meurt": "everyone-dies",
  "seul-survivant": "sole-survivor",
  deuil: "grief",
  "vengeance-aboutie": "revenge-fulfilled",
  "vengeance-vaine": "revenge-in-vain",
  trahison: "betrayal",
  fuite: "flight",
  chute: "downfall",
  "amour-impossible": "impossible-love",
  retrouvailles: "reunion",
  enfermement: "confinement",
  "perte-de-raison": "loss-of-reason",
  "fin-ouverte": "open-ending",
  "revelation-finale": "final-revelation",
  "retour-au-depart": "back-to-the-start",
  "fin-heureuse-mensongere": "false-happy-ending",
  "derniere-image-fixe": "final-freeze-frame",
  "epilogue-lointain": "distant-epilogue",
  "recit-non-lineaire": "non-linear-narrative",
  "narrateur-non-fiable": "unreliable-narrator",
  "huis-clos": "single-setting",
  "film-choral": "ensemble-film",
  "mise-en-abyme": "story-within-a-story",
  "voix-off": "voice-over",
  "temps-reel": "real-time",
  "boucle-temporelle": "time-loop",
  chapitres: "chapters",
  "faux-documentaire": "mockumentary",
  "plan-sequence": "long-take",
  "adaptation-litteraire": "literary-adaptation",
  "le-double": "the-double",
  "mentor-perdu": "lost-mentor",
  "faux-coupable": "wrong-man",
  "enfant-temoin": "child-witness",
  fratrie: "siblings",
  "pere-absent": "absent-father",
  "duo-depareille": "mismatched-duo",
  "groupe-qui-se-defait": "group-falling-apart",
  "artiste-au-travail": "artist-at-work",
  "figure-de-l-autorite": "authority-figure",
  fantome: "ghost",
  melancolie: "melancholy",
  burlesque: "slapstick",
  malaise: "unease",
  contemplatif: "contemplative",
  ironie: "irony",
  tendresse: "tenderness",
  fievre: "fever",
  sensualite: "sensuality",
  onirique: "dreamlike",
  "ville-tentaculaire": "sprawling-city",
  "campagne-etouffante": "stifling-countryside",
  hiver: "winter",
  "ete-ecrasant": "crushing-summer",
  mer: "sea",
  "futur-proche": "near-future",
  "apres-la-fin": "after-the-end",
  "guerre-en-arriere-plan": "war-in-the-background",
  "monde-du-travail": "world-of-work",
  "huis-clos-familial": "family-single-setting",
  "la-nuit": "the-night",
  exil: "exile",
};

/* Les FAMILLES ont changé de nom en même temps que les motifs, et elles
   sont écrites sur le disque elles aussi : un motif que vous avez créé
   garde la sienne dans le `localStorage`. La reprise passe par
   `services/motifs`, qui est sa porte de lecture. */
const ANCIENNES_FAMILLES: Record<string, MotifFamille> = {
  destin: "fate",
  fin: "ending",
  récit: "narrative",
  figure: "figures",
  ton: "tone",
  monde: "world",
};

export const migrateMotifFamille = (f: unknown): MotifFamille | null =>
  typeof f === "string" ? (ANCIENNES_FAMILLES[f] ?? null) : null;

/** L'identifiant d'aujourd'hui pour un motif écrit avant la bascule. */
export const migrateMotifId = (id: string): string => ANCIENS_IDS[id] ?? id;

/** La même chose sur une liste, en écartant les doublons qu'elle produirait. */
export const migrateMotifIds = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? [...new Set(ids.filter((i) => typeof i === "string").map(migrateMotifId))]
    : [];
