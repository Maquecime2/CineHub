/* ============================================================
   VUE — ÉTAGÈRE

   Le mur montre des fiches punaisées ; l'étagère montre des objets
   rangés. Ce n'est pas le même geste : sur le mur on regarde, sur
   l'étagère on range. D'où le glisser-déposer, et d'où les rayons
   qui sont eux-mêmes des destinations — déposer un boîtier dans un
   rayon, c'est lui donner son statut, pas seulement sa place.
   ============================================================ */
import type { ComponentType, CSSProperties } from "react";
import { Paperclip, Sparkles, Moon, Clapperboard, Archive } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { C } from "../../theme/tokens";
import { CoffeeRing, Tape, TapeResidue, PushPin, InkUnderline } from "../atmosphere";
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
  chevet: {
    title: "Films de chevet",
    tag: "ceux qu'on revoit",
    patch: { chevet: true, archived: false },
    tint: `${C.burgundy}0d`,
    border: C.burgundy,
  },
  main: { title: "La collection", tag: "", patch: { chevet: false, archived: false } },
  reserve: {
    title: "Mis de côté",
    tag: "gardés, pas jetés",
    patch: { chevet: false, archived: true },
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

/* Les couleurs qu'une catégorie peut porter. La vue enregistre la CLÉ et
   jamais l'hexadécimal : retoucher la palette repeint alors d'un coup
   toutes les catégories déjà créées, au lieu de les figer à la teinte du
   jour où on les a faites. */
export const CAT_COLORS = {
  burgundy: C.burgundy,
  ochre: C.ochre,
  pine: C.pine,
  slate: C.slate,
  cobalt: C.cobalt,
  vermillion: C.vermillion,
  moss: C.moss,
  ink: C.ink,
};
export const catInk = (key: string): string =>
  CAT_COLORS[key as keyof typeof CAT_COLORS] || C.burgundy;

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

/* Le cabinet de curiosités : ce qu'on peut poser sur une planche à côté
   des boîtiers. Six des dix motifs sont les décors que la maison dessine
   déjà ailleurs — d'où un rayon qui ne ressemble pas à une planche
   d'icônes rapportée. Les quatre autres viennent de lucide, déjà importé. */
interface DecorType {
  key: string;
  label: string;
  /* Un dessin de la maison. Les décors de `atmosphere` n'ont pas tous la
     même signature — l'un veut `width`, l'autre `w`, un troisième un
     `rotate` — et les lister ici ne ferait que recopier un contrat qui
     appartient à chaque dessin. `ComponentType` sans contrainte dit ce
     qu'on sait vraiment : c'est un composant, et l'appelant lui passe ce
     dont il dispose. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draw?: ComponentType<any>;
  /** Ou un pictogramme lucide, pour les motifs qu'on ne dessine pas. */
  icon?: LucideIcon;
  /** Se dresse à la hauteur d'un boîtier plutôt qu'en carré. */
  tall?: boolean;
  /** Porte un nom, et ouvre donc un champ texte dans son panneau. */
  writes?: boolean;
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
  { key: "coffee", label: "Tache de café", draw: CoffeeRing },
  { key: "tape", label: "Bout de scotch", draw: Tape },
  { key: "residue", label: "Résidu de scotch", draw: TapeResidue },
  { key: "pin", label: "Punaise", draw: PushPin },
  { key: "underline", label: "Trait d'encre", draw: InkUnderline },
  { key: "clip", label: "Trombone", icon: Paperclip },
  { key: "star", label: "Étoile", icon: Sparkles },
  { key: "moon", label: "Lune", icon: Moon },
  { key: "clap", label: "Clap", icon: Clapperboard },
  { key: "archive", label: "Carton", icon: Archive },
];
export const DECOR_BY_KEY: Record<string, DecorType> = Object.fromEntries(
  DECOR_TYPES.map((d) => [d.key, d])
);
export const DECOR_SIZES: [string, number][] = [
  ["S", 0.7],
  ["M", 1],
  ["L", 1.5],
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

/* La couture. Pas une barre, pas une flèche : la ligne à gros pointillés
   qu'on trace à main levée dans une marge pour dire « ça se coud ici ».

   Elle casse au lieu d'onduler : des segments droits, des tirets taillés
   net, et à chaque sommet un vrai angle. Mais un angle très ouvert — la
   dent ne déborde que de quatre pixels de part et d'autre de l'axe pour
   trente-huit de hauteur, soit une douzaine de degrés d'écart à la
   verticale. C'est ce rapport-là qui fait tout : un zigzag franc à
   quarante-cinq degrés sonnerait comme un pictogramme d'interface au
   milieu du kraft, alors qu'une brisure de douze degrés se lit comme une
   main qui trace vite. Cassante de près, presque droite de loin.

   L'amplitude est serrée aussi par nécessité : le trou qui s'ouvre entre
   les deux boîtiers fait une vingtaine de pixels, et un trait qui l'emplit
   vient lécher les tranches au lieu de passer entre elles.

   Elle porte son ombre sur le papier, décalée en bas à droite comme
   toutes les ombres de la page : c'est ce qui la pose SUR l'étagère
   plutôt que dedans.

   Tout est en coordonnées relatives à `MARK_H` : la hauteur du boîtier
   reste seule à décider. */
export const AXIS = 13,
  ZIG_AMP = 4,
  ZIG_STEP = 38;

export const ZIGZAG = (() => {
  const top = 9,
    span = MARK_H - 18;
  /* On fixe la HAUTEUR d'une dent, pas leur nombre : c'est le rapport de
     cette hauteur à l'amplitude qui donne l'angle, et c'est lui qu'il faut
     tenir. Compter les dents aurait fait varier l'angle avec la longueur
     du repère — raccourcir la barre l'aurait rendue plus agressive. */
  const teeth = Math.max(2, Math.round(span / ZIG_STEP));
  const pts = [];
  for (let i = 0; i <= teeth; i++) {
    pts.push(
      `${(AXIS + (i % 2 ? ZIG_AMP : -ZIG_AMP)).toFixed(2)} ${(top + (span * i) / teeth).toFixed(2)}`
    );
  }
  return `M${pts[0]} L${pts.slice(1).join(" L")}`;
})();

/* Les deux passes partagent le même chemin et le même pointillé : l'ombre
   n'est que la copie décalée du trait, elle ne peut pas dériver. Bouts
   droits et angles vifs — un tiret arrondi rendrait au trait la mollesse
   qu'on vient de lui retirer. */
export const STITCH: CSSProperties = {
  strokeDasharray: "12 11",
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
};
