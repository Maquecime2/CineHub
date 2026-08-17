/* ============================================================
   LA MÊME ŒUVRE, DEUX FOIS DANS LE CLASSEUR
   ============================================================

   D'OÙ ÇA VIENT, ET POURQUOI ÇA REVIENT. `diffImport` rapproche une
   ligne d'une fiche par son `tmdbId`, et à défaut par `filmKey` — le
   titre et l'année. Une fiche qui n'a jamais été rapprochée de TMDB n'a
   donc que son TITRE pour se faire reconnaître, et un titre n'est pas
   une identité : « Scenes from a Marriage » et « Scènes de la vie
   conjugale » sont le même film d'Ingmar Bergman, et deux clés
   différentes.

   Le fichier qu'on redépose porte l'une, le classeur tient l'autre :
   rien ne se rencontre, une fiche se crée, et cela RECOMMENCE à chaque
   import. C'est la boucle qu'on vient fermer, et elle ne se ferme pas en
   devinant mieux — elle se ferme en RETENANT.

   `aka` EST CE QUE LA FUSION APPREND. En rapprochant deux fiches, on
   apprend que ce titre-là désigne cette œuvre-là ; la fiche survivante
   le garde, et le prochain import s'y reconnaît. Aucune requête, aucune
   heuristique qui s'améliore toute seule : une chose qu'on a dite une
   fois et que le classeur n'oublie plus.

   ON NE PERD RIEN DE CE QUI A ÉTÉ ÉCRIT À LA MAIN. C'est la seule règle
   qui compte ici, parce que c'est la seule qu'on ne peut pas rattraper :
   une note, une critique, une séance n'existent nulle part ailleurs. Ce
   que TMDB fournit — affiche, générique, durée — se redemande ; ce qu'on
   a écrit un soir, non. En cas de doute, cette fonction GARDE.
   ============================================================ */
import { filmKey } from "./importing";
import type { Film, Watch } from "../types";

/** Les titres sous lesquels cette fiche a déjà été connue. */
export const akaOf = (f: Partial<Film> & { aka?: string[] }): string[] => f.aka ?? [];

/** Le plus avancé des deux statuts : vu l'emporte sur à voir. */
const furthest = (a: Film, b: Film): Film["status"] =>
  a.status === "watched" || b.status === "watched" ? "watched" : (a.status ?? b.status);

/* Les séances des deux, sans doublon. La clé est le JOUR : deux imports
   du même journal décrivent la même soirée, et la compter deux fois
   gonflerait un compteur que personne ne peut plus corriger. */
function bothWatches(a: Watch[] = [], b: Watch[] = []): Watch[] {
  const seen = new Set<string>();
  const out: Watch[] = [];
  for (const w of [...a, ...b]) {
    const day = String(w?.date ?? "").slice(0, 10);
    if (!day || seen.has(day)) continue;
    seen.add(day);
    out.push(w);
  }
  return out.sort((x, y) => String(x.date).localeCompare(String(y.date)));
}

/* DEUX TEXTES ÉCRITS À LA MAIN NE SE CHOISISSENT PAS. Si les deux
   fiches portent une critique, en garder une reviendrait à en effacer
   une — et c'est exactement ce qu'on s'est interdit. On les met bout à
   bout, ce qui est laid une fois et récupérable toujours. */
const bothTexts = (a = "", b = ""): string => {
  const x = (a || "").trim();
  const y = (b || "").trim();
  if (!x) return y;
  if (!y) return x;
  if (x === y) return x;
  return `${x}\n\n${y}`;
};

const union = (a: string[] = [], b: string[] = []): string[] => [...new Set([...a, ...b])];

/**
 * Fondre `drop` dans `keep`, et rendre la fiche survivante.
 *
 * `keep` EST CELLE QUI PORTE L'IDENTITÉ — son `tmdbId`, son titre, son
 * affiche, son générique. C'est l'appelant qui la désigne, et il désigne
 * celle que TMDB a reconnue : l'autre est justement celle dont on sait
 * qu'elle n'est raccrochée à rien.
 *
 * TOUT LE RESTE PENCHE VERS CE QUI EXISTE. Un champ vide chez `keep` se
 * remplit avec celui de `drop` ; un champ rempli ne bouge pas. Les
 * listes s'unissent, les séances se fondent, les textes se suivent.
 */
export function mergeDuplicate(keep: Film, drop: Film): Film {
  return {
    ...keep,
    /* CE QU'ON A ÉCRIT, ET QUI N'EXISTE NULLE PART AILLEURS. */
    rating: keep.rating || drop.rating || 0,
    review: bothTexts(keep.review, drop.review),
    notes: bothTexts(keep.notes, drop.notes),
    watches: bothWatches(keep.watches, drop.watches),
    watchedAt: keep.watchedAt ?? drop.watchedAt ?? null,
    themes: union(keep.themes, drop.themes),
    motifs: union(keep.motifs, drop.motifs),
    /* Les captures vivent dans le coffre et sont désignées par une clé :
       les perdre laisserait des images orphelines que rien ne réclame. */
    stills: [...(keep.stills ?? []), ...(drop.stills ?? [])],
    linkedWorks: [...(keep.linkedWorks ?? []), ...(drop.linkedWorks ?? [])],

    /* CE QUE TMDB FOURNIT NE SE REPREND QUE S'IL MANQUE. */
    director: keep.director || drop.director || "",
    poster: keep.poster || drop.poster || "",
    genres: keep.genres?.length ? keep.genres : (drop.genres ?? []),
    cast: keep.cast?.length ? keep.cast : (drop.cast ?? []),
    runtime: keep.runtime ?? drop.runtime ?? null,

    /* LA PLUS ANCIENNE DES DEUX ARRIVÉES : c'est le jour où cette œuvre
       est entrée dans le classeur, et le doublon ne l'a pas décalé. */
    addedAt: Math.min(keep.addedAt || Infinity, drop.addedAt || Infinity) || Date.now(),
    status: furthest(keep, drop),
    bedside: keep.bedside || drop.bedside,

    /* CE QUE LA FUSION APPREND, et qui referme la boucle : le prochain
       import qui parlera de « Scenes from a Marriage » trouvera cette
       fiche-ci au lieu d'en créer une de plus. On garde aussi les alias
       que la disparue portait — elle a pu être fusionnée avant. */
    aka: union(union(akaOf(keep), akaOf(drop)), [filmKey(drop)]).filter((k) => k !== filmKey(keep)),
    updatedAt: Date.now(),
  };
}

/**
 * Les paires à proposer, une fois les fiches sans `tmdbId` résolues.
 *
 * `resolved` DIT CE QUE TMDB A RECONNU, par identifiant de fiche. On ne
 * devine rien ici : deux fiches font une paire quand elles désignent le
 * MÊME `tmdbId`, ce qui est une identité et non une ressemblance. Un
 * rapprochement par titre approchant aurait fondu « Solaris » 1972 et
 * « Solaris » 2002, et il n'y a pas de retour.
 */
export function duplicatePairs(
  films: Film[],
  resolved: Map<string, number | string>
): { keep: Film; drop: Film }[] {
  const byTmdb = new Map<string, Film>();
  for (const f of films) if (f.tmdbId) byTmdb.set(String(f.tmdbId), f);

  const pairs: { keep: Film; drop: Film }[] = [];
  for (const f of films) {
    if (f.tmdbId) continue;
    const found = resolved.get(f.id);
    if (!found) continue;
    const keep = byTmdb.get(String(found));
    /* Rien en face : ce n'est pas un doublon, c'est une fiche qu'il
       reste à raccrocher — le panneau de complétion s'en charge. */
    if (!keep || keep.id === f.id) continue;
    pairs.push({ keep, drop: f });
  }
  return pairs;
}
