/* ============================================================
   ONE STATION ON A RUNNING ORDER
   ============================================================

   IT IS A STATION ON A RAIL, AND NOT A CARD IN A ROW. A viewing plan
   drawn as separated tiles reads as a shelf: a set of things one owns,
   in no particular relation. The rail is what says the opposite — these
   follow one another, and the order is the statement. So the poster
   sits ABOVE the line, the ordinal is a bead ON it, and the title hangs
   BELOW: three registers, one axis.

   THE RAIL ONLY LINES UP IF THE POSTERS DO. `PosterArt` takes a 2:3
   shape when it holds a real poster and the `height` it is given when it
   does not — two different heights in one row, and the beads would sit
   at two different levels. `plain` is the mode written for exactly this
   ("the case already sets the dimensions"), so the box is fixed here and
   the poster pours into it. The torn edge goes, and that is the trade:
   an order that does not line up is not an order.

   THE BAND CARRIES THE FILM-MAKER, AND IT IS DRAWN ONCE PER RUN OF THEM.
   `groupedSteps` groups only what is CONSECUTIVE, on purpose — so three
   Ozu in a row make one band, and two Ozu split by a Hou make two,
   because that is what was written down.

   IT IS DRAGGED AND IT IS ALSO MOVED BY KEY, and the second is not a
   consolation prize. `usePointerDrag` makes the touch gesture come free
   as soon as something is `draggable="true"`, but a drag has no keyboard
   at all: without the two chevrons and `Alt` + arrows, the one gesture
   this whole screen exists for would be reachable by mouse and finger
   only. BOTH ARROW PAIRS ARE BOUND — the strip runs sideways on a desk
   and downwards on a phone, and the fingers that learnt one should not
   have to learn the other.

   THE TICK-BOX IS THE THIRD DOOR TO A SELECTION. Ctrl-click and
   Shift-click are the desk conventions and they cost nothing to anybody
   who knows them; they are also unreachable with a finger and awkward
   with a screen reader. The box appears on hover and on FOCUS, and is
   always there once ticked — so the pointer, the finger and the keyboard
   all have a way in.

   NO EXPENSIVE EFFECT LIVES HERE. A strip is a LIST — `filter`,
   `mixBlendMode` and stacked shadows are for moments — which is also why
   `PosterArt` is handed `lazy`: that prop is the project's word for
   "there are many of these on screen at once". */
import { useEffect, useRef, useState } from "react";
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { PosterArt } from "../film/PosterArt";
import { initialsOf } from "../../domain/film";
import type { Step } from "../../domain/course";
import type { Film } from "../../types";

/** La station et son affiche. Le rail se cale dessus : voir l'en-tête. */
export const CARD = 116;
export const POSTER_H = 168;
/** Hauteur du bandeau de cinéaste, au-dessus de l'affiche. */
export const BAND_H = 20;
/** Où court le rail dans la carte, depuis son haut. */
export const RAIL_Y = BAND_H + POSTER_H + 9;

interface StepCardProps {
  step: Step;
  film: Film;
  /** Sa place dans la file, lue par un humain : 1 et non 0. */
  place: number;
  total: number;
  directorName: string | null;
  /** La colonne du téléphone plutôt que la bande. */
  column: boolean;
  /** Première / dernière d'une suite du même cinéaste : le bandeau. */
  bandStart: boolean;
  bandEnd: boolean;
  /** C'est l'étape ouverte dans le panneau. */
  picked: boolean;
  /** Elle fait partie de la sélection qu'on déplace en bloc. */
  selected: boolean;
  /** L'entrée est mise en avant par la carte des cinéastes. */
  lit: boolean;
  /** La PREMIÈRE entrée allumée, celle qu'on amène sous les yeux. */
  leading: boolean;
  /** Une note de marge est écrite dessus : la station le montre. */
  noted: boolean;
  /** Le clic porte ses modificateurs : la bande en fait une sélection. */
  onPick: (e: ReactMouseEvent) => void;
  onToggle: () => void;
  /** Survol ou focus : la carte épaissit le lien invoqué. */
  onPoint: (on: boolean) => void;
  onMoveBy: (delta: number) => void;
  onDragStart: () => void;
  onDropHere: () => void;
  /** L'entrée survolée pendant un glissement porte le repère de dépôt. */
  marked: boolean;
  onMark: (on: boolean) => void;
}

export function StepCard({
  step,
  film,
  place,
  total,
  directorName,
  column,
  bandStart,
  bandEnd,
  picked,
  selected,
  lit,
  leading,
  noted,
  onPick,
  onToggle,
  onPoint,
  onMoveBy,
  onDragStart,
  onDropHere,
  marked,
  onMark,
}: StepCardProps) {
  const { t } = useTranslation();
  const card = useRef<HTMLLIElement | null>(null);
  const [near, setNear] = useState(false);

  /* `block: "nearest"` ET RIEN D'AUTRE : la bande bouge seulement si
     l'entrée est hors du champ. « center » recadrerait la file entière
     à chaque clic sur la carte, y compris quand on regardait déjà la
     bonne affiche.
     La méthode est APPELÉE SOUS CONDITION D'EXISTENCE : c'est une
     commodité de confort, et un environnement qui ne l'implémente pas —
     jsdom en est un — ne doit pas faire tomber la bande entière pour un
     recadrage qu'on ne verrait pas de toute façon. */
  useEffect(() => {
    if (leading && typeof card.current?.scrollIntoView === "function")
      card.current.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [leading]);

  const showBox = near || selected;

  const box = (
    <input
      type="checkbox"
      checked={selected}
      onChange={onToggle}
      onClick={(e) => e.stopPropagation()}
      aria-label={t("lineage.select", { title: film.title })}
      style={{
        cursor: "pointer",
        accentColor: C.plum,
        /* Présente au clavier même invisible : `visibility` la retirerait
           de l'ordre de tabulation, et la sélection n'aurait plus de
           porte sans souris. */
        opacity: showBox ? 1 : 0,
        margin: 0,
      }}
      onFocus={() => setNear(true)}
      onBlur={() => setNear(false)}
    />
  );

  const chevrons = (
    <div style={{ display: "flex" }}>
      <button
        onClick={() => onMoveBy(-1)}
        disabled={place === 1}
        aria-label={t("lineage.moveEarlier")}
        title={t("lineage.moveEarlier")}
        style={{ ...bare, opacity: place === 1 ? 0.3 : 1, padding: 2 }}
      >
        {column ? <ChevronUp size={14} /> : <ChevronLeft size={14} />}
      </button>
      <button
        onClick={() => onMoveBy(1)}
        disabled={place === total}
        aria-label={t("lineage.moveLater")}
        title={t("lineage.moveLater")}
        style={{ ...bare, opacity: place === total ? 0.3 : 1, padding: 2 }}
      >
        {column ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
    </div>
  );

  const shared = {
    ref: card,
    draggable: "true" as const,
    onDragStart,
    onDragOver: (e: ReactDragEvent) => {
      e.preventDefault();
      onMark(true);
    },
    onDragLeave: () => onMark(false),
    onDrop: (e: ReactDragEvent) => {
      e.preventDefault();
      onMark(false);
      onDropHere();
    },
    "aria-current": (lit ? "true" : undefined) as "true" | undefined,
    onMouseEnter: () => {
      setNear(true);
      onPoint(true);
    },
    onMouseLeave: () => {
      setNear(false);
      onPoint(false);
    },
    onFocusCapture: () => onPoint(true),
    onBlurCapture: () => onPoint(false),
    onKeyDown: (e: ReactKeyboardEvent) => {
      /* `Alt` because the bare arrows belong to the page: a strip one
         cannot scroll through with the keyboard would trade one loss for
         another. */
      if (!e.altKey) return;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        onMoveBy(-1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        onMoveBy(1);
      }
    },
  };

  /* ------------------------------------------------------------
     LA COLONNE DU TÉLÉPHONE — même contenu, pas de rail : une ligne
     verticale doublerait la colonne elle-même sans rien dire de plus.
     ------------------------------------------------------------ */
  if (column)
    return (
      <li
        {...shared}
        style={{
          listStyle: "none",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "8px 4px",
          borderTop: `2px solid ${marked ? C.burgundy : "transparent"}`,
          borderBottom: `1px solid ${alpha(C.line, 0.7)}`,
          background: selected ? alpha(C.plum, 0.16) : lit ? alpha(C.plum, 0.09) : "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", paddingTop: 22 }}>{box}</div>
        <button
          onClick={onPick}
          aria-pressed={picked}
          aria-label={t("lineage.openStep", { title: film.title })}
          style={{
            ...bare,
            display: "block",
            width: 54,
            flexShrink: 0,
            padding: 0,
            position: "relative",
            height: 81,
            outline: picked ? `2px solid ${C.plum}` : undefined,
            outlineOffset: 2,
          }}
        >
          <PosterArt film={film} initials={initialsOf(film.title)} width={54} plain lazy />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>{place}</span>
            <button
              onClick={onPick}
              style={{
                ...bare,
                flex: 1,
                minWidth: 0,
                color: C.ink,
                fontFamily: F.body,
                fontSize: 14.5,
                lineHeight: 1.25,
                textAlign: "left",
                display: "block",
              }}
            >
              {film.title}
            </button>
          </div>
          {directorName && (
            <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, marginTop: 1 }}>
              {directorName}
            </div>
          )}
          {noted && (
            <div
              style={{ fontFamily: F.hand, fontSize: 14, color: alpha(C.ink, 0.5), marginTop: 1 }}
            >
              {step.why}
            </div>
          )}
          {chevrons}
        </div>
      </li>
    );

  /* ------------------------------------------------------------
     LA STATION SUR LE RAIL
     ------------------------------------------------------------ */
  return (
    <li
      {...shared}
      style={{
        listStyle: "none",
        flexShrink: 0,
        width: CARD,
        padding: "0 5px",
        /* Le repère de dépôt est DANS le flux : un trait posé en
           coordonnées d'écran devrait quitter la colonne de vue, que
           `[data-enters]` transforme pendant son entrée. */
        borderLeft: `2px solid ${marked ? C.burgundy : "transparent"}`,
        boxSizing: "border-box",
      }}
    >
      {/* LE BANDEAU DU CINÉASTE. Ouvert sur la première station d'une
          suite, fermé sur la dernière ; muet au milieu, où répéter le
          nom ne dirait rien de plus. */}
      <div
        style={{
          height: BAND_H,
          display: "flex",
          alignItems: "center",
          borderTop: `1px solid ${directorName ? alpha(C.ink, 0.35) : "transparent"}`,
          borderLeft: bandStart && directorName ? `1px solid ${alpha(C.ink, 0.35)}` : undefined,
          borderRight: bandEnd && directorName ? `1px solid ${alpha(C.ink, 0.35)}` : undefined,
          paddingLeft: bandStart ? 4 : 0,
          overflow: "hidden",
        }}
      >
        {bandStart && directorName && (
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 8.5,
              letterSpacing: 1,
              color: alpha(C.ink, 0.65),
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {directorName}
          </span>
        )}
      </div>

      {/* LA CASE EST À CÔTÉ DU BOUTON, PAS DEDANS. Une commande dans une
          commande est du HTML invalide, et le bouton de l'affiche y
          prenait pour NOM le libellé de la case — deux boutons portant
          la même chose, et rien ne disait plus lequel ouvrait la fiche. */}
      <div style={{ position: "relative", height: POSTER_H }}>
        <button
          onClick={onPick}
          aria-pressed={picked}
          aria-label={t("lineage.openStep", { title: film.title })}
          style={{
            ...bare,
            display: "block",
            width: "100%",
            height: "100%",
            padding: 0,
            position: "relative",
            outline: picked ? `2px solid ${C.plum}` : selected ? `2px solid ${C.ochre}` : undefined,
            outlineOffset: -1,
          }}
        >
          <PosterArt film={film} initials={initialsOf(film.title)} width={CARD} plain lazy />
          {/* La mise en avant par la carte des cinéastes : un voile, et
              non un `filter` — la bande défile. */}
          {lit && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: alpha(C.plum, 0.3),
                pointerEvents: "none",
              }}
            />
          )}
        </button>
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            display: "flex",
            alignItems: "center",
            background: showBox ? alpha(C.card, 0.85) : "transparent",
            padding: showBox ? 2 : 0,
          }}
        >
          {box}
        </span>
      </div>

      {/* LA PERLE SUR LE RAIL. Le trait, lui, est tiré d'une seule pièce
          par la bande : voir `OrderStrip`. */}
      <div style={{ height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 9,
            lineHeight: "16px",
            minWidth: 16,
            height: 16,
            textAlign: "center",
            borderRadius: 8,
            border: `1px solid ${selected ? C.ochre : alpha(C.ink, 0.45)}`,
            background: selected ? C.ochre : C.paper,
            color: selected ? C.card : C.inkFaded,
          }}
        >
          {place}
        </span>
      </div>

      <div style={{ minWidth: 0 }}>
        <button
          onClick={onPick}
          style={{
            ...bare,
            width: "100%",
            color: C.ink,
            fontFamily: F.body,
            fontSize: 12.5,
            lineHeight: 1.25,
            textAlign: "left",
            display: "block",
          }}
        >
          {film.title}
        </button>
        {film.year && (
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, marginTop: 1 }}>
            {film.year}
          </div>
        )}
        {noted && (
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 13,
              color: alpha(C.ink, 0.5),
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {step.why}
          </div>
        )}
        {chevrons}
      </div>
    </li>
  );
}
