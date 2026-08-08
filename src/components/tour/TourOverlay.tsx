/* ============================================================
   LE MONTREUR — un voile percé, et une fiche bristol qui explique

   Le voile n'est pas un carré à trou en `clip-path` mais QUATRE
   rectangles autour de la cible. C'est plus simple à animer, et surtout
   le trou reste un vrai vide : ce qu'on montre demeure cliquable, et
   l'on pourra un jour demander à l'utilisateur de faire le geste plutôt
   que de le regarder.

   Rien n'y est écrit : le moteur ne connaît que des étapes, et les
   étapes vivent dans `steps.ts`.
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

/** Au-dessus de tout : modale 50, panneau de peaux 60, tiroirs 60. */
const Z = 200;

/** Marge du trou autour de la cible — l'objet montré respire. */
const PAD = 8;

const BULLE_BASE = 300;
/** Distance entre le bord du trou et la fiche. */
const GAP = 16;

interface TourOverlayProps {
  /** Clé de `TOURS`. `null` : aucune visite en cours. */
  tourId: string | null;
  onClose: () => void;
  /** Ouvre une vue — c'est ce qui permet à la visite globale de voyager. */
  onView: (view: string) => void;
}

export function TourOverlay({ tourId, onClose, onView }: TourOverlayProps) {
  const tour = tourId ? TOURS[tourId] : undefined;
  const [i, setI] = useState(0);

  /* Une visite relancée repart du début : reprendre au milieu de la
     précédente serait la plus mauvaise des surprises. */
  useEffect(() => {
    setI(0);
  }, [tourId]);

  const step: TourStep | undefined = tour?.steps[i];

  /* LA VUE D'ABORD, LA CIBLE ENSUITE. Le changement de vue est demandé
     pendant le rendu de l'étape — c'est un effet, pas un calcul — et la
     recherche de la cible attend ensuite que React ait posé le nœud. */
  useEffect(() => {
    if (step?.view) onView(step.view);
  }, [step, onView]);

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

  /* UNE CIBLE INTROUVABLE NE BLOQUE PAS. Une collection vide n'a ni
     affiche ni rangée, et la moitié des étapes visent du contenu : sans
     cette échappatoire, la première visite d'un classeur neuf resterait
     plantée sur un voile opaque. */
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

  /* Une étape sans cible, ou dont la cible se fait attendre, se joue au
     centre sur voile plein : mieux vaut une bulle centrée qu'un trou qui
     saute d'un coin à l'autre pendant que la vue s'ouvre. */
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

/* Quatre volets. Cliquer à côté de ce qu'on montre écarte la visite —
   c'est le geste que tout le monde tente, et le refuser serait tenir
   l'utilisateur en otage. */
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

/** Le liseré du trou — sans lui, le vide se lit comme un accident. */
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
  /* AUCUN CÔTÉ N'EST LIBRE SUR UN TÉLÉPHONE.

     Une fiche de trois cents pixels posée « à droite » d'une cible, dans
     une fenêtre de trois cent quatre-vingt-dix, n'a pas de droite : le
     bornage la ramenait sur la cible, et la visite montrait alors une
     chose en la cachant. Au centre, elle ne cache que le voile — et le
     trou, lui, continue de désigner. */
  const { phone } = useViewport();
  const pos = placer(hole, phone ? "center" : step.placement);
  /* L'inclinaison est semée sur le rang de l'étape : la même fiche
     penche toujours pareil, comme tout le désordre du site. */
  const tilt = Number(tiltOf(`bulle-${index}`)) / 2.4;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: "fixed",
        /* Elle ne rétrécit qu'au besoin : sur un bureau, c'est la même
           fiche qu'avant, au pixel. */
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

/* ---------- où poser la fiche ---------- */

/* Le côté demandé n'est qu'un vœu : si la fiche déborde, on la replie
   du côté opposé, et à défaut on la borne dans la fenêtre. Une bulle à
   moitié hors de l'écran est pire que mal placée. */
function placer(hole: Rect | null, placement: TourStep["placement"]): CSSProperties {
  const W = window.innerWidth;
  const H = window.innerHeight;
  /* La fiche se rétrécit avec la fenêtre : la mesure qui sert à la
     placer doit dire la même chose que celle qui la dessine. */
  const BULLE_W = Math.min(BULLE_BASE, W - 24);
  /* Hauteur inconnue avant mesure : on prend une borne haute prudente
     plutôt que de faire un aller-retour de rendu pour un pixel. */
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
