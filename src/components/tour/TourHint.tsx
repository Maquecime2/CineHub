/* ============================================================
   THE REMINDER — a taped card saying where the tour can be found again

   Waving the tour away is a right; never knowing again that it existed
   is a trap. This card is the compromise: it appears once, points at the
   help button, and fades on its own. After three, we stop insisting —
   that is a refusal, not an oversight.
   ============================================================ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CornerLeftDown, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { bumpHint } from "../../services/onboarding";

/** Long enough to be read twice, short enough not to be in the way. */
const VIE_MS = 8000;

export function TourHint({ onReplay, onDismiss }: { onReplay: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  const [partie, setPartie] = useState(false);

  useEffect(() => {
    bumpHint();
    const t = setTimeout(() => setPartie(true), VIE_MS);
    return () => clearTimeout(t);
  }, []);

  /* Two beats: we fade out, THEN unmount. Removing the node in one go
     would whisk the card away instead of letting it fade — and under
     `prefers-reduced-motion` the duration is zero, so the two beats
     become one. */
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
      {/* the tape, on the wall side */}
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
        aria-label={t("tour.ui.dismissHint")}
        style={{
          all: "unset",
          ...tap,
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
        {t("tour.ui.hintKicker")}
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
        {t("tour.ui.hintBody")}
      </div>
      <button
        onClick={onReplay}
        style={{
          all: "unset",
          ...tap,
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
        {t("tour.ui.hintReplay")}
      </button>
    </div>
  );
}
