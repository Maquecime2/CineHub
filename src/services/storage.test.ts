import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { store, flush, KEYS, watchQuota, forgetQuotaWarning } from "./storage";

describe("the deferred write", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    flush();
    vi.useRealTimers();
  });

  it("does not write straight away", () => {
    store.setSoon(KEYS.films, [{ id: "a" }]);
    expect(localStorage.getItem(KEYS.films)).toBeNull();
    expect(store.pending()).toBe(1);
  });

  it("writes after the delay", () => {
    store.setSoon(KEYS.films, [{ id: "a" }]);
    vi.advanceTimersByTime(500);
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual([{ id: "a" }]);
    expect(store.pending()).toBe(0);
  });

  /* That is the whole point of the module: ten edits in a row on a
     collection of five hundred cards must make one write only. */
  it("melts ten writes into one, and keeps the last", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    for (let i = 0; i < 10; i++) store.setSoon(KEYS.films, [{ id: `v${i}` }]);
    vi.advanceTimersByTime(500);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual([{ id: "v9" }]);
    spy.mockRestore();
  });

  it("keeps distinct keys apart", () => {
    store.setSoon(KEYS.films, ["f"]);
    store.setSoon(KEYS.notes, ["n"]);
    vi.advanceTimersByTime(500);
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual(["f"]);
    expect(JSON.parse(localStorage.getItem(KEYS.notes)!)).toEqual(["n"]);
  });

  /* The flush is what makes deferring safe: without it, deferring would
     amount to betting the tab will stay open. */
  it("writes immediately when flushed by hand", () => {
    store.setSoon(KEYS.films, ["urgent"]);
    flush();
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual(["urgent"]);
  });

  it("does nothing when there is nothing to flush", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    flush();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("writes what is waiting when the tab goes into the background", () => {
    store.setSoon(KEYS.films, ["caché"]);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual(["caché"]);
  });

  it("reads back what it has just written", () => {
    store.setSoon(KEYS.films, [{ id: "a" }]);
    flush();
    expect(store.get(KEYS.films, [])).toEqual([{ id: "a" }]);
  });
});

describe("reading", () => {
  beforeEach(() => localStorage.clear());

  it("returns the fallback when the key does not exist", () => {
    expect(store.get("absente", "repli")).toBe("repli");
  });

  it("returns the fallback rather than throwing on damaged JSON", () => {
    localStorage.setItem("cassée", "{ceci n'est pas du json");
    expect(store.get("cassée", [])).toEqual([]);
  });
});

/* ============================================================
   L'AVERTISSEMENT DE QUOTA

   C'était un `alert()` bloquant dont la phrase était écrite en français
   dans le code. Ce module ne peut pas traduire — il est chargé avant
   l'écran — donc il SIGNALE, et l'écran parle. Ce qui se teste ici est
   le contrat de ce signal, pas la phrase.
   ============================================================ */
describe("le signal de quota", () => {
  beforeEach(() => {
    localStorage.clear();
    forgetQuotaWarning();
  });

  afterEach(() => {
    localStorage.clear();
    forgetQuotaWarning();
  });

  it("ne dit rien tant qu'on reste sous le seuil", () => {
    const heard = vi.fn();
    watchQuota(heard);
    store.set("petit", "à peine trois mots");
    expect(heard).not.toHaveBeenCalled();
  });

  it("prévient une fois passé le seuil, et une seule", () => {
    const heard = vi.fn();
    watchQuota(heard);
    const big = "x".repeat(4_100_000);
    /* On n'écrit pas vraiment quatre mégaoctets : la mesure se fait sur
       la chaîne AVANT l'écriture, et c'est elle qu'on éprouve. Le
       navigateur de test peut refuser derrière, sans changer le signal. */
    store.set("gros", big);
    store.set("gros", big);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0]![0]).toBeGreaterThan(4_000_000);
  });

  /* LE PREMIER DÉPASSEMENT PEUT PRÉCÉDER L'ÉCRAN. Le classeur écrit
     pendant son chargement ; un abonné arrivé après ne doit pas hériter
     du silence. */
  it("rejoue à qui s'abonne trop tard", () => {
    store.set("gros", "x".repeat(4_100_000));
    const heard = vi.fn();
    watchQuota(heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("se tait auprès de qui s'est désabonné", () => {
    const heard = vi.fn();
    watchQuota(heard)();
    store.set("gros", "x".repeat(4_100_000));
    expect(heard).not.toHaveBeenCalled();
  });
});
