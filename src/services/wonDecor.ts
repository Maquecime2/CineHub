/* ============================================================
   LES OBJETS QU'ON A GAGNÉS
   ============================================================

   ON NE DÉPOSE PLUS DE BIBELOT, ON EN TIRE. Chacun montait les siens —
   `customDecor` tient toujours ceux-là, et ils ne bougent pas ; les
   objets NEUFS sortent d'une pochette, tirés par le serveur, et ce
   module est ce qui les rend posables sur une étagère.

   ------------------------------------------------------------
   POURQUOI PAS DANS `customDecor`, PUISQUE C'EST LA MÊME ÉTAGÈRE
   ------------------------------------------------------------

   Parce que ce ne sont pas les mêmes objets, et que ce qui les
   distingue est exactement ce qu'il ne faut pas confondre :

   UN OBJET GAGNÉ NE SE PARTAGE PAS. `CustomDecor` porte `shown`,
   `remoteId`, `owner` — tout le nécessaire pour être montré, pris et
   crédité. Un objet de pochette n'a rien de tout cela, et c'est
   délibéré : une personne généreuse qui ouvrirait sa collection
   viderait la boutique de sa raison d'être en un après-midi. Les
   ranger ensemble aurait mis le partage à une propriété de distance.

   ET IL N'EST PAS À NOUS. Son image est du stock commun
   (`bank/decor/<clé>`), lisible par tout compte, écrite par le seul
   rôle. Rien à envoyer, rien à effacer, rien à synchroniser : ce qu'on
   possède est une LIGNE au serveur, pas un fichier chez soi.

   ------------------------------------------------------------
   POURQUOI UN CACHE LOCAL

   `decorSpec` est appelé au rendu de CHAQUE objet posé. Il doit
   répondre sans réseau et sans attendre — d'où la même forme que les
   peaux et les papiers : le serveur remplit, le stockage local garde, et
   l'étagère lit. Une étagère qui attend une réponse pour savoir ce
   qu'elle porte est une étagère qui clignote à chaque ouverture.

   LE CACHE A DONC TORT PARFOIS, et c'est acceptable ici : un objet
   gagné sur un autre appareil apparaît à la première lecture du
   comptoir. L'inverse — demander au serveur avant de dessiner une
   rangée — ne l'était pas.
   ============================================================ */
import { store } from "./storage";
import type { DecorDef } from "./server";

const CATALOGUE = "cinehub.decor.won.catalogue";
const OWNED = "cinehub.decor.won.owned";

/** `won:<id>` — ce qui s'écrit dans `item.motif`. */
export const WON_PREFIX = "won:";

export const isWonMotif = (motif: string): boolean =>
  typeof motif === "string" && motif.startsWith(WON_PREFIX);

/** Un objet gagné, tel que l'étagère a besoin de le connaître. */
export interface WonDecor {
  /** `won:<id>` — la clé écrite dans `item.motif`. */
  key: string;
  id: string;
  label: { fr: string; en: string };
  rarity: string;
  media: string;
  wall: boolean;
  tintable: boolean;
  /** Combien on en a. Un double se montre, il ne se cache pas. */
  copies: number;
}

/* Le registre est lu par `decorSpec`, donc à chaque image rendue :
   passer par le stockage local à chaque fois voudrait dire analyser du
   JSON cent fois par écran. On garde donc la liste en mémoire, et le
   stockage local n'est que là où elle survit à un rechargement. */
let cache: WonDecor[] | null = null;
const listeners = new Set<() => void>();

const compose = (defs: DecorDef[], owned: Record<string, number>): WonDecor[] =>
  defs
    .filter((d) => owned[d.id] !== undefined)
    .map((d) => ({
      key: `${WON_PREFIX}${d.id}`,
      id: d.id,
      label: d.label,
      rarity: d.rarity,
      media: d.media,
      wall: d.wall,
      tintable: d.tintable,
      copies: owned[d.id] ?? 1,
    }));

const read = (): WonDecor[] => {
  if (!cache) {
    const defs = store.get<DecorDef[]>(CATALOGUE, []);
    const owned = store.get<Record<string, number>>(OWNED, {});
    cache = compose(defs, owned);
  }
  return cache;
};

const tell = () => {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (e) {
      console.error("[cinehub] un abonné des objets gagnés a levé", e);
    }
  }
};

/**
 * Ce que le comptoir vient d'apprendre du serveur.
 *
 * LE CATALOGUE ENTIER EST GARDÉ, pas seulement ce qu'on possède : la
 * collection doit dessiner les cases VIDES — ce qui manque n'est dans
 * aucune réponse, par définition — et un objet retiré de l'étal doit
 * garder son nom chez ceux qui l'ont.
 */
export function rememberWonDecor(
  catalogue: DecorDef[],
  owned: { decor_id: string; copies: number }[]
): void {
  const byId: Record<string, number> = {};
  for (const o of owned) byId[o.decor_id] = o.copies;
  store.set(CATALOGUE, catalogue);
  store.set(OWNED, byId);
  cache = compose(catalogue, byId);
  tell();
}

/** Le catalogue tel qu'on l'a en mémoire — cases vides comprises. */
export const wonCatalogue = (): DecorDef[] => store.get<DecorDef[]>(CATALOGUE, []);

/** Ce qu'on possède, prêt à poser. */
export const listWonDecor = (): WonDecor[] => read();

export const wonDecorByKey = (key: string): WonDecor | undefined =>
  read().find((d) => d.key === key);

export const subscribeWonDecor = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Le cache est un raccourci, pas une source : une restauration le vide. */
export const refreshWonDecor = (): void => {
  cache = null;
  tell();
};

/** À la fermeture d'un compte : ce qui appartenait à quelqu'un s'en va. */
export function forgetWonDecor(): void {
  store.set(CATALOGUE, []);
  store.set(OWNED, {});
  cache = [];
  tell();
}
