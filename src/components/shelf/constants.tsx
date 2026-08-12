/* ============================================================
   VUE — ÉTAGÈRE

   Le mur montre des fiches punaisées ; l'étagère montre des objets
   rangés. Ce n'est pas le même geste : sur le mur on regarde, sur
   l'étagère on range. D'où le glisser-déposer, et d'où les rayons
   qui sont eux-mêmes des destinations — déposer un boîtier dans un
   rayon, c'est lui donner son statut, pas seulement sa place.
   ============================================================ */
import type { ComponentType, CSSProperties } from "react";
import { C, alpha } from "../../theme/tokens";
import {
  Plant,
  Cactus,
  Statuette,
  Cat,
  Candle,
  Mug,
  Clock,
  Books,
  Frame,
  Postcard,
  WallClock,
  Garland,
  Pennant,
  Ivy,
  Tape,
} from "./objects";
import { CustomDraw } from "./CustomDraw";
import {
  customDecorByKey,
  isCustomMotif,
  isDecorHidden,
  listCustomDecor,
} from "../../services/customDecor";
import type { CustomDecor } from "../../services/customDecor";
import type { Film, ShelfKind } from "../../types";

interface ShelfKindConfig {
  title: string;
  tag: string;
  /** Ce que devient une fiche déposée dans ce rayon. */
  patch: Partial<Film>;
  tint?: string;
  border?: string;
}

export const SHELF_KIND: Record<ShelfKind, ShelfKindConfig> = {
  bedside: {
    title: "Films de bedside",
    tag: "ceux qu'on revoit",
    patch: { bedside: true, archived: false },
    tint: `${alpha(C.burgundy, 0.051)}`,
    border: C.burgundy,
  },
  main: { title: "La collection", tag: "", patch: { bedside: false, archived: false } },
  reserve: {
    title: "Mis de côté",
    tag: "gardés, pas jetés",
    patch: { bedside: false, archived: true },
    tint: "transparent",
    border: C.line,
  },
};

export const BOX_W = 96,
  BOX_H = 144;

/* L'écart entre deux boîtiers, et celui qui les sépare de la planche.
   Ce n'est plus un chiffre recopié dans trois styles : le glissement a
   besoin de le CONNAÎTRE.

   L'écart vit maintenant DANS l'enveloppe de l'objet, et c'est tout le
   remède à la nervosité du repère. Avant, la zone de dépôt d'un boîtier
   s'arrêtait à sa tranche : les neuf pixels qui le séparaient du suivant
   appartenaient à la rangée. Les traverser — ce qu'on fait à chaque
   boîtier quand on balaie l'étagère — désignait donc la rangée entière,
   et le repère filait au bout de la ligne avant de revenir. Une rangée
   de dix boîtiers, c'était neuf allers-retours par balayage.

   Les enveloppes pavent désormais la rangée sans un trou : à tout
   instant on survole exactement un objet, ou le vide franc de la
   rangée. */
export const GAP_X = 9,
  GAP_Y = 12;

/* Les couleurs qu'une catégorie peut porter vivent dans `theme/palette`,
   avec les clés qu'elles définissent — il y avait ici une seconde liste
   à tenir à la main, et une clé oubliée d'un côté retombait sans un mot
   sur le bordeaux. On les redonne au nom sous lequel ce fichier les
   servait déjà. */
export { CAT_COLORS, CAT_FAMILIES, catInk } from "../../theme/palette";

/* Une vue peut changer de bois. Ne sont thématisés que trois choses : la
   planche, la teinte du papier du rayon, et l'encre d'accent — assez
   pour changer d'ambiance, trop peu pour défaire le carnet.
   `kraft` reproduit exactement l'étagère d'avant les thèmes : une vue
   migrée doit être identique au pixel. */
export const THEMES = {
  kraft: { label: "Kraft", wood: ["#7A5B3A", "#5E442A"], tint: null, accent: C.burgundy },
  noyer: { label: "Noyer", wood: ["#5A3E28", "#3B2818"], tint: "#2B262008", accent: C.ochre },
  ceruse: { label: "Cérusé", wood: ["#C9B99C", "#A8967A"], tint: null, accent: C.pine },
  nuit: { label: "Nuit", wood: ["#3A4250", "#252B36"], tint: "#5C6B7814", accent: C.cobalt },
  atelier: {
    label: "Atelier",
    wood: ["#8A6A3E", "#6B4F2A"],
    tint: "#B9862E10",
    accent: C.vermillion,
  },
};
export const themeOf = (key: string) => THEMES[key as keyof typeof THEMES] || THEMES.kraft;

/* LE CABINET DE CURIOSITÉS — ce qu'on met sur une étagère et qui n'est
   pas un film.

   Les premiers motifs étaient les décors que la maison dessine ailleurs
   — tache de café, bout de scotch, punaise — et quatre pictogrammes
   lucide. Les uns disaient « papeterie », les autres « planche
   d'icônes », et aucun ne disait ce qu'on pose vraiment sur une
   étagère. Ce sont maintenant des objets du quotidien, dessinés à la
   main dans `objects.jsx`.

   Deux familles, et c'est le motif qui décide : ce qui se POSE tient
   debout sur une planche, au milieu des boîtiers ; ce qui s'ACCROCHE se
   punaise au fond du rayon, où l'on veut, et ne prend la place de
   personne. */
export interface DecorType {
  key: string;
  label: string;
  /** Vient du disque de l'utilisateur, et non de `objects.jsx`. */
  custom?: boolean;
  /** Pour un motif importé : la couleur lui parle-t-elle encore ? */
  tintable?: boolean;
  /* Un dessin de la maison. Les décors de `atmosphere` n'ont pas tous la
     même signature — l'un veut `width`, l'autre `w`, un troisième un
     `rotate` — et les lister ici ne ferait que recopier un contrat qui
     appartient à chaque dessin. `ComponentType` sans contrainte dit ce
     qu'on sait vraiment : c'est un composant, et l'appelant lui passe ce
     dont il dispose. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw?: ComponentType<any>;
  /** Se dresse à la hauteur d'un boîtier plutôt qu'en carré. */
  tall?: boolean;
  /** Porte un nom, et ouvre donc un champ texte dans son panneau. */
  writes?: boolean;
  /** S'accroche au fond du rayon au lieu de se poser sur une planche. */
  wall?: boolean;
  /** La taille qu'il prend en arrivant, quand `M` ne lui va pas. */
  defaultSize?: number;
}

export const DECOR_TYPES: DecorType[] = [
  /* L'INTERCALAIRE — le carton dressé d'avant les catégories, revenu en
     bibelot.

     Il séparait sans rien contenir, et c'est précisément ce qui lui
     manquait pour être une catégorie : impossible de « mettre un film
     dans Polars », seulement de le poser après le carton et d'espérer
     que l'ordre tienne. La boîte a pris ce rôle-là. Mais séparer sans
     contenir reste un geste utile — dans une boîte qui a grossi, une
     étagère par cinéaste où l'on veut marquer les décennies. Le carton
     revient donc pour ce qu'il a toujours su faire, et rien de plus.

     `tall` : il se dresse à la hauteur d'un boîtier au lieu du carré des
     autres décors — c'est ce qui le fait lire comme une cloison plantée
     entre deux tranches, et non comme un bibelot posé devant.
     `writes` : seul motif à porter un nom, donc seul à ouvrir un champ
     texte dans son panneau. */
  { key: "divider", label: "Intercalaire", tall: true, writes: true },

  // ce qui se pose
  { key: "plant", label: "Plante verte", draw: Plant },
  { key: "cactus", label: "Cactus", draw: Cactus },
  { key: "statuette", label: "Statuette", draw: Statuette },
  { key: "cat", label: "Chat en céramique", draw: Cat },
  { key: "candle", label: "Bougie", draw: Candle },
  { key: "mug", label: "Tasse", draw: Mug },
  { key: "clock", label: "Réveil", draw: Clock },
  { key: "books", label: "Pile de livres", draw: Books },

  // ce qui s'accroche
  { key: "frame", label: "Cadre photo", draw: Frame, wall: true },
  { key: "postcard", label: "Carte postale", draw: Postcard, wall: true },
  { key: "wallclock", label: "Horloge", draw: WallClock, wall: true },
  { key: "garland", label: "Guirlande", draw: Garland, wall: true },
  { key: "pennant", label: "Fanions", draw: Pennant, wall: true },
  { key: "ivy", label: "Lierre suspendu", draw: Ivy, wall: true },
  /* Il arrive en XS : un ruban à la taille des autres objets muraux
     ferait une banderole, et personne ne colle une banderole. */
  { key: "tape", label: "Ruban adhésif", draw: Tape, wall: true, defaultSize: 0.42 },
];

/* Les deux familles, prêtes à afficher : le cabinet les présente sous
   deux intitulés, parce qu'on ne les pose pas du même geste. */
export const SHELF_DECOR = DECOR_TYPES.filter((d) => !d.wall);
export const WALL_DECOR = DECOR_TYPES.filter((d) => d.wall);
export const DECOR_BY_KEY: Record<string, DecorType> = Object.fromEntries(
  DECOR_TYPES.map((d) => [d.key, d])
);

/* LE CATALOGUE, MOTIFS IMPORTÉS COMPRIS.

   `DECOR_BY_KEY` reste la table des motifs de la maison — figée, connue
   à la compilation. Mais un objet posé sur l'étagère peut désormais
   désigner un motif venu du disque, et chercher son dessin est devenu un
   geste : c'est `decorSpec` qui le fait, et lui seul. Lire
   `DECOR_BY_KEY` directement, c'est ne voir que la moitié du cabinet.

   Le composant de dessin est mémorisé par clé : `decorSpec` est appelé
   au rendu de chaque objet, et fabriquer un composant neuf à chaque
   fois ferait remonter l'image entière à chaque survol. */
const drawCache = new Map<string, ComponentType<{ color?: string; style?: CSSProperties }>>();

const customDraw = (key: string) => {
  let Draw = drawCache.get(key);
  if (!Draw) {
    Draw = (props) => <CustomDraw motif={key} {...props} />;
    drawCache.set(key, Draw);
  }
  return Draw;
};

const specOf = (d: CustomDecor): DecorType => ({
  key: d.key,
  label: d.label,
  wall: d.wall,
  custom: true,
  tintable: d.tintable,
  draw: customDraw(d.key),
});

/** Le motif d'un objet, qu'il vienne de la maison ou d'un import. */
export const decorSpec = (motif: string): DecorType | undefined => {
  const house = DECOR_BY_KEY[motif];
  if (house) return house;
  const mine = isCustomMotif(motif) ? customDecorByKey(motif) : undefined;
  return mine ? specOf(mine) : undefined;
};

/* Les deux familles du cabinet : motifs importés inclus, motifs masqués
   exclus. Le filtre est ici et pas dans `decorSpec` — un motif masqué
   sort du PANNEAU, il ne s'efface pas des étagères où il est déjà posé. */
export const shelfDecorTypes = (): DecorType[] =>
  [
    ...SHELF_DECOR,
    ...listCustomDecor()
      .filter((d) => !d.wall)
      .map(specOf),
  ].filter((d) => !isDecorHidden(d.key));
export const wallDecorTypes = (): DecorType[] =>
  [
    ...WALL_DECOR,
    ...listCustomDecor()
      .filter((d) => d.wall)
      .map(specOf),
  ].filter((d) => !isDecorHidden(d.key));

export const isWallMotif = (motif: string): boolean => !!decorSpec(motif)?.wall;
/* La taille d'un objet accroché, dessin et prise comprises.

   `WALL_GRIP` est la marge transparente qui fait le tour du dessin : un
   lierre n'est qu'un trait d'encre, et viser le trait lui-même demandait
   une précision qu'on n'a pas au milieu d'une étagère.

   Elle vit ici et non dans le dessin parce que le DÉPÔT en a besoin
   autant que l'affichage : c'est cette demi-largeur qui empêche un objet
   de déborder sur le rayon voisin. */
export const WALL_ART = 64,
  WALL_GRIP = 11;
export const wallBoxOf = (size = 1): number => Math.round(WALL_ART * size) + 2 * WALL_GRIP;

/* Les tailles. `XS` est venu avec le ruban adhésif : un bout de scotch
   n'est pas un objet qu'on regarde, c'est une trace qu'on remarque, et
   même le petit calibre en faisait une pancarte. Il sert aussi bien à
   tout le reste — une punaise, une carte postale glissée dans un coin. */
export const DECOR_SIZES: [string, number][] = [
  ["XS", 0.42],
  ["S", 0.7],
  ["M", 1],
  ["L", 1.5],
  ["XL", 2.2],
  ["XXL", 3.2],
  ["XXXL", 4.6],
];

/* Le repère se déplace en `transform` et jamais en `left`/`top` : une
   translation est un travail de composition, alors qu'écrire une position
   invalide la mise en page — que le `getBoundingClientRect` de l'événement
   suivant oblige alors à recalculer en entier. Sur cent boîtiers, cet
   aller-retour écriture/lecture coûtait plus cher que tout le reste. */
/* Plus court que le boîtier, et centré sur lui : le repère n'a pas à
   border toute la tranche pour désigner une fente. Une barre pleine
   hauteur se lisait comme une bordure de rayon ; ce tronçon-là se lit
   comme une marque posée entre deux choses. */
export const MARK_W = 26,
  MARK_H = BOX_H - 30;

export const DROP_MARK_STYLE: CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  width: MARK_W,
  height: MARK_H,
  zIndex: 60,
  pointerEvents: "none",
  /* Le repère reste dans la page en permanence, transparent, pour que sa
     couche soit prête AVANT le glissement — sinon le navigateur la fabrique
     au premier mouvement, et c'est ce retard qu'on voyait. Apparition et
     déplacement ne coûtent alors plus qu'une composition.

     Le dessin, lui, peut être aussi fouillé qu'on veut : il est peint une
     seule fois dans la couche, à la naissance de la page, et plus jamais
     — un aplat n'était pas une nécessité, seulement une prudence. */
  opacity: 0,
  willChange: "transform, opacity",
  backfaceVisibility: "hidden",
  // il se pose sur la planche : c'est par le pied qu'il se déplie
  transformOrigin: "bottom center",
  // la transition est dans la feuille de styles — voir le commentaire là-bas
};

/* LE REPÈRE DE DÉPÔT — un signe de typographe, pas un pointillé.

   C'était une couture : une ligne à gros pointillés brisée, tracée comme
   dans la marge d'un patron. L'intention était bonne — dire « ça
   s'insère ici » d'une main plutôt que d'une flèche — mais un pointillé
   qui clignote entre deux boîtiers finit par ressembler à un curseur de
   traitement de texte, et il y avait beaucoup de dessin pour dire une
   chose simple.

   C'est maintenant le signe qu'un correcteur trace dans une épreuve pour
   dire « ici, et pas ailleurs » : un filet d'encre plein, un empattement
   qui le coiffe, et au pied un chevron d'insertion posé sur la planche.
   Trois traits, aucun mouvement, aucune répétition. Il ne clignote plus
   — il glisse d'une fente à l'autre, et c'est ce glissement qui montre
   ce qu'on vise.

   Tout est relatif à `MARK_H` : la hauteur du boîtier reste seule à
   décider. */
export const AXIS = 13;

const HEAD = 9,
  FOOT = MARK_H - 11,
  SERIF = 4.5,
  CARET = 6.5;

/* Le filet, l'empattement, le chevron. Trois chemins plutôt qu'un seul :
   ils ne portent ni la même épaisseur ni la même fonction, et l'ombre
   les reprend tous les trois sans avoir à les redessiner. */
export const MARK_PATHS: { d: string; w: number }[] = [
  { d: `M${AXIS} ${HEAD} L${AXIS} ${FOOT}`, w: 2.2 },
  { d: `M${AXIS - SERIF} ${HEAD} L${AXIS + SERIF} ${HEAD}`, w: 2.2 },
  { d: `M${AXIS - CARET} ${MARK_H - 2} L${AXIS} ${FOOT} L${AXIS + CARET} ${MARK_H - 2}`, w: 2.6 },
];

/* L'ombre n'est que la copie décalée du trait, en bas à droite comme
   toutes les ombres de la page : c'est ce qui pose le repère SUR
   l'étagère plutôt que dedans. */
export const MARK_INK: CSSProperties = {
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
