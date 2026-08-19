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

   ELLE NE RÈGLE PLUS RIEN, ELLE NAVIGUE. Le champ de titre, la thèse et
   les cinq rubans du fil rouge s'ouvraient ici en permanence, et c'est
   la moitié de l'encombrement du haut de l'écran : ils sont passés dans
   `RunSettings`, une feuille, derrière un bouton. Ce qui reste est ce
   qu'on LIT — quel parcours, comment il s'appelle, et s'il est épinglé.
   Le titre est donc un TITRE et non un champ : on doit savoir ce qu'on
   regarde sans ouvrir quoi que ce soit.

   ON A PHONE IT IS THE CHIPS THAT SCROLL, and each carries
   `flexShrink: 0` — a soft button inside a scrolling bar shrinks
   instead of scrolling, which is the mistake the folder rail already
   documents. */
import { useTranslation } from "react-i18next";
import { Pin, Plus, SlidersHorizontal } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, chip, hollow, inked } from "../../theme/styles";
import { courseLabel } from "../../domain/course";
import type { Course } from "../../domain/course";

interface RunBarProps {
  courses: Course[];
  course: Course | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** La porte des réglages : titre, thèse, fil rouge, épingle, retrait. */
  onSettings: () => void;
}

export function RunBar({ courses, course, onOpen, onNew, onSettings }: RunBarProps) {
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
      </div>

      {/* LE TITRE SE LIT, IL NE SE TAPE PLUS ICI. Et la thèse est SOUS
          lui, en manuscrit : c'est la phrase qui dit pourquoi ce plan
          est ce plan-là, et elle se relit plus souvent qu'elle ne
          s'écrit. */}
      {course && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontFamily: F.title,
                fontSize: 24,
                fontWeight: 400,
                color: course.label.trim() ? C.ink : C.inkFaded,
              }}
            >
              {courseLabel(course, t("program.untitled"))}
            </h2>
            {course.note.trim() && (
              <div
                style={{
                  fontFamily: "var(--f-hand)",
                  fontSize: 17,
                  color: alpha(C.ink, 0.7),
                  marginTop: 4,
                }}
              >
                {course.note}
              </div>
            )}
          </div>

          {/* LA VISITE VISE LA PORTE, JAMAIS LA FEUILLE : une visite ne
              peut pas ouvrir une modale. */}
          <button
            data-tour="program-thread"
            onClick={onSettings}
            style={{ ...inked(C.ink), ...hollow, flexShrink: 0, fontFamily: F.mono }}
          >
            <SlidersHorizontal size={12} />
            {t("program.runSettings")}
          </button>
        </div>
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
