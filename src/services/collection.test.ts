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

const { chargerFilms, enregistrerFilms, oublierLeCache, CLÉ } = await import("./collection");
const { makeFilm } = await import("../domain/film");

const fiche = (p: Record<string, unknown> = {}) => makeFilm({ title: "Playtime", ...p });

beforeEach(() => {
  coffre.clear();
  refuse = false;
  localStorage.clear();
  oublierLeCache([]);
});

afterEach(() => {
  localStorage.clear();
});

describe("le déménagement", () => {
  it("descend dans le coffre ce qu'il trouve en haut, et libère la place", async () => {
    const avant = [fiche({ id: "a", title: "Stalker" })];
    localStorage.setItem(CLÉ, JSON.stringify(avant));

    const chargés = await chargerFilms();
    expect(chargés).toHaveLength(1);
    expect(chargés[0]!.title).toBe("Stalker");
    expect(coffre.get(CLÉ)).toHaveLength(1);
    /* La copie du haut occupait la place qui manquait : elle part une
       fois — et seulement une fois — que le coffre a pris. */
    expect(localStorage.getItem(CLÉ)).toBeNull();
  });

  it("lit le coffre en premier : la copie du haut est un fantôme", async () => {
    coffre.set(CLÉ, [fiche({ id: "a", title: "Le Trou" })]);
    localStorage.setItem(CLÉ, JSON.stringify([fiche({ id: "z", title: "effacé hier" })]));

    const chargés = await chargerFilms();
    expect(chargés.map((f) => f.title)).toEqual(["Le Trou"]);
  });

  it("un classeur vide ne déclenche pas d'écriture", async () => {
    expect(await chargerFilms()).toEqual([]);
    expect(coffre.has(CLÉ)).toBe(false);
  });
});

describe("la date de modification", () => {
  it("ne bouge que sur la fiche qui a changé", async () => {
    const a = fiche({ id: "a", updatedAt: 1000 });
    const b = fiche({ id: "b", updatedAt: 1000 });
    oublierLeCache([a, b]);

    const datés = await enregistrerFilms([{ ...a, rating: 5 }, b]);
    expect(datés[0]!.updatedAt).toBeGreaterThan(1000);
    expect(datés[1]!.updatedAt).toBe(1000);
    /* Mieux : la fiche intacte est le MÊME objet, sans quoi toutes les
       vues mémoïsées se referaient à chaque frappe. */
    expect(datés[1]).toBe(b);
  });

  it("une recopie sans changement de valeur ne date rien", async () => {
    const a = fiche({ id: "a", updatedAt: 1000 });
    oublierLeCache([a]);
    /* Ce que fait toute l'application : `films.map(f => ({...f}))`. */
    const datés = await enregistrerFilms([{ ...a }]);
    expect(datés[0]!.updatedAt).toBe(1000);
  });

  it("une fiche neuve porte sa date dès la première écriture", async () => {
    oublierLeCache([]);
    const datés = await enregistrerFilms([fiche({ id: "neuf", updatedAt: 0 })]);
    expect(datés[0]!.updatedAt).toBeGreaterThan(0);
  });

  it("les fiches d'avant gardent leur date d'ajout, et ne se disent pas fraîches", async () => {
    /* Sinon, à la première synchronisation, TOUTE la collection se
       prétendrait modifiée à l'instant et écraserait ce qui vient d'en
       face. */
    localStorage.setItem(CLÉ, JSON.stringify([{ id: "vieux", title: "Persona", addedAt: 42 }]));
    const chargés = await chargerFilms();
    expect(chargés[0]!.updatedAt).toBe(42);
  });
});

describe("quand le coffre se refuse", () => {
  it("la collection reste écrite, en haut, plutôt que perdue", async () => {
    refuse = true;
    oublierLeCache([]);
    await enregistrerFilms([fiche({ id: "a", title: "Yi Yi" })]);
    const écrit = JSON.parse(localStorage.getItem(CLÉ) || "[]");
    expect(écrit).toHaveLength(1);
    expect(écrit[0].title).toBe("Yi Yi");
  });

  it("et se recharge de là où elle a été écrite", async () => {
    refuse = true;
    oublierLeCache([]);
    await enregistrerFilms([fiche({ id: "a", title: "Cléo" })]);
    oublierLeCache([]);
    const chargés = await chargerFilms();
    expect(chargés.map((f) => f.title)).toEqual(["Cléo"]);
  });
});
