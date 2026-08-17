/* ============================================================
   THE RUNNING ORDER
   ============================================================

   The array is the order (`domain/course`), so this component holds no
   rank of its own and sorts nothing: it draws `course.steps` as they
   are, and every gesture hands a new array back up.

   IT SAYS WHAT IT HIDES. Steps whose card has left the collection are
   not drawn — reading must never write, so they stay on disk — but the
   count is stated at the foot rather than letting the column quietly
   shrink by two entries.

   ONE SPOKEN CHANNEL AND NOT TWO. Moves are announced through `useSay`,
   the binder's single `aria-live` region. A second one placed here
   would have both talking at once over the same gesture. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { ruledTextarea, underlineInput } from "../../theme/styles";
import { Guideline, Nothing } from "../ui";
import { useSay } from "../ui/Feedback";
import {
  courseSteps,
  move,
  moveBy,
  patchStep,
  stepBond,
  strandedCount,
  withSteps,
} from "../../domain/course";
import { primaryDirector } from "../../domain/lineageMap";
import { bondsTouching } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import type { Course, Step } from "../../domain/course";
import type { Film } from "../../types";
import { StepRow } from "./StepRow";

interface OrderColumnProps {
  course: Course;
  films: Film[];
  bonds: Bond[];
  /** Le cinéaste mis en avant par la carte : ses entrées s'allument. */
  focusKey: string | null;
  /** L'arête mise en avant : les entrées qui l'invoquent s'allument. */
  focusBond: string | null;
  /** Une entrée est pointée : la carte épaissit le lien qu'elle invoque. */
  onPointBond: (bondId: string | null) => void;
  onLinkDirector: (name: string) => void;
  /** Pendant le geste : écriture différée. */
  onCourseSoon: (next: Course) => void;
  /** Le geste est fini : on écrit. */
  onCourse: (next: Course) => void;
  onOpen: (filmId: string) => void;
}

export function OrderColumn({
  course,
  films,
  bonds,
  focusKey,
  focusBond,
  onPointBond,
  onLinkDirector,
  onCourse,
  onCourseSoon,
  onOpen,
}: OrderColumnProps) {
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

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* LE TITRE ET LA THÈSE. Aucun des deux n'est obligatoire : un
          parcours sans nom se lit par ce qu'il contient, et le catalogue
          le nomme. */}
      <input
        value={course.label}
        onChange={(e) => onCourseSoon({ ...course, label: e.target.value })}
        onBlur={() => onCourse(course)}
        placeholder={t("lineage.untitled")}
        aria-label={t("lineage.courseName")}
        style={{ ...underlineInput, fontFamily: F.title, fontSize: 22 }}
      />

      <textarea
        value={course.note}
        onChange={(e) => onCourseSoon({ ...course, note: e.target.value })}
        onBlur={() => onCourse(course)}
        rows={2}
        placeholder={t("lineage.thesisPlaceholder")}
        aria-label={t("lineage.thesis")}
        style={{ ...ruledTextarea, marginTop: 10 }}
      />

      <div data-tour="lineage-order" style={{ marginTop: 16 }}>
        {entries.length === 0 ? (
          <Nothing what={t("lineage.emptyCourse")} />
        ) : (
          <ul aria-label={t("lineage.order")} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {(() => {
              /* La première allumée, calculée une fois : c'est elle qu'on
                 amène sous les yeux, et elle seule. */
              const litAt = entries.findIndex(({ step, film }) => {
                const d = primaryDirector(film);
                return (
                  (!!focusKey && d?.key === focusKey) || (!!focusBond && step.because === focusBond)
                );
              });
              return entries.map(({ step, film }, drawn) => {
                const at = indexOf(step.id);
                const director = primaryDirector(film);
                const theirs = director ? bondsTouching(bonds, director.key) : [];
                const because = stepBond(step, bonds);
                /* Allumée par la carte de deux façons : parce que c'est SON
                 cinéaste, ou parce qu'elle invoque CETTE arête. */
                const lit =
                  (!!focusKey && director?.key === focusKey) ||
                  (!!focusBond && step.because === focusBond);
                return (
                  <StepRow
                    key={step.id}
                    step={step}
                    film={film}
                    place={drawn + 1}
                    total={entries.length}
                    directorName={director?.name ?? null}
                    directorKey={director?.key ?? null}
                    bonds={theirs}
                    because={because}
                    lit={lit}
                    leading={lit && drawn === litAt}
                    onPoint={(on) => onPointBond(on ? step.because : null)}
                    onBecause={(bondId) =>
                      onCourse(patchStep(course, step.id, { because: bondId }))
                    }
                    onLinkDirector={() => director && onLinkDirector(director.name)}
                    marked={marked === at}
                    onMark={(on) => setMarked(on ? at : null)}
                    onMoveBy={(delta) => shift(step.id, delta)}
                    onDragStart={() => setDragging(at)}
                    onDropHere={() => {
                      if (dragging !== null)
                        reorder(dragging, at, course.steps[dragging]!.id, true);
                      setDragging(null);
                    }}
                    onPatch={(patch) => onCourseSoon(patchStep(course, step.id, patch))}
                    onRemove={() =>
                      onCourse(
                        withSteps(
                          course,
                          course.steps.filter((s) => s.id !== step.id)
                        )
                      )
                    }
                    onOpen={() => onOpen(film.id)}
                  />
                );
              });
            })()}
          </ul>
        )}
      </div>

      {/* CE QUI A DISPARU SE DIT. Une colonne qui rétrécit sans un mot
          est le même défaut qu'un échec silencieux. */}
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
            marginTop: 12,
            letterSpacing: 0.5,
          }}
        >
          {t("lineage.howToMove")}
        </div>
      )}
    </div>
  );
}
