/* ============================================================
   DEUX FICHES SCOTCHÉES EN BAS DE PAGE

   La première invite à poser le classeur sur l'écran d'accueil. La
   seconde dit qu'une nouvelle version attend. Elles ne paraissent
   jamais ensemble : on ne demande pas deux choses à la fois.

   Elles empruntent leur forme au rappel de la visite — une fiche de
   bristol posée de travers, avec son bout de ruban adhésif. Ce n'est pas
   une coquetterie : c'est ce qui distingue une phrase du classeur d'une
   bannière du navigateur, et l'on veut justement que celle-ci ne
   ressemble pas à celle-là.

   Montées par `Calque`, comme tout ce qui flotte : la colonne de vue est
   un contexte d'empilement et se transforme le temps d'une animation.
   ============================================================ */
import type { ReactNode } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Calque } from "../ui/Calque";

/* La fiche vit au-dessus de la barre du bas (20) et au-dessous de tout
   panneau ouvert (30) : elle informe, elle n'interrompt pas. */
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
          /* Au-dessus de la barre du bas quand elle existe : la fiche ne
             doit pas cacher les onglets qu'elle invite à garder. */
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
        {/* le bout de ruban : la fiche est scotchée, pas posée */}
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
  /** Sur iOS on explique le geste : aucune boîte de dialogue n'existe. */
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
      {/* On ne remplace RIEN sans le dire : une application qui se met à
          jour toute seule pendant qu'on écrit une note perd la note. */}
      <Phrase>Elle s'installera au rechargement. Rien de ce que vous avez rangé ne bouge.</Phrase>
      <button onClick={onRecharger} style={bouton}>
        <RefreshCw size={12} /> RECHARGER
      </button>
    </Fiche>
  );
}
