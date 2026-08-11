/* ============================================================
   LA FICHE DE L'EXEMPLE — semer sans le dire serait pire

   Les douze films de `services/demo` mentent sur le contenu du
   classeur : quelqu'un qui ouvre l'application pour la première fois
   voit une collection qui n'est pas la sienne. Elle est là pour que la
   visite guidée ait quelque chose à montrer, et c'est une bonne raison ;
   ce n'en est pas une pour laisser croire.

   Elle ne paraît que TANT QUE LE CLASSEUR N'EST QUE L'EXEMPLE. Au
   premier film ajouté à la main, le classeur devient celui de
   quelqu'un : les douze restent — les effacer d'autorité serait un autre
   abus — mais l'avertissement n'a plus d'objet.

   SCOTCHÉE ET NON POSÉE DANS LE FLUX, et ce n'est pas une coquetterie.
   Un bandeau au-dessus de la colonne de vue repoussait tout d'une
   soixantaine de pixels, et l'almanach — qui promet de tenir dans la
   fenêtre sans une barre de défilement, par un `height: 100vh` qui
   suppose qu'il commence en haut — se mettait à défiler exactement de
   cette hauteur. Elle emprunte donc sa forme et son `Calque` aux deux
   fiches de `Installation` : le classeur dit déjà ses phrases ainsi.

   Elle se tient AU-DESSUS de la place de ces deux-là, qui peuvent
   paraître en même temps sur une première ouverture. Sans elles, le
   décalage n'est qu'un peu de marge.
   ============================================================ */
import { Info, Trash2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Calque } from "../ui/Calque";

/** Comme les fiches d'installation : au-dessus de la barre du bas (20),
 *  au-dessous de tout panneau ouvert (30). Elle informe, elle
 *  n'interrompt pas. */
const Z = 25;

export function BandeauDémo({ onRetirer }: { onRetirer: () => void }) {
  return (
    <Calque>
      <div
        role="status"
        style={{
          position: "fixed",
          left: "max(12px, var(--safe-left))",
          right: "max(12px, var(--safe-right))",
          /* 66 px pour la barre du bas du téléphone, 92 de plus pour
             laisser sa place à la fiche d'installation. */
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
            onClick={onRetirer}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              /* `tap` ne pose l'affichage en ligne flexible que sur un
                 écran tactile ; l'icône et le mot doivent s'aligner
                 partout. */
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
    </Calque>
  );
}
