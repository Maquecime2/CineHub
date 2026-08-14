/* ============================================================
   LE GUICHET — ce qu'on a gagné, ce qu'on peut dépenser
   ============================================================

   Un ticket, souche et talon. À gauche le MÉRITE, qui se cumule et ne
   descend jamais : c'est lui qui classe. À droite les JETONS, le même
   chiffre moins ce qui est passé au comptoir. Les deux côtés d'un même
   billet parce que c'est la même chose gagnée, comptée deux fois — et
   la ligne perforée entre eux dit sans un mot que l'un se détache.

   LE GAIN S'ÉCRIT SUR LA PAGE, PAS DANS UN COIN. Un carnet ne fait pas
   surgir une bulle en bas à droite : il écrit là où la chose a eu lieu.
   Le « +N » monte au-dessus du chiffre qu'il vient d'augmenter, et le
   fronton s'allume une fois. Les deux passent par les jetons de
   mouvement, donc le mouvement réduit les éteint sans rien casser.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F } from "../../theme/tokens";
import { Gain, Marquee, Ticket, velvet } from "../atmosphere/hall";
import type { Purse as PurseFigures } from "../../services/server";

export function Purse({ purse, tour }: { purse: PurseFigures; tour?: string }) {
  const { t } = useTranslation();

  /* CE QUI VIENT DE CHANGER, ET RIEN D'AUTRE. On garde le mérite du
     rendu précédent pour en déduire le gain : le serveur envoie un
     total, et un total ne dit pas ce qu'on vient de faire. La
     comparaison se fait dans une référence et non dans un état, sans
     quoi la lire déclencherait le rendu qui la met à jour. */
  const before = useRef(purse.merit);
  const [gained, setGained] = useState(0);

  useEffect(() => {
    const grew = purse.merit - before.current;
    before.current = purse.merit;
    if (grew <= 0) return;
    setGained(grew);
    /* Le chiffre s'efface tout seul. La durée suit celle de l'animation
       qui l'emporte, sans quoi il resterait accroché à un écran
       immobile chez qui a demandé moins de mouvement. */
    const out = setTimeout(() => setGained(0), 1400);
    return () => clearTimeout(out);
  }, [purse.merit]);

  const figure = (label: string, value: number, ink: string) => (
    <>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: C.inkFaded,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: F.title, fontSize: 30, lineHeight: 1.05, color: ink }}>{value}</div>
    </>
  );

  return (
    <div data-tour={tour} data-print-block style={{ position: "relative" }}>
      <Marquee lit={gained > 0} />
      <div style={{ ...velvet(), padding: "13px 14px 15px" }}>
        <Ticket
          stub={
            <div style={{ position: "relative" }}>
              {figure(t("counter.merit"), purse.merit, C.ink)}
              {gained > 0 && <Gain amount={gained} style={{ top: -4, left: 46 }} />}
            </div>
          }
          counterfoil={figure(t("counter.tokens"), purse.tokens, C.ochre)}
        />
      </div>

      {/* La place, dite sous le billet et non dessus : on vient ici pour
          savoir ce qu'on a, le rang est la conséquence. */}
      {purse.standing !== null && purse.ladder === "tous" && (
        <div
          style={{
            fontFamily: F.hand,
            fontSize: 16,
            color: C.inkFaded,
            marginTop: 6,
            textAlign: "right",
          }}
        >
          {t("counter.standing", { place: purse.standing })}
        </div>
      )}
    </div>
  );
}
