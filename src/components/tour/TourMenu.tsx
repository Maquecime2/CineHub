/* ============================================================
   LE MENU D'AIDE — deux portes, pas une de plus

   Panneau et voile repris du choix des peaux : c'est le motif maison
   pour un petit panneau qui se referme au clic à côté (`data-veil` est
   honoré par une règle globale des jetons).
   ============================================================ */
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { C, F } from "../../theme/tokens";
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

        <button onClick={() => onPlay("global")} style={porte}>
          <span style={titre}>{TOURS.global!.label}</span>
          <span style={sous}>
            le tour du classeur, d&apos;un onglet à l&apos;autre — {TOURS.global!.steps.length}{" "}
            étapes
          </span>
        </button>

        {/* La visite de page n'est pas grisée quand elle manque : elle
            n'est pas là. Un bouton mort se clique quand même, et ne
            répond pas — ce qui se lit comme une panne. */}
        {page ? (
          <button onClick={() => onPlay(view)} style={porte}>
            <span style={titre}>Cette page</span>
            <span style={sous}>
              {page.label.toLowerCase()} — {page.steps.length}{" "}
              {page.steps.length > 1 ? "étapes" : "étape"}
            </span>
          </button>
        ) : (
          <div style={{ ...sous, marginTop: 12 }}>cette page n&apos;a pas de visite à elle</div>
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

const porte: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  boxSizing: "border-box",
  display: "block",
  width: "100%",
  marginTop: 10,
  padding: "9px 11px",
  background: C.paperDark,
  border: `1px solid ${C.line}`,
};

const titre: CSSProperties = {
  display: "block",
  fontFamily: F.title,
  fontStyle: "italic",
  fontWeight: 700,
  fontSize: 16,
  color: C.ink,
};

const sous: CSSProperties = {
  display: "block",
  fontFamily: F.hand,
  fontSize: 15,
  color: C.inkFaded,
  marginTop: 1,
};
