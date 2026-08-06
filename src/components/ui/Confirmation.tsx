/* ============================================================
   « ÊTES-VOUS SÛR ? » — une fiche posée sur la page
   ============================================================

   Deux gestes de la fiche ne se rattrapent pas de la même façon :
   supprimer efface pour de bon, mettre de côté range ailleurs. Ils
   étaient pourtant tous les deux à un clic, dans le même carton, écrits
   de la même encre — et « mettre de côté » se lit très vite comme
   « supprimer » quand on va vite.

   La demande de confirmation dit donc DEUX choses : ce qui va se passer,
   et ce qu'il en coûtera de se tromper. D'où le ton, qui change avec le
   danger : le bordeaux pour l'irréversible, l'encre ordinaire pour ce qui
   se défait d'un second clic.

   Pas de `window.confirm` : il ne sait pas dire « douze films portent ce
   motif », et son cadre gris tombe au milieu du carnet comme un
   avertissement de navigateur — ce qu'il est. */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { C, F } from "../../theme/tokens";
import { Tape } from "../atmosphere";

export interface DemandeConfirmation {
  titre: string;
  /** Ce qui va se passer, en une phrase. */
  corps?: string;
  /** Le mot écrit sur le bouton qui engage. */
  action: string;
  /** Vrai quand le geste ne se rattrape pas : le bouton passe au bordeaux. */
  grave?: boolean;
  onConfirm: () => void;
}

export function Confirmation({
  demande,
  onClose,
}: {
  demande: DemandeConfirmation | null;
  onClose: () => void;
}) {
  const boutonRef = useRef<HTMLButtonElement | null>(null);

  /* Échap renonce, et le bouton qui engage prend le clavier — mais c'est
     RENONCER qui est le geste par défaut : on ouvre cette fiche parce
     qu'on doute, et un Entrée réflexe ne doit pas valider une
     suppression. */
  useEffect(() => {
    if (!demande) return;
    boutonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demande, onClose]);

  if (!demande) return null;
  const encre = demande.grave ? C.burgundy : C.ink;

  /* MONTÉE SUR LE CORPS DE LA PAGE, PAS LÀ OÙ ON L'APPELLE.

     Les vues vivent dans la colonne `[data-enters]`, qui porte une
     transformation le temps de son animation d'entrée. Une
     transformation fait de son élément le repère des `position: fixed`
     qu'il contient : la fiche s'ancrait alors sur la colonne — donc sur
     le haut du document — et une confirmation demandée en bas d'une
     page longue s'ouvrait hors de l'écran. Le portail la sort de la
     colonne, et elle retrouve la fenêtre. */
  return createPortal(
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
        aria-label={demande.titre}
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
        <Tape color={encre} rotate={-6} width={64} style={{ top: -11, left: 22 }} />
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
          {demande.titre}
        </div>
        {demande.corps && (
          <div style={{ fontFamily: F.hand, fontSize: 18, color: C.inkFaded, marginBottom: 16 }}>
            {demande.corps}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 4 }}>
          <button
            ref={boutonRef}
            onClick={() => {
              demande.onConfirm();
              onClose();
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "7px 15px",
              background: encre,
              color: C.card,
              fontFamily: F.mono,
              fontSize: 10.5,
              letterSpacing: 1,
            }}
          >
            {demande.action.toUpperCase()}
          </button>
          <button
            onClick={onClose}
            style={{
              all: "unset",
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
    </div>,
    document.body
  );
}
