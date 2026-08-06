/* ============================================================
   CHERCHER PARTOUT — une question, tout le classeur

   `domain/search` savait déjà répondre à « ce FILM correspond-il », et
   trois vues s'en servaient. Mais un classeur ne contient pas que des
   films : il contient aussi des pages de carnet, un vocabulaire de
   motifs, des fils tendus, et les gens des génériques. Rien de tout
   cela n'était cherchable — il fallait savoir d'avance dans quel onglet
   se trouvait ce qu'on cherchait, ce qui suppose de l'avoir déjà
   trouvé.

   Ce module ne redéfinit RIEN. Il pose la même question à chaque nature
   de chose, et rassemble les réponses sous une forme commune. La
   définition de « ce film répond-il » reste dans `search`, celle d'une
   personne dans `people`, celle d'un fil dans `fils`.

   Pur, hors ligne, sans index : à quelques milliers de fiches un
   balayage se fait en moins d'une image, et un index serait une
   structure de plus à tenir à jour à chaque frappe.
   ============================================================ */
import { normaliser, scoreFilm } from "./search";
import { tousLesMotifs, motifById } from "./motifs";
import { membresDuFil } from "./fils";
import { recenser } from "./people";
import type { Fil } from "./fils";
import type { Film, Note } from "../types";

/** Les natures de choses qu'un classeur contient. */
export type Genre = "film" | "page" | "motif" | "fil" | "personne";

export interface Trouvaille {
  genre: Genre;
  /** Identité stable, préfixée par le genre : deux natures peuvent partager un id. */
  clé: string;
  titre: string;
  /** Le contexte, en une ligne : l'année et la réalisation, le nombre de films… */
  sous: string;
  /**
   * Le passage où le mot a été trouvé, quand il vient d'un texte long.
   * C'est ce qui distingue une recherche utile d'une liste de titres :
   * on veut voir CE QU'ON AVAIT ÉCRIT, pas seulement savoir que c'était
   * quelque part.
   */
  extrait?: string;
  /** Ce qu'il faut à la vue pour ouvrir la chose trouvée. */
  filmId?: string;
  noteId?: string;
  motifId?: string;
  filId?: string;
  /** Clé normalisée d'une personne, telle que le générique les range. */
  personne?: string;
  /** Plus petit, plus pertinent. */
  rang: number;
}

export interface Fonds {
  films: Film[];
  notes: Note[];
  fils: Fil[];
}

/* Combien de caractères de part et d'autre du mot trouvé. Assez pour
   une phrase, pas assez pour un paragraphe : l'extrait sert à
   reconnaître, pas à relire. */
const AUTOUR = 46;

/* Les jetons de capture ne sont pas des mots — même raison que dans
   `search`, et même recopie assumée : le domaine ne dépend d'aucun
   composant. */
const JETON_CAPTURE = /\[img:\d+\]/g;

/**
 * Le passage autour de la première occurrence, avec des points de
 * suspension là où l'on a coupé.
 *
 * On cherche sur le texte NORMALISÉ mais on découpe dans l'ORIGINAL :
 * les deux ont la même longueur — `normaliser` ne fait que retirer les
 * signes diacritiques, caractère par caractère — et c'est ce qui permet
 * de rendre l'extrait avec ses accents et ses majuscules.
 */
export function extraitAutour(texte: string, q: string): string | undefined {
  const propre = (texte || "").replace(JETON_CAPTURE, " ");
  const t = normaliser(q.trim());
  if (!t) return undefined;
  const i = normaliser(propre).indexOf(t);
  if (i < 0) return undefined;

  const début = Math.max(0, i - AUTOUR);
  const fin = Math.min(propre.length, i + t.length + AUTOUR);
  const morceau = propre.slice(début, fin).replace(/\s+/g, " ").trim();
  return `${début > 0 ? "…" : ""}${morceau}${fin < propre.length ? "…" : ""}`;
}

/* Le rang d'un texte simple : ce qui COMMENCE par ce qu'on tape passe
   devant ce qui le contient au milieu. Même règle que pour un titre de
   film, et pour la même raison. */
const rangDe = (texte: string, t: string, base: number): number | null => {
  const n = normaliser(texte);
  if (!n.includes(t)) return null;
  return n.startsWith(t) ? base - 0.5 : base;
};

/**
 * Tout ce qui répond, le plus pertinent d'abord.
 *
 * `parGenre` borne CHAQUE nature séparément et non le total : sans
 * cela, une collection de mille films noierait l'unique page de carnet
 * qui répond, et l'on ne saurait jamais qu'elle existe. Une recherche
 * transversale qui ne montre qu'une seule nature n'est pas transversale.
 */
export function chercherPartout(
  q: string,
  { films, notes, fils }: Fonds,
  parGenre = 5
): Trouvaille[] {
  const t = normaliser(q.trim());
  if (t.length < 2) return [];

  const out: Trouvaille[] = [];

  /* ---- les films ----
     `scoreFilm` reste seul juge : la recherche du mur et celle-ci
     doivent trouver les mêmes films, sans quoi l'une des deux mentirait. */
  const parFilm: Trouvaille[] = [];
  for (const f of films) {
    const rang = scoreFilm(f, q);
    if (rang == null) continue;
    parFilm.push({
      genre: "film",
      clé: `film:${f.id}`,
      titre: f.title,
      sous: [f.year || null, f.director || null].filter(Boolean).join(" · "),
      /* L'extrait ne vient que de VOS mots : un titre trouvé n'a pas
         besoin qu'on le recopie sous lui-même. */
      extrait: extraitAutour(f.review || "", q) || extraitAutour(f.notes || "", q),
      filmId: f.id,
      rang,
    });
  }
  out.push(...parFilm.sort((a, b) => a.rang - b.rang || a.titre.localeCompare(b.titre, "fr")).slice(0, parGenre));

  /* ---- les pages du carnet ---- */
  const parPage: Trouvaille[] = [];
  for (const n of notes) {
    const surTitre = rangDe(n.title || "", t, 0);
    const surCorps = rangDe(n.body || "", t, 2);
    const rang = surTitre ?? surCorps;
    if (rang == null) continue;
    parPage.push({
      genre: "page",
      clé: `page:${n.id}`,
      titre: n.title || "Sans titre",
      sous: new Date(n.createdAt).toLocaleDateString("fr-FR"),
      extrait: extraitAutour(n.body || "", q),
      noteId: n.id,
      rang,
    });
  }
  out.push(...parPage.sort((a, b) => a.rang - b.rang).slice(0, parGenre));

  /* ---- les motifs du vocabulaire ----
     On compte les fiches qui le portent : un motif que personne ne
     porte se trouve quand même, mais il se présente pour ce qu'il est. */
  const parMotif: Trouvaille[] = [];
  for (const m of tousLesMotifs()) {
    const rang = rangDe(m.label, t, 1);
    if (rang == null) continue;
    const n = films.filter((f) => (f.motifs || []).includes(m.id)).length;
    parMotif.push({
      genre: "motif",
      clé: `motif:${m.id}`,
      titre: m.label,
      /* « le portent » et non « fiches » tout court : le compte décrit
         le MOTIF, alors qu'ouvrir le résultat lance une recherche sur
         son libellé — laquelle ramène en plus les fiches qui en parlent
         sans le porter. Deux nombres différents, et l'un des deux doit
         dire de quoi il parle. */
      sous: n ? `${n} fiche${n > 1 ? "s" : ""} le porte${n > 1 ? "nt" : ""}` : "sur aucune fiche",
      motifId: m.id,
      rang,
    });
  }
  out.push(...parMotif.sort((a, b) => a.rang - b.rang).slice(0, parGenre));

  /* ---- les fils ---- */
  const parFil: Trouvaille[] = [];
  for (const fil of fils) {
    const surLabel = rangDe(fil.label || "", t, 1);
    const surNote = rangDe(fil.note || "", t, 3);
    const rang = surLabel ?? surNote;
    if (rang == null) continue;
    const n = membresDuFil(fil, films).length;
    parFil.push({
      genre: "fil",
      clé: `fil:${fil.id}`,
      titre: fil.label,
      sous: [
        `${n} film${n > 1 ? "s" : ""}`,
        fil.motif ? motifById(fil.motif)?.label : null,
      ]
        .filter(Boolean)
        .join(" · "),
      extrait: extraitAutour(fil.note || "", q),
      filId: fil.id,
      rang,
    });
  }
  out.push(...parFil.sort((a, b) => a.rang - b.rang).slice(0, parGenre));

  /* ---- les gens ----
     Le générique sait déjà les recenser ; on ne redéfinit pas ce qu'est
     une personne, on lui repose la question. */
  const parGens: Trouvaille[] = [];
  for (const p of recenser(films)) {
    const rang = rangDe(p.nom, t, 1);
    if (rang == null) continue;
    parGens.push({
      genre: "personne",
      clé: `personne:${p.clé}`,
      titre: p.nom,
      sous: `${p.films.length} film${p.films.length > 1 ? "s" : ""} · ${p.rôles.join(", ")}`,
      personne: p.clé,
      rang,
    });
  }
  out.push(
    ...parGens
      .sort((a, b) => a.rang - b.rang || a.titre.localeCompare(b.titre, "fr"))
      .slice(0, parGenre)
  );

  return out;
}

/** Ce qui a été trouvé, rangé par nature — la forme que la vue affiche. */
export const parGenres = (trouvailles: Trouvaille[]): { genre: Genre; items: Trouvaille[] }[] => {
  const ordre: Genre[] = ["film", "personne", "motif", "fil", "page"];
  return ordre
    .map((genre) => ({ genre, items: trouvailles.filter((t) => t.genre === genre) }))
    .filter((g) => g.items.length > 0);
};
