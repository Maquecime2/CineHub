/* ============================================================
   WHICH RUN, AND WHAT IT MEANS TO SHOW
   ============================================================

   THE DOOR IS EXPLICIT NOW, AND THE IMPLICIT ONE STAYS. Laying down the
   first film still makes the run — that is the ordinary way in, and it
   is the one the guided tour describes. But an empty screen offering
   nothing but a text field left people looking for a button that was
   not there, so the button exists: it is the second door, not the first.
   `isEmptyCourse` is what makes it harmless — a run with no film, no
   name and no thesis is never written to disk, so pressing it twice
   costs nothing at all.

   THE CHIPS ARE ALWAYS DRAWN, even at one run. They used to appear only
   from two upwards, which meant the one control that says "there can be
   several of these" was invisible to anybody who only ever had one.

   ON A PHONE IT IS THE CHIPS THAT SCROLL, and each carries
   `flexShrink: 0` — a soft button inside a scrolling bar shrinks
   instead of scrolling, which is the mistake the folder rail already
   documents. */
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, chip, hollow, inked, ruledTextarea, underlineInput } from "../../theme/styles";
import { courseLabel } from "../../domain/course";
import type { Course } from "../../domain/course";

interface RunBarProps {
  courses: Course[];
  course: Course | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (course: Course) => void;
  /** Pendant la frappe : écriture différée. */
  onCourseSoon: (next: Course) => void;
  /** Le champ est quitté : on écrit. */
  onCourse: (next: Course) => void;
}

export function RunBar({
  courses,
  course,
  onOpen,
  onNew,
  onDelete,
  onCourse,
  onCourseSoon,
}: RunBarProps) {
  const { t } = useTranslation();

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        data-tour="lineage-runs"
        aria-label={t("lineage.courses")}
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginBottom: 12,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {courses.map((c) => {
          const here = c.id === course?.id;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              aria-current={here ? "true" : undefined}
              style={{
                ...bare,
                ...chip,
                flexShrink: 0,
                color: here ? C.card : C.inkFaded,
                background: here ? C.plum : "transparent",
                borderColor: here ? C.plum : C.line,
              }}
            >
              {courseLabel(c, t("lineage.untitled"))}
            </button>
          );
        })}

        <button onClick={onNew} style={{ ...bare, ...chip, flexShrink: 0, borderStyle: "dashed" }}>
          <Plus size={11} />
          {t("lineage.newCourse")}
        </button>

        {course && (
          <button
            onClick={() => onDelete(course)}
            aria-label={t("lineage.deleteCourse")}
            title={t("lineage.deleteCourse")}
            style={{ ...bare, flexShrink: 0, padding: 4, marginLeft: "auto", color: C.burgundy }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* LE TITRE ET LA THÈSE. Aucun des deux n'est obligatoire : un
          parcours sans nom se lit par ce qu'il contient, et le catalogue
          le nomme. */}
      {course && (
        <>
          <input
            value={course.label}
            onChange={(e) => onCourseSoon({ ...course, label: e.target.value })}
            onBlur={() => onCourse(course)}
            placeholder={t("lineage.untitled")}
            aria-label={t("lineage.courseName")}
            style={{ ...underlineInput, fontFamily: F.title, fontSize: 24 }}
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
        </>
      )}
    </div>
  );
}

/** Ce qu'on montre quand il n'y a pas encore un seul parcours. */
export function NoRun({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginBottom: 10 }}>
        {t("lineage.empty")}
      </div>
      <button
        data-tour="lineage-runs"
        onClick={onNew}
        style={{ ...inked(C.ink), ...hollow, fontFamily: F.mono }}
      >
        <Plus size={12} />
        {t("lineage.newCourse")}
      </button>
    </div>
  );
}
