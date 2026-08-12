import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/* ============================================================
   LE DÉPÔT, ÉPROUVÉ SUR SES TROIS PROMESSES

   Descendre dans le coffre sans rien perdre, dater ce qui a changé et
   rien d'autre, et ne jamais abandonner la collection quand le coffre
   se refuse. Aucune des trois ne se voit à l'écran, et les trois se
   paieraient cher.

   jsdom n'a pas d'IndexedDB : on double `src/db`, ce qui a l'avantage de
   pouvoir ensuite le faire échouer à volonté — un mode privé de
   navigateur ne se simule pas autrement.
   ============================================================ */

const coffre = new Map<string, unknown>();
let refuse = false;

vi.mock("../db", () => ({
  getDoc: async (k: string) => {
    if (refuse) throw new Error("coffre ferme");
    return coffre.get(k);
  },
  putDoc: async (k: string, v: unknown) => {
    if (refuse) throw new Error("coffre ferme");
    coffre.set(k, v);
  },
}));

const { loadFilms, saveFilms, forgetCache, knownGraves, FILMS_KEY } = await import("./collection");
const { makeFilm } = await import("../domain/film");

const fiche = (p: Record<string, unknown> = {}) => makeFilm({ title: "Playtime", ...p });

beforeEach(() => {
  coffre.clear();
  refuse = false;
  localStorage.clear();
  forgetCache([]);
});

afterEach(() => {
  localStorage.clear();
});

describe("the move into the vault", () => {
  it("descend dans le coffre ce qu'il trouve en haut, et libère la place", async () => {
    const avant = [fiche({ id: "a", title: "Stalker" })];
    localStorage.setItem(FILMS_KEY, JSON.stringify(avant));

    const chargés = await loadFilms();
    expect(chargés).toHaveLength(1);
    expect(chargés[0]!.title).toBe("Stalker");
    expect(coffre.get(FILMS_KEY)).toHaveLength(1);
    /* La copie du haut occupait la place qui manquait : elle part une
       fois — et seulement une fois — que le coffre a pris. */
    expect(localStorage.getItem(FILMS_KEY)).toBeNull();
  });

  it("lit le coffre en premier : la copie du haut est un fantôme", async () => {
    coffre.set(FILMS_KEY, [fiche({ id: "a", title: "Le Trou" })]);
    localStorage.setItem(FILMS_KEY, JSON.stringify([fiche({ id: "z", title: "effacé hier" })]));

    const chargés = await loadFilms();
    expect(chargés.map((f) => f.title)).toEqual(["Le Trou"]);
  });

  it("un classeur vide ne déclenche pas d'écriture", async () => {
    expect(await loadFilms()).toEqual([]);
    expect(coffre.has(FILMS_KEY)).toBe(false);
  });
});

describe("the modification date", () => {
  it("ne bouge que sur la fiche qui a changé", async () => {
    const a = fiche({ id: "a", updatedAt: 1000 });
    const b = fiche({ id: "b", updatedAt: 1000 });
    forgetCache([a, b]);

    const datés = await saveFilms([{ ...a, rating: 5 }, b]);
    expect(datés[0]!.updatedAt).toBeGreaterThan(1000);
    expect(datés[1]!.updatedAt).toBe(1000);
    /* Mieux : la fiche intacte est le MÊME objet, sans quoi toutes les
       vues mémoïsées se referaient à chaque frappe. */
    expect(datés[1]).toBe(b);
  });

  it("une recopie sans changement de valeur ne date rien", async () => {
    const a = fiche({ id: "a", updatedAt: 1000 });
    forgetCache([a]);
    /* Ce que fait toute l'application : `films.map(f => ({...f}))`. */
    const datés = await saveFilms([{ ...a }]);
    expect(datés[0]!.updatedAt).toBe(1000);
  });

  it("une fiche neuve porte sa date dès la première écriture", async () => {
    forgetCache([]);
    const datés = await saveFilms([fiche({ id: "neuf", updatedAt: 0 })]);
    expect(datés[0]!.updatedAt).toBeGreaterThan(0);
  });

  it("les fiches d'avant gardent leur date d'ajout, et ne se disent pas fraîches", async () => {
    /* Sinon, à la première synchronisation, TOUTE la collection se
       prétendrait modifiée à l'instant et écraserait ce qui vient d'en
       face. */
    localStorage.setItem(
      FILMS_KEY,
      JSON.stringify([{ id: "vieux", title: "Persona", addedAt: 42 }])
    );
    const chargés = await loadFilms();
    expect(chargés[0]!.updatedAt).toBe(42);
  });
});

describe("when the vault refuses", () => {
  it("la collection reste écrite, en haut, plutôt que perdue", async () => {
    refuse = true;
    forgetCache([]);
    await saveFilms([fiche({ id: "a", title: "Yi Yi" })]);
    const écrit = JSON.parse(localStorage.getItem(FILMS_KEY) || "[]");
    expect(écrit).toHaveLength(1);
    expect(écrit[0].title).toBe("Yi Yi");
  });

  it("et se recharge de là où elle a été écrite", async () => {
    refuse = true;
    forgetCache([]);
    await saveFilms([fiche({ id: "a", title: "Cléo" })]);
    forgetCache([]);
    const chargés = await loadFilms();
    expect(chargés.map((f) => f.title)).toEqual(["Cléo"]);
  });
});

/* ============================================================
   TOMBSTONES WRITTEN BEFORE THE TRANSLATION

   `Grave.le` became `Grave.at`, and a tombstone is written to disk.
   Reading only the new spelling would drop every one of them — and each
   of those deleted cards would come back on the first pull from a device
   that still has it. That is precisely the hole tombstones exist to
   plug.
   ============================================================ */
describe("tombstones written before the translation", () => {
  it("reads back a stone written with `le`", async () => {
    localStorage.setItem("films-effaces", JSON.stringify([{ id: "parti", le: 1234 }]));
    await loadFilms();
    expect(knownGraves()).toEqual([{ id: "parti", at: 1234 }]);
  });

  it("reads back a stone already written with `at`", async () => {
    localStorage.setItem("films-effaces", JSON.stringify([{ id: "parti", at: 99 }]));
    await loadFilms();
    expect(knownGraves()).toEqual([{ id: "parti", at: 99 }]);
  });

  it("drops a stone with no readable date rather than keeping it mute", async () => {
    localStorage.setItem(
      "films-effaces",
      JSON.stringify([{ id: "bancal" }, { le: 5 }, { id: "bon", le: 7 }])
    );
    await loadFilms();
    expect(knownGraves()).toEqual([{ id: "bon", at: 7 }]);
  });

  it("survives a store that does not hold a list", async () => {
    localStorage.setItem("films-effaces", JSON.stringify({ pas: "une liste" }));
    await loadFilms();
    expect(knownGraves()).toEqual([]);
  });
});
