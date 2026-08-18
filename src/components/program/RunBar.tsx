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
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, chip, hollow, inked, ruledTextarea, underlineInput } from "../../theme/styles";
import { courseLabel } from "../../domain/course";
import type { Course } from "../../domain/course";
import { ThreadBar } from "./ThreadBar";
import type { Film } from "../../types";

interface RunBarProps {
  courses: Course[];
  course: Course | null;
  /** Ce qu'on possède : le fil rouge n'offre que cela. */
  films: Film[];
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
  films,
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
        data-tour="program-runs"
        aria-label={t("program.courses")}
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
              {c.pinned && <Pin size={9} />}
              {courseLabel(c, t("program.untitled"))}
            </button>
          );
        })}

        <button onClick={onNew} style={{ ...bare, ...chip, flexShrink: 0, borderStyle: "dashed" }}>
          <Plus size={11} />
          {t("program.newCourse")}
        </button>

        {/* L'ÉPINGLE EST CE QUE LE RESTE DE L'APPLICATION LIT. Une fiche,
            la liste à voir et la porte du classeur parlent d'UN parcours,
            et sans épingle c'est « le dernier touché » qui décide — ce
            qui change de sujet dès qu'on renomme un autre parcours. Une
            seule à la fois, et `normalizeCourses` le garantit à la porte
            plutôt qu'ici : deux appareils épinglent chacun le leur. */}
        {course && (
          <button
            onClick={() => onCourse({ ...course, pinned: !course.pinned })}
            aria-pressed={!!course.pinned}
            aria-label={t(course.pinned ? "program.unpin" : "program.pin")}
            title={t(course.pinned ? "program.unpin" : "program.pin")}
            style={{
              ...bare,
              flexShrink: 0,
              padding: 4,
              marginLeft: "auto",
              color: course.pinned ? C.plum : C.inkFaded,
            }}
          >
            {course.pinned ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
        )}

        {course && (
          <button
            onClick={() => onDelete(course)}
            aria-label={t("program.deleteCourse")}
            title={t("program.deleteCourse")}
            style={{ ...bare, flexShrink: 0, padding: 4, color: C.burgundy }}
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
            placeholder={t("program.untitled")}
            aria-label={t("program.courseName")}
            style={{ ...underlineInput, fontFamily: F.title, fontSize: 24 }}
          />
          <textarea
            value={course.note}
            onChange={(e) => onCourseSoon({ ...course, note: e.target.value })}
            onBlur={() => onCourse(course)}
            rows={2}
            placeholder={t("program.thesisPlaceholder")}
            aria-label={t("program.thesis")}
            style={{ ...ruledTextarea, marginTop: 10 }}
          />
          <ThreadBar
            thread={course.thread}
            films={films}
            onThread={(thread) => onCourse({ ...course, thread })}
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
        {t("program.empty")}
      </div>
      <button
        data-tour="program-runs"
        onClick={onNew}
        style={{ ...inked(C.ink), ...hollow, fontFamily: F.mono }}
      >
        <Plus size={12} />
        {t("program.newCourse")}
      </button>
    </div>
  );
}
