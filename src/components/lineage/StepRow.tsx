/* ============================================================
   ONE ENTRY IN A RUNNING ORDER
   ============================================================

   IT IS DRAGGED AND IT IS ALSO MOVED BY KEY, and the second is not a
   consolation prize. `usePointerDrag` makes the touch gesture come free
   as soon as something is `draggable="true"`, but a drag has no keyboard
   at all: without the two chevrons and `Alt+↑` / `Alt+↓`, the one
   gesture this whole screen exists for would be reachable by mouse and
   finger only.

   THE DROP MARKER IS IN THE FLOW — a rule drawn on the edge of the
   entry being crossed, not a line placed at screen coordinates. That is
   what keeps it out of `Layer`: a marker positioned by hand would have
   to leave the view column, since `[data-enters]` carries a transform
   during its entrance and anchors `position: fixed` to itself.

   NO EXPENSIVE EFFECT LIVES HERE. This column scrolls, and `filter`,
   `mixBlendMode` and stacked shadows are for moments, not for lists —
   the tilt of the marginal note comes from `tiltOf`, which is sown on
   the step and costs nothing. */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, ruledTextarea } from "../../theme/styles";
import { tiltOf } from "../../domain/seeded";
import { bondLabel } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import type { Step } from "../../domain/course";
import type { Film } from "../../types";

interface StepRowProps {
  step: Step;
  film: Film;
  /** Sa place dans la file, lue par un humain : 1 et non 0. */
  place: number;
  total: number;
  directorName: string | null;
  directorKey: string | null;
  /** Les liens du réalisateur de cette entrée. Lus, jamais saisis ici. */
  bonds: Bond[];
  /** Le lien invoqué par cette étape, s'il en nomme un qu'on tient encore. */
  because: Bond | undefined;
  onBecause: (bondId: string | null) => void;
  /** Aucun lien sur ce cinéaste : on propose d'en poser un. */
  onLinkDirector: () => void;
  /** L'entrée est mise en avant par la carte. */
  lit: boolean;
  /** La PREMIÈRE entrée allumée, celle qu'on amène sous les yeux. */
  leading: boolean;
  /** Survol ou focus : la carte épaissit le lien invoqué. */
  onPoint: (on: boolean) => void;
  onMoveBy: (delta: number) => void;
  onDragStart: () => void;
  onDropHere: () => void;
  onPatch: (patch: Partial<Step>) => void;
  onRemove: () => void;
  onOpen: () => void;
  /** L'entrée survolée pendant un glissement porte le repère de dépôt. */
  marked: boolean;
  onMark: (on: boolean) => void;
}

export function StepRow({
  step,
  film,
  place,
  total,
  directorName,
  directorKey,
  bonds,
  because,
  onBecause,
  onLinkDirector,
  lit,
  leading,
  onPoint,
  onMoveBy,
  onDragStart,
  onDropHere,
  onPatch,
  onRemove,
  onOpen,
  marked,
  onMark,
}: StepRowProps) {
  const { t } = useTranslation();
  const [writing, setWriting] = useState(false);
  const row = useRef<HTMLLIElement | null>(null);

  /* `block: "nearest"` ET RIEN D'AUTRE : la colonne bouge seulement si
     l'entrée est hors du champ. « center » recadrerait la liste entière
     à chaque clic sur la carte, y compris quand on regardait déjà la
     bonne ligne. */
  /* La méthode est APPELÉE SOUS CONDITION D'EXISTENCE : c'est une
     commodité de confort, et un environnement qui ne l'implémente pas —
     jsdom en est un — ne doit pas faire tomber la colonne entière pour
     un recadrage qu'on ne verrait pas de toute façon. */
  useEffect(() => {
    if (leading && typeof row.current?.scrollIntoView === "function")
      row.current.scrollIntoView({ block: "nearest" });
  }, [leading]);

  return (
    <li
      ref={row}
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
        /* `Alt` because the bare arrows belong to the page: a column one
           cannot scroll through with the keyboard would trade one loss
           for another. */
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        onMoveBy(e.key === "ArrowUp" ? -1 : 1);
      }}
      style={{
        listStyle: "none",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 2px",
        borderTop: `2px solid ${marked ? C.burgundy : "transparent"}`,
        borderBottom: `1px solid ${alpha(C.line, 0.7)}`,
        /* Mise en avant par un FOND et non par un `filter` : la colonne
           défile, et une teinte de fond ne coûte rien à repeindre. */
        background: lit ? alpha(C.plum, 0.09) : "transparent",
      }}
    >
      <GripVertical size={13} color={alpha(C.ink, 0.35)} style={{ marginTop: 3, flexShrink: 0 }} />

      <span
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          color: C.inkFaded,
          minWidth: 18,
          marginTop: 3,
          flexShrink: 0,
        }}
      >
        {place}
      </span>

      {/* L'ancre est posée sur CHAQUE entrée et la visite prend la
          première : un sélecteur ne rend qu'un nœud, et une ancre
          conditionnelle disparaîtrait le jour où la première entrée
          change. */}
      <div style={{ flex: 1, minWidth: 0 }} data-tour="lineage-why">
        <button
          onClick={onOpen}
          style={{ ...bare, color: C.ink, fontFamily: F.body, fontSize: 15, textAlign: "left" }}
        >
          {film.title}
        </button>
        {directorName && (
          <div style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded, marginTop: 1 }}>
            {directorName}
          </div>
        )}

        {/* WHY THIS FILM, AT THIS PLACE. Empty is the norm, so what shows
            then is an invitation and not a blank field: a column of eight
            open textareas would read as a form to fill in. */}
        {writing || step.why ? (
          <textarea
            autoFocus={writing}
            value={step.why}
            onChange={(e) => onPatch({ why: e.target.value })}
            onBlur={() => setWriting(false)}
            rows={2}
            placeholder={t("lineage.whyPlaceholder")}
            style={{ ...ruledTextarea, fontSize: 17, lineHeight: "26px", marginTop: 4 }}
          />
        ) : (
          <button
            onClick={() => setWriting(true)}
            style={{
              ...bare,
              fontFamily: F.hand,
              fontSize: 15,
              color: alpha(C.ink, 0.45),
              transform: `rotate(${tiltOf(step.id)}deg)`,
              marginTop: 2,
            }}
          >
            {t("lineage.why")}
          </button>
        )}

        {/* LES LIENS DU CINÉASTE, LUS EN CLAIR ET SANS RIEN SAISIR.
            `bondLabel` les lit DEPUIS cette personne, donc « a pour
            maître X » et non l'inverse : personne n'a à les retourner
            dans sa tête. C'est ce qui fait que le graphe se lit même
            sans regarder le graphe. */}
        {directorKey && bonds.length > 0 && (
          <div style={{ fontFamily: F.mono, fontSize: 9, color: alpha(C.ink, 0.6), marginTop: 3 }}>
            {bonds.map((b) => bondLabel(b, directorKey, t)).join(" · ")}
          </div>
        )}

        {/* LE RUBAN : la justification est un champ TYPÉ qui pointe vers
            un lien, et c'est ce qui rend le raisonnement navigable dans
            les deux sens. Sans lien sur ce cinéaste, on ne montre pas un
            sélecteur vide — on propose d'en poser un, et c'est par là
            que la carte se remplit. */}
        <div style={{ marginTop: 4 }}>
          {bonds.length === 0 ? (
            <button
              onClick={onLinkDirector}
              disabled={!directorKey}
              style={{ ...bare, fontFamily: F.mono, fontSize: 9, letterSpacing: 0.5 }}
            >
              {t("lineage.linkThisDirector")}
            </button>
          ) : (
            <label
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 5,
                fontFamily: F.mono,
                fontSize: 9,
                color: C.inkFaded,
              }}
            >
              {t("lineage.because")}
              <select
                value={because?.id || ""}
                onChange={(e) => onBecause(e.target.value || null)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${C.line}`,
                  color: because ? C.plum : C.inkFaded,
                  fontFamily: F.mono,
                  fontSize: 9,
                  maxWidth: 240,
                }}
              >
                <option value="">{t("lineage.becauseNone")}</option>
                {bonds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {directorKey ? bondLabel(b, directorKey, t) : b.id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexShrink: 0, marginTop: 1 }}>
        <button
          onClick={() => onMoveBy(-1)}
          disabled={place === 1}
          aria-label={t("lineage.moveUp")}
          title={t("lineage.moveUp")}
          style={{ ...bare, opacity: place === 1 ? 0.3 : 1, padding: 2 }}
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => onMoveBy(1)}
          disabled={place === total}
          aria-label={t("lineage.moveDown")}
          title={t("lineage.moveDown")}
          style={{ ...bare, opacity: place === total ? 0.3 : 1, padding: 2 }}
        >
          <ChevronDown size={14} />
        </button>
        <button
          onClick={onRemove}
          aria-label={t("lineage.remove")}
          title={t("lineage.remove")}
          style={{ ...bare, padding: 2 }}
        >
          <X size={13} />
        </button>
      </div>
    </li>
  );
}
