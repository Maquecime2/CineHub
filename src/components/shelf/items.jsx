/* Les objets qu'on pose sur une planche : le repère de dépôt, le boîtier,
   le décor et la catégorie. */
import React, { useEffect, useMemo, useState } from "react";
import { C } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { tiltOf } from "../../domain/seeded";
import { PosterArt } from "../film/PosterArt";
import { PushPin } from "../atmosphere";
import { Palette } from "lucide-react";
import {
  BOX_W,
  BOX_H,
  GAP_X,
  GAP_Y,
  MARK_W,
  MARK_H,
  DROP_MARK_STYLE,
  MARK_PATHS,
  MARK_INK,
  decorSpec,
  WALL_GRIP,
  wallBoxOf,
  catInk,
} from "./constants";

/* L'IMAGE QU'ON EMPORTE SOUS LE CURSEUR.

   Le navigateur fabrique tout seul l'aperçu d'un glissement en
   photographiant l'élément saisi. Mais le boîtier vit dans une enveloppe
   en `content-visibility: auto` : la photo prise là-dedans déborde de
   l'élément et rend une bande entière — on croit tirer la rangée alors
   qu'on ne déplace bien qu'un film.

   On lui donne donc la photo à emporter : un CALQUE du boîtier, posé
   hors écran le temps du cliché, sans l'inclinaison ni la transparence
   que le glissement lui applique par ailleurs. Il est saisi à l'endroit
   exact où la main l'a pris, pour que rien ne saute au départ.

   La copie s'efface au tour de boucle suivant : le cliché est pris
   pendant `dragstart`, la retirer plus tôt ne laisserait rien à
   photographier. On passe par un délai plutôt que par une trame
   d'animation, parce qu'une trame ne vient pas quand la page ne se
   compose pas — et la copie resterait alors dans le document. */
export const carryGhost = (e, node) => {
  const r = node.getBoundingClientRect();
  const ghost = node.cloneNode(true);
  ghost.style.position = "fixed";
  ghost.style.top = "0px";
  ghost.style.left = "-10000px";
  ghost.style.margin = "0";
  ghost.style.opacity = "1";
  ghost.style.transform = "none";
  ghost.style.contentVisibility = "visible";
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, e.clientX - r.left, e.clientY - r.top);
  setTimeout(() => ghost.remove(), 0);
};

export const DropMark = React.forwardRef(function DropMark(_props, ref) {
  return (
    <div ref={ref} data-drop-mark aria-hidden style={DROP_MARK_STYLE}>
      <svg
        width={MARK_W}
        height={MARK_H}
        viewBox={`0 0 ${MARK_W} ${MARK_H}`}
        fill="none"
        style={{ display: "block" }}
      >
        {/* l'ombre d'abord, en un seul groupe décalé : elle ne peut pas
            dériver du trait puisqu'elle en reprend les mêmes chemins */}
        <g transform="translate(1.2 1.4)" opacity="0.18">
          {MARK_PATHS.map((p) => (
            <path key={p.d} d={p.d} stroke="#1E140A" strokeWidth={p.w + 0.8} {...MARK_INK} />
          ))}
        </g>
        {MARK_PATHS.map((p) => (
          <path key={p.d} d={p.d} stroke={C.burgundy} strokeWidth={p.w} {...MARK_INK} />
        ))}
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
export const FilmBox = React.memo(function FilmBox({
  film,
  ctx,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  dim,
}) {
  const [hover, setHover] = useState(false);
  const hue = hueOf(film.id);
  const initials = film.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  /* LA NOTE SUR LA TRANCHE.

     On comptait les étoiles pleines et les creuses avec deux `repeat`.
     Mais `repeat` tronque : une note de 3,5 rendait trois pleines et UNE
     creuse — la demie disparaissait, et le film paraissait noté sur
     quatre. Même juste, deux glyphes qui ne diffèrent que par leur
     remplissage ne se distinguent plus à dix pixels de haut.

     On empile donc deux fois les mêmes cinq étoiles : les éteintes
     dessous, les allumées par-dessus, coupées net à la fraction de la
     note. La demie est alors une étoile à moitié peinte — la seule
     lecture qui ne demande pas de compter. */
  const fill = `${Math.min(Math.max(film.rating || 0, 0), 5) * 20}%`;

  return (
    <div
      /* L'enveloppe porte l'identité de l'objet ET sa zone de dépôt : le
         code de glissement remonte toujours jusqu'ici, il peut donc lire
         qui il vise sans qu'on le lui repasse en fermeture. */
      data-shelf-item={film.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        flexShrink: 0,
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
          display: "flex",
          alignItems: "flex-end",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
        }}
      >
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", film.id);
            carryGhost(e, e.currentTarget);
            onDragStart("film", film.id, e.currentTarget);
          }}
          onDragEnd={onDragEnd}
          onClick={() => onOpen(film.id)}
          title={`${film.title}${film.year ? ` (${film.year})` : ""}`}
          style={{
            all: "unset",
            boxSizing: "border-box",
            cursor: "pointer",
            position: "relative",
            /* `draggable` ne pose pas un drapeau : il applique `-webkit-user-drag:
               element`, une simple déclaration de style — que `all: unset` efface
               comme le reste. Le boîtier n'était donc pas saisissable ; ce qu'on
               glissait, c'était l'affiche, que le navigateur rend saisissable
               d'elle-même, et l'événement remontait jusqu'ici. Sans affiche, plus
               rien à saisir : le rayon devenait immobile. On rétablit donc ce que
               `all: unset` a emporté. */
            WebkitUserDrag: "element",
            // et le texte des initiales ne doit pas se sélectionner au glissement
            userSelect: "none",
            WebkitUserSelect: "none",
            width: BOX_W,
            height: BOX_H,
            marginBottom: GAP_Y,
            marginRight: GAP_X,
            flexShrink: 0,
            borderRadius: "2px 3px 3px 2px",
            overflow: "hidden",
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
            transition:
              "transform .18s ease, box-shadow .18s ease, opacity .15s ease, filter .15s ease",
          }}
        >
          <PosterArt film={film} height={BOX_H} initials={initials} plain />
          {/* le dos : c'est lui qui fait lire « boîtier » et non « vignette » */}
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 11,
              background: hue,
              boxShadow: "inset -2px 0 4px rgba(0,0,0,0.4)",
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontFamily: "'Special Elite', monospace",
                fontSize: 8,
                letterSpacing: "0.08em",
                color: "rgba(246,239,222,0.92)",
                whiteSpace: "nowrap",
              }}
            >
              {film.title}
            </span>
          </span>
          {film.year !== "" && film.year != null && (
            <span
              style={{
                position: "absolute",
                top: 4,
                left: 15,
                background: "rgba(246,239,222,0.88)",
                color: C.ink,
                fontFamily: "'Special Elite', monospace",
                fontSize: 9,
                padding: "1px 4px",
                zIndex: 3,
              }}
            >
              {film.year}
            </span>
          )}
          {film.chevet && <PushPin style={{ top: -5, right: -5, zIndex: 4 }} />}
          {film.status !== "watchlist" && (
            <span
              style={{
                position: "absolute",
                bottom: 0,
                left: 11,
                right: 0,
                padding: "3px 5px",
                background: "rgba(43,38,32,0.72)",
                color: C.card,
                fontFamily: "'Special Elite', monospace",
                fontSize: 9.5,
                letterSpacing: 1,
                zIndex: 3,
              }}
            >
              <span
                aria-label={`${film.rating || 0} sur 5`}
                style={{
                  position: "relative",
                  display: "inline-block",
                  fontSize: 11,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: "rgba(246,239,222,0.3)" }}>★★★★★</span>
                {/* La couche allumée se superpose exactement à l'éteinte :
                    même texte, même chasse, donc les deux rangées se
                    recouvrent au pixel et la coupure tombe où il faut. */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: fill,
                    overflow: "hidden",
                    color: C.card,
                  }}
                >
                  ★★★★★
                </span>
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
});

/* L'INCLINAISON D'UN CARTON DRESSÉ.

   Un carton planté ne gît pas de travers comme un bibelot posé : il
   s'APPUIE. C'est ce qui le distingue d'une cloison d'imprimerie, et
   c'est aussi ce qui le fait lire comme du carton plutôt que comme un
   trait tracé à la règle.

   Deux raisons de ne pas lui donner le guingois entier des autres
   décors. La première tient à sa hauteur : ±4,5° sur quarante-six
   pixels ne se remarque pas, mais sur cent quarante-quatre le sommet
   part à onze pixels de son pied et le carton a l'air de tomber. La
   seconde est qu'il sépare : ce qui sépare doit rester lisible comme une
   verticale, sinon la rangée entière semble de guingois.

   Mais la moitié du guingois ne suffisait pas non plus, parce que le
   hasard est SEMÉ : `tiltOf` peut rendre une valeur voisine de zéro, et
   ce carton-là se dressait parfaitement droit — c'est ce qu'on voyait.
   On garde donc la variation, qui donne à chaque carton sa main propre,
   mais on l'éloigne de zéro : au moins un degré et deux dixièmes, jamais
   plus de deux et deux. Le sommet dérive de trois à six pixels — assez
   pour qu'on voie qu'il s'appuie, trop peu pour qu'on croie qu'il glisse.

   Les deux bornes tiennent sur une décimale, comme l'angle qu'on écrit :
   une borne plus fine que l'arrondi serait franchie par l'arrondi
   lui-même, et ne bornerait donc rien.

   Il pivote sur son pied (`transformOrigin: bottom center`, plus bas),
   comme un vrai carton calé contre les tranches voisines. */
const LEAN_MIN = 1.2,
  LEAN_MAX = 2.2;

/* LE CARTON, REPRIS POUR QU'ON LE VOIE.

   Il portait le papier de la boîte : même kraft, même filet, un liseré
   de couleur de trois pixels sur la tête. C'était juste — c'est bien le
   même carton d'archives — mais entre douze boîtiers du même papier,
   ce qui sépare avait exactement la couleur de ce qu'il sépare, et on ne
   le trouvait qu'en le cherchant. Or un intercalaire ne sert à rien
   d'autre qu'à être vu du bout de la rangée.

   Trois changements, et tous vont dans le même sens : rendre le carton à
   sa COULEUR au lieu de la réduire à un liseré.

   1. L'ONGLET. Un vrai carton de fichier ne se signale pas par sa
      tranche, mais par la languette de couleur qui dépasse en tête. Les
      trois pixels de bordure deviennent donc une vraie tête pleine,
      percée de son œillet — le trou de classeur, qui est ce qui fait
      lire « carton de fichier » et non « trait vertical ».
   2. LE CORPS. Un lavis de la même encre plutôt que le kraft commun :
      assez pâle pour qu'on écrive dessus à l'encre sombre, assez teinté
      pour qu'il ne se confonde plus avec les tranches voisines.
   3. LA LARGEUR. Vingt-six pixels étaient la largeur d'une tranche ; le
      carton en prend trente, parce qu'un séparateur qui a la chasse de
      ce qu'il sépare ne sépare rien.

   Le nom, lui, ne bouge pas : il se lit toujours à la verticale, de bas
   en haut, et commence sous l'onglet — écrire dans la tête reviendrait à
   écrire sur la languette, qui est justement la partie qu'on regarde. */
export const DIVIDER_W = 30,
  DIVIDER_HEAD = 18;

/* Le carton et sa maquette au cabinet doivent se ressembler assez pour
   qu'on reconnaisse dans la rangée ce qu'on a tiré du panneau : les deux
   lisent donc leur habillage ici. */
export const dividerSkin = (ink) => ({
  background: `linear-gradient(160deg, ${ink}22, ${ink}3A)`,
  border: `1px solid ${ink}99`,
  borderBottom: "none",
  borderRadius: "3px 3px 0 0",
  boxShadow: "2px 2px 0 rgba(43,38,32,0.2)",
});

/* L'onglet : la tête pleine, et l'œillet dedans. */
export const DividerHead = ({ ink, height }) => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height,
      background: ink,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // le carton est un peu plus clair juste sous la tête, comme un pli
      boxShadow: `0 1px 0 rgba(246,239,222,0.45)`,
    }}
  >
    <span
      style={{
        width: Math.max(3, Math.round(height * 0.32)),
        height: Math.max(3, Math.round(height * 0.32)),
        borderRadius: "50%",
        background: C.paper,
        opacity: 0.85,
      }}
    />
  </div>
);

export const leanOf = (id) => {
  const t = Number(tiltOf(id)) / 2;
  const side = t < 0 ? -1 : 1;
  return (side * Math.min(Math.max(Math.abs(t), LEAN_MIN), LEAN_MAX)).toFixed(1);
};

/* L'ANGLE D'UN OBJET — celui qu'on a réglé, sinon celui du hasard semé.

   Le guingois vient de l'identifiant : c'est lui qui fait qu'une étagère
   ressemble à une étagère et non à une planche de catalogue, et il n'y a
   rien à régler tant qu'on ne le veut pas. Mais un cadre qu'on veut
   droit, un lierre qui pend du mauvais côté, une image importée couchée
   sur le flanc : à un moment la main doit pouvoir passer devant le
   hasard.

   `??` et non `||` : zéro degré est une réponse, et la plus demandée de
   toutes — c'est « remets-le d'aplomb ». */
export const angleOf = (item, tall = false) =>
  item.rot ?? (tall ? leanOf(item.id) : tiltOf(item.id));

/* LA PLACE QUE PREND UN OBJET TOURNÉ — ET OÙ ELLE TOMBE.

   Premier essai : la largeur du cadre englobant, |L·cos θ| + |H·sin θ|,
   donnée à l'enveloppe. Le compte était juste, et pourtant les boîtiers
   collés au carton restaient dessous.

   Parce qu'un objet ne tourne pas sur son milieu : il pivote sur son
   PIED (`transformOrigin: bottom center`), comme un carton calé contre
   les tranches voisines. Le cadre englobant a bien la largeur qu'on
   calculait, mais il n'est plus centré sur l'objet — il part du côté vers
   lequel la tête penche. L'enveloppe, elle, centrait sagement le carton
   dedans : en bas tout allait bien, en haut le carton sortait de la place
   qu'il avait réclamée et recouvrait son voisin. La hauteur avait le même
   défaut, en pire : le coin bas passait SOUS la planche.

   On mesure donc les quatre coins après rotation autour du pied, et on
   rend deux choses — la taille du cadre, et le décalage qui le remet à
   cheval sur l'enveloppe. L'objet est ensuite translaté d'autant : ce
   qu'on voit occupe exactement ce qui a été réservé, du pied à la tête. */
export const rotatedBox = (w, h, deg) => {
  const r = (Number(deg) * Math.PI) / 180;
  const cos = Math.cos(r),
    sin = Math.sin(r);
  /* Les coins, comptés depuis le pivot : le pied à l'ordonnée 0, la tête
     à −h (l'axe des y descend, à l'écran comme en CSS). */
  const xs = [],
    ys = [];
  for (const x of [-w / 2, w / 2])
    for (const y of [0, -h]) {
      xs.push(x * cos - y * sin);
      ys.push(x * sin + y * cos);
    }
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  return {
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
    /* Le cadre se cale sur le BORD GAUCHE de l'enveloppe, et non en son
       milieu. L'enveloppe vaut le cadre plus l'écart au voisin, et cet
       écart appartient tout entier à la droite — c'est un `marginRight`
       qu'on a déménagé, pas une marge à partager. Centré, il se coupait
       en deux et le carton se retrouvait avec six pixels de trop à sa
       gauche : un trou que rien ne justifiait, puisque de ce côté-là il
       n'y a pas d'écart à tenir.

       On vise donc le pied du cadre à l'abscisse zéro : le carton est
       posé à gauche de l'enveloppe, son pivot est à `w/2`, et le coin le
       plus à gauche du cadre tombé à `minX` de ce pivot. */
    // `|| 0` : `Math.round` rend un zéro NÉGATIF, qui s'écrirait « -0px »
    dx: Math.round(-(w / 2 + minX)) || 0,
    dy: Math.round(-maxY) || 0,
  };
};

/* Un décor posé sur la planche : il se glisse, se déplace et s'enlève
   comme un boîtier, mais ne dit rien d'un film. Six des motifs sont les
   décors que la maison dessine déjà ailleurs ; le reste vient de lucide. */
export const DecorItem = React.memo(function DecorItem({
  item,
  ctx,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  onEdit,
  onLabel,
}) {
  const spec = decorSpec(item.motif);
  const [writing, setWriting] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState(item.label || "");
  useEffect(() => {
    setDraft(item.label || "");
  }, [item.label]);

  const ink = catInk(item.color);
  const s = item.size || 1;
  const box = Math.round(46 * s);
  if (!spec) return null;
  const Draw = spec.draw;

  /* L'ONGLET DU CARTON — la hauteur de tête qu'on voit de loin.
     Voir le long passage sur la refonte, plus bas. */
  const head = Math.round(DIVIDER_HEAD * s);

  /* Un carton se nomme SUR le carton. Le panneau savait déjà le faire,
     mais il fallait l'ouvrir pour le découvrir — et un carton vierge ne
     dit pas qu'il attend un nom. C'est le geste de la catégorie, dont on
     écrit l'onglet là où on le lit ; la palette reste à côté, pour ce
     qui n'est pas du texte. */
  /* NOMMER RESTE UNE OFFRE, PAS UN PASSAGE OBLIGÉ.

     Le carton s'écrivait sur lui-même : un clic ouvrait le champ, et un
     carton vierge affichait « nommer » en italique. C'était juste pour
     qui venait poser une catégorie, et pénible pour tous les autres —
     beaucoup d'intercalaires ne servent qu'à marquer une coupure, et
     n'ont rien à dire. Le clic tombait alors dans un champ dont il
     fallait ressortir, et la couleur ou la taille se cachaient derrière
     une icône qu'on ne trouvait qu'au survol.

     On garde donc le geste, mais on le réserve aux cartons qui ONT un
     nom : celui-là s'écrit là où on le lit. Un carton vierge, lui, ouvre
     son panneau comme n'importe quel objet — et le panneau porte déjà un
     champ NOM pour qui veut lui en donner un. */
  const writes = !!spec.writes && !!onLabel && !!item.label;
  const commit = () => {
    setWriting(false);
    const v = draft.trim();
    if (v !== (item.label || "")) onLabel(item.id, v);
  };
  const w = spec.tall ? Math.round(DIVIDER_W * s) : box;
  const h = spec.tall ? Math.round(BOX_H * s) : box;
  const angle = angleOf(item, spec.tall);
  const frame = rotatedBox(w, h, angle);

  return (
    <div
      data-shelf-item={item.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        flexShrink: 0,
        /* La place réclamée dans la rangée suit l'angle, en largeur comme
           en hauteur : voir `rotatedBox`. Une tête qui penche dépasse du
           bois, et c'est la rangée qui doit s'en apercevoir. */
        width: frame.width + GAP_X,
        height: frame.height + GAP_Y,
      }}
    >
      {/* la couche qui bascule à l'écartement, sous la cible de dépôt */}
      <div
        data-lean
        style={{
          display: "flex",
          alignItems: "flex-end",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
        }}
      >
        <div
          /* Un carton qu'on est en train d'écrire ne se glisse pas : le
             `draggable` d'un ancêtre avale la sélection du texte et le
             double-clic dans le champ déclenche un glissement. */
          draggable={!writing}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            onDragStart("decor", item.id, e.currentTarget);
          }}
          onDragEnd={onDragEnd}
          onClick={() => (writes ? setWriting(true) : onEdit(item.id))}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title={
            writes
              ? item.label || "Cliquez pour nommer cet intercalaire"
              : spec.writes && item.label
                ? item.label
                : spec.label
          }
          style={{
            position: "relative",
            width: w,
            height: h,
            /* Le pied du carton se pose sur la planche, jamais dessous :
               `dy` rattrape ce que la rotation lui a fait descendre. */
            marginBottom: GAP_Y,
            /* L'écart au voisin est passé à l'enveloppe, avec la place que
               réclame l'angle : le laisser ici l'ajouterait une seconde
               fois, et un objet tourné dériverait vers la droite. */
            flexShrink: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transform: `translate(${frame.dx}px, ${frame.dy}px) rotate(${angle}deg)`,
            transformOrigin: "bottom center",
            userSelect: "none",
            WebkitUserSelect: "none",
            // le carton lui-même : sa propre encre, tête comprise
            ...(spec.tall ? dividerSkin(ink) : null),
          }}
        >
          {spec.tall && <DividerHead ink={ink} height={head} />}

          {spec.tall ? (
            /* Le nom se lit à la verticale, de bas en haut : c'est ainsi
               qu'on lit une tranche dans une boîte d'archives, et la
               seule façon d'écrire long sur vingt-six pixels de large.
               Le champ reprend exactement la même écriture, pour qu'on
               n'ait pas l'impression que le texte saute de place quand on
               se met à l'écrire. */
            writing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(item.label || "");
                    setWriting(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Nom de l'intercalaire"
                style={{
                  all: "unset",
                  boxSizing: "border-box",
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontFamily: "'Special Elite', monospace",
                  fontSize: Math.max(8, Math.round(10 * s)),
                  letterSpacing: "0.08em",
                  color: C.ink,
                  /* Le champ commence SOUS l'onglet : écrire dans la tête
                     reviendrait à écrire sur la languette de couleur,
                     qui est précisément ce qu'on regarde de loin. */
                  height: `calc(100% - ${head}px)`,
                  marginTop: head,
                  padding: "6px 0",
                  // le filet du champ longe la tranche, comme un trait au crayon
                  borderLeft: `1px solid ${ink}`,
                }}
              />
            ) : (
              <span
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  fontFamily: "'Special Elite', monospace",
                  fontSize: Math.max(8, Math.round(10 * s)),
                  letterSpacing: "0.08em",
                  /* Le nom passe à l'encre sombre : sur un corps désormais
                     teinté de sa propre couleur, l'écrire dans cette
                     même couleur le rendait illisible. */
                  color: C.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxHeight: `calc(100% - ${head}px)`,
                  marginTop: head,
                  padding: "6px 0",
                }}
              >
                {/* Un carton vierge reste vierge : il sépare, et séparer
                    se passe très bien de mot. */}
                {item.label}
              </span>
            )
          ) : (
            <Draw color={ink} style={{ width: "100%", height: "100%" }} />
          )}

          {/* La palette reste joignable : écrire prend le clic, mais la
              couleur, la taille et le retrait sont ailleurs. Au pied du
              carton, et seulement au survol — c'est le geste de l'onglet
              d'une catégorie, qui porte le même bouton à côté de son
              nom. */}
          {writes && !writing && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item.id);
              }}
              title="Couleur, taille, retrait"
              aria-label={`Réglages de « ${item.label || "sans nom"} »`}
              style={{
                all: "unset",
                cursor: "pointer",
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 2,
                display: "flex",
                justifyContent: "center",
                color: ink,
                // il répond au survol du CARTON : sur le sien, il resterait introuvable
                opacity: hover ? 0.75 : 0,
                transition: "opacity .15s ease",
              }}
            >
              <Palette size={10} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/* Le cadre englobant d'un objet ACCROCHÉ. Il pivote sur son milieu et
   non sur son pied — rien ne le porte, il pend — d'où un `rotatedBox`
   d'une boîte deux fois moins haute, recentrée : les décalages
   s'annulent et il ne reste que la taille. C'est elle que réclame la
   case, et elle aussi qui borne le dépôt au bord du rayon. */
export const rotatedBoxOfWall = (item) => {
  const b = wallBoxOf(item.size);
  const { width, height } = rotatedBox(b, b, angleOf(item));
  return { width, height };
};

/* UN OBJET ACCROCHÉ — il ne pose sur rien, mais il peut faire de l'ombre.

   Le décor posé vit dans le flux de sa rangée : il prend une place entre
   deux boîtiers, et l'écartement le pousse comme les autres. Celui-ci
   est punaisé au fond du rayon, à un point qu'on a choisi en le lâchant.
   Il n'a donc ni enveloppe, ni écart, ni zone de dépôt — rien ne se
   range à côté de lui.

   Sauf s'il le RÉCLAME. Un cadre au fond d'un rayon plein disparaît
   derrière les tranches, et il n'y avait rien à faire sinon le déplacer
   là où il restait de la place. La case à cocher de son panneau lui
   donne une emprise : les boîtiers de la ligne qu'il recouvre s'écartent
   pour le laisser voir. C'est un choix par objet, et par défaut il ne
   dérange personne — la plupart des punaises n'ont pas à repousser une
   collection.

   Il est peint AVANT les rangées et sans `z-index` : les boîtiers, plus
   loin dans le document, passent devant. C'est ce qui le met au fond
   plutôt que par-dessus, et c'est aussi ce qu'on attend d'un cadre
   accroché derrière une étagère. */
export const WallItem = React.memo(function WallItem({ item, onDragStart, onDragEnd, onEdit }) {
  const spec = decorSpec(item.motif);
  if (!spec) return null;
  const ink = catInk(item.color);
  // le dessin, plus la marge de prise qui en fait le tour
  const box = wallBoxOf(item.size);
  const frame = rotatedBoxOfWall(item);
  const Draw = spec.draw;
  return (
    <div
      data-wall-item
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        /* OÙ l'a-t-on pris ? Sans cette mesure, l'objet se recentre sous
           le curseur au dépôt : on le saisit par un coin, on le lâche là
           où on croit le voir, et il saute d'une demi-largeur. On garde
           donc l'écart entre le point de prise et le centre, pour le
           défalquer à l'arrivée. */
        const r = e.currentTarget.getBoundingClientRect();
        /* CELUI-CI, ON LE TIENT.

           Le temps d'un geste, les objets accrochés cessent de recevoir
           le curseur : c'est ce qui les autorise à déborder de leur rayon
           sans voler les dépôts du rayon voisin (voir `tokens.ts`). Mais
           la règle attrapait aussi l'objet qu'on venait d'empoigner, et
           un glissement dont la source cesse d'être testable au survol
           est un glissement que le navigateur annule : une fois posé, un
           objet volant ne se reprenait plus.

           Il se marque donc comme étant celui qu'on tient, et la règle
           l'épargne. Le marquage est écrit à la main sur le nœud, comme
           tout ce qui bouge pendant un glissement — un état React ici
           re-rendrait le rayon au pire moment. */
        e.currentTarget.dataset.dragSelf = "1";
        onDragStart("wall", item.id, e.currentTarget, {
          dx: e.clientX - (r.left + r.width / 2),
          dy: e.clientY - (r.top + r.height / 2),
        });
      }}
      onDragEnd={(e) => {
        delete e.currentTarget.dataset.dragSelf;
        onDragEnd(e);
      }}
      onClick={() => onEdit(item.id)}
      title={spec.label}
      style={{
        position: "absolute",
        left: `${item.x}%`,
        top: `${item.y}%`,
        /* LA PRISE SUIT L'ANGLE. Elle faisait la taille du dessin DEBOUT,
           et la rotation, qui ne déplace pas la mise en page, laissait
           dépasser tout ce qui sortait de ce carré : un fanion couché se
           voyait sur toute sa longueur mais ne s'attrapait qu'au milieu,
           et le reste laissait passer le curseur vers les boîtiers. */
        width: frame.width,
        height: frame.height,
        marginLeft: -frame.width / 2,
        marginTop: -frame.height / 2,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        // la couche du mur ne laisse passer le curseur que sur ses objets
        pointerEvents: "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          width: box,
          height: box,
          padding: WALL_GRIP,
          boxSizing: "border-box",
          // accroché de travers, comme tout ce qu'on accroche — sauf si on l'a redressé
          transform: `rotate(${angleOf(item)}deg)`,
        }}
      >
        <Draw color={ink} style={{ width: "100%", height: "100%" }} />
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
   illisible dès qu'on nommait vraiment quelque chose.

   ELLE SE COUPE EN SEGMENTS. Une boîte ne replie plus son contenu à
   l'intérieur d'elle-même : elle grandissait alors en hauteur sans
   qu'aucune planche ne vienne sous ses lignes, et le rayon cessait
   d'être un rayon. Elle reçoit maintenant la seule TRANCHE qui tient sur
   la ligne (`items`), et se répète telle quelle sur la ligne suivante —
   c'est `splitRow` qui découpe (voir `lines.js`). `first` porte
   l'en-tête, `last` ferme le carton à droite ; entre les deux, les bords
   restent ouverts, et l'on voit que c'est la même boîte qui continue. */
export const CategoryBox = React.memo(function CategoryBox({
  cat,
  items,
  first = true,
  last = true,
  kind,
  rowId,
  films,
  dim,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  onCatOver,
  onOpen,
  onEdit,
  onEditDecor,
  onDecorLabel,
  acts,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cat.label);
  useEffect(() => {
    setDraft(cat.label);
  }, [cat.label]);

  const ink = catInk(cat.color);
  const ctx = useMemo(() => ({ kind, rowId, catId: cat.id }), [kind, rowId, cat.id]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== cat.label) acts.setCat(cat.id, { label: v });
    else setDraft(cat.label);
  };

  /* Une boîte tient des boîtiers ET du mobilier : un intercalaire glissé
     là-dedans est la sous-division dont on a besoin quand la
     filmographie déborde. Seule une autre boîte reste dehors. */
  const boxes = (items || cat.items)
    .map((it) => {
      if (it.t === "d")
        return (
          <DecorItem
            key={it.id}
            item={it}
            ctx={ctx}
            onEdit={onEditDecor}
            onLabel={onDecorLabel}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverBox={onDragOverBox}
          />
        );
      const f = films.get(it.id);
      if (!f) return null;
      return (
        <FilmBox
          key={f.id}
          film={f}
          ctx={ctx}
          onOpen={onOpen}
          dim={dim(f)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOverBox={onDragOverBox}
        />
      );
    })
    .filter(Boolean);

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
      /* Plus de `maxWidth` ni de repli : la tranche reçue tient sur la
         ligne par construction, c'est `splitRow` qui s'en est assuré. La
         boîte trop grande pour la ligne ne se replie pas sur elle-même,
         elle DÉBORDE sur la ligne du dessous, qui a son bois. */
      style={{
        flexShrink: 0,
        minWidth: 0,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      {/* Le carton EST la couche qui bascule : rien d'autre ne touche à
          son `transform`, il n'a donc pas besoin d'une couche à lui. */}
      <div
        data-cat-card
        data-lean
        style={{
          position: "relative",
          flexShrink: 0,
          minWidth: 0,
          marginRight: GAP_X,
          marginBottom: GAP_Y,
          display: "flex",
          flexDirection: "column",
          transformOrigin: "bottom center",
          transition: "transform .3s cubic-bezier(.32,1.16,.42,1)",
          /* C'est TOUJOURS un carton : même papier, même filet, même ombre
             portée sèche que l'intercalaire debout d'avant. Il a seulement
             cessé d'être une cloison pour devenir une pochette — ouverte en
             bas, pour que les boîtiers qu'elle tient posent sur la planche
             du rayon comme les autres. Une pochette fermée les ferait
             flotter, et l'étagère cesserait d'être une étagère. */
          background: `linear-gradient(160deg, ${C.paperDark}, #D8C69C)`,
          border: `1px solid ${C.line}`,
          borderBottom: "none",
          /* Une boîte coupée en deux garde ses bords là où elle commence
             et là où elle finit, et les perd là où elle continue : c'est
             le bord manquant qui dit « la suite est plus bas ». */
          borderLeft: first ? `1px solid ${C.line}` : "none",
          borderRight: last ? `1px solid ${C.line}` : "none",
          borderRadius: `${first ? 3 : 0}px ${last ? 3 : 0}px 0 0`,
          boxShadow: last ? "2px 2px 0 rgba(43,38,32,0.14)" : "0 2px 0 rgba(43,38,32,0.14)",
          "--cat-open": `${ink}22`,
        }}
      >
        {/* L'onglet d'index : la couleur est une languette collée en tête de
            carton, pas un aplat qui mangerait le kraft. C'est ainsi qu'on
            repère un dossier dans une boîte d'archives. */}
        <div
          style={{
            height: 4,
            background: ink,
            borderRadius: `${first ? 2 : 0}px ${last ? 2 : 0}px 0 0`,
            opacity: 0.9,
          }}
        />
        {/* La suite d'une boîte ne reporte pas son nom : la languette de
            couleur et le bord gauche ouvert suffisent à la reconnaître, et
            un nom répété à chaque ligne se lirait comme trois boîtes. */}
        {!first && <div style={{ height: 1, background: C.line, opacity: 0.5 }} />}
        {first && (
          <div
            onClick={() => setEditing(true)}
            title={cat.label}
            style={{
              padding: "4px 8px",
              cursor: "text",
              color: ink,
              fontFamily: "'Special Elite', monospace",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              borderBottom: `1px solid ${C.line}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(cat.label);
                    setEditing(false);
                  }
                }}
                style={{
                  all: "unset",
                  flex: 1,
                  minWidth: 60,
                  fontFamily: "'Special Elite', monospace",
                  fontSize: 10.5,
                  color: C.ink,
                  borderBottom: `1px solid ${C.line}`,
                }}
              />
            ) : (
              /* Horizontal, tronqué proprement, et l'infobulle porte le nom
               entier. L'intercalaire d'avant l'écrivait à la verticale et le
               coupait net à 144 px, sans ellipse ni recours. */
              <span
                style={{
                  flex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 220,
                }}
              >
                {cat.label}
              </span>
            )}
            <span style={{ color: C.inkFaded, fontSize: 9 }}>{cat.items.length}</span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(cat.id);
              }}
              title="Couleur de la catégorie"
              style={{ all: "unset", cursor: "pointer", color: C.inkFaded, display: "flex" }}
            >
              <Palette size={11} />
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            /* Plus de repli ici : ce qui ne tient pas sur la ligne n'est
               pas dans `items`, il est dans le segment d'en dessous. */
            flexWrap: "nowrap",
            alignItems: "flex-end",
            padding: `${first ? 8 : 4}px 6px 0`,
            minWidth: boxes.length ? 0 : BOX_W + 12,
            minHeight: BOX_H + 8,
          }}
        >
          {boxes.length === 0 && (
            <div
              style={{
                color: C.inkFaded,
                fontFamily: "'Caveat', cursive",
                fontSize: 15,
                padding: "0 6px 12px",
                alignSelf: "flex-end",
              }}
            >
              glissez-y des films
            </div>
          )}
          {boxes}
        </div>
      </div>
    </div>
  );
});
