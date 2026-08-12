/* ============================================================
   LE RESTE DU CLASSEUR — ce qui n'est pas une fiche
   ============================================================

   Une vidéothèque n'est pas une liste de films. C'est aussi l'AGENCEMENT
   des étagères — quel film sur quelle planche, dans quel ordre, sous
   quel intercalaire —, les pages du carnet, les fils tendus entre les
   œuvres, le vocabulaire qu'on s'est écrit, les décors qu'on a posés.

   La première synchronisation ne portait que les fiches. Le second
   appareil retrouvait donc les films et pas la façon dont ils étaient
   rangés : la moitié du classeur, et pas la moins personnelle — ranger
   est le geste central de cette application.

   POURQUOI CE MODULE EXISTE À PART. Ces documents ne portent AUCUNE
   date : ce sont des objets écrits directement dans le `localStorage`
   par six services différents, sans horodatage, depuis toujours. Leur
   en donner une dans chacun d'eux voudrait dire six endroits à ne pas
   oublier. On tient donc un registre : une clé, une date, écrite ici et
   nulle part ailleurs.
   ============================================================ */
import { store } from "./storage";

/** Le registre des dates, à côté des documents eux-mêmes. */
const CLÉ_REGISTRE = "documents-maj";
/** Ce qui attend d'être envoyé — les clés, comme pour les fiches. */
const PENDING_KEY = "documents-a-envoyer";

/* CE QUI SE SYNCHRONISE, ET CE QUI NE DOIT SURTOUT PAS.

   Tout ce qui décrit la COLLECTION voyage. Tout ce qui décrit cet
   appareil-ci reste : la peau choisie (on n'impose pas son goût du
   moment à son autre écran), l'état de la visite guidée, l'invitation à
   installer, et les repères de synchronisation eux-mêmes — les envoyer
   reviendrait à se synchroniser sur son propre curseur. */
const PRÉFIXES = ["shelf-view:"];
const CLÉS = [
  "shelf-views-index",
  "shelf-dividers",
  "notebook-notes",
  "fils",
  "motifs",
  "wall-prefs",
  "decor-custom",
  "decor-hidden",
];

export const estSynchronisable = (clé: string): boolean =>
  CLÉS.includes(clé) || PRÉFIXES.some((p) => clé.startsWith(p));

type Registre = Record<string, number>;

const registre = (): Registre => store.get<Registre>(CLÉ_REGISTRE, {});
const attente = (): string[] => store.get<string[]>(PENDING_KEY, []);

/**
 * Ce document vient de changer ICI.
 *
 * Appelé par le magasin lui-même (`services/storage`), pas par les
 * services qui écrivent : c'est le seul point de passage obligé, et
 * donc le seul endroit où l'on ne peut pas oublier de le dire.
 */
export function noterDocument(clé: string, maintenant = Date.now()): void {
  if (!estSynchronisable(clé)) return;
  store.set(CLÉ_REGISTRE, { ...registre(), [clé]: maintenant });
  const liste = attente();
  if (!liste.includes(clé)) store.set(PENDING_KEY, [...liste, clé]);
}

/** La date d'un document, ou zéro s'il n'a jamais été noté. */
export const dateDe = (clé: string): number => registre()[clé] ?? 0;

/** Ce qu'il reste à envoyer, prêt pour la route. */
export function documentsÀEnvoyer(): {
  cle: string;
  majLe: number;
  contenu: unknown;
  supprime?: boolean;
}[] {
  return attente().map((clé) => {
    const brut = localStorage.getItem(clé);
    return {
      cle: clé,
      majLe: dateDe(clé) || Date.now(),
      /* Un document effacé ici part comme les fiches : en pierre
         tombale. Sans quoi l'autre appareil le repousserait. */
      supprime: brut === null,
      contenu: brut === null ? null : safeParse(brut),
    };
  });
}

const safeParse = (brut: string): unknown => {
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
};

export function oublierDocumentsPartis(clés: string[]): void {
  const reste = attente().filter((c) => !clés.includes(c));
  store.set(PENDING_KEY, reste);
}

/**
 * Range un document venu du serveur.
 *
 * Rend `true` s'il a été écrit. Le dernier écrivain gagne, comme pour
 * les fiches — et à égalité stricte on garde le local, parce que ne rien
 * faire est le seul arbitrage qui ne surprenne personne.
 */
export function rangerDocumentVenu(d: {
  cle: string;
  majLe: number;
  contenu: unknown;
  supprime?: boolean;
}): boolean {
  if (!estSynchronisable(d.cle)) return false;
  if (d.majLe <= dateDe(d.cle)) return false;

  if (d.supprime) localStorage.removeItem(d.cle);
  else store.set(d.cle, d.contenu);

  /* On note la date REÇUE, et l'on ne met pas la clé en attente : ce
     document vient d'ailleurs, il n'a aucune raison d'y retourner. */
  store.set(CLÉ_REGISTRE, { ...registre(), [d.cle]: d.majLe });
  oublierDocumentsPartis([d.cle]);
  return true;
}

/** À la première connexion d'un compte : tout ce qu'on a doit partir. */
export function tousLesDocumentsÀEnvoyer(): void {
  const maintenant = Date.now();
  const reg = registre();
  const clés: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const clé = localStorage.key(i);
    if (clé && estSynchronisable(clé)) clés.push(clé);
  }
  /* Une date pour ceux qui n'en ont jamais eu — sans quoi le serveur
     recevrait `majLe: 0` et les refuserait tous au tour suivant. */
  const suite = { ...reg };
  for (const c of clés) if (!suite[c]) suite[c] = maintenant;
  store.set(CLÉ_REGISTRE, suite);
  store.set(PENDING_KEY, clés);
}

export function oublierLesDocuments(): void {
  store.set(PENDING_KEY, []);
}
