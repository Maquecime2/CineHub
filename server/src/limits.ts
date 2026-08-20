/* ============================================================
   CE QU'UN COMPTE PEUT OCCUPER — les plafonds, en un seul endroit
   ============================================================

   Il n'y en avait AUCUN. Le dépôt d'un média se fait par ticket signé,
   le navigateur écrit directement dans le container, et le serveur ne
   voyait donc ni le nombre ni la taille de ce qu'on lui laissait. Sur un
   classeur personnel c'est sans conséquence ; sur une adresse ouverte au
   public, une place illimitée qu'on héberge est une facture illimitée,
   et il suffit d'une personne pour la faire.

   ------------------------------------------------------------
   TROIS PALIERS, UN SEUL JEU DE CHIFFRES
   ------------------------------------------------------------

   `plus` porte les chiffres de référence — ceux qu'on a choisis sur un
   usage réel. `free` en tient la moitié, plus un import par mois. Et
   l'ADMIN passe au-dessus de tout.

   LES BORNES NE DÉCIDENT DE RIEN D'AUTRE. Un compte gratuit a le produit
   ENTIER : les mêmes écrans, les mêmes gestes, le même hall. Ce qui
   change est la place qu'il occupe chez nous, parce que c'est la seule
   chose qui nous coûte. Verrouiller une fonctionnalité aurait demandé de
   la verrouiller partout où elle se touche ; borner une capacité se fait
   en un endroit, celui qui écrit.

   ILS SE RÈGLENT PAR L'ENVIRONNEMENT. Une instance qui héberge trois
   personnes et une qui en héberge trois mille n'ont pas la même idée de
   « raisonnable », et redéployer pour changer un nombre est le genre de
   friction qui fait qu'on ne le change jamais.

   ------------------------------------------------------------
   CE QU'ILS NE TOUCHENT PAS
   ------------------------------------------------------------

   LES FICHES NE SE BORNENT PAS. Ranger et noter est le geste central du
   produit ; le compter reviendrait à faire payer la lecture de ses
   propres données. Ce sont le MIROIR des médias, les DÉCORS et les
   IMPORTS qui sont bornés — les trois choses qui coûtent au serveur.

   ------------------------------------------------------------
   CE FICHIER N'IMPORTE RIEN DE `store.ts`, ET C'EST OBLIGATOIRE
   ------------------------------------------------------------

   Il en tirait `Person` pour typer `ceilingsFor`, et `store.ts` en tire
   `ceilingsFor` : un cycle, que `tsc` a payé en saturant quatre
   gigaoctets avant d'abandonner. Les deux champs dont on a besoin sont
   décrits ici, en clair. C'est trois lignes de plus et zéro dépendance —
   ce module dit ce qu'un compte a le droit d'occuper, il n'a aucune
   raison de savoir ce qu'est un compte.
   ============================================================ */

/** Le strict nécessaire pour décider d'un plafond. */
export interface Holder {
  plan?: string | null;
  is_admin?: boolean | null;
}

const nombre = (raw: string | undefined, defaut: number): number => {
  const n = Number((raw ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : defaut;
};

/* Les chiffres de RÉFÉRENCE, ceux du palier `plus`. Le gratuit en prend
   une part, définie juste en dessous. */

/**
 * Combien de médias privés un compte peut faire autoriser.
 *
 * DEUX MILLE, et le chiffre vient d'un usage : une collection de six
 * cents films porte six cents affiches, plus quelques captures sur les
 * fiches qu'on travaille. On borne large — le plafond est là pour
 * arrêter l'abus, pas pour gêner quelqu'un qui range.
 */
export const MEDIA_CEILING = nombre(process.env.PLAFOND_MEDIAS, 2000);

/**
 * Combien d'objets de décor un compte peut déposer.
 *
 * Beaucoup plus bas, et ce n'est pas une inégalité de traitement : un
 * décor se dessine ou s'importe un par un, à la main. Deux cents, c'est
 * déjà une armoire que personne n'a remplie.
 */
export const DECOR_CEILING = nombre(process.env.PLAFOND_DECORS, 200);

/**
 * Ce que les décors d'un compte peuvent peser en tout, en octets.
 *
 * LA TAILLE EST DÉCLARÉE PAR LE CLIENT, donc ce plafond-ci ne protège
 * pas contre quelqu'un qui ment — c'est celui du NOMBRE qui le fait,
 * puisqu'on sait compter des lignes exactement. Celui-ci attrape le cas
 * honnête et bien plus fréquent : quarante objets énormes.
 */
export const DECOR_BYTES_CEILING = nombre(process.env.PLAFOND_DECORS_OCTETS, 40 * 1024 * 1024);

/**
 * Combien d'imports par fenêtre de trente jours, en gratuit.
 *
 * UN. Un import Letterboxd de six cents films, c'est six cents
 * interrogations du relais TMDB : c'est le geste le plus cher du
 * produit, et le seul qu'on répète en boucle sans y penser. Le palier
 * `plus` n'en compte pas.
 */
export const FREE_IMPORTS = nombre(process.env.PLAFOND_IMPORTS_GRATUIT, 1);

/** La fraction des plafonds de référence que tient un compte gratuit. */
const FREE_SHARE = 0.5;

/** Ce qu'un palier accorde. `Infinity` veut dire « rien ne refuse ». */
export interface Ceilings {
  media: number;
  decors: number;
  decorBytes: number;
  /** `Infinity` : on ne compte pas les imports de ce palier. */
  imports: number;
}

/**
 * Les bornes de cette personne-ci.
 *
 * ON PREND LA PERSONNE ET NON LE PALIER, et c'est délibéré : l'admin est
 * un champ de la personne, pas un troisième palier. Passer `plan` seul
 * aurait obligé chaque appelant à se souvenir de tester `is_admin`
 * à côté — donc à l'oublier une fois.
 */
export function ceilingsFor(person: Holder): Ceilings {
  /* L'ADMIN PASSE AU-DESSUS DE TOUT. `Infinity` plutôt qu'un très grand
     nombre : une comparaison contre l'infini ne se trompe jamais, là où
     un milliard finit par ressembler à une limite. */
  if (person.is_admin) {
    return { media: Infinity, decors: Infinity, decorBytes: Infinity, imports: Infinity };
  }
  if (person.plan === "plus") {
    return {
      media: MEDIA_CEILING,
      decors: DECOR_CEILING,
      decorBytes: DECOR_BYTES_CEILING,
      imports: Infinity,
    };
  }
  return {
    media: Math.floor(MEDIA_CEILING * FREE_SHARE),
    decors: Math.floor(DECOR_CEILING * FREE_SHARE),
    decorBytes: Math.floor(DECOR_BYTES_CEILING * FREE_SHARE),
    imports: FREE_IMPORTS,
  };
}

/**
 * Le plafond est atteint.
 *
 * UNE ERREUR ET NON UNE VALEUR DE RETOUR, et c'est pour rester
 * cohérent : `createDecor` signalait déjà ses refus en jetant — une
 * étiquette vide, un genre inconnu — parce que ce sont des contraintes
 * du schéma. Celui-ci en est une aussi ; en faire un `null` aurait donné
 * deux façons de dire non dans la même fonction, dont une que dix
 * appelants ignorent en silence.
 *
 * `quel` nomme ce qui est plein, pour que la route puisse le dire sans
 * relire la phrase.
 */
export class QuotaReached extends Error {
  /* ÉCRIT EN DEUX TEMPS, ET CE N'EST PAS UN STYLE.

     C'était `constructor(readonly quel: …)` — une propriété de
     paramètre, qui est de la syntaxe TypeScript à TRANSFORMER et non à
     effacer. Le serveur tourne sous `--experimental-strip-types`, qui
     efface les types sans rien transformer : il a refusé de démarrer,
     net.

     Et rien ne l'a vu, parce que `tsc --noEmit` l'accepte et que vitest
     transforme avant d'exécuter. La suite de tests ne DÉMARRE jamais le
     serveur — c'est ce trou que `npm run boot` bouche depuis. */
  readonly quel: "medias" | "decors" | "decors-octets" | "imports";

  constructor(quel: "medias" | "decors" | "decors-octets" | "imports") {
    super("Plafond atteint.");
    this.name = "QuotaReached";
    this.quel = quel;
  }
}
