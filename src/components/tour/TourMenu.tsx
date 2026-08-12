/* ============================================================
   THE HELP MENU — two doors, not one more

   Panel and veil taken from the skin picker: it is the house pattern for
   a small panel that closes on a click beside it (`data-veil` is honoured
   by a global rule in the tokens).
   ============================================================ */
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { TOURS, tourForView } from "./steps";

export function TourMenu({
  view,
  onPlay,
  onClose,
}: {
  view: string;
  onPlay: (tourId: string) => void;
  onClose: () => void;
}) {
  const page = tourForView(view);

  return (
    <>
      <div onClick={onClose} data-veil style={{ position: "fixed", inset: 0, zIndex: 59 }} />
      <div
        style={{
          position: "fixed",
          left: 58,
          bottom: 22,
          zIndex: 60,
          width: 262,
          boxSizing: "border-box",
          padding: "14px 16px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: "2px 8px 24px rgba(20,14,8,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 1, color: C.inkFaded }}>
            LA VISITE GUIDÉE
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", color: C.inkFaded }}>
            <X size={13} />
          </button>
        </div>

        <button onClick={() => onPlay("global")} style={carries}>
          <span style={title}>{TOURS.global!.label}</span>
          <span style={under}>
            le tour du classeur, d&apos;un tab à l&apos;other — {TOURS.global!.steps.length} steps
          </span>
        </button>

        {/* The page tour is not greyed out when it is missing: it is
            simply not there. A dead button gets clicked anyway, and does
            not answer — which reads as a failure. */}
        {page ? (
          <button onClick={() => onPlay(view)} style={carries}>
            <span style={title}>Cette page</span>
            <span style={under}>
              {page.label.toLowerCase()} — {page.steps.length}{" "}
              {page.steps.length > 1 ? "étapes" : "étape"}
            </span>
          </button>
        ) : (
          <div style={{ ...under, marginTop: 12 }}>cette page n&apos;a pas de visite à elle</div>
        )}

        <div
          style={{
            fontFamily: F.hand,
            fontSize: 15,
            color: C.inkFaded,
            marginTop: 12,
            borderTop: `1px solid ${C.line}`,
            paddingTop: 8,
            lineHeight: 1.3,
          }}
        >
          les flèches du clavier feuillettent, Échap referme
        </div>
      </div>
    </>
  );
}

const carries: CSSProperties = {
  all: "unset",
  ...tap,
  cursor: "pointer",
  boxSizing: "border-box",
  display: "block",
  width: "100%",
  marginTop: 10,
  padding: "9px 11px",
  background: C.paperDark,
  border: `1px solid ${C.line}`,
};

const title: CSSProperties = {
  display: "block",
  fontFamily: F.title,
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: 16,
  color: C.ink,
};

const under: CSSProperties = {
  display: "block",
  fontFamily: F.hand,
  fontSize: 15,
  color: C.inkFaded,
  marginTop: 1,
};
