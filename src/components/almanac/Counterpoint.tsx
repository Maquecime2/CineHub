/* ============================================================
   LA FEUILLE DU CONTREPOINT — l'envers de la reco
   ============================================================

   L'almanach DÉCRIT : quatre planches disent ce que l'année a contenu.
   Celle-ci JUGE, et c'est pourquoi ce n'est pas une cinquième planche —
   les planches sont un livret à hauteur arrêtée, sans défilement, et une
   pastille de plus dans un en-tête de hauteur fixe reproduirait le
   débordement que cet en-tête raconte avoir corrigé.

   UNE `Sheet` ET NON UNE VUE. Une vue coûterait une entrée dans l'union
   `View`, une place dans `GROUPS` et un tour dans `TOURS`, pour un écran
   qu'on ouvre trois fois par an et dont chaque ligne renvoie AILLEURS.
   C'est le raisonnement déjà tenu pour `HintHarvest` et `NewList`.

   LE VERDICT SE DIT PAR UN MOT, JAMAIS PAR UNE COULEUR, et c'est la
   règle qui se ferait oublier ici : un écran d'écarts appelle
   irrésistiblement du rouge. Il n'y en a pas, ni de vert, ni de barre de
   complétude, ni de score. Chaque écart porte un TAMPON — un mot — et un
   chiffre. Ce qui les distingue se lit, il ne se devine pas à la teinte,
   sans quoi cinq des dix-sept peaux l'effaceraient.

   TROIS ÉTATS ET NON DEUX. « Il est trop tôt » n'est pas « aucun
   écart » : le premier dit que le classeur est trop maigre pour qu'une
   absence veuille dire quelque chose, le second est un vrai résultat. Le
   domaine tranche (`tooThin`), l'écran ne devine pas.

   LES EFFETS CHERS APPARTIENNENT AUX MOMENTS : six lignes réglées, pas
   de `mixBlendMode`, pas de `filter`. Le tampon s'incline, et son
   inclinaison est SEMÉE sur la clé de l'écart — un mur qui gigote n'est
   pas un mur.
   ============================================================ */
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { C, F, alpha } from "../../theme/tokens";
import { bare } from "../../theme/styles";
import { Sheet } from "../ui/Sheet";
import { tiltOf } from "../../domain/seeded";
import { countryName } from "../../names";
import type { Counterpoint as Gaps, Gap } from "../../domain/counterpoint";

/* LA DONNÉE RESTE UNE CLÉ, L'ÉCRAN LA TRADUIT. Le domaine rend "JP", et
   `countryName` en fait « Japon » dans la langue du moment. Écrire du
   français dans le domaine figerait la langue du jour — c'est la règle
   de `threadLabel`, et `geography` la tient déjà. */
const readable = (gap: Gap, lang: string): string =>
  gap.kind === "country" ? countryName(gap.key, lang) : gap.key;

/* LE MOT DU TAMPON, par nature d'écart. Le tableau ne porte que des
   CLÉS : une phrase rangée dans un tableau de constantes échappe à
   `literals.test.ts` — la limite est écrite dans son en-tête — et
   partirait en français dans l'écran anglais sans qu'un contrôle
   bronche. */
const STAMP: Record<Gap["kind"], string> = {
  decade: "counterpoint.kindDecade",
  country: "counterpoint.kindCountry",
  director: "counterpoint.kindDirector",
};

/* CE QU'UN ÉCART DIT, et le pays en a DEUX phrases : « jamais mis » et
   « vu une seule fois » ne sont pas la même observation, et les fondre
   sous un compte ferait dire « un seul film vu » là où aucun ne l'a
   été. */
const said = (gap: Gap): { key: string; count: number } => {
  if (gap.kind === "decade") return { key: "counterpoint.decadeSaid", count: gap.held };
  if (gap.kind === "director") return { key: "counterpoint.directorSaid", count: gap.held };
  return {
    key: gap.cards === 0 ? "counterpoint.countryNever" : "counterpoint.countrySaid",
    count: gap.held,
  };
};

const line: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
  padding: "14px 0",
  borderBottom: `1px solid ${C.line}`,
};

const jump: CSSProperties = {
  ...bare,
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: "var(--tag-tracking)",
  color: C.burgundy,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

function Stamp({ gap }: { gap: Gap }) {
  const { t } = useTranslation();
  return (
    <span
      style={{
        flexShrink: 0,
        display: "inline-block",
        padding: "3px 9px",
        border: `1px solid ${alpha(C.ink, 0.45)}`,
        fontFamily: F.mono,
        fontSize: 9,
        letterSpacing: "var(--tag-tracking)",
        textTransform: "uppercase",
        color: C.inkFaded,
        transform: `rotate(${tiltOf(gap.kind + gap.key)}deg)`,
        marginTop: 2,
      }}
    >
      {t(STAMP[gap.kind])}
    </span>
  );
}

/**
 * Ce que la collection ne regarde pas, sur la période affichée.
 *
 * LES SAUTS SONT DONNÉS, JAMAIS DEVINÉS : sans le rappel correspondant,
 * la ligne n'est pas un bouton — un bouton mort apprend à ne plus
 * cliquer.
 */
export function CounterpointSheet({
  gaps,
  aside,
  onClose,
  onOpen,
  onOpenPerson,
  onOpenDecade,
}: {
  gaps: Gaps;
  /** La période affichée, dite à côté du titre et non dans une phrase. */
  aside: string;
  onClose: () => void;
  onOpen?: (id: string) => void;
  onOpenPerson?: (name: string) => void;
  onOpenDecade?: (decade: string) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Sheet title={t("counterpoint.title")} aside={aside} width={620} onClose={onClose}>
      <p
        style={{
          margin: "0 0 18px",
          fontFamily: F.hand,
          fontSize: 16,
          lineHeight: 1.5,
          color: C.inkFaded,
        }}
      >
        {t("counterpoint.lede")}
      </p>

      {gaps.tooThin && (
        <p style={{ margin: 0, fontFamily: F.body, fontSize: 14, color: C.ink }}>
          {t("counterpoint.thin", { count: gaps.weighed })}
        </p>
      )}

      {!gaps.tooThin && gaps.gaps.length === 0 && (
        <p style={{ margin: 0, fontFamily: F.body, fontSize: 14, color: C.ink }}>
          {t("counterpoint.even")}
        </p>
      )}

      {gaps.gaps.map((gap) => {
        const phrase = said(gap);
        return (
          <div key={`${gap.kind}:${gap.key}`} style={line}>
            <Stamp gap={gap} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 1.5 }}>
                {t(phrase.key, { key: readable(gap, i18n.language), count: phrase.count })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 7 }}>
                {gap.kind === "decade" && onOpenDecade && (
                  <button style={jump} onClick={() => onOpenDecade(gap.key)}>
                    {t("counterpoint.jumpDecade")}
                  </button>
                )}
                {gap.kind === "director" && onOpenPerson && (
                  <button style={jump} onClick={() => onOpenPerson(gap.key)}>
                    {t("counterpoint.jumpPerson")}
                  </button>
                )}
                {gap.witness && onOpen && (
                  <button style={jump} onClick={() => onOpen(gap.witness?.id as string)}>
                    {t("counterpoint.jumpFilm")} · {gap.witness.title}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
