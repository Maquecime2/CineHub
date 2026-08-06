/* ============================================================
   LA NATURE D'UN LIEN ENTRE DEUX FICHES
   ============================================================

   `LinkType` ne dit que la NATURE DE LA CIBLE — un livre, un tableau, un
   autre film. Il ne dit rien de ce qui se passe entre les deux, et toute
   cette part vivait jusqu'ici dans la note libre : lisible pour vous,
   muette pour la carte.

   Une relation nomme ce lien. Elle change ce que la constellation peut
   dessiner — une réponse n'est pas un écho, et un remake n'est pas un
   diptyque.

   LE SENS EST LA VRAIE DIFFICULTÉ. Un fil est écrit des deux côtés, en
   deux moitiés jumelles (`pairId`). Pour un écho, les deux moitiés disent
   la même chose. Pour « suite de », non : d'un côté « suite de », de
   l'autre « précède ». Écrire la même relation aux deux bouts ferait dire
   à chaque film qu'il est la suite de l'autre — une absurdité qui ne se
   voit qu'en ouvrant la seconde fiche, c'est-à-dire jamais tout de suite. */

export type Relation =
  | "écho"
  | "diptyque"
  | "même-destin"
  | "réponse-à"
  | "répondu-par"
  | "adapté-de"
  | "adapté-en"
  | "suite-de"
  | "précède"
  | "remake-de"
  | "remaké-par";

export interface RelationDef {
  id: Relation;
  label: string;
  /** L'autre bout du fil. Égal à `id` quand la relation est symétrique. */
  inverse: Relation;
  /** Ce qui ne se propose pas au formulaire : seulement subi par l'autre moitié. */
  dérivée?: boolean;
}

export const RELATIONS: RelationDef[] = [
  { id: "écho", label: "fait écho à", inverse: "écho" },
  { id: "diptyque", label: "forme un diptyque avec", inverse: "diptyque" },
  { id: "même-destin", label: "même destin que", inverse: "même-destin" },
  /* « Répond à » se renverse en « a reçu une réponse » et NON en « écho ».
     Rabattre les deux sur l'écho perdait le sens de la lecture : la fiche
     d'en face ne pouvait plus dire lequel des deux avait répondu, et
     l'information ne se retrouvait nulle part. */
  { id: "réponse-à", label: "répond à", inverse: "répondu-par" },
  { id: "répondu-par", label: "a reçu une réponse de", inverse: "réponse-à", dérivée: true },
  { id: "adapté-de", label: "adapte", inverse: "adapté-en" },
  { id: "adapté-en", label: "a été adapté par", inverse: "adapté-de", dérivée: true },
  { id: "suite-de", label: "fait suite à", inverse: "précède" },
  { id: "précède", label: "précède", inverse: "suite-de", dérivée: true },
  { id: "remake-de", label: "refait", inverse: "remaké-par" },
  { id: "remaké-par", label: "a été refait par", inverse: "remake-de", dérivée: true },
];

const PAR_ID = new Map(RELATIONS.map((r) => [r.id, r]));

export const relationDef = (r: string | null | undefined): RelationDef | undefined =>
  r ? PAR_ID.get(r as Relation) : undefined;

/** Ce que voit l'autre moitié du fil. Une relation inconnue reste elle-même. */
export const inverseDe = (r: Relation | null | undefined): Relation | undefined =>
  r ? (PAR_ID.get(r)?.inverse ?? r) : undefined;

/** Ce qu'on propose à la saisie : les dérivées s'écrivent toutes seules. */
export const RELATIONS_SAISISSABLES = RELATIONS.filter((r) => !r.dérivée);

export const estSymétrique = (r: Relation): boolean => PAR_ID.get(r)?.inverse === r;

/* La force du fil, en trois crans et pas davantage.

   Trois parce qu'on sait dire « un peu / beaucoup / c'est le même film »
   et qu'on ne sait pas dire 7 sur 10 sur une parenté. Un curseur fin
   donnerait une précision fausse, et la carte n'en tirerait rien de plus :
   elle ne s'en sert que pour rapprocher les astres et épaissir le trait. */
export type Force = 1 | 2 | 3;
export const FORCES: { valeur: Force; label: string }[] = [
  { valeur: 1, label: "un fil ténu" },
  { valeur: 2, label: "une vraie parenté" },
  { valeur: 3, label: "le même film, deux fois" },
];

export const forceDe = (f: number | null | undefined): Force =>
  f === 1 || f === 2 || f === 3 ? f : 2;
