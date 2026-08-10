/* ============================================================
   LA FUSION — quand la même fiche a bougé des deux côtés
   ============================================================

   Deux appareils tiennent la même collection. Le téléphone note un film
   dans le métro, le portable en note un autre le soir : rien à
   arbitrer, chacun apporte ce que l'autre n'a pas. Le cas intéressant
   est plus rare et plus vicieux — la MÊME fiche touchée des deux côtés,
   chacun ignorant l'autre.

   CE QU'ON FAIT : LE DERNIER ÉCRIVAIN GAGNE, FICHE PAR FICHE.

   Et non « champ par champ », comme je l'avais d'abord écrit dans le
   plan. Arbitrer champ par champ demanderait une date par champ ; nous
   n'en avons qu'une par fiche. Prétendre le contraire donnerait un
   mélange arbitraire de deux versions — une note d'ici, une critique de
   là — c'est-à-dire une fiche que personne n'a jamais écrite. Mieux
   vaut perdre la version la plus ancienne, ce qui est compréhensible,
   qu'inventer une troisième version que nul ne reconnaît.

   SAUF LE JOURNAL DES SÉANCES, QUI S'ADDITIONNE.

   Une séance est un FAIT : « j'ai vu ce film le 3 mars ». Deux appareils
   qui en connaissent chacun une n'ont pas un désaccord, ils ont deux
   moitiés de la vérité. Écraser l'un par l'autre effacerait une soirée
   qui a eu lieu. C'est la seule exception, et elle tient à la nature de
   la donnée : partout ailleurs, deux valeurs différentes sont deux
   OPINIONS sur la même chose, et la plus récente l'emporte.
   ============================================================ */
import { mergeWatches, sortWatches } from "./film";
import type { Film } from "../types";

/** Ce que le serveur rend pour une fiche. */
export interface FicheDistante {
  id: string;
  majLe: number;
  supprimee?: boolean;
  donnees: Partial<Film>;
}

export interface Fusion {
  /** La collection après fusion. */
  films: Film[];
  /** Ce qui est entré, pour pouvoir le dire à l'écran. */
  bilan: { ajoutees: number; remplacees: number; gardees: number; effacees: number };
}

/* On ne tranche que sur des millisecondes : deux horloges ne sont
   jamais d'accord au dixième près, et une fiche dont les deux versions
   naissent dans la même milliseconde est, en pratique, la même. En cas
   d'égalité stricte, on garde le LOCAL — ne rien faire est le seul
   arbitrage qui ne surprenne personne. */
const plusRecent = (distant: number, local: number) => distant > local;

/**
 * Range ce qui vient du serveur dans la collection locale.
 *
 * Ne modifie rien sur place : rend une collection neuve, et les fiches
 * inchangées y sont les MÊMES objets — les vues sont mémoïsées sur
 * l'identité, et tout recopier referait l'étagère entière à chaque
 * synchronisation.
 */
export function fusionner(locaux: Film[], distants: FicheDistante[]): Fusion {
  const parId = new Map(locaux.map((f) => [f.id, f]));
  const bilan = { ajoutees: 0, remplacees: 0, gardees: 0, effacees: 0 };

  for (const venue of distants) {
    const ici = parId.get(venue.id);

    /* UNE FICHE EFFACÉE AILLEURS. On ne la supprime que si l'effacement
       est POSTÉRIEUR à ce qu'on en sait : sinon, un appareil qui a
       effacé hier emporterait la note écrite ce matin. */
    if (venue.supprimee) {
      if (ici && !plusRecent(venue.majLe, ici.updatedAt)) {
        bilan.gardees += 1;
        continue;
      }
      if (ici) {
        parId.delete(venue.id);
        bilan.effacees += 1;
      }
      continue;
    }

    if (!ici) {
      /* Inconnue ici : elle arrive telle quelle, avec sa date. Sans
         cette date, la prochaine comparaison la croirait plus fraîche
         que tout et la renverrait au serveur pour rien. */
      parId.set(venue.id, {
        ...(venue.donnees as Film),
        id: venue.id,
        updatedAt: venue.majLe,
        watches: sortWatches(venue.donnees.watches || []),
      });
      bilan.ajoutees += 1;
      continue;
    }

    /* LES SÉANCES S'ADDITIONNENT DANS TOUS LES CAS, y compris quand
       c'est la version locale qui gagne : une séance connue là-bas et
       pas ici doit entrer, même si le reste de la fiche ne change pas. */
    const séances = mergeWatches(ici.watches, venue.donnees.watches);
    const séancesEnPlus = séances.length !== (ici.watches || []).length;

    if (!plusRecent(venue.majLe, ici.updatedAt)) {
      if (séancesEnPlus) {
        parId.set(venue.id, {
          ...ici,
          watches: séances,
          watchedAt: séances[0]?.date ?? ici.watchedAt,
        });
      }
      bilan.gardees += 1;
      continue;
    }

    parId.set(venue.id, {
      ...ici,
      ...(venue.donnees as Film),
      id: venue.id,
      updatedAt: venue.majLe,
      watches: séances,
      watchedAt: séances[0]?.date ?? null,
    });
    bilan.remplacees += 1;
  }

  return { films: [...parId.values()], bilan };
}

/**
 * Ce qu'il reste à envoyer.
 *
 * PAS DE COMPARAISON DE DATES ICI, et c'est le fruit d'une erreur : la
 * première version filtrait sur « modifié depuis le dernier envoi », ce
 * qui renvoyait au serveur les fiches qu'on venait d'en recevoir. Leur
 * date vient d'un autre appareil, dont l'horloge n'est pas la nôtre ;
 * la comparer à notre repère ne veut rien dire.
 *
 * On travaille donc sur une LISTE tenue par le dépôt — les fiches
 * modifiées ici — et sur les pierres tombales. Ce qui est arrivé du
 * serveur n'y figure pas, et ne repart donc pas.
 */
export function àEnvoyer(
  films: Film[],
  tombes: { id: string; le: number }[],
  attente: string[]
): { id: string; tmdbId: unknown; majLe: number; supprimee?: boolean; donnees?: unknown }[] {
  const enAttente = new Set(attente);
  const partis = new Set(films.map((f) => f.id));

  const envois = films
    .filter((f) => enAttente.has(f.id))
    .map((f) => ({ id: f.id, tmdbId: f.tmdbId, majLe: f.updatedAt, donnees: f }));

  /* Les tombes suivent la même liste d'attente que les fiches : sans
     cela, elles repartiraient à chaque tour pendant un an. Et une fiche
     effacée puis recréée avec le même identifiant existe de nouveau —
     sa pierre tombale ne doit pas la retuer. */
  const effacees = tombes
    .filter((t) => enAttente.has(t.id) && !partis.has(t.id))
    .map((t) => ({ id: t.id, tmdbId: null, majLe: t.le, supprimee: true, donnees: {} }));

  return [...envois, ...effacees];
}
