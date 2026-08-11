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
import { POIDS, familleDe, parQuotas } from "./sillage";
import type { Famille, Lien, Quotas, Rapprochement, Voisin } from "./sillage";
import type { Film } from "../types";

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

/* À quelle famille appartient un chemin. « Recommandé » n'est ni l'un ni
   l'autre — c'est la foule qui parle, pas une équipe ni un sujet — et on
   le range dans « sujets » : c'est de ce côté-là que TMDB a le moins à
   offrir, et une recommandation est plus proche d'un « ça parle de la
   même chose » que d'un générique partagé. */
const familleLoin = (par: Lien | "reco" | undefined): Famille =>
  !par || par === "reco" ? "sujets" : familleDe([{ type: par, valeur: "" }]);

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

/** Un chemin, en toutes lettres : « du même chef op Franz Lustig ». */
const direLeChemin = (p: VoisinLoin["par"][number]): string =>
  p.par === "reco" ? INTITULÉS_LOIN.reco : `${INTITULÉS_LOIN[p.par]} ${p.valeur}`;

/* UN LIEN SE NOMME, IL NE SE COMPTE PAS.

   Le premier jet écrivait « du même chef op Franz Lustig, + 1 lien ». Ce
   « + 1 lien » ne dit rien du tout : on apprend qu'il existe une seconde
   raison, et pas laquelle — c'est-à-dire exactement l'information qu'on
   était venu chercher. La moitié maison, elle, nomme la famille (« + 2
   motifs ») ; celle-ci doit au moins en faire autant.

   On nomme donc les DEUX premiers chemins. Au-delà, on compte : trois
   provenances écrites bout à bout font une ligne qu'on ne lit plus, et
   les deux plus forts portent déjà l'essentiel. */
function raisonDe(par: VoisinLoin["par"]): string {
  const [tête, second, ...reste] = par;
  if (!tête) return "";
  if (!second) return direLeChemin(tête);
  const deux = `${direLeChemin(tête)} · ${direLeChemin(second)}`;
  return reste.length ? `${deux}, + ${reste.length}` : deux;
}

/* ============================================================
   LE RENFORT — ce que TMDB apprend sur VOTRE collection
   ============================================================

   Le sillage maison rapproche par les sujets à condition que les DEUX
   fiches en portent. Or les motifs et les thèmes se posent à la main, et
   les mots-clés de TMDB ne sont récoltés que depuis peu : sur une
   collection importée avant cela, la moitié « sujets » reste vide et la
   colonne ne parle que d'équipes.

   Aller chercher les mots-clés des cinq cents fiches réglerait la
   question — au prix de cinq cents appels à l'ouverture d'une fiche, ce
   qui n'est pas une option.

   MAIS LA RÉPONSE EST DÉJÀ LÀ. La requête `discover` par mots-clés,
   lancée pour la colonne de droite, rapporte des films qui partagent le
   sujet du pivot — et certains sont DANS votre classeur. On les jetait
   comme des doublons ; ce sont en réalité les rapprochements
   thématiques qui manquaient, obtenus sans un appel de plus.

   Le raisonnement vaut pour tous les chemins : un film de votre
   collection remonté par la filmographie d'un chef opérateur est un
   voisin, que sa fiche porte ou non le nom de ce chef opérateur. */

/**
 * Les films de VOTRE collection que les récoltes ont désignés.
 *
 * `parTmdbId` associe un identifiant TMDB à la fiche correspondante ;
 * c'est l'appelant qui le construit, une fois, à partir de la
 * collection — la conversion des identifiants écrits en texte comprise.
 */
export function renfortDuDehors(
  récoltes: Récolte[],
  parTmdbId: Map<number, Film>,
  pivotId: string
): Voisin[] {
  const fusion = new Map<string, { film: Film; par: VoisinLoin["par"] }>();

  for (const r of récoltes) {
    for (const c of r.candidats || []) {
      if (!c?.tmdbId) continue;
      const film = parTmdbId.get(c.tmdbId);
      /* Le pivot se retrouve évidemment lui-même dans sa propre
         filmographie et dans ses propres mots-clés. */
      if (!film || film.id === pivotId || film.archived) continue;
      const déjà = fusion.get(film.id);
      if (déjà) déjà.par.push({ par: r.par, valeur: r.valeur });
      else fusion.set(film.id, { film, par: [{ par: r.par, valeur: r.valeur }] });
    }
  }

  const out: Voisin[] = [];
  for (const { film, par } of fusion.values()) {
    par.sort((a, b) => poidsDe(b.par) - poidsDe(a.par));
    /* Les chemins deviennent des liens du même vocabulaire que le
       sillage maison : c'est ce qui permet de les mêler aux siens et de
       leur appliquer les mêmes quotas. « Recommandé » n'a pas
       d'équivalent — il devient un sujet, faute de mieux, et le dit. */
    const liens: Rapprochement[] = par.map((p) =>
      p.par === "reco"
        ? { type: "mot-clé" as const, valeur: p.valeur }
        : { type: p.par, valeur: p.valeur }
    );
    out.push({
      film,
      score: par.reduce((s, p) => s + poidsDe(p.par), 0),
      liens,
      raison: raisonDe(par),
      clé: `renfort:${pivotId}:${film.id}`,
    });
  }
  return out;
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
  { déjàLà = new Set<number>(), quotas = {} as Partial<Quotas>, votesMinimum = VOTES_MINIMUM } = {}
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
  const triés = [...fusion.values()].sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title, "fr")
  );
  /* Les mêmes quotas qu'à la maison, et pour la même raison : sans eux,
     les filmographies des quatre artisans de tête raflent toute la
     colonne et l'on n'apprend jamais « du même sujet ». */
  return parQuotas(triés, (v) => familleLoin(v.par[0]?.par), quotas);
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
/** Le même passage au nombre, isolé pour être appliqué partout pareil. */
const idNumérique = (v: string | number | null | undefined): number =>
  v == null || v === "" ? NaN : Number(v);

/**
 * La collection indexée par identifiant TMDB — de quoi reconnaître une
 * de vos fiches dans ce que TMDB rapporte.
 */
export const parIdTmdb = (films: Film[]): Map<number, Film> => {
  const m = new Map<number, Film>();
  for (const f of films) {
    const id = idNumérique(f.tmdbId);
    if (Number.isFinite(id)) m.set(id, f);
  }
  return m;
};

export const déjàDansLeClasseur = (films: { tmdbId?: string | number | null }[]): Set<number> =>
  new Set(
    films
      .map((f) => (f.tmdbId == null || f.tmdbId === "" ? NaN : Number(f.tmdbId)))
      .filter((id) => Number.isFinite(id))
  );
