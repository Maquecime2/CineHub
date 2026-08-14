/* ============================================================
   LES POUVOIRS, PENDANT UNE PARTIE
   ============================================================

   UN POUVOIR QU'ON N'A PAS S'ACHÈTE ICI. C'était l'inverse au départ —
   absent, pas grisé, pas d'« achetez-en » — au nom de la règle qui veut
   qu'on ne dessine pas ce qu'on ne peut pas faire. Elle ne tenait pas :
   le moment où l'on veut écarter deux mauvaises réponses n'est pas le
   moment où l'on ouvre le comptoir, c'est CELUI-CI, devant la question à
   laquelle on ne sait pas répondre. Un pouvoir qu'on ne peut acheter
   qu'ailleurs est un pouvoir qu'on n'achète jamais.

   Ce qui reste de la règle : rien n'est mort. Un pouvoir qu'on possède
   se joue, un pouvoir qu'on n'a pas s'achète, et un pouvoir hors de
   portée dit ce qu'il manque. Aucun des trois n'est un bouton qui ne
   fait rien.

   La barre disparaît quand même entièrement sans compte, et sans
   comptoir : là il n'y a rien à jouer NI à acheter.

   CHAQUE POUVOIR EST UN TICKET À SOUCHE, et le compte est écrit sur le
   talon. Dépenser en détache un ; le serveur, lui, refuse tout seul
   quand il n'y en a plus — ce compteur n'est qu'une lecture.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { punched } from "../atmosphere/hall";
import { BuyChip } from "./Buy";
import { useShop } from "../../hooks/useShop";
import { accountOpen } from "../../services/server";

export type Power = "halve" | "redo";

export function PowerBar({
  powers,
  used,
  onUse,
  onBought,
  busy,
  tour,
}: {
  /** Combien il reste de chaque, tel que le serveur le dit. */
  powers: Record<string, number>;
  /** Ce qui a déjà servi sur CETTE question : un pouvoir ne se rejoue pas. */
  used: readonly Power[];
  onUse: (p: Power) => void;
  /** Ce qu'on relit après un achat : le compte de pouvoirs a changé. */
  onBought?: () => void;
  busy?: boolean;
  tour?: string;
}) {
  const { t } = useTranslation();
  const catalogue = useShop();
  if (!accountOpen()) return null;

  const kinds = (["halve", "redo"] as const).filter((p) => !used.includes(p));
  if (kinds.length === 0) return null;

  return (
    <div data-tour={tour} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {kinds.map((p) => {
        const held = powers[p] ?? 0;
        if (held === 0) {
          /* On ne l'a pas : on l'achète, sans quitter la question. */
          const sold = catalogue.find((i) => i.power === p);
          if (!sold) return null;
          return (
            <span key={p} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.inkFaded }}>
                {t(`quizView.power.${p}`)}
              </span>
              <BuyChip item={sold.id} price={sold.price} onBought={onBought} compact />
            </span>
          );
        }
        return (
          <button
            key={p}
            onClick={() => onUse(p)}
            disabled={busy}
            style={{
              all: "unset",
              ...tap,
              cursor: busy ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "stretch",
              opacity: busy ? 0.6 : 1,
              background: `linear-gradient(158deg, ${C.card}, ${C.paperDark})`,
              border: `1px solid ${C.line}`,
              boxShadow: "1px 2px 4px rgba(30,20,10,0.16)",
            }}
          >
            <span
              style={{
                padding: "6px 10px",
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: C.ink,
              }}
            >
              {t(`quizView.power.${p}`)}
            </span>
            {/* La ligne de déchirure, percée pour de bon : c'est elle qui
              dit qu'on détache quelque chose en cliquant. */}
            <span
              style={{ width: 1, background: alpha(C.ink, 0.4), ...punched("y", { pitch: 7 }) }}
            />
            <span
              style={{
                padding: "6px 9px",
                fontFamily: F.mono,
                fontSize: 10,
                color: C.ochre,
                alignSelf: "center",
              }}
            >
              ×{held}
            </span>
          </button>
        );
      })}
    </div>
  );
}
