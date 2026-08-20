/* ============================================================
   LA COMMANDE DU RECUL

   Quatre pastilles, et un `radiogroup` — jamais un `<select>` (ce projet
   en a tué un dans `BondPicker`) et jamais un curseur continu : les
   crans sont des VALEURS et non un réglage fin, et un `radiogroup` rend
   les flèches du clavier sans qu'on écrive une ligne.

   ELLE SE DÉSARME PENDANT UN GLISSEMENT, et c'est la seule règle du
   fichier qui protège autre chose que le confort. Le cache de rectangles
   de `ShelfBoard` compare du client à du client : il ne survit pas à une
   échelle qui change SOUS la main. On refuse donc le clic tant qu'une
   main tient un boîtier, plutôt que d'invalider un cache dont tout le
   glissement dépend.

   ELLE NE DIT RIEN AU MIROIR. `ShelfMirror` reste la vérité linéaire, et
   une échelle visuelle ne concerne pas qui lit l'étagère au lecteur
   d'écran : l'annoncer serait annoncer un fait qui ne lui apprend rien.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { NOTCHES, dragging } from "./useStepBack";

export function StepBack({ value, onChange }: { value: number; onChange: (k: number) => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t("shelf.stepBack.title")}
      data-tour="shelf-zoom"
      style={{ display: "inline-flex", alignItems: "center", gap: 2 }}
    >
      {NOTCHES.map((k) => {
        const on = k === value;
        const percent = Math.round(k * 100);
        return (
          <button
            key={k}
            role="radio"
            aria-checked={on}
            /* LE MOT PORTE LE CHIFFRE, et le chiffre est aussi ce qu'on
               voit : un pourcentage écrit en toutes lettres dans le nom
               et en deux caractères sur la pastille dit la même chose à
               l'œil et au clavier. */
            aria-label={t("shelf.stepBack.notch", { percent })}
            onClick={() => {
              if (dragging()) return;
              onChange(k);
            }}
            style={{
              all: "unset",
              ...tap,
              cursor: "pointer",
              fontFamily: F.mono,
              fontSize: 9,
              letterSpacing: 0.5,
              padding: "2px 6px",
              minHeight: 0,
              /* LE CRAN CHOISI SE DIT PAR L'ENCRE ET LE TRAIT, jamais par
                 une couleur d'accent : elle disparaîtrait sous cinq des
                 dix-sept peaux, comme le verdict du quizz. */
              color: on ? C.ink : C.inkFaded,
              borderBottom: `1px ${on ? "solid" : "dashed"} ${on ? C.ink : C.line}`,
            }}
          >
            {percent}
          </button>
        );
      })}
    </div>
  );
}
