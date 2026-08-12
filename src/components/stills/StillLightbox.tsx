import { useEffect } from "react";
import { Calque } from "../ui/Calque";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { IdbImage } from "./IdbImage";
import type { Still } from "../../types";

const ARROW_COL = {
  all: "unset",
  ...tap,
  cursor: "pointer",
  width: "16%",
  minWidth: 90,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: `${alpha(C.paper, 0.6)}`,
  fontSize: 44,
  fontFamily: F.title,
} as const;

/* The full-screen viewer, with keyboard navigation. */
export function StillLightbox({
  stills,
  index,
  onClose,
  onIndex,
}: {
  stills: Still[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const still = stills[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % stills.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + stills.length) % stills.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stills.length, onClose, onIndex]);

  /* THE PAGE BEHIND DOES NOT SCROLL.

     The viewer takes the whole screen, but the film's card stays
     underneath with all its height: the vertical bar went on showing at
     the edge, and the wheel slid a page nobody can see. An image looked
     at large is a full screen, not a window laid over something else.

     On `html` and not on `body`: it is the root element's overflow that
     propagates to the window. The previous value is put back as it was —
     empty most of the time, and the style sheet takes over again. */
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflowY;
    root.style.overflowY = "hidden";
    return () => {
      root.style.overflowY = before;
    };
  }, []);
  if (!still) return null;

  return (
    <Calque>
      /* Closing only fires on the backdrop itself (`e.target` = the veil), never on what it
      contains: aiming beside the image no longer closes the viewer by accident. */
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,15,10,0.88)",
          zIndex: 80,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
        }}
      >
        {/* `all: unset` puts the button back to inline: without `flex`, the vertical
          padding does not count and the target stays a thin strip */}
        <button
          onClick={onClose}
          title="fermer (Échap)"
          style={{
            all: "unset",
            ...tap,
            position: "absolute",
            top: 10,
            right: 14,
            cursor: "pointer",
            color: C.paper,
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <X size={22} />
        </button>

        {/* full-height navigation columns: a wide target, not a chevron */}
        {stills.length > 1 && (
          <button
            onClick={() => onIndex((index - 1 + stills.length) % stills.length)}
            title="précédente (←)"
            style={ARROW_COL}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = C.paper;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${alpha(C.paper, 0.6)}`;
            }}
          >
            ‹
          </button>
        )}

        {/* la zone centrale est entièrement sûre, marges comprises */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px 10px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              background: C.card,
              padding: 10,
              boxShadow: "0 14px 40px rgba(0,0,0,0.6)",
              maxWidth: "100%",
            }}
          >
            <IdbImage
              imageKey={still.key}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: "72vh",
                objectFit: "contain",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: F.hand,
              fontSize: 21,
              color: C.paper,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {still.caption || `capture ${index + 1}`}
            <span
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                opacity: 0.7,
                marginLeft: 10,
              }}
            >
              {index + 1} / {stills.length}
            </span>
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 9.5,
              color: `${alpha(C.paper, 0.4)}`,
              marginTop: 10,
              letterSpacing: 1,
            }}
          >
            ÉCHAP POUR FERMER
          </div>
        </div>

        {stills.length > 1 && (
          <button
            onClick={() => onIndex((index + 1) % stills.length)}
            title="suivante (→)"
            style={ARROW_COL}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = C.paper;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = `${alpha(C.paper, 0.6)}`;
            }}
          >
            ›
          </button>
        )}
      </div>
    </Calque>
  );
}
