/* ============================================================
   L'ALMANACH — la collection regardée dans le temps
   ============================================================

   Le journal des séances est la donnée la plus riche de la fiche, et
   jusqu'ici la moins regardée : `WatchLog` la montre film par film, ce
   qui répond à « combien de fois celui-là » et jamais à « qu'ai-je fait
   de cette année ». Ce module répond à la seconde question.

   IL COMPTE DES SÉANCES, PAS DES FICHES, et c'est toute la différence.
   Un mois où l'on a revu six fois le même film n'est pas un mois où l'on
   a vu six films — mais ce n'est pas non plus un mois où l'on a vu un
   film. Les deux nombres sont donnés, jamais l'un pour l'autre.

   Pur, hors ligne, sans React : comme tout `domain/`. */
import { sortWatches } from "./film";
import type { Film, Watch } from "../types";

/* Une séance rapportée à son film — la forme sur laquelle tout le
   module travaille, parce que compter des années, des réalisateurs et
   des décennies demande de savoir DE QUEL FILM chaque séance vient. */
interface Séance {
  film: Film;
  watch: Watch;
}

/** `YYYY-MM-DD` → l'année, ou `null` si la date ne dit rien. */
const anneeDe = (date: string | null | undefined): number | null => {
  const an = Number((date || "").slice(0, 4));
  return Number.isInteger(an) && an > 1800 ? an : null;
};

/* TOUTES LES SÉANCES DE LA COLLECTION.

   Les fiches mises de côté comptent : les avoir archivées ne les rend
   pas non vues. Celles de la liste « à voir », en revanche, n'ont rien
   à faire ici — une séance sur un film qu'on n'a pas vu n'existe pas,
   et si le journal en porte une, c'est le statut qui est en retard.

   `migrate` garantit un `watches` non nul et sème la séance d'une fiche
   d'avant le journal depuis `watchedAt`. On ne refait donc PAS ce
   travail ici : un film sans séance dans son journal est un film sans
   date, et il est juste qu'il ne pèse sur aucun mois. */
const séancesDe = (films: Film[]): Séance[] => {
  const out: Séance[] = [];
  for (const film of films) {
    if (film.status === "watchlist") continue;
    for (const watch of film.watches || []) if (watch?.date) out.push({ film, watch });
  }
  return out;
};

/** Les années où il s'est passé quelque chose, de la plus récente à la plus ancienne. */
export function yearsCovered(films: Film[]): number[] {
  const ans = new Set<number>();
  for (const { watch } of séancesDe(films)) {
    const an = anneeDe(watch.date);
    if (an) ans.add(an);
  }
  return [...ans].sort((a, b) => b - a);
}

/* LA PLUS LONGUE SUITE DE JOURS CONSÉCUTIFS.

   Sur des dates `YYYY-MM-DD` triées, on compare chaque jour au
   précédent + 1. Le passage par `Date` est ce qui rend les fins de mois
   et les années bissextiles gratuites — les compter à la main sur des
   chaînes est exactement le genre de calcul qu'on croit juste jusqu'au
   29 février.

   `Date.UTC` et non `new Date(chaîne)` : le second lit une date nue en
   UTC mais une date horodatée en local, et l'écart d'un fuseau suffit à
   faire glisser une séance de minuit d'un jour. */
const enJours = (date: string): number => {
  const parts = date.split("-").map(Number);
  const a = parts[0] || 0;
  const m = parts[1] || 1;
  const j = parts[2] || 1;
  return Math.floor(Date.UTC(a, m - 1, j) / 86400000);
};

export function longestStreak(dates: string[]): number {
  const jours = [...new Set(dates.filter(Boolean).map(enJours))].sort((a, b) => a - b);
  if (jours.length === 0) return 0;
  let meilleure = 1;
  let courante = 1;
  for (let i = 1; i < jours.length; i++) {
    courante = jours[i] === (jours[i - 1] as number) + 1 ? courante + 1 : 1;
    if (courante > meilleure) meilleure = courante;
  }
  return meilleure;
}

/** Les valeurs les plus fréquentes, du plus au moins — à égalité, l'ordre alphabétique. */
const palmarès = (valeurs: string[], combien: number): { nom: string; n: number }[] => {
  const compte = new Map<string, number>();
  for (const v of valeurs) {
    const nom = (v || "").trim();
    if (nom) compte.set(nom, (compte.get(nom) || 0) + 1);
  }
  return [...compte.entries()]
    .map(([nom, n]) => ({ nom, n }))
    .sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom))
    .slice(0, combien);
};

/* ============================================================
   CE QUI RÉVÈLE UN GOÛT
   ============================================================

   Un compte ne dit rien de personne : tout le monde regarde des films.
   Ce qui distingue une collection d'une autre, c'est l'ÂGE de ce qu'on
   regarde, les pays qu'on visite, les gens qu'on suit, et le rythme
   auquel on y va. Les fonctions qui suivent répondent à cela.

   Chacune est exportée et se teste seule, mais toutes sont appelées par
   `almanacFor` : la vue n'a qu'un appel à faire, et ne peut pas oublier
   d'en faire un. */

/** L'année de sortie d'une fiche, ou `null` — le type `Year` admet le vide. */
const sortieDe = (film: Film): number | null => {
  const n = typeof film.year === "number" ? film.year : Number(film.year);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const médiane = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? (t[m] as number) : ((t[m - 1] as number) + (t[m] as number)) / 2;
};

export interface AgeOfFilms {
  /** Écart moyen, en années, entre la sortie du film et la séance. */
  moyen: number | null;
  median: number | null;
  /** Part des séances portant sur un film de plus de vingt ans, en %. */
  partPatrimoine: number | null;
  /** Le plus vieux film vu dans l'année. */
  plusAncien: { film: Film; year: number } | null;
}

/* L'ÂGE DE CE QU'ON REGARDE.

   « Vous regardez des films vieux de trente-quatre ans en moyenne » dit
   quelque chose qu'aucun compte ne dit. La médiane l'accompagne parce
   qu'elle résiste à un muet de 1920 qui, seul, décalerait la moyenne de
   dix ans à lui tout seul.

   Les fiches sans année de sortie sont ÉCARTÉES et non comptées zéro :
   un film sans date donnerait un âge de deux mille ans. */
export function ageOfFilms(films: Film[], year: number): AgeOfFilms {
  const âges: number[] = [];
  let plusAncien: { film: Film; year: number } | null = null;

  for (const { film, watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year) continue;
    const sortie = sortieDe(film);
    if (sortie == null) continue;
    âges.push(year - sortie);
    if (!plusAncien || sortie < plusAncien.year) plusAncien = { film, year: sortie };
  }

  if (âges.length === 0)
    return { moyen: null, median: null, partPatrimoine: null, plusAncien: null };

  return {
    moyen: âges.reduce((s, a) => s + a, 0) / âges.length,
    median: médiane(âges),
    partPatrimoine: (âges.filter((a) => a > 20).length / âges.length) * 100,
    plusAncien,
  };
}

/* LA NOTE MOYENNE PAR DÉCENNIE — le biais qu'on ne se connaît pas.

   On note peut-être les années 70 d'une demi-étoile au-dessus de tout le
   reste, sans l'avoir jamais remarqué. Seules les séances NOTÉES entrent
   ici ; une décennie sans aucune note n'apparaît pas plutôt que
   d'apparaître à zéro. */
export function ratingByDecade(
  films: Film[],
  year: number
): { decade: number; avg: number; n: number }[] {
  const par = new Map<number, { somme: number; n: number }>();
  for (const { film, watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year || watch.rating == null) continue;
    const sortie = sortieDe(film);
    if (sortie == null) continue;
    const d = Math.floor(sortie / 10) * 10;
    const lot = par.get(d) || { somme: 0, n: 0 };
    lot.somme += watch.rating;
    lot.n += 1;
    par.set(d, lot);
  }
  return [...par.entries()]
    .map(([decade, { somme, n }]) => ({ decade, avg: somme / n, n }))
    .sort((a, b) => a.decade - b.decade);
}

/* LES CINÉASTES DÉCOUVERTS CETTE ANNÉE.

   « Découvert » et non « vu » : on regarde le journal ENTIER pour savoir
   si ce nom était déjà apparu avant. Un réalisateur qu'on suit depuis
   dix ans n'est pas une découverte, même si on l'a revu cette année —
   et c'est justement la distinction qui a de la valeur. */
export function newDirectors(films: Film[], year: number): string[] {
  const première = new Map<string, number>();
  for (const { film, watch } of séancesDe(films)) {
    const an = anneeDe(watch.date);
    if (an == null) continue;
    for (const nom of noms(film.director)) {
      const vu = première.get(nom);
      if (vu == null || an < vu) première.set(nom, an);
    }
  }
  return [...première.entries()]
    .filter(([, an]) => an === year)
    .map(([nom]) => nom)
    .sort((a, b) => a.localeCompare(b));
}

/** « Coen, Coen » ou « Powell & Pressburger » — un champ, plusieurs personnes. */
const noms = (champ: string): string[] =>
  (champ || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

export interface Loyalties {
  /** Cinéastes vus au moins trois fois dans l'année. */
  directors: { nom: string; n: number }[];
  /** Interprètes retrouvés au moins trois fois dans l'année. */
  actors: { nom: string; n: number }[];
}

/* LES FIDÉLITÉS. Trois fois dans une année n'est pas un hasard : c'est
   une traversée d'œuvre, et c'est la chose qu'un cinéphile veut voir
   nommée. En deçà, c'est du bruit. */
export function loyalties(films: Film[], year: number, seuil = 3): Loyalties {
  const réal: string[] = [];
  const acteurs: string[] = [];
  for (const { film, watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year) continue;
    réal.push(...noms(film.director));
    acteurs.push(...(film.cast || []));
  }
  const garde = (liste: string[]) => palmarès(liste, 99).filter((x) => x.n >= seuil);
  return { directors: garde(réal), actors: garde(acteurs) };
}

export interface Rhythm {
  /** Jours distincts où l'on a vu quelque chose. */
  jours: number;
  /** Part de l'année, en % — la densité de la pratique. */
  densite: number;
  /** Le plus long intervalle sans aucune séance, en jours. */
  disette: number;
  /** Le mois le plus dense, de 1 à 12 ; `null` si l'année est vide. */
  moisLePlusDense: number | null;
}

/* LE RYTHME.

   La disette se mesure ENTRE la première et la dernière séance de
   l'année, et non depuis le 1er janvier : une année commencée en mars
   n'a pas connu deux mois de disette, elle n'avait simplement pas
   commencé. Compter les bords ferait passer tout nouvel arrivant pour un
   cinéphile intermittent. */
export function rhythm(films: Film[], year: number): Rhythm {
  const jours = new Set<number>();
  const parMois = Array(12).fill(0) as number[];
  for (const { watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year) continue;
    jours.add(enJours(watch.date));
    const m = Number(watch.date.slice(5, 7));
    if (m >= 1 && m <= 12) parMois[m - 1] = (parMois[m - 1] as number) + 1;
  }

  const triés = [...jours].sort((a, b) => a - b);
  let disette = 0;
  for (let i = 1; i < triés.length; i++)
    disette = Math.max(disette, (triés[i] as number) - (triés[i - 1] as number) - 1);

  const parAn = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
  const max = Math.max(...parMois);
  return {
    jours: jours.size,
    densite: (jours.size / parAn) * 100,
    disette,
    moisLePlusDense: max > 0 ? parMois.indexOf(max) + 1 : null,
  };
}

export interface ScreenTime {
  /** Minutes cumulées des séances dont on connaît la durée. */
  minutes: number;
  /** Durée moyenne d'une séance ; `null` si aucune durée n'est connue. */
  moyenne: number | null;
  plusLong: { film: Film; runtime: number } | null;
  /** Séances dont la durée manque — de quoi dire que le total est un plancher. */
  sansDuree: number;
}

/* LES HEURES DE CINÉMA.

   Les séances sans durée connue sont comptées À PART et non ignorées en
   silence : « quatre-vingt-douze heures » sur une collection à moitié
   renseignée est un chiffre faux, « quatre-vingt-douze heures, et douze
   séances dont on ignore la durée » est un chiffre honnête. C'est aussi
   ce qui donne envie d'aller cliquer « compléter les fiches ». */
export function screenTime(films: Film[], year: number): ScreenTime {
  let minutes = 0;
  let n = 0;
  let sansDuree = 0;
  let plusLong: { film: Film; runtime: number } | null = null;

  for (const { film, watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year) continue;
    if (film.runtime == null || film.runtime <= 0) {
      sansDuree += 1;
      continue;
    }
    minutes += film.runtime;
    n += 1;
    if (!plusLong || film.runtime > plusLong.runtime) plusLong = { film, runtime: film.runtime };
  }
  return { minutes, moyenne: n ? minutes / n : null, plusLong, sansDuree };
}

export interface Geography {
  /** Codes ISO 3166-1, du plus vu au moins. */
  pays: { nom: string; n: number }[];
  /** Codes ISO 639-1. */
  langues: { nom: string; n: number }[];
  /** Combien de pays distincts l'année a traversés. */
  nbPays: number;
}

/* LA GÉOGRAPHIE. On rend des CODES et non des noms : traduire « JP » en
   « Japon » est un choix de langue d'affichage, qui appartient à la vue.
   Le domaine ne sait pas dans quelle langue on le lira. */
export function geography(films: Film[], year: number): Geography {
  const pays: string[] = [];
  const langues: string[] = [];
  for (const { film, watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year) continue;
    pays.push(...(film.countries || []));
    if (film.language) langues.push(film.language);
  }
  return {
    pays: palmarès(pays, 6),
    langues: palmarès(langues, 6),
    nbPays: new Set(pays).size,
  };
}

export interface Almanac {
  year: number;
  /** Séances de l'année — revoyures comprises. */
  count: number;
  /** Fiches distinctes touchées : le nombre de films, et non de soirées. */
  titles: number;
  /** Séances portant sur un film déjà vu auparavant, ici ou avant l'année. */
  rewatches: number;
  /** Douze cases, janvier en tête. Des séances, toujours. */
  byMonth: number[];
  /** Moyenne des séances NOTÉES ; `null` quand aucune ne l'est. */
  ratingAvg: number | null;
  /** Onze cases : 0, 0.5, 1 … 5. */
  ratingHistogram: number[];
  /** Les décennies de sortie visitées, de la plus ancienne à la plus récente. */
  decades: { decade: number; n: number }[];
  topDirectors: { nom: string; n: number }[];
  topGenres: { nom: string; n: number }[];
  longestStreak: number;
  firstWatch: string | null;
  lastWatch: string | null;
  /* Ce qui révèle un goût, plutôt que ce qui le compte. Chacun se
     calcule aussi seul — voir les fonctions du même nom plus haut. */
  age: AgeOfFilms;
  ratingByDecade: { decade: number; avg: number; n: number }[];
  newDirectors: string[];
  loyalties: Loyalties;
  rhythm: Rhythm;
  screenTime: ScreenTime;
  geography: Geography;
}

/* CE QU'UNE ANNÉE CONTIENT.

   Une seule traversée par question, et aucune ne suppose l'autre : une
   collection vide, une année sans séance et une séance sans note
   donnent toutes les trois une réponse — jamais une exception, jamais
   un `NaN`. C'est ce qui permet à la vue de ne rien tester avant de
   dessiner. */
export function almanacFor(films: Film[], year: number): Almanac {
  const toutes = séancesDe(films);
  const année = toutes.filter(({ watch }) => anneeDe(watch.date) === year);

  const notées = année.filter(({ watch }) => watch.rating != null);
  const somme = notées.reduce((s, { watch }) => s + (watch.rating || 0), 0);

  const byMonth = Array(12).fill(0) as number[];
  for (const { watch } of année) {
    const mois = Number(watch.date.slice(5, 7));
    if (mois >= 1 && mois <= 12) byMonth[mois - 1] = (byMonth[mois - 1] as number) + 1;
  }

  /* Une revoyure est une séance qui n'est pas la PREMIÈRE de son film,
     journal entier à l'appui — revoir en mars un film découvert l'année
     d'avant est une revoyure, et le compter comme une découverte serait
     mentir sur ce que l'année a apporté. */
  const première = new Map<string, string>();
  for (const { film, watch } of toutes) {
    const connue = première.get(film.id);
    if (!connue || watch.date < connue) première.set(film.id, watch.date);
  }
  const rewatches = année.filter(({ film, watch }) => watch.date !== première.get(film.id)).length;

  const ratingHistogram = Array(11).fill(0) as number[];
  for (const { watch } of notées) {
    const case_ = Math.round((watch.rating || 0) * 2);
    if (case_ >= 0 && case_ <= 10) ratingHistogram[case_] = (ratingHistogram[case_] as number) + 1;
  }

  /* Les décennies se lisent sur l'ANNÉE DE SORTIE du film, qui peut
     manquer — le type `Year` autorise la chaîne vide, héritée des CSV
     sans colonne d'année. Ces fiches sont écartées du décompte et non
     rangées en l'an zéro. */
  const parDécennie = new Map<number, number>();
  for (const { film } of année) {
    const sortie = typeof film.year === "number" ? film.year : Number(film.year);
    if (!Number.isFinite(sortie) || sortie <= 0) continue;
    const d = Math.floor(sortie / 10) * 10;
    parDécennie.set(d, (parDécennie.get(d) || 0) + 1);
  }

  const dates = année.map(({ watch }) => watch.date).sort();

  return {
    year,
    count: année.length,
    titles: new Set(année.map(({ film }) => film.id)).size,
    rewatches,
    byMonth,
    ratingAvg: notées.length ? somme / notées.length : null,
    ratingHistogram,
    decades: [...parDécennie.entries()]
      .map(([decade, n]) => ({ decade, n }))
      .sort((a, b) => a.decade - b.decade),
    topDirectors: palmarès(
      année.map(({ film }) => film.director),
      6
    ),
    topGenres: palmarès(
      année.flatMap(({ film }) => film.genres || []),
      6
    ),
    longestStreak: longestStreak(dates),
    firstWatch: dates[0] ?? null,
    lastWatch: dates[dates.length - 1] ?? null,
    age: ageOfFilms(films, year),
    ratingByDecade: ratingByDecade(films, year),
    newDirectors: newDirectors(films, year),
    loyalties: loyalties(films, year),
    rhythm: rhythm(films, year),
    screenTime: screenTime(films, year),
    geography: geography(films, year),
  };
}

/* ------------------------------------------------------------
   LES FILMS DE L'ANNÉE
   ------------------------------------------------------------

   L'almanach compte des séances ; une image à emporter montre des
   AFFICHES, et donc des films — un film revu trois fois n'y paraît
   qu'une, avec la meilleure note qu'il a reçue cette année-là.

   L'ordre est celui du mérite puis du calendrier : à note égale, le plus
   récemment vu d'abord. Sans note, un film ne passe pas devant un film
   noté — mais il passe, parce que ne pas avoir noté n'est pas un
   jugement. */
export interface FilmOfYear {
  film: Film;
  /** La meilleure note reçue cette année-là ; `null` si aucune séance n'est notée. */
  rating: number | null;
  /** Séances de l'année pour ce film. */
  n: number;
  /** La dernière séance de l'année. */
  date: string;
}

export function filmsOfYear(films: Film[], year: number): FilmOfYear[] {
  const par = new Map<string, FilmOfYear>();
  for (const { film, watch } of séancesDe(films)) {
    if (anneeDe(watch.date) !== year) continue;
    const vu = par.get(film.id);
    if (!vu) {
      par.set(film.id, { film, rating: watch.rating, n: 1, date: watch.date });
      continue;
    }
    vu.n += 1;
    if (watch.rating != null && (vu.rating == null || watch.rating > vu.rating))
      vu.rating = watch.rating;
    if (watch.date > vu.date) vu.date = watch.date;
  }
  return [...par.values()].sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.date.localeCompare(a.date)
  );
}

/* ------------------------------------------------------------
   CE QUI A BOUGÉ
   ------------------------------------------------------------

   La trouvaille la plus personnelle de l'almanach n'est pas un compte :
   c'est un film qu'on avait mis trois étoiles et qui en vaut cinq dix
   ans plus tard. `ratingDrift` sait déjà le calculer sur une fiche ; il
   ne manquait qu'un endroit d'où regarder toute la collection.

   On garde l'écart le plus GRAND en valeur absolue, et on ne retient
   que le sens dans lequel il penche — un film qui monte puis redescend
   a bien bougé deux fois, mais ce qu'on veut voir est son amplitude. */
export interface Drift {
  film: Film;
  /** Signé : positif si la note a monté. */
  delta: number;
  from: number;
  to: number;
  /** La séance qui porte cet écart. */
  date: string;
}

export function driftHighlights(films: Film[], combien = 5): Drift[] {
  const out: Drift[] = [];
  for (const film of films) {
    if (film.status === "watchlist") continue;
    const ordonnées = sortWatches(film.watches || []);
    let meilleur: Drift | null = null;
    ordonnées.forEach((w, i) => {
      if (w.rating == null) return;
      const avant = ordonnées.slice(i + 1).find((p) => p.rating != null);
      if (!avant) return;
      const delta = w.rating - (avant.rating as number);
      if (delta === 0) return;
      if (!meilleur || Math.abs(delta) > Math.abs(meilleur.delta))
        meilleur = { film, delta, from: avant.rating as number, to: w.rating, date: w.date };
    });
    if (meilleur) out.push(meilleur);
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, combien);
}
