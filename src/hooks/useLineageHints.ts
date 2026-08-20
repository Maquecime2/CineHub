/* ============================================================
   LES PISTES D'UNE PERSONNE, LUES UNE FOIS
   ============================================================

   TROIS ÉTATS ET JAMAIS DEUX. « On attend », « il n'y a rien », « on
   n'a pas pu demander » sont trois écrans, et les confondre est le
   défaut que `CLAUDE.md` dit avoir retiré de quatre vues. Le hook les
   rend séparément pour que la vue n'ait pas à les deviner d'un tableau
   vide.

   IL NE FILTRE PAS. `usefulHints` a besoin des liens déjà posés, et
   l'appelant est le seul à les tenir — le hook rendrait des pistes
   périmées à chaque lien noué s'il s'en chargeait ici.
   ============================================================ */
import { useCallback, useEffect, useMemo, useState } from "react";
import { hintsFor } from "../services/lineageHints";
import { binderHints } from "../domain/hints";
import type { Hint } from "../domain/hints";
import type { Film } from "../types";

export interface HintsState {
  hints: Hint[];
  waiting: boolean;
  trouble: boolean;
  retry: () => void;
}

export function useLineageHints(names: string[], apiKey: string, films: Film[] = []): HintsState {
  /* CE QUE LE CLASSEUR SAIT DÉJÀ NE SE FAIT PAS ATTENDRE. Il n'y a rien
     à demander à personne : ces pistes sont là au premier rendu, et le
     réseau ne fait que les compléter. Sans clé et hors ligne, elles
     restent — c'est la moitié qui répond le plus souvent. */
  const mine = useMemo(() => binderHints(films), [films]);
  const [hints, setHints] = useState<Hint[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [trouble, setTrouble] = useState(false);
  /* Le nom sert de clé d'effet : un tableau se recrée à chaque rendu, et
     le dépendre ferait redemander en boucle. */
  const key = names.join("|");
  const [again, setAgain] = useState(0);

  useEffect(() => {
    if (!key || !apiKey) {
      setHints(null);
      return;
    }
    let alive = true;
    setWaiting(true);
    setTrouble(false);
    const fail = () => {
      /* PAS UN `catch` VIDE : c'est un chargement, et l'échec a un
         écran à lui. */
      if (!alive) return;
      setTrouble(true);
      setWaiting(false);
    };
    /* LE `try` ENGLOBE L'APPEL, ET PAS SEULEMENT SA PROMESSE. Un service
       qui lève AVANT de rendre une promesse traverserait un `.catch` et
       emporterait tout le panneau — c'est le défaut déjà réglé dans
       `PeoplePicker` et dans l'écran de fin du quizz. */
    try {
      hintsFor(key.split("|"), apiKey)
        .then((found) => {
          if (!alive) return;
          setHints(found);
          setWaiting(false);
        })
        .catch(fail);
    } catch {
      fail();
    }
    return () => {
      alive = false;
    };
  }, [key, apiKey, again]);

  const retry = useCallback(() => setAgain((n) => n + 1), []);
  /* Les deux sources se rejoignent ici et NON dans la vue : `usefulHints`
     dédoublonne par `bondId`, donc une filiation que Wikidata et vos
     fiches énoncent toutes les deux ne se propose qu'une fois — et c'est
     Wikidata qui passe en premier, puisqu'elle DIT ce que l'autre ne
     fait que suggérer. */
  const all = useMemo(() => (hints ? [...hints, ...mine] : mine), [hints, mine]);
  return { hints: all, waiting, trouble, retry };
}
