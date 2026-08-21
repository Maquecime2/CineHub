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
import { crossHintsFor } from "../services/tmdbHints";
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
  /* DEUX ÉTATS POUR LES DEUX MOITIÉS DE RÉSEAU, et non un tableau
     fondu : le classeur s'intercale ENTRE elles (voir l'ordre plus bas),
     et un seul tableau aurait forcé le croisement à passer devant lui. */
  const [hints, setHints] = useState<Hint[] | null>(null);
  const [crossed, setCrossed] = useState<Hint[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [trouble, setTrouble] = useState(false);
  /* Le nom sert de clé d'effet : un tableau se recrée à chaque rendu, et
     le dépendre ferait redemander en boucle. */
  const key = names.join("|");
  const [again, setAgain] = useState(0);

  useEffect(() => {
    if (!key || !apiKey) {
      setHints(null);
      setCrossed([]);
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
      /* LES DEUX SOURCES DE RÉSEAU PARTENT ENSEMBLE, et `allSettled`
         plutôt que `all` : elles ne savent pas la même chose, et
         Wikidata muette ne doit pas emporter le croisement des
         génériques — ni l'inverse.

         MAIS L'ÉCHEC D'UNE SEULE SE DIT QUAND MÊME, et c'est le premier
         jet qui avait tort. On avait voulu ne se plaindre que si les
         DEUX tombaient ; c'était inventer un troisième état — « il
         manque la moitié de la réponse et on ne vous le dit pas ». Or
         `NodePanel` montre DÉJÀ `Trouble` À CÔTÉ des pistes qu'il a,
         parce que le classeur en fournit hors ligne : l'échec est
         ADDITIF ici, jamais exclusif. On garde donc ce qui est arrivé,
         ET on dit qu'on n'a pas tout pu demander. */
      Promise.allSettled([hintsFor(key.split("|"), apiKey), crossHintsFor(key.split("|"), apiKey)])
        .then(([wiki, crossed]) => {
          if (!alive) return;
          setHints(wiki.status === "fulfilled" ? wiki.value : []);
          setCrossed(crossed.status === "fulfilled" ? crossed.value : []);
          setWaiting(false);
          if (wiki.status === "rejected" || crossed.status === "rejected") setTrouble(true);
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
  /* LES TROIS SOURCES SE REJOIGNENT ICI ET NON DANS LA VUE, et L'ORDRE
     EST UNE DÉCISION : `usefulHints` dédoublonne par `bondId`, premier
     arrivé gagne.

       1. WIKIDATA, parce qu'elle ÉNONCE là où les deux autres
          constatent. Elle est aussi la seule à présenter quelqu'un dont
          on ne possède rien.
       2. LE CLASSEUR, gratuit et hors ligne, et qui tient l'information
          de VOS fiches — donc de plus près.
       3. LE CROISEMENT DES GÉNÉRIQUES, qui dit la même chose que le
          classeur mais pour des films qu'on ne possède pas. Il vient
          après lui sur une paire qu'ils connaissent tous les deux, et
          parle seul sur les autres.

     ET CE MÉLANGE EST ÉCRIT DEUX FOIS : `HintHarvest` ne passe pas par
     ce hook et compose le sien. Une source ajoutée ici et oubliée là-bas
     n'apparaîtrait jamais dans la feuille de moisson, en silence. */
  const all = useMemo(
    () => (hints ? [...hints, ...mine, ...crossed] : mine),
    [hints, mine, crossed]
  );
  return { hints: all, waiting, trouble, retry };
}
