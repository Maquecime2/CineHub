/* ============================================================
   UNE FEUILLE POSÉE SUR LA TABLE
   ============================================================

   LA MÊME COQUILLE ÉTAIT ÉCRITE CINQ FOIS. Un voile, une boîte centrée,
   un titre, une croix, `Layer`, `useDialog` — recopiés dans la vue
   rapide, le panneau d'un motif, la liste ouverte, le tableau d'un défi
   et l'assistant. Elles avaient déjà divergé : deux largeurs, deux
   opacités de voile, et une seule des cinq arrêtait le clic sur la boîte
   avant qu'il ne referme tout.

   CE QU'ELLE GARANTIT, ET QUI EST LA VRAIE RAISON DE L'EXTRAIRE :

   - `Layer`, donc rendue dans le CORPS du document. La colonne de vue
     est un contexte d'empilement et porte une transformation pendant son
     animation d'entrée : un `position: fixed` rendu dedans s'ancrerait
     sur la colonne et son `z-index` ne le classerait plus que parmi ses
     voisins. C'est la règle du budget de `z-index` dans `CLAUDE.md`.
   - `useDialog`, donc le focus ENTRE, y tourne en cycle, et REVIENT au
     bouton qui a ouvert. Sans lui, ouvrir au clavier laisse le curseur
     derrière le voile et refermer renvoie au début du document.
   - Échap ferme, le voile ferme, la croix ferme — et le clic sur la
     feuille ne ferme PAS. Les trois premiers viennent de `useDialog` et
     du voile ; le quatrième est le `stopPropagation` qu'une copie sur
     cinq avait oublié.

   ELLE NE SAIT RIEN DU CONTENU, et c'est délibéré : pas de pied de
   boutons imposé, pas de « valider / annuler ». Un formulaire de
   création et un tableau de marque n'ont pas le même bas de page, et
   l'inventer ici obligerait chacun à le contourner.
   ============================================================ */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { Layer } from "./Layer";
import { useDialog } from "../../hooks/useDialog";

export function Sheet({
  title,
  /** Ce qui se lit à côté du titre — un compte, une période, un état. */
  aside,
  /** Ce qui se pose à GAUCHE du titre : un retour en arrière, une
      vignette. Rien par défaut. */
  lead,
  /** La largeur maximale. Un formulaire n'a pas besoin de la place d'une
      grille d'affiches, et l'étirer rendrait ses champs illisibles. */
  width = 760,
  tour,
  children,
  onClose,
}: {
  title: string;
  aside?: ReactNode;
  lead?: ReactNode;
  width?: number;
  tour?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  /* `autoFocus: false` : on LIT une feuille avant d'agir dessus, et
     poser le curseur sur la première commande fait sauter la lecture au
     lecteur d'écran comme à l'œil. */
  const box = useDialog(onClose, { autoFocus: false });

  return (
    <Layer>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: alpha(C.ink, 0.4),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-tour={tour}
          /* SANS CECI, CLIQUER DANS LA FEUILLE LA REFERME. Le voile est
             le PARENT de la boîte et non son frère — le sortir romprait
             le centrage — donc tout clic remonte jusqu'à lui. */
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            boxShadow: "0 10px 40px rgba(20,14,8,0.4)",
            width: `min(${width}px, 100%)`,
            maxHeight: "92vh",
            overflowY: "auto",
            padding: "22px 24px 28px",
            animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {lead}
            <span
              style={{
                fontFamily: F.title,
                fontStyle: "italic",
                fontWeight: 700,
                fontSize: 24,
                color: C.ink,
              }}
            >
              {title}
            </span>
            {aside}
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                marginLeft: "auto",
                display: "flex",
              }}
            >
              <X size={16} color={C.inkFaded} />
            </button>
          </div>

          {children}
        </div>
      </div>
    </Layer>
  );
}
