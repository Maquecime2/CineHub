/* ============================================================
   PROGRAMMING — a viewing plan, its state, and why it is that plan
   ============================================================

   THE SUBJECT IS THE PLAN, AND THE MAP IS EVIDENCE FOR IT. This screen
   was built to programme films around a red thread, of which film-maker
   filiations were one example — and the example took the screen. A
   six-hundred-pixel graph stood above everything, the running order
   read as its footnote, and NOTHING ANYWHERE SAID HOW FAR ALONG ONE
   WAS. Three things follow, and they are the whole of this file:

     — the screen opens on `ProgressBand`: how many walked, how many
       left, and the next station in full;
     — the thread is a CHOICE (`Course.thread`) — a filiation, a motif,
       a decade, a genre, or a sentence one writes — and each draws its
       own evidence, folded, UNDER the heading rather than over it;
     — the state is DERIVED (`stepDone`): a screening later than the
       step was laid settles it, so watching a film from its own card
       advances the plan without anybody coming back to say so.

   The point is not to keep a list. It is to see the plan, to see where
   one stands in it, AND to understand why it is that plan — which is
   why the reasons are written in four places and none of them is an
   afterthought:

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
import { RunBar, NoRun } from "../components/program/RunBar";
import { ProgressBand } from "../components/program/ProgressBand";
import { ThreadEvidence } from "../components/program/ThreadEvidence";
import { OrderStrip } from "../components/program/OrderStrip";
import { StepPanel } from "../components/program/StepPanel";
import { FilmPicker } from "../components/film/FilmPicker";
import { LineageMap, MapToggle } from "../components/program/LineageMap";
import { BondForm } from "../components/program/BondForm";
import { NodePanel } from "../components/program/NodePanel";
import { FilmQuickView } from "../components/film/FilmQuickView";
import { normalize } from "../domain/search";
import {
  courseLabel,
  courseProgress,
  courseSteps,
  makeCourse,
  pinnedCourse,
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

interface ProgramViewProps {
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

export function ProgramView({
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
}: ProgramViewProps) {
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
  /**
   * Ce qu'on regarde en entier, par-dessus le plan. La FICHE et non son
   * identifiant : un aperçu venu de TMDB n'est pas au classeur, donc
   * rien ne l'y retrouverait.
   */
  const [quick, setQuick] = useState<Film | null>(null);
  const [folded, setFolded] = useState(true);
  /* LES DEUX RETRAITS PASSENT PAR UNE CONFIRMATION, et ce ne sont pas
     les mêmes pertes. Supprimer un parcours perd un ORDRE et des notes
     — rien d'autre au monde ne les tient. Retirer un lien perd un
     savoir sur le cinéma, et laisse muettes les étapes qui l'invoquaient.
     Dans les deux cas la confirmation dit ce qui SURVIT, parce que c'est
     la question qu'on se pose la main sur le bouton. */
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  /* L'ÉPINGLÉ D'ABORD, et non le premier de la liste : c'est celui dont
     le reste de l'application parle, et arriver ici sur un autre ferait
     deux réponses à la même question sur deux écrans. */
  const course = useMemo(
    () => courses.find((c) => c.id === openId) || pinnedCourse(courses),
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
  const progress = useMemo(
    () => (course ? courseProgress(course, films) : { done: 0, total: 0, next: null }),
    [course, films]
  );
  const picked = pickedStep ? entries.find((e) => e.step.id === pickedStep) : undefined;
  /* Au classeur ou simple aperçu : c'est ce qui décide si la vue rapide
     montre une note et des séances, et si elle a une fiche à compléter. */
  const quickHeld = !!quick && films.some((f) => f.id === quick.id);

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
      title: t("program.confirmDeleteCourse", {
        name: courseLabel(doomed, t("program.untitled")),
      }),
      body: t("program.confirmDeleteCourseBody"),
      action: t("program.confirmDelete"),
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
      title: t("program.confirmRemoveBond"),
      body: t("program.confirmRemoveBondBody"),
      action: t("program.removeBond"),
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
      title: t("program.confirmRemoveSteps", { count }),
      body: t("program.confirmRemoveStepsBody"),
      action: t("program.removeMany"),
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
      data-tour="program-bond"
      onClick={() => tieBond("")}
      style={{ ...inked(C.plum), fontFamily: F.mono }}
    >
      {t("program.addBond")}
    </button>
  );

  return (
    <ViewHeading
      icon={<Route size={22} color={C.plum} />}
      title={t("program.heading")}
      blurb={t("program.subheading")}
      wide
    >
      {course ? (
        <RunBar
          courses={courses}
          course={course}
          films={films}
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

      {/* LE BANDEAU EST LA PREMIÈRE CHOSE LUE. Il répond à « où j'en
          suis », qui est la question qu'on se pose en arrivant, et il ne
          se déplace pas : ce qui se compose est plus bas. */}
      {course && (
        <ProgressBand
          progress={progress}
          onOpenStep={setPickedStep}
          onQuick={() => progress.next && setQuick(progress.next.film)}
        />
      )}

      {/* LA PREUVE DU FIL ROUGE, ET UNE SEULE À LA FOIS. Sous une
          filiation, c'est la carte des cinéastes — repliée par défaut,
          parce qu'elle explique l'ordre et ne le remplace pas. Sous un
          motif, une décennie ou un genre, ce sont les fiches qu'on
          possède et qui le portent. Sous une thèse écrite à la main, il
          n'y a rien à dessiner : la phrase est déjà au-dessus. */}
      {course && course.thread.kind !== "filiation" && (
        <ThreadEvidence
          thread={course.thread}
          films={films}
          inCourse={inCourse}
          onAdd={(filmId) => add([filmId])}
          onLook={setQuick}
        />
      )}

      {(!course || course.thread.kind === "filiation") && (
        <div style={{ marginBottom: 20 }}>
          <LineageMap
            films={films}
            bonds={bonds}
            course={course}
            focusKey={focusKey}
            focusBond={focusBond || pointed}
            onPickPerson={pickPerson}
            onPickBond={pickBond}
            /* REPLIÉE PAR DÉFAUT, ET SUR TOUS LES ÉCRANS. La carte est une
             PREUVE : elle explique l'ordre, elle ne le remplace pas, et
             tant qu'elle s'ouvrait d'elle-même en pleine largeur c'est
             elle qu'on venait voir. Le repli était réservé au téléphone,
             où le graphe poussait le sujet sous la ligne de flottaison —
             la raison vaut partout, à un pli près. */
            folded={folded}
            action={
              <>
                {bondButton}
                <MapToggle folded={folded} onToggle={() => setFolded((f) => !f)} />
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
      )}

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
          onQuick={() => setQuick(picked.film)}
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
          onLook={setQuick}
          inRun={inCourse}
          tour="program-add"
          label={course ? t("program.addToRun") : t("program.addFirst")}
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

      {quick && (
        <FilmQuickView
          film={quick}
          inBinder={quickHeld}
          onEnrich={onUpdateFilm}
          onOpenPerson={(name) => onOpenPerson(normalize(name))}
          onOpenFilm={
            quickHeld
              ? () => {
                  setQuick(null);
                  onOpen(quick.id);
                }
              : undefined
          }
          /* CE QU'ON PEUT FAIRE DEPUIS LÀ, et c'est le geste même pour
             lequel on a ouvert : décider, puis poser. Une fiche du
             classeur s'ajoute telle quelle ; un aperçu TMDB passe par
             l'adoption, qui va chercher la fiche entière. */
          action={
            quickHeld ? (
              <button
                onClick={() => {
                  add([quick.id]);
                  setQuick(null);
                }}
                style={inked(C.plum)}
              >
                {t("program.addToRun")}
              </button>
            ) : undefined
          }
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
        {t("program.removeBond")}
      </button>
    </div>
  );
}
