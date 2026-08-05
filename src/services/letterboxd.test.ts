import { describe, it, expect } from "vitest";
import { parseLetterboxdRss, feedUrl, DEFAULT_RELAY } from "./letterboxd";

/* Un extrait de flux RÉEL, figé ici. Aucun appel réseau dans ces tests :
   ce qu'on vérifie, c'est la lecture, et un flux vivant changerait de
   contenu entre deux exécutions. Il porte exprès les quatre cas qui
   comptent — une séance notée, une liste, un film vu sans note, et un
   revisionnage du même film à deux dates. */
const item = (guid: string, inner: string) =>
  `<item><guid isPermaLink="false">${guid}</guid>${inner}</item>`;

const FLUX = `<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0" xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">
<channel><title>Letterboxd - Essai</title>
${item(
  "letterboxd-watch-1",
  `<title>Toy Story 4, 2019 - ★★★½</title>
   <link>https://letterboxd.com/essai/film/toy-story-4/</link>
   <letterboxd:watchedDate>2026-06-25</letterboxd:watchedDate>
   <letterboxd:rewatch>Yes</letterboxd:rewatch>
   <letterboxd:filmTitle>Toy Story 4</letterboxd:filmTitle>
   <letterboxd:filmYear>2019</letterboxd:filmYear>
   <letterboxd:memberRating>3.5</letterboxd:memberRating>
   <tmdb:movieId>301528</tmdb:movieId>`
)}
${item(
  "letterboxd-list-99",
  `<title>Mes films de 2026</title>
   <link>https://letterboxd.com/essai/list/2026/</link>
   <letterboxd:filmTitle>Mes films de 2026</letterboxd:filmTitle>`
)}
${item(
  "letterboxd-watch-2",
  `<title>The Backrooms, 2022</title>
   <link>https://letterboxd.com/essai/film/the-backrooms/</link>
   <letterboxd:watchedDate>2026-05-22</letterboxd:watchedDate>
   <letterboxd:filmTitle>The Backrooms</letterboxd:filmTitle>
   <letterboxd:filmYear>2022</letterboxd:filmYear>
   <tmdb:movieId>979600</tmdb:movieId>`
)}
${item(
  "letterboxd-watch-3",
  `<title>Toy Story 4, 2019 - ★★★</title>
   <link>https://letterboxd.com/essai/film/toy-story-4/1/</link>
   <letterboxd:watchedDate>2024-01-02</letterboxd:watchedDate>
   <letterboxd:filmTitle>Toy Story 4</letterboxd:filmTitle>
   <letterboxd:filmYear>2019</letterboxd:filmYear>
   <letterboxd:memberRating>3.0</letterboxd:memberRating>
   <tmdb:movieId>301528</tmdb:movieId>`
)}
</channel></rss>`;

const parsed = () => parseLetterboxdRss(FLUX);
const find = (title: string) => parsed().rows.find((r) => r.title === title);

describe("lire le flux Letterboxd", () => {
  it("rend une séance complète, identifiant TMDB compris", () => {
    expect(find("The Backrooms")).toMatchObject({
      title: "The Backrooms",
      year: 2022,
      watchedAt: "2026-05-22",
      tmdbId: 979600,
      uri: "https://letterboxd.com/essai/film/the-backrooms/",
    });
  });

  /* L'identifiant est ce qui permet à `diffImport` d'apparier sans passer
     par le titre, et à TMDB de ne plus chercher. C'est le seul champ du
     flux qui n'existait dans aucun CSV. */
  it("donne l'identifiant TMDB en nombre, pas en chaîne", () => {
    expect(find("Toy Story 4")!.tmdbId).toBe(301528);
  });

  /* Le flux mêle les listes publiées aux séances : sans le tri sur le
     `guid`, « Mes films de 2026 » entrerait dans la vidéothèque comme un
     film — il a un titre et un lien, rien ne le trahirait. */
  it("écarte les listes, qui ne sont pas des films", () => {
    expect(parsed().rows.map((r) => r.title)).not.toContain("Mes films de 2026");
    expect(parsed().rows).toHaveLength(2);
  });

  /* Zéro veut dire « noté zéro » dans le modèle. Un film vu sans note
     doit ressortir en null, sinon le réimport écrase une note existante
     par un zéro que personne n'a donné. */
  it("distingue « pas de note » de « noté zéro »", () => {
    expect(find("The Backrooms")!.rating).toBeNull();
    expect(find("Toy Story 4")!.rating).toBe(3.5);
  });

  it("fond un revisionnage en une fiche, pas deux", () => {
    const rows = parsed().rows.filter((r) => r.title === "Toy Story 4");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.watchedAt).toBe("2026-06-25");
  });

  /* Le flux donne la note de CHAQUE séance. Les réduire à la dernière,
     c'était jeter la seule chose qui dit qu'un avis a bougé. */
  it("garde les deux séances d'un film revu, chacune avec sa note", () => {
    expect(find("Toy Story 4")!.watches).toEqual([
      { date: "2026-06-25", rating: 3.5, rewatch: true },
      { date: "2024-01-02", rating: 3 },
    ]);
  });

  it("consigne une séance même sans note", () => {
    expect(find("The Backrooms")!.watches).toEqual([{ date: "2026-05-22", rating: null }]);
  });

  /* Une revoyure n'est pas un rebut : l'annoncer comme un doublon ferait
     croire qu'on a perdu ce qu'on vient justement de garder. */
  it("compte ce qu'il a lu, sans prendre les revoyures pour des doublons", () => {
    expect(parsed().stats).toMatchObject({
      lines: 3,
      total: 2,
      duplicatesInFile: 0,
      withRating: 1,
      withoutRating: 1,
    });
  });

  // il n'existe pas de flux de watchlist : ce chemin ne rend que du vu
  it("annonce des films vus", () => {
    expect(parsed().kind).toBe("watched");
  });

  /* Un relais en panne ne répond pas une erreur : il répond une page. La
     lire en silence donnerait « aucune séance », et on chercherait du
     côté du pseudo pendant que le vrai coupable est le relais. */
  it("refuse une page HTML avec un message qui dit quoi vérifier", () => {
    expect(() => parseLetterboxdRss("<html><body>503 Service Unavailable</body></html>")).toThrow(
      /pseudo|relais/i
    );
  });
});

describe("l'adresse du flux", () => {
  /* Les tests tournent sous Vitest, donc en mode développement : c'est le
     chemin relatif du proxy Vite qui doit sortir. */
  it("passe par le serveur de développement, sans relais ni tiers", () => {
    expect(feedUrl("essai")).toBe("/lb-rss/essai/rss/");
  });

  it("laisse coller un pseudo avec son arobase", () => {
    expect(feedUrl("@essai")).toBe("/lb-rss/essai/rss/");
  });

  it("a un relais par défaut qui sait où mettre l'adresse", () => {
    expect(DEFAULT_RELAY).toContain("{url}");
  });
});
