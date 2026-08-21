/* ============================================================
   ALLER CHERCHER DEUX GÉNÉRIQUES, ET LES CROISER

   `domain/hints` sait apparier des génériques et ne sait pas les
   obtenir ; c'est cette moitié-là. Le module est court exprès : tout ce
   qui décide est PUR et vit à côté, ici on ne fait que demander.

   LE CLASSEUR NE CONNAÎT QUE DES NOMS, donc la charnière est
   l'identifiant TMDB — exactement comme pour Wikidata. `searchPerson`
   le trouve, et il porte la correction qui vaut d'être retenue : il ne
   prend PAS `results[0]`, qui est le classement par POPULARITÉ, sinon
   demander un réalisateur qui partage son nom avec un acteur plus connu
   rendrait l'acteur.

   IL LE REDEMANDE, ET ÇA NE COÛTE RIEN. `lineageHints` résout déjà les
   mêmes noms de son côté ; `searchPerson` met en cache par
   `p:<nom>:<métier>`, donc la seconde demande est une lecture de disque.
   Partager le travail aurait soudé deux services que rien d'autre ne
   lie, pour économiser zéro requête.

   ON GARDE LE NOM DU CLASSEUR, JAMAIS CELUI DE TMDB. Le lien posé
   portera ce nom-là (`Bond.fromName`), et la carte lit l'orthographe de
   la collection quand elle existe. Laisser entrer « Mario Bava (I) » y
   ferait un second nœud à côté du vôtre, sans que rien ne le dise.

   L'ÉCHEC REMONTE. `Trouble` et `Nothing` ne sont pas le même écran, et
   la vue ne peut les distinguer que si la levée traverse : pas de
   `.catch(() => {})` sur un chargement. `pooled`, lui, avale une requête
   perdue — et c'est juste ici : un nom qu'on n'a pas su résoudre est un
   cinéaste sans piste, pas une moisson qui a échoué.

   AUCUN CACHE À LUI. Les deux appels qu'il fait sont DÉJÀ mis en cache
   par `tmdb.js` — `p:<nom>` pour la recherche, `cw:<id>` pour le
   générique — avec la semaine de TTL et la purge au-delà de trois cents
   que tout ce fichier applique. En ajouter un troisième par-dessus
   aurait fait deux dates de péremption pour une donnée.
   ============================================================ */
import { searchPerson, personCrew, pooled } from "../tmdb";
import { crossedHints } from "../domain/hints";
import type { CrossPerson, Hint } from "../domain/hints";

export type CrossProgress = (done: number, total: number) => void;

/**
 * Les pistes que le croisement des génériques donne sur ces cinéastes.
 *
 * Rien n'est filtré contre ce qui est déjà posé : `usefulHints` s'en
 * charge, et seul l'appelant tient les liens du moment.
 */
export async function crossHintsFor(
  names: string[],
  apiKey: string,
  onProgress?: CrossProgress
): Promise<Hint[]> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!wanted.length) return [];

  /* Le compte est tenu ici plutôt que confié à `pooled` : son
     `onProgress` vient d'un module JavaScript et n'est pas visible à
     `tsc` — la remarque est déjà écrite dans `lineageHints`. */
  let done = 0;
  const total = wanted.length;

  const people = await pooled(
    wanted.map((name) => async () => {
      try {
        const hit = (await searchPerson(name, apiKey, { role: "réalisation" })) as {
          id?: number;
        } | null;
        if (!hit?.id) return null;
        const credits = (await personCrew(hit.id, apiKey)) as CrossPerson["credits"];
        return { name, credits } satisfies CrossPerson;
      } finally {
        onProgress?.((done += 1), total);
      }
    }),
    { concurrency: 5 }
  );

  return crossedHints((people as (CrossPerson | null)[]).filter((p): p is CrossPerson => !!p));
}
