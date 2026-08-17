/* ============================================================
   THE RUNNING ORDER
   ============================================================

   The array is the order (`domain/course`), so this component holds no
   rank of its own and sorts nothing: it draws `course.steps` as they
   are, and every gesture hands a new array back up.

   ONE COMPONENT, TWO DIRECTIONS. A strip of posters on a desk, a column
   of them on a phone — and NOT two components. A second one would be the
   same gestures written twice, and the second copy is always the one
   that loses a keyboard binding.

   THE COLUMN IS NOT A LESSER STRIP, IT IS THE BETTER ONE ON A PHONE.
   `usePointerDrag` auto-scrolls VERTICALLY only — it reads `clientY` and
   tests `overflowY` — so a horizontal strip cannot bring an off-screen
   slot under a dragging finger. Downwards, the gesture comes free.

   IT SAYS WHAT IT HIDES. Steps whose card has left the collection are
   not drawn — reading must never write, so they stay on disk — but the
   count is stated at the foot rather than letting the strip quietly
   shrink by two entries.

   ONE SPOKEN CHANNEL AND NOT TWO. Moves are announced through `useSay`,
   the binder's single `aria-live` region. A second one placed here
   would have both talking at once over the same gesture. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { Guideline, Nothing } from "../ui";
import { useSay } from "../ui/Feedback";
import { courseSteps, move, moveBy, strandedCount, withSteps } from "../../domain/course";
import { primaryDirector } from "../../domain/lineageMap";
import type { Course, Step } from "../../domain/course";
import type { Film } from "../../types";
import { StepCard } from "./StepCard";

interface OrderStripProps {
  course: Course;
  films: Film[];
  /** La colonne du téléphone plutôt que la bande. */
  column: boolean;
  /** L'étape ouverte dans le panneau, par son identifiant. */
  pickedId: string | null;
  onPick: (stepId: string | null) => void;
  /** Le cinéaste mis en avant par la carte : ses entrées s'allument. */
  focusKey: string | null;
  /** L'arête mise en avant : les entrées qui l'invoquent s'allument. */
  focusBond: string | null;
  /** Une entrée est pointée : la carte épaissit le lien qu'elle invoque. */
  onPointBond: (bondId: string | null) => void;
  /** Pendant le geste : écriture différée. */
  onCourseSoon: (next: Course) => void;
  /** Le geste est fini : on écrit. */
  onCourse: (next: Course) => void;
}

export function OrderStrip({
  course,
  films,
  column,
  pickedId,
  onPick,
  focusKey,
  focusBond,
  onPointBond,
  onCourse,
  onCourseSoon,
}: OrderStripProps) {
  const { t } = useTranslation();
  const say = useSay();
  const [dragging, setDragging] = useState<number | null>(null);
  const [marked, setMarked] = useState<number | null>(null);

  const entries = courseSteps(course, films);
  const stranded = strandedCount(course, films);

  /** Une entrée dessinée renvoie à sa place RÉELLE dans le tableau. */
  const indexOf = (stepId: string) => course.steps.findIndex((s) => s.id === stepId);

  const announce = (steps: Step[], stepId: string) => {
    const at = steps.findIndex((s) => s.id === stepId);
    const film = films.find((f) => f.id === steps[at]?.filmId);
    if (film) say(t("lineage.moved", { title: film.title, place: at + 1, total: steps.length }));
  };

  const reorder = (from: number, to: number, stepId: string, settled: boolean) => {
    const steps = move(course.steps, from, to);
    /* `move` hands the very same array back when there was nothing to
       do — a refused move must not be announced as one that worked. */
    if (steps === course.steps) return;
    const next = withSteps(course, steps);
    if (settled) onCourse(next);
    else onCourseSoon(next);
    announce(steps, stepId);
  };

  const shift = (stepId: string, delta: number) => {
    const at = indexOf(stepId);
    const steps = moveBy(course.steps, at, delta);
    if (steps === course.steps) return;
    onCourse(withSteps(course, steps));
    announce(steps, stepId);
  };

  /* La première allumée, calculée une fois : c'est elle qu'on amène sous
     les yeux, et elle seule. */
  const litAt = entries.findIndex(({ step, film }) => {
    const d = primaryDirector(film);
    return (!!focusKey && d?.key === focusKey) || (!!focusBond && step.because === focusBond);
  });

  return (
    <div>
      {entries.length === 0 ? (
        <Nothing what={t("lineage.emptyCourse")} />
      ) : (
        <ul
          data-tour="lineage-order"
          aria-label={t("lineage.order")}
          style={{
            listStyle: "none",
            margin: 0,
            padding: column ? 0 : "0 0 6px",
            display: "flex",
            flexDirection: column ? "column" : "row",
            gap: column ? 0 : 10,
            overflowX: column ? undefined : "auto",
          }}
        >
          {entries.map(({ step, film }, drawn) => {
            const at = indexOf(step.id);
            const director = primaryDirector(film);
            /* Allumée par la carte de deux façons : parce que c'est SON
               cinéaste, ou parce qu'elle invoque CETTE arête. */
            const lit =
              (!!focusKey && director?.key === focusKey) ||
              (!!focusBond && step.because === focusBond);
            return (
              <StepCard
                key={step.id}
                step={step}
                film={film}
                place={drawn + 1}
                total={entries.length}
                directorName={director?.name ?? null}
                column={column}
                picked={pickedId === step.id}
                lit={lit}
                leading={lit && drawn === litAt}
                noted={!!step.why.trim()}
                onPick={() => onPick(pickedId === step.id ? null : step.id)}
                onPoint={(on) => onPointBond(on ? step.because : null)}
                marked={marked === at}
                onMark={(on) => setMarked(on ? at : null)}
                onMoveBy={(delta) => shift(step.id, delta)}
                onDragStart={() => setDragging(at)}
                onDropHere={() => {
                  if (dragging !== null) reorder(dragging, at, course.steps[dragging]!.id, true);
                  setDragging(null);
                }}
              />
            );
          })}
        </ul>
      )}

      {/* CE QUI A DISPARU SE DIT. Une file qui rétrécit sans un mot est
          le même défaut qu'un échec silencieux. */}
      {stranded > 0 && (
        <div style={{ marginTop: 10 }}>
          <Guideline tight>{t("lineage.stranded", { count: stranded })}</Guideline>
        </div>
      )}

      {entries.length > 1 && (
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 9.5,
            color: alpha(C.ink, 0.45),
            marginTop: 8,
            letterSpacing: 0.5,
          }}
        >
          {t(column ? "lineage.howToMove" : "lineage.howToMoveRow")}
        </div>
      )}
    </div>
  );
}
