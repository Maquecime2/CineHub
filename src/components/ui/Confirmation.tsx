/* ============================================================
   "ARE YOU SURE?" — a card laid on the page
   ============================================================

   Two of the card's gestures cannot be taken back the same way: deleting
   erases for good, setting aside files elsewhere. Yet both sat one click
   away, in the same box, written in the same ink — and "set aside" reads
   very quickly as "delete" when you are in a hurry.

   So the confirmation request says TWO things: what is about to happen,
   and what it will cost to be wrong. Hence the tone, which changes with
   the danger: burgundy for the irreversible, ordinary ink for what a
   second click undoes.

   No `window.confirm`: it does not know how to say "twelve films carry
   this motif", and its grey frame drops into the middle of the notebook
   like a browser warning — which is what it is. */
import { useEffect, useRef } from "react";
import { Layer } from "./Layer";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Tape } from "../atmosphere";

export interface ConfirmRequest {
  title: string;
  /** What is about to happen, in one sentence. */
  body?: string;
  /** The word written on the button that commits. */
  action: string;
  /** True when the gesture cannot be taken back: the button turns burgundy. */
  severe?: boolean;
  onConfirm: () => void;
}

export function Confirmation({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /* Escape backs out, and the committing button takes the keyboard — but
     BACKING OUT is the default gesture: you open this card because you
     are in doubt, and a reflex Enter must not confirm a deletion. */
  useEffect(() => {
    if (!request) return;
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request) return null;
  const ink = request.severe ? C.burgundy : C.ink;

  /* MOUNTED ON THE PAGE BODY, NOT WHERE IT IS CALLED FROM.

     The views live in the `[data-enters]` column, which carries a
     transform for the length of its entry animation. A transform makes
     its element the reference for the `position: fixed` it contains: the
     card was therefore anchoring on the column — hence on the top of the
     document — and a confirmation asked for at the bottom of a long page
     opened off screen. The portal takes it out of the column, and it
     finds the window again. */
  return (
    <Layer>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(20,14,8,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={request.title}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: "4px 10px 30px rgba(20,14,8,0.5)",
            padding: "22px 26px 20px",
            maxWidth: 420,
            width: "100%",
            transform: "rotate(-0.4deg)",
          }}
        >
          <Tape color={ink} rotate={-6} width={64} style={{ top: -11, left: 22 }} />
          <div
            style={{
              fontFamily: F.title,
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 21,
              color: C.ink,
              marginBottom: 6,
            }}
          >
            {request.title}
          </div>
          {request.body && (
            <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginBottom: 16 }}>
              {request.body}
            </div>
          )}
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 4 }}>
            <button
              ref={buttonRef}
              onClick={() => {
                request.onConfirm();
                onClose();
              }}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                padding: "7px 15px",
                background: ink,
                color: C.card,
                fontFamily: F.mono,
                fontSize: 10.5,
                letterSpacing: 1,
              }}
            >
              {request.action.toUpperCase()}
            </button>
            <button
              onClick={onClose}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                fontFamily: F.mono,
                fontSize: 10.5,
                color: C.inkFaded,
              }}
            >
              RENONCER
            </button>
          </div>
        </div>
      </div>
    </Layer>
  );
}
