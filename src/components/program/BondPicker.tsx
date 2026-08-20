/* ============================================================
   WHAT THIS ENTRY FOLLOWS FROM
   ============================================================

   IT WAS A `<select>`, AND THAT WAS THE MISTAKE. Nine pixels of type in
   a dropdown, one of eight identical ones down a column: the field that
   carries the whole idea of this screen — a justification that POINTS AT
   a bond instead of merely asserting one in prose — was the least
   visible thing on it, and it took two gestures to read what was in it.

   THE BONDS ARE RIBBONS ONE PRESSES. `bondLabel` reads them FROM this
   film-maker, so it says "studied under Ozu" and never the wording it
   was typed with: nobody has to reverse a bond in their head. Pressing
   the lit one clears it, which is what the empty option used to be for.

   "TIE THEM TO SOMEBODY" IS ALWAYS THERE, and not only when the list is
   empty. That is the continuous gesture the screen was missing: the form
   opens with this name already filled, and on saving, the bond is laid
   AND this step is made to call upon it, in one act. Before, one laid a
   bond in a modal, closed it, found the row again and opened a dropdown
   — four gestures to state one thing, which is why nobody stated it. */
import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { C, F, alpha } from "../../theme/tokens";
import { bare, chip } from "../../theme/styles";
import { bondLabel } from "../../domain/bonds";
import type { Bond } from "../../domain/bonds";

interface BondPickerProps {
  directorName: string | null;
  directorKey: string | null;
  /** Les liens du réalisateur de cette entrée. */
  bonds: Bond[];
  /** Le lien invoqué, s'il en nomme un qu'on tient encore. */
  value: Bond | undefined;
  onPick: (bondId: string | null) => void;
  onTie: () => void;
}

export function BondPicker({
  directorName,
  directorKey,
  bonds,
  value,
  onPick,
  onTie,
}: BondPickerProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          letterSpacing: 1,
          color: C.inkFaded,
          marginBottom: 6,
        }}
      >
        {t("program.because")}
      </div>

      <div
        role="radiogroup"
        aria-label={t("program.because")}
        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
      >
        {directorKey &&
          bonds.map((b) => {
            const here = value?.id === b.id;
            return (
              <button
                key={b.id}
                role="radio"
                aria-checked={here}
                onClick={() => onPick(here ? null : b.id)}
                style={{
                  ...bare,
                  ...chip,
                  fontFamily: F.body,
                  fontSize: 12.5,
                  color: here ? C.card : C.ink,
                  background: here ? C.plum : "transparent",
                  borderColor: here ? C.plum : C.line,
                }}
              >
                {bondLabel(b, directorKey, t)}
              </button>
            );
          })}

        {/* PERMANENTE, ET PAS SEULEMENT SUR UNE LISTE VIDE : c'est par
            là que la carte se remplit, et le savoir ne s'arrête pas au
            premier lien posé. */}
        <button
          onClick={onTie}
          disabled={!directorName}
          style={{
            ...bare,
            ...chip,
            borderStyle: "dashed",
            fontFamily: F.mono,
            fontSize: 9.5,
            opacity: directorName ? 1 : 0.4,
          }}
        >
          <Link2 size={11} />
          {t("program.tieTo", { name: directorName || "" })}
        </button>
      </div>

      {!value && bonds.length > 0 && (
        <div style={{ fontFamily: F.hand, fontSize: 15, color: alpha(C.ink, 0.5), marginTop: 6 }}>
          {t("program.becauseNone")}
        </div>
      )}
    </div>
  );
}
