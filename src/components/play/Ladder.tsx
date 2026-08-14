/* ============================================================
   LE PALMARÈS — l'affiche collée sur la vitre du guichet
   ============================================================

   DEUX TABLEAUX, ET LE PREMIER N'EST PAS TOUJOURS LÀ. « Le monde »
   n'apparaît qu'à qui a accepté d'y figurer : un onglet qui promet un
   classement mondial pour montrer une seule ligne — la sienne — serait
   une porte sur un mur. Le réglage vit dans le tiroir du compte, à côté
   du partage, et l'onglet suit.

   ON SE VOIT TOUJOURS, où qu'on soit. C'est le serveur qui le garantit,
   pas ce fichier : `p.id = $1` est dans les deux requêtes, sans
   condition. Ici on se contente de le SIGNALER — une ligne sur fond
   ocre, soulignée à l'encre.

   LE RANG EST EN CHIFFRES ROMAINS. Pas par coquetterie : un palmarès de
   festival les écrit ainsi, et surtout un « 1 » et un « 11 » en chiffres
   arabes ont la même largeur au regard, quand « I » et « XI » se
   distinguent d'un coup d'œil dans une colonne étroite.

   ET RIEN DE COÛTEUX PAR LIGNE. Cinquante lignes qui défilent ne portent
   ni mélange de calques ni filtre : la règle du hall est que les effets
   chers appartiennent aux moments, pas aux listes.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { InkUnderline } from "../atmosphere";
import { Stamp } from "../atmosphere/hall";
import { Nothing } from "../ui";
import { STAMP_INK, stampLabel } from "./stamps";
import type { Rank } from "../../services/server";

/* I à L. Au-delà de cinquante on ne classe plus, on recense — et la
   table s'arrête là où le serveur s'arrête. */
const ROMAN: readonly [number, string][] = [
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function roman(n: number): string {
  if (n <= 0) return "—";
  let left = n;
  let out = "";
  for (const [value, sign] of ROMAN) {
    while (left >= value) {
      out += sign;
      left -= value;
    }
  }
  return out;
}

export function Ladder({
  ranks,
  scope,
  onScope,
  worldOpen,
  tour,
}: {
  ranks: Rank[];
  scope: "world" | "friends";
  onScope: (s: "world" | "friends") => void;
  /** A-t-on accepté de figurer au classement mondial ? */
  worldOpen: boolean;
  tour?: string;
}) {
  const { t } = useTranslation();
  const best = Math.max(1, ...ranks.map((r) => r.merit));

  const tab = (key: "world" | "friends", label: string) => (
    <button
      key={key}
      onClick={() => onScope(key)}
      style={{
        ...bare,
        cursor: "pointer",
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        padding: "6px 12px",
        color: scope === key ? C.card : C.inkFaded,
        /* L'onglet retenu est un onglet de classeur : plein en haut,
           légèrement dégradé, coins droits du côté de la reliure. */
        background:
          scope === key ? `linear-gradient(180deg, ${C.ochre}, ${alpha(C.ochre, 0.82)})` : "none",
        border: `1px solid ${scope === key ? C.ochre : C.line}`,
        borderBottom: "none",
        borderRadius: "var(--tag-radius) var(--tag-radius) 0 0",
      }}
    >
      {label}
    </button>
  );

  return (
    <div data-tour={tour} data-print-block>
      <div style={{ display: "flex", gap: 4 }}>
        {/* L'onglet du monde n'existe pas pour qui n'y figure pas. */}
        {worldOpen && tab("world", t("counter.ladder.world"))}
        {tab("friends", t("counter.ladder.friends"))}
      </div>

      <div
        style={{
          border: `1px solid ${C.line}`,
          background: C.card,
          padding: "12px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {ranks.length === 0 && <Nothing what={t("counter.ladder.empty")} />}
        {ranks.map((r) => (
          <div
            key={r.pseudo}
            style={{
              position: "relative",
              padding: r.me ? "3px 6px" : "3px 0",
              margin: r.me ? "0 -6px" : undefined,
              background: r.me ? alpha(C.ochre, 0.08) : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span
                style={{
                  fontFamily: F.title,
                  fontSize: 15,
                  color: C.inkFaded,
                  width: 34,
                  flexShrink: 0,
                  textAlign: "right",
                }}
              >
                {roman(r.rank)}
              </span>
              <span
                style={{
                  fontFamily: F.body,
                  fontSize: 14,
                  color: C.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.pseudo}
              </span>
              {r.stamp && (
                <Stamp
                  text={t(stampLabel(r.stamp))}
                  ink={STAMP_INK[r.stamp] ?? C.burgundy}
                  tilt={-5}
                />
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaded }}>{r.merit}</span>
            </div>

            {/* La barre, sous le nom plutôt qu'à côté : une colonne de
                plus aurait rogné les pseudonymes, qui sont ce qu'on lit. */}
            <div style={{ height: 3.5, background: alpha(C.line, 0.5), marginTop: 2 }}>
              <div
                style={{ height: "100%", width: `${(r.merit / best) * 100}%`, background: C.ochre }}
              />
            </div>

            {r.me && <InkUnderline width={120} style={{ marginTop: -1, opacity: 0.5 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
