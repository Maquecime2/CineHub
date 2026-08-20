/* ============================================================
   A LIST OF NAMES THAT LEADS SOMEWHERE
   ============================================================

   These names were text joined by commas: one read "Henri Decaë" without
   being able to ask what else one had of his, whereas the collection had
   known since the start. Each of them now opens its folder in the
   Credits.

   A DOTTED INK LINE, AND NOT A LINK BLUE. The art direction is a
   notebook, and a notebook does not underline in blue what can be
   followed — it writes it in ink. The colour on hover is an accent and
   never the signal: burgundy goes under five of the seventeen skins.

   IT LIVES ON ITS OWN BECAUSE THREE SCREENS WANT IT. It was written
   inside the TMDB reading, where the quick view and the card's identity
   could not reach it — and both had started to draw their own, with the
   tooltip written out in French in the middle of a view. `whatIHaveOf`
   had been in both catalogues the whole time. */
import { useTranslation } from "react-i18next";
import { C } from "../../theme/tokens";
import { tap } from "../../theme/styles";

/** Ce qu'on écrit là où il n'y a rien : un tiret, jamais du vide. */
export const EMPTY = <span style={{ color: C.line }}>—</span>;

export function Names({
  names,
  separator = ", ",
  onOpenPerson,
}: {
  names: string[];
  separator?: string;
  onOpenPerson?: (name: string) => void;
}) {
  const { t } = useTranslation();
  if (!names.length) return EMPTY;
  return (
    <>
      {names.map((name, i) => (
        <span key={`${name}-${i}`}>
          {i > 0 && separator}
          {onOpenPerson ? (
            <button
              onClick={() => onOpenPerson(name)}
              title={t("credits.whatIHaveOf", { name })}
              style={{
                all: "unset",
                ...tap,
                cursor: "pointer",
                borderBottom: `1px dotted ${C.inkFaded}`,
                transition: "color var(--motion-fast) ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = C.burgundy;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "";
              }}
            >
              {name}
            </button>
          ) : (
            name
          )}
        </span>
      ))}
    </>
  );
}
