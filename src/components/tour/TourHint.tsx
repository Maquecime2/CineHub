/* ============================================================
   LE RAPPEL — une fiche scotchée qui dit où la visite se retrouve

   Écarter la visite est un droit ; ne plus jamais savoir qu'elle
   existait est un piège. Cette fiche est le compromis : elle paraît une
   fois, pointe le bouton d'aide, et s'efface toute seule. Au bout de
   trois, on n'insiste plus — c'est un refus, pas un oubli.
   ============================================================ */
import { useEffect, useState } from "react";
import { CornerLeftDown, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bumpHint } from "../../services/onboarding";

/** Assez pour être lu deux fois, trop court pour gêner. */
const VIE_MS = 8000;

export function TourHint({ onReplay, onDismiss }: { onReplay: () => void; onDismiss: () => void }) {
  const [partie, setPartie] = useState(false);

  useEffect(() => {
    bumpHint();
    const t = setTimeout(() => setPartie(true), VIE_MS);
    return () => clearTimeout(t);
  }, []);

  /* Deux temps : on éteint, PUIS on démonte. Retirer le nœud d'un coup
     escamoterait la fiche au lieu de la laisser s'effacer — et sous
     `prefers-reduced-motion` la durée vaut zéro, donc les deux temps
     n'en font plus qu'un. */
  useEffect(() => {
    if (!partie) return;
    const t = setTimeout(onDismiss, 400);
    return () => clearTimeout(t);
  }, [partie, onDismiss]);

  return (
    <div
      style={{
        position: "fixed",
        left: 62,
        bottom: 22,
        zIndex: 190,
        width: 234,
        padding: "14px 16px 12px",
        boxSizing: "border-box",
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "2px 6px 18px rgba(20,14,8,0.38)",
        transform: `rotate(-1.4deg) translateY(${partie ? 14 : 0}px)`,
        opacity: partie ? 0 : 1,
        transition:
          "opacity var(--motion-slow) var(--motion-ease), transform var(--motion-slow) var(--motion-ease)",
      }}
    >
      {/* le scotch, du côté du mur */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -9,
          left: 20,
          width: 58,
          height: 18,
          background: alpha(C.ochre, 0.5),
          border: `1px solid ${alpha(C.ochre, 0.35)}`,
          transform: "rotate(-6deg)",
        }}
      />
      <button
        onClick={() => setPartie(true)}
        aria-label="Effacer ce rappel"
        style={{
          all: "unset",
          cursor: "pointer",
          position: "absolute",
          top: 8,
          right: 10,
          color: C.inkFaded,
        }}
      >
        <X size={12} />
      </button>

      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, color: C.inkFaded }}>
        LA VISITE
      </div>
      <div
        style={{
          fontFamily: F.hand,
          fontSize: 18,
          lineHeight: 1.3,
          color: C.ink,
          marginTop: 4,
        }}
      >
        Elle vous attend au pied des onglets, sous le « ? ».
      </div>
      <button
        onClick={onReplay}
        style={{
          all: "unset",
          cursor: "pointer",
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.burgundy,
          borderBottom: `1px dashed ${C.burgundy}`,
        }}
      >
        <CornerLeftDown size={12} />
        la reprendre maintenant
      </button>
    </div>
  );
}
