/* ============================================================
   CE QUE LETTERBOXD A DE PLUS QUE LE CLASSEUR
   ============================================================

   Le calcul de la veille, et rien d'autre : pas de réseau, pas d'état,
   pas de hasard. Les mêmes fiches et le même flux rendent toujours la
   même proposition — c'est ce qui rend la règle éprouvable sans aller
   chercher un compte Letterboxd dans un test.

   ELLE N'AJOUTE QUE, ET C'EST UNE DÉCISION. L'écran d'import sait dire
   « ces souhaits ne sont plus sur ton Letterboxd » (`absentFrom`) et
   c'est très bien là où quelqu'un a cliqué pour le savoir. Une tâche de
   FOND qui annonce des retraits est une autre affaire : la watchlist se
   lit dans des pages HTML dont le gabarit peut changer sans prévenir, et
   le jour où il change, ce n'est pas un souhait qui aurait disparu, ce
   sont TOUS. On ne propose donc jamais de retirer quoi que ce soit.
   ============================================================ */
import { diffImport, filmKey } from "./importing";
import type { Film, ImportDiff, ParsedCsv } from "../types";

/** Une proposition vide — celle qu'on ne montre pas. */
export const NOTHING: ImportDiff = { toCreate: [], toUpdate: [], unchanged: [] };

/** Y a-t-il quelque chose à proposer ? `unchanged` ne compte pas. */
export const hasSomething = (d: ImportDiff): boolean =>
  d.toCreate.length > 0 || d.toUpdate.length > 0;

/** Combien de lignes une proposition porte. C'est ce que dit la pastille. */
export const countOf = (d: ImportDiff): number => d.toCreate.length + d.toUpdate.length;

/**
 * Ce que ce flux apporterait au classeur, moins ce qu'on a déjà écarté.
 *
 * LE STATUT VIENT DU FLUX ET NON DE L'APPELANT. `parsed.kind` dit si l'on
 * regarde des séances ou des souhaits, et c'est exactement la distinction
 * dont `diffImport` a besoin pour décider sur quelle étagère naît une
 * fiche créée. Le passer à la main depuis le hook aurait mis la règle à
 * deux endroits.
 */
export function proposalFrom(films: Film[], parsed: ParsedCsv, dismissed: Set<string>): ImportDiff {
  const diff = diffImport(
    films,
    parsed.rows,
    parsed.kind === "watchlist" ? "watchlist" : "watched"
  );
  /* ON ÉCARTE APRÈS LE CALCUL ET NON AVANT. Retirer les lignes refusées
     des `rows` en amont les rendrait invisibles à `diffImport` — donc
     absentes de `unchanged` aussi — et la proposition ne saurait plus
     dire combien de films du flux elle a réellement regardés. */
  const kept = (f: { title: string; year?: Film["year"] }) => !dismissed.has(filmKey(f));
  return {
    toCreate: diff.toCreate.filter(kept),
    toUpdate: diff.toUpdate.filter((u) => kept(u.film)),
    unchanged: diff.unchanged,
  };
}

/**
 * Les deux moitiés de la veille en une seule proposition.
 *
 * Le flux et la watchlist sont lus à des rythmes différents — l'un à
 * chaque passe, l'autre une fois par jour — donc ils arrivent séparément
 * et se cumulent ici. UN FILM PRÉSENT DES DEUX CÔTÉS EST TENU PAR LE
 * PREMIER : une séance vue l'emporte sur un souhait, sinon un film
 * qu'on a regardé hier et retiré de sa watchlist ce matin entrerait au
 * classeur en « à voir ».
 */
export function mergeProposals(first: ImportDiff, second: ImportDiff): ImportDiff {
  const seen = new Set([
    ...first.toCreate.map(filmKey),
    ...first.toUpdate.map((u) => filmKey(u.film)),
  ]);
  return {
    toCreate: [...first.toCreate, ...second.toCreate.filter((f) => !seen.has(filmKey(f)))],
    toUpdate: [...first.toUpdate, ...second.toUpdate.filter((u) => !seen.has(filmKey(u.film)))],
    unchanged: [...first.unchanged, ...second.unchanged],
  };
}

/**
 * Ce qu'on retient d'une proposition dont on n'a coché qu'une partie.
 *
 * Rend deux choses parce qu'il se passe deux choses : ce qui part à
 * l'écriture, et ce qu'on n'a PAS coché — qui s'en va dans `dismissed`
 * pour ne plus revenir, sur aucun appareil.
 */
export function splitByChoice(
  diff: ImportDiff,
  chosen: Set<string>
): { taken: ImportDiff; refused: string[] } {
  const refused: string[] = [];
  const pick = <T>(items: T[], keyOf: (item: T) => string): T[] =>
    items.filter((item) => {
      const k = keyOf(item);
      if (chosen.has(k)) return true;
      refused.push(k);
      return false;
    });

  return {
    taken: {
      toCreate: pick(diff.toCreate, filmKey),
      toUpdate: pick(diff.toUpdate, (u) => filmKey(u.film)),
      unchanged: [],
    },
    refused,
  };
}
