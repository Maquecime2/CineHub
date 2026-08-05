import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseLetterboxdRss,
  parseWatchlistPage,
  fetchLetterboxdWatchlist,
  feedUrl,
  watchlistUrl,
  DEFAULT_RELAY,
} from "./letterboxd";

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

  it("numérote les pages de watchlist à partir de un", () => {
    expect(watchlistUrl("@essai")).toBe("/lb-rss/essai/watchlist/page/1/");
    expect(watchlistUrl("essai", 3)).toBe("/lb-rss/essai/watchlist/page/3/");
  });
});

/* La watchlist n'a pas de flux : on lit du HTML. Ce gabarit-ci est celui
   que Letterboxd sert AUJOURD'HUI, relevé sur une vraie page et réduit à
   trois films — un titre qui porte une virgule, un sans année, et une
   affiche sans nom. La pagination est reproduite telle quelle, points de
   suspension compris : c'est elle qui dit combien de pages relever. */
const GRILLE = `<html><body><section>
  <div class="poster-grid"><ul class="grid -p125">
    <li class="griditem">
      <div class="react-component" data-component-class="LazyPoster"
           data-item-name="Rachel, Rachel (1968)" data-item-slug="rachel-rachel"
           data-item-link="/film/rachel-rachel/"></div>
    </li>
    <li class="griditem">
      <div class="react-component" data-item-name="Le Samouraï (1967)"
           data-item-slug="le-samourai"></div>
    </li>
    <li class="griditem">
      <div class="react-component" data-item-slug="sans-nom"></div>
    </li>
  </ul></div>
  <div class="paginate-pages"><ul>
    <li class="paginate-page paginate-current"><span>1</span></li>
    <li class="paginate-page"><a href="/x/watchlist/page/2/">2</a></li>
    <li class="paginate-page unseen-pages">&hellip;</li>
    <li class="paginate-page"><a href="/x/watchlist/page/4/">4</a></li>
  </ul></div>
</section></body></html>`;

/* L'ancien gabarit, encore servi ici et là : l'année y est un attribut et
   le titre vit dans l'`alt` de l'affiche. */
const ANCIEN = `<html><body><ul class="poster-list">
  <li class="poster-container">
    <div class="film-poster" data-film-slug="vivre-sa-vie"
         data-film-release-year="1962"><img alt="Vivre sa vie"></div>
  </li>
</ul></body></html>`;

describe("lire une page de watchlist", () => {
  const page = () => parseWatchlistPage(GRILLE);

  it("rend chaque film avec son année et son adresse", () => {
    expect(page().rows[0]).toMatchObject({
      title: "Rachel, Rachel",
      year: 1968,
      uri: "https://letterboxd.com/film/rachel-rachel/",
    });
  });

  /* L'année est collée au titre, pas dans un attribut. La laisser là
     ferait de « Le Samouraï (1967) » un film que la collection ne
     reconnaîtrait jamais — et qu'elle recréerait à chaque relevé. */
  it("détache l'année du titre sans manger le reste", () => {
    expect(page().rows[1]).toMatchObject({ title: "Le Samouraï", year: 1967 });
  });

  /* Une envie n'a ni note ni séance. Les rendre à zéro plutôt qu'à null
     ferait écraser, au réimport, la note d'un film déjà vu qui traîne
     encore dans la watchlist. */
  it("ne prête ni note ni séance à une envie", () => {
    expect(page().rows[1]).toMatchObject({ rating: null, watchedAt: null, watches: [] });
  });

  it("compte les affiches sans titre au lieu de les inventer", () => {
    expect(page().rows).toHaveLength(2);
    expect(page().skippedNoTitle).toBe(1);
  });

  /* La pagination porte des points de suspension entre la troisième page
     et la dernière : c'est le plus GRAND nombre qui compte, pas le
     dernier lu, et surtout pas le « … ». */
  it("lit le nombre de pages dans la pagination, points de suspension compris", () => {
    expect(page().lastPage).toBe(4);
  });

  it("tient une watchlist courte pour une seule page", () => {
    expect(parseWatchlistPage(ANCIEN).lastPage).toBe(1);
  });

  it("comprend encore l'ancien gabarit, où l'année est un attribut", () => {
    expect(parseWatchlistPage(ANCIEN).rows[0]).toMatchObject({
      title: "Vivre sa vie",
      year: 1962,
      uri: "https://letterboxd.com/film/vivre-sa-vie/",
    });
  });

  /* LE point du garde-fou : une page qui n'est pas une watchlist doit
     lever, pas rendre zéro film. Zéro film se raconterait comme une
     watchlist vidée, et l'écran signalerait toute la collection comme
     retirée. */
  it("refuse une page qui n'est pas une watchlist", () => {
    expect(() => parseWatchlistPage("<html><body>503 Service Unavailable</body></html>")).toThrow(
      /pseudo|relais|public/i
    );
  });

  /* Une watchlist vide le dit : Letterboxd pose « No films yet » dans
     `.empty-text`. C'est ce qui la distingue d'une page ratée. */
  it("accepte en revanche une watchlist réellement vide", () => {
    const vide = `<html><body><p class="empty-text">No films yet</p></body></html>`;
    expect(parseWatchlistPage(vide).rows).toEqual([]);
  });
});

/* Le relevé entier, pages comprises. Le réseau est remplacé par un
   dictionnaire de pages : ce qu'on vérifie ici, c'est la BOUCLE et
   l'ordre, pas la capacité de `fetch` à aller chercher une page. */
describe("relever une watchlist entière", () => {
  const page = (noms: string[], dernière: number) =>
    `<html><body><ul class="grid">${noms
      .map(
        (n) =>
          `<li class="griditem"><div class="react-component" data-item-name="${n}"
             data-item-slug="${n.toLowerCase().replace(/\W+/g, "-")}"></div></li>`
      )
      .join("")}</ul>
     <div class="paginate-pages"><ul><li>1</li><li>${dernière}</li></ul></div></body></html>`;

  const servir = (pages: Record<string, string>) =>
    vi.stubGlobal("fetch", (url: string) => {
      const html = pages[url];
      return Promise.resolve({
        ok: html !== undefined,
        status: html === undefined ? 404 : 200,
        text: () => Promise.resolve(html ?? ""),
      } as Response);
    });

  afterEach(() => vi.unstubAllGlobals());

  it("suit la pagination et rend les films dans l'ordre des pages", async () => {
    servir({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)", "Solaris (1972)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Le Miroir (1975)"], 2),
    });
    const { rows, stats, kind } = await fetchLetterboxdWatchlist("essai");
    expect(kind).toBe("watchlist");
    expect(rows.map((r) => r.title)).toEqual(["Stalker", "Solaris", "Le Miroir"]);
    expect(stats.total).toBe(3);
  });

  /* L'ORDRE EST UNE DONNÉE : la page sert la watchlist du plus récemment
     ajouté au plus ancien. Sans ce report, les trois fiches naîtraient à
     la même milliseconde et le tri « par ajout » serait au hasard. */
  it("date les fiches dans l'ordre où elles ont été mises de côté", async () => {
    servir({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)", "Solaris (1972)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Le Miroir (1975)"], 2),
    });
    const { rows } = await fetchLetterboxdWatchlist("essai");
    const dates = rows.map((r) => r.addedAt!);
    expect(dates[0]).toBeGreaterThan(dates[1]!);
    expect(dates[1]).toBeGreaterThan(dates[2]!);
  });

  it("annonce l'avancée page après page", async () => {
    servir({
      "/lb-rss/essai/watchlist/page/1/": page(["Stalker (1979)"], 2),
      "/lb-rss/essai/watchlist/page/2/": page(["Solaris (1972)"], 2),
    });
    const vu: string[] = [];
    await fetchLetterboxdWatchlist("essai", undefined, {
      onProgress: (d, t) => vu.push(`${d}/${t}`),
    });
    expect(vu).toEqual(["1/2", "2/2"]);
  });

  it("refuse un pseudo vide avant de toucher au réseau", async () => {
    await expect(fetchLetterboxdWatchlist("  ")).rejects.toThrow(/pseudo/i);
  });
});
