/* ============================================================
   ONE ENTRY IN A RUNNING ORDER
   ============================================================

   IT IS A POSTER NOW, AND THAT IS THE POINT OF THE STRIP. A viewing
   plan read as a list of titles asks one to remember what each film
   looks like; read as a row of posters it is taken in at a glance, which
   is what an order is for.

   IT IS DRAGGED AND IT IS ALSO MOVED BY KEY, and the second is not a
   consolation prize. `usePointerDrag` makes the touch gesture come free
   as soon as something is `draggable="true"`, but a drag has no keyboard
   at all: without the two chevrons and `Alt` + arrows, the one gesture
   this whole screen exists for would be reachable by mouse and finger
   only. BOTH ARROW PAIRS ARE BOUND — the strip runs sideways on a desk
   and downwards on a phone, and the fingers that learnt one should not
   have to learn the other.

   THE DROP MARKER IS IN THE FLOW — a rule drawn on the edge of the entry
   being crossed, not a line placed at screen coordinates. That is what
   keeps it out of `Layer`: a marker positioned by hand would have to
   leave the view column, since `[data-enters]` carries a transform
   during its entrance and anchors `position: fixed` to itself.

   NO EXPENSIVE EFFECT LIVES HERE. A strip is a LIST — `filter`,
   `mixBlendMode` and stacked shadows are for moments — which is also why
   `PosterArt` is handed `lazy`: that prop is the project's word for
   "there are many of these on screen at once". */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { PosterArt } from "../film/PosterArt";
import { initialsOf } from "../../domain/film";
import type { Step } from "../../domain/course";
import type { Film } from "../../types";

const CARD = 118;

interface StepCardProps {
  step: Step;
  film: Film;
  /** Sa place dans la file, lue par un humain : 1 et non 0. */
  place: number;
  total: number;
  directorName: string | null;
  /** La colonne du téléphone plutôt que la bande. */
  column: boolean;
  /** C'est l'étape ouverte dans le panneau. */
  picked: boolean;
  /** L'entrée est mise en avant par la carte des cinéastes. */
  lit: boolean;
  /** La PREMIÈRE entrée allumée, celle qu'on amène sous les yeux. */
  leading: boolean;
  /** Une note de marge est écrite dessus : la carte le montre. */
  noted: boolean;
  onPick: () => void;
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
  picked,
  lit,
  leading,
  noted,
  onPick,
  onPoint,
  onMoveBy,
  onDragStart,
  onDropHere,
  marked,
  onMark,
}: StepCardProps) {
  const { t } = useTranslation();
  const card = useRef<HTMLLIElement | null>(null);

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

  const back = column ? "ArrowUp" : "ArrowLeft";
  const forth = column ? "ArrowDown" : "ArrowRight";

  return (
    <li
      ref={card}
      draggable="true"
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onMark(true);
      }}
      onDragLeave={() => onMark(false)}
      onDrop={(e) => {
        e.preventDefault();
        onMark(false);
        onDropHere();
      }}
      aria-current={lit ? "true" : undefined}
      onMouseEnter={() => onPoint(true)}
      onMouseLeave={() => onPoint(false)}
      onFocusCapture={() => onPoint(true)}
      onBlurCapture={() => onPoint(false)}
      onKeyDown={(e) => {
        /* `Alt` because the bare arrows belong to the page: a strip one
           cannot scroll through with the keyboard would trade one loss
           for another. */
        if (!e.altKey) return;
        if (e.key === back || e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          onMoveBy(-1);
        } else if (e.key === forth || e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          onMoveBy(1);
        }
      }}
      style={{
        listStyle: "none",
        flexShrink: 0,
        display: "flex",
        flexDirection: column ? "row" : "column",
        alignItems: column ? "flex-start" : "stretch",
        gap: column ? 10 : 5,
        width: column ? "100%" : CARD,
        padding: column ? "8px 4px" : 4,
        /* Le repère de dépôt suit l'axe de la bande. */
        ...(column
          ? { borderTop: `2px solid ${marked ? C.burgundy : "transparent"}` }
          : { borderLeft: `2px solid ${marked ? C.burgundy : "transparent"}` }),
        borderBottom: column ? `1px solid ${alpha(C.line, 0.7)}` : undefined,
        /* Mise en avant par un FOND et non par un `filter` : la bande
           défile, et une teinte de fond ne coûte rien à repeindre. */
        background: lit ? alpha(C.plum, 0.09) : "transparent",
      }}
    >
      <button
        onClick={onPick}
        aria-pressed={picked}
        style={{
          ...bare,
          display: "block",
          width: column ? 56 : "100%",
          flexShrink: 0,
          padding: 0,
          outline: picked ? `2px solid ${C.plum}` : undefined,
          outlineOffset: 2,
        }}
      >
        <span style={{ display: "block", position: "relative" }}>
          <PosterArt
            film={film}
            height={column ? 84 : 176}
            width={column ? 56 : CARD}
            initials={initialsOf(film.title)}
            clipSeed={place}
            lazy
          />
        </span>
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 5,
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>{place}</span>
          <button
            onClick={onPick}
            style={{
              ...bare,
              flex: 1,
              minWidth: 0,
              color: C.ink,
              fontFamily: F.body,
              fontSize: column ? 14.5 : 12.5,
              lineHeight: 1.25,
              textAlign: "left",
              display: "block",
            }}
          >
            {film.title}
          </button>
        </div>

        {directorName && (
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9,
              color: C.inkFaded,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {directorName}
          </div>
        )}

        {/* LA MARQUE D'UNE NOTE, ET PAS LA NOTE. Huit notes manuscrites
            ouvertes dans une bande en feraient un formulaire ; ce qu'on
            doit voir d'ici, c'est qu'il y a quelque chose d'écrit. */}
        {noted && (
          <div style={{ fontFamily: F.hand, fontSize: 14, color: alpha(C.ink, 0.5), marginTop: 1 }}>
            {step.why}
          </div>
        )}

        <div style={{ display: "flex", marginTop: 2 }}>
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
      </div>
    </li>
  );
}
