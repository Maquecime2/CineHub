/* ============================================================
   L'AUTRE MOITIÉ DU SILLAGE — ce qui, dehors, tient de ce film

   `sillage` fouille votre classeur ; celui-ci trie ce que TMDB rapporte.
   La récolte elle-même est ailleurs (`services/sillage`) : ici, rien
   qu'une fusion, un classement et une exclusion — donc rien qui demande
   le réseau, et tout qui se teste.

   LA RÈGLE QUI COMMANDE TOUT : cette colonne ne montre QUE ce qu'on n'a
   pas. Un film déjà au mur qui reviendrait ici ferait deux fois la même
   proposition à un pas d'intervalle, et la moitié droite du panneau
   cesserait d'être « dehors » pour devenir un doublon de la gauche.
   ============================================================ */
import { POIDS } from "./sillage";
import type { Lien } from "./sillage";

/** Ce qu'une récolte rapporte : des films, et par quel chemin. */
export interface Récolte {
  /** Le chemin suivi. `reco` : « les gens qui ont vu celui-ci ont vu ». */
  par: Lien | "reco";
  /** Le nom de la personne, ou le titre du pivot pour une reco. */
  valeur: string;
  candidats: CandidatLoin[];
}

/** Un film de TMDB, tel que `toCandidate` le rend. */
export interface CandidatLoin {
  tmdbId: number;
  title: string;
  year: number | null;
  poster: string | null;
  voteAverage: number;
  voteCount: number;
  overview?: string;
}

export interface VoisinLoin extends CandidatLoin {
  score: number;
  /** Toutes les provenances : un film peut arriver par trois chemins. */
  par: { par: Lien | "reco"; valeur: string }[];
  raison: string;
  clé: string;
}

/* CE QUE PÈSE « RECOMMANDÉ À PARTIR DE CE FILM ».

   TMDB tire ses recommandations des comportements réels, pas d'une
   intersection d'étiquettes : c'est un bon signal, mais un signal de
   foule. Il pèse donc moins qu'un chef opérateur partagé, qui est un
   fait vérifiable sur le film qu'on regarde, et plus qu'un thème. */
export const POIDS_RECO = 2.2;

const poidsDe = (par: Lien | "reco"): number => (par === "reco" ? POIDS_RECO : POIDS[par]);

/* CE QU'ON EXIGE AVANT DE PROPOSER QUELQUE CHOSE.

   Sans plancher de votes, la filmographie d'un chef opérateur remonte
   ses courts-métrages d'école et ses documentaires de commande, notés
   par onze personnes — proposés au même rang qu'un film qu'on pourrait
   vraiment voir. Trente votes est le même seuil que le bureau des
   découvertes ; le garder identique évite deux définitions de « ça
   existe vraiment » dans la même application. */
export const VOTES_MINIMUM = 30;

const INTITULÉS_LOIN: Record<Lien | "reco", string> = {
  image: "du même chef op",
  musique: "du même compositeur",
  réalisation: "de la même réalisation",
  scénario: "du même scénario",
  acteur: "avec",
  motif: "même motif",
  thème: "même thème",
  "mot-clé": "même sujet",
  reco: "vu par les mêmes gens",
};

/* La qualité perçue entre pour très peu, et seulement pour départager :
   elle dit ce que le public en pense, pas ce que ce film a à voir avec
   celui-là — qui est la seule question posée ici. */
const qualité = (c: CandidatLoin): number =>
  Math.max(0, Math.min(1, (c.voteAverage - 5.5) / 3)) * 0.4;

function raisonDe(par: VoisinLoin["par"]): string {
  const [tête, ...reste] = par;
  if (!tête) return "";
  const début =
    tête.par === "reco" ? INTITULÉS_LOIN.reco : `${INTITULÉS_LOIN[tête.par]} ${tête.valeur}`;
  return reste.length ? `${début}, + ${reste.length} lien${reste.length > 1 ? "s" : ""}` : début;
}

/**
 * Fusionne les récoltes en une liste classée, purgée de ce qu'on a déjà.
 *
 * `déjàLà` porte les identifiants TMDB de la collection ENTIÈRE, liste
 * « à voir » comprise : un film qu'on a mis de côté n'est pas une
 * découverte, et le proposer comme telle serait oublier ce qu'on a
 * décidé la semaine dernière.
 */
export function fusionnerLoin(
  récoltes: Récolte[],
  { déjàLà = new Set<number>(), combien = 8, votesMinimum = VOTES_MINIMUM } = {}
): VoisinLoin[] {
  const fusion = new Map<number, VoisinLoin>();

  for (const r of récoltes) {
    for (const c of r.candidats || []) {
      if (!c?.tmdbId || !c.title) continue;
      if (déjàLà.has(c.tmdbId)) continue;
      if ((c.voteCount || 0) < votesMinimum) continue;

      const déjà = fusion.get(c.tmdbId);
      if (déjà) {
        /* Arrivé par plusieurs chemins : c'est bon signe, et les
           provenances s'additionnent au lieu de se remplacer. */
        déjà.par.push({ par: r.par, valeur: r.valeur });
        déjà.score += poidsDe(r.par);
        continue;
      }
      fusion.set(c.tmdbId, {
        ...c,
        par: [{ par: r.par, valeur: r.valeur }],
        score: poidsDe(r.par) + qualité(c),
        raison: "",
        clé: `loin:${c.tmdbId}`,
      });
    }
  }

  for (const v of fusion.values()) {
    v.par.sort((a, b) => poidsDe(b.par) - poidsDe(a.par));
    v.raison = raisonDe(v.par);
  }

  /* Le titre départage : sans lui, deux films de même score changeraient
     de place au gré de l'ordre d'arrivée des requêtes — c'est-à-dire du
     réseau, ce qui ferait un panneau différent à chaque ouverture. */
  return [...fusion.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fr"))
    .slice(0, combien);
}

/**
 * Les identifiants TMDB de la collection — ce que la colonne « dehors »
 * doit taire.
 *
 * `tmdbId` est tantôt un nombre, tantôt une CHAÎNE : les fiches écrites
 * à la main et certains imports anciens l'ont posé en texte. Comparé
 * sans conversion, `"27205"` n'est jamais `27205` — et le film qu'on
 * possède revient se proposer comme une découverte. On ramène donc tout
 * au nombre, une bonne fois, à l'entrée.
 */
export const déjàDansLeClasseur = (films: { tmdbId?: string | number | null }[]): Set<number> =>
  new Set(
    films
      .map((f) => (f.tmdbId == null || f.tmdbId === "" ? NaN : Number(f.tmdbId)))
      .filter((id) => Number.isFinite(id))
  );
