/* ============================================================
   TWO CARDS TAPED AT THE BOTTOM OF THE PAGE

   The first invites you to lay the binder on the home screen. The second
   says a new version is waiting. They never appear together: we do not
   ask two things at once.

   They borrow their shape from the tour's reminder — an index card laid
   askew, with its strip of tape. That is not an affectation: it is what
   distinguishes a sentence from the binder from a browser banner, and
   what we want precisely is for the former not to look like the latter.

   Mounted by `Calque`, like everything that floats: the view column is a
   stacking context and transforms itself for the length of an animation.
   ============================================================ */
import type { ReactNode } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Calque } from "../ui/Calque";

/* The card lives above the bottom bar (20) and below any open panel
   (30): it informs, it does not interrupt. */
const Z = 25;

function Fiche({
  children,
  tour,
  onFermer,
}: {
  children: ReactNode;
  tour?: string;
  onFermer?: () => void;
}) {
  return (
    <Calque>
      <div
        data-tour={tour}
        style={{
          position: "fixed",
          left: "max(12px, var(--safe-left))",
          right: "max(12px, var(--safe-right))",
          /* Above the bottom bar when there is one: the card must not
             hide the tabs it invites you to keep. */
          bottom: "calc(66px + var(--safe-bottom))",
          zIndex: Z,
          margin: "0 auto",
          maxWidth: 420,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px",
          background: C.card,
          border: `1px solid ${C.line}`,
          boxShadow: `2px 6px 18px ${alpha(C.ink, 0.28)}`,
          transform: "rotate(-0.5deg)",
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
            background: alpha(C.paper, 0.72),
            border: `1px solid ${alpha(C.line, 0.6)}`,
            transform: "rotate(-1.6deg)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {onFermer && (
          <button
            onClick={onFermer}
            aria-label="Écarter"
            style={{ all: "unset", ...tap, cursor: "pointer", color: C.inkFaded }}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </Calque>
  );
}

const Titre = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.title, fontStyle: "italic", fontSize: 18, color: C.ink }}>
    {children}
  </div>
);

const Phrase = ({ children }: { children: ReactNode }) => (
  <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 2 }}>
    {children}
  </div>
);

const bouton = {
  all: "unset" as const,
  ...tap,
  cursor: "pointer",
  marginTop: 8,
  padding: "6px 12px",
  gap: 6,
  fontFamily: F.mono,
  fontSize: 10.5,
  letterSpacing: 1,
  color: C.card,
  background: C.burgundy,
  border: `1px solid ${C.burgundy}`,
};

/** L'invitation à poser le classeur sur l'écran d'accueil. */
export function Installation({
  apple,
  onInstaller,
  onÉcarter,
}: {
  /** On iOS we explain the gesture: no dialog box exists. */
  apple: boolean;
  onInstaller: () => void;
  onÉcarter: () => void;
}) {
  return (
    <Fiche tour="install" onFermer={onÉcarter}>
      <Titre>Le classeur tient sur votre écran d'accueil</Titre>
      {apple ? (
        <Phrase>
          Touchez <Share size={13} style={{ verticalAlign: -2 }} /> en bas de Safari, puis « Sur
          l'écran d'accueil ». Il s'ouvrira en plein écran, et même sans réseau.
        </Phrase>
      ) : (
        <>
          <Phrase>
            Il s'ouvre alors en plein écran, sans barre d'adresse, et même sans réseau.
          </Phrase>
          <button onClick={onInstaller} style={bouton}>
            <Download size={12} /> INSTALLER
          </button>
        </>
      )}
    </Fiche>
  );
}

/** Une version neuve attend d'être posée. */
export function MiseÀJour({ onRecharger }: { onRecharger: () => void }) {
  return (
    <Fiche tour="maj">
      <Titre>Une nouvelle version est prête</Titre>
      {/* We replace NOTHING without saying so: an application that
          updates itself while one is writing a note loses the note. */}
      <Phrase>Elle s'installera au rechargement. Rien de ce que vous avez rangé ne bouge.</Phrase>
      <button onClick={onRecharger} style={bouton}>
        <RefreshCw size={12} /> RECHARGER
      </button>
    </Fiche>
  );
}
