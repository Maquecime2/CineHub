import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkApiKey, enrichRows } from "./tmdb";
import { VIA_SERVER, setTmdbKey } from "./services/tmdbKey";

const CACHE_KEY = "tmdb-cache";

/* Une réponse TMDB minimale : seulement ce que `searchMovie` et `getDetails` lisent. */
const okFetch = () =>
  vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      String(url).includes("/search/movie")
        ? { results: [{ id: 42, title: "Le Samouraï", release_date: "1967-10-25" }] }
        : {
            id: 42,
            genres: [{ name: "Policier" }],
            release_date: "1967-10-25",
            poster_path: "/p.jpg",
            credits: { crew: [{ job: "Director", name: "Jean-Pierre Melville" }] },
            /* `append_to_response` demande AUSSI les mots-clés, et TMDB
               les rend toujours — fût-ce sous forme de liste vide. Sans
               eux, le mock déclenche le repli sur l'endpoint dédié et
               fait donc un appel de plus que la réalité. */
            keywords: { keywords: [{ id: 1, name: "hitman" }] },
          },
  }));

const emptySearch = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ results: [] }),
  }));

const rows = [{ title: "Le Samouraï", year: 1967 }];
const cache = () => JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");

describe("enrichRows — cache", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("mémorise un film résolu et n'interroge plus TMDB au réimport", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const first = await enrichRows(rows, "k");
    expect(first.resolved).toBe(1);
    expect(first.rows[0].director).toBe("Jean-Pierre Melville");

    const calls = fetchMock.mock.calls.length;
    const second = await enrichRows(rows, "k");
    expect(second.resolved).toBe(1);
    expect(fetchMock.mock.calls.length).toBe(calls); // rien n'est redemandé
  });

  it("ne mémorise pas un échec réseau : le réimport suivant retente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const out = await enrichRows(rows, "k");
    expect(out.failed).toBe(1);
    expect(cache()).toEqual({});

    vi.stubGlobal("fetch", okFetch());
    expect((await enrichRows(rows, "k")).resolved).toBe(1);
  });

  it("mémorise un « introuvable », mais le laisse se périmer", async () => {
    vi.stubGlobal("fetch", emptySearch());
    const out = await enrichRows(rows, "k");
    expect(out.failed).toBe(1);

    // dans les trente jours, on ne redemande rien
    const fresh = emptySearch();
    vi.stubGlobal("fetch", fresh);
    await enrichRows(rows, "k");
    expect(fresh.mock.calls.length).toBe(0);

    // au-delà, l'échec est oublié et la recherche repart
    const stale = cache();
    const [k] = Object.keys(stale);
    stale[k] = { miss: Date.now() - 31 * 24 * 3600 * 1000 };
    localStorage.setItem(CACHE_KEY, JSON.stringify(stale));

    vi.stubGlobal("fetch", okFetch());
    expect((await enrichRows(rows, "k")).resolved).toBe(1);
  });

  it("retente les échecs mémorisés par les versions précédentes (null sans date)", async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ "le samouraï|1967": null }));
    vi.stubGlobal("fetch", okFetch());
    expect((await enrichRows(rows, "k")).resolved).toBe(1);
  });
});

/* Le flux Letterboxd donne l'identifiant TMDB de chaque séance. Le
   chercher quand même serait un appel de trop, et surtout `searchMovie`
   retient le PREMIER résultat sans comparer les titres — c'est de là que
   viennent les faux positifs, et un identifiant n'en produit aucun. */
describe("enrichRows — quand la ligne porte déjà son identifiant", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const parId = [{ title: "Le Samouraï", year: 1967, tmdbId: 42 }];

  it("va droit au détail, sans passer par la recherche", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const out = await enrichRows(parId, "k");
    expect(out.resolved).toBe(1);
    expect(out.rows[0].director).toBe("Jean-Pierre Melville");

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("/search/movie"))).toBe(false);
    // un seul appel là où le titre en demandait deux
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/movie/42");
  });

  it("mémorise sous l'identifiant et ne redemande rien", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    await enrichRows(parId, "k");
    expect(Object.keys(cache())).toEqual(["id:42"]);

    const calls = fetchMock.mock.calls.length;
    await enrichRows(parId, "k");
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  /* Deux films peuvent porter le même titre la même année. Sous une clé
     de titre, le second prendrait le réalisateur et l'affiche du
     premier — sans que rien ne le signale. */
  it("ne confond pas deux homonymes de la même année", async () => {
    vi.stubGlobal("fetch", okFetch());
    await enrichRows(
      [
        { title: "Carrie", year: 1976, tmdbId: 11 },
        { title: "Carrie", year: 1976, tmdbId: 22 },
      ],
      "k"
    );
    expect(Object.keys(cache()).sort()).toEqual(["id:11", "id:22"]);
  });
});

/* ------------------------------------------------------------
   LA RÉCOLTE DU CASTING
   ------------------------------------------------------------ */

/* Une réponse complète : générique fourni, équipe mêlée de métiers
   qu'on ne retient pas. */
const castFetch = () =>
  vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      String(url).includes("/search/movie")
        ? { results: [{ id: 42 }] }
        : {
            id: 42,
            genres: [],
            release_date: "1967-10-25",
            credits: {
              crew: [
                { job: "Director", name: "Melville" },
                { job: "Director of Photography", name: "Decaë" },
                { job: "Original Music Composer", name: "Rubinstein" },
                { job: "Screenplay", name: "Melville" },
                { job: "Third Assistant Editor", name: "Person" },
              ],
              cast: Array.from({ length: 20 }, (_, i) => ({ name: `Acteur ${i}` })),
            },
          },
  }));

describe("enrichRows — casting", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("ne retient que les huit premiers rôles", async () => {
    vi.stubGlobal("fetch", castFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].cast).toHaveLength(8);
    expect(out[0].cast[0]).toBe("Acteur 0");
    expect(out[0].cast[7]).toBe("Acteur 7");
  });

  it("range l'équipe par métier, et jette les métiers qu'on ne suit pas", async () => {
    vi.stubGlobal("fetch", castFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].crew).toEqual({
      image: ["Decaë"],
      musique: ["Rubinstein"],
      scénario: ["Melville"],
    });
  });

  /* Le cache d'avant la récolte ne porte ni `cast` ni `crew`. Il était
     servi tel quel, et la fiche ressortait aussi vide qu'elle était
     entrée — d'où « compléter les fiches ne fait rien » : l'appel avait
     bien lieu, mais il revenait du `localStorage`. Une entrée d'une
     forme périmée n'est pas une réponse : on la jette et on redemande. */
  it("redemande une entrée mémorisée avant la récolte, au lieu de la servir tronquée", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ "le samouraï|1967": { tmdbId: 42, director: "Melville", genres: [] } })
    );
    const fetchMock = castFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).toHaveBeenCalled();
    expect(out[0].cast).toHaveLength(8);
    expect(out[0].crew).toMatchObject({ image: ["Decaë"] });
  });

  it("n'invente pas d'équipe quand TMDB n'en donne pas", async () => {
    vi.stubGlobal("fetch", okFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].cast).toEqual([]);
    expect(out[0].crew).toEqual({});
  });
});

/* ------------------------------------------------------------
   DURÉE, LANGUE, PAYS, NOTE DU PUBLIC
   ------------------------------------------------------------ */
const detailsFetch = (extra) =>
  vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () =>
      String(url).includes("/search/movie")
        ? { results: [{ id: 42 }] }
        : {
            id: 42,
            genres: [],
            release_date: "1967-10-25",
            credits: { crew: [], cast: [] },
            ...extra,
          },
  }));

describe("enrichRows — durée, langue, pays, note", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("récolte les quatre champs", async () => {
    vi.stubGlobal(
      "fetch",
      detailsFetch({
        runtime: 105,
        original_language: "fr",
        production_countries: [{ iso_3166_1: "FR" }, { iso_3166_1: "IT" }],
        vote_average: 7.6,
      })
    );
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0]).toMatchObject({
      runtime: 105,
      language: "fr",
      countries: ["FR", "IT"],
      tmdbRating: 7.6,
    });
  });

  it("ne garde que deux pays d'une coproduction qui en aligne six", async () => {
    vi.stubGlobal(
      "fetch",
      detailsFetch({
        production_countries: ["FR", "IT", "DE", "BE", "CH", "LU"].map((c) => ({ iso_3166_1: c })),
      })
    );
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].countries).toEqual(["FR", "IT"]);
  });

  /* TMDB rend 0 pour une durée qu'il ignore. Le garder ferait entrer un
     zéro dans les moyennes de l'almanach sans qu'on sache pourquoi. */
  it("traduit une durée de zéro en « inconnue »", async () => {
    vi.stubGlobal("fetch", detailsFetch({ runtime: 0, vote_average: 0 }));
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].runtime).toBeNull();
    expect(out[0].tmdbRating).toBeNull();
  });

  /* Le pays manquait sur presque toute la collection pour cette seule
     raison : ces champs sont arrivés après les entrées qui les
     attendaient, et le cache servait les vieilles réponses sans savoir
     qu'il était en retard. */
  it("redemande une entrée mémorisée avant ces champs", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ "le samouraï|1967": { tmdbId: 42, director: "Melville", genres: [] } })
    );
    const fetchMock = detailsFetch({
      runtime: 105,
      original_language: "fr",
      production_countries: [{ iso_3166_1: "FR" }],
      vote_average: 8.2,
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).toHaveBeenCalled();
    expect(out[0]).toMatchObject({
      runtime: 105,
      language: "fr",
      countries: ["FR"],
      tmdbRating: 8.2,
    });
  });

  /* Une entrée de la forme courante, elle, reste servie sans un appel :
     le cache garde sa raison d'être. */
  it("sert sans redemander une entrée de la forme courante", async () => {
    vi.stubGlobal("fetch", detailsFetch({ runtime: 105 }));
    await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    const fetchMock = detailsFetch({ runtime: 105 });
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out[0].runtime).toBe(105);
  });
});

/* ============================================================
   LES MOTS-CLÉS — « absent » n'est PAS « vide »
   ============================================================

   Confondre les deux a figé des collections entières. Une réponse où la
   ressource jointe n'est pas revenue devenait `[]`, c'est-à-dire une
   AFFIRMATION — « on a demandé, ce film n'en a pas ». Or tout ce qui
   répare (`isIncomplete`, la fiche ouverte, la fusion d'import) ne vise
   que l'absence : la fiche devenait irréparable, sans qu'aucune erreur
   ne soit levée nulle part. */
describe("enrichRows — les mots-clés", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const détail = (extra) =>
    vi.fn(async (url) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () =>
        String(url).includes("/search/movie")
          ? { results: [{ id: 42, title: "Le Samouraï", release_date: "1967-10-25" }] }
          : String(url).includes("/keywords")
            ? { keywords: [{ id: 7, name: "de secours" }] }
            : { id: 42, release_date: "1967-10-25", credits: { crew: [] }, ...extra },
    }));

  it("rapporte les mots-clés de la ressource jointe", async () => {
    vi.stubGlobal("fetch", détail({ keywords: { keywords: [{ id: 1, name: "hitman" }] } }));
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toEqual(["hitman"]);
  });

  /* Présent mais vide : c'est une vraie réponse. On l'écrit, et la fiche
     ne sera plus redemandée — sans quoi « compléter » boucle sans fin. */
  it("garde la liste vide quand TMDB dit qu'il n'y en a pas", async () => {
    vi.stubGlobal("fetch", détail({ keywords: { keywords: [] } }));
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toEqual([]);
  });

  /* Absent : on ne sait pas. On retombe sur l'endpoint dédié plutôt que
     d'inventer une réponse. */
  it("retombe sur l'endpoint dédié quand la ressource jointe manque", async () => {
    vi.stubGlobal("fetch", détail({}));
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toEqual(["de secours"]);
  });

  /* Et si le repli échoue à son tour, on rend `undefined` — jamais `[]`.
     C'est ce qui laisse la fiche réparable. */
  it("rend « on ne sait pas » plutôt qu'une liste vide quand tout échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () =>
          String(url).includes("/search/movie")
            ? { results: [{ id: 42, title: "Le Samouraï", release_date: "1967-10-25" }] }
            : String(url).includes("/keywords")
              ? { keywords: [] }
              : { id: 42, release_date: "1967-10-25", credits: { crew: [] } },
      }))
    );
    const out = await enrichRows(rows, "k");
    expect(out.rows[0].keywords).toBeUndefined();
  });
});

/* ============================================================
   PAR SOI, OU PAR LE SERVEUR

   L'aiguillage est la seule ligne de tout le classeur qui décide si une
   requête part chez TMDB avec une clé, ou chez notre serveur avec un
   cookie. Elle ne se voit pas à l'usage — les deux chemins rendent la
   même chose — et se casserait donc en silence.
   ============================================================ */
describe("le relais du serveur", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const réponse = (status, corps = {}, entetes = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(entetes),
    json: async () => corps,
  });

  it("passe par le serveur, sans clé, avec le cookie", async () => {
    const appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts) => {
        appels.push({ url: String(url), opts });
        return réponse(200, {});
      })
    );

    expect((await checkApiKey(VIA_SERVER)).ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0].url).toContain("/tmdb/configuration");
    expect(appels[0].url).not.toContain("api.themoviedb.org");
    /* La clé du serveur est la sienne : on n'a rien à envoyer, et
       envoyer quelque chose serait envoyer la clé de quelqu'un vers un
       endroit qui n'en veut pas. */
    expect(appels[0].url).not.toContain("api_key");
    /* Sans cette ligne, le serveur voit un inconnu : le cookie vient
       d'une autre origine que la page. */
    expect(appels[0].opts?.credentials).toBe("include");
  });

  it("redescend sur la clé posée quand le relais se récuse", async () => {
    /* 401 : la session a expiré pendant que l'onglet dormait. 503 : le
       serveur tourne sans clé de son côté. Ni l'un ni l'autre ne dit
       que TMDB n'a rien — et une clé dort peut-être à côté. */
    for (const code of [401, 403, 503]) {
      setTmdbKey("la-mienne");
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return String(url).includes("/tmdb/") ? réponse(code) : réponse(200, {});
        })
      );

      expect((await checkApiKey(VIA_SERVER)).ok, `code ${code}`).toBe(true);
      expect(appels, `code ${code}`).toHaveLength(2);
      expect(appels[1]).toContain("api.themoviedb.org");
      expect(appels[1]).toContain("api_key=la-mienne");
      setTmdbKey("");
    }
  });

  it("ne contourne PAS un chemin que le relais ne connaît pas", async () => {
    /* Un 404 du relais est une liste à corriger, pas un incident à
       rattraper : repartir en douce vers TMDB rendrait le défaut
       invisible pour toujours. */
    setTmdbKey("la-mienne");
    const appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        appels.push(String(url));
        return réponse(404);
      })
    );

    expect((await checkApiKey(VIA_SERVER)).ok).toBe(false);
    expect(appels).toHaveLength(1);
  });

  /* ============================================================
     LE 429 DU RELAIS, ET LE TEMPS QU'IL FAUT VRAIMENT ATTENDRE
     ============================================================

     Le relais a son propre plafond par minute, et « compléter les
     fiches » le franchit forcément : c'est un travail long, une requête
     par film, cinq à la fois. Le 429 est donc NORMAL sur ce chemin — ce
     qui ne l'était pas, c'est la suite.

     La voie du relais attendait une seconde, puis deux, puis trois, en
     dur, sans lire `retry-after`. Sur une fenêtre d'une minute, les
     trois essais retombaient dans la fenêtre qui venait de les
     rejeter : trois refus, et le remplissage s'arrêtait là. */
  it("attend le délai que le relais annonce, et non une seconde inventée", async () => {
    vi.useFakeTimers();
    try {
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return appels.length === 1 ? réponse(429, {}, { "retry-after": "47" }) : réponse(200, {});
        })
      );

      const promesse = checkApiKey(VIA_SERVER);
      /* Une seconde ne suffit plus : c'était exactement le défaut. */
      await vi.advanceTimersByTimeAsync(1500);
      expect(appels).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(46_000);
      expect(appels).toHaveLength(2);
      expect((await promesse).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  /* L'en-tête peut manquer — un serveur qui ne le pose pas, ou une
     réponse d'une autre origine dont il n'est pas exposé. On retombe
     alors sur l'escalier plutôt que de renoncer. */
  it("retombe sur une attente en escalier quand rien n'est annoncé", async () => {
    vi.useFakeTimers();
    try {
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return appels.length === 1 ? réponse(429) : réponse(200, {});
        })
      );

      const promesse = checkApiKey(VIA_SERVER);
      await vi.advanceTimersByTimeAsync(1500);
      expect(appels).toHaveLength(2);
      expect((await promesse).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  /* Un délai déraisonnable ne doit pas retenir un remplissage entier sur
     une seule fiche : on rend la main plutôt que de dormir une heure. */
  it("ne dort jamais plus d'une minute, quoi qu'on lui dise", async () => {
    vi.useFakeTimers();
    try {
      const appels = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url) => {
          appels.push(String(url));
          return appels.length === 1
            ? réponse(429, {}, { "retry-after": "3600" })
            : réponse(200, {});
        })
      );

      const promesse = checkApiKey(VIA_SERVER);
      await vi.advanceTimersByTimeAsync(61_000);
      expect(appels).toHaveLength(2);
      expect((await promesse).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sans compte ni relais, rien ne change", async () => {
    const appels = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        appels.push(String(url));
        return réponse(200, {});
      })
    );

    await checkApiKey("la-mienne");
    expect(appels[0]).toContain("api.themoviedb.org");
    expect(appels[0]).toContain("api_key=la-mienne");
  });
});
