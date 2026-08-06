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

export type MotifFamille = "destin" | "fin" | "récit" | "figure" | "ton" | "monde";

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
  { id: "destin", label: "Ce qui arrive aux personnages" },
  { id: "fin", label: "La dernière image" },
  { id: "récit", label: "La façon de raconter" },
  { id: "figure", label: "Les figures" },
  { id: "ton", label: "Le ton" },
  { id: "monde", label: "Le monde" },
];

/* L'ORDRE COMPTE : c'est celui de l'affichage, famille par famille, et il
   va du plus courant au plus rare à l'intérieur de chacune. */
export const MOTIFS: Motif[] = [
  /* --- ce qui arrive aux personnages ------------------------------- */
  {
    id: "heros-meurt",
    label: "Le héros meurt",
    famille: "destin",
    spoiler: true,
    tmdb: ["death of hero", "dying and death", "protagonist dies"],
  },
  {
    id: "sacrifice",
    label: "Il se sacrifie",
    famille: "destin",
    spoiler: true,
    tmdb: ["self sacrifice", "sacrifice", "heroic sacrifice"],
  },
  {
    id: "tout-le-monde-meurt",
    label: "Personne n'en réchappe",
    famille: "destin",
    spoiler: true,
    tmdb: ["mass death", "massacre"],
  },
  {
    id: "seul-survivant",
    label: "Un seul en réchappe",
    famille: "destin",
    spoiler: true,
    tmdb: ["sole survivor", "survivor"],
  },
  { id: "deuil", label: "Le deuil d'un proche", famille: "destin", tmdb: ["grief", "mourning"] },
  {
    id: "vengeance-aboutie",
    label: "La vengeance aboutit",
    famille: "destin",
    spoiler: true,
    tmdb: ["revenge", "vengeance"],
  },
  {
    id: "vengeance-vaine",
    label: "La vengeance ne répare rien",
    famille: "destin",
    spoiler: true,
  },
  {
    id: "trahison",
    label: "Trahi par un proche",
    famille: "destin",
    tmdb: ["betrayal", "traitor"],
  },
  { id: "fuite", label: "La fuite", famille: "destin", tmdb: ["escape", "on the run", "manhunt"] },
  {
    id: "chute",
    label: "L'ascension puis la chute",
    famille: "destin",
    tmdb: ["rise and fall", "downfall"],
  },
  {
    id: "amour-impossible",
    label: "L'amour impossible",
    famille: "destin",
    tmdb: ["forbidden love", "unrequited love", "impossible love"],
  },
  {
    id: "retrouvailles",
    label: "Se retrouver après des années",
    famille: "destin",
    tmdb: ["reunion", "family reunion"],
  },
  {
    id: "enfermement",
    label: "Enfermé, littéralement",
    famille: "destin",
    tmdb: ["prison", "captivity", "kidnapping"],
  },
  {
    id: "perte-de-raison",
    label: "La raison qui s'en va",
    famille: "destin",
    tmdb: ["insanity", "madness", "mental illness"],
  },

  /* --- la dernière image ------------------------------------------- */
  {
    id: "fin-ouverte",
    label: "Fin ouverte",
    famille: "fin",
    spoiler: true,
    tmdb: ["open ending", "ambiguous ending"],
  },
  {
    id: "revelation-finale",
    label: "Tout bascule à la fin",
    famille: "fin",
    spoiler: true,
    tmdb: ["twist ending", "plot twist", "surprise ending"],
  },
  { id: "retour-au-depart", label: "On revient au point de départ", famille: "fin", spoiler: true },
  {
    id: "fin-heureuse-mensongere",
    label: "Une fin heureuse à laquelle on ne croit pas",
    famille: "fin",
    spoiler: true,
  },
  {
    id: "derniere-image-fixe",
    label: "Un dernier plan qui se fige",
    famille: "fin",
    spoiler: true,
    tmdb: ["freeze frame"],
  },
  { id: "epilogue-lointain", label: "Un épilogue des années après", famille: "fin", spoiler: true },

  /* --- la façon de raconter ---------------------------------------- */
  {
    id: "recit-non-lineaire",
    label: "Récit désordonné",
    famille: "récit",
    tmdb: ["nonlinear timeline", "anachronic order"],
  },
  {
    id: "narrateur-non-fiable",
    label: "Le narrateur ment",
    famille: "récit",
    tmdb: ["unreliable narrator"],
  },
  { id: "huis-clos", label: "Huis clos", famille: "récit", tmdb: ["one location", "single set"] },
  { id: "film-choral", label: "Film choral", famille: "récit", tmdb: ["ensemble cast"] },
  { id: "road-movie", label: "Road movie", famille: "récit", tmdb: ["road movie", "road trip"] },
  {
    id: "mise-en-abyme",
    label: "Un film dans le film",
    famille: "récit",
    tmdb: ["film within a film", "filmmaking", "metafiction"],
  },
  {
    id: "voix-off",
    label: "Porté par une voix off",
    famille: "récit",
    tmdb: ["voice over narration", "narration"],
  },
  {
    id: "temps-reel",
    label: "En temps réel",
    famille: "récit",
    tmdb: ["real time", "one day"],
  },
  {
    id: "boucle-temporelle",
    label: "La même journée qui recommence",
    famille: "récit",
    tmdb: ["time loop"],
  },
  { id: "chapitres", label: "Découpé en chapitres", famille: "récit", tmdb: ["anthology"] },
  {
    id: "flashback",
    label: "Raconté depuis après",
    famille: "récit",
    tmdb: ["flashback", "told in flashback"],
  },
  { id: "faux-documentaire", label: "Faux documentaire", famille: "récit", tmdb: ["mockumentary"] },
  {
    id: "plan-sequence",
    label: "De longs plans-séquences",
    famille: "récit",
    tmdb: ["long take", "one shot"],
  },
  {
    id: "adaptation-litteraire",
    label: "Vient d'un livre",
    famille: "récit",
    tmdb: ["based on novel or book", "based on play"],
  },

  /* --- les figures -------------------------------------------------- */
  { id: "le-double", label: "Le double", famille: "figure", tmdb: ["doppelganger", "twins"] },
  {
    id: "mentor-perdu",
    label: "Le mentor qu'on perd",
    famille: "figure",
    spoiler: true,
    tmdb: ["mentor"],
  },
  {
    id: "faux-coupable",
    label: "Le faux coupable",
    famille: "figure",
    tmdb: ["wrongful conviction", "wrongly accused"],
  },
  {
    id: "enfant-temoin",
    label: "Un enfant qui regarde",
    famille: "figure",
    tmdb: ["child protagonist", "coming of age"],
  },
  {
    id: "fratrie",
    label: "Une histoire de fratrie",
    famille: "figure",
    tmdb: ["brother brother relationship", "sister sister relationship", "siblings"],
  },
  {
    id: "pere-absent",
    label: "Le père absent",
    famille: "figure",
    tmdb: ["father son relationship", "absent father"],
  },
  {
    id: "duo-depareille",
    label: "Un duo dépareillé",
    famille: "figure",
    tmdb: ["buddy", "odd couple"],
  },
  {
    id: "groupe-qui-se-defait",
    label: "Une bande qui se défait",
    famille: "figure",
    tmdb: ["friendship", "gang"],
  },
  {
    id: "artiste-au-travail",
    label: "Quelqu'un qui fabrique quelque chose",
    famille: "figure",
    tmdb: ["artist", "writer", "musician"],
  },
  {
    id: "figure-de-l-autorite",
    label: "L'institution comme adversaire",
    famille: "figure",
    tmdb: ["bureaucracy", "corruption"],
  },
  {
    id: "fantome",
    label: "Un mort qui reste là",
    famille: "figure",
    tmdb: ["ghost", "haunting"],
  },

  /* --- le ton -------------------------------------------------------- */
  { id: "melancolie", label: "Mélancolie", famille: "ton", tmdb: ["melancholy", "loneliness"] },
  { id: "burlesque", label: "Burlesque", famille: "ton", tmdb: ["slapstick comedy", "farce"] },
  {
    id: "malaise",
    label: "Malaise",
    famille: "ton",
    tmdb: ["awkwardness", "psychological horror"],
  },
  {
    id: "contemplatif",
    label: "Contemplatif",
    famille: "ton",
    tmdb: ["slow cinema", "meditative"],
  },
  { id: "ironie", label: "Ironie froide", famille: "ton", tmdb: ["black comedy", "satire"] },
  { id: "tendresse", label: "Tendresse", famille: "ton", tmdb: ["heartwarming"] },
  { id: "fievre", label: "Fièvre, tout va trop vite", famille: "ton", tmdb: ["frenetic"] },
  { id: "sensualite", label: "Sensualité", famille: "ton", tmdb: ["eroticism", "sensuality"] },
  { id: "paranoia", label: "Paranoïa", famille: "ton", tmdb: ["paranoia", "conspiracy"] },
  { id: "onirique", label: "Onirique", famille: "ton", tmdb: ["dream", "surrealism"] },

  /* --- le monde ------------------------------------------------------ */
  {
    id: "ville-tentaculaire",
    label: "La grande ville qui avale",
    famille: "monde",
    tmdb: ["urban setting", "megacity", "new york city"],
  },
  {
    id: "campagne-etouffante",
    label: "La campagne étouffante",
    famille: "monde",
    tmdb: ["rural setting", "small town", "village"],
  },
  { id: "hiver", label: "L'hiver, la neige", famille: "monde", tmdb: ["winter", "snow"] },
  { id: "ete-ecrasant", label: "Un été écrasant", famille: "monde", tmdb: ["summer", "heat wave"] },
  { id: "mer", label: "La mer", famille: "monde", tmdb: ["ocean", "sea", "island"] },
  {
    id: "futur-proche",
    label: "Un futur tout proche",
    famille: "monde",
    tmdb: ["near future", "dystopia"],
  },
  {
    id: "apres-la-fin",
    label: "Après la fin du monde",
    famille: "monde",
    tmdb: ["post-apocalyptic future", "apocalypse"],
  },
  {
    id: "guerre-en-arriere-plan",
    label: "La guerre, en arrière-plan",
    famille: "monde",
    tmdb: ["world war ii", "war", "occupation"],
  },
  {
    id: "monde-du-travail",
    label: "Le travail, vraiment montré",
    famille: "monde",
    tmdb: ["workplace", "factory", "office"],
  },
  {
    id: "huis-clos-familial",
    label: "La maison de famille",
    famille: "monde",
    tmdb: ["family drama", "dysfunctional family"],
  },
  { id: "la-nuit", label: "Ça se passe la nuit", famille: "monde", tmdb: ["night", "one night"] },
  {
    id: "exil",
    label: "Loin de chez soi",
    famille: "monde",
    tmdb: ["immigration", "exile", "refugee"],
  },
];

const PAR_ID = new Map(MOTIFS.map((m) => [m.id, m]));

export const motifById = (id: string): Motif | undefined => PAR_ID.get(id);

/** Les motifs d'une fiche, dans l'ordre du catalogue et non celui de la pose.
 *
 *  Un `id` inconnu — un motif retiré du catalogue depuis — est simplement
 *  ignoré à l'affichage plutôt qu'effacé de la fiche : le retirer des
 *  données demanderait une migration pour une liste qui bouge encore. */
export const motifsDe = (film: Pick<Film, "motifs">): Motif[] =>
  MOTIFS.filter((m) => (film.motifs || []).includes(m.id));

export const parFamille = (): { famille: MotifFamille; label: string; motifs: Motif[] }[] =>
  FAMILLES.map((f) => ({
    famille: f.id,
    label: f.label,
    motifs: MOTIFS.filter((m) => m.famille === f.id),
  }));

/** Recherche dans le catalogue, sur le label ET la famille. */
export const chercheMotifs = (q: string): Motif[] => {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return MOTIFS.filter(
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
