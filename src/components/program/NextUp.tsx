/* ============================================================
   THE PINNED RUN, SEEN FROM ELSEWHERE
   ============================================================

   A PLAN THAT ONLY EXISTS ON ITS OWN SCREEN IS NOT A PLAN. One decides
   what to watch at the binder door and in the watchlist — never on the
   programming screen, which one goes to in order to COMPOSE. So the
   pinned run says what comes next where the decision is actually made,
   and nowhere else: one run, the pinned one, because naming three would
   be naming none.

   IT READS AND IT NEVER WRITES. `courseProgress` derives the state from
   the cards; nothing here can lay, move or settle a step. The only
   gesture offered is the way back to the run.

   IT IS SILENT WHEN IT HAS NOTHING TO SAY. No run, an empty one, or one
   already walked to the end: nothing is drawn. A band saying "0 of 0" is
   a band one learns to skip. */
import { useTranslation } from "react-i18next";
import { Route } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { PosterArt } from "../film/PosterArt";
import { initialsOf } from "../../domain/film";
import { courseLabel, courseProgress, pinnedCourse, stepDone } from "../../domain/course";
import type { Course } from "../../domain/course";
import type { Film } from "../../types";

/** Combien d'étapes à venir on montre. Trois : de quoi choisir, pas de
    quoi refaire la file — celle-ci est sur son écran. */
const SHOWN = 3;

interface NextUpProps {
  courses: Course[];
  films: Film[];
  onOpenFilm: (id: string) => void;
  onOpenRun: () => void;
}

export function NextUp({ courses, films, onOpenFilm, onOpenRun }: NextUpProps) {
  const { t } = useTranslation();
  const course = pinnedCourse(courses);
  if (!course) return null;

  const { done, total, next } = courseProgress(course, films);
  if (!next || total === 0) return null;

  const byId = new Map(films.map((f) => [f.id, f]));
  const ahead = course.steps
    .map((step) => ({ step, film: byId.get(step.filmId) }))
    .filter((e): e is { step: (typeof course.steps)[number]; film: Film } => !!e.film)
    .filter((e) => !stepDone(e.step, e.film))
    .slice(0, SHOWN);

  return (
    <section
      aria-label={t("program.nextInRun", { name: courseLabel(course, t("program.untitled")) })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
        padding: "10px 12px",
        border: `1px solid ${C.line}`,
        background: alpha(C.plum, 0.05),
      }}
    >
      <div style={{ minWidth: 160, flex: 1 }}>
        <button
          onClick={onOpenRun}
          style={{ ...bare, fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1.2, color: C.plum }}
        >
          <Route size={11} />
          {t("program.nextInRun", { name: courseLabel(course, t("program.untitled")) })}
        </button>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkFaded, marginTop: 2 }}>
          {t("program.progressCount", { done, total })}
        </div>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 8 }}>
        {ahead.map(({ step, film }) => (
          <li key={step.id}>
            <button
              onClick={() => onOpenFilm(film.id)}
              aria-label={film.title}
              title={film.title}
              /* Voir `ProgressBand` : `plain` exige une boîte positionnée
                 ET haute, sinon l'affiche s'échappe de la bande. */
              style={{
                ...bare,
                display: "block",
                position: "relative",
                width: 46,
                height: 69,
                padding: 0,
              }}
            >
              <PosterArt film={film} initials={initialsOf(film.title)} width={46} plain lazy />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Où ce film se tient dans un programme, dit sur sa fiche. */
export function InRun({
  placing,
  onOpenRun,
}: {
  placing: { course: Course; place: number; step: { why: string } } | null;
  onOpenRun: () => void;
}) {
  const { t } = useTranslation();
  if (!placing) return null;
  const { course, place, step } = placing;

  return (
    <div style={{ marginTop: 10, paddingLeft: 10, borderLeft: `2px solid ${C.plum}` }}>
      <button
        onClick={onOpenRun}
        style={{ ...bare, fontFamily: F.mono, fontSize: 10, color: C.plum }}
      >
        <Route size={11} />
        {t("program.inRun", { place, name: courseLabel(course, t("program.untitled")) })}
      </button>
      {/* LA NOTE DE MARGE SUIT LA FICHE. C'est la phrase qui dit pourquoi
          ce film à cette place, et la chercher voulait dire quitter la
          fiche pour l'écran du programme. */}
      {step.why.trim() && (
        <div
          style={{
            fontFamily: "var(--f-hand)",
            fontSize: 16,
            color: alpha(C.ink, 0.7),
            marginTop: 2,
          }}
        >
          {step.why}
        </div>
      )}
    </div>
  );
}
