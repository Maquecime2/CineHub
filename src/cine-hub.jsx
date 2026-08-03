import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
import {
  Pin, Paperclip, Plus, X, Trash2, ArrowLeft, Upload,
  Star, BookOpen, Palette, Clapperboard, Sparkles, Link2,
  LayoutGrid, Library, Archive, ArchiveRestore, Moon,
} from "lucide-react";
import Papa from "papaparse";
import { enrichRows, checkApiKey, listPosters, POSTER_BASE, POSTER_THUMB } from "./tmdb";
import { buildTaste } from "./taste";
import { gatherCandidates, rank, DEFAULT_QUERY } from "./reco";
import {
  IDB_PREFIX, isIdbPoster, idbKeyOf, putImage, getImage, deleteImage,
  posterStats, pruneOrphans, exportBackup, importBackup,
} from "./db";
import {
  SHELF_KINDS, CAT_KEYS, ROW_CAPS, VIEW_VERSION, belongs, isUnplaced,
  makeView, makeCat, makeDecor,
  reconcileView, moveItem, sortIntoRows, buildViewsFromLegacy, duplicateView,
  reflowView, layoutView, layoutByDirector, upgradeView, DEFAULT_CAP, capFor,
  patchRow, addRow, removeRow, clearRow, addCat, patchCat, removeCat, patchDecor, removeDecor,
} from "./shelf-views";
import { C, FONT_IMPORT, GRAIN } from "./theme/tokens";
import { tapeColor, hueOf } from "./theme/ink";
import { hash, seededRand, tiltOf, usesPin, nudgeOf, fileNoOf, tornClip } from "./domain/seeded";
import { uid, makeFilm, migrate } from "./domain/film";
import { slugOf, filmKey, parseRating, parseLetterboxdCsv, diffImport } from "./domain/importing";
import { workKey, buildSky, relax } from "./domain/sky";
import { store } from "./services/storage";
import { underlineInput, ruledTextarea } from "./theme/styles";
import { LINK_TYPES } from "./components/film/linkTypes";
import {
  PaperGrain, CoffeeRing, TapeResidue, InkUnderline, FileNumber,
  Tape, PushPin, StampCorner,
} from "./components/atmosphere";
import { InkStars, Label } from "./components/ui";
import { PosterArt } from "./components/film/PosterArt";
import { FilmPolaroid } from "./components/film/FilmPolaroid";
import { FilmModal } from "./components/film/FilmModal";
import { FolderTabs } from "./components/layout/FolderTabs";
import { FilmWall } from "./views/library/FilmWall";
import { WALLS } from "./views/library/walls";
import { ThreadBoard } from "./components/film/ThreadBoard";
import { IdbImage } from "./components/stills/IdbImage";
import { StillLightbox } from "./components/stills/StillLightbox";
import { RichText } from "./components/stills/RichText";
import { RichField } from "./components/stills/RichField";
import { StillsStrip } from "./components/stills/StillsStrip";
import { STILL_TOKEN } from "./components/stills/tokens";
import { NotebookView } from "./views/NotebookView";
import { RecoView } from "./views/RecoView";
import { DetailView } from "./views/DetailView";
import { ImportView } from "./views/import/ImportView";
import { ConstellationView } from "./views/ConstellationView";
import { TagChip, TagEditor } from "./components/ui/TagEditor";
import { PosterPicker } from "./components/film/PosterPicker";
import { imageSize, shrinkImage } from "./services/images";

/* Réexportés le temps de la migration : shelf-views et les tests les
   importent encore depuis ce fichier. */
export { makeFilm, migrate, slugOf, filmKey, parseRating, parseLetterboxdCsv, diffImport };
/* ============================================================
   LES VUES — chargement, écriture, migration
   ============================================================

   Une clé par vue, et non un tableau unique : un dépôt réécrit alors le
   seul agencement touché, pas toute la bibliothèque. Sur une grande
   collection c'est la différence entre une écriture de quelques dizaines
   de kilo-octets et une écriture qui frôle le quota. */
const VIEW_INDEX = "shelf-views";
const viewKey = (id) => `shelf-view:${id}`;

const loadViewIndex = () => {
  const idx = store.get(VIEW_INDEX, null);
  return idx?.byWall ? idx : null;
};
const saveViewIndex = (byWall) => store.set(VIEW_INDEX, { version: VIEW_VERSION, byWall });

const loadView = (id) => store.get(viewKey(id), null);

/* Le message de quota de `store` parle d'affiches ; ici ce qu'on perd
   est un rangement, et le dire est la seule façon que l'utilisateur ne
   croie pas son geste enregistré. */
const saveView = (view) => {
  const ok = store.set(viewKey(view.id), view);
  if (!ok) alert("Le rangement n'a pas pu être enregistré — espace de stockage plein.");
  return ok;
};

const deleteViewKey = (id) => { try { localStorage.removeItem(viewKey(id)); } catch { /* rien à faire */ } };

/* Fabriquer les vues à partir de l'ancien rangement, une fois.

   La garde porte sur l'EXISTENCE de l'index, jamais sur « il n'y a pas
   d'intercalaire » : un utilisateur qui n'en a jamais posé se verrait
   sinon regénérer une vue neuve à chaque chargement, et perdrait son
   agencement à chaque fois. */
function ensureViews({ films, dividers, wallPrefs, force = false }) {
  if (!force) {
    const idx = loadViewIndex();
    if (idx) {
      const docs = {};
      for (const wall of Object.keys(idx.byWall)) {
        for (const id of idx.byWall[wall]) {
          const v = loadView(id);
          if (!v) continue;
          /* Une vue d'une version antérieure est reprise ICI, au
             chargement, et réenregistrée. La laisser telle quelle, c'est
             la laisser en une seule grosse ligne jusqu'à ce que
             l'utilisateur y touche — autant dire jamais. */
          const up = upgradeView(v);
          if (up !== v) store.set(viewKey(id), up);
          docs[id] = up;
        }
      }
      // un index qui ne mène à rien vaut un index absent : on refabrique
      if (Object.keys(docs).length) return { byWall: idx.byWall, docs };
    }
  }
  const built = buildViewsFromLegacy({ films, dividers, wallPrefs, now: Date.now() });
  const byWall = { watched: [], watchlist: [] };
  const docs = {};
  for (const v of built) { byWall[v.wall].push(v.id); docs[v.id] = v; store.set(viewKey(v.id), v); }
  saveViewIndex(byWall);
  return { byWall, docs };
}


/* ============================================================
   VUE — ÉTAGÈRE

   Le mur montre des fiches punaisées ; l'étagère montre des objets
   rangés. Ce n'est pas le même geste : sur le mur on regarde, sur
   l'étagère on range. D'où le glisser-déposer, et d'où les rayons
   qui sont eux-mêmes des destinations — déposer un boîtier dans un
   rayon, c'est lui donner son statut, pas seulement sa place.
   ============================================================ */
const SHELF_KIND = {
  chevet:  { title: "Films de chevet", tag: "ceux qu'on revoit", patch: { chevet: true, archived: false }, tint: `${C.burgundy}0d`, border: C.burgundy },
  main:    { title: "La collection",   tag: "",                  patch: { chevet: false, archived: false } },
  reserve: { title: "Mis de côté",     tag: "gardés, pas jetés",  patch: { chevet: false, archived: true }, tint: "transparent", border: C.line },
};

const BOX_W = 96, BOX_H = 144;

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
const GAP_X = 9, GAP_Y = 12;

/* Les couleurs qu'une catégorie peut porter. La vue enregistre la CLÉ et
   jamais l'hexadécimal : retoucher la palette repeint alors d'un coup
   toutes les catégories déjà créées, au lieu de les figer à la teinte du
   jour où on les a faites. */
const CAT_COLORS = {
  burgundy: C.burgundy, ochre: C.ochre, pine: C.pine, slate: C.slate,
  cobalt: C.cobalt, vermillion: C.vermillion, moss: C.moss, ink: C.ink,
};
const catInk = (key) => CAT_COLORS[key] || C.burgundy;

/* Une vue peut changer de bois. Ne sont thématisés que trois choses : la
   planche, la teinte du papier du rayon, et l'encre d'accent — assez
   pour changer d'ambiance, trop peu pour défaire le carnet.
   `kraft` reproduit exactement l'étagère d'avant les thèmes : une vue
   migrée doit être identique au pixel. */
const THEMES = {
  kraft:   { label: "Kraft",   wood: ["#7A5B3A", "#5E442A"], tint: null,        accent: C.burgundy },
  noyer:   { label: "Noyer",   wood: ["#5A3E28", "#3B2818"], tint: "#2B262008", accent: C.ochre },
  ceruse:  { label: "Cérusé",  wood: ["#C9B99C", "#A8967A"], tint: null,        accent: C.pine },
  nuit:    { label: "Nuit",    wood: ["#3A4250", "#252B36"], tint: "#5C6B7814", accent: C.cobalt },
  atelier: { label: "Atelier", wood: ["#8A6A3E", "#6B4F2A"], tint: "#B9862E10", accent: C.vermillion },
};
const themeOf = (key) => THEMES[key] || THEMES.kraft;

/* Le cabinet de curiosités : ce qu'on peut poser sur une planche à côté
   des boîtiers. Six des dix motifs sont les décors que la maison dessine
   déjà ailleurs — d'où un rayon qui ne ressemble pas à une planche
   d'icônes rapportée. Les quatre autres viennent de lucide, déjà importé. */
const DECOR_TYPES = [
  { key: "coffee",    label: "Tache de café",   draw: CoffeeRing },
  { key: "tape",      label: "Bout de scotch",  draw: Tape },
  { key: "residue",   label: "Résidu de scotch", draw: TapeResidue },
  { key: "pin",       label: "Punaise",         draw: PushPin },
  { key: "underline", label: "Trait d'encre",   draw: InkUnderline },
  { key: "clip",      label: "Trombone",        icon: Paperclip },
  { key: "star",      label: "Étoile",          icon: Sparkles },
  { key: "moon",      label: "Lune",            icon: Moon },
  { key: "clap",      label: "Clap",            icon: Clapperboard },
  { key: "archive",   label: "Carton",          icon: Archive },
];
const DECOR_BY_KEY = Object.fromEntries(DECOR_TYPES.map((d) => [d.key, d]));
const DECOR_SIZES = [["S", 0.7], ["M", 1], ["L", 1.5]];

/* Le repère se déplace en `transform` et jamais en `left`/`top` : une
   translation est un travail de composition, alors qu'écrire une position
   invalide la mise en page — que le `getBoundingClientRect` de l'événement
   suivant oblige alors à recalculer en entier. Sur cent boîtiers, cet
   aller-retour écriture/lecture coûtait plus cher que tout le reste. */
/* Plus court que le boîtier, et centré sur lui : le repère n'a pas à
   border toute la tranche pour désigner une fente. Une barre pleine
   hauteur se lisait comme une bordure de rayon ; ce tronçon-là se lit
   comme une marque posée entre deux choses. */
const MARK_W = 26, MARK_H = BOX_H - 30;

const DROP_MARK_STYLE = {
  position: "fixed", left: 0, top: 0, width: MARK_W, height: MARK_H, zIndex: 60,
  pointerEvents: "none",
  /* Le repère reste dans la page en permanence, transparent, pour que sa
     couche soit prête AVANT le glissement — sinon le navigateur la fabrique
     au premier mouvement, et c'est ce retard qu'on voyait. Apparition et
     déplacement ne coûtent alors plus qu'une composition.

     Le dessin, lui, peut être aussi fouillé qu'on veut : il est peint une
     seule fois dans la couche, à la naissance de la page, et plus jamais
     — un aplat n'était pas une nécessité, seulement une prudence. */
  opacity: 0, willChange: "transform, opacity", backfaceVisibility: "hidden",
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
const AXIS = 13, ZIG_AMP = 4, ZIG_STEP = 38;

const ZIGZAG = (() => {
  const top = 9, span = MARK_H - 18;
  /* On fixe la HAUTEUR d'une dent, pas leur nombre : c'est le rapport de
     cette hauteur à l'amplitude qui donne l'angle, et c'est lui qu'il faut
     tenir. Compter les dents aurait fait varier l'angle avec la longueur
     du repère — raccourcir la barre l'aurait rendue plus agressive. */
  const teeth = Math.max(2, Math.round(span / ZIG_STEP));
  const pts = [];
  for (let i = 0; i <= teeth; i++) {
    pts.push(`${(AXIS + (i % 2 ? ZIG_AMP : -ZIG_AMP)).toFixed(2)} ${(top + (span * i) / teeth).toFixed(2)}`);
  }
  return `M${pts[0]} L${pts.slice(1).join(" L")}`;
})();

/* Les deux passes partagent le même chemin et le même pointillé : l'ombre
   n'est que la copie décalée du trait, elle ne peut pas dériver. Bouts
   droits et angles vifs — un tiret arrondi rendrait au trait la mollesse
   qu'on vient de lui retirer. */
const STITCH = { strokeDasharray: "12 11", strokeLinecap: "butt", strokeLinejoin: "miter" };

const DropMark = React.forwardRef(function DropMark(_props, ref) {
  return (
    <div ref={ref} data-drop-mark aria-hidden style={DROP_MARK_STYLE}>
      <svg
        width={MARK_W} height={MARK_H} viewBox={`0 0 ${MARK_W} ${MARK_H}`} fill="none"
        style={{ display: "block", animation: "inkBreathe 1.9s ease-in-out infinite" }}
      >
        <path d={ZIGZAG} stroke="#1E140A" strokeWidth="4.6" opacity="0.2" transform="translate(1.6 1.8)" {...STITCH} />
        <path d={ZIGZAG} stroke={C.burgundy} strokeWidth="3.8" {...STITCH} />
      </svg>
    </div>
  );
});

/* Un boîtier vu de tranche : le dos porte le titre, la face porte l'affiche.

   Mémoïsé, et ce n'est pas une optimisation de confort : `dragover` tire
   plusieurs dizaines d'événements par seconde pendant tout le glissement.
   Sans cela, chaque événement reconstruit tous les boîtiers du rayon — et
   un rayon de cent films rame. Les fonctions reçues sont donc stables, et
   `kind` voyage en prop plutôt que dans une fermeture.

   Le boîtier ne connaît PLUS le repère de dépôt : pendant un glissement
   il ne reçoit aucune prop qui change, donc React ne le retouche jamais.
   Le repère est un seul élément déplacé à la main, hors de React. */
const FilmBox = React.memo(function FilmBox({ film, ctx, onOpen, onDragStart, onDragEnd, onDragOverBox, dim }) {
  const [hover, setHover] = useState(false);
  const hue = hueOf(film.id);
  const initials = film.title.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const stars = "★".repeat(film.rating || 0) + "☆".repeat(5 - (film.rating || 0));

  return (
    <div
      /* L'enveloppe porte l'identité de l'objet ET sa zone de dépôt : le
         code de glissement remonte toujours jusqu'ici, il peut donc lire
         qui il vise sans qu'on le lui repasse en fermeture. */
      data-shelf-item={film.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{
        position: "relative", display: "flex", alignItems: "flex-end", flexShrink: 0,
        /* Une étagère de cent films, c'est cent affiches à disposer et à
           peindre alors qu'on n'en voit qu'une vingtaine. `content-visibility`
           dit au navigateur de ne rien calculer pour ce qui est hors écran ;
           la taille annoncée étant exactement celle d'un boîtier, la mise en
           page reste juste et rien ne saute au défilement. */
        contentVisibility: "auto",
        containIntrinsicSize: `${BOX_W + GAP_X}px ${BOX_H + GAP_Y}px`,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* La couche qui bascule quand le voisin s'écarte. Elle est SOUS
          l'enveloppe et non confondue avec elle : l'enveloppe est la
          cible de dépôt, et une cible qui se dérobe sous le curseur fait
          osciller le geste au lieu de l'accompagner.

          Le seul style que le glissement écrit ici est un `transform` ;
          la transition et le pivot sont déclarés une fois pour toutes,
          pour que l'écartement s'anime sans que personne ait à toucher au
          reste. Le boîtier bascule sur son pied, comme au survol, et la
          courbe dépasse à peine avant de se poser : un carton qu'on
          écarte revient toujours d'un cheveu — mais mollement, pas d'un
          claquement.

          Elle est distincte du boîtier lui-même parce que React tient
          DÉJÀ le `transform` du boîtier, pour la bascule du survol : deux
          mains sur la même propriété, et l'une efface le travail de
          l'autre. */}
      <div
        data-lean
        style={{
          display: "flex", alignItems: "flex-end",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
        }}
      >
        <button
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", film.id); onDragStart("film", film.id, e.currentTarget); }}
          onDragEnd={onDragEnd}
          onClick={() => onOpen(film.id)}
          title={`${film.title}${film.year ? ` (${film.year})` : ""}`}
          style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", position: "relative",
            /* `draggable` ne pose pas un drapeau : il applique `-webkit-user-drag:
               element`, une simple déclaration de style — que `all: unset` efface
               comme le reste. Le boîtier n'était donc pas saisissable ; ce qu'on
               glissait, c'était l'affiche, que le navigateur rend saisissable
               d'elle-même, et l'événement remontait jusqu'ici. Sans affiche, plus
               rien à saisir : le rayon devenait immobile. On rétablit donc ce que
               `all: unset` a emporté. */
            WebkitUserDrag: "element",
            // et le texte des initiales ne doit pas se sélectionner au glissement
            userSelect: "none", WebkitUserSelect: "none",
            width: BOX_W, height: BOX_H, marginBottom: GAP_Y, marginRight: GAP_X, flexShrink: 0,
            borderRadius: "2px 3px 3px 2px", overflow: "hidden",
            // ce qui se repeint dans un boîtier ne concerne que ce boîtier
            contain: "layout paint style",
            border: `1px solid rgba(43,38,32,0.35)`,
            boxShadow: hover ? `3px 5px 10px rgba(30,20,10,0.34)` : `2px 2px 0 rgba(43,38,32,0.16)`,
            transform: hover ? "translateY(-7px) rotate(-1.2deg)" : "none",
            transformOrigin: "bottom center",
            /* `dim` : la recherche, sur l'étagère, ne trie plus le rayon —
               elle éteint ce qu'elle ne trouve pas. Filtrer démonterait
               l'agencement à chaque lettre tapée. */
            opacity: dim ? 0.26 : film.archived ? 0.62 : 1,
            filter: dim ? "saturate(0.35)" : film.archived ? "saturate(0.5)" : "none",
            transition: "transform .18s ease, box-shadow .18s ease, opacity .15s ease, filter .15s ease",
          }}
        >
          <PosterArt film={film} height={BOX_H} initials={initials} plain />
          {/* le dos : c'est lui qui fait lire « boîtier » et non « vignette » */}
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 11, background: hue, boxShadow: "inset -2px 0 4px rgba(0,0,0,0.4)", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "'Special Elite', monospace", fontSize: 8, letterSpacing: "0.08em", color: "rgba(246,239,222,0.92)", whiteSpace: "nowrap" }}>{film.title}</span>
          </span>
          {film.year !== "" && film.year != null && (
            <span style={{ position: "absolute", top: 4, left: 15, background: "rgba(246,239,222,0.88)", color: C.ink, fontFamily: "'Special Elite', monospace", fontSize: 9, padding: "1px 4px", zIndex: 3 }}>{film.year}</span>
          )}
          {film.chevet && <PushPin style={{ top: -5, right: -5, zIndex: 4 }} />}
          {film.status !== "watchlist" && (
            <span style={{ position: "absolute", bottom: 0, left: 11, right: 0, padding: "3px 5px", background: "rgba(43,38,32,0.72)", color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 9.5, letterSpacing: 1, zIndex: 3 }}>{stars}</span>
          )}
        </button>
      </div>
    </div>
  );
});

/* Les sauts de ligne d'un conteneur. Le retour à la ligne n'est pas
   laissé au hasard de la largeur : quand la rangée porte un compte, on
   le pose nous-mêmes. Une catégorie compte pour un objet — c'en est un. */
const withBreaks = (nodes, cap) => {
  if (!cap) return nodes;
  const out = [];
  nodes.forEach((n, i) => {
    if (i > 0 && i % cap === 0) out.push(<div key={`br-${i}`} style={{ flexBasis: "100%", height: 0 }} />);
    out.push(n);
  });
  return out;
};

/* Un décor posé sur la planche : il se glisse, se déplace et s'enlève
   comme un boîtier, mais ne dit rien d'un film. Six des motifs sont les
   décors que la maison dessine déjà ailleurs ; le reste vient de lucide. */
const DecorItem = React.memo(function DecorItem({ item, ctx, onDragStart, onDragEnd, onDragOverBox, onEdit }) {
  const spec = DECOR_BY_KEY[item.motif];
  const ink = catInk(item.color);
  const s = item.size || 1;
  const box = Math.round(46 * s);
  if (!spec) return null;
  const Draw = spec.draw, Icon = spec.icon;
  return (
    <div
      data-shelf-item={item.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{ position: "relative", display: "flex", alignItems: "flex-end", flexShrink: 0 }}
    >
      {/* la couche qui bascule à l'écartement, sous la cible de dépôt */}
      <div data-lean style={{ display: "flex", alignItems: "flex-end", transformOrigin: "bottom center", transition: "transform .3s cubic-bezier(.32,1.16,.42,1)" }}>
        <div
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart("decor", item.id, e.currentTarget); }}
          onDragEnd={onDragEnd}
          onClick={() => onEdit(item.id)}
          title={spec.label}
          style={{
            position: "relative", width: box, height: box, marginBottom: GAP_Y, marginRight: GAP_X, flexShrink: 0,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            /* Posé de guingois, mais toujours de la même façon : le hasard
               stable de la maison, et non un réglage de plus à régler. */
            transform: `rotate(${tiltOf(item.id)}deg)`,
            userSelect: "none", WebkitUserSelect: "none",
          }}
        >
          {Icon
            ? <Icon size={Math.round(26 * s)} color={ink} />
            : <Draw color={ink} width={box} w={box} style={{ position: "relative", width: box, height: box }} />}
        </div>
      </div>
    </div>
  );
});

/* LA CATÉGORIE — une boîte, et non plus un carton planté.

   L'intercalaire d'avant séparait sans rien contenir : on ne pouvait pas
   « mettre un film dans Polars », seulement le poser après le carton et
   espérer que l'ordre tienne. La catégorie est un conteneur : on y
   glisse, on en sort, elle se déplace pleine.

   Son nom se lit à l'horizontale, tronqué par des points de suspension et
   doublé d'une infobulle. Le carton d'avant l'écrivait à la verticale et
   le coupait net à la hauteur d'un boîtier, sans repli d'aucune sorte —
   illisible dès qu'on nommait vraiment quelque chose. */
const CategoryBox = React.memo(function CategoryBox({
  cat, kind, rowId, rowCap, films, dim,
  onDragStart, onDragEnd, onDragOverBox, onCatOver, onOpen, onEdit, acts,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cat.label);
  useEffect(() => { setDraft(cat.label); }, [cat.label]);

  const ink = catInk(cat.color);
  const ctx = useMemo(() => ({ kind, rowId, catId: cat.id }), [kind, rowId, cat.id]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== cat.label) acts.setCat(cat.id, { label: v });
    else setDraft(cat.label);
  };

  const boxes = cat.items
    .map((it) => films.get(it.id))
    .filter(Boolean)
    .map((f) => (
      <FilmBox
        key={f.id} film={f} ctx={ctx} onOpen={onOpen} dim={dim(f)}
        onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOverBox={onDragOverBox}
      />
    ));

  return (
    /* Une boîte est bâtie comme un boîtier : une enveloppe qui porte
       l'écart, l'identité et la zone de dépôt, et l'objet visible à
       l'intérieur. C'est ce qui fait que les cibles pavent la rangée. */
    <div
      data-shelf-item={cat.id}
      draggable={!editing}
      /* Une boîte contient des boîtiers, eux-mêmes saisissables : le
         `dragstart` d'un film REMONTE jusqu'ici. Sans cette garde, saisir
         un film dans une catégorie déplaçait la catégorie entière —
         l'événement arrivait en second et écrasait le premier.

         On compare les ENVELOPPES et non plus les nœuds : `e.target ===
         e.currentTarget` ne laissait saisir la boîte que par son propre
         fond, jamais par son onglet — c'est-à-dire jamais par l'endroit
         où la main va la chercher. Le glissement partait quand même, sans
         que personne l'ait enregistré, et se terminait par un dépôt qui
         ne faisait rien. */
      onDragStart={(e) => {
        if (editing || e.target.closest("[data-shelf-item]") !== e.currentTarget) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart("cat", cat.id, e.currentTarget);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onCatOver(e, ctx)}
      style={{ flexShrink: 0, display: "flex", alignItems: "flex-end" }}
    >
      {/* Le carton EST la couche qui bascule : rien d'autre ne touche à
          son `transform`, il n'a donc pas besoin d'une couche à lui. */}
      <div
        data-cat-card data-lean
        style={{
          position: "relative", flexShrink: 0, marginRight: GAP_X, marginBottom: GAP_Y,
          display: "flex", flexDirection: "column",
          transformOrigin: "bottom center", transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
          /* C'est TOUJOURS un carton : même papier, même filet, même ombre
             portée sèche que l'intercalaire debout d'avant. Il a seulement
             cessé d'être une cloison pour devenir une pochette — ouverte en
             bas, pour que les boîtiers qu'elle tient posent sur la planche
             du rayon comme les autres. Une pochette fermée les ferait
             flotter, et l'étagère cesserait d'être une étagère. */
          background: `linear-gradient(160deg, ${C.paperDark}, #D8C69C)`,
          border: `1px solid ${C.line}`, borderBottom: "none", borderRadius: "3px 3px 0 0",
          boxShadow: "2px 2px 0 rgba(43,38,32,0.14)",
          "--cat-open": `${ink}22`,
        }}
      >
        {/* L'onglet d'index : la couleur est une languette collée en tête de
            carton, pas un aplat qui mangerait le kraft. C'est ainsi qu'on
            repère un dossier dans une boîte d'archives. */}
        <div style={{ height: 4, background: ink, borderRadius: "2px 2px 0 0", opacity: 0.9 }} />
        <div
          onClick={() => setEditing(true)}
          title={cat.label}
          style={{
            padding: "4px 8px", cursor: "text", color: ink,
            fontFamily: "'Special Elite', monospace", fontSize: 10.5, letterSpacing: "0.06em",
            borderBottom: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", gap: 8,
            userSelect: "none", WebkitUserSelect: "none",
          }}
        >
          {editing ? (
            <input
              autoFocus value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(cat.label); setEditing(false); } }}
              style={{ all: "unset", flex: 1, minWidth: 60, fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.ink, borderBottom: `1px solid ${C.line}` }}
            />
          ) : (
            /* Horizontal, tronqué proprement, et l'infobulle porte le nom
               entier. L'intercalaire d'avant l'écrivait à la verticale et le
               coupait net à 144 px, sans ellipse ni recours. */
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{cat.label}</span>
          )}
          <span style={{ color: C.inkFaded, fontSize: 9 }}>{cat.items.length}</span>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); onEdit(cat.id); }}
            title="Couleur de la catégorie"
            style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}
          ><Palette size={11} /></button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", padding: "8px 6px 0", minWidth: BOX_W + 12, minHeight: BOX_H + 8 }}>
          {boxes.length === 0 && (
            <div style={{ color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 15, padding: "0 6px 12px", alignSelf: "flex-end" }}>
              glissez-y des films
            </div>
          )}
          {withBreaks(boxes, cat.perRow || rowCap || DEFAULT_CAP)}
        </div>
      </div>
    </div>
  );
});

const GutterAct = ({ label, onClick, ink = C.inkFaded }) => (
  <button onClick={onClick} style={{
    all: "unset", cursor: "pointer", padding: "3px 0",
    fontFamily: "'Special Elite', monospace", fontSize: 10, color: ink,
  }}>{label}</button>
);

/* LA GOUTTIÈRE — le réglage d'une rangée, à sa gauche.

   Le nombre de films par ligne était un réglage de MUR, le même pour
   toute l'étagère, qu'un intercalaire pouvait seulement surcharger en
   ouvrant sa ligne. Il appartient maintenant à la rangée elle-même, et
   se règle là où on la regarde. */
const RowGutter = React.memo(function RowGutter({ row, shown, acts, capMax }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(row.label || "");
  useEffect(() => { setDraft(row.label || ""); }, [row.label]);
  const caps = ROW_CAPS.filter((n) => n === null || !capMax || n <= capMax);

  return (
    <div style={{ position: "relative", width: 26, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-end", paddingBottom: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={isUnplaced(row) ? "Les films pas encore rangés" : "Réglages de cette ligne"}
        style={{
          all: "unset", cursor: "pointer", boxSizing: "border-box",
          width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
          background: C.paperDark, border: `1px solid ${C.line}`, borderRight: "none", borderRadius: "2px 0 0 2px",
          boxShadow: "1px 1px 0 rgba(43,38,32,0.14)",
          fontFamily: "'Special Elite', monospace", fontSize: 9.5, color: C.inkFaded,
          // discrète tant qu'on ne s'occupe pas de la rangée
          opacity: open || shown ? 1 : 0.45, transition: "opacity .15s ease",
        }}
      >{isUnplaced(row) ? "?" : row.perRow || "~"}</button>

      {row.label && !open && (
        <div title={row.label} style={{ position: "absolute", top: -18, left: 0, width: 130, textAlign: "left", fontFamily: "'Caveat', cursive", fontSize: 14, color: C.inkFaded, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>
          {row.label}
        </div>
      )}

      {open && (
        <>
          {/* cliquer ailleurs referme : un réglage ne reste pas ouvert */}
          <div onClick={() => setOpen(false)} data-veil style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{
            position: "absolute", left: 24, bottom: 8, zIndex: 31, width: 214, padding: "10px 12px",
            background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
          }}>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 8.5, letterSpacing: 1, color: C.inkFaded, marginBottom: 5 }}>FILMS SUR CETTE LIGNE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {caps.map((n) => {
                const on = (row.perRow || null) === n;
                return (
                  <button key={String(n)} onClick={() => acts.setRow(row.id, { perRow: n })} style={{
                    all: "unset", cursor: "pointer", padding: "2px 7px", fontFamily: "'Special Elite', monospace", fontSize: 9.5,
                    background: on ? C.ink : "transparent", color: on ? C.card : C.inkFaded, border: `1px solid ${on ? C.ink : C.line}`,
                  }}>{n === null ? "auto" : n}</button>
                );
              })}
            </div>

            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 8.5, letterSpacing: 1, color: C.inkFaded, margin: "12px 0 3px" }}>NOM DE LA LIGNE</div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => acts.setRow(row.id, { label: draft.trim() })}
              onKeyDown={(e) => { if (e.key === "Enter") { acts.setRow(row.id, { label: draft.trim() }); setOpen(false); } }}
              placeholder="sans nom"
              style={{ all: "unset", boxSizing: "border-box", width: "100%", borderBottom: `1px solid ${C.line}`, paddingBottom: 2, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
              <GutterAct label="+ une ligne au-dessus" onClick={() => { acts.addRow(row.id, "before"); setOpen(false); }} />
              <GutterAct label="+ une ligne en dessous" onClick={() => { acts.addRow(row.id, "after"); setOpen(false); }} />
              <GutterAct label="+ une catégorie ici" onClick={() => { acts.addCat(row.id); setOpen(false); }} />
              {!isUnplaced(row) && <>
                <GutterAct label="vider la ligne" onClick={() => { acts.clearRow(row.id); setOpen(false); }} />
                <GutterAct label="supprimer la ligne" ink={C.burgundy} onClick={() => { acts.removeRow(row.id); setOpen(false); }} />
              </>}
            </div>
            {isUnplaced(row) && (
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: C.inkFaded, marginTop: 8 }}>
                la ligne d'arrivée recueille ce qui n'a pas encore de place — elle ne se supprime pas
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
});

/* UNE RANGÉE — sa gouttière, sa planche, et ce qui est posé dessus.

   Une planche par rangée, et non plus une par rayon : c'est ce qu'est une
   étagère, cela donne à la gouttière un objet contre quoi buter, et cela
   fait de la rangée une chose qu'on voit. */
const ShelfRow = React.memo(function ShelfRow({
  row, kind, films, theme, dim, dnd, acts, onOpen, onEditCat, onEditDecor, capMax, isLast, bare,
}) {
  const [shown, setShown] = useState(false);
  const ctx = useMemo(() => ({ kind, rowId: row.id, catId: null }), [kind, row.id]);

  const nodes = row.items.map((it) => {
    if (it.t === "c") {
      return (
        <CategoryBox
          key={it.id} cat={it} kind={kind} rowId={row.id} rowCap={row.perRow}
          films={films} dim={dim} acts={acts} onOpen={onOpen} onEdit={onEditCat}
          onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd}
          onDragOverBox={dnd.onBoxOver} onCatOver={dnd.onCatOver}
        />
      );
    }
    if (it.t === "d") {
      return (
        <DecorItem
          key={it.id} item={it} ctx={ctx} onEdit={onEditDecor}
          onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd} onDragOverBox={dnd.onBoxOver}
        />
      );
    }
    const f = films.get(it.id);
    if (!f) return null;
    return (
      <FilmBox
        key={f.id} film={f} ctx={ctx} onOpen={onOpen} dim={dim(f)}
        onDragStart={dnd.onDragStart} onDragEnd={dnd.onDragEnd} onDragOverBox={dnd.onBoxOver}
      />
    );
  }).filter(Boolean);

  const empty = nodes.length === 0;
  // la ligne d'arrivée vide ne se montre pas : elle n'a rien à dire
  const hidden = empty && isUnplaced(row);

  return (
    <>
      <div
        style={{ display: "flex", alignItems: "stretch" }}
        onMouseEnter={() => setShown(true)}
        onMouseLeave={() => setShown(false)}
      >
        {!hidden && !bare && <RowGutter row={row} shown={shown} acts={acts} capMax={capMax} />}
        <div
          data-shelf-row
          onDragOver={(e) => dnd.onRowOver(e, ctx)}
          onDrop={(e) => { e.preventDefault(); dnd.onDrop(kind); }}
          style={{
            position: "relative", flex: 1, display: "flex", flexWrap: "wrap", alignItems: "flex-end",
            minHeight: hidden ? 12 : BOX_H + 26,
            padding: hidden ? 0 : bare ? "14px 2px 0" : "14px 10px 0",
            marginLeft: hidden && !bare ? 26 : 0,
          }}
        >
          {empty && !isUnplaced(row) && (
            <div style={{ color: C.inkFaded, fontStyle: "italic", fontSize: 13, padding: "44px 4px" }}>
              ligne vide — glissez-y un boîtier
            </div>
          )}
          {withBreaks(nodes, row.perRow)}
          {/* la planche de CETTE rangée */}
          {!hidden && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, background: `linear-gradient(${theme.wood[0]}, ${theme.wood[1]})`, boxShadow: "0 3px 0 rgba(0,0,0,0.18)" }} />
          )}
        </div>
      </div>
      {/* la couture : y lâcher un boîtier ouvre une rangée neuve */}
      {!isLast && (
        <div
          data-row-seam
          onDragOver={(e) => dnd.onSeamOver(e, kind, row.id)}
          onDrop={(e) => { e.preventDefault(); dnd.onDrop(kind); }}
          style={{ height: 10, marginLeft: bare ? 0 : 26 }}
        />
      )}
    </>
  );
});

/* Un rayon : ses rangées, empilées dans son cadre. La planche n'est plus
   ici — chaque rangée porte la sienne. */
function Shelf({ kind, title, tag, shelf, count, onOpen, dnd, acts, films, theme, dim, onEditCat, onEditDecor, onCabinet }) {
  const cfg = SHELF_KIND[kind];
  const rows = shelf?.rows || [];

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 21, color: C.ink }}>{title ?? cfg.title}</div>
        <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded, letterSpacing: 1 }}>{count} film{count > 1 ? "s" : ""}</div>
        {(tag ?? cfg.tag) && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: C.burgundy, transform: "rotate(-3deg)" }}>{tag ?? cfg.tag}</div>}
        <div style={{ flex: 1 }} />
        <button onClick={() => acts.addRow(null, "end", kind)} title="Ajouter une ligne à la fin du rayon" style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 9.5, letterSpacing: 1, color: C.inkFaded, border: `1px dashed ${C.line}`, padding: "3px 8px" }}>
          + LIGNE
        </button>
        <button onClick={() => onCabinet(kind)} title="Poser un objet sur une planche" style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 9.5, letterSpacing: 1, color: C.inkFaded, border: `1px dashed ${C.line}`, padding: "3px 8px" }}>
          + DÉCOR
        </button>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); dnd.onShelfOver(kind); }}
        onDrop={(e) => { e.preventDefault(); dnd.onDrop(kind); }}
        style={{
          position: "relative",
          background: cfg.tint || "transparent",
          border: cfg.border ? `1px ${kind === "reserve" ? "solid" : "dashed"} ${cfg.border}${kind === "reserve" ? "" : "59"}` : "none",
          borderBottom: "none", borderRadius: cfg.border ? "3px 3px 0 0" : 0,
          padding: "10px 10px 0",
          transition: "background .15s ease",
        }}
      >
        {/* la teinte du thème, à l'intérieur du rayon SEULEMENT : repeindre
            le fond de la page se battrait avec le vignettage du papier */}
        {theme.tint && <div style={{ position: "absolute", inset: 0, background: theme.tint, mixBlendMode: "multiply", pointerEvents: "none", zIndex: 0 }} />}
        {rows.map((row, i) => (
          <ShelfRow
            key={row.id} row={row} kind={kind} films={films} theme={theme} dim={dim}
            dnd={dnd} acts={acts} onOpen={onOpen} onEditCat={onEditCat} onEditDecor={onEditDecor}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/* LE TIROIR — les mis de côté.

   En bas de page, ce rayon obligeait à traverser toute la collection pour
   y déposer un film ; et comme il grandissait avec le temps, il repoussait
   la collection vers le haut. Sur le côté, il est atteignable de partout et
   ne prend de la place que lorsqu'on l'ouvre. Fermé, il reste une cible :
   glisser un boîtier sur sa languette l'ouvre tout seul. */
const DRAWER_W = 250;

function ReserveDrawer({ shelf, count, open, setOpen, dnd, acts, films, theme, dim, onOpen, onEditCat, onEditDecor }) {
  const rows = shelf?.rows || [];
  const filled = rows.some((r) => r.items.length);

  return (
    <>
      {/* la languette, toujours accrochée au bord */}
      <button
        data-drawer-tab
        onClick={() => setOpen(!open)}
        onDragOver={(e) => { e.preventDefault(); dnd.onShelfOver("reserve"); if (!open) setOpen(true); }}
        onDrop={(e) => { e.preventDefault(); dnd.onDrop("reserve"); }}
        title={open ? "Fermer le tiroir" : "Ouvrir les films mis de côté"}
        style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", position: "fixed",
          right: open ? DRAWER_W : 0, top: "50%", transform: "translateY(-50%)", zIndex: 41,
          writingMode: "vertical-rl", padding: "20px 9px", borderRadius: "4px 0 0 4px",
          background: `linear-gradient(180deg, ${C.slate}, ${C.slate}cc)`,
          color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1.4,
          boxShadow: "-3px 3px 10px rgba(30,20,10,0.32)",
          transition: "right .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
        }}
      >
        {open ? "FERMER" : `MIS DE CÔTÉ${count ? ` · ${count}` : ""}`}
      </button>

      <div
        onDragOver={(e) => { e.preventDefault(); dnd.onShelfOver("reserve"); }}
        onDrop={(e) => { e.preventDefault(); dnd.onDrop("reserve"); }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: DRAWER_W, zIndex: 40,
          transform: open ? "none" : `translateX(${DRAWER_W}px)`,
          transition: "transform .26s cubic-bezier(.2,.8,.3,1), background .15s ease",
          background: C.paperDark,
          borderLeft: `1px solid ${C.line}`, boxShadow: open ? "-8px 0 24px rgba(30,20,10,0.22)" : "none",
          display: "flex", flexDirection: "column",
          // fermé, il ne doit intercepter ni clic ni survol
          visibility: open ? "visible" : "hidden",
        }}
      >
        <div style={{ padding: "18px 16px 10px", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 19, color: C.ink }}>Mis de côté</div>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded }}>{count}</div>
            <div style={{ flex: 1 }} />
            <button onClick={() => setOpen(false)} title="Fermer" style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}><X size={16} /></button>
          </div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: C.inkFaded, marginTop: 2 }}>gardés, pas jetés</div>
          <button onClick={() => acts.addRow(null, "end", "reserve")} title="Ajouter une ligne" style={{ all: "unset", cursor: "pointer", display: "inline-block", marginTop: 8, fontFamily: "'Special Elite', monospace", fontSize: 9.5, letterSpacing: 1, color: C.inkFaded, border: `1px dashed ${C.line}`, padding: "3px 8px" }}>
            + LIGNE
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 4px", alignContent: "flex-start" }}>
          {!filled ? (
            <div style={{ color: C.inkFaded, fontStyle: "italic", fontSize: 13, lineHeight: 1.6, padding: "0 8px" }}>
              Rien de côté. Glissez ici un film que vous ne voulez plus voir sur le mur — il reste entier, avec sa note et ses captures.
            </div>
          ) : rows.map((row, i) => (
            <ShelfRow
              key={row.id} row={row} kind="reserve" films={films} theme={theme} dim={dim}
              dnd={dnd} acts={acts} onOpen={onOpen} onEditCat={onEditCat} onEditDecor={onEditDecor}
              isLast={i === rows.length - 1}
              /* Dans un tiroir de 250 px, le réglage par ligne n'a rien à
                 régler : la largeur décide. La rangée y va donc nue, ce
                 qui rend les 26 px de gouttière aux boîtiers. */
              bare capMax={2}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* Le boîtier qu'on ouvre. Aperçu seulement : le dossier complet reste
   la fiche, on y va d'un clic depuis ici. */
function CasePreview({ film, onClose, onOpenFile }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = film.title.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,15,10,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div data-case onClick={(e) => e.stopPropagation()} style={{ width: "min(760px, 100%)", perspective: 1400, animation: "caseIn .3s ease both" }}>
        <div style={{ position: "relative", display: "flex", background: C.card, border: `1px solid ${C.line}`, minHeight: 330, boxShadow: "6px 14px 40px rgba(0,0,0,0.42)", overflow: "hidden" }}>
          <button onClick={onClose} style={{ all: "unset", position: "absolute", top: 10, right: 12, zIndex: 9, cursor: "pointer", color: C.inkFaded }}><X size={18} /></button>
          {/* le rabat, qui s'ouvre vers la gauche */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: C.paperDark, borderRight: `1px solid ${C.line}`, transformOrigin: "left center", backfaceVisibility: "hidden", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", animation: "openLid .78s cubic-bezier(.22,.9,.25,1) both" }}>
            <span style={{ transform: "rotate(-90deg)", fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: "0.2em", color: C.inkFaded, whiteSpace: "nowrap" }}>N° {fileNoOf(film.id)}</span>
          </div>
          <div style={{ width: 210, flexShrink: 0, background: C.paperDark, display: "flex", alignItems: "center", padding: 16 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "2 / 3", border: "1px solid rgba(43,38,32,0.3)", boxShadow: "2px 3px 0 rgba(43,38,32,0.18)", animation: "slideOut .7s .25s cubic-bezier(.2,.85,.3,1) both" }}>
              <PosterArt film={film} height={300} initials={initials} plain />
            </div>
          </div>
          <div style={{ flex: 1, padding: "24px 28px", animation: "sheetIn .5s .45s both" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: C.ink }}>{film.title}</div>
            <div style={{ fontFamily: "'Lora', serif", fontStyle: "italic", fontSize: 13.5, color: C.inkFaded, marginTop: 2 }}>
              {film.director || "anonyme"} · {film.year || "s.d."}
            </div>
            {film.status !== "watchlist" && <div style={{ marginTop: 8 }}><InkStars value={film.rating || 0} size={16} /></div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
              {(film.genres || []).map((g) => <span key={g} style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.line}`, color: C.inkFaded, padding: "3px 7px" }}>{g}</span>)}
              {film.chevet && <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.burgundy}`, color: C.burgundy, padding: "3px 7px" }}>FILM DE CHEVET</span>}
              {film.archived && <span style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, border: `1px solid ${C.slate}`, color: C.slate, padding: "3px 7px" }}>MIS DE CÔTÉ</span>}
            </div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 14, lineHeight: 1.65, color: C.ink, marginTop: 14, maxHeight: 120, overflow: "hidden" }}>
              {film.review?.trim()
                ? film.review.replace(/\[img:\d+\]/g, "").slice(0, 260)
                : <span style={{ fontStyle: "italic", color: C.inkFaded }}>Pas encore de note. Le boîtier attend son feuillet.</span>}
            </div>
            <button onClick={() => onOpenFile(film.id)} style={{ all: "unset", cursor: "pointer", marginTop: 18, padding: "9px 16px", background: C.burgundy, color: C.card, fontFamily: "'Special Elite', monospace", fontSize: 11, letterSpacing: 1 }}>
              OUVRIR LE DOSSIER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Le rangement à la main. Déposer écrit un `order` sur chaque boîtier du
   rayon d'arrivée : sans numéro stable, l'ordre repartirait au tri par
   défaut au prochain rendu. */
/* Le cabinet de curiosités : ce qu'on peut poser sur une planche. Chaque
   motif s'en tire au glisser — et ce glissement-là ne DÉPLACE rien, il
   CRÉE : l'objet n'existe pas encore quand on l'empoigne. */
function DecorCabinet({ kind, onDragStart, onDragEnd, onClose }) {
  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      <div style={{
        position: "fixed", right: 40, top: 120, zIndex: 45, width: 240, padding: "12px 14px",
        background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 8px 20px rgba(30,20,10,0.34)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>CABINET DE CURIOSITÉS</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}><X size={13} /></button>
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: C.inkFaded, marginBottom: 8 }}>
          glissez un objet sur une planche
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DECOR_TYPES.map((d) => {
            const Draw = d.draw, Icon = d.icon;
            return (
              <div
                key={d.key}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "copy"; onDragStart(d.key, e.currentTarget); }}
                onDragEnd={onDragEnd}
                title={d.label}
                style={{
                  width: 46, height: 46, cursor: "grab", flexShrink: 0, overflow: "hidden",
                  border: `1px solid ${C.line}`, background: C.paper,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {Icon ? <Icon size={20} color={C.inkFaded} />
                      : <Draw color={C.ochre} width={40} w={40} style={{ position: "relative", width: 40, height: 40 }} />}
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 14, color: C.inkFaded, marginTop: 8 }}>
          rayon visé : {SHELF_KIND[kind]?.title || kind}
        </div>
      </div>
    </>
  );
}

/* Le petit panneau d'un objet posé — couleur, taille, retrait. Sert aux
   catégories comme aux décors : ce sont les deux seules choses de
   l'étagère dont on choisit la teinte. */
function ItemPalette({ title, color, size, onColor, onSize, onRemove, onClose, removeLabel }) {
  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 44 }} />
      <div style={{
        position: "fixed", right: 40, top: 120, zIndex: 45, width: 224, padding: "12px 14px",
        background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 8px 20px rgba(30,20,10,0.34)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>{title}</div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}><X size={13} /></button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {CAT_KEYS.map((k) => (
            <button key={k} onClick={() => onColor(k)} title={k} style={{
              all: "unset", cursor: "pointer", width: 22, height: 22, borderRadius: "50%",
              background: CAT_COLORS[k],
              border: color === k ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
              transform: `rotate(${(hash(k) % 5) - 2}deg)`,
            }} />
          ))}
        </div>

        {onSize && (
          <>
            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 8.5, letterSpacing: 1, color: C.inkFaded, margin: "12px 0 4px" }}>TAILLE</div>
            <div style={{ display: "flex" }}>
              {DECOR_SIZES.map(([l, v], i) => (
                <button key={l} onClick={() => onSize(v)} style={{
                  all: "unset", cursor: "pointer", padding: "3px 12px", fontFamily: "'Special Elite', monospace", fontSize: 10,
                  background: size === v ? C.ink : "transparent", color: size === v ? C.card : C.inkFaded,
                  border: `1px solid ${size === v ? C.ink : C.line}`, marginLeft: i === 0 ? 0 : -1,
                }}>{l}</button>
              ))}
            </div>
          </>
        )}

        <button onClick={onRemove} style={{
          all: "unset", cursor: "pointer", display: "block", marginTop: 14,
          fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.burgundy,
        }}>{removeLabel}</button>
      </div>
    </>
  );
}

/* L'ÉTAGÈRE — le rangement à la main, et rien d'autre.

   Il n'y a plus de « mode manuel » : la vue EST l'agencement. Le tri n'a
   pas disparu, il a changé de nature — c'est un geste qu'on donne
   (« ranger par note »), et non plus un état qui se battrait avec les
   catégories. */
function ShelfBoard({ films, doc, onDoc, onOpen, onUpdateMany, dimSet }) {
  /* Un glissement ne change AUCUN état React. C'était le dernier retard
     visible : `setDragId` au départ du glissement re-rendait le rayon, ce
     qui salissait la mise en page — et le premier `getBoundingClientRect`
     du premier survol devait alors la recalculer entièrement avant que le
     repère puisse s'afficher. D'où un trait qui tardait à apparaître.

     Tout ce qui bouge pendant un glissement est donc écrit à la main : le
     boîtier pâli, le repère, les voisins écartés, les cibles qui
     s'éclairent, et l'attribut `data-dragging` du document. */
  const dragRef = useRef(null);          // { type, id, node, create? }
  const overRef = useRef({});            // { kind, rowId, catId, overId, side, afterRowId }
  const markRef = useRef(null);          // le repère de dépôt, hors React
  const spreadRef = useRef([]);          // les couches écartées, à remettre d'aplomb
  const litRef = useRef(null);           // la cible actuellement éclairée
  const [preview, setPreview] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [cabinet, setCabinet] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [editDecor, setEditDecor] = useState(null);

  const filmsById = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);

  /* La vue affichée est la vue enregistrée RAMENÉE à la collection réelle :
     films disparus retirés, films neufs recueillis dans la rangée
     d'arrivée. Purement au rendu — on n'écrit rien tant que l'utilisateur
     n'a pas lui-même rangé quelque chose. */
  const view = useMemo(() => (doc ? reconcileView(doc, films) : null), [doc, films]);
  const theme = themeOf(view?.theme);

  const dim = useCallback((f) => !!dimSet && !dimSet.has(f.id), [dimSet]);

  const acts = useMemo(() => ({
    setRow: (id, patch) => onDoc(patchRow(view, id, patch)),
    addRow: (refId, where, kind) => onDoc(addRow(view, kind || shelfKindOfRow(view, refId), refId, where)),
    removeRow: (id) => onDoc(removeRow(view, id)),
    clearRow: (id) => onDoc(clearRow(view, id)),
    addCat: (rowId) => onDoc(addCat(view, rowId, makeCat({ color: CAT_KEYS[0] }))),
    setCat: (id, patch) => onDoc(patchCat(view, id, patch)),
    removeCat: (id) => onDoc(removeCat(view, id)),
    setDecor: (id, patch) => onDoc(patchDecor(view, id, patch)),
    removeDecor: (id) => onDoc(removeDecor(view, id)),
  }), [view, onDoc]);

  const hideMark = () => { if (markRef.current) markRef.current.style.opacity = "0"; };

  /* Poser le repère.

     Une fois posé, il n'a plus qu'à glisser d'une fente à l'autre : on
     écrit le `transform`, la transition de la feuille de styles fait le
     reste, et il file d'un intervalle au suivant au lieu de sauter.

     La PREMIÈRE pose est le cas délicat. Le repère est un élément unique
     qui vit dans la page en permanence : il porte encore la position du
     glissement d'avant. Le laisser glisser depuis là, c'est un trait qui
     traverse l'étagère en biais avant de se poser. On coupe donc la
     transition, on l'installe un peu au-dessus de sa place et un peu
     écrasé, on force le navigateur à entériner cet état de départ, et
     seulement alors on rend la transition et on vise la place juste : il
     redescend de ses sept pixels en se dépliant, ce qui ressemble à
     quelque chose qu'on dépose plutôt qu'à quelque chose qui s'allume.

     C'est la lecture de rectangle qui force cette prise en compte, et
     c'est délibérément elle plutôt qu'une attente de trame. Un double
     `requestAnimationFrame` ferait le même travail sans rien coûter en
     mise en page — mais il ferait dépendre l'apparition du repère de la
     bonne volonté des trames PENDANT une boucle de glissement native, ce
     que tous les navigateurs ne garantissent pas ; là où les trames sont
     affamées, le repère ne naîtrait jamais. Le coût, lui, est nul à
     l'échelle de ce fichier : une seule fois par glissement, quand le
     survol d'un boîtier en lit déjà une à chaque événement.

     Les deux gestes n'ont pas la même vitesse, et c'est voulu. La dépose
     peut prendre son temps : elle n'a rien à rattraper, on la regarde.
     Le glissement d'une fente à l'autre, lui, court après la souris — au
     même tempo il traînerait derrière elle. D'où une durée longue écrite
     en ligne pour la seule pose, que le premier déplacement efface pour
     retomber sur le tempo vif de la feuille de styles. */
  const SETTLE = "transform .36s cubic-bezier(.16,.86,.26,1), opacity .3s ease-out";

  /* `rot` : entre deux RANGÉES, le repère se couche. C'est le même
     élément et le même dessin — seule la chaîne de transformation
     change, donc rien de neuf à peindre. */
  const placeMark = (x, y, rot = 0) => {
    const m = markRef.current;
    if (!m) return;
    const turn = rot ? ` rotate(${rot}deg)` : "";
    const at = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)${turn}`;
    if (m.style.opacity === "1") {
      if (m.style.transition) m.style.transition = "";   // la pose est finie, on reprend le pas vif
      m.style.transform = at;
      return;
    }

    m.style.transition = "none";
    m.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y) - 9}px, 0)${turn} scaleY(0.86)`;
    m.getBoundingClientRect();
    m.style.transition = SETTLE;
    m.style.transform = at;
    m.style.opacity = "1";
  };

  /* Les deux voisins du point de dépôt s'écartent pour faire la place :
     c'est le geste des deux doigts qui ouvrent une rangée de boîtiers
     avant d'y glisser le suivant. Ils ne glissent pas à plat — ils
     BASCULENT, pivotant sur leur pied comme des boîtiers debout qu'on
     couche l'un vers la gauche, l'autre vers la droite. C'est l'idiome
     de toute la page : le survol d'un boîtier le fait déjà se pencher.

     Comme le repère, cela s'écrit à la main sur les nœuds — un `setState`
     ici rendrait à nouveau tout le rayon à chaque frémissement de souris,
     ce que toute cette partie s'emploie à éviter.

     Le geste bascule une COUCHE À L'INTÉRIEUR de l'enveloppe, jamais
     l'enveloppe elle-même, et c'est toute la différence entre un
     écartement et un tremblement.

     L'enveloppe est la cible de dépôt. La faire basculer, c'était
     déplacer la cible sous le curseur : les deux voisins s'écartant de
     sept pixels chacun, un trou de quatorze s'ouvrait entre eux — juste
     là où la main visait. Le curseur y tombait, ne survolait plus aucun
     boîtier, l'événement retombait sur la rangée qui rappelait tout le
     monde à sa place, le curseur se retrouvait sur le boîtier, qui
     rouvrait le trou. Vingt fois par seconde. Le geste se mordait la
     queue parce qu'il effaçait sa propre condition.

     Les cibles sont donc fixes pour toute la durée du glissement : elles
     pavent la rangée et rien ne les bouge. Seule l'image bascule. C'est
     aussi ce qui permet de mesurer les rectangles au repos sans avoir à
     défalquer quoi que ce soit — l'écartement ne les touche plus. */
  const SPREAD = 7, TILT = 1.4;

  /* La couche qui bascule, sous une enveloppe donnée. */
  const leanLayer = (wrap) => wrap?.querySelector(":scope > [data-lean]") || null;

  const clearSpread = () => {
    spreadRef.current.forEach((node) => { node.style.transform = ""; });
    spreadRef.current = [];
  };

  const setSpread = (left, right) => {
    clearSpread();
    const next = [];
    [[left, -1], [right, 1]].forEach(([wrap, dir]) => {
      const layer = leanLayer(wrap);
      if (!layer) return;
      layer.style.transform = `translateX(${dir * SPREAD}px) rotate(${dir * TILT}deg)`;
      next.push(layer);
    });
    spreadRef.current = next;
  };

  /* Le voisin immédiat. Aux bords d'une catégorie il n'y a PAS de frère :
     le boîtier suivant est dehors, un cran plus haut dans l'arbre. On
     remonte alors jusqu'à la boîte elle-même et on prend son voisin à
     elle — la catégorie s'écarte d'un bloc, et c'est exactement ce qu'on
     veut voir : la boîte s'ouvre pour accueillir. */
  const neighbour = (wrap, dir) => {
    const sib = dir < 0 ? wrap.previousElementSibling : wrap.nextElementSibling;
    if (sib && sib.hasAttribute("data-shelf-item")) return sib;
    const box = wrap.parentElement?.closest("[data-shelf-item]");
    if (!box) return null;
    const out = dir < 0 ? box.previousElementSibling : box.nextElementSibling;
    return out && out.hasAttribute("data-shelf-item") ? out : null;
  };

  /* Éclairer une cible, et une seule. En attribut plutôt qu'en état : les
     règles vivent dans la feuille de styles, et React ne sait rien de ce
     qui s'allume pendant qu'on glisse. */
  const light = (node, attr) => {
    if (litRef.current === node) return;
    if (litRef.current) {
      delete litRef.current.dataset.catOver;
      delete litRef.current.dataset.rowOver;
      delete litRef.current.dataset.seamOver;
    }
    litRef.current = node;
    if (node) node.dataset[attr] = "1";
  };

  const reset = useCallback(() => {
    const d = dragRef.current;
    if (d?.node && !d.create) d.node.style.opacity = "";
    dragRef.current = null; overRef.current = {};
    hideMark();
    clearSpread();
    light(null);
    delete document.documentElement.dataset.dragging;
  }, []);

  const onDragStart = useCallback((type, id, node) => {
    dragRef.current = { type, id, node };
    if (node) node.style.opacity = "0.35";     // le boîtier soulevé, sans passer par React
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* Sortir un décor du cabinet, c'est le FAIRE, pas le déplacer : il
     n'existe nulle part tant qu'on ne l'a pas lâché. */
  const onDecorDragStart = useCallback((motif, node) => {
    dragRef.current = { type: "decor", id: null, node, create: makeDecor({ motif }) };
    document.documentElement.dataset.dragging = "1";
  }, []);

  /* Une boîte ne contient que des films — `moveItem` le refuse net. Le
     repère ne doit donc jamais INVITER autre chose à y entrer : une boîte
     ou un décor qu'on promène au-dessus d'une catégorie voyait la fente
     s'ouvrir devant lui, et le lâcher ne faisait rien. Un dépôt qui
     s'annonce et n'arrive pas est pire que pas de cible du tout. Ce qui
     ne peut pas entrer se range donc À CÔTÉ de la boîte. */
  const goesInside = (drag) => drag.type === "film";

  /* Viser la fente avant ou après un objet du rayon.

     `wrap` est toujours une enveloppe [data-shelf-item] : elle porte
     l'écart qui suit l'objet, jamais l'objet seul. On retire donc cet
     écart pour retrouver la tranche — sinon le partage en deux moitiés se
     ferait autour d'un milieu décalé, et le repère hésiterait sur le bord
     au lieu de trancher.

     Ce gestionnaire ne touche pas à l'état React : il déplace un unique
     élément à la main. Faire passer le repère par un `setState`, c'était
     redemander à React de reconstruire les cent boîtiers du rayon à chaque
     frimousse de la souris — même mémoïsés, cent comparaisons de props par
     événement, soixante fois par seconde. */
  const aimBeside = (wrap, clientX, ctx) => {
    const id = wrap.dataset.shelfItem;
    /* Le rectangle d'une enveloppe est toujours celui du repos :
       l'écartement bascule une couche à l'intérieur d'elle et ne la
       déplace pas. Rien à défalquer, donc, et surtout rien qui puisse se
       mettre à osciller au gré de sa propre animation. */
    const r = wrap.getBoundingClientRect();
    const left = r.left, right = r.right - GAP_X;
    const o = overRef.current;

    /* Le milieu du boîtier est une charnière, et une charnière franche
       claque. À son aplomb, le moindre tremblement de la main renvoyait
       le repère d'un bord à l'autre — deux fentes distantes de cent
       pixels, désignées l'une après l'autre par un curseur qui n'a pas
       bougé d'un cheveu, et les voisins qui s'écartaient dans un sens
       puis dans l'autre à chaque aller.

       On ne change donc d'avis qu'en dépassant FRANCHEMENT le milieu, et
       seulement quand on tenait déjà ce boîtier : la bande morte ne
       s'applique pas au premier survol, où il n'y a pas d'avis à garder
       et où le partage en deux moitiés est le bon. */
    const HYST = 6;
    const mid = (left + right) / 2;
    const held = o.overId === id ? o.side : null;
    const s = held
      ? (clientX < mid - HYST ? "before" : clientX > mid + HYST ? "after" : held)
      : (clientX < mid ? "before" : "after");

    if (o.overId === id && o.side === s && (o.catId || null) === (ctx.catId || null)) return;
    overRef.current = { ...ctx, overId: id, side: s };
    light(null);

    // le repère est centré dans l'espace qui s'ouvre entre les deux voisins
    placeMark((s === "before" ? left - 5 : right + 5) - MARK_W / 2,
              r.bottom - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2);
    if (s === "before") setSpread(neighbour(wrap, -1), wrap);
    else setSpread(wrap, neighbour(wrap, 1));
  };

  /* `dragover` tire en continu tant que la souris bouge, et même immobile. */
  const onBoxOver = useCallback((e, ctx) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    const wrap = e.currentTarget;
    /* Un boîtier DANS une boîte : si ce qu'on tire ne peut pas y entrer,
       on ne vise pas la fente qu'on a sous les yeux — on remonte à la
       boîte et on vise à côté d'elle, au niveau de la rangée. */
    if (ctx.catId && !goesInside(drag)) {
      const box = wrap.parentElement?.closest("[data-shelf-item]");
      if (box) aimBeside(box, e.clientX, { kind: ctx.kind, rowId: ctx.rowId, catId: null });
      return;
    }
    aimBeside(wrap, e.clientX, ctx);
  }, []);

  /* Le corps d'une catégorie : on entre DANS la boîte, à la suite. */
  const onCatOver = useCallback((e, ctx) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    const wrap = e.currentTarget;
    // une boîte ne se range pas dans une boîte : elle se range à côté
    if (!goesInside(drag)) {
      aimBeside(wrap, e.clientX, { kind: ctx.kind, rowId: ctx.rowId, catId: null });
      return;
    }
    const o = overRef.current;
    if (o.catId === ctx.catId && !o.overId) return;
    overRef.current = { ...ctx, overId: null, side: null };
    clearSpread();
    /* C'est le CARTON qui s'éclaire, pas l'enveloppe : celle-ci n'est
       qu'une zone, elle n'a ni papier ni bord à teinter. */
    const card = wrap.querySelector("[data-cat-card]");
    light(card, "catOver");
    const r = (card || wrap).getBoundingClientRect();
    // le pied des boîtiers d'une boîte est à un écart au-dessus de son bas
    placeMark(r.right - 5 - MARK_W / 2, r.bottom - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2);
  }, []);

  /* Le vide d'une rangée : à la suite de ce qui s'y trouve déjà. */
  const onRowOver = useCallback((e, ctx) => {
    if (!dragRef.current) return;
    e.preventDefault(); e.stopPropagation();
    const o = overRef.current;
    if (o.rowId === ctx.rowId && !o.overId && !o.catId && !o.afterRowId) return;
    overRef.current = { ...ctx, overId: null, side: null };
    clearSpread();
    light(e.currentTarget, "rowOver");
    const strip = e.currentTarget;
    const items = strip.querySelectorAll(":scope > [data-shelf-item]");
    const last = items[items.length - 1];
    const r = strip.getBoundingClientRect();
    /* `content-visibility` peut avoir sauté la mise en page du dernier
       boîtier ; un rectangle vide n'apprendrait rien, on se rabat alors
       sur le bord de la rangée. */
    const lr = last?.getBoundingClientRect();
    // les rectangles d'enveloppe portent l'écart : on le retire pour viser la tranche
    const x = lr && lr.width ? lr.right - GAP_X + 5 : r.left + GAP_Y;
    const y = (lr && lr.height ? lr.bottom : r.bottom) - GAP_Y - BOX_H - (MARK_H - BOX_H) / 2;
    placeMark(x - MARK_W / 2, y);
  }, []);

  /* La couture entre deux rangées : y lâcher quelque chose ouvre une
     rangée neuve. Le repère se couche pour le dire. */
  const onSeamOver = useCallback((e, kind, afterRowId) => {
    if (!dragRef.current) return;
    e.preventDefault(); e.stopPropagation();
    if (overRef.current.afterRowId === afterRowId) return;
    overRef.current = { kind, afterRowId, rowId: null, catId: null, overId: null };
    clearSpread();
    light(e.currentTarget, "seamOver");
    const r = e.currentTarget.getBoundingClientRect();
    placeMark(r.left + r.width / 2 - MARK_W / 2, r.top + r.height / 2 - MARK_H / 2, 90);
  }, []);

  const onShelfOver = useCallback(() => {}, []);   // le repère suffit à dire où l'on va

  /* Déposer.

     Il n'y a plus de numéros à distribuer ni de rayon à renuméroter : la
     place d'un boîtier est sa position dans un tableau, et l'écriture ne
     touche qu'un document — celui de la vue. Ce que le film garde en
     propre, ce sont ses drapeaux : ils disent SUR QUEL rayon il est, et
     ils valent pour toutes les vues à la fois. */
  const drop = (kind) => {
    const drag = dragRef.current;
    if (!drag || !view) return reset();
    const o = overRef.current;

    let target;
    if (o.kind === kind && o.afterRowId) {
      target = { kind, afterRowId: o.afterRowId };
    } else if (o.kind === kind && o.rowId) {
      target = { kind, rowId: o.rowId, catId: o.catId, overId: o.overId, side: o.side };
    } else {
      /* Lâché sur le fond d'un rayon, sur la languette du tiroir, ou sur
         un repère resté d'ailleurs : on ne sait pas OÙ, seulement sur
         quel rayon. La rangée d'arrivée est faite pour ça. */
      const rows = view.shelves[kind].rows;
      target = { kind, rowId: rows[rows.length - 1].id };
    }

    const next = moveItem(view, drag.create ? { create: drag.create } : { id: drag.id }, target);
    if (next !== view) onDoc(next);
    if (drag.type === "film") onUpdateMany({ [drag.id]: { ...SHELF_KIND[kind].patch } });
    reset();
  };

  const dnd = useMemo(() => ({
    onDragStart, onDragEnd: reset, onShelfOver, onBoxOver, onCatOver, onRowOver, onSeamOver, onDrop: drop,
  }), [onDragStart, reset, onShelfOver, onBoxOver, onCatOver, onRowOver, onSeamOver, drop]);

  const countOf = (kind) => films.filter(belongs[kind]).length;

  if (!view) return null;

  const cat = editCat && findCatIn(view, editCat);
  const decor = editDecor && findDecorIn(view, editDecor);

  const shared = {
    dnd, acts, films: filmsById, theme, dim, onOpen: setPreview,
    onEditCat: setEditCat, onEditDecor: setEditDecor,
  };

  return (
    /* `--mark-ink` : l'encre du repère vient du thème de la vue, par
       variable CSS. Un changement de thème n'a ainsi rien à demander à
       React au milieu d'un glissement. */
    <div onDragEnd={reset} style={{ "--mark-ink": theme.accent }}>
      {/* le repère de dépôt : un seul, déplacé à la main pendant le glissement */}
      <DropMark ref={markRef} />
      <Shelf kind="chevet" shelf={view.shelves.chevet} count={countOf("chevet")} onCabinet={setCabinet} {...shared} />
      <Shelf kind="main" shelf={view.shelves.main} count={countOf("main")} onCabinet={setCabinet} {...shared} />
      <ReserveDrawer
        shelf={view.shelves.reserve} count={countOf("reserve")}
        open={drawer} setOpen={setDrawer} {...shared}
      />
      {cabinet && (
        <DecorCabinet kind={cabinet} onClose={() => setCabinet(null)}
          onDragStart={onDecorDragStart} onDragEnd={reset} />
      )}
      {cat && (
        <ItemPalette
          title="CATÉGORIE" color={cat.color} removeLabel="défaire la catégorie"
          onColor={(k) => acts.setCat(cat.id, { color: k })}
          onRemove={() => { acts.removeCat(cat.id); setEditCat(null); }}
          onClose={() => setEditCat(null)}
        />
      )}
      {decor && (
        <ItemPalette
          title="OBJET" color={decor.color} size={decor.size} removeLabel="retirer l'objet"
          onColor={(k) => acts.setDecor(decor.id, { color: k })}
          onSize={(v) => acts.setDecor(decor.id, { size: v })}
          onRemove={() => { acts.removeDecor(decor.id); setEditDecor(null); }}
          onClose={() => setEditDecor(null)}
        />
      )}
      {preview && filmsById.get(preview) && (
        <CasePreview film={filmsById.get(preview)} onClose={() => setPreview(null)} onOpenFile={onOpen} />
      )}
    </div>
  );
}

/* Retrouver un meuble dans la vue — le panneau d'édition n'en connaît
   que l'identifiant. */
const shelfKindOfRow = (view, rowId) =>
  SHELF_KINDS.find((k) => view.shelves[k].rows.some((r) => r.id === rowId)) || "main";

const findCatIn = (view, id) => {
  for (const k of SHELF_KINDS)
    for (const row of view.shelves[k].rows)
      for (const it of row.items) if (it.t === "c" && it.id === id) return it;
  return null;
};

const findDecorIn = (view, id) => {
  for (const k of SHELF_KINDS)
    for (const row of view.shelves[k].rows)
      for (const it of row.items) if (it.t === "d" && it.id === id) return it;
  return null;
};

/* LE CHOIX DE LA VUE — une étagère peut être rangée de plusieurs façons.

   Les films sont les mêmes ; ce qui change, c'est la mise en scène :
   l'ordre, les catégories, la largeur des lignes, les objets posés et le
   bois des planches. On passe de l'une à l'autre sans rien déplacer. */
function ViewSwitcher({ views, active, onPick, onCreate, onCreateByDirector, onCopy, onDelete, onRename, onTheme }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(active?.name || "");
  useEffect(() => { setDraft(active?.name || ""); }, [active?.name]);
  if (!active) return null;

  const commit = () => { setRenaming(false); const v = draft.trim(); if (v && v !== active.name) onRename(v); else setDraft(active.name); };

  return (
    <div style={{ position: "relative" }}>
      <Label>Vue</Label>
      <button onClick={() => setOpen((o) => !o)} title="Changer de rangement" style={{
        all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        marginTop: 2, padding: "5px 12px", maxWidth: 190,
        fontFamily: "'Special Elite', monospace", fontSize: 10.5, color: C.ink,
        background: C.paperDark, border: `1px solid ${C.line}`, borderRadius: "3px 3px 0 0",
      }}>
        <Library size={12} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active.name}</span>
      </button>

      {open && (
        <>
          <div onClick={() => { setOpen(false); setRenaming(false); }} data-veil style={{ position: "fixed", inset: 0, zIndex: 42 }} />
          <div style={{
            position: "absolute", left: 0, top: "100%", zIndex: 43, width: 244, padding: "10px 12px",
            background: C.card, border: `1px solid ${C.line}`, boxShadow: "2px 6px 14px rgba(30,20,10,0.3)",
          }}>
            {views.map((v) => {
              const on = v.id === active.id;
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                  {on && renaming ? (
                    <input
                      autoFocus value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commit}
                      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(active.name); setRenaming(false); } }}
                      style={{ all: "unset", flex: 1, fontFamily: "'Lora', serif", fontSize: 13, color: C.ink, borderBottom: `1px solid ${C.line}` }}
                    />
                  ) : (
                    <button onClick={() => { onPick(v.id); setOpen(false); }} style={{
                      all: "unset", cursor: "pointer", flex: 1, fontFamily: "'Lora', serif", fontSize: 13,
                      color: on ? C.burgundy : C.ink, textDecoration: on ? "underline" : "none",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }} title={v.name}>{v.name}</button>
                  )}
                  {on && !renaming && (
                    <>
                      <button onClick={() => setRenaming(true)} title="Renommer" style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}><Paperclip size={11} /></button>
                      <button onClick={() => onCopy(v.id)} title="Dupliquer ce rangement" style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}><Plus size={12} /></button>
                      {views.length > 1 && (
                        <button onClick={() => onDelete(v.id)} title="Supprimer cette vue" style={{ all: "unset", cursor: "pointer", color: C.burgundy, display: "flex" }}><Trash2 size={11} /></button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}`, display: "flex", flexDirection: "column", gap: 3 }}>
              <button onClick={() => { onCreate(); setOpen(false); }} style={{
                all: "unset", cursor: "pointer",
                fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded,
              }}>+ NOUVELLE VUE</button>
              {/* Une étagère par cinéaste : une ligne et une boîte par
                  réalisateur. C'est une vue comme les autres une fois
                  posée — on la range ensuite à la main si l'on veut. */}
              <button onClick={() => { onCreateByDirector(); setOpen(false); }} title="Une ligne et une boîte par réalisateur" style={{
                all: "unset", cursor: "pointer",
                fontFamily: "'Special Elite', monospace", fontSize: 10, color: C.inkFaded,
              }}>+ PAR RÉALISATEUR</button>
            </div>

            <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 8.5, letterSpacing: 1, color: C.inkFaded, margin: "12px 0 5px" }}>BOIS DE L'ÉTAGÈRE</div>
            <div style={{ display: "flex", gap: 5 }}>
              {Object.entries(THEMES).map(([k, t]) => (
                <button key={k} onClick={() => onTheme(k)} title={t.label} style={{
                  all: "unset", cursor: "pointer", width: 26, height: 20,
                  background: `linear-gradient(${t.wood[0]}, ${t.wood[1]})`,
                  border: active.theme === k ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                }} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LibraryView({
  films, onOpen, wall = "watched", ui, setUi, onUpdateMany,
  shelfView, shelfViews, onShelfView, onPickView, onCreateView, onCreateDirectorView, onCopyView, onDeleteView,
}) {
  const cfg = WALLS[wall];
  /* Recherche, filtre et tri vivent dans App : ouvrir un film démonte cette
     vue, et un état local serait perdu au retour au mur. */
  const { q, genreFilter, sortBy, desc, grouped } = ui;
  const mode = ui.mode === "shelf" ? "shelf" : "wall";
  const set = (patch) => setUi({ ...ui, ...patch });
  const setQ = (v) => set({ q: v });
  const setGenreFilter = (v) => set({ genreFilter: v });
  const setGrouped = (fn) => set({ grouped: typeof fn === "function" ? fn(grouped) : fn });
  // recliquer le tri actif inverse simplement le sens
  const pickSort = (k) => set(k === sortBy ? { desc: !desc } : { sortBy: k, desc: true });

  const allGenres = useMemo(() => Array.from(new Set(films.flatMap((f) => f.genres || []))).sort(), [films]);

  /* Un film mis de côté n'a rien à faire sur le mur : c'est justement ce
     qu'on lui a demandé. Il reste visible sur l'étagère, dans son rayon. */
  const scope = useMemo(() => (mode === "shelf" ? films : films.filter((f) => !f.archived)), [films, mode]);
  const asideCount = useMemo(() => films.filter((f) => f.archived).length, [films]);

  /* Sur l'étagère, chercher n'est pas filtrer.

     Retirer les films qui ne correspondent pas démonterait l'agencement à
     chaque lettre tapée, et rendrait les rangées absurdes — une ligne de
     six qui n'en montre plus qu'un. On garde donc tout en place et on
     ÉTEINT ce qui ne répond pas : la collection reste lisible comme une
     étagère, et ce qu'on cherche s'y détache. */
  const matches = useCallback((f) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return f.title.toLowerCase().includes(s) || (f.director || "").toLowerCase().includes(s);
  }, [q]);

  const dimSet = useMemo(() => {
    if (mode !== "shelf" || (!q && !genreFilter)) return null;
    return new Set(scope.filter((f) => matches(f) && (!genreFilter || (f.genres || []).includes(genreFilter))).map((f) => f.id));
  }, [mode, q, genreFilter, scope, matches]);

  /* Ranger l'étagère d'un geste. Le tri n'est plus un état qui se battrait
     avec les catégories : c'est un verbe qui réécrit l'agencement une
     fois, puis s'efface. Les catégories et les objets posés gardent leur
     place ; seuls les films circulent. */
  const arrangeBy = (key) => {
    if (!shelfView) return;
    const by = new Map(films.map((f) => [f.id, f]));
    const cmp = (x, y) => {
      const a = by.get(x.id), b = by.get(y.id);
      if (!a || !b) return 0;
      return key === "title" ? a.title.localeCompare(b.title)
        : key === "director" ? (a.director || "zzz").localeCompare(b.director || "zzz") || a.title.localeCompare(b.title)
        : key === "year" ? (b.year || 0) - (a.year || 0)
        : key === "rating" ? (b.rating || 0) - (a.rating || 0)
        : (b.addedAt || 0) - (a.addedAt || 0);
    };
    let next = shelfView;
    for (const k of SHELF_KINDS) next = sortIntoRows(next, k, cmp);
    onShelfView(next);
  };

  const ARRANGE = [["title", "A–Z"], ["year", "année"], ["rating", "note"], ["director", "réalisateur"], ["added", "ajout"]];

  const filtered = useMemo(() => {
    let list = scope.filter((f) => {
      const mq = !q || f.title.toLowerCase().includes(q.toLowerCase()) || (f.director || "").toLowerCase().includes(q.toLowerCase());
      const mg = !genreFilter || (f.genres || []).includes(genreFilter);
      return mq && mg;
    });
    return [...list].sort((a, b) => {
      const cmp =
        // A–Z se lit dans l'ordre naturel : c'est `desc` qui l'inverse
        sortBy === "title" ? -a.title.localeCompare(b.title)
        : sortBy === "director" ? -((a.director || "zzz").localeCompare(b.director || "zzz") || a.title.localeCompare(b.title))
        : sortBy === "year" ? (b.year || 0) - (a.year || 0)
        : sortBy === "rating" ? (b.rating || 0) - (a.rating || 0)
        // les films jamais datés glissent en fin de liste plutôt qu'en tête
        : sortBy === "watched" ? (b.watchedAt || "").localeCompare(a.watchedAt || "")
        : (b.addedAt || 0) - (a.addedAt || 0);
      return desc ? cmp : -cmp;
    });
  }, [scope, q, genreFilter, sortBy, desc]);

  /* Le regroupement par réalisateur : une pile de fiches par cinéaste, les
     plus fréquentés d'abord — c'est là que se lisent les habitudes. */
  const groups = useMemo(() => {
    if (!grouped) return null;
    const by = new Map();
    for (const f of filtered) {
      const key = f.director?.trim() || "Réalisateur inconnu";
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(f);
    }
    return [...by.entries()].sort((a, b) =>
      b[1].length - a[1].length ||
      (a[0] === "Réalisateur inconnu" ? 1 : b[0] === "Réalisateur inconnu" ? -1 : a[0].localeCompare(b[0]))
    );
  }, [filtered, grouped]);

  return (
    <div style={{ padding: "34px 44px 60px", position: "relative", overflow: "hidden" }}>
      <CoffeeRing style={{ top: 10, right: 120 }} rotate={12} />
      <CoffeeRing style={{ bottom: 40, left: -30, width: 100, height: 100 }} rotate={-40} />
      <CoffeeRing style={{ top: 340, right: -40, width: 190, height: 190 }} rotate={70} />
      <TapeResidue style={{ top: 96, right: 260 }} />
      <TapeResidue style={{ bottom: 120, left: 180, opacity: 0.3 }} rotate={7} w={64} />
      <StampCorner text={`${cfg.stamp} · ${films.length}`} />
      <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 46, color: C.ink, position: "relative", zIndex: 2 }}>{cfg.title}</div>
      <InkUnderline width={cfg.underline} />
      <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, color: C.inkFaded, marginTop: 2, position: "relative", zIndex: 2 }}>{cfg.subtitle}</div>

      {/* Pas de `z-index` sur cette barre, et c'est délibéré.

          Elle en portait un — le même 2 que le reste du contenu, pour
          passer devant les taches de café. Mais un `z-index` sur un
          élément positionné ouvre un CONTEXTE D'EMPILEMENT, et tout ce
          qu'il contient s'y trouve enfermé : les 43 du menu des vues ne
          valaient plus qu'à l'intérieur de la barre, laquelle restait à 2
          parmi ses frères. L'étagère, elle aussi à 2 mais PLUS BAS dans le
          document, passait donc devant le bas du menu déroulant — juste
          là où se trouvent les pastilles de bois. Elles s'affichaient, et
          le clic allait au rayon derrière.

          Sans `z-index`, la barre n'enferme plus rien : le menu compare
          son 43 au 2 de l'étagère dans un contexte commun, et gagne. Les
          taches de café restent derrière sans qu'on ait à le demander —
          elles sont AVANT dans le document et ne captent aucun clic. */}
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end", marginTop: 26, marginBottom: 34, borderBottom: `1px dashed ${C.line}`, paddingBottom: 18, position: "relative" }}>
        <div style={{ minWidth: 200 }}>
          <Label>Chercher</Label>
          <input style={underlineInput} placeholder="un titre, un·e cinéaste…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <Label>Genre</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allGenres.length === 0 && <span style={{ color: C.inkFaded, fontSize: 13, fontStyle: "italic" }}>—</span>}
            {allGenres.map((g) => {
              // chaque genre porte sa propre encre — l'étiquetage n'a pas été fait le même jour
              const ink = [C.burgundy, C.cobalt, C.moss, C.vermillion, C.slate][Math.abs(hash(g)) % 5];
              const on = genreFilter === g;
              return (
                <button key={g} onClick={() => setGenreFilter(on ? "" : g)} style={{ all: "unset", cursor: "pointer", fontFamily: "'Special Elite', monospace", fontSize: 10.5, padding: "4px 11px", borderRadius: 14, border: `1px solid ${ink}`, color: on ? C.card : ink, background: on ? ink : "transparent", transform: `rotate(${(Math.abs(hash(g)) % 5) - 2}deg)`, boxShadow: on ? `1px 2px 4px ${ink}55` : "none", transition: "background .15s ease" }}>{g}</button>
              );
            })}
          </div>
        </div>
        <div>
          {/* Sur le mur, trier est un état. Sur l'étagère, l'agencement EST
              l'état : ranger devient un geste qu'on donne une fois. */}
          <Label>{mode === "shelf" ? "Ranger" : "Trier"}</Label>
          <div style={{ display: "flex", gap: 14, fontFamily: "'Special Elite', monospace", fontSize: 11 }}>
            {mode === "shelf"
              ? ARRANGE.map(([k, l]) => (
                  <span key={k} onClick={() => arrangeBy(k)} title="Réécrit l'agencement de cette vue" style={{ cursor: "pointer", color: C.inkFaded, borderBottom: `1px dashed ${C.line}` }}>{l}</span>
                ))
              : cfg.sorts.map(([k, l]) => (
                  <span key={k} onClick={() => pickSort(k)} title={sortBy === k ? "cliquer pour inverser" : ""} style={{ cursor: "pointer", color: sortBy === k ? C.burgundy : C.inkFaded, textDecoration: sortBy === k ? "underline" : "none" }}>
                    {l}{sortBy === k && <span style={{ marginLeft: 3 }}>{desc ? "↓" : "↑"}</span>}
                  </span>
                ))}
          </div>
        </div>
        <div>
          <Label>Présentation</Label>
          <div style={{ display: "flex", marginTop: 2 }}>
            {[{ k: "wall", l: "MUR", icon: LayoutGrid }, { k: "shelf", l: "ÉTAGÈRE", icon: Library }].map(({ k, l, icon: Icon }) => (
              <button key={k} onClick={() => set({ mode: k })} style={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                fontFamily: "'Special Elite', monospace", fontSize: 10.5,
                background: mode === k ? C.ink : "transparent", color: mode === k ? C.card : C.inkFaded,
                border: `1px solid ${mode === k ? C.ink : C.line}`, marginLeft: k === "shelf" ? -1 : 0,
              }}><Icon size={12} /> {l}</button>
            ))}
          </div>
        </div>
        {/* Le nombre de films par ligne ne se règle plus ici : il appartient
            à chaque rangée, dans sa gouttière. Ce qui se choisit à ce
            niveau, c'est la vue — l'étagère tout entière. */}
        {mode === "shelf" && (
          <ViewSwitcher
            views={shelfViews} active={shelfView}
            onPick={onPickView} onCreate={onCreateView} onCreateByDirector={onCreateDirectorView}
            onCopy={onCopyView} onDelete={onDeleteView}
            onRename={(name) => onShelfView({ ...shelfView, name })}
            onTheme={(theme) => onShelfView({ ...shelfView, theme })}
          />
        )}
        {mode === "wall" && <div>
          <Label>Classer</Label>
          <button
            onClick={() => setGrouped((g) => !g)}
            style={{
              all: "unset", cursor: "pointer", padding: "5px 12px", marginTop: 2,
              fontFamily: "'Special Elite', monospace", fontSize: 10.5,
              background: grouped ? C.pine : "transparent", color: grouped ? C.card : C.inkFaded,
              border: `1px solid ${grouped ? C.pine : C.line}`,
            }}
          >PAR RÉALISATEUR</button>
        </div>}
        {mode === "wall" && asideCount > 0 && (
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 18, color: C.inkFaded }}>
            <button onClick={() => set({ mode: "shelf" })} style={{ all: "unset", cursor: "pointer", borderBottom: `1px dashed ${C.line}` }}>
              {asideCount} film{asideCount > 1 ? "s" : ""} de côté — voir l'étagère
            </button>
          </div>
        )}
      </div>

      {mode === "shelf" ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {/* L'étagère reçoit la collection ENTIÈRE du mur, jamais la liste
              filtrée : c'est l'agencement qui commande l'ordre, et la
              recherche ne fait qu'éteindre ce qu'elle ne trouve pas. */}
          <ShelfBoard
            films={scope} doc={shelfView} onDoc={onShelfView}
            onOpen={onOpen} onUpdateMany={onUpdateMany} dimSet={dimSet}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.inkFaded, position: "relative", zIndex: 2 }}>
          <Pin size={26} color={C.line} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.ink, marginBottom: 6 }}>{films.length === 0 ? cfg.empty[0] : "Rien à afficher"}</div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19 }}>{films.length === 0 ? cfg.empty[1] : "Essayez une autre recherche."}</div>
        </div>
      ) : grouped ? (
        <div style={{ position: "relative", zIndex: 2 }}>
          {groups.map(([director, list]) => (
            <div key={director} style={{ marginBottom: 46 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 700, fontSize: 26, color: C.ink }}>{director}</div>
                <div style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, transform: "translateY(-6px)" }} />
                <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 11, color: C.inkFaded }}>{list.length} film{list.length > 1 ? "s" : ""}</div>
              </div>
              <FilmWall films={list} onOpen={onOpen} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 2 }}>
          <FilmWall films={filtered} onOpen={onOpen} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  const [films, setFilms] = useState([]);
  const [notes, setNotes] = useState([]);
  /* Les intercalaires ne sont plus du mobilier vivant : la migration les a
     versés dans les vues. On les garde en mémoire pour pouvoir refabriquer
     une vue depuis une vieille sauvegarde, et on ne les réécrit jamais. */
  const [dividers, setDividers] = useState([]);
  /* Le rangement de l'étagère : { byWall: { watched: [id…] }, docs: { id: vue } }.
     Un document par vue, chacun dans sa propre clé. */
  const [views, setViews] = useState({ byWall: { watched: [], watchlist: [] }, docs: {} });
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("library");
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // les fiches d'avant les champs status/watchedAt/tmdbId sont complétées ici
    const migrated = migrate(store.get("films", []));
    setFilms(migrated);
    store.set("films", migrated);
    setNotes(store.get("notebook-notes", []));
    const tabs = store.get("shelf-dividers", []);
    setDividers(tabs);
    /* La migration lit `order` et `status`, que `migrate` vient de
       normaliser : elle doit donc passer après, et sur les fiches
       migrées — pas sur ce qui sort du disque. */
    setViews(ensureViews({ films: migrated, dividers: tabs, wallPrefs: store.get("wall-prefs", {}) }));
    setLoaded(true);
  }, []);

  const saveFilms = (next) => { setFilms(next); store.set("films", next); };
  const saveNotes = (next) => { setNotes(next); store.set("notebook-notes", next); };

  /* ---- les vues ----------------------------------------------------
     Écrire une vue ne touche qu'à sa clé : le reste de la bibliothèque
     n'est pas re-sérialisé pour un boîtier déplacé. */
  /* Tous en `useCallback` : ce sont des gestes, jamais du rendu. Ils
     horodatent, et une fonction impure appelée pendant un rendu serait
     une faute — la règle vaut aussi pour le compilateur, qui la relève. */
  /* Le débordement est un invariant, pas un geste : toute écriture y
     passe. Sans quoi une rangée réglée à cinq garderait ses douze films
     et se replierait en accordéon sous une planche unique. */
  const commitView = useCallback((next) => {
    const stamped = { ...reflowView(next), updatedAt: Date.now() };
    setViews((s) => ({ ...s, docs: { ...s.docs, [stamped.id]: stamped } }));
    saveView(stamped);
  }, []);

  const addView = useCallback((wall, doc) => {
    setViews((s) => {
      const byWall = { ...s.byWall, [wall]: [...(s.byWall[wall] || []), doc.id] };
      saveViewIndex(byWall);
      return { byWall, docs: { ...s.docs, [doc.id]: doc } };
    });
    saveView(doc);
  }, []);

  const createView = useCallback((wall, name) => {
    const blank = makeView({ wall, name: name || "Nouvelle vue", now: Date.now() });
    /* Tout laisser dans le sas donnerait une étagère vide et un tas :
       une vue neuve arrive déjà rangée, en planches d'une dizaine. */
    const pool = films.filter((f) => (f.status === "watchlist") === (wall === "watchlist"));
    const doc = layoutView(blank, pool);
    addView(wall, doc);
    return doc.id;
  }, [addView, films]);

  /* L'étagère par cinéaste. Elle naît rangée — une ligne et une boîte par
     réalisateur — puis c'est une vue comme une autre : rien ne la refait
     dans son dos, et ce qu'on y déplace y reste. */
  const createDirectorView = useCallback((wall) => {
    const blank = makeView({ wall, name: "Par réalisateur", now: Date.now() });
    const pool = films.filter((f) => (f.status === "watchlist") === (wall === "watchlist"));
    const doc = layoutByDirector(blank, pool);
    addView(wall, doc);
    return doc.id;
  }, [addView, films]);

  const copyView = useCallback((id) => {
    const src = views.docs[id];
    if (!src) return null;
    const doc = duplicateView(src, { now: Date.now() });
    addView(src.wall, doc);
    return doc.id;
  }, [views.docs, addView]);

  /* Supprimer la dernière vue d'un mur laisserait l'étagère sans
     rangement du tout : on refuse plutôt que d'en refabriquer une. */
  const removeView = useCallback((id) => {
    const doc = views.docs[id];
    if (!doc || (views.byWall[doc.wall] || []).length <= 1) return false;
    setViews((s) => {
      const byWall = { ...s.byWall, [doc.wall]: s.byWall[doc.wall].filter((x) => x !== id) };
      const docs = { ...s.docs };
      delete docs[id];
      saveViewIndex(byWall);
      return { byWall, docs };
    });
    deleteViewKey(id);
    return true;
  }, [views]);

  const addFilm = (film) => { saveFilms([film, ...films]); setShowModal(false); };
  const updateFilm = (film) => saveFilms(films.map((f) => (f.id === film.id ? film : f)));
  /* Ranger un boîtier renumérote tout un rayon : une écriture, pas trente. */
  const updateMany = (patches) => saveFilms(films.map((f) => (patches[f.id] ? { ...f, ...patches[f.id] } : f)));
  const deleteFilm = (id) => {
    const next = films.filter((f) => f.id !== id);
    saveFilms(next);
    pruneOrphans(next).catch(console.error);  // l'affiche part avec la fiche
    setView("library"); setSelectedId(null);
  };

  /* Relier deux fiches, c'est écrire des deux côtés : ouvrir l'un ou l'autre
     doit montrer le même fil. Les deux moitiés partagent un pairId, ce qui
     permet de les défaire ensemble. */
  const linkFilms = (fromId, toId, note = "") => {
    const a = films.find((f) => f.id === fromId);
    const b = films.find((f) => f.id === toId);
    if (!a || !b || a.id === b.id) return;
    if ((a.linkedWorks || []).some((w) => w.filmId === b.id)) return;  // déjà relié

    const pairId = uid();
    const card = (target) => ({
      id: uid(), pairId, type: "film", filmId: target.id,
      title: target.title, creator: target.director || "", note: note.trim(),
    });
    saveFilms(films.map((f) =>
      f.id === a.id ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(b)] }
      : f.id === b.id ? { ...f, linkedWorks: [...(f.linkedWorks || []), card(a)] }
      : f
    ));
  };

  /* Défaire un lien : la moitié réciproque part avec lui. */
  const removeLink = (ownerId, workId) => {
    const owner = films.find((f) => f.id === ownerId);
    const work = (owner?.linkedWorks || []).find((w) => w.id === workId);
    if (!work) return;
    saveFilms(films.map((f) => {
      if (f.id === ownerId) return { ...f, linkedWorks: f.linkedWorks.filter((w) => w.id !== workId) };
      if (work.pairId && f.id === work.filmId) return { ...f, linkedWorks: (f.linkedWorks || []).filter((w) => w.pairId !== work.pairId) };
      return f;
    }));
  };

  /* Restaurer, c'est remplacer l'état entier — y compris le rangement.
     Une sauvegarde d'avant les vues (v ≤ 3) n'en contient pas : on les
     refabrique alors depuis ses intercalaires, ce à quoi sert `force`. */
  const restoreBackup = ({ films: f, notes: n, dividers: d, views: v }) => {
    const migrated = migrate(f);
    saveFilms(migrated);
    if (n?.length) saveNotes(n);
    const tabs = d || [];
    setDividers(tabs);
    store.set("shelf-dividers", tabs);

    if (v?.byWall && v?.docs) {
      for (const id of Object.keys(v.docs)) store.set(viewKey(id), v.docs[id]);
      saveViewIndex(v.byWall);
      setViews({ byWall: v.byWall, docs: v.docs });
    } else {
      for (const wall of Object.keys(views.byWall)) for (const id of views.byWall[wall]) deleteViewKey(id);
      setViews(ensureViews({ films: migrated, dividers: tabs, wallPrefs: store.get("wall-prefs", {}), force: true }));
    }
    return migrated.length;
  };

  /* Applique le diff déjà validé à l'écran : les mises à jour sont fusionnées
     champ par champ, jamais un remplacement de fiche. */
  const importFilms = ({ toCreate, toUpdate }) => {
    const patches = new Map(toUpdate.map(({ film, changes }) => [film.id, changes]));
    const merged = films.map((f) => (patches.has(f.id) ? { ...f, ...patches.get(f.id) } : f));
    saveFilms([...toCreate, ...merged]);
  };

  const selectedFilm = films.find((f) => f.id === selectedId);
  // l'état des deux murs survit à l'ouverture d'une fiche
  /* Recherche et filtre sont de l'humeur du moment ; la présentation, le tri
     et la largeur des rayons sont un rangement. Ranger son étagère puis la
     retrouver en désordre au rechargement, ce serait ne pas l'avoir rangée —
     ces trois-là sont donc gardés sur le disque. */
  const [wallUi, setWallUi] = useState(() => {
    const saved = store.get("wall-prefs", {});
    const one = (wall) => ({
      q: "", genreFilter: "", grouped: false,
      sortBy: saved[wall]?.sortBy || WALLS[wall].defaultSort,
      desc: saved[wall]?.desc ?? true,
      mode: saved[wall]?.mode || "wall",
      /* La largeur des rayons n'est plus un réglage de mur : elle
         appartient à chaque rangée, dans la vue. Ne survit ici que la
         vue qu'on regardait. */
      viewId: saved[wall]?.viewId || null,
    });
    return { watched: one("watched"), watchlist: one("watchlist") };
  });
  const setUiFor = (wall) => (next) => setWallUi((s) => {
    const merged = { ...s, [wall]: next };
    const keep = ({ mode, sortBy, desc, viewId }) => ({ mode, sortBy, desc, viewId });
    store.set("wall-prefs", { watched: keep(merged.watched), watchlist: keep(merged.watchlist) });
    return merged;
  });

  /* La vue active d'un mur : celle qu'on regardait, ou la première —
     l'identifiant gardé sur le disque peut désigner une vue supprimée
     depuis, ou d'un autre navigateur. */
  const activeViewId = (wall) => {
    const list = views.byWall[wall] || [];
    const kept = wallUi[wall].viewId;
    return kept && list.includes(kept) ? kept : list[0] || null;
  };

  /* Tout ce dont l'étagère d'un mur a besoin, rassemblé en un endroit :
     la vue qu'elle montre, la liste de celles entre lesquelles basculer,
     et les gestes qui les font naître, se renommer ou disparaître. */
  const viewProps = (wall) => {
    const id = activeViewId(wall);
    return {
      shelfView: id ? views.docs[id] : null,
      shelfViews: (views.byWall[wall] || []).map((x) => views.docs[x]).filter(Boolean),
      onShelfView: commitView,
      onPickView: (next) => setUiFor(wall)({ ...wallUi[wall], viewId: next }),
      onCreateView: (name) => setUiFor(wall)({ ...wallUi[wall], viewId: createView(wall, name) }),
      onCreateDirectorView: () => setUiFor(wall)({ ...wallUi[wall], viewId: createDirectorView(wall) }),
      onCopyView: (from) => { const next = copyView(from); if (next) setUiFor(wall)({ ...wallUi[wall], viewId: next }); },
      onDeleteView: removeView,
    };
  };

  const watched = useMemo(() => films.filter((f) => f.status !== "watchlist"), [films]);
  const watchlist = useMemo(() => films.filter((f) => f.status === "watchlist"), [films]);
  // la carte du ciel ne relie que ce qui est en rayon
  const constellationFilms = useMemo(() => watched.filter((f) => !f.archived), [watched]);
  // le mur d'où l'on vient : « je l'ai vu » depuis la watchlist doit ramener au bon endroit
  const backView = selectedFilm?.status === "watchlist" ? "watchlist" : "library";

  if (!loaded) {
    return (
      <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaded, fontFamily: "'Caveat', cursive", fontSize: 22 }}>
        <style>{FONT_IMPORT}</style>
        ouverture du classeur…
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", position: "relative",
      // le kraft n'est pas uniforme : des nappes plus claires là où la lumière tombe
      background: `
        radial-gradient(circle at 18% 12%, #F5EDD8 0%, transparent 45%),
        radial-gradient(circle at 82% 68%, #F2E9D2 0%, transparent 40%),
        radial-gradient(circle at 55% 100%, #E5D6B4 0%, transparent 50%),
        ${C.paper}`,
    }}>
      <style>{FONT_IMPORT}</style>
      <PaperGrain />
      <FolderTabs view={view} setView={(v) => { setView(v); setSelectedId(null); }} onAdd={() => setShowModal(true)} />
      <div style={{ flex: 1, position: "relative", zIndex: 2 }}>
        {view === "library" && !selectedId && <LibraryView wall="watched" films={watched} ui={wallUi.watched} setUi={setUiFor("watched")} onUpdateMany={updateMany} {...viewProps("watched")} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "watchlist" && !selectedId && <LibraryView wall="watchlist" films={watchlist} ui={wallUi.watchlist} setUi={setUiFor("watchlist")} onUpdateMany={updateMany} {...viewProps("watchlist")} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "detail" && selectedFilm && (
          <DetailView
            film={selectedFilm}
            films={films}
            onBack={() => { setView(backView); setSelectedId(null); }}
            onUpdate={updateFilm}
            onDelete={deleteFilm}
            onLinkFilm={linkFilms}
            onRemoveLink={removeLink}
            onOpen={(id) => setSelectedId(id)}
          />
        )}
        {view === "reco" && <RecoView films={films} onAddToWatchlist={addFilm} />}
        {view === "constellation" && <ConstellationView films={constellationFilms} onOpen={(id) => { setSelectedId(id); setView("detail"); }} />}
        {view === "notebook" && <NotebookView notes={notes} onAdd={(n) => saveNotes([n, ...notes])} onUpdate={(n) => saveNotes(notes.map((x) => (x.id === n.id ? n : x)))} onDelete={(id) => saveNotes(notes.filter((x) => x.id !== id))} />}
        {view === "import" && <ImportView onImport={importFilms} films={films} notes={notes} dividers={dividers} views={views} onRestore={restoreBackup} />}
      </div>
      {showModal && <FilmModal onClose={() => setShowModal(false)} onSave={addFilm} />}
    </div>
  );
}
