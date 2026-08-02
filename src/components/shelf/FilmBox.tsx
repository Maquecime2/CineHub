import React, { useState } from "react";
import { Plus } from "lucide-react";
import { C } from "../../theme/tokens";
import { hueOf } from "../../theme/ink";
import { PosterArt } from "../film/PosterArt";
import { PushPin } from "../atmosphere";
import { BOX_W, BOX_H } from "./constants";
import type { DragKind } from "./constants";
import type { Film, ShelfKind } from "../../types";

interface FilmBoxProps {
  film: Film;
  kind: ShelfKind;
  onOpen: (id: string) => void;
  onDragStart: (kind: DragKind, id: string, el: HTMLElement) => void;
  onDragEnd: () => void;
  onDragOverBox: (e: React.DragEvent, shelf: ShelfKind, overId: string) => void;
  onInsertDivider?: ((shelf: ShelfKind, beforeId: string) => void) | undefined;
}

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
  kind,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOverBox,
  onInsertDivider,
}: FilmBoxProps) {
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
        containIntrinsicSize: `${BOX_W + 9}px ${BOX_H + 12}px`,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Poser un intercalaire ICI. Le bouton du haut de rayon oblige à
          remonter chercher le carton puis à le redescendre à la main ;
          au milieu d'une grande étagère, c'est intenable. */}
      {hover && onInsertDivider && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInsertDivider(kind, film.id);
          }}
          title="Poser un intercalaire avant ce film"
          style={{
            all: "unset",
            position: "absolute",
            left: -12,
            bottom: 52,
            zIndex: 7,
            cursor: "pointer",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: C.paper,
            border: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.burgundy,
            boxShadow: "1px 1px 3px rgba(30,20,10,0.25)",
          }}
        >
          <Plus size={11} />
        </button>
      )}
      <button
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", film.id);
          onDragStart("film", film.id, e.currentTarget);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOverBox(e, kind, film.id)}
        onClick={() => onOpen(film.id)}
        title={`${film.title}${film.year ? ` (${film.year})` : ""}`}
        style={{
          all: "unset",
          boxSizing: "border-box",
          cursor: "pointer",
          position: "relative",
          width: BOX_W,
          height: BOX_H,
          marginBottom: 12,
          marginRight: 9,
          flexShrink: 0,
          borderRadius: "2px 3px 3px 2px",
          overflow: "hidden",
          // ce qui se repeint dans un boîtier ne concerne que ce boîtier
          contain: "layout paint style",
          border: `1px solid rgba(43,38,32,0.35)`,
          boxShadow: hover ? `3px 5px 10px rgba(30,20,10,0.34)` : `2px 2px 0 rgba(43,38,32,0.16)`,
          transform: hover ? "translateY(-7px) rotate(-1.2deg)" : "none",
          transformOrigin: "bottom center",
          opacity: film.archived ? 0.62 : 1,
          filter: film.archived ? "saturate(0.5)" : "none",
          transition: "transform .18s ease, box-shadow .18s ease, opacity .15s ease",
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
  );
});
