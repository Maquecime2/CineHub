/* ============================================================
   ACHETER LÀ OÙ NAÎT L'ENVIE
   ============================================================

   Le comptoir reste l'endroit où l'on regarde ce qu'on a. Mais on ne
   veut pas une peau en regardant un étal : on la veut en ouvrant le
   sélecteur de peaux. On ne veut pas un pouvoir au comptoir : on le veut
   devant la question à laquelle on ne sait pas répondre.

   D'où cette pastille, qui va se poser dans trois endroits qui n'ont
   rien à voir entre eux. Elle est SEULE à savoir comment on achète —
   sinon le sélecteur, la barre de pouvoirs et la carte de défi auraient
   chacun leur version du même geste, et la troisième aurait divergé.

   ELLE DIT TOUJOURS LE MANQUE PLUTÔT QUE DE DISPARAÎTRE. C'est la règle
   du présentoir, et elle vaut ici encore plus : quelqu'un qui ne peut
   pas s'offrir une peau doit voir ce qu'il lui faut, pas un trou.

   ET LE SERVEUR DÉCIDE, PAS ELLE. Un achat refusé — plus assez, déjà
   possédé, article inconnu — revient en phrase et s'affiche. Cette
   pastille ne fait que demander.
   ============================================================ */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { priceGap } from "../../domain/points";
import { refreshPurse, usePurse } from "../../hooks/usePurse";
import { refreshShop } from "../../hooks/useShop";
import { buy } from "../../services/server";

export function BuyChip({
  item,
  price,
  ink = C.ochre,
  onBought,
  compact,
}: {
  item: string;
  price: number;
  ink?: string;
  /** Ce qu'il faut relire ensuite : ce qu'on possède a changé. */
  onBought?: () => void;
  /** Dans une barre déjà chargée, on écrit plus petit. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const purse = usePurse();
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const missing = priceGap(price, purse?.tokens ?? 0);

  const take = async () => {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      await buy(item);
      await Promise.all([refreshPurse(), refreshShop()]);
      onBought?.();
    } catch (e) {
      setTrouble((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (missing > 0) {
    return (
      <span
        style={{
          fontFamily: F.hand,
          fontSize: compact ? 13 : 14,
          color: C.inkFaded,
          whiteSpace: "nowrap",
        }}
      >
        {t("counter.shop.short", { count: missing })}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <button
        onClick={take}
        disabled={busy}
        style={{
          all: "unset",
          ...tap,
          cursor: busy ? "wait" : "pointer",
          padding: compact ? "4px 8px" : "5px 10px",
          fontFamily: F.mono,
          fontSize: compact ? 9 : 9.5,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: C.card,
          background: ink,
          border: `1px solid ${ink}`,
          borderRadius: "var(--tag-radius)",
          opacity: busy ? 0.6 : 1,
          boxShadow: `1px 2px 3px ${alpha(C.ink, 0.25)}`,
        }}
      >
        {t("counter.shop.buy", { price })}
      </button>
      {trouble && (
        <span style={{ fontFamily: F.hand, fontSize: 13, color: C.burgundy }}>{trouble}</span>
      )}
    </span>
  );
}
