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
  ZIGZAG,
  STITCH,
  DECOR_BY_KEY,
  catInk,
} from "./constants";

export const DropMark = React.forwardRef(function DropMark(_props, ref) {
  return (
    <div ref={ref} data-drop-mark aria-hidden style={DROP_MARK_STYLE}>
      <svg
        width={MARK_W}
        height={MARK_H}
        viewBox={`0 0 ${MARK_W} ${MARK_H}`}
        fill="none"
        style={{ display: "block", animation: "inkBreathe 1.9s ease-in-out infinite" }}
      >
        <path
          d={ZIGZAG}
          stroke="#1E140A"
          strokeWidth="4.6"
          opacity="0.2"
          transform="translate(1.6 1.8)"
          {...STITCH}
        />
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
  const stars = "★".repeat(film.rating || 0) + "☆".repeat(5 - (film.rating || 0));

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
              {stars}
            </span>
          )}
        </button>
      </div>
    </div>
  );
});

/* Les sauts de ligne d'un conteneur. Le retour à la ligne n'est pas
   laissé au hasard de la largeur : quand la rangée porte un compte, on
   le pose nous-mêmes. Une catégorie compte pour un objet — c'en est un. */
export const withBreaks = (nodes, cap) => {
  if (!cap) return nodes;
  const out = [];
  nodes.forEach((n, i) => {
    if (i > 0 && i % cap === 0)
      out.push(<div key={`br-${i}`} style={{ flexBasis: "100%", height: 0 }} />);
    out.push(n);
  });
  return out;
};

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

export const leanOf = (id) => {
  const t = Number(tiltOf(id)) / 2;
  const side = t < 0 ? -1 : 1;
  return (side * Math.min(Math.max(Math.abs(t), LEAN_MIN), LEAN_MAX)).toFixed(1);
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
  const spec = DECOR_BY_KEY[item.motif];
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

  /* Un carton se nomme SUR le carton. Le panneau savait déjà le faire,
     mais il fallait l'ouvrir pour le découvrir — et un carton vierge ne
     dit pas qu'il attend un nom. C'est le geste de la catégorie, dont on
     écrit l'onglet là où on le lit ; la palette reste à côté, pour ce
     qui n'est pas du texte. */
  const writes = !!spec.writes && !!onLabel;
  const commit = () => {
    setWriting(false);
    const v = draft.trim();
    if (v !== (item.label || "")) onLabel(item.id, v);
  };
  return (
    <div
      data-shelf-item={item.id}
      onDragOver={(e) => onDragOverBox(e, ctx)}
      style={{ position: "relative", display: "flex", alignItems: "flex-end", flexShrink: 0 }}
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
            width: spec.tall ? Math.round(26 * s) : box,
            height: spec.tall ? Math.round(BOX_H * s) : box,
            marginBottom: GAP_Y,
            marginRight: GAP_X,
            flexShrink: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transform: `rotate(${spec.tall ? leanOf(item.id) : tiltOf(item.id)}deg)`,
            transformOrigin: "bottom center",
            userSelect: "none",
            WebkitUserSelect: "none",
            /* Le carton lui-même : même papier, même filet et même ombre
               sèche que la boîte — c'est le même carton d'archives, l'un
               ouvert, l'autre plein. */
            ...(spec.tall
              ? {
                  background: `linear-gradient(160deg, ${C.paperDark}, #D8C69C)`,
                  border: `1px solid ${C.line}`,
                  borderBottom: "none",
                  borderTop: `3px solid ${ink}`,
                  borderRadius: "3px 3px 0 0",
                  boxShadow: "2px 2px 0 rgba(43,38,32,0.14)",
                }
              : null),
          }}
        >
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
                  height: "100%",
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
                  color: ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxHeight: "100%",
                  padding: "6px 0",
                  // un carton vierge annonce qu'il attend un nom
                  ...(writes && !item.label ? { opacity: 0.45, fontStyle: "italic" } : null),
                }}
              >
                {item.label || (writes ? "nommer" : "")}
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

/* UN OBJET ACCROCHÉ — il ne pose sur rien.

   Le décor posé vit dans le flux de sa rangée : il prend une place entre
   deux boîtiers, et l'écartement le pousse comme les autres. Celui-ci
   est punaisé au fond du rayon, à un point qu'on a choisi en le lâchant.
   Il n'a donc ni enveloppe, ni écart, ni zone de dépôt — rien ne se
   range à côté de lui.

   Il est peint AVANT les rangées et sans `z-index` : les boîtiers, plus
   loin dans le document, passent devant. C'est ce qui le met au fond
   plutôt que par-dessus, et c'est aussi ce qu'on attend d'un cadre
   accroché derrière une étagère. */
export const WallItem = React.memo(function WallItem({ item, onDragStart, onDragEnd, onEdit }) {
  const spec = DECOR_BY_KEY[item.motif];
  if (!spec) return null;
  const ink = catInk(item.color);
  const box = Math.round(64 * (item.size || 1));
  const Draw = spec.draw;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart("wall", item.id, e.currentTarget);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(item.id)}
      title={spec.label}
      style={{
        position: "absolute",
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: box,
        height: box,
        marginLeft: -box / 2,
        marginTop: -box / 2,
        cursor: "pointer",
        // accroché de travers, comme tout ce qu'on accroche
        transform: `rotate(${tiltOf(item.id)}deg)`,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <Draw color={ink} style={{ width: "100%", height: "100%" }} />
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
export const CategoryBox = React.memo(function CategoryBox({
  cat,
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
  const boxes = cat.items
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
      /* `maxWidth` est ce qui rend le mode auto tenable : sans compte, la
         boîte prendrait la largeur de tous ses boîtiers mis bout à bout
         et sortirait du rayon par la droite. Bornée à la rangée, elle
         grandit jusque-là puis replie son contenu. */
      style={{
        flexShrink: 0,
        minWidth: 0,
        maxWidth: "100%",
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
          maxWidth: "100%",
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
          borderRadius: "3px 3px 0 0",
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            padding: "8px 6px 0",
            minWidth: BOX_W + 12,
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
          {/* Le compte de la boîte, et rien d'autre. Il héritait de celui
              de la rangée à défaut du sien, avec un repli sur dix : une
              boîte réglée sur « auto » se retrouvait donc plafonnée sans
              l'avoir demandé, et le réglage mentait. Sans compte, elle
              grandit avec son contenu jusqu'à la largeur du rayon, où le
              `flex-wrap` la replie de lui-même. */}
          {withBreaks(boxes, cat.perRow)}
        </div>
      </div>
    </div>
  );
});
