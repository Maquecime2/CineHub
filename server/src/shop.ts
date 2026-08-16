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

   UNE SEULE PEAU EST DONNÉE : le carnet d'archiviste, celle avec
   laquelle le classeur a toujours été dessiné. Les seize autres
   s'achètent — c'est ce qu'on gagne à jouer.

   ET VERROUILLÉES MÊME SANS SERVEUR. Elles se voient, avec leur prix,
   sur un classeur qui n'a jamais parlé à personne : c'est la seule
   chose du produit qui donne une raison d'ouvrir un compte. Le classeur
   MARCHE toujours entier hors ligne — ranger, noter, chercher, importer,
   exporter ; ce qu'on n'a pas, c'est le choix de la robe.

   The stamps are safe for a different reason: they only exist where
   pseudonyms meet. With no account there is nobody to show them to, so
   their absence is not a thing withheld — it is a room one has not
   entered.

   LES BIBELOTS D'ÉTAGÈRE NE SE DÉPOSENT PLUS, ILS SE TIRENT. Chacun
   montait les siens ; les objets neufs sortent maintenant d'une
   pochette, et d'elle seule. Leur catalogue est le seul qui vive en
   base (`sql/002_collection.sql`), parce qu'un objet est une image et
   une rareté — rien à coder, donc rien qui justifie un déploiement.
   ============================================================ */

export type ShopKind = "stamp" | "pack" | "skin" | "power" | "paper" | "title";
export type PowerKind = "halve" | "redo" | "extend" | "double" | "second-wind";

/* CE QU'ON PORTE, ET OÙ ÇA S'ÉCRIT. Quatre familles se portent, chacune
   dans sa colonne de `person`. La liste est ici plutôt que répétée dans
   `wear`, dans `sell` et dans la route : c'est elle qui décide, et le
   type l'oblige à rester d'accord avec les colonnes. */
export const WEARABLE = ["stamp", "skin", "paper", "title"] as const;
export type Wearable = (typeof WEARABLE)[number];

export const isWearable = (kind: ShopKind): kind is Wearable =>
  (WEARABLE as readonly string[]).includes(kind);

export interface ShopItem {
  id: string;
  kind: ShopKind;
  price: number;
  /** For a skin: the key it unlocks in the binder's own catalogue. */
  grants?: string;
  /** For a power: which one, and how many a purchase gives. */
  power?: PowerKind;
  /** Ce qu'un libellé de pochette dit, quand il vient de la base. */
  label?: { fr: string; en: string };
  /** Pour une pochette venue de la base : sa couverture, si elle en a une. */
  cover?: string;
}

/**
 * S'achète-t-il une fois pour toutes ?
 *
 * LE REFUS « VOUS L'AVEZ DÉJÀ » ÉTAIT ÉCRIT EN DUR SUR DEUX FAMILLES,
 * et il l'a été juste assez longtemps pour qu'il y en ait quatre. Une
 * propriété de l'article plutôt qu'une liste dans `buy` : la famille
 * suivante l'obtient sans que personne ait à y penser, et c'est
 * exactement le genre d'oubli qui débite quelqu'un pour un
 * `ON CONFLICT DO NOTHING`.
 */
export const isUnique = (item: ShopItem): boolean => isWearable(item.kind);

export const SHOP: readonly ShopItem[] = [
  /* THE STAMPS — what one wears beside one's name, in the feed, in the
     rankings, on a shared collection. Worn one at a time. */
  { id: "stamp-habitue", kind: "stamp", price: 40 },
  { id: "stamp-noctambule", kind: "stamp", price: 40 },
  { id: "stamp-premiere-seance", kind: "stamp", price: 60 },
  { id: "stamp-projectionniste", kind: "stamp", price: 90 },

  /* LES POCHETTES NE SONT PLUS ICI. Elles vivent en base (`pack_def`),
     avec leurs vignettes, parce que ce sont les seuls articles qu'on
     veut pouvoir AJOUTER sans écrire de code — une image et un prix, et
     rien à rendre de neuf. `packItem` les remet en `ShopItem` et
     `resolveItem` va les chercher quand un identifiant n'est pas ici.
     Voir `sql/002_collection.sql` pour où passe la frontière. */

  /* LES PAPIERS — le fond de la page, et non la robe entière.
     ------------------------------------------------------------

     LEUR INTÉRÊT EST QU'ILS NE REMPLACENT PAS UNE PEAU. Un papier prend
     son encre des jetons du thème en cours, donc les six se combinent
     avec les dix-sept peaux : soixante-dix-sept classeurs différents,
     pour six articles à dessiner. Une dix-huitième peau en aurait donné
     un.

     C'est aussi pourquoi ils ne portent pas de `grants` : il n'y a rien
     à débloquer dans un catalogue de peaux, la surface se dessine à
     partir de l'identifiant. */
  { id: "paper-quadrille", kind: "paper", price: 40 },
  { id: "paper-millimetre", kind: "paper", price: 40 },
  { id: "paper-verge", kind: "paper", price: 70 },
  { id: "paper-calque", kind: "paper", price: 70 },
  { id: "paper-ondule", kind: "paper", price: 100 },
  { id: "paper-kraft-sombre", kind: "paper", price: 110 },

  /* LES TITRES — une mention à côté du pseudonyme.
     ------------------------------------------------------------

     LE MÊME MÉCANISME QUE LES TAMPONS, et volontairement : `owned` pour
     la possession, une colonne de `person` pour le port, un seul à la
     fois. Ce qui change est qu'un titre se LIT — il dit quelque chose
     là où un tampon ne fait que décorer, et c'est ce qui justifie une
     famille séparée plutôt que quatre tampons de plus.

     Ils s'ACHÈTENT et ne se méritent pas, et c'est assumé : ce qui se
     mérite est déjà mesuré par le palmarès, qu'aucun jeton n'achète. */
  { id: "title-cinephile", kind: "title", price: 50 },
  { id: "title-archiviste", kind: "title", price: 70 },
  { id: "title-projectionniste", kind: "title", price: 90 },
  { id: "title-programmateur", kind: "title", price: 110 },
  { id: "title-conservateur", kind: "title", price: 130 },
  { id: "title-doyen", kind: "title", price: 150 },

  /* LES PEAUX — toutes, sauf le carnet d'archiviste.

     C'ÉTAIT TROIS PEAUX NEUVES, et les quatorze existantes restaient
     libres. Le produit a tranché autrement : une seule est donnée — celle
     avec laquelle le classeur a toujours été dessiné — et les seize
     autres sont ce qu'on gagne à jouer.

     LES PRIX SONT ÉCRITS DEUX FOIS, ici et dans `src/theme/skins.ts`.
     C'est un doublon assumé, comme le barème : le sélecteur de peaux doit
     pouvoir annoncer « il vous faut 180 jetons » sans aller-retour, et
     il s'ouvre dans le rail, à tout moment. `skins.test.ts` compare les
     deux catalogues article par article — une divergence afficherait un
     prix et en prélèverait un autre.

     `grants` porte la clé de la peau et non son article : c'est elle que
     `SkinPicker` compare, et les deux ne s'écrivent pas pareil. */
  { id: "skin-veilleuse", kind: "skin", price: 60, grants: "veilleuse" },
  { id: "skin-sepia", kind: "skin", price: 60, grants: "sepia" },
  { id: "skin-herbier", kind: "skin", price: 90, grants: "herbier" },
  { id: "skin-bleu", kind: "skin", price: 90, grants: "bleu" },
  { id: "skin-pastel", kind: "skin", price: 90, grants: "pastel" },
  { id: "skin-bauhaus", kind: "skin", price: 120, grants: "bauhaus" },
  { id: "skin-pulp", kind: "skin", price: 140, grants: "pulp" },
  { id: "skin-fanzine", kind: "skin", price: 140, grants: "fanzine" },
  { id: "skin-affiche", kind: "skin", price: 160, grants: "affiche" },
  { id: "skin-cinematheque", kind: "skin", price: 180, grants: "cinematheque" },
  { id: "skin-japon", kind: "skin", price: 180, grants: "japon" },
  { id: "skin-nuit-americaine", kind: "skin", price: 200, grants: "nuit-americaine" },
  { id: "skin-kodachrome", kind: "skin", price: 200, grants: "kodachrome" },
  { id: "skin-nitrate", kind: "skin", price: 250, grants: "nitrate" },
  { id: "skin-drive-in", kind: "skin", price: 250, grants: "drive-in" },
  { id: "skin-cinemascope", kind: "skin", price: 320, grants: "cinemascope" },

  /* THE POWERS — spent, not worn. Each purchase adds one to the count. */
  { id: "power-halve", kind: "power", price: 15, power: "halve" },
  { id: "power-redo", kind: "power", price: 20, power: "redo" },
  { id: "power-extend", kind: "power", price: 30, power: "extend" },

  /* LA DOUBLE MISE DOUBLE LES JETONS, PAS LE MÉRITE, et c'est la seule
     décision de ce fichier qui mérite d'être défendue.

     Les deux compteurs montent ensemble partout ailleurs (`award`), pour
     qu'acheter ne coûte jamais une place au classement. Ici il faut les
     séparer dans l'autre sens : le mérite EST le classement, et un
     classement dont on peut acheter les points avec des jetons — eux
     mêmes gagnés — ne mesure plus ce qu'on a fait, il mesure ce qu'on a
     réinvesti. Les jetons, en revanche, ne sont qu'une monnaie de
     boutique : les doubler ne fausse rien.

     Le prix est haut exprès. À soixante jetons pour un quiz qui en
     rapporte une quinzaine, ce n'est rentable que sur une longue série,
     donc c'est un pari et non un rendement. */
  { id: "power-double", kind: "power", price: 60, power: "double" },

  /* LE SECOND SOUFFLE EST LE PREMIER POUVOIR QUI N'EST PAS DU QUIZ. Il
     relance un défi échoué, ce qui n'était rattrapable par rien : un
     défi raté était raté, et la seule voie était d'attendre le suivant.
     `PowerBar` apparaît donc aussi dans la vue des listes. */
  { id: "power-second-wind", kind: "power", price: 45, power: "second-wind" },
];

export const itemById = (id: string): ShopItem | undefined => SHOP.find((i) => i.id === id);

/* ------------------------------------------------------------
   THE STICKERS, AND THE DRAW
   ------------------------------------------------------------

   THE CHANCE IS THE SERVER'S, AND IT IS RECORDED BEFORE THE ANSWER
   LEAVES. Drawn in the browser, a disappointing packet would be reopened
   by reloading the page until it pleased. Drawn here, inside the
   purchase's transaction, the object is in the database before
   anybody sees them: replaying the request replays nothing.

   `draw` takes its generator as an argument rather than reaching for
   `randomInt` itself. That is the only way a thing built on chance can
   be tested at all — the production call passes real randomness, the
   test passes a sequence it chose. */

export type Rarity = "common" | "rare" | "gold";

/**
 * Une pochette, telle que la base la tient.
 *
 * LE CATALOGUE DES OBJETS A QUITTÉ CE FICHIER et les onze dessins avec
 * lui. Ce qui reste ici est la FORME de la chance — les seuils, et la
 * façon de retomber sur ses pieds quand un bassin est vide — parce
 * qu'elle est la même pour toutes les pochettes et qu'aucun
 * administrateur n'a de raison de la régler.
 */
export interface PackDef {
  id: string;
  price: number;
  label: { fr: string; en: string };
  cover: string | null;
  retired: boolean;
}

/** Un objet qu'on pose sur l'étagère, et qui se gagne. */
export interface DecorDef {
  id: string;
  packId: string;
  rarity: Rarity;
  /** Une clé de blob sous `bank/decor/…`, ou le nom d'un dessin embarqué. */
  media: string;
  label: { fr: string; en: string };
  /** Se pend au fond de la rangée au lieu de se poser sur la planche. */
  wall: boolean;
  /** Son encre se remplace : la couleur lui parle encore. */
  tintable: boolean;
  retired: boolean;
}

/** Une pochette de la base, vue comme un article du présentoir. */
export const packItem = (p: PackDef): ShopItem => ({
  id: p.id,
  kind: "pack",
  price: p.price,
  label: p.label,
  ...(p.cover ? { cover: p.cover } : {}),
});

/* Seven in ten common, a quarter rare, one in twenty gold. Written as
   thresholds over a thousand so the figures stay whole and the sum is
   checkable by eye. */
const THRESHOLD: readonly { rarity: Rarity; upTo: number }[] = [
  { rarity: "common", upTo: 700 },
  { rarity: "rare", upTo: 950 },
  { rarity: "gold", upTo: 1000 },
];

/**
 * COMBIEN SORT D'UNE POCHETTE. Un, et ce n'est pas réglable par
 * pochette : un nombre paramétrable qu'on met partout à la même valeur
 * est un réglage que personne n'utilise et que tout le monde doit
 * comprendre. Il reste nommé plutôt qu'écrit en clair à l'appel, pour
 * que le jour où il bouge, il bouge à un seul endroit.
 */
export const DRAWS = 1;

/** A source of whole numbers in [0, max). Real randomness, or a test's. */
export type Rng = (max: number) => number;

/**
 * Ce qui sort d'une pochette. UN OBJET, TOUJOURS — `count` reste un
 * paramètre parce que le tirage se teste en série, mais aucun appelant
 * ne lui passe autre chose que `DRAWS`.
 *
 * Les doubles sont possibles et voulus : un double est ce qu'on montre,
 * et un tirage qui garantirait la nouveauté viderait le catalogue à la
 * quatrième pochette.
 */
export function draw(rng: Rng, count: number, stock: readonly DecorDef[]): string[] {
  /* UNE POCHETTE VIDE NE TIRE RIEN, et elle ne jette pas non plus. Le
     cas n'existait pas quand les onze vignettes étaient en dur ; il
     existe dès qu'un administrateur peut créer une pochette et
     l'oublier avant d'y mettre une image. Rendre une liste vide laisse
     l'achat aboutir sur un paquet vide — visible, réparable, et sans
     exception levée sur des jetons déjà débités. */
  const live = stock.filter((s) => !s.retired);
  if (live.length === 0) return [];

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng(1000);
    const rarity = (THRESHOLD.find((t) => roll < t.upTo) ?? THRESHOLD[THRESHOLD.length - 1]!)
      .rarity;
    /* LE BASSIN PEUT ÊTRE VIDE MAINTENANT QUE LES POCHETTES SE CRÉENT.
       Une pochette sans vignette d'or est parfaitement légitime, et
       aucune contrainte ne pourrait l'interdire sans interdire aussi de
       commencer une pochette par une vignette commune. On redescend
       donc vers le plus commun, et à défaut on prend tout le stock —
       tirer dans le vide était la seule issue vraiment fausse. */
    const pool = poolFor(live, rarity);
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

/** Le bassin d'une rareté, ou le plus proche qui ne soit pas vide. */
function poolFor(live: readonly DecorDef[], rarity: Rarity): readonly DecorDef[] {
  const order: Rarity[] = [rarity, "common", "rare", "gold"];
  for (const r of order) {
    const pool = live.filter((s) => s.rarity === r);
    if (pool.length > 0) return pool;
  }
  return live;
}
