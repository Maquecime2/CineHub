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
   how many it is not drawing, and leaves them alone.

   THE BONDS ARE NOW OFFERED AS WELL, AND NEVER WRITTEN. Nobody knows by
   heart who taught whom, so an empty form asking for two names meant a
   fresh binder drew a map with not one edge on it — and therefore a run
   no step could justify. `HintHarvest` sweeps the binder's film-makers,
   `NodePanel` asks about the one clicked, and BOTH end in this form:
   `tieHint` fills it in, `submit()` has not one line for a suggestion,
   and `makeBond` -> `hasBond` -> `contradicts` stay the one door. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Route, Waypoints } from "lucide-react";
import { C, F } from "../theme/tokens";
import { hollow, inked } from "../theme/styles";
import { Confirmation, ViewHeading } from "../components/ui";
import type { ConfirmRequest } from "../components/ui";
import { RunBar, NoRun } from "../components/program/RunBar";
import { RunSettings } from "../components/program/RunSettings";
import { ProgressBand } from "../components/program/ProgressBand";
import { ThreadEvidence } from "../components/program/ThreadEvidence";
import { OrderStrip } from "../components/program/OrderStrip";
import { StepPanel } from "../components/program/StepPanel";
import { FilmPicker } from "../components/film/FilmPicker";
import { MAP_H, MAP_W } from "../components/program/LineageMap";
import { LineageSheet } from "../components/program/LineageSheet";
import { BondForm } from "../components/program/BondForm";
import { HintHarvest } from "../components/program/HintHarvest";
import { FilmQuickView } from "../components/film/FilmQuickView";
import { normalize } from "../domain/search";
import {
  courseLabel,
  courseProgress,
  courseSteps,
  makeCourse,
  pinnedCourse,
  patchStep,
  stepBond,
  withSteps,
  withStep,
  withoutSteps,
} from "../domain/course";
import type { Course } from "../domain/course";
import { buildLineage } from "../domain/lineageMap";
import { relax } from "../domain/sky";
import type { Bond, BondKind } from "../domain/bonds";
import { hintedBonds, isHinted } from "../domain/hints";
import type { Hint } from "../domain/hints";
import { useViewport } from "../hooks/useViewport";
import type { Film } from "../types";

/** Un lien en cours d'écriture, et l'étape qu'il servira à justifier. */
interface Linking {
  from: string;
  to?: string;
  /** L'étape à faire pointer sur le lien une fois posé, s'il y en a une. */
  forStep?: string;
  /** La nature proposée, quand le lien vient d'une piste. */
  kind?: BondKind;
  /** La note proposée — un renvoi à la source, jamais une phrase. */
  note?: string;
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
  /** L'étape ouverte dans le panneau. C'est un troisième foyer, et il
      est indépendant des deux autres : on lit une étape PENDANT qu'on
      regarde un cinéaste, c'est même tout l'intérêt. */
  const [pickedStep, setPickedStep] = useState<string | null>(null);
  const [linking, setLinking] = useState<Linking | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  /** La feuille des réglages : titre, thèse, fil rouge, épingle, retrait. */
  const [settling, setSettling] = useState(false);
  /**
   * Ce qu'on regarde en entier, par-dessus le plan. La FICHE et non son
   * identifiant : un aperçu venu de TMDB n'est pas au classeur, donc
   * rien ne l'y retrouverait.
   */
  const [quick, setQuick] = useState<Film | null>(null);
  /** La carte des cinéastes, ouverte par-dessus. */
  const [mapOpen, setMapOpen] = useState(false);
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

  const { nodes, links } = useMemo(
    () => buildLineage(films, bonds, course),
    [films, bonds, course]
  );
  /* LA DISPOSITION EST CALCULÉE ICI, ET NON DANS LA CARTE. `relax` est
     en O(n²) sur trois cent vingt passes : la carte se démontant à
     chaque fermeture de sa feuille, il se rejouerait à chaque ouverture.
     Rien de la fenêtre n'y entre — c'est la règle déjà écrite. */
  const placed = useMemo(() => relax(nodes, links, MAP_W, MAP_H), [nodes, links]);
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

  /* REPRENDRE CE QU'UNE MOISSON A SEMÉ. Balayer tout un classeur peut
     couvrir la carte de liens qu'on ne voulait pas, et les retirer un
     par un serait le prix d'un seul clic mal placé. La confirmation dit
     ce qui SURVIT : ce qu'on a écrit soi-même ne bouge pas — c'est la
     note qui fait la différence, donc récrire celle d'un lien proposé le
     met à l'abri. */
  const hinted = useMemo(() => hintedBonds(bonds), [bonds]);

  const askForgetHinted = () =>
    setRequest({
      title: t("program.confirmForgetHinted", { count: hinted.length }),
      body: t("program.confirmForgetHintedBody"),
      action: t("program.forgetHinted", { count: hinted.length }),
      severe: true,
      onConfirm: () => {
        onBonds(bonds.filter((b) => !isHinted(b)));
        setFocusBond(null);
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

  /* UNE PISTE REMPLIT LE FORMULAIRE, ELLE NE L'OUTREPASSE PAS. Les deux
     noms, la nature et la note arrivent posés ; `submit()` n'a pas une
     ligne pour elle, et c'est tout l'intérêt — une suggestion passe la
     même porte qu'un nom tapé de mémoire. */
  const tieHint = (hint: Hint, forStep?: string) =>
    setLinking({
      from: hint.fromName,
      to: hint.toName,
      kind: hint.kind,
      note: hint.note,
      ...(forStep ? { forStep } : {}),
    });

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
          onOpen={(id) => {
            setOpenId(id);
            setPickedStep(null);
          }}
          onNew={newCourse}
          onSettings={() => setSettling(true)}
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
          /* LE LIEN QUI JUSTIFIE LA PROCHAINE SÉANCE. Absent est le cas
             normal, et une justification pendante en fait partie :
             `stepBond` ne rend que ce qu'on tient. */
          because={progress.next ? stepBond(progress.next.step, bonds) : undefined}
          onOpenStep={setPickedStep}
          onQuick={() => progress.next && setQuick(progress.next.film)}
          onOpenFilm={progress.next ? () => onOpen(progress.next!.film.id) : undefined}
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
          {/* LA PORTE, ET SON COMPTE ÉCRIT DESSUS. C'est la seule chose
              qui dise ce qu'il y a derrière — la règle du bouton de
              moisson, qui annonce ce qu'il va dépenser. */}
          <button
            data-tour="program-map"
            onClick={() => setMapOpen(true)}
            style={{ ...inked(C.ink), ...hollow, fontFamily: F.mono }}
          >
            <Waypoints size={12} />
            {t("program.openMap", { count: bonds.length })}
          </button>
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
          /* On allume l'arête AVANT d'ouvrir : la carte s'ouvre déjà
             pointée sur ce qu'on est venu vérifier. */
          onSeeOnMap={() => {
            if (!picked.step.because) return;
            setFocusKey(null);
            setFocusBond(picked.step.because);
            setMapOpen(true);
          }}
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

      {mapOpen && (
        <LineageSheet
          placed={placed}
          links={links}
          films={films}
          bonds={bonds}
          node={node}
          focusKey={focusKey}
          focusBond={focusBond}
          hinted={hinted}
          inCourse={inCourse}
          onPickPerson={pickPerson}
          onPickBond={pickBond}
          onAdd={(filmId) => add([filmId])}
          onAddAll={add}
          onOpenPerson={onOpenPerson}
          onAddBond={(name, hint) => (hint ? tieHint(hint) : tieBond(name))}
          onHarvest={() => setHarvesting(true)}
          onForgetHinted={askForgetHinted}
          onRemoveBond={askRemoveBond}
          /* ALLUMER LE RAIL, PUIS SE RETIRER : les étapes qu'on vient
             demander sont derrière le voile. */
          onSeeSteps={(bondId) => {
            setFocusKey(null);
            setFocusBond(bondId);
            setMapOpen(false);
          }}
          onClose={() => setMapOpen(false)}
        />
      )}

      {settling && course && (
        <RunSettings
          course={course}
          films={films}
          onCourse={(next) => replace(next)}
          onCourseSoon={(next) => replace(next, false)}
          onDelete={askDeleteCourse}
          onClose={() => setSettling(false)}
        />
      )}

      {harvesting && (
        <HintHarvest
          films={films}
          bonds={bonds}
          onLay={(laid) => onBonds([...bonds, ...laid])}
          onClose={() => setHarvesting(false)}
        />
      )}

      {linking !== null && (
        <BondForm
          films={films}
          bonds={bonds}
          from={linking.from}
          to={linking.to}
          kind={linking.kind}
          note={linking.note}
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
