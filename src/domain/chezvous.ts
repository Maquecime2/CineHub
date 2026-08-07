/* ============================================================
   CE QUE VOUS AVEZ DÉJÀ — des propositions sans réseau

   Le bureau des découvertes ne parlait qu'à TMDB : il répondait
   admirablement à « quoi d'autre existe-t-il dehors », et jamais à la
   question qu'une collection tenue pendant des années finit par poser
   toute seule — « qu'est-ce que j'ai là, dedans, que j'ai oublié ? ».

   Deux cents fiches vues, et l'on tourne autour des douze dernières.
   Ce module va chercher les autres.

   IL NE PARLE PAS DE LA LISTE « À VOIR ». `domain/soir` s'en charge, et
   pose une question différente : là, on choisit ce qu'on va découvrir ce
   soir ; ici, on se rappelle ce qu'on a aimé. Mélanger les deux ferait
   deux outils qui se marchent dessus.

   Pur, hors ligne, déterministe : aucune de ces propositions ne demande
   quoi que ce soit à personne, et c'est ce qui les rend utiles quand
   aucune clé TMDB n'est posée.
   ============================================================ */
import { sortWatches } from "./film";
import { motifById } from "./motifs";
import { directorsOf } from "../taste";
import type { Film } from "../types";

/**
 * La nature d'une proposition — ce n'est pas un classement mais trois
 * QUESTIONS différentes, et c'est pourquoi on les distingue plutôt que
 * de les fondre dans un score unique. « Vous l'aviez adoré » et « ce
 * motif ne vous a plus croisé » ne se répondent pas de la même façon.
 */
export type Nature = "revoir" | "motif" | "cinéaste";

export interface Suggestion {
  nature: Nature;
  film: Film;
  /** L'intitulé de la proposition, court. */
  titre: string;
  /** Pourquoi celle-ci, en clair et en français. */
  raison: string;
  /** Identité stable — deux natures peuvent viser le même film. */
  clé: string;
}

const JOUR = 24 * 3600 * 1000;

/* LES SEUILS SE DÉDUISENT DE VOTRE PRATIQUE, ILS NE SONT PAS ÉCRITS
   D'AVANCE.

   Le premier jet posait deux ans pour une revoyure et dix-huit mois pour
   un motif. Des nombres raisonnables — pour une collection tenue depuis
   dix ans. Sur un classeur ouvert il y a dix-huit mois, ils
   disqualifiaient TOUT : la section entière restait vide, et rien ne
   disait pourquoi. Un seuil absolu ne mesure pas l'oubli, il mesure
   l'ancienneté du classeur.

   Ce qu'on veut dire est relatif : « il y a longtemps, POUR VOUS ». On
   prend donc une fraction de l'étendue réellement couverte, de la
   première séance à la dernière.

   Bornée des deux côtés, et les deux bornes comptent.

   Le PLANCHER est à cinq mois, et non à quelques semaines : on ne
   redécouvre pas un film qu'on a adoré trois mois plus tôt, et une
   collection ouverte le mois dernier n'a rien d'oublié — elle doit
   pouvoir ne rien proposer du tout plutôt que d'insister.

   Le PLAFOND garde le comportement d'origine dès que la pratique
   dépasse quelques années : au-delà, deux ans est bien la bonne mesure
   de l'oubli, là où le tiers de quinze ans effacerait toute la
   dernière décennie. */
const OUBLI_FILM = { part: 1 / 3, min: 150, max: 730 };
const OUBLI_THÈME = { part: 1 / 4, min: 120, max: 540 };

interface Seuils {
  film: number;
  thème: number;
}

const borne = (n: number, min: number, max: number): number =>
  Math.round(Math.max(min, Math.min(max, n)));

const seuilsPour = (étendue: number): Seuils => ({
  film: borne(étendue * OUBLI_FILM.part, OUBLI_FILM.min, OUBLI_FILM.max),
  thème: borne(étendue * OUBLI_THÈME.part, OUBLI_THÈME.min, OUBLI_THÈME.max),
});

/** Ce qui vaut la peine d'être revu : on ne rappelle pas une déception. */
const AIMÉ = 4;
const AIMÉ_MOYEN = 3.5;

/** La dernière séance d'une fiche, en millisecondes ; `null` sans journal. */
const dernièreSéance = (f: Film): number | null => {
  const w = sortWatches(f.watches || [])[0];
  if (!w?.date) return null;
  const t = Date.parse(`${w.date}T12:00:00Z`);
  return Number.isFinite(t) ? t : null;
};

const joursDepuis = (t: number, maintenant: number): number =>
  Math.floor((maintenant - t) / JOUR);

/* « il y a deux ans » se lit ; « il y a 913 jours » demande un calcul.
   Sous un an on garde les mois, qui restent parlants. */
const enClair = (jours: number): string => {
  const ans = Math.floor(jours / 365);
  if (ans >= 1) return `${ans} an${ans > 1 ? "s" : ""}`;
  const mois = Math.max(1, Math.floor(jours / 30));
  return `${mois} mois`;
};

/** La meilleure note qu'une fiche ait jamais reçue. */
const meilleureNote = (f: Film): number => {
  const notes = (f.watches || []).map((w) => w.rating).filter((r): r is number => r != null);
  return Math.max(f.rating || 0, ...(notes.length ? notes : [0]));
};

/* Les fiches sur lesquelles ce module travaille : vues, non archivées,
   et datées. Une fiche sans séance n'a pas d'oubli à mesurer — ce n'est
   pas qu'on l'a délaissée, c'est qu'on ne sait pas quand on l'a vue. */
interface Datée {
  film: Film;
  quand: number;
  jours: number;
}

const datées = (films: Film[], maintenant: number): Datée[] => {
  const out: Datée[] = [];
  for (const film of films) {
    if (film.status === "watchlist" || film.archived) continue;
    const quand = dernièreSéance(film);
    if (quand == null) continue;
    out.push({ film, quand, jours: joursDepuis(quand, maintenant) });
  }
  return out;
};

/* ------------------------------------------------------------
   1. À REVOIR — ce que vous aviez aimé et laissé de côté
   ------------------------------------------------------------ */
function àRevoir(pool: Datée[], seuil: number): Suggestion[] {
  return pool
    .filter((d) => d.jours >= seuil && meilleureNote(d.film) >= AIMÉ)
    .sort((a, b) => meilleureNote(b.film) - meilleureNote(a.film) || b.jours - a.jours)
    .map(({ film, jours }) => ({
      nature: "revoir" as const,
      film,
      titre: "À revoir",
      raison: `${meilleureNote(film)}★, pas revu depuis ${enClair(jours)}`,
      clé: `revoir:${film.id}`,
    }));
}

/* ------------------------------------------------------------
   2. UN MOTIF QUI NE VOUS A PLUS CROISÉ
   ------------------------------------------------------------

   Les motifs sont le vocabulaire commun de la collection — « il pleut à
   la fin », « le héros meurt ». On peut donc demander depuis quand on
   n'a plus vu un film qui en porte un, ce qu'aucune étiquette libre ne
   permettrait de faire proprement.

   Un motif posé sur une seule fiche ne dit rien : c'est un accident, pas
   une veine qu'on aurait délaissée. */
function motifsDélaissés(pool: Datée[], seuil: number): Suggestion[] {
  const par = new Map<string, Datée[]>();
  for (const d of pool)
    for (const id of d.film.motifs || []) {
      const lot = par.get(id);
      if (lot) lot.push(d);
      else par.set(id, [d]);
    }

  const out: Suggestion[] = [];
  for (const [id, lot] of par) {
    if (lot.length < 2) continue;
    const motif = motifById(id);
    /* Un motif inconnu du catalogue est ignoré à l'affichage, jamais
       effacé de la fiche : la règle vaut partout. */
    if (!motif) continue;
    /* La date du motif est celle de sa séance LA PLUS RÉCENTE : c'est
       depuis là qu'on ne l'a plus croisé. */
    const jours = Math.min(...lot.map((d) => d.jours));
    if (jours < seuil) continue;
    /* On propose le mieux noté de la veine, et non le plus vieux : il
       s'agit de rouvrir une porte, pas de solder un fond de tiroir. */
    const choix = [...lot].sort(
      (a, b) => meilleureNote(b.film) - meilleureNote(a.film) || b.jours - a.jours
    )[0]!;
    out.push({
      nature: "motif",
      film: choix.film,
      titre: motif.label,
      raison: `${lot.length} films portent ce motif, plus aucun depuis ${enClair(jours)}`,
      clé: `motif:${id}`,
    });
  }
  return out.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
}

/* ------------------------------------------------------------
   3. UN CINÉASTE DÉLAISSÉ
   ------------------------------------------------------------

   Quelqu'un dont on a vu plusieurs films, qu'on a aimés, et qu'on n'a
   plus ouvert depuis longtemps. On exige DEUX films et une moyenne
   franche : un seul film noté cinq étoiles ne fait pas un cinéaste
   qu'on suit, et le rappeler serait deviner à la place de l'autre. */
function cinéastesDélaissés(pool: Datée[], seuil: number): Suggestion[] {
  const par = new Map<string, Datée[]>();
  for (const d of pool)
    for (const nom of directorsOf(d.film) as string[]) {
      const lot = par.get(nom);
      if (lot) lot.push(d);
      else par.set(nom, [d]);
    }

  const out: Suggestion[] = [];
  for (const [nom, lot] of par) {
    if (lot.length < 2) continue;
    const notes = lot.map((d) => meilleureNote(d.film)).filter((n) => n > 0);
    if (notes.length === 0) continue;
    const moyenne = notes.reduce((s, n) => s + n, 0) / notes.length;
    if (moyenne < AIMÉ_MOYEN) continue;
    const jours = Math.min(...lot.map((d) => d.jours));
    if (jours < seuil) continue;
    const choix = [...lot].sort(
      (a, b) => meilleureNote(b.film) - meilleureNote(a.film) || b.jours - a.jours
    )[0]!;
    out.push({
      nature: "cinéaste",
      film: choix.film,
      titre: nom,
      raison: `${lot.length} films chez vous, ${moyenne.toFixed(1)}★ de moyenne, plus rien depuis ${enClair(jours)}`,
      clé: `cinéaste:${nom.toLowerCase()}`,
    });
  }
  return out.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
}

/* CE QU'UNE PROPOSITION DIT DE PLUS QU'UNE AUTRE.

   Un même film est souvent désigné par les trois natures à la fois : on
   l'a aimé, il porte un motif délaissé, et son cinéaste n'a plus été
   ouvert. Il ne doit paraître qu'une fois — mais alors sous QUELLE
   raison ?

   Le premier jet gardait celle qui arrivait la première, et « à revoir »
   arrivait toujours la première. Résultat : il raflait les films et les
   deux autres natures, privées de sujet, ne paraissaient jamais. Le
   défaut ne se voyait pas sur une carte isolée — seulement à l'échelle
   de la liste, qui se mettait à ne plus raconter qu'une seule chose.

   On garde donc la plus SPÉCIFIQUE. « Mélancolie — trois films portent
   ce motif, plus aucun depuis deux ans » apprend quelque chose sur la
   collection ; « à revoir, 5★ » n'apprend rien qu'une note ne dise déjà.
   Le banal passe en dernier, et sert de remplissage quand les veines
   sont épuisées. */
const SPÉCIFICITÉ: Nature[] = ["motif", "cinéaste", "revoir"];

/**
 * Ce que votre collection a à vous proposer, sans rien demander à
 * personne.
 *
 * Les natures sont ENTRELACÉES et non mises bout à bout : trois « à
 * revoir » d'affilée donneraient l'impression d'un seul outil qui se
 * répète, là où l'alternance montre qu'on regarde la collection sous
 * trois angles.
 *
 * `maintenant` est un paramètre : sans lui, ce module serait intestable
 * — la moitié de ce qu'il calcule est une durée depuis aujourd'hui.
 */
export function suggestionsMaison(
  films: Film[],
  maintenant: number = Date.now(),
  combien = 6
): Suggestion[] {
  const pool = datées(films, maintenant);
  if (pool.length === 0) return [];

  /* L'ÉTENDUE DE LA PRATIQUE : de la séance la plus ancienne à la plus
     récente. C'est elle qui donne l'échelle de « il y a longtemps ».

     On part de la plus VIEILLE séance et non de la plus récente : ce
     qu'on mesure est depuis quand le classeur est tenu, pas depuis
     quand on ne l'a pas ouvert. */
  const étendue = Math.max(...pool.map((d) => d.jours)) - Math.min(...pool.map((d) => d.jours));
  const seuils = seuilsPour(étendue);

  const parNature: Record<Nature, Suggestion[]> = {
    revoir: àRevoir(pool, seuils.film),
    motif: motifsDélaissés(pool, seuils.thème),
    cinéaste: cinéastesDélaissés(pool, seuils.thème),
  };

  /* Chaque film n'est retenu que par la nature la plus spécifique qui le
     désigne — les autres le laissent passer et gardent leur rang pour un
     film qu'elles seules savent nommer. */
  const attribué = new Map<string, Nature>();
  for (const nature of SPÉCIFICITÉ)
    for (const s of parNature[nature]) if (!attribué.has(s.film.id)) attribué.set(s.film.id, nature);

  const files = SPÉCIFICITÉ.map((nature) =>
    parNature[nature].filter((s) => attribué.get(s.film.id) === nature)
  );

  const out: Suggestion[] = [];
  for (let tour = 0; out.length < combien; tour++) {
    let posé = false;
    for (const file of files) {
      const s = file[tour];
      if (!s) continue;
      posé = true;
      out.push(s);
      if (out.length >= combien) break;
    }
    // plus rien dans aucune file : on s'arrête plutôt que de tourner
    if (!posé) break;
  }
  return out;
}
