import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { enrichRows } from "./tmdb";

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
                { job: "Third Assistant Editor", name: "Personne" },
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

  /* Le cache d'avant la récolte ne porte ni `cast` ni `crew`. Il ne doit
     pas laisser filtrer `undefined` jusqu'à la fiche : tout le reste du
     code compte sur une liste, fût-elle vide. */
  it("rend des listes vides pour une entrée mémorisée avant la récolte", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ "le samouraï|1967": { tmdbId: 42, director: "Melville", genres: [] } })
    );
    const fetchMock = castFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out[0].cast).toEqual([]);
    expect(out[0].crew).toEqual({});
  });

  it("n'invente pas d'équipe quand TMDB n'en donne pas", async () => {
    vi.stubGlobal("fetch", okFetch());
    const { rows: out } = await enrichRows([{ title: "Le Samouraï", year: 1967 }], "k");
    expect(out[0].cast).toEqual([]);
    expect(out[0].crew).toEqual({});
  });
});
