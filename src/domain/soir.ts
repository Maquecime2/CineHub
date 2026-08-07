/* ============================================================
   LEQUEL CE SOIR ? — la seule question que la watchlist ne savait pas
   entendre

   La liste « à voir » ne sait que s'empiler. On y range des films
   pendant des mois, et le soir venu on la parcourt du regard sans
   pouvoir lui poser la question qu'on a vraiment : j'ai une heure
   quarante, je suis d'humeur mélancolique, lequel ?

   CE N'EST PAS LA QUESTION DU BUREAU DES DÉCOUVERTES. `reco` demande
   « quoi d'autre existe-t-il dehors » et parle à TMDB pour y répondre.
   Ici on ne cherche rien de nouveau : tout est déjà là, mis de côté par
   vous, et il ne s'agit que de trancher. D'où un module à part, qui
   emprunte le PROFIL de `taste` mais pas le score de `reco` — celui-ci
   est taillé pour un candidat TMDB, avec ses compteurs de votes et ses
   sources, dont une fiche de votre liste n'a rien.

   Pur, sans réseau, sans état : une collection entre, un classement
   sort. Les motifs devinés arrivent tout mâchés (voir `SoirDrawer`),
   parce qu'aller les chercher est une entrée-sortie et que ce module
   n'en fait pas.
   ============================================================ */
import { buildTaste, decadeOf } from "../taste";
import { motifById } from "./motifs";
import type { Film } from "../types";

export interface Envie {
  /** Minutes disponibles. `null` : « peu importe ». */
  minutes: number | null;
  /** Ids de motifs souhaités — la famille « ton » d'abord. */
  humeur: string[];
  /** Codes ISO 639-1 voulus. Vide : toutes. */
  langues: string[];
}

export interface Proposition {
  film: Film;
  /** Ce qui l'a fait monter, en clair et en français. */
  raisons: string[];
  /** La carte doit le dire : on ne fait pas passer une inconnue pour un fait. */
  duréeInconnue: boolean;
  /** Minutes au-delà du créneau, s'il y en a. */
  dépassement: number;
}

/* Les créneaux tels qu'on les dit. « Peu importe » n'en est pas un :
   c'est l'absence de contrainte, et l'interface l'exprime en n'en
   choisissant aucun. */
export const CRÉNEAUX: { label: string; minutes: number }[] = [
  { label: "une heure", minutes: 60 },
  { label: "une heure et demie", minutes: 90 },
  { label: "deux heures", minutes: 120 },
  { label: "deux heures et demie", minutes: 150 },
];

/* AU-DELÀ DE QUOI UN DÉPASSEMENT N'EN EST PLUS UN, MAIS UN REFUS.

   Le créneau est une enveloppe, pas une égalité : « j'ai deux heures »
   accepte volontiers cent dix-huit minutes, et cent vingt-cinq n'est pas
   une erreur — c'est un quart d'heure de retard au coucher. Trois quarts
   d'heure de trop, en revanche, ce n'est plus la même soirée. */
const MARGE = 45;

/* Ce que vaut une durée inconnue. Sous « ça tient » (1), au-dessus d'un
   franc dépassement : une fiche importée de Letterboxd sans être passée
   par TMDB n'a pas de durée, et l'écarter reviendrait à punir
   l'incomplétude — c'est-à-dire à cacher la moitié d'une collection
   fraîchement importée. Elle passe après les réponses sûres, et le dit. */
const SANS_DURÉE = 0.55;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/* Un critère qui compte, et combien. On les assemble puis on fait une
   moyenne PONDÉRÉE DES SEULS CRITÈRES ACTIFS : sans cela, ne rien
   demander écraserait tous les scores vers zéro et le classement ne
   dirait plus rien. */
interface Critère {
  poids: number;
  valeur: number;
}

const moyennePondérée = (cs: Critère[]): number => {
  const total = cs.reduce((s, c) => s + c.poids, 0);
  if (!total) return 0;
  return cs.reduce((s, c) => s + c.poids * c.valeur, 0) / total;
};

/** Les motifs que ce film porte : les siens, plus ceux devinés pour lui. */
const motifsDe = (f: Film, devinés?: Map<string, string[]>): Set<string> =>
  new Set([...(f.motifs || []), ...(devinés?.get(f.id) || [])]);

/* L'ancienneté dans la liste, ramenée entre 0 et 1 sur l'étendue de la
   watchlist elle-même : le film rangé il y a trois ans est justement
   celui qu'on a oublié, et une liste toute neuve ne doit pas pour autant
   voir ce critère s'affoler. */
const ancienneté = (f: Film, plusVieux: number, plusJeune: number): number => {
  if (plusJeune <= plusVieux) return 0.5;
  return clamp01(1 - (f.addedAt - plusVieux) / (plusJeune - plusVieux));
};

const ans = (ms: number): number => Math.floor(ms / (365.25 * 24 * 3600 * 1000));

/**
 * Le classement de la soirée, du plus indiqué au moins.
 *
 * `films` est TOUTE la collection et non la seule watchlist : le profil
 * de goût se bâtit sur les films vus, et une liste d'intentions ne dit
 * rien de ce qu'on aime.
 *
 * Déterministe, et c'est voulu. « Une autre » descend d'un cran dans
 * cette liste plutôt que de retirer au sort : un classement s'explique
 * — « voilà le suivant » — là où un hasard ne s'explique jamais, et il
 * se teste.
 */
export function classerLaSoirée(
  films: Film[],
  envie: Envie,
  motifsDevinés?: Map<string, string[]>
): Proposition[] {
  const pool = films.filter((f) => f.status === "watchlist" && !f.archived);
  if (pool.length === 0) return [];

  const taste = buildTaste(films);
  const veutHumeur = envie.humeur.length > 0;
  const veutLangue = envie.langues.length > 0;

  /* La langue est un filtre choisi : demander du japonais et recevoir du
     suédois n'aurait pas de sens. Mais une fiche dont la LANGUE est
     inconnue reste éligible, pour la raison qui vaut aussi pour la
     durée — on ne punit pas l'incomplétude. */
  const retenus = veutLangue
    ? pool.filter((f) => !f.language || envie.langues.includes(f.language))
    : pool;
  if (retenus.length === 0) return [];

  const dates = retenus.map((f) => f.addedAt);
  const plusVieux = Math.min(...dates);
  const plusJeune = Math.max(...dates);
  const maintenant = Date.now();

  const propositions = retenus.map((f) => {
    const critères: Critère[] = [];
    const raisons: string[] = [];

    /* ---- le temps ---- */
    const durée = f.runtime;
    const duréeInconnue = durée == null || durée <= 0;
    let dépassement = 0;

    if (envie.minutes != null) {
      if (duréeInconnue) {
        critères.push({ poids: 0.34, valeur: SANS_DURÉE });
      } else {
        dépassement = Math.max(0, durée! - envie.minutes);
        critères.push({
          poids: 0.34,
          valeur: dépassement === 0 ? 1 : clamp01(1 - dépassement / MARGE),
        });
        if (dépassement === 0) raisons.push(`${durée} min — ça tient`);
        else raisons.push(`${durée} min, soit ${dépassement} de trop`);
      }
    } else if (!duréeInconnue) {
      raisons.push(`${durée} min`);
    }
    if (duréeInconnue) raisons.push("durée inconnue");

    /* ---- l'humeur ----
       Le critère le plus fort quand il est posé : c'est la question
       qu'on est venu poser, le reste n'est qu'affinage. */
    if (veutHumeur) {
      const siens = motifsDe(f, motifsDevinés);
      const touchés = envie.humeur.filter((id) => siens.has(id));
      critères.push({ poids: 0.44, valeur: touchés.length / envie.humeur.length });
      for (const id of touchés) {
        const m = motifById(id);
        if (m) raisons.push(m.label.toLowerCase());
      }
    }

    /* ---- ce que vous aimez ----
       Ne sert qu'à départager : deux films qui tiennent dans la soirée
       et portent la même humeur ne se distinguent plus autrement. Sans
       profil (moins de trois films vus), on n'en tire rien plutôt que
       d'inventer. */
    if (!taste.isEmpty) {
      const gs = (f.genres || []).map((g: string) => taste.genres.get(g) || 0);
      const genre = gs.length ? gs.reduce((a: number, b: number) => a + b, 0) / gs.length : 0;
      const déc = decadeOf(f.year);
      const décennie = déc ? taste.decades.get(déc) || 0 : 0;
      const langue = f.language ? taste.languages.get(f.language) || 0 : 0;
      critères.push({
        poids: 0.14,
        valeur: clamp01((0.55 * genre + 0.25 * décennie + 0.2 * langue + 1) / 2),
      });

      /* La raison la plus parlante est le genre que vous aimez le plus
         parmi ceux de CE film — « genre que vous aimez : drame » se lit,
         « affinité 0,72 » non.

         Tournure NOMINALE et non « vous aimez le drame » : l'article
         dépend du genre — le drame, l'action, la science-fiction — et
         une phrase qui doit deviner un article finit toujours par se
         tromper sur l'un d'eux. */
      const meilleur = (f.genres || [])
        .map((g: string) => ({ g, w: taste.genres.get(g) || 0 }))
        .sort((a: { w: number }, b: { w: number }) => b.w - a.w)[0];
      if (meilleur && meilleur.w > 0.35)
        raisons.push(`genre que vous aimez : ${meilleur.g.toLowerCase()}`);
    }

    /* ---- depuis quand il attend ---- */
    critères.push({ poids: 0.08, valeur: ancienneté(f, plusVieux, plusJeune) });
    const âge = ans(maintenant - f.addedAt);
    if (âge >= 1) raisons.push(`en attente depuis ${âge} an${âge > 1 ? "s" : ""}`);

    return {
      film: f,
      raisons,
      duréeInconnue,
      dépassement,
      score: moyennePondérée(critères),
    };
  });

  /* À score égal, le plus anciennement rangé passe devant : c'est celui
     qu'on avait oublié. Le titre ne tranche qu'en dernier ressort, pour
     que l'ordre ne dépende jamais de celui de la collection. */
  propositions.sort(
    (a, b) =>
      b.score - a.score ||
      a.film.addedAt - b.film.addedAt ||
      a.film.title.localeCompare(b.film.title, "fr")
  );

  return propositions.map(({ film, raisons, duréeInconnue, dépassement }) => ({
    film,
    raisons,
    duréeInconnue,
    dépassement,
  }));
}

/**
 * Les langues réellement présentes dans la watchlist, les plus fournies
 * d'abord. Proposer les cent quatre-vingts langues de la norme quand la
 * liste en contient trois serait un formulaire, pas un choix.
 */
export const languesDeLaListe = (films: Film[]): { code: string; n: number }[] => {
  const compte = new Map<string, number>();
  for (const f of films)
    if (f.status === "watchlist" && !f.archived && f.language)
      compte.set(f.language, (compte.get(f.language) || 0) + 1);
  return [...compte.entries()]
    .map(([code, n]) => ({ code, n }))
    .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
};
