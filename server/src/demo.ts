/* ============================================================
   LES AFFICHES DE LA DÉMONSTRATION
   ============================================================

   Les douze fiches d'exemple sont désormais la SEULE chose qu'on montre
   à qui n'a pas de compte. Elles se dessinaient avec leurs initiales sur
   une émulsion teintée — un choix de direction artistique assumé, écrit
   dans `src/services/demo.ts`, et dont l'argument était qu'une adresse
   morte donnerait douze rectangles cassés dans une application qui
   marche hors ligne.

   Cet argument est tombé avec la porte de session : l'application ne
   s'ouvre plus sans réseau. Une vitrine sans images est une vitrine
   qu'on ne regarde pas.

   ------------------------------------------------------------
   ON RETIENT L'ADRESSE, PAS L'IMAGE
   ------------------------------------------------------------

   Recopier douze affiches dans le container aurait lié la vitrine au
   stockage blob, qui est FACULTATIF dans ce serveur — une instance sans
   container aurait perdu sa page d'accueil. L'adresse du CDN de TMDB
   tient dans une ligne et se sert toute seule.

   ------------------------------------------------------------
   LA RÉSOLUTION EST UNE RECHERCHE, DONC ELLE PEUT SE TROMPER
   ------------------------------------------------------------

   Les fiches d'exemple ne portent pas d'identifiant TMDB, et en inventer
   douze aurait attaché silencieusement les mauvaises affiches — le genre
   de faute qui a l'air de marcher. On cherche donc par TITRE D'ORIGINE
   et par ANNÉE, ce que le produit fait déjà pour tout import Letterboxd.

   Deux garde-fous, puisqu'une recherche se trompe : le résultat est
   RANGÉ EN BASE, donc corrigeable à la main sans redéployer, et il n'est
   cherché QU'UNE FOIS — un démarrage ne refait pas le travail du
   précédent.

   ------------------------------------------------------------
   LES DOUZE IDENTIFIANTS SONT ÉCRITS DES DEUX CÔTÉS
   ------------------------------------------------------------

   Le classeur tient les siens dans `src/services/demo.ts`, avec leurs
   textes traduits ; ici on ne tient que ce qu'il faut pour chercher. Les
   deux listes doivent nommer les mêmes douze fiches, et
   `src/services/demoPosters.test.ts` les compare — c'est le genre
   d'accord qui se défait en silence, et il se défait du côté qu'on n'a
   pas ouvert ce jour-là.
   ============================================================ */
import type { Db } from "./db.ts";

/** Ce qu'il faut pour trouver une affiche : le titre d'origine et l'année. */
export interface DemoFilm {
  id: string;
  /* LE TITRE D'ORIGINE et non le titre français : c'est celui sous
     lequel TMDB indexe, et le seul qui ne dépende pas de la langue dans
     laquelle le classeur se lit. */
  title: string;
  year: number;
}

export const DEMO_FILMS: DemoFilm[] = [
  { id: "demo-chihiro", title: "千と千尋の神隠し", year: 2001 },
  { id: "demo-mulholland", title: "Mulholland Drive", year: 2001 },
  { id: "demo-mood", title: "花樣年華", year: 2000 },
  { id: "demo-jour-sans-fin", title: "Groundhog Day", year: 1993 },
  { id: "demo-alien", title: "Alien", year: 1979 },
  { id: "demo-blade-runner", title: "Blade Runner", year: 1982 },
  { id: "demo-paris-texas", title: "Paris, Texas", year: 1984 },
  { id: "demo-perfect-days", title: "Perfect Days", year: 2023 },
  { id: "demo-400-coups", title: "Les Quatre Cents Coups", year: 1959 },
  { id: "demo-samourai", title: "Le Samouraï", year: 1967 },
  { id: "demo-stalker", title: "Сталкер", year: 1979 },
  { id: "demo-portrait", title: "Portrait de la jeune fille en feu", year: 2019 },
];

/** D'où viennent les images. La taille est celle d'une affiche de mur. */
const CDN = "https://image.tmdb.org/t/p/w500";

/** Ce que la route publique rend : un identifiant, une adresse complète. */
export type DemoPosters = Record<string, string>;

export async function demoPosters(db: Db): Promise<DemoPosters> {
  const rows = await db.query<{ demo_id: string; path: string }>(
    "SELECT demo_id, path FROM demo_poster WHERE path <> ''"
  );
  const out: DemoPosters = {};
  for (const r of rows) out[r.demo_id] = `${CDN}${r.path}`;
  return out;
}

/**
 * Cherche les affiches manquantes, une fois pour toutes.
 *
 * APPELÉE AU DÉMARRAGE ET JAMAIS AILLEURS, et elle ne bloque rien : le
 * serveur répond pendant qu'elle travaille, et la vitrine se garnit au
 * démarrage suivant si TMDB traîne. Sans clé, elle ne fait rien du tout
 * et le classeur dessine ses initiales comme avant.
 *
 * UNE LIGNE EST ÉCRITE MÊME QUAND LA RECHERCHE ÉCHOUE, avec un chemin
 * vide : sans elle, un film que TMDB ne connaît pas sous ce titre serait
 * recherché à chaque démarrage, pour toujours.
 */
export async function resolveDemoPosters(
  db: Db,
  tmdbKey: string | undefined,
  say: (m: string) => void = () => {}
): Promise<number> {
  if (!tmdbKey) return 0;

  const known = new Set(
    (await db.query<{ demo_id: string }>("SELECT demo_id FROM demo_poster")).map((r) => r.demo_id)
  );
  const missing = DEMO_FILMS.filter((f) => !known.has(f.id));
  if (missing.length === 0) return 0;

  let found = 0;
  for (const film of missing) {
    let path = "";
    try {
      const url =
        `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(tmdbKey)}` +
        `&query=${encodeURIComponent(film.title)}&year=${film.year}`;
      const res = await fetch(url);
      if (res.ok) {
        const body = (await res.json()) as { results?: { poster_path?: string | null }[] };
        path = body.results?.[0]?.poster_path ?? "";
      }
    } catch {
      /* Réseau coupé au démarrage : on n'écrit RIEN, pour que le
         démarrage suivant réessaie. Une ligne vide veut dire « cherché
         et pas trouvé », pas « pas encore cherché ». */
      continue;
    }

    await db.query(
      "INSERT INTO demo_poster (demo_id, path) VALUES ($1, $2) ON CONFLICT (demo_id) DO NOTHING",
      [film.id, path]
    );
    if (path) found += 1;
    else say(`affiche introuvable pour ${film.id} (${film.title}, ${film.year})`);
  }
  return found;
}
