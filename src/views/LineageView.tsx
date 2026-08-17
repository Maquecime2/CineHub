/* ============================================================
   FILIATIONS — a viewing plan, and why it is that plan
   ============================================================

   TWO THINGS THAT ANSWER ONE ANOTHER, STACKED AND NOT SIDE BY SIDE. The
   MAP of the film-makers is drawn full width; the RUNNING ORDER — films,
   in the order one means to watch them — runs as a strip of posters
   directly beneath it, and the entry one picks opens a panel below that.
   They used to sit in two columns, and read as two unrelated screens
   joined by nothing but a highlight. The map explains the strip, so it
   stands over it and is the same width.

   The point is not to keep a list. It is to see the plan AND to
   understand why it is that plan, which is why the reasons are written
   in four places and none of them is an afterthought:

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

   TWO DOORS INTO A RUN, AND THE IMPLICIT ONE IS STILL THE FIRST. Laying
   down a film makes a run, exactly as laying a motif makes a gathering
   (`isEmptyCourse`) — and there is now a button as well, because an
   empty screen offering nothing but a text field left people looking for
   one. A run with no film, no name and no thesis is never written to
   disk, so the second door cannot litter anybody's binder.

   LAYING A BOND CAN JUSTIFY A STEP IN THE SAME ACT. `Linking` carries
   the step it was opened from, and a successful save both appends the
   bond and points that step at it. Before, one laid a bond in a modal,
   closed it, found the row again and opened a dropdown — four gestures
   to state one thing, which is why nobody stated it.

   AND IT NEVER ERASES a step whose card has left the collection: it says
   how many it is not drawing, and leaves them alone. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route } from "lucide-react";
import { C, F } from "../theme/tokens";
import { hollow, inked } from "../theme/styles";
import { Confirmation, ViewHeading } from "../components/ui";
import type { ConfirmRequest } from "../components/ui";
import { RunBar, NoRun } from "../components/lineage/RunBar";
import { OrderStrip } from "../components/lineage/OrderStrip";
import { StepPanel } from "../components/lineage/StepPanel";
import { FilmPicker } from "../components/lineage/FilmPicker";
import { LineageMap, MapToggle } from "../components/lineage/LineageMap";
import { BondForm } from "../components/lineage/BondForm";
import { NodePanel } from "../components/lineage/NodePanel";
import { FilmQuickView } from "../components/film/FilmQuickView";
import { normalize } from "../domain/search";
import {
  courseLabel,
  courseSteps,
  makeCourse,
  patchStep,
  withSteps,
  withStep,
  withoutSteps,
} from "../domain/course";
import type { Course } from "../domain/course";
import { buildLineage } from "../domain/lineageMap";
import type { Bond } from "../domain/bonds";
import { useViewport } from "../hooks/useViewport";
import type { Film } from "../types";

/** Un lien en cours d'écriture, et l'étape qu'il servira à justifier. */
interface Linking {
  from: string;
  to?: string;
  /** L'étape à faire pointer sur le lien une fois posé, s'il y en a une. */
  forStep?: string;
}

interface LineageViewProps {
  films: Film[];
  courses: Course[];
  bonds: Bond[];
  onCourses: (next: Course[]) => void;
  onCoursesSoon: (next: Course[]) => void;
  onBonds: (next: Bond[]) => void;
  /** Ranger au classeur une fiche venue de TMDB. */
  onAddFilm: (film: Film) => void;
  /** Écrire une fiche complétée : la vue rapide comble ses trous. */
  onUpdateFilm: (film: Film) => void;
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
  onAddFilm,
  onUpdateFilm,
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
  /** L'étape ouverte dans le panneau. C'est un troisième foyer, et il
      est indépendant des deux autres : on lit une étape PENDANT qu'on
      regarde un cinéaste, c'est même tout l'intérêt. */
  const [pickedStep, setPickedStep] = useState<string | null>(null);
  const [linking, setLinking] = useState<Linking | null>(null);
  /** La fiche dont on regarde le tout, par-dessus le plan. */
  const [quick, setQuick] = useState<string | null>(null);
  const [folded, setFolded] = useState(true);
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

  const entries = useMemo(() => (course ? courseSteps(course, films) : []), [course, films]);
  const picked = pickedStep ? entries.find((e) => e.step.id === pickedStep) : undefined;
  const quickFilm = quick ? films.find((f) => f.id === quick) : undefined;

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

  /* RANGER PUIS POSER, dans cet ordre et dans le même tick. Les deux
     écritures sont deux `setState` du même rendu, et `courseSteps` filtre
     à la LECTURE : une étape dont la fiche arriverait un rendu plus tard
     n'est pas dessinée, jamais effacée. */
  const adopt = (film: Film) => {
    onAddFilm(film);
    add([film.id]);
  };

  const newCourse = () => {
    const fresh = makeCourse();
    setOpenId(fresh.id);
    setPickedStep(null);
    /* Différé : un parcours vide n'est de toute façon jamais stocké. */
    onCoursesSoon([...courses, fresh]);
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
        setPickedStep(null);
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

  /* LE RETRAIT EN BLOC PASSE PAR LA MÊME PORTE QUE LES DEUX AUTRES, et
     dit ce qui SURVIT : les fiches restent au classeur, seul l'ordre et
     les notes de ces entrées-là s'en vont. Retirer UNE étape n'a pas de
     confirmation — un clic se refait ; huit, non. */
  const askRemoveSteps = (ids: ReadonlySet<string>, count: number) => {
    if (!course) return;
    setRequest({
      title: t("lineage.confirmRemoveSteps", { count }),
      body: t("lineage.confirmRemoveStepsBody"),
      action: t("lineage.removeMany"),
      severe: true,
      onConfirm: () => {
        replace(withoutSteps(course, ids));
        if (pickedStep && ids.has(pickedStep)) setPickedStep(null);
      },
    });
  };

  const pickPerson = (key: string) => {
    setFocusBond(null);
    setFocusKey((k) => (k === key ? null : key));
  };

  const pickBond = (bondId: string) => {
    setFocusKey(null);
    setFocusBond((b) => (b === bondId ? null : bondId));
  };

  /* LE LIEN POSÉ JUSTIFIE L'ÉTAPE D'OÙ IL EST PARTI, en un seul geste.
     Sans cela, on refermait le formulaire pour aller chercher dans une
     liste ce qu'on venait d'écrire. */
  const saveBond = (bond: Bond) => {
    onBonds([...bonds, bond]);
    if (linking?.forStep && course)
      replace(patchStep(course, linking.forStep, { because: bond.id }));
  };

  const tieBond = (from: string, to?: string, forStep?: string) =>
    setLinking({ from, ...(to ? { to } : {}), ...(forStep ? { forStep } : {}) });

  const bondButton = (
    <button
      data-tour="lineage-bond"
      onClick={() => tieBond("")}
      style={{ ...inked(C.plum), fontFamily: F.mono }}
    >
      {t("lineage.addBond")}
    </button>
  );

  return (
    <ViewHeading
      icon={<Route size={22} color={C.plum} />}
      title={t("lineage.heading")}
      blurb={t("lineage.subheading")}
      wide
    >
      {course ? (
        <RunBar
          courses={courses}
          course={course}
          onOpen={(id) => {
            setOpenId(id);
            setPickedStep(null);
          }}
          onNew={newCourse}
          onDelete={askDeleteCourse}
          onCourse={(next) => replace(next)}
          onCourseSoon={(next) => replace(next, false)}
        />
      ) : (
        <NoRun onNew={newCourse} />
      )}

      {/* LA CARTE EST AU-DESSUS DE CE QU'ELLE EXPLIQUE, et de la même
          largeur. Sur téléphone elle se replie : six cents pixels de
          graphe au-dessus du sujet le pousseraient sous la ligne de
          flottaison — et son miroir en liste, lui, reste monté. */}
      <div style={{ marginBottom: 20 }}>
        <LineageMap
          films={films}
          bonds={bonds}
          course={course}
          focusKey={focusKey}
          focusBond={focusBond || pointed}
          onPickPerson={pickPerson}
          onPickBond={pickBond}
          folded={phone && folded}
          action={
            <>
              {bondButton}
              {phone && <MapToggle folded={folded} onToggle={() => setFolded((f) => !f)} />}
            </>
          }
        />

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
            onAddBond={(name) => tieBond(name)}
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

      {course && (
        <OrderStrip
          course={course}
          films={films}
          column={phone}
          pickedId={pickedStep}
          onPick={setPickedStep}
          focusKey={focusKey}
          focusBond={focusBond}
          onPointBond={setPointed}
          onRemoveMany={askRemoveSteps}
          onCourse={(next) => replace(next)}
        />
      )}

      {picked && course && (
        <StepPanel
          step={picked.step}
          film={picked.film}
          place={entries.indexOf(picked) + 1}
          bonds={bonds}
          otherName={node?.name ?? null}
          onPatch={(patch, settled) => replace(patchStep(course, picked.step.id, patch), settled)}
          onSettle={() => replace(course)}
          onTie={(from, to) => tieBond(from, to, picked.step.id)}
          onQuick={() => setQuick(picked.film.id)}
          onRemove={() => {
            onCourses(
              courses.map((c) =>
                c.id === course.id
                  ? withSteps(
                      course,
                      course.steps.filter((s) => s.id !== picked.step.id)
                    )
                  : c
              )
            );
            setPickedStep(null);
          }}
          onOpen={() => onOpen(picked.film.id)}
          onClose={() => setPickedStep(null)}
        />
      )}

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
        <FilmPicker
          films={films}
          onPick={(film) => add([film.id])}
          onAdopt={adopt}
          tour="lineage-add"
          label={course ? t("lineage.addToRun") : t("lineage.addFirst")}
        />
      </div>

      {linking !== null && (
        <BondForm
          films={films}
          bonds={bonds}
          from={linking.from}
          to={linking.to}
          onSave={saveBond}
          onClose={() => setLinking(null)}
        />
      )}

      {quickFilm && (
        <FilmQuickView
          film={quickFilm}
          onEnrich={onUpdateFilm}
          onOpenPerson={(name) => onOpenPerson(normalize(name))}
          onOpenFilm={() => {
            setQuick(null);
            onOpen(quickFilm.id);
          }}
          onClose={() => setQuick(null)}
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
        {t("lineage.removeBond")}
      </button>
    </div>
  );
}
