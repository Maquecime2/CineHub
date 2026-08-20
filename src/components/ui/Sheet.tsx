/* ============================================================
   UNE FEUILLE POSÉE SUR LA TABLE
   ============================================================

   LA MÊME COQUILLE ÉTAIT ÉCRITE SEPT FOIS. Un voile, une boîte, un
   titre, une croix, `Layer`, `useDialog` — recopiés dans la vue rapide,
   le panneau d'un motif, la liste ouverte, le tableau d'un défi,
   l'assistant, la création d'une liste et le tirage d'un quizz. Elles
   avaient déjà divergé : deux largeurs, deux opacités de voile, et une
   seule d'entre elles arrêtait le clic sur la boîte avant qu'il ne
   referme tout.

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
     du voile ; le quatrième est le `stopPropagation` que six copies sur
     sept avaient oublié.

   DEUX FORMES, ET LE BUDGET DE `z-index` LES SUIT. Une feuille CENTRÉE
   est une modale et vit à 50 ; un TIROIR est ancré à un bord, tient
   toute la hauteur, et vit à 59/60 — ce sont les deux étages que
   `CLAUDE.md` réserve, et les confondre ferait passer un tiroir sous une
   modale ouverte par-dessus lui. La forme n'est donc pas un goût : elle
   décide de l'étage.

   ELLE NE SAIT RIEN DU CONTENU, et c'est délibéré : pas de pied de
   boutons imposé, pas de « valider / annuler ». Un formulaire de
   création et un tableau de marque n'ont pas le même bas de page, et
   l'inventer ici obligerait chacun à le contourner. L'EN-TÊTE LUI-MÊME
   SE REFUSE (`heading={false}`) : la vue rapide met une affiche et un
   titre en `h2` dans son propre corps, et lui coiffer un second titre
   ferait lire deux fois le nom du film.
   ============================================================ */
import type { CSSProperties, ReactNode } from "react";
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
  /**
   * `"center"` — une modale posée au milieu, à 50.
   * `"drawer"` — un tiroir ancré à droite sur toute la hauteur, à 59/60.
   */
  variant = "center",
  /** La largeur maximale. Un formulaire n'a pas besoin de la place d'une
      grille d'affiches, et l'étirer rendrait ses champs illisibles. */
  width = 760,
  /** L'en-tête se refuse quand le contenu porte déjà son propre titre. */
  heading = true,
  tour,
  children,
  onClose,
}: {
  title: string;
  aside?: ReactNode;
  lead?: ReactNode;
  variant?: "center" | "drawer";
  width?: number;
  heading?: boolean;
  tour?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  /* `autoFocus: false` : on LIT une feuille avant d'agir dessus, et
     poser le curseur sur la première commande fait sauter la lecture au
     lecteur d'écran comme à l'œil. */
  const box = useDialog(onClose, { autoFocus: false });
  const drawer = variant === "drawer";

  const veil: CSSProperties = drawer
    ? { position: "fixed", inset: 0, zIndex: 59, background: "rgba(20,14,8,0.5)" }
    : {
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: alpha(C.ink, 0.4),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      };

  const pane: CSSProperties = drawer
    ? {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: `min(${width}px, 94vw)`,
        zIndex: 60,
        background: C.paper,
        borderLeft: `1px solid ${C.line}`,
        boxShadow: "-6px 0 24px rgba(0,0,0,0.28)",
        overflowY: "auto",
        padding: "26px 26px 40px",
        animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
      }
    : {
        background: C.card,
        border: `1px solid ${C.line}`,
        boxShadow: "0 10px 40px rgba(20,14,8,0.4)",
        width: `min(${width}px, 100%)`,
        maxHeight: "92vh",
        overflowY: "auto",
        padding: "22px 24px 28px",
        animation: "drawerIn var(--motion-slow) var(--motion-ease) backwards",
      };

  const shut = (
    <button
      onClick={onClose}
      aria-label={t("common.close")}
      style={{ all: "unset", ...tap, cursor: "pointer", marginLeft: "auto", display: "flex" }}
    >
      <X size={16} color={C.inkFaded} />
    </button>
  );

  return (
    <Layer>
      {/* LE TIROIR A SON VOILE EN FRÈRE, LA MODALE EN PARENT. Le second
          centre son contenu, ce dont le premier n'a que faire — il est
          collé à un bord. C'est aussi pourquoi seul le second a besoin
          d'arrêter le clic. */}
      <>
        <div onClick={onClose} data-veil={drawer ? "" : undefined} style={veil}>
          {!drawer && (
            <div
              ref={box}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              data-tour={tour}
              /* SANS CECI, CLIQUER DANS LA FEUILLE LA REFERME : le voile
                 est le PARENT de la boîte, donc tout clic remonte. */
              onClick={(e) => e.stopPropagation()}
              style={pane}
            >
              {heading && (
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
                  {shut}
                </div>
              )}
              {children}
            </div>
          )}
        </div>

        {drawer && (
          <div
            ref={box}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-tour={tour}
            style={pane}
          >
            {heading && (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  {lead}
                  <div
                    style={{
                      fontFamily: F.title,
                      fontStyle: "italic",
                      fontWeight: 700,
                      fontSize: 26,
                      color: C.ink,
                    }}
                  >
                    {title}
                  </div>
                  {shut}
                </div>
                {aside}
              </>
            )}
            {children}
          </div>
        )}
      </>
    </Layer>
  );
}
