import { describe, it, expect } from "vitest";
import { wearOf, patinaOf, PATINA_CAP } from "./patina";
import { neglectDaysFor } from "./athome";
import { makeFilm } from "./film";
import type { Film, Watch } from "../types";

/* Une date de référence fixe : tout ce que ce module calcule est une
   durée depuis aujourd'hui, et un test qui vieillit est un test qui
   passera un jour sans que personne sache pourquoi. */
const TODAY = Date.parse("2026-08-07T12:00:00Z");
const daysAgo = (days: number): string =>
  new Date(TODAY - days * 24 * 3600 * 1000).toISOString().slice(0, 10);

const watched = (title: string, watches: Watch[], extra: Partial<Film> = {}): Film =>
  makeFilm({ title, status: "watched", watches, ...extra });

/** Le seuil sert de repère à presque tous les tests : on le nomme. */
const THRESHOLD = 400;
const wear = (film: Film, neglect = THRESHOLD) => wearOf(film, neglect, TODAY);

describe("les quatre états", () => {
  it("une fiche à voir, jamais vue, est encore sous cellophane", () => {
    expect(wear(makeFilm({ title: "En attente", status: "watchlist" })).state).toBe("sealed");
  });

  it("une séance récente est le cas ordinaire", () => {
    expect(wear(watched("Hier", [{ date: daysAgo(10), rating: 4 }])).state).toBe("fresh");
  });

  it("une séance lointaine endort le boîtier", () => {
    expect(wear(watched("Loin", [{ date: daysAgo(900), rating: 4 }])).state).toBe("dormant");
  });

  /* LE CAS QUI COMPTE. Un import Letterboxd sans dates n'est pas un film
     négligé : le classeur ne SAIT pas. Le classer « dormant » serait
     reprocher de la négligence à quelqu'un qui n'a fait que manquer de
     dates. */
  it("vue sans date n'est PAS vue il y a longtemps", () => {
    const f = watched("Sans date", [{ date: "", rating: 4 }]);
    const w = wear(f);
    expect(w.state).toBe("undated");
    expect(w.since).toBeNull();
    expect(w.times).toBe(1);
  });

  it("une fiche vue au journal vide est sans date, pas sous cellophane", () => {
    expect(wear(watched("Vue jadis", [])).state).toBe("undated");
  });

  it("une date illisible ne compte pas pour une date", () => {
    expect(wear(watched("Bancale", [{ date: "196?", rating: 4 }])).state).toBe("undated");
  });
});

describe("la frontière", () => {
  it("au seuil exact, le boîtier est endormi", () => {
    expect(wear(watched("Pile", [{ date: daysAgo(THRESHOLD), rating: 3 }])).state).toBe("dormant");
  });

  it("un jour en deçà, il ne l'est pas", () => {
    expect(wear(watched("Presque", [{ date: daysAgo(THRESHOLD - 1), rating: 3 }])).state).toBe(
      "fresh"
    );
  });

  /* Le seuil n'est pas écrit ici : il vient d'`athome`, et il est
     RELATIF à l'étendue de la pratique. Le même film est donc endormi
     dans un classeur jeune et frais dans un classeur tenu depuis dix
     ans. C'est le comportement voulu, et c'est celui qu'on garde. */
  it("le seuil vient du classeur, et il n'y en a qu'un", () => {
    const long = [
      watched("Vieux", [{ date: daysAgo(3000), rating: 4 }]),
      watched("Neuf", [{ date: daysAgo(1), rating: 4 }]),
    ];
    const neglect = neglectDaysFor(long, TODAY);
    expect(neglect).toBe(730); // le plafond d'`athome`, une pratique longue
    expect(wearOf(long[0]!, neglect, TODAY).state).toBe("dormant");
    expect(wearOf(long[1]!, neglect, TODAY).state).toBe("fresh");
  });

  it("un classeur ouvert le mois dernier n'a rien d'oublié", () => {
    const young = [watched("Récent", [{ date: daysAgo(20), rating: 4 }])];
    const neglect = neglectDaysFor(young, TODAY);
    expect(neglect).toBe(150); // le plancher d'`athome`
    expect(wearOf(young[0]!, neglect, TODAY).state).toBe("fresh");
  });
});

describe("le compte et l'état ne se disputent pas", () => {
  /* Un film vu six fois ET rouvert la dernière fois en 2019 est les deux
     à la fois. Un seul champ aurait obligé à choisir un vainqueur. */
  it("un film rouvert souvent mais plus depuis longtemps porte les deux", () => {
    const f = watched("Culte oublié", [
      { date: daysAgo(900), rating: 5 },
      { date: daysAgo(1200), rating: 5 },
      { date: daysAgo(1500), rating: 4 },
    ]);
    const w = wear(f);
    expect(w.state).toBe("dormant");
    expect(w.times).toBe(3);
  });

  it("ce qu'on n'a pas vu n'a pas de séance", () => {
    expect(wear(makeFilm({ title: "Neuf", status: "watchlist" })).times).toBe(0);
  });

  it("la dernière séance datée est la plus récente, quel que soit l'ordre écrit", () => {
    const f = watched("Désordre", [
      { date: daysAgo(1200), rating: 4 },
      { date: daysAgo(3), rating: 5 },
    ]);
    expect(wear(f).since).toBe(3);
  });

  it("une séance sans date ne masque pas celle qui en a une", () => {
    const f = watched("Mêlé", [
      { date: "", rating: 4 },
      { date: daysAgo(5), rating: 5 },
    ]);
    expect(wear(f).state).toBe("fresh");
    expect(wear(f).since).toBe(5);
  });
});

describe("la patine", () => {
  it("une seule séance n'en porte aucune", () => {
    expect(patinaOf(1)).toBe(0);
    expect(patinaOf(0)).toBe(0);
  });

  it("elle monte avec les séances", () => {
    expect(patinaOf(2)).toBeGreaterThan(patinaOf(1));
    expect(patinaOf(3)).toBeGreaterThan(patinaOf(2));
  });

  /* Au-delà du plafond elle ne se lit plus : l'œil distingue « une fois »
     de « trois fois », jamais « neuf » de « douze ». Sans plafond, un
     film revu vingt fois se lirait comme une avarie. */
  it("elle plafonne, et vingt séances ne font pas plus que quatre", () => {
    expect(patinaOf(PATINA_CAP)).toBe(1);
    expect(patinaOf(20)).toBe(1);
  });
});

describe("l'usure est semée, jamais tirée", () => {
  it("la même fiche rend deux fois le même grain", () => {
    const f = watched("Stable", [{ date: daysAgo(30), rating: 4 }]);
    expect(wear(f).grain).toBe(wear(f).grain);
  });

  it("le grain tient entre zéro et un", () => {
    for (const title of ["a", "bb", "ccc", "Rashomon", "2001"]) {
      const g = wear(makeFilm({ title })).grain;
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("deux fiches n'ont pas le même grain", () => {
    const a = wear(makeFilm({ title: "A" })).grain;
    const b = wear(makeFilm({ title: "B" })).grain;
    expect(a).not.toBe(b);
  });
});
