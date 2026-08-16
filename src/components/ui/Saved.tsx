/* ============================================================
   LA MENTION « ENREGISTRÉ »
   ============================================================

   Trois mots dans la marge, et rien de plus. Elle répond à la seule
   question qu'on se pose en écrivant une critique — « est-ce que ça
   part quelque part ? » — à laquelle le produit ne répondait pas du
   tout.

   ELLE NE DIT RIEN QUAND IL N'Y A RIEN À DIRE. Pas de « à jour »
   permanent : une mention qui reste devient un meuble, et un meuble ne
   rassure plus. Elle apparaît en écrivant, se change en « enregistré »,
   et s'efface.

   ELLE N'EST PAS UN BOUTON, et c'est la décision. Ce classeur écrit
   tout seul et l'a toujours fait ; poser un bouton « enregistrer »
   voudrait dire qu'on peut l'oublier, donc perdre quelque chose — on
   ajouterait un risque pour afficher une garantie.

   `aria-live="polite"` : « enregistré » est exactement le genre de
   phrase qu'on ne voit pas quand on ne regarde pas l'écran.
   ============================================================ */
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { saveState, watchSaving } from "../../services/saving";

export function Saved({ align = "right" }: { align?: "left" | "right" }) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(watchSaving, saveState, saveState);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: 14,
        textAlign: align,
        fontFamily: F.mono,
        fontSize: 9,
        letterSpacing: 1,
        textTransform: "uppercase",
        /* LA PLACE EST TENUE MÊME VIDE. Sans `minHeight`, la mention qui
           arrive pousse le champ d'une ligne au moment précis où l'on
           tape dedans. */
        color: state === "saved" ? C.pine : C.inkFaded,
        opacity: state === "clean" ? 0 : 1,
        transition: "opacity var(--motion-fast) var(--motion-ease)",
      }}
    >
      {state === "saved" ? t("saving.saved") : state === "pending" ? t("saving.saving") : ""}
    </div>
  );
}
