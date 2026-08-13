/* ============================================================
   THE EXAMPLE'S CARD — sowing without saying so would be worse

   The twelve films of `services/demo` lie about the binder's contents:
   somebody opening the application for the first time sees a collection
   that is not theirs. It is there so the guided tour has something to
   show, and that is a good reason; it is not a reason to let anyone be
   misled.

   It only appears AS LONG AS THE BINDER IS NOTHING BUT THE EXAMPLE. At
   the first film added by hand, the binder becomes somebody's: the
   twelve stay — erasing them by decree would be another abuse — but the
   warning no longer has an object.

   TAPED AND NOT LAID IN THE FLOW, and that is not an affectation. A
   banner above the view column pushed everything down by some sixty
   pixels, and the almanac — which promises to fit in the window without
   a scrollbar, through a `height: 100vh` that assumes it starts at the
   top — began to scroll by exactly that height. So it borrows its shape
   and its `Layer` from the two cards of `Installation`: the binder
   already says its sentences that way.

   It stands ABOVE the place of those two, which can appear at the same
   time on a first opening. Without them, the offset is just a bit of
   margin.
   ============================================================ */
import { Info, Trash2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "../ui/Layer";

/** Like the installation cards: above the bottom bar (20), below any
 *  open panel (30). It informs, it does not interrupt. */
const Z = 25;

export function DemoBanner({ onRemove }: { onRemove: () => void }) {
  return (
    <Layer>
      <div
        role="status"
        style={{
          position: "fixed",
          left: "max(12px, var(--safe-left))",
          right: "max(12px, var(--safe-right))",
          /* 66 px for the phone's bottom bar, 92 more to leave room for
             the installation card. */
          bottom: "calc(158px + var(--safe-bottom))",
          zIndex: Z,
          margin: "0 auto",
          maxWidth: 420,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: `2px 6px 18px ${alpha(C.ink, 0.28)}`,
          transform: "rotate(0.6deg)",
          animation: "sheetIn var(--motion-slow) var(--motion-ease) backwards",
        }}
      >
        {/* the strip of tape: the card is taped, not laid */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -9,
            left: "50%",
            width: 62,
            height: 18,
            marginLeft: -31,
            background: alpha(C.ochre, 0.6),
            border: `1px solid ${alpha(C.line, 0.6)}`,
            transform: "rotate(1.4deg)",
          }}
        />
        <Info size={15} style={{ flexShrink: 0, marginTop: 3, color: C.ochre }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 18, color: C.ink }}>
            Ces douze films ne sont pas à vous
          </div>
          <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 2 }}>
            Un exemple, posé pour que la visite ait quelque chose à montrer. Gardez-le le temps de
            faire le tour, ou retirez-le tout de suite.
          </div>
          <button
            onClick={onRemove}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              /* `tap` only sets flexible inline display on a touch
                 screen; the icon and the word must line up
                 everywhere. */
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "6px 12px",
              fontFamily: F.mono,
              fontSize: 10.5,
              letterSpacing: 1,
              color: C.card,
              background: C.burgundy,
              border: `1px solid ${C.burgundy}`,
            }}
          >
            <Trash2 size={12} /> LES RETIRER
          </button>
        </div>
      </div>
    </Layer>
  );
}
