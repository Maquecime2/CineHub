/* ============================================================
   LE GÉNÉRIQUE — ce que la collection sait des gens

   Les noms étaient déjà là. Chaque fiche porte sa réalisation, ses huit
   premiers rôles et son équipe par métier, et ces trois champs ne
   servaient qu'à UNE chose : tracer les pointillés de la constellation.
   On ne pouvait pas demander « et Decaë, qu'est-ce que j'ai de lui ».

   Rien n'est collecté de plus, rien n'est écrit nulle part : un dossier
   de personne se RECOMPOSE à chaque lecture depuis les films, comme un
   fil (`domain/fils`). Une personne n'est pas une entité qu'on range,
   c'est une question qu'on pose à la collection.
   ============================================================ */
import { parentésDe } from "./sky";
import { normalize } from "./search";
import { watchCount } from "./film";
import type { Film, KinshipRole, Year } from "../types";

/** Les rôles qui désignent quelqu'un. `thème` n'est pas une personne. */
export const RÔLES: KinshipRole[] = [
  "réalisation",
  "interprétation",
  "image",
  "musique",
  "scénario",
];

const estUnRôleDePersonne = (r: KinshipRole): boolean => r !== "thème";

export interface Personne {
  /** `normalize(nom)` — l'identité, insensible à la casse et aux accents. */
  clé: string;
  /** L'orthographe la plus fréquente dans la collection. */
  nom: string;
  /** À quels titres cette personne apparaît, dans l'ordre de `RÔLES`. */
  rôles: KinshipRole[];
  /** Ses films chez vous, toutes casquettes confondues, les plus récents d'abord. */
  films: string[];
  vus: number;
  àVoir: number;
  /** Le nombre de séances tenues sur ses films — un revu compte deux fois. */
  séances: number;
  /**
   * La moyenne de VOS notes, sur ses films vus ET notés. Un zéro veut
   * dire « pas noté » et non « exécuté » : le faire entrer dans la
   * moyenne ferait passer pour tiède quelqu'un qu'on n'a simplement pas
   * jugé. `null` quand aucun de ses films n'est noté.
   */
  note: number | null;
  /**
   * Votre note ramenée sur dix, moins la note publique. Positif : vous
   * êtes plus tendre que la foule ; négatif : plus sévère.
   *
   * C'est la première exploitation réelle de `tmdbRating`, dont le type
   * dit depuis le début qu'il est là « de quoi mesurer son propre
   * écart ». Ne compte que les fiches où LES DEUX notes existent —
   * comparer à un vide donnerait un écart inventé.
   */
  écart: number | null;
  /** De son film le plus ancien au plus récent. `null` si aucune année connue. */
  période: [Year, Year] | null;
  /** Les motifs qui reviennent chez elle : vus sur deux de ses films au moins. */
  motifs: string[];
}

/* Ce qu'on accumule en balayant, avant de faire les comptes. */
interface Brouillon {
  clé: string;
  /** Chaque orthographe rencontrée et son nombre d'occurrences. */
  graphies: Map<string, number>;
  rôles: Set<KinshipRole>;
  films: Film[];
}

/** À quels titres cette personne apparaît sur CE film. */
export const rôlesSurLeFilm = (f: Film, clé: string): KinshipRole[] => {
  const vus = new Set<KinshipRole>();
  for (const k of parentésDe(f))
    if (estUnRôleDePersonne(k.role) && normalize(k.nom.trim()) === clé) vus.add(k.role);
  return RÔLES.filter((r) => vus.has(r));
};

const graphieDominante = (graphies: Map<string, number>): string => {
  let meilleure = "";
  let meilleurCompte = -1;
  /* À égalité, la première rencontrée gagne — l'ordre de la collection
     est stable, donc le nom affiché ne change pas d'un rendu à l'autre.
     Une personne dont le nom danserait serait une personne différente à
     chaque coup d'œil. */
  for (const [graphie, n] of graphies)
    if (n > meilleurCompte) {
      meilleure = graphie;
      meilleurCompte = n;
    }
  return meilleure;
};

const moyenne = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const composer = ({ clé, graphies, rôles, films }: Brouillon): Personne => {
  const notes: number[] = [];
  const écarts: number[] = [];
  const années: number[] = [];
  const compteMotifs = new Map<string, number>();

  for (const f of films) {
    if (f.rating > 0) {
      notes.push(f.rating);
      // sur cinq d'un côté, sur dix de l'autre : on parle la même langue avant de soustraire
      if (f.tmdbRating != null) écarts.push(f.rating * 2 - f.tmdbRating);
    }
    if (f.year) années.push(Number(f.year));
    for (const id of f.motifs || []) compteMotifs.set(id, (compteMotifs.get(id) || 0) + 1);
  }

  return {
    clé,
    nom: graphieDominante(graphies),
    rôles: RÔLES.filter((r) => rôles.has(r)),
    /* Les plus récemment ajoutés d'abord : c'est le film qu'on vient de
       ranger qui nous fait ouvrir le dossier de quelqu'un. */
    films: [...films].sort((a, b) => b.addedAt - a.addedAt).map((f) => f.id),
    vus: films.filter((f) => f.status === "watched").length,
    àVoir: films.filter((f) => f.status === "watchlist").length,
    séances: films.reduce((n, f) => n + watchCount(f), 0),
    note: moyenne(notes),
    écart: moyenne(écarts),
    période: années.length ? [Math.min(...années), Math.max(...années)] : null,
    motifs: [...compteMotifs.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id),
  };
};

/**
 * Tout le monde, le mieux fourni d'abord.
 *
 * Pas d'index, pas de cache : à quelques milliers de fiches et huit noms
 * chacune, un balayage se fait en moins d'une image, là où un index
 * serait une structure de plus à tenir à jour à chaque écriture. C'est le
 * même raisonnement que dans `domain/search`, et la vue mémoïse.
 *
 * Les fiches ARCHIVÉES comptent : les avoir mises de côté ne retire pas
 * quelqu'un de leur générique, pas plus que ça ne les rend non vues —
 * l'almanach fait déjà ce choix pour les séances.
 */
export function recenser(films: Film[]): Personne[] {
  const brouillons = new Map<string, Brouillon>();

  for (const f of films) {
    /* Un même nom peut revenir plusieurs fois sur une fiche (réalisateur
       ET scénariste) : on ne veut le film qu'une fois dans sa liste, mais
       les deux rôles. */
    const vusIci = new Set<string>();
    for (const k of parentésDe(f)) {
      if (!estUnRôleDePersonne(k.role)) continue;
      const nom = k.nom.trim();
      if (!nom) continue;
      const clé = normalize(nom);
      if (!clé) continue;

      let b = brouillons.get(clé);
      if (!b) brouillons.set(clé, (b = { clé, graphies: new Map(), rôles: new Set(), films: [] }));
      b.rôles.add(k.role);
      b.graphies.set(nom, (b.graphies.get(nom) || 0) + 1);
      if (!vusIci.has(clé)) {
        vusIci.add(clé);
        b.films.push(f);
      }
    }
  }

  return [...brouillons.values()]
    .map(composer)
    .sort((a, b) => b.films.length - a.films.length || a.nom.localeCompare(b.nom, "fr"));
}

/** Le dossier d'une personne, ou `null` si la collection ne la connaît pas. */
export const dossierDe = (films: Film[], clé: string): Personne | null =>
  recenser(films).find((p) => p.clé === clé) || null;

/**
 * Chercher dans le répertoire.
 *
 * Sur le nom seul, et volontairement : on tape « decae » pour trouver
 * Decaë, pas pour trouver les films où il a travaillé — c'est la
 * recherche du mur qui répond à cette question-là.
 */
export const chercherPersonnes = (gens: Personne[], q: string): Personne[] => {
  const t = normalize(q.trim());
  if (!t) return gens;
  const touche = gens.filter((p) => p.clé.includes(t));
  /* Celui dont un MOT commence par ce qu'on tape passe devant. Le rang
     ne se prend pas sur le nom entier comme pour un titre de film
     (`domain/search`) : on tape presque toujours le patronyme, qui est
     le dernier mot, et « ozu » doit trouver Ozu avant Kurozu. */
  const parMot = (clé: string) => (clé.split(/[\s-]+/).some((mot) => mot.startsWith(t)) ? 0 : 1);
  return touche.sort(
    (a, b) =>
      parMot(a.clé) - parMot(b.clé) ||
      b.films.length - a.films.length ||
      a.nom.localeCompare(b.nom, "fr")
  );
};
