/* ============================================================
   DEUX ORTHOGRAPHES POUR UN SEUL GENRE
   ============================================================

   « Science Fiction » ET « Science-Fiction » se tenaient côte à côte
   dans le tamis, comme deux genres différents. Aucune fiche ne portait
   les deux, donc filtrer sur l'une des deux cases cachait la moitié des
   films qu'on cherchait — sans rien dire, et sans qu'on puisse deviner
   qu'il fallait cocher l'autre aussi.

   D'OÙ ÇA VIENT : TMDB sert les genres DANS LA LANGUE DEMANDÉE, et un
   classeur se remplit sur plusieurs années, parfois depuis deux
   navigateurs réglés autrement. Ce n'est donc ni une faute de frappe ni
   un défaut de TMDB : ce sont deux réponses justes à deux questions
   différentes, qui atterrissent dans la même colonne.

   ON NE TRADUIT PAS LES GENRES, ET CE FICHIER N'EST PAS UN CATALOGUE.
   Un genre est une DONNÉE : il est écrit dans la fiche de quelqu'un, et
   `CLAUDE.md` dit pourquoi traduire une donnée fige la langue du jour
   dans le classeur d'autrui. Ce qu'on fait ici est plus étroit — on
   choisit UNE orthographe quand plusieurs désignent visiblement la même
   chose, et on s'arrête là.

   LA CLÉ IGNORE LA CASSE, LES ACCENTS ET LES SÉPARATEURS ; c'est elle
   qui rapproche « Science Fiction » de « Science-Fiction ». Mais le
   rapprochement seul ne suffit pas à choisir un gagnant, et deviner
   aurait renommé des genres que personne n'a demandé de renommer :
   `CANON` est la liste EXPLICITE des collisions qu'on tranche, et rien
   d'autre n'est touché. Une orthographe inconnue passe telle quelle.

   LA FORME RETENUE EST LA FRANÇAISE, parce que le catalogue par défaut
   de ce produit l'est (`DEFAULT_LANGUAGE`). C'est le seul arbitrage de
   ce fichier, il tient sur une ligne, et il se renverse sur une ligne.
   ============================================================ */

/** La clé sous laquelle deux orthographes se reconnaissent. */
export const genreKey = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    /* Trait d'union, tiret bas, espaces, apostrophes : tout ce qui
       sépare deux mots sans les changer. */
    .replace(/[^a-z0-9]/g, "");

/**
 * Les collisions qu'on tranche, et elles seules.
 *
 * On n'y met une ligne que lorsque deux orthographes désignent la MÊME
 * chose dans la MÊME langue, ou qu'une graphie est visiblement la
 * version sans trait d'union de l'autre. « Thriller » et « Suspense »
 * n'y ont pas leur place : ce sont deux mots, pas deux graphies.
 */
const CANON: Record<string, string> = {
  sciencefiction: "Science-Fiction",
};

/** L'orthographe retenue pour ce genre. Inconnue : la sienne. */
export const canonicalGenre = (g: string): string => {
  const said = (g || "").trim();
  return CANON[genreKey(said)] ?? said;
};

/**
 * La liste d'une fiche, mise au propre.
 *
 * ET DÉDOUBLONNÉE, ce qui est la moitié du travail : une fiche
 * réimportée pouvait tenir les deux graphies, et les rapprocher sans
 * dédoublonner l'aurait fait porter deux fois le même genre.
 */
export const canonicalGenres = (genres: readonly string[] = []): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of genres) {
    const said = canonicalGenre(g);
    if (!said || seen.has(said)) continue;
    seen.add(said);
    out.push(said);
  }
  return out;
};
