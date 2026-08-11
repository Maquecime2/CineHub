import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { store, flush, KEYS } from "./storage";

describe("l'écriture différée", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    flush();
    vi.useRealTimers();
  });

  it("n'écrit pas tout de suite", () => {
    store.setSoon(KEYS.films, [{ id: "a" }]);
    expect(localStorage.getItem(KEYS.films)).toBeNull();
    expect(store.enAttente()).toBe(1);
  });

  it("écrit après le délai", () => {
    store.setSoon(KEYS.films, [{ id: "a" }]);
    vi.advanceTimersByTime(500);
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual([{ id: "a" }]);
    expect(store.enAttente()).toBe(0);
  });

  /* C'est tout l'objet du module : dix éditions d'affilée sur une
     collection de cinq cents fiches ne doivent faire qu'une écriture. */
  it("fond dix écritures en une, et garde la dernière", () => {
    const espion = vi.spyOn(Storage.prototype, "setItem");
    for (let i = 0; i < 10; i++) store.setSoon(KEYS.films, [{ id: `v${i}` }]);
    vi.advanceTimersByTime(500);
    expect(espion).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual([{ id: "v9" }]);
    espion.mockRestore();
  });

  it("garde les clés distinctes séparées", () => {
    store.setSoon(KEYS.films, ["f"]);
    store.setSoon(KEYS.notes, ["n"]);
    vi.advanceTimersByTime(500);
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual(["f"]);
    expect(JSON.parse(localStorage.getItem(KEYS.notes)!)).toEqual(["n"]);
  });

  /* Le vidage est ce qui rend le report sûr : sans lui, différer
     reviendrait à parier que l'onglet restera ouvert. */
  it("écrit tout de suite quand on vide à la main", () => {
    store.setSoon(KEYS.films, ["urgent"]);
    flush();
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual(["urgent"]);
  });

  it("ne fait rien quand il n'y a rien à vider", () => {
    const espion = vi.spyOn(Storage.prototype, "setItem");
    flush();
    expect(espion).not.toHaveBeenCalled();
    espion.mockRestore();
  });

  it("écrit ce qui attend quand l'onglet passe en arrière-plan", () => {
    store.setSoon(KEYS.films, ["caché"]);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(JSON.parse(localStorage.getItem(KEYS.films)!)).toEqual(["caché"]);
  });

  it("relit ce qu'il vient d'écrire", () => {
    store.setSoon(KEYS.films, [{ id: "a" }]);
    flush();
    expect(store.get(KEYS.films, [])).toEqual([{ id: "a" }]);
  });
});

describe("la lecture", () => {
  beforeEach(() => localStorage.clear());

  it("rend le repli quand la clé n'existe pas", () => {
    expect(store.get("absente", "repli")).toBe("repli");
  });

  it("rend le repli plutôt que de lever sur du JSON abîmé", () => {
    localStorage.setItem("cassée", "{ceci n'est pas du json");
    expect(store.get("cassée", [])).toEqual([]);
  });
});
