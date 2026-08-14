/* ============================================================
   LE COMPTE, TOUJOURS VISIBLE
   ============================================================

   Un chiffre qu'on ne voit qu'en ouvrant un onglet est un chiffre qu'on
   oublie. Le mérite et les jetons se gagnent partout — en finissant un
   quiz, en bouclant un défi, en rangeant une fiche — et le seul endroit
   où on les lisait était le comptoir, c'est-à-dire l'endroit où l'on va
   quand on sait déjà qu'on a de quoi.

   IL EST DANS LE RAIL, JUSTE AVANT LA PEAU, et ce n'est pas un hasard :
   le sélecteur de peaux affiche maintenant des prix, et c'est la
   décision qu'on prend en le regardant. Le compte et ce qu'il permet
   sont à deux pixels l'un de l'autre.

   IL N'EXISTE PAS SANS COMPTE. Comme tout le reste du volet
   communautaire : rien à compter, rien à montrer, et pas un cadre vide
   qui demande ce qu'il fait là.

   CE N'EST PAS UNE COUCHE. Il vit DANS le rail, en flux, donc rien à
   voir avec le budget de `z-index` ni avec `<Layer>` — un `fixed` de
   plus pour deux nombres aurait été un `fixed` de trop.
   ============================================================ */
import { useTranslation } from "react-i18next";
import { C, F, alpha } from "../../theme/tokens";
import { tap } from "../../theme/styles";
import { usePurse } from "../../hooks/usePurse";
import { accountOpen, serverConfigured } from "../../services/server";

export function PurseTally({ onOpen, phone }: { onOpen: () => void; phone?: boolean }) {
  const { t } = useTranslation();
  const purse = usePurse();

  if (!serverConfigured() || !accountOpen() || !purse) return null;

  /* Un chiffre à quatre positions écrase le rail : au-delà du millier on
     abrège. La bourse exacte se lit au comptoir, qui est à un clic. */
  const short = (n: number) => (n >= 10000 ? `${Math.floor(n / 1000)}k` : String(n));

  return (
    <button
      onClick={onOpen}
      data-tour="rail-purse"
      title={t("counter.tally", { merit: purse.merit, tokens: purse.tokens })}
      style={{
        all: "unset",
        ...tap,
        cursor: "pointer",
        marginTop: phone ? 0 : 8,
        marginLeft: phone ? 6 : 0,
        display: "flex",
        flexDirection: phone ? "row" : "column",
        alignItems: "center",
        gap: phone ? 6 : 1,
        padding: phone ? "4px 8px" : "5px 4px",
        background: alpha(C.card, 0.55),
        border: `1px solid ${C.line}`,
        borderRadius: "var(--tag-radius)",
      }}
    >
      <span
        style={{
          fontFamily: F.title,
          fontSize: 13,
          lineHeight: 1,
          color: C.ink,
        }}
      >
        {short(purse.merit)}
      </span>
      {/* La pastille de jeton : un rond d'ocre, la même encre qu'au
          guichet, pour qu'on reconnaisse les deux compteurs d'un endroit
          à l'autre sans avoir à lire les étiquettes. */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontFamily: F.mono,
          fontSize: 9.5,
          color: C.ochre,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.ochre,
            display: "inline-block",
          }}
        />
        {short(purse.tokens)}
      </span>
    </button>
  );
}
