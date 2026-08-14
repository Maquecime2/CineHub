/* ============================================================
   LES POUVOIRS, PENDANT UNE PARTIE
   ============================================================

   UN POUVOIR QU'ON N'A PAS N'EST PAS DESSINÉ. Pas grisé, pas barré,
   pas accompagné d'un « achetez-en » : absent. C'est la même règle que
   pour tout ce qui dépend du dehors dans ce classeur, et elle vaut
   d'autant plus ici — un bouton mort au milieu d'une question est une
   distraction pendant qu'on réfléchit.

   Il en découle que cette barre disparaît entièrement quand on n'a rien,
   ce qui est le cas de presque tout le monde presque tout le temps. Elle
   ne coûte donc rien à la lecture d'une question, ce qui est exactement
   ce qu'on veut d'elle.

   CHAQUE POUVOIR EST UN TICKET À SOUCHE, et le compte est écrit sur le
   talon. Dépenser en détache un ; le serveur, lui, refuse tout seul
   quand il n'y en a plus — ce compteur n'est qu'une lecture.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { punched } from "../atmosphere/hall";

export type Power = "halve" | "redo";

export function PowerBar({
  powers,
  used,
  onUse,
  busy,
  tour,
}: {
  /** Combien il reste de chaque, tel que le serveur le dit. */
  powers: Record<string, number>;
  /** Ce qui a déjà servi sur CETTE question : un pouvoir ne se rejoue pas. */
  used: readonly Power[];
  onUse: (p: Power) => void;
  busy?: boolean;
  tour?: string;
}) {
  const { t } = useTranslation();
  const offered = (["halve", "redo"] as const).filter(
    (p) => (powers[p] ?? 0) > 0 && !used.includes(p)
  );
  if (offered.length === 0) return null;

  return (
    <div data-tour={tour} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {offered.map((p) => (
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
            ×{powers[p]}
          </span>
        </button>
      ))}
    </div>
  );
}
