import { describe, it, expect } from "vitest";
import { fusionner, àEnvoyer, type FicheDistante } from "./fusion";
import { makeFilm } from "./film";
import type { Film } from "../types";

/* La fusion est le seul endroit du projet où une erreur EFFACE quelque
   chose que quelqu'un a écrit. Elle se teste donc sur les cas qui font
   perdre : la version périmée qui revient, l'effacement en retard, et
   la séance connue d'un seul côté. */

const fiche = (p: Partial<Film> = {}): Film =>
  makeFilm({ id: "f1", title: "Playtime", updatedAt: 1000, ...p });

const venue = (p: Partial<FicheDistante> = {}): FicheDistante => ({
  id: "f1",
  majLe: 2000,
  donnees: { title: "Playtime" },
  ...p,
});

describe("qui gagne", () => {
  it("la version la plus récente, et c'est tout l'arbitrage", () => {
    const { films, bilan } = fusionner(
      [fiche({ title: "ici", updatedAt: 1000 })],
      [venue({ majLe: 2000, donnees: { title: "là-bas" } })]
    );
    expect(films[0]!.title).toBe("là-bas");
    expect(films[0]!.updatedAt).toBe(2000);
    expect(bilan.remplacees).toBe(1);
  });

  it("une version plus ancienne ne remonte pas le temps", () => {
    const { films, bilan } = fusionner(
      [fiche({ title: "ici", updatedAt: 5000 })],
      [venue({ majLe: 1000, donnees: { title: "vieux" } })]
    );
    expect(films[0]!.title).toBe("ici");
    expect(bilan.gardees).toBe(1);
  });

  it("à égalité stricte, on ne touche à rien", () => {
    /* Deux horloges ne sont jamais d'accord : ne rien faire est le seul
       arbitrage qui ne surprenne personne. */
    const local = fiche({ title: "ici", updatedAt: 3000 });
    const { films } = fusionner([local], [venue({ majLe: 3000, donnees: { title: "là-bas" } })]);
    expect(films[0]!.title).toBe("ici");
  });

  it("une fiche inconnue entre avec la date du serveur", () => {
    /* Sans cette date, la comparaison suivante la croirait plus fraîche
       que tout et la renverrait au serveur pour rien. */
    const { films, bilan } = fusionner([], [venue({ id: "neuve", majLe: 7000 })]);
    expect(films[0]!.updatedAt).toBe(7000);
    expect(bilan.ajoutees).toBe(1);
  });

  it("ce qui n'a pas bougé reste le même objet", () => {
    /* Les vues sont mémoïsées sur l'identité : tout recopier referait
       l'étagère entière à chaque synchronisation. */
    const intacte = fiche({ id: "autre", updatedAt: 9000 });
    const { films } = fusionner([intacte, fiche()], [venue({ majLe: 2000 })]);
    expect(films.find((f) => f.id === "autre")).toBe(intacte);
  });
});

describe("les séances s'additionnent", () => {
  it("une soirée connue d'un seul côté n'est pas effacée par l'autre", () => {
    const local = fiche({
      updatedAt: 5000,
      watches: [{ date: "2024-01-01", rating: 4 }],
    });
    const { films } = fusionner(
      [local],
      [
        venue({
          majLe: 9000,
          donnees: { title: "Playtime", watches: [{ date: "2024-06-15", rating: 5 }] },
        }),
      ]
    );
    expect(films[0]!.watches.map((w) => w.date)).toEqual(["2024-06-15", "2024-01-01"]);
    expect(films[0]!.watchedAt).toBe("2024-06-15");
  });

  it("même quand c'est la version locale qui gagne", () => {
    /* Une séance est un FAIT, pas une opinion : elle entre même si le
       reste de la fiche ne change pas. */
    const local = fiche({ updatedAt: 9000, watches: [{ date: "2024-01-01", rating: 4 }] });
    const { films, bilan } = fusionner(
      [local],
      [venue({ majLe: 1000, donnees: { watches: [{ date: "2023-05-05", rating: 3 }] } })]
    );
    expect(films[0]!.watches.map((w) => w.date)).toEqual(["2024-01-01", "2023-05-05"]);
    expect(bilan.gardees).toBe(1);
  });
});

describe("les effacements", () => {
  it("une fiche effacée ailleurs s'en va", () => {
    const { films, bilan } = fusionner(
      [fiche({ updatedAt: 1000 })],
      [venue({ majLe: 2000, supprimee: true })]
    );
    expect(films).toHaveLength(0);
    expect(bilan.effacees).toBe(1);
  });

  it("un effacement en retard n'emporte pas ce qu'on vient d'écrire", () => {
    const { films, bilan } = fusionner(
      [fiche({ title: "note de ce matin", updatedAt: 8000 })],
      [venue({ majLe: 2000, supprimee: true })]
    );
    expect(films).toHaveLength(1);
    expect(films[0]!.title).toBe("note de ce matin");
    expect(bilan.gardees).toBe(1);
  });

  it("l'effacement d'une fiche qu'on n'a jamais eue ne fait rien", () => {
    const { films, bilan } = fusionner([], [venue({ id: "jamais-vue", supprimee: true })]);
    expect(films).toEqual([]);
    expect(bilan.effacees).toBe(0);
  });
});

describe("ce qu'il reste à envoyer", () => {
  it("les fiches modifiées ici, et elles seules", () => {
    const envois = àEnvoyer([fiche({ id: "intacte" }), fiche({ id: "touchee" })], [], ["touchee"]);
    expect(envois.map((e) => e.id)).toEqual(["touchee"]);
  });

  it("les pierres tombales partent avec", () => {
    /* Sans elles, une fiche effacée ici revient au prochain tirage. */
    const envois = àEnvoyer([], [{ id: "partie", le: 4000 }], ["partie"]);
    expect(envois).toEqual([
      { id: "partie", tmdbId: null, majLe: 4000, supprimee: true, donnees: {} },
    ]);
  });

  it("rien à dire quand rien n'a bougé", () => {
    expect(àEnvoyer([fiche()], [{ id: "x", le: 500 }], [])).toEqual([]);
  });
});
