/* ============================================================
   LE RYTHME DE LA VEILLE LETTERBOXD
   ============================================================

   Quand elle part, et jamais plus souvent qu'il ne faut :

   — à l'ouverture, une fois le classeur chargé ;
   — quand le réseau revient ;
   — quand l'onglet redevient visible, parce qu'on revient d'ailleurs ;
   — et tous les quarts d'heure, faute de mieux.

   C'est la structure de `useSync`, et c'est délibéré : deux boucles de
   fond qui se réveillent différemment sont deux boucles qu'on ne peut
   plus raisonner ensemble.

   MAIS PAS LE MÊME PAS. La synchro bat à cinq minutes parce qu'elle
   rattrape ce que l'on vient d'écrire soi-même. Ici on regarde le
   travail de quelqu'un d'autre — soi, ailleurs, sur un autre site — et
   une séance Letterboxd ne se saisit pas à la seconde.

   ============================================================
   DEUX LECTURES, DEUX CADENCES, ET LA RAISON EST ARITHMÉTIQUE
   ============================================================

   Le flux coûte UNE requête et rend une centaine d'entrées : il part à
   chaque passe. La watchlist n'a pas de flux — `/watchlist/rss/` répond
   403 — et se lit dans des pages de vingt-huit films, jusqu'à quarante.
   La tirer tous les quarts d'heure, ce sont quarante requêtes chez
   Letterboxd pour apprendre qu'il ne s'est rien passé, et la certitude
   de se faire couper. Une fois par jour suffit : une watchlist bouge
   lentement, une séance bouge vite.

   ============================================================
   L'ÉCHEC EST MUET, ET C'EST LE BON CHOIX ICI
   ============================================================

   Ce n'est pas un chargement de page, c'est une décoration : personne
   n'a rien demandé, rien n'attend à l'écran. Un `Trouble` sur le rail
   toutes les quinze minutes parce qu'un train est entré dans un tunnel
   serait une alarme pour un non-événement. Donc rien ne paraît, la
   pastille reste absente, et on retente à la passe suivante.

   Le dernier échec est retenu quand même, et il se dit DANS la feuille
   si on l'ouvre — là, quelqu'un a demandé, et « il n'y a rien » ne doit
   pas se confondre avec « on n'a pas pu demander ».
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLetterboxdFeed, fetchLetterboxdWatchlist } from "../services/letterboxd";
import {
  dismiss,
  loadWatch,
  onWatchChanged,
  patchWatch,
  type LetterboxdWatch,
} from "../services/letterboxdWatch";
import { serverConfigured } from "../services/server";
import { getTmdbKey } from "../services/tmdbKey";
import { enrichRows } from "../tmdb";
import { diffImport, filmKey } from "../domain/importing";
import {
  NOTHING,
  countOf,
  mergeProposals,
  proposalFrom,
  splitByChoice,
} from "../domain/letterboxdWatch";
import type { Film, ImportDiff, ParsedCsv } from "../types";

/* Une lecture, telle que Letterboxd l'a rendue : ses LIGNES, et de quel
   côté elles viennent (`kind`). On garde ça et pas seulement la
   proposition parce que `enrichRows` travaille sur des lignes. */
type Source = ParsedCsv;

const RHYTHM_MS = 15 * 60 * 1000;

/* Un jour. La watchlist ne part qu'au-delà, donc en pratique une fois
   par session et jamais deux fois dans la journée. */
const WATCHLIST_EVERY_MS = 24 * 60 * 60 * 1000;

export interface LetterboxdVigil {
  /** Ce que Letterboxd a de plus, moins ce qu'on a déjà écarté. */
  proposal: ImportDiff;
  /** Le nombre que porte la pastille. Zéro : il n'y a pas de pastille. */
  count: number;
  /** Une passe est en cours. */
  busy: boolean;
  /**
   * On écrit, et TMDB est en train de compléter. `null` au repos.
   *
   * Ce n'est plus instantané : valider demande à TMDB une fiche par
   * film choisi, et un écran qui ne dit rien pendant cinq secondes est
   * un écran qu'on reclique.
   */
  filling: { done: number; total: number } | null;
  /** La dernière passe n'a pas abouti. Ne se dit que dans la feuille. */
  failed: boolean;
  /** Le réglage, tel qu'il est sur le disque. */
  watch: LetterboxdWatch;
  /** Relire maintenant — le bouton de la feuille. */
  refresh: () => void;
  /**
   * On a choisi. Rend ce qu'il faut écrire, et écarte le reste POUR DE
   * BON : l'appelant n'a plus qu'à le passer à l'import.
   */
  settle: (chosen: Set<string>) => Promise<ImportDiff>;
}

export function useLetterboxd(ready: boolean, films: Film[]): LetterboxdVigil {
  const [proposal, setProposal] = useState<ImportDiff>(NOTHING);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [watch, setWatch] = useState<LetterboxdWatch>(() => loadWatch());

  /* `films` change à chaque rendu de l'application : le garder dans une
     référence évite de relancer la boucle à chacun — même raison que
     `onFilms` dans `useSync`. */
  const filmsRef = useRef(films);
  /* DANS UN EFFET ET NON AU RENDU, comme `useSync` : écrire dans une
     référence pendant le rendu est ce que React interdit désormais, et
     le lint le refuse — la valeur serait posée par un rendu que React
     peut jeter avant de le valider. */
  useEffect(() => {
    filmsRef.current = films;
  }, [films]);
  const running = useRef(false);
  const sourcesRef = useRef<Source[]>([]);
  const [filling, setFilling] = useState<{ done: number; total: number } | null>(null);

  const run = useCallback(async () => {
    if (running.current) return;
    const kept = loadWatch();
    /* LA VEILLE N'EXISTE PAS SANS SERVEUR. C'est par lui qu'on relaie —
       voir `services/letterboxd` — et c'est lui qui tient le document
       où se range ce qu'on a écarté. */
    if (!serverConfigured() || !kept.on || !kept.handle) return;

    running.current = true;
    setBusy(true);
    let trouble = false;
    let found = NOTHING;
    const refused = new Set(kept.dismissed);
    /* LES LIGNES BRUTES SONT GARDÉES, ET PAS SEULEMENT LA PROPOSITION.
       C'est TMDB qui l'exige : on enrichit des LIGNES, jamais des fiches
       déjà faites — voir `settle`. */
    const sources: Source[] = [];

    /* LE FLUX, TOUJOURS. Une requête, les séances. */
    try {
      const parsed = await fetchLetterboxdFeed(kept.handle);
      sources.push(parsed);
      found = proposalFrom(filmsRef.current, parsed, refused);
      patchWatch({ feedAt: Date.now() });
    } catch {
      /* Muet. Voir l'en-tête : rien ne paraît, on retentera. */
      trouble = true;
    }

    /* LA WATCHLIST, UNE FOIS PAR JOUR. Et seulement si le flux n'a pas
       déjà échoué : quarante pages sur un réseau qui vient de refuser
       une requête, c'est quarante refus de plus. */
    if (!trouble && Date.now() - kept.watchlistAt > WATCHLIST_EVERY_MS) {
      try {
        const parsed = await fetchLetterboxdWatchlist(kept.handle);
        sources.push(parsed);
        /* LE FLUX PASSE EN PREMIER dans la fusion : une séance vue
           l'emporte sur un souhait. Voir `mergeProposals`. */
        found = mergeProposals(found, proposalFrom(filmsRef.current, parsed, refused));
        patchWatch({ watchlistAt: Date.now() });
      } catch {
        trouble = true;
      }
    }

    setProposal(found);
    sourcesRef.current = sources;
    setFailed(trouble);
    setWatch(loadWatch());
    setBusy(false);
    running.current = false;
  }, []);

  useEffect(() => {
    if (!ready || !serverConfigured()) return;
    void run();

    const onOnline = () => void run();
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void run(), RHYTHM_MS);

    /* ET UNE PASSE DÈS QU'ON ALLUME. Cocher la case dans l'import
       n'appelait rien : la boucle ne dépend que de `ready`, et il
       fallait attendre le quart d'heure suivant pour qu'il se passe
       quoi que ce soit. On regardait le rail, rien n'y venait, et la
       seule conclusion possible était que ça ne marchait pas.

       SEULEMENT SUR LE RÉGLAGE, et jamais sur les horodatages : `run`
       écrit `feedAt` par `patchWatch`, donc réagir à toute écriture
       ferait boucler la passe sur elle-même. Le garde `running` la
       rattraperait, mais on ne s'appuie pas sur un garde pour éviter
       une boucle qu'on peut ne pas créer. */
    const at = loadWatch();
    let setting = `${at.on}|${at.handle}`;
    const stopWatching = onWatchChanged(() => {
      const now = loadWatch();
      const next = `${now.on}|${now.handle}`;
      if (next === setting) return;
      setting = next;
      setWatch(now);
      void run();
    });

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
      stopWatching();
    };
  }, [ready, run]);

  /* ============================================================
     ON COMPLÈTE AVANT D'ÉCRIRE, ET NON APRÈS
     ============================================================

     Letterboxd donne un titre, une année, une note, une date — et pour
     les séances un identifiant TMDB. Il ne donne NI réalisateur, ni
     genres, ni affiche, ni distribution, ni mots-clés. Une fiche née de
     la veille sans cette passe serait la fiche la plus pauvre du
     classeur, et c'est le sillage, la constellation, les motifs et les
     filiations qui s'en trouveraient muets — tous lisent `crew`,
     `keywords` et `cast`.

     C'EST L'ORDRE DE L'IMPORT MANUEL, AU CARACTÈRE PRÈS : `enrichRows`
     travaille sur les LIGNES, puis `diffImport` compare. L'inverse —
     compléter des fiches déjà fabriquées — obligerait à refaire à la
     main la fusion que `diffImport` sait déjà faire, et c'est elle qui
     décide ce qu'une fiche existante garde.

     AU MOMENT DE VALIDER, ET JAMAIS DANS LA PASSE DE FOND. La veille se
     réveille toutes les quinze minutes ; y mettre une requête TMDB par
     film proposé ferait payer le quota pour des propositions que
     personne ne regardera. Ici quelqu'un vient de cliquer, et il ne
     paie que pour ce qu'il a coché.

     SANS CLÉ, ON ÉCRIT QUAND MÊME. La veille n'a jamais eu besoin de
     TMDB pour trouver une séance ; refuser d'écrire faute de clé
     perdrait le geste au lieu de le rendre plus riche. Et un échec de
     TMDB ne fait rien perdre non plus : on retombe sur les lignes
     nues, exactement ce qu'on écrivait avant. */
  const settle = useCallback(
    async (chosen: Set<string>): Promise<ImportDiff> => {
      const { refused } = splitByChoice(proposal, chosen);

      const key = getTmdbKey();
      const parts: ImportDiff[] = [];
      /* Le total est compté d'avance : une barre qui découvre sa
         longueur en avançant recule. */
      const wanted = sourcesRef.current.map((parsed) =>
        parsed.rows.filter((r) => chosen.has(filmKey(r)))
      );
      const total = wanted.reduce((n, rows) => n + rows.length, 0);
      let already = 0;
      if (total && key) setFilling({ done: 0, total });

      for (const [i, parsed] of sourcesRef.current.entries()) {
        const rows = wanted[i] ?? [];
        if (!rows.length) continue;
        let ready = rows;
        if (key) {
          try {
            const res = await enrichRows(rows, key, {
              onProgress: (done: number) => setFilling({ done: already + done, total }),
            } as never);
            ready = res.rows;
          } catch {
            /* On garde les lignes nues : mieux vaut une fiche maigre
               qu'un geste perdu. */
          }
          already += rows.length;
        }
        /* LE STATUT VIENT DE LA LECTURE, comme dans `proposalFrom` : le
           flux fait des « vu », la watchlist des « à voir ». */
        parts.push(
          diffImport(filmsRef.current, ready, parsed.kind === "watchlist" ? "watchlist" : "watched")
        );
      }
      setFilling(null);

      /* LE FLUX PASSE EN PREMIER, toujours : `sourcesRef` est rempli
         dans cet ordre et `mergeProposals` garde le premier. */
      const taken = parts.reduce(mergeProposals, NOTHING);

      /* CE QU'ON N'A PAS COCHÉ EST ÉCARTÉ, et pas simplement laissé de
         côté : sans cela la proposition reviendrait identique un quart
         d'heure plus tard, et la seule façon de s'en défaire serait de
         l'accepter. */
      setWatch(dismiss(refused));
      setProposal(NOTHING);
      /* `unchanged` n'a rien à faire dans une écriture : `diffImport` l'a
         rempli des fiches que rien ne change. */
      return { toCreate: taken.toCreate, toUpdate: taken.toUpdate, unchanged: [] };
    },
    [proposal]
  );

  return {
    proposal,
    count: countOf(proposal),
    busy,
    filling,
    failed,
    watch,
    refresh: () => void run(),
    settle,
  };
}
