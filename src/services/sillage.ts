/* ============================================================
   LA RÉCOLTE DU SILLAGE — les quelques requêtes, et rien d'autre

   Séparée du tri (`domain/sillageLoin`) pour la raison habituelle : ce
   qui touche au réseau ne se teste qu'en le simulant, ce qui classe se
   teste tout court. Ce module ne décide de rien — il demande, et rend ce
   qu'on lui a répondu.

   CINQ REQUÊTES AU PLUS, et toutes mises en cache par `tmdb.js` (sept
   jours). Ouvrir une fiche ne doit pas coûter une récolte : ce sont des
   propositions à côté d'un film, pas un balayage du catalogue.
   ============================================================ */
import {
  recommendationsFor,
  searchPerson,
  personFilmography,
  fetchKeywords,
  discover,
  pooled,
} from "../tmdb";
import type { Récolte } from "../domain/sillageLoin";
import type { Film } from "../types";
import type { Lien } from "../domain/sillage";

/* Les chemins qu'on suit, dans l'ordre où ils comptent. On ne demande
   PAS le scénario ni les rôles secondaires : cinq requêtes tiennent en
   une seconde, quinze font attendre — et les deux premiers métiers plus
   la réalisation portent déjà l'essentiel de ce qui rapproche. */
const CHEMINS: { lien: Lien; rôle: string; de: (f: Film) => string | undefined }[] = [
  { lien: "image", rôle: "image", de: (f) => f.crew?.image?.[0] },
  { lien: "musique", rôle: "musique", de: (f) => f.crew?.musique?.[0] },
  { lien: "réalisation", rôle: "réalisation", de: (f) => f.director?.split(",")[0]?.trim() },
  { lien: "acteur", rôle: "interprétation", de: (f) => f.cast?.[0] },
];

/**
 * Ce que TMDB a autour de ce film : ses recommandations, et ce que ses
 * quatre artisans de tête ont fait ailleurs.
 *
 * Rend des récoltes brutes — la fusion, l'exclusion de ce qu'on possède
 * déjà et le classement sont l'affaire de `fusionnerLoin`.
 *
 * Une requête qui échoue est PERDUE, pas fatale : `pooled` avale les
 * échecs, et un chef opérateur introuvable ne doit pas emporter les
 * recommandations avec lui.
 */
export async function récolterLeSillage(pivot: Film, apiKey: string): Promise<Récolte[]> {
  if (!apiKey) return [];

  const tâches: (() => Promise<Récolte | null>)[] = [];

  if (pivot.tmdbId)
    tâches.push(async () => ({
      par: "reco",
      valeur: pivot.title,
      candidats: await recommendationsFor(pivot.tmdbId, apiKey),
    }));

  for (const chemin of CHEMINS) {
    const nom = chemin.de(pivot);
    if (!nom) continue;
    tâches.push(async () => {
      const personne = await searchPerson(nom, apiKey);
      if (!personne) return null;
      return {
        par: chemin.lien,
        valeur: nom,
        candidats: await personFilmography(personne.id, apiKey, { role: chemin.rôle }),
      };
    });
  }

  /* LA VOIE DU SUJET, qui manquait entièrement.

     Les quatre chemins ci-dessus mènent tous à des GENS : la colonne
     « ailleurs » ne savait donc rendre que des filmographies, et
     « même sujet » n'y paraissait jamais. `/discover` accepte des
     mots-clés — encore faut-il leurs IDENTIFIANTS, que `film.keywords`
     ne garde pas (il n'a que les libellés, qui se lisent). On les
     redemande donc ici : l'appel est en cache, et c'est le même que
     celui de la fiche ouverte.

     Trois mots-clés joints par une barre verticale, c'est-à-dire un OU :
     exiger les trois à la fois ne rendrait presque rien, et les trois
     premiers sont les plus spécifiques du lot. */
  if (pivot.tmdbId)
    tâches.push(async () => {
      const mots = await fetchKeywords(pivot.tmdbId, apiKey);
      const ids = mots
        .map((m: { id?: number }) => m.id)
        .filter(Boolean)
        .slice(0, 3);
      if (!ids.length) return null;
      return {
        par: "mot-clé",
        valeur: mots
          .slice(0, 3)
          .map((m: { name?: string }) => m.name)
          .filter(Boolean)
          .join(", "),
        candidats: await discover(
          { with_keywords: ids.join("|"), sort_by: "vote_count.desc" },
          apiKey
        ),
      };
    });

  const résultats = await pooled(tâches, { concurrency: 5 });
  return résultats.filter((r): r is Récolte => !!r?.candidats?.length);
}
