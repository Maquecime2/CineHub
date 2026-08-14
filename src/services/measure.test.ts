import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   Ce qui se teste ici : le SILENCE par défaut, et ce qui sort quand on
   parle.

   Le module lit son adresse au chargement (`import.meta.env`), donc on
   le réimporte à chaque cas avec l'environnement voulu — d'où les
   `vi.resetModules()` et les imports dynamiques.
   ============================================================ */

const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./measure");
};

const track = vi.fn();

beforeEach(() => {
  track.mockClear();
  vi.stubGlobal("window", { umami: { track } });
  document.head.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("sans instance réglée", () => {
  /* La règle du projet : ce qui dépend du dehors est ABSENT en son
     absence. Pas de script mort, pas de requête qui échoue en silence. */
  it("ne charge aucun script et ne rapporte rien", async () => {
    const m = await load({ VITE_UMAMI: "", VITE_UMAMI_ID: "" });
    expect(m.measuring()).toBe(false);

    m.startMeasuring();
    expect(document.head.querySelector("script")).toBeNull();

    m.pageSeen({ view: "library" });
    m.doorEvent("porte:compte-cree");
    expect(track).not.toHaveBeenCalled();
  });

  /* Une moitié de réglage n'est pas un réglage : une adresse sans
     identifiant de site chargerait un script qui ne saurait où écrire. */
  it("refuse une configuration à moitié faite", async () => {
    expect(
      (await load({ VITE_UMAMI: "https://m.exemple.fr", VITE_UMAMI_ID: "" })).measuring()
    ).toBe(false);
    expect((await load({ VITE_UMAMI: "", VITE_UMAMI_ID: "abc" })).measuring()).toBe(false);
  });
});

describe("avec une instance réglée", () => {
  const env = { VITE_UMAMI: "https://mesure.exemple.fr/ ", VITE_UMAMI_ID: " abc-123 " };

  it("nettoie l'adresse que le terminal a salie", async () => {
    const m = await load(env);
    expect(m.UMAMI).toBe("https://mesure.exemple.fr");
    expect(m.UMAMI_ID).toBe("abc-123");
  });

  it("pose le script une seule fois, en suivi manuel", async () => {
    const m = await load(env);
    m.startMeasuring();
    m.startMeasuring();

    const tags = document.head.querySelectorAll("script");
    expect(tags).toHaveLength(1);
    const tag = tags[0] as HTMLScriptElement;
    expect(tag.src).toBe("https://mesure.exemple.fr/script.js");
    expect(tag.dataset.websiteId).toBe("abc-123");
    /* SANS CETTE LIGNE, tout le soin pris dans `placeToPage` est perdu :
       le script lirait `location.href` et rapporterait l'identifiant. */
    expect(tag.dataset.autoTrack).toBe("false");
  });

  it("rapporte une vue par son adresse", async () => {
    const m = await load(env);
    m.pageSeen({ view: "watchlist" });
    expect(track).toHaveBeenCalledWith({ url: "#/a-voir" });
  });

  /* LE CAS QUI COMPTE. Ce que la mesure ne doit jamais apprendre, c'est
     quels films quelqu'un possède. */
  it("ne fait pas sortir l'identifiant d'une fiche", async () => {
    const m = await load(env);
    m.pageSeen({ view: "detail", film: "demo-mood" });
    expect(track).toHaveBeenCalledWith({ url: "#/fiche" });
    expect(JSON.stringify(track.mock.calls)).not.toContain("demo-mood");
  });

  it("rapporte un geste de la porte par son nom", async () => {
    const m = await load(env);
    m.doorEvent("porte:import-abouti");
    expect(track).toHaveBeenCalledWith("porte:import-abouti");
  });

  /* Le script est asynchrone : les premières vues le précèdent. Elles
     tombent, elles ne cassent pas. */
  it("ne casse pas quand le script n'est pas encore arrivé", async () => {
    vi.stubGlobal("window", {});
    const m = await load(env);
    expect(() => m.pageSeen({ view: "library" })).not.toThrow();
    expect(() => m.doorEvent("porte:compte-cree")).not.toThrow();
  });
});
