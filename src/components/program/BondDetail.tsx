/* ============================================================
   CE QU'UNE ARÊTE DIT QUAND ON LA CHOISIT
   ============================================================

   ELLE NE DISAIT QUE SA NOTE, ET UNE NOTE N'EST PAS UN LIEN. On lisait
   « Wikidata P1066 » — une référence, écrite pour la machine — au-dessus
   d'un bouton de retrait, sans les deux noms, sans la nature, sans le
   sens. Le seul endroit du produit où l'on regarde un lien EN
   PARTICULIER était le seul à ne pas l'énoncer.

   ET LA PROVENANCE SE DIT EN TOUTES LETTRES. `Bond.note` reste une
   référence sur le disque — y écrire du français figerait la langue du
   jour dans les données — mais l'ÉCRAN la traduit. C'est la règle de
   `threadLabel` : la donnée est une clé, l'affichage lit le catalogue.

   IL SORT DE LA VUE, ET IL PORTE UN GESTE DE PLUS. La carte vit
   désormais sous une feuille : choisir une arête allume les étapes qui
   l'invoquent DERRIÈRE le voile, c'est-à-dire nulle part. « Voir les
   étapes » referme donc, et c'est ce qui garde navigable dans les deux
   sens un raisonnement dont les deux bouts ne sont plus sur le même
   écran. */
import { useTranslation } from "react-i18next";
import { CornerDownLeft } from "lucide-react";
import { C, F } from "../../theme/tokens";
import { bare, hollow, inked } from "../../theme/styles";
import { bondLabel } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";
import { HINT_MARK, isHinted, readCreditNote } from "../../domain/hints";

export function BondDetail({
  bond,
  onRemove,
  onSeeSteps,
}: {
  bond?: Bond;
  onRemove: (bond: Bond) => void;
  /** Allumer les étapes qui l'invoquent — et refermer la carte. */
  onSeeSteps?: () => void;
}) {
  const { t } = useTranslation();
  if (!bond) return null;
  const hinted = isHinted(bond);
  const credit = readCreditNote(bond.note);
  return (
    /* UN NOM, PARCE QUE ÇA PARAÎT SANS PRÉVENIR. Ce bloc s'ouvre quand
       on choisit une arête, loin du geste au lecteur d'écran, et le
       miroir en liste de la carte énonce déjà les mêmes phrases : sans
       nom, rien ne distingue les deux. */
    <div
      role="group"
      aria-label={t("program.bondDetail")}
      style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}
    >
      <div style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>
        <strong style={{ fontWeight: 600 }}>{bond.fromName}</strong> {bondLabel(bond, bond.from, t)}
      </div>

      {/* LU DE L'AUTRE BOUT, et ce n'est pas une redite : « a pour
          élève » et « a pour maître » sont la même ligne, et c'est
          précisément le sens qu'on vient vérifier sur une arête. */}
      <div style={{ fontFamily: F.body, fontSize: 13, color: C.inkFaded, marginTop: 2 }}>
        <strong style={{ fontWeight: 600 }}>{bond.toName}</strong> {bondLabel(bond, bond.to, t)}
      </div>

      {bond.note && (
        <div style={{ fontFamily: F.hand, fontSize: 16, color: C.inkFaded, marginTop: 6 }}>
          {credit
            ? t("program.bondFromCredits", {
                role: t(`roles.${credit.role}`),
                count: credit.n,
              })
            : hinted
              ? t("program.bondFromHint", { prop: bond.note.slice(HINT_MARK.length) })
              : bond.note}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {onSeeSteps && (
          <button onClick={onSeeSteps} style={{ ...inked(C.ink), ...hollow }}>
            <CornerDownLeft size={12} />
            {t("program.seeSteps")}
          </button>
        )}
        <button
          onClick={() => onRemove(bond)}
          style={{ ...bare, color: C.burgundy, fontFamily: F.mono, fontSize: 9.5 }}
        >
          {t("program.removeBond")}
        </button>
      </div>
    </div>
  );
}
