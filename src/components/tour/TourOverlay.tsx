/* ============================================================
   THE GUIDE — a pierced veil, and an index card that explains

   The veil is not a square with a `clip-path` hole but FOUR rectangles
   around the target. That is simpler to animate, and above all the hole
   stays a real void: what we point at remains clickable, and one day we
   may ask the user to make the gesture rather than watch it.

   Nothing is written in it: the engine knows only steps, and the steps
   live in `steps.ts`.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { C, F, alpha } from "../../theme/tokens";
import { useViewport } from "../../hooks/useViewport";
import { tiltOf } from "../../domain/seeded";
import { Tape } from "../atmosphere";
import { markDone, markSkipped } from "../../services/onboarding";
import { TOURS } from "./steps";
import type { TourStep } from "./steps";
import { useTourTarget } from "./useTourTarget";
import type { Rect } from "./useTourTarget";

/** Above everything: modal 50, skin panel 60, drawers 60. */
const Z = 200;

/** The hole's margin around the target — the object shown can breathe. */
const PAD = 8;

const BULLE_BASE = 300;
/** Distance between the hole's edge and the card. */
const GAP = 16;

interface TourOverlayProps {
  /** Key of `TOURS`. `null`: no tour under way. */
  tourId: string | null;
  onClose: () => void;
  /** Opens a view — that is what lets the global tour travel. */
  onView: (view: string) => void;
  /**
   * Opens a tab of the film folder.
   *
   * The exact counterpart of `onView`, one notch lower: since the card is
   * read in three tabs, a step aiming at the red thread must be able to
   * open "Links" before looking for its target, failing which it would
   * pass for a missing target and be skipped.
   */
  onTab?: (tab: string) => void;
}

export function TourOverlay({ tourId, onClose, onView, onTab }: TourOverlayProps) {
  const tour = tourId ? TOURS[tourId] : undefined;
  const [i, setI] = useState(0);

  /* A tour restarted begins again from the start: picking up in the
     middle of the previous one would be the worst kind of surprise. */
  useEffect(() => {
    setI(0);
  }, [tourId]);

  const step: TourStep | undefined = tour?.steps[i];

  /* THE VIEW FIRST, THE TARGET SECOND. The change of view is asked for
     during the step's render — it is an effect, not a computation — and
     the search for the target then waits for React to have laid the
     node. */
  useEffect(() => {
    if (step?.view) onView(step.view);
    if (step?.tab) onTab?.(step.tab);
  }, [step, onView, onTab]);

  const { rect, status } = useTourTarget(step?.target ?? null, i);

  const total = tour?.steps.length ?? 0;
  const last = i >= total - 1;

  const finish = useCallback(() => {
    if (tourId) markDone(tourId);
    onClose();
  }, [tourId, onClose]);

  const skip = useCallback(() => {
    markSkipped();
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    if (last) finish();
    else setI((n) => n + 1);
  }, [last, finish]);

  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  /* A TARGET THAT CANNOT BE FOUND DOES NOT BLOCK. An empty collection
     has neither poster nor row, and half the steps aim at content:
     without this escape hatch, a new binder's first tour would stay
     stuck on an opaque veil. */
  useEffect(() => {
    if (!step || !step.target || status !== "missing") return;
    if (!step.optional) return;
    if (last) finish();
    else setI((n) => n + 1);
  }, [step, status, last, finish]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, skip, next, prev]);

  if (!tour || !step) return null;

  /* A step with no target, or whose target keeps us waiting, plays in
     the centre on a full veil: better a centred bubble than a hole
     jumping from one corner to another while the view opens. */
  const hole = step.target && status === "found" && rect ? grow(rect, PAD) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: Z, pointerEvents: "none" }}>
      <Voile hole={hole} onSkip={skip} />
      {hole && <Cadre hole={hole} />}
      <Bulle
        step={step}
        hole={hole}
        index={i}
        total={total}
        onNext={next}
        onPrev={prev}
        onSkip={skip}
        label={tour.label}
      />
    </div>
  );
}

const grow = (r: Rect, p: number): Rect => ({
  top: r.top - p,
  left: r.left - p,
  width: r.width + p * 2,
  height: r.height + p * 2,
});

/* ---------- le voile ---------- */

/* Four panels. Clicking beside what we are showing waves the tour away —
   it is the gesture everybody tries, and refusing it would hold the user
   hostage. */
function Voile({ hole, onSkip }: { hole: Rect | null; onSkip: () => void }) {
  const encre = alpha(C.ink, 0.62);
  const commun: CSSProperties = {
    position: "fixed",
    background: encre,
    pointerEvents: "auto",
    transition: "all var(--motion-slow) var(--motion-ease)",
  };
  if (!hole) return <div onClick={onSkip} style={{ ...commun, inset: 0 }} />;
  const bas = hole.top + hole.height;
  const droite = hole.left + hole.width;
  return (
    <>
      <div
        onClick={onSkip}
        style={{ ...commun, top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) }}
      />
      <div onClick={onSkip} style={{ ...commun, top: bas, left: 0, right: 0, bottom: 0 }} />
      <div
        onClick={onSkip}
        style={{
          ...commun,
          top: hole.top,
          left: 0,
          width: Math.max(hole.left, 0),
          height: hole.height,
        }}
      />
      <div
        onClick={onSkip}
        style={{ ...commun, top: hole.top, left: droite, right: 0, height: hole.height }}
      />
    </>
  );
}

/** The hole's outline — without it, the void reads as an accident. */
function Cadre({ hole }: { hole: Rect }) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: hole.top,
        left: hole.left,
        width: hole.width,
        height: hole.height,
        border: `1px solid ${C.burgundy}`,
        borderRadius: 3,
        boxShadow: `0 0 0 1px ${alpha(C.card, 0.35)}`,
        pointerEvents: "none",
        transition: "all var(--motion-slow) var(--motion-ease)",
      }}
    />
  );
}

/* ---------- la fiche ---------- */

function Bulle({
  step,
  hole,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
  label,
}: {
  step: TourStep;
  hole: Rect | null;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  label: string;
}) {
  /* NO SIDE IS FREE ON A PHONE.

     A three-hundred-pixel card laid "to the right" of a target, in a
     window three hundred and ninety wide, has no right: the clamping
     brought it back over the target, and the tour then showed a thing by
     hiding it. In the centre it hides only the veil — and the hole goes
     on pointing. */
  const { phone } = useViewport();
  const pos = placer(hole, phone ? "center" : step.placement);
  /* The tilt is sown from the step's rank: the same card always leans
     the same way, like all the site's disorder. */
  const tilt = Number(tiltOf(`bulle-${index}`)) / 2.4;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: "fixed",
        /* It only shrinks when it has to: on a desktop it is the same
           card as before, to the pixel. */
        width: `min(${BULLE_BASE}px, calc(100vw - 24px))`,
        maxWidth: "100%",
        boxSizing: "border-box",
        padding: "18px 20px 14px",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "3px 8px 22px rgba(20,14,8,0.45)",
        pointerEvents: "auto",
        transform: `rotate(${tilt.toFixed(2)}deg)`,
        transition:
          "top var(--motion-slow) var(--motion-ease), left var(--motion-slow) var(--motion-ease)",
        ...pos,
      }}
    >
      <Tape color={alpha(C.ochre, 0.55)} rotate={-5} width={64} style={{ top: -11, left: 22 }} />

      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9,
          letterSpacing: 1.2,
          color: C.inkFaded,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: F.title,
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: 21,
          color: C.ink,
          marginTop: 2,
        }}
      >
        {step.title}
      </div>
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 18,
          lineHeight: 1.35,
          color: C.inkFaded,
          marginTop: 6,
        }}
      >
        {step.body}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
          paddingTop: 10,
          borderTop: `1px dashed ${C.line}`,
        }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaded }}>
          {index + 1} / {total}
        </span>
        <button onClick={onSkip} style={lien}>
          passer
        </button>
        <div style={{ flex: 1 }} />
        {index > 0 && (
          <button onClick={onPrev} style={lien}>
            retour
          </button>
        )}
        <button
          onClick={onNext}
          style={{
            all: "unset",
            cursor: "pointer",
            padding: "6px 14px",
            fontFamily: F.mono,
            fontSize: 10.5,
            letterSpacing: "var(--tag-tracking)",
            color: C.card,
            background: C.burgundy,
            borderRadius: "var(--tag-radius)",
          }}
        >
          {index + 1 >= total ? "TERMINER" : "SUIVANT"}
        </button>
      </div>
    </div>
  );
}

const lien: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 10,
  color: C.inkFaded,
  borderBottom: `1px dashed ${C.line}`,
};

/* ---------- where to lay the card ---------- */

/* The requested side is only a wish: if the card overflows, we fold it
   to the opposite side, and failing that we clamp it inside the window. A
   bubble half off the screen is worse than badly placed. */
function placer(hole: Rect | null, placement: TourStep["placement"]): CSSProperties {
  const W = window.innerWidth;
  const H = window.innerHeight;
  /* The card shrinks with the window: the measurement used to place it
     must say the same thing as the one that draws it. */
  const BULLE_W = Math.min(BULLE_BASE, W - 24);
  /* Height unknown before measuring: we take a cautious upper bound
     rather than doing a render round trip for one pixel. */
  const HAUT = 230;

  if (!hole || placement === "center") {
    return { top: Math.max(20, H / 2 - HAUT / 2), left: Math.max(20, W / 2 - BULLE_W / 2) };
  }

  const bas = hole.top + hole.height;
  const droite = hole.left + hole.width;
  const cote = placement || "right";

  const essais: Record<string, { top: number; left: number }> = {
    right: { top: hole.top, left: droite + GAP },
    left: { top: hole.top, left: hole.left - BULLE_W - GAP },
    bottom: { top: bas + GAP, left: hole.left },
    top: { top: hole.top - HAUT - GAP, left: hole.left },
  };
  const oppose: Record<string, string> = {
    right: "left",
    left: "right",
    bottom: "top",
    top: "bottom",
  };

  const tient = (p: { top: number; left: number }) =>
    p.left >= 8 && p.left + BULLE_W <= W - 8 && p.top >= 8 && p.top + HAUT <= H - 8;

  const choix = tient(essais[cote]!)
    ? essais[cote]!
    : tient(essais[oppose[cote]!]!)
      ? essais[oppose[cote]!]!
      : essais[cote]!;

  return {
    top: Math.min(Math.max(choix.top, 8), Math.max(8, H - HAUT - 8)),
    left: Math.min(Math.max(choix.left, 8), Math.max(8, W - BULLE_W - 8)),
  };
}
