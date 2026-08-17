/* ============================================================
   FILIATIONS — a viewing plan, and why it is that plan
   ============================================================

   Two halves that answer one another: the RUNNING ORDER on one side —
   films, in the order one means to watch them — and on the other the
   MAP of the film-makers, tied together by hand. The point is not to
   keep a list. It is to see the plan AND to understand why it is that
   plan, which is why the reasons are written in four places and none of
   them is an afterthought:

     — `Course.note`, the thesis of the whole run;
     — `Step.why`, the marginal note on one entry;
     — the bonds of a film-maker, read out beside each entry with
       nothing to fill in;
     — `Step.because`, which POINTS AT a bond and makes the reasoning
       navigable from either end: point at an entry and its bond
       thickens; click a bond and every entry calling upon it lights up.

   ONE FOCUS FOR BOTH HALVES, and it is the whole trick. A person, a
   step or a bond — never two of them at once, so nothing on screen is
   ever lit for two different reasons.

   WHAT THIS VIEW DOES NOT DO. It offers no "create a course" button on
   an empty screen: the first film dropped in makes one, exactly as
   laying a motif makes a gathering (`isEmptyCourse`). And it never
   erases a step whose card has left the collection — it says how many
   it is not drawing, and leaves them alone. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route, Trash2 } from "lucide-react";
import { C, F, alpha } from "../theme/tokens";
import { bare, chip, hollow, inked } from "../theme/styles";
import { Confirmation, Nothing, ViewHeading } from "../components/ui";
import type { ConfirmRequest } from "../components/ui";
import { OrderColumn } from "../components/lineage/OrderColumn";
import { FilmPicker } from "../components/lineage/FilmPicker";
import { LineageMap } from "../components/lineage/LineageMap";
import { BondForm } from "../components/lineage/BondForm";
import { NodePanel } from "../components/lineage/NodePanel";
import { courseLabel, courseSteps, makeCourse, withStep } from "../domain/course";
import type { Course } from "../domain/course";
import { buildLineage } from "../domain/lineageMap";
import type { Bond } from "../domain/bonds";
import { useViewport } from "../hooks/useViewport";
import type { Film } from "../types";

interface LineageViewProps {
  films: Film[];
  courses: Course[];
  bonds: Bond[];
  onCourses: (next: Course[]) => void;
  onCoursesSoon: (next: Course[]) => void;
  onBonds: (next: Bond[]) => void;
  onOpen: (filmId: string) => void;
  onOpenPerson: (key: string) => void;
}

export function LineageView({
  films,
  courses,
  bonds,
  onCourses,
  onCoursesSoon,
  onBonds,
  onOpen,
  onOpenPerson,
}: LineageViewProps) {
  const { t } = useTranslation();
  const { phone } = useViewport();
  const [openId, setOpenId] = useState<string | null>(null);
  /* Le foyer, partagé par les deux moitiés. Une personne OU une arête,
     jamais les deux : rien n'est allumé pour deux raisons à la fois. */
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [focusBond, setFocusBond] = useState<string | null>(null);
  /* Le lien seulement SURVOLÉ depuis la file : il épaissit l'arête sans
     déplacer le foyer, sinon promener la souris changerait la sélection. */
  const [pointed, setPointed] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  /* LES DEUX RETRAITS PASSENT PAR UNE CONFIRMATION, et ce ne sont pas
     les mêmes pertes. Supprimer un parcours perd un ORDRE et des notes
     — rien d'autre au monde ne les tient. Retirer un lien perd un
     savoir sur le cinéma, et laisse muettes les étapes qui l'invoquaient.
     Dans les deux cas la confirmation dit ce qui SURVIT, parce que c'est
     la question qu'on se pose la main sur le bouton. */
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const course = useMemo(
    () => courses.find((c) => c.id === openId) || courses[0] || null,
    [courses, openId]
  );

  const { nodes } = useMemo(() => buildLineage(films, bonds, course), [films, bonds, course]);
  const node = focusKey ? nodes.find((n) => n.key === focusKey) : undefined;

  /** Les fiches déjà au programme : le panneau n'offre pas de doublon. */
  const inCourse = useMemo(
    () => new Set(course ? courseSteps(course, films).map((e) => e.film.id) : []),
    [course, films]
  );

  const replace = (next: Course, settled = true) => {
    const list = courses.some((c) => c.id === next.id)
      ? courses.map((c) => (c.id === next.id ? next : c))
      : [...courses, next];
    (settled ? onCourses : onCoursesSoon)(list);
  };

  /* THE FIRST FILM MAKES THE RUN — see the header. */
  const add = (filmIds: string[]) => {
    let target = course || makeCourse();
    for (const id of filmIds) target = withStep(target, id);
    setOpenId(target.id);
    replace(target);
  };

  const askDeleteCourse = (doomed: Course) =>
    setRequest({
      title: t("lineage.confirmDeleteCourse", {
        name: courseLabel(doomed, t("lineage.untitled")),
      }),
      body: t("lineage.confirmDeleteCourseBody"),
      action: t("lineage.confirmDelete"),
      severe: true,
      onConfirm: () => {
        onCourses(courses.filter((c) => c.id !== doomed.id));
        /* On lâche le parcours ouvert plutôt que d'en désigner un autre :
           le suivant dans la liste n'est pas celui qu'on regardait. */
        setOpenId(null);
      },
    });

  const askRemoveBond = (doomed: Bond) =>
    setRequest({
      title: t("lineage.confirmRemoveBond"),
      body: t("lineage.confirmRemoveBondBody"),
      action: t("lineage.removeBond"),
      severe: true,
      onConfirm: () => {
        onBonds(bonds.filter((b) => b.id !== doomed.id));
        setFocusBond(null);
        /* `Step.because` N'EST PAS NETTOYÉ, et c'est la même règle que
           la synchro : une justification pendante est muette au rendu,
           jamais effacée. Reposer le même lien la rend telle quelle —
           l'identifiant est calculé, pas tiré. */
      },
    });

  const pickPerson = (key: string) => {
    setFocusBond(null);
    setFocusKey((k) => (k === key ? null : key));
  };

  const pickBond = (bondId: string) => {
    setFocusKey(null);
    setFocusBond((b) => (b === bondId ? null : bondId));
  };

  return (
    <ViewHeading
      icon={<Route size={22} color={C.plum} />}
      title={t("lineage.heading")}
      blurb={t("lineage.subheading")}
      wide
    >
      {courses.length > 1 && (
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}
          aria-label={t("lineage.courses")}
        >
          {courses.map((c) => {
            const here = c.id === course?.id;
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                aria-current={here ? "true" : undefined}
                style={{
                  ...bare,
                  ...chip,
                  color: here ? C.card : C.inkFaded,
                  background: here ? C.plum : "transparent",
                  borderColor: here ? C.plum : C.line,
                }}
              >
                {courseLabel(c, t("lineage.untitled"))}
              </button>
            );
          })}
        </div>
      )}

      {/* SUR TÉLÉPHONE, LES DEUX SE SUPERPOSENT ET LA COLONNE PASSE
          DEVANT : c'est elle le sujet, la carte l'explique. */}
      <div
        style={{
          display: "flex",
          flexDirection: phone ? "column" : "row",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, width: phone ? "100%" : undefined }}>
          {course ? (
            <OrderColumn
              course={course}
              films={films}
              bonds={bonds}
              focusKey={focusKey}
              focusBond={focusBond}
              onPointBond={setPointed}
              onLinkDirector={(name) => setLinking(name)}
              onCourse={(next) => replace(next)}
              onCourseSoon={(next) => replace(next, false)}
              onOpen={onOpen}
            />
          ) : (
            <Nothing what={t("lineage.empty")} />
          )}

          <div
            style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${alpha(C.line, 0.8)}` }}
          >
            <FilmPicker
              films={films}
              onPick={(film) => add([film.id])}
              tour="lineage-add"
              label={course ? t("lineage.addToRun") : t("lineage.addFirst")}
            />
          </div>

          {/* A SECOND RUN IS ONLY OFFERED ONCE THE FIRST HOLDS SOMETHING:
              otherwise it would put an empty course beside an empty
              course, and neither is ever stored anyway. */}
          {course && course.steps.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
              <button
                onClick={() => {
                  const fresh = makeCourse();
                  setOpenId(fresh.id);
                  onCoursesSoon([...courses, fresh]);
                }}
                style={{ ...inked(C.ink), ...hollow, fontFamily: F.mono }}
              >
                {t("lineage.newCourse")}
              </button>
              <button
                onClick={() => askDeleteCourse(course)}
                style={{ ...inked(C.ink), ...hollow, fontFamily: F.mono, color: C.burgundy }}
              >
                <Trash2 size={12} />
                {t("lineage.deleteCourse")}
              </button>
            </div>
          )}
        </div>

        <div
          style={{ flex: 1, minWidth: 0, width: phone ? "100%" : undefined, position: "relative" }}
        >
          <LineageMap
            films={films}
            bonds={bonds}
            course={course}
            focusKey={focusKey}
            focusBond={focusBond || pointed}
            onPickPerson={pickPerson}
            onPickBond={pickBond}
          />

          <button
            data-tour="lineage-bond"
            onClick={() => setLinking("")}
            style={{ ...inked(C.plum), marginTop: 12 }}
          >
            {t("lineage.addBond")}
          </button>

          {node && (
            <NodePanel
              node={node}
              films={films}
              bonds={bonds}
              inCourse={inCourse}
              onAdd={(filmId) => add([filmId])}
              onAddAll={add}
              onOpenPerson={onOpenPerson}
              onPickBond={pickBond}
              onAddBond={(name) => setLinking(name)}
              onClose={() => setFocusKey(null)}
            />
          )}

          {/* L'ARÊTE SÉLECTIONNÉE SE RETIRE D'ICI, et pas depuis la ligne
              du SVG : une croix de six pixels sur un trait qu'on peut
              déplacer est une cible qu'on rate. */}
          {focusBond && (
            <BondRemoval bond={bonds.find((b) => b.id === focusBond)} onRemove={askRemoveBond} />
          )}
        </div>
      </div>

      {linking !== null && (
        <BondForm
          films={films}
          bonds={bonds}
          from={linking}
          onSave={(bond) => onBonds([...bonds, bond])}
          onClose={() => setLinking(null)}
        />
      )}

      <Confirmation request={request} onClose={() => setRequest(null)} />
    </ViewHeading>
  );
}

/** Le retrait d'un lien, une fois qu'on l'a choisi sur la carte. */
function BondRemoval({ bond, onRemove }: { bond?: Bond; onRemove: (bond: Bond) => void }) {
  const { t } = useTranslation();
  if (!bond) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {bond.note && (
        <div style={{ fontFamily: F.hand, fontSize: 17, color: C.inkFaded, marginBottom: 6 }}>
          {bond.note}
        </div>
      )}
      <button
        onClick={() => onRemove(bond)}
        style={{ ...inked(C.ink), ...hollow, color: C.burgundy }}
      >
        <Trash2 size={12} />
        {t("lineage.removeBond")}
      </button>
    </div>
  );
}
