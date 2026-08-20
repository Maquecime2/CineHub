/* ============================================================
   L'USURE D'UN BOÎTIER — ce que le temps a fait de ce film

   Sur une étagère, un film vu six fois et un film jamais rouvert depuis
   2019 se ressemblaient trait pour trait. Le classeur SAIT pourtant tout
   cela : `watches` est un journal de séances. Ce module le lit et rend ce
   qu'un objet peut en montrer.

   PUR, HORS LIGNE, DÉTERMINISTE. Il ne demande rien à personne et rend
   deux fois la même chose pour la même fiche — c'est ce qui lui permet
   d'être appelé au rendu de chaque boîtier, des dizaines de fois par
   seconde sous un glissement.

   IL N'ÉCRIT AUCUN SEUIL. « Il y a longtemps » n'est pas un nombre de
   jours qu'on choisit : `domain/athome` a déjà tranché que c'est une
   FRACTION de l'étendue de la pratique, parce qu'« un seuil ne mesure pas
   l'oubli, il mesure l'âge du classeur ». Le nombre arrive donc en
   argument, par `neglectDaysFor`, et il n'y en a qu'un dans le projet :
   un boîtier qui paraît négligé sur l'étagère pendant que le panneau des
   suggestions n'en dit rien ferait de l'un des deux un menteur, sans que
   rien à l'écran dise lequel.
   ============================================================ */
import { sortWatches, watchCount } from "./film";
import { hash, seededRand } from "./seeded";
import type { Film } from "../types";

const DAY = 24 * 3600 * 1000;

/**
 * QUATRE ÉTATS, ET LE PLUS IMPORTANT EST CELUI QUI NE DESSINE RIEN.
 *
 * - `sealed` — jamais vu. Le boîtier est encore sous cellophane.
 * - `fresh` — vu, et pas il y a longtemps. **Le cas ordinaire.**
 * - `dormant` — vu, mais plus depuis longtemps POUR CE CLASSEUR-LÀ.
 * - `undated` — vu, et on ne sait pas quand.
 *
 * `fresh` NE SE DESSINE PAS, et c'est la règle qui fait tenir tout le
 * reste : si chaque boîtier porte une marque, aucun n'est marqué. Ce
 * qu'on ajoute ne parle que de l'exception.
 *
 * ET `undated` N'EST PAS `dormant`. Un import Letterboxd sans dates n'est
 * pas un film négligé : le classeur ne SAIT pas. Les confondre
 * reprocherait de la négligence à quelqu'un qui n'a fait que manquer de
 * dates. C'est la règle déjà écrite pour `keywords` et pour `frames` —
 * absent et vide ne disent pas la même chose. Il ne dessine donc rien lui
 * non plus, mais il porte une clé à lui : le miroir en liste peut le
 * dire, le dessin n'a pas à l'inventer.
 */
export type WearState = "sealed" | "fresh" | "dormant" | "undated";

export interface Wear {
  /** Le QUAND. Une clé, jamais une phrase — l'écran la met en mots. */
  state: WearState;
  /**
   * Le COMBIEN — le nombre de séances, 0 pour ce qu'on n'a pas vu.
   *
   * IL EST ORTHOGONAL À `state`, et les fondre en un seul champ les
   * aurait mis en concurrence : un film vu six fois et rouvert la
   * dernière fois en 2019 est `dormant` ET `times: 6`. Choisir un
   * vainqueur aurait été arbitraire, et on aurait perdu la moitié de ce
   * qu'on venait de lire.
   */
  times: number;
  /** Jours depuis la dernière séance datée ; `null` quand on ne sait pas. */
  since: number | null;
  /**
   * SEMÉ SUR L'IDENTIFIANT, JAMAIS TIRÉ. Entre 0 et 1 : le grain de la
   * poussière, le biais du reflet. Un boîtier a la même usure pour
   * toujours — `Math.random` la ferait bouger à chaque rendu, et il y en
   * a des dizaines par seconde sous un glissement.
   */
  grain: number;
}

/**
 * AU-DELÀ DE QUATRE SÉANCES, LA PATINE NE SE LIT PLUS.
 *
 * Elle est une différence entre deux boîtiers voisins, pas un compteur :
 * l'œil distingue « une fois » de « trois fois », il ne distingue pas
 * « neuf » de « douze ». Sans plafond, un film revu vingt fois aurait
 * mangé sa tranche entière et se serait lu comme une avarie.
 */
export const PATINA_CAP = 4;

/**
 * La patine, de 0 à 1 — ce que le dessin lit, pour n'avoir à connaître
 * ni le plafond ni le compte.
 */
export const patinaOf = (times: number): number =>
  Math.min(Math.max(times - 1, 0), PATINA_CAP - 1) / (PATINA_CAP - 1);

/** La dernière séance DATÉE d'une fiche, en millisecondes ; `null` sinon. */
const lastDated = (film: Film): number | null => {
  for (const w of sortWatches(film.watches || [])) {
    if (!w?.date) continue;
    const t = Date.parse(`${w.date}T12:00:00Z`);
    if (Number.isFinite(t)) return t;
  }
  return null;
};

/**
 * Ce que le temps a fait de ce film.
 *
 * `neglectDays` vient de `neglectDaysFor(films)` (`domain/athome`), et
 * `now` est un paramètre : sans lui ce module serait intestable, la
 * moitié de ce qu'il calcule étant une durée depuis aujourd'hui.
 */
export function wearOf(film: Film, neglectDays: number, now: number = Date.now()): Wear {
  const times = watchCount(film);
  const grain = seededRand(Math.abs(hash(film.id)) + 7);
  const when = lastDated(film);

  /* LE JOURNAL DÉCIDE, ET LE STATUT NE TRANCHE QUE LE JOURNAL VIDE. Une
     fiche « à voir » qui porte des séances a été vue — c'est la preuve
     qui l'emporte sur l'étiquette, sans quoi une séance notée après coup
     laisserait le boîtier sous cellophane pour toujours. */
  if (times === 0)
    return {
      state: film.status === "watchlist" ? "sealed" : "undated",
      times: 0,
      since: null,
      grain,
    };

  if (when == null) return { state: "undated", times, since: null, grain };

  const since = Math.floor((now - when) / DAY);
  return { state: since >= neglectDays ? "dormant" : "fresh", times, since, grain };
}
