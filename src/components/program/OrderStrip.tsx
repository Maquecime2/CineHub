/* ============================================================
   THE RUNNING ORDER
   ============================================================

   The array is the order (`domain/course`), so this component holds no
   rank of its own and sorts nothing: it draws `course.steps` as they
   are, and every gesture hands a new array back up.

   THE RAIL IS TIED IN ONE PIECE, AND NOT STATION BY STATION. Each card
   drawing its own segment leaves a hairline gap at every join — eight of
   them, and the line reads as eight dashes rather than one axis. It is
   therefore a background on the list itself, laid at `RAIL_Y`, which is
   the one number the cards and this file must agree on. That agreement
   is why `POSTER_H` is fixed and `PosterArt` is given `plain`: a 2:3
   poster and a substitute emulsion are not the same height, and the
   beads would sit at two levels.

   THE BANDS GROUP WHAT IS CONSECUTIVE, and `groupedSteps` is what says
   so — it was written for this and had never been called. Gathering
   every Ozu together would REORDER somebody's plan under cover of
   presenting it, and the plan is the one thing here that is theirs.

   ONE COMPONENT, TWO DIRECTIONS. A rail of stations on a desk, a column
   on a phone — and NOT two components. A second one would be the same
   gestures written twice, and the second copy is always the one that
   loses a keyboard binding. THE COLUMN IS NOT A LESSER RAIL, IT IS THE
   BETTER ONE ON A PHONE: `usePointerDrag` auto-scrolls VERTICALLY only —
   it reads `clientY` and tests `overflowY` — so a horizontal strip
   cannot bring an off-screen slot under a dragging finger.

   A SELECTION MOVES AS ONE, AND `moveGroup` REFUSES WHAT MAKES NO SENSE.
   Dropping a selection onto one of its own members has no answer, so the
   domain hands the same array back and nothing is written or announced —
   the same contract as `move`. Dragging a station that is NOT in the
   selection drags that station alone: a gesture must never carry more
   than it visibly grabbed.

   IT SAYS WHAT IT HIDES. Steps whose card has left the collection are
   not drawn — reading must never write, so they stay on disk — but the
   count is stated at the foot rather than letting the rail quietly
   shrink by two entries.

   ONE SPOKEN CHANNEL AND NOT TWO. Moves are announced through `useSay`,
   the binder's single `aria-live` region. A second one placed here
   would have both talking at once over the same gesture. */
import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, hollow, inked } from "../../theme/styles";
import { Guideline, Nothing } from "../ui";
import { useSay } from "../ui/Feedback";
import {
  courseSteps,
  groupedSteps,
  move,
  moveBy,
  moveGroup,
  stepDone,
  strandedCount,
  withSteps,
} from "../../domain/course";
import { primaryDirector } from "../../domain/lineageMap";
import type { Course, Step } from "../../domain/course";
import type { Film } from "../../types";
import { StepCard, RAIL_Y } from "./StepCard";

interface OrderStripProps {
  course: Course;
  films: Film[];
  /** La colonne du téléphone plutôt que le rail. */
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
  /** Le retrait d'une sélection passe par la confirmation de la vue. */
  onRemoveMany: (ids: ReadonlySet<string>, count: number) => void;
  /**
   * On écrit, et RÉGLÉ. Un réordonnancement est fini au moment où il
   * arrive — un lâcher, un chevron, une flèche — là où une frappe ne
   * l'est pas ; il n'y a donc rien à différer ici.
   */
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
  onRemoveMany,
  onCourse,
}: OrderStripProps) {
  const { t } = useTranslation();
  const say = useSay();
  const [dragging, setDragging] = useState<number | null>(null);
  const [marked, setMarked] = useState<number | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  /** D'où part une plage prise à la touche Maj. */
  const [anchor, setAnchor] = useState<string | null>(null);
  /* CE REPLI EST UN ÉTAT DE VUE, JAMAIS UN ÉTAT DE DOCUMENT. Masquer ce
     qui est fait est une façon de REGARDER le plan, pas de le réécrire :
     rien ne quitte `course.steps`, et la place annoncée reste celle qui
     est écrite — sans quoi « déplacer vers la 3ᵉ » viserait une position
     qui n'existe que sur cet écran-là, à cet instant-là. */
  const [hideDone, setHideDone] = useState(false);

  const all = courseSteps(course, films);
  const walked = all.filter((e) => stepDone(e.step, e.film)).length;
  const entries = hideDone ? all.filter((e) => !stepDone(e.step, e.film)) : all;
  const stranded = strandedCount(course, films);

  /* UNE SÉLECTION NE SURVIT PAS À CE QU'ELLE DÉSIGNE. Retirer une étape
     — ici ou depuis le panneau — laisserait sinon un compte qui parle
     d'entrées que plus rien ne dessine, et le retrait en bloc porterait
     sur des identifiants morts. */
  const alive = course.steps.map((s) => s.id).join("|");
  useEffect(() => {
    setSelected((was) => {
      const ids = new Set(course.steps.map((s) => s.id));
      if ([...was].every((id) => ids.has(id))) return was;
      return new Set([...was].filter((id) => ids.has(id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive]);

  /** Une entrée dessinée renvoie à sa place RÉELLE dans le tableau. */
  const indexOf = (stepId: string) => course.steps.findIndex((s) => s.id === stepId);

  const announce = (steps: Step[], stepId: string) => {
    const at = steps.findIndex((s) => s.id === stepId);
    const film = films.find((f) => f.id === steps[at]?.filmId);
    if (film) say(t("program.moved", { title: film.title, place: at + 1, total: steps.length }));
  };

  const reorder = (from: number, to: number, stepId: string) => {
    const steps = move(course.steps, from, to);
    /* `move` hands the very same array back when there was nothing to
       do — a refused move must not be announced as one that worked. */
    if (steps === course.steps) return;
    onCourse(withSteps(course, steps));
    announce(steps, stepId);
  };

  const reorderMany = (beforeId: string) => {
    const steps = moveGroup(course.steps, selected, beforeId);
    if (steps === course.steps) return;
    onCourse(withSteps(course, steps));
    const at = steps.findIndex((s) => selected.has(s.id));
    say(t("program.movedMany", { count: selected.size, place: at + 1 }));
  };

  const shift = (stepId: string, delta: number) => {
    const at = indexOf(stepId);
    const steps = moveBy(course.steps, at, delta);
    if (steps === course.steps) return;
    onCourse(withSteps(course, steps));
    announce(steps, stepId);
  };

  const toggle = (stepId: string) => {
    setAnchor(stepId);
    setSelected((was) => {
      const next = new Set(was);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  /* MAJ PREND UNE PLAGE, CTRL AJOUTE UNE UNITÉ, un clic nu ouvre le
     panneau et lâche la sélection. Les trois sont la convention du
     bureau ; la case à cocher est la porte de ceux qui ne l'ont pas. */
  const clicked = (stepId: string, e: ReactMouseEvent) => {
    if (e.shiftKey && anchor) {
      e.preventDefault();
      const a = entries.findIndex((x) => x.step.id === anchor);
      const b = entries.findIndex((x) => x.step.id === stepId);
      if (a < 0 || b < 0) return;
      const [low, high] = a < b ? [a, b] : [b, a];
      setSelected(new Set(entries.slice(low, high + 1).map((x) => x.step.id)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggle(stepId);
      return;
    }
    setSelected(new Set());
    setAnchor(stepId);
    onPick(pickedId === stepId ? null : stepId);
  };

  /* La première allumée, calculée une fois : c'est elle qu'on amène sous
     les yeux, et elle seule. */
  const litAt = entries.findIndex(({ step, film }) => {
    const d = primaryDirector(film);
    return (!!focusKey && d?.key === focusKey) || (!!focusBond && step.because === focusBond);
  });

  /* LES BANDEAUX. `groupedSteps` ne réunit que du CONSÉCUTIF ; on n'en
     garde ici que les bornes, parce que le rail reste une seule liste
     plate — imbriquer une liste par groupe ferait de chaque bandeau une
     entrée à parcourir au lecteur d'écran, pour une décoration. */
  const groups = groupedSteps(entries, (film) => primaryDirector(film)?.key ?? "");
  /** La place ÉCRITE, celle du document — et non le rang à l'écran. */
  const placeOf = (stepId: string): number => all.findIndex((e) => e.step.id === stepId) + 1;
  const bandStart = new Set<string>();
  const bandEnd = new Set<string>();
  for (const g of groups) {
    bandStart.add(g.entries[0]!.step.id);
    bandEnd.add(g.entries[g.entries.length - 1]!.step.id);
  }

  return (
    <div>
      {/* CE QUI EST PRIS SE DIT, ET SE LÂCHE. Une sélection invisible
          qui suit le geste suivant est la façon la plus sûre de déplacer
          huit entrées quand on en visait une. */}
      {selected.size > 0 && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 8,
            padding: "6px 10px",
            border: `1px solid ${C.ochre}`,
            background: alpha(C.ochre, 0.1),
          }}
        >
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.ink }}>
            {t("program.selected", { count: selected.size })}
          </span>
          <span style={{ fontFamily: F.hand, fontSize: 15, color: C.inkFaded, flex: 1 }}>
            {t("program.selectedHow")}
          </span>
          <button
            onClick={() => onRemoveMany(selected, selected.size)}
            style={{ ...inked(C.ink), ...hollow, color: C.burgundy }}
          >
            <X size={12} />
            {t("program.removeMany")}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ ...bare, fontFamily: F.mono, fontSize: 9.5 }}
          >
            {t("program.selectNone")}
          </button>
        </div>
      )}

      {/* CE QUI EST FAIT SE REPLIE, ET SEULEMENT À L'ŒIL. Le bouton ne
          paraît qu'une fois qu'il y a quelque chose à replier : une
          commande qui ne changerait rien est une commande qu'on essaie. */}
      {walked > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button
            onClick={() => setHideDone((h) => !h)}
            aria-pressed={hideDone}
            style={{ ...bare, fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}
          >
            {hideDone ? <Eye size={12} /> : <EyeOff size={12} />}
            {t(hideDone ? "program.showDone" : "program.hideDone", { count: walked })}
          </button>
        </div>
      )}

      {all.length === 0 ? (
        <Nothing what={t("program.emptyCourse")} />
      ) : entries.length === 0 ? (
        <Nothing what={t("program.allDone")} />
      ) : (
        <ul
          data-tour="program-order"
          aria-label={t("program.order")}
          style={{
            listStyle: "none",
            margin: 0,
            padding: column ? 0 : "0 0 6px",
            display: "flex",
            flexDirection: column ? "column" : "row",
            gap: 0,
            overflowX: column ? undefined : "auto",
            /* LE RAIL, D'UNE SEULE PIÈCE — voir l'en-tête. C'est un fond
               et non une bordure : une bordure suivrait la boîte, et le
               trait doit couper les stations à mi-hauteur. */
            ...(column
              ? null
              : {
                  backgroundImage: `linear-gradient(${alpha(C.ink, 0.4)}, ${alpha(C.ink, 0.4)})`,
                  backgroundSize: `100% 1px`,
                  backgroundPosition: `0 ${RAIL_Y}px`,
                  backgroundRepeat: "no-repeat",
                }),
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
                place={placeOf(step.id)}
                total={all.length}
                directorName={director?.name ?? null}
                column={column}
                bandStart={bandStart.has(step.id)}
                bandEnd={bandEnd.has(step.id)}
                picked={pickedId === step.id}
                selected={selected.has(step.id)}
                lit={lit}
                leading={lit && drawn === litAt}
                noted={!!step.why.trim()}
                done={stepDone(step, film)}
                onPick={(e) => clicked(step.id, e)}
                onToggle={() => toggle(step.id)}
                onPoint={(on) => onPointBond(on ? step.because : null)}
                marked={marked === at}
                onMark={(on) => setMarked(on ? at : null)}
                onMoveBy={(delta) => shift(step.id, delta)}
                onDragStart={() => setDragging(at)}
                onDropHere={() => {
                  if (dragging === null) return;
                  const held = course.steps[dragging]!.id;
                  /* Une station HORS sélection se déplace seule : un
                     geste ne doit jamais emporter plus que ce qu'il a
                     visiblement saisi. */
                  if (selected.size > 1 && selected.has(held)) reorderMany(step.id);
                  else reorder(dragging, at, held);
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
          <Guideline tight>{t("program.stranded", { count: stranded })}</Guideline>
        </div>
      )}

      {all.length > 1 && (
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 9.5,
            color: alpha(C.ink, 0.45),
            marginTop: 8,
            letterSpacing: 0.5,
          }}
        >
          {t(column ? "program.howToMove" : "program.howToMoveRow")}
        </div>
      )}
    </div>
  );
}
