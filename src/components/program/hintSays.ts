/* ============================================================
   D'OÙ VIENT CETTE PISTE, EN TOUTES LETTRES

   IL ÉTAIT ÉCRIT DEUX FOIS, et c'est pour ça qu'il est ici. Le panneau
   d'un nœud portait une fonction, la feuille de moisson une copie en
   ligne dans son JSX ; les deux disaient la même chose, et une source
   de plus les aurait fait diverger le jour même — l'une à trois
   branches, l'autre à deux, et personne pour dire laquelle était en
   retard. C'est la leçon des sept coquilles de modale, payée une fois.

   IL BRANCHE SUR LA NOTE, ET NON SUR `hint.source`. Ce n'est pas un
   détail d'implémentation : ce que l'écran doit dire, c'est ce qui sera
   écrit dans `Bond.note` si l'on pose le lien — donc ce qu'on relira sur
   la carte dans six mois, quand `Hint` n'existera plus nulle part. Les
   marques sont le contrat, et `hints.ts` les tient.

   LA DONNÉE RESTE UNE CLÉ, L'ÉCRAN LA TRADUIT. `credits image 3` porte
   un rôle de `KinshipRole` et un compte ; c'est ici qu'ils deviennent du
   français ou de l'anglais. Écrire la phrase dans la note figerait la
   langue du jour dans les données de quelqu'un — la règle de
   `threadLabel`, et elle vaut pour les trois sources.
   ============================================================ */
import { readCreditNote, readCrossNote } from "../../domain/hints";
import type { Hint } from "../../domain/hints";
import type { NameOf } from "../../domain/motifs";

/**
 * Ce qu'on dit d'une piste, sous le lien qu'elle propose.
 *
 * TROIS SOURCES, TROIS PHRASES, et elles ne sont pas interchangeables :
 * Wikidata ÉNONCE une filiation, vos fiches CONSTATENT un générique, et
 * le croisement constate la même chose sur des films que vous ne
 * possédez pas. Les confondre reviendrait à présenter une lecture comme
 * un fait, ce que tout ce module refuse.
 */
export const hintSays = (hint: Hint, say: NameOf): string => {
  const credit = readCreditNote(hint.note);
  if (credit)
    return say("program.hintFromCredits", {
      role: say(`roles.${credit.role}`),
      count: credit.n,
    });

  const cross = readCrossNote(hint.note);
  if (cross)
    return say("program.hintFromCrossed", {
      role: say(`roles.${cross.role}`),
      count: cross.n,
    });

  return say("program.hintFromWikidata");
};
